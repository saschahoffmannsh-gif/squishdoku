// Mission levels 1–2 (hand-made, guided by the hand + bubble) and the place of the generated ramp.
//   L1  "Anleitung": all rules, above all "Leuchter berühren sich nie" + hearts (the former tutorial L3, 4×4)
//   L2  "Profi-Trick": a colour lying inside ONE row claims that row (found with tools/find-claim.js;
//       basic rules alone cannot make a single step, tests/levels-test.js proves it)
//   L3–L9   = generated ramp L4–L10 (single-cell starter colour)
//   L10     = one more starter level (pool seed 108, score 14 like its neighbours)
//   L11–L50 = generated ramp L11–L50 (unchanged)
const GUIDED = [
  { id: 1, N: 4, label: 'Mit Anleitung', regions: ['ccbb', 'ccdb', 'addd', 'dddd'], solution: [1, 3, 0, 2], guide: 'touch', starter: 1, colors: [3, 8, 1, 5], score: 0 },
  { id: 2, N: 5, label: 'Mit Anleitung', regions: ['eeeaa', 'cbbaa', 'ccbdd', 'cccdd', 'cccdd'], solution: [1, 4, 2, 0, 3], guide: 'claim', colors: [2, 3, 1, 8, 5], score: 11 },
];
const EXTRA_L10 = { N: 5, label: 'Sehr leicht', regions: ['abbbb', 'aabbb', 'aaccd', 'aaccd', 'eccdd'], solution: [3, 1, 4, 2, 0], colors: [1, 2, 3, 5, 8], seed: 108, maxTech: 3, steps: 8, score: 14, used: { 1: 5, 2: 4, 3: 3 }, firstTech: 1, starter: 1 };
// ramp: the generated levels without the guided ones. 50 fresh from tools/gen-levels.js → drop the 3 easiest.
function applyMissions(levels) {
  let ramp = levels.filter(l => !l.tutorial && !l.guide && l.seed !== EXTRA_L10.seed);
  if (ramp.length === 50) ramp = ramp.slice(3);
  if (ramp.length !== 47) throw new Error('expected 47 generated levels, got ' + ramp.length);
  const out = [...GUIDED, ...ramp.slice(0, 7), EXTRA_L10, ...ramp.slice(7)];
  return out.map((l, i) => { const { tutorial, prePopped, ...rest } = l; return { ...rest, id: i + 1 }; });
}
// saved progress before the missions (store without v): old 1–2 tutorial dropped, old 3 → 1, old 4–10 → 3–9, 11+ unchanged
const mapOldId = id => id <= 2 ? 0 : id === 3 ? 1 : id <= 10 ? id - 1 : id;
module.exports = { GUIDED, EXTRA_L10, applyMissions, mapOldId };
if (require.main === module) {
  const fs = require('fs'), p = __dirname + '/../src/levels.json';
  const out = applyMissions(JSON.parse(fs.readFileSync(p, 'utf8')));
  fs.writeFileSync(p, JSON.stringify(out, null, 1)); console.log('levels', out.length);
}
