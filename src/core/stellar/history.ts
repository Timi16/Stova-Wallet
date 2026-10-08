import { Horizon } from '@stellar/stellar-sdk';
import { STELLAR } from '@/config';
import { horizon } from './horizon';
import { feeToXlm } from './amount';
import { XLM, type AssetRef } from './assets';

export type HistoryKind = 'in' | 'out' | 'created' | 'funded' | 'other';

export interface HistoryItem {
  id: string;
  pagingToken: string;
  kind: HistoryKind;
  title: string;
  /** The other party (G… address) or a label such as "Friendbot". */
  counterparty: string;
  asset: AssetRef | null;
  amount: string | null;
  createdAt: string;
  txHash: string;
  successful: boolean;
  opType: string;
}

export interface HistoryPage {
  items: HistoryItem[];
  nextCursor: string | null;
}

type PaymentRecord = Horizon.ServerApi.PaymentOperationRecord;
type CreateRecord = Horizon.ServerApi.CreateAccountOperationRecord;
type PathRecord = Horizon.ServerApi.PathPaymentOperationRecord | Horizon.ServerApi.PathPaymentStrictSendOperationRecord;
type AnyRecord = Horizon.ServerApi.OperationRecord;

const FRIENDBOT_HINT = /friendbot/i;

function assetOf(rec: { asset_type: string; asset_code?: string; asset_issuer?: string }): AssetRef {
  return rec.asset_type === 'native' ? XLM : { code: rec.asset_code ?? '?', issuer: rec.asset_issuer ?? null };
}

export function normalizeOperation(rec: AnyRecord, me: string): HistoryItem {
  const base = {
    id: rec.id,
    pagingToken: rec.paging_token,
    createdAt: rec.created_at,
    txHash: rec.transaction_hash,
    successful: rec.transaction_successful,
    opType: rec.type,
  };
  switch (rec.type) {
    case 'payment': {
      const p = rec as PaymentRecord;
      const asset = assetOf(p);
      const out = p.from === me;
      return { ...base, kind: out ? 'out' : 'in', title: out ? `Sent ${asset.code}` : `Received ${asset.code}`, counterparty: out ? p.to : p.from, asset, amount: p.amount };
    }
    case 'create_account': {
      const c = rec as CreateRecord;
      if (c.account === me) {
        const byFriendbot = FRIENDBOT_HINT.test(c.funder) || c.starting_balance === '10000.0000000';
        return { ...base, kind: 'funded', title: byFriendbot ? 'Funded by Friendbot' : 'Account created', counterparty: byFriendbot ? 'Friendbot' : c.funder, asset: XLM, amount: c.starting_balance };
      }
      return { ...base, kind: 'created', title: 'Created account', counterparty: c.account, asset: XLM, amount: c.starting_balance };
    }
    case 'path_payment_strict_receive':
    case 'path_payment_strict_send': {
      const p = rec as PathRecord;
      const asset = assetOf(p);
      const out = p.from === me;
      return { ...base, kind: out ? 'out' : 'in', title: out ? `Sent ${asset.code} (path)` : `Received ${asset.code} (path)`, counterparty: out ? p.to : p.from, asset, amount: p.amount };
    }
    default:
      return { ...base, kind: 'other', title: 'Other operation', counterparty: rec.source_account, asset: null, amount: null };
  }
}

/** Payments, account creations and path payments, newest first, 20 per page. */
export async function fetchPayments(publicKey: string, cursor?: string | null): Promise<HistoryPage> {
  let builder = horizon.payments().forAccount(publicKey).order('desc').limit(STELLAR.historyPageSize);
  if (cursor) builder = builder.cursor(cursor);
  const page = await builder.call();
  const items = page.records.map((r) => normalizeOperation(r as AnyRecord, publicKey));
  const nextCursor = page.records.length === STELLAR.historyPageSize ? page.records[page.records.length - 1].paging_token : null;
  return { items, nextCursor };
}

export interface TxDetail {
  hash: string;
  ledger: number;
  createdAt: string;
  feeXlm: string;
  memo: string | null;
  memoType: string;
  successful: boolean;
  source: string;
  operations: { type: string; summary: string }[];
}

function summarizeOp(op: AnyRecord): string {
  switch (op.type) {
    case 'payment': {
      const p = op as PaymentRecord;
      return `Payment of ${p.amount} ${assetOf(p).code} to ${p.to}`;
    }
    case 'create_account': {
      const c = op as CreateRecord;
      return `Create account ${c.account} with ${c.starting_balance} XLM`;
    }
    case 'change_trust': {
      const c = op as Horizon.ServerApi.ChangeTrustOperationRecord;
      return c.limit === '0.0000000' ? `Remove ${c.asset_code} trustline` : `Trust ${c.asset_code} from ${c.asset_issuer}`;
    }
    default:
      return op.type.replace(/_/g, ' ');
  }
}

export async function fetchTransactionDetail(hash: string): Promise<TxDetail> {
  const tx = await horizon.transactions().transaction(hash).call();
  const ops = await horizon.operations().forTransaction(hash).limit(50).call();
  return {
    hash: tx.hash,
    ledger: tx.ledger_attr,
    createdAt: tx.created_at,
    feeXlm: feeToXlm(tx.fee_charged),
    memo: tx.memo ?? null,
    memoType: tx.memo_type,
    successful: tx.successful,
    source: tx.source_account,
    operations: ops.records.map((o) => ({ type: o.type, summary: summarizeOp(o as AnyRecord) })),
  };
}
