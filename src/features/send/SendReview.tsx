import { friendlyMessage } from '@/app/errors';
import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useActiveAccount, useSession } from '@/app/session';
import { useAccountInfo, useRefreshAccount } from '@/app/queries';
import { sendDraft } from '@/app/drafts';
import { copyText } from '@/app/clipboard';
import { useToast } from '@/app/toast';
import { shortHash } from '@/app/format';
import { STELLAR } from '@/config';
import { chunkAddress, shortAddress } from '@/core/keys';
import {
  assetLabel,
  buildPayment,
  checkRecipient,
  describeError,
  explorerTxUrl,
  fetchTransactionByHash,
  formatAmount,
  isNative,
  sameAsset,
  subAmounts,
  submitSigned,
  SubmitPendingError,
  type BuiltPayment,
  type SubmitResult,
} from '@/core/stellar';
import { hasPasskey, isUnlocked, signTransaction, unlock, unlockWithPasskey } from '@/core/vault';
import { BackButton, Footer, Header, Main, Screen } from '@/ui/Screen';
import { Orb } from '@/ui/Orb';
import { KV, KVCard } from '@/ui/Row';
import { NetworkDot } from '@/ui/NetworkPill';
import { Sheet } from '@/ui/Sheet';
import { PasswordInput } from '@/ui/Field';
import { DoneHero, FailHero, StepOverlay, useJob } from '@/ui/StepOverlay';
import { IconArrowRight, IconCheck, IconCopy, IconExternal, IconFingerprint, IconLock, IconWarn, Spinner } from '@/ui/Icons';

