import { BUILD_COSTS, RESOURCE_NAME, RESOURCES, type Resource } from './constants';
import type { ActionResult, GameAction, GameEvent } from './action-types';
import { checkWin, describe, fail, payCost } from './action-utils';
import { updateLongestRoad } from './awards';
import { buyDevCard, playKnight, playMonopoly, playRoadBuilding, playYearOfPlenty } from './devcard-actions';
import {
  canBuildCityAt,
  canBuildRoadAt,
  canBuildSettlementAt,
  satisfiesDistanceRule,
  validRoadSpots,
  validSetupRoadSpots,
} from './placement';
import { computeProduction } from './production';
import { canAfford, emptyBundle, totalCards } from './resources';
import { addLog, cloneState, nextRandom } from './state-utils';
import { cancelTrade, confirmTrade, maritimeTrade, proposeTrade, respondTrade } from './trade-actions';
import type { GameState, ResourceBundle } from './types';

export type { ActionResult, GameAction, GameEvent } from './action-types';

/* ───────────────────────────── Setup ───────────────────────────── */

function placeSetupSettlement(state: GameState, player: number, vertex: number): ActionResult {
  const setup = state.setup;
  if (state.phase !== 'setup' || !setup) return fail('Not in the setup phase');
  if (setup.step !== 'settlement') return fail('Place a road next to your settlement first');
  if (!state.board.vertices[vertex]) return fail('That corner does not exist');
  if (!satisfiesDistanceRule(state, vertex)) {
    return fail('Settlements must be at least two roads away from any other settlement');
  }

  const s = cloneState(state);
  const p = s.players[player];
  if (p.settlementsLeft <= 0) return fail('No settlements left');
  p.settlementsLeft--;
  s.buildings[vertex] = { owner: player, kind: 'settlement' };
  s.setup = { ...setup, step: 'road', lastSettlement: vertex };
  const events: GameEvent[] = [{ type: 'settlementPlaced', player, vertex }];
  addLog(s, `${p.name} founded a settlement.`, player);

  // The second settlement yields one of each adjacent resource.
  if (setup.index >= s.players.length) {
    const gained = emptyBundle();
    for (const hexId of s.board.vertices[vertex].hexes) {
      const res = s.board.hexes[hexId].resource;
      if (res && s.bank[res] > 0) {
        s.bank[res]--;
        p.resources[res]++;
        gained[res]++;
      }
    }
    if (totalCards(gained) > 0) {
      events.push({ type: 'resourcesGained', player, resources: gained });
      addLog(s, `${p.name} received starting resources: ${describe(gained)}.`, player);
    }
  }
  return { ok: true, state: s, events };
}

function placeSetupRoad(state: GameState, player: number, edge: number): ActionResult {
  const setup = state.setup;
  if (state.phase !== 'setup' || !setup) return fail('Not in the setup phase');
  if (setup.step !== 'road') return fail('Place a settlement first');
  if (!state.board.edges[edge]) return fail('That edge does not exist');
  if (!validSetupRoadSpots(state).includes(edge)) {
    return fail('Your road must connect to the settlement you just placed');
  }

  const s = cloneState(state);
  const p = s.players[player];
  if (p.roadsLeft <= 0) return fail('No roads left');
  p.roadsLeft--;
  s.roads[edge] = player;
  const events: GameEvent[] = [{ type: 'roadPlaced', player, edge }];
  addLog(s, `${p.name} built a road.`, player);

  const nextIndex = setup.index + 1;
  if (nextIndex >= setup.order.length) {
    s.setup = null;
    s.phase = 'roll';
    s.turn = 1;
    s.currentPlayer = setup.order[0];
    s.turnLeader = setup.order[0];
    s.pairedTurn = false;
    events.push({ type: 'setupComplete' });
    addLog(s, `Setup complete. ${s.players[s.currentPlayer].name} takes the first turn.`);
  } else {
    s.setup = { ...setup, index: nextIndex, step: 'settlement', lastSettlement: null };
    s.currentPlayer = setup.order[nextIndex];
  }
  return { ok: true, state: s, events };
}

/* ───────────────────────────── Dice ───────────────────────────── */

/**
 * Resolve a specific dice result for the current player. ROLL_DICE uses this with dice
 * drawn from the game's own RNG; it is exported for deterministic tests and replays only —
 * clients must never be allowed to choose their dice.
 */
export function applyDiceResult(state: GameState, player: number, dice: [number, number]): ActionResult {
  if (state.phase !== 'roll') return fail('You cannot roll right now');
  if (player !== state.currentPlayer) return fail("It's not your turn");
  if (!dice.every((d) => Number.isInteger(d) && d >= 1 && d <= 6)) return fail('Invalid dice');
  return resolveRoll(cloneState(state), player, dice);
}

