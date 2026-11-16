# Reused from Squish Attack

Source: `saschahoffmannsh-gif/squish-attack`, commit `9a61cc9` (branch `launch-26`,
local worktree `/workspace/squish-l26`) – the current live look (comic gel squishes, "Stil C").
Files are copied unchanged into `vendor/squish-attack/` with the original folder layout
(`game/…`, `squish/…`) so their relative imports keep working.

| What | Files |
|---|---|
| Current squish look (gel model + comic cel shading, ink outline, highlight) | `squish/squish-graphics.js` (three.js bundle + SDK), `game/original-gel-models.js`, `game/comic-style.mjs`, `game/gel-lighting.mjs`, `game/gel-softness.mjs`, `game/special-squish.mjs` |
| Glass table and camera view 1:1 (chrome frame, glass reflections, contact shadows, Squish Attack's tilted camera from `PARAMETERS.camera` + `fitStoneBoard`; only the grid is re-laid out N×N on the same 5×5 footprint) | `game/clean-screen.mjs`, `game/chrome-frame.mjs`, `game/glass-reflections.mjs`, `game/glass-shadows.mjs`, `game/pressure-contact.mjs`, `game/pressure-wave.mjs`, `game/dense-contacts.mjs`, `game/render-quality.mjs` |
| Pop animation (comic balloon pop: torn skin, gel drops, burst/spark/ring) | `game/fusion.mjs` (`popBody`), `game/fusion-core.mjs`, `game/fusion-worker.mjs` |
| Swipe reaction / wobble | press/drag/release/wobble springs of `squish-graphics.js` (`Vh/Gh/Wh/bl`, re-stated in `src/board3d.mjs`) driving `updateSquishy` from `original-gel-models.js` |
| Sounds | `game/sound.mjs`, `game/assets/audio/` (plop, suction, slide, burst – CC0, see CREDITS.txt), `game/haptics.mjs` |
| Menus / UI style | `game/autumn-ui.css`, `game/comic-ui.css`, `game/aw-icons.mjs`, `game/home-menu.mjs` (backdrop), `game/confetti.mjs`, fonts (Fredoka, Lilita One, OFL) |
| Support | `game/flags.mjs`, `game/i18n.mjs`, `game/locales.mjs`, `game/fit-labels.mjs` |

Only change in the copies: `glass-reflections.mjs` / `glass-shadows.mjs` default capacity 29 → 64
(Squish Attack only ever shows 25 board squishes; a 7×7 SquishDoku board has 49).
`assets/specials/` keeps only the two textures `special-squish.mjs` fetches at import.

Engine (solver, unique-puzzle generator, human-style logic step solver) comes from the
GlowDoku prototype `/workspace/glowdoku/engine.js` → `src/engine.js`.

`sound.mjs`: optionale `detune`-Option für `play('pop',…)` (jeder Pop eines Wischers klingt leicht anders).
Kein Ladering; geplatzte Squishs hinterlassen nichts (leeres Glas); Glas-Reflexe folgen dem aktuellen Zustand (Leuchten = Gold).
`comic-style.mjs`: zusätzliche weiße Gel-Farbe (Wert 9) für 8 Farben auf 8×8.

## Werbung (aus Squish Attack, squish-appshell / launch-27)
- `vendor/squish-attack/game/native-ads.mjs` – unverändert (Adapter-Registry `registerNativeAds`, `showRewarded`, `showInterstitial`).
- `vendor/squish-attack/game/ad-pacing.mjs` – unverändert bis auf den localStorage-Schlüssel (`squishdoku-ad-pacing-v1`), Takt `interstitialEvery: 5`.
- `vendor/squish-attack/game/ads.css` – der Werbedialog-Teil aus `game/ads.css` (+ die zwei Keyframes aus `store.css`).
- `src/ad-ui.mjs` – angepasste Kopie von `game/ad-ui.mjs` (deutsche Texte, Tipp-Squish als Belohnung, Dummy-Interstitial mit Countdown im Browser).
- `native/admob-adapter.mjs` – unverändert aus `app/src/admob-adapter.mjs`; `native/app-config.mjs` gleicher Aufbau wie `app/src/app-config.mjs`
  (Google-TEST-IDs, Platzhalter `TODO-SQUISHDOKU-…` für die echten IDs). Siehe `native/README.md`.
