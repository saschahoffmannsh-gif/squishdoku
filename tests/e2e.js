// SquishDoku end-to-end test (playwright-core + /usr/bin/google-chrome, real touch events via CDP).
// Usage: node tests/e2e.js [baseUrl] [--shots]
const { chromium } = require('playwright-core');
const BASE = process.argv.find(a => a.startsWith('http')) || 'http://localhost:8792/index.html';
const SHOTS = process.argv.includes('--shots');
const OUT = __dirname + '/../shots';
const fs = require('fs'); if (SHOTS) fs.mkdirSync(OUT, { recursive: true });
let failures = 0;
const ok = (cond, msg) => { console.log((cond ? '  ✔ ' : '  ✘ ') + msg); if (!cond) failures++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function run(vp, dpr) {
  console.log(`\n=== ${vp.width}x${vp.height} @${dpr}x ===`);
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: dpr, hasTouch: true, isMobile: true, locale: 'de-DE' });
  const p = await ctx.newPage();
  const errors = [], warnings = [];
  p.on('pageerror', e => errors.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); if (m.type() === 'warning') warnings.push(m.text()); });
  const cdp = await ctx.newCDPSession(p);
  const touch = (type, x, y, timestamp) => cdp.send('Input.dispatchTouchEvent', { type, ...(timestamp ? { timestamp } : {}), touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }] });
  const pos = (r, c) => p.evaluate(([r, c]) => { const s = SquishDoku.board.screenOf(r, c); return { x: s.x, y: s.y + s.size * .1 }; }, [r, c]);
  async function hold(r, c, ms = 650) { const q = await pos(r, c); await touch('touchStart', q.x, q.y); await sleep(ms); await touch('touchEnd'); await sleep(120); }
  async function tapCell(r, c) { const q = await pos(r, c); // explicit event timestamps: a real 60 ms tap even if the software renderer delays delivery
    // the software renderer can stall the page >400 ms between touchStart and touchEnd, which would fire the hold timer; widen it for the tap only
    await p.evaluate(() => { SquishDoku.holdMs = 1500; });
    const t0 = Date.now() / 1000; await touch('touchStart', q.x, q.y, t0); await touch('touchEnd', 0, 0, t0 + .06); await sleep(150);
    await p.evaluate(() => { SquishDoku.holdMs = 400; }); }
  async function swipe(cells, stepMs = 25) {
    const pts = []; for (const [r, c] of cells) pts.push(await pos(r, c));
    // start moving right away (a finger that rests >400 ms would start a hold instead)
    await touch('touchStart', pts[0].x, pts[0].y);
    await touch('touchMove', pts[0].x + (pts[1].x - pts[0].x) * .4, pts[0].y + (pts[1].y - pts[0].y) * .4);
    for (let i = 1; i < pts.length; i++) for (let k = 1; k <= 6; k++) {
      await touch('touchMove', pts[i - 1].x + (pts[i].x - pts[i - 1].x) * k / 6, pts[i - 1].y + (pts[i].y - pts[i - 1].y) * k / 6); await sleep(stepMs);
    }
    await touch('touchEnd'); await sleep(200);
  }
  const st = () => p.evaluate(() => { const S = SquishDoku.state; return { id: S.id, N: S.N, hearts: S.hearts, glow: S.glow, grid: S.state.map(r => r.slice()), sol: S.L.solution, regions: S.L.regions, locked: S.locked }; });
  const dialog = () => p.evaluate(() => { const v = document.getElementById('veil'); return v.hidden ? null : document.getElementById('dialog').dataset.kind; });
  const shot = async name => { if (SHOTS) await p.screenshot({ path: `${OUT}/${name}-${vp.width}x${vp.height}.png` }); };
  const noScroll = () => p.evaluate(() => document.scrollingElement.scrollHeight <= innerHeight + 1 && document.scrollingElement.scrollWidth <= innerWidth + 1);

  await p.goto(BASE); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.waitForFunction(() => document.documentElement.dataset.ready === '1');
  await sleep(800); await shot('01-home');
  ok(await noScroll(), 'home: no scrolling');
  ok(await p.isVisible('#btn-play') && await p.isVisible('#btn-levels'), 'home: menu buttons visible');
  ok((await p.title()) === 'SquishDoku', 'title is SquishDoku');
  await p.click('#btn-levels'); await sleep(700); await shot('02-levels');
  ok(await p.locator('.sd-levels .aw-tile').count() === 50, 'level select: 50 levels');
  ok(await p.locator('.sd-levels .aw-tile.is-locked').count() === 49, 'level select: levels 2-50 locked');
  ok(await noScroll(), 'levels: page itself does not scroll');
  ok(await p.evaluate(() => { const sc = document.querySelector('.sd-levels-scroll'), r = sc.getBoundingClientRect(); return sc.scrollHeight > sc.clientHeight && r.bottom <= innerHeight && r.top >= 0; }), 'levels: list scrolls inside its card, card fits the screen');
  ok(await p.evaluate(() => { const b = document.querySelector('#btn-home').getBoundingClientRect(); return b.bottom <= innerHeight && b.top > 0; }), 'levels: back button visible');
  await p.click('[data-level="1"]');
  await p.waitForFunction(() => SquishDoku.board && SquishDoku.board.stats.frames > 1, null, { timeout: 30000 });
  ok(await dialog() === 'rules', 'L1: first-time rules dialog');
  await shot('03-rules');
  await p.click('#btn-rules-ok'); await sleep(800);
  await shot('04-L1');
  ok(await noScroll(), 'game: no scrolling');
  // layout: board inside viewport, between HUD and hint
  const lay = await p.evaluate(() => { const fr = SquishDoku.board.frameRect(), st = document.querySelector('.sd-status').getBoundingClientRect(), hint = document.getElementById('hint').getBoundingClientRect(), hud = document.querySelector('.sd-hud').getBoundingClientRect(); return { fr, st: st.bottom, hint: hint.top, hud: hud.bottom, w: innerWidth, h: innerHeight }; });
  ok(lay.fr.left >= 0 && lay.fr.left + lay.fr.width <= lay.w + .5, `board fits horizontally (${lay.fr.left.toFixed(0)}..${(lay.fr.left + lay.fr.width).toFixed(0)} of ${lay.w})`);
  ok(lay.fr.top >= lay.st - 2 && lay.fr.top + lay.fr.height <= lay.hint + 2, `board between HUD (${lay.st.toFixed(0)}) and hint (${lay.hint.toFixed(0)}): ${lay.fr.top.toFixed(0)}..${(lay.fr.top + lay.fr.height).toFixed(0)}`);

  let s = await st();
  ok(s.N === 5 && s.hearts === 3, 'L1 is 5x5 with 3 hearts');
  // 1) hold to glow
  const r0 = 0, c0 = s.sol[0];
  await hold(r0, c0); await sleep(1400);
  s = await st();
  ok(s.grid[r0][c0] === 'glow' && s.glow === 1, 'hold on correct squish -> glows');
  const reg = (r, c) => s.regions[r][c];
  let untouched = true;
  for (let r = 0; r < s.N; r++) for (let c = 0; c < s.N; c++) if (!(r === r0 && c === c0)) untouched = untouched && s.grid[r][c] === 'normal';
  ok(untouched, 'no auto-pop: every other squish stays untouched after a glow');
  await shot('05-L1-glow');
  // 2) swipe over non-solution squishes -> pop ; across a solution squish -> wobble + heart
  const row = 2, sc = s.sol[row];
  const path = []; for (let c = 0; c < s.N; c++) if (s.grid[row][c] === 'normal') path.push([row, c]);
  ok(path.some(([r, c]) => c === sc), 'test row contains the solution squish');
  // software rendering delays touch delivery; give the swipe start more slack than 400 ms
  await p.evaluate(() => SquishDoku.holdMs = 1500);
  await swipe(path); await sleep(600);
  await p.evaluate(() => SquishDoku.holdMs = 400);
  let s2 = await st();
  ok(s2.grid[row][sc] === 'normal', 'swipe does NOT pop the squish that must glow');
  ok(s2.hearts === 2, `wrong swipe costs a heart (hearts ${s2.hearts})`);
  ok(path.filter(([r, c]) => c !== sc).every(([r, c]) => s2.grid[r][c] === 'popped'), 'swipe pops the other squishes');
  await shot('06-L1-swipe');
  // 3) tap restores a popped squish, tap again pops it
  const pc = path.find(([r, c]) => c !== sc);
  await tapCell(pc[0], pc[1]); await sleep(400);
  ok((await st()).grid[pc[0]][pc[1]] === 'normal', 'tap restores a popped squish');
  await tapCell(pc[0], pc[1]); await sleep(400);
  ok((await st()).grid[pc[0]][pc[1]] === 'popped', 'tap on a normal (non-glowing) squish pops it');
  // 4) un-glow / re-glow
  await hold(r0, c0); await sleep(300);
  ok((await st()).grid[r0][c0] === 'normal', 'hold on glowing squish -> un-glow');
  await hold(r0, c0); await sleep(300);
  ok((await st()).grid[r0][c0] === 'glow', 'hold again -> glows again');
  // 5) wrong hold -> heart
  s = await st();
  let wrong = null; for (let r = 0; r < s.N && !wrong; r++) for (let c = 0; c < s.N; c++) if (s.grid[r][c] === 'normal' && s.sol[r] !== c) { wrong = [r, c]; break; }
  if (wrong) { await hold(...wrong); await sleep(500); s = await st(); ok(s.hearts === 1 && s.grid[wrong[0]][wrong[1]] === 'normal', 'hold on wrong squish -> wobble + heart lost'); }
  else ok(true, '(no wrong squish left to hold)');
  // 6) finish L1
  for (let r = 0; r < s.N; r++) if ((await st()).grid[r][s.sol[r]] !== 'glow') { await hold(r, s.sol[r]); await sleep(250); }
  await p.waitForFunction(() => !document.getElementById('veil').hidden, null, { timeout: 15000 });
  await sleep(1500); await shot('07-win');
  ok(await dialog() === 'win', 'L1 won -> win screen');
  ok(await p.locator('.sd-stars i.on').count() === 1, 'win screen shows stars = hearts left (1)');
  const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('squishdoku-v1')));
  ok(saved.unlocked === 2 && saved.stars[1] === 1, 'progress saved in localStorage');
  await p.click('#btn-next'); await sleep(1500);
  // 7) L2-L5: solve by holds only
  for (let lvl = 2; lvl <= 5; lvl++) {
    s = await st();
    ok(s.id === lvl, `level ${lvl} started (${s.N}x${s.N})`);
    for (let r = 0; r < s.N; r++) { await hold(r, s.sol[r]); await sleep(lvl === 5 && r === 3 ? 900 : 200); if (lvl === 5 && r === 3) await shot('08-L5-mid'); }
    await p.waitForFunction(() => !document.getElementById('veil').hidden, null, { timeout: 20000 });
    await sleep(1600);
    ok(await dialog() === 'win' && (await st()).hearts === 3, `level ${lvl} won with 3 hearts`);
    if (lvl < 5) await p.click('#btn-next'), await sleep(1500);
  }
  // 7b) unlock everything, pick an 8x8 (L41) and the final level (L50) from the scrolling list and win them
  await p.click('#btn-to-levels'); await sleep(700);
  await p.evaluate(() => { SquishDoku.store.unlocked = 50; SquishDoku.showHome('levels'); }); await sleep(700);
  ok(await p.evaluate(() => SquishDoku.adPacing.wins === 5 && SquishDoku.adPacing.interstitialDue), 'ads: 5 wins -> interstitial due');
  ok(await p.evaluate(() => JSON.parse(localStorage.getItem('squishdoku-ad-pacing-v1')).wins === 5), 'ads: interstitial counter saved in localStorage');
  for (const lvl of [41, 50]) {
    await p.locator(`[data-level="${lvl}"]`).scrollIntoViewIfNeeded(); await sleep(200); await shot(`08-levels-${lvl}`);
    await p.click(`[data-level="${lvl}"]`); await sleep(400);
    if (lvl === 41) {
      ok(await p.isVisible('#ad-interstitial') && await p.isDisabled('#ad-continue'), 'ads: interstitial shown between levels, "Weiter" waits for the countdown');
      await shot('08-interstitial');
      ok(await p.evaluate(() => !SquishDoku.state || SquishDoku.state.id !== 41), 'ads: next level starts only after the ad');
      await p.waitForFunction(() => !document.getElementById('ad-continue').disabled, null, { timeout: 8000 });
      await p.click('#ad-continue');
    } else ok(!(await p.isVisible('#ad-interstitial')), 'ads: no interstitial on the 6th win');
    await sleep(1800);
    s = await st(); ok(s.id === lvl && s.N === 8, `level ${lvl} started (${s.N}x${s.N})`);
    ok(await noScroll(), `L${lvl} 8x8: no scrolling`);
    ok(await p.evaluate(() => { const b = SquishDoku.board, a = b.screenOf(0, 0), z = b.screenOf(b.N - 1, b.N - 1); return a.x - a.size / 2 >= 0 && z.x + z.size / 2 <= innerWidth && a.y > 0 && z.y < innerHeight; }), `L${lvl} 8x8 board fits the screen`);
    for (let r = 0; r < s.N; r++) { await hold(r, s.sol[r]); await sleep(200); }
    await p.waitForFunction(() => !document.getElementById('veil').hidden, null, { timeout: 20000 });
    await sleep(1600);
    ok(await dialog() === 'win' && (await st()).hearts === 3, `level ${lvl} (8x8) won with 3 hearts`);
    if (lvl === 50) { await shot('09-win-final'); ok(await p.locator('#btn-next').count() === 0 && (await p.textContent('#dialog')).includes('Alles geschafft'), 'final level shows "Alles geschafft!"'); }
    else { await p.click('#btn-to-levels'); await sleep(700); }
  }
  // 8) lose flow
  await p.click('#btn-to-levels'); await sleep(700);
  ok(await p.locator('.sd-levels .aw-tile.is-locked').count() === 0, 'all levels unlocked');
  ok((await p.textContent('.sd-lv-progress')).startsWith('7 / 50'), 'level select shows solved count');
  await p.click('[data-level="2"]'); await sleep(1500);
  s = await st(); let n = 0;
  for (let r = 0; r < s.N && n < 3; r++) for (let c = 0; c < s.N && n < 3; c++) if (s.sol[r] !== c && Math.abs(s.sol[r] - c) > 0) { await hold(r, c); n++; await sleep(150); break; }
  await sleep(1300);
  ok(await dialog() === 'lose', '0 hearts -> retry dialog');
  await shot('10-lose');
  await p.click('#btn-retry'); await sleep(1200);
  s = await st(); ok(s.hearts === 3 && s.glow === 0 && !s.locked, 'retry restarts the level with 3 hearts');
  // 9) reset button + back
  await hold(0, s.sol[0]); await sleep(300);
  await p.click('#btn-reset'); await sleep(1000);
  ok((await st()).glow === 0, 'reset button restarts level');
  await p.click('#btn-back'); await sleep(600);
  ok(await p.isVisible('.sd-levels'), 'back button -> level select');
  // 10) Tipp per Werbung: each watched (dummy) ad reveals one more solution squish, as often as wanted
  await p.evaluate(() => SquishDoku.startLevel(3)); await sleep(1600);
  s = await st();
  ok(await p.isVisible('#btn-adtip') && !(await p.isDisabled('#btn-adtip')), 'reveal: "Tipp per Werbung" button visible and enabled');
  ok(await p.evaluate(() => { const a = document.getElementById('btn-adtip').getBoundingClientRect(), h = document.getElementById('hint').getBoundingClientRect(), z = SquishDoku.board.boardRect(); return a.bottom <= h.top + 1 && a.top >= z.top + z.height && a.bottom <= innerHeight; }), 'reveal: button sits between board and hint, on screen');
  await p.click('#btn-adtip'); await sleep(400);
  ok(await p.isVisible('#ad-dialog'), 'reveal: ad dialog opens');
  await p.click('.ad-later'); await sleep(300);
  ok((await st()).glow === 0, 'reveal: "Nein danke" reveals nothing');
  for (let i = 1; i <= s.N; i++) {
    await p.click('#btn-adtip'); await sleep(300); await p.click('#ad-watch'); await sleep(900);
    const t = await st();
    if (i < s.N) ok(t.glow === i && t.sol.every((c, r) => t.grid[r][c] === 'glow' || t.grid[r][c] === 'normal'), `reveal ${i}: one more correct squish glows (${t.glow}/${t.N})`);
    if (i === 1) await shot('11-reveal');
  }
  await p.waitForFunction(() => !document.getElementById('veil').hidden, null, { timeout: 15000 }); await sleep(1200);
  ok(await dialog() === 'win', 'reveal: all squishes revealed -> level won');
  ok(await p.evaluate(() => document.getElementById('btn-adtip').disabled), 'reveal: button disabled once all squishes glow');
  ok(await p.evaluate(n => JSON.parse(localStorage.getItem('squishdoku-v1')).revealed[3] === n, s.N), 'reveal: used reveals saved per level in localStorage');
  // 11) cadence: wins 9 and 10 -> next start shows the interstitial again
  for (const lvl of [4, 5]) {
    await p.evaluate(l => SquishDoku.startLevel(l), lvl); await sleep(1500);
    const t = await st(); for (let r = 0; r < t.N; r++) { await hold(r, t.sol[r]); await sleep(200); }
    await p.waitForFunction(() => !document.getElementById('veil').hidden, null, { timeout: 20000 }); await sleep(1200);
  }
  ok(await p.evaluate(() => SquishDoku.adPacing.wins === 10 && SquishDoku.adPacing.interstitialDue), 'ads: 10 wins -> interstitial due again');
  await p.click('#btn-again'); await sleep(400);
  ok(await p.isVisible('#ad-interstitial'), 'ads: interstitial after every 5th win');
  await p.waitForFunction(() => !document.getElementById('ad-continue').disabled, null, { timeout: 8000 }); await p.click('#ad-continue'); await sleep(1500);
  ok((await st()).id === 5 && !(await p.evaluate(() => SquishDoku.adPacing.interstitialDue)), 'ads: level starts after the interstitial, counter cleared');
  ok(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  if (warnings.length) console.log('  (warnings: ' + [...new Set(warnings)].join(' | ') + ')');
  await b.close();
}
(async () => {
  const dpr = SHOTS ? 2 : 1;
  await run({ width: 390, height: 844 }, dpr);
  await run({ width: 375, height: 667 }, dpr);
  console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
  process.exit(failures ? 1 : 0);
})();
