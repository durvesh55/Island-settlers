import { mulberry32Step } from './rng';
import type { GameState } from './types';

/** Copy the mutable parts of state (the board itself is immutable after generation). */
export function cloneState(s: GameState): GameState {
  return {
    ...s,
    players: s.players.map((p) => ({
      ...p,
      resources: { ...p.resources },
      devCards: [...p.devCards],
      newDevCards: [...p.newDevCards],
    })),
    setup: s.setup ? { ...s.setup, order: [...s.setup.order] } : null,
    buildings: { ...s.buildings },
    roads: { ...s.roads },
    bank: { ...s.bank },
    devDeck: [...s.devDeck],
    pendingDiscards: { ...s.pendingDiscards },
    robberVictims: [...s.robberVictims],
    tradeOffer: s.tradeOffer
      ? { ...s.tradeOffer, give: { ...s.tradeOffer.give }, want: { ...s.tradeOffer.want }, responses: { ...s.tradeOffer.responses } }
      : null,
    dice: s.dice ? [s.dice[0], s.dice[1]] : null,
    log: [...s.log],
  };
}

export function addLog(s: GameState, text: string, player: number | null = null): void {
  const id = (s.log.at(-1)?.id ?? -1) + 1;
  s.log.push({ id, text, player });
  if (s.log.length > 200) s.log.splice(0, s.log.length - 200);
}

/** Draw a random number in [0,1) from the state's RNG, advancing it (mutates `s`). */
export function nextRandom(s: GameState): number {
  const [value, next] = mulberry32Step(s.rngState);
  s.rngState = next;
  return value;
}
