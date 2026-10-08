import type { CSSProperties } from 'react';

/**
 * Account avatar: a glowing orb whose colours come from the public key, so
 * two accounts never look alike and the same account always looks the same.
 */
const PALETTES: { a: string; b: string; c: string; glow: string }[] = [
  { a: '#D3C8FF', b: '#7C6AF0', c: '#2BB4C9', glow: '#A48CFF' },
  { a: '#FFD6A5', b: '#FF8A65', c: '#C2469B', glow: '#FF8A65' },
  { a: '#A7F3D0', b: '#2DD4BF', c: '#0E7490', glow: '#2DD4BF' },
  { a: '#FDE68A', b: '#F59E0B', c: '#B45309', glow: '#F59E0B' },
  { a: '#FBCFE8', b: '#EC4899', c: '#7E22CE', glow: '#EC4899' },
  { a: '#BFDBFE', b: '#3B82F6', c: '#1E3A8A', glow: '#60A5FA' },
  { a: '#D9F99D', b: '#84CC16', c: '#3F6212', glow: '#A3E635' },
  { a: '#FECACA', b: '#F87171', c: '#7F1D1D', glow: '#F87171' },
];

export function paletteFor(publicKey: string) {
  let h = 0;
  for (let i = 0; i < publicKey.length; i++) h = (h * 31 + publicKey.charCodeAt(i)) >>> 0;
  return PALETTES[h % PALETTES.length];
}

export function Orb({ publicKey, size = 40, className = '' }: { publicKey: string; size?: number; className?: string }) {
  const p = paletteFor(publicKey);
  const style: CSSProperties = {
    width: size,
    height: size,
    background: `radial-gradient(circle at 30% 30%, ${p.a} 0%, ${p.b} 45%, ${p.c} 100%)`,
    color: p.glow,
  };
  return (
    <span className={`relative inline-block shrink-0 rounded-full ${className}`} style={style} aria-hidden="true">
      <span className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_20px_5px_currentColor] animate-orb-halo" />
      <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-full">
        <span className="absolute inset-0 animate-spin-slow bg-[radial-gradient(circle_at_80%_50%,rgba(255,255,255,0.5)_0%,rgba(255,255,255,0)_38%)]" />
      </span>
      <span className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_32%_26%,rgba(255,255,255,0.85)_0%,rgba(255,255,255,0.18)_22%,rgba(255,255,255,0)_42%)]" />
      <span className="pointer-events-none absolute inset-0 rounded-full shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2),inset_0_-6px_10px_rgba(0,0,0,0.28)]" />
    </span>
  );
}
