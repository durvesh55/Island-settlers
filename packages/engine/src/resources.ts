import { RESOURCES, type Resource } from './constants';
import type { ResourceBundle } from './types';

export function emptyBundle(fill = 0): ResourceBundle {
  return { wood: fill, brick: fill, wool: fill, grain: fill, ore: fill };
}

export function totalCards(bundle: Partial<ResourceBundle>): number {
  return RESOURCES.reduce((sum, r) => sum + (bundle[r] ?? 0), 0);
}

export function canAfford(have: ResourceBundle, cost: Partial<Record<Resource, number>>): boolean {
  return RESOURCES.every((r) => have[r] >= (cost[r] ?? 0));
}

export function addBundle(a: ResourceBundle, b: Partial<ResourceBundle>): ResourceBundle {
  const out = { ...a };
  for (const r of RESOURCES) out[r] += b[r] ?? 0;
  return out;
}

export function subtractBundle(a: ResourceBundle, b: Partial<ResourceBundle>): ResourceBundle {
  const out = { ...a };
  for (const r of RESOURCES) {
    out[r] -= b[r] ?? 0;
    if (out[r] < 0) throw new Error(`Insufficient ${r}`);
  }
  return out;
}
