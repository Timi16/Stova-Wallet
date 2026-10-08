import { friendlyMessage } from '@/app/errors';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useActiveAccount, useSession } from '@/app/session';
import { copySecret } from '@/app/clipboard';
import { useToast } from '@/app/toast';
import { SECURITY } from '@/config';
import { chunkAddress } from '@/core/keys';
import { revealSecrets, WrongPasswordError } from '@/core/vault';
import { BackButton, Footer, Header, Main, Screen } from '@/ui/Screen';
import { PasswordInput } from '@/ui/Field';
import { IconCheck, IconClose, IconCopy, IconEye, IconLock, IconWarn } from '@/ui/Icons';

/**
 * Settings › Show recovery phrase / secret key.
 * Warning → password → reveal (blurred until pressed, hides again after 30 s).
 * The revealed strings live in a ref and are wiped on hide and on unmount.
 */
export function Export() {
  const acct = useActiveAccount();
  const session = useSession();
  const toast = useToast();
  const [st, setSt] = useState<'warn' | 'pw' | 'show'>('warn');
  const [agree, setAgree] = useState(false);
  const [pw, setPw] = useState('');
  const [pwErr, setPwErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'phrase' | 'secret'>('phrase');
  const [hidden, setHidden] = useState(true);
  const [secs, setSecs] = useState(SECURITY.revealSeconds);
  const secretRef = useRef<{ mnemonic?: string; secret: string } | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const hasPhrase = !!session.vault?.hasPhrase && acct?.kind === 'derived';

  useEffect(() => {
    if (!hasPhrase) setMode('secret');
  }, [hasPhrase]);

  useEffect(
    () => () => {
      secretRef.current = null;
      if (timer.current) clearInterval(timer.current);
    },
    [],
  );

  if (!acct) return <Navigate to="/settings" replace />;

  const check = async (e?: FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    try {
      secretRef.current = await revealSecrets(pw, acct.publicKey);
      setPw('');
      setSt('show');
    } catch (ex) {
      setPwErr(ex instanceof WrongPasswordError ? 'Wrong password.' : friendlyMessage(ex));
    } finally {
      setBusy(false);
    }
  };

  const reveal = () => {
    setHidden(false);
    setSecs(SECURITY.revealSeconds);
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => {
      setSecs((s) => {
        if (s <= 1) {
          if (timer.current) clearInterval(timer.current);
          setHidden(true);
          return SECURITY.revealSeconds;
        }
        return s - 1;
      });
    }, 1000);
  };

  const hide = () => {
    if (timer.current) clearInterval(timer.current);
    setHidden(true);
    setSecs(SECURITY.revealSeconds);
  };

  const words = secretRef.current?.mnemonic?.split(' ') ?? [];
  const secret = secretRef.current?.secret ?? '';
  const copyLabel = mode === 'phrase' ? 'Copy phrase' : 'Copy secret key';

  return (
    <Screen>
      <Header left={<BackButton to="/settings" />} title={hasPhrase ? 'Recovery phrase' : 'Secret key'} />
      <Main className="px-5 pb-4">
        {st === 'warn' && (
          <>
            <div className="flex flex-col items-center gap-3.5 pb-2 pt-6 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-bad/[0.12] text-bad">
                <IconWarn className="h-[30px] w-[30px]" />
              </span>
              <h2 className="m-0 text-[22px] font-bold">Before you continue</h2>
            </div>
            <ul className="m-0 flex list-none flex-col gap-2.5 p-0 text-sm leading-relaxed">
              <li className="card flex gap-2.5 px-3.5 py-3">
                <IconClose className="h-[18px] w-[18px] shrink-0 text-bad" strokeWidth={2.6} />
                STOVA support, Stellar, or anyone else will never ask for these words.
              </li>
              <li className="card flex gap-2.5 px-3.5 py-3">
                <IconClose className="h-[18px] w-[18px] shrink-0 text-bad" strokeWidth={2.6} />
                Don&apos;t screenshot them or paste them into a chat.
              </li>
              <li className="card flex gap-2.5 px-3.5 py-3">
                <IconCheck className="h-[18px] w-[18px] shrink-0 text-good" />
                Write them on paper, in order, and keep it somewhere only you can reach.
              </li>
            </ul>
            <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="h-5 w-5" />
              Nobody is watching my screen
            </label>
          </>
        )}

        {st === 'pw' && (
          <>
            <div className="flex flex-col gap-1.5 pt-2">
              <h2 className="m-0 text-[22px] font-bold">Enter your password</h2>
              <span className="text-sm text-muted">This decrypts the {hasPhrase ? 'phrase' : 'key'} on this device only.</span>
            </div>
            <form onSubmit={check} noValidate className="flex flex-col gap-2">
              <PasswordInput value={pw} onChange={(e) => { setPw(e.target.value); setPwErr(''); }} placeholder="Password" aria-label="Password" autoFocus autoComplete="current-password" bad={!!pwErr} className={pwErr ? 'animate-shake' : ''} />
              {pwErr && (
                <span role="alert" className="error-text">
                  {pwErr}
                </span>
              )}
            </form>
          </>
        )}

        {st === 'show' && (
          <>
            {hasPhrase && (
              <div role="tablist" aria-label="What to show" className="seg">
                <button type="button" role="tab" aria-selected={mode === 'phrase'} onClick={() => { setMode('phrase'); hide(); }} className="seg-btn">
                  Recovery phrase
                </button>
                <button type="button" role="tab" aria-selected={mode === 'secret'} onClick={() => { setMode('secret'); hide(); }} className="seg-btn">
                  Secret key
                </button>
              </div>
            )}
            <div className="card relative p-3.5">
              {mode === 'phrase' ? (
                <ol className="m-0 grid list-none grid-cols-2 gap-2 p-0">
                  {words.map((w, i) => (
                    <li key={i} className="flex h-11 items-center gap-2 rounded-xl bg-surface-2 px-3 text-[15px] font-medium">
                      <span className="w-[18px] font-mono text-xs text-dim">{i + 1}</span>
                      <span className={hidden ? 'blur-secret' : ''}>{w}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <span className={`block font-mono text-sm leading-[1.8] break-all ${hidden ? 'blur-secret' : ''}`}>{chunkAddress(secret)}</span>
              )}
              {hidden && (
                <button type="button" onClick={reveal} className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-[20px] bg-ground/55 text-[15px] font-semibold">
                  <IconEye className="h-6 w-6" />
                  Tap to reveal
                  <span className="text-xs font-medium text-muted">Hides again in {SECURITY.revealSeconds} s</span>
                </button>
              )}
            </div>
            {!hidden && (
              <div className="flex items-center justify-between px-1 text-[13px] text-muted">
                <span>Hides in {secs} s</span>
                <button type="button" onClick={hide} className="h-9 text-[13px] font-semibold text-accent">
                  Hide now
                </button>
              </div>
            )}
            {mode === 'secret' && acct.kind === 'derived' && <span className="hint px-1">This is the secret key for {acct.name} only. The recovery phrase covers every account.</span>}
            <button
              type="button"
              disabled={hidden}
              onClick={async () => {
                const v = mode === 'phrase' ? (secretRef.current?.mnemonic ?? '') : secret;
                toast((await copySecret(v)) ? `Copied. STOVA clears your clipboard in ${SECURITY.clipboardClearSeconds} s.` : "Couldn't copy");
              }}
              className="btn-secondary h-12 rounded-2xl text-[15px]"
            >
              <IconCopy className="h-4 w-4" />
              {copyLabel}
            </button>
            <span className="text-center text-xs text-dim">Copying puts it on your clipboard for {SECURITY.clipboardClearSeconds} seconds, then STOVA clears it.</span>
          </>
        )}
      </Main>
      <Footer className="px-5">
        {st === 'warn' && (
          <button type="button" disabled={!agree} onClick={() => setSt('pw')} className={agree ? 'btn-primary' : 'btn-primary bg-surface-2 text-dim'}>
            I understand, continue
          </button>
        )}
        {st === 'pw' && (
          <button type="button" onClick={() => check()} disabled={busy || !pw} className="btn-primary">
            <IconLock />
            {busy ? 'Decrypting…' : hasPhrase ? 'Show my phrase' : 'Show my secret key'}
          </button>
        )}
        {st === 'show' && (
          <Link to="/settings" className="btn-secondary" onClick={() => (secretRef.current = null)}>
            Done
          </Link>
        )}
      </Footer>
    </Screen>
  );
}
