// SquishDoku feature tests: Tagesrätsel + Serie, Sterne & Zeit, Rückgängig, Vibration, Optionen & Statistik.
// Real touch events via CDP, mobile viewports, CPU throttling (THROTTLE env, default 4).
// Usage: node tests/features-e2e.js [baseUrl] [--shots]
const { chromium } = require('playwright-core');
const BASE = process.argv.find(a => a.startsWith('http')) || 'http://localhost:8792/index.html';
const SHOTS = process.argv.includes('--shots');
const THROTTLE = +(process.env.THROTTLE || 4);
const OUT = __dirname + '/../shots';
const fs = require('fs'); if (SHOTS) fs.mkdirSync(OUT, { recursive: true });
const DAILY = require('../src/daily.json');
const SD = require('../src/daily.js');
let failures = 0;
const ok = (cond, msg) => { console.log((cond ? '  ✔ ' : '  ✘ ') + msg); if (!cond) failures++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const overlap = (a, b) => a && b && a.left < b.right - .5 && b.left < a.right - .5 && a.top < b.bottom - .5 && b.top < a.bottom - .5;

async function run(vp) {
  console.log(`\n=== ${vp.width}x${vp.height}, CPU x${THROTTLE} ===`);
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 2, hasTouch: true, isMobile: true, locale: 'de-DE' });
  // record vibrations (Chrome headless has navigator.vibrate; we keep the calls)
  await ctx.addInitScript(() => { window.__vib = []; navigator.vibrate = p => { window.__vib.push(JSON.stringify(p)); return true; }; });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const cdp = await ctx.newCDPSession(p);
  if (THROTTLE > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
  const touch = (type, x, y, timestamp) => cdp.send('Input.dispatchTouchEvent', { type, ...(timestamp ? { timestamp } : {}), touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }] });
  const pos = (r, c) => p.evaluate(([r, c]) => { const s = SquishDoku.board.screenOf(r, c); return { x: s.x, y: s.y + s.size * .1 }; }, [r, c]);
  async function hold(r, c, ms = 700) { const q = await pos(r, c); await touch('touchStart', q.x, q.y); await sleep(ms); await touch('touchEnd'); await sleep(150); }
  async function tapCell(r, c) { const q = await pos(r, c);
    await p.evaluate(() => { SquishDoku.holdMs = 1500; });
    const t0 = Date.now() / 1000; await touch('touchStart', q.x, q.y, t0); await touch('touchEnd', 0, 0, t0 + .06); await sleep(200);
    await p.evaluate(() => { SquishDoku.holdMs = 400; }); }
  async function swipe(cells, stepMs = 25) {
    await p.evaluate(() => { SquishDoku.holdMs = 1500; });
    const pts = []; for (const [r, c] of cells) pts.push(await pos(r, c));
    await touch('touchStart', pts[0].x, pts[0].y);
    await touch('touchMove', pts[0].x + (pts[1].x - pts[0].x) * .4, pts[0].y + (pts[1].y - pts[0].y) * .4);
    for (let i = 1; i < pts.length; i++) for (let k = 1; k <= 6; k++) {
      await touch('touchMove', pts[i - 1].x + (pts[i].x - pts[i - 1].x) * k / 6, pts[i - 1].y + (pts[i].y - pts[i - 1].y) * k / 6); await sleep(stepMs);
    }
    await touch('touchEnd'); await sleep(250);
    await p.evaluate(() => { SquishDoku.holdMs = 400; });
  }
  async function tapEl(sel) { const r = await p.evaluate(s => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, sel); if (!r) throw new Error('no ' + sel);
    const t0 = Date.now() / 1000; await touch('touchStart', r.x, r.y, t0); await touch('touchEnd', 0, 0, t0 + .05); }
  const st = () => p.evaluate(() => { const S = SquishDoku.state; return { id: S.id, N: S.N, hearts: S.hearts, glow: S.glow, grid: S.state.map(r => r.slice()), sol: S.L.solution, regions: S.L.regions, locked: S.locked, ms: S.ms, hist: S.hist.length, daily: S.L.daily || null }; });
  const dialog = () => p.evaluate(() => { const v = document.getElementById('veil'); return v.hidden ? null : document.getElementById('dialog').dataset.kind; });
  const waitFor = async (fn, arg, ms = 15000) => { try { await p.waitForFunction(fn, arg, { timeout: ms }); return true; } catch { return false; } };
  const rect = sel => p.evaluate(s => { const e = document.querySelector(s); if (!e || e.hidden || !e.offsetParent && getComputedStyle(e).position !== 'fixed') return null; const b = e.getBoundingClientRect(); return { left: b.left, top: b.top, right: b.right, bottom: b.bottom, width: b.width, height: b.height }; }, sel);
  const shot = async n => { if (SHOTS) await p.screenshot({ path: `${OUT}/feat-${vp.width}x${vp.height}-${n}.png` }); };
  // interstitial ads are tested in e2e.js; here they would only interrupt the replays
  const ready = async () => { await p.waitForFunction(() => document.documentElement.dataset.ready === '1', null, { timeout: 30000 }); await p.evaluate(() => { SquishDoku.adPacing.takeInterstitial = () => false; }); };
  // solve the current board quickly: all solution cells via the game's own hold action (input itself is tested elsewhere)
  async function solveRest(skipFirst = 0) { const s = await st(); for (let r = skipFirst; r < s.N; r++) if (s.grid[r][s.sol[r]] !== 'glow') await p.evaluate(([r, c]) => SquishDoku.act.hold(r, c), [r, s.sol[r]]); }
  // the settings sheet slides up: wait until it rests before measuring / tapping its rows
  const sheetReady = () => waitFor(() => !document.getElementById('sheet-veil').hidden && document.getElementById('sheet').getAnimations().length === 0);
  const tooBig = async () => { const d = await rect('#dialog'); return !d || d.top < 0 || d.bottom > vp.height + 1; };

  // ---------- 1. Speicher-Migration v2 → v3 ----------
  console.log('Speicher');
  await p.goto(BASE); await ready();
  await p.evaluate(() => localStorage.setItem('squishdoku-v1', JSON.stringify({ v: 2, unlocked: 6, stars: { 1: 3, 2: 3, 3: 2, 4: 1, 5: 3 }, revealed: { 5: 2 }, seenRules: true, rulesCollapsed: true })));
  await p.reload(); await ready();
  const mig = await p.evaluate(() => JSON.parse(localStorage.getItem('squishdoku-v1')));
  ok(mig.v === 4 && mig.unlocked === 9 && JSON.stringify(mig.stars) === JSON.stringify({ 1: 3, 2: 3, 3: 2, 7: 1, 8: 3 }) && mig.revealed[8] === 2 && mig.rulesCollapsed === true, `v2 save migrated to v4 without losing stars/unlock/reveals (old L4-5 → L7-8) ${JSON.stringify(mig.stars)}`);
  ok(JSON.stringify(mig.times) === '{}' && mig.daily && mig.daily.streak === 0 && JSON.stringify(mig.daily.done) === '{}' && mig.settings.vibration === true, 'v3 adds times, daily (streak 0) and settings (vibration on)');
  ok((await p.textContent('#home-stars')) === '12/150' && (await p.textContent('#home-stars b')) === '12', 'total stars shown in the top pill (12/150)');

  // ---------- 2. Startseite: Tagesrätsel-Karte ----------
  console.log('Tagesrätsel');
  const today = await p.evaluate(() => SquishDoku.today);
  ok(today === SD.dateKey(new Date()), `today's key is the Europe/Berlin date (${today})`);
  ok(SD.dateKey(new Date('2026-11-21T23:30:00Z')) === '2026-11-22' && SD.dateKey(new Date('2026-07-01T21:59:00Z')) === '2026-07-01' && SD.dateKey(new Date('2026-07-01T22:01:00Z')) === '2026-07-02', 'day switches at Berlin midnight (CET and CEST)');
  // fixed test days: Mo 2026-11-23 (5×5), Do 2026-11-26
  await p.evaluate(() => { const s = SquishDoku.store; s.daily = { done: {}, streak: 4, best: 6, last: '2026-11-22' }; localStorage.setItem('squishdoku-v1', JSON.stringify(s)); SquishDoku.reload(); SquishDoku.today = '2026-11-23'; SquishDoku.showHome('home'); });
  await sleep(600);
  const card = await p.evaluate(() => { const b = document.getElementById('btn-daily'); return b && { text: b.textContent.replace(/\s+/g, ' ').trim(), status: b.dataset.status, flame: document.querySelector('#home-streak b').textContent, week: [...b.querySelectorAll('.nn-week span')].map(d => d.className).join(' ') }; });
  ok(card && card.text.includes('Tagesrätsel') && card.text.includes('Mo., 23. November') && card.text.includes('5×5') && card.text.includes('Rekord 6 Tage') && card.text.includes('Spielen') && card.status === 'new', `daily card on the start screen: date, size, record, "Spielen" (${card && card.text})`);
  ok(card && card.flame === '4', 'streak pill shows the running streak (4, yesterday solved)');
  ok(card && card.week.startsWith('is-today is-future'), `week row Mo–So: Monday = today (${card && card.week})`);
  const hr = { play: await rect('#btn-play'), daily: await rect('#btn-daily'), levels: await rect('#btn-levels'), gear: await rect('#btn-settings'), top: await rect('#home-stars'), streak: await rect('#home-streak'), tag: await rect('#tagline'), tabs: await rect('#tab-home') };
  const list = Object.values(hr);
  ok(list.every(r => r && r.top >= 0 && r.bottom <= vp.height && r.left >= 0 && r.right <= vp.width), 'start screen: all items inside the viewport');
  ok(!list.some((a, i) => list.some((b, j) => j > i && overlap(a, b))), 'start screen: nothing overlaps');
  await shot('01-home');

  // play the daily: puzzle = table entry, labelled as Tagesrätsel
  await tapEl('#btn-daily');
  ok(await waitFor(() => SquishDoku.state?.L?.daily === '2026-11-23' && !document.getElementById('game').hidden), 'tapping the card starts the daily puzzle');
  await sleep(800);
  let s = await st();
  ok(JSON.stringify(s.regions) === JSON.stringify(DAILY['2026-11-23'].regions) && JSON.stringify(s.sol) === JSON.stringify(DAILY['2026-11-23'].solution) && s.N === 5, 'daily puzzle comes from the precomputed table (5×5 on Monday)');
  ok((await p.textContent('#lvl-kind')) === 'TAGESRÄTSEL' && (await p.textContent('#lvl-name')).includes('23'), `level card says TAGESRÄTSEL + date ("${await p.textContent('#lvl-name')}")`);
  const winsBefore = await p.evaluate(() => SquishDoku.adPacing.wins);
  await hold(0, s.sol[0]);
  s = await st(); ok(s.grid[0][s.sol[0]] === 'glow', 'daily: hold lights a squish (touch)');
  await solveRest(1);
  ok(await waitFor(() => document.getElementById('dialog').dataset.kind === 'win' && !document.getElementById('veil').hidden), 'daily solved → win dialog');
  await sleep(1600);
  const dw = await p.evaluate(() => ({ txt: document.getElementById('dialog').textContent, stars: document.querySelectorAll('.sd-stars i.on').length, D: SquishDoku.store.daily, wins: SquishDoku.adPacing.wins }));
  ok(dw.txt.includes('5 Tage') && dw.txt.includes('in Folge') && dw.txt.includes('Rekord: 6'), 'win dialog shows the grown streak (5 Tage in Folge, Rekord 6)');
  ok(dw.D.streak === 5 && dw.D.last === '2026-11-23' && dw.D.best === 6 && dw.D.done['2026-11-23'] && dw.D.done['2026-11-23'].stars === 3, 'daily result + streak saved');
  ok(dw.wins === winsBefore + 1, 'daily win counts once for the ad rhythm, like a level');
  ok(!(await tooBig()), 'daily win dialog fits the screen');
  await shot('02-daily-win');
  await tapEl('#btn-daily-ok'); await sleep(900);
  const card2 = await p.evaluate(() => { const b = document.getElementById('btn-daily'); return { status: b.dataset.status, flame: document.querySelector('#home-streak b').textContent, stars: b.querySelectorAll('.nn-dstars i.on').length, text: b.textContent, today: b.querySelector('.nn-week .is-today').classList.contains('is-done') }; });
  ok(card2.status === 'solved' && card2.flame === '5' && card2.stars === 3 && /Gelöst in \d:\d\d/.test(card2.text) && card2.today, 'card shows today\'s result (stars + time), today lit in the week row, streak 5');
  await shot('03-home-solved');
  await tapEl('#btn-daily'); await sleep(700);
  const dd = await p.evaluate(() => ({ kind: document.getElementById('dialog').dataset.kind, txt: document.getElementById('dialog').textContent }));
  ok(dd.kind === 'daily' && dd.txt.includes('Heute schon gelöst') && dd.txt.includes('Neues Rätsel in') && dd.txt.includes('5 Tage'), 'solved card opens today\'s result (no second streak)');
  ok(!(await tooBig()), 'result dialog fits the screen');
  await shot('04-daily-done');
  // replay keeps the best and doesn't count the streak twice
  await tapEl('#btn-daily-again'); await waitFor(() => SquishDoku.state?.L?.daily === '2026-11-23' && document.getElementById('veil').hidden); await sleep(500);
  await p.evaluate(() => { SquishDoku.state.hearts = 2; }); await solveRest();
  await waitFor(() => document.getElementById('dialog').dataset.kind === 'win' && !document.getElementById('veil').hidden); await sleep(400);
  const rep = await p.evaluate(() => SquishDoku.store.daily);
  ok(rep.streak === 5 && rep.done['2026-11-23'].stars === 3, 'daily replay: best result kept, streak unchanged');
  // missed days reset the streak
  await p.evaluate(() => { SquishDoku.today = '2026-11-26'; SquishDoku.showHome('home'); }); await sleep(500);
  const card3 = await p.evaluate(() => { const b = document.getElementById('btn-daily'); return { status: b.dataset.status, flame: document.querySelector('#home-streak b').textContent, out: document.getElementById('home-streak').classList.contains('is-out'), week: [...b.querySelectorAll('.nn-week span')].map(d => d.className.split(' ')[0]).join(' ') }; });
  ok(card3.status === 'new' && card3.flame === '0' && card3.out, 'two days missed → streak pill shows 0 (grey)');
  ok(card3.week === 'is-on is-off is-off is-today is-future is-future is-future', `week row: Mo solved, Di+Mi missed, Do today (${card3.week})`);
  await tapEl('#btn-daily'); await waitFor(() => SquishDoku.state?.L?.daily === '2026-11-26'); await sleep(600);
  s = await st(); ok(s.N === 7 && JSON.stringify(s.regions) === JSON.stringify(DAILY['2026-11-26'].regions), 'Thursday daily is 7×7 from the table');
  await solveRest(); await waitFor(() => document.getElementById('dialog').dataset.kind === 'win' && !document.getElementById('veil').hidden); await sleep(300);
  const rs = await p.evaluate(() => SquishDoku.store.daily);
  ok(rs.streak === 1 && rs.best === 6 && rs.last === '2026-11-26', `after a gap the streak restarts at 1, best stays 6 (${JSON.stringify({ ...rs, done: Object.keys(rs.done) })})`);
  // the next day continues
  await p.evaluate(() => { SquishDoku.today = '2026-11-27'; }); await p.evaluate(() => SquishDoku.startDaily('2026-11-27'));
  await waitFor(() => SquishDoku.state?.L?.daily === '2026-11-27' && document.getElementById('veil').hidden); await sleep(400);
  await solveRest(); await waitFor(() => document.getElementById('dialog').dataset.kind === 'win' && !document.getElementById('veil').hidden); await sleep(300);
  ok((await p.evaluate(() => SquishDoku.store.daily.streak)) === 2, 'solving the next day → streak 2');
  // a day outside the table is built off the main thread (Web Worker), identical to the generator
  const far = '2031-03-03';
  const wp = await p.evaluate(async k => { const t = performance.now(); const L = await SquishDoku.dailyPuzzle(k); return { L, ms: performance.now() - t }; }, far);
  const ref = SD.puzzle(far);
  ok(JSON.stringify(wp.L.regions) === JSON.stringify(ref.regions) && JSON.stringify(wp.L.solution) === JSON.stringify(ref.solution), `day outside the table: worker builds the same puzzle as the generator (${Math.round(wp.ms)} ms)`);
  ok(!DAILY[far] && Object.keys(DAILY).length >= 760, `table covers ${Object.keys(DAILY)[0]} … ${Object.keys(DAILY).slice(-1)[0]}`);

  // ---------- 3. Sterne & Zeit ----------
  console.log('Sterne & Zeit');
  const th = await p.evaluate(() => { const f = (N, h, s) => SquishDoku.starsFor({ N }, h, s * 1000), g = (h) => SquishDoku.starsFor({ N: 5, guide: 'touch' }, h, 999999);
    return [f(5, 3, 59), f(5, 3, 61), f(5, 2, 100), f(5, 2, 121), f(5, 1, 30), f(7, 3, 119), f(7, 3, 500), f(8, 2, 299), f(8, 2, 301), g(3), g(2), g(1)].join(''); });
  ok(th === '322113221321', `star thresholds (${th})`);
  await p.evaluate(() => SquishDoku.startLevel(8)); await waitFor(() => SquishDoku.state?.id === 8 && document.getElementById('veil').hidden); await waitFor(() => SquishDoku.state.ms > 600, null, 20000);
  const t1 = await p.evaluate(() => SquishDoku.state.ms);
  ok(t1 > 600, `timer runs while playing (${Math.round(t1)} ms)`);
  ok(/^\d:\d\d$/.test(await p.textContent('#timer-text')), 'timer shown in the HUD (m:ss)');
  await p.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  const h0 = await p.evaluate(() => SquishDoku.state.ms); await sleep(1500); const h1 = await p.evaluate(() => SquishDoku.state.ms);
  ok(h1 - h0 < 300, `timer pauses while the app is hidden (+${Math.round(h1 - h0)} ms in 1.5 s)`);
  await p.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
  await tapEl('#btn-adtip'); await waitFor(() => SquishDoku.adUI.isOpen, null, 5000);
  const a0 = await p.evaluate(() => SquishDoku.state.ms); await sleep(1200); const a1 = await p.evaluate(() => SquishDoku.state.ms);
  ok(a1 - a0 < 300, `timer pauses while the hint offer is open (+${Math.round(a1 - a0)} ms)`);
  await tapEl('.ad-later'); await waitFor(() => !SquishDoku.adUI.isOpen, null, 5000);
  const r0 = await p.evaluate(() => SquishDoku.state.ms); await waitFor(r0 => SquishDoku.state.ms > r0 + 500, r0, 10000); const r1 = await p.evaluate(() => SquishDoku.state.ms);
  ok(r1 - r0 > 500, `timer continues afterwards (+${Math.round(r1 - r0)} ms)`);
  // status row and HUD don't overlap
  const hud = ['#btn-back', '#level-card', '#btn-undo', '#btn-reset'], row = ['#hearts', '#timer', '#progress'];
  const hr2 = []; for (const q of [...hud, ...row]) hr2.push(await rect(q));
  ok(hr2.every(Boolean) && !hr2.some((a, i) => hr2.some((b, j) => j > i && overlap(a, b))) && hr2.every(r => r.left >= 0 && r.right <= vp.width), 'HUD + status row (hearts | timer | progress) fit without overlap');
  const brd = await p.evaluate(() => { const r = SquishDoku.board.boardRect(); return { left: r.left, top: r.top, right: r.left + r.width, bottom: r.top + r.height }; });
  const rb = await rect('#rulesbar');
  ok(hr2.every(r => r.bottom <= brd.top + 2) && (!rb || rb.bottom <= brd.top + 4), 'HUD and status row stay above the board');
  await shot('05-hud');
  await solveRest(); await waitFor(() => document.getElementById('dialog').dataset.kind === 'win' && !document.getElementById('veil').hidden); await sleep(1800);
  const w1 = await p.evaluate(() => ({ on: document.querySelectorAll('.sd-stars i.on').length, time: document.getElementById('win-time')?.textContent, times: SquishDoku.store.times, stars: SquishDoku.store.stars }));
  ok(w1.on === 3 && /\d:\d\d/.test(w1.time) && w1.times[8] > 0 && w1.stars[8] === 3, `fast, no mistakes → 3 animated stars, time on the win screen (${w1.time})`);
  ok(!(await tooBig()), 'level win dialog fits the screen');
  await shot('06-win');
  // slow replay: 2 stars, best (3 stars + time) kept
  await tapEl('#btn-again'); await waitFor(() => SquishDoku.state?.id === 8 && !SquishDoku.state.locked && document.getElementById('veil').hidden); await sleep(400);
  await p.evaluate(() => { SquishDoku.state.ms = 10 * 60 * 1000; }); await solveRest(); await waitFor(() => document.getElementById('dialog').dataset.kind === 'win' && !document.getElementById('veil').hidden); await sleep(1800);
  const w2 = await p.evaluate(() => ({ on: document.querySelectorAll('.sd-stars i.on').length, txt: document.getElementById('dialog').textContent, t: SquishDoku.store.times[8], s: SquishDoku.store.stars[8] }));
  ok(w2.on === 2 && w2.s === 3 && w2.t === w1.times[8] && w2.txt.includes('Bestzeit') && w2.txt.includes('Für 3 Sterne') && w2.txt.includes('unter 1:00'), `slow replay → 2 stars, best stars + best time kept, tells you how to get 3 (${JSON.stringify({ ...w2, txt: w2.txt.slice(0, 160), dlg: await dialog(), s: await st().then(x => ({ id: x.id, glow: x.glow, locked: x.locked, ms: x.ms })) })})`);
  // faster replay → new best time
  await tapEl('#btn-again'); await waitFor(() => SquishDoku.state?.id === 8 && !SquishDoku.state.locked && document.getElementById('veil').hidden); await sleep(200);
  await solveRest(); await waitFor(() => document.getElementById('dialog').dataset.kind === 'win' && !document.getElementById('veil').hidden); await sleep(1500);
  const w3 = await p.evaluate(() => ({ txt: document.getElementById('dialog').textContent, t: SquishDoku.store.times[8] }));
  ok(w3.t < w1.times[8] && w3.txt.includes('Neue Bestzeit'), `faster replay → "Neue Bestzeit!" (${w3.t} ms < ${w1.times[8]} ms)`);
  await shot('07-newbest');
  await tapEl('#btn-to-levels'); await sleep(900);
  const tiles = await p.evaluate(() => ({ l5: document.querySelectorAll('[data-level="8"] .nn-ts i.on').length, l4: document.querySelectorAll('[data-level="7"] .nn-ts i.on').length, aria: document.querySelector('[data-level="8"]').getAttribute('aria-label'), time: document.querySelector('[data-level="8"] small').textContent, perfect: document.querySelector('[data-level="8"]').classList.contains('is-perfect'), prog: document.getElementById('home-stars').textContent }));
  ok(tiles.l5 === 3 && tiles.l4 === 1 && tiles.aria.includes('Bestzeit') && /^\d:\d\d$/.test(tiles.time) && tiles.perfect, `level tiles show best stars, best time (${tiles.time}) and the 3-star dot`);
  ok(tiles.prog === '12/150', `levels header shows the total star count (${tiles.prog})`);
  ok(await p.evaluate(() => { const sc = document.querySelector('.nn-lv-scroll'), t = sc.querySelector('.nn-tile.is-current') || sc.querySelector('.nn-tile:not(.is-locked):last-of-type'), a = sc.getBoundingClientRect(), r = t.getBoundingClientRect(); return r.top >= a.top && r.bottom <= a.bottom; }), 'levels open scrolled to the current level');
  ok(await p.evaluate(() => { const sc = document.querySelector('.nn-lv-scroll'), h = document.querySelector('.nn-hdr').getBoundingClientRect(); sc.scrollTop = 99999; const after = document.querySelector('.nn-hdr').getBoundingClientRect(), last = sc.querySelector('.nn-legend').getBoundingClientRect(), tabs = document.getElementById('tabs').getBoundingClientRect(); return h.top === after.top && last.bottom <= tabs.top + 1; }), 'levels: header stays put while the list scrolls, end of list clears the tab bar');
  await shot('08-levels');

  // ---------- 4. Rückgängig ----------
  console.log('Rückgängig');
  await p.evaluate(() => SquishDoku.startLevel(9)); await waitFor(() => SquishDoku.state?.id === 9 && document.getElementById('veil').hidden); await sleep(700);
  ok(await p.evaluate(() => document.getElementById('btn-undo').disabled), 'undo disabled at the start (nothing to undo)');
  s = await st();
  await hold(0, s.sol[0]); s = await st();
  ok(s.grid[0][s.sol[0]] === 'glow' && !(await p.evaluate(() => document.getElementById('btn-undo').disabled)), 'after lighting a squish, undo is enabled');
  await tapEl('#btn-undo'); await sleep(400); s = await st();
  ok(s.grid[0][s.sol[0]] === 'normal' && s.glow === 0 && await p.evaluate(() => document.getElementById('btn-undo').disabled), 'undo switches the light off again → nothing left, disabled');
  // one swipe over 3 non-solution squishes in row 1 = one step
  // three neighbours in one row (not row 0) without the solution squish
  const sr = [1, 2, 3, 4].find(r => s.sol[r] >= 3 || s.sol[r] <= s.N - 4);
  const cells = (s.sol[sr] >= 3 ? [0, 1, 2] : [s.N - 3, s.N - 2, s.N - 1]).map(c => [sr, c]);
  await swipe(cells); await waitFor(c => c.every(([r, k]) => SquishDoku.state.state[r][k] === 'popped'), cells, 6000);
  s = await st(); const popped = cells.filter(([r, c]) => s.grid[r][c] === 'popped').length;
  ok(popped === cells.length && s.hearts === 3, `swipe popped ${popped} squishes (${JSON.stringify(cells)} row1=${s.grid[1].join(',')} sol=${s.sol.join('')} hearts=${s.hearts})`);
  ok(s.hist === 1, 'the whole swipe is ONE undo step');
  await tapEl('#btn-undo'); await waitFor(c => c.every(([r, k]) => SquishDoku.state.state[r][k] === 'normal'), cells, 6000); s = await st();
  ok(cells.every(([r, c]) => s.grid[r][c] === 'normal'), 'one undo brings the whole swipe back');
  // wrong move: heart lost, no undo step, undo does not refund it
  const wr = sr === 2 ? 3 : 2, wrongC = [0, 1, 2, 3, 4, 5].find(c => c !== s.sol[wr]);
  await hold(wr, wrongC); s = await st();
  ok(s.hearts === 2 && s.hist === 0 && await p.evaluate(() => document.getElementById('btn-undo').disabled), 'wrong move costs a heart and is no undo step');
  // tap-pop, tap-restore, undo restore → popped again; undo pop → back
  await tapCell(3, [0, 1, 2, 3, 4, 5].find(c => c !== s.sol[3])); s = await st();
  const pc = [0, 1, 2, 3, 4, 5].find(c => c !== s.sol[3]);
  ok(s.grid[3][pc] === 'popped', 'tap pops a squish');
  await tapCell(3, pc); s = await st(); ok(s.grid[3][pc] === 'normal', 'tap brings it back');
  await tapEl('#btn-undo'); await sleep(500); s = await st(); ok(s.grid[3][pc] === 'popped', 'undo of "bring back" pops it again');
  await tapEl('#btn-undo'); await sleep(500); s = await st(); ok(s.grid[3][pc] === 'normal' && s.hearts === 2, 'undo of the pop → back; hearts stay lost (2)');
  // undo of switching off
  await hold(0, s.sol[0]); await hold(0, s.sol[0]); s = await st(); ok(s.grid[0][s.sol[0]] === 'normal', 'holding a lit squish switches it off');
  await tapEl('#btn-undo'); await sleep(400); s = await st(); ok(s.grid[0][s.sol[0]] === 'glow' && s.glow === 1, 'undo of switching off lights it again');
  await shot('09-undo');
  await p.evaluate(() => SquishDoku.startLevel(1)); await waitFor(() => SquishDoku.state?.id === 1); await sleep(800);
  s = await st(); await p.evaluate(([c]) => SquishDoku.act.hold(0, c), [s.sol[0]]); await sleep(200);
  ok(await p.evaluate(() => document.getElementById('btn-undo').disabled), 'undo stays off in the guided missions');

  // ---------- 5. Vibration ----------
  console.log('Vibration');
  await p.evaluate(() => SquishDoku.startLevel(10)); await waitFor(() => SquishDoku.state?.id === 10 && document.getElementById('veil').hidden); await sleep(700);
  const P = await p.evaluate(() => SquishDoku.haptics.PATTERNS);
  const vib = async fn => { await p.evaluate(() => { window.__vib = []; }); await fn(); await sleep(700); return p.evaluate(() => window.__vib); };
  s = await st();
  let v = await vib(() => hold(0, s.sol[0]));
  ok(v.includes(JSON.stringify(P.light)), `light → ${JSON.stringify(P.light)} (${v.join(' ')})`);
  const pcol = [0, 1, 2, 3, 4, 5, 6].find(c => c !== s.sol[1]);
  v = await vib(async () => { await tapCell(1, pcol); await waitFor(x => window.__vib.includes(x), JSON.stringify(P.pop), 6000); });
  ok(v.includes(JSON.stringify(P.pop)), `pop → ${JSON.stringify(P.pop)} (${v.join(' ')})`);
  v = await vib(() => hold(2, [0, 1, 2, 3, 4, 5, 6].find(c => c !== s.sol[2])));
  ok(v.includes(JSON.stringify(P.wrong)), `wrong → ${JSON.stringify(P.wrong)} (${v.join(' ')})`);
  v = await vib(async () => { await solveRest(); await waitFor(() => document.getElementById('dialog').dataset.kind === 'win' && !document.getElementById('veil').hidden); await sleep(1200); });
  ok(v.includes(JSON.stringify(P.win)), `win → ${JSON.stringify(P.win)}`);
  await p.evaluate(() => SquishDoku.showHome('home')); await sleep(500);
  await tapEl('#tab-settings'); await sheetReady();
  ok(await p.evaluate(() => !document.getElementById('sheet-veil').hidden && document.getElementById('tab-settings').classList.contains('is-on')), 'tab "Optionen" opens the settings sheet');
  ok(await p.evaluate(() => !document.getElementById('vibe-toggle').hidden && document.getElementById('vibe-toggle').getAttribute('aria-pressed') === 'true'), 'vibration switch in the sheet (on)');
  const tb = ['#sheet-stats', '#sound-toggle', '#vibe-toggle', '#time-toggle', '#btn-rules', '#btn-share', '#btn-wipe']; const tbr = []; for (const q of tb) tbr.push(await rect(q));
  ok(tbr.every(r => r && r.top >= 0 && r.bottom <= vp.height) && !tbr.some((a, i) => tbr.some((b, j) => j > i && overlap(a, b))), 'sheet: chips + all rows inside the screen, nothing overlaps');
  await tapEl('#vibe-toggle'); await sleep(300);
  ok(await p.evaluate(() => document.getElementById('vibe-toggle').getAttribute('aria-pressed') === 'false' && JSON.parse(localStorage.getItem('squishdoku-v1')).settings.vibration === false), 'toggle off → saved');
  await p.evaluate(() => SquishDoku.startLevel(11)); await waitFor(() => SquishDoku.state?.id === 11 && document.getElementById('veil').hidden); await sleep(600);
  s = await st();
  v = await vib(async () => { await hold(0, s.sol[0]); await hold(1, [0, 1, 2, 3, 4, 5, 6].find(c => c !== s.sol[1])); });
  ok(v.length === 0, `vibration off → no vibration at all (${v.length})`);
  await p.reload(); await ready();
  ok(await p.evaluate(() => document.getElementById('vibe-toggle').getAttribute('aria-pressed') === 'false'), 'setting survives a reload');
  await shot('10-topbar');

  // ---------- Optionen: Zeit anzeigen, Statistik, Teilen, Zurücksetzen ----------
  console.log('Optionen & Statistik');
  await tapEl('#btn-settings'); await sheetReady();
  ok(await p.evaluate(() => !document.getElementById('sheet-veil').hidden), 'gear on the start screen opens the settings sheet');
  await shot('11-sheet');
  await tapEl('#time-toggle'); await sleep(200);
  ok(await p.evaluate(() => document.getElementById('time-toggle').getAttribute('aria-pressed') === 'false' && JSON.parse(localStorage.getItem('squishdoku-v1')).settings.showTime === false), '"Zeit anzeigen" off → saved');
  await tapEl('#sheet-close'); await sleep(400);
  ok(await p.evaluate(() => document.getElementById('sheet-veil').hidden), 'sheet closes (✕)');
  await p.evaluate(() => SquishDoku.startLevel(9)); await waitFor(() => SquishDoku.state?.id === 9 && !SquishDoku.state.locked && document.getElementById('veil').hidden); await sleep(1500);
  ok(await p.evaluate(() => getComputedStyle(document.getElementById('timer')).display === 'none' && SquishDoku.state.ms > 500), 'timer hidden in the HUD, time still counts (for stars)');
  await p.evaluate(() => SquishDoku.showHome('home')); await sleep(300);
  await tapEl('#tab-settings'); await sheetReady(); await tapEl('#time-toggle'); await sleep(200); await tapEl('#sheet-close'); await sleep(400);
  await p.evaluate(() => SquishDoku.startLevel(9)); await waitFor(() => SquishDoku.state?.id === 9 && document.getElementById('veil').hidden); await sleep(500);
  ok(await p.evaluate(() => getComputedStyle(document.getElementById('timer')).display !== 'none'), 'switched on again → timer back');
  await p.evaluate(() => SquishDoku.showHome('home')); await sleep(300);
  await tapEl('#tab-stats'); await sleep(600);
  const stx = await p.evaluate(() => ({ txt: document.getElementById('home-screen').textContent.replace(/\s+/g, ' '), on: document.getElementById('tab-stats').classList.contains('is-on'), solved: Object.keys(SquishDoku.store.stars).length, stars: Object.values(SquishDoku.store.stars).reduce((a, b) => a + b, 0) }));
  ok(stx.on && stx.txt.includes(`${stx.stars} / 150`) && stx.txt.includes(`${stx.solved}/50Gelöst`) && stx.txt.includes('Ø Zeit') && stx.txt.includes('Beste Serie') && stx.txt.includes('Tagesrätsel gelöst'), `Statistik screen with real numbers (${stx.txt.slice(0, 120)}…)`);
  ok(!(await p.evaluate(() => { const v = document.querySelector('.nn-scroll').getBoundingClientRect(), t = document.getElementById('tabs').getBoundingClientRect(); return v.bottom > t.top + 1; })), 'Statistik scrolls above the tab bar');
  await shot('12-stats');
  // share: Web Share API when there is one, else copy the link
  await p.evaluate(() => { navigator.share = d => { window.__share = d; return Promise.resolve(); }; });
  await tapEl('#tab-settings'); await sheetReady(); await tapEl('#btn-share'); await sleep(300);
  ok(await p.evaluate(() => window.__share?.url === 'https://saschahoffmannsh-gif.github.io/squishdoku/' && /SquishDoku/.test(window.__share.text)), 'Freunde einladen → Web Share with the game link');
  await p.evaluate(() => { navigator.share = undefined; navigator.clipboard.writeText = t => { window.__copied = t; return Promise.resolve(); }; });
  await tapEl('#btn-share'); await sleep(400);
  ok(await p.evaluate(() => window.__copied === 'https://saschahoffmannsh-gif.github.io/squishdoku/' && !document.getElementById('toast').hidden && /Link kopiert/.test(document.getElementById('toast').textContent)), 'no Web Share → link copied + toast');
  // reset with confirmation
  await tapEl('#btn-wipe'); await sleep(500);
  ok(await dialog() === 'confirm' && await p.evaluate(() => document.getElementById('sheet-veil').hidden), 'Fortschritt zurücksetzen → confirmation dialog');
  await shot('13-confirm');
  await tapEl('#btn-wipe-no'); await sheetReady();
  ok(await dialog() === null && await p.evaluate(() => !document.getElementById('sheet-veil').hidden && Object.keys(SquishDoku.store.stars).length > 0), '"Abbrechen" keeps everything, back to the sheet');
  await tapEl('#btn-wipe'); await sleep(500); await tapEl('#btn-wipe-yes'); await sleep(700);
  const wiped = await p.evaluate(() => ({ s: JSON.parse(localStorage.getItem('squishdoku-v1')), pill: document.getElementById('home-stars').textContent, screen: document.getElementById('home').dataset.screen }));
  ok(JSON.stringify(wiped.s.stars) === '{}' && JSON.stringify(wiped.s.times) === '{}' && wiped.s.unlocked === 1 && wiped.s.daily.streak === 0 && wiped.s.settings.vibration === false && wiped.pill === '0/150' && wiped.screen === 'home', 'confirmed → progress wiped (settings kept), start screen shows 0/150');
  // iOS-like: no navigator.vibrate → toggle hidden, no errors
  const p2 = await ctx.newPage(); await p2.addInitScript(() => { delete Navigator.prototype.vibrate; delete navigator.vibrate; });
  await p2.goto(BASE); await p2.waitForFunction(() => document.documentElement.dataset.ready === '1');
  await p2.evaluate(() => { SquishDoku.store.settings.vibration = true; });
  const ios = await p2.evaluate(() => ({ hidden: document.getElementById('vibe-toggle').hidden, sup: SquishDoku.haptics.supported, r: SquishDoku.haptics.pulse('win') }));
  ok(ios.hidden && !ios.sup && ios.r === false, 'no vibrate API (iOS Safari) → toggle hidden, pulses do nothing');
  await p2.evaluate(() => { window.SquishNative = { haptic: k => (window.__nat = (window.__nat || []).concat(k)) }; SquishDoku.haptics.pulse('light'); });
  ok((await p2.evaluate(() => window.__nat || [])).join() === 'light', 'native shell hook (window.SquishNative.haptic) gets the moment name');
  await p2.close();

  ok(errors.length === 0, `no console errors (${errors.slice(0, 3).join(' | ')})`);
  await b.close();
}
(async () => {
  for (const vp of [{ width: 390, height: 844 }, { width: 375, height: 667 }]) await run(vp);
  console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
  process.exit(failures ? 1 : 0);
})();