function resolveRoll(s: GameState, player: number, dice: [number, number]): ActionResult {
  const total = dice[0] + dice[1];
  s.dice = dice;
  const events: GameEvent[] = [{ type: 'diceRolled', player, dice, total }];
  addLog(s, `${s.players[player].name} rolled ${total} (${dice[0]} + ${dice[1]}).`, player);

  if (total === 7) {
    s.resumePhase = 'main';
    const pending: Record<number, number> = {};
    for (const p of s.players) {
      const n = totalCards(p.resources);
      if (n > 7) pending[p.id] = Math.floor(n / 2);
    }
    s.pendingDiscards = pending;
    if (Object.keys(pending).length > 0) {
      s.phase = 'discard';
      events.push({ type: 'discardRequired', players: pending });
      const names = Object.entries(pending).map(([id, n]) => `${s.players[Number(id)].name} (${n})`);
      addLog(s, `The robber stirs! Discarding: ${names.join(', ')}.`);
    } else {
      s.phase = 'moveRobber';
      addLog(s, 'The robber stirs! No one has to discard.');
    }
    return { ok: true, state: s, events };
  }

  const prod = computeProduction(s, total);
  prod.gains.forEach((g, pid) => {
    const p = s.players[pid];
    for (const r of RESOURCES) {
      p.resources[r] += g[r];
      s.bank[r] -= g[r];
    }
    if (totalCards(g) > 0) addLog(s, `${p.name} collected ${describe(g)}.`, pid);
  });
  if (prod.blockedHexes.length) addLog(s, 'The robber blocked production on one hex.');
  if (prod.shortages.length) addLog(s, `The supply ran short of ${prod.shortages.map((r) => RESOURCE_NAME[r]).join(', ')}.`);
  if (prod.gains.every((g) => totalCards(g) === 0)) addLog(s, 'Nothing was produced.');
  events.push({ type: 'produced', gains: prod.gains, hexes: prod.hexes, blockedHexes: prod.blockedHexes, shortages: prod.shortages });
  s.phase = 'main';
  return { ok: true, state: s, events };
}

function rollDice(state: GameState, player: number): ActionResult {
  if (state.phase !== 'roll') return fail('You cannot roll right now');
  const s = cloneState(state);
  const d1 = 1 + Math.floor(nextRandom(s) * 6);
  const d2 = 1 + Math.floor(nextRandom(s) * 6);
  return resolveRoll(s, player, [d1, d2]);
}

/* ───────────────────────────── Robber ───────────────────────────── */

function discard(state: GameState, player: number, resources: Partial<ResourceBundle>): ActionResult {
  if (state.phase !== 'discard') return fail('No one needs to discard right now');
  const required = state.pendingDiscards[player];
  if (required === undefined) return fail('You do not need to discard');
  const bundle = emptyBundle();
  for (const r of RESOURCES) {
    const n = resources[r] ?? 0;
    if (!Number.isInteger(n) || n < 0) return fail('Invalid discard amounts');
    bundle[r] = n;
  }
  if (totalCards(bundle) !== required) return fail(`You must discard exactly ${required} cards`);
  if (!canAfford(state.players[player].resources, bundle)) return fail("You don't have those cards");

  const s = cloneState(state);
  const p = s.players[player];
  for (const r of RESOURCES) {
    p.resources[r] -= bundle[r];
    s.bank[r] += bundle[r];
  }
  delete s.pendingDiscards[player];
  addLog(s, `${p.name} discarded ${required} cards.`, player);
  if (Object.keys(s.pendingDiscards).length === 0) s.phase = 'moveRobber';
  return { ok: true, state: s, events: [{ type: 'discarded', player, resources: bundle }] };
}

function stealFrom(s: GameState, thief: number, victim: number): GameEvent {
  const v = s.players[victim];
  const cards = RESOURCES.flatMap((r) => Array<Resource>(v.resources[r]).fill(r));
  let resource: Resource | null = null;
  if (cards.length > 0) {
    resource = cards[Math.floor(nextRandom(s) * cards.length)];
    v.resources[resource]--;
    s.players[thief].resources[resource]++;
  }
  addLog(s, `${s.players[thief].name} stole a card from ${v.name}.`, thief);
  s.robberVictims = [];
  s.phase = s.resumePhase; // 'roll' if a knight was played before rolling
  return { type: 'stolen', thief, victim, resource };
}

/** Opponents with a building on the hex who hold at least one card. */
export function robberCandidates(state: GameState, player: number, hex: number): number[] {
  const owners = new Set<number>();
  for (const v of state.board.hexes[hex].vertices) {
    const b = state.buildings[v];
    if (b && b.owner !== player && totalCards(state.players[b.owner].resources) > 0) owners.add(b.owner);
  }
  return [...owners].sort((a, b) => a - b);
}

