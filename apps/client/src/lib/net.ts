import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@island/engine';

export type GameSocketClient = Socket<ServerToClientEvents, ClientToServerEvents>;
export type AckResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

let socket: GameSocketClient | null = null;

/**
 * The single Socket.IO connection to the game server. In development Vite proxies
 * /socket.io to the server on port 3001; in production the server serves this client,
 * so the same origin works. VITE_SERVER_URL can point elsewhere.
 */
export function getSocket(): GameSocketClient {
  if (!socket) {
    const url = (import.meta.env.VITE_SERVER_URL as string | undefined) || undefined;
    socket = io(url ?? '', { transports: ['websocket', 'polling'], reconnectionDelayMax: 4000 });
  }
  return socket;
}

/** Emit an event and wait for the server's acknowledgement (8 s timeout). */
export function request<T = object>(event: keyof ClientToServerEvents, ...args: unknown[]): Promise<AckResult<T>> {
  const s = getSocket();
  return new Promise((resolve) => {
    const timer = window.setTimeout(
      () => resolve({ ok: false, error: s.connected ? 'The server did not answer. Try again.' : 'Cannot reach the game server. Check your connection.' }),
      8000,
    );
    (s.emit as (...a: unknown[]) => void)(event, ...args, (res: AckResult<T>) => {
      window.clearTimeout(timer);
      resolve(res);
    });
  });
}
