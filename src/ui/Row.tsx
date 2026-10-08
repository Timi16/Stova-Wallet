import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { IconChevronRight, IconExternal } from './Icons';

/** Key / value row inside a card. */
export function KV({ k, v, mono = false }: { k: ReactNode; v: ReactNode; mono?: boolean }) {
  return (
    <div className="kv">
      <span className="text-muted">{k}</span>
      <span className={`text-right ${mono ? 'font-mono text-[13px]' : 'font-semibold tabular'}`}>{v}</span>
    </div>
  );
}

export function KVCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`card px-4 py-0.5 text-sm ${className}`}>{children}</div>;
}

/** Settings-style list row: icon tile, label, trailing value, chevron. */
export function ListRow({
  icon,
  label,
  sub,
  value,
  to,
  href,
  onClick,
  danger = false,
  trailing,
}: {
  icon?: ReactNode;
  label: ReactNode;
  sub?: ReactNode;
  value?: ReactNode;
  to?: string;
  href?: string;
  onClick?: () => void;
  danger?: boolean;
  trailing?: ReactNode;
}) {
  const inner = (
    <>
      {icon && <span className={`flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-xl bg-surface-2 ${danger ? 'text-bad' : 'text-accent'}`}>{icon}</span>}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 py-2">
        <span className={`text-[15px] font-medium ${danger ? 'text-bad' : 'text-text'}`}>{label}</span>
        {sub && <span className="text-xs font-medium text-dim">{sub}</span>}
      </span>
      {value && <span className="text-[13px] text-muted">{value}</span>}
      {trailing ?? (href ? <IconExternal className="h-4 w-4 text-dim" /> : <IconChevronRight className="h-4 w-4 text-dim" />)}
    </>
  );
  const cls = 'flex w-full items-center gap-3 px-4 min-h-14 text-left [&+&]:border-t [&+&]:border-line hover:bg-surface-2/60';
  if (to) return <Link to={to} className={cls}>{inner}</Link>;
  if (href)
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        {inner}
      </a>
    );
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={cls}>
        {inner}
      </button>
    );
  return <div className={cls.replace(' hover:bg-surface-2/60', '')}>{inner}</div>;
}

export function Section({ title, children, foot }: { title?: ReactNode; children: ReactNode; foot?: ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      {title && <span className="label px-1">{title}</span>}
      <div className="card overflow-hidden">{children}</div>
      {foot && <span className="hint px-1">{foot}</span>}
    </section>
  );
}
