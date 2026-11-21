import { AnimatePresence, motion } from 'framer-motion';
import {
  BUILD_COSTS,
  DEV_CARD_TYPES,
  PIECE_LIMITS,
  type GameState,
} from '@island/engine';
import { PLAYER_PALETTE } from '../../lib/colors';
import { useGameStore, type Panel } from '../../store/useGameStore';
import { Avatar } from '../Avatar';
import { DEV_CARD_INFO } from '../devCardInfo';
import { CameraIcon, CloseIcon, ShuffleIcon } from '../icons';
import { CostList } from '../ResourceIcon';
import { RulesContent } from '../RulesContent';
import { DevHand } from './DevCards';
import { TradePanel } from './TradePanel';
import { BuildMenu } from './BuildMenu';
import { possessive } from '../../lib/text';

const TITLES: Record<Panel, string> = {
  game: 'Game',
  trade: 'Trade',
  build: 'Build',
  development: 'Development Cards',
  rules: 'Rules',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-5">
      <h4 className="mb-2 font-display text-lg text-gold-300">{title}</h4>
      {children}
    </section>
  );
}

function PhaseNote({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-gold-600/30 bg-gold-500/10 px-3 py-2 text-sm text-parchment-200">{children}</p>;
}

const PHASE_LABEL: Record<GameState['phase'], string> = {
  setup: 'Setup',
  roll: 'Awaiting roll',
  discard: 'Discarding (rolled 7)',
  moveRobber: 'Moving the robber',
  steal: 'Robbing a neighbour',
  roadBuilding: 'Road Building',
  main: 'Building',
  gameOver: 'Game over',
};

function GamePanel({ game }: { game: GameState }) {
  const mode = useGameStore((s) => s.mode);
  const resetCamera = useGameStore((s) => s.resetCamera);
  const newIsland = useGameStore((s) => s.newIsland);
  const quitToMenu = useGameStore((s) => s.quitToMenu);
  const exitGame = useGameStore((s) => s.exitGame);
  const phaseLabel = game.phase === 'setup' ? `Setup (placement ${game.setup!.index + 1} of ${game.setup!.order.length})` : PHASE_LABEL[game.phase];
  return (
    <>
      <Section title="Room">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-parchment-300/70">Mode</dt>
          <dd>{mode === 'local' ? 'Local pass-and-play' : mode === 'single' ? 'Single player' : 'Online'}</dd>
          <dt className="text-parchment-300/70">Island code</dt>
          <dd className="font-mono">{game.board.seed}</dd>
          <dt className="text-parchment-300/70">Phase</dt>
          <dd>{phaseLabel}</dd>
          <dt className="text-parchment-300/70">Turn</dt>
          <dd>{game.turn === 0 ? '—' : game.turn}</dd>
        </dl>
      </Section>
      <Section title="Settlers">
        <ul className="space-y-1.5">
          {game.players.map((p) => (
            <li key={p.id} className="flex items-center gap-2 text-sm">
              <Avatar index={p.avatar} ring={PLAYER_PALETTE[p.color].accent} size={30} />
              <span className="flex-1">{p.name}</span>
              <span className="rounded px-1.5 text-xs" style={{ background: `${PLAYER_PALETTE[p.color].accent}33`, color: PLAYER_PALETTE[p.color].accent }}>
                {PLAYER_PALETTE[p.color].label}
              </span>
            </li>
          ))}
        </ul>
      </Section>
      <Section title="Table">
        <div className="flex flex-wrap gap-2">
          <button className="btn-wood text-sm" onClick={resetCamera}>
            <CameraIcon width={16} height={16} /> Reset view
          </button>
          <button
            className="btn-wood text-sm"
            onClick={() => {
              if (window.confirm('Start over on a brand-new island with the same players?')) newIsland();
            }}
          >
            <ShuffleIcon width={16} height={16} /> New island
          </button>
          <button className="btn-wood text-sm" onClick={quitToMenu}>
            Main menu
          </button>
          <button
            className="btn-wood text-sm"
            onClick={() => {
              if (window.confirm('Exit the game?')) exitGame();
            }}
          >
            Exit game
          </button>
        </div>
        <p className="mt-2 text-xs text-parchment-300/70">Your game is saved automatically on this device. Drag to orbit, scroll to zoom, right-drag to pan.</p>
      </Section>
      <Section title="Chronicle">
        <ol className="scroll-thin max-h-64 space-y-1 overflow-y-auto pr-1 text-sm">
          {[...game.log].reverse().map((l) => (
            <li key={l.id} className="flex gap-2">
              <span
                className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                style={{ background: l.player !== null ? PLAYER_PALETTE[game.players[l.player].color].accent : '#c99a3e' }}
              />
              <span className="text-parchment-100/90">{l.text}</span>
            </li>
          ))}
        </ol>
      </Section>
    </>
  );
}

function BuildPanel({ game }: { game: GameState }) {
  const player = game.players[game.currentPlayer];
  const closePanel = useGameStore((s) => s.closePanel);
  const rows = [
    { label: 'Road', cost: BUILD_COSTS.road, left: player.roadsLeft, max: PIECE_LIMITS.roads, note: 'Must connect to your road, settlement or city.' },
    { label: 'Settlement', cost: BUILD_COSTS.settlement, left: player.settlementsLeft, max: PIECE_LIMITS.settlements, note: 'On your road network, 2+ edges from any building.' },
    { label: 'City', cost: BUILD_COSTS.city, left: player.citiesLeft, max: PIECE_LIMITS.cities, note: 'Upgrades one of your settlements; produces double.' },
  ];
  return (
    <>
      <div className="mb-5">
        <BuildMenu game={game} onPicked={closePanel} />
      </div>
      <Section title={`${possessive(player.name)} pieces`}>
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.label} className="rounded-lg bg-black/25 p-3">
              <div className="flex items-center justify-between">
                <span className="font-display text-lg">{r.label}</span>
                <CostList cost={r.cost} />
              </div>
              <div className="mt-1 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded bg-black/40">
                  <div className="h-full rounded" style={{ width: `${(r.left / r.max) * 100}%`, background: PLAYER_PALETTE[player.color].accent }} />
                </div>
                <span className="text-xs text-parchment-200">
                  {r.left}/{r.max} left
                </span>
              </div>
              <p className="mt-1 text-xs text-parchment-300/75">{r.note}</p>
            </li>
          ))}
        </ul>
      </Section>
      <PhaseNote>After rolling, pick Road, Settlement or City above (or press 1–3), then click a glowing spot on the island. Esc cancels.</PhaseNote>
    </>
  );
}

