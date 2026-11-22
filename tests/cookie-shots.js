// Game shots with the set F cookies: node tests/cookie-shots.js [WxH] [level]
// shots/ck-board-<sz>.png (start), ck-lit-<sz>.png (lit + crumbled), ck-home-<sz>.png
const { chromium } = require('playwright-core');
const sz = process.argv.find(a => /^\d+x\d+$/.test(a)) || '390x844', LV = +(process.argv.find(a => /^\d+$/.test(a)) || 12);
const OUT = __dirname + '/../shots', sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const [w, h] = sz.split('x').map(Number);
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, locale: 'de-DE' });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
  await p.goto('http://localhost:8792/index.html'); await p.waitForFunction(() => document.documentElement.dataset.ready === '1');
  await p.evaluate(() => { localStorage.setItem('squishdoku-v1', JSON.stringify({ v: 3, unlocked: 40, stars: {}, times: {}, seenRules: true, revealed: {}, daily: { done: {}, streak: 0, best: 0, total: 0 }, settings: { vibration: true, showTime: true } })); });
  await p.reload(); await p.waitForFunction(() => document.documentElement.dataset.ready === '1'); await p.evaluate(() => { SquishDoku.adPacing.takeInterstitial = () => false; });
  await sleep(800); await p.screenshot({ path: `${OUT}/ck-home-${sz}.png` });
  await p.evaluate(lv => SquishDoku.startLevel(lv), LV); await sleep(2500);
  await p.screenshot({ path: `${OUT}/ck-board-${sz}.png` });
  await p.evaluate(() => { const S = SquishDoku.state; for (const r of [0, 2]) SquishDoku.act.hold(r, S.L.solution[r]);
    const c0 = S.L.solution[0]; for (let c = 0; c < S.N; c++) if (c !== c0) SquishDoku.act.swipe(0, c);
    const c1 = S.L.solution[1]; SquishDoku.act.swipe(1, (c1 + 2) % S.N); });
  for (const t of [1, 2, 3, 4, 5]) { await sleep(350); await p.screenshot({ path: `${OUT}/ck-crumble${t}-${sz}.png` }); }
  await sleep(2500); await p.screenshot({ path: `${OUT}/ck-lit-${sz}.png` });
  console.log(sz, 'frames', await p.evaluate(() => SquishDoku.board.stats.frames), errs.length ? 'LOG: ' + errs.join(' | ') : 'no errors');
  await b.close();
})();
