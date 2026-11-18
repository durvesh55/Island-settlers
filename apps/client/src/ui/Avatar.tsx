import { useId } from 'react';

const SKIN = ['#c68a55', '#f0c9a0', '#e3b07c', '#8d5a34', '#f5d3b3', '#a86c42'];
const HAIR = ['#24160d', '#5a371b', '#121212', '#7a4a22', '#b07a3a', '#2e2e2e'];
const SHIRT = ['#6b4423', '#3d5a80', '#7a3b2e', '#4f6b3a', '#5c4a7a', '#7a6a3a'];

export const AVATAR_COUNT = 6;

/** Original illustrated avatar portraits, drawn in SVG. */
export function Avatar({ index, ring, size = 56 }: { index: number; ring: string; size?: number }) {
  const id = useId();
  const i = ((index % AVATAR_COUNT) + AVATAR_COUNT) % AVATAR_COUNT;
  const skin = SKIN[i];
  const hair = HAIR[i];
  const shirt = SHIRT[i];
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className="shrink-0 drop-shadow-md">
      <defs>
        <radialGradient id={`${id}bg`} cx="50%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#f6e2b8" />
          <stop offset="100%" stopColor="#b98d52" />
        </radialGradient>
        <clipPath id={`${id}clip`}>
          <circle cx="32" cy="32" r="28" />
        </clipPath>
      </defs>
      <circle cx="32" cy="32" r="31" fill={ring} />
      <circle cx="32" cy="32" r="28" fill={`url(#${id}bg)`} />
      <g clipPath={`url(#${id}clip)`}>
        {i === 2 && <path d="M17 30c0-12 7-18 15-18s15 6 15 18v20H17z" fill={hair} />}
        {i === 4 && <path d="M18 28c0-10 6-15 14-15s14 5 14 15v14c-3 2-6 0-6 0V28H24v14s-3 2-6 0z" fill={hair} />}
        <path d="M8 66c1-11 10-17 24-17s23 6 24 17z" fill={shirt} />
        <path d="M27 42h10v8c-3 2-7 2-10 0z" fill={skin} />
        <ellipse cx="32" cy="31" rx="11.5" ry="13" fill={skin} />
        <ellipse cx="20.5" cy="32" rx="2" ry="3" fill={skin} />
        <ellipse cx="43.5" cy="32" rx="2" ry="3" fill={skin} />
        {/* hair styles */}
        {i === 0 && <path d="M20.5 28c0-9 5-12.5 11.5-12.5S43.5 19 43.5 28c-2-4-5-6-11.5-6.5C26 22 23 24 20.5 28z" fill={hair} />}
        {i === 1 && (
          <>
            <path d="M20.5 27c0-8 5-11.5 11.5-11.5S43.5 19 43.5 27c-3-3-7-4.5-11.5-4.5S23.5 24 20.5 27z" fill={hair} />
            <path d="M21 33c1 9 5 12 11 12s10-3 11-12c-2 4-5 5-11 5s-9-1-11-5z" fill={hair} />
          </>
        )}
        {i === 2 && <path d="M20.5 29c0-9 5-13 11.5-13s11.5 4 11.5 13c-4-5-9-6.5-14-6.5-3 0-6 2-9 6.5z" fill={hair} />}
        {i === 3 && (
          <>
            <path d="M20.5 27.5c0-8.5 5-12 11.5-12s11.5 3.5 11.5 12c-2-3-6-4.5-11.5-4.5S22.5 24.5 20.5 27.5z" fill={hair} />
            <g fill="none" stroke="#2a1a10" strokeWidth="1.3">
              <circle cx="27.5" cy="31" r="3.3" />
              <circle cx="36.5" cy="31" r="3.3" />
              <path d="M30.8 31h2.4" />
            </g>
            <path d="M24 38c2 5 14 5 16 0-1 6-4 8-8 8s-7-2-8-8z" fill={hair} />
          </>
        )}
        {i === 4 && <path d="M20.5 28c1-8 5-12 11.5-12s10.5 4 11.5 12c-5-2-9-6-11.5-7-2 2-6 5-11.5 7z" fill={hair} />}
        {i === 5 && (
          <>
            <path d="M20 26c0-7 5-11 12-11s12 4 12 11l-2 1c-2-3-5-4-10-4s-8 1-10 4z" fill={hair} />
            <path d="M18 26h28v-2c-2-3-8-5-14-5s-12 2-14 5z" fill="#6b4a2a" />
            <path d="M15 26h34" stroke="#4a301a" strokeWidth="2.5" strokeLinecap="round" />
          </>
        )}
        {/* face */}
        <circle cx="27.5" cy="31" r="1.3" fill="#2a1a10" />
        <circle cx="36.5" cy="31" r="1.3" fill="#2a1a10" />
        <path d="M24.5 27.3c1.5-1 3.5-1 5 0M34.5 27.3c1.5-1 3.5-1 5 0" stroke={hair} strokeWidth="1.2" strokeLinecap="round" fill="none" />
        <path d="M32 32.5v3.5h-1.5" stroke="#9a6a45" strokeWidth="1" fill="none" strokeLinecap="round" />
        {i !== 1 && i !== 3 && <path d="M28.5 39c2 1.5 5 1.5 7 0" stroke="#7a3a2a" strokeWidth="1.3" fill="none" strokeLinecap="round" />}
      </g>
    </svg>
  );
}
