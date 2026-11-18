import { useState } from 'react';
import { motion } from 'framer-motion';
import { AI_LEVELS, MAX_PLAYERS, MIN_PLAYERS, PLAYER_COLORS, ROOM_CODE_LENGTH, type AILevel } from '@island/engine';
import { PLAYER_PALETTE } from '../lib/colors';
import { playSound } from '../lib/sound';
import { useGameStore } from '../store/useGameStore';
import { Avatar, AVATAR_COUNT } from '../ui/Avatar';
import { BackIcon, PlayIcon, UsersIcon } from '../ui/icons';

const fade = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
  transition: { duration: 0.3 },
};

const NAME_KEY = 'island-settlers:online-name';
const LEVEL_LABEL: Record<AILevel, string> = { easy: 'Easy', normal: 'Normal', hard: 'Hard' };

function loadName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}
function saveName(name: string) {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    /* ignore */
  }
}

/** Create a room or join one with a code. */
export function OnlineHome() {
  const setScreen = useGameStore((s) => s.setScreen);
  const createRoom = useGameStore((s) => s.createRoom);
  const joinRoom = useGameStore((s) => s.joinRoom);
  const [name, setName] = useState(loadName);
  const [avatar, setAvatar] = useState(0);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);
  const nameOk = name.trim().length > 0;
  const codeOk = code.length === ROOM_CODE_LENGTH;

  const run = async (kind: 'create' | 'join') => {
    if (!nameOk || busy) return;
    playSound('click');
    saveName(name.trim());
    setBusy(kind);
    if (kind === 'create') await createRoom(name.trim(), avatar);
    else await joinRoom(code, name.trim(), avatar);
    setBusy(null);
  };

  return (
    <motion.div {...fade} className="relative z-10 flex h-full items-center justify-center overflow-y-auto p-4">
      <div className="panel-wood w-full max-w-lg p-6">
        <h1 className="font-display text-4xl text-parchment-50">Play online</h1>
        <p className="mt-1 text-parchment-200/85">Create a room and share its code, or join a friend's room.</p>

        <div className="mt-5 flex items-center gap-3">
          <button title="Change avatar" onClick={() => setAvatar((a) => (a + 1) % AVATAR_COUNT)} className="rounded-full transition hover:scale-105">
            <Avatar index={avatar} ring="#e2b65a" size={52} />
          </button>
          <label className="min-w-0 flex-1">
            <span className="text-sm text-parchment-200">Your name</span>
            <input
              id="online-name"
              value={name}
              maxLength={20}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ana"
              className="mt-1 block w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 font-display text-lg text-parchment-50 outline-none focus:border-gold-400"
            />
          </label>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <section className="rounded-xl border border-gold-600/30 bg-black/20 p-4">
            <h2 className="font-display text-xl text-gold-300">New room</h2>
            <p className="mt-1 text-sm text-parchment-300/80">You'll be the host: invite friends, add computer players and start the game.</p>
            <button className="btn-primary mt-3 w-full" disabled={!nameOk || busy !== null} onClick={() => run('create')}>
              <UsersIcon width={18} height={18} /> {busy === 'create' ? 'Creating…' : 'Create room'}
            </button>
          </section>
          <section className="rounded-xl border border-gold-600/30 bg-black/20 p-4">
            <h2 className="font-display text-xl text-gold-300">Join a room</h2>
            <input
              id="online-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, ROOM_CODE_LENGTH))}
              onKeyDown={(e) => e.key === 'Enter' && codeOk && run('join')}
              placeholder="ROOM CODE"
              aria-label="Room code"
              className="mt-2 block w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-center font-mono text-xl tracking-[0.3em] text-parchment-50 outline-none focus:border-gold-400"
            />
            <button className="btn-wood mt-3 w-full" disabled={!nameOk || !codeOk || busy !== null} onClick={() => run('join')}>
              <PlayIcon width={16} height={16} /> {busy === 'join' ? 'Joining…' : 'Join'}
            </button>
          </section>
        </div>
        {!nameOk && <p className="mt-3 text-sm text-parchment-300/70">Enter your name to create or join a room.</p>}

        <div className="mt-6">
          <button className="btn-wood" onClick={() => setScreen('mode')}>
            <BackIcon width={18} height={18} /> Back
          </button>
        </div>
      </div>
    </motion.div>
  );
}

