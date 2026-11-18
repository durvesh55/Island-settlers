# Island Settlers

A premium, browser-based 3D tabletop strategy game about settling a newly discovered island:
gather resources, build roads, settlements and cities, trade, and race to 10 victory points.

Original artwork and branding. Every board, texture, piece, avatar and icon is generated
procedurally or drawn in SVG, so no third-party game assets are used.

> **Status:** Phases 1–3 complete: the full base-game rules for local pass-and-play, including trading,
> development cards, Longest Road and Largest Army.
> See [PROGRESS.md](PROGRESS.md) for exactly what works and what is pending.

## Requirements

- Node.js 20+ (tested with Node 22) and npm 10+
- A WebGL-capable browser (Chrome, Edge, Firefox, Safari)

## Getting started

```bash
npm install      # installs all workspaces
npm run dev      # starts the game at http://localhost:5173
```

Other scripts (run from the repository root):

| Command             | What it does                                        |
| ------------------- | --------------------------------------------------- |
| `npm run dev`       | Vite dev server with hot reload                     |
| `npm test`          | Runs the game-engine unit tests (Vitest)            |
| `npm run typecheck` | Type-checks every workspace                         |
| `npm run build`     | Type-checks and builds the client to `apps/client/dist` |
| `npm run preview`   | Serves the production build                         |

### Dev shortcuts

`http://localhost:5173/?quick=4&seed=123&auto=6` jumps straight into a local 4-player game
(`quick=3` for 3 players) on island `123`, and makes `auto` random **legal** setup
placements through the normal engine path. This is useful for testing and screenshots.

## Controls

- **Left-drag** to orbit, **scroll** to zoom, **right-drag** to pan the camera.
- Legal spots glow **cyan**. Hovering one shows a translucent preview in your color.
- **Setup:** click a glowing corner for a settlement, then a glowing edge for its road.
  **Random** picks a random legal spot.
- **Your turn:** **Roll Dice** (`R`). Hexes that produce glow gold, and a hex blocked by the robber glows red.
  Then build from the Build menu (`1` road, `2` settlement, `3` city), click a glowing spot (`Esc` cancels), and **End Turn** (`E`).
- **Rolling a 7:** anyone holding more than 7 cards discards half, then you click a hex to move the
  robber and choose whom to rob.
- **Trading:** open the **Trade** drawer after rolling to trade with the bank (4:1, or your harbor
  rates) or offer a trade to all players. Each player accepts or declines, then you pick a partner.
- **Development cards:** buy from the Build menu (`4`), then play one per turn from your hand,
  even before rolling. A card can't be played on the turn you bought it.
- **Pass-and-play:** between turns a curtain asks the next player to take the device (`Enter` to continue).
  You can turn it off in Settings.
- Hover any terrain hex to see what it produces and how often its number is rolled.
- The game autosaves to the browser; **Continue game** on the main menu resumes it.

## Architecture

```
packages/engine/     Pure TypeScript rules engine: no React, no DOM, fully unit-tested
  src/constants.ts   Resources, terrain counts, costs, piece limits, dev deck
  src/rng.ts         Seeded RNG (deterministic boards; RNG state lives in game state)
  src/hex.ts         Axial hex coordinates (pointy-top) and geometry
  src/board.ts       Island generation, vertex/edge graph, coastline walk, harbors
  src/game.ts        createGame(): validated game-state factory
  src/actions.ts     applyAction(): the ONLY way to change game state; validates every rule
                     (setup, dice, robber, discards, building, end turn, victory)
  src/production.ts  Dice production incl. robber blocking and the bank-shortage rule
  src/placement.ts   Distance rule, road connectivity, legal spots for every piece
  src/trading.ts     Maritime trade ratios from occupied harbors
  src/victory.ts     Public / total victory points
  test/              Vitest suites
apps/client/         React + Vite + Tailwind + Framer Motion + React Three Fiber
  src/three/         3D tabletop: table, framed sea (shader), tiles, terrain props,
                     number discs, harbors, robber, pieces, placement hotspots
  src/ui/            HUD: logo, side nav, top bar, player panels, resource hand,
                     build menu, dev cards, drawers, settings, toasts
  src/screens/       Main menu, mode select, player setup, game, rules
  src/store/         Zustand store: dispatches actions through the engine and persists them
  src/lib/           Canvas textures, SVG resource art, Web Audio sound effects
```

Key design decisions:

- **The engine is the authority.** The UI never mutates game state. It calls
  `applyAction(state, action)`, which returns a new state or an error message. The same engine
  will run on the Socket.IO server in Phase 5, so online games are validated server-side.
- **Serializable, deterministic state.** The board is generated from a seed and all randomness
  flows through a stored RNG state, so a game can be saved, restored or synced as plain JSON.
- **No external assets.** Wood grain, terrain ground, number discs and harbor signs are painted
  onto canvases at runtime. The decorations (trees, peaks, wheat, sheep, bricks, dunes) are
  instanced 3D meshes.

## Planned stack for later phases

- **Server (Phase 5):** Node.js + Express + Socket.IO in `apps/server`, reusing `@island/engine`.
- **Database:** PostgreSQL (or Supabase) for rooms, reconnection and match history.
