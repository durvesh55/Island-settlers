import { create } from 'zustand';
import {
  applyAction,
  createGame,
  type DevCardType,
  type GameAction,
  type GameEvent,
  type GameState,
  type PlayerConfig,
} from '@island/engine';
import { playSound, setMuted } from '../lib/sound';

export type Screen = 'menu' | 'mode' | 'players' | 'game' | 'rules';
export type GameMode = 'single' | 'local' | 'online';
export type Panel = 'game' | 'trade' | 'build' | 'development' | 'rules';
export type BuildMode = 'road' | 'settlement' | 'city';

export interface Settings {
  muted: boolean;
  shadows: boolean;
  showProbabilities: boolean;
  revealHands: boolean;
  autoRotateMenu: boolean;
  /** Pass-and-play: cover the screen between turns so hands stay private. */
  handoff: boolean;
}

export interface Toast {
  id: number;
  text: string;
  kind: 'error' | 'info' | 'success';
}

/** Hexes to glow after a roll: gold = produced, red = blocked by the robber. */
export interface RollPulse {
  seq: number;
  at: number;
  hexes: number[];
  blocked: number[];
}

/** Dice currently tumbling across the table; the rolled state is applied when they land. */
export interface DiceThrow {
  seq: number;
  dice: [number, number];
}

/** How long the dice tumble before the result is applied (ms). */
export const DICE_ROLL_MS = 1250;

interface StoreState {
  screen: Screen;
  mode: GameMode | null;
  game: GameState | null;
  playerConfigs: PlayerConfig[] | null;
  /** Events from the most recent successful action (drive UI animations). */
  lastEvents: GameEvent[];
  eventSeq: number;
  panel: Panel | null;
  settingsOpen: boolean;
  settings: Settings;
  hoveredHex: number | null;
  toasts: Toast[];
  cameraResetSeq: number;
  buildMode: BuildMode | null;
  diceThrow: DiceThrow | null;
  rolling: boolean;
  rollPulse: RollPulse | null;
  /** Player who must take the device before their turn starts (pass-and-play curtain). */
  handoffFor: number | null;
  /** Resource picker for Year of Plenty / Monopoly. */
  devCardDialog: 'yearOfPlenty' | 'monopoly' | null;
  /** A just-bought development card being revealed to its buyer. */
  revealCard: { seq: number; card: DevCardType } | null;
  setDevCardDialog: (d: 'yearOfPlenty' | 'monopoly' | null) => void;

  setScreen: (s: Screen) => void;
  setMode: (m: GameMode) => void;
  togglePanel: (p: Panel) => void;
  closePanel: () => void;
  setSettingsOpen: (open: boolean) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  setHoveredHex: (id: number | null) => void;
  pushToast: (text: string, kind?: Toast['kind']) => void;
  dismissToast: (id: number) => void;
  resetCamera: () => void;
  setBuildMode: (mode: BuildMode | null) => void;
  dismissHandoff: () => void;
  startGame: (players: PlayerConfig[], seed?: number) => void;
  newIsland: () => void;
  quitToMenu: () => void;
  resumeSavedGame: () => boolean;
  dispatch: (action: GameAction) => boolean;
  rollDice: () => void;
}

const GAME_KEY = 'island-settlers:game';
const SETTINGS_KEY = 'island-settlers:settings';
const SAVE_VERSION = 3;

const DEFAULT_SETTINGS: Settings = {
  muted: false,
  shadows: true,
  showProbabilities: true,
  revealHands: true,
  autoRotateMenu: true,
  handoff: true,
};

function load<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function save(key: string, value: unknown): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable — the game still works, it just won't persist */
  }
}

interface SavedGame {
  mode: GameMode;
  game: GameState;
  playerConfigs: PlayerConfig[];
}

export function hasSavedGame(): boolean {
  const saved = load<SavedGame>(GAME_KEY);
  return !!saved && saved.game?.version === SAVE_VERSION && saved.game.phase !== 'gameOver';
}

