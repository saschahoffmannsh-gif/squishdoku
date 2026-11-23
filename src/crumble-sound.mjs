// SquishDoku – das einzige Spielgeräusch an den Keksen: ein feines Sand-Rieseln, wenn ein Keks zerbröselt.
// Granular-Synthese, einmal pro Variante vorgerechnet (beim ersten Antippen, ~ms):
//  • Tausende winzige Körnchen (0,25–1,2 ms weißes Rauschen, Hann-gefenstert → keine Knackser) mit
//    zufälligem Abstand (Poisson) – Dichte bis ~2600 Körner/s;
//  • die Dichte folgt einer Hüllkurve (sanftes Einblenden ~60 ms, langer weicher Ausklang ~1,2 s, so lange
//    rutschen die Krümel aus dem Bild) mal einer langsam schwankenden Zufallskurve (Klümpchen, kein Rauschen-Teppich);
//  • danach Bandbegrenzung ~2–8 kHz (Hochpass 4. Ordnung bei 1,9 kHz, Tiefpass bei 7 kHz): luftig, kein Rumpeln/„Whoosh“.
// Abspielen: höchstens 3 Stimmen gleichzeitig, neue frühestens alle 60 ms → schnelles Wischen stottert nicht.
// Folgt dem Ton-Schalter (isOn); eigener AudioContext, gestartet durch eine echte Berührung.
export function renderTrickle(sr, seed = 1) {
  let s = seed >>> 0 || 1; const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  const len = Math.round(sr * 1.3), d = new Float32Array(len);
  // slow random "clumps": a smoothed random walk in 0.35..1.4
  const knots = Array.from({ length: 40 }, () => .35 + rnd() * 1.05), clump = t => { const x = t / 1.3 * 39, i = Math.min(38, x | 0), f = x - i, k = f * f * (3 - 2 * f); return knots[i] * (1 - k) + knots[i + 1] * k; };
  const env = t => (t < .06 ? t / .06 : Math.exp(-(t - .06) / .38)) * Math.max(0, Math.min(1, (1.25 - t) / .2));
  const PEAK = 2600;
  for (let t = 0; ;) {
    const rate = Math.max(30, PEAK * env(t) * clump(t)); t += -Math.log(1 - rnd()) / rate; if (t >= 1.25) break;
    const e = env(t); if (e < .002) continue;
    const n = Math.round(sr * (.00025 + rnd() * .00095)), at = Math.round(t * sr), a = (.55 + .45 * rnd()) * e * (rnd() < .5 ? -1 : 1);
    for (let i = 0; i < n && at + i < len; i++) d[at + i] += a * (rnd() * 2 - 1) * .5 * (1 - Math.cos(2 * Math.PI * (i + .5) / n));
  }
  // band-limit ~2–8 kHz (RBJ biquads): 2× high-pass 1.9 kHz, 1× low-pass 7 kHz
  const biquad = (type, f0, q) => { const w = 2 * Math.PI * f0 / sr, cw = Math.cos(w), al = Math.sin(w) / (2 * q); let b0, b1, b2; if (type === 'hp') { b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = b0; } else { b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = b0; } const a0 = 1 + al, a1 = -2 * cw, a2 = 1 - al; let x1 = 0, x2 = 0, y1 = 0, y2 = 0; for (let i = 0; i < len; i++) { const x = d[i], y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0; x2 = x1; x1 = x; y2 = y1; y1 = y; d[i] = y; } };
  biquad('hp', 1900, .707); biquad('hp', 1900, .707); biquad('lp', 7000, .707);
  // soft edges + normalise
  const fi = Math.round(sr * .01), fo = Math.round(sr * .05);
  for (let i = 0; i < fi; i++) d[i] *= i / fi; for (let i = 0; i < fo; i++) d[len - 1 - i] *= i / fo;
  let peak = 0; for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(d[i])); if (peak) for (let i = 0; i < len; i++) d[i] *= .8 / peak;
  return d;
}
export function createCrumbleSound({ isOn = () => true, volume = .3 } = {}) {
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
  let ctx = null, out = null, bufs = [], voices = [], last = -1, seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  function unlock() {
    if (!AC || !isOn()) return;
    try {
      if (!ctx) {
        ctx = new AC(); out = ctx.createGain(); out.gain.value = 1;
        const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1600; // safety: nothing low ever reaches the speaker
        out.connect(hp); hp.connect(ctx.destination);
        bufs = [11, 23, 37].map(sd => { const d = renderTrickle(ctx.sampleRate, sd), b = ctx.createBuffer(1, d.length, ctx.sampleRate); b.getChannelData(0).set(d); return b; });
      }
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    } catch {}
  }
  function play() {
    if (!ctx || !bufs.length || !isOn() || ctx.state !== 'running' || document.hidden) return;
    const now = ctx.currentTime;
    if (now - last < .06) return; last = now;
    voices = voices.filter(v => v.end > now);
    if (voices.length >= 3) { const v = voices.shift(); v.g.gain.cancelScheduledValues(now); v.g.gain.setTargetAtTime(0, now, .05); }
    const src = ctx.createBufferSource(), g = ctx.createGain(), vol = volume * (.8 + rnd() * .3);
    src.buffer = bufs[(rnd() * bufs.length) | 0]; src.playbackRate.value = .94 + rnd() * .12;
    g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(vol, now + .04);
    src.connect(g); g.connect(out); src.start(now); src.stop(now + 1.4);
    src.onended = () => { try { g.disconnect(); } catch {} };
    voices.push({ g, end: now + 1.4 });
  }
  function stop() { if (!ctx) return; const now = ctx.currentTime; for (const v of voices) { v.g.gain.cancelScheduledValues(now); v.g.gain.setTargetAtTime(0, now, .03); } voices = []; }
  return { unlock, play, stop, get stats() { return { state: ctx?.state || 'locked', voices: voices.filter(v => v.end > (ctx?.currentTime || 0)).length }; } };
}
