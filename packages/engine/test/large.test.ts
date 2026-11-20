import { describe, expect, it } from 'vitest';
import {
  applyAction,
  applyDiceResult,
  axialDistance,
  BOARD_RULES,
  chooseAIAction,
  createGame,
  generateBoard,
  newAIMemory,
  pairedPartner,
  pendingAIPlayers,
  PIECE_LIMITS,
  PLAYER_COLORS,
  recordAIAction,
  RESOURCES,
  TERRAINS,
  type AIMemory,
  type GameState,
  type PlayerConfig,
} from '../src';
import { deepClone, must, playedSetup, setHand, totalResources } from './helpers';

const SEEDS = [1, 42, 1337, 2024, 99999, 123456789];

const seats = (n: number, ai = false): PlayerConfig[] =>
  Array.from({ length: n }, (_, i) => ({
    name: `P${i + 1}`,
    color: PLAYER_COLORS[i],
    avatar: i,
    isAI: ai,
    ...(ai ? { aiLevel: (['easy', 'normal', 'hard'] as const)[i % 3] } : {}),
  }));

describe('5–6 player board (CATAN 5-6 extension)', () => {
  it.each(SEEDS)('has 30 hexes, 28 number discs and 11 harbors (seed %i)', (seed) => {
    const board = generateBoard(seed, 'large');
    expect(board.size).toBe('large');
    expect(board.hexes).toHaveLength(30);
    expect(board.harbors).toHaveLength(11);
    const rules = BOARD_RULES.large;
    for (const t of TERRAINS) expect(board.hexes.filter((h) => h.terrain === t)).toHaveLength(rules.terrains[t]);
    expect(board.hexes.filter((h) => h.terrain === 'desert')).toHaveLength(2);

    const tokens = board.hexes.map((h) => h.token).filter((t): t is number => t !== null);
    expect(tokens).toHaveLength(28);
    expect([...tokens].sort((a, b) => a - b)).toEqual([...rules.tokens].sort((a, b) => a - b));
    for (const h of board.hexes) expect(h.token === null).toBe(h.terrain === 'desert');

    // a flat planar graph of 30 hexagons: V - E + F = 1 (F counts the 30 hexes, not the sea)
    expect(board.edges.length).toBe(board.vertices.length + 29);
    // each corner touches 1–3 hexes and 2–3 edges
    for (const v of board.vertices) {
      expect(v.hexes.length).toBeGreaterThanOrEqual(1);
      expect(v.hexes.length).toBeLessThanOrEqual(3);
      expect(v.edges.length).toBeGreaterThanOrEqual(2);
      expect(v.edges.length).toBeLessThanOrEqual(3);
    }
  });

  it.each(SEEDS)('harbors match the extension and never share a corner (seed %i)', (seed) => {
    const board = generateBoard(seed, 'large');
    const types = board.harbors.map((h) => h.type);
    expect(types.filter((t) => t === 'any')).toHaveLength(6);
    for (const r of RESOURCES) expect(types.filter((t) => t === r)).toHaveLength(1);
    const corners = board.harbors.flatMap((h) => h.vertices);
    expect(new Set(corners).size).toBe(corners.length);
  });

  it.each(SEEDS)('never places 6 and 8 next to each other (seed %i)', (seed) => {
    const board = generateBoard(seed, 'large');
    const red = board.hexes.filter((h) => h.token === 6 || h.token === 8);
    expect(red).toHaveLength(6);
    for (const a of red) for (const b of red) if (a !== b) expect(axialDistance(a, b)).not.toBe(1);
  });

  it('is centred on the table and deterministic per seed', () => {
    const a = generateBoard(5, 'large');
    const b = generateBoard(5, 'large');
    expect(a).toEqual(b);
    const xs = a.hexes.map((h) => h.x);
    expect(Math.abs((Math.min(...xs) + Math.max(...xs)) / 2)).toBeLessThan(1e-9);
    const ys = a.hexes.map((h) => h.y);
    expect(Math.abs((Math.min(...ys) + Math.max(...ys)) / 2)).toBeLessThan(1e-9);
  });

  it('keeps the standard island untouched for 3–4 players', () => {
    const board = generateBoard(42);
    expect(board.hexes).toHaveLength(19);
    expect(board.harbors).toHaveLength(9);
  });
});

