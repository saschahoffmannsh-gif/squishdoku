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
// ramp rules: 50 levels, single-cell starter in L1 and L3-10, sizes never shrink, score rises (small dips allowed)
const single = l => { const m = {}; l.regions.join('').split('').forEach(ch => m[ch] = (m[ch] || 0) + 1); return Object.values(m).filter(x => x === 1).length; };
const rule = (cond, msg) => { console.log(`${cond ? 'OK  ' : 'FAIL'} ${msg}`); if (!cond) bad++; };
rule(levels.length === 50, `50 levels (${levels.length})`);
const starters = [0, 2, 6, 7, 8, 9].map(i => levels[i]);
rule(starters.every(l => single(l) === 1), 'L1, M3 (Lösungsweg) and L7-10: exactly one single-cell starter region each');
rule(single(levels[1]) === 0, 'L2 (Profi-Trick): no single-cell colour – the trick is the way in');
rule(levels.slice(10).every(l => single(l) === 0), 'L11-50: no single-cell region');
rule(levels.every((l, i) => !i || l.N >= levels[i - 1].N), 'grid size never shrinks');
rule(levels.every(l => l.N <= 8), 'max 8x8');
const plain = levels.filter(l => !l.guide);
rule(plain.every((l, i) => i < 1 || l.score >= plain[i - 1].score - 2), 'difficulty score rises over the regular levels (dips <= 2; guided missions excluded)');
// guided missions L1-2 (hand + bubble from tutorial.js), no separate tutorial any more
rule(levels.slice(0, 6).map(l => l.guide).join() === 'touch,claim,recap,shared,pair,whatif' && levels[0].N === 4 && levels.slice(1, 6).every(l => l.N === 5) && levels.slice(6).every(l => !l.guide && !l.tutorial), 'L1-6 guided strategy missions (4x4 rules, then 5x5: Reihen-Trick, Lösungsweg, Kreuzfeuer, Doppel-Trick, Was wäre wenn), L7+ regular');
const flow = (l, o) => { try { return T.simulate(l, o); } catch (e) { return null; } };
const f1 = flow(levels[0]), f2 = flow(levels[1]);
rule(f1 && f1[0].type === 'hold' && f1[1].type === 'pop' && f1[1].rule === 'touch' && !flow(levels[0], { rules: ['reg', 'row', 'col'] }), 'L1 guide: needs the no-touching rule (diagonal pop right after the first glow)');
// L2: proof that the basic rules are not enough and the "colour inside one line" step is required
const names = ['A', 'B', 'C', 'D', 'E'];
const basic = E.stepSolve(levels[1].regions, names, { maxTech: 2 }), withTrick = E.stepSolve(levels[1].regions, names, { maxTech: 3 });
rule(!basic.solved && basic.log.length === 0, `L2: basic rules (singles + eliminations) cannot make a single step (${basic.log.length} steps)`);
rule(withTrick.solved && withTrick.log[0].tech === 3 && (withTrick.used[3] || 0) >= 2 && !withTrick.used[4] && !withTrick.used[5], `L2: solved with the line trick (used ${JSON.stringify(withTrick.used)}), it is the first step, nothing harder needed`);
rule(f2 && f2[0].type === 'pop' && f2[0].rule === 'claim' && f2.filter(s => s.rule === 'claim').length >= 2 && !flow(levels[1], { rules: T.RULES.touch }), 'L2 guide: starts with the claim step, uses it twice, and gets stuck without it');
// missions 3-6: each one is solved by the guide with its rules, gets stuck without its new technique, and uses it
const PREV = { recap: 'touch', shared: 'claim', pair: 'shared', whatif: 'pair' };
for (const l of levels.slice(2, 6)) {
  const f = flow(l, { merge: true }), without = flow(l, { merge: true, rules: T.RULES[PREV[l.guide]] });
  const tech = l.guide === 'recap' ? 'claim' : l.guide, n = f ? f.filter(s => s.rule === tech).length : 0, first = f ? f.findIndex(s => s.rule === tech) : -1;
  rule(f && !without && n >= 1 && first <= 7 && f.length <= 24, `M${l.id} (${l.guide}): guide solves it in ${f && f.length} steps, '${tech}' used ${n}x (first at step ${first + 1}), stuck without it`);
}
rule(levels[2].seed === 37 && levels[2].guide === 'recap', 'M3 is the former L3 (seed 37), now with the solve path explained');
rule(levels[6].score <= 10 && levels[6].N === 5, `no jump after the missions (L7 score ${levels[6].score}, ${levels[6].N}x${levels[6].N})`);
rule(levels[10].score - levels[9].score <= 1, `no jump at L10 -> L11 (score ${levels[9].score} -> ${levels[10].score})`);
// saved progress from before the missions maps onto the new numbering
const { mapOldId } = require('../tools/missions.js');
const { mapV4 } = require('../tools/missions.js');
rule([4, 5, 6, 7, 8, 9, 12].map(mapV4).join() === '7,8,4,5,6,9,12', 'v4 save ids map: old L4-5 → L7-8, stars of dropped L6-8 → missions 4-6, L9+ same');
rule(mapOldId(1) === 0 && mapOldId(3) === 1 && mapOldId(4) === 3 && mapOldId(10) === 9 && mapOldId(11) === 11 && mapOldId(50) === 50, 'old save ids map: 1-2 dropped, 3->1, 4-10->3-9, 11+ same');
rule(levels.every(l => !l.colors.includes(6)), 'yellow (glow colour) never used as a region colour');
process.exit(bad ? 1 : 0);
