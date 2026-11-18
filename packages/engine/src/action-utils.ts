import { BUILD_COSTS, RESOURCES, VICTORY_POINTS_TO_WIN, type BuildKind } from './constants';
import type { ActionResult, GameEvent } from './action-types';
import { emptyBundle } from './resources';
import { addLog } from './state-utils';
import type { GameState, ResourceBundle } from './types';
import { totalVictoryPoints } from './victory';

export const fail = (error: string): ActionResult => ({ ok: false, error });

export const describe = (b: Partial<ResourceBundle>) =>
  RESOURCES.filter((r) => (b[r] ?? 0) > 0)
    .map((r) => `${b[r]} ${r}`)
    .join(', ');

/** Validate and normalise a user-supplied partial bundle (non-negative integers only). */
export function toBundle(input: Partial<ResourceBundle> | undefined): ResourceBundle | null {
  const out = emptyBundle();
  for (const r of RESOURCES) {
    const n = input?.[r] ?? 0;
    if (!Number.isInteger(n) || n < 0) return null;
    out[r] = n;
  }
  return out;
}

/** Move a building cost from the player's hand to the bank (mutates `s`). */
export function payCost(s: GameState, player: number, kind: BuildKind): void {
  const cost = BUILD_COSTS[kind];
  const p = s.players[player];
  for (const r of RESOURCES) {
    const n = cost[r] ?? 0;
    p.resources[r] -= n;
    s.bank[r] += n;
  }
}

/** Official rule: you win as soon as you have 10+ VP during your own turn (mutates `s`). */
export function checkWin(s: GameState, events: GameEvent[]): void {
  if (s.phase === 'gameOver') return;
  const p = s.currentPlayer;
  const vp = totalVictoryPoints(s, p);
  if (vp >= VICTORY_POINTS_TO_WIN) {
    s.phase = 'gameOver';
    s.winner = p;
    events.push({ type: 'gameWon', player: p });
    addLog(s, `${s.players[p].name} reaches ${vp} victory points and wins!`, p);
  }
}
