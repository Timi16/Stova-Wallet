import { Horizon, Memo, Operation, Transaction, TransactionBuilder, BASE_FEE, NetworkError, NotFoundError } from '@stellar/stellar-sdk';
import { bytesToHex } from '@noble/hashes/utils.js';
import { NETWORK, STELLAR } from '@/config';
import { horizon } from './horizon';
import { fetchAccount, loadSourceAccount, type AccountInfo } from './account';
import { compareAmounts, feeToXlm, memoBytes } from './amount';
import { isNative, sameAsset, toSdkAsset, type AssetRef } from './assets';
import { describeError, type FriendlyError } from './errors';

// ---- recipient checks -----------------------------------------------------

export interface RecipientCheck {
  exists: boolean;
  /** True when the recipient already trusts exactly this code + issuer. */
  hasTrustline: boolean;
  /** Recipient is the asset issuer: no trustline needed. */
  isIssuer: boolean;
  info: AccountInfo;
}

export async function checkRecipient(destination: string, asset: AssetRef): Promise<RecipientCheck> {
  const info = await fetchAccount(destination);
  const isIssuer = !isNative(asset) && asset.issuer === destination;
  const hasTrustline = isNative(asset) || isIssuer || info.balances.some((b) => sameAsset(b.asset, asset));
  return { exists: info.exists, hasTrustline, isIssuer, info };
}

// ---- building -------------------------------------------------------------

export interface PaymentDraft {
  source: string;
  destination: string;
  asset: AssetRef;
  amount: string;
  memo: string;
}

export interface BuiltPayment {
  tx: Transaction;
  xdr: string;
  /** createAccount when the recipient doesn't exist yet. */
  kind: 'payment' | 'createAccount';
  feeXlm: string;
  hash: string;
  builtAt: number;
}

export class PaymentBlockedError extends Error {
  friendly: FriendlyError;
  constructor(friendly: FriendlyError) {
    super(friendly.title);
    this.name = 'PaymentBlockedError';
    this.friendly = friendly;
  }
}

/**
 * Builds (but does not sign) a payment. Runs every pre-flight check from the
 * architecture doc so the user is blocked before signing, not after.
 */
export async function buildPayment(draft: PaymentDraft, recipient: RecipientCheck): Promise<BuiltPayment> {
  if (draft.destination === draft.source) {
    throw new PaymentBlockedError({ title: "That's this wallet", message: 'Pick someone else to send to.', code: null, action: 'stop' });
  }
  if (memoBytes(draft.memo) > STELLAR.memoMaxBytes) {
    throw new PaymentBlockedError({ title: 'Memo too long', message: `Memos are limited to ${STELLAR.memoMaxBytes} bytes.`, code: null, action: 'stop' });
  }

  let kind: BuiltPayment['kind'] = 'payment';
  if (!recipient.exists) {
    if (!isNative(draft.asset)) {
      throw new PaymentBlockedError({
        title: "This account isn't activated yet",
        message: `It can't receive ${draft.asset.code} until it holds XLM. Send it 1 XLM first, or ask them to activate it.`,
        code: 'op_no_destination',
        action: 'stop',
        hint: 'min-1-xlm',
      });
    }
    if (compareAmounts(draft.amount, '1') < 0) {
      throw new PaymentBlockedError({
        title: 'New accounts need at least 1 XLM',
        message: 'This address has no account yet. Sending 1 XLM or more creates it.',
        code: 'op_no_destination',
        action: 'stop',
        hint: 'min-1-xlm',
      });
    }
    kind = 'createAccount';
  } else if (!recipient.hasTrustline) {
    throw new PaymentBlockedError({
      title: `Recipient can't receive ${draft.asset.code} yet`,
      message: 'They need to add this asset to their wallet first.',
      code: 'op_no_trust',
      action: 'stop',
      hint: 'needs-trustline',
    });
  }

  const [source, baseFee] = await Promise.all([loadSourceAccount(draft.source), horizon.fetchBaseFee().catch(() => Number(BASE_FEE))]);
  const fee = String(Math.max(baseFee, Number(BASE_FEE)));

  const builder = new TransactionBuilder(source, { fee, networkPassphrase: NETWORK.passphrase });
  if (kind === 'createAccount') {
    builder.addOperation(Operation.createAccount({ destination: draft.destination, startingBalance: draft.amount }));
  } else {
    builder.addOperation(Operation.payment({ destination: draft.destination, asset: toSdkAsset(draft.asset), amount: draft.amount }));
  }
  if (draft.memo.trim()) builder.addMemo(Memo.text(draft.memo.trim()));
  builder.setTimeout(STELLAR.txTimeoutSeconds);
  const tx = builder.build();
  return { tx, xdr: tx.toXDR(), kind, feeXlm: feeToXlm(tx.fee), hash: bytesToHex(tx.hash()), builtAt: Date.now() };
}

