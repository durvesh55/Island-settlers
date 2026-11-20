import { useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { validSetupRoadSpots, validSetupSettlementSpots } from '@island/engine';
import { useGameStore } from './store/useGameStore';
import { GameScreen } from './screens/GameScreen';
import { MainMenu, MenuBackdrop, ModeSelect, RulesScreen } from './screens/MenuScreens';
import { LobbyScreen, OnlineHome } from './screens/OnlineScreens';
import { defaultPlayers, PlayerSetup } from './screens/PlayerSetup';
import { SettingsModal, Toasts } from './ui/Overlays';

/**
 * Dev/testing shortcut: `?quick=4&seed=123&auto=6` (quick=3…6 players) starts a local game immediately
 * and performs `auto` random legal setup placements through the normal engine path.
 * `&ai=3` makes the last 3 seats computer players (`ai=4` watches computers play each other).
 */
let quickStarted = false;

function useQuickStart() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const quick = params.get('quick');
    if (!quick || quickStarted) return;
    quickStarted = true;
    const store = useGameStore.getState();
    const count = Math.min(6, Math.max(3, Number(quick) || 4));
    const ai = Math.max(0, Math.min(count, Number(params.get('ai') ?? 0)));
    store.setMode(ai > 0 ? 'single' : 'local');
    const seed = params.get('seed');
    const players = defaultPlayers(count, 'local').map((p, i) =>
      i >= count - ai ? { ...p, name: `Computer ${i + 1}`, isAI: true, aiLevel: (params.get('level') as 'easy' | 'normal' | 'hard' | null) ?? 'normal' } : p,
    );
    store.startGame(players, seed ? Number(seed) : undefined);
    const auto = Math.min(16, Number(params.get('auto') ?? 0));
    // deterministic picks when a seed is given, so test runs are reproducible
    let r = (Number(seed ?? Date.now()) * 2654435761) >>> 0 || 1;
    const rand = () => ((r = (Math.imul(r, 1664525) + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < auto; i++) {
      const g = useGameStore.getState().game!;
      if (g.phase !== 'setup') break;
      const player = g.currentPlayer;
      if (g.setup!.step === 'settlement') {
        const spots = validSetupSettlementSpots(g);
        store.dispatch({ type: 'PLACE_SETUP_SETTLEMENT', player, vertex: spots[Math.floor(rand() * spots.length)] });
      }
      const g2 = useGameStore.getState().game!;
      const roads = validSetupRoadSpots(g2);
      if (roads.length) store.dispatch({ type: 'PLACE_SETUP_ROAD', player, edge: roads[Math.floor(rand() * roads.length)] });
    }
  }, []);
}

export default function App() {
  const screen = useGameStore((s) => s.screen);
  useQuickStart();
  const inMenus = screen !== 'game';
  return (
    <div className="relative h-full w-full overflow-hidden bg-wood-950 font-body text-parchment-100">
      {inMenus && <MenuBackdrop />}
      <AnimatePresence mode="wait">
        {screen === 'menu' && <MainMenu key="menu" />}
        {screen === 'mode' && <ModeSelect key="mode" />}
        {screen === 'players' && <PlayerSetup key="players" />}
        {screen === 'rules' && <RulesScreen key="rules" />}
        {screen === 'online' && <OnlineHome key="online" />}
        {screen === 'lobby' && <LobbyScreen key="lobby" />}
        {screen === 'game' && <GameScreen key="game" />}
      </AnimatePresence>
      <SettingsModal />
      <Toasts />
    </div>
  );
}
