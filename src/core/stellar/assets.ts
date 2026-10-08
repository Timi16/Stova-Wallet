import { Asset } from '@stellar/stellar-sdk';
import { PRESET_ASSETS } from '@/config';
import { shortAddress } from '@/core/keys/import';

/** Serialisable asset reference. `issuer` is null for native XLM. */
export interface AssetRef {
  code: string;
  issuer: string | null;
}

export const XLM: AssetRef = { code: 'XLM', issuer: null };

export function isNative(a: AssetRef): boolean {
  return a.issuer === null;
}

export function assetKey(a: AssetRef): string {
  return a.issuer ? `${a.code}:${a.issuer}` : 'native';
}

export function parseAssetKey(key: string): AssetRef {
  if (key === 'native') return XLM;
  const [code, issuer] = key.split(':');
  return { code, issuer };
}

export function sameAsset(a: AssetRef, b: AssetRef): boolean {
  return a.code === b.code && a.issuer === b.issuer;
}

export function toSdkAsset(a: AssetRef): Asset {
  return a.issuer ? new Asset(a.code, a.issuer) : Asset.native();
}

export function presetFor(a: AssetRef) {
  return PRESET_ASSETS.find((p) => p.code === a.code && p.issuer === a.issuer) ?? null;
}

/** "USDC · Circle" for known presets, "NGNT · GBXK…7QPA" otherwise, so a fake "USDC" looks different. */
export function assetLabel(a: AssetRef): string {
  if (isNative(a)) return 'XLM · native';
  const p = presetFor(a);
  return p ? `${a.code} · ${p.issuerName}` : `${a.code} · ${shortAddress(a.issuer!)}`;
}

export function assetDisplayName(a: AssetRef): string {
  if (isNative(a)) return 'Stellar Lumens';
  return presetFor(a)?.name ?? a.code;
}

export function isValidAssetCode(code: string): boolean {
  return /^[A-Za-z0-9]{1,12}$/.test(code);
}
