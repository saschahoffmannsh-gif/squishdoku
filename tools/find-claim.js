// Search for the guided level 2 (5x5): unique, logic-solvable, and it NEEDS the "colour inside one
// row/column claims that line" step (engine technique 3): basic rules alone (singles + eliminations,
// techniques 1–2) get stuck, techniques 1–3 solve it, nothing harder is needed. The guided flow in
// src/tutorial.js must solve it with the claim rule and get stuck without it.
// Usage: node tools/find-claim.js [seed]
const E = require('../src/engine.js'), T = require('../src/tutorial.js');
let seed = +process.argv[2] || 7; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
function layout(N) {
  const g = Array.from({ length: N }, () => Array(N).fill(-1)); const fr = [];
  for (let k = 0; k < N; k++) { let r, c; do { r = rnd() * N | 0; c = rnd() * N | 0; } while (g[r][c] >= 0); g[r][c] = k; fr.push([r, c, k]); }
  let left = N * N - N;
  while (left) { const [r, c, k] = fr[rnd() * fr.length | 0]; const d = [[1, 0], [-1, 0], [0, 1], [0, -1]][rnd() * 4 | 0]; const rr = r + d[0], cc = c + d[1];
    if (rr >= 0 && rr < N && cc >= 0 && cc < N && g[rr][cc] < 0) { g[rr][cc] = k; fr.push([rr, cc, k]); left--; } }
  return g.map(row => row.map(k => String.fromCharCode(97 + k)).join(''));
}
const names = ['A', 'B', 'C', 'D', 'E'];
const out = [];
for (let i = 0; i < 2e6 && out.length < 8; i++) {
  const N = 5, rows = layout(N);
  if (E.validate(rows)) continue;
  const s = E.solve(rows, 2); if (s.count !== 1) continue;
  const sizes = {}; rows.join('').split('').forEach(ch => sizes[ch] = (sizes[ch] || 0) + 1);
  if (Object.values(sizes).some(v => v === 1)) continue;          // no single-cell colour: the trick is the way in
  const basic = E.stepSolve(rows, names, { maxTech: 2 }); if (basic.solved) continue;
  const full = E.stepSolve(rows, names, { maxTech: 3 }); if (!full.solved) continue;
  const first = full.log[0]; if (first.tech !== 3 || !/hat nur noch Platz/.test(first.text)) continue; // starts with colour→line
  const lv = { id: 2, N, regions: rows, solution: s.solution, guide: 'claim' };
  let st; try { st = T.simulate(lv); } catch { continue; }
  try { T.simulate(lv, { rules: T.RULES.touch }); continue; } catch {}
  if (st[0].type !== 'pop' || st[0].rule !== 'claim' || st[0].area.length < 2 || st[0].cells.length < 2) continue;
  const claims = st.filter(x => x.rule === 'claim').length;
  if (st.length > 26) continue;
  out.push(lv);
  console.log(JSON.stringify({ rows, sol: s.solution, used: full.used, claims, steps: st.length }), st.map(x => x.type[0] + (x.rule || x.kind || '')).join(' '));
}
