# Ocean Merge – Wasser während der Bootfahrt

Dieses Paket enthält den **aktuellen Wasserzustand der Levelauswahl während der Bootfahrt**, Stand **24.10.2026**, geprüft gegen die veröffentlichte Ocean-Merge-Version **46**. Originalgrafiken, Wassersimulation, Lichtbrechung, Wellen, Scrollreaktionen und Bootsspur sind enthalten. Die Originalmodule und Bilder sind bytegleich mit dem Projekt.

## Ausprobieren

1. ZIP vollständig entpacken.
2. In diesem Ordner `python3 start.py` ausführen; unter Windows auch `py start.py`.
3. `http://localhost:8000` öffnen und auf der Inselkarte nach oben wischen.

Die Startseite zeigt sofort die Levelkarte mit dem Boot bei Insel 1. Kein vorgeschalteter Startbildschirm. Alle Inseln sind per Scrollen erreichbar. Level 1 zeigt beim Antippen einen Beispiel-Callback; hier kann das andere Spiel starten. `meer.html` zeigt zusätzlich das Wasser allein.

Keine npm-Installation oder Kompilierung nötig. Ein Doppelklick auf HTML reicht wegen der ES-Module nicht; bitte über einen Webserver öffnen. Die optionale Schrift der Beispieloberfläche lädt aus Google Fonts. Meer, Boot, Inseln und Tiere sind lokal enthalten.

## Aktuelle Hauptwerte

| Einstellung | Originalwert |
| --- | --- |
| Wellengang | **85 – Kraftvoll** |
| Sonnenreflexe | **65** |
| Wasserinteraktion | `ripple` |
| Qualität | `auto`, maximal 1,5× Gerätepixeldichte |
| Meeresklang | zunächst aus, einschaltbar |
| Physikschritt | 1/60 Sekunde |
| Simulationsraster bei `auto` | 192 Spalten, Höhe abhängig vom Seitenverhältnis, maximal 512 |
| Dämpfungsfaktor pro Physikschritt | innen 0,993; am Rand 0,92 |
| Analytischer Wellengain | 1,22 |
| Große gekrümmte Welle | 7,6 Sekunden Zyklus, Verstärkung 1,85 |
| Zusätzlicher breiter Wellenimpuls | alle 2.100 ms, 12 versetzte Impulse |
| Bootswasserimpuls | Stärke 0,11–0,24 je nach Bewegung, Radius 4,5 Rasterzellen |
| Mindestabstand zwischen Bootsspuren | 65 ms |
| Sichtbare Schaumspur | maximal 34 Partikel, je 1,35 Sekunden |
| Fingerreaktion beim Scrollen | Radius 5,5 Rasterzellen, Abtastung frühestens nach 32 ms |
| Bootsbewegung | ursprüngliche kurvige Route, Auf und Ab ±1,6 px |
| Wassertextur beim Scrollen | `scrollTop / max(400, Höhe des gesamten Meers) × 0.34` |

Die vollständigen Werte und Formeln stehen in **`ocean/boat-voyage-preset.json`**. Dieselben Daten sind als `BOAT_VOYAGE_PRESET` aus **`ocean/boat-voyage-preset.js`** importierbar. Dort steht auch die fertige Initialisierung `createBoatVoyageSea`.

Diese Werte sind der aktuelle **Projektstandard**. Persönlich geänderte Schieberegler aus dem lokalen Speicher eines iPhones sind nicht auslesbar und wurden nicht als Messung ausgegeben. Bei aktivierter Systemoption „Bewegung reduzieren“ verwendet das Original den sanfteren Standard 12 und reduziert Bootsspur und Gestenfeedback; das Paket berücksichtigt diese Option ebenfalls.

## In ein anderes Spiel übernehmen

Den Ordner **`ocean/` vollständig kopieren**. Er enthält alle Laufzeitmodule, Originalgrafiken und das Preset. Für eine Übernahme mit derselben Bootfahrt zusätzlich das Karten-Markup aus `index.html` und die Anbindung aus `levelkarte.js` verwenden. **`SO_UEBERNEHMEN.md`** erklärt die entscheidenden Details.

Das Meer verwendet WebGL2 und auf unterstützter Hardware ein echtes Höhenfeld mit zwei abwechselnden Zustandsbildern. Ohne diese Unterstützung greift der mitgelieferte Original-Fallback; dieser ist sichtbar einfacher. Deshalb für denselben Look den Originalrenderer verwenden.

## Dateien

| Datei/Ordner | Zweck |
| --- | --- |
| `index.html`, `levelkarte.js` | direkte Bootfahrt mit Original-Inselroute |
| `ocean/boat-voyage-preset.json` | genaue Einstellungen und Formeln |
| `ocean/boat-voyage-preset.js` | importierbares Preset und Startfunktion |
| `ocean/` | vollständige wiederverwendbare Meereskomponenten |
| `SO_UEBERNEHMEN.md` | Anleitung für die Übernahme, auch für einen anderen Entwickler/KI |
| `INTEGRATION_DETAILS.md` | ergänzende API-Dokumentation für Wasser und schwimmende Spielobjekte |
| `reference/` | unveränderte Quellreferenz; kein eigenständig startbares Spiel |
| `ORIGINALDATEIEN.json` | Originalpfade und SHA-256-Prüfsummen |
| `PRUEFBERICHT.txt`, `tests/` | tatsächlich ausgeführte Prüfungen und wiederholbare Tests |

Das bestehende Ocean-Merge-Spiel wurde durch diesen Export nicht verändert.
