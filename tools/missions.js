// Mission levels 1–6: a strategy curriculum, each guided by the hand + bubble (src/tutorial.js), one new
// technique per mission (found with tools/find-claim.js / tools/find-lessons.js; tests/levels-test.js proves
// each mission gets stuck without its technique):
//   M1 touch  "Anleitung": all rules – Einzel-Keks halten, Nachbarn/Reihe/Spalte/Farbe weg, letzter Keks (4×4)
//   M2 claim  "Reihen-Trick": a colour lying inside ONE row/column claims that line
//   M3 recap  "Lösungsweg": the former L3 (seed 37), everything so far step by step on 5×5
//   M4 shared "Fremder Keks": a squish every remaining squish of a colour sees (row, column, touch) goes
//   M5 pair   "Doppel-Trick": two colours inside the same two rows/columns own them → the rest there goes
//   M6 whatif "Was wäre wenn": a squish whose glow would wipe out a whole colour/row/column goes
//   L7–L9   = generated ramp L4, L5, L9 (single-cell starter colour; ramp L6–L8 dropped for the missions)
//   L10     = one more starter level (pool seed 108, score 14 like its neighbours)
//   L11–L50 = generated ramp L11–L50 (unchanged)
const GUIDED = [
  { id: 1, N: 4, label: 'Mit Anleitung', regions: ['ccbb', 'ccdb', 'addd', 'dddd'], solution: [1, 3, 0, 2], guide: 'touch', starter: 1, colors: [3, 8, 1, 5], score: 0 },
  { id: 2, N: 5, label: 'Mit Anleitung', regions: ['eeeaa', 'cbbaa', 'ccbdd', 'cccdd', 'cccdd'], solution: [1, 4, 2, 0, 3], guide: 'claim', colors: [2, 3, 1, 8, 5], score: 11 },
];
const RECAP_SEED = 37; // ramp[0], becomes the guided M3
const LESSONS = [
  { N: 5, label: 'Mit Anleitung', regions: ['cccca', 'dcdba', 'dddbe', 'ddbbe', 'ddeee'], solution: [4, 1, 3, 0, 2], guide: 'shared', colors: [5, 2, 3, 1, 8], score: 11 },
  { N: 5, label: 'Mit Anleitung', regions: ['aaddd', 'aaddd', 'aaedd', 'cceeb', 'cceeb'], solution: [3, 0, 2, 4, 1], guide: 'pair', colors: [2, 8, 3, 5, 1], score: 12 },
  { N: 5, label: 'Mit Anleitung', regions: ['badcc', 'baddd', 'baddd', 'badde', 'badde'], solution: [3, 0, 2, 4, 1], guide: 'whatif', colors: [3, 1, 5, 2, 8], score: 14 },
];
const EXTRA_L10 = { N: 5, label: 'Sehr leicht', regions: ['abbbb', 'aabbb', 'aaccd', 'aaccd', 'eccdd'], solution: [3, 1, 4, 2, 0], colors: [1, 2, 3, 5, 8], seed: 108, maxTech: 3, steps: 8, score: 14, used: { 1: 5, 2: 4, 3: 3 }, firstTech: 1, starter: 1 };
// ramp: the generated levels without the guided ones. 50 fresh from tools/gen-levels.js → drop the 3 easiest.
function applyMissions(levels) {
  if (levels.some(l => l.guide === 'whatif')) return levels; // already applied
  let ramp = levels.filter(l => !l.tutorial && (!l.guide || l.guide === 'recap') && l.seed !== EXTRA_L10.seed).map(({ guide, ...l }) => l);
  if (ramp.length === 50) ramp = ramp.slice(3);
  if (ramp.length !== 47) throw new Error('expected 47 generated levels, got ' + ramp.length);
  if (ramp[0].seed !== RECAP_SEED) throw new Error('ramp[0] should be seed ' + RECAP_SEED);
  const out = [...GUIDED, { ...ramp[0], label: 'Mit Anleitung', guide: 'recap' }, ...LESSONS, ramp[1], ramp[2], ramp[6], EXTRA_L10, ...ramp.slice(7)];
  return out.map((l, i) => { const { tutorial, prePopped, ...rest } = l; return { ...rest, id: i + 1 }; });
}
// saved progress before the missions (store without v): old 1–2 tutorial dropped, old 3 → 1, old 4–10 → 3–9, 11+ unchanged
const mapOldId = id => id <= 2 ? 0 : id === 3 ? 1 : id <= 10 ? id - 1 : id;
// saves from before the strategy missions (store v<4): old L4 → L7, L5 → L8; the stars of the dropped
// old L6–8 count for the missions M4–6 that now sit there (their best times are dropped); L9+ unchanged
const mapV4 = id => ({ 4: 7, 5: 8, 6: 4, 7: 5, 8: 6 })[id] || id;
module.exports = { GUIDED, LESSONS, EXTRA_L10, applyMissions, mapOldId, mapV4 };
if (require.main === module) {
  const fs = require('fs'), p = __dirname + '/../src/levels.json';
  const out = applyMissions(JSON.parse(fs.readFileSync(p, 'utf8')));
  fs.writeFileSync(p, JSON.stringify(out, null, 1)); console.log('levels', out.length);
}
