// ======================================================================================
//  SquishDoku – PLATZHALTER der App-Hülle (gleicher Aufbau wie Squish Attack app/src/app-config.mjs)
// ======================================================================================
// Solange `testing: true` gilt, laufen die öffentlichen Google-TEST-Anzeigenblöcke (iOS).
// Vor dem Store-Start: in AdMob eine App „SquishDoku“ anlegen, zwei Anzeigenblöcke (Belohnung + Interstitial)
// erstellen und die IDs unten bei den TODO-Platzhaltern eintragen, dann `testing: false`.
export const SQUISHDOKU_REAL_IDS = Object.freeze({
  rewardedId: 'TODO-SQUISHDOKU-REWARDED-AD-UNIT-ID',        // ca-app-pub-…/… (AdMob → SquishDoku → Anzeigenblöcke)
  interstitialId: 'TODO-SQUISHDOKU-INTERSTITIAL-AD-UNIT-ID', // ca-app-pub-…/…
  appId: 'TODO-SQUISHDOKU-ADMOB-APP-ID',                    // ca-app-pub-…~… → Info.plist GADApplicationIdentifier
});
export const APP_CONFIG = Object.freeze({
  admob: Object.freeze({
    // true = Google-TEST-Anzeigen. Erst auf false stellen, wenn die echten IDs oben stehen!
    testing: true,
    // Google-TEST-Anzeigenblöcke für iOS (öffentlich, von Google dokumentiert) – dieselben wie in Squish Attack.
    rewardedId: 'ca-app-pub-3940256099942544/1712485313',
    interstitialId: 'ca-app-pub-3940256099942544/4411468910',
    askTracking: true,
  }),
});
export const adIds = () => APP_CONFIG.admob.testing ? APP_CONFIG.admob : { ...APP_CONFIG.admob, ...SQUISHDOKU_REAL_IDS };
