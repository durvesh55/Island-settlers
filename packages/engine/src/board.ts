import { BOARD_RULES, TERRAIN_RESOURCE, TERRAINS, type BoardSize, type Terrain } from './constants';
import { axialDistance, axialToPixel, hexCorner, hexesInRadius, SQRT3, type Axial } from './hex';
import { Rng } from './rng';
import type { Board, Edge, Harbor, HexTile, Vertex } from './types';

const BOARD_RADIUS = 2;
/** Gaps (in coastal edges) between consecutive harbors: 9 harbors over 30 coastal edges. */
const HARBOR_GAPS = [3, 3, 4, 3, 3, 4, 3, 3, 4];
/** The 5–6 player island: rows of 3, 4, 5, 6, 5, 4 and 3 hexes (30 in all). */
const LARGE_ROWS = [3, 4, 5, 6, 5, 4, 3];

function expandTerrains(size: BoardSize): Terrain[] {
  return TERRAINS.flatMap((t) => Array<Terrain>(BOARD_RULES[size].terrains[t]).fill(t));
}

/** Axial coordinates (sorted row by row) and the x shift that centres the island on the table. */
function layout(size: BoardSize): { coords: Axial[]; shiftX: number } {
  if (size === 'standard') {
    return { coords: hexesInRadius(BOARD_RADIUS).sort((a, b) => a.r - b.r || a.q - b.q), shiftX: 0 };
  }
  const coords: Axial[] = [];
  const mid = (LARGE_ROWS.length - 1) / 2;
  LARGE_ROWS.forEach((width, row) => {
    const r = row - mid;
    // choose the first q so every row is centred on the same x (half a hex right of the origin)
    const q0 = 0.5 - r / 2 - (width - 1) / 2;
    for (let j = 0; j < width; j++) coords.push({ q: q0 + j, r });
  });
  return { coords, shiftX: SQRT3 * 0.5 };
}

function isHighNumber(n: number | null): boolean {
  return n === 6 || n === 8;
}

/** Assign tokens so that no two red numbers (6/8) are adjacent. */
function assignTokens(hexes: HexTile[], rng: Rng, tokenPool: readonly number[]): void {
  const productive = hexes.filter((h) => h.terrain !== 'desert');
  for (let attempt = 0; attempt < 20000; attempt++) {
    const tokens = rng.shuffle(tokenPool);
    productive.forEach((h, i) => (h.token = tokens[i]));
    const valid = productive.every(
      (a) =>
        !isHighNumber(a.token) ||
        productive.every((b) => a === b || axialDistance(a, b) !== 1 || !isHighNumber(b.token)),
    );
    if (valid) return;
  }
  throw new Error('Unable to place number tokens');
}

function buildGraph(hexes: HexTile[]): { vertices: Vertex[]; edges: Edge[] } {
  const vertices: Vertex[] = [];
  const edges: Edge[] = [];
  const vertexByKey = new Map<string, number>();
  const edgeByKey = new Map<string, number>();

  for (const hex of hexes) {
    for (let i = 0; i < 6; i++) {
      const c = hexCorner(hex, 1, i);
      const key = `${Math.round(c.x * 1000)},${Math.round(c.y * 1000)}`;
      let id = vertexByKey.get(key);
      if (id === undefined) {
        id = vertices.length;
        vertexByKey.set(key, id);
        vertices.push({ id, x: c.x, y: c.y, hexes: [], edges: [], neighbors: [], harbor: null });
      }
      vertices[id].hexes.push(hex.id);
      hex.vertices.push(id);
    }
  }

  for (const hex of hexes) {
    for (let i = 0; i < 6; i++) {
      const a = hex.vertices[i];
      const b = hex.vertices[(i + 1) % 6];
      const [lo, hi] = a < b ? [a, b] : [b, a];
      const key = `${lo}-${hi}`;
      let id = edgeByKey.get(key);
      if (id === undefined) {
        id = edges.length;
        edgeByKey.set(key, id);
        const va = vertices[lo];
        const vb = vertices[hi];
        edges.push({
          id,
          vertices: [lo, hi],
          hexes: [],
          x: (va.x + vb.x) / 2,
          y: (va.y + vb.y) / 2,
          angle: Math.atan2(vb.y - va.y, vb.x - va.x),
        });
        va.edges.push(id);
        vb.edges.push(id);
        va.neighbors.push(hi);
        vb.neighbors.push(lo);
      }
      edges[id].hexes.push(hex.id);
      hex.edges.push(id);
    }
  }
  return { vertices, edges };
}

