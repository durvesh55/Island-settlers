import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/** Height of the terrain surface. */
export const TILE_TOP = 0.2;
/** Height at which roads/settlements sit (on the tile frame border). */
export const PIECE_BASE = 0.18;
export const SEA_RADIUS = 6.35;
export const FRAME_OUTER = 6.95;

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
