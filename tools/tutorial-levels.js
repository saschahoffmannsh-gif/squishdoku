// The three hand-picked tutorial levels (found with tools/find-tutorial.js, checked by tests/levels-test.js).
// They replace the three easiest generated levels, so the game keeps 50 levels in total:
//   1–3 tutorial (4×4) → 4… = the generated ramp from its 4th level on (unchanged order and difficulty).
const TUTORIAL = [
  // L1: colour rule + hold. Region "b" is a single squish; the guide then points at each further glow.
  { id: 1, N: 4, label: 'Tutorial', regions: ['cccc', 'addd', 'addd', 'abdd'], solution: [2, 0, 3, 1], tutorial: 1, starter: 1 },
  // L2: row/column rule + swipe. Two squishes start popped so that colour + row + column suffice.
  { id: 2, N: 4, label: 'Tutorial', regions: ['bbdd', 'bbdd', 'dddc', 'aadd'], solution: [2, 0, 3, 1], prePopped: [[1, 1], [1, 2]], tutorial: 2, starter: 1 },
  // L3: no touching (diagonals too) + hearts. Not solvable without the touch rule.
  { id: 3, N: 4, label: 'Tutorial', regions: ['ccbb', 'ccdb', 'addd', 'dddd'], solution: [1, 3, 0, 2], tutorial: 3, starter: 1 },
];
const COLOURS = { 1: [1, 2, 3, 5], 2: [1, 3, 2, 8], 3: [3, 8, 1, 5] };
function applyTutorial(levels) {
  const rest = levels.filter(l => !l.tutorial);
  const ramp = rest.length === 50 ? rest.slice(3) : rest; // first run: drop the 3 easiest generated levels
  return [...TUTORIAL.map(t => ({ ...t, colors: COLOURS[t.id], score: 0 })), ...ramp.map((l, i) => ({ ...l, id: i + 4 }))];
}
module.exports = { TUTORIAL, applyTutorial };
if (require.main === module) {
  const fs = require('fs'), p = __dirname + '/../src/levels.json';
  const out = applyTutorial(JSON.parse(fs.readFileSync(p, 'utf8')));
  fs.writeFileSync(p, JSON.stringify(out, null, 1)); console.log('levels', out.length);
}
