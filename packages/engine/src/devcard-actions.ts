import { BUILD_COSTS, RESOURCE_NAME, RESOURCES, type DevCardType, type Resource } from './constants';
import type { ActionResult, GameEvent } from './action-types';
import { checkWin, fail, payCost } from './action-utils';
import { updateLargestArmy } from './awards';
import { validRoadSpots } from './placement';
import { canAfford } from './resources';
import { addLog, cloneState } from './state-utils';
import type { GameState } from './types';

const CARD_NAME: Record<DevCardType, string> = {
  knight: 'Knight',
  roadBuilding: 'Road Building',
  yearOfPlenty: 'Year of Plenty',
  monopoly: 'Monopoly',
  victoryPoint: 'Victory Point',
};

export function buyDevCard(state: GameState, player: number): ActionResult {
  if (state.phase === 'roll') return fail('Roll the dice first');
  if (state.phase !== 'main') return fail('You cannot buy a development card right now');
  if (state.devDeck.length === 0) return fail('The development card deck is empty');
  if (!canAfford(state.players[player].resources, BUILD_COSTS.devCard)) return fail('A development card costs 1 wool, 1 wheat and 1 ore');
  const s = cloneState(state);
  payCost(s, player, 'devCard');
  const card = s.devDeck.pop()!;
  s.players[player].newDevCards.push(card);
  addLog(s, `${s.players[player].name} bought a development card.`, player);
  const events: GameEvent[] = [{ type: 'devCardBought', player, card }];
  // A Victory Point card counts immediately — it may win the game on the turn it is bought.
  checkWin(s, events);
  return { ok: true, state: s, events };
}

/**
 * Shared checks for playing a card (rulebook p.5, 7): one per turn, any time during your own turn
 * (even before rolling), never a card bought this turn, and never in the middle of another step.
 * Returns a cloned state with the card removed from hand.
 */
function beginPlay(state: GameState, player: number, card: DevCardType): GameState | string {
  if (state.phase !== 'roll' && state.phase !== 'main') return 'Finish the current step before playing a card';
  if (state.devCardPlayedThisTurn) return 'You may only play one development card per turn';
  const p = state.players[player];
  if (!p.devCards.includes(card)) {
    return p.newDevCards.includes(card) ? 'You cannot play a card on the turn you bought it' : `You don't have a ${CARD_NAME[card]} card`;
  }
  const s = cloneState(state);
  const hand = s.players[player].devCards;
  hand.splice(hand.indexOf(card), 1);
  s.devCardPlayedThisTurn = true;
  s.tradeOffer = null;
  addLog(s, `${p.name} played ${CARD_NAME[card]}.`, player);
  return s;
}

export function playKnight(state: GameState, player: number): ActionResult {
  const s = beginPlay(state, player, 'knight');
  if (typeof s === 'string') return fail(s);
  s.players[player].knightsPlayed++;
  const events: GameEvent[] = [{ type: 'devCardPlayed', player, card: 'knight' }];
  updateLargestArmy(s, player, events);
  s.resumePhase = state.phase === 'roll' ? 'roll' : 'main';
  s.phase = 'moveRobber';
  checkWin(s, events);
  return { ok: true, state: s, events };
}

export function playRoadBuilding(state: GameState, player: number): ActionResult {
  if (state.players[player].roadsLeft === 0) return fail('You have no roads left to place');
  if (validRoadSpots(state, player).length === 0) return fail('There is nowhere to build a road');
  const s = beginPlay(state, player, 'roadBuilding');
  if (typeof s === 'string') return fail(s);
  s.freeRoads = Math.min(2, s.players[player].roadsLeft);
  s.resumePhase = state.phase === 'roll' ? 'roll' : 'main';
  s.phase = 'roadBuilding';
  return { ok: true, state: s, events: [{ type: 'devCardPlayed', player, card: 'roadBuilding' }] };
}

export function playYearOfPlenty(state: GameState, player: number, resources: [Resource, Resource]): ActionResult {
  if (!Array.isArray(resources) || resources.length !== 2 || !resources.every((r) => RESOURCES.includes(r))) {
    return fail('Choose two resources');
  }
  const need: Partial<Record<Resource, number>> = {};
  for (const r of resources) need[r] = (need[r] ?? 0) + 1;
  for (const r of RESOURCES) if ((need[r] ?? 0) > state.bank[r]) return fail(`The supply doesn't have enough ${RESOURCE_NAME[r]}`);
  const s = beginPlay(state, player, 'yearOfPlenty');
  if (typeof s === 'string') return fail(s);
  for (const r of resources) {
    s.bank[r]--;
    s.players[player].resources[r]++;
  }
  addLog(s, `${s.players[player].name} took ${resources.map((r) => RESOURCE_NAME[r]).join(' and ')} from the supply.`, player);
  return {
    ok: true,
    state: s,
    events: [
      { type: 'devCardPlayed', player, card: 'yearOfPlenty' },
      { type: 'yearOfPlenty', player, resources },
    ],
  };
}

export function playMonopoly(state: GameState, player: number, resource: Resource): ActionResult {
  if (!RESOURCES.includes(resource)) return fail('Choose a resource');
  const s = beginPlay(state, player, 'monopoly');
  if (typeof s === 'string') return fail(s);
  const taken = s.players.map((p) => {
    if (p.id === player) return 0;
    const n = p.resources[resource];
    p.resources[resource] = 0;
    return n;
  });
  const total = taken.reduce((a, b) => a + b, 0);
  s.players[player].resources[resource] += total;
  addLog(s, `${s.players[player].name} claimed every ${RESOURCE_NAME[resource]} — ${total} card${total === 1 ? '' : 's'}.`, player);
  return {
    ok: true,
    state: s,
    events: [
      { type: 'devCardPlayed', player, card: 'monopoly' },
      { type: 'monopoly', player, resource, taken },
    ],
  };
}
