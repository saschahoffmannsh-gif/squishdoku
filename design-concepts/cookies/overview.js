// Combines shots/<set>-lineup.png + shots/<set>-board.png of all sets into shots/cookies-overview.png
// node design-concepts/cookies/overview.js   (run render.js first)
const { chromium } = require('playwright-core');
const path = require('path'), fs = require('fs');
const DIR = __dirname, OUT = path.join(DIR, 'shots'), SETS = JSON.parse(fs.readFileSync(path.join(DIR, 'sets.json'), 'utf8'));
const pal = fs.readFileSync(path.join(DIR, 'cookies.mjs'), 'utf8').match(/\{ key: \d+, name: '[^']+', hex: '#\w+', animal: '\w+', tier: '[^']+' \}/g).map(s => ({ hex: s.match(/#\w+/)[0], tier: s.match(/tier: '([^']+)'/)[1], name: s.match(/name: '([^']+)'/)[1] }));
const col = (k, s) => `<section><h2>${s.title}</h2><p>${s.de}</p>
  <div class="lineup"><img src="file://${OUT}/${k}-lineup.png"></div>
  <div class="board"><img src="file://${OUT}/${k}-board.png"></div></section>`;
const html = `<html><head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600&display=swap"><style>
body{margin:0;padding:64px 72px 72px;background:radial-gradient(1400px 700px at 50% 0,#1c2560,#0b1030 70%);color:#e9ecff;font-family:Fredoka,sans-serif;width:${3 * 1000 + 2 * 48}px}
h1{margin:0;font-weight:600;font-size:44px;letter-spacing:.01em}h1 b{color:#ffc829}h1 small{font-weight:400;font-size:22px;color:#8f97c9;margin-left:18px}
.chips{display:flex;gap:14px;margin:22px 0 40px;flex-wrap:wrap}.chips span{display:flex;align-items:center;gap:8px;font-size:18px;color:#c6cbef;padding:7px 14px 7px 8px;border-radius:99px;background:#ffffff0d;border:1px solid #ffffff14}
.chips i{width:20px;height:20px;border-radius:50%;display:block;box-shadow:inset 0 -3px 5px #0004}
.row{display:flex;gap:48px}section{width:1000px;background:#ffffff08;border:1px solid #ffffff12;border-radius:36px;padding:34px 34px 30px;box-sizing:border-box}
h2{margin:0;font-size:32px;font-weight:600;color:#ffd760}p{margin:10px 0 22px;font-size:19px;line-height:1.45;color:#b9bfe6;min-height:84px}
.lineup img{width:100%;display:block;border-radius:22px}.board{margin-top:18px;height:880px;overflow:hidden;border-radius:22px;background:#0b1030}
.board img{width:100%;display:block;margin-top:-125px}</style></head><body>
<h1>SquishDoku · <b>Keks-Sets</b><small>3 Entwürfe · je Farbe ein Tier · three.js-Render, Spiel-Brett &amp; -Kamera · goldener Keks = leuchtend, zerbröselt = geplatzt</small></h1>
<div class="chips">${pal.map(p => `<span><i style="background:${p.hex}"></i>${p.name} · ${p.tier}</span>`).join('')}</div>
<div class="row">${Object.entries(SETS).map(([k, s]) => col(k, s)).join('')}</div></body></html>`;
(async () => {
  const tmp = path.join(OUT, '_overview.html'); fs.writeFileSync(tmp, html);
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 3240, height: 1000 }, deviceScaleFactor: 1 });
  await p.goto('file://' + tmp); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(500);
  await p.screenshot({ path: path.join(OUT, 'cookies-overview.png'), fullPage: true }); fs.unlinkSync(tmp); await b.close();
  console.log(path.join(OUT, 'cookies-overview.png'));
})();
