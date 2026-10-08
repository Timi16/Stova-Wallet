import { generateMnemonic, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';

export type PhraseCheck =
  | { ok: true; words: string[]; normalized: string }
  | { ok: false; reason: 'empty' | 'count' | 'unknown-word' | 'checksum'; message: string; words: string[]; badIndex?: number };

/** 128 bits of entropy → 12 English words. */
export function generatePhrase(): string {
  return generateMnemonic(wordlist, 128);
}

/** Lower-case, collapse whitespace, drop stray punctuation between words. */
export function normalizePhrase(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[‘’'"`,.;:]/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean);
}

/**
 * Validates a typed or pasted recovery phrase and explains what is wrong in
 * plain words, flagging an unknown word by position so the user can fix it.
 */
export function checkPhrase(input: string): PhraseCheck {
  const words = normalizePhrase(input);
  if (words.length === 0) {
    return { ok: false, reason: 'empty', message: 'Paste or type your recovery phrase.', words };
  }
  if (words.length !== 12 && words.length !== 24) {
    return {
      ok: false,
      reason: 'count',
      message: `A recovery phrase has 12 or 24 words. You have ${words.length}.`,
      words,
    };
  }
  const badIndex = words.findIndex((w) => !wordlist.includes(w));
  if (badIndex !== -1) {
    return {
      ok: false,
      reason: 'unknown-word',
      message: `Word ${badIndex + 1} ("${words[badIndex]}") isn't in the recovery word list. Check the spelling.`,
      words,
      badIndex,
    };
  }
  const normalized = words.join(' ');
  if (!validateMnemonic(normalized, wordlist)) {
    return {
      ok: false,
      reason: 'checksum',
      message: "These words are all valid but the phrase doesn't check out. One of them is probably in the wrong place.",
      words,
    };
  }
  return { ok: true, words, normalized };
}

export function isWordInList(word: string): boolean {
  return wordlist.includes(word.toLowerCase());
}
