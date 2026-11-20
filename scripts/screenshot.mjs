// Screenshot the running dev client at several viewport sizes using the installed Chrome/Edge.
// Usage: node scripts/screenshot.mjs <url> <outDir> [name] [WxH ...]
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const [url = 'http://localhost:5173/?quick=4&seed=123&auto=8&ai=3', outDir = 'shots', name = 'shot', ...sizes] = process.argv.slice(2);
const viewports = (sizes.length ? sizes : ['390x844', '820x1180', '1024x768', '1366x768', '1920x1080']).map((s) => s.split('x').map(Number));
const candidates = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];
const executablePath = candidates.find((p) => existsSync(p));
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ executablePath, args: ['--use-angle=d3d11', '--enable-webgl', '--ignore-gpu-blocklist'] });
for (const [w, h] of viewports) {
  const isPhone = w < 600;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: isPhone, isMobile: isPhone });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(Number(process.env.WAIT ?? 2500));
  const file = path.join(outDir, `${name}-${w}x${h}.png`);
  await page.screenshot({ path: file });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  console.log(file, overflow ? 'HORIZONTAL OVERFLOW' : '', errors.length ? `errors: ${errors.slice(0, 3).join(' | ')}` : '');
  await ctx.close();
}
await browser.close();
