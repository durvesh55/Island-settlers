import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/** Height of the terrain surface. */
export const TILE_TOP = 0.2;
/** Height at which roads/settlements sit (on the tile frame border). */
export const PIECE_BASE = 0.18;
export const SEA_RADIUS = 6.35;
export const FRAME_OUTER = 6.95;

/* ───────────── Board outline (sea + frame) ───────────── */

export interface P2 {
  x: number;
  z: number;
}

/** Convex hull (counter-clockwise) of points in the x/z plane — Andrew's monotone chain. */
export function convexHull(points: P2[]): P2[] {
  const pts = [...points].sort((a, b) => a.x - b.x || a.z - b.z);
  const cross = (o: P2, a: P2, b: P2) => (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x);
  const build = (list: P2[]) => {
    const out: P2[] = [];
    for (const p of list) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], p) <= 1e-9) out.pop();
      out.push(p);
    }
    out.pop();
    return out;
  };
  return [...build(pts), ...build([...pts].reverse())];
}

/** Push every side of a convex polygon outwards by `d` (mitred corners). */
export function offsetConvex(poly: P2[], d: number): P2[] {
  const n = poly.length;
  const c = poly.reduce((a, p) => ({ x: a.x + p.x / n, z: a.z + p.z / n }), { x: 0, z: 0 });
  const normal = (a: P2, b: P2) => {
    const ex = b.x - a.x;
    const ez = b.z - a.z;
    const len = Math.hypot(ex, ez) || 1;
    let nx = ez / len;
    let nz = -ex / len;
    if (nx * ((a.x + b.x) / 2 - c.x) + nz * ((a.z + b.z) / 2 - c.z) < 0) {
      nx = -nx;
      nz = -nz;
    }
    return { x: nx, z: nz };
  };
  return poly.map((v, i) => {
    const n1 = normal(poly[(i - 1 + n) % n], v);
    const n2 = normal(v, poly[(i + 1) % n]);
    const k = d / (1 + n1.x * n2.x + n1.z * n2.z);
    return { x: v.x + (n1.x + n2.x) * k, z: v.z + (n1.z + n2.z) * k };
  });
}

export function insideConvex(poly: P2[], p: P2): boolean {
  let sign = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const cr = (b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x);
    if (Math.abs(cr) < 1e-12) continue;
    if (sign === 0) sign = Math.sign(cr);
    else if (Math.sign(cr) !== sign) return false;
  }
  return true;
}

