import { describe, expect, it } from 'vitest';
import {
  applyAction,
  applyDiceResult,
  createGame,
  longestRoadLength,
  totalCards,
  totalVictoryPoints,
  tradeRatios,
  updateLongestRoad,
  validRoadSpots,
  type Board,
  type GameEvent,
  type GameState,
  type Resource,
} from '../src';
import { deepClone, must, PLAYERS, playedSetup, setHand, totalResources } from './helpers';

/** A game in its main phase on player 0's turn. */
function mainPhase(seed = 51): GameState {
  return must(applyDiceResult(playedSetup(seed), 0, [1, 1]));
}

/** A simple path of `n` edges starting at `start` (no vertex repeated). */
function simplePath(board: Board, start: number, n: number): number[] | null {
  const seen = new Set([start]);
  const path: number[] = [];
  const go = (v: number): boolean => {
    if (path.length === n) return true;
    for (const e of board.vertices[v].edges) {
      const [a, b] = board.edges[e].vertices;
      const w = a === v ? b : a;
      if (seen.has(w)) continue;
      seen.add(w);
      path.push(e);
      if (go(w)) return true;
      path.pop();
      seen.delete(w);
    }
    return false;
  };
  return go(start) ? path : null;
}

/** Empty-board game state for road-network tests. */
function blank(): GameState {
  const g = deepClone(createGame({ players: PLAYERS, seed: 77, firstPlayer: 0 }));
  g.phase = 'main';
  g.setup = null;
  return g;
}

describe('maritime trade', () => {
  it('trades 4:1 with the bank, only after rolling, and supports multiple lots', () => {
    let g = playedSetup(52);
    g = setHand(g, 0, { wood: 8 });
    expect(applyAction(g, { type: 'MARITIME_TRADE', player: 0, give: 'wood', receive: 'ore', amount: 1 }).ok).toBe(false); // roll first
    g = must(applyDiceResult(g, 0, [1, 1]));
    g = setHand(g, 0, { wood: 8 });
    expect(applyAction(g, { type: 'MARITIME_TRADE', player: 0, give: 'wood', receive: 'wood', amount: 1 }).ok).toBe(false);
    const ratio = tradeRatios(g, 0).wood; // 4, or 3/2 if a setup settlement landed on a harbor
    const lots = Math.floor(8 / ratio);
    expect(applyAction(g, { type: 'MARITIME_TRADE', player: 0, give: 'wood', receive: 'ore', amount: lots + 1 }).ok).toBe(false);
    g = must(applyAction(g, { type: 'MARITIME_TRADE', player: 0, give: 'wood', receive: 'ore', amount: lots }));
    expect(g.players[0].resources).toMatchObject({ wood: 8 - lots * ratio, ore: lots });
    expect(totalResources(g)).toBe(95);
  });

  it('uses 3:1 and 2:1 harbor rates for the player who occupies the harbor', () => {
    let g = deepClone(mainPhase(53));
    const generic = g.board.harbors.find((h) => h.type === 'any')!;
    const special = g.board.harbors.find((h) => h.type !== 'any')!;
    g.buildings[generic.vertices[0]] = { owner: 0, kind: 'settlement' };
    g.buildings[special.vertices[0]] = { owner: 0, kind: 'settlement' };
    const res = special.type as Resource;
    const other = res === 'ore' ? 'grain' : 'ore';
    g = setHand(g, 0, { [res]: 2, [other]: 3 });
    g = must(applyAction(g, { type: 'MARITIME_TRADE', player: 0, give: res, receive: other, amount: 1 }));
    expect(g.players[0].resources[res]).toBe(0);
    g = must(applyAction(g, { type: 'MARITIME_TRADE', player: 0, give: other, receive: res, amount: 1 }));
    expect(g.players[0].resources[other]).toBe(1); // 4 - 3
  });
});

