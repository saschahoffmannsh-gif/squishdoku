// Generates the 5 SquishDoku levels and verifies: valid regions, exactly one
// solution (brute force), and solvable by pure logic steps (no lookahead/guessing).
const E = require('../src/engine.js');
const fs = require('fs');
const names = Array.from({length: 9}, (_, i) => 'Farbe ' + (i + 1));
const plan = [
  { N: 5, maxTech: 2, minTech: 1, label: 'Sehr leicht' },
  { N: 5, maxTech: 3, minTech: 3, label: 'Leicht' },
  { N: 6, maxTech: 3, minTech: 3, label: 'Mittel' },
  { N: 6, maxTech: 4, minTech: 4, label: 'Knifflig' },
  { N: 7, maxTech: 5, minTech: 4, label: 'Schwer' },
];
function regionSizes(rows) { const m = {}; rows.join('').split('').forEach(ch => m[ch] = (m[ch] || 0) + 1); return Object.values(m); }
// Region colours = Squish Attack comic palette values 1..8 (comic-style.mjs PALETTE mid tones).
const PAL = {1:'#1f7ff0',2:'#e8291f',3:'#38b81c',4:'#ff7a0c',5:'#8a3cf0',6:'#ffc21f',7:'#f0459e',8:'#1fc9bd'};
const rgb = h => [1,3,5].map(i => parseInt(h.slice(i, i + 2), 16));
function lab(h) { // sRGB -> CIELAB (D65)
  let [r, g, b] = rgb(h).map(v => { v /= 255; return v > .04045 ? ((v + .055) / 1.055) ** 2.4 : v / 12.92; });
  let x = (r * .4124 + g * .3576 + b * .1805) / .95047, y = r * .2126 + g * .7152 + b * .0722, z = (r * .0193 + g * .1192 + b * .9505) / 1.08883;
  const f = t => t > .008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}
const dist = (a, b) => { const A = lab(PAL[a]), B = lab(PAL[b]); return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]); };
function assignColours(rows) {
  const N = rows.length, adj = new Set();
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) for (const [dr, dc] of [[0,1],[1,0],[1,1],[1,-1]]) {
    const rr = r + dr, cc = c + dc; if (rr >= N || cc < 0 || cc >= N) continue;
    const a = rows[r].charCodeAt(c) - 97, b = rows[rr].charCodeAt(cc) - 97; if (a !== b) adj.add(Math.min(a, b) + ',' + Math.max(a, b));
  }
  const edges = [...adj].map(e => e.split(',').map(Number));
  const vals = N <= 7 ? [1,2,3,4,5,6,7] : [1,2,3,4,5,6,7,8]; let best = null, bestScore = -1;
  (function rec(pick, used) {
    if (pick.length === N) {
      let mn = Infinity, sum = 0; for (const [a, b] of edges) { const d = dist(pick[a], pick[b]); mn = Math.min(mn, d); sum += d; }
      // every pair of regions should still be distinguishable, neighbours most of all
      let all = Infinity; for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) all = Math.min(all, dist(pick[i], pick[j]));
      const score = mn * 2 + all + sum / edges.length * .2 - (pick.includes(8) ? 30 : 0);
      if (score > bestScore) { bestScore = score; best = pick.slice(); }
      return;
    }
    for (const v of vals) if (!used.has(v)) { used.add(v); pick.push(v); rec(pick, used); pick.pop(); used.delete(v); }
  })([], new Set());
  return best;
}
const out = [];
plan.forEach((p, li) => {
  for (let seed = 1000 * (li + 1) + 1; ; seed++) {
    const rows = E.generate(p.N, seed);
    if (!rows || E.validate(rows)) continue;
    if (E.solve(rows, 2).count !== 1) continue;
    const sizes = regionSizes(rows);
    if (Math.min(...sizes) < 2 && li > 0) continue;     // no trivial 1-cell regions after L1
    if (Math.max(...sizes) > p.N * 2.2) continue;       // avoid giant blobs
    const st = E.stepSolve(rows, names, { maxTech: p.maxTech, noLookahead: true });
    if (!st.solved) continue;
    const top = Math.max(...Object.keys(st.used).map(Number));
    if (top < p.minTech) continue;
    const sol = E.solve(rows, 2).solution;
    out.push({ id: li + 1, N: p.N, label: p.label, regions: rows, solution: sol, colors: assignColours(rows), seed, maxTech: top, steps: st.log.length });
    console.log(`L${li + 1} ${p.N}x${p.N} seed ${seed} techs ${JSON.stringify(st.used)} steps ${st.log.length}`);
    console.log(rows.join('\n'));
    break;
  }
});
fs.writeFileSync(__dirname + '/../src/levels.json', JSON.stringify(out, null, 1));
