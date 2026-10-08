import { StovaMark } from './Logo';

/**
 * In-app splash, drawn exactly like the boot splash in index.html and the step
 * loader, so the hand-off from "page loading" to "session loading" is seamless.
 */
export function Splash({ label = 'Opening your wallet' }: { label?: string }) {
  return (
    <div className="mx-auto flex h-dvh w-full max-w-[430px] flex-col items-center justify-center gap-[22px] bg-ground text-muted" role="status" aria-label={label}>
      <div className="relative flex h-28 w-28 items-center justify-center">
        <span className="absolute -inset-[18px] rounded-full bg-[radial-gradient(circle,rgba(180,163,255,0.3)_0%,rgba(180,163,255,0)_68%)] animate-glow" />
        <span className="absolute inset-1 rounded-full border-[3px] border-surface-3 border-t-accent animate-spin" />
        <span className="absolute inset-4 rounded-full border-2 border-surface-3 border-b-accent/50 animate-[spin_1.8s_linear_infinite_reverse]" />
        <StovaMark size={56} />
      </div>
      <span className="text-lg font-bold tracking-[0.14em] text-text">STOVA</span>
    </div>
  );
}
