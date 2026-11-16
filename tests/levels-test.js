// Verifies every level: valid regions, exactly one solution, solvable by pure logic (no lookahead).
const E = require('../src/engine.js');
const levels = require('../src/levels.json');
let bad = 0;
for (const l of levels) {
  const v = E.validate(l.regions), sol = E.solve(l.regions, 5);
  const st = E.stepSolve(l.regions, Array.from({ length: 9 }, (_, i) => 'F' + i), { noLookahead: true });
  const logicSol = st.solved ? st.marks.map(r => r.indexOf(2)) : null;
  const colours = new Set(l.colors).size === l.N;
  const pass = !v && sol.count === 1 && st.solved && JSON.stringify(logicSol) === JSON.stringify(l.solution) && JSON.stringify(sol.solution) === JSON.stringify(l.solution) && colours;
  console.log(`L${l.id} ${l.N}x${l.N}: regions ${v || 'ok'}, solutions ${sol.count}, logic-solvable ${st.solved} (${st.log.length} steps, techniques ${JSON.stringify(st.used)}), colours ${l.colors.join(',')} -> ${pass ? 'OK' : 'FAIL'}`);
  if (!pass) bad++;
}
process.exit(bad ? 1 : 0);
