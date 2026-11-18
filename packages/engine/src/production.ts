import { RESOURCES, type Resource } from './constants';
import { emptyBundle } from './resources';
import type { GameState, ResourceBundle } from './types';

export interface Production {
  /** Resources each player receives, indexed by player id. */
  gains: ResourceBundle[];
  /** Hexes that produced (matching number, not blocked by the robber). */
  hexes: number[];
  /** Hex with the matching number that the robber blocked, if any. */
  blockedHexes: number[];
  /** Resources nobody received because the bank ran short. */
  shortages: Resource[];
}

/**
 * What a dice total produces. Settlements yield 1, cities 2; the robber blocks its hex.
 * Bank shortage rule: if the bank cannot pay everyone owed a resource, nobody receives it —
 * unless only one player is owed it, in which case they take whatever remains.
 */
export function computeProduction(state: GameState, total: number): Production {
  const want = state.players.map(() => emptyBundle());
  const hexes: number[] = [];
  const blockedHexes: number[] = [];
  for (const hex of state.board.hexes) {
    if (hex.token !== total || !hex.resource) continue;
    if (hex.id === state.robberHex) {
      blockedHexes.push(hex.id);
      continue;
    }
    hexes.push(hex.id);
    for (const v of hex.vertices) {
      const b = state.buildings[v];
      if (b) want[b.owner][hex.resource] += b.kind === 'city' ? 2 : 1;
    }
  }

  const gains = state.players.map(() => emptyBundle());
  const shortages: Resource[] = [];
  for (const r of RESOURCES) {
    const owed = want.reduce((s, w) => s + w[r], 0);
    if (owed === 0) continue;
    if (owed <= state.bank[r]) {
      want.forEach((w, p) => (gains[p][r] = w[r]));
      continue;
    }
    const recipients = want.map((w, p) => (w[r] > 0 ? p : -1)).filter((p) => p >= 0);
    if (recipients.length === 1) gains[recipients[0]][r] = state.bank[r];
    shortages.push(r);
  }
  return { gains, hexes, blockedHexes, shortages };
}
