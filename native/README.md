# SquishDoku – Werbung in der App (Vorlage)

Gleiche Integration wie Squish Attack (`squish-appshell`, docs/app-shell.md §3.1):

- **Spiel (läuft schon, auch im Browser):** `vendor/squish-attack/game/native-ads.mjs` (Adapter-Registry,
  `registerNativeAds`, auch als `window.SquishNative.registerNativeAds`), `vendor/squish-attack/game/ad-pacing.mjs`
  (Takt: jede 5. gewonnene Runde → Zwischenwerbung beim Start des nächsten Levels), `src/ad-ui.mjs` (Comic-Dialog).
- **App-Hülle (noch nicht gebaut):** Capacitor + `@capacitor-community/admob`. `admob-adapter.mjs` ist unverändert
  aus Squish Attack (`setupConsent` = UMP-Einwilligung → ATT, `createAdMobAdapter`). Beim App-Start:

```js
import { setupConsent, createAdMobAdapter } from './admob-adapter.mjs';
import { APP_CONFIG, adIds } from './app-config.mjs';
const AdMob = Capacitor.Plugins.AdMob;
const ready = setupConsent(AdMob, { askTracking: APP_CONFIG.admob.askTracking, testing: APP_CONFIG.admob.testing });
window.SquishNative.registerNativeAds(createAdMobAdapter({ AdMob, ids: adIds(), testing: APP_CONFIG.admob.testing, ready }));
```

Ohne angemeldeten Adapter (Browser/GitHub Pages) gibt es nur Dummy-Werbung: Tipp-Clip = sofortige Belohnung,
Zwischenwerbung = Dummy-Spot mit 3-s-Countdown. Kein Netz, kein Fremdcode im Spiel.

Für echte Werbung nötig: AdMob-App + 2 Anzeigenblöcke für SquishDoku (IDs in `app-config.mjs` statt der TODOs),
AdMob-App-ID in Info.plist, UMP-Einwilligungstexte in AdMob, SKAdNetwork-IDs, `app-ads.txt`, Datenschutztext.
