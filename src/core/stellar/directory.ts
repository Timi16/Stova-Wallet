import { StrKey } from '@stellar/stellar-sdk';
import { NETWORK } from '@/config';
import type { AssetRef } from './assets';

/**
 * Testnet asset directory, read from Stellar Expert's public API so users can
 * browse and search assets and add them from inside the wallet. Discovery only:
 * nothing here is trusted for anything but a code + issuer the user then adds.
 */
export interface DirectoryAsset {
  asset: AssetRef;
  /** Issuer home domain when Stellar Expert knows it. */
  domain: string | null;
  name: string | null;
  orgName: string | null;
  image: string | null;
  trustlines: number;
  payments: number;
  /** 0–10 composite rating from Stellar Expert. */
  rating: number;
  pagingToken: string;
}

export interface DirectoryPage {
  items: DirectoryAsset[];
  nextCursor: string | null;
}

interface RawRecord {
  asset: string;
  code?: string | null;
  domain?: string;
  tomlInfo?: { name?: string; orgName?: string; image?: string };
  trustlines?: { total?: number };
  payments?: number;
  rating?: { average?: number };
  paging_token?: string | number;
}

/** Parses one Stellar Expert record. Returns null for XLM, contract-only assets and anything malformed. */
export function parseDirectoryRecord(r: RawRecord): DirectoryAsset | null {
  if (!r || typeof r.asset !== 'string' || r.asset === 'XLM') return null;
  const [code, issuer] = r.asset.split('-');
  if (!code || !issuer || !StrKey.isValidEd25519PublicKey(issuer) || !/^[A-Za-z0-9]{1,12}$/.test(code)) return null;
  return {
    asset: { code, issuer },
    domain: r.domain ?? null,
    name: r.tomlInfo?.name ?? null,
    orgName: r.tomlInfo?.orgName ?? null,
    image: r.tomlInfo?.image ?? null,
    trustlines: r.trustlines?.total ?? 0,
    payments: r.payments ?? 0,
    rating: r.rating?.average ?? 0,
    pagingToken: String(r.paging_token ?? ''),
  };
}

export function parseDirectoryPage(body: unknown, limit: number): DirectoryPage {
  const records = ((body as { _embedded?: { records?: RawRecord[] } })?._embedded?.records ?? []) as RawRecord[];
  const items = records.map(parseDirectoryRecord).filter((a): a is DirectoryAsset => a !== null);
  const last = records[records.length - 1];
  return { items, nextCursor: records.length === limit && last?.paging_token != null ? String(last.paging_token) : null };
}

const LIMIT = 20;

export async function fetchDirectory(opts: { search?: string; cursor?: string | null } = {}): Promise<DirectoryPage> {
  const p = new URLSearchParams({ limit: String(LIMIT), order: 'desc' });
  if (opts.search?.trim()) p.set('search', opts.search.trim());
  else p.set('sort', 'rating');
  if (opts.cursor) p.set('cursor', opts.cursor);
  const res = await fetch(`${NETWORK.directoryApi}/asset?${p.toString()}`, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`Asset directory returned ${res.status}`);
  return parseDirectoryPage(await res.json(), LIMIT);
}
