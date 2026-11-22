// SquishDoku – Keks-Spielsteine (Design-Studie). Prozedurale three.js-Kekse: gebackener Teig mit Krümelkante,
// glänzender Zuckerguss als Höhenfeld (Gesicht = gespritzte Linien), Zustände normal / leuchtend / zerbröselt.
// Gleiche three.js-Version wie das Spiel (r180 aus vendor/squish-attack), damit die Steine später ins Brett können.
import { THREE } from '../../vendor/squish-attack/squish/squish-graphics.js';
export { THREE };

// ---------- Farben & Tiere (Spiel-Palette: 1 blau, 2 rot, 3 grün, 4 orange, 5 lila, 7 pink, 8 türkis, 9 weiß; 6 gelb = Leuchtfarbe) ----------
export const PALETTE = [
  { key: 1, name: 'Blau', hex: '#1aa7f0', animal: 'penguin', tier: 'Pinguin' },
  { key: 2, name: 'Rot', hex: '#e8263f', animal: 'fox', tier: 'Fuchs' },
  { key: 3, name: 'Grün', hex: '#2fc24e', animal: 'frog', tier: 'Frosch' },
  { key: 4, name: 'Orange', hex: '#ff8a1c', animal: 'lion', tier: 'Löwe' },
  { key: 5, name: 'Lila', hex: '#8f45ff', animal: 'owl', tier: 'Eule' },
  { key: 7, name: 'Pink', hex: '#f45bb8', animal: 'pig', tier: 'Schwein' },
  { key: 8, name: 'Türkis', hex: '#1fcfc4', animal: 'cat', tier: 'Katze' },
  { key: 9, name: 'Weiß', hex: '#f3efe8', animal: 'bunny', tier: 'Hase' },
];
export const byKey = Object.fromEntries(PALETTE.map(p => [p.key, p]));

// ---------- Rauschen ----------
function hash3(x, y, z) { let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
  const s = t => t * t * (3 - 2 * t), u = s(xf), v = s(yf), w = s(zf);
  const L = (a, b, t) => a + (b - a) * t, h = (i, j, k) => hash3(xi + i, yi + j, zi + k);
  return L(L(L(h(0,0,0), h(1,0,0), u), L(h(0,1,0), h(1,1,0), u), v), L(L(h(0,0,1), h(1,0,1), u), L(h(0,1,1), h(1,1,1), u), v), w) * 2 - 1;
}
export const fbm = (x, y, z, o = 4) => { let a = 0, f = 1, amp = .5; for (let i = 0; i < o; i++) { a += amp * vnoise(x * f, y * f, z * f); f *= 2.03; amp *= .5; } return a; };
const rand = (() => { let s = 12345; return (seed) => { if (seed != null) s = seed; s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; })();

// ---------- Teig-Texturen (Farbe + Bump), einmal erzeugt ----------
const TEX = {};
function canvas(n) { const c = document.createElement('canvas'); c.width = c.height = n; return c; }
function doughTextures() {
  if (TEX.dough) return TEX.dough;
  const n = 512, c = canvas(n), b = canvas(n), cx = c.getContext('2d'), bx = b.getContext('2d');
  const ci = cx.createImageData(n, n), bi = bx.createImageData(n, n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const u = x / n * 8, v = y / n * 8; // tileable enough at this scale
    const big = fbm(u * .7, v * .7, 1.3, 3), fine = fbm(u * 5, v * 5, 7.1, 3), pit = vnoise(u * 11, v * 11, 3.3);
    const i = (y * n + x) * 4, k = .5 + .5 * big;
    // golden shortbread: cream → toasted spots
    ci.data[i] = 236 - 26 * k + 12 * fine; ci.data[i + 1] = 196 - 40 * k + 10 * fine; ci.data[i + 2] = 140 - 46 * k + 8 * fine; ci.data[i + 3] = 255;
    const h = 128 + 60 * fine + 40 * big - (pit > .55 ? 90 : 0); bi.data[i] = bi.data[i + 1] = bi.data[i + 2] = Math.max(0, Math.min(255, h)); bi.data[i + 3] = 255;
  }
  cx.putImageData(ci, 0, 0); bx.putImageData(bi, 0, 0);
  const map = new THREE.CanvasTexture(c), bump = new THREE.CanvasTexture(b);
  for (const t of [map, bump]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(.55, .55); t.anisotropy = 8; }
  map.colorSpace = THREE.SRGBColorSpace;
  return TEX.dough = { map, bump };
}

// ---------- Umrisse ----------
// returns inside(x,y) for the cookie outline in [-1,1]² (y up)
const ell = (cx, cy, rx, ry) => (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
const tri = (ax, ay, bx, by, cx, cy) => (x, y) => { const s = (px, py, qx, qy) => (x - qx) * (py - qy) - (px - qx) * (y - qy); const d1 = s(ax, ay, bx, by), d2 = s(bx, by, cx, cy), d3 = s(cx, cy, ax, ay); return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0)); };
const union = (...f) => (x, y) => f.some(g => g(x, y));
const roundRect = (h, r) => (x, y) => { const qx = Math.max(Math.abs(x) - (h - r), 0), qy = Math.max(Math.abs(y) - (h - r), 0); return qx * qx + qy * qy <= r * r; };
export const SILHOUETTE = {
  fox: union(ell(0, -.1, .74, .66), ell(0, -.3, .9, .5), tri(-.78, .2, -.18, .5, -.62, .95), tri(.78, .2, .18, .5, .62, .95)),
  penguin: union(ell(0, -.04, .76, .9), ell(-.7, -.28, .2, .32), ell(.7, -.28, .2, .32), ell(-.2, -.86, .2, .1), ell(.2, -.86, .2, .1)),
  frog: union(ell(0, -.14, .93, .7), ell(-.46, .42, .34, .32), ell(.46, .42, .34, .32)),
  lion: (x, y) => { const r = Math.hypot(x, y), a = Math.atan2(y, x); return r <= .84 + .08 * Math.cos(12 * a); },
  owl: union(roundRect(.82, .45), tri(-.82, .45, -.3, .7, -.78, 1), tri(.82, .45, .3, .7, .78, 1)),
  pig: union(ell(0, -.06, .8, .76), tri(-.8, .25, -.25, .62, -.78, .9), tri(.8, .25, .25, .62, .78, .9)),
  cat: union(ell(0, -.12, .8, .72), tri(-.78, .1, -.2, .5, -.6, .98), tri(.78, .1, .2, .5, .6, .98)),
  bunny: union(ell(0, -.26, .74, .66), ell(-.27, .5, .19, .46), ell(.27, .5, .19, .46)),
};
// outline polygon by marching rays from the centre (all shapes are star-shaped)
function polar(inside, n = 220, rMax = 1.05) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2; let lo = 0, hi = rMax;
    // last inside point along the ray (coarse march, then refine)
    let last = 0; for (let r = 0; r <= rMax; r += .01) if (inside(Math.cos(a) * r, Math.sin(a) * r)) last = r;
    lo = last; hi = Math.min(rMax, last + .01); for (let k = 0; k < 8; k++) { const m = (lo + hi) / 2; if (inside(Math.cos(a) * m, Math.sin(a) * m)) lo = m; else hi = m; }
    pts.push([Math.cos(a) * lo, Math.sin(a) * lo]);
  }
  // smooth a little (rounded cut-out corners, like a real cutter)
  for (let it = 0; it < 3; it++) { const q = pts.map(p => p.slice()); for (let i = 0; i < pts.length; i++) { const a = q[(i + pts.length - 1) % pts.length], b = q[i], c = q[(i + 1) % pts.length]; pts[i] = [(a[0] + 2 * b[0] + c[0]) / 4, (a[1] + 2 * b[1] + c[1]) / 4]; } }
  return pts;
}
const shapeFrom = (pts, s = 1) => { const sh = new THREE.Shape(); pts.forEach(([x, y], i) => i ? sh.lineTo(x * s, y * s) : sh.moveTo(x * s, y * s)); sh.closePath(); return sh; };
function insidePoly(pts) { return (x, y) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; }; }

