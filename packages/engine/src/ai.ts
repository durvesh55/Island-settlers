import { BUILD_COSTS, pipCount, RESOURCES, type AILevel, type BuildKind, type Resource } from './constants';
import type { GameAction } from './action-types';
import { longestRoadLength } from './awards';
import {
  satisfiesDistanceRule,
  validCitySpots,
  validRoadSpots,
  validSettlementSpots,
  validSetupRoadSpots,
  validSetupSettlementSpots,
} from './placement';
import { canAfford, emptyBundle, totalCards } from './resources';
import { mulberry32Step } from './rng';
import { tradeRatios } from './trading';
import type { GameState, ResourceBundle } from './types';
import { publicVictoryPoints } from './victory';

/**
 * Computer opponents.
 *
 * `chooseAIAction` is a pure function: given a game state it returns the next action a computer
 * player wants to take (or null when it is waiting on someone else). It only ever proposes actions
 * that the engine will accept, and it only uses public information — hand *sizes* and the board,
 * never the cards in an opponent's hand. Its randomness is derived from the game state, so the
 * same state always yields the same choice (useful for tests and, later, the server).
 */

/** Per-player, per-turn bookkeeping the caller keeps between calls (limits trading loops). */
export interface AIMemory {
  turn: number;
  /** Actions taken this turn. */
  steps: number;
  /** Maritime trades this turn. */
  trades: number;
  /** Player-to-player offers this turn. */
  offers: number;
  /** Offers already made this turn (give→want), so the same one is never repeated. */
  offered: string[];
}

const offerKey = (give: Partial<ResourceBundle>, want: Partial<ResourceBundle>) => JSON.stringify([give, want]);

export const newAIMemory = (): AIMemory => ({ turn: -1, steps: 0, trades: 0, offers: 0, offered: [] });

/** Update the memory after the caller has successfully applied `action` to `state`. */
export function recordAIAction(memory: AIMemory, state: GameState, action: GameAction): void {
  if (memory.turn !== state.turn) Object.assign(memory, newAIMemory(), { turn: state.turn });
  memory.steps++;
  if (action.type === 'MARITIME_TRADE') memory.trades++;
  if (action.type === 'PROPOSE_TRADE') {
    memory.offers++;
    memory.offered.push(offerKey(action.give, action.want));
  }
}

const MAX_STEPS_PER_TURN = 40;
const MAX_MARITIME_PER_TURN = 6;
const MAX_OFFERS_PER_TURN = 2;
/** Don't help a player this close to winning. */
const LEADER_VP = 8;

/** How much randomness each difficulty adds to its scores. */
const NOISE: Record<AILevel, number> = { easy: 3, normal: 0.6, hard: 0 };

/** Rough early-game worth of each resource (roads and settlements need wood and brick most). */
const WORTH: Record<Resource, number> = { wood: 1.1, brick: 1.1, wool: 0.85, grain: 1.0, ore: 0.95 };

interface Ctx {
  state: GameState;
  player: number;
  level: AILevel;
  rand: () => number;
}

function makeCtx(state: GameState, player: number): Ctx {
  let seed = (state.rngState ^ Math.imul(player + 1, 0x9e3779b1) ^ Math.imul(state.log.length + 1, 0x85ebca6b)) | 0;
  const rand = () => {
    const [v, next] = mulberry32Step(seed);
    seed = next;
    return v;
  };
  return { state, player, level: state.players[player].aiLevel ?? 'normal', rand };
}

const noise = (ctx: Ctx) => (ctx.rand() - 0.5) * NOISE[ctx.level];

/* ───────────────────────────── Evaluation ───────────────────────────── */

function hexPips(state: GameState, hexId: number): number {
  const h = state.board.hexes[hexId];
  return h.resource && h.token ? pipCount(h.token) : 0;
}

/** Expected production (in pips, i.e. chances out of 36) per resource. */
export function productionOf(state: GameState, player: number): ResourceBundle {
  const out = emptyBundle();
  for (const [vk, b] of Object.entries(state.buildings)) {
    if (b.owner !== player) continue;
    for (const hid of state.board.vertices[Number(vk)].hexes) {
      const h = state.board.hexes[hid];
      if (!h.resource || hid === state.robberHex) continue;
      out[h.resource] += hexPips(state, hid) * (b.kind === 'city' ? 2 : 1);
    }
  }
  return out;
}

