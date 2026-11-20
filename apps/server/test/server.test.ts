import { afterEach, describe, expect, it } from 'vitest';
import { io as connect, type Socket } from 'socket.io-client';
import { newDb } from 'pg-mem';
import {
  chooseAIAction,
  newAIMemory,
  recordAIAction,
  validSetupRoadSpots,
  validSetupSettlementSpots,
  type ClientToServerEvents,
  type GameState,
  type GameUpdate,
  type LobbyView,
  type ServerToClientEvents,
} from '@island/engine';
import { startServer, type RunningServer } from '../src/server';
import { MemoryStore, PostgresStore, type RoomRecord } from '../src/store';

type Client = Socket<ServerToClientEvents, ClientToServerEvents> & { lobby?: LobbyView; game?: GameUpdate; updates: GameUpdate[] };

const servers: RunningServer[] = [];
const clients: Client[] = [];

afterEach(async () => {
  for (const c of clients.splice(0)) c.disconnect();
  for (const s of servers.splice(0)) await s.close();
});

async function server(opts: Parameters<typeof startServer>[0] = {}) {
  const s = await startServer({ botDelayMs: 0, log: () => {}, ...opts });
  servers.push(s);
  return s;
}

function client(s: RunningServer): Promise<Client> {
  const c = connect(s.url, { transports: ['websocket'], forceNew: true, reconnection: false }) as Client;
  c.updates = [];
  c.on('room:lobby', (l) => (c.lobby = l));
  c.on('game:update', (u) => {
    c.game = u;
    c.updates.push(u);
  });
  clients.push(c);
  return new Promise((resolve, reject) => {
    c.once('connect', () => resolve(c));
    c.once('connect_error', reject);
  });
}

/** Emit with an acknowledgement and resolve with the server's answer. */
function call(c: Client, event: string, ...args: unknown[]): Promise<{ ok: boolean; error?: string; [k: string]: unknown }> {
  return new Promise((resolve) => (c.emit as (...a: unknown[]) => void)(event, ...args, resolve));
}

async function until<T>(fn: () => T | undefined | null | false, ms = 4000): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    const v = fn();
    if (v) return v;
    if (Date.now() > end) throw new Error('Timed out waiting for condition');
    await new Promise((r) => setTimeout(r, 5));
  }
}

/** Host + two friends in a fresh room. */
async function threeInRoom(s: RunningServer) {
  const a = await client(s);
  const created = await call(a, 'room:create', { name: 'Ana', avatar: 1 });
  expect(created.ok).toBe(true);
  const code = created.code as string;
  const b = await client(s);
  const c = await client(s);
  const jb = await call(b, 'room:join', { code: code.toLowerCase(), name: 'Ben', avatar: 2 });
  const jc = await call(c, 'room:join', { code, name: '  Cleo  ', avatar: 3 });
  expect(jb.ok && jc.ok).toBe(true);
  await until(() => a.lobby?.seats.length === 3 && c.lobby?.seats.length === 3);
  return { a, b, c, code, tokens: [created.token as string, jb.token as string, jc.token as string] };
}

