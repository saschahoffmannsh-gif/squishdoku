# Keks-Sets (Design-Studie)

Drei Entwürfe, die Squishes durch farbige Kekse zu ersetzen. Jede Spielfarbe bekommt ein eigenes Tier.
Nur eine Studie: das Spiel lädt nichts aus diesem Ordner.

| Farbe | Tier |
|---|---|
| Blau | Pinguin |
| Rot | Fuchs |
| Grün | Frosch |
| Orange | Löwe |
| Lila | Eule |
| Pink | Schwein |
| Türkis | Katze |
| Weiß | Hase |

Gelb bleibt die Leuchtfarbe.

- **A · Zuckerguss-Kekse**: runder Mürbeteig mit glänzendem Guss und aufgespritztem Gesicht
- **B · Tier-Ausstecher**: der Keks hat die Kopfform des Tiers und ist ganz glasiert
- **C · Kissen-Kekse**: gewölbtes Quadrat aus gefärbtem Teig in Squish-Form, mit Streuseln

## Dateien
- `cookies.mjs`: die Bibliothek, mit dem `three` aus `vendor/squish-attack`, also dieselbe Version wie im Spiel. Mit `buildCookie(set, farbe, {state, size})` bekommst du eine `THREE.Group`, die sich direkt ins Spiel setzen lässt.
  - `set`: `'A' | 'B' | 'C'`
  - `state`: `'normal' | 'lit' | 'crumbled'`
  - Prozedural erzeugt: Teig-Textur, Bräunung über Vertex-Farben, Guss als Höhenfeld aus gezeichneten Gesichtern (`FACES`), Umrisse (`SILHOUETTE`), Bruchstücke und Krümel.
- `render.html?set=A&view=lineup|board|single[&key=2&state=lit]`: die Render-Seite.
  - `board` benutzt das echte `src/board3d.mjs` mit Glastisch, Licht und Kamera. Es zeigt Level 29 (7×7) mit Keksen an Stelle der Squishes.
  - Weitere Parameter: `&level=`, `&lit=r,c`, `&pop=r,c`.
- `render.js`: der Playwright-Treiber. Er schreibt nach `shots/<set>-<view>.png`.
- `overview.js` und `sets.json`: bauen den Vergleich `shots/cookies-overview.png`.

```sh
python3 -m http.server 8792            # im Repo-Root
node design-concepts/cookies/render.js A,B,C lineup,board
node design-concepts/cookies/overview.js
```
