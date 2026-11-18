import type { GameState } from '@island/engine';
import { DevHand } from './DevCards';

function CardBack({ count }: { count: number }) {
  return (
    <div className="relative h-[78px] w-[56px] shrink-0" title={`${count} cards left in the deck`}>
      {[2, 1, 0].map((i) => (
        <div
          key={i}
          className="absolute inset-0 rounded-md border border-gold-500/60"
          style={{
            transform: `translate(${i * 3}px, ${-i * 3}px)`,
            background: 'linear-gradient(160deg,#4a5670,#232a3a)',
            boxShadow: '0 3px 8px rgba(0,0,0,.5)',
            opacity: count === 0 ? 0.3 : 1,
          }}
        >
          {i === 0 && (
            <svg viewBox="0 0 40 40" className="absolute inset-2">
              <path d="M4 32 L16 14 L22 22 L28 12 L36 32Z" fill="#c99a3e" />
              <path d="M28 12 L31 17 L25 17Z" fill="#fbf4e4" />
            </svg>
          )}
        </div>
      ))}
      <span className="absolute -bottom-1 -right-2 rounded bg-parchment-100 px-1 font-display text-xs font-bold text-wood-900">×{count}</span>
    </div>
  );
}

export function DevCardsPanel({ game }: { game: GameState }) {
  return (
    <div className="panel-wood p-3">
      <div className="mb-2 flex items-center justify-between font-display text-lg text-parchment-100">
        Development Cards
        {game.devCardPlayedThisTurn && <span className="font-body text-xs text-parchment-300/70">card played this turn</span>}
      </div>
      <div className="flex items-end gap-3">
        <div className="scroll-thin flex min-h-[78px] flex-1 items-end overflow-x-auto pb-1.5 pt-1.5">
          <DevHand game={game} />
        </div>
        <CardBack count={game.devDeck.length} />
      </div>
    </div>
  );
}
