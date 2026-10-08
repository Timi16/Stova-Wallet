import { NetworkError, TransactionFailedError, AccountRequiresMemoError } from '@stellar/stellar-sdk';
import { describeError, FriendbotError, PaymentBlockedError, SubmitPendingError } from '@/core/stellar';
import { CooldownError, LockedError, PasskeyError, StorageUnavailableError, WrongPasswordError } from '@/core/vault';

/**
 * One place that turns any thrown value into a sentence a person can act on.
 * Raw exception text (DOMException, SDK internals, "Failed to fetch") never
 * reaches the screen.
 */
export function friendlyMessage(err: unknown): string {
  if (err instanceof WrongPasswordError) return 'Wrong password.';
  if (err instanceof CooldownError) return `Too many tries. Wait ${err.secondsLeft} seconds and try again.`;
  if (err instanceof LockedError) return 'The wallet is locked. Unlock it and try again.';
  if (err instanceof PasskeyError) return err.message;
  if (err instanceof StorageUnavailableError) return "This browser won't let STOVA store anything. Private browsing and full storage do this.";
  if (err instanceof FriendbotError) return err.message;
  if (err instanceof PaymentBlockedError) return `${err.friendly.title}. ${err.friendly.message}`;
  if (err instanceof SubmitPendingError) return "Stellar hasn't confirmed yet. Check the transaction by its hash before trying again.";
  if (err instanceof TransactionFailedError || err instanceof NetworkError || err instanceof AccountRequiresMemoError) {
    const f = describeError(err);
    return `${f.title}. ${f.message}`;
  }
  if (typeof DOMException !== 'undefined' && err instanceof DOMException) return domMessage(err);
  if (err instanceof TypeError && /fetch|network|load failed/i.test(err.message)) return "Can't reach the network right now. Check your connection and try again.";
  if (err instanceof Error && err.message && isPlain(err.message)) return err.message;
  return 'Something went wrong. Please try again.';
}

function domMessage(e: DOMException): string {
  switch (e.name) {
    case 'NotAllowedError':
    case 'AbortError':
      return "That was cancelled or timed out. Try again when you're ready.";
    case 'QuotaExceededError':
      return 'This browser is out of storage space for STOVA.';
    case 'SecurityError':
      return 'The browser blocked this on security grounds. Make sure you opened STOVA over HTTPS.';
    case 'NotSupportedError':
      return "This browser or device doesn't support that.";
    default:
      return 'Something went wrong. Please try again.';
  }
}

/** Messages we wrote ourselves read like sentences; library internals usually don't. */
function isPlain(msg: string): boolean {
  return /^[A-Z][^{}<>]*[.!?]$/.test(msg.trim()) && !/https?:\/\/|\bundefined\b|\bnull\b|Error:|at \w+ \(/.test(msg) && msg.length <= 220;
}
