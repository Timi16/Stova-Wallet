import { Horizon, NotFoundError } from '@stellar/stellar-sdk';
import { NETWORK, STELLAR } from '@/config';
import { horizon } from './horizon';
import { fromStroops, subAmounts, toStroops } from './amount';
import { XLM, type AssetRef } from './assets';

export interface Balance {
  asset: AssetRef;
  balance: string;
  limit: string | null;
  sellingLiabilities: string;
  /** False when the issuer requires authorisation and hasn't granted it. */
  authorized: boolean;
}

export interface AccountInfo {
  publicKey: string;
  exists: boolean;
  sequence: string;
  subentryCount: number;
  balances: Balance[];
  xlm: {
    balance: string;
    /** balance − minimum reserve − selling liabilities, never below 0. */
    spendable: string;
    reserve: string;
    sellingLiabilities: string;
  };
  fetchedAt: number;
}

/** Minimum balance: (2 + subentries) × base reserve. */
export function minimumReserve(subentryCount: number): string {
  const stroops = BigInt(2 + subentryCount) * toStroops(String(STELLAR.baseReserve));
  return fromStroops(stroops);
}

/** Spendable XLM = balance − reserve − selling liabilities, floored at 0. */
export function spendableXlm(balance: string, subentryCount: number, sellingLiabilities = '0'): string {
  const v = toStroops(balance) - toStroops(minimumReserve(subentryCount)) - toStroops(sellingLiabilities);
  return fromStroops(v < 0n ? 0n : v);
}

export function emptyAccount(publicKey: string): AccountInfo {
  return {
    publicKey,
    exists: false,
    sequence: '0',
    subentryCount: 0,
    balances: [{ asset: XLM, balance: '0', limit: null, sellingLiabilities: '0', authorized: true }],
    xlm: { balance: '0', spendable: '0', reserve: '0', sellingLiabilities: '0' },
    fetchedAt: Date.now(),
  };
}

type BalanceLine = Horizon.HorizonApi.BalanceLine;

function normalizeBalances(lines: BalanceLine[]): Balance[] {
  const out: Balance[] = [];
  for (const b of lines) {
    if (b.asset_type === 'native') {
      out.unshift({ asset: XLM, balance: b.balance, limit: null, sellingLiabilities: b.selling_liabilities, authorized: true });
    } else if (b.asset_type === 'credit_alphanum4' || b.asset_type === 'credit_alphanum12') {
      out.push({
        asset: { code: b.asset_code, issuer: b.asset_issuer },
        balance: b.balance,
        limit: b.limit,
        sellingLiabilities: b.selling_liabilities,
        authorized: b.is_authorized !== false,
      });
    }
    // Liquidity pool shares are out of MVP scope and skipped on purpose.
  }
  return out;
}

export function toAccountInfo(resp: Horizon.AccountResponse): AccountInfo {
  const balances = normalizeBalances(resp.balances);
  const native = balances.find((b) => b.asset.issuer === null) ?? { balance: '0', sellingLiabilities: '0' };
  const reserve = minimumReserve(resp.subentry_count);
  return {
    publicKey: resp.accountId(),
    exists: true,
    sequence: resp.sequenceNumber(),
    subentryCount: resp.subentry_count,
    balances,
    xlm: {
      balance: native.balance,
      spendable: spendableXlm(native.balance, resp.subentry_count, native.sellingLiabilities),
      reserve,
      sellingLiabilities: native.sellingLiabilities,
    },
    fetchedAt: Date.now(),
  };
}

/** Loads an account. A 404 means "not activated yet", returned as `exists: false`, not thrown. */
export async function fetchAccount(publicKey: string): Promise<AccountInfo> {
  try {
    const resp = await horizon.loadAccount(publicKey);
    return toAccountInfo(resp);
  } catch (e) {
    if (e instanceof NotFoundError || (e as { response?: { status?: number } })?.response?.status === 404) {
      return emptyAccount(publicKey);
    }
    throw e;
  }
}

/** Raw Horizon response, needed as the transaction source (sequence number). */
export async function loadSourceAccount(publicKey: string): Promise<Horizon.AccountResponse> {
  return horizon.loadAccount(publicKey);
}

export class FriendbotError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'FriendbotError';
    this.status = status;
  }
}

/** Asks Friendbot to create and fund the account with Testnet XLM. */
export async function fundWithFriendbot(publicKey: string): Promise<{ hash: string }> {
  const url = `${NETWORK.friendbotUrl}/?addr=${encodeURIComponent(publicKey)}`;
  let res: Response;
  try {
    res = await fetch(url, { method: 'GET' });
  } catch {
    throw new FriendbotError("Couldn't reach Friendbot. Check your connection and try again.", 0);
  }
  if (!res.ok) {
    let detail = '';
    try {
      const body = (await res.json()) as { detail?: string; title?: string };
      detail = body.detail ?? body.title ?? '';
    } catch {
      /* ignore */
    }
    if (res.status === 400 && /already funded|createAccountAlreadyExist|op_already_exists/i.test(detail)) {
      throw new FriendbotError('Friendbot says this account is already funded.', 400);
    }
    if (res.status === 429) throw new FriendbotError('Friendbot is busy right now (rate limit). Try again in a minute.', 429);
    throw new FriendbotError(detail || "Friendbot didn't answer. It gets busy sometimes.", res.status);
  }
  const body = (await res.json()) as { hash?: string };
  return { hash: body.hash ?? '' };
}

/** Balance left in XLM after a new trustline locks another base reserve. */
export function spendableAfterTrustline(info: AccountInfo): string {
  return subAmounts(info.xlm.spendable, String(STELLAR.baseReserve));
}
