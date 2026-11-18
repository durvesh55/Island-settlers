import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAIController } from '../store/useAIController';
import { useGameStore } from '../store/useGameStore';
import { BoardCanvas } from '../three/BoardScene';
import { BuildMenu } from '../ui/hud/BuildMenu';
import { DevCardsPanel } from '../ui/hud/DevCardsPanel';
import { Drawer } from '../ui/hud/Drawer';
import { PlayerPanels } from '../ui/hud/PlayerPanels';
import { ResourceHand } from '../ui/hud/ResourceHand';
import { SideNav } from '../ui/hud/SideNav';
import { StatusBanner } from '../ui/hud/StatusBanner';
import { TopBar } from '../ui/hud/TopBar';
import { TurnControls } from '../ui/hud/TurnControls';
import { TurnModals } from '../ui/hud/TurnModals';
import { DevCardDialog, DevCardReveal } from '../ui/hud/DevCards';
import { UsersIcon } from '../ui/icons';
import { Logo } from '../ui/Logo';

/**
 * Main tabletop: the 3D board fills the screen and the HUD floats on top of it,
 * mirroring the reference layout — logo and nav on the left, turn/dice/settings on top,
 * player panels → development cards → build on the right, resource cards along the bottom.
 */
export function GameScreen() {
  const game = useGameStore((s) => s.game);
  const [showSide, setShowSide] = useState(false);
  const connection = useGameStore((s) => s.online?.connection);
  useAIController();
  if (!game) return null;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative h-full w-full">
      <div className="absolute inset-0">
        <BoardCanvas board={game.board} game={game} variant="game" />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_45%_45%,transparent_55%,rgba(10,5,2,0.6)_100%)]" />

      <div className="pointer-events-none absolute inset-0">
        {/* left: logo, navigation, drawer */}
        <div className="absolute bottom-44 left-3 top-[176px] flex flex-col gap-3 sm:bottom-[212px] sm:left-4 sm:top-4">
          <div className="pointer-events-auto hidden sm:block">
            <Logo />
          </div>
          <div className="flex min-h-0 flex-1 items-start gap-3">
            <div className="pointer-events-auto">
              <SideNav />
            </div>
            <div className="flex max-h-full min-h-0">
              <Drawer game={game} />
            </div>
          </div>
        </div>

        {/* top right: turn, dice, controls */}
        <div className="pointer-events-auto absolute right-3 top-3 flex items-center gap-2 sm:right-4 sm:top-4">
          <TopBar game={game} />
          <button className="icon-btn xl:hidden" title="Players & build" onClick={() => setShowSide((v) => !v)}>
            <UsersIcon />
          </button>
        </div>

        {/* instruction banner, centred over the board */}
        <div className="absolute left-16 right-3 top-[68px] flex justify-center sm:left-[220px] sm:top-[72px] xl:right-[372px]">
          <StatusBanner game={game} />
        </div>

        {/* right column */}
        <div
          className={`pointer-events-auto scroll-thin absolute bottom-4 right-3 top-[72px] w-[min(340px,calc(100vw-1.5rem))] flex-col gap-3 overflow-y-auto sm:right-4 xl:flex ${showSide ? 'flex' : 'hidden'}`}
        >
          <PlayerPanels game={game} />
          <DevCardsPanel game={game} />
          <div className="mt-auto">
            <BuildMenu game={game} />
          </div>
        </div>

        {/* bottom: resource hand */}
        <div className="absolute bottom-0 left-0 right-0 flex justify-center px-3 sm:left-[220px] xl:right-[372px]">
          <div className="flex max-w-full items-end gap-3 pb-3 sm:pb-4">
            <div className="pointer-events-auto scroll-thin min-w-0 overflow-x-auto px-2 pt-12">
              <ResourceHand game={game} />
            </div>
            <div className="pointer-events-auto shrink-0 pb-1">
              <TurnControls game={game} />
            </div>
          </div>
        </div>
      </div>
      {connection && connection !== 'connected' && (
        <div className="pointer-events-none fixed inset-x-0 top-3 z-50 flex justify-center px-4">
          <div className="rounded-xl border border-red-400/60 bg-red-950/90 px-4 py-2 text-red-100 shadow-panel">Connection lost. Reconnecting to the game server…</div>
        </div>
      )}
      <TurnModals game={game} />
      <DevCardDialog game={game} />
      <DevCardReveal />
    </motion.div>
  );
}
