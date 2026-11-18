import { AnimatePresence, motion } from 'framer-motion';
import { validSetupRoadSpots, validSetupSettlementSpots, type GameState } from '@island/engine';
import { PLAYER_PALETTE } from '../../lib/colors';
import { useGameStore, type BuildMode } from '../../store/useGameStore';
import { ShuffleIcon } from '../icons';

const BUILD_PROMPT: Record<BuildMode, { title: string; detail: string }> = {
  road: { title: 'Build a road', detail: 'Choose a glowing edge connected to your network. Esc to cancel.' },
  settlement: { title: 'Found a settlement', detail: 'Choose a glowing corner on one of your roads. Esc to cancel.' },
  city: { title: 'Upgrade to a city', detail: 'Choose one of your settlements. Cities produce double. Esc to cancel.' },
};

function promptFor(game: GameState, buildMode: BuildMode | null, rolling: boolean): { title: string; detail: string } {
  const p = game.players[game.currentPlayer];
  if (rolling) return { title: 'The dice are rolling…', detail: '' };
  if (p.isAI && game.phase !== 'gameOver') {
    const waiting =
      game.phase === 'discard'
        ? 'Waiting for discards.'
        : game.tradeOffer
          ? 'Waiting for answers to their trade offer.'
          : 'Watch the board and the chronicle to follow their moves.';
    return { title: `${p.name} is taking their turn…`, detail: waiting };
  }
  switch (game.phase) {
    case 'setup': {
      const round = game.setup!.index < game.players.length ? 'first' : 'second';
      if (game.setup!.step === 'settlement') {
        return {
          title: `${p.name}, place your ${round} settlement`,
          detail:
            round === 'second'
              ? 'You will receive one resource from each hex touching this settlement.'
              : 'Pick a glowing corner. Settlements need two road-lengths of space between them.',
        };
      }
      return { title: `${p.name}, place a road`, detail: 'Your road must touch the settlement you just placed.' };
    }
    case 'roll':
      return { title: `${p.name}, roll the dice`, detail: 'Every hex showing the total produces for adjacent settlements and cities.' };
    case 'discard':
      return { title: 'A 7! Discard time', detail: 'Players holding more than 7 cards return half to the bank.' };
    case 'moveRobber':
      return { title: `${p.name}, move the robber`, detail: 'Click any other hex. It stops producing, and you may rob a neighbour.' };
    case 'steal':
      return { title: `${p.name}, choose whom to rob`, detail: '' };
    case 'roadBuilding':
      return { title: `Road Building — ${game.freeRoads} free road${game.freeRoads === 1 ? '' : 's'} left`, detail: 'Choose a glowing edge connected to your network.' };
    case 'main':
      if (buildMode) return BUILD_PROMPT[buildMode];
      return { title: `${p.name}'s turn`, detail: 'Trade (T), build (1–3), buy a card (4), play a card, then end your turn (E).' };
    case 'gameOver':
      return { title: `${game.players[game.winner!].name} wins!`, detail: '' };
  }
}

/** Contextual instruction banner plus a helper that picks a random legal setup placement. */
export function StatusBanner({ game }: { game: GameState }) {
  const dispatch = useGameStore((s) => s.dispatch);
  const buildMode = useGameStore((s) => s.buildMode);
  const rolling = useGameStore((s) => s.rolling);
  const { title, detail } = promptFor(game, buildMode, rolling);
  const player = game.players[game.currentPlayer];
  const pal = PLAYER_PALETTE[player.color];
  const canAuto = game.phase === 'setup' && !player.isAI;

  const placeRandom = () => {
    if (game.setup?.step === 'settlement') {
      const spots = validSetupSettlementSpots(game);
      if (spots.length) dispatch({ type: 'PLACE_SETUP_SETTLEMENT', player: player.id, vertex: spots[Math.floor(Math.random() * spots.length)] });
    } else {
      const spots = validSetupRoadSpots(game);
      if (spots.length) dispatch({ type: 'PLACE_SETUP_ROAD', player: player.id, edge: spots[Math.floor(Math.random() * spots.length)] });
    }
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={title}
        initial={{ y: -12, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 8, opacity: 0 }}
        className="panel-wood pointer-events-auto flex max-w-xl items-center gap-3 px-4 py-2"
        style={{ borderColor: `${pal.accent}aa` }}
      >
        <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: pal.accent, boxShadow: `0 0 10px ${pal.accent}` }} />
        <div className="min-w-0">
          <div className="font-display text-base leading-tight text-parchment-50 sm:text-lg">{title}</div>
          {detail && <div className="text-xs leading-snug text-parchment-200/80 sm:text-sm">{detail}</div>}
        </div>
        {canAuto && (
          <button className="btn-wood shrink-0 px-2.5 py-1.5 text-sm" onClick={placeRandom} title="Place on a random legal spot">
            <ShuffleIcon width={16} height={16} />
            <span className="hidden sm:inline">Random</span>
          </button>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
