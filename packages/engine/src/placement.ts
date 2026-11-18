import type { GameState } from './types';

export function isVertexOccupied(state: GameState, vertex: number): boolean {
  return state.buildings[vertex] !== undefined;
}

/** Distance rule: the corner and all adjacent corners must be empty. */
export function satisfiesDistanceRule(state: GameState, vertex: number): boolean {
  const v = state.board.vertices[vertex];
  if (!v) return false;
  return !isVertexOccupied(state, vertex) && v.neighbors.every((n) => !isVertexOccupied(state, n));
}

export function validSetupSettlementSpots(state: GameState): number[] {
  if (state.phase !== 'setup' || state.setup?.step !== 'settlement') return [];
  return state.board.vertices.filter((v) => satisfiesDistanceRule(state, v.id)).map((v) => v.id);
}

/** During setup, the road must touch the settlement that was just placed. */
export function validSetupRoadSpots(state: GameState): number[] {
  const setup = state.setup;
  if (state.phase !== 'setup' || setup?.step !== 'road' || setup.lastSettlement === null) return [];
  return state.board.vertices[setup.lastSettlement].edges.filter((e) => state.roads[e] === undefined);
}

/**
 * A road may be built on an empty edge that connects to the player's own building,
 * or to the player's own road — unless an opponent's building sits on the joining corner
 * (opponent settlements break road networks).
 */
export function canBuildRoadAt(state: GameState, player: number, edge: number): boolean {
  const e = state.board.edges[edge];
  if (!e || state.roads[edge] !== undefined) return false;
  return e.vertices.some((vid) => {
    const b = state.buildings[vid];
    if (b) return b.owner === player;
    return state.board.vertices[vid].edges.some((other) => other !== edge && state.roads[other] === player);
  });
}

/** A turn-time settlement must obey the distance rule and touch one of the player's roads. */
export function canBuildSettlementAt(state: GameState, player: number, vertex: number): boolean {
  const v = state.board.vertices[vertex];
  if (!v || !satisfiesDistanceRule(state, vertex)) return false;
  return v.edges.some((e) => state.roads[e] === player);
}

export function canBuildCityAt(state: GameState, player: number, vertex: number): boolean {
  const b = state.buildings[vertex];
  return !!b && b.owner === player && b.kind === 'settlement';
}

export function validRoadSpots(state: GameState, player: number): number[] {
  return state.board.edges.filter((e) => canBuildRoadAt(state, player, e.id)).map((e) => e.id);
}

export function validSettlementSpots(state: GameState, player: number): number[] {
  return state.board.vertices.filter((v) => canBuildSettlementAt(state, player, v.id)).map((v) => v.id);
}

export function validCitySpots(state: GameState, player: number): number[] {
  return state.board.vertices.filter((v) => canBuildCityAt(state, player, v.id)).map((v) => v.id);
}