/** Walk the coastline in order: each coastal vertex has exactly two coastal edges. */
function orderedCoast(edges: Edge[], vertices: Vertex[]): Edge[] {
  const coastal = edges.filter((e) => e.hexes.length === 1);
  const isCoastal = new Set(coastal.map((e) => e.id));
  const ordered: Edge[] = [coastal[0]];
  const used = new Set([coastal[0].id]);
  let at = coastal[0].vertices[1];
  while (ordered.length < coastal.length) {
    const nextId = vertices[at].edges.find((e) => isCoastal.has(e) && !used.has(e));
    if (nextId === undefined) throw new Error('Coastline is not a closed loop');
    const next = edges[nextId];
    ordered.push(next);
    used.add(next.id);
    at = next.vertices[0] === at ? next.vertices[1] : next.vertices[0];
  }
  return ordered;
}

/** Spread `count` harbors around a coastline of `length` edges, as evenly as whole edges allow. */
function harborGaps(count: number, length: number, size: BoardSize): number[] {
  if (size === 'standard') return HARBOR_GAPS;
  return Array.from({ length: count }, (_, i) => Math.floor(((i + 1) * length) / count) - Math.floor((i * length) / count));
}

function placeHarbors(hexes: HexTile[], edges: Edge[], vertices: Vertex[], rng: Rng, size: BoardSize): Harbor[] {
  const coast = orderedCoast(edges, vertices);
  const types = rng.shuffle(BOARD_RULES[size].harbors);
  const gaps = harborGaps(types.length, coast.length, size);
  let pos = rng.int(coast.length);
  return types.map((type, id) => {
    const edge = coast[pos % coast.length];
    pos += gaps[id];
    const hex = hexes[edge.hexes[0]];
    const dx = edge.x - hex.x;
    const dy = edge.y - hex.y;
    const len = Math.hypot(dx, dy);
    for (const v of edge.vertices) vertices[v].harbor = id;
    return {
      id,
      type,
      ratio: type === 'any' ? 3 : 2,
      edge: edge.id,
      vertices: edge.vertices,
      x: edge.x,
      y: edge.y,
      nx: dx / len,
      ny: dy / len,
    };
  });
}

/** Procedurally generate a full, valid island from a seed: 19 hexes, or 30 for the 5–6 player extension. */
export function generateBoard(seed: number, size: BoardSize = 'standard'): Board {
  const rng = new Rng(seed);
  const { coords, shiftX } = layout(size);
  const terrains = rng.shuffle(expandTerrains(size));

  const hexes: HexTile[] = coords.map((c, id) => {
    const p = axialToPixel(c);
    p.x -= shiftX;
    const terrain = terrains[id];
    return {
      id,
      q: c.q,
      r: c.r,
      x: p.x,
      y: p.y,
      terrain,
      resource: TERRAIN_RESOURCE[terrain],
      token: null,
      vertices: [],
      edges: [],
    };
  });

  assignTokens(hexes, rng, BOARD_RULES[size].tokens);
  const { vertices, edges } = buildGraph(hexes);
  const harbors = placeHarbors(hexes, edges, vertices, rng, size);
  return { seed, size, hexes, vertices, edges, harbors };
}

/** The robber starts on a desert (the first one on a board that has two). */
export function desertHex(board: Board): HexTile {
  const desert = board.hexes.find((h) => h.terrain === 'desert');
  if (!desert) throw new Error('Board has no desert');
  return desert;
}