describe('5–6 player game setup', () => {
  it.each([5, 6])('creates a %i-player game with the extended supply and paired turns', (n) => {
    const g = createGame({ players: seats(n), seed: 3, firstPlayer: 0 });
    expect(g.board.size).toBe('large');
    expect(g.paired).toBe(true);
    for (const r of RESOURCES) expect(g.bank[r]).toBe(24);
    expect(g.devDeck).toHaveLength(34);
    expect(g.devDeck.filter((c) => c === 'knight')).toHaveLength(20);
    expect(g.devDeck.filter((c) => c === 'victoryPoint')).toHaveLength(5);
    for (const c of ['roadBuilding', 'yearOfPlenty', 'monopoly'] as const) expect(g.devDeck.filter((x) => x === c)).toHaveLength(3);
    expect(g.setup!.order).toHaveLength(n * 2);
  });

  it('keeps the base rules for 3–4 players', () => {
    const g = createGame({ players: seats(4), seed: 3, firstPlayer: 0 });
    expect(g.paired).toBe(false);
    for (const r of RESOURCES) expect(g.bank[r]).toBe(19);
    expect(g.devDeck).toHaveLength(25);
  });

  it('rejects more than 6 players and duplicate colors', () => {
    expect(() => createGame({ players: [...seats(6), { name: 'X', color: 'red', avatar: 0, isAI: false }] })).toThrow();
    const dup = seats(5);
    dup[4] = { ...dup[4], color: 'red' };
    expect(() => createGame({ players: dup })).toThrow();
  });
});

/** Finish the current player's turn after rolling a harmless number. */
function rollAndEnd(g: GameState): GameState {
  g = must(applyAction(g, { type: 'ROLL_DICE', player: g.currentPlayer }));
  while (g.phase === 'discard' || g.phase === 'moveRobber' || g.phase === 'steal') {
    if (g.phase === 'discard') {
      const [who, n] = Object.entries(g.pendingDiscards)[0];
      const hand = { ...g.players[Number(who)].resources };
      const out = { wood: 0, brick: 0, wool: 0, grain: 0, ore: 0 };
      for (let i = 0; i < n; i++) {
        const r = RESOURCES.find((x) => hand[x] > 0)!;
        hand[r]--;
        out[r]++;
      }
      g = must(applyAction(g, { type: 'DISCARD', player: Number(who), resources: out }));
    } else if (g.phase === 'moveRobber') {
      const hex = g.board.hexes.find((h) => h.id !== g.robberHex)!.id;
      g = must(applyAction(g, { type: 'MOVE_ROBBER', player: g.currentPlayer, hex }));
    } else {
      g = must(applyAction(g, { type: 'STEAL', player: g.currentPlayer, victim: g.robberVictims[0] }));
    }
  }
  return must(applyAction(g, { type: 'END_TURN', player: g.currentPlayer }));
}