/** Rarer resources on this island are worth more (about 11–12 pips of each is average). */
function scarcity(state: GameState): Record<Resource, number> {
  const total = emptyBundle();
  for (const h of state.board.hexes) if (h.resource) total[h.resource] += hexPips(state, h.id);
  const out = {} as Record<Resource, number>;
  for (const r of RESOURCES) out[r] = Math.min(1.5, Math.max(0.7, 11.6 / Math.max(1, total[r])));
  return out;
}

/** How good a corner would be for a new settlement for this player. */
export function vertexScore(state: GameState, player: number, vertex: number, prod = productionOf(state, player)): number {
  const v = state.board.vertices[vertex];
  const sc = scarcity(state);
  const gains = emptyBundle();
  let score = 0;
  for (const hid of v.hexes) {
    const h = state.board.hexes[hid];
    if (!h.resource) continue;
    const pips = hexPips(state, hid) * (hid === state.robberHex ? 0.5 : 1);
    gains[h.resource] += pips;
    score += pips * sc[h.resource] * WORTH[h.resource];
  }
  for (const r of RESOURCES) if (gains[r] > 0 && prod[r] === 0) score += 1.5; // diversity
  if (v.harbor !== null) {
    const harbor = state.board.harbors[v.harbor];
    score += harbor.type === 'any' ? 1 : Math.min(3, (prod[harbor.type] + gains[harbor.type]) / 3);
  }
  return score;
}

function vertexPips(state: GameState, vertex: number): number {
  return state.board.vertices[vertex].hexes.reduce((s, h) => s + (h === state.robberHex ? 0 : hexPips(state, h)), 0);
}

function argmax<T>(items: T[], score: (t: T) => number): T | null {
  let best: T | null = null;
  let bestScore = -Infinity;
  for (const it of items) {
    const s = score(it);
    if (s > bestScore) {
      bestScore = s;
      best = it;
    }
  }
  return best;
}

function missingFor(have: ResourceBundle, kind: BuildKind): ResourceBundle {
  const out = emptyBundle();
  const cost = BUILD_COSTS[kind];
  for (const r of RESOURCES) out[r] = Math.max(0, (cost[r] ?? 0) - have[r]);
  return out;
}

/* ───────────────────────────── Road planning ───────────────────────────── */

export interface RoadPlan {
  /** First road to build. */
  edge: number;
  /** Corner the road heads for (a future settlement spot). */
  target: number;
  /** Roads needed to reach it. */
  dist: number;
  score: number;
}

/** Breadth-first search out from the road network for the best reachable settlement spot (≤ 4 roads). */
export function planRoad(state: GameState, player: number, prod = productionOf(state, player)): RoadPlan | null {
  const { board } = state;
  const start = new Set<number>();
  for (const [v, b] of Object.entries(state.buildings)) if (b.owner === player) start.add(Number(v));
  for (const [e, owner] of Object.entries(state.roads)) {
    if (owner !== player) continue;
    for (const v of board.edges[Number(e)].vertices) {
      const b = state.buildings[v];
      if (!b || b.owner === player) start.add(v);
    }
  }
  const dist = new Map<number, number>();
  const firstEdge = new Map<number, number>();
  for (const v of start) dist.set(v, 0);
  let frontier = [...start];
  let best: RoadPlan | null = null;
  for (let d = 1; d <= 4 && frontier.length > 0; d++) {
    const next: number[] = [];
    for (const u of frontier) {
      if (dist.get(u)! > 0 && state.buildings[u]) continue; // cannot build through an occupied corner
      for (const e of board.vertices[u].edges) {
        if (state.roads[e] !== undefined) continue;
        const [a, b] = board.edges[e].vertices;
        const w = a === u ? b : a;
        if (dist.has(w)) continue;
        dist.set(w, d);
        firstEdge.set(w, dist.get(u) === 0 ? e : firstEdge.get(u)!);
        next.push(w);
        if (satisfiesDistanceRule(state, w)) {
          const score = vertexScore(state, player, w, prod) - 1.2 * d;
          if (!best || score > best.score) best = { edge: firstEdge.get(w)!, target: w, dist: d, score };
        }
      }
    }
    frontier = next;
  }
  return best;
}

