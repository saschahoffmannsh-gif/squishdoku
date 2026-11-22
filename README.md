# SquishDoku

Logik-Puzzle mit den Squishs aus Squish Attack: Pro Reihe, Spalte und Farbe leuchtet genau ein
Squish, leuchtende Squishs berühren sich nie (auch nicht schräg).

Live auf GitHub Pages: https://saschahoffmannsh-gif.github.io/squishdoku/

* **Halten** (~0,4 s, Ladering) → Squish leuchtet; nochmal halten → aus.
* **Wischen** / kurz **antippen** → Squish ploppt (bleibt platt liegen); antippen holt ihn zurück.
* Falsch halten / einen Squish wegwischen, der leuchten muss → Wackeln + 1 Herz weg (3 pro Level).
* Richtig leuchtend → nur dieser Squish leuchtet; weggeploppt wird ausschließlich per Wischen.

## Tagesrätsel, Sterne & Zeit, Rückgängig, Vibration
**Tagesrätsel** – ein Rätsel pro Kalendertag (Europe/Berlin, Wechsel um Mitternacht), für alle gleich.
`src/daily.js` erzeugt es nur aus dem Datum (FNV-Hash → feste Seed-Reihe → `engine.generate`), nimmt nur
Rätsel mit genau einer Lösung, die rein logisch lösbar sind, und deren Schwierigkeit im Band des Wochentags liegt:

| Tag | Größe | Score | Name |
|---|---|---|---|
| Mo | 5×5 | 11–16 | Leicht |
| Di | 6×6 | 16–22 | Leicht |
| Mi | 6×6 | 20–28 | Mittel |
| Do | 7×7 | 24–34 | Mittel |
| Fr | 7×7 | 30–38 | Mittel |
| Sa | 7×7 | 34–43 | Knifflig |
| So | 8×8 | 40–52 | Knifflig |

(Score wie `tools/gen-levels.js`: gewichtete Logikschritte + 2 je Größe über 5.) Weil das Suchen auf dem
Handy bis zu Sekunden dauern kann, liegen 2026-11-01 … 2028-12-31 vorberechnet in `src/daily.json`
(`node tools/gen-daily.js FROM TO part parts` + `node tools/gen-daily.js merge`). Tage außerhalb baut ein
Web Worker (`src/daily-worker.js`) mit demselben Code – gleiches Ergebnis, kein Ruckeln.
Das Tagesrätsel zählt im Werbe-Takt wie ein Level (jede 5. gewonnene Runde → Zwischenwerbung beim nächsten
Start), der Tipp-Clip ist erlaubt; es zählt nicht zu den 50 Leveln/Sternen.

**Serie** – Tage in Folge mit gelöstem Tagesrätsel. Zählt beim ersten Lösen des heutigen Rätsels (oder des
gestrigen, wenn vor Mitternacht begonnen); ein verpasster Tag → Anzeige 0, nächstes Lösen startet bei 1.
Rekord bleibt. Nochmal spielen behält das beste Ergebnis und zählt die Serie nicht doppelt.

**Sterne & Zeit** – die Zeit läuft nur beim Spielen (pausiert im Hintergrund, bei offenem Dialog/Werbung,
im Menü). Zielzeit T: 4×4 45 s · 5×5 60 s · 6×6 90 s · 7×7 120 s · 8×8 150 s.
* 3★ = kein Herz verloren **und** ≤ T
* 2★ = kein Herz verloren (egal wie lange) **oder** 1 Herz verloren und ≤ 2·T
* 1★ = sonst gelöst
* Missionen mit Anleitung (L1–2): nur Herzen (0/1/2 verloren → 3/2/1★).

Gespeichert werden je Level die besten Sterne und die Bestzeit (unabhängig voneinander). Alte Spielstände
(v2: Sterne = übrige Herzen) behalten ihre Sterne, Bestzeiten beginnen leer.

**Rückgängig** – ein Schritt = eine Aktion: Squish leuchten lassen, ausschalten, ein ganzer Wisch (alle
dabei geploppten Squishs) oder ein Antippen (ploppen/zurückholen). Falsche Züge ändern nichts am Brett und
sind kein Schritt; das verlorene Herz bleibt weg (sonst wären Fehler gratis). Ein per Werbung enthüllter
Squish ist kein Schritt. Aus, wenn nichts da ist, das Level vorbei ist oder in den Missionen L1–2.

**Vibration** – kurze Muster (`src/haptics.mjs`): tap [6] · pop [9] · light [14,40,22] · wrong [40,60,40] ·
win [20,50,20,50,70] · undo [8,30,8]. Schalter in den Einstellungen (nur sichtbar, wo das Gerät vibrieren
kann; iOS Safari hat keine Vibration → still). Eine native Hülle setzt `window.SquishNative.haptic(kind)`
(`native/haptics-bridge.mjs`), dann gehen die Momente an die Taptic Engine.

