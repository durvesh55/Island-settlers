import { randomInt, randomUUID } from 'node:crypto';
import {
  applyAction,
  chooseAIAction,
  createGame,
  MAX_PLAYERS,
  MIN_PLAYERS,
  newAIMemory,
  pendingAIPlayers,
  PLAYER_COLORS,
  recordAIAction,
  redactEvents,
  redactFor,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  totalVictoryPoints,
  type AILevel,
  type AIMemory,
  type ClientToServerEvents,
  type GameAction,
  type GameEvent,
  type LobbyView,
  type PlayerColor,
  type ServerToClientEvents,
} from '@island/engine';
import type { Socket } from 'socket.io';
import type { RoomRecord, RoomStore, StoredSeat } from './store';

export type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, { code?: string; token?: string }>;

const BOT_NAMES = ['Ottilie', 'Maren', 'Tobin', 'Sela', 'Brann', 'Ivo'];
const MAX_AVATAR = 5;

export interface RoomOptions {
  store: RoomStore;
  /** Base pause before a computer player acts (ms). */
  botDelayMs: number;
  log?: (msg: string) => void;
}

export function cleanName(name: unknown): string | null {
  if (typeof name !== 'string') return null;
  const n = name.replace(/\s+/g, ' ').trim().slice(0, 20);
  return n.length > 0 ? n : null;
}

const cleanAvatar = (a: unknown) => (Number.isInteger(a) ? Math.max(0, Math.min(MAX_AVATAR, a as number)) : 0);

/** A single online room: its lobby, its game, the sockets attached to each seat and its computer players. */
export class Room {
  /** token → sockets currently attached for that seat (a player may have several tabs open). */
  private sockets = new Map<string, Set<GameSocket>>();
  private botTimer: NodeJS.Timeout | undefined;
  private memos: AIMemory[] = [];
  private saving: Promise<void> = Promise.resolve();
  closed = false;

  constructor(
    public record: RoomRecord,
    private opts: RoomOptions,
  ) {
    this.memos = record.seats.map(() => newAIMemory());
  }

  get code() {
    return this.record.code;
  }

  seatOf(token: string | undefined): number {
    return token ? this.record.seats.findIndex((s) => s.token === token) : -1;
  }

  isConnected(token: string | null): boolean {
    return !!token && (this.sockets.get(token)?.size ?? 0) > 0;
  }

  hasConnectedHumans(): boolean {
    return this.record.seats.some((s) => this.isConnected(s.token));
  }

  /* ───────────── persistence & broadcasting ───────────── */

  private persist(): void {
    this.record.updatedAt = Date.now();
    const snapshot = structuredClone(this.record);
    this.saving = this.saving
      .then(() => this.opts.store.save(snapshot))
      .catch((err) => this.opts.log?.(`Failed to save room ${this.code}: ${String(err)}`));
  }

  /** Resolves once every pending save has been written. */
  flush(): Promise<void> {
    return this.saving;
  }

  lobbyFor(seat: number): LobbyView {
    return {
      code: this.code,
      status: this.record.status,
      you: seat,
      seats: this.record.seats.map((s, i) => ({
        seat: i,
        name: s.name,
        color: s.color,
        avatar: s.avatar,
        isAI: s.isAI,
        ...(s.isAI ? { aiLevel: s.aiLevel ?? 'normal' } : {}),
        connected: s.isAI || this.isConnected(s.token),
        isHost: i === this.record.hostSeat,
      })),
    };
  }

  private eachSocket(fn: (socket: GameSocket, seat: number) => void): void {
    for (const [token, set] of this.sockets) {
      const seat = this.seatOf(token);
      for (const socket of set) fn(socket, seat);
    }
  }

  broadcastLobby(): void {
    this.eachSocket((socket, seat) => socket.emit('room:lobby', this.lobbyFor(seat)));
  }

  private sendGame(socket: GameSocket, seat: number, events: GameEvent[]): void {
    const game = this.record.game;
    if (!game) return;
    socket.emit('game:update', { state: redactFor(game, seat), events: redactEvents(events, seat), seq: this.record.seq });
  }

  private broadcastGame(events: GameEvent[]): void {
    this.eachSocket((socket, seat) => this.sendGame(socket, seat, events));
  }

  /* ───────────── sockets ───────────── */

  attach(socket: GameSocket, token: string): void {
    let set = this.sockets.get(token);
    if (!set) this.sockets.set(token, (set = new Set()));
    set.add(socket);
    socket.data.code = this.code;
    socket.data.token = token;
    this.broadcastLobby();
    this.sendGame(socket, this.seatOf(token), []);
  }

  detach(socket: GameSocket): void {
    const token = socket.data.token;
    if (!token) return;
    this.sockets.get(token)?.delete(socket);
    if (this.sockets.get(token)?.size === 0) this.sockets.delete(token);
    socket.data.code = undefined;
    socket.data.token = undefined;
    this.broadcastLobby();
  }

