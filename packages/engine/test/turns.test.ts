import { describe, expect, it } from 'vitest';
import {
  applyAction,
  applyDiceResult,
  computeProduction,
  publicVictoryPoints,
  robberCandidates,
  totalCards,
  validCitySpots,
  validRoadSpots,
  validSettlementSpots,
  type GameState,
} from '../src';
import { deepClone, must, playedSetup, setHand, totalResources } from './helpers';

/** Find a dice pair that produces for some player (non-7, hex not under the robber). */
function productiveRoll(g: GameState): { dice: [number, number]; total: number } {
  for (let total = 2; total <= 12; total++) {
    if (total === 7) continue;
    const prod = computeProduction(g, total);
    if (prod.gains.some((x) => totalCards(x) > 0)) {
      const d1 = Math.max(1, total - 6);
      return { dice: [d1, total - d1], total };
    }
  }
  throw new Error('no productive roll');
}

describe('dice and production', () => {
  it('only the current player may roll, and only once', () => {
    const g = playedSetup(11);
    expect(applyAction(g, { type: 'ROLL_DICE', player: 1 }).ok).toBe(false);
    const rolled = must(applyAction(g, { type: 'ROLL_DICE', player: 0 }));
    expect(rolled.dice).not.toBeNull();
    expect(applyAction(rolled, { type: 'ROLL_DICE', player: 0 }).ok).toBe(false);
  });

  it('is deterministic for a given state', () => {
    const g = playedSetup(12);
    const a = must(applyAction(g, { type: 'ROLL_DICE', player: 0 }));
    const b = must(applyAction(g, { type: 'ROLL_DICE', player: 0 }));
    expect(a.dice).toEqual(b.dice);
  });

  it('distributes resources for matching hexes; cities produce double', () => {
    let g = playedSetup(13);
    const { dice, total } = productiveRoll(g);
    const before = g.players.map((p) => ({ ...p.resources }));
    const expected = computeProduction(g, total).gains;
    const after = must(applyDiceResult(g, 0, dice));
    after.players.forEach((p, i) => {
      for (const r of Object.keys(p.resources) as (keyof typeof p.resources)[]) {
        expect(p.resources[r]).toBe(before[i][r] + expected[i][r]);
      }
    });
    expect(after.phase).toBe('main');

    // upgrade every settlement to a city: production doubles
    g = deepClone(g);
    for (const b of Object.values(g.buildings)) b.kind = 'city';
    const doubled = computeProduction(g, total).gains;
    doubled.forEach((d, i) => expect(totalCards(d)).toBe(totalCards(expected[i]) * 2));
  });

  it('the robber blocks production on its hex', () => {
    const g = playedSetup(14);
    const { total } = productiveRoll(g);
    const hex = computeProduction(g, total).hexes[0];
    const blocked = { ...deepClone(g), robberHex: hex };
    const prod = computeProduction(blocked, total);
    expect(prod.hexes).not.toContain(hex);
    expect(prod.blockedHexes).toContain(hex);
  });

  it('applies the bank shortage rule', () => {
    const g = deepClone(playedSetup(15));
    // two players on the same productive hex
    const hex = g.board.hexes.find((h) => h.resource && h.token)!;
    g.buildings = { [hex.vertices[0]]: { owner: 0, kind: 'settlement' }, [hex.vertices[3]]: { owner: 1, kind: 'settlement' } };
    g.robberHex = g.board.hexes.find((h) => h.terrain === 'desert')!.id;
    g.bank[hex.resource!] = 1;
    const prod = computeProduction(g, hex.token!);
    expect(prod.gains[0][hex.resource!]).toBe(0);
    expect(prod.gains[1][hex.resource!]).toBe(0);
    expect(prod.shortages).toContain(hex.resource);

    // a single recipient takes whatever is left
    delete g.buildings[hex.vertices[3]];
    g.buildings[hex.vertices[0]] = { owner: 0, kind: 'city' };
    expect(computeProduction(g, hex.token!).gains[0][hex.resource!]).toBe(1);
  });
});

