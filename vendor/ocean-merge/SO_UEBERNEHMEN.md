# So bleibt das Wasser wie bei der Bootfahrt

## Fertige Integration

Für ein HTML-/JavaScript-Spiel den gesamten Ordner `ocean/` übernehmen. Die folgenden Dateien nicht durch eine nachgebaute Wasseranimation ersetzen: `water.js`, `surf.js`, `camera.js`, `game-feel.js`, `water-settings.js`, `wildlife.js`, `wildlife-assets.js`, `voyage-model.js`, `voyage-touch.js` und die zugehörigen Bilder.

```html
<link rel="stylesheet" href="./ocean/ocean-scene.css">
<div id="mein-meer" style="position:relative;width:100%;height:100svh"></div>
<script type="module">
  import {createBoatVoyageSea, BOAT_VOYAGE_PRESET}
    from './ocean/boat-voyage-preset.js';

  const meer = createBoatVoyageSea(document.querySelector('#mein-meer'));
  await meer.ready;
  console.log(BOAT_VOYAGE_PRESET.settings);
  // Beim Verlassen: meer.destroy();
</script>
```

Damit starten Originalwasser, Licht, Fische und Vögel mit dem richtigen Ausschnitt. Für Inseln und das fahrende Boot das Markup aus `index.html` zusätzlich einsetzen und anschließend `OceanMap` anbinden, wie vollständig in `levelkarte.js` gezeigt. Dazu auch `ocean/voyage.css` laden; die allgemeine Beispielgestaltung aus `demo.css` an das neue Spiel anpassen. `OceanMap` bindet Scrollreaktion und Wasserfahrt selbst an. Keine zweite Scrollbindung darüberlegen.

```js
import {OceanMap} from './ocean/ocean-map.js';
// Karten-Markup und SVG-Symbole sind bereits im Meer-Container vorhanden.
const karte = new OceanMap(meer, {
  onLevel: id => starteMeinLevel(id)
});

// Beim Verlassen zuerst:
// karte.destroy();
// meer.destroy();
```

Die Dateien in `reference/` sind nur Quellnachweise. Sie benötigen weitere Spielmodule und werden für das portable Meer nicht importiert. Die Presetdateien dokumentieren auch feste Shader- und Bootsparameter. Ein Editieren der JSON allein verändert diese festen Parameter nicht; deren maßgebliche Implementierung liegt in den Originalmodulen.

## 1. Derselbe Meeresbereich und dieselben Farben

Die Levelkarte nimmt den Unterwasserbereich von `coast-no-tent-v4.png`. Sie lädt kein zweites Meeresbild. Im Shader wird die Textur bei fortlaufender Fahrt gespiegelt abgetastet:

```js
const travel = scrollTop / Math.max(400, fullSeaHeight) * 0.34;
renderer.setOceanView(travel);
```

Bei Insel 1 beginnt `travel` bei **0**. Der Startbildschirm des ursprünglichen Spiels verwendet **0,10**; dieser Wert gehört nicht zur anfänglichen Levelkarte. Die Y-Abtastung lautet `q = uv.y * 0.86 + travel`, `mirror = 1 - abs(mod(q, 2) - 1)`, `sceneY = 0.43 + mirror * 0.59`.

Die Farbwirkung entsteht zusätzlich aus den beiden Verlaufsebenen in `ocean-scene.css`. Diese mit übernehmen. Sie liegen über dem Originalwasser; ein Weglassen verändert den Farbeindruck. Hintergrundposition, Mipmaps und Bildfilterung nicht vereinfachen.

Die Originalkomposition verwendet im Hochformat eine 100svh hohe Meeresfläche, auf Desktop 74svh breit und maximal 620 px; auf schmalen Geräten volle Breite. Wellenradien werden in Simulationsrasterzellen angegeben. Ihre sichtbare Ausdehnung hängt dadurch auch von der Rasterauflösung und dem Seitenverhältnis ab.

## 2. Echte Bootsspur der Levelkarte

Der Wasserimpuls beim Fahren wird frühestens alle **65 ms** erzeugt. Die Stärke hängt wie im Original vom Fortschrittsunterschied zwischen zwei Frames ab:

```js
const amplitude = 0.11 + Math.min(0.13, Math.abs(progressDelta) * 3);
meer.disturb(
  pathPoint.x / meer.width,
  (mapTop + pathPoint.y - scrollTop) / meer.height,
  amplitude,
  4.5
);
```

