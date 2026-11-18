import {
  BANK_RESOURCE_COUNT,
  DEV_CARD_TYPES,
  DEV_DECK_COUNTS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  PIECE_LIMITS,
  type AILevel,
  type DevCardType,
  type PlayerColor,
} from './constants';
import { desertHex, generateBoard } from './board';
import { emptyBundle } from './resources';
import { randomSeed, Rng } from './rng';
import type { GameState, Player } from './types';

export interface PlayerConfig {
  name: string;
  color: PlayerColor;
  avatar: number;
  isAI: boolean;
  aiLevel?: AILevel;
}

export interface GameConfig {
  players: PlayerConfig[];
  seed?: number;
  /** Skip the opening roll-off and let this seat start (used by tests / replays). */
  firstPlayer?: number;
}

/**
 * Official rule: every player rolls both dice and the highest roll starts; tied players re-roll.
 * Returns the winning seat and a human-readable summary for the chronicle.
 */
function rollOff(rng: Rng, names: string[]): { first: number; summary: string } {
  let contenders = names.map((_, i) => i);
  const rounds: string[] = [];
  for (;;) {
    const rolls = contenders.map((p) => ({ p, total: 2 + rng.int(6) + rng.int(6) }));
    rounds.push(rolls.map((r) => `${names[r.p]} ${r.total}`).join(', '));
    const best = Math.max(...rolls.map((r) => r.total));
    contenders = rolls.filter((r) => r.total === best).map((r) => r.p);
    if (contenders.length === 1) return { first: contenders[0], summary: rounds.join(' → re-roll: ') };
  }
}

export function createGame(config: GameConfig): GameState {
  const { players } = config;
  if (players.length < MIN_PLAYERS || players.length > MAX_PLAYERS) {
    throw new Error(`A game needs ${MIN_PLAYERS}–${MAX_PLAYERS} players`);
  }
  if (new Set(players.map((p) => p.color)).size !== players.length) {
    throw new Error('Each player must have a different color');
  }
  if (players.some((p) => !p.name.trim())) {
    throw new Error('Every player needs a name');
  }

  const seed = config.seed ?? randomSeed();
  const board = generateBoard(seed);
  const rng = new Rng((seed ^ 0x9e3779b9) >>> 0);
  const devDeck = rng.shuffle(
    DEV_CARD_TYPES.flatMap((t) => Array<DevCardType>(DEV_DECK_COUNTS[t]).fill(t)),
  );

  const statePlayers: Player[] = players.map((p, id) => ({
    id,
    name: p.name.trim().slice(0, 20),
    color: p.color,
    avatar: p.avatar,
    isAI: p.isAI,
    ...(p.isAI ? { aiLevel: p.aiLevel ?? 'normal' } : {}),
    resources: emptyBundle(),
    devCards: [],
    newDevCards: [],
    knightsPlayed: 0,
    roadsLeft: PIECE_LIMITS.roads,
    settlementsLeft: PIECE_LIMITS.settlements,
    citiesLeft: PIECE_LIMITS.cities,
  }));

  let first = config.firstPlayer ?? -1;
  let opening = '';
  if (first < 0) {
    const r = rollOff(rng, statePlayers.map((p) => p.name));
    first = r.first;
    opening = `Opening roll: ${r.summary}. ${statePlayers[first].name} rolled highest and goes first.`;
  } else if (!statePlayers[first]) {
    throw new Error('Invalid first player');
  }
  // Seats keep their clockwise order, starting from the first player.
  const forward = statePlayers.map((_, i) => (first + i) % statePlayers.length);
  const order = [...forward, ...[...forward].reverse()];

  return {
    version: 3,
    board,
    players: statePlayers,
    currentPlayer: order[0],
    phase: 'setup',
    setup: { order, index: 0, step: 'settlement', lastSettlement: null },
    buildings: {},
    roads: {},
    robberHex: desertHex(board).id,
    bank: emptyBundle(BANK_RESOURCE_COUNT),
    devDeck,
    dice: null,
    pendingDiscards: {},
    robberVictims: [],
    resumePhase: 'main',
    freeRoads: 0,
    devCardPlayedThisTurn: false,
    tradeOffer: null,
    tradeSeq: 0,
    turn: 0,
    rngState: rng.state,
    log: [
      { id: 0, text: 'A new island rises from the sea. Setup begins!', player: null },
      ...(opening ? [{ id: 1, text: opening, player: first }] : []),
    ],
    winner: null,
    longestRoadHolder: null,
    largestArmyHolder: null,
  };
}
