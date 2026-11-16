# Reused from Squish Attack

Source: `saschahoffmannsh-gif/squish-attack`, commit `9a61cc9` (branch `launch-26`,
local worktree `/workspace/squish-l26`) for table, menus, sounds and springs; the squish *look* is the
older translucent gel from commit `281e8da` (launch-5, 2026-11-14, last build before the comic restyle `4429015`).
Files are copied unchanged into `vendor/squish-attack/` with the original folder layout
(`game/…`, `squish/…`) so their relative imports keep working.

| What | Files |
|---|---|
| **Original translucent gel squishes** (the look before the comic restyle) | material recipe of `game/graphics-adapter.mjs` `createHudMaterial` @ `281e8da` (launch-5): `createGelMaterial` + `installGelOptics` (`game/original-gel-models.js`) → `applyDiffuseGelGlow` (`game/gel-lighting.mjs`) → `installNeonBands` (`game/neon-bands.mjs`, copied from `281e8da`) + env map, rendered through the HDR glass composite of `game/clean-screen.mjs` (non-direct mode). `squish/squish-graphics.js` is byte-identical in launch-5 and launch-26. |
| Squish model, springs, softness | `squish/squish-graphics.js` (three.js bundle + SDK), `game/original-gel-models.js`, `game/gel-softness.mjs`, `game/special-squish.mjs`; `game/comic-style.mjs` only for the glow spark texture |
| Glass table (chrome frame, glass reflections, contact shadows, camera fit) | `game/clean-screen.mjs`, `game/chrome-frame.mjs`, `game/glass-reflections.mjs`, `game/glass-shadows.mjs`, `game/pressure-contact.mjs`, `game/pressure-wave.mjs`, `game/dense-contacts.mjs`, `game/render-quality.mjs` |
| Pop animation (original gel burst: torn skin + gel drops) | `game/fusion-gel.mjs` = `game/fusion.mjs` @ `281e8da` (`popBody`), with `game/fusion-core.mjs`, `game/fusion-worker.mjs` (identical in both versions). Render density: `game/render-quality-gel.mjs` = `game/render-quality.mjs` @ `281e8da`. (`game/fusion.mjs` / `render-quality.mjs` from launch-26 stay in the folder, unused.) |
| Swipe reaction / wobble | press/drag/release/wobble springs of `squish-graphics.js` (`Vh/Gh/Wh/bl`, re-stated in `src/board3d.mjs`) driving `updateSquishy` from `original-gel-models.js` |
| Sounds | `game/sound.mjs`, `game/assets/audio/` (plop, suction, slide, burst – CC0, see CREDITS.txt), `game/haptics.mjs` |
| Menus / UI style | `game/autumn-ui.css`, `game/comic-ui.css`, `game/aw-icons.mjs`, `game/home-menu.mjs` (backdrop), `game/confetti.mjs`, fonts (Fredoka, Lilita One, OFL) |
| Support | `game/flags.mjs`, `game/i18n.mjs`, `game/locales.mjs`, `game/fit-labels.mjs` |

Only change in the copies: `glass-reflections.mjs` / `glass-shadows.mjs` default capacity 29 → 64
(Squish Attack only ever shows 25 board squishes; a 7×7 SquishDoku board has 49).
`assets/specials/` keeps only the two textures `special-squish.mjs` fetches at import.

Engine (solver, unique-puzzle generator, human-style logic step solver) comes from the
GlowDoku prototype `/workspace/glowdoku/engine.js` → `src/engine.js`.
