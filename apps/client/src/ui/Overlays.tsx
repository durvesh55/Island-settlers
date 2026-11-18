import { AnimatePresence, motion } from 'framer-motion';
import { useGameStore, type Settings } from '../store/useGameStore';
import { CloseIcon } from './icons';

export function Toasts() {
  const toasts = useGameStore((s) => s.toasts);
  const dismiss = useGameStore((s) => s.dismissToast);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-44 z-50 flex flex-col items-center gap-2 px-4 sm:bottom-48">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.button
            key={t.id}
            layout
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10 }}
            onClick={() => dismiss(t.id)}
            className={`pointer-events-auto rounded-xl border px-4 py-2.5 font-body text-[15px] shadow-panel ${
              t.kind === 'error'
                ? 'border-red-400/60 bg-red-950/90 text-red-100'
                : t.kind === 'success'
                  ? 'border-emerald-400/60 bg-emerald-950/90 text-emerald-100'
                  : 'border-gold-500/50 bg-wood-900/95 text-parchment-100'
            }`}
          >
            {t.text}
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}

const TOGGLES: { key: keyof Settings; label: string; hint: string }[] = [
  { key: 'muted', label: 'Mute sound effects', hint: 'Silence wooden knocks, chimes and alerts.' },
  { key: 'shadows', label: 'Realistic shadows', hint: 'Turn off for better performance on slower devices.' },
  { key: 'showProbabilities', label: 'Show roll odds on hover', hint: 'Hovering a hex shows how often its number is rolled.' },
  { key: 'revealHands', label: 'Open hands', hint: "Show every player's resource breakdown (casual play). Off: only totals for others." },
  { key: 'handoff', label: 'Pass-and-play curtain', hint: 'Cover the screen between turns so the next player can take the device privately.' },
  { key: 'autoRotateMenu', label: 'Rotate island on the menu', hint: 'Slowly turns the island behind the main menu.' },
];

export function SettingsModal() {
  const open = useGameStore((s) => s.settingsOpen);
  const setOpen = useGameStore((s) => s.setSettingsOpen);
  const settings = useGameStore((s) => s.settings);
  const update = useGameStore((s) => s.updateSettings);
  const resetCamera = useGameStore((s) => s.resetCamera);
  const screen = useGameStore((s) => s.screen);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setOpen(false)}
        >
          <motion.div
            initial={{ scale: 0.92, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 10 }}
            className="panel-wood w-full max-w-md p-5 text-parchment-100"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Settings"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-3xl text-parchment-50">Settings</h2>
              <button onClick={() => setOpen(false)} className="text-parchment-200 hover:text-gold-300" aria-label="Close settings">
                <CloseIcon />
              </button>
            </div>
            <ul className="space-y-3">
              {TOGGLES.map((t) => (
                <li key={t.key}>
                  <label className="flex cursor-pointer items-start gap-3">
                    <button
                      role="switch"
                      aria-checked={settings[t.key]}
                      onClick={() => update({ [t.key]: !settings[t.key] })}
                      className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full border transition ${
                        settings[t.key] ? 'border-gold-400 bg-gold-500/80' : 'border-gold-600/40 bg-black/40'
                      }`}
                    >
                      <motion.span
                        layout
                        className="absolute top-0.5 h-4.5 w-4.5 rounded-full bg-parchment-50 shadow"
                        style={{ width: 18, height: 18, left: settings[t.key] ? 22 : 3 }}
                      />
                    </button>
                    <span>
                      <span className="block font-display text-lg leading-tight">{t.label}</span>
                      <span className="block text-sm text-parchment-300/75">{t.hint}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            {screen === 'game' && (
              <button className="btn-wood mt-5 w-full" onClick={resetCamera}>
                Reset camera view
              </button>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
