import { STELLAR } from '@/config';

/**
 * Exact decimal maths in stroops (1 XLM = 10^7 stroops) with BigInt, so
 * spendable balances and "left after this send" never suffer float drift.
 */
export const STROOP = 10_000_000n;

export type AmountCheck =
  | { ok: true; value: string; stroops: bigint }
  | { ok: false; message: string };

/** Parses user input: ".5" → "0.5", rejects commas, more than 7 decimals, zero and negatives. */
export function parseAmount(input: string): AmountCheck {
  const raw = input.trim();
  if (!raw) return { ok: false, message: 'Enter an amount.' };
  if (raw.includes(',')) return { ok: false, message: 'Use a dot for decimals and no thousands separators, like 1000.50.' };
  if (!/^\d*\.?\d*$/.test(raw) || raw === '.') return { ok: false, message: 'Numbers only, like 12.50.' };
  const [whole = '', frac = ''] = raw.split('.');
  if (frac.length > STELLAR.maxDecimals) return { ok: false, message: `Stellar allows up to ${STELLAR.maxDecimals} decimals.` };
  const stroops = BigInt(whole || '0') * STROOP + BigInt((frac + '0000000').slice(0, 7));
  if (stroops <= 0n) return { ok: false, message: 'The amount must be more than 0.' };
  if (stroops > 9_223_372_036_854_775_807n) return { ok: false, message: "That's more than Stellar can represent." };
  return { ok: true, value: fromStroops(stroops), stroops };
}

export function toStroops(decimal: string): bigint {
  const neg = decimal.startsWith('-');
  const s = neg ? decimal.slice(1) : decimal;
  const [whole = '0', frac = ''] = s.split('.');
  const v = BigInt(whole || '0') * STROOP + BigInt((frac + '0000000').slice(0, 7));
  return neg ? -v : v;
}

/** Canonical Stellar string: no trailing zeros beyond what's needed, at most 7 decimals. */
export function fromStroops(stroops: bigint): string {
  const neg = stroops < 0n;
  const v = neg ? -stroops : stroops;
  const whole = v / STROOP;
  const frac = (v % STROOP).toString().padStart(7, '0').replace(/0+$/, '');
  return `${neg ? '-' : ''}${whole}${frac ? '.' + frac : ''}`;
}

export function addAmounts(a: string, b: string): string {
  return fromStroops(toStroops(a) + toStroops(b));
}

export function subAmounts(a: string, b: string): string {
  return fromStroops(toStroops(a) - toStroops(b));
}

export function maxAmount(a: string, b: string): string {
  return toStroops(a) >= toStroops(b) ? a : b;
}

export function isPositive(a: string): boolean {
  return toStroops(a) > 0n;
}

export function compareAmounts(a: string, b: string): -1 | 0 | 1 {
  const x = toStroops(a);
  const y = toStroops(b);
  return x < y ? -1 : x > y ? 1 : 0;
}

/** Display formatting: thousands separators, at least `min` decimals, at most `max`. */
export function formatAmount(decimal: string, opts: { min?: number; max?: number } = {}): string {
  const { min = 2, max = 7 } = opts;
  const neg = decimal.startsWith('-');
  const s = neg ? decimal.slice(1) : decimal;
  const [wholeRaw = '0', fracRaw = ''] = s.split('.');
  let frac = fracRaw.slice(0, max).replace(/0+$/, '');
  if (frac.length < min) frac = frac.padEnd(min, '0');
  const whole = wholeRaw.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${neg ? '−' : ''}${whole}${frac ? '.' + frac : ''}`;
}

/** Stroops → XLM for fees (Horizon reports fees in stroops). */
export function feeToXlm(stroops: number | string): string {
  return fromStroops(BigInt(stroops));
}

/** UTF-8 byte length, for the 28-byte memo limit (emoji count as 4). */
export function memoBytes(text: string): number {
  return new TextEncoder().encode(text).length;
}