describe('domestic trade', () => {
  it('validates offers, lets others answer off-turn and completes with an accepting player', () => {
    let g = setHand(mainPhase(54), 0, { wood: 2, brick: 1 });
    g = setHand(g, 1, { ore: 2 });
    g = setHand(g, 2, {});
    expect(applyAction(g, { type: 'PROPOSE_TRADE', player: 0, give: { wood: 1 }, want: {} }).ok).toBe(false); // gift
    expect(applyAction(g, { type: 'PROPOSE_TRADE', player: 0, give: { wood: 1 }, want: { wood: 1 } }).ok).toBe(false); // like-for-like
    expect(applyAction(g, { type: 'PROPOSE_TRADE', player: 0, give: { ore: 1 }, want: { wool: 1 } }).ok).toBe(false); // doesn't own
    expect(applyAction(g, { type: 'PROPOSE_TRADE', player: 1, give: { ore: 1 }, want: { wood: 1 } }).ok).toBe(false); // not their turn

    g = must(applyAction(g, { type: 'PROPOSE_TRADE', player: 0, give: { wood: 2 }, want: { ore: 1 } }));
    expect(applyAction(g, { type: 'RESPOND_TRADE', player: 0, accept: true }).ok).toBe(false); // own offer
    expect(applyAction(g, { type: 'RESPOND_TRADE', player: 2, accept: true }).ok).toBe(false); // has no ore
    g = must(applyAction(g, { type: 'RESPOND_TRADE', player: 2, accept: false }));
    expect(applyAction(g, { type: 'CONFIRM_TRADE', player: 0, partner: 1 }).ok).toBe(false); // not accepted yet
    g = must(applyAction(g, { type: 'RESPOND_TRADE', player: 1, accept: true }));
    g = must(applyAction(g, { type: 'CONFIRM_TRADE', player: 0, partner: 1 }));
    expect(g.players[0].resources).toMatchObject({ wood: 0, brick: 1, ore: 1 });
    expect(g.players[1].resources).toMatchObject({ wood: 2, ore: 1 });
    expect(g.tradeOffer).toBeNull();
    expect(totalResources(g)).toBe(95);
  });

  it('offers are cleared when the turn ends', () => {
    let g = setHand(mainPhase(55), 0, { wood: 1 });
    g = must(applyAction(g, { type: 'PROPOSE_TRADE', player: 0, give: { wood: 1 }, want: { ore: 1 } }));
    g = must(applyAction(g, { type: 'END_TURN', player: 0 }));
    expect(g.tradeOffer).toBeNull();
    expect(applyAction(g, { type: 'RESPOND_TRADE', player: 2, accept: false }).ok).toBe(false);
  });
});