/** A legal road, preferring the plan, otherwise whatever lengthens the longest road most. */
function bestRoad(ctx: Ctx, prod: ResourceBundle): number | null {
  const { state, player } = ctx;
  const plan = planRoad(state, player, prod);
  if (plan) return plan.edge;
  const spots = validRoadSpots(state, player);
  return argmax(spots, (e) => {
    const s = { ...state, roads: { ...state.roads, [e]: player } };
    return longestRoadLength(s, player) + ctx.rand() * 0.1;
  });
}

/* ───────────────────────────── Goals ───────────────────────────── */

interface Goal {
  kind: BuildKind;
  /** Corner (settlement/city) or edge (road) the goal is aimed at. */
  target: number | null;
  missing: ResourceBundle;
  score: number;
}

/** Pick what to save for next: a settlement, a city, a road towards a new spot, or a development card. */
function chooseGoal(ctx: Ctx, prod = productionOf(ctx.state, ctx.player)): Goal | null {
  const { state, player } = ctx;
  const p = state.players[player];
  const options: Omit<Goal, 'missing' | 'score'>[] = [];
  const values: number[] = [];

  const settlementSpots = p.settlementsLeft > 0 ? validSettlementSpots(state, player) : [];
  if (settlementSpots.length > 0) {
    const best = argmax(settlementSpots, (v) => vertexScore(state, player, v, prod))!;
    options.push({ kind: 'settlement', target: best });
    values.push(5 + 0.25 * vertexScore(state, player, best, prod));
  }
  const citySpots = p.citiesLeft > 0 ? validCitySpots(state, player) : [];
  if (citySpots.length > 0) {
    const best = argmax(citySpots, (v) => vertexPips(state, v))!;
    options.push({ kind: 'city', target: best });
    values.push(4.5 + 0.3 * vertexPips(state, best));
  }
  if (p.roadsLeft > 0 && p.settlementsLeft > 0 && settlementSpots.length === 0) {
    const plan = planRoad(state, player, prod);
    if (plan) {
      options.push({ kind: 'road', target: plan.edge });
      values.push(3 + 0.15 * plan.score - 0.4 * (plan.dist - 1));
    }
  }
  if (state.devDeck.length > 0) {
    options.push({ kind: 'devCard', target: null });
    values.push((ctx.level === 'hard' ? 3 : 2.6) + (p.knightsPlayed > 0 ? 0.4 : 0));
  }
  if (options.length === 0) return null;

  const goals = options.map((o, i) => {
    const missing = missingFor(p.resources, o.kind);
    let penalty = 0;
    for (const r of RESOURCES) penalty += missing[r] * (prod[r] === 0 ? 2.8 : 1.6);
    return { ...o, missing, score: values[i] - penalty + noise(ctx) };
  });
  return argmax(goals, (g) => g.score);
}

function goalAction(ctx: Ctx, goal: Goal, prod: ResourceBundle): GameAction | null {
  const { player } = ctx;
  switch (goal.kind) {
    case 'settlement':
      return { type: 'BUILD_SETTLEMENT', player, vertex: goal.target! };
    case 'city':
      return { type: 'BUILD_CITY', player, vertex: goal.target! };
    case 'road': {
      const edge = goal.target ?? bestRoad(ctx, prod);
      return edge === null ? null : { type: 'BUILD_ROAD', player, edge };
    }
    case 'devCard':
      return { type: 'BUY_DEV_CARD', player };
  }
}

/* ───────────────────────────── Setup ───────────────────────────── */

function setupSettlement(ctx: Ctx): GameAction {
  const { state, player } = ctx;
  const prod = productionOf(state, player);
  const spots = validSetupSettlementSpots(state);
  const vertex = argmax(spots, (v) => vertexScore(state, player, v, prod) + noise(ctx) * 2)!;
  return { type: 'PLACE_SETUP_SETTLEMENT', player, vertex };
}

function setupRoad(ctx: Ctx): GameAction {
  const { state, player } = ctx;
  const prod = productionOf(state, player);
  const from = state.setup!.lastSettlement!;
  const edge = argmax(validSetupRoadSpots(state), (e) => {
    const [a, b] = state.board.edges[e].vertices;
    const w = a === from ? b : a;
    let best = 0;
    for (const x of state.board.vertices[w].neighbors) {
      if (x === from) continue;
      if (satisfiesDistanceRule(state, x)) best = Math.max(best, vertexScore(state, player, x, prod));
      for (const y of state.board.vertices[x].neighbors) {
        if (y !== w && satisfiesDistanceRule(state, y)) best = Math.max(best, 0.7 * vertexScore(state, player, y, prod));
      }
    }
    return best + noise(ctx);
  })!;
  return { type: 'PLACE_SETUP_ROAD', player, edge };
}

