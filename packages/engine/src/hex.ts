/**
 * Axial hex coordinates for a pointy-top layout.
 * Reference: https://www.redblobgames.com/grids/hexagons/
 * Board space: x to the right, y "down" the table (maps to world z in 3D).
 */
export interface Axial {
  q: number;
  r: number;
}

export interface Point {
  x: number;
  y: number;
}

export const SQRT3 = Math.sqrt(3);

export const AXIAL_DIRECTIONS: readonly Axial[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

export function axialKey(h: Axial): string {
  return `${h.q},${h.r}`;
}

export function axialDistance(a: Axial, b: Axial): number {
  return (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;
}

export function axialNeighbors(h: Axial): Axial[] {
  return AXIAL_DIRECTIONS.map((d) => ({ q: h.q + d.q, r: h.r + d.r }));
}

/** All hexes within `radius` steps of the origin (radius 2 → 19 hexes). */
export function hexesInRadius(radius: number): Axial[] {
  const out: Axial[] = [];
  for (let q = -radius; q <= radius; q++) {
    for (let r = Math.max(-radius, -q - radius); r <= Math.min(radius, -q + radius); r++) {
      out.push({ q, r });
    }
  }
  return out;
}

export function axialToPixel(h: Axial, size = 1): Point {
  return { x: size * SQRT3 * (h.q + h.r / 2), y: size * 1.5 * h.r };
}

/** Corner i (0..5) of a pointy-top hex. Corners sit at -30°, 30°, 90°, ... */
export function hexCorner(center: Point, size: number, i: number): Point {
  const angle = (Math.PI / 180) * (60 * i - 30);
  return { x: center.x + size * Math.cos(angle), y: center.y + size * Math.sin(angle) };
}
