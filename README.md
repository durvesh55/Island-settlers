# Island Settlers

A premium, browser-based 3D tabletop strategy game about settling a newly discovered island:
gather resources, build roads, settlements and cities, trade, and race to 10 victory points.

Original artwork and branding. Every board, texture, piece, avatar and icon is generated
procedurally or drawn in SVG, so no third-party game assets are used.

> **Status:** Phases 1–5 complete: the full base-game rules, including trading, development cards,
> Longest Road and Largest Army, played pass-and-play, against Easy / Normal / Hard computer opponents,
> or online with friends.
> See [PROGRESS.md](PROGRESS.md) for exactly what works and what is pending.

## Requirements

- Node.js 20+ (tested with Node 22) and npm 10+
- A WebGL-capable browser (Chrome, Edge, Firefox, Safari)

## Getting started

```bash
npm install      # installs all workspaces
npm run dev      # starts the game at http://localhost:5173 (local modes only)
npm run dev:online   # game server on :3001 + client on :5173 (all modes, including online)
```

Other scripts (run from the repository root):

| Command             | What it does                                        |
| ------------------- | --------------------------------------------------- |
| `npm run dev`       | Vite dev server with hot reload                     |
| `npm run dev:online` | Game server (port 3001) and client together; Vite proxies `/socket.io` and `/api` |
| `npm start`         | Builds the client and runs the production server on `PORT` (default 3001) |
| `npm test`          | Runs the engine and server tests (Vitest)           |
| `npm run typecheck` | Type-checks every workspace                         |
| `npm run build`     | Type-checks and builds the client to `apps/client/dist` |
| `npm run preview`   | Serves the production build                         |

### Dev shortcuts

`http://localhost:5173/?quick=4&seed=123&auto=6` jumps straight into a local 4-player game
(`quick=3` for 3 players) on island `123`, and makes `auto` random **legal** setup
placements through the normal engine path. This is useful for testing and screenshots.
Add `&ai=3` to make the last three seats computer players, or `&ai=4&level=hard` to watch them play each other.

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
- **Single Player:** choose *Single Player*, then set each seat to Human or Computer and pick a
  difficulty. Computer players move with short pauses (turn on **Fast computer turns** in Settings to
  speed them up). When one offers you a trade, a dialog asks you to accept or decline.
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
  src/ai.ts          Computer players: chooseAIAction(state, player) → next legal action
  test/              Vitest suites
apps/client/         React + Vite + Tailwind + Framer Motion + React Three Fiber
  src/three/         3D tabletop: table, framed sea (shader), tiles, terrain props,
                     number discs, harbors, robber, pieces, placement hotspots
  src/ui/            HUD: logo, side nav, top bar, player panels, resource hand,
                     build menu, dev cards, drawers, settings, toasts
  src/screens/       Main menu, mode select, player setup, game, rules
  src/store/         Zustand store: dispatches actions through the engine and persists them;
                     useAIController runs computer players through the same dispatch path
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

## Online play

`apps/server` is a Node.js + Express + Socket.IO server that reuses `@island/engine`:

```
apps/server/src/server.ts   HTTP + Socket.IO wiring, /api/health, /api/matches, serves the built client
apps/server/src/rooms.ts    Rooms: lobby, seats and tokens, actions, server-side computer players
apps/server/src/store.ts    Persistence: in-memory, or PostgreSQL / Supabase
packages/engine/src/online.ts  Per-player redaction and the shared message types
```

- **The server is the authority.** Clients send actions; the server checks the action is for the
  sender's own seat, runs it through `applyAction`, and sends each player their own redacted view.
- **Hidden information stays hidden.** Other players' cards arrive as counts only. The deck order and
  the RNG state never leave the server, so dice and draws cannot be predicted.
- **Reconnection.** Joining gives the browser a secret seat token, kept in `localStorage`. Reconnecting
  with it reclaims the seat, even after a server restart if a database is configured.

Environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3001` | HTTP and Socket.IO port |
| `DATABASE_URL` | unset (memory) | PostgreSQL or Supabase connection string; tables are created on start |
| `PGSSL` | auto | `1` forces TLS (auto-on for Supabase URLs and `sslmode=require`) |
| `BOT_DELAY_MS` | `900` | Pause before computer players act |
| `CORS_ORIGINS` | unset | Comma-separated origins, if the client is hosted elsewhere |
| `VITE_SERVER_URL` | same origin | Build-time: where the client connects, if the server is elsewhere |

To deploy, run `npm start` on any Node 20+ host that supports WebSockets (Render, Railway, Fly.io, a
VPS). It builds the client and serves the game and the sockets from one port.
