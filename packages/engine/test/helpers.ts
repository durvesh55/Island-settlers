import {
  applyAction,
  createGame,
  RESOURCES,
  validSetupRoadSpots,
  validSetupSettlementSpots,
  type ActionResult,
  type GameState,
  type PlayerConfig,
} from '../src';

export const PLAYERS: PlayerConfig[] = [
  { name: 'Ana', color: 'red', avatar: 0, isAI: false },
  { name: 'Ben', color: 'blue', avatar: 1, isAI: false },
  { name: 'Cleo', color: 'yellow', avatar: 2, isAI: false },
  { name: 'Dev', color: 'green', avatar: 3, isAI: false },
];

/** JSON deep clone (game state is plain JSON by design). */
export const deepClone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

export function must(result: ActionResult): GameState {
  if (!result.ok) throw new Error(result.error);
  return result.state;
}

/** Small deterministic PRNG for picking moves in tests. */
export function picker(seed: number) {
  let s = seed >>> 0 || 1;
  return <T>(items: T[]): T => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return items[s % items.length];
  };
}

/** A game that has completed setup (phase 'roll'), with placements picked pseudo-randomly. */
export function playedSetup(seed: number, players = PLAYERS): GameState {
  const pick = picker(seed);
  let g = createGame({ players, seed, firstPlayer: 0 });
  while (g.phase === 'setup') {
    const p = g.currentPlayer;
    g = must(applyAction(g, { type: 'PLACE_SETUP_SETTLEMENT', player: p, vertex: pick(validSetupSettlementSpots(g)) }));
    g = must(applyAction(g, { type: 'PLACE_SETUP_ROAD', player: p, edge: pick(validSetupRoadSpots(g)) }));
  }
  return g;
}

/** Directly set a player's hand, moving the difference to/from the bank (keeps totals honest). */
export function setHand(g: GameState, player: number, hand: Partial<Record<(typeof RESOURCES)[number], number>>): GameState {
  const s = deepClone(g);
  for (const r of RESOURCES) {
    const want = hand[r] ?? 0;
    const delta = want - s.players[player].resources[r];
    s.players[player].resources[r] = want;
    s.bank[r] -= delta;
  }
  return s;
}

export function totalResources(g: GameState): number {
  return RESOURCES.reduce((sum, r) => sum + g.bank[r] + g.players.reduce((s, p) => s + p.resources[r], 0), 0);
}
