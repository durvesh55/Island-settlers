import { RESOURCES, type Resource } from './constants';
import type { ActionResult } from './action-types';
import { describe, fail, toBundle } from './action-utils';
import { canAfford, totalCards } from './resources';
import { addLog, cloneState } from './state-utils';
import { tradeRatios } from './trading';
import type { GameState, ResourceBundle } from './types';

/** Rulebook p.14: trading happens on your own turn, after rolling. */
function tradeWindow(state: GameState): string | null {
  if (state.phase === 'roll') return 'Roll the dice before trading';
  if (state.phase !== 'main') return 'You cannot trade right now';
  return null;
}

/**
 * Maritime trade: `amount` cards of `receive` for amount × ratio cards of `give`,
 * at 4:1, or 3:1 / 2:1 with a harbor (rulebook p.9 — multiple lots allowed, e.g. 4 ore → 2 cards at 2:1).
 */
export function maritimeTrade(state: GameState, player: number, give: Resource, receive: Resource, amount: number): ActionResult {
  const err = tradeWindow(state);
  if (err) return fail(err);
  if (!RESOURCES.includes(give) || !RESOURCES.includes(receive)) return fail('Unknown resource');
  if (give === receive) return fail('You cannot trade a resource for the same resource');
  if (!Number.isInteger(amount) || amount < 1) return fail('Choose how many cards to receive');
  const ratio = tradeRatios(state, player)[give];
  const cost = ratio * amount;
  if (state.players[player].resources[give] < cost) return fail(`You need ${cost} ${give} for that trade (${ratio}:1)`);
  if (state.bank[receive] < amount) return fail(`The bank only has ${state.bank[receive]} ${receive} left`);

  const s = cloneState(state);
  const p = s.players[player];
  p.resources[give] -= cost;
  s.bank[give] += cost;
  p.resources[receive] += amount;
  s.bank[receive] -= amount;
  addLog(s, `${p.name} traded ${cost} ${give} to the bank for ${amount} ${receive} (${ratio}:1).`, player);
  return { ok: true, state: s, events: [{ type: 'maritimeTrade', player, give, gave: cost, receive, received: amount }] };
}

function validOfferBundles(give: ResourceBundle | null, want: ResourceBundle | null): string | null {
  if (!give || !want) return 'Invalid trade amounts';
  if (totalCards(give) === 0 || totalCards(want) === 0) return 'A trade must give and receive at least one card (no gifts)';
  if (RESOURCES.some((r) => give[r] > 0 && want[r] > 0)) return 'You cannot trade a resource for the same resource';
  return null;
}

export function proposeTrade(state: GameState, player: number, giveIn: Partial<ResourceBundle>, wantIn: Partial<ResourceBundle>): ActionResult {
  const err = tradeWindow(state);
  if (err) return fail(err);
  const give = toBundle(giveIn);
  const want = toBundle(wantIn);
  const bad = validOfferBundles(give, want);
  if (bad) return fail(bad);
  if (!canAfford(state.players[player].resources, give!)) return fail("You don't have the cards you are offering");

  const s = cloneState(state);
  s.tradeSeq++;
  s.tradeOffer = { id: s.tradeSeq, from: player, give: give!, want: want!, responses: {} };
  addLog(s, `${s.players[player].name} offers ${describe(give!)} for ${describe(want!)}.`, player);
  return { ok: true, state: s, events: [{ type: 'tradeProposed', player, offer: s.tradeSeq }] };
}

/** Another player accepts or declines the current offer (the only action allowed off-turn besides discarding). */
export function respondTrade(state: GameState, player: number, accept: boolean): ActionResult {
  const offer = state.tradeOffer;
  if (!offer || state.phase !== 'main') return fail('There is no trade offer to answer');
  if (player === offer.from) return fail('You cannot answer your own offer');
  if (accept && !canAfford(state.players[player].resources, offer.want)) return fail("You don't have the cards that were asked for");
  const s = cloneState(state);
  s.tradeOffer!.responses[player] = accept ? 'accepted' : 'declined';
  addLog(s, `${s.players[player].name} ${accept ? 'accepts' : 'declines'} the offer.`, player);
  return { ok: true, state: s, events: [{ type: 'tradeResponded', player, accept }] };
}

export function confirmTrade(state: GameState, player: number, partner: number): ActionResult {
  const offer = state.tradeOffer;
  if (!offer || state.phase !== 'main' || offer.from !== player) return fail('There is no offer of yours to complete');
  if (offer.responses[partner] !== 'accepted') return fail('That player has not accepted your offer');
  if (!canAfford(state.players[player].resources, offer.give)) return fail('You no longer have the cards you offered');
  if (!canAfford(state.players[partner].resources, offer.want)) return fail('They no longer have the cards you asked for');

  const s = cloneState(state);
  const a = s.players[player];
  const b = s.players[partner];
  for (const r of RESOURCES) {
    a.resources[r] += offer.want[r] - offer.give[r];
    b.resources[r] += offer.give[r] - offer.want[r];
  }
  s.tradeOffer = null;
  addLog(s, `${a.name} traded ${describe(offer.give)} with ${b.name} for ${describe(offer.want)}.`, player);
  return { ok: true, state: s, events: [{ type: 'tradeCompleted', from: player, to: partner, give: offer.give, want: offer.want }] };
}

export function cancelTrade(state: GameState, player: number): ActionResult {
  if (!state.tradeOffer || state.tradeOffer.from !== player) return fail('There is no offer to cancel');
  const s = cloneState(state);
  s.tradeOffer = null;
  return { ok: true, state: s, events: [{ type: 'tradeCancelled', player }] };
}
