import { describe, expect, it } from 'vitest';
import {
  applyAction,
  BUILD_COSTS,
  canAfford,
  longestRoadLength,
  PIECE_LIMITS,
  RESOURCES,
  totalCards,
  tradeRatios,
  validCitySpots,
  validRoadSpots,
  validSettlementSpots,
  type GameAction,
  type GameState,
  type Resource,
} from '../src';
import { picker, playedSetup, totalResources } from './helpers';

type Pick = ReturnType<typeof picker>;

/** Try to play a random playable development card, or return null. */
function devCardAction(g: GameState, pick: Pick): GameAction | null {
  const p = g.players[g.currentPlayer];
  if (g.devCardPlayedThisTurn) return null;
  const playable = p.devCards.filter((c) => c !== 'victoryPoint');
  if (playable.length === 0) return null;
  const card = pick(playable);
  switch (card) {
    case 'knight':
      return { type: 'PLAY_KNIGHT', player: p.id };
    case 'roadBuilding':
      return p.roadsLeft > 0 && validRoadSpots(g, p.id).length > 0 ? { type: 'PLAY_ROAD_BUILDING', player: p.id } : null;
    case 'yearOfPlenty': {
      const avail = RESOURCES.filter((r) => g.bank[r] >= 2);
      return avail.length ? { type: 'PLAY_YEAR_OF_PLENTY', player: p.id, resources: [pick(avail), pick(avail)] as [Resource, Resource] } : null;
    }
    case 'monopoly':
      return { type: 'PLAY_MONOPOLY', player: p.id, resource: pick([...RESOURCES]) };
    default:
      return null;
  }
}

/** A naive random player that only ever chooses legal actions. Used to fuzz the engine. */
function randomAction(g: GameState, pick: Pick): GameAction {
  const p = g.currentPlayer;
  switch (g.phase) {
    case 'roll': {
      const card = pick([0, 1, 2, 3]) === 0 ? devCardAction(g, pick) : null;
      return card?.type === 'PLAY_KNIGHT' ? card : { type: 'ROLL_DICE', player: p };
    }
    case 'discard': {
      const [who, n] = Object.entries(g.pendingDiscards)[0];
      const hand = { ...g.players[Number(who)].resources };
      const out = { wood: 0, brick: 0, wool: 0, grain: 0, ore: 0 };
      for (let i = 0; i < n; i++) {
        const r = pick(RESOURCES.filter((x) => hand[x] > 0));
        hand[r]--;
        out[r]++;
      }
      return { type: 'DISCARD', player: Number(who), resources: out };
    }
    case 'moveRobber':
      return { type: 'MOVE_ROBBER', player: p, hex: pick(g.board.hexes.filter((h) => h.id !== g.robberHex)).id };
    case 'steal':
      return { type: 'STEAL', player: p, victim: pick(g.robberVictims) };
    case 'roadBuilding':
      return { type: 'BUILD_ROAD', player: p, edge: pick(validRoadSpots(g, p)) };
    case 'main': {
      // finish any open player-to-player offer first
      const offer = g.tradeOffer;
      if (offer) {
        const pendingResponder = g.players.find((x) => x.id !== p && offer.responses[x.id] === undefined);
        if (pendingResponder) {
          const can = canAfford(pendingResponder.resources, offer.want);
          return { type: 'RESPOND_TRADE', player: pendingResponder.id, accept: can && pick([true, false]) };
        }
        const accepted = g.players.filter((x) => offer.responses[x.id] === 'accepted' && canAfford(x.resources, offer.want));
        if (accepted.length && canAfford(g.players[p].resources, offer.give)) return { type: 'CONFIRM_TRADE', player: p, partner: pick(accepted).id };
        return { type: 'CANCEL_TRADE', player: p };
      }
      const pl = g.players[p];
      const res = pl.resources;
      const options: GameAction[] = [];
      if (canAfford(res, BUILD_COSTS.city) && pl.citiesLeft > 0) for (const v of validCitySpots(g, p)) options.push({ type: 'BUILD_CITY', player: p, vertex: v });
      if (canAfford(res, BUILD_COSTS.settlement) && pl.settlementsLeft > 0)
        for (const v of validSettlementSpots(g, p)) options.push({ type: 'BUILD_SETTLEMENT', player: p, vertex: v });
      if (canAfford(res, BUILD_COSTS.devCard) && g.devDeck.length > 0) options.push({ type: 'BUY_DEV_CARD', player: p });
      if (options.length === 0 && canAfford(res, BUILD_COSTS.road) && pl.roadsLeft > 0)
        for (const e of validRoadSpots(g, p).slice(0, 4)) options.push({ type: 'BUILD_ROAD', player: p, edge: e });
      const card = devCardAction(g, pick);
      if (card) options.push(card);
      // maritime trade the most plentiful resource for the scarcest
      const ratios = tradeRatios(g, p);
      const rich = RESOURCES.filter((r) => res[r] >= ratios[r]);
      const poor = RESOURCES.filter((r) => res[r] === 0 && g.bank[r] > 0);
      if (rich.length && poor.length) {
        const give = pick(rich);
        const receive = pick(poor.filter((r) => r !== give).length ? poor.filter((r) => r !== give) : poor);
        if (give !== receive) options.push({ type: 'MARITIME_TRADE', player: p, give, receive, amount: 1 });
      }
      // occasionally offer a 1-for-1 swap to everyone
      const have = RESOURCES.filter((r) => res[r] > 0);
      const lack = RESOURCES.filter((r) => res[r] === 0);
      if (have.length && lack.length && pick([0, 1, 2]) === 0) {
        options.push({ type: 'PROPOSE_TRADE', player: p, give: { [pick(have)]: 1 }, want: { [pick(lack)]: 1 } });
      }
      return options.length && pick([0, 1, 2, 3]) !== 0 ? pick(options) : { type: 'END_TURN', player: p };
    }
    default:
      throw new Error(`unexpected phase ${g.phase}`);
  }
}

