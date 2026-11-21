// Neon-tube preview screenshots: node tests/tube-shots.js [baseUrl] [level] [tag] [WxH]
const { chromium } = require('playwright-core');
const args=process.argv.slice(2);
const BASE = args.find(a => a.startsWith('http')) || 'http://localhost:8792/tube.html';
const LEVEL = +(args.find(a => /^\d+$/.test(a)) || 6);
const TAG = args.find(a => /^[a-z]/.test(a) && !a.startsWith('http')) || 'tube';
const VP = (args.find(a => /^\d+x\d+$/.test(a)) || '390x844').split('x').map(Number);
const OUT = __dirname + '/../shots';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: VP[0], height: VP[1] }, deviceScaleFactor: +(process.env.DPR||2), hasTouch: true, isMobile: true, locale: 'de-DE' });
  const p = await ctx.newPage();
  const errs=[];p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' || m.type()==='warning') errs.push(m.text()); });
  const cdp = await ctx.newCDPSession(p);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }] });
  const pos = (r, c) => p.evaluate(([r, c]) => { const s = SquishDoku.board.screenOf(r, c); return { x: s.x, y: s.y }; }, [r, c]);
  const ACT = !process.env.TOUCH;
  async function hold(r, c, ms = 650) { if (ACT) { await p.evaluate(([r, c]) => { SquishDoku.board.press(r, c); }, [r, c]); await sleep(500); await p.evaluate(([r, c]) => { SquishDoku.board.release(r, c); SquishDoku.act.hold(r, c); }, [r, c]); await sleep(150); return; } const q = await pos(r, c); await touch('touchStart', q.x, q.y); await sleep(ms); await touch('touchEnd'); await sleep(150); }
  async function swipe(cells) { if (ACT) { for (const [r, c] of cells) { await p.evaluate(([r, c]) => { SquishDoku.board.brush(r, c); SquishDoku.act.swipe(r, c); }, [r, c]); await sleep(60); } await sleep(200); return; } await p.evaluate(() => { SquishDoku.holdMs = 5000; }); const pts = []; for (const [r, c] of cells) pts.push(await pos(r, c));
    if (pts.length === 1) pts.push({ x: pts[0].x + 22, y: pts[0].y + 4 });
    await touch('touchStart', pts[0].x, pts[0].y); await touch('touchMove', pts[0].x + (pts[1]?pts[1].x-pts[0].x:20) * .4, pts[0].y + (pts[1]?pts[1].y-pts[0].y:0) * .4);
    for (let i = 1; i < pts.length; i++) for (let k = 1; k <= 6; k++) { await touch('touchMove', pts[i-1].x + (pts[i].x - pts[i-1].x) * k / 6, pts[i-1].y + (pts[i].y - pts[i-1].y) * k / 6); await sleep(20); }
    await touch('touchEnd'); await sleep(200); await p.evaluate(() => { SquishDoku.holdMs = 400; }); }
  const dump = async tag => console.log(tag, JSON.stringify(await p.evaluate(() => ({ h: SquishDoku.state.hearts, g: SquishDoku.state.state.map(r => r.map(x => x[0]).join('')) }))));
  const shot = async name => { await dump(name); await sleep(900); await p.screenshot({ path: `${OUT}/${TAG}-${name}-${VP.join('x')}.png` }); console.log('shot', name); };
  await p.goto(BASE + '?level=' + LEVEL); await p.waitForFunction(() => document.documentElement.dataset.ready && window.SquishDoku?.board?.pieces?.length, null, { timeout: 60000 });
  await sleep(1500);
  const L = await p.evaluate(() => { const S = SquishDoku.state; return { N: S.N, sol: S.L.solution, regions: S.L.regions }; });
  console.log('pieces', await p.evaluate(() => SquishDoku.board.pieces.length), 'N', L.N);
  await shot('1-start');
  const reg = (r, c) => L.regions[r][c];
  // region of the first-row solution: hold its LED cell, swipe two other cells of it
  const r0 = 0, c0 = L.sol[0], g = reg(r0, c0);
  await hold(r0, c0); await sleep(400);
  const others = []; for (let r = 0; r < L.N; r++) for (let c = 0; c < L.N; c++) if (reg(r, c) === g && !(r === r0 && c === c0)) others.push([r, c]);
  await swipe(others.length>1&&Math.abs(others[0][0]-others[1][0])+Math.abs(others[0][1]-others[1][1])===1?others.slice(0,2):[others[0]]);
  await shot('2-pressed-led');
  // finish this region -> whole tube lights up
  for (const cell of others.slice(2)) await swipe([cell]);
  await sleep(4000);
  await shot('3-tube-lit');
  // wrong move: hold a non-solution cell somewhere else
  let wr = null; for (let r = L.N - 1; r >= 0 && !wr; r--) for (let c = 0; c < L.N; c++) if (reg(r, c) !== g && L.sol[r] !== c) { wr = [r, c]; break; }
  if (ACT) { await p.evaluate(([r, c]) => SquishDoku.board.press(r, c), wr); await sleep(450); await p.evaluate(([r, c]) => { SquishDoku.board.release(r, c); SquishDoku.act.hold(r, c); }, wr); await sleep(260); }
  else { const q = await pos(...wr); await touch('touchStart', q.x, q.y); await sleep(560); await touch('touchEnd'); await sleep(200); }
  await p.screenshot({ path: `${OUT}/${TAG}-4-wrong-${VP.join('x')}.png` }); console.log('shot wrong');
  // solved look: every LED on, every tube pressed in and lit (board only, no win dialog)
  await p.evaluate(() => { const B = SquishDoku.board, S = SquishDoku.state; S.locked = true; S.L.solution.forEach((c, r) => { if (B.cellAt(r, c).state !== 'glow') { if (B.cellAt(r, c).state === 'popped') B.restore(r, c); B.glow(r, c, true); } }); B.celebrate(); });
  await sleep(5000); await p.screenshot({ path: `${OUT}/${TAG}-5-solved-${VP.join('x')}.png` }); console.log('shot solved');
  console.log('stats', JSON.stringify(await p.evaluate(() => ({ ...SquishDoku.board.stats, hearts: SquishDoku.state.hearts }))));
  console.log('errors', errs.slice(0, 8));
  await b.close();
})();
