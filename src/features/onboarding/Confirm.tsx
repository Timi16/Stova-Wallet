import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { onboardingDraft } from '@/app/drafts';
import { BackButton, Footer, Header, Main, Screen, StepBadge, Title } from '@/ui/Screen';

const POSITIONS = [3, 7, 11];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  const rnd = new Uint32Array(a.length);
  crypto.getRandomValues(rnd);
  for (let i = a.length - 1; i > 0; i--) {
    const j = rnd[i] % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Create · step 2: pick words 3, 7 and 11 from shuffled options. Wrong pick → retry, no lockout. */
export function Confirm() {
  const draft = onboardingDraft.get();
  const words = draft?.kind === 'create' ? draft.mnemonic.split(' ') : null;
  const questions = useMemo(() => {
    if (!words) return [];
    return POSITIONS.map((n) => {
      const right = words[n - 1];
      const decoys = new Set<string>();
      const rnd = new Uint32Array(16);
      crypto.getRandomValues(rnd);
      let i = 0;
      while (decoys.size < 3 && i < rnd.length) {
        const w = wordlist[rnd[i++] % wordlist.length];
        if (w !== right && !words.includes(w)) decoys.add(w);
      }
      return { n, right, options: shuffle([right, ...decoys]) };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft?.kind === 'create' ? draft.mnemonic : '']);
  const [picks, setPicks] = useState<Record<number, string | null>>({ 3: null, 7: null, 11: null });

  const correct = questions.filter((q) => picks[q.n] === q.right).length;
  const all = questions.length > 0 && correct === questions.length;
  useEffect(() => {
    if (!all) return;
    const d = onboardingDraft.get();
    if (d?.kind === 'create' && !d.confirmed) onboardingDraft.set({ ...d, confirmed: true });
  }, [all]);

  if (!words) return <Navigate to="/create/backup" replace />;

  return (
    <Screen>
      <Header left={<BackButton to="/create/backup" />} title="Create wallet" right={<StepBadge>2 of 3</StepBadge>} />
      <Main className="gap-[18px] px-5">
        <Title sub="Tap the right word for each position. This proves your backup is correct.">Quick check</Title>
        {questions.map((q) => {
          const pick = picks[q.n];
          const done = pick === q.right;
          const wrong = pick !== null && !done;
          return (
            <div key={q.n} className="card flex flex-col gap-2.5 px-4 py-3.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Word #{q.n}</span>
                <span className={`text-xs font-semibold ${done ? 'text-good' : wrong ? 'text-bad' : 'text-dim'}`}>{done ? 'Correct' : wrong ? 'Not that one' : 'Pick one'}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {q.options.map((w) => {
                  const on = pick === w;
                  return (
                    <button
                      key={w}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setPicks((p) => ({ ...p, [q.n]: w }))}
                      className={`h-11 rounded-xl text-[15px] ${
                        on ? (done ? 'border-[1.5px] border-accent bg-surface-2 font-semibold' : 'border-[1.5px] border-bad bg-surface-2 font-semibold animate-shake') : 'border border-line bg-surface font-medium hover:bg-surface-2'
                      }`}
                    >
                      {w}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </Main>
      <Footer className="px-5">
        <Link to="/create/password" onClick={(e) => !all && e.preventDefault()} className={all ? 'btn-primary' : 'btn-primary bg-surface-2 text-dim'} aria-disabled={!all}>
          {all ? 'Continue' : `${correct} of ${questions.length} correct`}
        </Link>
        <Link to="/create/backup" className="btn-ghost">
          Show the words again
        </Link>
      </Footer>
    </Screen>
  );
}
