import { Keypair, StrKey } from '@stellar/stellar-sdk';
import { checkPhrase } from './mnemonic';
import { publicKeyFromPhrase } from './derive';

export type SecretCheck =
  | { ok: true; secret: string; publicKey: string }
  | { ok: false; message: string };

/** Validates an S… secret and explains the common mistakes in plain words. */
export function checkSecret(input: string): SecretCheck {
  const s = input.trim().toUpperCase();
  if (!s) return { ok: false, message: 'Paste your secret key.' };
  if (s[0] === 'G') {
    return { ok: false, message: "That's a public address. Import needs your secret key (starts with S) or your phrase." };
  }
  if (s[0] !== 'S') return { ok: false, message: 'A secret key starts with S.' };
  if (s.length !== 56) return { ok: false, message: `That has ${s.length} characters. A secret key has 56.` };
  if (!/^S[A-Z2-7]{55}$/.test(s)) return { ok: false, message: 'Only capital letters A–Z and digits 2–7.' };
  if (!StrKey.isValidEd25519SecretSeed(s)) {
    return { ok: false, message: "That doesn't check out. One character is probably wrong." };
  }
  return { ok: true, secret: s, publicKey: Keypair.fromSecret(s).publicKey() };
}

export type PhrasePreview =
  | { ok: true; phrase: string; publicKey: string; wordCount: number }
  | { ok: false; message: string; badIndex?: number; wordCount: number };

/** Validates a phrase and shows the G… it derives so the user can confirm it's theirs. */
export function previewPhrase(input: string): PhrasePreview {
  const check = checkPhrase(input);
  if (!check.ok) {
    return { ok: false, message: check.message, badIndex: check.badIndex, wordCount: check.words.length };
  }
  return {
    ok: true,
    phrase: check.normalized,
    publicKey: publicKeyFromPhrase(check.normalized, 0),
    wordCount: check.words.length,
  };
}

/** What a user typed into the recipient / issuer fields, classified. */
export function classifyAddress(input: string): 'valid' | 'empty' | 'secret' | 'muxed' | 'federation' | 'length' | 'invalid' {
  const s = input.trim();
  if (!s) return 'empty';
  if (s[0] === 'S' && s.length >= 50) return 'secret';
  if (s[0] === 'M' && StrKey.isValidMed25519PublicKey(s)) return 'muxed';
  if (s.includes('*')) return 'federation';
  if (StrKey.isValidEd25519PublicKey(s)) return 'valid';
  if (s.length !== 56) return 'length';
  return 'invalid';
}

export function shortAddress(address: string, head = 4, tail = 4): string {
  if (address.length <= head + tail + 1) return address;
  return `${address.slice(0, head)}…${address.slice(-tail)}`;
}

/** Groups of four, the way the design shows full addresses. */
export function chunkAddress(address: string): string {
  return address.replace(/(.{4})/g, '$1 ').trim();
}