function checkInvariants(g: GameState, progressPlayed: number) {
  expect(totalResources(g)).toBe(95);
  for (const r of RESOURCES) {
    expect(g.bank[r]).toBeGreaterThanOrEqual(0);
    for (const p of g.players) expect(p.resources[r]).toBeGreaterThanOrEqual(0);
  }
  for (const p of g.players) {
    const roads = Object.values(g.roads).filter((o) => o === p.id).length;
    const settlements = Object.values(g.buildings).filter((b) => b.owner === p.id && b.kind === 'settlement').length;
    const cities = Object.values(g.buildings).filter((b) => b.owner === p.id && b.kind === 'city').length;
    expect(roads + p.roadsLeft).toBe(PIECE_LIMITS.roads);
    expect(settlements + p.settlementsLeft).toBe(PIECE_LIMITS.settlements);
    expect(cities + p.citiesLeft).toBe(PIECE_LIMITS.cities);
  }
  // all 25 development cards accounted for: deck + hands + played knights + played progress cards
  const inHands = g.players.reduce((s, p) => s + p.devCards.length + p.newDevCards.length + p.knightsPlayed, 0);
  expect(g.devDeck.length + inHands + progressPlayed).toBe(25);
  // distance rule holds everywhere
  for (const v of Object.keys(g.buildings).map(Number)) {
    for (const n of g.board.vertices[v].neighbors) expect(g.buildings[n]).toBeUndefined();
  }
  // award holders are legitimate
  const lengths = g.players.map((p) => longestRoadLength(g, p.id));
  if (g.longestRoadHolder !== null) {
    expect(lengths[g.longestRoadHolder]).toBeGreaterThanOrEqual(5);
    expect(lengths[g.longestRoadHolder]).toBe(Math.max(...lengths));
  }
  if (g.largestArmyHolder !== null) {
    const k = g.players.map((p) => p.knightsPlayed);
    expect(k[g.largestArmyHolder]).toBeGreaterThanOrEqual(3);
    expect(k[g.largestArmyHolder]).toBe(Math.max(...k));
  }
}

describe('random full-game simulation (trades, dev cards, awards)', () => {
  it.each([101, 202, 303, 404, 505, 606])('plays legally to the end without breaking invariants (seed %i)', (seed) => {
    const pick = picker(seed * 7);
    let g = playedSetup(seed);
    let steps = 0;
    let progressPlayed = 0;
    const seen = new Set<string>();
    while (g.phase !== 'gameOver' && steps < 5000) {
      const action = randomAction(g, pick);
      const r = applyAction(g, action);
      if (!r.ok) throw new Error(`${action.type} rejected: ${r.error} (step ${steps})`);
      for (const e of r.events) {
        seen.add(e.type);
        if (e.type === 'devCardPlayed' && e.card !== 'knight') progressPlayed++;
      }
      g = r.state;
      checkInvariants(g, progressPlayed);
      steps++;
    }
    expect(g.phase).toBe('gameOver');
    expect(g.winner).toBe(g.currentPlayer);
    expect(totalCards(g.players[g.winner!].resources)).toBeGreaterThanOrEqual(0);
    // the fuzzer should have exercised the Phase 3 systems
    for (const t of ['maritimeTrade', 'devCardBought', 'devCardPlayed']) expect(seen.has(t)).toBe(true);
  });
});
