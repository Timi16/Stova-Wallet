import { hmac } from '@noble/hashes/hmac.js';
import { sha512 } from '@noble/hashes/sha2.js';
import { mnemonicToSeedSync } from '@scure/bip39';
import { Keypair } from '@stellar/stellar-sdk';

/**
 * SLIP-0010 ed25519 derivation, the scheme SEP-0005 uses for Stellar.
 * Only hardened children exist for ed25519, so every path segment is `'`.
 * Implemented on @noble/hashes (audited, already a dependency of bip39)
 * rather than a Node-flavoured package that would need Buffer polyfills.
 */
const HARDENED = 0x80000000;
const MASTER_KEY = new TextEncoder().encode('ed25519 seed');

function u32be(n: number): Uint8Array {
  const b = new Uint8Array(4);
  b[0] = (n >>> 24) & 0xff;
  b[1] = (n >>> 16) & 0xff;
  b[2] = (n >>> 8) & 0xff;
  b[3] = n & 0xff;
  return b;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function masterKey(seed: Uint8Array): { key: Uint8Array; chainCode: Uint8Array } {
  const I = hmac(sha512, MASTER_KEY, seed);
  return { key: I.slice(0, 32), chainCode: I.slice(32) };
}

function childKey(parent: { key: Uint8Array; chainCode: Uint8Array }, index: number) {
  const data = concat(new Uint8Array([0]), parent.key, u32be((index + HARDENED) >>> 0));
  const I = hmac(sha512, parent.chainCode, data);
  return { key: I.slice(0, 32), chainCode: I.slice(32) };
}

/** Derive the raw 32-byte ed25519 seed at m/44'/148'/{account}'. */
export function deriveStellarSeed(bip39Seed: Uint8Array, account: number): Uint8Array {
  if (!Number.isInteger(account) || account < 0 || account >= HARDENED) {
    throw new RangeError('Account index must be a non-negative integer');
  }
  let node = masterKey(bip39Seed);
  for (const idx of [44, 148, account]) node = childKey(node, idx);
  return node.key;
}

export function sep5Path(account: number): string {
  return `m/44'/148'/${account}'`;
}

/** Recovery phrase → Stellar keypair for one account index. */
export function keypairFromPhrase(phrase: string, account = 0): Keypair {
  const seed = mnemonicToSeedSync(phrase);
  try {
    return Keypair.fromRawEd25519Seed(deriveStellarSeed(seed, account));
  } finally {
    seed.fill(0);
  }
}

export function publicKeyFromPhrase(phrase: string, account = 0): string {
  return keypairFromPhrase(phrase, account).publicKey();
}
