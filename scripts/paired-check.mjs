// Drives a local 5-player game in the browser to the paired-players Action phase and screenshots it.
// Usage: node scripts/paired-check.mjs <outDir> [url]
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync } from 'node:fs';

const [outDir = 'shots', url = 'http://localhost:5174/?quick=5&seed=7'] = process.argv.slice(2);
const executablePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ executablePath, args: ['--use-angle=d3d11', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: 1366, height: 768 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(2500);

const report = await page.evaluate(async () => {
  const { engine, store } = window.__islandProbe;
  const st = () => store.getState();
  const log = [];
  // turn the hand-off curtain off so a single browser can play every seat
  st().updateSettings({ handoff: false });
  let guard = 0;
  while (st().game.phase === 'setup' && guard++ < 100) {
    const g = st().game;
    const spots = g.setup.step === 'settlement' ? engine.validSetupSettlementSpots(g) : engine.validSetupRoadSpots(g);
    st().dispatch(g.setup.step === 'settlement' ? { type: 'PLACE_SETUP_SETTLEMENT', player: g.currentPlayer, vertex: spots[0] } : { type: 'PLACE_SETUP_ROAD', player: g.currentPlayer, edge: spots[0] });
  }
  log.push(`after setup: phase=${st().game.phase} current=${st().game.currentPlayer} leader=${st().game.turnLeader} paired=${st().game.paired}`);
  st().rollDice();
  await new Promise((r) => setTimeout(r, 4000));
  // resolve a 7 if one came up
  guard = 0;
  while (st().game.phase !== 'main' && guard++ < 20) {
    const g = st().game;
    if (g.phase === 'discard') {
      for (const [who, n] of Object.entries(g.pendingDiscards)) {
        const hand = { ...g.players[Number(who)].resources };
        const out = { wood: 0, brick: 0, wool: 0, grain: 0, ore: 0 };
        for (let i = 0; i < n; i++) {
          const r = engine.RESOURCES.find((x) => hand[x] > 0);
          hand[r]--;
          out[r]++;
        }
        st().dispatch({ type: 'DISCARD', player: Number(who), resources: out });
      }
    } else if (g.phase === 'moveRobber') st().dispatch({ type: 'MOVE_ROBBER', player: g.currentPlayer, hex: g.board.hexes.find((h) => h.id !== g.robberHex).id });
    else if (g.phase === 'steal') st().dispatch({ type: 'STEAL', player: g.currentPlayer, victim: g.robberVictims[0] });
    else break;
  }
  log.push(`after roll: phase=${st().game.phase} current=${st().game.currentPlayer}`);
  st().dispatch({ type: 'END_TURN', player: st().game.currentPlayer });
  const g = st().game;
  log.push(`after end turn: phase=${g.phase} current=${g.currentPlayer} pairedTurn=${g.pairedTurn} leader=${g.turnLeader}`);
  const roll = engine.applyAction(g, { type: 'ROLL_DICE', player: g.currentPlayer });
  log.push(`player 2 roll attempt ok=${roll.ok} ${roll.ok ? '' : roll.error}`);
  const trade = engine.applyAction(g, { type: 'PROPOSE_TRADE', player: g.currentPlayer, give: { wood: 1 }, want: { ore: 1 } });
  log.push(`player 2 player-trade attempt ok=${trade.ok} ${trade.ok ? '' : trade.error}`);
  st().togglePanel('trade');
  return log;
});
console.log(report.join('\n'));
await page.waitForTimeout(1500);
await page.screenshot({ path: `${outDir}/paired-turn.png` });
console.log(errors.length ? `errors: ${errors.slice(0, 3).join(' | ')}` : 'no page errors');
await browser.close();
