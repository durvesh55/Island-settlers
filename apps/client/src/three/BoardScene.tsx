import { useEffect, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Html, OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as engine from '@island/engine';
import { desertHex, pipCount, type Board, type GameState } from '@island/engine';
import { RESOURCE_LABEL, TERRAIN_LABEL } from '../lib/colors';
import { RESOURCE_IMG } from '../lib/resourceArt';
import { useGameStore } from '../store/useGameStore';
import { Harbors } from './Harbors';
import { HexTile } from './HexTile';
import { Dice3D } from './Dice3D';
import { Hotspots } from './Hotspots';
import { Pieces } from './Pieces';
import { Robber } from './Robber';
import { Tabletop } from './Tabletop';
import { boardExtent, PIECE_BASE, TILE_TOP } from './shared';

function HexTooltip({ board }: { board: Board }) {
  const hoveredHex = useGameStore((s) => s.hoveredHex);
  const showProb = useGameStore((s) => s.settings.showProbabilities);
  if (hoveredHex === null) return null;
  const hex = board.hexes[hoveredHex];
  if (!hex) return null;
  const pips = hex.token ? pipCount(hex.token) : 0;
  return (
    <Html position={[hex.x, TILE_TOP + 0.9, hex.y]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
      <div className="whitespace-nowrap rounded-lg border border-gold-600/60 bg-wood-900/90 px-3 py-2 font-body text-sm text-parchment-100 shadow-panel backdrop-blur">
        <div className="flex items-center gap-2 font-display text-base text-gold-300">
          {hex.resource && <img src={RESOURCE_IMG[hex.resource]} alt="" className="h-5 w-5" />}
          {TERRAIN_LABEL[hex.terrain]}
        </div>
        <div className="text-parchment-200/90">
          {hex.resource ? `Produces ${RESOURCE_LABEL[hex.resource]}` : 'Produces nothing'}
          {hex.token !== null && ` on a ${hex.token}`}
        </div>
        {showProb && hex.token !== null && (
          <div className="text-xs text-parchment-300/80">
            Rolled {pips}/36 times · {((pips / 36) * 100).toFixed(1)}%
          </div>
        )}
      </div>
    </Html>
  );
}

type Vec3 = [number, number, number];
const BASE_CAMERA: Record<'menu' | 'game', { position: Vec3; target: Vec3; fov: number }> = {
  game: { position: [0.55, 14.2, 11.6], target: [0.55, 0, 0.75], fov: 36 },
  menu: { position: [0, 12.5, 13.5], target: [0, 0, 0.6], fov: 40 },
};

function Controls({ variant, board }: { variant: 'menu' | 'game'; board: Board }) {
  const ref = useRef<OrbitControlsImpl>(null);
  const resetSeq = useGameStore((s) => s.cameraResetSeq);
  const autoRotate = useGameStore((s) => s.settings.autoRotateMenu);
  const { camera, size, scene } = useThree();
  const game = variant === 'game';
  const base = game ? BASE_CAMERA.game : BASE_CAMERA.menu;

  // Fit the island to the viewport width (portrait phones need the camera further back).
  useEffect(() => {
    const controls = ref.current;
    if (!controls || !(camera instanceof THREE.PerspectiveCamera)) return;
    const target = new THREE.Vector3(...base.target);
    const offset = new THREE.Vector3(...base.position).sub(target);
    const aspect = size.width / Math.max(1, size.height);
    const halfTan = Math.tan(THREE.MathUtils.degToRad(base.fov / 2));
    // the island's width plus room for harbors, frame and HUD; the 30-hex island is also much deeper
    const ext = boardExtent(board);
    const needed = (ext.maxX - ext.minX + (game ? 3.84 : 5.34)) / (2 * aspect * halfTan);
    const neededDeep = (ext.maxY - ext.minY) / (board.size === 'large' ? 0.62 : 0.7) / (2 * halfTan);
    const dist = Math.max(offset.length(), needed, neededDeep);
    camera.position.copy(target).add(offset.setLength(dist));
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.near = dist + 6;
      scene.fog.far = dist + 30;
    }
    controls.target.copy(target);
    controls.update();
    controls.saveState();
  }, [camera, scene, size.width, size.height, base, game, board]);

  useEffect(() => {
    if (resetSeq > 0) ref.current?.reset();
  }, [resetSeq]);

  return (
    <OrbitControls
      ref={ref}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      enablePan={game}
      enableZoom={game}
      enableRotate={game}
      minDistance={6}
      maxDistance={60}
      minPolarAngle={0.15}
      maxPolarAngle={1.18}
      autoRotate={!game && autoRotate}
      autoRotateSpeed={0.35}
      zoomSpeed={0.8}
    />
  );
}

/** Dev-only: lets automated browser tests find on-screen positions of corners and edges. */
function DevProbe({ board }: { board: Board }) {
  const { camera, size } = useThree();
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const project = (x: number, y: number) => {
      const p = new THREE.Vector3(x, PIECE_BASE, y).project(camera);
      return { x: ((p.x + 1) / 2) * size.width, y: ((1 - p.y) / 2) * size.height };
    };
    (window as unknown as Record<string, unknown>).__islandProbe = {
      vertex: (id: number) => project(board.vertices[id].x, board.vertices[id].y),
      edge: (id: number) => project(board.edges[id].x, board.edges[id].y),
      hex: (id: number) => project(board.hexes[id].x, board.hexes[id].y),
      engine,
      store: useGameStore,
    };
  }, [board, camera, size]);
  return null;
}

interface SceneProps {
  board: Board;
  game?: GameState | null;
  variant: 'menu' | 'game';
}

export function BoardCanvas({ board, game = null, variant }: SceneProps) {
  const shadows = useGameStore((s) => s.settings.shadows);
  const setHoveredHex = useGameStore((s) => s.setHoveredHex);
  const interactive = variant === 'game';
  const robberHex = game ? board.hexes[game.robberHex] : desertHex(board);
  const camera = interactive ? BASE_CAMERA.game : BASE_CAMERA.menu;
  const shadowHalf = board.size === 'large' ? 13 : 9;

  return (
    <Canvas
      shadows={shadows ? 'soft' : false}
      dpr={[1, 2]}
      camera={camera}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onPointerMissed={() => setHoveredHex(null)}
    >
      <color attach="background" args={['#1b1008']} />
      <fog attach="fog" args={['#1b1008', 24, 46]} />
      <ambientLight intensity={0.35} color="#ffe0b5" />
      <hemisphereLight args={['#fff1d6', '#3b2412', 0.7]} />
      <directionalLight
        position={[-6, 13, 7]}
        intensity={2.4}
        color="#ffdcaa"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-shadowHalf}
        shadow-camera-right={shadowHalf}
        shadow-camera-top={shadowHalf}
        shadow-camera-bottom={-shadowHalf}
        shadow-camera-near={1}
        shadow-camera-far={35}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      />
      <Tabletop board={board} />
      {board.hexes.map((h) => (
        <HexTile key={`${board.seed}-${h.id}`} hex={h} seed={board.seed} interactive={interactive} introDelay={0.15 + h.id * 0.035} />
      ))}
      <Harbors board={board} />
      <Robber hex={robberHex} />
      {game && <Pieces game={game} />}
      {game && interactive && <Hotspots game={game} />}
      {game && interactive && <Dice3D lastDice={game.dice} />}
      {interactive && <HexTooltip board={board} />}
      <Controls variant={variant} board={board} />
      {interactive && <DevProbe board={board} />}
    </Canvas>
  );
}
