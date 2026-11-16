// one-off search for tutorial layouts (results are pasted into tools/tutorial-levels.js)
const E = require('../src/engine.js'), T = require('../src/tutorial.js');
let seed = +process.argv[3] || 1; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
function layout(N) { // grow N regions from random seeds
  const g = Array.from({ length: N }, () => Array(N).fill(-1)); const fr = [];
  for (let k = 0; k < N; k++) { let r, c; do { r = rnd() * N | 0; c = rnd() * N | 0; } while (g[r][c] >= 0); g[r][c] = k; fr.push([r, c, k]); }
  let left = N * N - N;
  while (left) { const [r, c, k] = fr[rnd() * fr.length | 0]; const d = [[1,0],[-1,0],[0,1],[0,-1]][rnd() * 4 | 0]; const rr = r + d[0], cc = c + d[1];
    if (rr >= 0 && rr < N && cc >= 0 && cc < N && g[rr][cc] < 0) { g[rr][cc] = k; fr.push([rr, cc, k]); left--; } }
  return g.map(row => row.map(k => String.fromCharCode(97 + k)).join(''));
}
const want = +process.argv[2]; const out = [];
for (let i = 0; i < 400000 && out.length < 6; i++) {
  const N = want === 1 ? 4 : want === 2 ? (rnd() < .5 ? 4 : 5) : (rnd() < .5 ? 4 : 5); const rows = layout(N);
  if (E.validate(rows)) continue; const s = E.solve(rows, 2); if (s.count !== 1) continue;
  const lv = { id: want, N, regions: rows, solution: s.solution };
  const sizes = {}; rows.join('').split('').forEach(ch => sizes[ch] = (sizes[ch] || 0) + 1);
  const singles = Object.values(sizes).filter(v => v === 1).length;
  try {
    if (want === 1) { if (singles !== 1) continue; T.simulate(lv, { noPops: true, solutionFallback: true }); }
    if (want === 2) { if (singles !== 1) continue; const st = T.simulate(lv); const holds = st.filter(x => x.type === 'hold');
      if (holds[0].kind !== 'reg' || holds.filter(h => h.kind !== 'reg').length < 1) continue; if (st[1].type !== 'pop' || st[1].rule === 'reg') continue; }
    if (want === 3) { if (singles > 1) continue; const st = T.simulate(lv); let ok = true; try { T.simulate(lv, { rules: ['reg', 'row', 'col'] }); ok = false; } catch {} if (!ok) continue;
      if (st[0].type !== 'hold' || st[1].type !== 'pop' || st[1].rule !== 'touch' || st[1].cells.length < 2) continue; if (st.length > 22) continue; }
  } catch (e) { continue; }
  out.push(lv); console.log(JSON.stringify(lv), T.simulate(lv, want === 1 ? { noPops: true, solutionFallback: true } : {}).map(s => s.type[0] + (s.rule || s.kind || '')).join(' '));
}
