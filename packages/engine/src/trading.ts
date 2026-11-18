import { BANK_TRADE_RATIO, RESOURCES, type Resource } from './constants';
import type { GameState } from './types';

/** Best maritime trade ratio per resource for a player (4:1 bank, 3:1 / 2:1 harbors). */
export function tradeRatios(state: GameState, player: number): Record<Resource, number> {
  const ratios = Object.fromEntries(RESOURCES.map((r) => [r, BANK_TRADE_RATIO])) as Record<Resource, number>;
  for (const [vid, building] of Object.entries(state.buildings)) {
    if (building.owner !== player) continue;
    const harborId = state.board.vertices[Number(vid)].harbor;
    if (harborId === null) continue;
    const harbor = state.board.harbors[harborId];
    if (harbor.type === 'any') {
      for (const r of RESOURCES) ratios[r] = Math.min(ratios[r], 3);
    } else {
      ratios[harbor.type] = Math.min(ratios[harbor.type], 2);
    }
  }
  return ratios;
}