function moveRobber(state: GameState, player: number, hex: number): ActionResult {
  if (state.phase !== 'moveRobber') return fail('You cannot move the robber now');
  if (!state.board.hexes[hex]) return fail('That hex does not exist');
  if (hex === state.robberHex) return fail('The robber must move to a different hex');

  const s = cloneState(state);
  s.robberHex = hex;
  const events: GameEvent[] = [{ type: 'robberMoved', player, hex }];
  addLog(s, `${s.players[player].name} moved the robber.`, player);
  const victims = robberCandidates(s, player, hex);
  if (victims.length === 0) {
    s.phase = s.resumePhase;
  } else if (victims.length === 1) {
    events.push(stealFrom(s, player, victims[0]));
  } else {
    s.phase = 'steal';
    s.robberVictims = victims;
  }
  return { ok: true, state: s, events };
}

function steal(state: GameState, player: number, victim: number): ActionResult {
  if (state.phase !== 'steal') return fail('There is no one to steal from right now');
  if (!state.robberVictims.includes(victim)) return fail('You can only rob a player next to the robber');
  const s = cloneState(state);
  return { ok: true, state: s, events: [stealFrom(s, player, victim)] };
}

/* ───────────────────────────── Building ───────────────────────────── */

function requireMain(state: GameState): string | null {
  if (state.phase === 'roll') return 'Roll the dice first';
  if (state.phase !== 'main') return 'You cannot build right now';
  return null;
}

function buildRoad(state: GameState, player: number, edge: number): ActionResult {
  const free = state.phase === 'roadBuilding';
  if (!free) {
    const err = requireMain(state);
    if (err) return fail(err);
  }
  const p = state.players[player];
  if (p.roadsLeft <= 0) return fail('You have no roads left (15 maximum)');
  if (!free && !canAfford(p.resources, BUILD_COSTS.road)) return fail('A road costs 1 wood and 1 brick');
  if (!canBuildRoadAt(state, player, edge)) return fail('Roads must connect to your own road, settlement or city');
  const s = cloneState(state);
  if (!free) payCost(s, player, 'road');
  s.players[player].roadsLeft--;
  s.roads[edge] = player;
  addLog(s, free ? `${p.name} placed a free road.` : `${p.name} built a road.`, player);
  const events: GameEvent[] = [{ type: 'roadPlaced', player, edge }];
  if (free) {
    s.freeRoads--;
    // Road Building ends after 2 roads, or early if no legal spot / no pieces remain.
    if (s.freeRoads <= 0 || s.players[player].roadsLeft === 0 || validRoadSpots(s, player).length === 0) {
      s.freeRoads = 0;
      s.phase = s.resumePhase;
    }
  }
  updateLongestRoad(s, events);
  checkWin(s, events);
  return { ok: true, state: s, events };
}

function buildSettlement(state: GameState, player: number, vertex: number): ActionResult {
  const err = requireMain(state);
  if (err) return fail(err);
  const p = state.players[player];
  if (p.settlementsLeft <= 0) return fail('You have no settlements left — upgrade one to a city');
  if (!canAfford(p.resources, BUILD_COSTS.settlement)) return fail('A settlement costs 1 wood, 1 brick, 1 wool and 1 wheat');
  if (!state.board.vertices[vertex]) return fail('That corner does not exist');
  if (!satisfiesDistanceRule(state, vertex)) return fail('Too close to another settlement (distance rule)');
  if (!canBuildSettlementAt(state, player, vertex)) return fail('Settlements must be placed on one of your roads');
  const s = cloneState(state);
  payCost(s, player, 'settlement');
  s.players[player].settlementsLeft--;
  s.buildings[vertex] = { owner: player, kind: 'settlement' };
  addLog(s, `${p.name} founded a settlement.`, player);
  const events: GameEvent[] = [{ type: 'settlementPlaced', player, vertex }];
  updateLongestRoad(s, events); // a settlement can break an opponent's road
  checkWin(s, events);
  return { ok: true, state: s, events };
}

function buildCity(state: GameState, player: number, vertex: number): ActionResult {
  const err = requireMain(state);
  if (err) return fail(err);
  const p = state.players[player];
  if (p.citiesLeft <= 0) return fail('You have no cities left (4 maximum)');
  if (!canAfford(p.resources, BUILD_COSTS.city)) return fail('A city costs 2 wheat and 3 ore');
  if (!canBuildCityAt(state, player, vertex)) return fail('Cities must replace one of your own settlements');
  const s = cloneState(state);
  payCost(s, player, 'city');
  const sp = s.players[player];
  sp.citiesLeft--;
  sp.settlementsLeft++; // the settlement piece returns to the supply
  s.buildings[vertex] = { owner: player, kind: 'city' };
  addLog(s, `${p.name} upgraded a settlement to a city.`, player);
  const events: GameEvent[] = [{ type: 'cityBuilt', player, vertex }];
  checkWin(s, events);
  return { ok: true, state: s, events };
}