export interface BoardExtent {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/** Bounding box of the island's corners (board space; y is the table's z axis). */
export function boardExtent(board: { vertices: { x: number; y: number }[] }): BoardExtent {
  const xs = board.vertices.map((v) => v.x);
  const ys = board.vertices.map((v) => v.y);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

export interface SeaShape {
  /** Sea surface polygon (x, z). */
  sea: P2[];
  /** Outer edge of the wooden frame. */
  frame: P2[];
  /** Island outline (convex hull of the corners). */
  hull: P2[];
  /** Size relative to the standard board's frame, for shading the water. */
  scale: number;
}

const hexOutline = (r: number): P2[] =>
  Array.from({ length: 6 }, (_, i) => ({ x: Math.cos((i * Math.PI) / 3) * r, z: Math.sin((i * Math.PI) / 3) * r }));

/** The standard 19-hex island sits in a regular hexagonal frame; the 5–6 player island gets a frame that wraps its outline. */
export function seaShape(board: { size?: string; vertices: { x: number; y: number }[] }): SeaShape {
  const hull = convexHull(board.vertices.map((v) => ({ x: v.x, z: v.y })));
  if (board.size !== 'large') return { sea: hexOutline(SEA_RADIUS + 0.05), frame: hexOutline(FRAME_OUTER), hull, scale: 1 };
  const sea = offsetConvex(hull, 1.75);
  const frame = offsetConvex(hull, 2.35);
  const radius = Math.max(...frame.map((p) => Math.hypot(p.x, p.z)));
  return { sea, frame, hull, scale: radius / FRAME_OUTER };
}

export interface InstanceItem {
  x: number;
  y: number;
  z: number;
  rx?: number;
  ry?: number;
  rz?: number;
  s?: number;
  sx?: number;
  sy?: number;
  sz?: number;
  color?: string;
}

/** Renders many copies of a mesh in one draw call. */
export function Instances({
  geometry,
  material,
  items,
  castShadow = true,
  receiveShadow = false,
}: {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  items: InstanceItem[];
  castShadow?: boolean;
  receiveShadow?: boolean;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const d = new THREE.Object3D();
    const c = new THREE.Color();
    items.forEach((it, i) => {
      d.position.set(it.x, it.y, it.z);
      d.rotation.set(it.rx ?? 0, it.ry ?? 0, it.rz ?? 0);
      d.scale.set(it.sx ?? it.s ?? 1, it.sy ?? it.s ?? 1, it.sz ?? it.s ?? 1);
      d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
      if (it.color) mesh.setColorAt(i, c.set(it.color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items]);
  if (items.length === 0) return null;
  return (
    <instancedMesh
      key={items.length}
      ref={ref}
      args={[geometry, material, items.length]}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
    />
  );
}

/** Deterministic PRNG for decoration placement. */
export function seeded(seed: number) {
  let s = (seed * 9301 + 49297) % 233280 || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const HEX_NORMALS = Array.from({ length: 6 }, (_, i) => [Math.cos((i * Math.PI) / 3), Math.sin((i * Math.PI) / 3)]);

/** Is (x,z) inside a pointy-top hexagon with the given apothem? */
export function insideHex(x: number, z: number, apothem: number): boolean {
  return HEX_NORMALS.every(([nx, nz]) => x * nx + z * nz <= apothem);
}

/** Rejection-sample points inside a hex, outside the central token area. */
export function scatterInHex(
  seed: number,
  count: number,
  { inner = 0.34, apothem = 0.74, minDist = 0.12 }: { inner?: number; apothem?: number; minDist?: number } = {},
): { x: number; z: number; r: number; s: number }[] {
  const rand = seeded(seed);
  const pts: { x: number; z: number; r: number; s: number }[] = [];
  inner = Math.max(inner, 0.42); // keep the number disc clear
  let tries = 0;
  while (pts.length < count && tries < count * 60) {
    tries++;
    const x = (rand() * 2 - 1) * apothem * 1.16;
    const z = (rand() * 2 - 1) * apothem * 1.16;
    if (Math.hypot(x, z) < inner || !insideHex(x, z, apothem)) continue;
    if (pts.some((p) => Math.hypot(p.x - x, p.z - z) < minDist)) continue;
    pts.push({ x, z, r: rand() * Math.PI * 2, s: 0.8 + rand() * 0.45 });
  }
  return pts;
}

export function easeOutBounce(t: number): number {
  const n = 7.5625;
  const d = 2.75;
  if (t < 1 / d) return n * t * t;
  if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
  if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
  return n * (t -= 2.625 / d) * t + 0.984375;
}

export function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

/** Drops its children onto the table with a little bounce when first mounted. */
export function DropIn({ children, delay = 0, height = 1.4, duration = 0.65 }: { children: ReactNode; delay?: number; height?: number; duration?: number }) {
  const ref = useRef<THREE.Group>(null);
  const start = useRef<number | null>(null);
  const done = useRef(false);
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g || done.current) return;
    if (start.current === null) start.current = clock.elapsedTime + delay;
    const raw = (clock.elapsedTime - start.current) / duration;
    g.visible = raw >= 0;
    const t = Math.min(1, Math.max(0, raw));
    g.position.y = (1 - easeOutBounce(t)) * height;
    if (t >= 1) done.current = true;
  });
  return (
    <group ref={ref} visible={false}>
      {children}
    </group>
  );
}

const materialCache = new Map<string, THREE.MeshStandardMaterial>();

export function stdMat(color: string, opts: { roughness?: number; metalness?: number; flat?: boolean } = {}): THREE.MeshStandardMaterial {
  const key = `${color}|${opts.roughness ?? 0.8}|${opts.metalness ?? 0}|${opts.flat ? 1 : 0}`;
  let m = materialCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      roughness: opts.roughness ?? 0.8,
      metalness: opts.metalness ?? 0,
      flatShading: opts.flat ?? false,
    });
    materialCache.set(key, m);
  }
  return m;
}
