import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useActiveAccount, useSession } from '@/app/session';
import { useAccountInfo, usePayments, useRefreshAccount } from '@/app/queries';
import { useToast } from '@/app/toast';
import { clockLabel, timeLabel, dayLabel } from '@/app/format';
import { NETWORK } from '@/config';
import { shortAddress } from '@/core/keys';
import { assetKey, assetLabel, assetDisplayName, formatAmount, fundWithFriendbot, FriendbotError, type HistoryItem } from '@/core/stellar';
import { updateSettings } from '@/core/vault';
import { Screen } from '@/ui/Screen';
import { AccountChip, AccountSheet } from '@/ui/AccountChip';
import { NetworkPill } from '@/ui/NetworkPill';
import { TabBar } from '@/ui/TabBar';
import { AssetLogo } from '@/ui/AssetLogo';
import { SkeletonRow } from '@/ui/Skeleton';
import { TxSheet, txAmountLabel, txIconClass, txSign } from '@/ui/TxSheet';
import { DoneHero, FailHero, StepOverlay, useJob } from '@/ui/StepOverlay';
import { IconCheck, IconEye, IconEyeOff, IconPlus, IconReceive, IconRefresh, IconSend, IconShield, IconStar, IconWarn } from '@/ui/Icons';

export function Home() {
  const acct = useActiveAccount();
  const session = useSession();
  const toast = useToast();
  const pk = acct?.publicKey ?? null;
  const info = useAccountInfo(pk);
  const payments = usePayments(pk);
  const refresh = useRefreshAccount(pk);
  const [acctOpen, setAcctOpen] = useState(false);
  const [tab, setTab] = useState<'tokens' | 'act'>('tokens');
  const [tx, setTx] = useState<HistoryItem | null>(null);
  const [spinning, setSpinning] = useState(false);
  const fund = useJob();

  const hidden = !!session.vault?.settings.hideBalances;
  const mask = (v: string) => (hidden ? '••••' : v);
  const data = info.data;
  const loading = info.isLoading && !data;
  const offline = !!info.error;
  const funded = !!data?.exists;
  const feed = (payments.data?.pages[0]?.items ?? []).slice(0, 5);

  const doRefresh = async () => {
    if (spinning) return;
    setSpinning(true);
    await refresh();
    setSpinning(false);
    if (!info.error) toast('Balances updated');
  };

  const doFund = () =>
    fund.run([
      async () => {
        if (!pk) return;
        await fundWithFriendbot(pk);
      },
      async () => {
        await new Promise((r) => setTimeout(r, 2500));
        await refresh();
      },
    ]);

  if (!acct || !pk) return null;

  return (
    <Screen>
      <header className="flex items-center gap-0.5 px-3 pb-1.5 pl-4 pt-3.5">
        <AccountChip onOpen={() => setAcctOpen(true)} />
        <span className="flex-1" />
        <NetworkPill />
        <button
          type="button"
          aria-label="Hide or show balances"
          aria-pressed={hidden}
          onClick={() => updateSettings({ hideBalances: !hidden })}
          className="flex h-10 w-10 items-center justify-center rounded-full text-muted hover:text-text"
        >
          {hidden ? <IconEyeOff /> : <IconEye />}
        </button>
      </header>

      <main className="scroll-y flex flex-col gap-4 px-4 pb-3 pt-1">
        {offline && (
          <div className="flex items-center gap-2.5 rounded-[14px] border border-warn/30 bg-warn/10 px-3.5 py-2.5 text-[13px]">
            <IconWarn className="h-[18px] w-[18px] shrink-0 text-warn" />
            <span className="flex-1">
              Can&apos;t reach Stellar right now.{data ? ` Showing balances as of ${clockLabel(data.fetchedAt)}.` : ''}
            </span>
            <button type="button" onClick={doRefresh} className="h-8 rounded-full bg-surface-2 px-2.5 text-xs font-semibold">
              Retry
            </button>
          </div>
        )}

        <section className="flex flex-col items-center gap-2 pt-2.5">
          {loading ? (
            <div className="flex flex-col items-center gap-3 py-1" aria-busy="true" aria-label="Loading balances">
              <span className="skeleton h-11 w-[220px]" />
              <span className="skeleton h-[22px] w-40 rounded-full" />
            </div>
          ) : (
            <>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-bold leading-none tracking-[-0.035em] tabular">{mask(formatAmount(data?.xlm.balance ?? '0'))}</span>
                <span className="text-xl font-medium text-muted">XLM</span>
              </div>
              <div className="flex items-center gap-2 text-[13px] text-muted">
                <span className="pill text-text">{funded ? `Spendable ${mask(formatAmount(data!.xlm.spendable))}` : 'Nothing to spend yet'}</span>
                <button type="button" onClick={doRefresh} className="inline-flex h-7 items-center gap-1.5 px-1.5 text-xs font-medium text-muted hover:text-text">
                  <IconRefresh className={`h-[13px] w-[13px] ${spinning || info.isFetching ? 'animate-spin' : ''}`} />
                  {spinning || info.isFetching ? 'Updating…' : data ? `Updated ${timeLabel(new Date(data.fetchedAt).toISOString())}` : 'Refresh'}
                </button>
              </div>
            </>
          )}
        </section>

        {!loading && !funded && !offline && (
          <section className="card flex flex-col gap-3.5 border border-accent/30 p-[18px]">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-accent">
                <IconStar />
              </span>
              <span className="flex flex-col gap-1">
                <span className="text-[15px] font-semibold">Three steps to your first payment</span>
                <span className="text-[13px] leading-relaxed text-muted">An account only exists on Stellar once it holds XLM. On Testnet, Friendbot gives you 10,000 free XLM.</span>
              </span>
            </div>
            <ol className="m-0 flex list-none flex-col gap-2 p-0 text-sm">
              <li className="flex items-center gap-2.5">
                <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-good text-ground">
                  <IconCheck className="h-3 w-3" strokeWidth={3} />
                </span>
                <span className="text-muted line-through">{session.vault?.hasPhrase ? 'Back up your recovery phrase' : 'Import your wallet'}</span>
              </li>
              <li className="flex items-center gap-2.5">
                <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-ink">2</span>
                <span>Get free Testnet XLM</span>
              </li>
              <li className="flex items-center gap-2.5">
                <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-surface-3 text-xs font-bold text-muted">3</span>
                <span className="text-muted">Add USDC, then send to a friend</span>
              </li>
            </ol>
            <button type="button" onClick={doFund} className="btn-primary h-12 text-[15px]">
              Fund with Friendbot
            </button>
          </section>
        )}

        <div className="grid grid-cols-3 gap-2.5">
          <Action to="/receive" label="Receive" icon={<IconReceive className="h-[22px] w-[22px]" />} />
          <Action to="/send" label="Send" icon={<IconSend className="h-[22px] w-[22px]" />} primary />
          <Action to="/add-asset" label="Add asset" icon={<IconPlus className="h-[22px] w-[22px]" />} />
        </div>

        <div role="tablist" aria-label="Wallet sections" className="seg">
          <button type="button" role="tab" aria-selected={tab === 'tokens'} onClick={() => setTab('tokens')} className="seg-btn h-[38px]">
            Tokens
          </button>
          <button type="button" role="tab" aria-selected={tab === 'act'} onClick={() => setTab('act')} className="seg-btn h-[38px]">
            Activity
          </button>
        </div>

        {tab === 'tokens' && loading ? (
          <section className="card flex flex-col gap-1 px-2 py-1" aria-busy="true">
            <SkeletonRow tall />
            <SkeletonRow tall />
          </section>
        ) : tab === 'tokens' ? (
          <section className="stagger card px-2 py-1">
            {(data?.balances ?? [{ asset: { code: 'XLM', issuer: null }, balance: '0', limit: null, sellingLiabilities: '0', authorized: true }]).map((b) => {
              const k = assetKey(b.asset);
              const native = b.asset.issuer === null;
              return (
                <Link key={k} to={`/asset/${encodeURIComponent(k)}`} className="flex h-[68px] items-center gap-3.5 border-b border-line px-2 text-text last:border-b-0 hover:bg-surface-2/50">
                  <AssetLogo asset={b.asset} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="inline-flex items-center gap-1.5 text-base font-semibold">
                      {assetDisplayName(b.asset)}
                      {!native && b.asset.code === 'USDC' && assetLabel(b.asset).includes('Circle') && <IconShield className="h-3.5 w-3.5 text-accent" />}
                    </span>
                    <span className="text-[13px] text-muted">{assetLabel(b.asset)}</span>
                  </span>
                  <span className="flex flex-col items-end">
                    <span className="text-base font-semibold tabular">{mask(formatAmount(b.balance))}</span>
                    <span className="text-xs text-muted">
                      {native ? (funded ? `${formatAmount(data!.xlm.reserve)} reserved` : 'not activated') : !b.authorized ? 'Waiting for issuer approval' : b.asset.issuer ? shortAddress(b.asset.issuer) : ''}
                    </span>
                  </span>
                </Link>
              );
            })}
            {funded && !data?.balances.some((b) => b.asset.code === 'USDC') && (
              <Link to="/add-asset" className="flex h-[68px] items-center gap-3.5 px-2 text-text hover:bg-surface-2/50">
                <span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-dashed border-surface-3 text-muted">
                  <IconPlus />
                </span>
                <span className="flex flex-col">
                  <span className="text-[15px] font-semibold text-muted">Add USDC to this account</span>
                  <span className="text-xs text-dim">Each account holds its own assets</span>
                </span>
              </Link>
            )}
          </section>
        ) : (
          <section className="stagger flex flex-col gap-0.5">
            {payments.isLoading && (
              <>
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </>
            )}
            {feed.length === 0 && !payments.isLoading && (
              <div className="flex flex-col items-center gap-1.5 px-4 py-7 text-center">
                <span className="text-[15px] font-semibold">Nothing yet</span>
                <span className="text-[13px] text-muted">Payments in and out of {acct.name} will show here.</span>
              </div>
            )}
            {feed.map((f) => (
              <button key={f.id} type="button" onClick={() => setTx(f)} className="flex h-[60px] items-center gap-3 rounded-[14px] px-1 text-left hover:bg-surface">
                <span className={`flex h-9 w-9 items-center justify-center rounded-full bg-surface text-base font-semibold ${txIconClass(f.kind)}`}>{txSign(f.kind)}</span>
                <span className="flex flex-1 flex-col">
                  <span className="text-sm font-semibold">{f.title}</span>
                  <span className="text-xs text-muted">
                    {f.kind === 'out' || f.kind === 'created' ? 'to ' : 'from '}
                    {f.counterparty.startsWith('G') ? shortAddress(f.counterparty) : f.counterparty} · {dayLabel(f.createdAt)}
                  </span>
                </span>
                <span className={`text-sm font-semibold tabular ${txIconClass(f.kind)}`}>{mask(txAmountLabel(f))}</span>
              </button>
            ))}
            {feed.length > 0 && (
              <Link to="/activity" className="btn-ghost h-11 text-sm">
                All activity
              </Link>
            )}
          </section>
        )}
      </main>
      <TabBar />

      <AccountSheet open={acctOpen} onClose={() => setAcctOpen(false)} />
      <TxSheet item={tx} onClose={() => setTx(null)} />

      <StepOverlay
        state={fund.state}
        steps={[
          { label: 'Asking Friendbot', text: 'Friendbot funds new Testnet accounts with 10,000 XLM.' },
          { label: 'Waiting for the ledger', text: 'The account exists once the ledger closes, about 5 seconds.' },
        ]}
        done={
          <>
            <DoneHero title="10,000 XLM arrived" text="Friendbot created this account on Testnet. It's test money: spend it, lose it, ask for more." />
            <footer className="flex flex-col gap-2 px-4 pb-6 pt-2">
              <button type="button" className="btn-primary" onClick={fund.reset}>
                Open my wallet
              </button>
            </footer>
          </>
        }
        fail={(e) => (
          <>
            <FailHero
              title={e instanceof FriendbotError && e.status === 400 ? 'Already funded' : "Friendbot didn't answer"}
              text={e instanceof FriendbotError ? e.message : 'It gets busy sometimes. Try again in a moment, or fund the account from the Stellar Lab.'}
            />
            <footer className="flex flex-col gap-2 px-4 pb-6 pt-2">
              <button type="button" className="btn-primary" onClick={() => { fund.reset(); void doFund(); }}>
                Try again
              </button>
              <a href={NETWORK.labFaucetUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary">
                Open the Stellar Lab faucet
              </a>
              <button type="button" className="btn-ghost" onClick={() => { fund.reset(); void refresh(); }}>
                Not now
              </button>
            </footer>
          </>
        )}
      />
    </Screen>
  );
}

function Action({ to, label, icon, primary = false }: { to: string; label: string; icon: React.ReactNode; primary?: boolean }) {
  return (
    <Link to={to} className="flex flex-col items-center gap-2 text-xs font-medium text-text">
      <span className={`flex h-[60px] w-full items-center justify-center rounded-[20px] ${primary ? 'bg-accent text-accent-ink' : 'bg-surface-2'}`}>{icon}</span>
      {label}
    </Link>
  );
}
