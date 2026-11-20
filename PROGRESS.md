# Island Settlers — Feature Tracker

Legend: ✅ done and tested · 🟡 partial · ⏳ not started

**Test coverage:** 109 engine unit tests (+8 server), including 6 randomized full-game simulations (with trades,
development cards and awards) and 9 full games played entirely by computer players, each thousands of legal actions long, with invariants checked after every action (resources conserved at 95,
piece counts, distance rule). There are also browser end-to-end runs with real mouse and keyboard input.

## Phase 1 — Foundation & visual board ✅

| Feature | Status | Notes |
| --- | --- | --- |
| Monorepo (npm workspaces): engine + client | ✅ | `packages/engine`, `apps/client` |
| Procedural 19-hex island, tokens (no adjacent 6/8), 9 harbors | ✅ | Seeded; unit-tested |
| Vertex/edge graph (54 corners, 72 edges) | ✅ | |
| 3D table, framed animated sea, terrain props, number discs, harbors, robber | ✅ | |
| Roads, settlements and cities as 3D wooden pieces with drop-in animation | ✅ | |
| Lighting, soft shadows, camera orbit/zoom/pan, portrait fit | ✅ | |
| Player panels, resource cards, side-nav drawers, all menu screens | ✅ | |
| Synthesized sound effects with mute; autosave and resume | ✅ | |

## Phase 2 — Core turn loop ✅

| Feature | Status | Notes |
| --- | --- | --- |
| Initial setup: snake order, distance rule, road must touch new settlement | ✅ | |
| Starting resources from the second settlement | ✅ | |
| Dice from the engine's seeded RNG (clients can't pick values) | ✅ | Deterministic per game state |
| Animated 3D dice that land on the rolled values | ✅ | The result is applied when they land |
| Resource production: settlements 1, cities 2, robber blocks its hex | ✅ | Producing hexes glow gold, blocked hex glows red |
| Bank shortage rule | ✅ | Unit-tested |
| Rolling a 7: discard half above 7 cards, move robber, steal a random card | ✅ | Pulled in from Phase 3 so 7s work correctly |
| Build road: cost, 15-piece limit, connectivity; opponent settlements break networks | ✅ | |
| Build settlement: cost, 5-piece limit, distance rule, must touch own road | ✅ | |
| Build city: cost, 4-piece limit, upgrades own settlement, settlement piece returns | ✅ | |
| Build menu with live affordability and the reason a piece is unavailable | ✅ | Keys `1`–`3`, `Esc` cancels |
| End turn (`E`), clockwise | ✅ | |
| Pass-and-play hand-off curtain | ✅ | Can be turned off in Settings |
| Victory points (public + hidden) and instant win at 10 VP on your turn | ✅ | |
| Victory screen with final scores | ✅ | Polish (camera fly-over, stats) planned for Phase 6 |
| Resource-gain chips on player panels, "+N" on cards, chronicle log | ✅ | |

## Phase 3 — Trading, development cards, awards ✅

| Feature | Status | Notes |
| --- | --- | --- |
| Robber, discards and stealing | ✅ | Done early in Phase 2 |
| Bank 4:1 and harbor 3:1 / 2:1 trades | ✅ | Trade drawer; multiple lots per trade; `trade-actions.ts` |
| Player-to-player trade offers and confirmation UI | ✅ | Offer to all → each player accepts/declines → active player picks a partner; offers clear at end of turn |
| Buying development cards | ✅ | Build menu or key `4`; the bought card is revealed to its buyer |
| Knight, Road Building, Year of Plenty, Monopoly, Victory Point effects | ✅ | `devcard-actions.ts`; resource pickers for Year of Plenty / Monopoly |
| Longest Road and Largest Army (+2 VP each) | ✅ | `awards.ts`; toasts and panel badges |

Not yet verified in a browser run with real mouse and keyboard input (engine tests, typecheck and production build pass).

## Phase 4 — AI opponents and full local play ✅

