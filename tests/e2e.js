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
  const cdp = await ctx.newCDPSession(p); if (+process.env.THROTTLE > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: +process.env.THROTTLE }); // THROTTLE=4: CPU x4
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
  // level tiles: scroll the tile into view inside the list, then tap it
  async function pickLevel(lvl, shotIt) {
    await p.locator(`.nn-tile[data-level="${lvl}"]`).scrollIntoViewIfNeeded(); await sleep(150); if (shotIt) await shot(`08-levels-${lvl}`);
    await p.click(`.nn-tile[data-level="${lvl}"]`);
  }
  const noScroll = () => p.evaluate(() => document.scrollingElement.scrollHeight <= innerHeight + 1 && document.scrollingElement.scrollWidth <= innerWidth + 1);

  await p.goto(BASE); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.waitForFunction(() => document.documentElement.dataset.ready === '1');
  await sleep(800); await shot('01-home');
  ok(await noScroll(), 'home: no scrolling');
  ok(await p.isVisible('#btn-play') && await p.isVisible('#btn-levels'), 'home: menu buttons visible');
  ok((await p.title()) === 'SquishDoku', 'title is SquishDoku');
  await p.click('#btn-levels'); await sleep(700); await shot('02-levels');
  ok(await p.locator('.nn-lv-grid .nn-tile').count() === 50, 'level select: 50 levels');
  ok(await p.locator('.nn-lv-grid .nn-tile.is-locked').count() === 49, 'level select: levels 2-50 locked');
  ok(await p.evaluate(() => [...document.querySelectorAll('.nn-seg button')].map(b => b.textContent + (b.classList.contains('is-on') ? '*' : '')).join(' ') === '5×5* 6×6 7×7 8×8'), 'levels: size tabs 5×5–8×8, 5×5 open for a new player');
  ok(await p.evaluate(() => { const g = document.querySelector('.nn-lv-grid'); return g.dataset.n === '5' && g.querySelector('[data-level="1"]').classList.contains('is-current') && g.querySelectorAll('.nn-tile').length === 14; }), 'levels: Kapitel 1 = Mission 1 (4×4) + the 5×5 levels, L1 marked current');
  ok(await p.evaluate(() => [...document.querySelectorAll('.nn-lv-scroll .nn-chap h3')].map(h => h.textContent.split(' mit')[0]).join('|') === 'Kapitel 1 · 5×5|Kapitel 2 · 6×6|Kapitel 3 · 7×7|Kapitel 4 · 8×8'), 'levels: one scrolling list, all 4 chapter cards stacked');
  await p.click('.nn-seg [data-n="7"]'); await sleep(1200);
  ok(await p.evaluate(() => { const sc = document.querySelector('.nn-lv-scroll'), c = sc.querySelector('.nn-lv-chap[data-n="7"]'); return Math.abs(sc.scrollTop - (c.offsetTop - 4)) < 6 && document.querySelector('.nn-seg [data-n="7"]').classList.contains('is-on'); }), 'levels: quick-jump chip scrolls to chapter 3');
  await p.evaluate(() => { const sc = document.querySelector('.nn-lv-scroll'); sc.scrollTop = 0; }); await sleep(300);
  ok(await p.evaluate(() => document.querySelector('.nn-seg [data-n="5"]').classList.contains('is-on')), 'levels: scrolling back up marks 5×5 again');
  ok(await noScroll(), 'levels: page itself does not scroll');
  ok(await p.evaluate(() => { const sc = document.querySelector('.nn-lv-scroll'), r = sc.getBoundingClientRect(), t = document.getElementById('tabs').getBoundingClientRect(); return getComputedStyle(sc).overflowY === 'auto' && r.top >= 0 && r.bottom <= t.top + 1; }), 'levels: tile list scrolls in its own box above the tab bar');
  ok(await p.evaluate(() => { const b = document.querySelector('#btn-home').getBoundingClientRect(); return b.bottom <= innerHeight && b.top > 0; }), 'levels: back button visible');
  // ---------- Missions 1–2 with guidance: follow the hand, the player does every action ----------
  await p.click('#btn-home'); await sleep(400);
  ok(!(await p.isVisible('#btn-tutorial')), 'home: no separate "Tutorial" button any more');
  ok(await p.isVisible('#tabs') && await p.evaluate(() => document.querySelector('#tab-home').classList.contains('is-on')), 'home: tab bar with "Start" active');
  ok(await p.evaluate(() => { const b = document.getElementById('btn-play').getBoundingClientRect(), t = document.getElementById('tabs').getBoundingClientRect(); return b.height >= 60 && b.width > innerWidth * .85 && b.bottom <= t.top && b.top > innerHeight / 2; }), 'home: big gold play button right above the tab bar');
  ok((await p.textContent('#btn-play')).includes('Mission 1 spielen'), 'home: play button names the next level');
  await p.click('#btn-play');
  await p.waitForFunction(() => SquishDoku.board && SquishDoku.board.stats.frames > 1, null, { timeout: 30000 });
  await sleep(900);
  ok(!(await p.isVisible('#tabs')), 'in-game: tab bar hidden');
  ok(await dialog() === null, 'L1: no rules dialog – the guide explains instead');
  const tut = () => p.evaluate(() => { const t = SquishDoku.tutorial; return { active: t.active, blocking: t.blocking, step: t.step, text: document.querySelector('.sd-tut-text').textContent, kicker: document.querySelector('.sd-tut-kicker').textContent, next: !document.getElementById('tut-next').hidden, marks: document.querySelectorAll('.sd-tut-mark').length, hand: document.querySelector('.sd-tut-hand').classList.contains('is-on') }; });
  const bar = () => p.evaluate(() => [...document.querySelectorAll('.sd-rb-chip')].map(c => (c.classList.contains('is-locked') || c.disabled ? 'L' : 'o')).join(''));
  let t = await tut(); s = await st();
  ok(s.id === 1 && s.N === 4 && t.active && t.next && /Farbe/.test(t.text) && /berühren sich nie/.test(t.text) && /Mission 1/.test(t.kicker), `L1 mission 4x4 opens with all rules ("${t.text.slice(0, 50)}…")`);
  ok(await bar() === 'ooo', 'rules bar: all three rules open from the start');
  ok(!(await p.isVisible('#btn-adtip')) && !(await p.isVisible('#hint')), 'guided mission: no ad button, no hint line (bubble instead)');
  ok(await noScroll(), 'guided mission: no scrolling');
  ok(await p.evaluate(() => { const b = document.getElementById('tut-bubble').getBoundingClientRect(), z = SquishDoku.board.boardRect(), r = document.getElementById('rulesbar').getBoundingClientRect(), st = document.querySelector('.sd-status').getBoundingClientRect(); return b.top >= z.top + z.height - 2 && b.bottom <= innerHeight && r.top >= st.bottom - 1 && r.bottom <= z.top + 2; }), 'layout: status → rules bar → board → speech bubble, all on screen');
  await shot('03-m1-intro');
  await hold(3, 1); s = await st(); ok(s.glow === 0, 'intro bubble: board waits for "Weiter"');
  await p.click('#tut-next'); await sleep(500);
  // play a tutorial level by following tutorial.step; returns the steps seen
  let maxBubble = 0; const exTexts = {};
  async function followTutorial(lvl, { wrongAt = -1, shotAt = {} } = {}) {
    const seen = []; let n = 0;
    for (let guard = 0; guard < 40; guard++) {
      t = await tut();
      if (t.step && t.step.explain) { (exTexts[t.step.rule] ||= []).push(t.text);
        const f = await p.evaluate(() => { const b = document.getElementById('tut-bubble').getBoundingClientRect(), z = SquishDoku.board.boardRect(); return b.top >= z.top + z.height - 2 && b.bottom <= innerHeight ? 0 : Math.round(b.height); });
        if (f) ok(false, `L${lvl} explanation bubble covers the board (${f}px): "${t.text.slice(0, 50)}"`); ok(t.next && t.marks >= 1 && !t.hand, `L${lvl} ${t.step.rule} explained first (Weiter, marks, no hand): "${t.text.slice(0, 60)}…"`); await p.click('#tut-next'); await sleep(400); continue; }
      if (t.step && t.step.type === 'intro') { if (shotAt.intro && !seen.includes('intro')) await shot(shotAt.intro); seen.push('intro'); await p.click('#tut-next'); await sleep(400); continue; }
      if (!t.step || t.step.type === 'done') break;
      const key = t.step.type + ':' + (t.step.rule || t.step.kind);
      if (!seen.includes(key) && shotAt[key]) await shot(shotAt[key]);
      if (!seen.length || !seen.includes(key)) ok(t.hand && t.marks >= 1, `L${lvl} ${key}: hand + highlight shown ("${t.text.slice(0, 48)}…")`);
      // the bubble (whatever its text) never covers the board, on every step
      const fit = await p.evaluate(() => { const b = document.getElementById('tut-bubble').getBoundingClientRect(), z = SquishDoku.board.boardRect(); return { ok: b.top >= z.top + z.height - 2 && b.bottom <= innerHeight, b: Math.round(b.top), z: Math.round(z.top + z.height) }; });
      if (!fit.ok) ok(false, `L${lvl} ${key}: bubble overlaps the board or leaves the screen (bubble top ${fit.b}, board bottom ${fit.z}) "${t.text.slice(0, 40)}…"`);
      maxBubble = Math.max(maxBubble, await p.evaluate(() => document.getElementById('tut-bubble').getBoundingClientRect().height));
      if (key === 'pop:claim' && !seen.includes(key) && lvl === 2) {
        const m = await p.evaluate(() => ({ band: document.querySelectorAll('.sd-tut-mark.is-band').length, claim: document.querySelectorAll('.sd-tut-mark.is-claim').length, pop: document.querySelectorAll('.sd-tut-mark.is-pop').length }));
        ok(m.band === 1 && m.claim === t.step.area.length && m.pop === t.step.cells.length, `L${lvl} claim: the line (band), the colour's squishes (gold) and the squishes to wipe are marked (${JSON.stringify(m)})`);
        ok(/nur in dieser (Reihe|Spalte)/.test(t.text) && /muss/.test(t.text) && /keiner/.test(t.text), `L${lvl} claim: the bubble explains why ("${t.text}")`);
      }
      if (['pop:shared', 'pop:pair', 'pop:whatif'].includes(key) && !seen.includes(key)) {
        const m = await p.evaluate(() => ({ band: document.querySelectorAll('.sd-tut-mark.is-band').length, claim: document.querySelectorAll('.sd-tut-mark.is-claim').length, pop: document.querySelectorAll('.sd-tut-mark.is-pop').length, links: document.querySelectorAll('.sd-tut-mark.is-link').length }));
        const bands = key === 'pop:pair' ? 2 : key === 'pop:whatif' ? (t.step.group.kind === 'reg' ? 0 : 1) : 0;
        ok(m.band === bands && m.claim === t.step.area.length && m.pop === t.step.cells.length, `L${lvl} ${t.step.rule}: reason marked (gold ${m.claim}, lines ${m.band}) and the squishes to wipe (${m.pop})`);
        const why = { 'pop:shared': [/muss/, /berühr|seiner (Reihe|Spalte)/, /blockiert/], 'pop:pair': [/nur/, /zwei (Reihen|Spalten)/, /einen/], 'pop:whatif': [/Stell dir vor/, /keinen/] }[key], all = (exTexts[t.step.rule] || []).join(' ') + ' ' + t.text;
        ok(why.every(re => re.test(all)) && (key !== 'pop:shared' || m.links === t.step.area.length), `L${lvl} ${t.step.rule}: explained concretely (${(exTexts[t.step.rule] || []).length} Weiter-steps, lines ${m.links}): "${all.slice(0, 220)}…"`);
      }
      seen.push(key);
      if (n === wrongAt) { // deliberately hold a wrong squish → heart lost + "Autsch" bubble
        s = await st(); let w = null; for (let r = 0; r < s.N && !w; r++) for (let c = 0; c < s.N; c++) if (s.grid[r][c] === 'normal' && s.sol[r] !== c) { w = [r, c]; break; }
        await hold(...w); await sleep(400); const s3 = await st(), t3 = await tut();
        ok(s3.hearts === 2 && /Herz/.test(t3.text), `L${lvl}: wrong squish costs a heart, bubble explains it ("${t3.text.slice(0, 30)}…")`);
        await shot('06-m1-ouch'); await sleep(2400);
      }
      if (t.step.type === 'hold') { await hold(...t.step.cell); await sleep(500); }
      else if (t.step.path.length === 1) { await tapCell(...t.step.path[0]); await sleep(500); }
      else { await p.evaluate(() => SquishDoku.holdMs = 1500); await swipe(t.step.path); await sleep(700); await p.evaluate(() => SquishDoku.holdMs = 400); }
      n++;
    }
    return seen;
  }
  let seen = await followTutorial(1, { wrongAt: 1, shotAt: { intro: '04-m1-hearts', 'pop:touch': '05-m1-touch' } });
  ok(seen.includes('hold:reg') && seen.includes('pop:touch') && seen.includes('pop:known'), `L1 steps: ${[...new Set(seen)].join(', ')}`);
  await p.waitForFunction(() => !document.getElementById('veil').hidden, null, { timeout: 15000 }); await sleep(1300);
  ok(await dialog() === 'win' && /Mission 1 geschafft/.test(await p.textContent('#dialog')), 'L1 won → "Mission 1 geschafft"');
  await p.click('#btn-next'); await sleep(1500);
  s = await st(); t = await tut();
  ok(s.id === 2 && s.N === 5 && t.active && /Profi-Trick/.test(t.text) && /Mission 2/.test(t.kicker), `L2 mission: Profi-Trick intro ("${t.text.slice(0, 50)}…")`);
  ok(!(await p.isVisible('#btn-adtip')), 'L2: no ad button');
  seen = await followTutorial(2, { shotAt: { 'pop:claim': '06-m2-claim', 'hold:reg': '07-m2-hold' } });
  ok(seen[0] === 'intro' && seen[1] === 'pop:claim' && seen.filter(k => k === 'pop:claim').length >= 2, `L2 steps: ${seen.join(', ')}`);
  await p.waitForFunction(() => !document.getElementById('veil').hidden, null, { timeout: 15000 }); await sleep(1300);
  ok(await dialog() === 'win' && /Mission 2 geschafft/.test(await p.textContent('#dialog')) && (await st()).hearts === 3, `L2 won → "Mission 2 geschafft" with 3 hearts (${(await st()).hearts})`);
  await shot('07-m2-win');
  ok(await p.evaluate(() => SquishDoku.adPacing.wins === 0), 'guided missions do not count for ads');
  await p.click('#btn-next'); await sleep(1500);
  // ---------- Missions 3–6: the solve path and one new technique each ----------
  const LESSON = { 3: ['recap', 'Lösungsweg', 'pop:claim', 'Mission 3 geschafft'], 4: ['shared', 'Kreuzfeuer', 'pop:shared', 'Mission 4 geschafft'], 5: ['pair', 'Doppel-Trick', 'pop:pair', 'Mission 5 geschafft'], 6: ['whatif', 'Was wäre wenn', 'pop:whatif', 'Alle Missionen geschafft'] };
  for (let m = 3; m <= 6; m++) {
    const [guide, kick, rule, win] = LESSON[m];
    s = await st(); t = await tut();
    ok(s.id === m && s.N === 5 && t.active && t.kicker === `Mission ${m} · ${kick}` && !(await p.isVisible('#btn-adtip')), `M${m} (${guide}): guided, kicker "${t.kicker}", no ad button ("${t.text.slice(0, 44)}…")`);
    seen = await followTutorial(m, { shotAt: { intro: `07-m${m}-intro`, [rule]: `07-m${m}-${guide}` } });
    ok(seen.includes(rule) && (m !== 3 || ['hold:reg', 'pop:touch', 'pop:known', 'pop:claim', 'hold:col'].every(k => seen.includes(k))), `M${m} steps: ${seen.join(', ')}`);
    await p.waitForFunction(() => !document.getElementById('veil').hidden, null, { timeout: 15000 }); await sleep(1300);
    ok(await dialog() === 'win' && (await p.textContent('#dialog')).includes(win) && (await st()).hearts === 3, `M${m} won → "${win}"`);
    await p.click('#btn-next'); await sleep(1500);
  }
  ok(maxBubble > 0 && maxBubble < vp.height * .25, `speech bubble stays small (max ${maxBubble.toFixed(0)} px of ${vp.height})`);
  ok(await p.evaluate(() => SquishDoku.adPacing.wins === 0), 'missions 1–6 do not count for ads');

  // ---------- Level 7: first regular 5x5 (gestures) ----------
  await shot('08-L3');
  ok(await noScroll(), 'game: no scrolling');
  ok(await p.isVisible('#btn-adtip') && !(await p.evaluate(() => SquishDoku.tutorial.active)), 'L7: guide off, ad button back');
  // layout: board inside viewport, between rules bar and hint
  const lay = await p.evaluate(() => { const fr = SquishDoku.board.frameRect(), st = document.getElementById('rulesbar').getBoundingClientRect(), hint = document.getElementById('hint').getBoundingClientRect(); return { fr, st: st.bottom, hint: hint.top, w: innerWidth, h: innerHeight }; });
  ok(lay.fr.left >= 0 && lay.fr.left + lay.fr.width <= lay.w + .5, `board fits horizontally (${lay.fr.left.toFixed(0)}..${(lay.fr.left + lay.fr.width).toFixed(0)} of ${lay.w})`);
  ok(lay.fr.top >= lay.st - 2 && lay.fr.top + lay.fr.height <= lay.hint + 2, `board between rules bar (${lay.st.toFixed(0)}) and hint (${lay.hint.toFixed(0)}): ${lay.fr.top.toFixed(0)}..${(lay.fr.top + lay.fr.height).toFixed(0)}`);
  // rules bar: tap a chip → its mini demo + explanation; collapse/expand is remembered
  await p.click('.sd-rb-chip[data-rule="touch"]'); await sleep(250);
  ok(await p.evaluate(() => document.querySelector('.sd-rb-chip[data-rule="touch"]').classList.contains('is-demo') && /schräg/.test(document.getElementById('hint').textContent)), 'rules bar: tapping a chip replays its demo and explains the rule');
  await shot('08-L3-chip-demo');
  await p.click('.sd-rb-toggle'); await sleep(300);
  ok(await p.evaluate(() => document.getElementById('rulesbar').classList.contains('is-collapsed') && JSON.parse(localStorage.getItem('squishdoku-v1')).rulesCollapsed === true), 'rules bar collapses (saved)');
  await shot('08-L3-collapsed');
  await p.click('.sd-rb-toggle'); await sleep(300);
  ok(await p.evaluate(() => !document.getElementById('rulesbar').classList.contains('is-collapsed')), 'rules bar expands again');

  s = await st();
  ok(s.id === 7 && s.N === 5 && s.hearts === 3, 'L7 is 5x5 with 3 hearts');
  // 1) hold to glow
  const r0 = 0, c0 = s.sol[0];
  await hold(r0, c0); await sleep(1400);
  s = await st();
  ok(s.grid[r0][c0] === 'glow' && s.glow === 1, 'hold on correct squish -> glows');
  let untouched = true;
  for (let r = 0; r < s.N; r++) for (let c = 0; c < s.N; c++) if (!(r === r0 && c === c0)) untouched = untouched && s.grid[r][c] === 'normal';
  ok(untouched, 'no auto-pop: every other squish stays untouched after a glow');
  await shot('09-L3-glow');
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
  await shot('10-L3-swipe');
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
  // 6) finish L3
  for (let r = 0; r < s.N; r++) if ((await st()).grid[r][s.sol[r]] !== 'glow') { await hold(r, s.sol[r]); await sleep(250); }
  await p.waitForFunction(() => !document.getElementById('veil').hidden, null, { timeout: 15000 });
  await sleep(1500); await shot('11-win');
  ok(await dialog() === 'win', 'L3 won -> win screen');
  ok(await p.locator('.sd-stars i.on').count() === 1, 'win screen shows stars = hearts left (1)');
  const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('squishdoku-v1')));
  ok(saved.v === 4 && saved.unlocked === 8 && saved.stars[7] === 1 && [2, 3, 4, 5, 6].every(i => saved.stars[i] === 3) && saved.stars[1] >= 1, `progress saved in localStorage (missions count) ${JSON.stringify(saved.stars)}`);
  await p.click('#btn-next'); await sleep(1500);
  // 7) L8-L11: solve by holds only
  for (let lvl = 8; lvl <= 11; lvl++) {
    s = await st();
    ok(s.id === lvl, `level ${lvl} started (${s.N}x${s.N})`);
    for (let r = 0; r < s.N; r++) { await hold(r, s.sol[r]); await sleep(200); }
    await p.waitForFunction(() => !document.getElementById('veil').hidden, null, { timeout: 20000 });
    await sleep(1600);
    ok(await dialog() === 'win' && (await st()).hearts === 3, `level ${lvl} won with 3 hearts`);
    if (lvl < 11) await p.click('#btn-next'), await sleep(1500);
  }
  // 7b) unlock everything, pick an 8x8 (L41) and the final level (L50) from the scrolling list and win them
  await p.click('#btn-to-levels'); await sleep(700);
  await p.evaluate(() => { SquishDoku.store.unlocked = 50; SquishDoku.showHome('levels'); }); await sleep(700);
  ok(await p.evaluate(() => SquishDoku.adPacing.wins === 5 && SquishDoku.adPacing.interstitialDue), 'ads: 5 wins -> interstitial due');
  ok(await p.evaluate(() => JSON.parse(localStorage.getItem('squishdoku-ad-pacing-v1')).wins === 5), 'ads: interstitial counter saved in localStorage');
  for (const lvl of [41, 50]) {
    await pickLevel(lvl, true); await sleep(400);
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
  ok(await p.locator('.nn-tile.is-locked').count() === 0, 'all levels unlocked');
  ok((await p.textContent('.sd-lv-progress')).startsWith('13 / 50'), 'level select shows solved count');
  await pickLevel(12); await sleep(1500);
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
  ok(await p.isVisible('.nn-lv-grid') && await p.isVisible('#tabs'), 'back button -> level select (with tab bar)');
  // 10) Tipp per Werbung: each watched (dummy) ad reveals one more solution squish, as often as wanted
  await p.evaluate(() => SquishDoku.startLevel(13)); await sleep(1600);
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
  ok(await p.evaluate(n => JSON.parse(localStorage.getItem('squishdoku-v1')).revealed[13] === n, s.N), 'reveal: used reveals saved per level in localStorage');
  // 11) cadence: wins 9 and 10 -> next start shows the interstitial again
  for (const lvl of [14, 15]) {
    await p.evaluate(l => SquishDoku.startLevel(l), lvl); await sleep(1500);
    const t = await st(); for (let r = 0; r < t.N; r++) { await hold(r, t.sol[r]); await sleep(200); }
    await p.waitForFunction(() => !document.getElementById('veil').hidden, null, { timeout: 20000 }); await sleep(1200);
  }
  ok(await p.evaluate(() => SquishDoku.adPacing.wins === 10 && SquishDoku.adPacing.interstitialDue), 'ads: 10 wins -> interstitial due again');
  await p.click('#btn-again'); await sleep(400);
  ok(await p.isVisible('#ad-interstitial'), 'ads: interstitial after every 5th win');
  await p.waitForFunction(() => !document.getElementById('ad-continue').disabled, null, { timeout: 8000 }); await p.click('#ad-continue'); await sleep(1500);
  ok((await st()).id === 15 && !(await p.evaluate(() => SquishDoku.adPacing.interstitialDue)), 'ads: level starts after the interstitial, counter cleared');
  // 12) the guided missions can be replayed from the level list and never show ads, even when one is due
  for (let lvl = 15; lvl <= 19; lvl++) { if (lvl > 15) { await p.evaluate(l => SquishDoku.startLevel(l), lvl); await sleep(1500); }
    const t = await st(); for (let r = 0; r < t.N; r++) { await hold(r, t.sol[r]); await sleep(200); }
    await p.waitForFunction(() => !document.getElementById('veil').hidden, null, { timeout: 20000 }); await sleep(1200); }
  ok(await p.evaluate(() => SquishDoku.adPacing.interstitialDue), 'ads: 15 wins -> interstitial due');
  await p.evaluate(() => SquishDoku.showHome('levels')); await sleep(600);
  await pickLevel(2); await sleep(1500);
  ok(!(await p.isVisible('#ad-interstitial')) && (await st()).id === 2 && await p.evaluate(() => SquishDoku.tutorial.active), 'mission 2 replays from the level list with its guide, without an ad');
  await p.evaluate(() => SquishDoku.showHome('rules')); await sleep(500);
  ok(!(await p.isVisible('#btn-rules-tutorial')) && !/Tutorial/.test(await p.textContent('#home-screen')), 'rules screen: no "Tutorial spielen" any more');
  // 13) saved progress from before the missions (old tutorial numbering) is migrated
  await p.evaluate(() => localStorage.setItem('squishdoku-v1', JSON.stringify({ unlocked: 6, stars: { 1: 3, 2: 3, 3: 2, 4: 1, 5: 3 }, revealed: { 5: 2 }, seenRules: true, rulesCollapsed: true })));
  await p.reload(); await p.waitForFunction(() => document.documentElement.dataset.ready === '1');
  const mig = await p.evaluate(() => JSON.parse(localStorage.getItem('squishdoku-v1')));
  ok(mig.v === 4 && mig.unlocked === 8 && JSON.stringify(mig.stars) === JSON.stringify({ 1: 2, 3: 1, 7: 3 }) && mig.revealed[7] === 2 && mig.rulesCollapsed === true, `old save migrated: old L3 → L1, old L4 → L3, old L5 → L7 (v4), unlocked 6 → 8 (${JSON.stringify(mig)})`);
  await p.evaluate(() => SquishDoku.showHome('levels')); await sleep(600);
  ok(await p.locator('.nn-tile.is-locked').count() === 42, 'migrated save: L1-8 open (incl. the new missions), L9-50 locked');
  ok(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  if (warnings.length) console.log('  (warnings: ' + [...new Set(warnings)].join(' | ') + ')');
  await b.close();
}
(async () => {
  const dpr = SHOTS ? 2 : 1;
  if (process.env.VP !== 'se') await run({ width: 390, height: 844 }, dpr);
  if (process.env.VP !== 'pro') await run({ width: 375, height: 667 }, dpr);
  console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
  process.exit(failures ? 1 : 0);
})();
