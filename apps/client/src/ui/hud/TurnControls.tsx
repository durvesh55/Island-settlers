import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { GameState } from '@island/engine';
import { PLAYER_PALETTE } from '../../lib/colors';
import { playSound } from '../../lib/sound';
import { useGameStore, type BuildMode } from '../../store/useGameStore';
import { CloseIcon, DiceIcon, PlayIcon } from '../icons';
import { buildAvailability } from './BuildMenu';

/** Keyboard shortcuts: R roll · E end turn · 1/2/3 build road/settlement/city · Esc cancel. */
function useShortcuts(game: GameState) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const s = useGameStore.getState();
      if (s.handoffFor !== null || s.settingsOpen) return;
      const g = s.game;
      if (!g || g.players[g.currentPlayer].isAI) return;
      const key = e.key.toLowerCase();
      if (key === 'r' && g.phase === 'roll') s.rollDice();
      else if (key === 'e' && g.phase === 'main') s.dispatch({ type: 'END_TURN', player: g.currentPlayer });
      else if (key === 'escape') s.setBuildMode(null);
      else if (key === 't') s.togglePanel('trade');
      else if (key === '4' && g.phase === 'main') s.dispatch({ type: 'BUY_DEV_CARD', player: g.currentPlayer });
      else if (['1', '2', '3'].includes(key)) {
        const mode = (['road', 'settlement', 'city'] as BuildMode[])[Number(key) - 1];
        if (buildAvailability(g, mode).ok) s.setBuildMode(s.buildMode === mode ? null : mode);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [game]);
}

/** Primary turn action button shown beside the hand: Roll Dice → End Turn. */
export function TurnControls({ game }: { game: GameState }) {
  useShortcuts(game);
  const rolling = useGameStore((s) => s.rolling);
  const buildMode = useGameStore((s) => s.buildMode);
  const rollDice = useGameStore((s) => s.rollDice);
  const dispatch = useGameStore((s) => s.dispatch);
  const setBuildMode = useGameStore((s) => s.setBuildMode);
  const player = game.players[game.currentPlayer];
  const pal = PLAYER_PALETTE[player.color];
  if (player.isAI) return null;

  let content: React.ReactNode = null;
  if (game.phase === 'roll' || rolling) {
    content = (
      <motion.button
        key="roll"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        disabled={rolling}
        onClick={rollDice}
        className="btn-primary min-w-[150px] flex-col gap-0 py-3 text-xl"
        style={{ background: `linear-gradient(180deg, ${pal.accent} 0%, ${pal.panelFrom} 100%)`, borderColor: pal.accent }}
        title="Roll the dice (R)"
      >
        <span className="flex items-center gap-2">
          <motion.span animate={rolling ? { rotate: 360 } : { rotate: [0, -12, 12, 0] }} transition={rolling ? { repeat: Infinity, duration: 0.5, ease: 'linear' } : { repeat: Infinity, duration: 1.6, repeatDelay: 1 }}>
            <DiceIcon width={26} height={26} />
          </motion.span>
          {rolling ? 'Rolling…' : 'Roll Dice'}
        </span>
        {!rolling && <span className="font-body text-xs opacity-75">press R</span>}
      </motion.button>
    );
  } else if (game.phase === 'main') {
    content = (
      <div key="main" className="flex flex-col items-stretch gap-2">
        {buildMode && (
          <motion.button initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="btn-wood text-sm" onClick={() => setBuildMode(null)} title="Cancel (Esc)">
            <CloseIcon width={16} height={16} /> Cancel {buildMode}
          </motion.button>
        )}
        <motion.button
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          onClick={() => {
            playSound('click');
            dispatch({ type: 'END_TURN', player: player.id });
          }}
          className="btn-wood min-w-[150px] flex-col gap-0 py-3 text-xl"
          title="End your turn (E)"
        >
          <span className="flex items-center gap-2">
            <PlayIcon width={18} height={18} /> End Turn
          </span>
          <span className="font-body text-xs opacity-60">press E</span>
        </motion.button>
      </div>
    );
  }
  return <AnimatePresence mode="wait">{content}</AnimatePresence>;
}
