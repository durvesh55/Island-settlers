import { useState } from 'react';
import { motion } from 'framer-motion';
import { PLAYER_COLORS, type PlayerColor, type PlayerConfig } from '@island/engine';
import { PLAYER_PALETTE } from '../lib/colors';
import { playSound } from '../lib/sound';
import { useGameStore } from '../store/useGameStore';
import { Avatar, AVATAR_COUNT } from '../ui/Avatar';
import { BackIcon, PlayIcon } from '../ui/icons';

const DEFAULT_NAMES = ['Player 1', 'Player 2', 'Player 3', 'Player 4'];

export function defaultPlayers(count: number): PlayerConfig[] {
  return Array.from({ length: count }, (_, i) => ({
    name: DEFAULT_NAMES[i],
    color: PLAYER_COLORS[i],
    avatar: i,
    isAI: false,
  }));
}

export function PlayerSetup() {
  const setScreen = useGameStore((s) => s.setScreen);
  const startGame = useGameStore((s) => s.startGame);
  const pushToast = useGameStore((s) => s.pushToast);
  const [players, setPlayers] = useState<PlayerConfig[]>(defaultPlayers(4));
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
    setPlayers((ps) => (n < ps.length ? ps.slice(0, n) : [...ps, ...defaultPlayers(4).slice(ps.length, n).map((p) => ({ ...p, color: PLAYER_COLORS.find((c) => !ps.some((q) => q.color === c))! }))]));

  const start = () => {
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
            {[3, 4].map((n) => (
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
            <button className="btn-primary" onClick={start} disabled={players.some((p) => !p.name.trim())}>
              <PlayIcon width={18} height={18} /> Start game
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
