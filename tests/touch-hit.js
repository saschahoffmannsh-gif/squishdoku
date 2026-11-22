// Touch → squish mapping test (playwright-core + /usr/bin/google-chrome, real CDP touch events).
// For every cell it touches three points projected from 3D: the body centre, the top and the lower
// front side (the part the old plane picker gave to the row below). The expected squish is found by
// an independent raycast against all squish bodies (what is actually drawn under the finger); the
// game must press exactly that squish. Repeated after folding the rules bar, after viewport height
// changes and after a forced page scroll (iOS), plus a check that the page fills the screen (no gap).
// Usage: node tests/touch-hit.js [baseUrl]
const { chromium } = require('playwright-core');
const BASE = process.argv.find(a => a.startsWith('http')) || 'http://localhost:8792/index.html';
const sleep = ms => new Promise(r => setTimeout(r, ms));
let failures = 0;
const ok = (cond, msg) => { console.log((cond ? '  ✔ ' : '  ✘ ') + msg); if (!cond) failures++; };

async function session(vp, { standalone = false } = {}) {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: vp, screen: standalone ? { width: vp.width, height: standalone } : vp, deviceScaleFactor: 2, hasTouch: true, isMobile: true, locale: 'de-DE' });
  if (standalone) await ctx.addInitScript(() => Object.defineProperty(navigator, 'standalone', { get: () => true }));
  const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p); if (+process.env.THROTTLE > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: +process.env.THROTTLE }); // THROTTLE=4: CPU x4
  const errors = []; p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await p.goto(BASE); await p.evaluate(() => localStorage.setItem('squishdoku-v1', JSON.stringify({ v: 2, unlocked: 50, stars: { 1: 3, 2: 3, 3: 3 }, seenRules: true, revealed: {} })));
  await p.reload(); await p.waitForFunction(() => document.documentElement.dataset.ready === '1');
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' || type === 'touchCancel' ? [] : [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }] });
  async function start(lv) {
    await p.evaluate(lv => SquishDoku.startLevel(lv), lv);
    await p.waitForFunction(lv => SquishDoku.state?.id === lv && SquishDoku.board.stats.frames > 1, lv, { timeout: 30000 }); await sleep(900);
    await p.evaluate(async () => {
      const { THREE } = await import('/vendor/squish-attack/squish/squish-graphics.js?v=play-sharp-1');
      const B = SquishDoku.board; window.__log = []; SquishDoku.holdMs = 5000; SquishDoku.holdMs = 5000;
      if (!B.__wrapped) { const orig = B.press; B.press = (r, c) => { window.__log.push([r, c]); return orig(r, c); }; B.__wrapped = true; }
      // ground truth: nearest squish body under a screen point (independent of the game's picker)
      window.__truth = (x, y) => {
        const g = B.graphics, rc = g.renderer.domElement.getBoundingClientRect(), ray = new THREE.Raycaster();
        ray.setFromCamera(new THREE.Vector2((x - rc.left) / rc.width * 2 - 1, -(y - rc.top) / rc.height * 2 + 1), g.camera);
        const S = SquishDoku.state; let best = null;
        for (let r = 0; r < S.N; r++) for (let c = 0; c < S.N; c++) { const s = B.cellAt(r, c).s; s.group.updateMatrixWorld(true); const h = ray.intersectObject(s.body, false)[0]; if (h && (!best || h.distance < best.d)) best = { d: h.distance, r, c }; }
        return best && [best.r, best.c];
      };
      // truth taken in the same instant the game picks (window capture runs before the board handler)
      if (!window.__tw) { window.__tw = true; addEventListener('pointerdown', e => { window.__downTruth = window.__truth(e.clientX, e.clientY); }, true); }
    });
  }
  // touch every cell at three projected points; returns mismatch count
  async function sweep(label) {
    const N = await p.evaluate(() => SquishDoku.state.N);
    let tested = 0, wrong = 0, centreOff = 0; const bad = [];
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) for (const [lift, dz, kind] of [[.6, 0, 'centre'], [1.2, 0, 'top'], [.35, .3, 'front']]) {
      const q = await p.evaluate(([r, c, lift, dz]) => { const s = SquishDoku.board.screenOf(r, c, lift, dz); return { x: s.x, y: s.y, t: window.__truth(s.x, s.y) }; }, [r, c, lift, dz]);
      if (!q.t) continue;
      if (kind === 'centre' && (q.t[0] !== r || q.t[1] !== c)) centreOff++;
      await p.evaluate(() => { window.__log.length = 0; window.__downTruth = null; });
      // finger down only (a touch held 220 ms and released before the hold time neither pops nor glows)
      await touch('touchStart', q.x, q.y); await sleep(220); await touch('touchEnd'); await sleep(60);
      const [got, t] = await p.evaluate(() => [window.__log[0] || null, window.__downTruth]); if (t) q.t = t;
      tested++;
      if (!got || got[0] !== q.t[0] || got[1] !== q.t[1]) { wrong++; if (bad.length < 4) bad.push(`${kind} ${r},${c}: drawn ${q.t} pressed ${got}`); }
    }
    ok(wrong === 0 && centreOff === 0 && tested >= N * N * 2, `${label}: ${tested} touches, pressed squish = squish drawn under the finger${wrong ? ` (${wrong} wrong: ${bad.join('; ')})` : ''}${centreOff ? ` (${centreOff} centres not on their own squish)` : ''}`);
    await sleep(300);
  }
  const noGap = () => p.evaluate(() => {
    const H = document.documentElement.classList.contains('is-standalone') ? parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--app-h')) : innerHeight;
    const g = document.getElementById('game').getBoundingClientRect(), bg = document.body.getBoundingClientRect(), cv = document.querySelector('#host canvas').getBoundingClientRect();
    return { ok: scrollY === 0 && document.scrollingElement.scrollTop === 0 && g.top === 0 && Math.abs(g.bottom - H) < 1 && Math.abs(bg.bottom - H) < 1 && Math.abs(cv.bottom - H) < 1, H, g: [g.top, g.bottom], bg: bg.bottom, cv: cv.bottom, sy: scrollY };
  });
  return { b, p, cdp, start, sweep, noGap, errors };
}

