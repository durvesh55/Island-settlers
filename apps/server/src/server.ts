import { existsSync } from 'node:fs';
import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import express from 'express';
import { Server } from 'socket.io';
import type { Ack, ClientToServerEvents, JoinResult, ServerToClientEvents } from '@island/engine';
import { cleanName, RoomManager, type GameSocket } from './rooms';
import { MemoryStore, type RoomStore } from './store';

export interface ServerOptions {
  port?: number;
  store?: RoomStore;
  /** Base pause before computer players act (ms). */
  botDelayMs?: number;
  /** Built client to serve (apps/client/dist). Skipped if missing. */
  clientDist?: string;
  /** Allowed browser origins for Socket.IO (in addition to same-origin). */
  corsOrigins?: string[];
  log?: (msg: string) => void;
}

export interface RunningServer {
  url: string;
  port: number;
  http: HttpServer;
  io: Server<ClientToServerEvents, ServerToClientEvents>;
  rooms: RoomManager;
  store: RoomStore;
  close(): Promise<void>;
}

const fail = (ack: unknown, error: string) => {
  if (typeof ack === 'function') (ack as Ack)({ ok: false, error });
};
const done = <T extends object>(ack: unknown, value?: T) => {
  if (typeof ack === 'function') (ack as Ack<T>)({ ok: true, ...(value ?? ({} as T)) });
};

export async function startServer(opts: ServerOptions = {}): Promise<RunningServer> {
  const store = opts.store ?? new MemoryStore();
  const log = opts.log ?? ((m: string) => console.log(`[island] ${m}`));
  const rooms = new RoomManager({ store, botDelayMs: opts.botDelayMs ?? 900, log });

  const app = express();
  app.disable('x-powered-by');
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, store: store.kind, rooms: rooms.rooms.size });
  });
  // Lets a returning browser check whether its saved room still exists before offering "Rejoin".
  app.get('/api/rooms/:code', async (req, res) => {
    try {
      res.json({ exists: !!(await rooms.get(req.params.code)) });
    } catch {
      res.status(500).json({ error: 'Could not look up the room' });
    }
  });
  app.get('/api/matches', async (_req, res) => {
    try {
      res.json(await store.recentMatches(20));
    } catch {
      res.status(500).json({ error: 'Could not load match history' });
    }
  });
  if (opts.clientDist && existsSync(path.join(opts.clientDist, 'index.html'))) {
    app.use(express.static(opts.clientDist, { index: false, maxAge: '1h' }));
    app.get('*', (_req, res) => res.sendFile(path.join(opts.clientDist!, 'index.html')));
  }

  const http = createServer(app);
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(http, {
    cors: opts.corsOrigins?.length ? { origin: opts.corsOrigins } : undefined,
    maxHttpBufferSize: 64 * 1024,
  });

  io.on('connection', (socket: GameSocket) => {
    const current = () => (socket.data.code ? rooms.rooms.get(socket.data.code) ?? null : null);
    const leaveCurrent = () => {
      const room = current();
      if (room) room.leave(socket);
    };

    socket.on('room:create', async (req, ack) => {
      const name = cleanName(req?.name);
      if (!name) return fail(ack, 'Enter a name');
      leaveCurrent();
      const room = await rooms.create();
      const added = room.addHuman(name, req?.avatar ?? 0);
      if ('error' in added) return fail(ack, added.error);
      room.record.hostSeat = 0;
      room.attach(socket, added.token);
      log(`Room ${room.code} created`);
      done<JoinResult>(ack, { code: room.code, seat: 0, token: added.token });
    });

    socket.on('room:join', async (req, ack) => {
      const room = await rooms.get(req?.code);
      if (!room) return fail(ack, 'No room with that code. Check the code and try again.');
      // Returning player: reclaim the seat with the saved token.
      if (typeof req?.token === 'string') {
        const seat = room.seatOf(req.token);
        if (seat >= 0) {
          if (current() !== room) leaveCurrent();
          room.attach(socket, req.token);
          return done<JoinResult>(ack, { code: room.code, seat, token: req.token });
        }
      }
      const name = cleanName(req?.name);
      if (!name) return fail(ack, 'Enter a name');
      const added = room.addHuman(name, req?.avatar ?? 0);
      if ('error' in added) return fail(ack, added.error);
      leaveCurrent();
      room.attach(socket, added.token);
      done<JoinResult>(ack, { code: room.code, seat: room.seatOf(added.token), token: added.token });
    });

    socket.on('room:leave', (ack) => {
      leaveCurrent();
      done(ack);
    });

    const withRoom = (ack: unknown, fn: (token: string, room: NonNullable<ReturnType<typeof current>>) => string | null) => {
      const room = current();
      const token = socket.data.token;
      if (!room || !token) return fail(ack, 'You are not in a room');
      const error = fn(token, room);
      if (error) fail(ack, error);
      else done(ack);
    };

    socket.on('room:seat', (req, ack) => withRoom(ack, (token, room) => room.updateSeat(token, req ?? {})));
    socket.on('room:addBot', (req, ack) => withRoom(ack, (token, room) => room.addBot(token, req?.level)));
    socket.on('room:removeSeat', (req, ack) => withRoom(ack, (token, room) => room.removeSeat(token, req?.seat)));
    socket.on('room:start', (ack) => withRoom(ack, (token, room) => room.start(token)));
    socket.on('room:newIsland', (ack) => withRoom(ack, (token, room) => room.newIsland(token)));
    socket.on('game:action', (action, ack) => withRoom(ack, (token, room) => room.act(token, action)));

    socket.on('disconnect', () => {
      const room = current();
      if (room) room.detach(socket);
    });
  });

  const sweep = setInterval(() => rooms.sweep(30 * 60_000), 10 * 60_000);
  sweep.unref();

  await new Promise<void>((resolve) => http.listen(opts.port ?? 0, resolve));
  const port = (http.address() as AddressInfo).port;
  return {
    url: `http://localhost:${port}`,
    port,
    http,
    io,
    rooms,
    store,
    async close() {
      clearInterval(sweep);
      await rooms.shutdown();
      await new Promise<void>((resolve) => io.close(() => resolve()));
      await store.close();
    },
  };
}
