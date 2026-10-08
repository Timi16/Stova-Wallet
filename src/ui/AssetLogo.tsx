import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchLogo, isNative, type AssetRef } from '@/core/stellar';
import { AssetIcon } from './AssetIcon';

/** Looks a logo up by asset code (cached for the session); null while loading or when there is none. */
export function useAssetLogo(asset: AssetRef, enabled = true): string | null {
  const q = useQuery({
    queryKey: ['logo', asset.code.toUpperCase()],
    queryFn: () => fetchLogo(asset),
    enabled: enabled && !isNative(asset),
    staleTime: Infinity,
    gcTime: 60 * 60_000,
    retry: 1,
  });
  return q.data?.image ?? null;
}

/**
 * The asset's logo when one is known, otherwise the generated tile. Falls back
 * to the tile if the image fails to load, so a broken URL never shows a gap.
 */
export function AssetLogo({ asset, size = 42, image }: { asset: AssetRef; size?: number; image?: string | null }) {
  const found = useAssetLogo(asset, !image);
  const [broken, setBroken] = useState<string | null>(null);
  const src = image ?? found;
  if (src && broken !== src) {
    return (
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        onError={() => setBroken(src)}
        className="shrink-0 rounded-full bg-surface-2 object-cover animate-pop"
        style={{ width: size, height: size }}
      />
    );
  }
  return <AssetIcon asset={asset} size={size} />;
}
