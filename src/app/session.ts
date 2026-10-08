import { useSyncExternalStore } from 'react';
import { activeAccount, getSession, subscribe, visibleAccounts, type AccountMeta, type SessionState } from '@/core/vault';

/** React view of the session. Secrets never pass through here; only status and public metadata. */
export function useSession(): SessionState {
  return useSyncExternalStore(subscribe, getSession, getSession);
}

export function useActiveAccount(): AccountMeta | null {
  const s = useSession();
  return activeAccount(s.vault);
}

export function useAccounts(): AccountMeta[] {
  const s = useSession();
  return visibleAccounts(s.vault);
}
