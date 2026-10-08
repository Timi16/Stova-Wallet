import type { AssetRef } from '@/core/stellar';
import type { BuiltPayment, RecipientCheck } from '@/core/stellar';

/**
 * Short-lived drafts shared between screens. Held in module variables (not
 * React state, not storage) so a freshly generated phrase or a built
 * transaction never touches anything persistent or devtools-visible.
 */

// ---- onboarding -----------------------------------------------------------

export type OnboardingDraft =
  | { kind: 'create'; mnemonic: string; confirmed: boolean }
  | { kind: 'import-phrase'; mnemonic: string; publicKey: string }
  | { kind: 'import-secret'; secret: string; publicKey: string }
  /** Importing into an existing, unlocked wallet (adds an account instead of creating a vault). */
  | { kind: 'add-phrase'; mnemonic: string; publicKey: string }
  | { kind: 'add-secret'; secret: string; publicKey: string };

let onboarding: OnboardingDraft | null = null;

export const onboardingDraft = {
  get: () => onboarding,
  set: (d: OnboardingDraft | null) => {
    onboarding = d;
  },
  clear: () => {
    onboarding = null;
  },
};

// ---- send -----------------------------------------------------------------

export interface SendDraft {
  destination: string;
  asset: AssetRef;
  amount: string;
  memo: string;
  recipient: RecipientCheck | null;
  /** Set by the review screen. One signed XDR per review; cleared on edit. */
  built: BuiltPayment | null;
}

let send: SendDraft | null = null;

export const sendDraft = {
  get: () => send,
  set: (d: SendDraft | null) => {
    send = d;
  },
  patch: (p: Partial<SendDraft>) => {
    if (send) send = { ...send, ...p };
  },
  clear: () => {
    send = null;
  },
};
