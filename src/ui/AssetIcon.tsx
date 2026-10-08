import { isNative, presetFor, type AssetRef } from '@/core/stellar';
import { paletteFor } from './Orb';
import { IconStellar } from './Icons';

/**
 * Asset "logo". XLM: white disc with a star. Known presets: their brand colour
 * and symbol. Everything else: a tile coloured deterministically from the
 * issuer (so two "USDC"s from different issuers look different) with the code.
 * When the directory supplies an image URL it is shown instead.
 */
export function AssetIcon({ asset, size = 42, image }: { asset: AssetRef; size?: number; image?: string | null }) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.43) };
  if (isNative(asset)) {
    return (
      <span className="flex shrink-0 items-center justify-center rounded-full bg-text text-ground" style={style} aria-hidden="true">
        <IconStellar className="h-[52%] w-[52%]" />
      </span>
    );
  }
  const p = presetFor(asset);
  if (p) {
    return (
      <span className="flex shrink-0 items-center justify-center rounded-full font-bold text-white" style={{ ...style, background: p.color }} aria-hidden="true">
        {p.symbol}
      </span>
    );
  }
  if (image) {
    return <img src={image} alt="" width={size} height={size} className="shrink-0 rounded-full bg-surface-2 object-cover" style={{ width: size, height: size }} />;
  }
  const pal = paletteFor(asset.issuer ?? asset.code);
  const code = asset.code.length > 4 ? asset.code.slice(0, 3) : asset.code;
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full font-bold tracking-tight text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18)]"
      style={{ ...style, fontSize: Math.round(size * (code.length > 3 ? 0.26 : 0.3)), background: `linear-gradient(135deg, ${pal.b} 0%, ${pal.c} 100%)` }}
      aria-hidden="true"
    >
      {code}
    </span>
  );
}