/* ───────────────────────────── Robber ───────────────────────────── */

/** Pips the robber is currently costing this player. */
function robberDamage(state: GameState, player: number): number {
  let dmg = 0;
  for (const v of state.board.hexes[state.robberHex].vertices) {
    const b = state.buildings[v];
    if (b?.owner === player) dmg += hexPips(state, state.robberHex) * (b.kind === 'city' ? 2 : 1);
  }
  return dmg;
}

function robberHex(ctx: Ctx): number {
  const { state, player } = ctx;
  const hex = argmax(
    state.board.hexes.filter((h) => h.id !== state.robberHex),
    (h) => {
      let score = 0;
      for (const v of h.vertices) {
        const b = state.buildings[v];
        if (!b) continue;
        if (b.owner === player) {
          score -= 50;
          continue;
        }
        const vp = publicVictoryPoints(state, b.owner);
        score += hexPips(state, h.id) * (b.kind === 'city' ? 2 : 1) * (1 + vp / 5);
        if (totalCards(state.players[b.owner].resources) > 0) score += 1;
      }
      return score + noise(ctx) * 3;
    },
  )!;
  return hex.id;
}

function stealVictim(ctx: Ctx): number {
  const { state } = ctx;
  return argmax(state.robberVictims, (v) => 3 * publicVictoryPoints(state, v) + totalCards(state.players[v].resources) + noise(ctx))!;
}

/* ───────────────────────────── Discards ───────────────────────────── */

function chooseDiscard(ctx: Ctx, count: number): ResourceBundle {
  const { state, player } = ctx;
  const goal = chooseGoal(ctx);
  const need = goal ? BUILD_COSTS[goal.kind] : {};
  const hand = { ...state.players[player].resources };
  const out = emptyBundle();
  for (let i = 0; i < count; i++) {
    const r = argmax(
      RESOURCES.filter((x) => hand[x] > 0),
      (x) => hand[x] - (need[x] ?? 0) - WORTH[x] * 0.1,
    )!;
    hand[r]--;
    out[r]++;
  }
  return out;
}

/* ───────────────────────────── Trading ───────────────────────────── */

/** Should this player accept receiving `receive` in exchange for `give` with `partner`? */
function wantsTrade(ctx: Ctx, receive: ResourceBundle, give: ResourceBundle, partner: number): boolean {
  const { state, player } = ctx;
  const have = state.players[player].resources;
  if (!canAfford(have, give)) return false;
  if (publicVictoryPoints(state, partner) >= LEADER_VP) return false;
  const goal = chooseGoal({ ...ctx, rand: () => 0.5 });
  const need = goal ? BUILD_COSTS[goal.kind] : {};
  const missing = goal ? { ...goal.missing } : emptyBundle();
  let gain = 0;
  let loss = 0;
  for (const r of RESOURCES) {
    for (let i = 0; i < receive[r]; i++) gain += i < missing[r] ? 2 : 0.5 * WORTH[r];
    for (let i = 0; i < give[r]; i++) loss += have[r] - i - 1 < (need[r] ?? 0) ? 2.2 : 0.5 * WORTH[r];
  }
  const margin = ctx.level === 'easy' ? -0.2 : ctx.level === 'hard' ? 0.5 : 0.25;
  return gain - loss > margin;
}

function maritimeFor(ctx: Ctx, goal: Goal): GameAction | null {
  const { state, player } = ctx;
  const have = state.players[player].resources;
  const need = BUILD_COSTS[goal.kind];
  const ratios = tradeRatios(state, player);
  const wanted = RESOURCES.filter((r) => goal.missing[r] > 0 && state.bank[r] > 0);
  if (wanted.length === 0) return null;
  const receive = argmax(wanted, (r) => goal.missing[r])!;
  const givers = RESOURCES.filter((r) => r !== receive && have[r] - (need[r] ?? 0) >= ratios[r]);
  const give = argmax(givers, (r) => have[r] - (need[r] ?? 0) - ratios[r]);
  return give ? { type: 'MARITIME_TRADE', player, give, receive, amount: 1 } : null;
}

