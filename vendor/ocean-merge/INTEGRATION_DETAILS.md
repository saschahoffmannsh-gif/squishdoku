# Ocean Merge – Originalmeer zum Einbauen

Dieses Paket enthält das Meer der Levelauswahl aus Ocean Merge, Stand **23. Oktober 2026, veröffentlichte Version 46**. Die Wasser-, Wellen-, Kamera- und Physikmodule sowie die Bilder wurden **unverändert aus dem Original kopiert**. Es sind dieselben Shader und Simulationsregeln. Eine schmale zusätzliche Anbindung macht sie ohne das Match-3-Spiel verwendbar.

## Schnell ausprobieren

1. Die ZIP vollständig entpacken.
2. In diesem Ordner `python3 start.py` starten. Unter Windows geht auch `py start.py`.
3. Im Browser `http://localhost:8000` öffnen.

Alternativ: `python3 -m http.server 8000`. Die Dateien können auch in einen bestehenden Webserver oder ein Sites-Projekt kopiert werden. Ein Doppelklick auf die HTML-Datei reicht wegen der JavaScript-Module nicht aus.

- **`index.html`**: nur das Originalmeer, mit Touch-Reaktionen und optionalem Meeresklang.
- **`levelkarte.html`**: zusätzlich die ursprünglichen Inseln, das Boot, die kurvige Route, Schlösser und die Scroll-Wassereffekte. Der Levelstart ist ein Callback für dein anderes Spiel.

Es muss nichts kompiliert oder mit npm installiert werden. Die Wasserbilder, Tiergrafiken und Inseln liegen vollständig im Paket. Die optionale Levelkarten-Schrift lädt wie beim Original über Google Fonts; ohne Internet verwendet diese Beispieloberfläche Ersatzschriften. Das eigentliche Meer und seine Grafiken benötigen keine externe Verbindung.

## Was enthalten ist

| Bestandteil | Dateien |
| --- | --- |
| Originales WebGL2-Wasser einschließlich Simulation und Shadern | `ocean/water.js` |
| Originale gekrümmte Brandungsfront und gemeinsame Wellenwerte | `ocean/surf.js`, `ocean/game-feel.js` |
| Schwimmphysik, Auftrieb und fortlaufende Reaktion auf lokale Wellen | `ocean/buoyancy.js` |
| Kamera und ursprüngliche Weltkoordinaten | `ocean/camera.js` |
| Originaltextur, aus deren Unterwasserbereich die Levelkarte besteht | `ocean/assets/coast-no-tent-v4.png` |
| Fische, Schwärme, schnelle Richtungswechsel und Vögel | `ocean/wildlife.js`, `ocean/wildlife-assets.js`, `ocean/assets/wildlife/` |
| Boot und vier Inselgrafiken mit den ursprünglichen Variationen | `ocean/assets/voyage/` |
| Kurvenfahrt und Reaktion an der Fingerposition beim Scrollen | `ocean/voyage-model.js`, `ocean/voyage-touch.js`, `ocean/ocean-map.js` |
| Originaler synthetischer Meeresklang und Wassergeräusche | `ocean/ocean-audio.js` |
| Wiederverwendbare Anbindung und Ebenendarstellung | `ocean/ocean-scene.js`, `ocean/ocean-scene.css` |

Die ursprüngliche Küstentextur wird bewusst vollständig mitgeliefert: Der Renderer verwendet für das Levelmeer deren Unterwasserbereich. Das ist Teil des Originalverfahrens. Es wurde keine neue Meeresgrafik generiert. Die Beispiele starten direkt im offenen Meer und zeigen kein vorgeschaltetes Strandbild.

## Meer in ein anderes HTML-Spiel einsetzen

Den Ordner **`ocean` vollständig übernehmen**, einschließlich seiner Unterordner. Relative Modul- und Bildpfade sind Bestandteil des Pakets.

```html
<link rel="stylesheet" href="./ocean/ocean-scene.css">
<div id="mein-meer" style="position:relative;width:100%;height:100svh"></div>
<script type="module">
  import {OceanScene} from './ocean/ocean-scene.js';

  const meer = new OceanScene(document.querySelector('#mein-meer'));
  await meer.ready;

  // Eigene Spieloberfläche als separate Ebene über dem Meer anzeigen.
  // Beim späteren Verlassen dieser Ansicht:
  // meer.destroy();
</script>
```

Nur `ocean/ocean-scene.css` gehört zur Grundintegration. `demo.css` gestaltet ausschließlich die beiliegenden Beispielseiten; sie muss nicht in dein Spiel übernommen werden.

Standardwerte entsprechen der Levelauswahl bei unveränderten Einstellungen: **Wellengang 85 / Kraftvoll**, Sonnenreflexe **65**, automatische Qualität mit maximal **1,5× Gerätepixeldichte**, Meeresklang zunächst aus. Die Systemeinstellung für reduzierte Bewegung wird wie im Original berücksichtigt. Persönliche Spielstände oder Geräteeinstellungen wurden nicht in die ZIP exportiert.

```js
meer.setSettings({swell: 85, light: 65, quality: 'auto'});
meer.interact();                      // aus einer Benutzerinteraktion heraus
meer.setSettings({sound: true});       // startet den originalen Meeresklang
meer.setSettings({mode: 'flow'});      // optional: 'ripple', 'flow', 'vortex'
```

