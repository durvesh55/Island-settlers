import { controlsTurn } from '../lib/viewer';
import { useMemo, useRef, useState } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import {
  validCitySpots,
  validRoadSpots,
  validSettlementSpots,
  validSetupRoadSpots,
  validSetupSettlementSpots,
  type GameAction,
  type GameState,
  type PlayerColor,
} from '@island/engine';
import { PLAYER_PALETTE } from '../lib/colors';
import { playSound } from '../lib/sound';
import { useGameStore } from '../store/useGameStore';
import { CityModel, RoadModel, SettlementModel, vertexRotation } from './Pieces';
import { PIECE_BASE, TILE_TOP } from './shared';

const ringGeo = new THREE.RingGeometry(0.075, 0.115, 32);
const cityRingGeo = new THREE.RingGeometry(0.17, 0.22, 32);
const hexRingGeo = new THREE.RingGeometry(0.5, 0.58, 6, 1, Math.PI / 6);
const hitSphere = new THREE.SphereGeometry(0.17, 10, 8);
const cityHit = new THREE.SphereGeometry(0.24, 10, 8);
const hexHit = new THREE.CylinderGeometry(0.82, 0.82, 0.12, 6);
const edgeGeo = new THREE.BoxGeometry(0.46, 0.06, 0.11).translate(0, 0.03, 0);
const edgeHit = new THREE.BoxGeometry(0.6, 0.16, 0.2);
/** Bright cyan reads clearly on beige frames and every terrain, and matches no player color. */
const HOT = '#6ff3ff';
const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
const ghostRobberGeo = new THREE.CylinderGeometry(0.06, 0.12, 0.34, 16).translate(0, 0.17, 0);
const ghostRobberMat = new THREE.MeshStandardMaterial({ color: '#2b2a2e', transparent: true, opacity: 0.55, depthWrite: false });

/** A drag on the board (orbiting the camera) should not count as a click. */
const isRealClick = (e: ThreeEvent<MouseEvent>) => e.delta < 6;

function setCursor(pointer: boolean) {
  document.body.style.cursor = pointer ? 'pointer' : '';
}

function useHover() {
  const [hover, setHover] = useState(false);
  const handlers = (onPick: () => void) => ({
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      setHover(true);
      setCursor(true);
      playSound('hover');
    },
    onPointerOut: () => {
      setHover(false);
      setCursor(false);
    },
    onClick: (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      if (!isRealClick(e)) return;
      setCursor(false);
      onPick();
    },
  });
  return { hover, handlers };
}

function usePulseMaterial(color: string, hover: boolean, hoverColor: string, phase = 0) {
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthWrite: false, toneMapped: false }), [color]);
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const s = 1 + Math.sin(clock.elapsedTime * 4 + phase) * 0.12;
    ref.current?.scale.set(s, s, s);
    mat.color.set(hover ? hoverColor : color);
  });
  return { mat, ref };
}

function VertexSpot({ game, vertex, color, onPick }: { game: GameState; vertex: number; color: PlayerColor; onPick: () => void }) {
  const v = game.board.vertices[vertex];
  const { hover, handlers } = useHover();
  const { mat, ref } = usePulseMaterial(HOT, hover, PLAYER_PALETTE[color].accent, vertex);
  return (
    <group position={[v.x, PIECE_BASE + 0.012, v.y]}>
      <mesh ref={ref} geometry={ringGeo} material={mat} rotation-x={-Math.PI / 2} renderOrder={2} />
      <mesh geometry={hitSphere} material={hitMat} {...handlers(onPick)} />
      {hover && (
        <group rotation-y={vertexRotation(game.board, vertex)}>
          <SettlementModel color={color} ghost />
        </group>
      )}
    </group>
  );
}

function CitySpot({ game, vertex, color, onPick }: { game: GameState; vertex: number; color: PlayerColor; onPick: () => void }) {
  const v = game.board.vertices[vertex];
  const { hover, handlers } = useHover();
  const { mat, ref } = usePulseMaterial(HOT, hover, PLAYER_PALETTE[color].accent, vertex);
  return (
    <group position={[v.x, PIECE_BASE + 0.012, v.y]}>
      <mesh ref={ref} geometry={cityRingGeo} material={mat} rotation-x={-Math.PI / 2} renderOrder={2} />
      <mesh geometry={cityHit} material={hitMat} position={[0, 0.1, 0]} {...handlers(onPick)} />
      {hover && (
        <group rotation-y={vertexRotation(game.board, vertex)} position={[0, 0.02, 0]}>
          <CityModel color={color} ghost />
        </group>
      )}
    </group>
  );
}

