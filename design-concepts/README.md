# SquishDoku – Design-Konzepte (Menüs & Startseite)

Statische Mockups, **nicht** mit dem Spiel verlinkt. Squishs sind echte Renders aus dem Spiel
(`capture-assets.js` → `assets/`), Schriften aus dem Spiel (Fredoka, Lilita One).

| Konzept | Präsentation | Screens |
|---|---|---|
| 1 · Squish-Welt | `shots/1-squish-welt.png` | home · levels · win |
| 2 · Neon-Nacht | `shots/2-neon-nacht.png` | home · levels · settings |
| 3 · Pastell Cozy | `shots/3-pastell-cozy.png` | home · levels · win |
| 4 · Comic-Heft | `shots/4-comic-heft.png` | home · levels · win |

Neu rendern (Spiel auf :8792 für die Assets):

    node design-concepts/capture-assets.js
    node design-concepts/render.js 1-squish-welt "Konzept 1 · Squish-Welt" "Untertitel"
