import { describe, expect, it } from 'vitest';
import { axialDistance, generateBoard, NUMBER_TOKENS, TERRAIN_COUNTS, TERRAINS } from '../src';

const SEEDS = [1, 42, 1337, 2024, 99999, 123456789];

describe('generateBoard', () => {
  it.each(SEEDS)('produces a valid island (seed %i)', (seed) => {
    const board = generateBoard(seed);
    expect(board.hexes).toHaveLength(19);
    expect(board.vertices).toHaveLength(54);
    expect(board.edges).toHaveLength(72);
    expect(board.harbors).toHaveLength(9);

    for (const t of TERRAINS) {
      expect(board.hexes.filter((h) => h.terrain === t)).toHaveLength(TERRAIN_COUNTS[t]);
    }

    const tokens = board.hexes.map((h) => h.token).filter((t): t is number => t !== null);
    expect([...tokens].sort((a, b) => a - b)).toEqual([...NUMBER_TOKENS].sort((a, b) => a - b));
    expect(board.hexes.find((h) => h.terrain === 'desert')!.token).toBeNull();
  });

  it.each(SEEDS)('never places 6 and 8 next to each other (seed %i)', (seed) => {
    const board = generateBoard(seed);
    const red = board.hexes.filter((h) => h.token === 6 || h.token === 8);
    for (const a of red) for (const b of red) if (a !== b) expect(axialDistance(a, b)).not.toBe(1);
  });

  it('builds a consistent vertex/edge graph', () => {
    const board = generateBoard(7);
    for (const v of board.vertices) {
      expect(v.hexes.length).toBeGreaterThanOrEqual(1);
      expect(v.hexes.length).toBeLessThanOrEqual(3);
      expect(v.neighbors.length).toBe(v.edges.length);
      expect(v.edges.length === 2 || v.edges.length === 3).toBe(true);
    }
    for (const e of board.edges) {
      const [a, b] = e.vertices;
      expect(board.vertices[a].neighbors).toContain(b);
      const len = Math.hypot(board.vertices[a].x - board.vertices[b].x, board.vertices[a].y - board.vertices[b].y);
      expect(len).toBeCloseTo(1, 5);
    }
    expect(board.edges.filter((e) => e.hexes.length === 1)).toHaveLength(30);
  });

  it('places harbors on distinct coastal edges without sharing corners', () => {
    const board = generateBoard(31337);
    const corners = board.harbors.flatMap((h) => h.vertices);
    expect(new Set(corners).size).toBe(18);
    for (const h of board.harbors) {
      expect(board.edges[h.edge].hexes).toHaveLength(1);
      expect(h.ratio).toBe(h.type === 'any' ? 3 : 2);
    }
    expect(board.harbors.filter((h) => h.type === 'any')).toHaveLength(4);
  });

  it('is deterministic for a given seed', () => {
    expect(generateBoard(5)).toEqual(generateBoard(5));
    expect(generateBoard(5)).not.toEqual(generateBoard(6));
  });
});
