import { Link } from 'react-router-dom';
import { NETWORK } from '@/config';

/** The Testnet badge, present on every screen after onboarding. Tapping opens the Network screen. */
export function NetworkPill({ linkTo = '/settings/network', quiet = false }: { linkTo?: string | null; quiet?: boolean }) {
  const inner = (
    <>
      <span className="h-2 w-2 rounded-full bg-testnet shadow-[0_0_0_3px_rgba(56,189,248,0.18)]" />
      {NETWORK.name}
    </>
  );
  const cls = quiet
    ? 'pill'
    : 'inline-flex h-9 items-center gap-[7px] rounded-full bg-surface pl-2.5 pr-3 text-[13px] font-semibold text-muted hover:text-text';
  if (!linkTo) return <span className={cls}>{inner}</span>;
  return (
    <Link to={linkTo} aria-label={`Network: ${NETWORK.name}. Change network`} className={cls}>
      {inner}
    </Link>
  );
}

export function NetworkDot({ className = 'h-[7px] w-[7px]' }: { className?: string }) {
  return <span className={`inline-block rounded-full bg-testnet ${className}`} aria-hidden="true" />;
}
