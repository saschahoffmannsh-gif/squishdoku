// Verification shots of the Neon-Nacht menus with a realistic save. node tests/neon-shots.js [baseUrl] [WxH ...]
// Writes shots/nn-<screen>-<W>x<H>.png (dpr 2) and, for 390x844, shots/neon-overview.png.
const { chromium } = require('playwright-core');
const fs = require('fs');
const BASE = process.argv.find(a => a.startsWith('http')) || 'http://localhost:8792/index.html';
const sizes = process.argv.filter(a => /^\d+x\d+$/.test(a)); if (!sizes.length) sizes.push('390x844', '375x667');
const OUT = __dirname + '/../shots'; fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
// a player mid-way: L1–17 solved, a few perfect, five dailies in a row this week
function seed(today) {
  const add = (k, n) => new Date(Date.parse(k + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
  const stars = {}, times = {}; const S = [3,3,2,3,3,2,3,1,3,2,3,3,2,3,3,3,2];
  S.forEach((s, i) => { stars[i + 1] = s; times[i + 1] = (35 + ((i * 37) % 70)) * 1000 + (i < 14 ? 0 : 30000); });
  const done = {}; for (let d = -5; d <= -1; d++) done[add(today, d)] = { stars: 2 + (d % 2 ? 1 : 0), ms: 98000, hearts: 3 };
  return { v: 3, unlocked: 18, stars, times, seenRules: true, revealed: {}, rulesCollapsed: false, daily: { done, streak: 5, best: 9, last: add(today, -1), total: 23 }, settings: { vibration: true, showTime: true } };
}
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  for (const sz of sizes) {
    const [w, h] = sz.split('x').map(Number);
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, locale: 'de-DE' });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await p.goto(BASE); await p.waitForFunction(() => document.documentElement.dataset.ready === '1');
    const today = await p.evaluate(() => SquishDoku.today);
    await p.evaluate(s => { localStorage.setItem('squishdoku-v1', JSON.stringify(s)); }, seed(today));
    await p.reload(); await p.waitForFunction(() => document.documentElement.dataset.ready === '1');
    await p.evaluate(() => { SquishDoku.adPacing.takeInterstitial = () => false; }); await p.evaluate(() => document.fonts.ready);
    const shot = async n => { await sleep(700); await p.screenshot({ path: `${OUT}/nn-${n}-${sz}.png` }); };
    await shot('home');
    await p.tap('#btn-levels'); await shot('levels');
    await p.tap('#tab-stats'); await shot('stats');
    await p.tap('#tab-home'); await sleep(300); await p.tap('#btn-settings'); await shot('settings');
    await p.tap('#sheet-close'); await sleep(300);
    await p.evaluate(() => SquishDoku.showHome('rules')); await shot('rules');
    await p.evaluate(() => SquishDoku.startLevel(18)); await sleep(1500);
    // light two correct squishes for a mid-game look
    await p.evaluate(() => { const S = SquishDoku.state; for (const r of [0, 2]) SquishDoku.act.hold(r, S.L.solution[r]); }); await sleep(600);
    await shot('game');
    await p.evaluate(() => { const S = SquishDoku.state; for (let r = 0; r < S.N; r++) if (S.state[r][S.L.solution[r]] !== 'glow') SquishDoku.act.hold(r, S.L.solution[r]); });
    await p.waitForFunction(() => document.getElementById('dialog').dataset.kind === 'win', null, { timeout: 8000 }); await sleep(1600);
    await shot('win');
    await p.evaluate(() => { const S = SquishDoku.state; }); 
    console.log(sz, errs.length ? 'ERRORS: ' + errs.join(' | ') : 'no errors');
    await ctx.close();
  }
  await b.close();
})();
