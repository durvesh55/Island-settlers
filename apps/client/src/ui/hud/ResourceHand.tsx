import { AnimatePresence, motion } from 'framer-motion';
import { RESOURCES, type GameEvent, type GameState, type Resource } from '@island/engine';
import { RESOURCE_CARD_THEME, RESOURCE_LABEL } from '../../lib/colors';
import { RESOURCE_IMG } from '../../lib/resourceArt';
import { useGameStore } from '../../store/useGameStore';

/** Resources the given player just received from setup, production or a steal. */
export function gainsFor(events: GameEvent[], player: number): Partial<Record<Resource, number>> | null {
  const out: Partial<Record<Resource, number>> = {};
  let any = false;
  for (const e of events) {
    if (e.type === 'resourcesGained' && e.player === player) Object.assign(out, e.resources);
    if (e.type === 'produced') Object.assign(out, e.gains[player]);
    if (e.type === 'stolen' && e.thief === player && e.resource) out[e.resource] = (out[e.resource] ?? 0) + 1;
  }
  for (const r of RESOURCES) if ((out[r] ?? 0) > 0) any = true;
  return any ? out : null;
}

function ResourceCard({ resource, count, gained, gainKey }: { resource: Resource; count: number; gained: number; gainKey: number }) {
  const t = RESOURCE_CARD_THEME[resource];
  const empty = count === 0;
  return (
    <motion.div
      whileHover={{ y: -16, scale: 1.04 }}
      transition={{ type: 'spring', stiffness: 380, damping: 22 }}
      className="relative h-[128px] w-[92px] shrink-0 rounded-xl p-[5px] sm:h-[148px] sm:w-[108px]"
      style={{
        background: `linear-gradient(160deg, ${t.frame} 0%, ${t.to} 100%)`,
        boxShadow: '0 10px 22px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.35)',
        filter: empty ? 'saturate(.35) brightness(.7)' : undefined,
      }}
      title={`${RESOURCE_LABEL[resource]}: ${count}`}
    >
      <div
        className="flex h-full flex-col items-center rounded-lg border border-black/30 pt-1"
        style={{ background: `radial-gradient(circle at 50% 45%, ${t.from} 0%, ${t.to} 100%)` }}
      >
        <span className="font-display text-base font-bold drop-shadow sm:text-lg" style={{ color: t.text }}>
          {RESOURCE_LABEL[resource]}
        </span>
        <img src={RESOURCE_IMG[resource]} alt="" className="mt-1 h-16 w-16 drop-shadow-[0_4px_4px_rgba(0,0,0,.45)] sm:h-20 sm:w-20" draggable={false} />
      </div>
      <motion.span
        key={count}
        initial={{ scale: 1.6 }}
        animate={{ scale: 1 }}
        className="absolute bottom-1.5 right-1.5 rounded-md border border-wood-700/40 bg-parchment-100 px-1.5 font-display text-base font-bold text-wood-900 shadow"
      >
        ×{count}
      </motion.span>
      <AnimatePresence>
        {gained > 0 && (
          <motion.span
            key={gainKey}
            initial={{ opacity: 0, y: 10, scale: 0.6 }}
            animate={{ opacity: [0, 1, 1, 0], y: [10, -34, -40, -64], scale: [0.6, 1.15, 1.1, 1] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2, times: [0, 0.2, 0.75, 1] }}
            className="absolute left-1/2 top-0 -translate-x-1/2 rounded-full bg-emerald-600 px-2.5 py-0.5 font-display text-lg font-bold text-white shadow-lg"
          >
            +{gained}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/** The current player's hand of resource cards (pass-and-play shows whoever is active). */
export function ResourceHand({ game }: { game: GameState }) {
  const lastEvents = useGameStore((s) => s.lastEvents);
  const eventSeq = useGameStore((s) => s.eventSeq);
  // In local pass-and-play the hand belongs to the active player; on the player who just
  // collected resources we briefly keep showing their gain.

  const viewer = game.players[game.currentPlayer];
  const gains = gainsFor(lastEvents, viewer.id);

  return (
    <div className="flex items-end gap-2 sm:gap-3">
      {RESOURCES.map((r, i) => (
        <motion.div key={r} initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 + i * 0.06 }}>
          <ResourceCard resource={r} count={viewer.resources[r]} gained={gains?.[r] ?? 0} gainKey={eventSeq} />
        </motion.div>
      ))}
    </div>
  );
}
