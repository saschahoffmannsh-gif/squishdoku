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

## Wasser (OceanMerge)
`vendor/ocean-merge/ocean/` stammt aus Saschas OceanMerge_Bootfahrt_Wasser.zip (WaterSurface, Höhenfeld-Simulation, BOAT_VOYAGE_PRESET).
Kleine, standardmäßig abgeschaltete Erweiterungen in `water.js` (nur aktiv mit `settings.gloss>0`):
schwarzer Lack-Look ohne Kaustik/Küste, wandernde Himmels-Reflexe, helle Wellenkanten, analytische Pop-Ringe;
außerdem `EXT_color_buffer_half_float` als Fallback für WebKit/iOS (sonst analytischer Wellen-Pfad).
`src/water.mjs` legt das Wasser bildschirmfüllend unter Squishs und UI (kein Tisch, kein Herbst-Hintergrund).
Der Finger bewegt das Wasser nicht; nur der Pop (Boom) löst Wellen am geplatzten Squish aus. Ein geplatzter Squish hinterlässt nichts außer Wasser.
`clean-screen.mjs` gibt zusätzlich `chromeFrame` zurück, damit der SA-Tischrahmen ausgeblendet werden kann.