Speicher: `localStorage['squishdoku-v1']`, Version 3 (`times`, `daily`, `settings` neu; Migration aus v1/v2).
`settings.showTime` („Zeit anzeigen“, Standard an) und `daily.total` (gelöste Tagesrätsel insgesamt) kommen
ohne Versionssprung dazu – fehlende Felder bekommen beim Laden ihren Standardwert.

## Design „Neon-Nacht“ (Menüs, HUD, Dialoge)
Umsetzung von `design-concepts/2-neon-nacht.html`: dunkles Navy-Glas, Gold-Akzente, Fredoka + Lilita One.
Das Brett und die Squishs (`src/board3d.mjs`) sind unverändert.
* `index.html` – Menü-Rahmen `#home` (Screens in `#home-screen`, Tab-Leiste `#tabs`), Einstellungen als
  Bottom-Sheet `#sheet`, Toast. `src/neon.css` – das komplette Design (Menüs, Sheet, HUD, Dialoge, Werbung),
  `src/style.css` – Spiel-Layout. `src/icons.mjs` – Icon-Set. `src/img/` – vorgerenderte Bilder.
* **Start**: Sterne- und Serien-Pill, Zahnrad, Logo, Brett-Hero (ein echtes Brett aus dem eigenen Renderer,
  vorgerendert als WebP, 59 KB – kein zweiter WebGL-Kontext, startet sofort), Tagesrätsel-Karte (Datum,
  Größe/Schwierigkeit, Rekord, Spielen, Wochenreihe Mo–So aus den gelösten Tagen), Weiterspielen mit Ring
  (gelöste Level / 50).
* **Levels**: Tabs nach Brettgröße 5×5 · 6×6 · 7×7 · 8×8 = Kapitel 1–4. Mission 1 (4×4) und Mission 2
  stehen am Anfang von Kapitel 1 (kleines „M“). Kachel: Nummer, Sterne, Bestzeit („Jetzt“ beim aktuellen
  Level, Goldrand), Punkt = 3 Sterne, Schloss = gesperrt.
* **Statistik**: Sterne, gelöste/perfekte Level, Bestzeit, Ø Zeit (über die Bestzeiten), Serie, beste Serie,
  gelöste Tagesrätsel, Tagesrätsel mit 3★, Tabelle je Größe.
* **Einstellungen** (Zahnrad oder Tab „Optionen“): Sterne/Serie/Ø Zeit, Ton, Vibration, Zeit anzeigen (blendet
  nur die Uhr im HUD aus, Sterne zählen weiter), Regeln & Tipps, Freunde einladen (Web Share, sonst Link
  kopieren), Fortschritt zurücksetzen (mit Rückfrage; Einstellungen bleiben).
* Screens neu gestalten: nur `src/neon.css` + die kleinen Render-Funktionen im Abschnitt „Menüs“ von
  `src/main.mjs` (`homeScreen`, `levelsScreen`, `statsScreen`, `rulesScreen`); Regeln in `src/progress.mjs`.

## Starten
    python3 -m http.server 8792     # im Projektordner
    open http://localhost:8792/

## Level
`node tools/gen-levels.js` erzeugt `src/levels.json` und prüft jedes Level: gültige zusammenhängende
Farbfelder, genau **eine** Lösung (Brute-Force), und vollständig lösbar mit reinen Logikschritten
(ohne Probieren/Lookahead). Farben werden so verteilt, dass benachbarte Felder maximal verschieden sind.

## Tests
    node tests/levels-test.js
    node tests/progress-test.mjs                            # Sterne/Zeit/Serie-Regeln (src/progress.mjs)
    NODE_PATH=<playwright-core> node tests/e2e.js [--shots]
    NODE_PATH=<playwright-core> node tests/touch-hit.js     # Touch trifft den gezeichneten Squish, kein Seitenversatz
    NODE_PATH=<playwright-core> node tests/tap-latency.js   # Knopf-Reaktionszeit (CPU 4x gedrosselt)
    NODE_PATH=<playwright-core> node tests/features-e2e.js  # Tagesrätsel/Serie, Sterne & Zeit, Rückgängig, Vibration, Optionen (CPU 4x)
    NODE_PATH=<playwright-core> node tests/startup.js       # Kaltstart + Menü-Renderzeit (CPU 4x)
    NODE_PATH=<playwright-core> node tests/neon-shots.js    # Kontroll-Screenshots aller Screens → shots/

Wiederverwendete Squish-Attack-Teile: siehe VENDOR.md.

## Release / Backend
GitHub Pages baut direkt aus `main` (Wurzel, `.nojekyll`) – wie bei Squish Attack, kein Workflow.

Supabase-Projekt `ixueznoxvanavkmrftaf` („squishdoku“, Org spoosoft, eu-central-1). `src/config.js`
enthält nur öffentliche Werte (URL, Publishable Key). Noch keine Backend-Funktionen.
