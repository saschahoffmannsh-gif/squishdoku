// Cookie interaction must make exactly one kind of sound: the sand trickle when a cookie crumbles.
// Logs every AudioBufferSourceNode.start (trickle buffers are 1.3 s long) while holding a right and a wrong
// cookie, swiping, tapping back and undoing – in a mission, a normal level, the last level and the daily.
const { chromium } = require('playwright-core');
const sleep = ms => new Promise(r => setTimeout(r, ms));
let bad = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) bad++; };
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await ctx.addInitScript(() => { window.__snd = []; const o = AudioBufferSourceNode.prototype.start; AudioBufferSourceNode.prototype.start = function (...a) { window.__snd.push(+(this.buffer?.duration || 0).toFixed(2)); return o.apply(this, a); }; });
  const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }] });
  const pos = (r, c) => p.evaluate(([r, c]) => { const s = SquishDoku.board.screenOf(r, c); return { x: s.x, y: s.y + s.size * .1 }; }, [r, c]);
  const hold = async (r, c) => { const q = await pos(r, c); await touch('touchStart', q.x, q.y); await sleep(700); await touch('touchEnd'); await sleep(400); };
  const tapC = async (r, c) => { const q = await pos(r, c); await touch('touchStart', q.x, q.y); await sleep(60); await touch('touchEnd'); await sleep(500); };
  await p.goto(process.argv[2] || 'http://localhost:8792/index.html');
  await p.evaluate(() => localStorage.setItem('squishdoku-v1', JSON.stringify({ v: 4, unlocked: 50, stars: {}, seenRules: true })));
  await p.reload(); await p.waitForFunction(() => document.documentElement.dataset.ready === '1');
  for (const lv of [1, 7, 50, 'daily']) {
    if (lv === 'daily') await p.evaluate(() => SquishDoku.startDaily(SquishDoku.today)); else await p.evaluate(l => SquishDoku.startLevel(l), lv);
    await sleep(1800);
    await p.evaluate(() => { const T = SquishDoku.tutorial; if (T.active) { T.stop(); } }); // play freely, the guide is tested elsewhere
    const s = await p.evaluate(() => ({ N: SquishDoku.state.N, sol: SquishDoku.state.L.solution }));
    const wrongC = (s.sol[0] + 2) % s.N, popR = 1, popC = (s.sol[1] + 2) % s.N;
    await p.evaluate(() => { window.__snd = []; });
    await hold(0, s.sol[0]);                         // light up
    await hold(0, s.sol[0]);                         // switch off
    await hold(s.N - 1, (s.sol[s.N - 1] + 3) % s.N); // wrong cookie → heart
    const quiet = await p.evaluate(() => window.__snd.slice());
    await p.evaluate(([r, c]) => SquishDoku.act.swipe(r, c), [popR, popC]); // wipe = crumble (same path as tap/swipe input)
    await p.waitForFunction(() => window.__snd.length > 0, null, { timeout: 5000 }).catch(() => {}); await sleep(200); const afterPop = await p.evaluate(() => window.__snd.slice());
    await p.evaluate(([r, c]) => SquishDoku.act.tap(r, c), [popR, popC]); await sleep(500); // tap = bring back
    const afterBack = await p.evaluate(() => window.__snd.slice());
    ok(quiet.length === 0, `${lv}: pressing / lighting / switching off / wrong cookie make no sound (${JSON.stringify(quiet)})`);
    ok(afterPop.length === 1 && afterPop[0] === 1.3, `${lv}: crumbling plays the sand trickle only (${JSON.stringify(afterPop)})`);
    ok(afterBack.length === afterPop.length, `${lv}: bringing a cookie back is silent (${JSON.stringify(afterBack)})`);
  }
  // mute switch: no trickle
  await p.evaluate(() => SquishDoku.showHome('home')); await sleep(300);
  await p.evaluate(() => document.getElementById('sound-toggle').click()); await sleep(200);
  await p.evaluate(() => SquishDoku.startLevel(8)); await sleep(1600);
  const s8 = await p.evaluate(() => ({ N: SquishDoku.state.N, sol: SquishDoku.state.L.solution }));
  await p.evaluate(() => { window.__snd = []; }); await p.evaluate(c => SquishDoku.act.swipe(1, c), (s8.sol[1] + 2) % s8.N); await sleep(1500);
  const m = await p.evaluate(() => window.__snd.slice());
  ok(m.length === 0, `sound switched off → no trickle (${JSON.stringify(m)})`);
  await b.close(); console.log(bad ? `\n${bad} FAILED` : '\nALL PASSED'); process.exit(bad ? 1 : 0);
})();
