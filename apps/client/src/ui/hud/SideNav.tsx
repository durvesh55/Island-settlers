import { motion } from 'framer-motion';
import { playSound } from '../../lib/sound';
import { useGameStore, type Panel } from '../../store/useGameStore';
import { BookIcon, CardsIcon, HammerIcon, HomeIcon, TradeIcon } from '../icons';

const ITEMS: { id: Panel; label: string; Icon: typeof HomeIcon }[] = [
  { id: 'game', label: 'Game', Icon: HomeIcon },
  { id: 'trade', label: 'Trade', Icon: TradeIcon },
  { id: 'build', label: 'Build', Icon: HammerIcon },
  { id: 'development', label: 'Development', Icon: CardsIcon },
  { id: 'rules', label: 'Rules', Icon: BookIcon },
];

export function SideNav() {
  const panel = useGameStore((s) => s.panel);
  const togglePanel = useGameStore((s) => s.togglePanel);
  return (
    <nav className="panel-wood flex flex-row gap-1 p-1.5 lg:flex-col">
      {ITEMS.map(({ id, label, Icon }) => {
        const active = panel === id;
        return (
          <button
            key={id}
            onClick={() => {
              playSound('click');
              togglePanel(id);
            }}
            className={`relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-left font-display text-[17px] transition ${
              active ? 'text-gold-300' : 'text-parchment-100 hover:bg-white/5 hover:text-gold-300'
            }`}
            title={label}
          >
            {active && (
              <motion.span
                layoutId="nav-active"
                className="absolute inset-0 rounded-lg border border-gold-500/60"
                style={{ background: 'linear-gradient(90deg, rgba(201,154,62,.35), rgba(201,154,62,.08))' }}
              />
            )}
            <Icon className="relative" />
            <span className="relative hidden lg:inline">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
