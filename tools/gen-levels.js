// SquishDoku – 50-level ramp. Picks puzzles from candidate pools (tools/pool.js) so the difficulty
// rises slowly and steadily: L1–10 each have exactly one single-cell "starter" region, from L11 on
// there is none, but L11 starts as easy as L10 (a 2-cell region confined to one line opens it).
// Every level: valid regions, exactly one solution (brute force), solvable by pure logic
// (stepSolve without lookahead). Difficulty score = sum of logic steps weighted by technique
// (single 1, line/colour confinement 3, blocking 6, k-colour sets 10) + 2 per grid size above 5.
//   node tools/pool.js N from count > /tmp/pool/pN.jsonl   (for N = 5..8), then node tools/gen-levels.js
const E = require('../src/engine.js');
const fs = require('fs');
const POOL = process.env.POOL || '/tmp/pool';
const pool = {}; for (const N of [5, 6, 7, 8]) pool[N] = fs.readFileSync(`${POOL}/p${N}.jsonl`, 'utf8').trim().split('\n').map(l => JSON.parse(l));
const adj = c => c.score + (c.N - 5) * 2;
const t = (c, k) => c.used[k] || 0;
// first non-trivial step of the human solve (what the player has to see to get going)
const names = Array.from({ length: 12 }, (_, i) => 'F' + i);
function firstTech(c) { const st = E.stepSolve(c.rows, names, { noLookahead: true }); const s = st.log.find(s => s.tech !== 2); return s ? s.tech : 0; }
const BLOCKS = [
  // ids, N, adjusted-score range, filter
  { from: 1, to: 10, N: 5, lo: 6, hi: 13, label: 'Sehr leicht', ok: c => c.singles === 1 && t(c, 4) === 0 && t(c, 5) === 0 },
  { from: 11, to: 14, N: 5, lo: 13, hi: 16, label: 'Leicht', ok: c => c.minRegion === 2 && t(c, 4) === 0 && t(c, 5) === 0 },
  { from: 15, to: 20, N: 6, lo: 16, hi: 21, label: 'Leicht', ok: c => c.minRegion >= 2 && t(c, 4) === 0 && t(c, 5) === 0 },
  { from: 21, to: 27, N: 6, lo: 21, hi: 28, label: 'Mittel', ok: c => c.minRegion >= 2 && t(c, 4) >= 1 && t(c, 4) <= 2 && t(c, 5) === 0 },
  { from: 28, to: 34, N: 7, lo: 29, hi: 36, label: 'Mittel', ok: c => c.minRegion >= 2 && t(c, 4) <= 3 && t(c, 5) === 0 },
  { from: 35, to: 40, N: 7, lo: 36, hi: 43, label: 'Knifflig', ok: c => c.minRegion >= 2 && t(c, 4) <= 3 && t(c, 5) <= 1 },
  { from: 41, to: 50, N: 8, lo: 43, hi: 58, label: 'Mittelschwer', ok: c => c.minRegion >= 2 && t(c, 4) <= 4 && t(c, 5) <= 2 && c.maxRegion <= 14 },
];
// near-duplicate guard: canonical form over the 8 symmetries with regions relabelled
function canon(rows) {
  const N = rows.length, forms = [];
  for (let s = 0; s < 8; s++) {
    const g = Array.from({ length: N }, (_, r) => Array.from({ length: N }, (_, c) => {
      let rr = r, cc = c; if (s & 1) [rr, cc] = [cc, rr]; if (s & 2) rr = N - 1 - rr; if (s & 4) cc = N - 1 - cc; return rows[rr][cc];
    }));
    const m = {}; let k = 0; forms.push(g.map(row => row.map(ch => (m[ch] ??= String.fromCharCode(97 + k++))).join('')).join('/'));
  }
  return forms.sort()[0];
}
const seen = new Set(), out = [];
for (const b of BLOCKS) {
  const n = b.to - b.from + 1;
  const cands = pool[b.N].filter(c => b.ok(c) && !seen.has(canon(c.rows)));
  const pick = [];
  for (let i = 0; i < n; i++) {
    const target = b.lo + (b.hi - b.lo) * (n === 1 ? 0 : i / (n - 1));
    // the first level of the 11+ block must open with a 2-cell line region (confinement step first)
    const okHere = c => !pick.includes(c) && !seen.has(canon(c.rows)) && (b.from !== 11 || i > 0 || firstTech(c) === 3);
    let best = null, bd = Infinity;
    for (const c of cands) { if (!okHere(c)) continue; const d = Math.abs(adj(c) - target) + c.seed * 1e-7; if (d < bd) { bd = d; best = c; } }
    if (!best) throw new Error(`no candidate for L${b.from + i}`);
    pick.push(best); seen.add(canon(best.rows));
  }
  pick.sort((a, b2) => adj(a) - adj(b2) || a.seed - b2.seed);
  pick.forEach((c, i) => out.push({ ...c, id: b.from + i, label: b.label }));
}
// region colours: Squish Attack gel palette (yellow 6 is the glow colour, so it is never a region).
// 9 = the extra white gel needed for 8 regions on 8x8; orange only joins on 8x8 (it sits close to red).
const PAL = { 1: '#1f7ff0', 2: '#e8291f', 3: '#38b81c', 4: '#ff7a0c', 5: '#8a3cf0', 7: '#f0459e', 8: '#1fc9bd', 9: '#e9edf5' };
const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
function lab(h) {
  let [r, g, b] = rgb(h).map(v => { v /= 255; return v > .04045 ? ((v + .055) / 1.055) ** 2.4 : v / 12.92; });
  let x = (r * .4124 + g * .3576 + b * .1805) / .95047, y = r * .2126 + g * .7152 + b * .0722, z = (r * .0193 + g * .1192 + b * .9505) / 1.08883;
  const f = t => t > .008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}
