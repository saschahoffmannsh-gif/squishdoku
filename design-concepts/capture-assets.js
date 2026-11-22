// Renders real SquishDoku squishes (the game's own three.js board) to transparent PNGs for the mockups.
// node design-concepts/capture-assets.js  (game served on :8792)
const { chromium } = require('playwright-core');
const OUT = __dirname + '/assets';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await (await b.newContext({ viewport: { width: 700, height: 900 }, deviceScaleFactor: 3, locale: 'de-DE' })).newPage();
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('http://localhost:8792/index.html'); await p.waitForFunction(() => document.documentElement.dataset.ready === '1');
  await p.evaluate(() => { localStorage.setItem('squishdoku-v1', JSON.stringify({ v: 3, unlocked: 50, stars: {}, seenRules: true, rulesCollapsed: true })); SquishDoku.reload(); SquishDoku.adPacing.takeInterstitial = () => false; });
  await p.addStyleTag({ content: `html,body{background:transparent!important}.aw-bg,.sd-hud,.sd-status,.sd-rulesbar,.sd-adtip,.sd-hint,#plate,.sd-plate,.sd-tut-layer,.sd-tut-bubble,#home,.aw-confetti{display:none!important}` });
  const start = async L => { await p.evaluate(L => SquishDoku.startLevel(99, L), L); await p.waitForFunction(() => SquishDoku.state?.id === 99, null, { timeout: 30000 }); await sleep(2500); };
  const clipOf = (r, c, k = 1.25) => p.evaluate(([r, c, k]) => { const s = SquishDoku.board.screenOf(r, c); const h = s.size * k; return { x: s.x - h, y: s.y - h * 1.05, width: 2 * h, height: 2 * h }; }, [r, c, k]);
  // single squishes: 3x3 board, only the centre stays
  const PAL = { blue: 1, red: 2, green: 3, orange: 4, purple: 5, pink: 7, cyan: 8, white: 9 }; // game palette ids
  for (const [name, v] of Object.entries(PAL)) {
    await start({ id: 99, N: 3, label: '', regions: ['aaa', 'aba', 'aaa'], solution: [0, 1, 2], colors: [v, v] });
    await p.evaluate(() => { for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) if (r !== 1 || c !== 1) SquishDoku.board.vanish(r, c); SquishDoku.board.requestFrame({ shadows: true }); });
    await sleep(1200);
    await p.screenshot({ path: `${OUT}/squish-${name}.png`, clip: await clipOf(1, 1, .72), omitBackground: true });
    if (name === 'blue' || name === 'white') { await p.evaluate(() => { SquishDoku.board.press(1, 1); }); await sleep(500); await p.screenshot({ path: `${OUT}/squish-${name}-press.png`, clip: await clipOf(1, 1, .72), omitBackground: true }); await p.evaluate(() => SquishDoku.board.release(1, 1)); await sleep(1500); }
    if (name === 'blue') { await p.evaluate(() => { SquishDoku.board.glow(1, 1, true); }); await sleep(1500); await p.screenshot({ path: `${OUT}/squish-glow.png`, clip: await clipOf(1, 1, .95), omitBackground: true }); }
  }
  // a real board mid-game (5x5 from level 5), some lit, some popped
  const L5 = await p.evaluate(() => SquishDoku.levels[4]);
  await start({ ...L5, id: 99 });
  await p.evaluate(() => { const S = SquishDoku.state, B = SquishDoku.board; for (const [r, c] of [[0, 2], [1, 4], [3, 3]]) { S.state[r][c] = 'glow'; B.glow(r, c, true); } for (const [r, c] of [[0, 0], [0, 4], [1, 3], [4, 4], [2, 0]]) { S.state[r][c] = 'popped'; B.vanish(r, c); } B.requestFrame({ shadows: true }); });
  await sleep(2000);
  const fr = await p.evaluate(() => { const r = SquishDoku.board.frameRect(); return { x: r.left - 6, y: r.top - 6, width: r.width + 12, height: r.height + 12 }; });
  await p.screenshot({ path: `${OUT}/board-5x5.png`, clip: fr, omitBackground: true });
  console.log('done', fr);
  await b.close();
})();