// ---------- Gesichter (2D, gespritzter Zuckerguss) ----------
// Each painter draws into a colour canvas and a height canvas, coordinates in cookie units [-1,1], y up.
const ICE = { white: '#fffaf2', dark: '#2b1a17', cheek: '#ff8fae', orange: '#ff9a2a', cream: '#fff1d6', pinkL: '#ffc2dc' };
function painter(ctxC, ctxH, N) {
  const T = (x, y) => [(x + 1) / 2 * N, (1 - (y + 1) / 2) * N], S = r => r / 2 * N;
  const P = {
    fill(path, color, h) { ctxC.fillStyle = color; ctxC.fill(path); ctxH.fillStyle = `rgb(${h},${h},${h})`; ctxH.fill(path); },
    path(fn) { const p = new Path2D(); fn(p, T, S); return p; },
    ell(x, y, rx, ry, color, h, rot = 0) { const [px, py] = T(x, y); P.fill(P.path(p => p.ellipse(px, py, S(rx), S(ry), -rot, 0, Math.PI * 2)), color, h); },
    poly(pts, color, h) { P.fill(P.path(p => pts.forEach(([x, y], i) => { const [px, py] = T(x, y); i ? p.lineTo(px, py) : p.moveTo(px, py); })), color, h); },
    line(pts, w, color, h, curve) { // piped line (round caps)
      const p = new Path2D(); pts.forEach(([x, y], i) => { const [px, py] = T(x, y); i ? p.lineTo(px, py) : p.moveTo(px, py); });
      for (const [c, s] of [[ctxC, color], [ctxH, `rgb(${h},${h},${h})`]]) { c.lineCap = c.lineJoin = 'round'; c.lineWidth = S(w); c.strokeStyle = s; c.stroke(p); }
    },
    arc(x, y, r, a0, a1, w, color, h) { const pts = []; for (let i = 0; i <= 24; i++) { const a = a0 + (a1 - a0) * i / 24; pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]); } P.line(pts, w, color, h); },
    eye(x, y, r = .1) { P.ell(x, y, r, r * 1.15, ICE.dark, 235); P.ell(x - r * .35, y + r * .4, r * .32, r * .32, ICE.white, 250); },
    cheeks(y = -.2, dx = .48, r = .11) { P.ell(-dx, y, r, r * .7, ICE.cheek, 205); P.ell(dx, y, r, r * .7, ICE.cheek, 205); },
  };
  return P;
}
// set: 'A' round (ears drawn inside), 'B' cut-out (ears are the silhouette), 'C' pillow
export const FACES = {
  penguin(P, set) { const c = '#1f86d4';
    P.ell(-.24, -.02, .34, .4, ICE.white, 215); P.ell(.24, -.02, .34, .4, ICE.white, 215); P.ell(0, -.3, .5, .36, ICE.white, 215);
    P.eye(-.23, .06); P.eye(.23, .06); P.poly([[-.12, -.12], [.12, -.12], [0, -.3]], ICE.orange, 240); P.cheeks(-.2, .44, .09); },
  fox(P, set) {
    if (set !== 'B') for (const s of [-1, 1]) { const o = [[s * .52, .72], [s * .72, .3], [s * .24, .44]]; P.poly(o, '#a8122b', 222); P.line([...o, o[0]], .07, '#a8122b', 222); P.poly([[s * .51, .6], [s * .61, .38], [s * .37, .45]], '#ff9fb0', 228); }
    else { P.poly([[-.6, .82], [-.5, .38], [-.3, .52]], '#ffd4c8', 220); P.poly([[.6, .82], [.5, .38], [.3, .52]], '#ffd4c8', 220); }
    P.ell(-.3, -.34, .36, .28, ICE.white, 215); P.ell(.3, -.34, .36, .28, ICE.white, 215); P.ell(0, -.42, .26, .22, ICE.white, 215);
    P.eye(-.3, .06, .09); P.eye(.3, .06, .09); P.ell(0, -.24, .1, .07, ICE.dark, 245); P.arc(-.06, -.36, .06, Math.PI * 1.1, Math.PI * 1.9, .035, ICE.dark, 240); P.arc(.06, -.36, .06, Math.PI * 1.1, Math.PI * 1.9, .035, ICE.dark, 240); },
  frog(P, set) {
    P.ell(-.44, .4, .22, .22, ICE.white, 245); P.ell(.44, .4, .22, .22, ICE.white, 245); P.ell(-.44, .38, .11, .12, ICE.dark, 255); P.ell(.44, .38, .11, .12, ICE.dark, 255);
    P.ell(-.48, .44, .04, .04, ICE.white, 255); P.ell(.4, .44, .04, .04, ICE.white, 255);
    P.arc(0, -.05, .42, Math.PI * 1.15, Math.PI * 1.85, .06, ICE.dark, 240); P.ell(-.08, .02, .03, .03, ICE.dark, 235); P.ell(.08, .02, .03, .03, ICE.dark, 235); P.cheeks(-.25, .55, .12); },
  lion(P, set) {
    if (set !== 'B') for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; P.ell(Math.cos(a) * .66, Math.sin(a) * .66, .17, .17, '#c2560a', 212); }
    else for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; P.ell(Math.cos(a) * .7, Math.sin(a) * .7, .14, .14, '#c2560a', 212); }
    P.ell(0, 0, .52, .5, '#ffc46b', 214); P.ell(-.4, .4, .1, .1, '#ffc46b', 214); P.ell(.4, .4, .1, .1, '#ffc46b', 214);
    P.eye(-.2, .1, .08); P.eye(.2, .1, .08); P.ell(0, -.12, .17, .13, ICE.cream, 225); P.poly([[-.09, -.04], [.09, -.04], [0, -.13]], '#5a2a10', 245);
    P.line([[0, -.13], [0, -.2]], .03, '#5a2a10', 240); P.arc(-.06, -.2, .06, Math.PI * 1.1, Math.PI * 1.9, .03, '#5a2a10', 240); P.arc(.06, -.2, .06, Math.PI * 1.1, Math.PI * 1.9, .03, '#5a2a10', 240); P.cheeks(-.12, .36, .08); },
  owl(P, set) {
    if (set !== 'B') { P.poly([[-.62, .66], [-.48, .38], [-.28, .5]], '#4d1ea8', 222); P.poly([[.62, .66], [.48, .38], [.28, .5]], '#4d1ea8', 222); }
    P.ell(-.26, .14, .25, .25, ICE.white, 230); P.ell(.26, .14, .25, .25, ICE.white, 230); P.ell(-.26, .12, .12, .13, ICE.dark, 248); P.ell(.26, .12, .12, .13, ICE.dark, 248);
    P.ell(-.3, .17, .04, .04, ICE.white, 255); P.ell(.22, .17, .04, .04, ICE.white, 255); P.poly([[-.07, -.08], [.07, -.08], [0, -.24]], ICE.orange, 242);
    for (const [x, y] of [[-.22, -.42], [0, -.5], [.22, -.42]]) P.line([[x - .08, y + .05], [x, y - .03], [x + .08, y + .05]], .04, '#d9c2ff', 225); },
  pig(P, set) {
    if (set !== 'B') { P.poly([[-.6, .58], [-.52, .26], [-.26, .46]], '#c43c8c', 220); P.poly([[.6, .58], [.52, .26], [.26, .46]], '#c43c8c', 220); }
    else { P.poly([[-.62, .74], [-.52, .36], [-.32, .5]], '#ffc2dc', 220); P.poly([[.62, .74], [.52, .36], [.32, .5]], '#ffc2dc', 220); }
    P.ell(0, -.22, .3, .21, ICE.pinkL, 238); P.ell(-.1, -.22, .055, .075, '#9c2a6a', 250); P.ell(.1, -.22, .055, .075, '#9c2a6a', 250);
    P.eye(-.3, .12, .085); P.eye(.3, .12, .085); P.cheeks(-.14, .52, .1); },
  cat(P, set) {
    if (set !== 'B') { P.poly([[-.64, .64], [-.52, .24], [-.26, .5]], ICE.pinkL, 220); P.poly([[.64, .64], [.52, .24], [.26, .5]], ICE.pinkL, 220); }
    else { P.poly([[-.56, .86], [-.48, .42], [-.28, .54]], ICE.pinkL, 220); P.poly([[.56, .86], [.48, .42], [.28, .54]], ICE.pinkL, 220); }
    P.arc(-.27, .02, .11, Math.PI * .15, Math.PI * .85, .055, ICE.dark, 242); P.arc(.27, .02, .11, Math.PI * .15, Math.PI * .85, .055, ICE.dark, 242);
    P.poly([[-.07, -.1], [.07, -.1], [0, -.18]], '#ff7aa2', 245); P.arc(-.06, -.2, .06, Math.PI * 1.1, Math.PI * 1.9, .03, ICE.dark, 238); P.arc(.06, -.2, .06, Math.PI * 1.1, Math.PI * 1.9, .03, ICE.dark, 238);
    for (const s of [-1, 1]) for (const dy of [-.1, -.2]) P.line([[s * .2, dy - .02], [s * .52, dy + (dy + .15) * .3]], .025, ICE.white, 228); P.cheeks(-.12, .42, .08); },
  bunny(P, set) {
    if (set === 'B') { P.ell(-.27, .52, .08, .3, ICE.pinkL, 222); P.ell(.27, .52, .08, .3, ICE.pinkL, 222); }
    else { P.ell(-.22, .5, .1, .3, ICE.pinkL, 220, .15); P.ell(.22, .5, .1, .3, ICE.pinkL, 220, -.15); }
    const y0 = set === 'B' ? -.22 : -.08;
    P.eye(-.26, y0 + .08, .08); P.eye(.26, y0 + .08, .08); P.ell(0, y0 - .08, .07, .05, '#ff7aa2', 245);
    P.arc(-.05, y0 - .14, .05, Math.PI * 1.1, Math.PI * 1.9, .03, ICE.dark, 238); P.arc(.05, y0 - .14, .05, Math.PI * 1.1, Math.PI * 1.9, .03, ICE.dark, 238); P.cheeks(y0 - .06, .44, .09); },
};

