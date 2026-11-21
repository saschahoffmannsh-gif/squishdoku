// Neon-tube preview frame-time probe: 390x844 @3x, CPU throttled 4x, hold-to-LED, swipe row, light a whole tube.
// JS time per rendered frame = state update + three.js submit of all passes (scene + bloom when glowing).
const { chromium } = require('playwright-core');
const BASE = process.argv.find(a => a.startsWith('http')) || 'http://localhost:8792/tube.html';
const LV = +(process.env.LV || 37);
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: +(process.env.DPR || 3), hasTouch: true, isMobile: true });
  const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p);
  const errors = []; p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const tl0 = Date.now();
  await p.goto(BASE + '?level=' + LV); await p.waitForFunction(() => window.SquishDoku?.board?.pieces?.length, null, { timeout: 90000 });
  const firstLevelMs = Date.now() - tl0;
  await sleep(1000);
  const tb0 = await p.evaluate(() => { const t = performance.now(); SquishDoku.startLevel(SquishDoku.state.id); return performance.now() - t; });
  await sleep(800);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await p.evaluate(() => { window.__tubePerf = { frames: [], js: [], long: [] }; try { new PerformanceObserver(l => l.getEntries().forEach(e => window.__tubePerf.long.push(e.duration))).observe({ entryTypes: ['longtask'] }); } catch {} });
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }] });
  const pos = (r, c) => p.evaluate(([r, c]) => { const s = SquishDoku.board.screenOf(r, c); return { x: s.x, y: s.y }; }, [r, c]);
  const reset = () => p.evaluate(() => { const W = window.__tubePerf; W.frames.length = W.js.length = W.long.length = 0; W.lastR = 0; });
  const stats = name => p.evaluate(name => { const W = window.__tubePerf, q = (a, x) => { const s = [...a].sort((m, n) => m - n); return s.length ? +s[Math.min(s.length - 1, Math.floor(s.length * x))].toFixed(1) : 0; };
    return { phase: name, renderedFrames: W.js.length, jsPerFrameMs: { p50: q(W.js, .5), p95: q(W.js, .95), max: q(W.js, 1) }, frameIntervalMs: { p50: q(W.frames, .5), p95: q(W.frames, .95) }, longTasks: W.long.length, longestTaskMs: +(Math.max(0, ...W.long)).toFixed(0) }; }, name);
  const L = await p.evaluate(() => ({ sol: SquishDoku.state.L.solution, N: SquishDoku.state.N, regions: SquishDoku.state.L.regions }));
  await reset(); const q = await pos(0, L.sol[0]); await touch('touchStart', q.x, q.y); await sleep(700); await touch('touchEnd'); await sleep(1500);
  const glow = await stats('hold-led');
  await p.evaluate(() => SquishDoku.holdMs = 6000);
  const row = 3, pts = []; for (let c = 0; c < L.N; c++) if (c !== L.sol[row]) pts.push(await pos(row, c));
  await reset(); await touch('touchStart', pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) for (let k = 1; k <= 6; k++) { await touch('touchMove', pts[i - 1].x + (pts[i].x - pts[i - 1].x) * k / 6, pts[i - 1].y + (pts[i].y - pts[i - 1].y) * k / 6); await sleep(16); }
  await touch('touchEnd'); await sleep(2000);
  const swipe = await stats('swipe-press-row');
  // light the region of the first-row LED completely (board API, the game does the same per swipe)
  await reset();
  await p.evaluate(() => { const B = SquishDoku.board, S = SquishDoku.state; const r0 = 0, c0 = S.L.solution[0]; const reg = B.regions.get(S.L.regions[r0].charCodeAt(c0) - 97); for (const cl of reg.cells) if (cl.state === 'normal') B.pop(cl.r, cl.c); });
  await sleep(3000);
  const lit = await stats('tube-lights-up');
  await reset(); await sleep(1500); const idle = await p.evaluate(() => window.__tubePerf.js.length);
  const info = await p.evaluate(() => ({ dpr: devicePixelRatio, pixelRatio: SquishDoku.board.renderer.getPixelRatio(), programs: SquishDoku.board.renderer.info.programs.length, tris: SquishDoku.board.renderer.info.render.triangles, calls: SquishDoku.board.renderer.info.render.calls }));
  console.log(JSON.stringify({ level: LV, cpuThrottle: 4, firstLevelLoadMs: firstLevelMs, levelRebuildMs: +tb0.toFixed(0), ...info, glow, swipe, lit, framesWhileIdle1500ms: idle, errors }, null, 1));
  await b.close();
})();