describe('paired players turn structure', () => {
  const six = seats(6);

  it('Player 2 is the third player to the left of Player 1', () => {
    const g = playedSetup(11, six);
    expect(g.turnLeader).toBe(0);
    expect(pairedPartner(g)).toBe(3);
    expect(pairedPartner(g, 4)).toBe(1);
    const five = playedSetup(11, seats(5));
    expect(pairedPartner(five, 4)).toBe(2);
  });

  it('Player 1 takes a full turn, then Player 2 takes an Action phase with no roll', () => {
    let g = playedSetup(11, six);
    expect(g.currentPlayer).toBe(0);
    expect(g.phase).toBe('roll');
    g = rollAndEnd(g);
    // Player 2 now acts: no dice, straight into the Action phase
    expect(g.currentPlayer).toBe(3);
    expect(g.pairedTurn).toBe(true);
    expect(g.phase).toBe('main');
    expect(g.turnLeader).toBe(0);
    expect(applyAction(g, { type: 'ROLL_DICE', player: 3 }).ok).toBe(false);
    // once Player 2 finishes, the dice and markers pass left: Player 1 is now seat 1
    g = must(applyAction(g, { type: 'END_TURN', player: 3 }));
    expect(g.currentPlayer).toBe(1);
    expect(g.pairedTurn).toBe(false);
    expect(g.phase).toBe('roll');
    expect(g.turnLeader).toBe(1);
  });

  it('every seat gets its turn as Player 1 and as Player 2 over a full round', () => {
    let g = playedSetup(12, six);
    const asLeader: number[] = [];
    const asPartner: number[] = [];
    for (let i = 0; i < 12; i++) {
      (g.pairedTurn ? asPartner : asLeader).push(g.currentPlayer);
      g = g.phase === 'roll' ? rollAndEnd(g) : must(applyAction(g, { type: 'END_TURN', player: g.currentPlayer }));
    }
    expect(asLeader).toEqual([0, 1, 2, 3, 4, 5]);
    expect(asPartner).toEqual([3, 4, 5, 0, 1, 2]);
  });

  it('Player 2 may not trade with other players but may trade with the supply and build', () => {
    let g = playedSetup(13, six);
    g = rollAndEnd(g);
    expect(g.currentPlayer).toBe(3);
    g = setHand(g, 3, { wood: 4, brick: 1, ore: 1, wool: 1, grain: 1 });
    const offer = applyAction(g, { type: 'PROPOSE_TRADE', player: 3, give: { wood: 1 }, want: { ore: 1 } });
    expect(offer.ok).toBe(false);
    if (!offer.ok) expect(offer.error).toMatch(/Player 2/);
    // supply trade (4:1 or better) is fine
    const traded = must(applyAction(g, { type: 'MARITIME_TRADE', player: 3, give: 'wood', receive: 'ore', amount: 1 }));
    expect(traded.players[3].resources.ore).toBe(2);
    // and so is buying a development card
    const bought = must(applyAction(traded, { type: 'BUY_DEV_CARD', player: 3 }));
    expect(bought.players[3].newDevCards).toHaveLength(1);
  });

  it('Player 1 can still trade with other players, and only the active player may act', () => {
    let g = playedSetup(14, six);
    g = must(applyDiceResult(g, 0, [1, 2]));
    g = setHand(g, 0, { wood: 1 });
    g = setHand(g, 1, { ore: 1 });
    g = must(applyAction(g, { type: 'PROPOSE_TRADE', player: 0, give: { wood: 1 }, want: { ore: 1 } }));
    g = must(applyAction(g, { type: 'RESPOND_TRADE', player: 1, accept: true }));
    g = must(applyAction(g, { type: 'CONFIRM_TRADE', player: 0, partner: 1 }));
    expect(g.players[0].resources.ore).toBe(1);
    expect(applyAction(g, { type: 'END_TURN', player: 3 }).ok).toBe(false);
  });

  it('development cards bought as Player 2 are playable on your next Action phase', () => {
    let g = playedSetup(15, six);
    g = rollAndEnd(g); // seat 3 is Player 2
    g = setHand(g, 3, { wool: 1, grain: 1, ore: 1 });
    g = must(applyAction(g, { type: 'BUY_DEV_CARD', player: 3 }));
    expect(g.players[3].devCards).toHaveLength(0);
    g = must(applyAction(g, { type: 'END_TURN', player: 3 }));
    expect(g.players[3].devCards).toHaveLength(1);
    expect(g.players[3].newDevCards).toHaveLength(0);
  });

  it('only one development card per Action phase, reset for Player 2', () => {
    let g = deepClone(playedSetup(16, six));
    g.players[0].devCards = ['monopoly', 'monopoly'];
    g.players[3].devCards = ['monopoly', 'monopoly'];
    g = must(applyAction(g, { type: 'PLAY_MONOPOLY', player: 0, resource: 'ore' }));
    expect(applyAction(g, { type: 'PLAY_MONOPOLY', player: 0, resource: 'ore' }).ok).toBe(false);
    g = rollAndEnd(g);
    expect(g.currentPlayer).toBe(3);
    g = must(applyAction(g, { type: 'PLAY_MONOPOLY', player: 3, resource: 'ore' })); // Player 2's own card
    expect(applyAction(g, { type: 'PLAY_MONOPOLY', player: 3, resource: 'ore' }).ok).toBe(false);
  });

  it('Player 2 wins immediately on reaching 10 VP during their Action phase', () => {
    let g = deepClone(playedSetup(17, six));
    g.players[3].devCards = Array(9).fill('victoryPoint');
    const score = (s: GameState) => s.players[3].devCards.length + s.players[3].newDevCards.length;
    expect(score(g)).toBe(9);
    // two starting settlements = 2 VP, so 9 hidden VP cards is already past 10 at the start of Player 2's part
    g = rollAndEnd(g);
    expect(g.phase).toBe('gameOver');
    expect(g.winner).toBe(3);
  });

  it('does not use paired turns in a 4-player game', () => {
    let g = playedSetup(18);
    g = rollAndEnd(g);
    expect(g.currentPlayer).toBe(1);
    expect(g.phase).toBe('roll');
    expect(g.pairedTurn).toBe(false);
  });

  it('plays old saved games (without paired fields) as before', () => {
    let g = deepClone(playedSetup(19));
    delete g.paired;
    delete g.turnLeader;
    delete g.pairedTurn;
    g = rollAndEnd(g);
    expect(g.currentPlayer).toBe(1);
    expect(g.phase).toBe('roll');
  });
});

