import type { ReactNode } from 'react';
import { StovaMark } from './Logo';
import { IconLock } from './Icons';

/**
 * Browsers expose WebCrypto only on secure pages (HTTPS, or localhost). Without it
 * STOVA cannot encrypt anything, so instead of a cryptic error deep in the vault we
 * explain it up front and say how to open the app properly.
 */
export function SecureContextGate({ children }: { children: ReactNode }) {
  const secure = typeof window === 'undefined' || (window.isSecureContext && !!globalThis.crypto?.subtle);
  if (secure) return <>{children}</>;
  const httpsUrl = `https://${window.location.host}${window.location.pathname}`;
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col items-center justify-center gap-6 bg-ground px-6 text-center text-text">
      <StovaMark size={64} />
      <div className="flex flex-col gap-2">
        <h1 className="m-0 text-2xl font-bold tracking-[-0.01em]">Open STOVA over HTTPS</h1>
        <p className="m-0 text-sm leading-relaxed text-muted">
          Your browser only allows encryption on secure pages, and STOVA never stores a key without encrypting it. This page was opened over plain HTTP, so the vault can&apos;t work here.
        </p>
      </div>
      <div className="card flex w-full flex-col gap-3 p-4 text-left text-[13px] leading-relaxed text-muted">
        <span className="flex items-start gap-2.5">
          <IconLock className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <span>
            Use the <span className="font-semibold text-text">https://</span> address instead. For a local dev server, accept the self-signed certificate warning once.
          </span>
        </span>
        <span className="flex items-start gap-2.5">
          <IconLock className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <span>
            On this computer, <span className="font-mono text-text">localhost</span> also counts as secure.
          </span>
        </span>
      </div>
      <a href={httpsUrl} className="btn-primary w-full">
        Try the HTTPS address
      </a>
    </div>
  );
}
