import type { AILevel, DevCardType, PlayerColor } from './constants';
import type { GameAction, GameEvent } from './action-types';
import { emptyBundle, totalCards } from './resources';
import type { GameState, Player } from './types';

/* ───────────────────────────── Hidden information ───────────────────────────── */

/** Cards in a player's hand — works on full states and on redacted online views. */
export function handSize(p: Player): number {
  return p.handCount ?? totalCards(p.resources);
}

/** Development cards a player holds (playable + bought this turn). */
export function devCardTotal(p: Player): number {
  return p.devCardCount ?? p.devCards.length + p.newDevCards.length;
}

/**
 * The copy of the game a given seat is allowed to see online. Other players' resource cards and
 * development cards become counts only, the deck's order is hidden, and the RNG state is removed
 * so nobody can predict dice or draws. When the game is over everything is revealed.
 */
export function redactFor(state: GameState, seat: number | null): GameState {
  if (state.phase === 'gameOver') return { ...state, rngState: 0, viewer: seat ?? undefined };
  return {
    ...state,
    viewer: seat ?? undefined,
    rngState: 0,
    devDeck: state.devDeck.map((): DevCardType => 'knight'),
    players: state.players.map((p) =>
      p.id === seat
        ? p
        : {
            ...p,
            resources: emptyBundle(),
            devCards: [],
            newDevCards: [],
            handCount: totalCards(p.resources),
            devCardCount: p.devCards.length + p.newDevCards.length,
          },
    ),
  };
}

/** Hide event details that only the players involved may know. */
export function redactEvents(events: GameEvent[], seat: number | null): GameEvent[] {
  return events.map((e) => {
    if (e.type === 'devCardBought' && e.player !== seat) return { type: 'devCardBought', player: e.player };
    if (e.type === 'stolen' && e.thief !== seat && e.victim !== seat) return { ...e, resource: null };
    return e;
  });
}

/* ───────────────────────────── Network protocol ───────────────────────────── */

export const ROOM_CODE_LENGTH = 5;
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** One seat in an online room, as every client sees it (no secrets). */
export interface SeatView {
  seat: number;
  name: string;
  color: PlayerColor;
  avatar: number;
  isAI: boolean;
  aiLevel?: AILevel;
  connected: boolean;
  isHost: boolean;
}

export interface LobbyView {
  code: string;
  status: 'lobby' | 'playing' | 'finished';
  seats: SeatView[];
  /** The receiving client's own seat. */
  you: number;
}

export interface JoinResult {
  code: string;
  seat: number;
  /** Secret that lets this browser reclaim its seat after a disconnect. */
  token: string;
}

export type Ack<T = object> = (res: ({ ok: true } & T) | { ok: false; error: string }) => void;

export interface GameUpdate {
  /** Redacted for the receiving seat. */
  state: GameState;
  events: GameEvent[];
  /** Increases by one with every change to the game. */
  seq: number;
}

export interface ClientToServerEvents {
  'room:create': (req: { name: string; avatar: number }, ack: Ack<JoinResult>) => void;
  'room:join': (req: { code: string; name?: string; avatar?: number; token?: string }, ack: Ack<JoinResult>) => void;
  'room:leave': (ack?: Ack) => void;
  'room:seat': (req: { name?: string; avatar?: number; color?: PlayerColor }, ack: Ack) => void;
  'room:addBot': (req: { level: AILevel }, ack: Ack) => void;
  'room:removeSeat': (req: { seat: number }, ack: Ack) => void;
  'room:start': (ack: Ack) => void;
  'game:action': (action: GameAction, ack: Ack) => void;
}

export interface ServerToClientEvents {
  'room:lobby': (lobby: LobbyView) => void;
  'game:update': (update: GameUpdate) => void;
  /** This browser lost its seat (removed by the host, or the room closed). */
  'room:closed': (reason: string) => void;
}