Für den Original-Look wird WebGL2 verwendet. Wenn es auf einem Gerät nicht verfügbar ist, greift derselbe vereinfachte Canvas-Fallback wie in Ocean Merge. Der physikalische WebGL-Effekt lässt sich nicht vollständig durch ein einzelnes Bild oder Video ersetzen.

## Wasser durch Spielbewegungen beeinflussen

`disturb` erhält Positionen von **0 bis 1 relativ zum Meer-Container**. Ein Impuls wirkt in der bestehenden Wassersimulation, keine zusätzliche dekorative Animation.

```js
// Einmaliger Wasserimpuls in der Mitte.
meer.disturb(0.5, 0.5, 0.23, 5, true, true);

// Bewegtes Objekt: aktuelle Position normalisiert,
// Bewegungsrichtung dx/dy in Bildschirmpixeln seit dem letzten Schritt.
meer.motionWake(x / meer.width, y / meer.height, dx, dy, 0.92);
```

Die Scroll-Reaktion der Levelauswahl lässt sich an eine eigene scrollbare Ebene binden:

```js
const loesen = meer.bindScrollSurface(meinScrollElement, {
  travelWithScroll: true
});
// loesen();  // später alle zugehörigen Listener entfernen
```

Diese Bindung nutzt dieselbe `VoyageTouch`-Berechnung wie das Original. Sie erhält das native iPhone-Scrollen, liest die Fingerposition auch nach einem scrollbedingten `pointercancel` und verhindert doppelte Touch-Auslösungen. `travelWithScroll` bewegt außerdem die Unterwassertextur mit dem ursprünglichen Faktor `scrollTop / max(400, Höhe) × 0.34`. Ohne Scroll-Anbindung steht der Ausschnitt beim Start auf `0`, wie bei Insel 1 der Levelauswahl. `meer.setTravel(wert)` setzt diesen Wert direkt.

## Eigene schwimmende Gegenstände

Die Originalfunktionen `sampleSeaMotion`, `sampleInteractionWaves` und `stepBuoyancy` liegen in `ocean/buoyancy.js`. Die gespeicherten lokalen Impulse stehen unter `meer.interactionWaves` bereit; deren Positionen sind Pixelkoordinaten. Körperzustände müssen zwischen Frames erhalten bleiben, damit Trägheit und Dämpfung funktionieren.

Die vollständige unveränderte Einbindung für die Spielgegenstände steht unter **`reference/merge-game.js`**, insbesondere `reactToWater`, `update`, `syncBoard` und die Wasserlinienmaske in `reference/merge.css`. Damit kann das andere Spiel dieselben Parameter, Kippwinkel und das Ein- und Auftauchen übernehmen. Die zugehörigen Gegenstandsgrafiken sind nicht Teil dieses Meerpakets.

Das Boot der Levelkarte verwendet bereits im Original ein eigenes leichtes Auf und Ab und richtungsabhängige Kurvensteuerung. Im optionalen Kartenbeispiel wurde genau dieses Verhalten übernommen.

## Inselkarte an ein anderes Spiel anschließen

`levelkarte.html` enthält das erforderliche Markup; `levelkarte.js` zeigt die komplette Anbindung. `OceanMap` verwendet die ursprünglichen Methoden für Anordnung, Zeichnung, Bootfahrt und Schaumspur. Die Leveldaten sind von der bisherigen Puzzlelogik entkoppelt.

```js
import {OceanMap} from './ocean/ocean-map.js';

// Zuerst das Karten-Markup aus dem Beispiel in den Meer-Container einsetzen.
const karte = new OceanMap(meer, {
  onLevel: nummer => starteMeinLevel(nummer)
});

// Nach Abschluss eines Levels die eigenen Fortschrittsdaten übergeben.
karte.setProgress({
  levelId: 2,
  unlocked: [1, 2],
  completed: [1],
  seaMoves: 0,
  phase: 'collect',
  inventory: {}
});

// Beim Ansichtswechsel zuerst karte.destroy(), dann meer.destroy().
```

Weitere Inseln lassen sich über `ocean/level-data.js` ergänzen. Nummern beginnen mit 1 und folgen fortlaufend aufeinander. Scrollen kann jede Insel erreichen; spielbar wird die nächste nach Abschluss aller vorherigen. Der Fortschritt gehört deinem neuen Spiel; die Beispiele schreiben keine Ocean-Merge-Spielstände.

## Nachvollziehbarkeit und Prüfung

`ORIGINALDATEIEN.json` enthält den Quellstand und SHA-256-Prüfsummen für jedes unverändert kopierte Modul und Bild. `reference/` ist eine reine Quellreferenz aus Ocean Merge und kein zweites startbares Spiel. Die neuen Dateien `ocean-scene.js`, `ocean-map.js` und die Beispielseiten verbinden die Originalkomponenten mit dem eigenständigen Paket.

- `npm test`: automatische Prüfungen für Originaldateien, Abhängigkeiten, Auftrieb, Kurvenfahrt, Start, Touch-Scrollen und Aufräumen der Anbindung.
- `python3 tests/verify-water-gpu.py`: zusätzlicher Shader- und Render-Test mit Mesa/EGL und Pillow, falls diese Komponenten vorhanden sind. Für die Nutzung im Browser ist das nicht erforderlich.
- `PRUEFBERICHT.txt`: tatsächlich ausgeführte Prüfungen dieses Exports.

Das bestehende Ocean-Merge-Projekt wurde für diesen Export nicht verändert.
