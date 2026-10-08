import { NETWORK } from '@/config';
import { isNative, type AssetRef } from './assets';

/**
 * Asset logos. Testnet issuers almost never publish a stellar.toml with an
 * image, so we look the code up on the public network directory (Stellar
 * Expert) and take the best-rated issuer's logo for that exact code. It is a
 * picture, nothing more: trust still comes from the issuer address.
 */
export interface AssetLogoInfo {
  image: string | null;
  orgName: string | null;
  domain: string | null;
}

interface RawRecord {
  asset: string;
  tomlInfo?: { image?: string; orgName?: string };
  domain?: string;
  rating?: { average?: number };
}

const cache = new Map<string, Promise<AssetLogoInfo>>();

export function pickLogo(records: RawRecord[], code: string): AssetLogoInfo {
  const exact = records
    .filter((r) => typeof r.asset === 'string' && r.asset.split('-')[0] === code && r.tomlInfo?.image)
    .sort((a, b) => (b.rating?.average ?? 0) - (a.rating?.average ?? 0));
  const best = exact[0];
  return best ? { image: best.tomlInfo!.image!, orgName: best.tomlInfo?.orgName ?? null, domain: best.domain ?? null } : { image: null, orgName: null, domain: null };
}

export function fetchLogoForCode(code: string): Promise<AssetLogoInfo> {
  const key = code.toUpperCase();
  let p = cache.get(key);
  if (!p) {
    p = (async () => {
      const res = await fetch(`${NETWORK.logoApi}/asset?search=${encodeURIComponent(code)}&limit=10`, { headers: { accept: 'application/json' } });
      if (!res.ok) throw new Error(`Logo lookup returned ${res.status}`);
      const body = (await res.json()) as { _embedded?: { records?: RawRecord[] } };
      return pickLogo(body._embedded?.records ?? [], code);
    })();
    cache.set(key, p);
    p.catch(() => cache.delete(key));
  }
  return p;
}

export function fetchLogo(asset: AssetRef): Promise<AssetLogoInfo> {
  if (isNative(asset)) return Promise.resolve({ image: null, orgName: null, domain: null });
  return fetchLogoForCode(asset.code);
}