/** Let computer players play a whole 5–6 player game; every action must be legal. */
function playOut(game: GameState, maxSteps = 9000) {
  const memos: AIMemory[] = game.players.map(() => newAIMemory());
  let g = game;
  let steps = 0;
  let sawPaired = false;
  const total = 24 * 5;
  while (g.phase !== 'gameOver' && steps < maxSteps) {
    let acted = false;
    for (const id of pendingAIPlayers(g)) {
      const action = chooseAIAction(g, id, memos[id]);
      if (!action) continue;
      const r = applyAction(g, action);
      if (!r.ok) throw new Error(`${g.players[id].name} tried ${JSON.stringify(action)} in ${g.phase}: ${r.error}`);
      if (g.pairedTurn) {
        sawPaired = true;
        expect(action.type).not.toBe('PROPOSE_TRADE');
        expect(action.type).not.toBe('ROLL_DICE');
      }
      recordAIAction(memos[id], g, action);
      g = r.state;
      acted = true;
      break;
    }
    if (!acted) throw new Error(`No computer player could act in phase ${g.phase}`);
    expect(totalResources(g)).toBe(total);
    for (const p of g.players) {
      const roads = Object.values(g.roads).filter((o) => o === p.id).length;
      const settlements = Object.values(g.buildings).filter((b) => b.owner === p.id && b.kind === 'settlement').length;
      const cities = Object.values(g.buildings).filter((b) => b.owner === p.id && b.kind === 'city').length;
      expect(roads + p.roadsLeft).toBe(PIECE_LIMITS.roads);
      expect(settlements + p.settlementsLeft).toBe(PIECE_LIMITS.settlements);
      expect(cities + p.citiesLeft).toBe(PIECE_LIMITS.cities);
    }
    steps++;
  }
  return { game: g, steps, sawPaired };
}

describe('computer players on the 5–6 player board', () => {
  it.each([
    [5, 21],
    [5, 22],
    [6, 23],
    [6, 24],
  ])('play a complete %i-player game with paired turns (seed %i)', (n, seed) => {
    const { game, sawPaired } = playOut(createGame({ players: seats(n, true), seed }));
    expect(game.phase).toBe('gameOver');
    expect(game.winner).toBe(game.currentPlayer);
    expect(sawPaired).toBe(true);
    expect(Object.keys(game.buildings).length).toBeGreaterThan(2 * n);
  });
});
