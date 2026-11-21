// Precomputes the Tagesrätsel table (src/daily.json) with exactly the code the app runs (src/daily.js),
// so phones never wait for the generator. Dates outside the table are generated on the device (worker).
//   node tools/gen-daily.js FROM TO [part parts]   (YYYY-MM-DD) -> writes /tmp/daily-part-<part>.json
//   node tools/gen-daily.js merge                   -> src/daily.json
const D = require('../src/daily.js'), fs = require('fs');
const [a, b, part = '0', parts = '1'] = process.argv.slice(2);
if (a === 'merge') {
  const all = {}; for (const f of fs.readdirSync('/tmp').filter(f => /^daily-part-\d+\.json$/.test(f))) Object.assign(all, JSON.parse(fs.readFileSync('/tmp/' + f, 'utf8')));
  const keys = Object.keys(all).sort(); const out = {}; for (const k of keys) out[k] = all[k];
  fs.writeFileSync(__dirname + '/../src/daily.json', JSON.stringify(out)); console.log(keys.length, keys[0], keys[keys.length - 1]);
} else {
  const out = {}; let n = 0;
  for (let k = a; k <= b; k = D.addDays(k, 1), n++) if (n % +parts === +part) { const p = D.puzzle(k); out[k] = { N: p.N, label: p.label, regions: p.regions, solution: p.solution, colors: p.colors, score: p.score }; }
  fs.writeFileSync(`/tmp/daily-part-${part}.json`, JSON.stringify(out)); console.log('part', part, Object.keys(out).length);
}
