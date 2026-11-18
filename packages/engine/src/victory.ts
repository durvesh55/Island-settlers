import type { GameState } from './types';

/** Points visible to everyone: buildings + Longest Road + Largest Army. */
export function publicVictoryPoints(state: GameState, player: number): number {
  let vp = 0;
  for (const b of Object.values(state.buildings)) {
    if (b.owner === player) vp += b.kind === 'city' ? 2 : 1;
  }
  if (state.longestRoadHolder === player) vp += 2;
  if (state.largestArmyHolder === player) vp += 2;
  return vp;
}

/** Public points plus hidden Victory Point development cards. */
export function totalVictoryPoints(state: GameState, player: number): number {
  const p = state.players[player];
  const hidden = [...p.devCards, ...p.newDevCards].filter((c) => c === 'victoryPoint').length;
  return publicVictoryPoints(state, player) + hidden;
}
