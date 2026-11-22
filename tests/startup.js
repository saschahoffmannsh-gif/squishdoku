// Startup + menu render cost: CPU x4 (CDP), 390x844 @3x. Cold load (cache off) → first paint, LCP, app ready,
// long tasks; then the JS time to render each menu screen. node tests/startup.js [baseUrl] [runs]
const { chromium } = require('playwright-core');
const BASE = process.argv.find(a => a.startsWith('http')) || 'http://localhost:8792/index.html';
const RUNS = +(process.argv.find(a => /^\d+$/.test(a)) || 5);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const med = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const R = { fcp: [], lcp: [], ready: [], long: [], kb: [] };
  for (let i = 0; i < RUNS; i++) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true, locale: 'de-DE' });
    const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p);
    await cdp.send('Network.enable'); await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    let bytes = 0; cdp.on('Network.loadingFinished', e => { bytes += e.encodedDataLength; });
    await p.addInitScript(() => { window.__lt = []; window.__lcp = 0;
      new PerformanceObserver(l => l.getEntries().forEach(e => window.__lt.push(e.duration))).observe({ type: 'longtask', buffered: true });
      new PerformanceObserver(l => l.getEntries().forEach(e => { window.__lcp = e.startTime; })).observe({ type: 'largest-contentful-paint', buffered: true });
      const iv = setInterval(() => { if (document.documentElement?.dataset.ready === '1') { window.__ready = performance.now(); clearInterval(iv); } }, 4); });
    await p.goto(BASE); await p.waitForFunction(() => window.__ready); await sleep(1500);
    const m = await p.evaluate(() => ({ fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime, lcp: window.__lcp, ready: window.__ready, long: Math.max(0, ...window.__lt) }));
    R.fcp.push(m.fcp); R.lcp.push(m.lcp); R.ready.push(m.ready); R.long.push(m.long); R.kb.push(bytes / 1024);
    if (i === RUNS - 1 && await p.evaluate(() => !!document.getElementById('tabs'))) {
      const scr = await p.evaluate(async () => { const out = {}; for (const s of ['home', 'levels', 'stats', 'rules', 'home']) { const t = []; for (let k = 0; k < 10; k++) { const t0 = performance.now(); SquishDoku.showHome(s); document.body.offsetHeight; t.push(performance.now() - t0); await new Promise(r => requestAnimationFrame(() => r())); } t.sort((a, b) => a - b); out[s] = t[5]; } return out; });
      console.log('menu render (JS + layout, median, CPU x4):', Object.entries(scr).map(([k, v]) => `${k} ${v.toFixed(1)} ms`).join(' · '));
    }
    await ctx.close();
  }
  const f = a => `${med(a).toFixed(0)} ms`;
  console.log(`${BASE}\n  cold start (CPU x4, cache off, median of ${RUNS}): first paint ${f(R.fcp)} · LCP ${f(R.lcp)} · app ready ${f(R.ready)} · longest task ${f(R.long)} · transferred ${med(R.kb).toFixed(0)} KB`);
  await b.close();
})();