describe('rolling a 7', () => {
  it('forces discards, robber movement and a steal', () => {
    let g = playedSetup(21);
    g = setHand(g, 1, { wood: 4, brick: 3, ore: 3 }); // 10 cards → discard 5
    g = setHand(g, 2, { grain: 7 }); // exactly 7 → safe
    g = must(applyDiceResult(g, 0, [3, 4]));
    expect(g.phase).toBe('discard');
    expect(g.pendingDiscards).toEqual({ 1: 5 });

    expect(applyAction(g, { type: 'DISCARD', player: 2, resources: { grain: 3 } }).ok).toBe(false);
    expect(applyAction(g, { type: 'DISCARD', player: 1, resources: { wood: 4 } }).ok).toBe(false); // too few
    expect(applyAction(g, { type: 'DISCARD', player: 1, resources: { grain: 5 } }).ok).toBe(false); // doesn't have
    expect(applyAction(g, { type: 'MOVE_ROBBER', player: 0, hex: 0 }).ok).toBe(false); // discards first
    g = must(applyAction(g, { type: 'DISCARD', player: 1, resources: { wood: 4, ore: 1 } }));
    expect(totalCards(g.players[1].resources)).toBe(5);
    expect(g.phase).toBe('moveRobber');

    expect(applyAction(g, { type: 'MOVE_ROBBER', player: 0, hex: g.robberHex }).ok).toBe(false);
    // move to a hex next to player 1 (who has cards)
    const target = g.board.hexes.find(
      (h) => h.id !== g.robberHex && h.vertices.some((v) => g.buildings[v]?.owner === 1),
    )!;
    const victims = robberCandidates(g, 0, target.id);
    expect(victims).toContain(1);
    const before = totalCards(g.players[0].resources);
    g = must(applyAction(g, { type: 'MOVE_ROBBER', player: 0, hex: target.id }));
    if (victims.length > 1) {
      expect(g.phase).toBe('steal');
      expect(applyAction(g, { type: 'STEAL', player: 0, victim: 3 === victims[0] ? 99 : 0 }).ok).toBe(false);
      g = must(applyAction(g, { type: 'STEAL', player: 0, victim: 1 }));
    }
    expect(g.phase).toBe('main');
    expect(g.robberHex).toBe(target.id);
    expect(totalCards(g.players[0].resources)).toBe(before + 1);
    expect(totalResources(g)).toBe(95);
  });

  it('skips discarding when nobody holds more than 7 cards', () => {
    const g = must(applyDiceResult(playedSetup(22), 0, [1, 6]));
    expect(g.phase).toBe('moveRobber');
  });
});

describe('building', () => {
  it('requires a roll, the right resources and a connected spot for roads', () => {
    let g = playedSetup(31);
    const spot = validRoadSpots(g, 0)[0];
    expect(applyAction(g, { type: 'BUILD_ROAD', player: 0, edge: spot }).ok).toBe(false); // must roll first
    g = must(applyDiceResult(g, 0, [1, 1]));
    g = setHand(g, 0, {});
    expect(applyAction(g, { type: 'BUILD_ROAD', player: 0, edge: spot }).ok).toBe(false); // no resources
    g = setHand(g, 0, { wood: 2, brick: 2 });
    const disconnected = g.board.edges.find((e) => g.roads[e.id] === undefined && !validRoadSpots(g, 0).includes(e.id))!;
    expect(applyAction(g, { type: 'BUILD_ROAD', player: 0, edge: disconnected.id }).ok).toBe(false);
    expect(applyAction(g, { type: 'BUILD_ROAD', player: 1, edge: spot }).ok).toBe(false); // out of turn
    const bankWood = g.bank.wood;
    g = must(applyAction(g, { type: 'BUILD_ROAD', player: 0, edge: spot }));
    expect(g.roads[spot]).toBe(0);
    expect(g.players[0].resources).toMatchObject({ wood: 1, brick: 1 });
    expect(g.bank.wood).toBe(bankWood + 1);
    expect(g.players[0].roadsLeft).toBe(12);
  });

  it("opponent settlements break a road network", () => {
    const g = deepClone(must(applyDiceResult(playedSetup(32), 0, [1, 1])));
    // player 0 road from vertex A to B; opponent settlement on B → cannot extend past B
    const e0 = Number(Object.entries(g.roads).find(([, o]) => o === 0)![0]);
    const [a, b] = g.board.edges[e0].vertices;
    const far = g.buildings[a]?.owner === 0 ? b : a;
    g.buildings = Object.fromEntries(Object.entries(g.buildings).filter(([v]) => Number(v) !== far));
    g.buildings[far] = { owner: 1, kind: 'settlement' };
    const beyond = g.board.vertices[far].edges.filter((e) => e !== e0 && g.roads[e] === undefined);
    for (const e of beyond) {
      const other = g.board.edges[e].vertices.find((v) => v !== far)!;
      const ownNearby = g.board.vertices[other].edges.some((x) => x !== e && g.roads[x] === 0) || g.buildings[other]?.owner === 0;
      if (!ownNearby) expect(validRoadSpots(g, 0)).not.toContain(e);
    }
  });

  it('settlements need an own road and respect the distance rule', () => {
    let g = must(applyDiceResult(playedSetup(33), 0, [1, 1]));
    g = setHand(g, 0, { wood: 3, brick: 3, wool: 1, grain: 1 });
    expect(validSettlementSpots(g, 0)).toEqual([]); // setup roads only reach distance-blocked corners
    // extend: road, road → then a valid corner appears
    for (let i = 0; i < 2; i++) {
      const spots = validRoadSpots(g, 0);
      const pick = spots.find((e) => {
        const tryG = must(applyAction(g, { type: 'BUILD_ROAD', player: 0, edge: e }));
        return validSettlementSpots(tryG, 0).length > 0 || i === 0;
      })!;
      g = must(applyAction(g, { type: 'BUILD_ROAD', player: 0, edge: pick }));
    }
    const spots = validSettlementSpots(g, 0);
    expect(spots.length).toBeGreaterThan(0);
    const unconnected = g.board.vertices.find((v) => !spots.includes(v.id) && g.buildings[v.id] === undefined)!;
    expect(applyAction(g, { type: 'BUILD_SETTLEMENT', player: 0, vertex: unconnected.id }).ok).toBe(false);
    g = must(applyAction(g, { type: 'BUILD_SETTLEMENT', player: 0, vertex: spots[0] }));
    expect(publicVictoryPoints(g, 0)).toBe(3);
    expect(g.players[0].settlementsLeft).toBe(2);
  });

  it('cities upgrade own settlements and return the settlement piece', () => {
    let g = must(applyDiceResult(playedSetup(34), 0, [1, 1]));
    g = setHand(g, 0, { grain: 2, ore: 3 });
    const mine = validCitySpots(g, 0);
    expect(mine).toHaveLength(2);
    const theirs = Number(Object.entries(g.buildings).find(([, b]) => b.owner === 1)![0]);
    expect(applyAction(g, { type: 'BUILD_CITY', player: 0, vertex: theirs }).ok).toBe(false);
    g = must(applyAction(g, { type: 'BUILD_CITY', player: 0, vertex: mine[0] }));
    expect(g.buildings[mine[0]].kind).toBe('city');
    expect(g.players[0].settlementsLeft).toBe(4);
    expect(g.players[0].citiesLeft).toBe(3);
    expect(publicVictoryPoints(g, 0)).toBe(3);
    expect(applyAction(g, { type: 'BUILD_CITY', player: 0, vertex: mine[0] }).ok).toBe(false);
  });
});

