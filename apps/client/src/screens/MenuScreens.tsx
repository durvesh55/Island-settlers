import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { generateBoard, randomSeed } from '@island/engine';
import { playSound } from '../lib/sound';
import { hasSavedGame, useGameStore, type GameMode } from '../store/useGameStore';
import { BoardCanvas } from '../three/BoardScene';
import { BackIcon, BookIcon, GearIcon, PlayIcon, UsersIcon } from '../ui/icons';
import { Logo } from '../ui/Logo';
import { RulesContent } from '../ui/RulesContent';

/** Slowly rotating 3D island behind every menu screen. */
export function MenuBackdrop() {
  const board = useMemo(() => generateBoard(randomSeed()), []);
  return (
    <div className="absolute inset-0">
      <BoardCanvas board={board} variant="menu" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(20,10,4,0.15)_0%,rgba(20,10,4,0.75)_75%)]" />
    </div>
  );
}

const fade = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
  transition: { duration: 0.35 },
};

export function MainMenu() {
  const setScreen = useGameStore((s) => s.setScreen);
  const resume = useGameStore((s) => s.resumeSavedGame);
  const setSettingsOpen = useGameStore((s) => s.setSettingsOpen);
  const canResume = hasSavedGame();
  const go = (fn: () => void) => () => {
    playSound('click');
    fn();
  };
  return (
    <motion.div {...fade} className="relative z-10 flex h-full flex-col items-center justify-center gap-10 px-4">
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 120, damping: 14 }}>
        <Logo size="lg" />
      </motion.div>
      <p className="max-w-md rounded-full bg-wood-950/70 px-5 py-1.5 text-center font-body text-lg text-parchment-100 backdrop-blur-sm">
        Gather, build and trade your way across a newly discovered island.
      </p>
      <div className="flex w-full max-w-xs flex-col gap-3">
        {canResume && (
          <button className="btn-primary" onClick={go(() => resume())}>
            <PlayIcon width={18} height={18} /> Continue game
          </button>
        )}
        <button className={canResume ? 'btn-wood py-3 text-lg' : 'btn-primary'} onClick={go(() => setScreen('mode'))}>
          <UsersIcon width={20} height={20} /> New game
        </button>
        <button className="btn-wood py-3 text-lg" onClick={go(() => setScreen('rules'))}>
          <BookIcon width={20} height={20} /> How to play
        </button>
        <button className="btn-wood py-3 text-lg" onClick={go(() => setSettingsOpen(true))}>
          <GearIcon width={20} height={20} /> Settings
        </button>
      </div>
    </motion.div>
  );
}

const MODES: { id: GameMode; title: string; text: string; available: boolean; badge?: string }[] = [
  { id: 'local', title: 'Local Multiplayer', text: '3–4 settlers share one device and pass it around each turn.', available: true },
  { id: 'single', title: 'Single Player', text: 'Face 2–3 computer opponents that build, trade and scheme.', available: false, badge: 'Phase 4' },
  { id: 'online', title: 'Online Multiplayer', text: 'Create a room, share the code and play with friends anywhere.', available: false, badge: 'Phase 5' },
];

export function ModeSelect() {
  const setScreen = useGameStore((s) => s.setScreen);
  const setMode = useGameStore((s) => s.setMode);
  return (
    <motion.div {...fade} className="relative z-10 flex h-full flex-col items-center justify-center gap-8 overflow-y-auto px-4 py-10">
      <h1 className="font-display text-5xl text-parchment-50 drop-shadow-lg">Choose a mode</h1>
      <div className="grid w-full max-w-4xl gap-4 md:grid-cols-3">
        {MODES.map((m, i) => (
          <motion.button
            key={m.id}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 * i }}
            whileHover={m.available ? { y: -6 } : undefined}
            disabled={!m.available}
            onClick={() => {
              playSound('click');
              setMode(m.id);
              setScreen('players');
            }}
            className="panel-wood relative flex flex-col items-start gap-2 p-6 text-left disabled:cursor-not-allowed disabled:opacity-60"
          >
            {m.badge && (
              <span className="absolute right-3 top-3 rounded-full border border-gold-500/50 bg-black/40 px-2 py-0.5 text-xs text-gold-300">
                Coming in {m.badge}
              </span>
            )}
            <span className="font-display text-2xl text-parchment-50">{m.title}</span>
            <span className="text-parchment-200/85">{m.text}</span>
          </motion.button>
        ))}
      </div>
      <button className="btn-wood" onClick={() => setScreen('menu')}>
        <BackIcon width={18} height={18} /> Back
      </button>
    </motion.div>
  );
}

export function RulesScreen() {
  const setScreen = useGameStore((s) => s.setScreen);
  const [scrolled, setScrolled] = useState(false);
  return (
    <motion.div {...fade} className="relative z-10 flex h-full items-center justify-center p-4">
      <div className="panel-wood flex max-h-full w-full max-w-2xl flex-col overflow-hidden">
        <header className={`flex items-center justify-between px-6 py-4 transition ${scrolled ? 'border-b border-gold-600/30' : ''}`}>
          <h1 className="font-display text-4xl text-parchment-50">How to play</h1>
          <button className="btn-wood" onClick={() => setScreen('menu')}>
            <BackIcon width={18} height={18} /> Back
          </button>
        </header>
        <div className="scroll-thin overflow-y-auto px-6 pb-6" onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 4)}>
          <RulesContent />
        </div>
      </div>
    </motion.div>
  );
}
