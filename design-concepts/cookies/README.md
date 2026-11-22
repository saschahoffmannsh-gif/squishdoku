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

- **D · Back-Ausstecher** (`cookies-d.mjs`): natürlicher Mürbeteig-Ausstecher mit gebackenem Rand und mehrlagigem, glänzendem Royal Icing. Jedes Tier besteht aus einzelnen gewölbten Guss-Flächen (Mähne, Ohren, Schnauze …) und dünnen gespritzten Linien. Daraus entstehen ein Höhenfeld für das Mesh, eine Normal-Map für die feinen Linien, eine Farbkarte mit leichter Farbvariation und der Keksumriss (Guss-Umriss plus Backrand). `view=closeups` rendert die Nahaufnahmen (`&keys=4,2,9`).

- **E · Back-Ausstecher mit Posen** (`ANIMALS_E` in `cookies-d.mjs`): gebacken und glasiert wie D, aber die Tiere stehen unterschiedlich.
  - Im Profil: Fuchs nach links, Schwein nach rechts.
  - Dreiviertel-Ansicht: Katze, Pinguin (winkt) und Hase (mit Schlappohr).
  - Frontal: Löwe, Eule mit Seitenblick und Frosch, der zwinkert.
  - Augen im Pixar-Stil mit Blickrichtung (`S.look`).
  - Nahaufnahmen: `view=closeups&keys=2,7,9`.

- **F · Bedruckte Kekse** (`cookies-f.mjs`, `art/`): echter 3D-Mürbeteig-Keks in der Silhouette des Tiers, mit Backrand. Das Pixar-Motiv ist flach aufgedruckt, mit ganz leichtem Glanz und ohne Relief.
  - `art/prepare.py` stellt die Original-JPGs in `art/src/` frei und entfernt gezeichnete Keksränder.
  - Es schiebt die Farben in Richtung der Regionsfarben (Fuchs → Rot, Schwein → Pink, Frosch → Grün, Eule → Lila).
  - Es schreibt Texturen mit 512 px (`*.webp` für Mobilgeräte, `*.png`) und `outlines.json` (Umriss = Motiv + Backrand).
  - Vor `buildCookie('F', …)` muss `await loadArt()` laufen.

## Dateien
- `cookies.mjs`: die Bibliothek, mit dem `three` aus `vendor/squish-attack`, also dieselbe Version wie im Spiel. Mit `buildCookie(set, farbe, {state, size})` bekommst du eine `THREE.Group`, die sich direkt ins Spiel setzen lässt.
  - `set`: `'A' | 'B' | 'C' | 'D' | 'E' | 'F'`
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
