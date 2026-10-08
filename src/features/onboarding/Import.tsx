import { friendlyMessage } from '@/app/errors';
import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { onboardingDraft } from '@/app/drafts';
import { useSession } from '@/app/session';
import { useToast } from '@/app/toast';
import { checkSecret, previewPhrase, shortAddress } from '@/core/keys';
import { addImportedAccount, addImportedPhraseAccount } from '@/core/vault';
import { BackButton, Footer, Header, Main, Screen } from '@/ui/Screen';
import { Field, Input, Textarea } from '@/ui/Field';
import { Orb } from '@/ui/Orb';
import { IconCheck, IconEye, IconEyeOff } from '@/ui/Icons';

/**
 * Import by recovery phrase or S… secret. Shows the derived G… before saving.
 * With `?add=1` (from an unlocked wallet) it adds an account instead of
 * creating a new vault.
 */
export function Import() {
  const loc = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const session = useSession();
  const adding = new URLSearchParams(loc.search).get('add') === '1' && session.status === 'unlocked';
  const [mode, setMode] = useState<'phrase' | 'secret'>('phrase');
  const [phrase, setPhrase] = useState('');
  const [secret, setSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);

  const phraseCheck = useMemo(() => previewPhrase(phrase), [phrase]);
  const secretCheck = useMemo(() => checkSecret(secret), [secret]);
  const isPhrase = mode === 'phrase';
  const valid = isPhrase ? phraseCheck.ok : secretCheck.ok;
  const previewKey = isPhrase ? (phraseCheck.ok ? phraseCheck.publicKey : null) : secretCheck.ok ? secretCheck.publicKey : null;
  const alreadyHere = !!previewKey && !!session.vault?.accounts.some((a) => a.publicKey === previewKey && !a.hidden);

  const go = async () => {
    if (!valid) {
      setTried(true);
      return;
    }
    if (adding) {
      if (alreadyHere) {
        toast('That account is already in this wallet.', 'warn');
        return;
      }
      setBusy(true);
      try {
        const meta = isPhrase && phraseCheck.ok ? await addImportedPhraseAccount(phraseCheck.phrase, 'Imported wallet') : secretCheck.ok ? await addImportedAccount(secretCheck.secret, 'Imported wallet') : null;
        if (meta) {
          toast(`Imported ${shortAddress(meta.publicKey)}`);
          navigate('/home', { replace: true });
        }
      } catch (e) {
        toast(friendlyMessage(e), 'warn');
      } finally {
        setBusy(false);
      }
      return;
    }
    if (isPhrase && phraseCheck.ok) onboardingDraft.set({ kind: 'import-phrase', mnemonic: phraseCheck.phrase, publicKey: phraseCheck.publicKey });
    else if (secretCheck.ok) onboardingDraft.set({ kind: 'import-secret', secret: secretCheck.secret, publicKey: secretCheck.publicKey });
    navigate('/import/password');
  };

  const wordCount = phraseCheck.wordCount;

  return (
    <Screen>
      <Header left={<BackButton to={adding ? '/home' : '/welcome'} />} title={adding ? 'Import a wallet' : 'Import wallet'} />
      <Main className="px-5">
        <div role="tablist" aria-label="Import method" className="seg">
          <button type="button" role="tab" aria-selected={isPhrase} onClick={() => { setMode('phrase'); setTried(false); }} className="seg-btn">
            Recovery phrase
          </button>
          <button type="button" role="tab" aria-selected={!isPhrase} onClick={() => { setMode('secret'); setTried(false); }} className="seg-btn">
            Secret key
          </button>
        </div>

        {isPhrase ? (
          <Field
            label="Your 12 or 24 words"
            right={<span className={`text-xs font-semibold ${wordCount === 12 || wordCount === 24 ? 'text-good' : 'text-dim'}`}>{wordCount} words</span>}
            error={tried && !phraseCheck.ok ? phraseCheck.message : null}
            hint="Spaces and capitals don't matter. Works with phrases from Freighter, Lobstr and most Stellar wallets."
          >
            {(id) => (
              <Textarea
                id={id}
                rows={4}
                value={phrase}
                onChange={(e) => setPhrase(e.target.value)}
                placeholder="word word word …"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                bad={tried && !phraseCheck.ok}
              />
            )}
          </Field>
        ) : (
          <Field label="Secret key" error={tried && !secretCheck.ok ? secretCheck.message : null} hint="Starts with S and has 56 characters. It is encrypted on this device and never sent anywhere.">
            {(id) => (
              <div className="relative">
                <Input
                  id={id}
                  type={showSecret ? 'text' : 'password'}
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  placeholder="S…"
                  mono
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  className="pr-14"
                  bad={tried && !secretCheck.ok}
                />
                <button type="button" onClick={() => setShowSecret((s) => !s)} aria-label={showSecret ? 'Hide secret key' : 'Show secret key'} className="absolute right-1.5 top-1 flex h-11 w-11 items-center justify-center text-muted">
                  {showSecret ? <IconEyeOff /> : <IconEye />}
                </button>
              </div>
            )}
          </Field>
        )}

        {previewKey && (
          <div className="card flex items-center gap-3 px-4 py-3.5 animate-pop">
            <Orb publicKey={previewKey} size={40} />
            <span className="flex min-w-0 flex-col">
              <span className="text-xs text-muted">{alreadyHere ? 'Already in this wallet' : adding ? 'This will add' : 'This will import'}</span>
              <span className="font-mono text-[13px] break-all">{shortAddress(previewKey, 8, 8)}</span>
            </span>
            {!alreadyHere && <IconCheck className="ml-auto h-[18px] w-[18px] text-good" />}
          </div>
        )}
        {isPhrase && previewKey && !adding && <span className="hint">Shows account 1 of this phrase. You can add more accounts from the same phrase later.</span>}
      </Main>
      <Footer className="px-5">
        <button type="button" onClick={go} disabled={busy || alreadyHere} className={valid && !alreadyHere ? 'btn-primary' : 'btn-primary bg-surface-2 text-dim'}>
          {busy ? 'Adding…' : adding ? 'Add to wallet' : 'Continue'}
        </button>
        {!adding && session.status === 'none' && (
          <Link to="/welcome" className="btn-ghost">
            Back to start
          </Link>
        )}
      </Footer>
    </Screen>
  );
}
