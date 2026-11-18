import { describe, expect, it } from 'vitest';
import {
  applyAction,
  createGame,
  publicVictoryPoints,
  totalCards,
  tradeRatios,
  validSetupRoadSpots,
  validSetupSettlementSpots,
  type GameState,
  type PlayerConfig,
} from '../src';

const players: PlayerConfig[] = [
  { name: 'Ana', color: 'red', avatar: 0, isAI: false },
  { name: 'Ben', color: 'blue', avatar: 1, isAI: false },
  { name: 'Cleo', color: 'yellow', avatar: 2, isAI: false },
  { name: 'Dev', color: 'green', avatar: 3, isAI: false },
];

function must(result: ReturnType<typeof applyAction>): GameState {
  if (!result.ok) throw new Error(result.error);
  return result.state;
}

describe('createGame', () => {
  it('rejects invalid configurations', () => {
    expect(() => createGame({ players: players.slice(0, 2) })).toThrow();
    expect(() => createGame({ players: [players[0], players[0], players[1]] })).toThrow();
  });

  it('starts in setup with full piece supply and a 25-card dev deck', () => {
    const g = createGame({ players, firstPlayer: 0, seed: 1 });
    expect(g.phase).toBe('setup');
    expect(g.setup!.order).toEqual([0, 1, 2, 3, 3, 2, 1, 0]);
    expect(g.devDeck).toHaveLength(25);
    expect(g.board.hexes[g.robberHex].terrain).toBe('desert');
  });
});

describe('setup phase', () => {
  it('rejects out-of-turn and out-of-order actions', () => {
    const g = createGame({ players, firstPlayer: 0, seed: 2 });
    expect(applyAction(g, { type: 'PLACE_SETUP_SETTLEMENT', player: 1, vertex: 0 }).ok).toBe(false);
    expect(applyAction(g, { type: 'PLACE_SETUP_ROAD', player: 0, edge: 0 }).ok).toBe(false);
  });

  it('enforces the distance rule', () => {
    let g = createGame({ players, firstPlayer: 0, seed: 3 });
    g = must(applyAction(g, { type: 'PLACE_SETUP_SETTLEMENT', player: 0, vertex: 10 }));
    const road = validSetupRoadSpots(g)[0];
    g = must(applyAction(g, { type: 'PLACE_SETUP_ROAD', player: 0, edge: road }));
    const neighbor = g.board.vertices[10].neighbors[0];
    const r = applyAction(g, { type: 'PLACE_SETUP_SETTLEMENT', player: 1, vertex: neighbor });
    expect(r.ok).toBe(false);
    expect(validSetupSettlementSpots(g)).not.toContain(neighbor);
    expect(validSetupSettlementSpots(g)).not.toContain(10);
  });

  it('requires the setup road to touch the new settlement', () => {
    let g = createGame({ players, firstPlayer: 0, seed: 4 });
    g = must(applyAction(g, { type: 'PLACE_SETUP_SETTLEMENT', player: 0, vertex: 20 }));
    const far = g.board.edges.find((e) => !e.vertices.includes(20))!;
    expect(applyAction(g, { type: 'PLACE_SETUP_ROAD', player: 0, edge: far.id }).ok).toBe(false);
  });

  it('runs a full snake-order setup and grants resources for the second settlement', () => {
    let g = createGame({ players, firstPlayer: 0, seed: 5 });
    const order: number[] = [];
    const second: Record<number, number> = {};
    while (g.phase === 'setup') {
      const p = g.currentPlayer;
      order.push(p);
      const spot = validSetupSettlementSpots(g)[0];
      if (g.setup!.index >= 4) second[p] = spot;
      g = must(applyAction(g, { type: 'PLACE_SETUP_SETTLEMENT', player: p, vertex: spot }));
      g = must(applyAction(g, { type: 'PLACE_SETUP_ROAD', player: p, edge: validSetupRoadSpots(g)[0] }));
    }
    expect(order).toEqual([0, 1, 2, 3, 3, 2, 1, 0]);
    expect(g.phase).toBe('roll');
    expect(g.currentPlayer).toBe(0);
    for (const p of g.players) {
      const expected = g.board.vertices[second[p.id]].hexes.filter((h) => g.board.hexes[h].resource).length;
      expect(totalCards(p.resources)).toBe(expected);
      expect(publicVictoryPoints(g, p.id)).toBe(2);
      expect(p.settlementsLeft).toBe(3);
      expect(p.roadsLeft).toBe(13);
      expect(Object.values(tradeRatios(g, p.id)).every((r) => r >= 2 && r <= 4)).toBe(true);
    }
    const bankTotal = totalCards(g.bank) + g.players.reduce((s, p) => s + totalCards(p.resources), 0);
    expect(bankTotal).toBe(95);
  });
});

describe('opening roll-off (official rule: highest roll starts)', () => {
  it('picks a starting seat deterministically and keeps clockwise seating', () => {
    const starts = new Set<number>();
    for (let seed = 1; seed <= 40; seed++) {
      const g = createGame({ players, seed });
      expect(createGame({ players, seed }).currentPlayer).toBe(g.currentPlayer); // deterministic
      const f = g.currentPlayer;
      const n = players.length;
      const forward = [0, 1, 2, 3].map((i) => (f + i) % n);
      expect(g.setup!.order).toEqual([...forward, ...[...forward].reverse()]);
      expect(g.log.some((l) => l.text.includes('rolled highest'))).toBe(true);
      starts.add(f);
    }
    expect(starts.size).toBeGreaterThan(1); // not always the same seat
  });

  it('the starting player places last in round two and takes the first turn', () => {
    let g = createGame({ players, seed: 9, firstPlayer: 2 });
    const placers: number[] = [];
    while (g.phase === 'setup') {
      const p = g.currentPlayer;
      placers.push(p);
      g = must(applyAction(g, { type: 'PLACE_SETUP_SETTLEMENT', player: p, vertex: validSetupSettlementSpots(g)[0] }));
      g = must(applyAction(g, { type: 'PLACE_SETUP_ROAD', player: p, edge: validSetupRoadSpots(g)[0] }));
    }
    expect(placers).toEqual([2, 3, 0, 1, 1, 0, 3, 2]);
    expect(g.currentPlayer).toBe(2);
  });
});
