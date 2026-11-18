import { describe, expect, it } from 'vitest';
import {
  applyAction,
  chooseAIAction,
  createGame,
  newAIMemory,
  pendingAIPlayers,
  recordAIAction,
  RESOURCES,
  satisfiesDistanceRule,
  totalCards,
  validSetupSettlementSpots,
  vertexScore,
  type AILevel,
  type AIMemory,
  type GameState,
  type PlayerConfig,
} from '../src';
import { deepClone, must, playedSetup, setHand, totalResources } from './helpers';

const aiPlayers = (levels: AILevel[]): PlayerConfig[] =>
  levels.map((aiLevel, i) => ({ name: `Bot ${i + 1}`, color: (['red', 'blue', 'yellow', 'green'] as const)[i], avatar: i, isAI: true, aiLevel }));

/** Let the computer players play a whole game; every action must be legal. */
function playOut(game: GameState, maxSteps = 6000) {
  const memos: AIMemory[] = game.players.map(() => newAIMemory());
  let g = game;
  let steps = 0;
  while (g.phase !== 'gameOver' && steps < maxSteps) {
    let acted = false;
    for (const id of pendingAIPlayers(g)) {
      const action = chooseAIAction(g, id, memos[id]);
      if (!action) continue;
      const r = applyAction(g, action);
      if (!r.ok) throw new Error(`${g.players[id].name} tried ${JSON.stringify(action)} in ${g.phase}: ${r.error}`);
      recordAIAction(memos[id], g, action);
      g = r.state;
      acted = true;
      break;
    }
    if (!acted) throw new Error(`No computer player could act in phase ${g.phase}`);
    expect(totalResources(g)).toBe(95);
    steps++;
  }
  return { game: g, steps };
}