| Feature | Status | Notes |
| --- | --- | --- |
| Computer player engine (`ai.ts`): pure, deterministic, uses only public information | ✅ | Never sees opponents' cards, only hand sizes; same state → same move |
| Setup: scores corners by pips, scarcity, resource variety and harbors; aims the road at the next good spot | ✅ | |
| Turn play: picks a goal (settlement, city, road towards a spot, dev card) and builds when it can afford it | ✅ | Spends spare cards when holding more than 7 |
| Bank/harbor trades towards the goal; 1-for-1 offers to the table; answers offers on their merits | ✅ | Won't help a player at 8+ VP |
| Robber: targets the leader's best hex, never its own; robs the leader | ✅ | |
| Dev cards: Knight when the robber hurts it or to take Largest Army, Road Building, Year of Plenty, Monopoly | ✅ | Monopoly picks a resource from opponents' *production*, not their hands |
| Discards keep the cards its goal needs | ✅ | |
| Easy / Normal / Hard per seat | ✅ | In 30 all-AI test games: Hard won 30%, Normal 25% per seat, Easy 20% |
| Single Player mode; Human/Computer toggle and difficulty per seat | ✅ | Mixed tables work too; the pass-and-play curtain appears only with 2+ humans |
| AI controller with readable pauses; **Fast computer turns** setting | ✅ | `useAIController.ts` |
| Offer dialog when a computer player proposes a trade to a human | ✅ | |
| Computer hands and bought cards stay hidden; HUD shows the human's own hand during computer turns | ✅ | |

Not yet checked in a browser with real mouse and keyboard input. Engine tests, typecheck and the production build all pass.
Dev shortcut: `?quick=4&ai=3` (you vs 3 computers), `?quick=4&ai=4&level=hard` (watch computers play).

## Phase 5 — Online multiplayer (Express + Socket.IO + Postgres/Supabase) ✅

| Feature | Status | Notes |
| --- | --- | --- |
| `apps/server`: Express + Socket.IO, reusing `@island/engine` | ✅ | The server runs every action through `applyAction` |
| Rooms with 5-character codes; lobby with seats, colors, host controls | ✅ | Host adds/removes computer players and starts at 3–4 seats |
| Server-side validation: only your own seat, only when allowed | ✅ | Malformed actions are rejected, not crashed on |
| Hidden information: each player gets a redacted view | ✅ | Other hands and dev cards are counts only; deck order and RNG state are removed; stolen/bought cards only shown to those involved |
| Computer players run on the server | ✅ | Same AI as single player |
| Reconnection: a seat token in the browser reclaims the seat | ✅ | Automatic after a dropped connection; **Rejoin room** on the main menu |
| Persistence: rooms survive a server restart; finished matches are recorded | ✅ | Postgres/Supabase when `DATABASE_URL` is set, otherwise in memory; `GET /api/matches` |
| Client: Online screen (create/join), waiting room, dice animation from server rolls | ✅ | `OnlineScreens.tsx`, `lib/net.ts` |
| Production: one Node process serves the built client and the sockets | ✅ | `npm start` |

**Tests:** 8 server tests with real Socket.IO clients cover the lobby, redaction, turn and seat checks, reconnection,
a server restart, a full online game against server-side computer players, and the Postgres store (via `pg-mem`).
Also checked by hand: online play through the Vite dev proxy, and the production server serving the game and sockets on one port.
Not yet checked: against a real Postgres/Supabase database (none installed here), and in a browser with real clicks.
Not built yet: a turn timer, and replacing a player who never comes back with a computer player.

## Extension — 5–6 players (CATAN 5-6 rulebook, 2025) ✅

Audited against the 6th-edition rulebooks CN3081 (base) and CN3082 (5-6). The base rules already matched; wording now
follows the 2025 books (wheat, supply, Invention, Longest Route).

| Feature | Status | Notes |
| --- | --- | --- |
| 3–6 players everywhere (local setup, online lobby/server, AI seats), 6 colors | ✅ | `MAX_PLAYERS = 6`; orange and purple added |
| 30-hex island: rows 3-4-5-6-5-4-3; 6 forest / 5 hills / 5 mountains / 6 fields / 6 pasture / 2 desert | ✅ | `board.ts`, `BOARD_RULES.large` in `constants.ts` |
| 28 number discs (no 7, 6/8 never adjacent), 11 harbors (6× 3:1 + one 2:1 per resource) | ✅ | tested over several seeds |
| Supply of 24 cards per resource; 34 development cards (20 Knights, 5 VP, 3 each Road Building / Invention / Monopoly) | ✅ | |
| Paired players: after Player 1's turn, the third player to the left takes an extra Action phase | ✅ | `endTurn` in `actions.ts`; `turnLeader`, `pairedTurn` on `GameState` |
| Player 2: no dice roll, no trading with players (supply is fine), may build, buy and play one card; wins at 10 VP | ✅ | `trade-actions.ts`; Player 1 / 2 markers shown on the player panels |
| Computer players handle paired turns (never offer player trades as Player 2) | ✅ | 4 full AI games at 5 and 6 players in `large.test.ts` |
| Sea/frame, camera, shadows and decorations scale to the 30-hex island | ✅ | `three/Tabletop.tsx`, `three/BoardScene.tsx` |
| Older saved games (no paired fields) keep working | ✅ | fields are optional |

