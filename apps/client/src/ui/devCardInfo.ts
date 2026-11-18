import type { DevCardType } from '@island/engine';

export const DEV_CARD_INFO: Record<DevCardType, { name: string; glyph: string; text: string }> = {
  knight: {
    name: 'Knight',
    glyph: '⚔️',
    text: 'Move the robber and steal 1 resource from a player next to its new hex. Counts toward Largest Army.',
  },
  roadBuilding: { name: 'Road Building', glyph: '🛤️', text: 'Place 2 roads for free, following normal road rules.' },
  yearOfPlenty: { name: 'Year of Plenty', glyph: '🌾', text: 'Take any 2 resources from the bank.' },
  monopoly: { name: 'Monopoly', glyph: '👑', text: 'Name a resource. Every other player gives you all of that resource.' },
  victoryPoint: { name: 'Victory Point', glyph: '🏛️', text: 'Worth 1 hidden victory point. Kept secret until you win.' },
};
