import { SECURITY } from '@/config';

/**
 * Browser-native encryption only. PBKDF2-SHA256 (600k iterations, random
 * 16-byte salt) derives an AES-256-GCM key; a random 12-byte IV per encrypt.
 * Nothing here is hand-rolled: it is all WebCrypto.
 */

const subtle = () => {
  const c = globalThis.crypto?.subtle;
  if (!c) throw new Error('WebCrypto is not available in this browser.');
  return c;
};

export function randomBytes(n: number): Uint8Array {
  const b = new Uint8Array(n);
  globalThis.crypto.getRandomValues(b);
  return b;
}

export function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

export function fromBase64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export interface Ciphertext {
  version: 1;
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  salt: string; // base64, 16 bytes
  iv: string; // base64, 12 bytes
  data: string; // base64 AES-GCM ciphertext + tag
}

export async function deriveKey(password: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const raw = await subtle().importKey('raw', new TextEncoder().encode(password.normalize('NFKC')), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return subtle().deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    raw,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey'],
  );
}

// ---- v2 envelope: one random master key, wrapped by the password and optionally by a passkey ----

export interface Sealed {
  iv: string; // base64, 12 bytes
  data: string; // base64 AES-GCM ciphertext + tag
}

/** Random AES-256-GCM master key. Extractable only so it can be (re)wrapped; it never leaves memory unwrapped. */
export function generateMasterKey(): Promise<CryptoKey> {
  return subtle().generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}

export async function sealJson(key: CryptoKey, value: unknown): Promise<Sealed> {
  const iv = randomBytes(12);
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const data = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, plaintext as BufferSource));
  plaintext.fill(0);
  return { iv: toBase64(iv), data: toBase64(data) };
}

export async function openJson<T>(key: CryptoKey, sealed: Sealed): Promise<T> {
  let plain: ArrayBuffer;
  try {
    plain = await subtle().decrypt({ name: 'AES-GCM', iv: fromBase64(sealed.iv) as BufferSource }, key, fromBase64(sealed.data) as BufferSource);
  } catch {
    throw new WrongPasswordError();
  }
  const text = new TextDecoder().decode(plain);
  new Uint8Array(plain).fill(0);
  return JSON.parse(text) as T;
}

export async function wrapMasterKey(master: CryptoKey, wrappingKey: CryptoKey): Promise<Sealed> {
  const iv = randomBytes(12);
  const wrapped = new Uint8Array(await subtle().wrapKey('raw', master, wrappingKey, { name: 'AES-GCM', iv: iv as BufferSource }));
  return { iv: toBase64(iv), data: toBase64(wrapped) };
}

/** Throws WrongPasswordError when the wrapping key is wrong (GCM auth failure). */
export async function unwrapMasterKey(sealed: Sealed, wrappingKey: CryptoKey): Promise<CryptoKey> {
  try {
    return await subtle().unwrapKey(
      'raw',
      fromBase64(sealed.data) as BufferSource,
      wrappingKey,
      { name: 'AES-GCM', iv: fromBase64(sealed.iv) as BufferSource },
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt'],
    );
  } catch {
    throw new WrongPasswordError();
  }
}

/** Passkey PRF output (32 bytes) → AES-GCM wrapping key via HKDF. */
export async function wrappingKeyFromPrf(prf: Uint8Array): Promise<CryptoKey> {
  const raw = await subtle().importKey('raw', prf as BufferSource, 'HKDF', false, ['deriveKey']);
  return subtle().deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new TextEncoder().encode('stova-passkey-wrap-v1'), info: new TextEncoder().encode('master-key') },
    raw,
    { name: 'AES-GCM', length: 256 },
    false,
    ['wrapKey', 'unwrapKey'],
  );
}

export async function encryptJson(value: unknown, password: string, iterations = SECURITY.pbkdf2Iterations): Promise<Ciphertext> {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = await deriveKey(password, salt, iterations);
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const data = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, plaintext as BufferSource));
  plaintext.fill(0);
  return { version: 1, kdf: 'PBKDF2-SHA256', iterations, salt: toBase64(salt), iv: toBase64(iv), data: toBase64(data) };
}

export class WrongPasswordError extends Error {
  constructor() {
    super('Wrong password');
    this.name = 'WrongPasswordError';
  }
}

export async function decryptJson<T>(ct: Ciphertext, password: string): Promise<T> {
  const key = await deriveKey(password, fromBase64(ct.salt), ct.iterations);
  let plain: ArrayBuffer;
  try {
    plain = await subtle().decrypt({ name: 'AES-GCM', iv: fromBase64(ct.iv) as BufferSource }, key, fromBase64(ct.data) as BufferSource);
  } catch {
    // AES-GCM authentication failure is the only normal failure mode here.
    throw new WrongPasswordError();
  }
  const text = new TextDecoder().decode(plain);
  new Uint8Array(plain).fill(0);
  return JSON.parse(text) as T;
}