/** Change-trust transaction. `limit` "0" removes the trustline. */
export async function buildChangeTrust(source: string, asset: AssetRef, limit?: string): Promise<BuiltPayment> {
  const [acct, baseFee] = await Promise.all([loadSourceAccount(source), horizon.fetchBaseFee().catch(() => Number(BASE_FEE))]);
  const fee = String(Math.max(baseFee, Number(BASE_FEE)));
  const tx = new TransactionBuilder(acct, { fee, networkPassphrase: NETWORK.passphrase })
    .addOperation(Operation.changeTrust(limit === undefined ? { asset: toSdkAsset(asset) } : { asset: toSdkAsset(asset), limit }))
    .setTimeout(STELLAR.txTimeoutSeconds)
    .build();
  return { tx, xdr: tx.toXDR(), kind: 'payment', feeXlm: feeToXlm(tx.fee), hash: bytesToHex(tx.hash()), builtAt: Date.now() };
}

// ---- submitting -----------------------------------------------------------

export interface SubmitResult {
  hash: string;
  ledger: number;
  feeCharged: string;
  successful: boolean;
  createdAt: string;
  xdr: string;
}

export class SubmitPendingError extends Error {
  hash: string;
  constructor(hash: string) {
    super('Transaction submitted but not yet confirmed');
    this.name = 'SubmitPendingError';
    this.hash = hash;
  }
}

function toResult(r: Horizon.HorizonApi.SubmitTransactionResponse | Horizon.ServerApi.TransactionRecord, xdr: string): SubmitResult {
  const ledger = 'ledger_attr' in r ? r.ledger_attr : (r as Horizon.HorizonApi.SubmitTransactionResponse).ledger;
  return {
    hash: r.hash,
    ledger,
    feeCharged: feeToXlm((r as { fee_charged?: number | string }).fee_charged ?? 0),
    successful: r.successful,
    createdAt: (r as { created_at?: string }).created_at ?? new Date().toISOString(),
    xdr,
  };
}

/** Looks a transaction up by hash. Null when Horizon has not seen it (yet). */
export async function fetchTransactionByHash(hash: string): Promise<SubmitResult | null> {
  try {
    const rec = await horizon.transactions().transaction(hash).call();
    return toResult(rec, rec.envelope_xdr);
  } catch (e) {
    if (e instanceof NotFoundError) return null;
    throw e;
  }
}

/**
 * Submits a signed transaction. On a timeout (504) or network failure, polls
 * `/transactions/{hash}` until it shows up or the timeout window passes.
 * It never rebuilds and resends blindly: that could double-pay.
 */
export async function submitSigned(
  signed: Transaction,
  onStatus?: (s: 'submitting' | 'polling') => void,
): Promise<SubmitResult> {
  const hash = bytesToHex(signed.hash());
  const xdr = signed.toXDR();
  onStatus?.('submitting');
  try {
    // The SDK's SEP-29 check runs first: a recipient flagged "memo required" (exchanges) is refused before anything is sent.
    const res = await horizon.submitTransaction(signed);
    return toResult(res, xdr);
  } catch (e) {
    const friendly = describeError(e);
    if (friendly.action !== 'poll') throw e;
    // 504 / network: the transaction may still land. Poll by hash.
    onStatus?.('polling');
    const deadline = Date.now() + STELLAR.txTimeoutSeconds * 1000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 3000));
      try {
        const found = await fetchTransactionByHash(hash);
        if (found) return found;
      } catch {
        /* keep polling */
      }
    }
    throw new SubmitPendingError(hash);
  }
}

export function isNetworkError(e: unknown): boolean {
  return e instanceof NetworkError && (e.response?.status === undefined || e.response.status === 0);
}
