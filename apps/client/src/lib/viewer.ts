import type { GameState } from '@island/engine';

/**
 * Whose private view (resource hand, development cards) the screen shows.
 * Online, it is always this browser's own seat. Locally, on a human's turn it's that human;
 * during a computer player's turn it stays with the human who played most recently, so computer
 * hands are never shown. If every seat is a computer, it follows the current player (spectating).
 */
export function viewerId(game: GameState): number {
  if (game.viewer !== undefined) return game.viewer;
  const n = game.players.length;
  for (let i = 0; i < n; i++) {
    const id = (game.currentPlayer - i + n) % n;
    if (!game.players[id].isAI) return id;
  }
  return game.currentPlayer;
}

/** Can this device act for `seat`? Online: only its own seat. Locally: any human seat. */
export function canControl(game: GameState, seat: number): boolean {
  if (game.viewer !== undefined) return seat === game.viewer;
  return !game.players[seat].isAI;
}

/** Can this device act for whoever's turn it is? */
export const controlsTurn = (game: GameState) => canControl(game, game.currentPlayer);
