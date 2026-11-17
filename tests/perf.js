// Frame-time probe: 390x844 @3x, CPU throttled 4x via CDP, during hold-to-glow and swipe-pop.
// Software GL (swiftshader) in headless Chrome is far slower than an iPhone GPU, so the wall
// frame interval is pessimistic; the JS time per frame (game loop + three.js submit) is the
// part that matters for jank on a device.
const { chromium } = require('playwright-core');
const BASE = process.argv.find(a => a.startsWith('http')) || 'http://localhost:8792/index.html';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: +(process.env.DPR || 3), hasTouch: true, isMobile: true });
  const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p);
  const errors = []; p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await p.goto(BASE); await p.waitForFunction(() => document.documentElement.dataset.ready === '1');
  await p.evaluate(() => { localStorage.setItem('squishdoku-v1', JSON.stringify({ v: 2, unlocked: 5, stars: {}, seenRules: true })); });
  await p.reload(); await p.waitForFunction(() => document.documentElement.dataset.ready === '1');
  const lv = +(process.env.LV || 1);
  await p.evaluate(lv => SquishDoku.startLevel(lv), lv); await sleep(1500);
  if (await p.isVisible('#veil')) { await p.click('#dialog .aw-btn'); await sleep(500); }
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  // instrument: wall interval between rendered frames + JS time inside each animation frame
  await p.evaluate(() => {
    const W = window.__perf = { frames: [], js: [], long: [] };
    const gfx = SquishDoku.board.graphics, orig = gfx.render.bind(gfx); let lastR = 0;
    gfx.render = dt => { const t0 = performance.now(); const r = orig(dt); const t1 = performance.now(); W.js.push(t1 - t0); if (lastR) W.frames.push(t0 - lastR); lastR = t0; return r; };
    try { new PerformanceObserver(l => l.getEntries().forEach(e => W.long.push(e.duration))).observe({ entryTypes: ['longtask'] }); } catch {}
  });
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }] });
  const pos = (r, c) => p.evaluate(([r, c]) => { const s = SquishDoku.board.screenOf(r, c); return { x: s.x, y: s.y }; }, [r, c]);
  const reset = () => p.evaluate(() => { const W = window.__perf; W.frames.length = W.js.length = W.long.length = 0; });
  const stats = name => p.evaluate(name => {
    const W = window.__perf, q = (a, x) => { const s = [...a].sort((m, n) => m - n); return s.length ? +s[Math.min(s.length - 1, Math.floor(s.length * x))].toFixed(1) : 0; };
    return { phase: name, renderedFrames: W.js.length, jsPerFrameMs: { p50: q(W.js, .5), p95: q(W.js, .95), max: q(W.js, 1) }, frameIntervalMs: { p50: q(W.frames, .5), p95: q(W.frames, .95), max: q(W.frames, 1) }, longTasks: W.long.length, longestTaskMs: +(Math.max(0, ...W.long)).toFixed(0) };
  }, name);
  const sol = await p.evaluate(() => SquishDoku.state.L.solution);
  const prog = () => p.evaluate(() => SquishDoku.board.graphics.renderer.info.programs.length);
  const progNames = () => p.evaluate(() => SquishDoku.board.graphics.renderer.info.programs.map(x=>x.name+'#'+x.cacheKey.length));
  const namesStart = await progNames();
  const progStart = await prog();
  // hold-to-glow on a solution squish
  await reset(); const q = await pos(0, sol[0]); await touch('touchStart', q.x, q.y); await sleep(700); await touch('touchEnd'); await sleep(1500);
  const glow = await stats('hold-glow');
  // swipe-pop along row 2 (skip the solution cell)
  await p.evaluate(() => SquishDoku.holdMs = 3000);
  const N = await p.evaluate(() => SquishDoku.state.N), row = 2, pts = [];
  for (let c = 0; c < N; c++) if (c !== sol[row]) pts.push(await pos(row, c));
  await reset(); await touch('touchStart', pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) for (let k = 1; k <= 6; k++) { await touch('touchMove', pts[i - 1].x + (pts[i].x - pts[i - 1].x) * k / 6, pts[i - 1].y + (pts[i].y - pts[i - 1].y) * k / 6); await sleep(16); }
  await touch('touchEnd'); await sleep(2000);
  const swipe = await stats('swipe-pop');
  swipe.newShaderPrograms = (await prog()) - progStart;
  swipe.newProgramNames = (await progNames()).filter(n => !namesStart.includes(n));
  swipe.spikeFrames = await p.evaluate(() => window.__perf.js.map((v,i)=>[i,+v.toFixed(0)]).filter(x=>x[1]>50));
  const idle0 = await p.evaluate(() => window.__perf.js.length); await sleep(1500); const idle1 = await p.evaluate(() => window.__perf.js.length);
  const info = await p.evaluate(() => ({ dpr: devicePixelRatio, pixelRatio: SquishDoku.board.graphics.renderer.getPixelRatio(), popped: SquishDoku.state.state.flat().filter(s => s === 'popped').length }));
  console.log(JSON.stringify({ level: lv, cpuThrottle: 4, ...info, glow, swipe, framesWhileIdle1500ms: idle1 - idle0, errors }, null, 1));
  await b.close();
})();
