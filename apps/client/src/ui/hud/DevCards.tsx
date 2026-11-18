import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { DEV_CARD_TYPES, RESOURCES, validRoadSpots, type DevCardType, type GameState, type Resource } from '@island/engine';
import { RESOURCE_LABEL } from '../../lib/colors';
import { playSound } from '../../lib/sound';
import { useGameStore } from '../../store/useGameStore';
import { DEV_CARD_INFO } from '../devCardInfo';
import { CloseIcon } from '../icons';
import { ResourceIcon } from '../ResourceIcon';

const FRAME: Record<DevCardType, string> = {
  knight: '#7a5ab8',
  roadBuilding: '#3f8f4a',
  yearOfPlenty: '#3f8f4a',
  monopoly: '#3f8f4a',
  victoryPoint: '#d08a2a',
};

/** Why a held card can or cannot be played right now (mirrors the engine's rules). */
export function playability(game: GameState, card: DevCardType): { ok: boolean; reason: string } {
  const p = game.players[game.currentPlayer];
  if (card === 'victoryPoint') return { ok: false, reason: 'Counts automatically — kept hidden until the game ends' };
  if (p.isAI) return { ok: false, reason: 'Waiting for the computer player' };
  if (!p.devCards.includes(card)) return { ok: false, reason: 'Bought this turn — playable from your next turn' };
  if (game.devCardPlayedThisTurn) return { ok: false, reason: 'Only one development card per turn' };
  if (game.phase !== 'roll' && game.phase !== 'main') return { ok: false, reason: 'Finish the current step first' };
  if (card === 'roadBuilding' && (p.roadsLeft === 0 || validRoadSpots(game, p.id).length === 0)) {
    return { ok: false, reason: 'There is nowhere to build a road' };
  }
  return { ok: true, reason: 'Click to play' };
}

export function DevCardFace({ type, size = 'sm', dim }: { type: DevCardType; size?: 'sm' | 'lg'; dim?: boolean }) {
  const info = DEV_CARD_INFO[type];
  const lg = size === 'lg';
  return (
    <div
      className={`parchment relative flex flex-col items-center rounded-lg border-[3px] text-center shadow-md ${lg ? 'h-[300px] w-[210px] p-4' : 'h-[78px] w-[56px] justify-center p-1'}`}
      style={{ borderColor: FRAME[type], opacity: dim ? 0.55 : 1 }}
    >
      {lg && <span className="mb-2 font-display text-2xl" style={{ color: FRAME[type] }}>{info.name}</span>}
      <span className={lg ? 'my-4 text-7xl' : 'text-2xl leading-none'}>{info.glyph}</span>
      {!lg && <span className="mt-1 px-0.5 font-display text-[9px] leading-tight">{info.name}</span>}
      {lg && <span className="font-body text-sm leading-snug text-wood-800">{info.text}</span>}
    </div>
  );
}