describe('lobby', () => {
  it('creates rooms, gives each seat a unique color and keeps the host in charge', async () => {
    const s = await server();
    const { a, b, c } = await threeInRoom(s);
    const seats = a.lobby!.seats;
    expect(seats.map((x) => x.name)).toEqual(['Ana', 'Ben', 'Cleo']);
    expect(new Set(seats.map((x) => x.color)).size).toBe(3);
    expect(seats[0].isHost).toBe(true);
    expect(b.lobby!.you).toBe(1);

    expect(await call(b, 'room:addBot', { level: 'hard' })).toMatchObject({ ok: false, error: expect.stringMatching(/host/) });
    expect(await call(b, 'room:start')).toMatchObject({ ok: false });
    expect(await call(c, 'room:seat', { color: seats[0].color })).toMatchObject({ ok: false, error: expect.stringMatching(/Ana/) });

    expect((await call(a, 'room:addBot', { level: 'hard' })).ok).toBe(true);
    await until(() => c.lobby?.seats.length === 4);
    expect(c.lobby!.seats[3]).toMatchObject({ isAI: true, aiLevel: 'hard', connected: true });

    // up to six seats now (5–6 player extension); the room is full after two more
    expect((await call(a, 'room:addBot', { level: 'easy' })).ok).toBe(true);
    expect((await call(a, 'room:addBot', { level: 'easy' })).ok).toBe(true);
    await until(() => c.lobby?.seats.length === 6);
    expect(new Set(c.lobby!.seats.map((x) => x.color)).size).toBe(6);
    expect(await call(a, 'room:addBot', { level: 'easy' })).toMatchObject({ ok: false, error: expect.stringMatching(/full/) });

    const late = await client(s);
    expect(await call(late, 'room:join', { code: a.lobby!.code, name: 'Dev' })).toMatchObject({ ok: false, error: expect.stringMatching(/full/) });
    expect(await call(late, 'room:join', { code: 'ZZZZZ', name: 'Dev' })).toMatchObject({ ok: false, error: expect.stringMatching(/No room/) });
  });

  it('needs three players to start, and the host can remove a player', async () => {
    const s = await server();
    const a = await client(s);
    const created = await call(a, 'room:create', { name: 'Ana', avatar: 0 });
    const b = await client(s);
    await call(b, 'room:join', { code: created.code, name: 'Ben' });
    expect(await call(a, 'room:start')).toMatchObject({ ok: false, error: expect.stringMatching(/at least 3/) });

    const closed = new Promise<string>((r) => b.once('room:closed', r));
    expect((await call(a, 'room:removeSeat', { seat: 1 })).ok).toBe(true);
    expect(await closed).toMatch(/removed/);
    await until(() => a.lobby?.seats.length === 1);
  });
});

describe('online game', () => {
  async function started() {
    const s = await server();
    const room = await threeInRoom(s);
    expect((await call(room.a, 'room:start')).ok).toBe(true);
    await until(() => room.a.game && room.b.game && room.c.game);
    return { s, ...room };
  }

  it('sends each player a view that hides other hands, the deck order and the RNG', async () => {
    const { a, b } = await started();
    const view: GameState = b.game!.state;
    expect(view.viewer).toBe(1);
    expect(view.rngState).toBe(0);
    expect(new Set(view.devDeck)).toEqual(new Set(['knight']));
    expect(view.devDeck).toHaveLength(25);
    expect(view.players[1].handCount).toBeUndefined();
    expect(view.players[0].handCount).toBe(0);
    expect(view.players[0].devCardCount).toBe(0);
    expect(a.game!.state.viewer).toBe(0);
  });

  it('only accepts actions from the seat whose turn it is, and broadcasts the result', async () => {
    const { a, b, c } = await started();
    const g = a.game!.state;
    const turn = g.currentPlayer;
    const sockets = [a, b, c];
    const active = sockets[turn];
    const other = sockets[(turn + 1) % 3];
    const vertex = validSetupSettlementSpots(g)[0];

    // pretending to be another seat
    expect(await call(other, 'game:action', { type: 'PLACE_SETUP_SETTLEMENT', player: turn, vertex })).toMatchObject({
      ok: false,
      error: expect.stringMatching(/own seat/),
    });
    // acting out of turn
    expect(await call(other, 'game:action', { type: 'PLACE_SETUP_SETTLEMENT', player: (turn + 1) % 3, vertex })).toMatchObject({
      ok: false,
      error: expect.stringMatching(/not your turn/),
    });
    // garbage
    expect((await call(active, 'game:action', { type: 'DISCARD', player: turn, resources: null })).ok).toBe(false);

    const seq = a.game!.seq;
    expect((await call(active, 'game:action', { type: 'PLACE_SETUP_SETTLEMENT', player: turn, vertex })).ok).toBe(true);
    for (const s of sockets) await until(() => s.game!.seq === seq + 1);
    expect(b.game!.state.buildings[vertex]).toEqual({ owner: turn, kind: 'settlement' });
    expect(c.game!.events).toEqual([{ type: 'settlementPlaced', player: turn, vertex }]);
    const road = validSetupRoadSpots(a.game!.state)[0];
    expect((await call(active, 'game:action', { type: 'PLACE_SETUP_ROAD', player: turn, edge: road })).ok).toBe(true);
  });

  it('lets a player reconnect to the same seat with their token', async () => {
    const { s, a, b, code, tokens } = await started();
    b.disconnect();
    await until(() => a.lobby!.seats[1].connected === false);
    const back = await client(s);
    const res = await call(back, 'room:join', { code, token: tokens[1] });
    expect(res).toMatchObject({ ok: true, seat: 1 });
    await until(() => back.game);
    expect(back.game!.state.viewer).toBe(1);
    await until(() => a.lobby!.seats[1].connected === true);
    // a stranger with a made-up token cannot take a seat once the game has started
    const stranger = await client(s);
    expect(await call(stranger, 'room:join', { code, token: 'nope', name: 'Eve' })).toMatchObject({ ok: false, error: expect.stringMatching(/started/) });
  });

  it('plays a whole game: one online human against two server-side computer players', async () => {
    const s = await server();
    const a = await client(s);
    const created = await call(a, 'room:create', { name: 'Ana', avatar: 0 });
    await call(a, 'room:addBot', { level: 'normal' });
    await call(a, 'room:addBot', { level: 'hard' });
    // The human seat is played by the same AI, but working only from its redacted view.
    const memo = newAIMemory();
    let lastSeq = -1;
    a.on('game:update', (u) => {
      if (u.seq <= lastSeq) return;
      lastSeq = u.seq;
      const action = chooseAIAction(u.state, 0, memo);
      if (!action) return;
      void call(a, 'game:action', action).then((r) => {
        if (r.ok) recordAIAction(memo, u.state, action);
      });
    });
    expect((await call(a, 'room:start')).ok).toBe(true);
    const end = await until(() => a.game?.state.phase === 'gameOver' && a.game, 60_000);
    expect(end.state.winner).not.toBeNull();
    // everything is revealed at the end
    expect(end.state.players.every((p) => p.handCount === undefined)).toBe(true);
    await until(() => a.lobby?.status === 'finished');
    const matches = await until(async () => (await (await fetch(`${s.url}/api/matches`)).json()) as unknown[]);
    expect(await matches).toHaveLength(1);
    expect(created.ok).toBe(true);
  }, 70_000);

  it('survives a server restart: rooms reload from the store and seats are reclaimed', async () => {
    const store = new MemoryStore();
    store.close = async () => {}; // keep the data across the restart
    const first = await startServer({ store, botDelayMs: 0, log: () => {} });
    const room = await (async () => {
      const a = await client(first);
      const created = await call(a, 'room:create', { name: 'Ana' });
      await call(a, 'room:addBot', { level: 'easy' });
      await call(a, 'room:addBot', { level: 'easy' });
      await call(a, 'room:start');
      await until(() => a.game);
      a.disconnect();
      return { code: created.code as string, token: created.token as string, seq: a.game!.seq };
    })();
    await first.close();

    const second = await server({ store });
    const back = await client(second);
    expect(await call(back, 'room:join', { code: room.code, token: room.token })).toMatchObject({ ok: true, seat: 0 });
    await until(() => back.game);
    expect(back.game!.seq).toBeGreaterThanOrEqual(room.seq);
    expect(back.lobby!.status).toBe('playing');
  });
});

