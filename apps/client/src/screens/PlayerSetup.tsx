import { useState } from 'react';
import { motion } from 'framer-motion';
import { AI_LEVELS, PLAYER_COLORS, type AILevel, type PlayerColor, type PlayerConfig } from '@island/engine';
import { PLAYER_PALETTE } from '../lib/colors';
import { playSound } from '../lib/sound';
import { useGameStore, type GameMode } from '../store/useGameStore';
import { Avatar, AVATAR_COUNT } from '../ui/Avatar';
import { BackIcon, PlayIcon } from '../ui/icons';

const DEFAULT_NAMES = ['Player 1', 'Player 2', 'Player 3', 'Player 4', 'Player 5', 'Player 6'];
/** Names for computer settlers (seat 0 is normally the human). */
const AI_NAMES = ['Ottilie', 'Maren', 'Tobin', 'Sela', 'Ines', 'Bram'];

const LEVEL_LABEL: Record<AILevel, string> = { easy: 'Easy', normal: 'Normal', hard: 'Hard' };

/** Starting seats: all humans for pass-and-play; you plus computer opponents for single player. */
export function defaultPlayers(count: number, mode: GameMode | null = 'local'): PlayerConfig[] {
  return Array.from({ length: count }, (_, i) => {
    const ai = mode === 'single' && i > 0;
    return {
      name: ai ? AI_NAMES[i] : mode === 'single' ? 'You' : DEFAULT_NAMES[i],
      color: PLAYER_COLORS[i],
      avatar: i,
      isAI: ai,
      ...(ai ? { aiLevel: 'normal' as AILevel } : {}),
    };
  });
}

