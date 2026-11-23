// Interstitial rhythm by level number: none before level 5, then after 5, 8, 11, 14 … (also on replays),
// never due from the daily puzzle, nothing when ad-free; shown only at the start of the next round.
(async () => {
  const { adAfterLevel, createAdRhythm } = await import('../src/ad-rhythm.mjs');
  let bad = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) bad++; };
  const store = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };
  const due = Array.from({ length: 50 }, (_, i) => i + 1).filter(adAfterLevel);
  ok(due.join() === '5,8,11,14,17,20,23,26,29,32,35,38,41,44,47,50', `due after levels ${due.join(', ')}`);
  ok(!adAfterLevel(null) && !adAfterLevel('daily') && !adAfterLevel(4) && !adAfterLevel(0), 'never due from the daily puzzle or before level 5');
  const st = store(), a = createAdRhythm({ storage: st }), shown = [];
  for (const id of [1, 2, 3, 4, 5, 6, 7, 8, null, 9, 10, 11, 11, 12]) { a.levelWon(id, id === null || id > 6); if (a.takeInterstitial()) shown.push(id ?? 'daily'); }
  ok(shown.join() === '5,8,11,11', `played 1–12 (+ daily, replay of 11): interstitial after ${shown.join(', ')}`);
  ok(a.wins === 8, `wins count regular levels + daily, not missions (${a.wins})`);
  const b = createAdRhythm({ storage: st }); b.levelWon(14); ok(createAdRhythm({ storage: st }).interstitialDue, 'due flag survives a reload');
  const f = createAdRhythm({ storage: store(), isAdFree: () => true }); f.levelWon(5); ok(!f.interstitialDue && !f.takeInterstitial(), 'ad-free: never due');
  process.exit(bad ? 1 : 0);
})();
