// Renders every .screen of a concept to shots/<concept>-<id>.png (390x844 @2x) and a combined
// presentation PNG shots/<concept>.png.  node design-concepts/render.js 1-squish-welt "1 · Squish-Welt" "subtitle"
const { chromium } = require('playwright-core');
const path = require('path'), fs = require('fs');
const [name, title, sub = ''] = process.argv.slice(2);
const DIR = __dirname, OUT = path.join(DIR, 'shots');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files'] });
  const ctx = await b.newContext({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 2, locale: 'de-DE' });
  const p = await ctx.newPage(); p.on('pageerror', e => console.log('ERR', e.message)); p.on('console', m => m.type() === 'error' && console.log('C', m.text()));
  await p.goto('file://' + path.join(DIR, name + '.html')); await p.waitForFunction(() => document.documentElement.dataset.ready === '1'); await p.waitForTimeout(400);
  const ids = await p.$$eval('.screen', s => s.map(x => [x.id, x.dataset.label || x.id]));
  const files = [];
  for (const [id, label] of ids) { const f = path.join(OUT, `${name}-${id}.png`); await p.locator('#' + id).screenshot({ path: f }); files.push([f, label]); }
  // presentation sheet
  const W = files.length * 390 + (files.length - 1) * 48 + 2 * 72;
  const html = `<html><head><link rel="stylesheet" href="file://${DIR}/shared.css"><style>body{margin:0;padding:56px 72px 64px;display:block;background:#f3f1ec;width:${W}px;font-family:Fredoka}
  h1{margin:0;font:600 26px/1 Fredoka;color:#1b1a2e;letter-spacing:.01em}h1 small{font-weight:500;color:#8a8796;margin-left:14px;font-size:18px}
  .row{display:flex;gap:48px;margin-top:36px}.row figure{margin:0}.row img{display:block;width:390px;height:844px;border-radius:34px;box-shadow:0 1px 0 #0000000d,0 24px 60px -18px #1b1a2e55,0 0 0 1px #00000012}
  figcaption{margin-top:16px;text-align:center;font:500 16px/1 Fredoka;color:#6d6a7a}</style></head><body>
  <h1>SquishDoku · ${title}<small>${sub}</small></h1><div class="row">${files.map(([f, l]) => `<figure><img src="file://${f}"><figcaption>${l}</figcaption></figure>`).join('')}</div></body></html>`;
  const tmp = path.join(OUT, `_${name}.html`); fs.writeFileSync(tmp, html);
  const q = await ctx.newPage(); await q.setViewportSize({ width: W, height: 1000 }); await q.goto('file://' + tmp); await q.evaluate(() => document.fonts.ready); await q.waitForTimeout(300);
  await q.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true }); fs.unlinkSync(tmp);
  console.log(files.map(f => f[0]).join('\n') + '\n' + path.join(OUT, `${name}.png`));
  await b.close();
})();