// ---------- Zuckerguss-Höhenfeld ----------
// mask: inside(x,y) for the icing area; returns {colorTex, heightData(N²), maskData}
function icingCanvases({ inside, color, animal, set, N = 640, base = 150, flood = false, faceScale = 1, faceY = 0 }) {
  const cC = canvas(N), cH = canvas(N), cM = canvas(N); const xC = cC.getContext('2d'), xH = cH.getContext('2d'), xM = cM.getContext('2d');
  // mask
  const md = xM.createImageData(N, N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const u = x / N * 2 - 1, v = 1 - y / N * 2; const i = (y * N + x) * 4; const k = inside(u, v) ? 255 : 0; md.data[i] = md.data[i + 1] = md.data[i + 2] = k; md.data[i + 3] = 255; }
  xM.putImageData(md, 0, 0);
  // colour: base icing colour inside the mask
  xC.fillStyle = color; xC.fillRect(0, 0, N, N);
  // height: blurred mask = soft rounded icing edge (royal icing flows and domes)
  xH.filter = `blur(${N * .012}px)`; xH.drawImage(cM, 0, 0); xH.filter = 'none';
  xH.globalCompositeOperation = 'multiply'; xH.fillStyle = `rgb(${base},${base},${base})`; xH.fillRect(0, 0, N, N); xH.globalCompositeOperation = 'source-over';
  // face details on separate layers so the height gets a piped, rounded profile
  const fC = canvas(N), fH = canvas(N), fx = fC.getContext('2d'), fh = fH.getContext('2d');
  fx.translate(N / 2, N / 2); fx.scale(faceScale, faceScale); fx.translate(-N / 2, -N / 2 - faceY * N / 2);
  fh.setTransform(fx.getTransform());
  FACES[animal](painter(fx, fh, N), set);
  xC.drawImage(fC, 0, 0);
  // piping: face layer replaces the base height where drawn, softened into round beads
  const tmp = canvas(N), tx = tmp.getContext('2d'); tx.filter = `blur(${N * .006}px)`; tx.drawImage(fH, 0, 0);
  xH.globalCompositeOperation = 'lighten'; xH.drawImage(tmp, 0, 0); xH.globalCompositeOperation = 'source-over';
  // keep everything inside the mask
  xH.globalCompositeOperation = 'destination-in'; xH.drawImage(cM, 0, 0); xH.globalCompositeOperation = 'source-over';
  const hd = xH.getImageData(0, 0, N, N).data, H = new Float32Array(N * N), M = new Uint8Array(N * N), md2 = xM.getImageData(0, 0, N, N).data;
  for (let i = 0; i < N * N; i++) { H[i] = hd[i * 4] / 255; M[i] = md2[i * 4] > 127 ? 1 : 0; }
  const tex = new THREE.CanvasTexture(cC); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const maskTex = new THREE.CanvasTexture(cM);
  return { tex, H, M, N, colorCanvas: cC, maskTex };
}
// grid mesh over [-1,1]² displaced by the height field, triangles outside the mask dropped
function heightMesh({ H, M, N }, res, scale, zBase, thick) {
  const sample = (u, v) => { const x = Math.min(N - 1, Math.max(0, Math.round((u + 1) / 2 * (N - 1)))), y = Math.min(N - 1, Math.max(0, Math.round((1 - (v + 1) / 2) * (N - 1)))); return [H[y * N + x], M[y * N + x]]; };
  const pos = [], uv = [], idx = [], keep = [];
  for (let j = 0; j <= res; j++) for (let i = 0; i <= res; i++) {
    const u = i / res * 2 - 1, v = j / res * 2 - 1, [h, m] = sample(u, v);
    pos.push(u * scale, zBase + h * thick, -v * scale); uv.push((u + 1) / 2, (v + 1) / 2); keep.push(m);
  }
  const id = (i, j) => j * (res + 1) + i;
  for (let j = 0; j < res; j++) for (let i = 0; i < res; i++) {
    const a = id(i, j), b = id(i + 1, j), c = id(i, j + 1), d = id(i + 1, j + 1);
    if (keep[a] + keep[b] + keep[c] + keep[d] >= 1) { idx.push(a, b, c, b, d, c); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  g.computeVertexNormals(); return g;
}

// ---------- Keks-Körper ----------
function crumbleGeometry(g, amt, seed = 1) { // crisp, slightly irregular baked edge
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), n = fbm(x * 3.1 + seed, y * 3.1, z * 3.1, 4), f = fbm(x * 14, y * 14 + seed, z * 14, 2);
    const r = Math.hypot(x, z) || 1; const k = amt * (n * .8 + f * .35); p.setXYZ(i, x + x / r * k, y + k * .4, z + z / r * k); }
  g.computeVertexNormals(); return g;
}
function bodyGeometry(shape, depth, bevel, seg = 5) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * .9, bevelSegments: seg, curveSegments: 1, steps: 1 });
  g.rotateX(-Math.PI / 2); g.translate(0, bevel, 0); // sits on y=0, top at depth+2·bevel
  return g;
}
// golden-brown baking: darker toward the rim and the bottom, pale in the middle of the top
export function bake(g, strength = 1) {
  const p = g.attributes.position; let R = 0, Y = 0; for (let i = 0; i < p.count; i++) { R = Math.max(R, Math.hypot(p.getX(i), p.getZ(i))); Y = Math.max(Y, p.getY(i)); }
  const col = new Float32Array(p.count * 3), pale = new THREE.Color('#fff2de'), gold = new THREE.Color('#e0a35a'), brown = new THREE.Color('#9a5a26'), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), r = Math.hypot(x, z) / R, n = fbm(x * 2.3, y * 2.3, z * 2.3, 3);
    const edge = Math.min(1, Math.max(0, (r - .72) / .28)), low = 1 - y / Y;
    let t = Math.min(1, Math.max(0, (edge * .65 + low * .55 + n * .25) * strength));
    c.copy(pale).lerp(gold, Math.min(1, t * 1.6)); if (t > .6) c.lerp(brown, (t - .6) / .4 * .8);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g;
}