/** The current player's development cards, grouped by type, clickable to play. */
export function DevHand({ game }: { game: GameState }) {
  const dispatch = useGameStore((s) => s.dispatch);
  const openDialog = useGameStore((s) => s.setDevCardDialog);
  const player = game.players[game.currentPlayer];
  const groups = DEV_CARD_TYPES.map((t) => ({
    type: t,
    ready: player.devCards.filter((c) => c === t).length,
    fresh: player.newDevCards.filter((c) => c === t).length,
  })).filter((g) => g.ready + g.fresh > 0);

  const play = (t: DevCardType) => {
    playSound('click');
    if (t === 'knight') dispatch({ type: 'PLAY_KNIGHT', player: player.id });
    else if (t === 'roadBuilding') dispatch({ type: 'PLAY_ROAD_BUILDING', player: player.id });
    else if (t === 'yearOfPlenty' || t === 'monopoly') openDialog(t);
  };

  if (groups.length === 0) {
    return <p className="self-center text-sm text-parchment-300/70">No cards yet. Buy them for 1 wool, 1 grain and 1 ore.</p>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {groups.map(({ type, ready, fresh }) => {
        const { ok, reason } = playability(game, type);
        const count = ready + fresh;
        return (
          <motion.button
            key={type}
            whileHover={ok ? { y: -6, rotate: -2 } : undefined}
            disabled={!ok}
            onClick={() => play(type)}
            title={`${DEV_CARD_INFO[type].name} — ${reason}`}
            className={`relative rounded-lg disabled:cursor-not-allowed ${ok ? 'ring-2 ring-gold-300/70 ring-offset-2 ring-offset-wood-900' : ''}`}
          >
            <DevCardFace type={type} dim={!ok && type !== 'victoryPoint'} />
            {count > 1 && <span className="absolute -right-1.5 -top-1.5 rounded-full bg-gold-500 px-1.5 font-display text-xs font-bold text-wood-900">×{count}</span>}
            {fresh > 0 && <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-sky-700 px-1 text-[9px] text-white">{fresh} new</span>}
          </motion.button>
        );
      })}
    </div>
  );
}

/** Choose resources for Year of Plenty (any 2) or Monopoly (1 type). */
export function DevCardDialog({ game }: { game: GameState }) {
  const dialog = useGameStore((s) => s.devCardDialog);
  const close = () => useGameStore.getState().setDevCardDialog(null);
  const dispatch = useGameStore((s) => s.dispatch);
  const [picks, setPicks] = useState<Resource[]>([]);
  useEffect(() => setPicks([]), [dialog]);
  const player = game.players[game.currentPlayer];
  if (!dialog) return null;
  const yop = dialog === 'yearOfPlenty';

  const choose = (r: Resource) => {
    playSound('click');
    if (!yop) {
      if (dispatch({ type: 'PLAY_MONOPOLY', player: player.id, resource: r })) close();
      return;
    }
    const next = [...picks, r];
    if (next.length === 2) {
      if (dispatch({ type: 'PLAY_YEAR_OF_PLENTY', player: player.id, resources: [next[0], next[1]] })) close();
      setPicks([]);
    } else setPicks(next);
  };

  return (
    <motion.div className="fixed inset-0 z-40 grid place-items-center bg-black/55 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={close}>
      <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="panel-wood w-full max-w-md p-5 text-parchment-100" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-display text-2xl text-parchment-50">{DEV_CARD_INFO[dialog].name}</h2>
            <p className="text-sm text-parchment-300/80">
              {yop ? `Choose 2 resources from the bank (${picks.length}/2 chosen${picks[0] ? `: ${RESOURCE_LABEL[picks[0]]}` : ''}).` : 'Name a resource — every other player hands you all of theirs.'}
            </p>
          </div>
          <button onClick={close} className="text-parchment-200 hover:text-gold-300" aria-label="Cancel">
            <CloseIcon />
          </button>
        </div>
        <div className="mt-4 grid grid-cols-5 gap-2">
          {RESOURCES.map((r) => {
            const left = game.bank[r] - picks.filter((x) => x === r).length;
            const disabled = yop && left <= 0;
            const others = game.players.reduce((s, p) => s + (p.id === player.id ? 0 : p.resources[r]), 0);
            return (
              <button
                key={r}
                disabled={disabled}
                onClick={() => choose(r)}
                className="flex flex-col items-center gap-1 rounded-lg border border-gold-600/40 bg-black/25 p-2 transition hover:border-gold-300 hover:bg-gold-500/15 disabled:opacity-35"
              >
                <ResourceIcon resource={r} className="h-10 w-10" />
                <span className="font-display text-sm">{RESOURCE_LABEL[r]}</span>
                <span className="text-[10px] text-parchment-300/70">{yop ? `bank ${game.bank[r]}` : `others hold ${others}`}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-parchment-300/60">Cancelling keeps the card in your hand.</p>
      </motion.div>
    </motion.div>
  );
}

/** Flip-in reveal of a freshly bought card, shown to the buyer. */
export function DevCardReveal() {
  const reveal = useGameStore((s) => s.revealCard);
  const clear = () => useGameStore.setState({ revealCard: null });
  useEffect(() => {
    if (!reveal) return;
    const t = window.setTimeout(clear, 2800);
    return () => window.clearTimeout(t);
  }, [reveal]);
  return (
    <AnimatePresence>
      {reveal && (
        <motion.div key={reveal.seq} className="fixed inset-0 z-40 grid place-items-center bg-black/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={clear}>
          <div className="flex flex-col items-center gap-3" style={{ perspective: 900 }}>
            <motion.div initial={{ rotateY: 180, scale: 0.6, y: 120 }} animate={{ rotateY: 0, scale: 1, y: 0 }} transition={{ type: 'spring', stiffness: 120, damping: 14 }}>
              <DevCardFace type={reveal.card} size="lg" />
            </motion.div>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="rounded-full bg-wood-950/80 px-4 py-1 text-parchment-100">
              {reveal.card === 'victoryPoint' ? '+1 hidden victory point!' : 'Playable from your next turn · click to continue'}
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
