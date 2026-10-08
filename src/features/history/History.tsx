import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useActiveAccount } from '@/app/session';
import { usePayments } from '@/app/queries';
import { dayLabel, timeLabel } from '@/app/format';
import { shortAddress } from '@/core/keys';
import { describeError, type HistoryItem } from '@/core/stellar';
import { Screen } from '@/ui/Screen';
import { AccountChip, AccountSheet } from '@/ui/AccountChip';
import { NetworkPill } from '@/ui/NetworkPill';
import { TabBar } from '@/ui/TabBar';
import { TxSheet, txAmountLabel, txIconClass, txSign } from '@/ui/TxSheet';
import { Spinner } from '@/ui/Icons';
import { SkeletonRow } from '@/ui/Skeleton';

type Filter = 'all' | 'in' | 'out' | 'other';
const CHIPS: [Filter, string][] = [
  ['all', 'All'],
  ['in', 'Received'],
  ['out', 'Sent'],
  ['other', 'Other'],
];

function matches(f: Filter, i: HistoryItem) {
  if (f === 'all') return true;
  if (f === 'in') return i.kind === 'in' || i.kind === 'funded';
  if (f === 'out') return i.kind === 'out' || i.kind === 'created';
  return i.kind === 'other';
}

/** Activity: in/out list grouped by day, filters, Load older, detail sheet. */
export function History() {
  const acct = useActiveAccount();
  const pk = acct?.publicKey ?? '';
  const q = usePayments(pk);
  const [acctOpen, setAcctOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [tx, setTx] = useState<HistoryItem | null>(null);

  const items = useMemo(() => (q.data?.pages.flatMap((p) => p.items) ?? []).filter((i) => matches(filter, i)), [q.data, filter]);
  const groups = useMemo(() => {
    const map = new Map<string, HistoryItem[]>();
    for (const i of items) {
      const d = dayLabel(i.createdAt);
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(i);
    }
    return [...map.entries()];
  }, [items]);

  if (!acct) return <Navigate to="/home" replace />;

  return (
    <Screen>
      <header className="flex items-center gap-0.5 px-3 pb-1.5 pl-4 pt-3.5">
        <AccountChip onOpen={() => setAcctOpen(true)} />
        <span className="flex-1" />
        <NetworkPill />
      </header>
      <h1 className="m-0 px-4 pt-1.5 text-[22px] font-bold">Activity</h1>
      <main className="scroll-y flex flex-col gap-3.5 px-4 pb-3 pt-1">
        <div role="group" aria-label="Filter" className="flex gap-2">
          {CHIPS.map(([k, l]) => (
            <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)} className="chip">
              {l}
            </button>
          ))}
        </div>

        {q.isLoading && (
          <div className="flex flex-col gap-1.5" aria-busy="true" aria-label="Loading activity">
            <span className="skeleton mb-1 h-4 w-16" />
            {[0, 1, 2, 3].map((i) => (
              <SkeletonRow key={i} />
            ))}
          </div>
        )}
        {q.error && !q.data && (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <span className="text-base font-semibold">Couldn&apos;t load activity</span>
            <span className="text-[13px] text-muted">{describeError(q.error).title}. {describeError(q.error).message}</span>
            <button type="button" onClick={() => q.refetch()} className="btn-secondary btn-sm mt-2 px-5">
              Retry
            </button>
          </div>
        )}
        {!q.isLoading && !q.error && items.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <span className="text-base font-semibold">{filter === 'all' ? 'No transactions yet' : 'Nothing here yet'}</span>
            <span className="text-[13px] text-muted">{filter === 'all' ? `Payments in and out of ${acct.name} will show here.` : 'Try another filter.'}</span>
          </div>
        )}

        {groups.map(([day, rows]) => (
          <section key={day} className="stagger flex flex-col gap-0.5">
            <span className="label px-1 pb-1">{day}</span>
            {rows.map((r) => (
              <button key={r.id} type="button" onClick={() => setTx(r)} className="mb-1.5 flex h-[60px] items-center gap-3 rounded-2xl bg-surface px-3 text-left hover:bg-surface-2">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-base font-semibold ${txIconClass(r.kind)}`}>{txSign(r.kind)}</span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-semibold">{r.title}</span>
                  <span className="truncate text-xs text-muted">
                    {r.kind === 'out' || r.kind === 'created' ? 'to ' : r.kind === 'other' ? '' : 'from '}
                    {r.counterparty.startsWith('G') ? shortAddress(r.counterparty) : r.counterparty} · {timeLabel(r.createdAt)}
                  </span>
                </span>
                <span className={`text-sm font-semibold tabular ${txIconClass(r.kind)}`}>{txAmountLabel(r)}</span>
              </button>
            ))}
          </section>
        ))}

        {q.hasNextPage && (
          <button type="button" onClick={() => q.fetchNextPage()} disabled={q.isFetchingNextPage} className="btn-secondary btn-sm">
            {q.isFetchingNextPage ? <Spinner /> : null}
            {q.isFetchingNextPage ? 'Loading…' : 'Load older'}
          </button>
        )}
        {!q.hasNextPage && items.length > 0 && <span className="text-center text-xs text-dim">That&apos;s everything Horizon has for this account.</span>}
      </main>
      <TabBar />
      <AccountSheet open={acctOpen} onClose={() => setAcctOpen(false)} />
      <TxSheet item={tx} onClose={() => setTx(null)} />
    </Screen>
  );
}
