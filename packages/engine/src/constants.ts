export const RESOURCES = ['wood', 'brick', 'wool', 'grain', 'ore'] as const;
export type Resource = (typeof RESOURCES)[number];

export const TERRAINS = ['forest', 'hills', 'pasture', 'fields', 'mountains', 'desert'] as const;
export type Terrain = (typeof TERRAINS)[number];

export type HarborType = Resource | 'any';

export const DEV_CARD_TYPES = ['knight', 'roadBuilding', 'yearOfPlenty', 'monopoly', 'victoryPoint'] as const;
export type DevCardType = (typeof DEV_CARD_TYPES)[number];

export const PLAYER_COLORS = ['red', 'blue', 'yellow', 'green'] as const;
export type PlayerColor = (typeof PLAYER_COLORS)[number];

export const TERRAIN_RESOURCE: Record<Terrain, Resource | null> = {
  forest: 'wood',
  hills: 'brick',
  pasture: 'wool',
  fields: 'grain',
  mountains: 'ore',
  desert: null,
};

/** Standard 19-hex island distribution. */
export const TERRAIN_COUNTS: Record<Terrain, number> = {
  forest: 4,
  hills: 3,
  mountains: 3,
  fields: 4,
  pasture: 4,
  desert: 1,
};

/** 18 number tokens (2–12, no 7). */
export const NUMBER_TOKENS: readonly number[] = [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12];

/** 4 generic 3:1 harbors and one 2:1 harbor per resource. */
export const HARBOR_TYPES: readonly HarborType[] = ['any', 'any', 'any', 'any', 'wood', 'brick', 'wool', 'grain', 'ore'];

export type BuildKind = 'road' | 'settlement' | 'city' | 'devCard';

export const BUILD_COSTS: Record<BuildKind, Partial<Record<Resource, number>>> = {
  road: { wood: 1, brick: 1 },
  settlement: { wood: 1, brick: 1, wool: 1, grain: 1 },
  city: { grain: 2, ore: 3 },
  devCard: { wool: 1, grain: 1, ore: 1 },
};

export const PIECE_LIMITS = { roads: 15, settlements: 5, cities: 4 } as const;

export const BANK_RESOURCE_COUNT = 19;
export const VICTORY_POINTS_TO_WIN = 10;
export const BANK_TRADE_RATIO = 4;

export const DEV_DECK_COUNTS: Record<DevCardType, number> = {
  knight: 14,
  roadBuilding: 2,
  yearOfPlenty: 2,
  monopoly: 2,
  victoryPoint: 5,
};

/** Computer opponent difficulty. */
export const AI_LEVELS = ['easy', 'normal', 'hard'] as const;
export type AILevel = (typeof AI_LEVELS)[number];

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 4;

/** Number of dice combinations (out of 36) that produce a given total. */
export function pipCount(n: number): number {
  if (n < 2 || n > 12 || n === 7) return 0;
  return 6 - Math.abs(7 - n);
}