const initialSettings = { ...DEFAULT_SETTINGS, ...(load<Partial<Settings>>(SETTINGS_KEY) ?? {}) };
setMuted(initialSettings.muted);

let toastId = 0;
let rollTimer: number | undefined;

const isBuildEvent = (e: GameEvent) => e.type === 'roadPlaced' || e.type === 'settlementPlaced' || e.type === 'cityBuilt';

export const useGameStore = create<StoreState>((set, get) => {
  /** Commit a successful engine result: persist, animate, play sounds. */
  const commit = (prev: GameState, next: GameState, events: GameEvent[]) => {
    const { mode, playerConfigs, settings } = get();
    save(GAME_KEY, { mode: mode ?? 'local', game: next, playerConfigs: playerConfigs ?? [] } satisfies SavedGame);

    const patch: Partial<StoreState> = { game: next, lastEvents: events };
    if (events.some(isBuildEvent) || next.phase !== 'main') patch.buildMode = null;
    set((s) => ({ ...patch, eventSeq: s.eventSeq + 1 }));

    for (const e of events) {
      switch (e.type) {
        case 'settlementPlaced':
        case 'cityBuilt':
          playSound('place');
          break;
        case 'roadPlaced':
          playSound('road');
          break;
        case 'resourcesGained':
          window.setTimeout(() => playSound('collect'), 250);
          break;
        case 'produced':
          set((s) => ({ rollPulse: { seq: (s.rollPulse?.seq ?? 0) + 1, at: performance.now(), hexes: e.hexes, blocked: e.blockedHexes } }));
          if (e.gains.some((g) => Object.values(g).some((n) => n > 0))) playSound('collect');
          break;
        case 'discardRequired':
          playSound('robber');
          break;
        case 'robberMoved':
          playSound('robber');
          set({ hoveredHex: null });
          break;
        case 'stolen':
          window.setTimeout(() => playSound('steal'), 300);
          break;
        case 'setupComplete':
          get().pushToast('Setup complete! Roll the dice to begin.', 'success');
          break;
        case 'turnEnded':
          if (settings.handoff && mode === 'local' && !next.players[e.next].isAI) set({ handoffFor: e.next });
          else window.setTimeout(() => playSound('turn'), 200);
          break;
        case 'devCardBought':
          playSound('collect');
          set((st) => ({ revealCard: { seq: (st.revealCard?.seq ?? 0) + 1, card: e.card } }));
          break;
        case 'devCardPlayed':
          playSound('place');
          break;
        case 'maritimeTrade':
        case 'tradeCompleted':
          playSound('collect');
          break;
        case 'monopoly': {
          const total = e.taken.reduce((a, b) => a + b, 0);
          get().pushToast(next.players[e.player].name + ' played Monopoly and took ' + total + ' ' + e.resource + '!', 'info');
          break;
        }
        case 'longestRoadChanged':
          get().pushToast(e.to === null ? 'The Longest Road card is set aside.' : next.players[e.to].name + ' takes the Longest Road (' + e.length + ' segments, +2 VP)!', 'success');
          playSound('turn');
          break;
        case 'largestArmyChanged':
          get().pushToast(next.players[e.to].name + ' commands the Largest Army (' + e.knights + ' knights, +2 VP)!', 'success');
          playSound('turn');
          break;
        case 'gameWon':
          window.setTimeout(() => playSound('win'), 400);
          break;
      }
    }
    if (next.currentPlayer !== prev.currentPlayer && next.phase === 'setup') window.setTimeout(() => playSound('turn'), 350);
  };

  return {
    screen: 'menu',
    mode: null,
    game: null,
    playerConfigs: null,
    lastEvents: [],
    eventSeq: 0,
    panel: null,
    settingsOpen: false,
    settings: initialSettings,
    hoveredHex: null,
    toasts: [],
    cameraResetSeq: 0,
    buildMode: null,
    diceThrow: null,
    rolling: false,
    rollPulse: null,
    handoffFor: null,
    devCardDialog: null,
    revealCard: null,
    setDevCardDialog: (devCardDialog) => set({ devCardDialog }),

    setScreen: (screen) => set({ screen }),
    setMode: (mode) => set({ mode }),
    togglePanel: (p) => set((s) => ({ panel: s.panel === p ? null : p })),
    closePanel: () => set({ panel: null }),
    setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
    updateSettings: (patch) => {
      const settings = { ...get().settings, ...patch };
      setMuted(settings.muted);
      save(SETTINGS_KEY, settings);
      set({ settings });
    },
    setHoveredHex: (hoveredHex) => set({ hoveredHex }),
    pushToast: (text, kind = 'info') => {
      const id = ++toastId;
      set((s) => ({ toasts: [...s.toasts.slice(-3), { id, text, kind }] }));
      window.setTimeout(() => get().dismissToast(id), 3600);
    },
    dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
    resetCamera: () => set((s) => ({ cameraResetSeq: s.cameraResetSeq + 1 })),
    setBuildMode: (buildMode) => {
      const { game } = get();
      if (buildMode && game?.phase !== 'main') return;
      set({ buildMode });
    },
    dismissHandoff: () => {
      set({ handoffFor: null });
      playSound('turn');
    },

    startGame: (players, seed) => {
      window.clearTimeout(rollTimer);
      const game = createGame({ players, seed });
      const mode = get().mode ?? 'local';
      save(GAME_KEY, { mode, game, playerConfigs: players } satisfies SavedGame);
      set({
        game,
        playerConfigs: players,
        mode,
        screen: 'game',
        panel: null,
        lastEvents: [],
        hoveredHex: null,
        buildMode: null,
        rolling: false,
        diceThrow: null,
        rollPulse: null,
        handoffFor: null,
        devCardDialog: null,
        revealCard: null,
      });
      const opening = game.log.find((l) => l.text.startsWith('Opening roll'));
      if (opening) get().pushToast(`${game.players[game.currentPlayer].name} rolled highest and places first!`, 'info');
      playSound('turn');
    },

    newIsland: () => {
      const { playerConfigs } = get();
      if (playerConfigs) get().startGame(playerConfigs);
    },

    quitToMenu: () => set({ screen: 'menu', panel: null, settingsOpen: false, hoveredHex: null, buildMode: null }),

    resumeSavedGame: () => {
      const saved = load<SavedGame>(GAME_KEY);
      if (!saved || saved.game?.version !== SAVE_VERSION) return false;
      set({
        game: saved.game,
        mode: saved.mode,
        playerConfigs: saved.playerConfigs,
        screen: 'game',
        panel: null,
        lastEvents: [],
        buildMode: null,
        rolling: false,
        handoffFor: null,
      });
      return true;
    },

    dispatch: (action) => {
      const { game, rolling } = get();
      if (!game) return false;
      if (rolling) return false; // wait for the dice to land
      const result = applyAction(game, action);
      if (!result.ok) {
        get().pushToast(result.error, 'error');
        playSound('error');
        return false;
      }
      commit(game, result.state, result.events);
      return true;
    },

    /** Validates and resolves the roll immediately, but shows the outcome when the dice land. */
    rollDice: () => {
      const { game, rolling } = get();
      if (!game || rolling) return;
      const result = applyAction(game, { type: 'ROLL_DICE', player: game.currentPlayer });
      if (!result.ok) {
        get().pushToast(result.error, 'error');
        playSound('error');
        return;
      }
      const dice = result.state.dice!;
      set((s) => ({ rolling: true, diceThrow: { seq: (s.diceThrow?.seq ?? 0) + 1, dice }, buildMode: null }));
      playSound('dice');
      rollTimer = window.setTimeout(() => {
        set({ rolling: false });
        if (get().game === game) commit(game, result.state, result.events);
      }, DICE_ROLL_MS);
    },
  };
});