const dist = (a, b) => { const A = lab(PAL[a]), B = lab(PAL[b]); return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]); };
function assignColours(rows) {
  const N = rows.length, adjSet = new Set();
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
    const rr = r + dr, cc = c + dc; if (rr >= N || cc < 0 || cc >= N) continue;
    const a = rows[r].charCodeAt(c) - 97, b = rows[rr].charCodeAt(cc) - 97; if (a !== b) adjSet.add(Math.min(a, b) + ',' + Math.max(a, b));
  }
  const edges = [...adjSet].map(e => e.split(',').map(Number));
  const vals = N <= 6 ? [1, 2, 3, 5, 7, 8] : N === 7 ? [1, 2, 3, 5, 7, 8, 9] : [1, 2, 3, 4, 5, 7, 8, 9];
  let best = null, bestScore = -1;
  (function rec(pick, used) {
    if (pick.length === N) {
      let mn = Infinity, sum = 0; for (const [a, b] of edges) { const d = dist(pick[a], pick[b]); mn = Math.min(mn, d); sum += d; }
      const score = mn * 2 + sum / edges.length * .2;
      if (score > bestScore) { bestScore = score; best = pick.slice(); }
      return;
    }
    for (const v of vals) if (!used.has(v)) { used.add(v); pick.push(v); rec(pick, used); pick.pop(); used.delete(v); }
  })([], new Set());
  return best;
}
const levels = out.map(c => ({ id: c.id, N: c.N, label: c.label, regions: c.rows, solution: c.solution, colors: assignColours(c.rows), seed: c.seed, maxTech: c.maxTech, steps: c.steps, score: adj(c), used: c.used, firstTech: firstTech(c), starter: c.singles }));
for (const l of levels) console.log(`L${String(l.id).padStart(2)} ${l.N}x${l.N} score ${String(l.score).padStart(2)} first ${l.firstTech} techs ${JSON.stringify(l.used)} starter ${l.starter} ${l.label}`);
// levels 1–2 are the hand-made guided missions (tools/missions.js); they replace the 3 easiest generated levels, plus one extra starter level at L10
fs.writeFileSync(__dirname + '/../src/levels.json', JSON.stringify(require('./missions.js').applyMissions(levels), null, 1));