const MAT = {};
export function doughMaterial(tint) {
  const k = 'dough' + (tint || '');
  if (MAT[k]) return MAT[k];
  const { map, bump } = doughTextures();
  const m = new THREE.MeshPhysicalMaterial({ map, bumpMap: bump, bumpScale: 2.6, roughness: .82, vertexColors: true, sheen: .25, sheenColor: new THREE.Color('#ffd9a0'), sheenRoughness: .8 });
  if (tint) { m.color = new THREE.Color(tint); }
  return MAT[k] = m;
}

// ---------- Ein Keks ----------
// set 'A' Zuckerguss-Kekse · 'B' Tier-Ausstecher · 'C' Kissen-Kekse; state 'normal' | 'lit' | 'crumbled'
const CACHE = new Map();
export function buildCookie(set, key, { state = 'normal', size = 1, seed = key } = {}) {
  const P = byKey[key], g = new THREE.Group(); g.name = `cookie-${set}-${P.animal}`;
  const ck = set + key;
  let entry = CACHE.get(ck);
  if (!entry) { const d = DESIGN[set](P); entry = { def: d, parts: d.build() }; CACHE.set(ck, entry); }
  const { def, parts } = entry;
  if (state === 'crumbled') { g.add(crumbs(def, P, seed)); g.scale.setScalar(size); return g; }
  for (const [geo, mat] of parts) { const m = new THREE.Mesh(geo, mat); m.castShadow = m.receiveShadow = true; g.add(m); }
  if (state === 'lit') addGlow(g, def, P);
  g.scale.setScalar(size);
  return g;
}

