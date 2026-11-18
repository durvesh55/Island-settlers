import {
  HARBOR_TYPES,
  NUMBER_TOKENS,
  TERRAIN_COUNTS,
  TERRAIN_RESOURCE,
  TERRAINS,
  type Terrain,
} from './constants';
import { axialDistance, axialToPixel, hexCorner, hexesInRadius } from './hex';
import { Rng } from './rng';
import type { Board, Edge, Harbor, HexTile, Vertex } from './types';

const BOARD_RADIUS = 2;
/** Gaps (in coastal edges) between consecutive harbors: 9 harbors over 30 coastal edges. */
const HARBOR_GAPS = [3, 3, 4, 3, 3, 4, 3, 3, 4];

function expandTerrains(): Terrain[] {
  return TERRAINS.flatMap((t) => Array<Terrain>(TERRAIN_COUNTS[t]).fill(t));
}

function isHighNumber(n: number | null): boolean {
  return n === 6 || n === 8;
}

/** Assign tokens so that no two red numbers (6/8) are adjacent. */
function assignTokens(hexes: HexTile[], rng: Rng): void {
  const productive = hexes.filter((h) => h.terrain !== 'desert');
  for (let attempt = 0; attempt < 2000; attempt++) {
    const tokens = rng.shuffle(NUMBER_TOKENS);
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

function placeHarbors(hexes: HexTile[], edges: Edge[], vertices: Vertex[], rng: Rng): Harbor[] {
  const coast = orderedCoast(edges, vertices);
  const types = rng.shuffle(HARBOR_TYPES);
  let pos = rng.int(coast.length);
  return types.map((type, id) => {
    const edge = coast[pos % coast.length];
    pos += HARBOR_GAPS[id];
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

/** Procedurally generate a full, valid 19-hex island from a seed. */
export function generateBoard(seed: number): Board {
  const rng = new Rng(seed);
  const coords = hexesInRadius(BOARD_RADIUS).sort((a, b) => a.r - b.r || a.q - b.q);
  const terrains = rng.shuffle(expandTerrains());

  const hexes: HexTile[] = coords.map((c, id) => {
    const p = axialToPixel(c);
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

  assignTokens(hexes, rng);
  const { vertices, edges } = buildGraph(hexes);
  const harbors = placeHarbors(hexes, edges, vertices, rng);
  return { seed, hexes, vertices, edges, harbors };
}

export function desertHex(board: Board): HexTile {
  const desert = board.hexes.find((h) => h.terrain === 'desert');
  if (!desert) throw new Error('Board has no desert');
  return desert;
}
