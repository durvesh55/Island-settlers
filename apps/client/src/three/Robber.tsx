import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { HexTile } from '@island/engine';
import { stdMat, TILE_TOP } from './shared';

const profile = [
  [0, 0],
  [0.13, 0],
  [0.135, 0.025],
  [0.1, 0.05],
  [0.085, 0.13],
  [0.1, 0.22],
  [0.092, 0.29],
  [0.06, 0.33],
  [0, 0.34],
].map(([x, y]) => new THREE.Vector2(x, y));

const bodyGeo = new THREE.LatheGeometry(profile, 24);
const headGeo = new THREE.SphereGeometry(0.068, 20, 14);
const hoodGeo = new THREE.SphereGeometry(0.078, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.62);
const mat = stdMat('#2b2a2e', { roughness: 0.45, metalness: 0.1 });
const faceMat = stdMat('#0c0c0e', { roughness: 0.9 });

/** The robber miniature. Glides to its hex; sits beside the number disc when one is present. */
export function Robber({ hex }: { hex: HexTile }) {
  const ref = useRef<THREE.Group>(null);
  const target = new THREE.Vector3(hex.x + (hex.token !== null ? 0.42 : 0), TILE_TOP, hex.y + (hex.token !== null ? 0.18 : 0));
  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    const dist = g.position.distanceTo(target);
    g.position.lerp(target, Math.min(1, dt * 4));
    // hop while travelling
    g.position.y = TILE_TOP + Math.min(0.6, dist * 0.35);
  });
  return (
    <group ref={ref} position={target.toArray()}>
      <mesh geometry={bodyGeo} material={mat} castShadow receiveShadow />
      <mesh geometry={headGeo} material={faceMat} position={[0, 0.39, 0.012]} castShadow />
      <mesh geometry={hoodGeo} material={mat} position={[0, 0.385, -0.008]} rotation-x={-0.35} castShadow />
    </group>
  );
}
