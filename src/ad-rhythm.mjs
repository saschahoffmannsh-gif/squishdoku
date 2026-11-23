// SquishDoku – Werbe-Takt nach Levelnummer (ersetzt den „jede 5. gewonnene Runde“-Zähler von Squish Attack):
//  • keine Zwischenwerbung vor Level 5; fällig nach dem Sieg in Level 5, 8, 11, 14, … (5 + 3·k) –
//    an der Levelnummer festgemacht, also auch bei Wiederholungen gleich und vorhersehbar;
//  • gezeigt wird sie erst beim Start der nächsten Runde, nie mitten im Level und nie in einer Mission mit
//    Anleitung (Level 1–6): die nach Level 5 fällige Werbung kommt vor dem nächsten normalen Level/Tagesrätsel;
//  • das Tagesrätsel hat keine Levelnummer und macht keine Werbung fällig (eine schon fällige kommt aber davor);
//  • „Tipp per Werbung“ (freiwillig, belohnt) ist davon unberührt.
// Gleicher Speicher-Schlüssel und gleiche Schnittstelle (wins, interstitialDue, takeInterstitial) wie vorher.
export const AD_FIRST_LEVEL = 5, AD_EVERY = 3;
export const adAfterLevel = id => Number.isInteger(id) && id >= AD_FIRST_LEVEL && (id - AD_FIRST_LEVEL) % AD_EVERY === 0;
export function createAdRhythm({ storage = globalThis.localStorage, isAdFree = () => false } = {}) {
  const KEY = 'squishdoku-ad-pacing-v1', free = () => { try { return !!isAdFree(); } catch { return false; } };
  let state = { wins: 0, due: false };
  try { const s = JSON.parse(storage?.getItem(KEY) || 'null'); if (s && Number.isInteger(s.wins)) state = { ...s, wins: Math.max(0, s.wins), due: !!s.due }; } catch {}
  const save = () => { try { storage?.setItem(KEY, JSON.stringify(state)); } catch {} };
  return {
    /** A round was won: id = level number (missions included), or a non-number for the daily puzzle;
     *  count=false: not counted in `wins` (missions). */
    levelWon(id, count = true) { if (count) state.wins++; if (!free() && adAfterLevel(id)) state.due = true; save(); return !free() && state.due; },
    get interstitialDue() { return !free() && state.due; },
    /** Before a (non-mission) round starts: true = show it now (and clear the flag). */
    takeInterstitial() { if (free()) { if (state.due) { state.due = false; save(); } return false; } if (!state.due) return false; state.due = false; save(); return true; },
    get wins() { return state.wins; },
  };
}
