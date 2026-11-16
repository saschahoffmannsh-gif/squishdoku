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
  // ---------- Tutorial (Level 1–3): follow the hand, the player does every action ----------
  await p.click('#btn-home'); await sleep(400);
  await p.click('#btn-play');
  await p.waitForFunction(() => SquishDoku.board && SquishDoku.board.stats.frames > 1, null, { timeout: 30000 });
  await sleep(900);
  ok(await dialog() === null, 'L1: no rules dialog any more – the tutorial explains instead');
  const tut = () => p.evaluate(() => { const t = SquishDoku.tutorial; return { active: t.active, blocking: t.blocking, step: t.step, text: document.querySelector('.sd-tut-text').textContent, next: !document.getElementById('tut-next').hidden, marks: document.querySelectorAll('.sd-tut-mark').length, hand: document.querySelector('.sd-tut-hand').classList.contains('is-on') }; });
  const bar = () => p.evaluate(() => [...document.querySelectorAll('.sd-rb-chip')].map(c => (c.classList.contains('is-locked') ? 'L' : c.classList.contains('is-new') ? 'N' : 'o')).join(''));
  let t = await tut(); s = await st();
  ok(s.id === 1 && s.N === 4 && t.active && t.next && /Jede Farbe/.test(t.text), `L1 tutorial 4x4 opens with the colour rule ("${t.text.slice(0, 40)}…")`);
  ok(await bar() === 'NLL', 'L1 rules bar: only rule 1 open (pulsing), rules 2+3 still locked');
  ok(!(await p.isVisible('#btn-adtip')) && !(await p.isVisible('#hint')), 'tutorial: no ad button, no hint line (bubble instead)');
  ok(await noScroll(), 'tutorial: no scrolling');
  ok(await p.evaluate(() => { const b = document.getElementById('tut-bubble').getBoundingClientRect(), z = SquishDoku.board.boardRect(), r = document.getElementById('rulesbar').getBoundingClientRect(), st = document.querySelector('.sd-status').getBoundingClientRect(); return b.top >= z.top + z.height - 2 && b.bottom <= innerHeight && r.top >= st.bottom - 1 && r.bottom <= z.top + 2; }), 'layout: status → rules bar → board → speech bubble, all on screen');
  await shot('03-tut1-intro');
  // blocking intro: the board ignores input until "Weiter"
  await hold(3, 1); s = await st(); ok(s.glow === 0, 'intro bubble: board waits for "Weiter"');
  await p.click('#tut-next'); await sleep(500);
  // play a tutorial level by following tutorial.step; returns the steps seen
  async function followTutorial(lvl, { wrongAt = -1, shotAt = {} } = {}) {
    const seen = []; let n = 0;
    for (let guard = 0; guard < 40; guard++) {
      t = await tut();
      if (t.step && t.step.type === 'intro') { if (shotAt.intro && !seen.includes('intro')) await shot(shotAt.intro); seen.push('intro'); await p.click('#tut-next'); await sleep(400); continue; }
      if (!t.step || t.step.type === 'done') break;
      const key = t.step.type + ':' + (t.step.rule || t.step.kind);
      if (!seen.includes(key) && shotAt[key]) await shot(shotAt[key]);
      if (!seen.length || !seen.includes(key)) ok(t.hand && t.marks >= 1, `L${lvl} ${key}: hand + highlight shown ("${t.text.slice(0, 48)}…")`);
      seen.push(key);
      if (n === wrongAt) { // deliberately hold a wrong squish → heart lost + "Autsch" bubble
        s = await st(); let w = null; for (let r = 0; r < s.N && !w; r++) for (let c = 0; c < s.N; c++) if (s.grid[r][c] === 'normal' && s.sol[r] !== c) { w = [r, c]; break; }
        await hold(...w); await sleep(400); const s3 = await st(), t3 = await tut();
        ok(s3.hearts === 2 && /Herz/.test(t3.text), `L${lvl}: wrong squish costs a heart, bubble explains it ("${t3.text.slice(0, 30)}…")`);
        await shot('06-tut3-ouch'); await sleep(2400);
      }
      if (t.step.type === 'hold') { await hold(...t.step.cell); await sleep(500); }
      else if (t.step.path.length === 1) { await tapCell(...t.step.path[0]); await sleep(500); }
      else { await p.evaluate(() => SquishDoku.holdMs = 1500); await swipe(t.step.path); await sleep(700); await p.evaluate(() => SquishDoku.holdMs = 400); }
      n++;
    }
    return seen;
  }
  let seen = await followTutorial(1, { shotAt: { 'hold:reg': '04-tut1-hold' } });
  ok(seen[0] === 'hold:reg' && seen.includes('hold:guide'), `L1 steps: ${[...new Set(seen)].join(', ')}`);
  await p.waitForFunction(() => !document.getElementById('veil').hidden, null, { timeout: 15000 }); await sleep(1300);
  ok(await dialog() === 'win' && /Tutorial 1\/3/.test(await p.textContent('#dialog')), 'L1 tutorial won → "Tutorial 1/3 geschafft"');
  await p.click('#btn-next'); await sleep(1500);
  s = await st(); t = await tut();
  ok(s.id === 2 && t.active && /Reihe/.test(t.text) && await bar() === 'oNL', 'L2 tutorial: row/column rule, rules bar opens rule 2');
  ok(await p.evaluate(() => SquishDoku.state.state[1][1] === 'popped' && SquishDoku.board.stats.popped === 2), 'L2: two squishes start as empty glass');
  seen = await followTutorial(2, { shotAt: { 'pop:row': '05-tut2-swipe' } });
  ok(seen.includes('pop:row') && seen.includes('pop:col') && (seen.includes('hold:row') || seen.includes('hold:col')), `L2 steps: ${[...new Set(seen)].join(', ')}`);
  await p.waitForFunction(() => !document.getElementById('veil').hidden, null, { timeout: 15000 }); await sleep(1300);
  ok(await dialog() === 'win', 'L2 tutorial won');
  await p.click('#btn-next'); await sleep(1500);
  s = await st(); t = await tut();
  ok(s.id === 3 && /berühren/.test(t.text) && await bar() === 'ooN', 'L3 tutorial: no-touching rule, all three rules in the bar');
  seen = await followTutorial(3, { wrongAt: 1, shotAt: { intro: '05-tut3-intro', 'pop:touch': '06-tut3-touch' } });
  ok(seen.includes('pop:touch') && seen.includes('pop:known'), `L3 steps: ${[...new Set(seen)].join(', ')}`);
  await p.waitForFunction(() => !document.getElementById('veil').hidden, null, { timeout: 15000 }); await sleep(1600);
  ok(await dialog() === 'tutorial-done' && /Du kannst/.test(await p.textContent('#dialog')), 'after L3: "Du kannst’s!" screen');
  await shot('07-tut-done');
  ok(await p.evaluate(() => SquishDoku.adPacing.wins === 0), 'tutorial wins do not count for ads');
  await p.click('#btn-tut-done'); await sleep(1500);

  // ---------- Level 4: first regular 5x5 (gestures) ----------
  await shot('08-L4');
  ok(await noScroll(), 'game: no scrolling');
  ok(await p.isVisible('#btn-adtip') && !(await p.evaluate(() => SquishDoku.tutorial.active)), 'L4: tutorial off, ad button back');
  // layout: board inside viewport, between rules bar and hint
  const lay = await p.evaluate(() => { const fr = SquishDoku.board.frameRect(), st = document.getElementById('rulesbar').getBoundingClientRect(), hint = document.getElementById('hint').getBoundingClientRect(); return { fr, st: st.bottom, hint: hint.top, w: innerWidth, h: innerHeight }; });
  ok(lay.fr.left >= 0 && lay.fr.left + lay.fr.width <= lay.w + .5, `board fits horizontally (${lay.fr.left.toFixed(0)}..${(lay.fr.left + lay.fr.width).toFixed(0)} of ${lay.w})`);
  ok(lay.fr.top >= lay.st - 2 && lay.fr.top + lay.fr.height <= lay.hint + 2, `board between rules bar (${lay.st.toFixed(0)}) and hint (${lay.hint.toFixed(0)}): ${lay.fr.top.toFixed(0)}..${(lay.fr.top + lay.fr.height).toFixed(0)}`);
  // rules bar: tap a chip → its mini demo + explanation; collapse/expand is remembered
  await p.click('.sd-rb-chip[data-rule="touch"]'); await sleep(250);
  ok(await p.evaluate(() => document.querySelector('.sd-rb-chip[data-rule="touch"]').classList.contains('is-demo') && /schräg/.test(document.getElementById('hint').textContent)), 'rules bar: tapping a chip replays its demo and explains the rule');
  await shot('08-L4-chip-demo');
  await p.click('.sd-rb-toggle'); await sleep(300);
  ok(await p.evaluate(() => document.getElementById('rulesbar').classList.contains('is-collapsed') && JSON.parse(localStorage.getItem('squishdoku-v1')).rulesCollapsed === true), 'rules bar collapses (saved)');
  await shot('08-L4-collapsed');
  await p.click('.sd-rb-toggle'); await sleep(300);
  ok(await p.evaluate(() => !document.getElementById('rulesbar').classList.contains('is-collapsed')), 'rules bar expands again');

  s = await st();
  ok(s.id === 4 && s.N === 5 && s.hearts === 3, 'L4 is 5x5 with 3 hearts');
  // 1) hold to glow
  const r0 = 0, c0 = s.sol[0];
  await hold(r0, c0); await sleep(1400);
  s = await st();
  ok(s.grid[r0][c0] === 'glow' && s.glow === 1, 'hold on correct squish -> glows');
  let untouched = true;
  for (let r = 0; r < s.N; r++) for (let c = 0; c < s.N; c++) if (!(r === r0 && c === c0)) untouched = untouched && s.grid[r][c] === 'normal';
  ok(untouched, 'no auto-pop: every other squish stays untouched after a glow');
  await shot('09-L4-glow');
  // 2) swipe over non-solution squishes -> pop ; across a solution squish -> wobble + heart
  const row = 2, sc = s.sol[row];
  const path = []; for (let c = 0; c < s.N; c++) if (s.grid[row][c] === 'normal') path.push([row, c]);
  ok(path.some(([r, c]) => c === sc), 'test row contains the solution squish');
  await p.evaluate(() => SquishDoku.holdMs = 1500);
  await swipe(path); await sleep(600);
  await p.evaluate(() => SquishDoku.holdMs = 400);
  let s2 = await st();
  ok(s2.grid[row][sc] === 'normal', 'swipe does NOT pop the squish that must glow');
  ok(s2.hearts === 2, `wrong swipe costs a heart (hearts ${s2.hearts})`);
  ok(path.filter(([r, c]) => c !== sc).every(([r, c]) => s2.grid[r][c] === 'popped'), 'swipe pops the other squishes');
  await shot('10-L4-swipe');
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
  // 6) finish L4
  for (let r = 0; r < s.N; r++) if ((await st()).grid[r][s.sol[r]] !== 'glow') { await hold(r, s.sol[r]); await sleep(250); }
  await p.waitForFunction(() => !document.getElementById('veil').hidden, null, { timeout: 15000 });
  await sleep(1500); await shot('11-win');
  ok(await dialog() === 'win', 'L4 won -> win screen');
  ok(await p.locator('.sd-stars i.on').count() === 1, 'win screen shows stars = hearts left (1)');
  const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('squishdoku-v1')));
  ok(saved.unlocked === 5 && saved.stars[4] === 1 && saved.stars[3] >= 1, 'progress saved in localStorage');
  await p.click('#btn-next'); await sleep(1500);
  // 7) L5-L8: solve by holds only
  for (let lvl = 5; lvl <= 8; lvl++) {
    s = await st();
    ok(s.id === lvl, `level ${lvl} started (${s.N}x${s.N})`);
    for (let r = 0; r < s.N; r++) { await hold(r, s.sol[r]); await sleep(200); }
    await p.waitForFunction(() => !document.getElementById('veil').hidden, null, { timeout: 20000 });
    await sleep(1600);
    ok(await dialog() === 'win' && (await st()).hearts === 3, `level ${lvl} won with 3 hearts`);
    if (lvl < 8) await p.click('#btn-next'), await sleep(1500);
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
  ok((await p.textContent('.sd-lv-progress')).startsWith('10 / 50'), 'level select shows solved count');
  await p.click('[data-level="5"]'); await sleep(1500);
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
  await p.evaluate(() => SquishDoku.startLevel(6)); await sleep(1600);
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
  ok(await p.evaluate(n => JSON.parse(localStorage.getItem('squishdoku-v1')).revealed[6] === n, s.N), 'reveal: used reveals saved per level in localStorage');
  // 11) cadence: wins 9 and 10 -> next start shows the interstitial again
  for (const lvl of [7, 8]) {
    await p.evaluate(l => SquishDoku.startLevel(l), lvl); await sleep(1500);
    const t = await st(); for (let r = 0; r < t.N; r++) { await hold(r, t.sol[r]); await sleep(200); }
    await p.waitForFunction(() => !document.getElementById('veil').hidden, null, { timeout: 20000 }); await sleep(1200);
  }
  ok(await p.evaluate(() => SquishDoku.adPacing.wins === 10 && SquishDoku.adPacing.interstitialDue), 'ads: 10 wins -> interstitial due again');
  await p.click('#btn-again'); await sleep(400);
  ok(await p.isVisible('#ad-interstitial'), 'ads: interstitial after every 5th win');
  await p.waitForFunction(() => !document.getElementById('ad-continue').disabled, null, { timeout: 8000 }); await p.click('#ad-continue'); await sleep(1500);
  ok((await st()).id === 8 && !(await p.evaluate(() => SquishDoku.adPacing.interstitialDue)), 'ads: level starts after the interstitial, counter cleared');
  // 12) tutorial can be replayed from the menu (and never shows ads, even when one is due)
  for (let lvl = 8; lvl <= 12; lvl++) { if (lvl > 8) { await p.evaluate(l => SquishDoku.startLevel(l), lvl); await sleep(1500); }
    const t = await st(); for (let r = 0; r < t.N; r++) { await hold(r, t.sol[r]); await sleep(200); }
    await p.waitForFunction(() => !document.getElementById('veil').hidden, null, { timeout: 20000 }); await sleep(1200); }
  ok(await p.evaluate(() => SquishDoku.adPacing.interstitialDue), 'ads: 15 wins -> interstitial due');
  await p.evaluate(() => SquishDoku.showHome('home')); await sleep(500);
  await p.click('#btn-tutorial'); await sleep(1500);
  ok(!(await p.isVisible('#ad-interstitial')) && (await st()).id === 1 && await p.evaluate(() => SquishDoku.tutorial.active), 'menu "Tutorial" replays tutorial level 1 without an ad');
  await p.evaluate(() => SquishDoku.showHome('rules')); await sleep(500);
  ok(await p.isVisible('#btn-rules-tutorial'), 'rules screen offers "Tutorial spielen"');
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
