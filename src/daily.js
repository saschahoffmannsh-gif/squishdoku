// SquishDoku – Tagesrätsel: one puzzle per calendar day (Europe/Berlin), the same for everybody,
// generated on the device from the date: seeded engine.generate -> exactly one solution (brute force)
// -> solvable by pure logic (stepSolve, no lookahead) -> difficulty score inside the weekday's band.
// Seeds are tried in a fixed order, so the result depends only on the date. Works in browser and node.
(function (root) {
  const E = root.SquishEngine || (typeof require !== 'undefined' ? require('./engine.js') : null);
  const TZ = 'Europe/Berlin';
  // date key "YYYY-MM-DD" of the Berlin calendar day
  function dateKey(d = new Date()) {
    const p = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
    const g = t => p.find(x => x.type === t).value; return `${g('year')}-${g('month')}-${g('day')}`;
  }
  const dayNum = key => { const [y, m, d] = key.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 864e5); };
  const keyOfDay = n => new Date(n * 864e5).toISOString().slice(0, 10);
  const addDays = (key, k) => keyOfDay(dayNum(key) + k);
  const weekday = key => (new Date(dayNum(key) * 864e5).getUTCDay() + 6) % 7; // 0 = Monday … 6 = Sunday
  // weekday ramp (adjusted score = technique-weighted logic steps + 2 per size above 5, as tools/gen-levels.js)
  const PLAN = [
    { N: 5, lo: 11, hi: 16, label: 'Leicht' },        // Mo
    { N: 6, lo: 16, hi: 22, label: 'Leicht' },        // Di
    { N: 6, lo: 20, hi: 28, label: 'Mittel' },        // Mi
    { N: 7, lo: 24, hi: 34, label: 'Mittel' },        // Do
    { N: 7, lo: 30, hi: 38, label: 'Mittel' },        // Fr
    { N: 7, lo: 34, hi: 43, label: 'Knifflig' },      // Sa
    { N: 8, lo: 40, hi: 52, label: 'Knifflig' },      // So
  ];
  const W = { 1: 1, 3: 3, 4: 6, 5: 10 };
  const names = Array.from({ length: 12 }, (_, i) => 'F' + i);
  function hash(str) { let h = 2166136261 >>> 0; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
  function rate(rows) {
    if (!rows || E.validate(rows)) return null;
    const sol = E.solve(rows, 2); if (sol.count !== 1) return null;
    const st = E.stepSolve(rows, names, { noLookahead: true }); if (!st.solved) return null;
    let score = 0; for (const s of st.log) if (s.tech !== 2) score += W[s.tech] || 0;
    const sizes = {}; rows.join('').split('').forEach(ch => sizes[ch] = (sizes[ch] || 0) + 1);
    const sz = Object.values(sizes);
    return { solution: sol.solution, used: st.used, score: score + (rows.length - 5) * 2, minRegion: Math.min(...sz), maxRegion: Math.max(...sz) };
  }
  // region colours: same palette and contrast rule as the level ramp
  const PAL = { 1: '#1f7ff0', 2: '#e8291f', 3: '#38b81c', 4: '#ff7a0c', 5: '#8a3cf0', 7: '#f0459e', 8: '#1fc9bd', 9: '#e9edf5' };
  function lab(h) {
    let [r, g, b] = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)).map(v => { v /= 255; return v > .04045 ? ((v + .055) / 1.055) ** 2.4 : v / 12.92; });
    const x = (r * .4124 + g * .3576 + b * .1805) / .95047, y = r * .2126 + g * .7152 + b * .0722, z = (r * .0193 + g * .1192 + b * .9505) / 1.08883;
    const f = t => t > .008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116; return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
  }
  const LAB = {}; for (const k in PAL) LAB[k] = lab(PAL[k]);
  const dist = (a, b) => { const A = LAB[a], B = LAB[b]; return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]); };
  function assignColours(rows) {
    const N = rows.length, adj = new Set();
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
      const rr = r + dr, cc = c + dc; if (rr >= N || cc < 0 || cc >= N) continue;
      const a = rows[r].charCodeAt(c) - 97, b = rows[rr].charCodeAt(cc) - 97; if (a !== b) adj.add(Math.min(a, b) * 16 + Math.max(a, b));
    }
    const edges = [...adj].map(e => [e >> 4, e & 15]);
    const vals = N <= 6 ? [1, 2, 3, 5, 7, 8] : N === 7 ? [1, 2, 3, 5, 7, 8, 9] : [1, 2, 3, 4, 5, 7, 8, 9];
    let best = null, bestScore = -1;
    (function rec(pick, used) {
      if (pick.length === N) {
        let mn = Infinity, sum = 0; for (const [a, b] of edges) { const d = dist(pick[a], pick[b]); if (d < mn) mn = d; sum += d; }
        const score = mn * 2 + sum / edges.length * .2; if (score > bestScore) { bestScore = score; best = pick.slice(); } return;
      }
      for (const v of vals) if (!used.has(v)) { used.add(v); pick.push(v); rec(pick, used); pick.pop(); used.delete(v); }
    })([], new Set());
    return best;
  }
  const cache = new Map();
  function puzzle(key) {
    if (cache.has(key)) return cache.get(key);
    const plan = PLAN[weekday(key)], N = plan.N, base = hash('squishdoku-daily-' + key) % 1e9;
    let pick = null, fallback = null, fd = Infinity;
    for (let i = 0; i < 600 && !pick; i++) {
      const seed = base + i * 7919, rows = E.generate(N, seed), r = rate(rows); if (!r) continue;
      const okShape = r.minRegion >= 2 && (r.used[5] || 0) <= (N >= 8 ? 2 : 1) && r.maxRegion <= (N >= 8 ? 14 : 12);
      if (okShape && r.score >= plan.lo && r.score <= plan.hi) pick = { rows, seed, ...r };
      else if (okShape) { const d = r.score < plan.lo ? plan.lo - r.score : r.score - plan.hi; if (d < fd) { fd = d; fallback = { rows, seed, ...r }; } }
    }
    pick = pick || fallback;
    const out = { id: 'daily', daily: key, N, label: plan.label, regions: pick.rows, solution: pick.solution, colors: assignColours(pick.rows), seed: pick.seed, score: pick.score };
    cache.set(key, out); return out;
  }
  const api = { dateKey, addDays, weekday, dayNum, puzzle, PLAN };
  if (typeof module !== 'undefined') module.exports = api; else root.SquishDaily = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