export function PlayerSetup() {
  const setScreen = useGameStore((s) => s.setScreen);
  const startGame = useGameStore((s) => s.startGame);
  const pushToast = useGameStore((s) => s.pushToast);
  const mode = useGameStore((s) => s.mode);
  const [players, setPlayers] = useState<PlayerConfig[]>(() => defaultPlayers(4, mode));
  const noHuman = players.every((p) => p.isAI);

  const toggleAI = (i: number) =>
    setPlayers((ps) =>
      ps.map((p, j) => {
        if (j !== i) return p;
        if (p.isAI) return { ...p, isAI: false, aiLevel: undefined, name: DEFAULT_NAMES[i] };
        return { ...p, isAI: true, aiLevel: 'normal', name: AI_NAMES[i] };
      }),
    );
  const [seedText, setSeedText] = useState('');

  const update = (i: number, patch: Partial<PlayerConfig>) =>
    setPlayers((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  const setColor = (i: number, color: PlayerColor) => {
    // swap with whoever already holds that color so colors stay unique
    setPlayers((ps) => {
      const other = ps.findIndex((p) => p.color === color);
      return ps.map((p, j) => (j === i ? { ...p, color } : j === other ? { ...p, color: ps[i].color } : p));
    });
  };

  const setCount = (n: number) =>
    setPlayers((ps) => (n < ps.length ? ps.slice(0, n) : [...ps, ...defaultPlayers(6, mode).slice(ps.length, n).map((p) => ({ ...p, color: PLAYER_COLORS.find((c) => !ps.some((q) => q.color === c))! }))]));

  const start = () => {
    if (noHuman) {
      pushToast('At least one seat must be a human player', 'error');
      return;
    }
    const seed = seedText.trim() === '' ? undefined : Number(seedText);
    if (seed !== undefined && (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff)) {
      pushToast('Island code must be a whole number between 0 and 4294967295', 'error');
      return;
    }
    try {
      playSound('click');
      startGame(players, seed);
    } catch (e) {
      pushToast(e instanceof Error ? e.message : 'Could not start the game', 'error');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="relative z-10 flex h-full items-center justify-center overflow-y-auto p-4"
    >
      <div className="panel-wood w-full max-w-2xl p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-4xl text-parchment-50">Gather your settlers</h1>
          <div className="flex rounded-lg border border-gold-600/40 bg-black/30 p-1">
            {[3, 4, 5, 6].map((n) => (
              <button
                key={n}
                onClick={() => setCount(n)}
                className={`rounded-md px-4 py-1.5 font-display text-lg transition ${players.length === n ? 'bg-gold-500 text-wood-900' : 'text-parchment-100 hover:text-gold-300'}`}
              >
                {n} players
              </button>
            ))}
          </div>
        </div>

        {players.length > 4 && (
          <p className="mb-3 rounded-lg border border-gold-600/40 bg-gold-500/10 px-3 py-2 text-sm text-parchment-100">
            <b>5–6 player game:</b> a bigger 30-hex island, and the <b>paired players</b> rule — after each turn, the third player to the left takes an extra Action phase (build and
            play a card, but no dice and no trading with other players).
          </p>
        )}
        <ul className="space-y-3">
          {players.map((p, i) => {
            const pal = PLAYER_PALETTE[p.color];
            return (
              <motion.li
                layout
                key={i}
                className="flex flex-wrap items-center gap-3 rounded-xl border-2 p-3"
                style={{ borderColor: `${pal.accent}99`, background: `linear-gradient(135deg, ${pal.panelFrom}, ${pal.panelTo})` }}
              >
                <button
                  title="Change avatar"
                  onClick={() => update(i, { avatar: (p.avatar + 1) % AVATAR_COUNT })}
                  className="rounded-full transition hover:scale-105"
                >
                  <Avatar index={p.avatar} ring={pal.accent} size={52} />
                </button>
                <input
                  value={p.name}
                  maxLength={20}
                  onChange={(e) => update(i, { name: e.target.value })}
                  className="min-w-0 flex-1 rounded-lg border border-white/15 bg-black/30 px-3 py-2 font-display text-lg text-parchment-50 outline-none focus:border-gold-400"
                  aria-label={`Player ${i + 1} name`}
                />
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => toggleAI(i)}
                    title={p.isAI ? 'Computer player — click to make this seat human' : 'Human player — click to make this seat a computer'}
                    className={`rounded-lg border px-2.5 py-1.5 font-display text-sm transition ${p.isAI ? 'border-sky-300/60 bg-sky-900/50 text-sky-100' : 'border-white/20 bg-black/30 text-parchment-100'} hover:border-gold-400`}
                  >
                    {p.isAI ? 'Computer' : 'Human'}
                  </button>
                  {p.isAI && (
                    <select
                      value={p.aiLevel ?? 'normal'}
                      onChange={(e) => update(i, { aiLevel: e.target.value as AILevel })}
                      aria-label={`${p.name} difficulty`}
                      className="rounded-lg border border-white/20 bg-black/40 px-2 py-1.5 font-display text-sm text-parchment-50 outline-none focus:border-gold-400"
                    >
                      {AI_LEVELS.map((l) => (
                        <option key={l} value={l} className="bg-wood-900">
                          {LEVEL_LABEL[l]}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="flex gap-1.5">
                  {PLAYER_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setColor(i, c)}
                      title={PLAYER_PALETTE[c].label}
                      className={`h-8 w-8 rounded-full border-2 transition ${p.color === c ? 'scale-110 border-white' : 'border-black/40 opacity-70 hover:opacity-100'}`}
                      style={{ background: PLAYER_PALETTE[c].piece }}
                    />
                  ))}
                </div>
              </motion.li>
            );
          })}
        </ul>

        <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
          <label className="text-sm text-parchment-200">
            Island code <span className="text-parchment-300/60">(optional — replay a specific island)</span>
            <input
              value={seedText}
              onChange={(e) => setSeedText(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="Random"
              inputMode="numeric"
              className="mt-1 block w-48 rounded-lg border border-white/15 bg-black/30 px-3 py-2 font-mono text-parchment-50 outline-none focus:border-gold-400"
            />
          </label>
          <div className="flex gap-3">
            <button className="btn-wood" onClick={() => setScreen('mode')}>
              <BackIcon width={18} height={18} /> Back
            </button>
            <button className="btn-primary" onClick={start} disabled={noHuman || players.some((p) => !p.name.trim())}>
              <PlayIcon width={18} height={18} /> Start game
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
