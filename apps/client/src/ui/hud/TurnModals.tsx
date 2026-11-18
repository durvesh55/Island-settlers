import { canControl, controlsTurn } from '../../lib/viewer';
import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  canAfford,
  handSize,
  publicVictoryPoints,
  RESOURCES,
  totalCards,
  totalVictoryPoints,
  type GameState,
  type Resource,
} from '@island/engine';
import { PLAYER_PALETTE, RESOURCE_LABEL } from '../../lib/colors';
import { playSound } from '../../lib/sound';
import { useGameStore } from '../../store/useGameStore';
import { Avatar } from '../Avatar';
import { CrownIcon } from '../icons';
import { ResourceIcon } from '../ResourceIcon';

function Backdrop({ children, z = 'z-40' }: { children: React.ReactNode; z?: string }) {
  return (
    <motion.div
      className={`fixed inset-0 ${z} grid place-items-center bg-black/55 p-4 backdrop-blur-[2px]`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {children}
    </motion.div>
  );
}

const card = {
  initial: { scale: 0.9, y: 24, opacity: 0 },
  animate: { scale: 1, y: 0, opacity: 1 },
  exit: { scale: 0.95, opacity: 0 },
  transition: { type: 'spring' as const, stiffness: 260, damping: 24 },
};

/* ───────────── Discard (rolled 7) ───────────── */

function DiscardDialog({ game, player, required }: { game: GameState; player: number; required: number }) {
  const dispatch = useGameStore((s) => s.dispatch);
  const p = game.players[player];
  const pal = PLAYER_PALETTE[p.color];
  const [pick, setPick] = useState<Record<Resource, number>>({ wood: 0, brick: 0, wool: 0, grain: 0, ore: 0 });
  useEffect(() => setPick({ wood: 0, brick: 0, wool: 0, grain: 0, ore: 0 }), [player]);
  const chosen = totalCards(pick);
  const change = (r: Resource, d: number) => {
    const next = Math.max(0, Math.min(p.resources[r], pick[r] + d));
    if (d > 0 && chosen >= required) return;
    playSound('click');
    setPick({ ...pick, [r]: next });
  };
  return (
    <motion.div {...card} className="panel-wood w-full max-w-lg p-5 text-parchment-100" style={{ borderColor: pal.accent }}>
      <div className="flex items-center gap-3">
        <Avatar index={p.avatar} ring={pal.accent} size={52} />
        <div>
          <h2 className="font-display text-2xl text-parchment-50">The robber strikes!</h2>
          <p className="text-parchment-200">
            <b style={{ color: pal.accent }}>{p.name}</b> holds {handSize(p)} cards and must discard <b>{required}</b>.
          </p>
        </div>
      </div>
      <p className="mt-2 text-sm text-parchment-300/80">Pass the device to {p.name} if needed. Choose which cards to return to the bank.</p>
      <div className="mt-4 grid grid-cols-5 gap-2">
        {RESOURCES.map((r) => (
          <div key={r} className="flex flex-col items-center gap-1 rounded-lg bg-black/25 p-2">
            <ResourceIcon resource={r} className="h-9 w-9" />
            <span className="text-xs text-parchment-300/80">has {p.resources[r]}</span>
            <div className="flex items-center gap-1">
              <button className="h-7 w-7 rounded bg-black/40 text-lg leading-none hover:bg-black/60 disabled:opacity-30" disabled={pick[r] === 0} onClick={() => change(r, -1)} aria-label={`Keep one ${RESOURCE_LABEL[r]}`}>
                −
              </button>
              <span className="w-5 text-center font-display text-lg">{pick[r]}</span>
              <button
                className="h-7 w-7 rounded bg-black/40 text-lg leading-none hover:bg-black/60 disabled:opacity-30"
                disabled={pick[r] >= p.resources[r] || chosen >= required}
                onClick={() => change(r, 1)}
                aria-label={`Discard one ${RESOURCE_LABEL[r]}`}
              >
                +
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between">
        <span className={`font-display text-lg ${chosen === required ? 'text-emerald-400' : 'text-parchment-200'}`}>
          {chosen} / {required} selected
        </span>
        <button className="btn-primary" disabled={chosen !== required} onClick={() => dispatch({ type: 'DISCARD', player, resources: pick })}>
          Discard
        </button>
      </div>
    </motion.div>
  );
}

/* ───────────── Offer from a computer player ───────────── */

function BundleChips({ b }: { b: Record<Resource, number> }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {RESOURCES.filter((r) => b[r] > 0).map((r) => (
        <span key={r} className="inline-flex items-center gap-1 font-display text-lg">
          {b[r]}
          <ResourceIcon resource={r} className="h-7 w-7" />
        </span>
      ))}
    </span>
  );
}

function IncomingOffer({ game, player }: { game: GameState; player: number }) {
  const dispatch = useGameStore((s) => s.dispatch);
  const offer = game.tradeOffer!;
  const from = game.players[offer.from];
  const me = game.players[player];
  const pal = PLAYER_PALETTE[from.color];
  const able = canAfford(me.resources, offer.want);
  return (
    <motion.div {...card} className="panel-wood w-full max-w-md p-5 text-parchment-100" style={{ borderColor: pal.accent }}>
      <div className="flex items-center gap-3">
        <Avatar index={from.avatar} ring={pal.accent} size={52} />
        <div>
          <h2 className="font-display text-2xl text-parchment-50">{from.name} offers a trade</h2>
          <p className="text-sm text-parchment-300/80">{me.name}, will you accept?</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-black/25 p-3">
          <div className="mb-1 text-xs text-parchment-300/75">You receive</div>
          <BundleChips b={offer.give} />
        </div>
        <div className="rounded-lg bg-black/25 p-3">
          <div className="mb-1 text-xs text-parchment-300/75">You give</div>
          <BundleChips b={offer.want} />
        </div>
      </div>
      {!able && <p className="mt-2 text-sm text-red-300">You don't have the cards they asked for.</p>}
      <div className="mt-4 flex justify-end gap-3">
        <button className="btn-wood" onClick={() => dispatch({ type: 'RESPOND_TRADE', player, accept: false })}>
          Decline
        </button>
        <button className="btn-primary" disabled={!able} onClick={() => dispatch({ type: 'RESPOND_TRADE', player, accept: true })}>
          Accept
        </button>
      </div>
    </motion.div>
  );
}

/* ───────────── Steal ───────────── */

function StealDialog({ game }: { game: GameState }) {
  const dispatch = useGameStore((s) => s.dispatch);
  const thief = game.players[game.currentPlayer];
  return (
    <motion.div {...card} className="panel-wood w-full max-w-md p-5 text-parchment-100">
      <h2 className="font-display text-2xl text-parchment-50">Whom will you rob?</h2>
      <p className="text-sm text-parchment-300/80">{thief.name} takes one random card from a settler next to the robber.</p>
      <div className="mt-4 space-y-2">
        {game.robberVictims.map((id) => {
          const v = game.players[id];
          const pal = PLAYER_PALETTE[v.color];
          return (
            <motion.button
              key={id}
              whileHover={{ x: 4 }}
              onClick={() => dispatch({ type: 'STEAL', player: thief.id, victim: id })}
              className="flex w-full items-center gap-3 rounded-xl border-2 p-2.5 text-left"
              style={{ borderColor: `${pal.accent}aa`, background: `linear-gradient(135deg, ${pal.panelFrom}, ${pal.panelTo})` }}
            >
              <Avatar index={v.avatar} ring={pal.accent} size={42} />
              <span className="flex-1 font-display text-lg">{v.name}</span>
              <span className="text-sm text-parchment-200">{handSize(v)} cards</span>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}

/* ───────────── Pass-and-play hand-off ───────────── */

function HandoffCurtain({ game, player }: { game: GameState; player: number }) {
  const dismiss = useGameStore((s) => s.dismissHandoff);
  const p = game.players[player];
  const pal = PLAYER_PALETTE[p.color];
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') dismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dismiss]);
  return (
    <motion.div
      className="fixed inset-0 z-40 grid place-items-center p-4"
      style={{ background: `radial-gradient(circle at 50% 40%, ${pal.panelFrom}f2 0%, #0d0704f7 70%)` }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div {...card} className="flex flex-col items-center gap-4 text-center">
        <motion.div animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 2.2 }}>
          <Avatar index={p.avatar} ring={pal.accent} size={120} />
        </motion.div>
        <p className="font-body text-lg text-parchment-200">Pass the device to</p>
        <h2 className="font-display text-5xl text-parchment-50" style={{ textShadow: `0 0 24px ${pal.accent}` }}>
          {p.name}
        </h2>
        <button className="btn-primary mt-2 px-8 py-3 text-xl" onClick={dismiss} style={{ background: `linear-gradient(180deg, ${pal.accent}, ${pal.panelFrom})` }}>
          I'm {p.name} — start my turn
        </button>
        <p className="text-sm text-parchment-300/60">Hands stay hidden until you continue. Turn this off in Settings.</p>
      </motion.div>
    </motion.div>
  );
}

/* ───────────── Victory ───────────── */

const CONFETTI_COLORS = ['#e8483a', '#4a8cf0', '#f5c842', '#4cc35a', '#fbf4e4', '#c99a3e'];

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 70 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 1.5,
        dur: 3 + Math.random() * 3,
        rot: Math.random() * 720 - 360,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        w: 6 + Math.random() * 8,
      })),
    [],
  );
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden">
      {pieces.map((p, i) => (
        <motion.span
          key={i}
          className="absolute top-0 block rounded-sm"
          style={{ left: `${p.left}%`, width: p.w, height: p.w * 0.45, background: p.color }}
          initial={{ y: -40, rotate: 0, opacity: 1 }}
          animate={{ y: '110vh', rotate: p.rot, opacity: [1, 1, 0.6] }}
          transition={{ delay: p.delay, duration: p.dur, repeat: Infinity, ease: 'easeIn' }}
        />
      ))}
    </div>
  );
}

function WinnerScreen({ game }: { game: GameState }) {
  const newIsland = useGameStore((s) => s.newIsland);
  const quitToMenu = useGameStore((s) => s.quitToMenu);
  const winner = game.players[game.winner!];
  const pal = PLAYER_PALETTE[winner.color];
  const rows = game.players
    .map((p) => {
      const settlements = Object.values(game.buildings).filter((b) => b.owner === p.id && b.kind === 'settlement').length;
      const cities = Object.values(game.buildings).filter((b) => b.owner === p.id && b.kind === 'city').length;
      const hidden = totalVictoryPoints(game, p.id) - publicVictoryPoints(game, p.id);
      return { p, settlements, cities, hidden, total: totalVictoryPoints(game, p.id) };
    })
    .sort((a, b) => b.total - a.total);
  return (
    <motion.div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <Confetti />
      <motion.div {...card} transition={{ ...card.transition, delay: 0.3 }} className="panel-wood relative w-full max-w-xl p-6 text-center text-parchment-100" style={{ borderColor: pal.accent }}>
        <motion.div initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ delay: 0.6, type: 'spring' }} className="mx-auto mb-2 w-fit text-gold-300">
          <CrownIcon width={56} height={56} />
        </motion.div>
        <div className="mx-auto w-fit">
          <Avatar index={winner.avatar} ring={pal.accent} size={110} />
        </div>
        <h2 className="mt-3 font-display text-5xl text-parchment-50" style={{ textShadow: `0 0 26px ${pal.accent}` }}>
          {winner.name} wins!
        </h2>
        <p className="mt-1 text-parchment-200">The island prospers under their banner after {game.turn} turns.</p>
        <table className="mt-5 w-full text-left text-sm">
          <thead className="text-parchment-300/70">
            <tr>
              <th className="py-1 font-normal">Settler</th>
              <th className="py-1 text-center font-normal">Settl.</th>
              <th className="py-1 text-center font-normal">Cities</th>
              <th className="py-1 text-center font-normal">Awards</th>
              <th className="py-1 text-center font-normal">VP cards</th>
              <th className="py-1 text-right font-normal">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ p, settlements, cities, hidden, total }, i) => (
              <motion.tr key={p.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.8 + i * 0.12 }} className="border-t border-white/10">
                <td className="flex items-center gap-2 py-2">
                  <Avatar index={p.avatar} ring={PLAYER_PALETTE[p.color].accent} size={30} />
                  <span className="font-display text-base">{p.name}</span>
                </td>
                <td className="text-center">{settlements}</td>
                <td className="text-center">{cities}</td>
                <td className="text-center text-xs">
                  {[game.longestRoadHolder === p.id && 'Road', game.largestArmyHolder === p.id && 'Army'].filter(Boolean).join(' · ') || '—'}
                </td>
                <td className="text-center">{hidden}</td>
                <td className="text-right font-display text-xl text-gold-300">{total}</td>
              </motion.tr>
            ))}
          </tbody>
        </table>
        <div className="mt-6 flex justify-center gap-3">
          <button className="btn-primary" onClick={newIsland}>
            Play again
          </button>
          <button className="btn-wood" onClick={quitToMenu}>
            Main menu
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/** Every blocking, turn-flow dialog lives here, driven purely by engine phase. */
export function TurnModals({ game }: { game: GameState }) {
  const handoffFor = useGameStore((s) => s.handoffFor);
  const rolling = useGameStore((s) => s.rolling);
  // computer players discard on their own; only show the dialog to humans
  const discarder = Object.entries(game.pendingDiscards).find(([id]) => canControl(game, Number(id)));
  const offer = game.tradeOffer;
  // an offer from a seat this device doesn't control (a computer player, or another online player)
  const incoming = offer && game.phase === 'main' && !canControl(game, offer.from);
  const answerer = incoming ? game.players.find((p) => canControl(game, p.id) && p.id !== offer.from && offer.responses[p.id] === undefined) : undefined;
  return (
    <AnimatePresence>
      {game.phase === 'gameOver' && game.winner !== null && <WinnerScreen key="win" game={game} />}
      {handoffFor !== null && game.phase !== 'gameOver' && <HandoffCurtain key={`handoff-${handoffFor}`} game={game} player={handoffFor} />}
      {!rolling && handoffFor === null && game.phase === 'discard' && discarder && (
        <Backdrop key="discard">
          <DiscardDialog game={game} player={Number(discarder[0])} required={discarder[1]} />
        </Backdrop>
      )}
      {handoffFor === null && answerer && (
        <Backdrop key={`offer-${offer!.id}-${answerer.id}`}>
          <IncomingOffer game={game} player={answerer.id} />
        </Backdrop>
      )}
      {handoffFor === null && game.phase === 'steal' && controlsTurn(game) && (
        <Backdrop key="steal">
          <StealDialog game={game} />
        </Backdrop>
      )}
    </AnimatePresence>
  );
}
