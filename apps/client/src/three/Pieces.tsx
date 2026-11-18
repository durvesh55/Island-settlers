import { memo, useMemo } from 'react';
import * as THREE from 'three';
import type { Board, GameState, PlayerColor } from '@island/engine';
import { PLAYER_PALETTE } from '../lib/colors';
import { DropIn, PIECE_BASE } from './shared';

function houseGeometry(w: number, wallH: number, roofH: number, depth: number): THREE.ExtrudeGeometry {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2, 0);
  s.lineTo(w / 2, wallH);
  s.lineTo(0, wallH + roofH);
  s.lineTo(-w / 2, wallH);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.008,
    bevelSegments: 2,
  });
  g.translate(0, 0.008, -depth / 2);
  return g;
}

export const PIECE_GEOMETRY = {
  settlement: houseGeometry(0.23, 0.13, 0.11, 0.19),
  cityHall: houseGeometry(0.3, 0.14, 0.1, 0.2),
  cityTower: new THREE.BoxGeometry(0.13, 0.29, 0.13).translate(0, 0.145 + 0.004, 0),
  cityRoof: new THREE.ConeGeometry(0.11, 0.13, 4).rotateY(Math.PI / 4).translate(0, 0.29 + 0.065 + 0.004, 0),
  road: new THREE.BoxGeometry(0.6, 0.08, 0.1).translate(0, 0.04, 0),
};

const pieceMats = new Map<string, THREE.MeshStandardMaterial>();
export function pieceMaterial(color: PlayerColor, ghost = false): THREE.MeshStandardMaterial {
  const key = `${color}-${ghost}`;
  let m = pieceMats.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color: PLAYER_PALETTE[color].piece,
      roughness: 0.5,
      metalness: 0.02,
      transparent: ghost,
      opacity: ghost ? 0.55 : 1,
      depthWrite: !ghost,
    });
    pieceMats.set(key, m);
  }
  return m;
}

export function SettlementModel({ color, ghost = false }: { color: PlayerColor; ghost?: boolean }) {
  return <mesh geometry={PIECE_GEOMETRY.settlement} material={pieceMaterial(color, ghost)} castShadow={!ghost} receiveShadow />;
}

export function CityModel({ color, ghost = false }: { color: PlayerColor; ghost?: boolean }) {
  const mat = pieceMaterial(color, ghost);
  return (
    <group>
      <mesh geometry={PIECE_GEOMETRY.cityHall} material={mat} position={[-0.06, 0, 0]} castShadow={!ghost} receiveShadow />
      <mesh geometry={PIECE_GEOMETRY.cityTower} material={mat} position={[0.14, 0, 0]} castShadow={!ghost} receiveShadow />
      <mesh geometry={PIECE_GEOMETRY.cityRoof} material={mat} position={[0.14, 0, 0]} castShadow={!ghost} />
    </group>
  );
}

export function RoadModel({ color, ghost = false }: { color: PlayerColor; ghost?: boolean }) {
  return <mesh geometry={PIECE_GEOMETRY.road} material={pieceMaterial(color, ghost)} castShadow={!ghost} receiveShadow />;
}

/** Stable, natural-looking orientation for a building on a given corner. */
export function vertexRotation(board: Board, vertex: number): number {
  const v = board.vertices[vertex];
  // face away from the island centre with slight variation
  return -Math.atan2(v.y, v.x) + Math.PI / 2 + ((vertex * 37) % 7) * 0.08;
}

export const Pieces = memo(function Pieces({ game }: { game: GameState }) {
  const { board, players } = game;
  const roads = useMemo(() => Object.entries(game.roads).map(([e, owner]) => ({ edge: Number(e), owner })), [game.roads]);
  const buildings = useMemo(
    () => Object.entries(game.buildings).map(([v, b]) => ({ vertex: Number(v), ...b })),
    [game.buildings],
  );
  return (
    <>
      {roads.map(({ edge, owner }) => {
        const e = board.edges[edge];
        return (
          <group key={`r${edge}`} position={[e.x, PIECE_BASE, e.y]} rotation-y={-e.angle}>
            <DropIn height={1}>
              <RoadModel color={players[owner].color} />
            </DropIn>
          </group>
        );
      })}
      {buildings.map(({ vertex, owner, kind }) => {
        const v = board.vertices[vertex];
        return (
          <group key={`b${vertex}-${kind}`} position={[v.x, PIECE_BASE, v.y]} rotation-y={vertexRotation(board, vertex)}>
            <DropIn>
              {kind === 'city' ? <CityModel color={players[owner].color} /> : <SettlementModel color={players[owner].color} />}
            </DropIn>
          </group>
        );
      })}
    </>
  );
});
