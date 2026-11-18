import type { GameEvent } from './action-types';
import { addLog } from './state-utils';
import type { GameState } from './types';

export const LONGEST_ROAD_MIN = 5;
export const LARGEST_ARMY_MIN = 3;

/**
 * Length of the player's longest continuous road: the longest trail through their road
 * network that never reuses a segment (forks don't add up — only the single longest branch
 * counts). A trail cannot pass *through* a corner holding an opponent's settlement or city.
 */
export function longestRoadLength(state: GameState, player: number): number {
  const { board } = state;
  const mine = new Set<number>();
  for (const [e, owner] of Object.entries(state.roads)) if (owner === player) mine.add(Number(e));
  if (mine.size === 0) return 0;

  const blocked = (v: number) => {
    const b = state.buildings[v];
    return !!b && b.owner !== player;
  };
  let best = 0;
  const used = new Set<number>();
  const walk = (v: number, len: number) => {
    if (len > best) best = len;
    if (len > 0 && blocked(v)) return;
    for (const e of board.vertices[v].edges) {
      if (!mine.has(e) || used.has(e)) continue;
      const [a, b] = board.edges[e].vertices;
      used.add(e);
      walk(a === v ? b : a, len + 1);
      used.delete(e);
    }
  };
  const starts = new Set<number>();
  for (const e of mine) for (const v of board.edges[e].vertices) starts.add(v);
  for (const v of starts) walk(v, 0);
  return best;
}

/**
 * Re-evaluate the Longest Road card after any road or settlement is placed (rulebook p.9):
 * - needs at least 5 segments;
 * - the holder keeps it while still tied for longest;
 * - otherwise a single strictly-longest player takes it;
 * - if several players tie for the new longest (or nobody has 5+), the card is set aside.
 */
export function updateLongestRoad(s: GameState, events: GameEvent[]): void {
  const lengths = s.players.map((p) => longestRoadLength(s, p.id));
  const max = Math.max(...lengths);
  const prev = s.longestRoadHolder;
  let next: number | null;
  if (max < LONGEST_ROAD_MIN) next = null;
  else if (prev !== null && lengths[prev] === max) next = prev;
  else {
    const leaders = lengths.map((l, i) => (l === max ? i : -1)).filter((i) => i >= 0);
    next = leaders.length === 1 ? leaders[0] : null;
  }
  if (next === prev) return;
  s.longestRoadHolder = next;
  events.push({ type: 'longestRoadChanged', from: prev, to: next, length: next === null ? 0 : lengths[next] });
  if (next !== null) addLog(s, `${s.players[next].name} now holds the Longest Road (${lengths[next]} segments, +2 VP).`, next);
  else addLog(s, 'The Longest Road card is set aside — no single player has the longest road.');
}

/** The first player with 3 knights takes Largest Army; afterwards only strictly more knights take it over. */
export function updateLargestArmy(s: GameState, player: number, events: GameEvent[]): void {
  const knights = s.players[player].knightsPlayed;
  const prev = s.largestArmyHolder;
  if (prev === player || knights < LARGEST_ARMY_MIN) return;
  if (prev !== null && knights <= s.players[prev].knightsPlayed) return;
  s.largestArmyHolder = player;
  events.push({ type: 'largestArmyChanged', from: prev, to: player, knights });
  addLog(s, `${s.players[player].name} now commands the Largest Army (${knights} knights, +2 VP).`, player);
}