describe('computer players', () => {
  it.each([11, 22, 33, 44, 55, 66])('play a complete 4-player game legally (seed %i)', (seed) => {
    const game = createGame({ players: aiPlayers(['easy', 'normal', 'hard', 'normal']), seed });
    const { game: end } = playOut(game);
    expect(end.phase).toBe('gameOver');
    expect(end.winner).not.toBeNull();
    // a real game, not a stall: someone built cities or settlements beyond the start
    expect(Object.keys(end.buildings).length).toBeGreaterThan(8);
  });

  it('finishes 3-player games in a reasonable number of turns', () => {
    for (const seed of [7, 8, 9]) {
      const { game } = playOut(createGame({ players: aiPlayers(['hard', 'hard', 'hard']), seed }));
      expect(game.phase).toBe('gameOver');
      expect(game.turn).toBeLessThan(200);
    }
  });

  it('opens on the best-scoring corner at hard difficulty', () => {
    const g = createGame({ players: aiPlayers(['hard', 'hard', 'hard', 'hard']), seed: 5, firstPlayer: 0 });
    const action = chooseAIAction(g, 0)!;
    expect(action.type).toBe('PLACE_SETUP_SETTLEMENT');
    const best = Math.max(...validSetupSettlementSpots(g).map((v) => vertexScore(g, 0, v)));
    if (action.type === 'PLACE_SETUP_SETTLEMENT') expect(vertexScore(g, 0, action.vertex)).toBe(best);
  });

  it('never moves the robber onto its own buildings when it has a choice', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const g = deepClone(playedSetup(seed));
      g.players[0].isAI = true;
      g.players[0].aiLevel = 'hard';
      g.phase = 'moveRobber';
      const action = chooseAIAction(g, 0)!;
      expect(action.type).toBe('MOVE_ROBBER');
      if (action.type !== 'MOVE_ROBBER') continue;
      const mine = g.board.hexes[action.hex].vertices.some((v) => g.buildings[v]?.owner === 0);
      expect(mine).toBe(false);
      expect(applyAction(g, action).ok).toBe(true);
    }
  });

  it('discards exactly half, from cards it holds, even off-turn', () => {
    let g = playedSetup(3);
    g = setHand(g, 2, { wood: 5, brick: 1, ore: 3, grain: 1 });
    g = deepClone(g);
    g.players[2].isAI = true;
    g.phase = 'discard';
    g.pendingDiscards = { 2: 5 };
    const action = chooseAIAction(g, 2)!;
    expect(action.type).toBe('DISCARD');
    if (action.type === 'DISCARD') expect(totalCards(action.resources)).toBe(5);
    const next = must(applyAction(g, action));
    expect(totalCards(next.players[2].resources)).toBe(5);
    expect(next.phase).toBe('moveRobber');
  });

  it('answers trade offers sensibly', () => {
    let g = playedSetup(4);
    // Player 1 (AI) has no free settlement spot, so it is saving for a road: it holds wood and spare wool.
    g = setHand(g, 1, { wood: 1, wool: 3 });
    g = setHand(g, 0, { brick: 2 });
    g = deepClone(g);
    g.players[1].isAI = true;
    g.phase = 'main';
    const offer = must(applyAction(g, { type: 'PROPOSE_TRADE', player: 0, give: { brick: 1 }, want: { wool: 1 } }));
    expect(chooseAIAction(offer, 1)).toEqual({ type: 'RESPOND_TRADE', player: 1, accept: true });

    // A lopsided offer is declined.
    const greedy = must(applyAction(g, { type: 'PROPOSE_TRADE', player: 0, give: { brick: 1 }, want: { wool: 3, wood: 1 } }));
    expect(chooseAIAction(greedy, 1)).toEqual({ type: 'RESPOND_TRADE', player: 1, accept: false });

    // Nobody helps a player about to win.
    const leader = deepClone(offer);
    for (const v of leader.board.vertices.filter((v) => satisfiesDistanceRule(leader, v.id)).slice(0, 4)) {
      leader.buildings[v.id] = { owner: 0, kind: 'city' };
    }
    expect(chooseAIAction(leader, 1)).toEqual({ type: 'RESPOND_TRADE', player: 1, accept: false });
  });

  it('waits for human answers before settling its own offer, then confirms with an accepter', () => {
    let g = playedSetup(6);
    g = deepClone(g);
    g.players[0].isAI = true;
    g.phase = 'main';
    // Saving for a road (no free settlement spot), missing only wood; spare cards are below the 3:1 harbor rate.
    g = setHand(g, 0, { brick: 1, wool: 1, grain: 1 });
    g = setHand(g, 1, { wood: 2 });
    const memo = newAIMemory();
    const propose = chooseAIAction(g, 0, memo)!;
    // it cannot trade with the bank, so it asks the table
    expect(propose.type).toBe('PROPOSE_TRADE');
    recordAIAction(memo, g, propose);
    let s = must(applyAction(g, propose));
    expect(chooseAIAction(s, 0, memo)).toBeNull(); // waiting on players 1–3
    s = must(applyAction(s, { type: 'RESPOND_TRADE', player: 1, accept: true }));
    s = must(applyAction(s, { type: 'RESPOND_TRADE', player: 2, accept: false }));
    s = must(applyAction(s, { type: 'RESPOND_TRADE', player: 3, accept: false }));
    expect(chooseAIAction(s, 0, memo)).toEqual({ type: 'CONFIRM_TRADE', player: 0, partner: 1 });
  });

  it('is deterministic for the same state', () => {
    const g = createGame({ players: aiPlayers(['easy', 'easy', 'easy']), seed: 77, firstPlayer: 0 });
    expect(chooseAIAction(g, 0)).toEqual(chooseAIAction(deepClone(g), 0));
  });

  it('does nothing when it is not its turn and nothing is asked of it', () => {
    const g = playedSetup(8);
    expect(chooseAIAction(g, (g.currentPlayer + 1) % 4)).toBeNull();
    expect(RESOURCES.length).toBe(5);
  });
});
