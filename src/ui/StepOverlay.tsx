import { useCallback, useRef, useState, type ReactNode } from 'react';
import { StovaMark } from './Logo';
import { IconCheck, IconClose } from './Icons';

/**
 * The one loader used everywhere: logo in an orbit ring plus real steps, then
 * a green check or a red cross. Steps advance as the real work completes.
 */
export interface Step {
  label: string;
  text: string;
}

export type JobState =
  | { phase: 'idle' }
  | { phase: 'busy'; step: number }
  | { phase: 'done' }
  | { phase: 'fail'; error: unknown };

export function useJob() {
  const [state, setState] = useState<JobState>({ phase: 'idle' });
  const running = useRef(false);
  const run = useCallback(async <T,>(steps: Array<() => Promise<T | void>>): Promise<T | undefined> => {
    if (running.current) return undefined;
    running.current = true;
    let last: T | undefined;
    try {
      for (let i = 0; i < steps.length; i++) {
        setState({ phase: 'busy', step: i });
        const [res] = await Promise.all([steps[i](), new Promise((r) => setTimeout(r, 450))]);
        if (res !== undefined) last = res as T;
      }
      setState({ phase: 'done' });
      return last;
    } catch (error) {
      setState({ phase: 'fail', error });
      return undefined;
    } finally {
      running.current = false;
    }
  }, []);
  const reset = useCallback(() => setState({ phase: 'idle' }), []);
  return { state, run, reset, busy: state.phase === 'busy' };
}

export function StepOverlay({
  state,
  steps,
  done,
  fail,
}: {
  state: JobState;
  steps: Step[];
  /** Rendered when the job finished: title, text and footer actions. */
  done: ReactNode;
  /** Rendered when the job failed: receives the error. */
  fail: (error: unknown) => ReactNode;
}) {
  if (state.phase === 'idle') return null;
  return (
    <div className="absolute inset-0 z-[70] flex flex-col bg-ground">
      {state.phase === 'busy' && <Busy step={state.step} steps={steps} />}
      {state.phase === 'done' && done}
      {state.phase === 'fail' && fail(state.error)}
    </div>
  );
}

function Busy({ step, steps }: { step: number; steps: Step[] }) {
  const n = steps.length;
  const pct = Math.round(((step + 1) / n) * 100);
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="relative flex h-[136px] w-[136px] items-center justify-center">
        <span className="absolute -inset-5 rounded-full bg-[radial-gradient(circle,rgba(180,163,255,0.3)_0%,rgba(180,163,255,0)_68%)] animate-glow" />
        <span className="absolute inset-1.5 rounded-full border-[3px] border-surface-3 border-t-accent animate-spin" />
        <span className="absolute inset-[18px] rounded-full border-2 border-surface-3 border-b-accent/50 animate-[spin_1.8s_linear_infinite_reverse]" />
        <StovaMark size={56} />
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-[22px] font-bold tracking-[-0.01em]">{steps[step]?.label}…</span>
        <span className="max-w-[280px] text-sm leading-relaxed text-muted">{steps[step]?.text}</span>
      </div>
      <ol className="m-0 flex min-w-[220px] list-none flex-col gap-2.5 p-0 text-left">
        {steps.map((s, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <li key={s.label} className="flex items-center gap-2.5">
              <span
                className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full ${
                  done ? 'bg-good text-ground' : active ? 'bg-accent text-accent animate-pulse-soft' : 'bg-surface-3 text-surface-3'
                }`}
              >
                <IconCheck className="h-3 w-3" strokeWidth={3} />
              </span>
              <span className={`text-sm font-medium ${i <= step ? 'text-text' : 'text-dim'}`}>{s.label}</span>
            </li>
          );
        })}
      </ol>
      <div className="h-1 w-[220px] overflow-hidden rounded-full bg-surface-3">
        <span className="block h-1 rounded-full bg-accent transition-[width] duration-300" style={{ width: `${pct}%` }} />
      </div>
    </main>
  );
}

/** Success body: green check with ripples. */
export function DoneHero({ title, text, children }: { title: ReactNode; text?: ReactNode; children?: ReactNode }) {
  return (
    <main className="scroll-y flex flex-col items-center justify-center gap-[18px] px-5 py-6 text-center animate-pop">
      <div className="relative flex h-[136px] w-[136px] items-center justify-center">
        <span className="absolute inset-0 rounded-full border-2 border-good animate-ripple" />
        <span className="absolute inset-0 rounded-full border-2 border-good animate-ripple [animation-delay:.5s]" />
        <span className="flex h-[92px] w-[92px] items-center justify-center rounded-full bg-good text-ground shadow-[0_0_40px_rgba(91,228,155,0.35)] animate-pop">
          <IconCheck className="h-[46px] w-[46px]" strokeWidth={3} />
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-[26px] font-bold tracking-[-0.02em]">{title}</span>
        {text && <span className="max-w-[300px] text-sm leading-relaxed text-muted">{text}</span>}
      </div>
      {children}
    </main>
  );
}

/** Failure body: red cross, plain reason, optional "what Stellar said". */
export function FailHero({ title, text, code, children }: { title: ReactNode; text?: ReactNode; code?: string | null; children?: ReactNode }) {
  return (
    <main className="scroll-y flex flex-col items-center justify-center gap-[18px] px-5 py-6 text-center animate-pop">
      <div className="relative flex h-[136px] w-[136px] items-center justify-center animate-shake">
        <span className="absolute inset-0 rounded-full border-2 border-bad opacity-40" />
        <span className="flex h-[92px] w-[92px] items-center justify-center rounded-full bg-bad/15 text-bad shadow-[0_0_40px_rgba(255,123,123,0.2)]">
          <IconClose className="h-[42px] w-[42px]" strokeWidth={3} />
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-[26px] font-bold tracking-[-0.02em]">{title}</span>
        {text && <span className="max-w-[300px] text-sm leading-relaxed text-muted">{text}</span>}
      </div>
      {code && (
        <div className="card flex w-full flex-col gap-1 px-4 py-3 text-left text-[13px]">
          <span className="text-muted">What Stellar said</span>
          <span className="font-mono">{code}</span>
        </div>
      )}
      {children}
    </main>
  );
}
