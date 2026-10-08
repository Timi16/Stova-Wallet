import { friendlyMessage } from '@/app/errors';
import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useQueries } from '@tanstack/react-query';
import { useAccounts, useSession } from '@/app/session';
import { keys } from '@/app/queries';
import { copyText } from '@/app/clipboard';
import { useToast } from '@/app/toast';
import { sep5Path, shortAddress } from '@/core/keys';
import { explorerAccountUrl, fetchAccount, formatAmount } from '@/core/stellar';
import { addDerivedAccount, hideAccount, renameAccount, setDefaultAccount, type AccountMeta } from '@/core/vault';
import { BackButton, Header, Main, Screen } from '@/ui/Screen';
import { Orb } from '@/ui/Orb';
import { TabBar } from '@/ui/TabBar';
import { Sheet } from '@/ui/Sheet';
import { Input } from '@/ui/Field';
import { Section } from '@/ui/Row';
import { DoneHero, StepOverlay, useJob } from '@/ui/StepOverlay';
import { IconCheck, IconChevronRight, IconCopy, IconExternal, IconKey, IconPlus, IconTrash } from '@/ui/Icons';

/** Manage accounts: rename, make default, hide; add from the phrase or import another wallet. */
export function Accounts() {
  const accounts = useAccounts();
  const session = useSession();
  const toast = useToast();
  const [edit, setEdit] = useState<AccountMeta | null>(null);
  const [edName, setEdName] = useState('');
  const [rmAsk, setRmAsk] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [createdName, setCreatedName] = useState('');
  const job = useJob();

  const infos = useQueries({ queries: accounts.map((a) => ({ queryKey: keys.account(a.publicKey), queryFn: () => fetchAccount(a.publicKey), staleTime: 15_000 })) });

  if (!session.vault) return <Navigate to="/home" replace />;
  const vault = session.vault;
  const derived = accounts.filter((a) => a.kind === 'derived');
  const imported = accounts.filter((a) => a.kind === 'imported');
  const ed = edit ? accounts.find((a) => a.id === edit.id) ?? null : null;

  const openEdit = (a: AccountMeta) => {
    setEdit(a);
    setEdName(a.name);
    setRmAsk(false);
  };

  const create = async () => {
    setNewOpen(false);
    const n = newName.trim() || `Account ${accounts.length + 1}`;
    setCreatedName(n);
    await job.run([
      async () => {
        await addDerivedAccount(n);
      },
      async () => {},
    ]);
    setNewName('');
  };

  // Plain render function (not a nested component) so rows keep their DOM between renders.
  const row = (a: AccountMeta, i: number) => {
    const info = infos[i]?.data;
    const usdc = info?.balances.find((b) => b.asset.code === 'USDC');
    return (
      <button key={a.id} type="button" onClick={() => openEdit(a)} className="flex min-h-[68px] w-full items-center gap-3 px-4 py-2.5 text-left [&+&]:border-t [&+&]:border-line hover:bg-surface-2/60">
        <Orb publicKey={a.publicKey} size={44} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="inline-flex items-center gap-2 text-[15px] font-semibold">
            <span className="truncate">{a.name}</span>
            {a.id === vault.defaultId && <span className="rounded-full bg-surface-3 px-[7px] py-0.5 text-[10px] font-bold tracking-[0.04em] text-muted">DEFAULT</span>}
          </span>
          <span className="font-mono text-[11px] text-muted">
            {shortAddress(a.publicKey)}
            {a.kind === 'derived' ? ` · ${sep5Path(a.index ?? 0)}` : ' · own key'}
          </span>
        </span>
        <span className="flex flex-col items-end gap-0.5">
          <span className="text-sm font-semibold tabular">{info ? (info.exists ? `${formatAmount(info.xlm.balance, { max: 2 })} XLM` : 'Not activated') : '…'}</span>
          <span className="text-[11px] text-muted">{usdc ? `${formatAmount(usdc.balance)} USDC` : info?.exists ? 'no USDC' : ''}</span>
        </span>
        <IconChevronRight className="h-4 w-4 shrink-0 text-dim" />
      </button>
    );
  };

  return (
    <Screen>
      <Header
        left={<BackButton to="/settings" />}
        title="Accounts"
        right={
          vault.hasPhrase ? (
            <button type="button" onClick={() => setNewOpen(true)} aria-label="New account" className="icon-btn">
              <IconPlus className="h-5 w-5" strokeWidth={2.4} />
            </button>
          ) : undefined
        }
      />
      <Main className="pb-5">
        <div className="card flex items-start gap-3 px-4 py-3.5">
          <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-xl bg-surface-2 text-accent">
            <IconKey className="h-[17px] w-[17px]" />
          </span>
          <span className="text-[13px] leading-relaxed text-muted">
            {vault.hasPhrase ? (
              <>
                All of these come from <span className="font-semibold text-text">one recovery phrase</span>. Back it up once and every account is covered. A wallet you import has its own
                phrase or key.
              </>
            ) : (
              <>This wallet was imported with a secret key, so each account here has its own backup.</>
            )}
          </span>
        </div>

        {derived.length > 0 && (
          <Section title="From your recovery phrase">
            {derived.map((a) => row(a, accounts.indexOf(a)))}
          </Section>
        )}

        <section className="flex flex-col gap-1.5">
          <span className="label px-1">Imported wallets</span>
          {imported.length > 0 ? (
            <div className="card overflow-hidden">
              {imported.map((a) => row(a, accounts.indexOf(a)))}
            </div>
          ) : (
            <div className="card flex flex-col items-center gap-2 px-4 py-[18px] text-center">
              <span className="text-sm text-muted">None yet. Import a phrase or secret key from another wallet and it shows here with its own backup.</span>
              <Link to="/import?add=1" className="btn-secondary h-11 text-sm">
                <IconKey className="h-4 w-4" />
                Import a wallet
              </Link>
            </div>
          )}
          {imported.length > 0 && (
            <Link to="/import?add=1" className="btn-secondary btn-sm">
              <IconKey className="h-4 w-4" />
              Import another wallet
            </Link>
          )}
        </section>

        {vault.hasPhrase && (
          <button type="button" onClick={() => setNewOpen(true)} className="btn-primary">
            <IconPlus strokeWidth={2.4} />
            New account
          </button>
        )}
      </Main>
      <TabBar />

      <Sheet open={newOpen} onClose={() => setNewOpen(false)} title="New account">
        <span className="text-sm leading-relaxed text-muted">Derived from your recovery phrase (path {derived.length}). Same backup, new address.</span>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="newName" className="label">
            Name
          </label>
          <Input id="newName" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Rent, Trading, Kids" maxLength={32} autoFocus />
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

      <Sheet open={!!ed} onClose={() => setEdit(null)}>
        {ed && (
          <>
            <div className="flex items-center gap-3">
              <Orb publicKey={ed.publicKey} size={44} />
              <span className="flex flex-1 flex-col">
                <h2 className="m-0 text-lg font-semibold">{ed.name}</h2>
                <span className="font-mono text-xs text-muted">{shortAddress(ed.publicKey, 6, 6)}</span>
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="edname" className="label">
                Name
              </label>
              <div className="flex gap-2">
                <Input id="edname" value={edName} onChange={(e) => setEdName(e.target.value)} maxLength={32} className="h-12 min-w-0 flex-1 bg-surface-2" />
                <button
                  type="button"
                  onClick={async () => {
                    const n = edName.trim();
                    if (!n) return;
                    await renameAccount(ed.id, n);
                    toast(`Renamed to ${n}`);
                  }}
                  className="btn-primary h-12 px-4 text-sm"
                >
                  Save
                </button>
              </div>
            </div>
            <div className="card-inner overflow-hidden">
              <SheetRow icon={<IconCopy className="h-4 w-4" />} label="Copy address" onClick={async () => toast((await copyText(ed.publicKey)) ? `${ed.name} address copied` : "Couldn't copy")} />
              <SheetRow icon={<IconExternal className="h-4 w-4" />} label="View on Stellar Expert" href={explorerAccountUrl(ed.publicKey)} />
              {ed.id !== vault.defaultId && (
                <SheetRow
                  icon={<IconCheck className="h-4 w-4" />}
                  label="Make this the default"
                  onClick={async () => {
                    await setDefaultAccount(ed.id);
                    toast(`${ed.name} is now the default`);
                  }}
                />
              )}
              {ed.id !== vault.defaultId ? (
                <SheetRow icon={<IconTrash className="h-4 w-4" />} label="Hide from this device" danger onClick={() => setRmAsk(true)} />
              ) : (
                <span className="block px-4 py-3 text-xs text-dim">The default account can&apos;t be hidden. Make another one default first.</span>
              )}
            </div>
            {rmAsk && (
              <div className="flex flex-col gap-2.5 rounded-[14px] border border-bad/25 bg-bad/[0.08] p-3.5">
                <span className="text-[13px] leading-relaxed">
                  {ed.kind === 'derived'
                    ? 'Hiding only removes it from this list. The funds stay on Stellar and the same recovery phrase brings it back.'
                    : 'Hiding removes it from this list. The funds stay on Stellar; you will need its secret key or phrase to bring it back.'}
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setRmAsk(false)} className="btn-secondary h-11 text-sm">
                    Keep
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await hideAccount(ed.id);
                        toast(`${ed.name} hidden from this device`);
                        setEdit(null);
                      } catch (e) {
                        toast(friendlyMessage(e), 'warn');
                      }
                    }}
                    className="btn-danger h-11 text-sm"
                  >
                    Hide {ed.name}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </Sheet>

      <StepOverlay
        state={job.state}
        steps={[
          { label: 'Deriving from your recovery phrase', text: 'Next key on the SEP-5 path. Nothing new to back up.' },
          { label: 'Saving on this device', text: 'Encrypted with the same password.' },
        ]}
        done={
          <>
            <DoneHero title={`${createdName} is ready`} text="Same recovery phrase, new address. It needs XLM before it exists on Stellar." />
            <footer className="flex flex-col gap-2 px-4 pb-6 pt-2">
              <button type="button" className="btn-primary" onClick={job.reset}>
                Done
              </button>
            </footer>
          </>
        }
        fail={(e) => (
          <>
            <main className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
              <span className="text-[26px] font-bold">Couldn&apos;t add the account</span>
              <span className="max-w-[300px] text-sm text-muted">{friendlyMessage(e)}</span>
            </main>
            <footer className="flex flex-col gap-2 px-4 pb-6 pt-2">
              <button type="button" className="btn-primary" onClick={job.reset}>
                Back
              </button>
            </footer>
          </>
        )}
      />
    </Screen>
  );
}

function SheetRow({ icon, label, onClick, href, danger }: { icon: React.ReactNode; label: string; onClick?: () => void; href?: string; danger?: boolean }) {
  const cls = `flex min-h-[52px] w-full items-center gap-3 px-4 text-left text-sm font-medium [&+&]:border-t [&+&]:border-surface-3 ${danger ? 'text-bad' : 'text-text'}`;
  if (href)
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        {icon}
        {label}
      </a>
    );
  return (
    <button type="button" onClick={onClick} className={cls}>
      {icon}
      {label}
    </button>
  );
}
