import type { PlayerColor, Resource, Terrain } from '@island/engine';

export interface PlayerPalette {
  /** Wooden piece color. */
  piece: string;
  /** UI accent (borders, glows). */
  accent: string;
  /** Panel gradient. */
  panelFrom: string;
  panelTo: string;
  label: string;
}

export const PLAYER_PALETTE: Record<PlayerColor, PlayerPalette> = {
  red: { piece: '#c62f22', accent: '#e8483a', panelFrom: '#5e1410', panelTo: '#2a0b08', label: 'Red' },
  blue: { piece: '#2a63c4', accent: '#4a8cf0', panelFrom: '#132f62', panelTo: '#0a1730', label: 'Blue' },
  yellow: { piece: '#e9b21f', accent: '#f5c842', panelFrom: '#5c4210', panelTo: '#2b1f08', label: 'Yellow' },
  green: { piece: '#2f9a3a', accent: '#4cc35a', panelFrom: '#164a1c', panelTo: '#0a240d', label: 'Green' },
  orange: { piece: '#e8761c', accent: '#ff9a45', panelFrom: '#6a3008', panelTo: '#301503', label: 'Orange' },
  purple: { piece: '#8a46c4', accent: '#b57af0', panelFrom: '#3e1a62', panelTo: '#1c0b30', label: 'Purple' },
};

export const RESOURCE_LABEL: Record<Resource, string> = {
  wood: 'Wood',
  brick: 'Brick',
  wool: 'Wool',
  grain: 'Wheat',
  ore: 'Ore',
};

export const RESOURCE_CARD_THEME: Record<Resource, { from: string; to: string; frame: string; text: string }> = {
  wood: { from: '#5d8f3a', to: '#24461a', frame: '#8fbf5a', text: '#f4f7e6' },
  brick: { from: '#c25a32', to: '#5e2312', frame: '#e3895e', text: '#fff1e6' },
  wool: { from: '#9fcf6a', to: '#3f7a2a', frame: '#cbe89a', text: '#1d3412' },
  grain: { from: '#f0c040', to: '#a86d12', frame: '#ffe08a', text: '#3d2604' },
  ore: { from: '#8d97a8', to: '#3a4150', frame: '#c4ccd8', text: '#f2f4f8' },
};

export const TERRAIN_LABEL: Record<Terrain, string> = {
  forest: 'Forest',
  hills: 'Hills',
  pasture: 'Pasture',
  fields: 'Fields',
  mountains: 'Mountains',
  desert: 'Desert',
};

/** Base ground colors for terrain tile surfaces. */
export const TERRAIN_GROUND: Record<Terrain, { base: string; speckle: string[] }> = {
  forest: { base: '#3f6b2a', speckle: ['#2f5520', '#4f7f34', '#365e24', '#5b8a3a'] },
  hills: { base: '#b45a32', speckle: ['#9a4a28', '#c96b3e', '#a5532d', '#d68250'] },
  pasture: { base: '#78b048', speckle: ['#6aa13e', '#8cc25a', '#5f9437', '#9bcf68'] },
  fields: { base: '#d9a52e', speckle: ['#c99426', '#e8b843', '#bf8a1f', '#f0c85a'] },
  mountains: { base: '#7d8088', speckle: ['#6b6e76', '#8e9199', '#5f6269', '#9a9da4'] },
  desert: { base: '#e2c58c', speckle: ['#d6b77a', '#ecd3a0', '#cfae6f', '#f2ddb0'] },
};