Quick start: `?quick=5&seed=7` or `?quick=6&ai=5`. `node scripts/paired-check.mjs <outDir>` drives a 5-player game to Player 2's Action phase.

## Phase 6 — Polish, performance, mobile ⏳

Basic responsiveness works now: on phones the camera pulls back to fit the island and side
panels collapse behind a toggle. A dedicated mobile layout is still pending.

## Official rulebook checklist

Audited against the 5th-edition *Game Rules & Almanac* (2020). ✅ = implemented in the engine and covered by tests.

| Rule (rulebook page) | Status | Where |
| --- | --- | --- |
| 19 hexes, 18 tokens (no 7), red 6/8 never adjacent in random set-up (p.13) | ✅ | `board.ts` |
| 9 harbors: 4× 3:1 generic, 5× 2:1 specific (p.2, 9) | ✅ | `board.ts`, `trading.ts` |
| 95 resource cards (19 each), 25 dev cards (14/2/2/2/5), 15 roads / 5 settlements / 4 cities (p.2) | ✅ | `constants.ts` |
| Opening roll: highest roll starts, ties re-roll (p.12) | ✅ | `game.ts` (rule audit fix) |
| Snake setup; 2nd road must touch 2nd settlement; start resources from 2nd settlement; starting player rolls first (p.12) | ✅ | `actions.ts` |
| Distance rule (p.7) | ✅ | `placement.ts` |
| Must roll first; production 1 per settlement, 2 per city; robber blocks its hex (p.4, 10) | ✅ | `production.ts` |
| Bank shortage: nobody gets that resource unless only 1 player is affected (p.4, 10) | ✅ | `production.ts` |
| 7: >7 cards discard half (round down) → must move robber to another hex (desert allowed) → steal 1 random card, choose victim if several (p.5, 11) | ✅ | `actions.ts` |
| Road connects to own road/building; opponent settlement blocks through-connection (p.11, Illus. K) | ✅ | `placement.ts` |
| Settlement must touch own road; city upgrades own settlement and the settlement returns to supply (p.5–6) | ✅ | `actions.ts` |
| Piece limits enforced (p.4) | ✅ | `actions.ts` |
| Combined trade/build phase, any order after rolling (p.6) | ✅ | `main` phase |
| Win with 10+ VP during your own turn; points reached off-turn are claimed at the start of your next turn (p.5, 7) | ✅ | `actions.ts` (rule audit fix) |
| Maritime trade 4:1 / 3:1 / 2:1, only on your turn, multiples allowed (p.9, 14) | ✅ | `trade-actions.ts` |
| Domestic trade only with the active player; no gifts, no like-for-like (p.7, 14) | ✅ | `trade-actions.ts` |
| Buy dev card (ore + wool + grain), not when the deck is empty (p.5) | ✅ | `devcard-actions.ts` |
| Play 1 dev card per turn, any time incl. before rolling, not one bought this turn (p.5, 7) | ✅ | `devcard-actions.ts` |
| VP cards: hidden, may be revealed the turn bought to win (p.7) | ✅ | `devcard-actions.ts` |
| Knight → robber; Largest Army at 3+ knights, strictly more to take over (p.8) | ✅ | `awards.ts` |
| Road Building (2 free roads), Year of Plenty (any 2), Monopoly (all of one type) (p.10) | ✅ | `devcard-actions.ts` |
| Longest Road ≥5, single longest branch, broken by settlements, tie/set-aside special case (p.9) | ✅ | `awards.ts` |

Deliberate departures:
- The rulebook says hands are kept hidden. The **Open hands** setting is on by default to match the
  reference screenshot. Turn it off in Settings for rules-accurate hidden hands.
- The fixed beginners' map is not included. Islands are always generated with the rulebook's
  variable set-up, which keeps the game original.

## Known limitations right now

- In pass-and-play, each player answers a trade offer on the shared screen, so with hidden hands
  the other players can see the answers. Online play keeps answers private.
- Online, a game waits for a disconnected player to return; there is no turn timer yet.
