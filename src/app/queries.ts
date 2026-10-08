import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { STELLAR } from '@/config';
import { fetchAccount, fetchPayments, fetchTransactionDetail, type AccountInfo } from '@/core/stellar';

export const keys = {
  account: (pk: string) => ['account', pk] as const,
  payments: (pk: string) => ['payments', pk] as const,
  tx: (hash: string) => ['tx', hash] as const,
};

/** Balances for one account, auto-refreshing every 15 s while the tab is visible. */
export function useAccountInfo(publicKey: string | null | undefined) {
  return useQuery<AccountInfo>({
    queryKey: keys.account(publicKey ?? ''),
    queryFn: () => fetchAccount(publicKey!),
    enabled: !!publicKey,
    // Keep polling while visible even after an error, so an "offline" banner clears itself when Horizon is back.
    refetchInterval: () => (document.visibilityState === 'visible' ? STELLAR.balanceRefreshMs : false),
    refetchIntervalInBackground: false,
  });
}

export function usePayments(publicKey: string | null | undefined) {
  return useInfiniteQuery({
    queryKey: keys.payments(publicKey ?? ''),
    queryFn: ({ pageParam }) => fetchPayments(publicKey!, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: !!publicKey,
    // Activity changes less often than balances; polling it at half the rate keeps Horizon's rate limit happy.
    refetchInterval: () => (document.visibilityState === 'visible' ? STELLAR.balanceRefreshMs * 2 : false),
  });
}

export function useTransaction(hash: string | null) {
  return useQuery({
    queryKey: keys.tx(hash ?? ''),
    queryFn: () => fetchTransactionDetail(hash!),
    enabled: !!hash,
    staleTime: Infinity,
  });
}

export function useRefreshAccount(publicKey: string | null | undefined) {
  const qc = useQueryClient();
  return async () => {
    if (!publicKey) return;
    await Promise.all([
      qc.invalidateQueries({ queryKey: keys.account(publicKey) }),
      qc.invalidateQueries({ queryKey: keys.payments(publicKey) }),
    ]);
  };
}
