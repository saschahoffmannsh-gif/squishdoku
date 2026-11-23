// Renders the crumble trickle variants to shots/trickle-*.wav and prints numbers: spectral centroid,
// energy below 1 kHz / in 2–8 kHz, crest factor, edge levels, loudest 5 ms window vs median (click check).
import { renderTrickle } from '../src/crumble-sound.mjs';
import fs from 'fs';
const SR = 44100;
function fftMag(x) { // naive radix-2 FFT on 4096-sample frames
  const n = x.length, re = Float64Array.from(x), im = new Float64Array(n);
  for (let i = 1, j = 0; i < n; i++) { let b = n >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; } }
  for (let len = 2; len <= n; len <<= 1) { const a = -2 * Math.PI / len; for (let i = 0; i < n; i += len) for (let k = 0; k < len / 2; k++) { const c = Math.cos(a * k), s = Math.sin(a * k), ur = re[i + k], ui = im[i + k], vr = re[i + k + len / 2] * c - im[i + k + len / 2] * s, vi = re[i + k + len / 2] * s + im[i + k + len / 2] * c; re[i + k] = ur + vr; im[i + k] = ui + vi; re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi; } }
  return Array.from({ length: n / 2 }, (_, k) => re[k] * re[k] + im[k] * im[k]);
}
for (const seed of [11, 23, 37]) {
  const d = renderTrickle(SR, seed), N = 4096, P = new Float64Array(N / 2);
  for (let o = 0; o + N <= d.length; o += N / 2) { const fr = Array.from({ length: N }, (_, i) => d[o + i] * (.5 - .5 * Math.cos(2 * Math.PI * i / N))); fftMag(fr).forEach((v, k) => P[k] += v); }
  let tot = 0, cen = 0, low = 0, band = 0; P.forEach((v, k) => { const f = k * SR / N; tot += v; cen += v * f; if (f < 1000) low += v; if (f >= 2000 && f <= 8000) band += v; });
  let rms = 0, pk = 0; for (const v of d) { rms += v * v; pk = Math.max(pk, Math.abs(v)); } rms = Math.sqrt(rms / d.length);
  const W = Math.round(SR * .005), win = []; for (let o = 0; o + W <= d.length * .8; o += W) { let e = 0; for (let i = 0; i < W; i++) e += d[o + i] ** 2; win.push(Math.sqrt(e / W)); }
  const sorted = [...win].sort((a, b) => a - b), med = sorted[sorted.length >> 1], mx = sorted[sorted.length - 1];
  // the loudest single 5 ms window should not stick out of its neighbours (a click would)
  // click = a 5 ms window that is BOTH far above its neighbours (×3) AND loud (above 2× the median window)
  let clicks = 0; for (let i = 2; i < win.length - 2; i++) { const nb = (win[i - 2] + win[i - 1] + win[i + 1] + win[i + 2]) / 4; if (win[i] > 3 * nb && win[i] > 2 * med) clicks++; }
  const body = d.slice(0, Math.round(SR * .3)); let br = 0, bp = 0; for (const v of body) { br += v * v; bp = Math.max(bp, Math.abs(v)); } br = Math.sqrt(br / body.length);
  const tail = d.slice(Math.round(SR * .9), Math.round(SR * 1.2)); let tr = 0; for (const v of tail) tr += v * v; tr = Math.sqrt(tr / tail.length);
  console.log(JSON.stringify({ file: `shots/trickle-${seed}.wav`, seconds: +(d.length / SR).toFixed(2), centroidHz: Math.round(cen / tot), below1kHzPct: +(100 * low / tot).toFixed(2), band2to8kHzPct: +(100 * band / tot).toFixed(1), crestFirst300ms: +(bp / br).toFixed(1), rms: +rms.toFixed(3), first: +Math.abs(d[0]).toFixed(4), last: +Math.abs(d[d.length - 1]).toFixed(4), clicks, tailRmsVsAll: +(tr / rms).toFixed(2) }));
  const b = Buffer.alloc(44 + d.length * 2); b.write('RIFF', 0); b.writeUInt32LE(36 + d.length * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(d.length * 2, 40);
  for (let i = 0; i < d.length; i++) b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, d[i] * .375)) * 32767), 44 + i * 2); // .375 ≈ the in-game level (volume .3)
  fs.writeFileSync(new URL(`../shots/trickle-${seed}.wav`, import.meta.url), b);
}