/** Send · review, sign, submit, result. One signed XDR per review; never a blind resend. */
export function SendReview() {
  const acct = useActiveAccount();
  const session = useSession();
  const pk = acct?.publicKey ?? '';
  const info = useAccountInfo(pk);
  const refresh = useRefreshAccount(pk);
  const toast = useToast();
  const navigate = useNavigate();
  const draft = sendDraft.get();
  const [built, setBuilt] = useState<BuiltPayment | null>(draft?.built ?? null);
  const [rebuilt, setRebuilt] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [pw, setPw] = useState('');
  const [pwErr, setPwErr] = useState('');
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [phase, setPhase] = useState<'submitting' | 'polling'>('submitting');
  const job = useJob();

  useEffect(() => {
    if (session.status === 'locked' && job.state.phase === 'idle') setUnlockOpen(true);
  }, [session.status, job.state.phase]);

  if (!draft || !acct) return <Navigate to="/send" replace />;
  const { destination, asset, amount, memo, recipient } = draft;
  const native = isNative(asset);
  const bal = info.data?.balances.find((b) => sameAsset(b.asset, asset));
  const spendable = native ? (info.data?.xlm.spendable ?? '0') : bal ? subAmounts(bal.balance, bal.sellingLiabilities) : '0';
  const leftAfter = subAmounts(spendable, amount);

  /** Rebuild with a fresh sequence / fee / timeout, e.g. after tx_bad_seq or when the review took too long. */
  const rebuild = async (): Promise<BuiltPayment | null> => {
    setRebuilding(true);
    try {
      const r = await checkRecipient(destination, asset);
      const b = await buildPayment({ source: pk, destination, asset, amount, memo }, r);
      sendDraft.patch({ built: b, recipient: r });
      setBuilt(b);
      setRebuilt(true);
      return b;
    } catch (e) {
      const f = describeError(e);
      toast(`${f.title}. ${f.message}`, 'warn');
      return null;
    } finally {
      setRebuilding(false);
    }
  };

  const sign = async () => {
    if (confirmed) return;
    // Read the live session, not the render closure: this runs right after the unlock sheet succeeds.
    if (!isUnlocked()) {
      setUnlockOpen(true);
      return;
    }
    setConfirmed(true);
    let tx = built;
    // A reviewed transaction expires after 60 s. If the review took long, rebuild before signing.
    if (!tx || Date.now() - tx.builtAt > (STELLAR.txTimeoutSeconds - 10) * 1000) {
      tx = await rebuild();
      if (!tx) {
        setConfirmed(false);
        return;
      }
    }
    const theTx = tx;
    await job.run([
      async () => {
        signTransaction(theTx.tx, pk);
      },
      async () => {
        try {
          const r = await submitSigned(theTx.tx, (s) => setPhase(s));
          setResult(r);
        } catch (e) {
          if (e instanceof SubmitPendingError) {
            setPending(e.hash);
            return;
          }
          throw e;
        }
      },
      async () => {
        await refresh();
      },
    ]);
    // The draft stays until the user leaves the result screen (Done / Send another clear it),
    // otherwise this screen would redirect to the form before showing the result.
  };

  const retryAfterFail = async (action: 'stop' | 'rebuild' | 'poll') => {
    job.reset();
    setConfirmed(false);
    if (action === 'rebuild') await rebuild();
  };

  const checkPending = async () => {
    if (!pending) return;
    const found = await fetchTransactionByHash(pending).catch(() => null);
    if (found) {
      setResult(found);
      setPending(null);
      await refresh();
    } else toast('Not on the ledger yet. Nothing was sent twice.', 'warn');
  };

  const steps = [
    { label: 'Signing on this device', text: 'Your key is used here, in this browser, and nowhere else.' },
    { label: phase === 'polling' ? 'Still confirming' : 'Sending to Stellar Testnet', text: phase === 'polling' ? 'Stellar is slow right now. STOVA is checking by transaction hash so nothing gets sent twice.' : 'The signed transaction is on its way. This usually takes about 5 seconds.' },
    { label: 'Updating balances', text: 'Reading the new balances from Horizon.' },
  ];

  return (
    <Screen>
      <Header left={<BackButton to="/send" />} title="Review" />
      <Main>
        <section className="flex items-center justify-center gap-3.5 pt-1">
          <div className="flex flex-col items-center gap-1.5">
            <Orb publicKey={pk} size={52} />
            <span className="text-xs text-muted">{acct.name}</span>
          </div>
          <IconArrowRight className="h-6 w-14 text-accent" />
          <div className="flex flex-col items-center gap-1.5">
            <Orb publicKey={destination} size={52} />
            <span className="font-mono text-xs text-muted">{shortAddress(destination)}</span>
          </div>
        </section>
        <section className="flex flex-col items-center gap-1">
          <div className="flex items-baseline gap-2">
            <span className="text-[44px] font-bold leading-none tracking-[-0.035em] tabular">{formatAmount(amount)}</span>
            <span className="text-lg font-medium text-muted">{asset.code}</span>
          </div>
          <span className="text-[13px] text-muted">
            {formatAmount(leftAfter)} {asset.code} left after this send
          </span>
        </section>
        <section className="card px-4 py-1 text-sm">
          <div className="flex flex-col gap-1 border-b border-line py-3">
            <span className="text-xs font-semibold text-muted">To</span>
            <span className="font-mono text-xs leading-[1.6] break-all">{chunkAddress(destination)}</span>
          </div>
          <KV k="Asset" v={assetLabel(asset)} />
          <KV k="Memo" v={memo || <span className="font-normal text-muted">none</span>} />
          <KV k="Network fee" v={built ? `${built.feeXlm} XLM` : '…'} />
          <KV
            k="Network"
            v={
              <span className="inline-flex items-center gap-[7px]">
                <NetworkDot />
                Stellar Testnet
              </span>
            }
          />
        </section>
        <section className="flex flex-col gap-2 px-1 text-[13px] text-text-2">
          {recipient?.exists ? (
            <span className="flex items-center gap-2.5">
              <IconCheck className="h-4 w-4 text-good" />
              Recipient account exists
            </span>
          ) : (
            <span className="flex items-center gap-2.5 text-warn">
              <IconWarn className="h-4 w-4" />
              New account: this payment creates it with {formatAmount(amount)} XLM
            </span>
          )}
          {!native && (
            <span className="flex items-center gap-2.5">
              <IconCheck className="h-4 w-4 text-good" />
              Recipient can receive {assetLabel(asset)}
            </span>
          )}
          {rebuilt && (
            <span className="flex items-center gap-2.5 text-warn">
              <IconWarn className="h-4 w-4" />
              Rebuilt with fresh details after the last try.
            </span>
          )}
        </section>
      </Main>
      <Footer className="gap-2.5">
        <button type="button" onClick={sign} disabled={confirmed || rebuilding || !built} className="btn-primary">
          {rebuilding ? <Spinner /> : <IconLock />}
          {rebuilding ? 'Rebuilding…' : 'Confirm and sign'}
        </button>
        <Link to="/send" className="btn-ghost">
          Edit details
        </Link>
        <span className="text-center text-xs text-dim">Signed on this device. Your key never leaves this browser.</span>
      </Footer>

      <Sheet open={unlockOpen} onClose={() => setUnlockOpen(false)} title="Unlock to sign">
        <span className="text-sm text-muted">STOVA locked while you were reviewing. Enter your password to sign this one transaction.</span>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await unlock(pw);
              setPw('');
              setUnlockOpen(false);
              void sign();
            } catch (ex) {
              setPwErr(friendlyMessage(ex));
            }
          }}
          className="flex flex-col gap-3"
        >
          <PasswordInput value={pw} onChange={(e) => { setPw(e.target.value); setPwErr(''); }} placeholder="Password" aria-label="Password" autoFocus bad={!!pwErr} className="bg-surface-2" />
          {pwErr && <span className="error-text">{pwErr}</span>}
          {hasPasskey(session.vault) && (
            <button
              type="button"
              className="btn-secondary"
              onClick={async () => {
                try {
                  await unlockWithPasskey();
                  setUnlockOpen(false);
                  void sign();
                } catch (ex) {
                  setPwErr(friendlyMessage(ex));
                }
              }}
            >
              <IconFingerprint />
              Use fingerprint or face
            </button>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setUnlockOpen(false)} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              <IconLock className="h-4 w-4" />
              Unlock and sign
            </button>
          </div>
        </form>
      </Sheet>

      <StepOverlay
        state={job.state}
        steps={steps}
        done={
          pending ? (
            <PendingView hash={pending} onCheck={checkPending} onHome={() => navigate('/home')} />
          ) : (
            <>
              <DoneHero
                title={`Sent ${formatAmount(amount)} ${asset.code}`}
                text={
                  <>
                    to <span className="font-mono text-text">{shortAddress(destination)}</span> · confirmed in ledger {result?.ledger.toLocaleString() ?? '…'}
                  </>
                }
              >
                <KVCard className="w-full text-left">
                  <KV k="Transaction" v={result ? shortHash(result.hash) : '…'} mono />
                  <KV k="Ledger" v={result?.ledger.toLocaleString() ?? '…'} mono />
                  <KV k="Fee paid" v={result ? `${result.feeCharged} XLM` : '…'} />
                  <KV k={`${asset.code} now`} v={formatAmount(native ? (info.data?.xlm.balance ?? '0') : (info.data?.balances.find((b) => sameAsset(b.asset, asset))?.balance ?? '0'))} />
                </KVCard>
                <div className="grid w-full grid-cols-2 gap-2">
                  <button type="button" onClick={async () => result && toast((await copyText(result.hash)) ? 'Transaction hash copied' : "Couldn't copy")} className="btn-secondary h-12 text-sm">
                    <IconCopy className="h-4 w-4" />
                    Copy hash
                  </button>
                  {result && (
                    <a href={explorerTxUrl(result.hash)} target="_blank" rel="noopener noreferrer" className="btn-secondary h-12 text-sm">
                      <IconExternal className="h-4 w-4" />
                      Stellar Expert
                    </a>
                  )}
                </div>
              </DoneHero>
              <Footer>
                <Link to="/home" className="btn-primary" onClick={() => sendDraft.clear()}>
                  Done
                </Link>
                <Link to="/send" className="btn-ghost" onClick={() => sendDraft.clear()}>
                  Send another
                </Link>
              </Footer>
            </>
          )
        }
        fail={(e) => {
          const f = describeError(e);
          return (
            <>
              <FailHero title={f.action === 'rebuild' ? f.title : 'Nothing was sent'} text={f.action === 'rebuild' ? f.message : `${f.title}. ${f.message}`} code={f.code}>
                <span className="text-xs text-dim">
                  Your {formatAmount(spendable)} {asset.code} is untouched.{f.action === 'rebuild' ? '' : ' No fee was charged.'}
                </span>
              </FailHero>
              <Footer>
                <button type="button" className="btn-primary" onClick={() => retryAfterFail(f.action)}>
                  {f.action === 'rebuild' ? 'Review again' : 'Try again'}
                </button>
                <Link to="/home" className="btn-ghost" onClick={() => sendDraft.clear()}>
                  Back to wallet
                </Link>
              </Footer>
            </>
          );
        }}
      />
    </Screen>
  );
}

