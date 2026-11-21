export const RESOURCES = ['wood', 'brick', 'wool', 'grain', 'ore'] as const;
export type Resource = (typeof RESOURCES)[number];

export const TERRAINS = ['forest', 'hills', 'pasture', 'fields', 'mountains', 'desert'] as const;
export type Terrain = (typeof TERRAINS)[number];

/** Player-facing resource names (the rulebook calls grain "wheat"). */
export const RESOURCE_NAME: Record<Resource, string> = { wood: 'wood', brick: 'brick', wool: 'wool', grain: 'wheat', ore: 'ore' };

export type HarborType = Resource | 'any';

export const DEV_CARD_TYPES = ['knight', 'roadBuilding', 'yearOfPlenty', 'monopoly', 'victoryPoint'] as const;
export type DevCardType = (typeof DEV_CARD_TYPES)[number];

export const PLAYER_COLORS = ['red', 'blue', 'yellow', 'green', 'orange', 'purple'] as const;
export type PlayerColor = (typeof PLAYER_COLORS)[number];

export const TERRAIN_RESOURCE: Record<Terrain, Resource | null> = {
  forest: 'wood',
  hills: 'brick',
  pasture: 'wool',
  fields: 'grain',
  mountains: 'ore',
  desert: null,
};

/** Board sizes: the base game's 19-hex island, or the 5–6 player extension's 30-hex island. */
export type BoardSize = 'standard' | 'large';

/** Everything that differs between the base game and the 5–6 player extension (rulebooks CN3081 / CN3082). */
export interface BoardRules {
  /** Terrain hexes by type (19 in the base game, 30 with the extension). */
  terrains: Record<Terrain, number>;
  /** Number discs (2–12, no 7): 18 in the base game, 28 with the extension. */
  tokens: readonly number[];
  /** Harbors: 3:1 generic plus one 2:1 per resource (+ extra generic harbors on the large board). */
  harbors: readonly HarborType[];
  /** Resource cards per type in the supply (19, or 24 with the extension's 5 extra each). */
  supplyPerResource: number;
  /** Development card deck (25, or 34 with the extension's 9 extra cards). */
  devDeck: Record<DevCardType, number>;
}

export const BOARD_RULES: Record<BoardSize, BoardRules> = {
  standard: {
    terrains: { forest: 4, hills: 3, mountains: 3, fields: 4, pasture: 4, desert: 1 },
    tokens: [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12],
    harbors: ['any', 'any', 'any', 'any', 'wood', 'brick', 'wool', 'grain', 'ore'],
    supplyPerResource: 19,
    devDeck: { knight: 14, roadBuilding: 2, yearOfPlenty: 2, monopoly: 2, victoryPoint: 5 },
  },
  large: {
    // +2 forest, +2 hills, +2 pasture, +2 fields, +2 mountains, +1 desert
    terrains: { forest: 6, hills: 5, mountains: 5, fields: 6, pasture: 6, desert: 2 },
    // 28 discs: one more of every number than the base game's 18 (two 2s and 12s, three of the rest)
    tokens: [2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 6, 8, 8, 8, 9, 9, 9, 10, 10, 10, 11, 11, 11, 12, 12],
    harbors: ['any', 'any', 'any', 'any', 'any', 'any', 'wood', 'brick', 'wool', 'grain', 'ore'],
    supplyPerResource: 24,
    // +6 Knights, +1 Road Building, +1 Year of Plenty, +1 Monopoly
    devDeck: { knight: 20, roadBuilding: 3, yearOfPlenty: 3, monopoly: 3, victoryPoint: 5 },
  },
};

/** 3–4 players use the standard island; 5–6 players use the extension. */
export const boardSizeFor = (playerCount: number): BoardSize => (playerCount > 4 ? 'large' : 'standard');
/** The paired players rule applies to 5–6 player games. */
export const usesPairedTurns = (playerCount: number): boolean => playerCount > 4;

/** Standard island kept for backwards compatibility with older imports. */
export const TERRAIN_COUNTS: Record<Terrain, number> = BOARD_RULES.standard.terrains;
export const NUMBER_TOKENS: readonly number[] = BOARD_RULES.standard.tokens;
export const HARBOR_TYPES: readonly HarborType[] = BOARD_RULES.standard.harbors;

export type BuildKind = 'road' | 'settlement' | 'city' | 'devCard';

export const BUILD_COSTS: Record<BuildKind, Partial<Record<Resource, number>>> = {
  road: { wood: 1, brick: 1 },
  settlement: { wood: 1, brick: 1, wool: 1, grain: 1 },
  city: { grain: 2, ore: 3 },
  devCard: { wool: 1, grain: 1, ore: 1 },
};

export const PIECE_LIMITS = { roads: 15, settlements: 5, cities: 4 } as const;

export const BANK_RESOURCE_COUNT = BOARD_RULES.standard.supplyPerResource;
export const VICTORY_POINTS_TO_WIN = 10;
export const BANK_TRADE_RATIO = 4;

export const DEV_DECK_COUNTS: Record<DevCardType, number> = BOARD_RULES.standard.devDeck;

/** Computer opponent difficulty. */
export const AI_LEVELS = ['easy', 'normal', 'hard'] as const;
export type AILevel = (typeof AI_LEVELS)[number];

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 6;

/** Number of dice combinations (out of 36) that produce a given total. */
export function pipCount(n: number): number {
  if (n < 2 || n > 12 || n === 7) return 0;
  return 6 - Math.abs(7 - n);
}
