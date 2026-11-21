// SquishDoku haptics: short vibration patterns for the game's moments.
// Web: navigator.vibrate (Android Chrome & co.). iOS Safari has no vibrate API -> silently nothing.
// Native shell (future, see native/haptics-bridge.mjs): if window.SquishNative.haptic exists, it gets the
// moment name instead ('tap' | 'pop' | 'light' | 'wrong' | 'win' | 'undo') and plays real Taptic patterns.
// Respects the in-game vibration toggle (store.settings.vibration).
export const PATTERNS = {
  tap: [6], pop: [9], light: [14, 40, 22], wrong: [40, 60, 40], win: [20, 50, 20, 50, 70], undo: [8, 30, 8],
};
// names used by the vendored Squish Attack modules (ad dialog) -> our moments
const ALIAS = { move: 'pop', merge: 'light', big: 'win' };
const RANK = { tap: 0, undo: 0, pop: 1, light: 2, wrong: 3, win: 3 };
export function createSdHaptics({ isEnabled = () => true } = {}) {
  const native = () => globalThis.SquishNative?.haptic;
  const vib = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function' ? navigator.vibrate.bind(navigator) : null;
  let lastAt = -1e9, lastRank = -1;
  const api = {
    PATTERNS,
    get supported() { return !!(native() || vib); },
    pulse(kind = 'tap') {
      kind = ALIAS[kind] || kind; if (!(kind in PATTERNS) || !isEnabled()) return false;
      const now = performance.now(), rank = RANK[kind];
      // one pattern at a time; only a stronger one may cut in (a swipe pops many squishes fast)
      if (now - lastAt < (rank > lastRank ? 40 : 90)) return false;
      lastAt = now; lastRank = rank;
      try { const n = native(); if (n) { n(kind); return true; } if (vib) { vib(PATTERNS[kind]); return true; } } catch {}
      return false;
    },
    prime() {},
  };
  return api;
}