function icingMaterial(tex, alphaMap) {
  return new THREE.MeshPhysicalMaterial({ map: tex, alphaMap, alphaTest: .5, clearcoat: .7, roughness: .42, clearcoatRoughness: .12 });
}

export const DESIGN = {
  // A: runder Mürbeteig-Keks, oben glänzender Zuckerguss, Gesicht gespritzt
  A: P => ({ top: .3, build() {
    const pts = polar((x, y) => Math.hypot(x, y) <= .93, 160);
    const body = bake(crumbleGeometry(bodyGeometry(shapeFrom(pts), .16, .07), .022, P.key));
    const ice = icingCanvases({ inside: (x, y) => Math.hypot(x, y) <= .8, color: P.hex, animal: P.animal, set: 'A', faceScale: .9 });
    const top = heightMesh(ice, 150, 1, .295, .075);
    this.ice = ice; this.pts = pts; this.iceR = .8;
    return [[body, doughMaterial()], [top, icingMaterial(ice.tex, ice.maskTex)]];
  } }),
  // B: Ausstecher in Kopf-Form, ganz glasiert bis kurz vor die Kante
  B: P => ({ top: .28, build() {
    const inside = SILHOUETTE[P.animal], pts = polar(inside, 220).map(([x, y]) => [x * .96, y * .96]);
    const body = bake(crumbleGeometry(bodyGeometry(shapeFrom(pts), .15, .065), .016, P.key));
    const inner = polar(inside, 220).map(([x, y]) => [x * .87, y * .87]);
    const ice = icingCanvases({ inside: insidePoly(inner), color: P.hex, animal: P.animal, set: 'B', faceScale: .92 });
    const top = heightMesh(ice, 160, 1, .275, .075);
    this.pts = pts; this.ice = ice;
    return [[body, doughMaterial()], [top, icingMaterial(ice.tex, ice.maskTex)]];
  } }),
  // C: weicher Kissen-Keks (Squish-Form), gefärbter Teig mit rundem Kissenrand, Gesicht aus Guss, bunte Streusel
  C: P => ({ top: .5, build() {
    const pillow = pillowSurface(.86, .4, .46), tint = new THREE.Color(P.hex).lerp(new THREE.Color('#fff3e0'), P.key === 9 ? 0 : .05);
    const [topG, botG] = pillow.meshes(170);
    const toast = new THREE.Color('#b8743a');
    for (const g of [topG, botG]) { // a little golden toast on the underside and the lower edge
      const p = g.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
      for (let i = 0; i < p.count; i++) { const y = p.getY(i), t = Math.max(0, Math.min(1, (.3 - y) / .3)) ** 1.5 * .55 + .06 * fbm(p.getX(i) * 4, y * 4, p.getZ(i) * 4, 2); c.copy(tint).lerp(toast, Math.max(0, t)); col.set([c.r, c.g, c.b], i * 3); }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    }
    const dough = new THREE.MeshPhysicalMaterial({ vertexColors: true, bumpMap: doughTextures().bump, bumpScale: 1.6, roughness: .74, sheen: .3, sheenColor: new THREE.Color('#ffffff'), sheenRoughness: .7 });
    const ice = icingCanvases({ inside: roundRect(.72, .3), color: '#000', animal: P.animal, set: 'C', base: 0, faceScale: .84, faceY: .02 });
    const detail = new THREE.CanvasTexture(ice.colorCanvas); detail.colorSpace = THREE.SRGBColorSpace;
    const M2 = new Uint8Array(ice.N * ice.N), ac = canvas(ice.N), ax = ac.getContext('2d'), ad = ax.createImageData(ice.N, ice.N);
    for (let i = 0; i < M2.length; i++) { M2[i] = ice.H[i] > .2 ? 1 : 0; ad.data[i * 4] = ad.data[i * 4 + 1] = ad.data[i * 4 + 2] = ice.H[i] > .3 ? 255 : 0; ad.data[i * 4 + 3] = 255; } ax.putImageData(ad, 0, 0);
    const top = heightMesh({ H: ice.H, M: M2, N: ice.N }, 190, 1, 0, .05);
    const tp = top.attributes.position; for (let i = 0; i < tp.count; i++) tp.setY(i, tp.getY(i) + pillow.height(tp.getX(i), tp.getZ(i)) - .006); top.computeVertexNormals();
    const parts = [[topG, dough], [botG, dough], [top, icingMaterial(detail, new THREE.CanvasTexture(ac))]];
    const sp = new THREE.CapsuleGeometry(.017, .065, 3, 6), cols = ['#ffffff', '#ffd23f', '#ff6fa8', '#5cc8ff', '#9df25a', '#b98cff'];
    const rnd = (s => () => (s = (s * 16807) % 2147483647) / 2147483647)(P.key * 977 + 3), placed = [];
    for (let k = 0; k < 24; k++) {
      let x, z, tries = 0; do { x = (rnd() * 2 - 1) * .7; z = (rnd() * 2 - 1) * .7; tries++; } while (tries < 60 && (Math.hypot(x / .6, z / .58) < 1 || placed.some(q => Math.hypot(q[0] - x, q[1] - z) < .13)));
      placed.push([x, z]);
      const g2 = sp.clone(); g2.rotateZ(Math.PI / 2); g2.rotateY(rnd() * Math.PI); g2.translate(x, pillow.height(x, z) + .012, z);
      parts.push([g2, new THREE.MeshPhysicalMaterial({ color: cols[k % cols.length], roughness: .28, clearcoat: 1, clearcoatRoughness: .08 })]);
    }
    this.pts = polar(roundRect(.86, .4), 160); this.ice = ice; this.base = tint; return parts;
  } }),
};

