import { viewerId } from '../../lib/viewer';
import { AnimatePresence, motion } from 'framer-motion';
import { longestRoadLength, publicVictoryPoints, RESOURCES, totalCards, type GameState, type Player } from '@island/engine';
import { PLAYER_PALETTE } from '../../lib/colors';
import { useGameStore } from '../../store/useGameStore';
import { Avatar } from '../Avatar';
import { CardsIcon, CityIcon, CrownIcon, HouseIcon, RoadIcon, ShieldIcon } from '../icons';
import { ResourceIcon } from '../ResourceIcon';
import { gainsFor } from './ResourceHand';

/** Floating '+2 wood +1 ore' chip after production; '−1 card' when robbed. */
function GainChip({ player }: { player: number }) {
  const lastEvents = useGameStore((s) => s.lastEvents);
  const seq = useGameStore((s) => s.eventSeq);
  const gains = gainsFor(lastEvents, player);
  const robbed = lastEvents.some((e) => e.type === 'stolen' && e.victim === player && e.resource);
  if (!gains && !robbed) return null;
  return (
    <AnimatePresence>
      <motion.div
        key={seq}
        initial={{ opacity: 0, y: 8, scale: 0.8 }}
        animate={{ opacity: [0, 1, 1, 0], y: [8, 0, 0, -6], scale: 1 }}
        transition={{ duration: 3, times: [0, 0.1, 0.8, 1] }}
        className={`pointer-events-none absolute right-2 top-1 z-10 flex items-center gap-1 rounded-full px-2 py-0.5 font-display text-sm text-white shadow-lg ${robbed ? 'bg-red-700' : 'bg-emerald-600'}`}
      >
        {robbed
          ? '−1 card (robbed)'
          : RESOURCES.filter((r) => (gains?.[r] ?? 0) > 0).map((r) => (
              <span key={r} className="flex items-center">
                +{gains![r]}
                <ResourceIcon resource={r} className="h-4 w-4" />
              </span>
            ))}
      </motion.div>
    </AnimatePresence>
  );
}

function PlayerPanel({ game, player, active, revealed }: { game: GameState; player: Player; active: boolean; revealed: boolean }) {
  const pal = PLAYER_PALETTE[player.color];
  const vp = publicVictoryPoints(game, player.id);
  const devCount = player.devCards.length + player.newDevCards.length;
  const longest = game.longestRoadHolder === player.id;
  const largest = game.largestArmyHolder === player.id;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0, scale: active ? 1 : 0.975 }}
      transition={{ type: 'spring', stiffness: 260, damping: 26 }}
      className="relative shrink-0 overflow-hidden rounded-xl border-2 px-2.5 py-2"
      style={{
        borderColor: active ? pal.accent : `${pal.accent}70`,
        background: `linear-gradient(135deg, ${pal.panelFrom} 0%, ${pal.panelTo} 100%)`,
        boxShadow: active ? `0 0 0 1px ${pal.accent}80, 0 0 26px ${pal.accent}70, 0 10px 24px rgba(0,0,0,.5)` : '0 8px 20px rgba(0,0,0,.45)',
      }}
    >
      {active && (
        <motion.div
          className="pointer-events-none absolute inset-0"
          style={{ background: `linear-gradient(100deg, transparent 30%, ${pal.accent}22 50%, transparent 70%)` }}
          animate={{ x: ['-100%', '100%'] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
      <GainChip player={player.id} />
      <div className="relative flex items-center gap-3">
        <Avatar index={player.avatar} ring={pal.accent} size={48} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-display text-[17px] leading-tight text-parchment-50">
              {player.name}
              {player.isAI && <span className="ml-1 text-xs text-parchment-300/70">(AI)</span>}
            </span>
            <span className="flex shrink-0 items-center gap-1 font-display text-[17px] text-gold-300" title="Victory points">
              <CrownIcon width={16} height={16} />
              {vp} VP
            </span>
          </div>
          {revealed ? (
            <div className="mt-1 grid grid-cols-5 gap-1">
              {RESOURCES.map((r) => (
                <div key={r} className="flex flex-col items-center leading-none">
                  <ResourceIcon resource={r} className="h-5 w-5" />
                  <span className="mt-0.5 font-display text-sm text-parchment-50">{player.resources[r]}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-1.5 text-sm text-parchment-200">{totalCards(player.resources)} resource cards</div>
          )}
        </div>
      </div>
      <div className="relative mt-1 flex items-center justify-between border-t border-white/10 pt-1 text-xs text-parchment-200/90">
        <span className="flex items-center gap-2.5">
          <span className="flex items-center gap-0.5" title="Roads left">
            <RoadIcon width={14} height={14} />
            {player.roadsLeft}
          </span>
          <span className="flex items-center gap-0.5" title="Settlements left">
            <HouseIcon width={14} height={14} />
            {player.settlementsLeft}
          </span>
          <span className="flex items-center gap-0.5" title="Cities left">
            <CityIcon width={14} height={14} />
            {player.citiesLeft}
          </span>
          <span className="flex items-center gap-0.5" title="Development cards">
            <CardsIcon width={14} height={14} />
            {devCount}
          </span>
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className={`flex items-center gap-0.5 rounded px-1 ${longest ? 'bg-gold-500/30 text-gold-300' : 'opacity-40'}`}
            title={(longest ? 'Holds Longest Road (+2 VP)' : 'Longest Road — not held') + ' · longest road: ' + longestRoadLength(game, player.id) + ' segments (5 needed)'}
          >
            <RoadIcon width={12} height={12} />
            {longestRoadLength(game, player.id)}
          </span>
          <span
            className={`flex items-center gap-0.5 rounded px-1 ${largest ? 'bg-gold-500/30 text-gold-300' : 'opacity-40'}`}
            title={largest ? 'Holds Largest Army (+2 VP)' : `Largest Army — not held (${player.knightsPlayed} knights)`}
          >
            <ShieldIcon width={12} height={12} />
            {player.knightsPlayed}
          </span>
        </span>
      </div>
    </motion.div>
  );
}

export function PlayerPanels({ game }: { game: GameState }) {
  const revealHands = useGameStore((s) => s.settings.revealHands);
  return (
    <div className="flex flex-col gap-2">
      {game.players.map((p) => (
        <PlayerPanel
          key={p.id}
          game={game}
          player={p}
          active={p.id === game.currentPlayer}
          revealed={revealHands || p.id === viewerId(game)}
        />
      ))}
    </div>
  );
}