  private kick(token: string, reason: string): void {
    for (const socket of this.sockets.get(token) ?? []) {
      socket.emit('room:closed', reason);
      socket.data.code = undefined;
      socket.data.token = undefined;
    }
    this.sockets.delete(token);
  }

  /* ───────────── lobby ───────────── */

  private freeColor(): PlayerColor | null {
    return PLAYER_COLORS.find((c) => !this.record.seats.some((s) => s.color === c)) ?? null;
  }

  /** Add a human seat. Returns its token, or an error. */
  addHuman(name: string, avatar: number): { token: string } | { error: string } {
    if (this.record.status !== 'lobby') return { error: 'That game has already started' };
    const color = this.freeColor();
    if (!color || this.record.seats.length >= MAX_PLAYERS) return { error: 'That room is full' };
    const token = randomUUID();
    this.record.seats.push({ name, color, avatar: cleanAvatar(avatar), isAI: false, token });
    this.memos.push(newAIMemory());
    this.persist();
    return { token };
  }

  addBot(byToken: string, level: AILevel): string | null {
    if (this.seatOf(byToken) !== this.record.hostSeat) return 'Only the host can add computer players';
    if (this.record.status !== 'lobby') return 'The game has already started';
    const color = this.freeColor();
    if (!color || this.record.seats.length >= MAX_PLAYERS) return 'The room is full';
    if (!['easy', 'normal', 'hard'].includes(level)) return 'Unknown difficulty';
    const used = new Set(this.record.seats.map((s) => s.name));
    const name = BOT_NAMES.find((n) => !used.has(n)) ?? `Computer ${this.record.seats.length + 1}`;
    this.record.seats.push({ name, color, avatar: (this.record.seats.length + 3) % (MAX_AVATAR + 1), isAI: true, aiLevel: level, token: null });
    this.memos.push(newAIMemory());
    this.persist();
    this.broadcastLobby();
    return null;
  }

  updateSeat(token: string, patch: { name?: unknown; avatar?: unknown; color?: unknown }): string | null {
    const seat = this.seatOf(token);
    if (seat < 0) return 'You are not in this room';
    if (this.record.status !== 'lobby') return 'Seats are fixed once the game starts';
    const s = this.record.seats[seat];
    if (patch.name !== undefined) {
      const n = cleanName(patch.name);
      if (!n) return 'Enter a name';
      s.name = n;
    }
    if (patch.avatar !== undefined) s.avatar = cleanAvatar(patch.avatar);
    if (patch.color !== undefined) {
      if (!PLAYER_COLORS.includes(patch.color as PlayerColor)) return 'Unknown color';
      const taken = this.record.seats.find((o) => o !== s && o.color === patch.color);
      if (taken) return `${taken.name} already has that color`;
      s.color = patch.color as PlayerColor;
    }
    this.persist();
    this.broadcastLobby();
    return null;
  }

  removeSeat(byToken: string, seat: number): string | null {
    if (this.seatOf(byToken) !== this.record.hostSeat) return 'Only the host can remove players';
    if (this.record.status !== 'lobby') return 'Players cannot be removed once the game starts';
    if (!Number.isInteger(seat) || !this.record.seats[seat]) return 'No such seat';
    if (seat === this.record.hostSeat) return 'The host cannot remove themselves — leave the room instead';
    this.dropSeat(seat, 'The host removed you from the room');
    return null;
  }

  /** Remove a seat in the lobby, keeping the host pointer and per-seat memories in step. */
  private dropSeat(seat: number, reason: string | null): void {
    const [removed] = this.record.seats.splice(seat, 1);
    this.memos.splice(seat, 1);
    if (removed.token && reason) this.kick(removed.token, reason);
    if (seat < this.record.hostSeat) this.record.hostSeat--;
    else if (seat === this.record.hostSeat) {
      this.record.hostSeat = Math.max(0, this.record.seats.findIndex((s) => !s.isAI));
    }
    this.persist();
    this.broadcastLobby();
  }

  /** A player leaves. In the lobby their seat is freed; during a game it is kept so they can return. */
  leave(socket: GameSocket): void {
    const token = socket.data.token;
    const seat = this.seatOf(token);
    this.detach(socket);
    if (this.record.status !== 'lobby' || seat < 0 || this.isConnected(token ?? null)) return;
    this.dropSeat(seat, null);
    if (!this.record.seats.some((s) => !s.isAI)) this.close('Everyone left the room');
  }

  start(byToken: string, seed?: number): string | null {
    if (this.seatOf(byToken) !== this.record.hostSeat) return 'Only the host can start the game';
    if (this.record.status !== 'lobby') return 'The game has already started';
    const n = this.record.seats.length;
    if (n < MIN_PLAYERS) return `A game needs at least ${MIN_PLAYERS} players — invite a friend or add a computer player`;
    this.record.game = createGame({
      seed,
      players: this.record.seats.map((s: StoredSeat) => ({ name: s.name, color: s.color, avatar: s.avatar, isAI: s.isAI, aiLevel: s.aiLevel })),
    });
    this.record.status = 'playing';
    this.record.seq++;
    this.memos = this.record.seats.map(() => newAIMemory());
    this.persist();
    this.broadcastLobby();
    this.broadcastGame([]);
    this.scheduleBots();
    return null;
  }

