import { useId } from 'react';

/** The STOVA mark: a single-stroke S on a lavender-to-violet tile. */
export function StovaMark({ size = 64, className }: { size?: number; className?: string }) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#D9CFFF" />
          <stop offset="0.5" stopColor="#8E7CF5" />
          <stop offset="1" stopColor="#4F3FCF" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="19" fill={`url(#${id})`} />
      <path
        d="M43 19 C40 13 20 11 20 23 C20 33 44 31 44 42 C44 53 24 53 20 46"
        fill="none"
        stroke="#1B1240"
        strokeWidth="7"
        strokeLinecap="round"
        opacity="0.18"
        transform="translate(0,1.5)"
      />
      <path d="M43 19 C40 13 20 11 20 23 C20 33 44 31 44 42 C44 53 24 53 20 46" fill="none" stroke="#FFFFFF" strokeWidth="7" strokeLinecap="round" />
    </svg>
  );
}

export function Wordmark({ className = 'text-[30px]' }: { className?: string }) {
  return <span className={`font-bold tracking-[0.12em] ${className}`}>STOVA</span>;
}
