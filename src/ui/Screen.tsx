import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { IconBack, IconClose } from './Icons';

/**
 * Phone-first shell: header / scrolling main / footer, pinned to the viewport
 * height. On wide screens it centres as a single column like the design.
 */
export function Screen({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`screen-in relative mx-auto flex h-dvh w-full max-w-[430px] flex-col overflow-hidden bg-ground text-text ${className}`}>{children}</div>;
}

export function Header({ left, title, right, className = '' }: { left?: ReactNode; title?: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <header className={`flex items-center gap-2 px-4 pt-3 pb-1 ${className}`}>
      {left ?? <span className="w-11" />}
      <h1 className="m-0 flex-1 text-center text-base font-semibold">{title}</h1>
      {right ?? <span className="w-11" />}
    </header>
  );
}

export function BackButton({ to, label = 'Back', onClick }: { to?: string; label?: string; onClick?: () => void }) {
  if (onClick) {
    return (
      <button type="button" aria-label={label} onClick={onClick} className="icon-btn">
        <IconBack className="h-5 w-5" />
      </button>
    );
  }
  return (
    <Link to={to ?? '..'} aria-label={label} className="icon-btn">
      <IconBack className="h-5 w-5" />
    </Link>
  );
}

export function CloseButton({ to, onClick }: { to?: string; onClick?: () => void }) {
  if (onClick) {
    return (
      <button type="button" aria-label="Close" onClick={onClick} className="icon-btn">
        <IconClose className="h-5 w-5" />
      </button>
    );
  }
  return (
    <Link to={to ?? '/home'} aria-label="Close" className="icon-btn">
      <IconClose className="h-5 w-5" />
    </Link>
  );
}

export function Main({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <main className={`scroll-y flex flex-col gap-4 px-4 pb-3 pt-2 ${className}`}>{children}</main>;
}

export function Footer({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <footer className={`flex flex-col gap-2 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2 ${className}`}>{children}</footer>;
}

export function StepBadge({ children }: { children: ReactNode }) {
  return <span className="pill">{children}</span>;
}

export function Title({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h2 className="m-0 text-2xl font-bold tracking-[-0.02em]">{children}</h2>
      {sub && <p className="m-0 text-sm text-muted">{sub}</p>}
    </div>
  );
}