// Kissen-Fläche: abgerundetes Quadrat (halbe Breite h, Eckradius r), voll gerundeter Rand, leicht gewölbte Oberseite
function pillowSurface(h, r, T) {
  const rho = T / 2;
  const sdf = (x, z) => { const qx = Math.abs(x) - (h - r), qz = Math.abs(z) - (h - r); return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - r; };
  const dome = (x, z, d) => .07 * Math.min(1, -d / (rho * 1.6)) * (1 - (x * x + z * z) / (2 * h * h));
  const half = (x, z) => { const d = Math.min(0, sdf(x, z)); return -d >= rho ? rho : Math.sqrt(Math.max(0, rho * rho - (rho + d) ** 2)); };
  const height = (x, z) => { const d = sdf(x, z); return rho + half(x, z) + (d < 0 ? dome(x, z, d) : 0) + .006 * fbm(x * 9, 0, z * 9, 2); };
  const toEdge = (x, z) => { let d = sdf(x, z); for (let k = 0; k < 4 && d > 0; k++) { const e = 1e-3, gx = (sdf(x + e, z) - sdf(x - e, z)) / (2 * e), gz = (sdf(x, z + e) - sdf(x, z - e)) / (2 * e), gl = Math.hypot(gx, gz) || 1; x -= gx / gl * d; z -= gz / gl * d; d = sdf(x, z); } return [x, z]; };
  function meshes(res) {
    const out = [];
    for (const side of [1, -1]) {
      const pos = [], uv = [], idx = [];
      for (let j = 0; j <= res; j++) for (let i = 0; i <= res; i++) {
        // denser near the rim: warp the grid toward the edge
        const w = t => Math.sign(t) * (1 - (1 - Math.abs(t)) ** 1.35);
        let x = w(i / res * 2 - 1) * (h + .02), z = w(j / res * 2 - 1) * (h + .02);
        if (sdf(x, z) > 0) [x, z] = toEdge(x, z);
        const y = side > 0 ? height(x, z) : rho - half(x, z) * .96 - (sdf(x, z) < -rho ? .0 : 0);
        pos.push(x, Math.max(0, y), z); uv.push((x + 1) / 2, (1 - z) / 2);
      }
      for (let j = 0; j < res; j++) for (let i = 0; i < res; i++) { const a = j * (res + 1) + i, b = a + 1, c = a + res + 1, d = c + 1; side > 0 ? idx.push(a, c, b, b, c, d) : idx.push(a, b, c, b, d, c); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
      out.push(g);
    }
    return out;
  }
  return { sdf, height, meshes };
}

// ---------- Leuchten: der Guss glimmt golden, Halo + Glanzstern ----------
let HALO = null;
function haloTexture() {
  if (HALO) return HALO; const c = canvas(256), x = c.getContext('2d'), g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,200,70,.0)'); g.addColorStop(.42, 'rgba(255,196,60,.10)'); g.addColorStop(.6, 'rgba(255,205,80,.85)'); g.addColorStop(.72, 'rgba(255,170,40,.35)'); g.addColorStop(1, 'rgba(255,150,20,0)'); x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  HALO = new THREE.CanvasTexture(c); HALO.colorSpace = THREE.SRGBColorSpace; return HALO;
}
let STAR = null;
function starTexture() {
  if (STAR) return STAR; const c = canvas(256), x = c.getContext('2d'); x.translate(128, 128);
  const g = x.createRadialGradient(0, 0, 0, 0, 0, 30); g.addColorStop(0, '#fff'); g.addColorStop(1, 'rgba(255,240,180,0)'); x.fillStyle = g; x.beginPath(); x.arc(0, 0, 30, 0, 7); x.fill();
  x.fillStyle = '#fff'; x.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = i % 2 ? 14 : 118; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); } x.closePath(); x.fill();
  STAR = new THREE.CanvasTexture(c); STAR.colorSpace = THREE.SRGBColorSpace; return STAR;
}
function addGlow(g, def, P) {
  // icing glows from inside (emissive on the icing only), golden rim light, halo on the table, sparkle
  g.children.forEach(m => { if (!m.isMesh) return; const mm = m.material.clone();
    if (mm.map) { mm.color = new THREE.Color('#ffe7a0'); mm.emissive = new THREE.Color('#ffae3a'); mm.emissiveMap = mm.map; mm.emissiveIntensity = .38; }
    else { mm.emissive = new THREE.Color('#ff9d2a'); mm.emissiveIntensity = .16; }
    m.material = mm; });
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 3.3), new THREE.MeshBasicMaterial({ map: haloTexture(), color: new THREE.Color(1.6, 1.3, .8), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 1, toneMapped: false }));
  halo.rotation.x = -Math.PI / 2; halo.position.y = .02; g.add(halo);
  const star = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  star.material.toneMapped = false; star.material.opacity = .9; star.scale.set(.75, .75, 1); star.position.set(-.5, def.top + .3, -.45); g.add(star);
  const L = new THREE.PointLight('#ffb84a', 2.2, 3, 1.6); L.position.set(0, 1.1, .3); g.add(L);
}

