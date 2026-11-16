// Verifies every level: valid regions, exactly one solution, solvable by pure logic (no lookahead).
const E = require('../src/engine.js');
const levels = require('../src/levels.json');
const T = require('../src/tutorial.js');
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
// ramp rules: 50 levels, single-cell starter exactly in L1-10, sizes never shrink, score rises (small dips allowed)
const single = l => { const m = {}; l.regions.join('').split('').forEach(ch => m[ch] = (m[ch] || 0) + 1); return Object.values(m).filter(x => x === 1).length; };
const rule = (cond, msg) => { console.log(`${cond ? 'OK  ' : 'FAIL'} ${msg}`); if (!cond) bad++; };
rule(levels.length === 50, `50 levels (${levels.length})`);
rule(levels.slice(0, 10).every(l => single(l) === 1), 'L1-10 (tutorial + L4-10): exactly one single-cell starter region each');
rule(levels.slice(10).every(l => single(l) === 0), 'L11-50: no single-cell region');
rule(levels.every((l, i) => !i || l.N >= levels[i - 1].N), 'grid size never shrinks');
rule(levels.every(l => l.N <= 8), 'max 8x8');
rule(levels.every((l, i) => !i || l.score >= levels[i - 1].score - 2), 'difficulty score rises (dips <= 2)');
// tutorial (L1-3): tiny boards, one new rule each, and the guided flow (tutorial.js) plays them to the end
rule(levels.slice(0, 3).every((l, i) => l.tutorial === i + 1 && l.N === 4) && levels.slice(3).every(l => !l.tutorial), 'L1-3 are the 4x4 tutorial, L4+ regular');
const flow = (l, o) => { try { return T.simulate(l, o); } catch (e) { return null; } };
const f1 = flow(levels[0], { noPops: true, solutionFallback: true }), f2 = flow(levels[1]), f3 = flow(levels[2]);
rule(f1 && f1[0].type === 'hold' && f1[0].kind === 'reg', 'L1 guide: starts with the single-squish colour, then points at each glow');
rule(f2 && f2[0].kind === 'reg' && f2[1].type === 'pop' && ['row', 'col'].includes(f2[1].rule) && f2.some(s => s.kind === 'row' || s.kind === 'col'), 'L2 guide: colour + row/column rule alone solve it (swipe steps + row/col forced glow)');
rule(levels[1].prePopped.every(([r, c]) => levels[1].solution[r] !== c), 'L2 pre-popped squishes are never solution squishes');
rule(f3 && f3[1].type === 'pop' && f3[1].rule === 'touch' && !flow(levels[2], { rules: ['reg', 'row', 'col'] }), 'L3 guide: needs the no-touching rule (diagonal pop first)');
rule(levels[3].score <= 10 && levels[3].N === 5, `no jump after the tutorial (L4 score ${levels[3].score}, ${levels[3].N}x${levels[3].N})`);
rule(levels[10].score - levels[9].score <= 1, `no jump at L10 -> L11 (score ${levels[9].score} -> ${levels[10].score})`);
rule(levels.every(l => !l.colors.includes(6)), 'yellow (glow colour) never used as a region colour');
process.exit(bad ? 1 : 0);