describe('turns and victory', () => {
  it('ending a turn requires a roll and passes play clockwise', () => {
    let g = playedSetup(41);
    expect(applyAction(g, { type: 'END_TURN', player: 0 }).ok).toBe(false);
    g = must(applyDiceResult(g, 0, [2, 2]));
    g = must(applyAction(g, { type: 'END_TURN', player: 0 }));
    expect(g.currentPlayer).toBe(1);
    expect(g.phase).toBe('roll');
    expect(g.turn).toBe(2);
  });

  it('a player reaching 10 VP on their turn wins immediately', () => {
    let g = deepClone(must(applyDiceResult(playedSetup(42), 0, [2, 2])));
    // give player 0: 4 cities (8 VP) + their 2nd settlement upgrade pending → 9 VP before building
    const own = Object.entries(g.buildings).filter(([, b]) => b.owner === 0).map(([v]) => Number(v));
    g.buildings[own[0]] = { owner: 0, kind: 'city' };
    const free = g.board.vertices.filter((v) => g.buildings[v.id] === undefined).slice(0, 30);
    let placed = 0;
    for (const v of free) {
      if (placed === 3) break;
      if (v.neighbors.some((n) => g.buildings[n]) ) continue;
      g.buildings[v.id] = { owner: 0, kind: 'city' };
      placed++;
    }
    expect(publicVictoryPoints(g, 0)).toBe(9);
    g.players[0].citiesLeft = 1;
    g = setHand(g, 0, { grain: 2, ore: 3 });
    g = must(applyAction(g, { type: 'BUILD_CITY', player: 0, vertex: own[1] }));
    expect(g.phase).toBe('gameOver');
    expect(g.winner).toBe(0);
    expect(applyAction(g, { type: 'END_TURN', player: 0 }).ok).toBe(false);
  });
});

describe('official victory timing', () => {
  it('points reached off-turn are claimed at the start of your own turn', () => {
    let g = deepClone(must(applyDiceResult(playedSetup(43), 0, [2, 2])));
    // Player 1 is handed 10 VP while it is player 0's turn (e.g. a Longest Road swing in Phase 3)
    g.longestRoadHolder = 1;
    const own = Object.entries(g.buildings).filter(([, b]) => b.owner === 1).map(([v]) => Number(v));
    for (const v of own) g.buildings[v] = { owner: 1, kind: 'city' }; // 4 VP
    g.players[1].devCards = ['victoryPoint', 'victoryPoint', 'victoryPoint', 'victoryPoint']; // +4, +2 LR = 10
    expect(g.phase).toBe('main'); // no win on someone else's turn
    g = must(applyAction(g, { type: 'END_TURN', player: 0 }));
    expect(g.phase).toBe('gameOver');
    expect(g.winner).toBe(1);
  });
});
