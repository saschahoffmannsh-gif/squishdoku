// SquishDoku – game rules for stars, time and the daily streak. Pure logic, no DOM: the UI (main.mjs)
// only renders what these return, so menus and dialogs can be restyled without touching the rules.
export const HEARTS = 3;
// target time per board size (seconds) for 3 stars
export const TARGET_S = { 4: 45, 5: 60, 6: 90, 7: 120, 8: 150 };
export const targetMs = N => (TARGET_S[N] || N * 20) * 1000;
// 3★ = no heart lost AND ≤ T · 2★ = no heart lost (any time) OR 1 heart lost AND ≤ 2T · 1★ = otherwise solved.
// Guided missions (L1–2): hearts only (0/1/2 lost → 3/2/1★).
export function starsFor(L, hearts, ms) {
  const lost = HEARTS - hearts; if (L.guide) return Math.max(1, 3 - lost);
  const T = targetMs(L.N); if (lost === 0 && ms <= T) return 3; if (lost === 0 || (lost <= 1 && ms <= 2 * T)) return 2; return 1;
}
export const fmtTime = ms => { const t = Math.floor(Math.max(0, ms) / 1000); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
// what is still missing for 3 stars (null when there is nothing to say)
export function missingFor3(L, hearts, ms) {
  if (L.guide) return null; const lost = HEARTS - hearts, T = targetMs(L.N), parts = [];
  if (lost) parts.push('ohne Fehler'); if (ms > T) parts.push(`unter ${fmtTime(T)}`);
  return parts.length ? parts.join(' und ') : null;
}
// level result: best stars and best time are kept independently
export function recordLevel(store, id, stars, ms) {
  const prevTime = store.times[id];
  store.stars[id] = Math.max(store.stars[id] || 0, stars); store.times[id] = Math.min(prevTime ?? Infinity, ms);
  return { prevTime, newBest: prevTime != null && ms < prevTime };
}
// streak = consecutive days with a solved daily; alive today if the last solved day is today or yesterday
export const curStreak = (D, today, addDays) => (D.last === today || D.last === addDays(today, -1) ? D.streak : 0);
export function recordDaily(D, key, { stars, ms, hearts }, today, addDays) {
  const prev = D.done[key], y = addDays(today, -1);
  D.done[key] = { stars: Math.max(prev?.stars || 0, stars), ms: Math.min(prev?.ms ?? Infinity, ms), hearts: Math.max(prev?.hearts || 0, hearts) };
  if (!prev) D.total = Math.max((D.total || 0) + 1, Object.keys(D.done).length); // solved dailies ever (done{} is pruned)
  let grew = false;
  // only today's puzzle (or yesterday's, if started before midnight) moves the streak, once per day
  if (!prev && (key === today || key === y) && (!D.last || key > D.last)) {
    D.streak = D.last === addDays(key, -1) ? D.streak + 1 : 1; D.last = key; D.best = Math.max(D.best || 0, D.streak); grew = true;
  }
  const cut = addDays(today, -120); for (const k of Object.keys(D.done)) if (k < cut) delete D.done[k]; // keep the save small
  return { prev, grew, newBest: prev != null && ms < prev.ms };
}