function PendingView({ hash, onCheck, onHome: goHome }: { hash: string; onCheck: () => void; onHome: () => void }) {
  const onHome = () => {
    sendDraft.clear();
    goHome();
  };
  return (
    <>
      <main className="scroll-y flex flex-col items-center justify-center gap-[18px] px-5 py-6 text-center">
        <div className="relative flex h-[136px] w-[136px] items-center justify-center">
          <span className="absolute inset-1.5 rounded-full border-[3px] border-surface-3 border-t-warn animate-spin" />
          <IconWarn className="h-12 w-12 text-warn" />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[26px] font-bold tracking-[-0.02em]">Checking whether it went through</span>
          <span className="max-w-[300px] text-sm leading-relaxed text-muted">
            Stellar didn&apos;t confirm in time. The transaction may still land. STOVA will not send it again: check by hash instead.
          </span>
        </div>
        <KVCard className="w-full text-left">
          <KV k="Hash" v={shortHash(hash)} mono />
        </KVCard>
        <a href={explorerTxUrl(hash)} target="_blank" rel="noopener noreferrer" className="btn-secondary h-12 w-full text-sm">
          <IconExternal className="h-4 w-4" />
          Look it up on Stellar Expert
        </a>
      </main>
      <Footer>
        <button type="button" className="btn-primary" onClick={onCheck}>
          Check again
        </button>
        <button type="button" className="btn-ghost" onClick={onHome}>
          Back to wallet
        </button>
      </Footer>
    </>
  );
}