`progressDelta` ist die Veränderung auf der Levelroute pro Frame, keine Pixelgeschwindigkeit pro Sekunde. Die Positionsnormalisierung bezieht sich auf den **gesamten Meer-Container**. Der Kartenbereich beginnt weiter unten; deshalb ist `mapTop` nötig.

Die sichtbare Schaumspur besteht aus kleinen paarigen Ellipsen, mit maximal 34 Partikeln und 1,35 s Lebensdauer. Diese Spur wird vom Wasserimpuls getrennt gerendert. Beide Systeme sind bereits in `OceanMap.update()` enthalten, einschließlich Rückwärtsfahrt und gedämpfter Kurvensteuerung.

**Das Kartenboot verwendet `disturb()`.** Die Funktion `motionWake()` im Wasseradapter stammt von den bewegten Match-3-Gegenständen und erzeugt andere, stärkere Impulspaare. Sie nicht zusätzlich auf das Kartenboot anwenden. Auch die komplette Gegenstands-Auftriebsphysik wird vom Kartenboot im Original nicht verwendet: Es hat die Kurvensteuerung und `sin(nowMs * 0.0022) * 1.6` Pixel Auf und Ab. Das zusätzliche Modul `buoyancy.js` ist für eigene schwimmende Spielobjekte enthalten.

## 3. Finger und Scrollen

Der Finger erzeugt lokale Wellen an seiner tatsächlichen Position. Native `touchmove`-Ereignisse müssen auch nach dem von iOS ausgelösten `pointercancel` weiter ausgewertet werden. Dafür sind `VoyageTouch` und die passive Scrollbindung enthalten. Touch-Pointer-Ereignisse werden nicht nochmals ausgewertet.

Ein Gestenbeginn erzeugt Stärke **0,10**. Danach wird **0,12 + min(0,14, (Distanz + |Wheel-Delta| × 0,15) / 180)** verwendet. Längere Fingerbewegungen werden in bis zu vier Impulse aufgeteilt, jeweils durch die Wurzel ihrer Anzahl geteilt, Radius **5,5**. Die Abtastung erfolgt frühestens nach **32 ms**. Weder `preventDefault()` noch Pointer-Capture sollen das native Scrollen dieser Ansicht übernehmen.

Falls eine eigene Karte verwendet wird und `OceanMap` entfällt:

```js
const loesen = meer.bindScrollSurface(meinScrollElement, {
  travelWithScroll: true
});
// Beim Verlassen: loesen();
```

## 4. Simulation und Licht unverändert lassen

Das physikalische Höhenfeld läuft mit **60 festen Schritten pro Sekunde**, zweifach gepuffert in `RG16F`. Der Fortschritt pro Renderframe wird auf 40 ms, der Simulationsakkumulator auf 50 ms begrenzt. Die Dämpfung reicht von **0,92** am Rand bis **0,993** im Inneren. Das Höhenfeld wird auf **−0,8 bis +0,8** begrenzt.

Analytische Grundwellen, dynamische Impulse und gekrümmte Brandungsfront beeinflussen dieselben Oberflächennormalen. Diese steuern wiederum Verzerrung, Sonnenreflexe und bewegte Lichtmuster. Der Shader enthält Brechungsverhältnis **0,75188**, eine lichtbrechende Tiefenspanne von **0,14–0,36**, zwei überblendete Flussphasen und begrenzte Lichtbündelung. Deshalb genügt es nicht, nur die Schiebereglerwerte auf eine andere Wasseranimation zu übertragen.

Fische und Vögel behalten ihre Originalanimationen und ihre eigene Kamera-/Weltzuordnung. Sie werden nicht zusätzlich mit dem Scroll-Texturwert verschoben. Für identisches Verhalten `CoastalWildlife` und dessen Bilder unverändert mitnehmen.

## Auftrag für das andere Spiel

> Übernimm das Meeresmodul aus dieser ZIP mit `createBoatVoyageSea`, den Originalshadern, Texturen, Verlaufsebenen, Tieranimationen und dem Preset der Level-Bootfahrt. Verwende für dieselbe Bootreise `OceanMap` samt ursprünglicher Kurvenroute, passiven Scrollgesten und Schaumspur. Erhalte Wellenstärke 85, Licht 65 und die dokumentierten Physikwerte. Verwende den Code direkt; ersetze das Wasser nicht durch einen neu erzeugten Hintergrund oder eine vereinfachte Animation. Binde nur die Levelstart- und Fortschritts-Callbacks an das neue Spiel an.