function domesticOffer(ctx: Ctx, goal: Goal, offered: string[]): GameAction | null {
  const { state, player } = ctx;
  if (state.pairedTurn) return null; // Player 2 may not trade with other players
  if (totalCards(goal.missing) > 2) return null;
  const have = state.players[player].resources;
  const need = BUILD_COSTS[goal.kind];
  const receive = argmax(
    RESOURCES.filter((r) => goal.missing[r] > 0),
    (r) => goal.missing[r],
  );
  const give = argmax(
    RESOURCES.filter((r) => r !== receive && have[r] > (need[r] ?? 0)),
    (r) => have[r] - (need[r] ?? 0) - WORTH[r] * 0.1,
  );
  if (!receive || !give) return null;
  const give1 = { [give]: 1 };
  const want1 = { [receive]: 1 };
  if (offered.includes(offerKey(give1, want1))) return null; // already asked this turn
  return { type: 'PROPOSE_TRADE', player, give: give1, want: want1 };
}

/** As the offerer: once everyone has answered, trade with the best accepting partner or withdraw. */
function settleOwnOffer(ctx: Ctx): GameAction | null {
  const { state, player } = ctx;
  const offer = state.tradeOffer!;
  const others = state.players.filter((p) => p.id !== player);
  if (others.some((p) => offer.responses[p.id] === undefined)) return null; // still waiting
  const partners = others.filter((p) => offer.responses[p.id] === 'accepted' && canAfford(p.resources, offer.want));
  const partner = argmax(partners, (p) => -publicVictoryPoints(state, p.id));
  if (partner && canAfford(state.players[player].resources, offer.give)) return { type: 'CONFIRM_TRADE', player, partner: partner.id };
  return { type: 'CANCEL_TRADE', player };
}

/* ───────────────────────────── Development cards ───────────────────────────── */

function devCardPlay(ctx: Ctx, goal: Goal | null, prod: ResourceBundle): GameAction | null {
  const { state, player } = ctx;
  const p = state.players[player];
  if (state.devCardPlayedThisTurn) return null;
  const hand = p.devCards;

  if (hand.includes('knight')) {
    const holder = state.largestArmyHolder;
    const armyChase =
      holder !== player && p.knightsPlayed + 1 >= 3 && (holder === null || p.knightsPlayed + 1 > state.players[holder].knightsPlayed);
    if (robberDamage(state, player) >= 3 || armyChase) return { type: 'PLAY_KNIGHT', player };
  }
  if (state.phase !== 'main') return null; // only a knight is worth playing before the roll

  if (hand.includes('roadBuilding') && p.roadsLeft > 0 && p.settlementsLeft > 0 && planRoad(state, player, prod)) {
    return { type: 'PLAY_ROAD_BUILDING', player };
  }
  if (hand.includes('yearOfPlenty') && goal && totalCards(goal.missing) > 0) {
    const picks: Resource[] = [];
    const bank = { ...state.bank };
    const missing = { ...goal.missing };
    for (let i = 0; i < 2; i++) {
      const r =
        argmax(
          RESOURCES.filter((x) => missing[x] > 0 && bank[x] > 0),
          (x) => missing[x],
        ) ?? argmax(RESOURCES.filter((x) => bank[x] > 0), (x) => -prod[x]);
      if (!r) break;
      picks.push(r);
      missing[r]--;
      bank[r]--;
    }
    if (picks.length === 2) return { type: 'PLAY_YEAR_OF_PLENTY', player, resources: [picks[0], picks[1]] };
  }
  if (hand.includes('monopoly')) {
    // Estimate opponents' holdings from what they produce (public), not from their hidden hands.
    const others = state.players.filter((o) => o.id !== player);
    const oppProd = emptyBundle();
    for (const o of others) {
      const op = productionOf(state, o.id);
      for (const r of RESOURCES) oppProd[r] += op[r];
    }
    const r = argmax([...RESOURCES], (x) => oppProd[x] * (goal && goal.missing[x] > 0 ? 1.5 : 1))!;
    const cardsOut = others.reduce((s, o) => s + totalCards(o.resources), 0);
    if (oppProd[r] >= 10 && cardsOut >= 6) return { type: 'PLAY_MONOPOLY', player, resource: r };
  }
  return null;
}

/* ───────────────────────────── Turn ───────────────────────────── */

