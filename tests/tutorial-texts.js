// Plays missions 3–6 by following the guide and prints every bubble text (+ screenshots of the trick
// explanations) – for reviewing the wording and that the bubble never covers the board.
const { chromium } = require('playwright-core');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const VPW = +(process.env.W || 375), VPH = +(process.env.H || 667);
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await (await b.newContext({ viewport: { width: VPW, height: VPH }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(process.argv[2] || 'http://localhost:8792/index.html'); await p.evaluate(() => localStorage.setItem('squishdoku-v1', JSON.stringify({ v: 4, unlocked: 50, stars: {}, seenRules: true })));
  await p.reload(); await p.waitForFunction(() => document.documentElement.dataset.ready === '1');
  let bad = 0;
  for (const lv of (process.env.LVS || '3,4,5,6').split(',').map(Number)) {
    await p.evaluate(l => { document.getElementById('veil').hidden || document.getElementById('btn-next')?.click(); }); await sleep(800);
    await p.evaluate(l => SquishDoku.startLevel(l), lv); await sleep(1800);
    await p.evaluate(() => { const v = document.getElementById('veil'); if (!v.hidden) document.getElementById('btn-next')?.click(); }); await sleep(600);
    console.log(`\n== Mission ${lv}`); let last = '', shots = 0;
    for (let g = 0; g < 60; g++) {
      const t = await p.evaluate(() => { const T = SquishDoku.tutorial, b = document.getElementById('tut-bubble').getBoundingClientRect(), z = SquishDoku.board.boardRect(); return { step: T.step, text: document.querySelector('.sd-tut-text').innerHTML, fit: b.top >= z.top + z.height - 2 && b.bottom <= innerHeight, h: Math.round(b.height), links: document.querySelectorAll('.is-link').length, no: document.querySelectorAll('.is-no').length }; });
      if (!t.step || t.step.type === 'done') { console.log('  [done] ' + t.text); await p.waitForFunction(() => !document.getElementById('veil').hidden, null, { timeout: 15000 }).catch(() => {}); await sleep(1500); break; }
      if (t.text !== last) { console.log(`  [${t.step.explain ? 'erklären' : t.step.type + ':' + (t.step.rule || t.step.kind || '')}] ${t.text.replace(/<\/?b>/g, '*')}  (${t.h}px${t.links ? ', Linien ' + t.links : ''}${t.no ? ', roter Ring' : ''})${t.fit ? '' : '  !!! ÜBERDECKT DAS BRETT'}`); last = t.text; if (!t.fit) bad++; }
      if ((t.step.explain || ['shared', 'pair', 'whatif'].includes(t.step.rule)) && shots < 4) await p.screenshot({ path: `shots/tut-m${lv}-${++shots}-${VPW}x${VPH}.png` });
      if (t.step.type === 'intro') { await p.click('#tut-next'); await sleep(350); continue; }
      if (t.step.type === 'hold') await p.evaluate(([r, c]) => SquishDoku.act.hold(r, c), t.step.cell);
      else for (const [r, c] of t.step.path) await p.evaluate(([r, c]) => SquishDoku.act.swipe(r, c), [r, c]);
      await sleep(450);
    }
  }
  console.log(errs.length ? 'ERRORS ' + errs.join(' | ') : '\nno page errors', bad ? `\n${bad} texts cover the board` : '');
  await b.close(); process.exit(bad || errs.length ? 1 : 0);
})();
