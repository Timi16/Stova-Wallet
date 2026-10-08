import { fromBase64, randomBytes, toBase64 } from './crypto';

/**
 * Passkey unlock via WebAuthn + the PRF extension. The authenticator (Touch ID,
 * Face ID, Android biometrics, Windows Hello, a security key) returns a secret
 * that only it can produce for our salt; HKDF turns it into the key that
 * unwraps the vault's master key. Nothing about the wallet is sent anywhere:
 * the credential is created for this origin and stays on the device.
 */

export type PasskeySupport = { ok: true } | { ok: false; reason: string };

/** A passkey problem explained in plain words (the browser's own messages are not for people). */
export class PasskeyError extends Error {
  cancelled: boolean;
  constructor(message: string, cancelled = false) {
    super(message);
    this.name = 'PasskeyError';
    this.cancelled = cancelled;
  }
}

function explain(e: unknown, action: 'create' | 'get'): PasskeyError {
  if (e instanceof PasskeyError) return e;
  const name = (e as { name?: string })?.name ?? '';
  switch (name) {
    case 'NotAllowedError':
    case 'AbortError':
      return new PasskeyError(action === 'create' ? "Passkey setup was cancelled or timed out. Nothing changed; try again when you're ready." : 'Unlock was cancelled or timed out. Try again, or use your password.', true);
    case 'InvalidStateError':
      return new PasskeyError('A passkey for STOVA already exists on this device. Remove it in your device settings, or turn this off and on again to replace it.');
    case 'NotSupportedError':
      return new PasskeyError("This device can't create a passkey. Your password still works.");
    case 'SecurityError':
      return new PasskeyError('Passkeys need a secure page on a real domain (localhost or the deployed site).');
    case 'ConstraintError':
      return new PasskeyError("This authenticator can't verify it's you (no fingerprint, face or PIN set up).");
    default:
      return new PasskeyError(action === 'create' ? "Couldn't set up the passkey. Your password still works." : "Couldn't unlock with the passkey. Use your password instead.");
  }
}

function b64url(bytes: Uint8Array): string {
  return toBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64url(s: string): Uint8Array {
  return fromBase64(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
}

export function passkeySupport(): PasskeySupport {
  if (typeof window === 'undefined' || !('PublicKeyCredential' in window) || !navigator.credentials?.create) {
    return { ok: false, reason: "This browser doesn't support passkeys." };
  }
  if (!window.isSecureContext) return { ok: false, reason: 'Passkeys need a secure (HTTPS) page.' };
  const host = window.location.hostname;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(':')) {
    return { ok: false, reason: 'Passkeys need a domain name, not an IP address. Use localhost or the deployed site.' };
  }
  return { ok: true };
}

export async function platformAuthenticatorAvailable(): Promise<boolean> {
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

type PrfResults = { prf?: { enabled?: boolean; results?: { first?: ArrayBuffer } } };

/**
 * Creates a resident, user-verified passkey with PRF enabled and immediately
 * evaluates the PRF for our salt. Returns the credential id, the salt and the
 * 32-byte secret. Throws with a plain message when the browser can't do PRF.
 */
export async function createPasskey(label: string): Promise<{ credentialId: string; prfSalt: string; secret: Uint8Array }> {
  const sup = passkeySupport();
  if (!sup.ok) throw new PasskeyError(sup.reason);
  const prfSalt = randomBytes(32);
  let create: Credential | null;
  try {
    create = await navigator.credentials.create({
    publicKey: {
      challenge: randomBytes(32) as BufferSource,
      rp: { name: 'STOVA Wallet', id: window.location.hostname },
      user: { id: randomBytes(16) as BufferSource, name: label, displayName: label },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
      timeout: 120_000,
      extensions: { prf: { eval: { first: prfSalt as BufferSource } } } as AuthenticationExtensionsClientInputs,
      },
    });
  } catch (e) {
    throw explain(e, 'create');
  }
  if (!create || !('rawId' in create)) throw new PasskeyError('Passkey setup was cancelled. Nothing changed.', true);
  const cred = create as PublicKeyCredential;
  const ext = cred.getClientExtensionResults() as PrfResults;
  if (!ext.prf?.enabled && !ext.prf?.results?.first) {
    throw new PasskeyError("This device's passkeys can't be used to unlock a wallet (no PRF support). Try a newer browser or device; your password still works.");
  }
  const credentialId = b64url(new Uint8Array(cred.rawId));
  // Some platforms only return the PRF output on an assertion, not at creation.
  const secret = ext.prf?.results?.first ? new Uint8Array(ext.prf.results.first) : await assertPrf(credentialId, toBase64(prfSalt));
  return { credentialId, prfSalt: toBase64(prfSalt), secret };
}

/** Asks the authenticator (fingerprint / face / PIN) for the PRF secret of our salt. */
export async function assertPrf(credentialId: string, prfSalt: string): Promise<Uint8Array> {
  const sup = passkeySupport();
  if (!sup.ok) throw new PasskeyError(sup.reason);
  let assertion: Credential | null;
  try {
    assertion = await navigator.credentials.get({
      publicKey: {
        challenge: randomBytes(32) as BufferSource,
        rpId: window.location.hostname,
        allowCredentials: [{ type: 'public-key', id: fromB64url(credentialId) as BufferSource }],
        userVerification: 'required',
        timeout: 120_000,
        extensions: { prf: { eval: { first: fromBase64(prfSalt) as BufferSource } } } as AuthenticationExtensionsClientInputs,
      },
    });
  } catch (e) {
    throw explain(e, 'get');
  }
  if (!assertion || !('rawId' in assertion)) throw new PasskeyError('Unlock was cancelled. Try again, or use your password.', true);
  const ext = (assertion as PublicKeyCredential).getClientExtensionResults() as PrfResults;
  const first = ext.prf?.results?.first;
  if (!first) throw new PasskeyError("This passkey didn't return a key. Use your password instead.");
  return new Uint8Array(first);
}
