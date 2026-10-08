import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { strokeWidth?: number };

function base({ strokeWidth = 2.2, className, ...rest }: P) {
  return {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    className: className ?? 'h-[18px] w-[18px]',
    ...rest,
  };
}

export const IconBack = (p: P) => (
  <svg {...base({ strokeWidth: 2.4, ...p })}>
    <path d="M15 5l-7 7 7 7" />
  </svg>
);
export const IconClose = (p: P) => (
  <svg {...base({ strokeWidth: 2.4, ...p })}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
export const IconCheck = (p: P) => (
  <svg {...base({ strokeWidth: 2.8, ...p })}>
    <path d="M5 12l5 5L20 7" />
  </svg>
);
export const IconCopy = (p: P) => (
  <svg {...base(p)}>
    <path d="M11 9h7a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2zM5 15V5a2 2 0 0 1 2-2h10" />
  </svg>
);
export const IconEye = (p: P) => (
  <svg {...base(p)}>
    <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
export const IconEyeOff = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.1A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.1M6.6 6.6C3.7 8.5 2 12 2 12s3.5 7 10 7c1.6 0 3-.4 4.2-1" />
  </svg>
);
export const IconWarn = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3l10 18H2zM12 10v4M12 17.5v.01" />
  </svg>
);
export const IconKey = (p: P) => (
  <svg {...base(p)}>
    <path d="M8 11a4 4 0 1 0 0 8a4 4 0 1 0 0-8zM11 12l8-8M16 7l2 2" />
  </svg>
);
export const IconGlobe = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
  </svg>
);
export const IconLock = (p: P) => (
  <svg {...base(p)}>
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);
export const IconSend = (p: P) => (
  <svg {...base({ strokeWidth: 2.4, ...p })}>
    <path d="M7 17L17 7M8 7h9v9" />
  </svg>
);
export const IconReceive = (p: P) => (
  <svg {...base({ strokeWidth: 2.4, ...p })}>
    <path d="M17 7L7 17M16 17H7V8" />
  </svg>
);
export const IconPlus = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const IconStar = (p: P) => (
  <svg {...base(p)} fill="currentColor" stroke="none">
    <path d="M12 2.5l2.4 7.1L21.5 12l-7.1 2.4L12 21.5l-2.4-7.1L2.5 12l7.1-2.4z" />
  </svg>
);
export const IconShield = (p: P) => (
  <svg {...base({ strokeWidth: 2.4, ...p })}>
    <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);
export const IconRefresh = (p: P) => (
  <svg {...base(p)}>
    <path d="M20 11A8 8 0 0 0 5.6 6.6L4 8M4 4v4h4M4 13a8 8 0 0 0 14.4 4.4L20 16M20 20v-4h-4" />
  </svg>
);
export const IconChevronDown = (p: P) => (
  <svg {...base({ strokeWidth: 2.6, ...p })}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);
export const IconChevronRight = (p: P) => (
  <svg {...base(p)}>
    <path d="M9 6l6 6-6 6" />
  </svg>
);
export const IconExternal = (p: P) => (
  <svg {...base(p)}>
    <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
  </svg>
);
export const IconHome = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
  </svg>
);
export const IconActivity = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 12h4l3-8 4 16 3-8h4" />
  </svg>
);
export const IconScan = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M4 12h16" />
  </svg>
);
export const IconSettings = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6zM12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" />
  </svg>
);
export const IconPaste = (p: P) => (
  <svg {...base(p)}>
    <path d="M9 4h6v3H9zM6 6H5a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-1M9 13h6M9 17h4" />
  </svg>
);
export const IconShare = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3v12M8 7l4-4 4 4M5 13v6a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6" />
  </svg>
);
export const IconTrash = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
  </svg>
);
export const IconClock = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);
export const IconUsers = (p: P) => (
  <svg {...base(p)}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 5a3.5 3.5 0 0 1 0 7M18 14.5a6 6 0 0 1 3.5 5.5" />
  </svg>
);
export const IconTorch = (p: P) => (
  <svg {...base(p)}>
    <path d="M9 2h6l1 7a4 4 0 0 1-8 0zM12 13v9M9 22h6" />
  </svg>
);
/** The official Stellar mark (Stellar Development Foundation brand asset), filled with currentColor. */
export const IconStellar = ({ className = 'h-[18px] w-[18px]', ...rest }: P) => (
  <svg viewBox="0 0 236.36 200" fill="currentColor" aria-hidden="true" className={className} {...rest}>
    <path d="M203,26.16l-28.46,14.5-137.43,70a82.49,82.49,0,0,1-.7-10.69A81.87,81.87,0,0,1,158.2,28.6l16.29-8.3,2.43-1.24A100,100,0,0,0,18.18,100q0,3.82.29,7.61a18.19,18.19,0,0,1-9.88,17.58L0,129.57V150l25.29-12.89,0,0,8.19-4.18,8.07-4.11v0L186.43,55l16.28-8.29,33.65-17.15V9.14Z" />
    <path d="M236.36,50,49.78,145,33.5,153.31,0,170.38v20.41l33.27-16.95,28.46-14.5L199.3,89.24A83.45,83.45,0,0,1,200,100,81.87,81.87,0,0,1,78.09,171.36l-1,.53-17.66,9A100,100,0,0,0,218.18,100c0-2.57-.1-5.14-.29-7.68a18.2,18.2,0,0,1,9.87-17.58l8.6-4.38Z" />
  </svg>
);
export const IconFingerprint = (p: P) => (
  <svg {...base({ strokeWidth: 2, ...p })}>
    <path d="M6.5 8.5A6.5 6.5 0 0 1 18.5 11v2M4.5 12a7.5 7.5 0 0 1 1.3-4.2M9 11a3 3 0 0 1 6 0v3c0 2 .5 3.5 1.5 5M12 11v3.5c0 2.3.8 4.4 2 6M9 14c0 2.5.7 4.7 2 6.5M6.7 15.5c.3 1.6.9 3.1 1.8 4.5" />
  </svg>
);
export const IconArrowRight = (p: P) => (
  <svg {...base({ strokeWidth: 2.4, ...p })} viewBox="0 0 56 24">
    <path d="M4 12h44M40 5l8 7-8 7" />
  </svg>
);

export function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return <span className={`inline-block rounded-full border-2 border-current border-r-transparent animate-spin ${className}`} aria-hidden="true" />;
}