function DevelopmentPanel({ game }: { game: GameState }) {
  return (
    <>
      <Section title={`${game.players[game.currentPlayer].name}'s cards`}>
        <DevHand game={game} />
        <p className="mt-2 text-xs text-parchment-300/70">One card per turn, any time during your turn (even before rolling), but not on the turn you bought it.</p>
      </Section>
      <Section title={`Deck — ${game.devDeck.length} cards remaining`}>
        <ul className="space-y-2 text-sm">
          {DEV_CARD_TYPES.map((t) => (
            <li key={t} className="flex gap-2">
              <span className="text-xl">{DEV_CARD_INFO[t].glyph}</span>
              <span>
                <b className="font-display">{DEV_CARD_INFO[t].name}</b> — {DEV_CARD_INFO[t].text}
              </span>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}

export function Drawer({ game }: { game: GameState }) {
  const panel = useGameStore((s) => s.panel);
  const closePanel = useGameStore((s) => s.closePanel);
  return (
    <AnimatePresence>
      {panel && (
        <motion.aside
          key="drawer"
          initial={{ x: -30, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -30, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 30 }}
          className="panel-wood pointer-events-auto flex max-h-full w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden"
        >
          <header className="flex items-center justify-between border-b border-gold-600/30 px-4 py-3">
            <h3 className="font-display text-2xl text-parchment-50">{TITLES[panel]}</h3>
            <button className="text-parchment-200 hover:text-gold-300" onClick={closePanel} aria-label="Close panel">
              <CloseIcon />
            </button>
          </header>
          <div className="scroll-thin flex-1 overflow-y-auto px-4 py-4 text-parchment-100">
            {panel === 'game' && <GamePanel game={game} />}
            {panel === 'trade' && <TradePanel game={game} />}
            {panel === 'build' && <BuildPanel game={game} />}
            {panel === 'development' && <DevelopmentPanel game={game} />}
            {panel === 'rules' && <RulesContent />}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