describe('Postgres store', () => {
  it('saves, loads and updates rooms and records matches (pg-mem)', async () => {
    const { Pool } = newDb().adapters.createPg();
    const store = new PostgresStore(new Pool());
    await store.init();
    const room: RoomRecord = {
      code: 'ABCDE',
      status: 'lobby',
      hostSeat: 0,
      seats: [{ name: 'Ana', color: 'red', avatar: 0, isAI: false, token: 't1' }],
      game: null,
      seq: 0,
      createdAt: 1,
      updatedAt: 1,
    };
    await store.save(room);
    expect(await store.load('ABCDE')).toEqual(room);
    await store.save({ ...room, status: 'playing', seq: 3 });
    expect(await store.load('ABCDE')).toMatchObject({ status: 'playing', seq: 3 });
    expect(await store.load('NOPE1')).toBeNull();

    await store.recordMatch({ code: 'ABCDE', finishedAt: 1000, winner: 'Ana', turns: 50, players: [{ name: 'Ana', color: 'red', isAI: false, vp: 10 }] });
    await store.recordMatch({ code: 'FGHJK', finishedAt: 2000, winner: 'Ben', turns: 40, players: [] });
    const matches = await store.recentMatches(10);
    expect(matches.map((m) => m.winner)).toEqual(['Ben', 'Ana']);
    expect(matches[1].players[0]).toEqual({ name: 'Ana', color: 'red', isAI: false, vp: 10 });

    await store.remove('ABCDE');
    expect(await store.load('ABCDE')).toBeNull();
  });
});
