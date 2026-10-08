import type { CSSProperties } from 'react';

/**
 * Account avatar: a glowing orb in STOVA's own colours only (lavender light,
 * lavender, violet, violet deep, ink). Accounts are told apart by how light
 * or deep the orb is and where the highlight sits, chosen from the public key,
 * so the same account always looks the same.
 */
const PALETTES: { a: string; b: string; c: string; glow: string }[] = [
  { a: '#D9CFFF', b: '#8E7CF5', c: '#4F3FCF', glow: '#B4A3FF' }, // brand: lavender → violet → deep
  { a: '#F1ECFF', b: '#B4A3FF', c: '#6B5BE0', glow: '#D9CFFF' }, // light lavender
  { a: '#B4A3FF', b: '#6B5BE0', c: '#2E2380', glow: '#8E7CF5' }, // violet
  { a: '#D9CFFF', b: '#4F3FCF', c: '#1B1240', glow: '#8E7CF5' }, // deep violet
  { a: '#8E7CF5', b: '#4F3FCF', c: '#1B1240', glow: '#6B5BE0' }, // ink
  { a: '#E6DFFF', b: '#9F90F8', c: '#3D2FB5', glow: '#B4A3FF' }, // soft
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
