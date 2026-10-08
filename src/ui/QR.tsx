import { useMemo } from 'react';
import QRCode from 'qrcode';

/** QR code rendered as React SVG (no innerHTML), on a white tile like the design. */
export function QR({ value, size = 220, label = 'QR code' }: { value: string; size?: number; label?: string }) {
  const { path, n } = useMemo(() => {
    const qr = QRCode.create(value, { errorCorrectionLevel: 'M' });
    const n = qr.modules.size;
    const data = qr.modules.data;
    let d = '';
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (data[r * n + c]) d += `M${c} ${r}h1v1h-1z`;
      }
    }
    return { path: d, n };
  }, [value]);
  return (
    <div className="rounded-[24px] bg-white p-[18px]">
      <svg width={size} height={size} viewBox={`-2 -2 ${n + 4} ${n + 4}`} role="img" aria-label={label} shapeRendering="crispEdges">
        <path d={path} fill="#0E0E12" />
      </svg>
    </div>
  );
}
