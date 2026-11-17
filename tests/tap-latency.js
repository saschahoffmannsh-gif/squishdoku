// Tap latency probe: real CDP touch taps (touchStart, 60 ms, touchEnd) on every main UI button,
// CPU throttled 4x. For each tap it measures, from the input timestamp of the pointerdown:
//   press = first frame in which the button looks pressed (transform changed)
//   frame = longest gap between two frames in the 2.5 s after the tap (a frozen page)
//   resp  = from the pointerup (the click fires there): first frame in which the result is shown (screen/dialog/class change)
// and fails if a tap does not register on the first try (no result within 2 s) or resp > LIMIT.
// Usage: node tests/tap-latency.js [baseUrl]   (env: RATE=4, LIMIT=100, VP=390x844)
const { chromium } = require('playwright-core');
const BASE = process.argv.find(a => a.startsWith('http')) || 'http://localhost:8792/index.html';
const RATE = +(process.env.RATE || 4), LIMIT = +(process.env.LIMIT || 100);
const sleep = ms => new Promise(r => setTimeout(r, ms));
let failures = 0;
const rows = [];

async function run(vp) {
  console.log(`\n=== ${vp.width}x${vp.height}, CPU ${RATE}x ===`);
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 2, hasTouch: true, isMobile: true, locale: 'de-DE' });
  const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p);
  const errors = []; p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await p.addInitScript(() => {
    const L = window.__lat = { down: 0, up: 0, downs: 0 };
    addEventListener('pointerdown', e => { L.down = e.timeStamp; L.downs++; }, true);
    addEventListener('pointerup', e => { L.up = e.timeStamp; }, true);
  });
  await p.goto(BASE); await p.evaluate(() => localStorage.setItem('squishdoku-v1', JSON.stringify({ unlocked: 50, stars: { 1: 3, 2: 3, 3: 3 }, seenRules: true, revealed: {} })));
  await p.reload(); await p.waitForFunction(() => document.documentElement.dataset.ready === '1'); await sleep(600);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: RATE });
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }] });

  // tap selector; `done` is a page-side predicate source (string) for "result visible"
  async function tap(name, sel, done, { settle = 700 } = {}) {
    await p.waitForSelector(sel, { state: 'visible', timeout: 10000 });
    await sleep(150);
    // keep the target inside its scroll box (level list)
    await p.evaluate(sel => { const el = document.querySelector(sel), sc = el.closest('.sd-levels-scroll'); if (sc) sc.scrollTop = Math.max(0, el.offsetTop - sc.clientHeight / 2); }, sel); await sleep(150);
    const box = await p.evaluate(sel => { const r = document.querySelector(sel).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, sel);
    // arm: watch frames for pressed look and the result
    await p.evaluate(([sel, done]) => {
      const L = window.__lat, el = document.querySelector(sel), base = getComputedStyle(el).transform + getComputedStyle(el).filter;
      const pred = new Function('return (' + done + ')');
      L.res = { press: null, resp: null, freeze: 0 }; let prev = 0; L.downs = 0; L.down = 0; L.up = 0;
      const t0 = performance.now();
      (function f() {
        const now = performance.now(); // not the rAF timestamp: Chrome stamps the frame start, before a long task
        if (L.down) {
          if (prev && prev - L.down < 2500) L.res.freeze = Math.max(L.res.freeze, now - prev); prev = now;
          if (L.res.press == null) { const cs = getComputedStyle(el); if (el.isConnected && cs.transform + cs.filter !== base) L.res.press = now - L.down; }
          if (L.res.resp == null && L.up) { let ok = false; try { ok = pred(); } catch { } if (ok) L.res.resp = now - L.up; }
        }
        if (now - t0 < 3500) requestAnimationFrame(f);
      })();
    }, [sel, done]);
    await touch('touchStart', box.x, box.y); await sleep(60); await touch('touchEnd');
    let res; const tEnd = Date.now() + 15000;
    do { await sleep(40); res = await p.evaluate(() => ({ ...window.__lat.res, downs: window.__lat.downs })); } while (res.resp == null && Date.now() < tEnd);
    await sleep(2600); res = await p.evaluate(() => ({ ...window.__lat.res, downs: window.__lat.downs }));
    // pass: tap registered first time, pressed look and result each on screen within LIMIT.
    // 'longest frame' is informational: in this headless box WebGL runs on the CPU (SwiftShader),
    // so any frame that redraws the 3D table is far slower here than on a phone GPU.
    const ok = res.resp != null && res.resp <= LIMIT && (res.press == null || res.press <= LIMIT);
    if (!ok) failures++;
    const f = v => v == null ? '  —  ' : v.toFixed(0).padStart(4) + ' ms';
    console.log(`  ${ok ? '✔' : '✘'} ${name.padEnd(30)} press ${f(res.press)}   result ${f(res.resp)}   longest frame ${f(res.freeze)}${res.resp == null ? '  (tap did not register)' : ''}`);
    rows.push({ vp: `${vp.width}x${vp.height}`, name, press: res.press, resp: res.resp, freeze: res.freeze });
    await sleep(settle);
  }
  const screen = s => `document.getElementById('home').dataset.screen==='${s}'&&!document.getElementById('home').hidden`;
  await tap('Home → Levels', '#btn-levels', `${screen('levels')}`);
  await tap('Levels → Zurück', '#btn-home', `${screen('home')}`);
  await tap('Home → Regeln', '#btn-rules', `${screen('rules')}`);
  await tap('Regeln → Zurück', '#home-screen .aw-btn.aw-slate', `${screen('home')}`);
  await tap('Home → Spielen (1st 3D setup)', '#btn-play', `!document.getElementById('game').hidden&&document.getElementById('lvl-num').textContent==='4'`, { settle: 1500 });
  await tap('Regel-Chip', '.sd-rb-chip[data-rule="touch"]', `document.querySelector('.sd-rb-chip[data-rule="touch"]').classList.contains('is-demo')`);
  await tap('Regeln einklappen', '.sd-rb-toggle', `document.getElementById('rulesbar').classList.contains('is-collapsed')`);
  await tap('Regeln ausklappen', '.sd-rb-toggle', `!document.getElementById('rulesbar').classList.contains('is-collapsed')`);
  await tap('Tipp per Werbung', '#btn-adtip', `!!document.getElementById('ad-dialog')`);
  await tap('Werbung: Nein danke', '.ad-later', `!document.getElementById('ad-dialog')`);
  await p.evaluate(() => { window.__s0 = SquishDoku.state; });
  await tap('Neustart', '#btn-reset', `SquishDoku.state!==window.__s0&&!document.getElementById('game').hidden`, { settle: 1500 });
  await tap('Zurück (Spiel → Levels)', '#btn-back', `${screen('levels')}&&document.getElementById('game').hidden`);
  await tap('Level-Kachel 12', '.aw-tile[data-level="12"]', `!document.getElementById('game').hidden&&SquishDoku.state.id===12`, { settle: 1500 });
  // win dialog: solve by setting glows through the real hold path is slow; use the solution with real holds
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  const S = await p.evaluate(() => ({ N: SquishDoku.state.N, sol: SquishDoku.state.L.solution }));
  for (let r = 0; r < S.N; r++) { const q = await p.evaluate(([r, c]) => { const s = SquishDoku.board.screenOf(r, c); return { x: s.x, y: s.y }; }, [r, S.sol[r]]); await touch('touchStart', q.x, q.y); await sleep(700); await touch('touchEnd'); await sleep(150); }
  await p.waitForFunction(() => !document.getElementById('veil').hidden, null, { timeout: 8000 }); await sleep(1500);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: RATE });
  await tap('Sieg → Weiter', '#btn-next', `document.getElementById('veil').hidden&&SquishDoku.state.id===13`, { settle: 1500 });
  await tap('Zurück (Spiel → Levels)', '#btn-back', `${screen('levels')}`);
  await tap('Levels → Zurück', '#btn-home', `${screen('home')}`);
  await tap('Home → Tutorial', '#btn-tutorial', `!document.getElementById('game').hidden&&SquishDoku.state.id===1`, { settle: 1500 });
  await p.evaluate(() => { window.__tx = document.querySelector('.sd-tut-text').textContent; });
  await tap('Tutorial-Blase Weiter', '#tut-next', `document.querySelector('.sd-tut-text').textContent!==window.__tx`);
  await tap('Zurück (Tutorial → Levels)', '#btn-back', `${screen('levels')}`);
  await p.evaluate(() => { window.__snd = document.getElementById('sound-toggle').getAttribute('aria-pressed'); });
  await tap('Ton-Knopf', '#sound-toggle', `document.getElementById('sound-toggle').getAttribute('aria-pressed')!==window.__snd`);
  if (errors.length) { console.log('  page errors:', errors.slice(0, 5)); failures++; }
  await b.close();
}
(async () => {
  const vps = process.env.VP ? [process.env.VP] : ['390x844', '375x667'];
  for (const v of vps) { const [width, height] = v.split('x').map(Number); await run({ width, height }); }
  if (process.env.JSON) require('fs').writeFileSync(process.env.JSON, JSON.stringify(rows, null, 1));
  console.log(failures ? `\n${failures} FAILED (limit ${LIMIT} ms)` : `\nall taps registered first time, all results <= ${LIMIT} ms`);
  process.exit(failures ? 1 : 0);
})();
