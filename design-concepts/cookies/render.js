// Renders the cookie sets.  node design-concepts/cookies/render.js [sets=A,B,C] [views=lineup,board]
// Needs the repo served on :8792 (python3 -m http.server 8792 in the repo root). Writes cookies/shots/<set>-<view>.png
const { chromium } = require('playwright-core');
const path = require('path');
const sets = (process.argv[2] || 'A,B,C').split(','), views = (process.argv[3] || 'lineup,board').split(',');
const extra = process.argv[4] || '';
const BASE = process.env.BASE || 'http://localhost:8792/design-concepts/cookies/render.html';
const SIZE = { lineup: [1600, 900], board: [900, 1100], single: [900, 700] };
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  for (const s of sets) for (const v of views) {
    const [w, h] = SIZE[v]; const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
    const p = await ctx.newPage(); p.on('pageerror', e => console.log('ERR', e.message)); p.on('console', m => (m.type() === 'error' || m.text().startsWith('toneMapping')) && console.log('C', m.text()));
    const t = Date.now(); await p.goto(`${BASE}?set=${s}&view=${v}${extra}`);
    await p.waitForFunction(() => document.documentElement.dataset.ready === '1' || document.documentElement.dataset.error, null, { timeout: 600000 });
    const err = await p.evaluate(() => document.documentElement.dataset.error); if (err) console.log('ERROR', err);
    const f = path.join(__dirname, 'shots', `${s}-${v}${extra ? '-' + extra.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') : ''}.png`); await p.screenshot({ path: f }); console.log(f, Date.now() - t, 'ms');
    await ctx.close();
  }
  await b.close();
})();