describe('development cards', () => {
  it('buying costs wool + grain + ore; a card cannot be played on the turn it was bought', () => {
    let g = setHand(mainPhase(61), 0, { wool: 1, grain: 1, ore: 1 });
    g = deepClone(g);
    g.devDeck.splice(g.devDeck.indexOf('knight'), 1);
    g.devDeck.push('knight'); // top of deck = knight
    g = must(applyAction(g, { type: 'BUY_DEV_CARD', player: 0 }));
    expect(g.players[0].newDevCards).toEqual(['knight']);
    expect(g.devDeck).toHaveLength(24);
    expect(totalCards(g.players[0].resources)).toBe(0);
    expect(applyAction(g, { type: 'PLAY_KNIGHT', player: 0 }).ok).toBe(false);
    expect(applyAction(g, { type: 'BUY_DEV_CARD', player: 0 }).ok).toBe(false); // can't afford
    g = must(applyAction(g, { type: 'END_TURN', player: 0 }));
    expect(g.players[0].devCards).toEqual(['knight']);
  });

  it('cannot buy from an empty deck', () => {
    const g = deepClone(setHand(mainPhase(62), 0, { wool: 1, grain: 1, ore: 1 }));
    g.devDeck = [];
    expect(applyAction(g, { type: 'BUY_DEV_CARD', player: 0 }).ok).toBe(false);
  });

  it('a knight may be played before rolling and returns to the roll step; only one card per turn', () => {
    let g = deepClone(playedSetup(63));
    g.players[0].devCards = ['knight', 'monopoly'];
    g = must(applyAction(g, { type: 'PLAY_KNIGHT', player: 0 }));
    expect(g.phase).toBe('moveRobber');
    expect(g.players[0].knightsPlayed).toBe(1);
    const empty = g.board.hexes.find((h) => h.id !== g.robberHex && h.vertices.every((v) => !g.buildings[v]))!;
    g = must(applyAction(g, { type: 'MOVE_ROBBER', player: 0, hex: empty.id }));
    expect(g.phase).toBe('roll');
    g = must(applyDiceResult(g, 0, [1, 1]));
    expect(applyAction(g, { type: 'PLAY_MONOPOLY', player: 0, resource: 'ore' }).ok).toBe(false); // one per turn
  });

  it('Largest Army goes to the first with 3 knights and only moves on strictly more', () => {
    let g = deepClone(mainPhase(64));
    g.players[0].knightsPlayed = 2;
    g.players[0].devCards = ['knight'];
    g = must(applyAction(g, { type: 'PLAY_KNIGHT', player: 0 }));
    expect(g.largestArmyHolder).toBe(0);
    expect(totalVictoryPoints(g, 0)).toBe(4);

    g = deepClone(g);
    g.phase = 'main';
    g.currentPlayer = 1;
    g.devCardPlayedThisTurn = false;
    g.players[1].knightsPlayed = 2;
    g.players[1].devCards = ['knight', 'knight'];
    g = must(applyAction(g, { type: 'PLAY_KNIGHT', player: 1 })); // 3 vs 3 → no change
    expect(g.largestArmyHolder).toBe(0);
    g = deepClone(g);
    g.phase = 'main';
    g.devCardPlayedThisTurn = false;
    g = must(applyAction(g, { type: 'PLAY_KNIGHT', player: 1 })); // 4 vs 3 → takes it
    expect(g.largestArmyHolder).toBe(1);
  });

  it('Road Building places two free roads and then resumes', () => {
    let g = deepClone(mainPhase(65));
    g.players[0].devCards = ['roadBuilding'];
    g = setHand(g, 0, {});
    g = must(applyAction(g, { type: 'PLAY_ROAD_BUILDING', player: 0 }));
    expect(g.phase).toBe('roadBuilding');
    g = must(applyAction(g, { type: 'BUILD_ROAD', player: 0, edge: validRoadSpots(g, 0)[0] }));
    expect(g.phase).toBe('roadBuilding');
    g = must(applyAction(g, { type: 'BUILD_ROAD', player: 0, edge: validRoadSpots(g, 0)[0] }));
    expect(g.phase).toBe('main');
    expect(g.players[0].roadsLeft).toBe(11);
    expect(totalCards(g.players[0].resources)).toBe(0);
    expect(applyAction(g, { type: 'END_TURN', player: 0 }).ok).toBe(true);
  });

  it('Year of Plenty takes any 2 from the bank; Monopoly takes all of one resource', () => {
    let g = deepClone(mainPhase(66));
    g.players[0].devCards = ['yearOfPlenty', 'monopoly'];
    g = setHand(g, 0, {});
    g = must(applyAction(g, { type: 'PLAY_YEAR_OF_PLENTY', player: 0, resources: ['ore', 'ore'] }));
    expect(g.players[0].resources.ore).toBe(2);

    g = deepClone(g);
    g.devCardPlayedThisTurn = false;
    g = setHand(g, 1, { wool: 3, ore: 1 });
    g = setHand(g, 2, { wool: 2 });
    g = setHand(g, 3, {});
    g = must(applyAction(g, { type: 'PLAY_MONOPOLY', player: 0, resource: 'wool' }));
    expect(g.players[0].resources.wool).toBe(5);
    expect(g.players[1].resources).toMatchObject({ wool: 0, ore: 1 });
    expect(totalResources(g)).toBe(95);
  });

  it('a Victory Point card counts at once and can win on the turn it is bought', () => {
    let g = deepClone(mainPhase(67));
    const own = Object.entries(g.buildings).filter(([, b]) => b.owner === 0).map(([v]) => Number(v));
    for (const v of own) g.buildings[v] = { owner: 0, kind: 'city' }; // 4 VP
    g.largestArmyHolder = 0;
    g.longestRoadHolder = 0; // 8 VP
    g.players[0].devCards = ['victoryPoint']; // 9 VP
    g.devDeck.push('victoryPoint');
    g = setHand(g, 0, { wool: 1, grain: 1, ore: 1 });
    g = must(applyAction(g, { type: 'BUY_DEV_CARD', player: 0 }));
    expect(g.phase).toBe('gameOver');
    expect(g.winner).toBe(0);
  });
});