function EdgeSpot({ game, edge, color, onPick }: { game: GameState; edge: number; color: PlayerColor; onPick: () => void }) {
  const e = game.board.edges[edge];
  const { hover, handlers } = useHover();
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: HOT, transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false }), []);
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const k = Math.sin(clock.elapsedTime * 4 + edge);
    mat.opacity = 0.7 + k * 0.25;
    ref.current?.scale.set(1, 1 + k * 0.25, 1 + k * 0.25);
  });
  return (
    <group position={[e.x, PIECE_BASE + 0.01, e.y]} rotation-y={-e.angle}>
      {!hover && <mesh ref={ref} geometry={edgeGeo} material={mat} renderOrder={2} />}
      {hover && <RoadModel color={color} ghost />}
      <mesh geometry={edgeHit} material={hitMat} {...handlers(onPick)} />
    </group>
  );
}

function RobberSpot({ game, hex, onPick }: { game: GameState; hex: number; onPick: () => void }) {
  const h = game.board.hexes[hex];
  const setHoveredHex = useGameStore((s) => s.setHoveredHex);
  const { hover, handlers } = useHover();
  const { mat, ref } = usePulseMaterial('#ff8a6a', hover, '#ff3b2a', hex);
  const base = handlers(onPick);
  return (
    <group position={[h.x, TILE_TOP + 0.08, h.y]}>
      <mesh ref={ref} geometry={hexRingGeo} material={mat} rotation-x={-Math.PI / 2} renderOrder={2} />
      <mesh
        geometry={hexHit}
        material={hitMat}
        onPointerOver={(e) => {
          base.onPointerOver(e);
          setHoveredHex(hex);
        }}
        onPointerOut={() => {
          base.onPointerOut();
          if (useGameStore.getState().hoveredHex === hex) setHoveredHex(null);
        }}
        onClick={base.onClick}
      />
      {hover && <mesh geometry={ghostRobberGeo} material={ghostRobberMat} position={[h.token !== null ? 0.42 : 0, -0.08, h.token !== null ? 0.18 : 0]} />}
    </group>
  );
}

/** Highlights every legal target for the current step, as computed by the engine. */
export function Hotspots({ game }: { game: GameState }) {
  const dispatch = useGameStore((s) => s.dispatch);
  const buildMode = useGameStore((s) => s.buildMode);
  const rolling = useGameStore((s) => s.rolling);
  const handoff = useGameStore((s) => s.handoffFor);
  const player = game.players[game.currentPlayer];
  const pid = player.id;

  const spots = useMemo(() => {
    const none = { vertices: [] as number[], edges: [] as number[], cities: [] as number[], hexes: [] as number[] };
    if (game.phase === 'setup') {
      return { ...none, vertices: validSetupSettlementSpots(game), edges: validSetupRoadSpots(game) };
    }
    if (game.phase === 'moveRobber') {
      return { ...none, hexes: game.board.hexes.filter((h) => h.id !== game.robberHex).map((h) => h.id) };
    }
    if (game.phase === 'roadBuilding') return { ...none, edges: validRoadSpots(game, pid) };
    if (game.phase === 'main' && buildMode === 'road') return { ...none, edges: validRoadSpots(game, pid) };
    if (game.phase === 'main' && buildMode === 'settlement') return { ...none, vertices: validSettlementSpots(game, pid) };
    if (game.phase === 'main' && buildMode === 'city') return { ...none, cities: validCitySpots(game, pid) };
    return none;
  }, [game, buildMode, pid]);

  if (!controlsTurn(game) || rolling || handoff !== null) return null;
  const setup = game.phase === 'setup';
  const act = (a: GameAction) => () => dispatch(a);

  return (
    <>
      {spots.vertices.map((v) => (
        <VertexSpot
          key={`v${v}`}
          game={game}
          vertex={v}
          color={player.color}
          onPick={act(setup ? { type: 'PLACE_SETUP_SETTLEMENT', player: pid, vertex: v } : { type: 'BUILD_SETTLEMENT', player: pid, vertex: v })}
        />
      ))}
      {spots.edges.map((e) => (
        <EdgeSpot
          key={`e${e}`}
          game={game}
          edge={e}
          color={player.color}
          onPick={act(setup ? { type: 'PLACE_SETUP_ROAD', player: pid, edge: e } : { type: 'BUILD_ROAD', player: pid, edge: e })}
        />
      ))}
      {spots.cities.map((v) => (
        <CitySpot key={`c${v}`} game={game} vertex={v} color={player.color} onPick={act({ type: 'BUILD_CITY', player: pid, vertex: v })} />
      ))}
      {spots.hexes.map((h) => (
        <RobberSpot key={`h${h}`} game={game} hex={h} onPick={act({ type: 'MOVE_ROBBER', player: pid, hex: h })} />
      ))}
    </>
  );
}
