// Tagesrätsel outside the precomputed table (src/daily.json): build it off the main thread so the UI never stutters.
importScripts('engine.js', 'daily.js');
onmessage = e => { const key = e.data; try { postMessage({ key, puzzle: self.SquishDaily.puzzle(key) }); } catch (err) { postMessage({ key, error: String(err) }); } };