function mainAction(ctx: Ctx, memo: AIMemory): GameAction {
  const { state, player } = ctx;
  const p = state.players[player];
  const end: GameAction = { type: 'END_TURN', player };
  if (memo.steps >= MAX_STEPS_PER_TURN) return end;
  const prod = productionOf(state, player);
  const goal = chooseGoal(ctx, prod);

  const card = devCardPlay(ctx, goal, prod);
  if (card) return card;

  // Points first: any affordable settlement or city.
  if (p.settlementsLeft > 0 && canAfford(p.resources, BUILD_COSTS.settlement)) {
    const v = argmax(validSettlementSpots(state, player), (x) => vertexScore(state, player, x, prod));
    if (v !== null) return { type: 'BUILD_SETTLEMENT', player, vertex: v };
  }
  if (p.citiesLeft > 0 && canAfford(p.resources, BUILD_COSTS.city)) {
    const v = argmax(validCitySpots(state, player), (x) => vertexPips(state, x));
    if (v !== null) return { type: 'BUILD_CITY', player, vertex: v };
  }

  if (goal) {
    if (totalCards(goal.missing) === 0) {
      const a = goalAction(ctx, goal, prod);
      if (a) return a;
    } else {
      if (memo.trades < MAX_MARITIME_PER_TURN) {
        const trade = maritimeFor(ctx, goal);
        if (trade) return trade;
      }
      if (ctx.level !== 'easy' && memo.offers < MAX_OFFERS_PER_TURN) {
        const offer = domesticOffer(ctx, goal, memo.offered);
        if (offer) return offer;
      }
    }
  }

  // Spend spare cards that don't set the goal back (and avoid losing half the hand to a 7).
  const spare = (kind: BuildKind) => {
    if (!canAfford(p.resources, BUILD_COSTS[kind])) return false;
    if (totalCards(p.resources) > 7) return true;
    if (!goal) return true;
    const after = { ...p.resources };
    for (const r of RESOURCES) after[r] -= BUILD_COSTS[kind][r] ?? 0;
    return totalCards(missingFor(after, goal.kind)) <= totalCards(goal.missing);
  };
  if (state.devDeck.length > 0 && spare('devCard')) return { type: 'BUY_DEV_CARD', player };
  if (p.roadsLeft > 0 && spare('road') && (totalCards(p.resources) > 7 || planRoad(state, player, prod))) {
    const edge = bestRoad(ctx, prod);
    if (edge !== null) return { type: 'BUILD_ROAD', player, edge };
  }
  return end;
}

/**
 * The next action computer player `player` wants to take, or null if it has nothing to do
 * right now (not its turn, or waiting for someone else to discard or answer a trade).
 */
export function chooseAIAction(state: GameState, player: number, memory: AIMemory = newAIMemory()): GameAction | null {
  if (state.phase === 'gameOver' || !state.players[player]) return null;
  const memo = memory.turn === state.turn ? memory : { ...newAIMemory(), turn: state.turn };
  const ctx = makeCtx(state, player);

  // Off-turn duties.
  if (state.phase === 'discard') {
    const n = state.pendingDiscards[player];
    return n ? { type: 'DISCARD', player, resources: chooseDiscard(ctx, n) } : null;
  }
  const offer = state.tradeOffer;
  if (offer && state.phase === 'main' && offer.from !== player) {
    if (offer.responses[player] !== undefined) return null;
    return { type: 'RESPOND_TRADE', player, accept: wantsTrade(ctx, offer.give, offer.want, offer.from) };
  }
  if (player !== state.currentPlayer) return null;

  switch (state.phase) {
    case 'setup':
      return state.setup!.step === 'settlement' ? setupSettlement(ctx) : setupRoad(ctx);
    case 'roll': {
      const card = devCardPlay(ctx, null, productionOf(state, player));
      return card ?? { type: 'ROLL_DICE', player };
    }
    case 'moveRobber':
      return { type: 'MOVE_ROBBER', player, hex: robberHex(ctx) };
    case 'steal':
      return { type: 'STEAL', player, victim: stealVictim(ctx) };
    case 'roadBuilding': {
      const edge = bestRoad(ctx, productionOf(state, player));
      return edge === null ? null : { type: 'BUILD_ROAD', player, edge };
    }
    case 'main':
      return offer ? settleOwnOffer(ctx) : mainAction(ctx, memo);
    default:
      return null;
  }
}

/** Which computer players have something to do right now (current player first). */
export function pendingAIPlayers(state: GameState): number[] {
  const order = state.players.map((_, i) => (state.currentPlayer + i) % state.players.length);
  return order.filter((id) => state.players[id].isAI);
}