// top texture for broken pieces: baked dough + the icing face (so the fragments still show the animal)
function topTexture(def, P) {
  const ice = def.ice, N = ice.N, c = canvas(N), x = c.getContext('2d');
  x.fillStyle = def.base ? '#' + def.base.getHexString() : '#e2b071'; x.fillRect(0, 0, N, N);
  const a = canvas(N), ax = a.getContext('2d'), ad = ax.createImageData(N, N);
  for (let i = 0; i < N * N; i++) ad.data[i * 4 + 3] = (def.base ? ice.H[i] > .3 : ice.M[i]) ? 255 : 0;
  ax.putImageData(ad, 0, 0);
  const t = canvas(N), tx = t.getContext('2d'); tx.drawImage(ice.colorCanvas, 0, 0); tx.globalCompositeOperation = 'destination-in'; tx.drawImage(a, 0, 0); x.drawImage(t, 0, 0);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.repeat.set(.5, .5); tex.offset.set(.5, .5); return tex;
}
// ---------- Zerbröselt: 4 Bruchstücke + Krümel ----------
function crumbs(def, P, seed) {
  const g = new THREE.Group(), pts = def.pts || polar((x, y) => Math.hypot(x, y) <= .9, 160);
  const rnd = (s => () => (s = (s * 16807) % 2147483647) / 2147483647)(seed * 131 + 7);
  const n = 4, cuts = []; for (let k = 0; k < n; k++) cuts.push(k / n * Math.PI * 2 + .5 + (rnd() - .5) * .5);
  const iceCol = new THREE.Color(P.hex);
  const capMat = new THREE.MeshPhysicalMaterial({ map: topTexture(def, P), roughness: .45, clearcoat: .6, clearcoatRoughness: .15 });
  const iceMat = new THREE.MeshPhysicalMaterial({ color: iceCol, roughness: .35, clearcoat: .7 });
  const crumbMat = new THREE.MeshPhysicalMaterial({ color: def.base ? def.base.clone().lerp(new THREE.Color('#c98a4a'), .35) : new THREE.Color('#d9a15c'), map: def.base ? null : doughTextures().map, bumpMap: doughTextures().bump, bumpScale: 3, roughness: .9 });
  const side = def.base ? new THREE.MeshPhysicalMaterial({ color: def.base, bumpMap: doughTextures().bump, bumpScale: 2, roughness: .8 }) : doughMaterial();
  const ang = ([x, y]) => (Math.atan2(y, x) + Math.PI * 4) % (Math.PI * 2);
  for (let k = 0; k < n; k++) {
    const a0 = cuts[k], a1 = cuts[(k + 1) % n] + (k === n - 1 ? Math.PI * 2 : 0);
    const arc = pts.filter(p => { let a = ang(p); while (a < a0) a += Math.PI * 2; return a <= a1; }).sort((p, q) => { let a = ang(p), b = ang(q); while (a < a0) a += Math.PI * 2; while (b < a0) b += Math.PI * 2; return a - b; });
    if (arc.length < 3) continue;
    // jagged break lines from the centre
    const jag = (a, out) => { const L = []; for (let t = 1; t <= 7; t++) { const r = t / 8 * .9, j = (rnd() - .5) * .16; L.push([Math.cos(a + j) * r, Math.sin(a + j) * r]); } return out ? L : L.reverse(); };
    const c0 = [(rnd() - .5) * .08, (rnd() - .5) * .08];
    const shapePts = [c0, ...jag(a0, true), ...arc, ...jag(a1, false)];
    const sh = new THREE.Shape(); shapePts.forEach(([x, y], i) => i ? sh.lineTo(x, y) : sh.moveTo(x, y));
    const geo = bake(crumbleGeometry(bodyGeometry(sh, .14, .045, 3), .02, seed + k), .8);
    const piece = new THREE.Mesh(geo, [capMat, side]); piece.castShadow = piece.receiveShadow = true;
    const mid = (a0 + a1) / 2, push = .2 + rnd() * .12;
    piece.position.set(Math.cos(mid) * push, 0, -Math.sin(mid) * push);
    piece.rotation.set((rnd() - .5) * .5, (rnd() - .5) * .6, (rnd() - .5) * .5); piece.scale.setScalar(.8); piece.position.y = .03 + rnd() * .05;
    g.add(piece);
  }
  // crumbs
  const cg = new THREE.IcosahedronGeometry(1, 1);
  for (let k = 0; k < 30; k++) {
    const geo = cg.clone(), p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const f = 1 + .35 * fbm(p.getX(i) * 2 + k, p.getY(i) * 2, p.getZ(i) * 2, 2); p.setXYZ(i, p.getX(i) * f, p.getY(i) * f * .7, p.getZ(i) * f); } geo.computeVertexNormals();
    const icy = rnd() < .3, m = new THREE.Mesh(geo, icy ? iceMat : crumbMat), s = .05 + rnd() * .08, a = rnd() * Math.PI * 2, r = .45 + rnd() * .6;
    m.scale.setScalar(s); m.position.set(Math.cos(a) * r, s * .6, Math.sin(a) * r); m.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3); m.castShadow = true; g.add(m);
  }
  return g;
}

// Saturation boost for scenes whose tone mapping washes the colours out (e.g. the game's glass-table lighting)
export function saturate(material, k = 1.4) {
  if (material.userData.sat) return; material.userData.sat = k;
  material.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
    diffuseColor.rgb = max(mix(vec3(dot(diffuseColor.rgb, vec3(.299, .587, .114))), diffuseColor.rgb, ${k.toFixed(2)}), 0.);`); };
  material.customProgramCacheKey = () => 'sat' + k; material.needsUpdate = true;
}
