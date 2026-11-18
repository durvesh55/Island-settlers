import { useEffect } from 'react';
import { chooseAIAction, newAIMemory, pendingAIPlayers, recordAIAction, type AIMemory, type GameAction } from '@island/engine';
import { useGameStore } from './useGameStore';

/** Per-seat memory (resets each turn inside the engine helpers). */
const memories = new Map<number, AIMemory>();
const memoFor = (id: number) => {
  let m = memories.get(id);
  if (!m) memories.set(id, (m = newAIMemory()));
  return m;
};

/** Pause before each kind of computer action, so a human can follow what happened (ms). */
function delayFor(action: GameAction): number {
  switch (action.type) {
    case 'PLACE_SETUP_SETTLEMENT':
    case 'PLACE_SETUP_ROAD':
      return 650;
    case 'ROLL_DICE':
      return 700;
    case 'DISCARD':
    case 'RESPOND_TRADE':
      return 600;
    case 'MOVE_ROBBER':
    case 'STEAL':
      return 900;
    case 'END_TURN':
      return 800;
    case 'PROPOSE_TRADE':
    case 'CONFIRM_TRADE':
    case 'CANCEL_TRADE':
      return 1000;
    default:
      return 850;
  }
}

/**
 * Drives every computer player: whenever the game state changes, find the first computer
 * player with something to do (its own turn, a discard, or answering a trade) and perform
 * that action after a short, readable delay — through the same engine path as a human.
 */
export function useAIController(): void {
  const game = useGameStore((s) => s.game);
  const rolling = useGameStore((s) => s.rolling);
  const fast = useGameStore((s) => s.settings.fastAI);
  const screen = useGameStore((s) => s.screen);
  const mode = useGameStore((s) => s.mode);

  useEffect(() => {
    // online, computer players run on the server
    if (!game || mode === 'online' || rolling || screen !== 'game' || game.phase === 'gameOver') return;
    let next: { player: number; action: GameAction } | null = null;
    for (const id of pendingAIPlayers(game)) {
      const action = chooseAIAction(game, id, memoFor(id));
      if (action) {
        next = { player: id, action };
        break;
      }
    }
    if (!next) return;
    const { player, action } = next;
    const timer = window.setTimeout(
      () => {
        const store = useGameStore.getState();
        if (store.game !== game) return; // state moved on (e.g. the human answered first)
        let ok: boolean;
        if (action.type === 'ROLL_DICE') {
          store.rollDice();
          ok = true;
        } else {
          ok = store.dispatch(action);
        }
        if (ok) {
          recordAIAction(memoFor(player), game, action);
        } else if (game.currentPlayer === player && game.phase === 'main') {
          // Should never happen; make sure the game can't stall on a computer turn.
          console.error('Computer player action rejected', action);
          store.dispatch({ type: 'END_TURN', player });
        }
      },
      delayFor(action) * (fast ? 0.35 : 1),
    );
    return () => window.clearTimeout(timer);
  }, [game, rolling, fast, screen, mode]);
}
