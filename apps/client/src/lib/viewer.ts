import type { GameState } from '@island/engine';

/**
 * Whose private view (resource hand, development cards) the screen shows.
 * On a human's turn it's that human. During a computer player's turn it stays with the human
 * who played most recently, so computer hands are never shown. If every seat is a computer,
 * it follows the current player (spectating).
 */
export function viewerId(game: GameState): number {
  const n = game.players.length;
  for (let i = 0; i < n; i++) {
    const id = (game.currentPlayer - i + n) % n;
    if (!game.players[id].isAI) return id;
  }
  return game.currentPlayer;
}