(async () => {
  for (const vp of [{ width: 390, height: 844 }, { width: 375, height: 667 }]) {
    console.log(`\n=== ${vp.width}x${vp.height} ===`);
    const s = await session(vp); const { p } = s;
    await s.start(41); await s.sweep('L41 8x8');
    await s.start(12); await s.sweep('L12 5x5');
    await p.click('.sd-rb-toggle'); await sleep(500);
    ok(await p.evaluate(() => document.getElementById('rulesbar').classList.contains('is-collapsed')), 'rules bar folded');
    await s.sweep('L12 after folding the rules bar');
    await p.click('.sd-rb-toggle'); await sleep(500);
    await s.sweep('L12 after unfolding the rules bar');
    // iOS toolbar / URL bar: the viewport gets shorter and taller again
    await p.setViewportSize({ width: vp.width, height: vp.height - 90 }); await sleep(800);
    let g = await s.noGap(); ok(g.ok, `viewport ${vp.height - 90}px: page fills it, no gap (${JSON.stringify(g)})`);
    await s.sweep(`L12 after viewport height ${vp.height} → ${vp.height - 90}`);
    await p.setViewportSize(vp); await sleep(800);
    g = await s.noGap(); ok(g.ok, `viewport back to ${vp.height}px: no gap`);
    await s.sweep(`L12 after viewport height back to ${vp.height}`);
    // forced page scroll (what iOS sometimes leaves behind): snapped back, no gap, taps still hit
    await p.evaluate(() => { document.documentElement.style.height = '200%'; document.body.style.position = 'static'; document.body.style.height = '200%'; scrollTo(0, 120); document.scrollingElement.scrollTop = 120; });
    await p.evaluate(() => { document.documentElement.style.height = ''; document.body.style.position = ''; document.body.style.height = ''; });
    await p.evaluate(() => dispatchEvent(new Event('resize'))); await sleep(600);
    g = await s.noGap(); ok(g.ok, `forced page scroll: snapped back to 0, no gap (${JSON.stringify(g)})`);
    await s.sweep('L12 after a forced page scroll');
    // a swipe on the empty area outside the board must not scroll the page
    await s.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: vp.width / 2, y: vp.height - 20, id: 1 }] });
    for (let i = 1; i <= 8; i++) await s.cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: vp.width / 2, y: vp.height - 20 - i * 40, id: 1 }] });
    await s.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(400);
    g = await s.noGap(); ok(g.ok, 'swipe up outside the board: page does not move');
    ok(!s.errors.length, 'no console errors' + (s.errors.length ? ': ' + s.errors.slice(0, 3).join(' | ') : ''));
    await s.b.close();
  }
  // home-screen app whose layout viewport came back a status bar short (iOS bug): layers use the real screen height
  console.log('\n=== standalone, layout viewport 390x797 on a 390x844 screen ===');
  const s = await session({ width: 390, height: 797 }, { standalone: 844 });
  await s.start(12);
  const g = await s.noGap(); ok(g.ok && g.H === 844, `standalone: game, backdrop and canvas reach the real screen bottom (${JSON.stringify(g)})`);
  await s.sweep('standalone L12');
  await s.p.evaluate(() => SquishDoku.showHome('home')); await sleep(600);
  const hm = await s.p.evaluate(() => { const h = document.getElementById('home').getBoundingClientRect(), t = document.getElementById('tabs').getBoundingClientRect(); return { h: h.bottom, t: t.bottom }; });
  ok(Math.abs(hm.h - 844) < 1 && hm.t <= 844 && hm.t > 797, `standalone: menu + tab bar sit at the real screen bottom (${JSON.stringify(hm)})`);
  ok(!s.errors.length, 'no console errors');
  await s.b.close();
  console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
  process.exit(failures ? 1 : 0);
})();
