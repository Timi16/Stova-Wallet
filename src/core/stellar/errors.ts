import { AccountRequiresMemoError, NetworkError, TransactionFailedError } from '@stellar/stellar-sdk';

/**
 * Horizon errors in plain words, with the action the app should take.
 *
 *  - `stop`:    nothing was sent; show the reason.
 *  - `rebuild`: reload the account, rebuild the transaction, ask to confirm again.
 *  - `poll`:    the transaction may have landed; poll by hash before any retry.
 */
export type ErrorAction = 'stop' | 'rebuild' | 'poll';

export interface FriendlyError {
  title: string;
  message: string;
  code: string | null;
  action: ErrorAction;
  /** Hints for the UI: offer the Max button, show the shortfall, etc. */
  hint?: 'show-spendable' | 'min-1-xlm' | 'needs-trustline';
}

const OP_CODES: Record<string, Omit<FriendlyError, 'code'>> = {
  op_underfunded: {
    title: 'Not enough balance after the XLM reserve',
    message: 'Stellar keeps part of your XLM locked as a reserve. Try a smaller amount, or use Max.',
    action: 'stop',
    hint: 'show-spendable',
  },
  op_low_reserve: {
    title: 'You need more XLM to keep this account open',
    message: 'This would drop the account below its minimum balance. Add some XLM first.',
    action: 'stop',
    hint: 'show-spendable',
  },
  op_no_destination: {
    title: "Recipient account isn't activated",
    message: 'That address has no account on Stellar yet. Send it at least 1 XLM to create it.',
    action: 'stop',
    hint: 'min-1-xlm',
  },
  op_no_trust: {
    title: "Recipient can't receive this asset yet",
    message: 'They need to add the asset to their wallet first. Ask them to add it, then try again.',
    action: 'stop',
    hint: 'needs-trustline',
  },
  op_line_full: {
    title: "Recipient's limit for this asset is full",
    message: 'Their wallet has a cap on how much of this asset it can hold and this would exceed it. Nothing was sent.',
    action: 'stop',
  },
  op_not_authorized: {
    title: "This asset's issuer hasn't authorised the account",
    message: 'The issuer must approve the recipient before they can receive this asset. Nothing was sent.',
    action: 'stop',
  },
  op_src_not_authorized: {
    title: "This asset's issuer hasn't authorised your account",
    message: 'The issuer must approve your account before you can send this asset. Nothing was sent.',
    action: 'stop',
  },
  op_src_no_trust: {
    title: "You don't hold this asset",
    message: 'Add the asset to this account before sending it.',
    action: 'stop',
  },
  op_malformed: {
    title: 'Something in the transaction was invalid',
    message: 'STOVA built a transaction Stellar rejected. Please edit the details and try again.',
    action: 'stop',
  },
  op_already_exists: {
    title: 'That account already exists',
    message: 'The recipient was activated a moment ago. Send a normal payment instead.',
    action: 'rebuild',
  },
  op_invalid_limit: {
    title: 'Remove asset blocked',
    message: 'You still hold some of this asset. Send it out first, then remove the asset.',
    action: 'stop',
  },
  op_too_few_offers: { title: 'No path for this payment', message: 'Nothing was sent.', action: 'stop' },
};

const TX_CODES: Record<string, Omit<FriendlyError, 'code'>> = {
  tx_bad_seq: {
    title: 'Something changed, retrying',
    message: 'Another transaction from this account landed first. STOVA reloaded your account; confirm again.',
    action: 'rebuild',
  },
  tx_insufficient_fee: {
    title: 'Network is busy',
    message: 'The fee was too low for the current load. STOVA rebuilt it with a higher fee; confirm again.',
    action: 'rebuild',
  },
  tx_too_late: {
    title: 'The review took too long',
    message: 'This transaction expired before it was submitted. STOVA rebuilt it; confirm again.',
    action: 'rebuild',
  },
  tx_too_early: { title: 'Clock mismatch', message: 'Your device clock looks off. Check the time and try again.', action: 'rebuild' },
  tx_insufficient_balance: {
    title: 'Not enough balance after the XLM reserve',
    message: 'There is not enough XLM to cover the amount, the fee and the reserve.',
    action: 'stop',
    hint: 'show-spendable',
  },
  tx_bad_auth: { title: 'Signature rejected', message: 'The network did not accept the signature. Lock and unlock, then try again.', action: 'stop' },
  tx_no_source_account: {
    title: "Your account isn't activated",
    message: 'This account has no XLM yet. Fund it first.',
    action: 'stop',
  },
  tx_failed: { title: 'Transaction failed', message: 'Stellar rejected one of the operations. Nothing was sent.', action: 'stop' },
};

export function describeError(err: unknown): FriendlyError {
  if (err instanceof AccountRequiresMemoError) {
    return {
      title: 'This recipient requires a memo',
      message: 'The account is flagged "memo required" (common for exchanges). Nothing was sent. Add the memo they gave you and try again.',
      code: 'memo_required',
      action: 'stop',
    };
  }
  if (err instanceof TransactionFailedError) {
    const codes = err.getResultCodes();
    const op = codes.operations.find((c) => c !== 'op_success');
    if (op && OP_CODES[op]) return { ...OP_CODES[op], code: op };
    const tx = codes.transaction;
    if (tx && TX_CODES[tx]) return { ...TX_CODES[tx], code: tx };
    return { title: 'Transaction failed', message: 'Stellar rejected this transaction. Nothing was sent.', code: op ?? tx ?? null, action: 'stop' };
  }

  if (err instanceof NetworkError) {
    const status = err.response?.status;
    if (status === 504 || status === 408) {
      return {
        title: 'Checking whether it went through',
        message: 'Stellar is slow right now. STOVA is checking by transaction hash so nothing gets sent twice.',
        code: 'timeout',
        action: 'poll',
      };
    }
    if (status === 429) return { title: 'Too many requests', message: 'Horizon asked us to slow down. Wait a moment, then retry.', code: '429', action: 'stop' };
    // Result codes can also appear on a generic BadResponseError payload.
    const extras = (err.response?.data as { extras?: { result_codes?: { transaction?: string; operations?: string[] } } } | undefined)?.extras;
    const op = extras?.result_codes?.operations?.find((c) => c !== 'op_success');
    if (op && OP_CODES[op]) return { ...OP_CODES[op], code: op };
    const tx = extras?.result_codes?.transaction;
    if (tx && TX_CODES[tx]) return { ...TX_CODES[tx], code: tx };
    if (status === undefined || status === 0) {
      return { title: "Can't reach Stellar right now", message: 'Check your connection and try again.', code: 'network', action: 'poll' };
    }
    return { title: 'Horizon returned an error', message: err.message || 'Please try again.', code: String(status), action: 'stop' };
  }

  if (err instanceof TypeError && /fetch|network/i.test(err.message)) {
    return { title: "Can't reach Stellar right now", message: 'Check your connection and try again.', code: 'network', action: 'poll' };
  }

  if (err instanceof Error) {
    return { title: 'Something went wrong', message: err.message, code: null, action: 'stop' };
  }
  return { title: 'Something went wrong', message: 'Please try again.', code: null, action: 'stop' };
}

/** Pure mapper for tests and for places that only have the code string. */
export function describeResultCode(code: string): FriendlyError {
  if (OP_CODES[code]) return { ...OP_CODES[code], code };
  if (TX_CODES[code]) return { ...TX_CODES[code], code };
  return { title: 'Transaction failed', message: 'Stellar rejected this transaction. Nothing was sent.', code, action: 'stop' };
}
