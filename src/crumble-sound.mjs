// SquishDoku – leises Keks-Rieseln statt Plopp-Geräusch, wenn ein Keks zerbröselt.
// Selbst erzeugt (WebAudio): drei vorgerechnete Varianten aus vielen winzigen, weich gefensterten
// Rausch-Körnchen + einem Hauch Sand-Rauschen, ~1 s lang (so lange rieseln die Krümel).
// Keine harten Transienten (jedes Korn hat ein Hann-Fenster, die Stimme blendet ein/aus), höchstens
// 3 Stimmen gleichzeitig und höchstens eine neue alle 60 ms – schnelles Wischen stottert nicht.
// Folgt dem Ton-Schalter des Spiels (isOn) und hat einen eigenen, erst per Geste gestarteten AudioContext.
export function createCrumbleSound({ isOn = () => true, volume = .32 } = {}) {
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
  let ctx = null, out = null, bufs = [], voices = [], last = -1, seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  function make() {
    const sr = ctx.sampleRate, len = Math.round(sr * 1.15), b = ctx.createBuffer(1, len, sr), d = b.getChannelData(0);
    // grains: dense at the start, thinning out like the last crumbs sliding away
    for (let g = 0; g < 170; g++) {
      const t = Math.pow(rnd(), 1.8) * .98, n = Math.round(sr * (.004 + rnd() * .008)), at = Math.round(t * sr);
      const amp = (.25 + rnd() * .75) * Math.pow(1 - t, 1.2), k = .15 + rnd() * .35; // k: one-pole tone (darker / brighter crumbs)
      let y = 0;
      for (let i = 0; i < n && at + i < len; i++) { y += k * ((rnd() * 2 - 1) - y); d[at + i] += y * amp * .5 * (1 - Math.cos(2 * Math.PI * i / n)); }
    }
    // a faint sandy hiss underneath
    let y = 0;
    for (let i = 0; i < len; i++) { const t = i / sr, env = Math.min(1, t / .04) * Math.max(0, 1 - t / 1.05); y += .3 * ((rnd() * 2 - 1) - y); d[i] += y * .05 * env * env; }
    let peak = 0; for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(d[i]));
    if (peak > 0) for (let i = 0; i < len; i++) d[i] *= .9 / peak;
    return b;
  }
  function unlock() {
    if (!AC || !isOn()) return;
    try {
      if (!ctx) {
        ctx = new AC(); out = ctx.createGain(); out.gain.value = 1;
        const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 700;
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4800; lp.Q.value = .5;
        out.connect(hp); hp.connect(lp); lp.connect(ctx.destination);
        bufs = [make(), make(), make()];
      }
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    } catch {}
  }
  function play() {
    if (!ctx || !isOn() || ctx.state !== 'running' || document.hidden) return;
    const now = ctx.currentTime;
    if (now - last < .06) return; last = now;
    voices = voices.filter(v => v.end > now);
    if (voices.length >= 3) { const v = voices.shift(); v.g.gain.cancelScheduledValues(now); v.g.gain.setTargetAtTime(0, now, .04); }
    const src = ctx.createBufferSource(), g = ctx.createGain(), vol = volume * (.8 + rnd() * .3);
    src.buffer = bufs[(rnd() * bufs.length) | 0]; src.playbackRate.value = .88 + rnd() * .24;
    g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(vol, now + .03);
    g.gain.setValueAtTime(vol, now + .55); g.gain.linearRampToValueAtTime(0, now + 1.15);
    src.connect(g); g.connect(out); src.start(now); src.stop(now + 1.2);
    src.onended = () => { try { g.disconnect(); } catch {} };
    voices.push({ g, end: now + 1.2 });
  }
  function stop() { if (!ctx) return; const now = ctx.currentTime; for (const v of voices) { v.g.gain.cancelScheduledValues(now); v.g.gain.setTargetAtTime(0, now, .03); } voices = []; }
  return { unlock, play, stop, get stats() { return { state: ctx?.state || 'locked', voices: voices.filter(v => v.end > (ctx?.currentTime || 0)).length }; } };
}
