import { StrKey } from '@stellar/stellar-sdk';
import type { AssetRef } from './assets';
import { XLM } from './assets';

/**
 * SEP-0007 pay links: web+stellar:pay?destination=G…&amount=…&asset_code=…&asset_issuer=…&memo=…
 * Pasting one into the recipient field prefills the Send form (PayBridge, etc).
 */
export interface PayLink {
  destination: string;
  amount: string | null;
  asset: AssetRef;
  memo: string | null;
  memoType: 'text' | 'id' | 'hash' | 'return' | null;
}

export function isPayLink(input: string): boolean {
  return /^web\+stellar:pay\?/i.test(input.trim());
}

export function parsePayLink(input: string): PayLink | { error: string } {
  const s = input.trim();
  if (!isPayLink(s)) return { error: 'Not a Stellar payment link.' };
  const q = s.slice(s.indexOf('?') + 1);
  const params = new URLSearchParams(q);
  const destination = params.get('destination')?.trim() ?? '';
  if (!StrKey.isValidEd25519PublicKey(destination)) return { error: "The payment link's destination isn't a valid Stellar address." };
  const code = params.get('asset_code')?.trim();
  const issuer = params.get('asset_issuer')?.trim();
  let asset: AssetRef = XLM;
  if (code && code.toUpperCase() !== 'XLM') {
    if (!issuer || !StrKey.isValidEd25519PublicKey(issuer)) return { error: 'The payment link names an asset but no valid issuer.' };
    asset = { code, issuer };
  }
  const amount = params.get('amount')?.trim() || null;
  const memo = params.get('memo')?.trim() || null;
  const memoTypeRaw = params.get('memo_type')?.trim().toUpperCase();
  const memoType = memo
    ? memoTypeRaw === 'MEMO_ID'
      ? 'id'
      : memoTypeRaw === 'MEMO_HASH'
        ? 'hash'
        : memoTypeRaw === 'MEMO_RETURN'
          ? 'return'
          : 'text'
    : null;
  return { destination, amount, asset, memo, memoType };
}

export function buildPayLink(destination: string, amount: string | null, asset: AssetRef, memo?: string): string {
  const p = new URLSearchParams();
  p.set('destination', destination);
  if (amount) p.set('amount', amount);
  if (asset.issuer) {
    p.set('asset_code', asset.code);
    p.set('asset_issuer', asset.issuer);
  }
  if (memo) p.set('memo', memo);
  return `web+stellar:pay?${p.toString()}`;
}
