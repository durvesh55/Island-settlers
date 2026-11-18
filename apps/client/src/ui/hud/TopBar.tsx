import { possessive } from '../../lib/text';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { GameState } from '@island/engine';
import { PLAYER_PALETTE } from '../../lib/colors';
import { useGameStore } from '../../store/useGameStore';
import { ExpandIcon, GearIcon, PlayIcon, SoundIcon, UsersIcon } from '../icons';

const PIPS: Record<number, [number, number][]> = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [0, 2], [2, 0], [2, 2]],
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
  6: [[0, 0], [1, 0], [2, 0], [0, 2], [1, 2], [2, 2]],
};

export function DieFace({ value, size = 38 }: { value: number | null; size?: number }) {
  return (
    <div
      className="relative grid grid-cols-3 grid-rows-3 rounded-lg p-1.5"
      style={{
        width: size,
        height: size,
        background: 'linear-gradient(145deg,#ffffff,#e4ddd0)',
        boxShadow: 'inset -2px -3px 4px rgba(0,0,0,.18), 0 4px 10px rgba(0,0,0,.5)',
      }}
    >
      {value === null ? (
        <span className="col-span-3 row-span-3 grid place-items-center font-display text-lg text-wood-700/40">?</span>
      ) : (
        PIPS[value].map(([r, c], i) => (
          <span key={i} className="m-auto h-[22%] min-h-[5px] w-[22%] min-w-[5px] rounded-full bg-wood-900" style={{ gridRow: r + 1, gridColumn: c + 1 }} />
        ))
      )}
    </div>
  );
}

function useFullscreen() {
  const [isFull, setIsFull] = useState(!!document.fullscreenElement);
  useEffect(() => {
    const onChange = () => setIsFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  const toggle = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => undefined);
  };
  return { isFull, toggle };
}

export function TopBar({ game }: { game: GameState }) {
  const player = game.players[game.currentPlayer];
  const pal = PLAYER_PALETTE[player.color];
  const setSettingsOpen = useGameStore((s) => s.setSettingsOpen);
  const togglePanel = useGameStore((s) => s.togglePanel);
  const muted = useGameStore((s) => s.settings.muted);
  const updateSettings = useGameStore((s) => s.updateSettings);
  const { toggle } = useFullscreen();
  const total = game.dice ? game.dice[0] + game.dice[1] : null;

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <AnimatePresence mode="wait">
        <motion.div
          key={player.id}
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 20, opacity: 0 }}
          className="flex h-11 items-center gap-2 rounded-xl border-2 px-4 font-display text-lg text-white"
          style={{
            borderColor: pal.accent,
            background: `linear-gradient(180deg, ${pal.piece} 0%, ${pal.panelFrom} 100%)`,
            boxShadow: `0 0 18px ${pal.accent}66, 0 6px 14px rgba(0,0,0,.5)`,
          }}
        >
          <PlayIcon width={16} height={16} />
          <span className="max-w-[10rem] truncate">{possessive(player.name)} Turn</span>
        </motion.div>
      </AnimatePresence>

      <div className="panel-wood hidden h-11 items-center gap-2 px-2.5 md:flex" title="Last roll">
        <DieFace value={game.dice?.[0] ?? null} size={30} />
        <DieFace value={game.dice?.[1] ?? null} size={30} />
        <span className="w-6 text-center font-display text-xl text-gold-300">{total ?? '–'}</span>
      </div>

      <button className="icon-btn hidden sm:grid" title="Players & room" onClick={() => togglePanel('game')}>
        <UsersIcon />
      </button>
      <button className="icon-btn hidden sm:grid" title={muted ? 'Unmute' : 'Mute'} onClick={() => updateSettings({ muted: !muted })}>
        <SoundIcon muted={muted} />
      </button>
      <button className="icon-btn" title="Settings" onClick={() => setSettingsOpen(true)}>
        <GearIcon />
      </button>
      <button className="icon-btn hidden sm:grid" title="Fullscreen" onClick={toggle}>
        <ExpandIcon />
      </button>
    </div>
  );
}