  /* ───────────── game ───────────── */

  act(token: string, action: GameAction): string | null {
    const game = this.record.game;
    if (!game || this.record.status === 'lobby') return 'The game has not started yet';
    const seat = this.seatOf(token);
    if (seat < 0) return 'You are not in this room';
    if (!action || typeof action !== 'object' || typeof action.type !== 'string') return 'Invalid action';
    if (action.player !== seat) return 'You can only act for your own seat';
    return this.apply(action);
  }

  private apply(action: GameAction): string | null {
    const game = this.record.game!;
    let result;
    try {
      result = applyAction(game, action);
    } catch {
      return 'Invalid action';
    }
    if (!result.ok) return result.error;
    this.record.game = result.state;
    this.record.seq++;
    if (result.state.phase === 'gameOver' && this.record.status !== 'finished') {
      this.record.status = 'finished';
      void this.recordMatch();
      this.broadcastLobby();
    }
    this.persist();
    this.broadcastGame(result.events);
    this.scheduleBots();
    return null;
  }

  private async recordMatch(): Promise<void> {
    const g = this.record.game!;
    try {
      await this.opts.store.recordMatch({
        code: this.code,
        finishedAt: Date.now(),
        winner: g.players[g.winner!].name,
        turns: g.turn,
        players: g.players.map((p) => ({ name: p.name, color: p.color, isAI: p.isAI, vp: totalVictoryPoints(g, p.id) })),
      });
    } catch (err) {
      this.opts.log?.(`Failed to record match ${this.code}: ${String(err)}`);
    }
  }

  /** Let the next computer player with something to do act, after a short pause. */
  scheduleBots(): void {
    clearTimeout(this.botTimer);
    const game = this.record.game;
    if (!game || this.closed || game.phase === 'gameOver') return;
    for (const id of pendingAIPlayers(game)) {
      const memo = this.memos[id] ?? (this.memos[id] = newAIMemory());
      const action = chooseAIAction(game, id, memo);
      if (!action) continue;
      const factor = action.type === 'END_TURN' || action.type === 'MOVE_ROBBER' ? 1.2 : action.type === 'RESPOND_TRADE' || action.type === 'DISCARD' ? 0.7 : 1;
      this.botTimer = setTimeout(() => {
        if (this.record.game !== game || this.closed) return;
        const error = this.apply(action);
        if (error === null) recordAIAction(memo, game, action);
        else {
          this.opts.log?.(`Computer player ${id} in ${this.code} was refused ${action.type}: ${error}`);
          if (game.currentPlayer === id && game.phase === 'main') this.apply({ type: 'END_TURN', player: id });
        }
      }, this.opts.botDelayMs * factor);
      return;
    }
  }

  close(reason: string): void {
    this.closed = true;
    clearTimeout(this.botTimer);
    for (const token of [...this.sockets.keys()]) this.kick(token, reason);
    void this.opts.store.remove(this.code).catch(() => {});
  }

  /** Stop timers without deleting anything (server shutdown / eviction from memory). */
  suspend(): void {
    clearTimeout(this.botTimer);
  }
}

/** Every room this server process currently holds; rooms are loaded from the store on demand. */
export class RoomManager {
  rooms = new Map<string, Room>();

  constructor(private opts: RoomOptions) {}

  private newCode(): string {
    for (;;) {
      let code = '';
      for (let i = 0; i < ROOM_CODE_LENGTH; i++) code += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
      if (!this.rooms.has(code)) return code;
    }
  }

  async create(): Promise<Room> {
    let code = this.newCode();
    while (await this.opts.store.load(code)) code = this.newCode();
    const now = Date.now();
    const room = new Room({ code, status: 'lobby', hostSeat: 0, seats: [], game: null, seq: 0, createdAt: now, updatedAt: now }, this.opts);
    this.rooms.set(code, room);
    return room;
  }

  async get(codeIn: string): Promise<Room | null> {
    const code = String(codeIn ?? '').trim().toUpperCase();
    if (code.length !== ROOM_CODE_LENGTH) return null;
    const live = this.rooms.get(code);
    if (live && !live.closed) return live;
    const record = await this.opts.store.load(code);
    if (!record) return null;
    const room = new Room(record, this.opts);
    this.rooms.set(code, room);
    room.scheduleBots(); // resume computer players after a restart
    return room;
  }

  /** Free memory held by idle rooms (they stay in the store and reload on the next join). */
  sweep(idleMs: number): void {
    const now = Date.now();
    for (const [code, room] of this.rooms) {
      if (room.closed || (!room.hasConnectedHumans() && now - room.record.updatedAt > idleMs)) {
        room.suspend();
        this.rooms.delete(code);
      }
    }
  }

  async shutdown(): Promise<void> {
    for (const room of this.rooms.values()) {
      room.suspend();
      await room.flush();
    }
  }
}
