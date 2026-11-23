// Search for the guided strategy missions (M4 shared, M5 pair, M6 whatif): unique, solved by the guided flow
// with the mission's rules, STUCK without its new technique (so the technique is genuinely needed), the new
// technique used early, few steps. Usage: node tools/find-lessons.js <shared|pair|whatif> [N] [seed] [count]
const E = require('../src/engine.js'), T = require('../src/tutorial.js');
const want = process.argv[2], N = +process.argv[3] || 5; let seed = +process.argv[4] || 11; const COUNT = +process.argv[5] || 6;
const rnd = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
function layout(N) {
  const g = Array.from({ length: N }, () => Array(N).fill(-1)); const fr = [];
  for (let k = 0; k < N; k++) { let r, c; do { r = rnd() * N | 0; c = rnd() * N | 0; } while (g[r][c] >= 0); g[r][c] = k; fr.push([r, c, k]); }
  let left = N * N - N;
  while (left) { const [r, c, k] = fr[rnd() * fr.length | 0]; const d = [[1, 0], [-1, 0], [0, 1], [0, -1]][rnd() * 4 | 0]; const rr = r + d[0], cc = c + d[1];
    if (rr >= 0 && rr < N && cc >= 0 && cc < N && g[rr][cc] < 0) { g[rr][cc] = k; fr.push([rr, cc, k]); left--; } }
  return g.map(row => row.map(k => String.fromCharCode(97 + k)).join(''));
}
const prev = { shared: 'claim', pair: 'shared', whatif: 'pair' }[want];
const code = s => s.map(x => x.type[0] + (x.rule || x.kind || '')).join(' ');
let found = 0;
for (let i = 0; i < 3e6 && found < COUNT; i++) {
  const rows = layout(N); if (E.validate(rows)) continue;
  const s = E.solve(rows, 2); if (s.count !== 1) continue;
  const lv = { N, regions: rows, solution: s.solution, guide: want };
  let st; try { st = T.simulate(lv, { merge: true }); } catch { continue; }
  try { T.simulate(lv, { merge: true, rules: T.RULES[prev] }); continue; } catch {}
  const uses = st.filter(x => x.rule === want); if (!uses.length) continue;
  const first = st.findIndex(x => x.rule === want); if (first > (+process.env.FIRST || 6)) continue;
  if (st.length > (+process.env.STEPS || 24)) continue;
  // the lesson step should be clear: a few cells for shared/pair, exactly one for whatif
  if (want !== 'whatif' && uses[0].cells.length < 2) continue;
  found++;
  console.log(JSON.stringify({ N, regions: rows, solution: s.solution }), 'first@' + first, 'uses', uses.length, 'steps', st.length, '|', code(st));
}