/** Waiting room: everyone sees the seats; the host adds computer players and starts. */
export function LobbyScreen() {
  const online = useGameStore((s) => s.online);
  const leaveRoom = useGameStore((s) => s.leaveRoom);
  const updateSeat = useGameStore((s) => s.updateSeat);
  const addBot = useGameStore((s) => s.addBot);
  const removeSeat = useGameStore((s) => s.removeSeat);
  const start = useGameStore((s) => s.startOnlineGame);
  const pushToast = useGameStore((s) => s.pushToast);
  const [level, setLevel] = useState<AILevel>('normal');
  const [copied, setCopied] = useState(false);
  const lobby = online?.lobby;

  if (!online) return null;
  const seats = lobby?.seats ?? [];
  const me = seats.find((s) => s.seat === online.seat);
  const isHost = !!me?.isHost;
  const full = seats.length >= MAX_PLAYERS;
  const canStart = seats.length >= MIN_PLAYERS;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(online.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      pushToast(`Room code: ${online.code}`, 'info');
    }
  };

  return (
    <motion.div {...fade} className="relative z-10 flex h-full items-center justify-center overflow-y-auto p-4">
      <div className="panel-wood w-full max-w-2xl p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl text-parchment-50">Waiting room</h1>
            <p className="mt-1 text-parchment-200/85">
              {isHost ? 'Share the code with friends. Start when 3–4 settlers are seated.' : 'The host will start the game when everyone is ready.'}
            </p>
          </div>
          <button onClick={copy} className="rounded-xl border-2 border-gold-500/60 bg-black/40 px-4 py-2 text-center transition hover:border-gold-300" title="Copy room code">
            <span className="block text-xs uppercase tracking-widest text-parchment-300/75">{copied ? 'Copied!' : 'Room code'}</span>
            <span className="font-mono text-3xl tracking-[0.25em] text-gold-300">{online.code}</span>
          </button>
        </div>

        {online.connection !== 'connected' && (
          <p className="mt-3 rounded-lg border border-red-400/40 bg-red-950/50 px-3 py-2 text-sm text-red-100">Reconnecting to the server…</p>
        )}

        <ul className="mt-5 space-y-2.5">
          {seats.map((s) => {
            const pal = PLAYER_PALETTE[s.color];
            const mine = s.seat === online.seat;
            return (
              <motion.li
                layout
                key={`${s.seat}-${s.name}`}
                className="flex flex-wrap items-center gap-3 rounded-xl border-2 p-2.5"
                style={{ borderColor: `${pal.accent}99`, background: `linear-gradient(135deg, ${pal.panelFrom}, ${pal.panelTo})` }}
              >
                <Avatar index={s.avatar} ring={pal.accent} size={44} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-display text-lg text-parchment-50">
                    {s.name} {mine && <span className="text-sm text-gold-300">(you)</span>}
                  </div>
                  <div className="text-xs text-parchment-200/80">
                    {s.isAI ? `Computer · ${LEVEL_LABEL[s.aiLevel ?? 'normal']}` : s.connected ? 'Connected' : 'Disconnected'}
                    {s.isHost && ' · Host'}
                  </div>
                </div>
                {mine && (
                  <div className="flex gap-1.5">
                    {PLAYER_COLORS.map((c) => {
                      const taken = seats.some((o) => o.color === c && o.seat !== s.seat);
                      return (
                        <button
                          key={c}
                          disabled={taken}
                          onClick={() => updateSeat({ color: c })}
                          title={taken ? `${PLAYER_PALETTE[c].label} is taken` : PLAYER_PALETTE[c].label}
                          className={`h-7 w-7 rounded-full border-2 transition disabled:cursor-not-allowed disabled:opacity-25 ${s.color === c ? 'scale-110 border-white' : 'border-black/40 hover:scale-105'}`}
                          style={{ background: PLAYER_PALETTE[c].piece }}
                        />
                      );
                    })}
                  </div>
                )}
                {isHost && !mine && (
                  <button className="rounded-lg border border-white/20 bg-black/30 px-2.5 py-1 text-sm hover:border-red-300 hover:text-red-200" onClick={() => removeSeat(s.seat)}>
                    Remove
                  </button>
                )}
              </motion.li>
            );
          })}
          {Array.from({ length: Math.max(0, MAX_PLAYERS - seats.length) }, (_, i) => (
            <li key={`empty-${i}`} className="rounded-xl border-2 border-dashed border-gold-600/25 p-3 text-center text-sm text-parchment-300/60">
              Empty seat
            </li>
          ))}
        </ul>

        {isHost && !full && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <select
              id="bot-level"
              value={level}
              onChange={(e) => setLevel(e.target.value as AILevel)}
              aria-label="Computer difficulty"
              className="rounded-lg border border-white/20 bg-black/40 px-2 py-2 font-display text-parchment-50 outline-none focus:border-gold-400"
            >
              {AI_LEVELS.map((l) => (
                <option key={l} value={l} className="bg-wood-900">
                  {LEVEL_LABEL[l]}
                </option>
              ))}
            </select>
            <button className="btn-wood" onClick={() => addBot(level)}>
              Add computer player
            </button>
          </div>
        )}

        <div className="mt-6 flex flex-wrap justify-between gap-3">
          <button className="btn-wood" onClick={leaveRoom}>
            <BackIcon width={18} height={18} /> Leave room
          </button>
          {isHost && (
            <button className="btn-primary" disabled={!canStart} onClick={() => start()} title={canStart ? 'Start the game' : `Seat at least ${MIN_PLAYERS} players`}>
              <PlayIcon width={18} height={18} /> Start game
            </button>
          )}
        </div>
        {isHost && !canStart && <p className="mt-2 text-right text-sm text-parchment-300/70">Seat at least {MIN_PLAYERS} players to start.</p>}
      </div>
    </motion.div>
  );
}
