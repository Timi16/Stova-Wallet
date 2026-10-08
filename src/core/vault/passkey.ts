import { fromBase64, randomBytes, toBase64 } from './crypto';

/**
 * Passkey unlock via WebAuthn + the PRF extension. The authenticator (Touch ID,
 * Face ID, Android biometrics, Windows Hello, a security key) returns a secret
 * that only it can produce for our salt; HKDF turns it into the key that
 * unwraps the vault's master key. Nothing about the wallet is sent anywhere:
 * the credential is created for this origin and stays on the device.
 */

export type PasskeySupport = { ok: true } | { ok: false; reason: string };

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
  if (!sup.ok) throw new Error(sup.reason);
  const prfSalt = randomBytes(32);
  const create = await navigator.credentials.create({
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
  if (!create || !('rawId' in create)) throw new Error('Passkey creation was cancelled.');
  const cred = create as PublicKeyCredential;
  const ext = cred.getClientExtensionResults() as PrfResults;
  if (!ext.prf?.enabled && !ext.prf?.results?.first) {
    throw new Error("This authenticator can't derive keys (no PRF support). Try a different browser or device.");
  }
  const credentialId = b64url(new Uint8Array(cred.rawId));
  // Some platforms only return the PRF output on an assertion, not at creation.
  const secret = ext.prf?.results?.first ? new Uint8Array(ext.prf.results.first) : await assertPrf(credentialId, toBase64(prfSalt));
  return { credentialId, prfSalt: toBase64(prfSalt), secret };
}

/** Asks the authenticator (fingerprint / face / PIN) for the PRF secret of our salt. */
export async function assertPrf(credentialId: string, prfSalt: string): Promise<Uint8Array> {
  const sup = passkeySupport();
  if (!sup.ok) throw new Error(sup.reason);
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: randomBytes(32) as BufferSource,
      rpId: window.location.hostname,
      allowCredentials: [{ type: 'public-key', id: fromB64url(credentialId) as BufferSource }],
      userVerification: 'required',
      timeout: 120_000,
      extensions: { prf: { eval: { first: fromBase64(prfSalt) as BufferSource } } } as AuthenticationExtensionsClientInputs,
    },
  });
  if (!assertion || !('rawId' in assertion)) throw new Error('Unlock was cancelled.');
  const ext = (assertion as PublicKeyCredential).getClientExtensionResults() as PrfResults;
  const first = ext.prf?.results?.first;
  if (!first) throw new Error("This authenticator didn't return a key. Use your password instead.");
  return new Uint8Array(first);
}
