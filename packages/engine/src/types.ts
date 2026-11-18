import type { AILevel, DevCardType, HarborType, PlayerColor, Resource, Terrain } from './constants';

export type ResourceBundle = Record<Resource, number>;

export interface HexTile {
  id: number;
  q: number;
  r: number;
  /** Center in board space (hex circumradius = 1). */
  x: number;
  y: number;
  terrain: Terrain;
  resource: Resource | null;
  /** Number token, or null for the desert. */
  token: number | null;
  /** Corner vertex ids, in corner order 0..5. */
  vertices: number[];
  /** Side edge ids; edges[i] joins vertices[i] and vertices[(i+1) % 6]. */
  edges: number[];
}

export interface Vertex {
  id: number;
  x: number;
  y: number;
  hexes: number[];
  edges: number[];
  neighbors: number[];
  /** Index into board.harbors if this corner touches a harbor. */
  harbor: number | null;
}

export interface Edge {
  id: number;
  vertices: [number, number];
  hexes: number[];
  /** Midpoint in board space. */
  x: number;
  y: number;
  /** Direction of the edge in radians (board space). */
  angle: number;
}

export interface Harbor {
  id: number;
  type: HarborType;
  ratio: 2 | 3;
  edge: number;
  vertices: [number, number];
  /** Edge midpoint. */
  x: number;
  y: number;
  /** Outward unit normal (towards the sea). */
  nx: number;
  ny: number;
}

export interface Board {
  seed: number;
  hexes: HexTile[];
  vertices: Vertex[];
  edges: Edge[];
  harbors: Harbor[];
}

export type BuildingKind = 'settlement' | 'city';

export interface Building {
  owner: number;
  kind: BuildingKind;
}

export interface Player {
  id: number;
  name: string;
  color: PlayerColor;
  avatar: number;
  isAI: boolean;
  /** Difficulty of a computer player (ignored for humans). */
  aiLevel?: AILevel;
  resources: ResourceBundle;
  /** Playable development cards. */
  devCards: DevCardType[];
  /** Cards bought this turn (not yet playable). */
  newDevCards: DevCardType[];
  knightsPlayed: number;
  /** Set only in a redacted online view of another player: their hidden hand size. */
  handCount?: number;
  /** Set only in a redacted online view of another player: their hidden development card count. */
  devCardCount?: number;
  roadsLeft: number;
  settlementsLeft: number;
  citiesLeft: number;
}

/**
 * setup      – initial snake-order placement
 * roll       – current player must roll
 * discard    – a 7 was rolled; players holding > 7 cards must discard half
 * moveRobber – current player must move the robber
 * steal      – current player picks whom to rob (only when more than one candidate)
 * main       – build / (trade, dev cards in Phase 3) / end turn
 * gameOver   – someone reached the victory threshold
 */
export type Phase = 'setup' | 'roll' | 'discard' | 'moveRobber' | 'steal' | 'roadBuilding' | 'main' | 'gameOver';

/** A player-to-player offer from the current player: they give `give` and receive `want`. */
export interface TradeOffer {
  id: number;
  from: number;
  give: ResourceBundle;
  want: ResourceBundle;
  /** Other players' answers. Missing = not answered yet. */
  responses: Record<number, 'accepted' | 'declined'>;
}

export interface SetupState {
  /** Snake order, e.g. [0,1,2,3,3,2,1,0]. */
  order: number[];
  index: number;
  step: 'settlement' | 'road';
  lastSettlement: number | null;
}

export interface LogEntry {
  id: number;
  text: string;
  player: number | null;
}

export interface GameState {
  version: 3;
  board: Board;
  players: Player[];
  currentPlayer: number;
  phase: Phase;
  setup: SetupState | null;
  /** vertexId → building */
  buildings: Record<number, Building>;
  /** edgeId → owner */
  roads: Record<number, number>;
  robberHex: number;
  bank: ResourceBundle;
  devDeck: DevCardType[];
  dice: [number, number] | null;
  /** player → number of cards they still have to discard (phase 'discard'). */
  pendingDiscards: Record<number, number>;
  /** Players the current player may rob (phase 'steal'). */
  robberVictims: number[];
  /** Phase to return to after a knight's robber move or Road Building ('roll' if played before rolling). */
  resumePhase: 'roll' | 'main';
  /** Free roads still to place from a Road Building card (phase 'roadBuilding'). */
  freeRoads: number;
  /** Only one development card may be played per turn. */
  devCardPlayedThisTurn: boolean;
  tradeOffer: TradeOffer | null;
  tradeSeq: number;
  turn: number;
  rngState: number;
  log: LogEntry[];
  winner: number | null;
  longestRoadHolder: number | null;
  largestArmyHolder: number | null;
  /** Set only in a redacted online view: the seat this view was made for. */
  viewer?: number;
}