describe('Longest Road', () => {
  it('counts only the longest single branch', () => {
    const g = blank();
    const path = simplePath(g.board, 10, 6)!;
    for (const e of path) g.roads[e] = 0;
    expect(longestRoadLength(g, 0)).toBe(6);
    // add a 1-segment fork off the middle: still 6
    const mid = g.board.edges[path[2]].vertices[1];
    const fork = g.board.vertices[mid].edges.find((e) => g.roads[e] === undefined);
    if (fork !== undefined) g.roads[fork] = 0;
    expect(longestRoadLength(g, 0)).toBe(6);
  });

  it('awards at 5, keeps on ties, transfers on strictly longer, and breaks on opponent settlements', () => {
    const g = blank();
    const red = simplePath(g.board, 0, 6)!;
    red.slice(0, 5).forEach((e) => (g.roads[e] = 0));
    const events: GameEvent[] = [];
    updateLongestRoad(g, events);
    expect(g.longestRoadHolder).toBe(0);

    // blue builds an equally long road elsewhere → red keeps it
    const farStart = g.board.vertices.reduce((best, v) => (Math.hypot(v.x - g.board.vertices[0].x, v.y - g.board.vertices[0].y) > Math.hypot(best.x - g.board.vertices[0].x, best.y - g.board.vertices[0].y) ? v : best)).id;
    const blue = simplePath(g.board, farStart, 6)!;
    blue.slice(0, 5).forEach((e) => (g.roads[e] = 1));
    updateLongestRoad(g, events);
    expect(g.longestRoadHolder).toBe(0);

    // blue extends to 6 → takes it
    g.roads[blue[5]] = 1;
    updateLongestRoad(g, events);
    expect(g.longestRoadHolder).toBe(1);

    // red settlement in the middle of blue's road breaks it (6 → at most 3) → red's 5 is now longest
    const cut = g.board.edges[blue[2]].vertices.find((v) => g.board.edges[blue[3]].vertices.includes(v))!;
    g.buildings[cut] = { owner: 0, kind: 'settlement' };
    expect(longestRoadLength(g, 1)).toBeLessThan(5);
    updateLongestRoad(g, events);
    expect(g.longestRoadHolder).toBe(0);
    expect(events.filter((e) => e.type === 'longestRoadChanged')).toHaveLength(3);
  });

  it('sets the card aside when others tie for the new longest road', () => {
    const g = blank();
    g.longestRoadHolder = 3; // holder whose road no longer qualifies
    const a = simplePath(g.board, 0, 5)!;
    a.forEach((e) => (g.roads[e] = 0));
    const farStart = 53;
    const b = simplePath(g.board, farStart, 5)!;
    if (b.some((e) => g.roads[e] !== undefined)) return; // board shape guard
    b.forEach((e) => (g.roads[e] = 1));
    updateLongestRoad(g, []);
    expect(g.longestRoadHolder).toBeNull();
  });
});
