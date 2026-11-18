import type { AILevel, GameState, PlayerColor } from '@island/engine';
import type pg from 'pg';

/** A seat as stored on the server. `token` is the secret that lets a browser reclaim it. */
export interface StoredSeat {
  name: string;
  color: PlayerColor;
  avatar: number;
  isAI: boolean;
  aiLevel?: AILevel;
  /** null for computer players. */
  token: string | null;
}

export interface RoomRecord {
  code: string;
  status: 'lobby' | 'playing' | 'finished';
  hostSeat: number;
  seats: StoredSeat[];
  game: GameState | null;
  seq: number;
  createdAt: number;
  updatedAt: number;
}

export interface MatchRecord {
  code: string;
  finishedAt: number;
  winner: string;
  turns: number;
  players: { name: string; color: PlayerColor; isAI: boolean; vp: number }[];
}

/** Where rooms (for reconnection and server restarts) and finished matches are kept. */
export interface RoomStore {
  readonly kind: 'memory' | 'postgres';
  load(code: string): Promise<RoomRecord | null>;
  save(room: RoomRecord): Promise<void>;
  remove(code: string): Promise<void>;
  recordMatch(match: MatchRecord): Promise<void>;
  recentMatches(limit: number): Promise<MatchRecord[]>;
  close(): Promise<void>;
}

const clone = <T,>(x: T): T => structuredClone(x);

/** Default store: everything lives in the server process (lost on restart). */
export class MemoryStore implements RoomStore {
  readonly kind = 'memory' as const;
  private rooms = new Map<string, RoomRecord>();
  private matches: MatchRecord[] = [];

  async load(code: string) {
    const r = this.rooms.get(code);
    return r ? clone(r) : null;
  }
  async save(room: RoomRecord) {
    this.rooms.set(room.code, clone(room));
  }
  async remove(code: string) {
    this.rooms.delete(code);
  }
  async recordMatch(match: MatchRecord) {
    this.matches.unshift(clone(match));
    this.matches.length = Math.min(this.matches.length, 500);
  }
  async recentMatches(limit: number) {
    return clone(this.matches.slice(0, limit));
  }
  async close() {}
}

/** PostgreSQL (or Supabase, which is Postgres) store. Tables are created on first use. */
export class PostgresStore implements RoomStore {
  readonly kind = 'postgres' as const;
  constructor(private pool: pg.Pool) {}

  async init(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS island_rooms (
        code TEXT PRIMARY KEY,
        data JSONB NOT NULL,
        status TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS island_matches (
        id SERIAL PRIMARY KEY,
        code TEXT NOT NULL,
        finished_at TIMESTAMPTZ NOT NULL,
        winner TEXT NOT NULL,
        turns INTEGER NOT NULL,
        players JSONB NOT NULL
      )`);
  }

  async load(code: string) {
    const res = await this.pool.query<{ data: RoomRecord }>('SELECT data FROM island_rooms WHERE code = $1', [code]);
    return res.rows[0]?.data ?? null;
  }

  async save(room: RoomRecord) {
    await this.pool.query(
      `INSERT INTO island_rooms (code, data, status, updated_at) VALUES ($1, $2, $3, now())
       ON CONFLICT (code) DO UPDATE SET data = EXCLUDED.data, status = EXCLUDED.status, updated_at = now()`,
      [room.code, JSON.stringify(room), room.status],
    );
  }

  async remove(code: string) {
    await this.pool.query('DELETE FROM island_rooms WHERE code = $1', [code]);
  }

  async recordMatch(m: MatchRecord) {
    await this.pool.query('INSERT INTO island_matches (code, finished_at, winner, turns, players) VALUES ($1, $2, $3, $4, $5)', [
      m.code,
      new Date(m.finishedAt),
      m.winner,
      m.turns,
      JSON.stringify(m.players),
    ]);
  }

  async recentMatches(limit: number) {
    const res = await this.pool.query<{ code: string; finished_at: Date; winner: string; turns: number; players: MatchRecord['players'] }>(
      'SELECT code, finished_at, winner, turns, players FROM island_matches ORDER BY finished_at DESC, id DESC LIMIT $1',
      [limit],
    );
    return res.rows.map((r) => ({ code: r.code, finishedAt: new Date(r.finished_at).getTime(), winner: r.winner, turns: r.turns, players: r.players }));
  }

  async close() {
    await this.pool.end();
  }
}

/** Pick a store from the environment: Postgres when DATABASE_URL is set, otherwise memory. */
export async function storeFromEnv(env: NodeJS.ProcessEnv = process.env): Promise<RoomStore> {
  const url = env.DATABASE_URL;
  if (!url) return new MemoryStore();
  const { default: pgLib } = await import('pg');
  const needsSsl = env.PGSSL === '1' || /supabase\.(co|com)|sslmode=require/.test(url);
  const pool = new pgLib.Pool({ connectionString: url, max: 5, ...(needsSsl ? { ssl: { rejectUnauthorized: false } } : {}) });
  const store = new PostgresStore(pool);
  await store.init();
  return store;
}
