/** Original "Island Settlers" wordmark on a carved wooden plaque. */
export function Logo({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const big = size === 'lg';
  return (
    <div
      className={`relative inline-flex flex-col items-center rounded-2xl border-2 border-gold-600/70 ${big ? 'px-12 pb-5 pt-3' : 'px-5 pb-2 pt-1'}`}
      style={{
        background: 'linear-gradient(180deg,#5a2f1a 0%,#3a1c0e 55%,#2a130a 100%)',
        boxShadow: 'inset 0 2px 0 rgba(255,210,150,.18), inset 0 -3px 8px rgba(0,0,0,.5), 0 10px 25px rgba(0,0,0,.6)',
      }}
    >
      <svg viewBox="0 0 120 34" className={big ? 'h-14 w-48' : 'h-6 w-20'} aria-hidden>
        <path d="M4 32 L34 8 L48 20 L62 4 L82 22 L94 14 L116 32Z" fill="#c99a3e" />
        <path d="M62 4 L69 11 L65 12 L62 9 L58 12 L55 11Z" fill="#fbf4e4" />
        <path d="M34 8 L40 13 L34 13 L29 12Z" fill="#fbf4e4" opacity=".9" />
        <path d="M4 32 Q60 26 116 32" stroke="#e8c06a" strokeWidth="2" fill="none" />
      </svg>
      <span
        className={`font-display font-extrabold leading-[0.85] text-parchment-50 ${big ? 'text-6xl' : 'text-[26px]'}`}
        style={{ textShadow: '0 2px 0 #1a0c05, 0 0 12px rgba(232,192,106,.35)' }}
      >
        Island
      </span>
      <span
        className={`font-display font-extrabold leading-[0.95] text-parchment-50 ${big ? 'text-7xl' : 'text-[30px]'}`}
        style={{ textShadow: '0 2px 0 #1a0c05, 0 0 12px rgba(232,192,106,.35)' }}
      >
        Settlers
      </span>
    </div>
  );
}
