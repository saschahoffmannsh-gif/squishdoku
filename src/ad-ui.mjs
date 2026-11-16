// SquishDoku-Werbedialoge. Übernommen aus Squish Attack (game/ad-ui.mjs, launch-27): gleicher Comic-Dialog,
// gleiche Schnittstelle (vendor/squish-attack/game/native-ads.mjs → registerNativeAds) und gleiche
// Dummy-Werbung im Browser. Unterschiede: Texte direkt auf Deutsch (kein i18n), Belohnung = Tipp-Squish,
// und im Browser zeigt die Zwischenwerbung einen Dummy-Spot mit kurzem Countdown (Squish Attack zeigt dort nichts).
import { showRewarded, showInterstitial, hasNativeAds } from '../vendor/squish-attack/game/native-ads.mjs';

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const CLOSE_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg>';
const PLAY_SVG = '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="20" fill="#ff5a4e" stroke="#0b0a16" stroke-width="3"/><path d="M19 15v18l15-9z" fill="#fff" stroke="#0b0a16" stroke-width="2.4" stroke-linejoin="round"/></svg>';
export const GLOW_SQUISH_SVG = '<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="5" y="7" width="30" height="27" rx="9" fill="#ffc21f" stroke="#140a10" stroke-width="3"/><rect x="5" y="7" width="30" height="15" rx="8" fill="#ffe36b"/><ellipse cx="13" cy="13" rx="4" ry="2.4" fill="#fff"/><path d="M20 1v4M36 6l-3 3M4 6l3 3" stroke="#ffd23f" stroke-width="3" stroke-linecap="round"/></svg>';
export const AD_ICON_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="4" width="20" height="14" rx="3.5" fill="#ff5a4e" stroke="#140a10" stroke-width="2"/><path d="M10 8v6l5-3z" fill="#fff" stroke="#140a10" stroke-width="1.4" stroke-linejoin="round"/><path d="M8 21h8" stroke="#140a10" stroke-width="2.2" stroke-linecap="round"/></svg>';

export function createAdUI({ onAdStart, onAdEnd, sound, haptics, interstitialSeconds = 3 } = {}) {
  let veil = null, lastFocus = null;
  const stats = { opens: 0, watched: 0, interstitials: 0 };
  function mount(v) { lastFocus = document.activeElement; veil = v; document.body.append(v); }
  function close() { if (!veil) return; veil.remove(); veil = null; lastFocus?.focus?.({ preventScroll: true }); }
  /** Belohnungsclip für einen Tipp. → Promise<boolean> (true = angesehen, Squish wird enthüllt). */
  function offerReveal({ left = 1 } = {}) {
    return new Promise(resolve => {
      if (veil) close();
      stats.opens++;
      const v = el('div', 'ad-veil'); v.id = 'ad-dialog';
      const panel = el('div', 'ad-panel'); panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-labelledby', 'ad-title');
      const done = ok => { close(); resolve(ok); };
      const x = el('button', 'ad-close'); x.type = 'button'; x.setAttribute('aria-label', 'Schließen'); x.innerHTML = CLOSE_SVG; x.addEventListener('click', () => done(false));
      const title = el('h2', 'ad-title', 'Werbung ansehen'); title.id = 'ad-title';
      const real = hasNativeAds();
      const screen = el('div', 'ad-screen'); const play = el('span', 'ad-play'); play.innerHTML = PLAY_SVG;
      screen.append(el('span', 'ad-badge', real ? 'Werbeclip' : 'Werbeclip (Dummy)'), play, el('small', 'ad-hint', real ? 'Kurzes Video, danach gibt es die Belohnung' : 'Testphase: Antippen reicht, kein Video'));
      const reward = el('div', 'ad-reward'); const ico = el('span', 'ad-reward-ico'); ico.innerHTML = GLOW_SQUISH_SVG;
      const txt = el('div', 'ad-reward-text'); txt.append(el('b', '', 'Danach leuchtet ein Squish'), el('small', '', 'Ein richtiger Squish wird dir gezeigt und leuchtet sofort.'));
      reward.append(ico, txt);
      const watch = el('button', 'ad-watch'); watch.type = 'button'; watch.id = 'ad-watch'; watch.append(el('span', '', 'Ansehen'));
      watch.setAttribute('aria-label', 'Werbeclip ansehen und einen richtigen Squish enthüllen');
      watch.addEventListener('click', async () => {
        close();
        onAdStart?.(); let res;
        try { res = await showRewarded({ placement: 'reveal', tool: 'reveal' }); } finally { onAdEnd?.(); }
        if (!res?.ok) { resolve(false); return; }
        stats.watched++; sound?.play?.('gift'); haptics?.pulse?.('merge');
        resolve(true);
      });
      const later = el('button', 'ad-later', 'Nein danke'); later.type = 'button'; later.addEventListener('click', () => done(false));
      panel.append(x, title, screen, reward, watch, later, el('p', 'ad-foot', left > 1 ? `Beliebig oft – noch ${left} Squishs zu finden.` : 'Der letzte Squish – danach ist das Level gelöst.'));
      v.append(panel); v.addEventListener('pointerdown', ev => { if (ev.target === v) { ev.preventDefault(); done(false); } });
      mount(v); requestAnimationFrame(() => watch.focus({ preventScroll: true }));
    });
  }
  /** Zwischenwerbung zwischen zwei Leveln. App: AdMob-Interstitial. Browser: Dummy-Spot mit Countdown. */
  async function interstitial() {
    stats.interstitials++;
    if (hasNativeAds()) { onAdStart?.(); try { await showInterstitial({ placement: 'level' }); } finally { onAdEnd?.(); } return; }
    await new Promise(resolve => {
      if (veil) close();
      const v = el('div', 'ad-veil sd-inter'); v.id = 'ad-interstitial';
      const panel = el('div', 'ad-panel'); panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-label', 'Werbung');
      const title = el('h2', 'ad-title', 'Kurze Werbung');
      const screen = el('div', 'ad-screen'); const play = el('span', 'ad-play'); play.innerHTML = PLAY_SVG;
      const count = el('b', 'sd-inter-count', String(interstitialSeconds));
      screen.append(el('span', 'ad-badge', 'Werbung (Dummy)'), play, count);
      const go = el('button', 'ad-watch'); go.type = 'button'; go.id = 'ad-continue'; go.disabled = true; go.append(el('span', '', `Weiter in ${interstitialSeconds}`));
      panel.append(title, screen, go, el('p', 'ad-foot', 'Alle 5 Level eine kurze Werbung. Danach geht’s direkt weiter.'));
      v.append(panel); mount(v);
      let n = interstitialSeconds;
      const tick = setInterval(() => {
        n--; count.textContent = String(Math.max(n, 0));
        if (n > 0) { go.firstChild.textContent = `Weiter in ${n}`; return; }
        clearInterval(tick); go.disabled = false; go.firstChild.textContent = 'Weiter'; go.focus({ preventScroll: true });
      }, 1000);
      go.addEventListener('click', () => { if (go.disabled) return; close(); resolve(); });
    });
  }
  return { get isOpen() { return !!veil; }, stats, offerReveal, interstitial, close };
}
