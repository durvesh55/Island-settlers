import { controlsTurn } from '../../lib/viewer';
import {
  BUILD_COSTS,
  canAfford,
  validCitySpots,
  validRoadSpots,
  validSettlementSpots,
  type BuildKind,
  type GameState,
} from '@island/engine';
import { playSound } from '../../lib/sound';
import { useGameStore, type BuildMode } from '../../store/useGameStore';
import { CardsIcon, CityIcon, HammerIcon, HouseIcon, RoadIcon } from '../icons';
import { CostList } from '../ResourceIcon';

const OPTIONS: { kind: BuildKind; label: string; Icon: typeof RoadIcon; key: string }[] = [
  { kind: 'road', label: 'Road', Icon: RoadIcon, key: '1' },
  { kind: 'settlement', label: 'Settlement', Icon: HouseIcon, key: '2' },
  { kind: 'city', label: 'City', Icon: CityIcon, key: '3' },
  { kind: 'devCard', label: 'Dev Card', Icon: CardsIcon, key: '4' },
];

export interface BuildAvailability {
  ok: boolean;
  reason: string;
}

/** Why a build option is (un)available right now — mirrors the engine's checks for clear feedback. */
export function buildAvailability(game: GameState, kind: BuildKind): BuildAvailability {
  const p = game.players[game.currentPlayer];
  if (game.phase === 'setup') return { ok: false, reason: 'During setup, place pieces for free on the board' };
  if (game.phase === 'roll') return { ok: false, reason: 'Roll the dice first' };
  if (game.phase !== 'main') return { ok: false, reason: 'Finish the robber first' };
  if (!controlsTurn(game)) return { ok: false, reason: p.isAI ? 'Waiting for the computer player' : `Waiting for ${p.name}` };
  if (!canAfford(p.resources, BUILD_COSTS[kind])) return { ok: false, reason: 'Not enough resources' };
  if (kind === 'road') {
    if (p.roadsLeft <= 0) return { ok: false, reason: 'All 15 roads are on the board' };
    if (validRoadSpots(game, p.id).length === 0) return { ok: false, reason: 'No legal place for a road' };
  }
  if (kind === 'settlement') {
    if (p.settlementsLeft <= 0) return { ok: false, reason: 'No settlements left — upgrade one to a city' };
    if (validSettlementSpots(game, p.id).length === 0) return { ok: false, reason: 'No legal corner — extend your roads first' };
  }
  if (kind === 'devCard') {
    if (game.devDeck.length === 0) return { ok: false, reason: 'The development deck is empty' };
    return { ok: true, reason: 'Click to draw the top card of the deck' };
  }
  if (kind === 'city') {
    if (p.citiesLeft <= 0) return { ok: false, reason: 'All 4 cities are built' };
    if (validCitySpots(game, p.id).length === 0) return { ok: false, reason: 'You have no settlement to upgrade' };
  }
  return { ok: true, reason: 'Click, then choose a glowing spot on the island' };
}

export function BuildMenu({ game }: { game: GameState }) {
  const buildMode = useGameStore((s) => s.buildMode);
  const setBuildMode = useGameStore((s) => s.setBuildMode);
  const rolling = useGameStore((s) => s.rolling);
  const dispatch = useGameStore((s) => s.dispatch);
  return (
    <div className="panel-wood w-full p-3">
      <div className="mb-2 flex items-center gap-2 font-display text-lg text-parchment-100">
        <HammerIcon width={18} height={18} className="text-gold-400" />
        Build
        <span className="ml-auto font-body text-xs text-parchment-300/70">
          {buildMode ? 'Pick a glowing spot · Esc to cancel' : game.phase === 'main' ? 'Keys 1–3' : ''}
        </span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {OPTIONS.map(({ kind, label, Icon, key }) => {
          const { ok, reason } = buildAvailability(game, kind);
          const active = buildMode === kind;
          return (
            <button
              key={kind}
              disabled={!ok || rolling}
              title={`${label} (${key}) — ${reason}`}
              onClick={() => {
                playSound('click');
                if (kind === 'devCard') dispatch({ type: 'BUY_DEV_CARD', player: game.currentPlayer });
                else setBuildMode(active ? null : (kind as BuildMode));
              }}
              className={`group flex flex-col items-center gap-1 rounded-lg border px-1 py-2 transition disabled:cursor-not-allowed ${
                active
                  ? 'border-gold-300 bg-gold-500/30 text-gold-300 shadow-[0_0_14px_rgba(232,192,106,.45)]'
                  : ok
                    ? 'border-gold-600/50 bg-black/25 text-parchment-50 hover:border-gold-400 hover:bg-gold-500/10'
                    : 'border-gold-600/20 bg-black/25 text-parchment-100 opacity-60'
              }`}
            >
              <Icon width={24} height={24} className={ok ? 'text-gold-300' : 'text-parchment-200/60'} />
              <span className="whitespace-nowrap font-display text-[13px] leading-none">{label}</span>
              <CostList cost={BUILD_COSTS[kind]} className="flex-wrap justify-center gap-x-1 gap-y-0 text-parchment-200" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
