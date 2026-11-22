// Renders the home/menu pictures (hero board, floaties, chapter icons) from tools/cookie-art.html.
// node tools/menu-art.js  (needs the local server on :8792). Writes src/img/*.webp via PIL.
const { chromium } = require('playwright-core');
const { execFileSync } = require('child_process');
const B = 'http://localhost:8792/tools/cookie-art.html';
const OUT = __dirname + '/../src/img', TMP = '/tmp/menu-art'; require('fs').mkdirSync(TMP, { recursive: true });
const ONLY = process.argv.slice(2);
let jobs = [
  { name: 'hero-board', q: 'mode=hero', w: 640 },
  { name: 'sq-glow', q: 'mode=single&v=4&lit=1', w: 240 },
  { name: 'sq-pink', q: 'mode=single&v=7', w: 140 },
  { name: 'sq-blue', q: 'mode=single&v=1', w: 180 }, { name: 'sq-red', q: 'mode=single&v=2', w: 180 },
  { name: 'sq-green', q: 'mode=single&v=3', w: 180 }, { name: 'sq-orange', q: 'mode=single&v=4', w: 180 },
  { name: 'sq-purple', q: 'mode=single&v=5', w: 180 },
];
if (ONLY.length) jobs = jobs.filter(j => ONLY.includes(j.name));
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  for (const j of jobs) {
    const p = await b.newPage({ viewport: { width: 900, height: 900 }, deviceScaleFactor: 2 });
    p.on('pageerror', e => console.log(j.name, 'ERR', e.message));
    await p.goto(B + '?' + j.q); await p.waitForFunction(() => document.documentElement.dataset.ready === '1', null, { timeout: 60000 });
    const png = `${TMP}/${j.name}.png`; await p.screenshot({ path: png, omitBackground: true });
    // crop to the visible pixels (alpha bbox), scale to the target width, WebP
    execFileSync('python3', ['-c', `
from PIL import Image
im=Image.open('${png}').convert('RGBA');a=im.split()[3].point(lambda v:255 if v>8 else 0);bb=a.getbbox();im=im.crop(bb)
w=${j.w};im=im.resize((w,round(im.height*w/im.width)),Image.LANCZOS);im.save('${OUT}/${j.name}.webp',quality=82,method=6);print('${j.name}',im.size)`], { stdio: 'inherit' });
    await p.close();
  }
  await b.close();
})();
