# SquishDoku

Logik-Puzzle mit den Squishs aus Squish Attack: Pro Reihe, Spalte und Farbe leuchtet genau ein
Squish, leuchtende Squishs berühren sich nie (auch nicht schräg).

Live auf GitHub Pages: https://saschahoffmannsh-gif.github.io/squishdoku/

* **Halten** (~0,4 s, Ladering) → Squish leuchtet; nochmal halten → aus.
* **Wischen** / kurz **antippen** → Squish ploppt (bleibt platt liegen); antippen holt ihn zurück.
* Falsch halten / einen Squish wegwischen, der leuchten muss → Wackeln + 1 Herz weg (3 pro Level).
* Richtig leuchtend → nur dieser Squish leuchtet; weggeploppt wird ausschließlich per Wischen.

## Starten
    python3 -m http.server 8792     # im Projektordner
    open http://localhost:8792/

## Level
`node tools/gen-levels.js` erzeugt `src/levels.json` und prüft jedes Level: gültige zusammenhängende
Farbfelder, genau **eine** Lösung (Brute-Force), und vollständig lösbar mit reinen Logikschritten
(ohne Probieren/Lookahead). Farben werden so verteilt, dass benachbarte Felder maximal verschieden sind.

## Tests
    node tests/levels-test.js
    NODE_PATH=<playwright-core> node tests/e2e.js [--shots]

Wiederverwendete Squish-Attack-Teile: siehe VENDOR.md.

## Release / Backend
GitHub Pages baut direkt aus `main` (Wurzel, `.nojekyll`) – wie bei Squish Attack, kein Workflow.

Supabase-Projekt `ixueznoxvanavkmrftaf` („squishdoku“, Org spoosoft, eu-central-1). `src/config.js`
enthält nur öffentliche Werte (URL, Publishable Key). Noch keine Backend-Funktionen.
