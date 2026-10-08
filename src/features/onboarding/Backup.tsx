import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { onboardingDraft } from '@/app/drafts';
import { copySecret } from '@/app/clipboard';
import { useToast } from '@/app/toast';
import { generatePhrase } from '@/core/keys';
import { BackButton, Footer, Header, Main, Screen, StepBadge, Title } from '@/ui/Screen';
import { IconCopy, IconEye, IconEyeOff, IconWarn } from '@/ui/Icons';

/** Create · step 1: show 12 words, blurred until revealed. The phrase lives only in the onboarding draft (memory). */
export function Backup() {
  const toast = useToast();
  const mnemonic = useMemo(() => {
    const d = onboardingDraft.get();
    if (d?.kind === 'create') return d.mnemonic;
    const m = generatePhrase();
    onboardingDraft.set({ kind: 'create', mnemonic: m, confirmed: false });
    return m;
  }, []);
  const words = mnemonic.split(' ');
  const [hidden, setHidden] = useState(true);
  const [agree, setAgree] = useState(false);
  const [nudge, setNudge] = useState(false);
  const ok = !hidden && agree;

  return (
    <Screen>
      <Header left={<BackButton to="/welcome" />} title="Create wallet" right={<StepBadge>1 of 3</StepBadge>} />
      <Main className="px-5">
        <Title sub="They are the only way to get your wallet back. Keep them offline and in order.">Write down these 12 words</Title>
        <div className="card relative p-3.5">
          <ol className="m-0 grid list-none grid-cols-2 gap-2 p-0">
            {words.map((w, i) => (
              <li key={i} className="flex h-11 items-center gap-2 rounded-xl bg-surface-2 px-3 text-[15px] font-medium">
                <span className="w-[18px] font-mono text-xs text-dim">{i + 1}</span>
                <span className={hidden ? 'blur-secret' : ''}>{w}</span>
              </li>
            ))}
          </ol>
          {hidden && (
            <button
              type="button"
              onClick={() => {
                setHidden(false);
                setNudge(false);
              }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-[20px] bg-ground/55 text-[15px] font-semibold"
            >
              <IconEye className="h-6 w-6" />
              Tap to reveal
              <span className="text-xs font-medium text-muted">Make sure nobody is looking</span>
            </button>
          )}
        </div>
        <div className="flex gap-2.5">
          <button
            type="button"
            disabled={hidden}
            onClick={async () => toast((await copySecret(mnemonic)) ? 'Copied. Paste it into a password manager, not a chat. Clipboard clears in 60 s.' : "Couldn't copy")}
            className="btn-secondary h-11 flex-1 rounded-[14px] text-sm"
          >
            <IconCopy className="h-4 w-4" />
            Copy
          </button>
          <button type="button" disabled={hidden} onClick={() => setHidden(true)} className="btn-secondary h-11 flex-1 rounded-[14px] text-sm">
            <IconEyeOff className="h-4 w-4" />
            Hide
          </button>
        </div>
        <div className="flex gap-3 rounded-2xl border border-bad/25 bg-bad/[0.08] p-3.5">
          <IconWarn className="h-5 w-5 shrink-0 text-bad" />
          <span className="text-[13px] leading-relaxed">Anyone with these words controls your money. STOVA will never ask for them, and nobody can recover them for you.</span>
        </div>
        <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
          <input
            type="checkbox"
            checked={agree}
            disabled={hidden}
            onChange={(e) => {
              setAgree(e.target.checked);
              setNudge(false);
            }}
            className="h-5 w-5"
          />
          I wrote them down somewhere safe
        </label>
      </Main>
      <Footer className="px-5">
        <Link
          to="/create/confirm"
          onClick={(e) => {
            if (!ok) {
              e.preventDefault();
              setNudge(true);
            }
          }}
          className={ok ? 'btn-primary' : 'btn-primary pointer-events-auto bg-surface-2 text-dim'}
          aria-disabled={!ok}
        >
          Continue
        </Link>
        {nudge && <span className="text-center text-[13px] font-medium text-bad">Reveal the words and tick the box first.</span>}
      </Footer>
    </Screen>
  );
}
