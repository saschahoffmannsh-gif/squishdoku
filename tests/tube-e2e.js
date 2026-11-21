// Neon-tube preview e2e (real touch via CDP): node tests/tube-e2e.js [baseUrl]
// hold = LED on, hold wrong = heart, swipe = pressed in dark, tap = springs back up, whole region = tube lit, solve = win.
const { chromium } = require('playwright-core');
const BASE = process.argv.find(a => a.startsWith('http')) || 'http://localhost:8792/tube.html';
const LV = +(process.env.LV || 6);
let failures = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) failures++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function run(vp) {
  console.log(`\n=== ${vp.width}x${vp.height} L${LV} ===`);
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 2, hasTouch: true, isMobile: true, locale: 'de-DE' });
  const p = await ctx.newPage(); const errors = [];
  p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const cdp = await ctx.newCDPSession(p);
  const touch = (type, x, y, timestamp) => cdp.send('Input.dispatchTouchEvent', { type, ...(timestamp ? { timestamp } : {}), touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }] });
  const pos = (r, c) => p.evaluate(([r, c]) => { const s = SquishDoku.board.screenOf(r, c); return { x: s.x, y: s.y }; }, [r, c]);
  async function hold(r, c) { await p.evaluate(() => { SquishDoku.holdMs = 400; }); const q = await pos(r, c); await touch('touchStart', q.x, q.y); await sleep(1200); await touch('touchEnd'); await sleep(200); }
  async function tap(r, c) { await p.evaluate(() => { SquishDoku.holdMs = 5000; }); const q = await pos(r, c); const t0 = Date.now() / 1000; await touch('touchStart', q.x, q.y, t0); await touch('touchEnd', 0, 0, t0 + .06); await sleep(250); }
  async function swipe(cells) { await p.evaluate(() => { SquishDoku.holdMs = 8000; });
    const pts = []; for (const [r, c] of cells) pts.push(await pos(r, c)); if (pts.length === 1) pts.push({ x: pts[0].x + 18, y: pts[0].y + 3 });
    await touch('touchStart', pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) for (let k = 1; k <= 6; k++) await touch('touchMove', pts[i - 1].x + (pts[i].x - pts[i - 1].x) * k / 6, pts[i - 1].y + (pts[i].y - pts[i - 1].y) * k / 6);
    await touch('touchEnd'); await sleep(300); }
  const st = () => p.evaluate(() => { const S = SquishDoku.state; return { hearts: S.hearts, glow: S.glow, grid: S.state.map(r => r.slice()), sol: S.L.solution, regions: S.L.regions, N: S.N }; });
  await p.goto(BASE + '?level=' + LV); await p.waitForFunction(() => window.SquishDoku?.board?.pieces?.length, null, { timeout: 90000 }); await sleep(800);
  let s = await st(); const N = s.N;
  ok(await p.evaluate(() => !!document.querySelector('#host canvas') && SquishDoku.board.pieces.length > 0), 'tube board rendered: ' + await p.evaluate(() => SquishDoku.board.pieces.length) + ' tube pieces for ' + N + ' colours');
  const tubesCoverAll = await p.evaluate(() => SquishDoku.board.cells.every(c => c.piece));
  ok(tubesCoverAll, 'every cell lies on a tube');
  // hold a solution cell -> LED glows
  await hold(0, s.sol[0]); s = await st();
  ok(s.grid[0][s.sol[0]] === 'glow' && s.hearts === 3, 'hold on solution cell → LED on (glow), no heart lost');
  ok(await p.evaluate(([r, c]) => SquishDoku.board.cellAt(r, c).led > .5 && SquishDoku.board.cellAt(r, c).press > .9, [0, s.sol[0]]), 'tube is pressed into the groove and lit at that cell');
  // wrong hold
  let wr = null; for (let r = N - 1; r >= 0 && !wr; r--) for (let c = 0; c < N; c++) if (s.sol[r] !== c && Math.abs(r - 0) > 1) { wr = [r, c]; break; }
  await hold(...wr); s = await st();
  ok(s.hearts === 2 && s.grid[wr[0]][wr[1]] === 'normal', 'hold on a wrong cell → heart lost, tube springs back up');
  // swipe row 2 (skip solution cell): pressed in dark
  const row = 2, runA = [], runB = []; for (let c = 0; c < N; c++) { if (c < s.sol[row]) runA.push([row, c]); if (c > s.sol[row]) runB.push([row, c]); }
  if (runA.length) await swipe(runA); if (runB.length) await swipe(runB); s = await st();
  ok(s.grid[row].every((v, c) => c === s.sol[row] ? v === 'normal' : v === 'popped') && s.hearts === 2, 'swipe over a row → all non-solution cells pressed in (' + s.grid[row].join(',') + ')');
  await sleep(600);
  ok(await p.evaluate(r => SquishDoku.board.cells.filter(c => c.r === r && c.state === 'popped').every(c => c.press > .9), row), 'pressed cells sit in the groove');
  // tap a pressed cell -> back up
  const tc = runA[0] || runB[0]; await tap(...tc); s = await st();
  ok(s.grid[tc[0]][tc[1]] === 'normal', 'tap on a pressed cell → tube pops back up');
  await swipe([tc]);
  // solve everything: hold each solution, swipe each remaining non-solution cell
  for (let r = 0; r < N; r++) if ((await st()).grid[r][s.sol[r]] !== 'glow') await hold(r, s.sol[r]);
  const lit0 = await p.evaluate(() => [...SquishDoku.board.regions.values()].filter(r => r.lit).length);
  for (let r = 0; r < N; r++) { const g = (await st()).grid; const left = []; for (let c = 0; c < N; c++) if (g[r][c] === 'normal' && c !== s.sol[r]) left.push([r, c]);
    for (const cell of left) { if ((await p.evaluate(() => SquishDoku.state.locked))) break; await swipe([cell]); } }
  await sleep(2500);
  s = await st();
  const litN = await p.evaluate(() => [...SquishDoku.board.regions.values()].filter(r => r.lit).length);
  ok(litN === N, `all ${N} tubes lit after every colour is pressed in (${litN}, ${lit0} before the last swipes)`);
  const kind = await p.evaluate(() => document.getElementById('veil').hidden ? null : document.getElementById('dialog').dataset.kind);
  ok(kind === 'win' && s.hearts === 2, 'puzzle solved → win dialog (' + kind + ', hearts ' + s.hearts + ')');
  ok(errors.length === 0, 'no console errors ' + (errors.length ? errors.slice(0, 3).join(' | ') : ''));
  await b.close();
}
(async () => { await run({ width: 390, height: 844 }); await run({ width: 375, height: 667 }); console.log(failures ? `\n${failures} FAILED` : '\nALL OK'); process.exit(failures ? 1 : 0); })();
