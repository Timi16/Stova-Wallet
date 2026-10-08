import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueries } from '@tanstack/react-query';
import { useAccounts, useActiveAccount, useSession } from '@/app/session';
import { keys } from '@/app/queries';
import { copyText } from '@/app/clipboard';
import { useToast } from '@/app/toast';
import { shortAddress } from '@/core/keys';
import { fetchAccount, formatAmount } from '@/core/stellar';
import { addDerivedAccount, setActiveAccount, type AccountMeta } from '@/core/vault';
import { Orb } from './Orb';
import { Sheet } from './Sheet';
import { IconCheck, IconChevronDown, IconCopy, IconKey, IconPlus } from './Icons';
import { DoneHero, StepOverlay, useJob } from './StepOverlay';
import { Input } from './Field';

/**
 * The account chip (orb · name · address · copy) shown on Home, Receive and
 * Activity. Tapping it opens the switcher sheet; "New account" derives the
 * next SEP-5 key from the same phrase.
 */
export function AccountChip({ onOpen }: { onOpen: () => void }) {
  const acct = useActiveAccount();
  const toast = useToast();
  if (!acct) return null;
  return (
    <div className="flex items-center gap-0.5">
      <button
        type="button"
        onClick={onOpen}
        aria-label="Switch account"
        className="flex h-12 items-center gap-2.5 rounded-full bg-surface py-1 pl-1 pr-2.5 text-left hover:bg-surface-2"
      >
        <Orb publicKey={acct.publicKey} size={40} />
        <span className="flex flex-col gap-px">
          <span className="text-sm font-semibold leading-[1.1]">{acct.name}</span>
          <span className="font-mono text-[11px] leading-[1.1] text-muted">{shortAddress(acct.publicKey)}</span>
        </span>
        <IconChevronDown className="h-3.5 w-3.5 text-muted" />
      </button>
      <button
        type="button"
        aria-label="Copy address"
        onClick={async () => toast((await copyText(acct.publicKey)) ? `${acct.name} address copied` : "Couldn't copy", 'ok')}
        className="flex h-10 w-10 items-center justify-center rounded-full text-muted hover:text-text"
      >
        <IconCopy className="h-4 w-4" />
      </button>
    </div>
  );
}

export function AccountSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const accounts = useAccounts();
  const active = useActiveAccount();
  const session = useSession();
  const toast = useToast();
  const navigate = useNavigate();
  const [newOpen, setNewOpen] = useState(false);
  const [name, setName] = useState('');
  const [createdName, setCreatedName] = useState('');
  const job = useJob();

  const infos = useQueries({
    queries: accounts.map((a) => ({ queryKey: keys.account(a.publicKey), queryFn: () => fetchAccount(a.publicKey), enabled: open, staleTime: 15_000 })),
  });

  const pick = async (a: AccountMeta) => {
    try {
      await setActiveAccount(a.id);
      onClose();
      toast(`Switched to ${a.name}`);
    } catch (e) {
      toast((e as Error).message, 'warn');
    }
  };

  const create = async () => {
    setNewOpen(false);
    const n = name.trim() || `Account ${accounts.length + 1}`;
    setCreatedName(n);
    await job.run([
      async () => {
        await addDerivedAccount(n);
      },
      async () => {},
    ]);
  };

  const canDerive = !!session.vault?.hasPhrase;

  return (
    <>
      <Sheet open={open && !newOpen} onClose={onClose}>
        <div className="flex items-center justify-between">
          <h2 className="m-0 text-lg font-semibold">Accounts</h2>
          <Link to="/settings/accounts" onClick={onClose} className="inline-flex min-h-11 items-center text-[13px] font-semibold">
            Manage
          </Link>
        </div>
        <div className="card-inner overflow-hidden">
          {accounts.map((a, i) => {
            const info = infos[i]?.data;
            const isActive = a.id === active?.id;
            const usdc = info?.balances.find((b) => b.asset.code === 'USDC');
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => pick(a)}
                className={`flex w-full items-center gap-3 border-b border-surface-3 px-3.5 py-2 text-left last:border-b-0 ${isActive ? 'bg-accent/[0.08]' : ''}`}
                style={{ minHeight: 64 }}
              >
                <Orb publicKey={a.publicKey} size={40} />
                <span className="flex min-w-0 flex-1 flex-col gap-px">
                  <span className="truncate text-[15px] font-semibold">{a.name}</span>
                  <span className="font-mono text-[11px] text-muted">{shortAddress(a.publicKey)}</span>
                </span>
                <span className="flex flex-col items-end gap-px">
                  <span className="text-sm font-semibold tabular">{info ? info.exists ? `${formatAmount(info.xlm.balance, { max: 2 })} XLM` : 'Not activated' : <span className="skeleton h-3.5 w-20" />}</span>
                  <span className="text-[11px] text-muted">{usdc ? `${formatAmount(usdc.balance)} USDC` : info?.exists ? 'no USDC yet' : a.kind === 'imported' ? 'imported' : ''}</span>
                </span>
                <span className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full ${isActive ? 'bg-accent text-accent-ink' : 'text-transparent'}`}>
                  <IconCheck className="h-3.5 w-3.5" strokeWidth={3} />
                </span>
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => (canDerive ? setNewOpen(true) : toast('This wallet was imported with a secret key, so it has no phrase to derive from.', 'warn'))} className="btn-secondary btn-sm">
            <IconPlus className="h-4 w-4" />
            New account
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              navigate('/import?add=1');
            }}
            className="btn-secondary btn-sm"
          >
            <IconKey className="h-4 w-4" />
            Import wallet
          </button>
        </div>
        <span className="hint">New accounts come from your one recovery phrase, so one backup covers all of them.</span>
      </Sheet>

      <Sheet open={newOpen} onClose={() => setNewOpen(false)} title="New account">
        <span className="text-sm leading-relaxed text-muted">
          Derived from your recovery phrase (path {session.vault ? session.vault.accounts.filter((a) => a.kind === 'derived').length : 0}). Same backup, new address.
        </span>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="newName" className="label">
            Name
          </label>
          <Input id="newName" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rent, Trading, Kids" maxLength={32} autoFocus />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setNewOpen(false)} className="btn-secondary">
            Cancel
          </button>
          <button type="button" onClick={create} className="btn-primary">
            Create
          </button>
        </div>
      </Sheet>

      <StepOverlay
        state={job.state}
        steps={[
          { label: 'Deriving from your recovery phrase', text: 'Next key on the SEP-5 path. Nothing new to back up.' },
          { label: 'Saving on this device', text: 'Encrypted with the same password.' },
        ]}
        done={
          <>
            <DoneHero title={`${createdName} is ready`} text="Same recovery phrase, new address. It needs XLM before it exists on Stellar, so fund it next." />
            <footer className="flex flex-col gap-2 px-4 pb-6 pt-2">
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  job.reset();
                  setName('');
                  onClose();
                }}
              >
                Go to {createdName}
              </button>
            </footer>
          </>
        }
        fail={(e) => (
          <>
            <DoneFail error={e} />
            <footer className="flex flex-col gap-2 px-4 pb-6 pt-2">
              <button type="button" className="btn-primary" onClick={job.reset}>
                Back
              </button>
            </footer>
          </>
        )}
      />
    </>
  );
}

function DoneFail({ error }: { error: unknown }) {
  const msg = error instanceof Error ? error.message : 'Please try again.';
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      <span className="text-[26px] font-bold">Couldn&apos;t add the account</span>
      <span className="max-w-[300px] text-sm text-muted">{msg}</span>
    </main>
  );
}
