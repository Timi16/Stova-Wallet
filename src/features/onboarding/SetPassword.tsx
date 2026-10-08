import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { onboardingDraft } from '@/app/drafts';
import { SECURITY } from '@/config';
import { shortAddress } from '@/core/keys';
import { createWalletFromPhrase, createWalletFromSecret, StorageUnavailableError } from '@/core/vault';
import { BackButton, Footer, Header, Main, Screen, StepBadge, Title } from '@/ui/Screen';
import { Field, PasswordInput } from '@/ui/Field';
import { Orb } from '@/ui/Orb';
import { NetworkDot } from '@/ui/NetworkPill';
import { IconCheck } from '@/ui/Icons';
import { DoneHero, FailHero, StepOverlay, useJob } from '@/ui/StepOverlay';
import { passwordStrength, strengthColor } from './password';

/** Create · step 3 (and the last import step): password, confirm, strength meter, then the step loader. */
export function SetPassword() {
  const navigate = useNavigate();
  const draft = onboardingDraft.get();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [agree, setAgree] = useState(false);
  const [tried, setTried] = useState(false);
  const job = useJob();

  const phraseWords = draft && 'mnemonic' in draft ? draft.mnemonic.split(' ') : [];
  const st = useMemo(() => passwordStrength(pw, phraseWords), [pw, phraseWords]);
  const match = pw === pw2;
  const ok = st.longEnough && st.mixed && st.notPhrase && match && agree;

  if (!draft || (draft.kind === 'create' && !draft.confirmed)) return <Navigate to={draft?.kind === 'create' ? '/create/confirm' : '/welcome'} replace />;
  const isCreate = draft.kind === 'create';
  const publicKey = isCreate ? null : 'publicKey' in draft ? draft.publicKey : null;

  const run = () =>
    job.run([
      async () => {},
      async () => {},
      async () => {
        if (draft.kind === 'create' || draft.kind === 'import-phrase') await createWalletFromPhrase(draft.mnemonic, pw);
        else if (draft.kind === 'import-secret') await createWalletFromSecret(draft.secret, pw);
      },
    ]);

  const steps = isCreate
    ? [
        { label: 'Generating your keys', text: 'A fresh Stellar keypair, made right here in your browser.' },
        { label: 'Encrypting with your password', text: 'AES-256 with a key derived from your password. Nothing leaves this device.' },
        { label: 'Saving on this device', text: 'Stored in this browser only. Your recovery phrase is the backup.' },
      ]
    : [
        { label: 'Checking your keys', text: 'Deriving your address the same way Freighter and Lobstr do.' },
        { label: 'Encrypting with your password', text: 'AES-256 with a key derived from your password. Nothing leaves this device.' },
        { label: 'Saving on this device', text: 'Stored in this browser only. Your phrase or secret is the backup.' },
      ];

  const seg = (n: number) => ({ background: st.score >= n ? strengthColor(st.score) : 'var(--color-surface-3)' });
  const Check = ({ on, children }: { on: boolean; children: string }) => (
    <span className="flex items-center gap-2">
      <span className={`flex h-[18px] w-[18px] items-center justify-center rounded-full ${on ? 'bg-good text-ground' : 'bg-surface-3 text-surface-3'}`}>
        <IconCheck className="h-3 w-3" strokeWidth={3} />
      </span>
      {children}
    </span>
  );

  return (
    <Screen>
      <Header left={<BackButton to={isCreate ? '/create/confirm' : '/import'} />} title={isCreate ? 'Last step' : 'Set a password'} right={isCreate ? <StepBadge>3 of 3</StepBadge> : undefined} />
      <Main className="gap-[18px] px-5">
        <Title sub="It unlocks STOVA on this device only. It is not a way to recover your wallet, your phrase is.">Lock it with a password</Title>
        <Field label="Password" error={tried && (!st.longEnough || !st.mixed) ? st.hint : null}>
          {(id) => (
            <div className="flex flex-col gap-2">
              <PasswordInput id={id} value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" bad={tried && (!st.longEnough || !st.mixed)} autoFocus />
              <div className="flex gap-1">
                {[1, 2, 3, 4].map((n) => (
                  <span key={n} className="h-1 flex-1 rounded-full" style={seg(n)} />
                ))}
              </div>
              <span className="text-xs" style={{ color: st.score === 0 ? 'var(--color-dim)' : strengthColor(st.score) }}>
                {st.hint}
              </span>
            </div>
          )}
        </Field>
        <Field label="Confirm password" error={tried && !match ? "The two passwords don't match." : null}>
          {(id) => <PasswordInput id={id} value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" bad={tried && !match} />}
        </Field>
        <div className="card flex flex-col gap-2 px-4 py-3.5 text-[13px] text-muted">
          <Check on={st.longEnough}>{`At least ${SECURITY.minPasswordLength} characters`}</Check>
          <Check on={st.mixed}>Letters and numbers</Check>
          <Check on={pw.length > 0 && st.notPhrase}>Not the same as your recovery words</Check>
        </div>
        <label className="flex items-start gap-3 text-[13px] leading-relaxed text-muted">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0" />
          I understand STOVA can&apos;t reset this password. If I forget it, I re-import with my recovery phrase.
        </label>
      </Main>
      <Footer className="px-5">
        <button
          type="button"
          onClick={() => {
            if (!ok) {
              setTried(true);
              return;
            }
            void run();
          }}
          className={ok ? 'btn-primary' : 'btn-primary bg-surface-2 text-dim'}
        >
          {isCreate ? 'Create wallet' : 'Import wallet'}
        </button>
      </Footer>

      <StepOverlay
        state={job.state}
        steps={steps}
        done={
          <Done
            publicKey={publicKey}
            isCreate={isCreate}
            onOpen={() => {
              onboardingDraft.clear(); // the phrase leaves memory here; the vault holds it encrypted
              navigate('/home', { replace: true });
            }}
          />
        }
        fail={(e) => (
          <>
            <FailHero
              title={e instanceof StorageUnavailableError ? "Couldn't save the wallet" : 'Something went wrong'}
              text={
                e instanceof StorageUnavailableError
                  ? "This browser wouldn't let STOVA store anything. Private browsing and full storage do this. Nothing was created, and your words are still safe."
                  : (e as Error)?.message || 'Please try again.'
              }
            />
            <Footer>
              <button type="button" className="btn-primary" onClick={job.reset}>
                Try again
              </button>
              <Link to="/welcome" className="btn-ghost" onClick={() => onboardingDraft.clear()}>
                Back to start
              </Link>
            </Footer>
          </>
        )}
      />
    </Screen>
  );
}

function Done({ publicKey, isCreate, onOpen }: { publicKey: string | null; isCreate: boolean; onOpen: () => void }) {
  // After creation the session is unlocked, so the vault's first account is the one we just made.
  return (
    <>
      <DoneHero title={isCreate ? 'Your wallet is ready' : 'Wallet imported'} text="Encrypted on this device and locked with your password.">
        <ReadyCard publicKey={publicKey} />
      </DoneHero>
      <Footer>
        <button type="button" className="btn-primary" onClick={onOpen}>
          Open my wallet
        </button>
      </Footer>
    </>
  );
}

function ReadyCard({ publicKey }: { publicKey: string | null }) {
  const pk = publicKey ?? '';
  return (
    <div className="card flex w-full items-center gap-3 px-4 py-3.5 text-left">
      {pk && <Orb publicKey={pk} size={40} />}
      <span className="flex min-w-0 flex-col">
        <span className="text-sm font-semibold">Main account</span>
        {pk && <span className="font-mono text-xs text-muted">{shortAddress(pk)}</span>}
      </span>
      <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted">
        <NetworkDot />
        Testnet
      </span>
    </div>
  );
}
