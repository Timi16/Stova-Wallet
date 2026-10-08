import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAccounts, useActiveAccount, useSession } from '@/app/session';
import { clearQueryCache } from '@/app/queryClient';
import { SECURITY } from '@/config';
import { shortAddress } from '@/core/keys';
import { CooldownError, cooldownSecondsLeft, hasPasskey, removeWallet, unlock, unlockWithPasskey, WrongPasswordError } from '@/core/vault';
import { Screen } from '@/ui/Screen';
import { StovaMark } from '@/ui/Logo';
import { NetworkPill } from '@/ui/NetworkPill';
import { Orb } from '@/ui/Orb';
import { PasswordInput } from '@/ui/Field';
import { Sheet } from '@/ui/Sheet';
import { IconFingerprint, IconLock, Spinner } from '@/ui/Icons';

/** Every later visit starts here. Wrong password = GCM failure; 5 fails = 30 s cooldown. */
export function Unlock() {
  const navigate = useNavigate();
  const loc = useLocation();
  const session = useSession();
  const acct = useActiveAccount();
  const accounts = useAccounts();
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [cool, setCool] = useState(cooldownSecondsLeft());
  const [forgot, setForgot] = useState(false);
  const from = (loc.state as { from?: string } | null)?.from ?? '/home';

  useEffect(() => {
    if (session.status === 'unlocked') navigate(from, { replace: true });
  }, [session.status, from, navigate]);

  useEffect(() => {
    if (session.cooldownUntil === 0) {
      setCool(0);
      return;
    }
    const t = setInterval(() => {
      const left = cooldownSecondsLeft();
      setCool(left);
      if (left === 0) {
        setErr('');
        clearInterval(t);
      }
    }, 250);
    return () => clearInterval(t);
  }, [session.cooldownUntil]);

  const cooling = cool > 0;
  const passkey = hasPasskey(session.vault);

  const bioUnlock = async () => {
    if (cooling || busy) return;
    setBusy(true);
    setErr('');
    try {
      await unlockWithPasskey();
    } catch (ex) {
      setErr((ex as Error).message || 'Unlock was cancelled.');
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (cooling || busy) return;
    setBusy(true);
    try {
      await unlock(pw);
      setPw('');
    } catch (ex) {
      if (ex instanceof CooldownError) setErr('');
      else if (ex instanceof WrongPasswordError) {
        const left = SECURITY.maxUnlockFails - (session.fails + 1);
        setErr(left > 0 ? `Wrong password. ${left} ${left === 1 ? 'try' : 'tries'} left.` : 'Wrong password.');
      } else setErr((ex as Error).message);
      setPw('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <header className="flex justify-end px-4 pt-4">
        <NetworkPill />
      </header>
      <main className="scroll-y flex flex-col items-center gap-6 px-6 pt-10">
        <StovaMark size={64} />
        <div className="flex flex-col items-center gap-1.5">
          <span className="text-2xl font-bold tracking-[-0.01em]">Welcome back</span>
          {acct && (
            <span className="inline-flex h-8 items-center gap-2 rounded-full bg-surface py-0 pl-1 pr-3 text-[13px] text-muted">
              <Orb publicKey={acct.publicKey} size={24} />
              <span className="font-semibold text-text">{acct.name}</span>
              <span className="font-mono text-xs">{shortAddress(acct.publicKey)}</span>
              {accounts.length > 1 && <span className="text-dim">+{accounts.length - 1}</span>}
            </span>
          )}
        </div>
        <form onSubmit={submit} noValidate className="flex w-full flex-col gap-2.5">
          <label htmlFor="pw" className="label">
            Password
          </label>
          <PasswordInput
            id="pw"
            value={pw}
            onChange={(e) => {
              setPw(e.target.value);
              setErr('');
            }}
            disabled={cooling}
            autoComplete="current-password"
            autoFocus
            bad={!!err}
            className={err ? 'animate-shake' : ''}
          />
          {(err || cooling) && (
            <span role="alert" className="error-text">
              {cooling ? `Too many tries. Wait ${cool} s.` : err}
            </span>
          )}
          <button type="submit" disabled={cooling || busy || !pw} className={cooling ? 'btn-primary bg-surface-2 text-dim' : 'btn-primary'}>
            {busy ? <Spinner /> : <IconLock />}
            {cooling ? `Locked for ${cool} s` : busy ? 'Unlocking…' : 'Unlock'}
          </button>
          {passkey && (
            <>
              <div className="flex items-center gap-2.5 py-0.5 text-xs text-dim">
                <span className="h-px flex-1 bg-line" />
                or
                <span className="h-px flex-1 bg-line" />
              </div>
              <button type="button" onClick={bioUnlock} disabled={cooling || busy} className="btn-secondary">
                <IconFingerprint />
                Unlock with fingerprint or face
              </button>
            </>
          )}
        </form>
      </main>
      <footer className="flex flex-col items-center gap-1 px-6 pb-7 pt-3">
        <button type="button" onClick={() => setForgot(true)} className="btn-ghost">
          Forgot password? Re-import with your phrase
        </button>
        <Link to="/settings/network" className="text-xs text-dim">
          Network: Testnet
        </Link>
      </footer>

      <Sheet open={forgot} onClose={() => setForgot(false)} title="Start over with your recovery phrase">
        <span className="text-sm leading-relaxed text-muted">
          STOVA can&apos;t reset a password. Re-importing removes the encrypted wallet from this device, then you type your recovery phrase (or secret key) and set a new password.
          Your funds stay on Stellar the whole time.
        </span>
        <div className="flex gap-3 rounded-2xl border border-bad/25 bg-bad/[0.08] p-3.5 text-[13px] leading-relaxed">Without the phrase or secret key, this wallet cannot be brought back.</div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setForgot(false)} className="btn-secondary">
            Keep wallet
          </button>
          <button
            type="button"
            onClick={async () => {
              await removeWallet();
              await clearQueryCache();
              navigate('/import', { replace: true });
            }}
            className="btn-danger"
          >
            Remove and re-import
          </button>
        </div>
      </Sheet>
    </Screen>
  );
}
