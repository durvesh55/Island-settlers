import type { SVGProps } from 'react';

/** Minimal inline icon set (stroke icons, inherit currentColor). */
type P = SVGProps<SVGSVGElement>;
const base = (p: P): P => ({
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  ...p,
});

export const HomeIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 11.5 12 4l9 7.5" />
    <path d="M5.5 10v9.5h13V10" />
    <path d="M10 19.5v-5h4v5" />
  </svg>
);
export const TradeIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 8h14l-3.5-3.5" />
    <path d="M20 16H6l3.5 3.5" />
  </svg>
);
export const HammerIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="m14 6 4 4" />
    <path d="M12.5 4.5 16 2l6 6-2.5 3.5-3-1-1.5 1.5L4 23l-3-3 11-11 1.5-1.5z" />
  </svg>
);
export const CardsIcon = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="6" width="11" height="15" rx="2" />
    <path d="M8 3.5 18.5 2.6a2 2 0 0 1 2.1 1.8l1.1 12.5a2 2 0 0 1-1.8 2.2L17 19.4" />
  </svg>
);
export const BookIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 6.5C10 5 7 4.5 3 5v14c4-.5 7 0 9 1.5 2-1.5 5-2 9-1.5V5c-4-.5-7 0-9 1.5z" />
    <path d="M12 6.5v14" />
  </svg>
);
export const GearIcon = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </svg>
);
export const ExpandIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
  </svg>
);
export const UsersIcon = (p: P) => (
  <svg {...base(p)}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20c.5-3.5 3.2-5.5 6.5-5.5s6 2 6.5 5.5" />
    <circle cx="17" cy="9" r="2.8" />
    <path d="M17 14.5c2.6 0 4.2 1.7 4.6 4.5" />
  </svg>
);
export const PlayIcon = (p: P) => (
  <svg {...base({ fill: 'currentColor', stroke: 'none', ...p })}>
    <path d="M7 4.5v15l12-7.5z" />
  </svg>
);
export const CloseIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);
export const SoundIcon = ({ muted, ...p }: P & { muted?: boolean }) => (
  <svg {...base(p)}>
    <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
    {muted ? <path d="m16 9.5 5 5m0-5-5 5" /> : <path d="M16 9a4.5 4.5 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" />}
  </svg>
);
export const CameraIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 8.5h3.5L8.5 6h7l2 2.5H21V19H3z" />
    <circle cx="12" cy="13.5" r="3.5" />
  </svg>
);
export const DiceIcon = (p: P) => (
  <svg {...base(p)}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="3.5" />
    <circle cx="8.5" cy="8.5" r="1" fill="currentColor" />
    <circle cx="15.5" cy="15.5" r="1" fill="currentColor" />
    <circle cx="12" cy="12" r="1" fill="currentColor" />
  </svg>
);
export const CrownIcon = (p: P) => (
  <svg {...base({ fill: 'currentColor', stroke: 'none', ...p })}>
    <path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z" />
  </svg>
);
export const ShieldIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3 4.5 6v5.5c0 4.5 3.2 8 7.5 9.5 4.3-1.5 7.5-5 7.5-9.5V6z" />
  </svg>
);
export const RoadIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 17 18 7" strokeWidth={4.5} />
  </svg>
);
export const HouseIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 20V11l8-6 8 6v9z" />
  </svg>
);
export const CityIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 20v-8l5-4 5 4v8M13 20V7l4-3 4 3v13M3 20h18" />
  </svg>
);
export const ShuffleIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 7h3.5c5 0 6 10 11 10H21M3 17h3.5c2 0 3.3-1.6 4.3-3.5M14 9.5c1-1.5 2-2.5 3.5-2.5H21M18 4l3 3-3 3M18 14l3 3-3 3" />
  </svg>
);
export const BackIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M15 5 8 12l7 7" />
  </svg>
);