/** Player 2 of the paired players rule: the third player to the left of Player 1. */
export function pairedPartner(state: GameState, leader: number = state.turnLeader ?? state.currentPlayer): number {
  return (leader + 3) % state.players.length;
}

function endTurn(state: GameState, player: number): ActionResult {
  if (state.phase === 'roll') return fail('Roll the dice before ending your turn');
  if (state.phase !== 'main') return fail('Finish the current step before ending your turn');
  const s = cloneState(state);
  const p = s.players[player];
  p.devCards.push(...p.newDevCards); // cards bought this turn become playable on your next Action phase
  p.newDevCards = [];
  const leader = s.turnLeader ?? player;
  let next: number;
  if (s.paired && !s.pairedTurn) {
    // 5–6 players: Player 1 is done — Player 2 now takes an Action phase (no dice, no trading with players).
    next = pairedPartner(s, leader);
    s.turnLeader = leader;
    s.pairedTurn = true;
    s.phase = 'main';
  } else {
    // Pass the dice (and the Player 1 / Player 2 markers) to the left.
    next = (leader + 1) % s.players.length;
    s.turnLeader = next;
    s.pairedTurn = false;
    s.phase = 'roll';
  }
  s.currentPlayer = next;
  s.resumePhase = 'main';
  s.devCardPlayedThisTurn = false;
  s.tradeOffer = null;
  s.turn++;
  addLog(s, `${p.name} ended their turn.`, player);
  if (s.pairedTurn) addLog(s, `${s.players[next].name} (Player 2) takes an Action phase — no dice roll and no trading with other players.`, next);
  const events: GameEvent[] = [{ type: 'turnEnded', player, next }];
  // Official rule: points reached off-turn (e.g. a Longest Route change) are claimed on your own turn.
  checkWin(s, events);
  return { ok: true, state: s, events };
}

/**
 * The single entry point for changing game state. Every action is validated here,
 * so the UI (and later the server) can never put the game into an illegal state.
 */
export function applyAction(state: GameState, action: GameAction): ActionResult {
  if (state.phase === 'gameOver') return fail('The game is over');
  if (!state.players[action.player]) return fail('Unknown player');
  // Discards and answering a trade offer happen off-turn; everything else belongs to the current player.
  const offTurnAllowed = action.type === 'DISCARD' || action.type === 'RESPOND_TRADE';
  if (!offTurnAllowed && action.player !== state.currentPlayer) return fail("It's not your turn");

  switch (action.type) {
    case 'PLACE_SETUP_SETTLEMENT':
      return placeSetupSettlement(state, action.player, action.vertex);
    case 'PLACE_SETUP_ROAD':
      return placeSetupRoad(state, action.player, action.edge);
    case 'ROLL_DICE':
      return rollDice(state, action.player);
    case 'DISCARD':
      return discard(state, action.player, action.resources);
    case 'MOVE_ROBBER':
      return moveRobber(state, action.player, action.hex);
    case 'STEAL':
      return steal(state, action.player, action.victim);
    case 'BUILD_ROAD':
      return buildRoad(state, action.player, action.edge);
    case 'BUILD_SETTLEMENT':
      return buildSettlement(state, action.player, action.vertex);
    case 'BUILD_CITY':
      return buildCity(state, action.player, action.vertex);
    case 'BUY_DEV_CARD':
      return buyDevCard(state, action.player);
    case 'PLAY_KNIGHT':
      return playKnight(state, action.player);
    case 'PLAY_ROAD_BUILDING':
      return playRoadBuilding(state, action.player);
    case 'PLAY_YEAR_OF_PLENTY':
      return playYearOfPlenty(state, action.player, action.resources);
    case 'PLAY_MONOPOLY':
      return playMonopoly(state, action.player, action.resource);
    case 'MARITIME_TRADE':
      return maritimeTrade(state, action.player, action.give, action.receive, action.amount);
    case 'PROPOSE_TRADE':
      return proposeTrade(state, action.player, action.give, action.want);
    case 'RESPOND_TRADE':
      return respondTrade(state, action.player, action.accept);
    case 'CONFIRM_TRADE':
      return confirmTrade(state, action.player, action.partner);
    case 'CANCEL_TRADE':
      return cancelTrade(state, action.player);
    case 'END_TURN':
      return endTurn(state, action.player);
    default:
      return fail('Unknown action');
  }
}
