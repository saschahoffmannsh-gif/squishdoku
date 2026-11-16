// Candidate pool for the level ramp: node tools/pool.js N fromSeed count > pool-N.jsonl
const E = require('../src/engine.js');
const [N, from, count] = process.argv.slice(2).map(Number);
const names = Array.from({ length: 12 }, (_, i) => 'F' + i);
const W = { 1: 1, 3: 3, 4: 6, 5: 10 };
for (let seed = from; seed < from + count; seed++) {
  const rows = E.generate(N, seed);
  if (!rows || E.validate(rows)) continue;
  const sol = E.solve(rows, 2); if (sol.count !== 1) continue;
  const st = E.stepSolve(rows, names, { noLookahead: true });
  if (!st.solved) continue;
  const sizes = {}; rows.join('').split('').forEach(ch => sizes[ch] = (sizes[ch] || 0) + 1);
  const sz = Object.values(sizes);
  let score = 0; const seq = [];
  for (const s of st.log) { if (s.tech === 2) continue; score += W[s.tech] || 0; seq.push(s.tech); }
  // how long until the first non-trivial step, and how many hard steps
  const used = st.used; const maxTech = Math.max(...seq);
  process.stdout.write(JSON.stringify({ N, seed, rows, solution: sol.solution, used, maxTech, score, steps: seq.length, minRegion: Math.min(...sz), maxRegion: Math.max(...sz), singles: sz.filter(x => x === 1).length }) + '\n');
}
