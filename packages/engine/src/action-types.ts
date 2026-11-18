import type { DevCardType, Resource } from './constants';
import type { GameState, ResourceBundle } from './types';

export type GameAction =
  // setup
  | { type: 'PLACE_SETUP_SETTLEMENT'; player: number; vertex: number }
  | { type: 'PLACE_SETUP_ROAD'; player: number; edge: number }
  // dice & robber
  | { type: 'ROLL_DICE'; player: number }
  | { type: 'DISCARD'; player: number; resources: Partial<ResourceBundle> }
  | { type: 'MOVE_ROBBER'; player: number; hex: number }
  | { type: 'STEAL'; player: number; victim: number }
  // building
  | { type: 'BUILD_ROAD'; player: number; edge: number }
  | { type: 'BUILD_SETTLEMENT'; player: number; vertex: number }
  | { type: 'BUILD_CITY'; player: number; vertex: number }
  | { type: 'BUY_DEV_CARD'; player: number }
  // development cards
  | { type: 'PLAY_KNIGHT'; player: number }
  | { type: 'PLAY_ROAD_BUILDING'; player: number }
  | { type: 'PLAY_YEAR_OF_PLENTY'; player: number; resources: [Resource, Resource] }
  | { type: 'PLAY_MONOPOLY'; player: number; resource: Resource }
  // trading
  | { type: 'MARITIME_TRADE'; player: number; give: Resource; receive: Resource; amount: number }
  | { type: 'PROPOSE_TRADE'; player: number; give: Partial<ResourceBundle>; want: Partial<ResourceBundle> }
  | { type: 'RESPOND_TRADE'; player: number; accept: boolean }
  | { type: 'CONFIRM_TRADE'; player: number; partner: number }
  | { type: 'CANCEL_TRADE'; player: number }
  | { type: 'END_TURN'; player: number };

export type GameEvent =
  | { type: 'settlementPlaced'; player: number; vertex: number }
  | { type: 'roadPlaced'; player: number; edge: number }
  | { type: 'cityBuilt'; player: number; vertex: number }
  | { type: 'resourcesGained'; player: number; resources: ResourceBundle }
  | { type: 'setupComplete' }
  | { type: 'diceRolled'; player: number; dice: [number, number]; total: number }
  | { type: 'produced'; gains: ResourceBundle[]; hexes: number[]; blockedHexes: number[]; shortages: Resource[] }
  | { type: 'discardRequired'; players: Record<number, number> }
  | { type: 'discarded'; player: number; resources: ResourceBundle }
  | { type: 'robberMoved'; player: number; hex: number }
  | { type: 'stolen'; thief: number; victim: number; resource: Resource | null }
  | { type: 'devCardBought'; player: number; card: DevCardType }
  | { type: 'devCardPlayed'; player: number; card: DevCardType }
  | { type: 'yearOfPlenty'; player: number; resources: [Resource, Resource] }
  | { type: 'monopoly'; player: number; resource: Resource; taken: number[] }
  | { type: 'maritimeTrade'; player: number; give: Resource; gave: number; receive: Resource; received: number }
  | { type: 'tradeProposed'; player: number; offer: number }
  | { type: 'tradeResponded'; player: number; accept: boolean }
  | { type: 'tradeCompleted'; from: number; to: number; give: ResourceBundle; want: ResourceBundle }
  | { type: 'tradeCancelled'; player: number }
  | { type: 'longestRoadChanged'; from: number | null; to: number | null; length: number }
  | { type: 'largestArmyChanged'; from: number | null; to: number; knights: number }
  | { type: 'turnEnded'; player: number; next: number }
  | { type: 'gameWon'; player: number };

export type ActionResult =
  | { ok: true; state: GameState; events: GameEvent[] }
  | { ok: false; error: string };
