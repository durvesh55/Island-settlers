import { useMemo } from 'react';
import { Billboard } from '@react-three/drei';
import * as THREE from 'three';
import type { Board, Harbor } from '@island/engine';
import { harborSignTexture } from '../lib/textures';
import { stdMat } from './shared';

const plankMat = stdMat('#9a6b3c', { roughness: 0.85 });
const postMat = stdMat('#5e3d1f', { roughness: 0.9 });
const postGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.2, 6);
const signGeo = new THREE.PlaneGeometry(0.42, 0.525);
const signPostGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.42, 6).translate(0, 0.21, 0);

function Pier({ harbor, board }: { harbor: Harbor; board: Board }) {
  const angle = Math.atan2(harbor.ny, harbor.nx);
  const signMat = useMemo(
    () => new THREE.MeshStandardMaterial({ map: harborSignTexture(harbor.type, harbor.ratio), roughness: 0.8, side: THREE.DoubleSide }),
    [harbor.type, harbor.ratio],
  );
  const end = { x: harbor.x + harbor.nx * 0.62, z: harbor.y + harbor.ny * 0.62 };
  // short gangways from each harbor corner to the pier, showing which corners can trade
  const gangways = harbor.vertices.map((vid) => {
    const v = board.vertices[vid];
    const tx = harbor.x + harbor.nx * 0.42;
    const tz = harbor.y + harbor.ny * 0.42;
    const len = Math.hypot(tx - v.x, tz - v.y);
    return { x: (tx + v.x) / 2, z: (tz + v.y) / 2, len, rot: -Math.atan2(tz - v.y, tx - v.x) };
  });
  return (
    <group>
      {/* main pier */}
      <mesh
        position={[harbor.x + harbor.nx * 0.5, 0.1, harbor.y + harbor.ny * 0.5]}
        rotation-y={-angle}
        material={plankMat}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[0.5, 0.025, 0.2]} />
      </mesh>
      {gangways.map((g, i) => (
        <mesh key={i} position={[g.x, 0.12, g.z]} rotation-y={g.rot} material={plankMat} castShadow receiveShadow>
          <boxGeometry args={[g.len, 0.02, 0.06]} />
        </mesh>
      ))}
      {[-0.08, 0.08].map((off) => (
        <mesh
          key={off}
          geometry={postGeo}
          material={postMat}
          position={[end.x - harbor.ny * off, 0.07, end.z + harbor.nx * off]}
          castShadow
        />
      ))}
      <group position={[harbor.x + harbor.nx * 0.95, 0.03, harbor.y + harbor.ny * 0.95]}>
        <mesh geometry={signPostGeo} material={postMat} castShadow />
        <Billboard position={[0, 0.5, 0]} lockX lockZ>
          <mesh geometry={signGeo} material={signMat} castShadow />
        </Billboard>
      </group>
    </group>
  );
}

export function Harbors({ board }: { board: Board }) {
  return (
    <>
      {board.harbors.map((h) => (
        <Pier key={`${board.seed}-${h.id}`} harbor={h} board={board} />
      ))}
    </>
  );
}
