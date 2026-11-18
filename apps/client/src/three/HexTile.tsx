import { memo, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { HexTile as HexTileData } from '@island/engine';
import { groundTexture, tokenTexture } from '../lib/textures';
import { useGameStore } from '../store/useGameStore';
import { TerrainDecor } from './TerrainDecor';
import { easeOutBack, stdMat, TILE_TOP } from './shared';

const baseGeo = new THREE.CylinderGeometry(0.975, 0.985, 0.16, 6);
const topGeo = new THREE.CylinderGeometry(0.885, 0.9, 0.024, 6);
const sandGeo = new THREE.CylinderGeometry(1.13, 1.2, 0.07, 6);
const shallowGeo = new THREE.CylinderGeometry(1.42, 1.42, 0.01, 6);
const tokenGeo = new THREE.CylinderGeometry(0.31, 0.31, 0.05, 40);
const tokenFaceGeo = new THREE.CircleGeometry(0.305, 40);

const frameMat = stdMat('#d9c08c', { roughness: 0.75 });
const sandMat = stdMat('#e3cc93', { roughness: 1 });
const shallowMat = new THREE.MeshStandardMaterial({ color: '#4fc0c8', roughness: 0.3, transparent: true, opacity: 0.55, depthWrite: false });
const tokenSideMat = stdMat('#c9a56c', { roughness: 0.6 });

/** Wooden number disc. The face is a separate circle so the numeral reads upright toward the player. */
function NumberToken({ value }: { value: number }) {
  const faceMat = useMemo(() => new THREE.MeshStandardMaterial({ map: tokenTexture(value), roughness: 0.55 }), [value]);
  return (
    <group position={[0, 0.03, 0]}>
      <mesh geometry={tokenGeo} material={tokenSideMat} castShadow receiveShadow />
      <mesh geometry={tokenFaceGeo} material={faceMat} rotation-x={-Math.PI / 2} position={[0, 0.0255, 0]} receiveShadow />
    </group>
  );
}

interface Props {
  hex: HexTileData;
  seed: number;
  interactive: boolean;
  introDelay: number;
}

/** One terrain tile: wooden frame, textured surface, 3D decorations and number disc. */
export const HexTile = memo(function HexTile({ hex, seed, interactive, introDelay }: Props) {
  const group = useRef<THREE.Group>(null);
  const start = useRef<number | null>(null);
  const settled = useRef(false);
  const setHoveredHex = useGameStore((s) => s.setHoveredHex);
  const hovered = useGameStore((s) => s.hoveredHex === hex.id);

  const topMat = useMemo(
    () => new THREE.MeshStandardMaterial({ map: groundTexture(hex.terrain), roughness: 0.95 }),
    [hex.terrain],
  );
  const topMats = useMemo(() => [frameMat, topMat, topMat], [topMat]);

  useFrame(({ clock }) => {
    // After a roll: producing hexes glow gold, robber-blocked hexes glow red, then fade.
    let glow = 0;
    let glowColor = '#ffe7a3';
    const pulse = useGameStore.getState().rollPulse;
    if (pulse) {
      const age = (performance.now() - pulse.at) / 1000;
      if (age < 2.4) {
        const strength = (1 - age / 2.4) * (0.8 + 0.2 * Math.sin(age * 14));
        if (pulse.hexes.includes(hex.id)) {
          glow = 0.55 * strength;
          glowColor = '#ffcf5a';
        } else if (pulse.blocked.includes(hex.id)) {
          glow = 0.5 * strength;
          glowColor = '#ff3a2a';
        }
      }
    }
    if (hovered && glow < 0.12) {
      glow = 0.12 + Math.sin(clock.elapsedTime * 5) * 0.04;
      glowColor = '#ffe7a3';
    }
    topMat.emissive.set(glow > 0 ? glowColor : '#000000');
    topMat.emissiveIntensity = glow;
    const g = group.current;
    if (!g || settled.current) return;
    if (start.current === null) start.current = clock.elapsedTime + introDelay;
    const t = Math.min(1, Math.max(0, (clock.elapsedTime - start.current) / 0.55));
    const e = easeOutBack(t);
    g.scale.setScalar(Math.max(0.0001, e));
    g.position.y = (1 - t) * 0.6;
    if (t >= 1) settled.current = true;
  });

  const onOver = (e: ThreeEvent<PointerEvent>) => {
    if (!interactive) return;
    e.stopPropagation();
    setHoveredHex(hex.id);
  };
  const onOut = () => {
    if (!interactive) return;
    if (useGameStore.getState().hoveredHex === hex.id) setHoveredHex(null);
  };

  return (
    <group position={[hex.x, 0, hex.y]}>
      <mesh geometry={shallowGeo} material={shallowMat} position={[0, 0.026, 0]} />
      <mesh geometry={sandGeo} material={sandMat} position={[0, 0.035, 0]} receiveShadow />
      <group ref={group} scale={0.0001}>
        <mesh geometry={baseGeo} material={frameMat} position={[0, 0.1, 0]} castShadow receiveShadow />
        <mesh
          geometry={topGeo}
          material={topMats}
          position={[0, TILE_TOP - 0.012 + 0.003, 0]}
          receiveShadow
          onPointerOver={onOver}
          onPointerOut={onOut}
        />
        <group position={[0, TILE_TOP, 0]}>
          <TerrainDecor terrain={hex.terrain} seed={seed * 31 + hex.id * 7919} />
          {hex.token !== null && <NumberToken value={hex.token} />}
        </group>
      </group>
    </group>
  );
});
