// Set F · "Bedruckte Kekse": real 3D shortbread body (thickness, rounded baked edge, crumb texture) whose
// outline follows the animal's silhouette + a baked rim; the Pixar-style artwork sits flat on the top face
// like an edible print (no relief, a faint sheen). Art + outlines come from art/prepare.py.
import { THREE, saturate, bake, doughMaterial, crumbleGeometry, bodyGeometry, shapeFrom, canvas } from './cookies.mjs';

const FILE = { penguin: 'pinguin', fox: 'fuchs', frog: 'frosch', lion: 'loewe', owl: 'eule', pig: 'schwein', cat: 'katze', bunny: 'hase' };
const ART = {}; let OUTLINES = null;
const BASE = new URL('./art/', import.meta.url);
// must be awaited once before buildCookie('F', …)
export async function loadArt(ext = 'webp') {
  if (OUTLINES) return; OUTLINES = await (await fetch(new URL('outlines.json', BASE))).json();
  await Promise.all(Object.entries(FILE).map(async ([animal, f]) => {
    const img = new Image(); img.src = new URL(`${f}.${ext}`, BASE).href; await img.decode();
    const c = canvas(img.width); c.getContext('2d').drawImage(img, 0, 0); ART[animal] = c;
  }));
}

export function designF(P) {
  return { top: .36, build() {
    const art = ART[P.animal], pts0 = OUTLINES[FILE[P.animal]];
    if (!art) throw new Error('loadArt() first');
    const xs = pts0.map(p => p[0]), ys = pts0.map(p => p[1]), cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const R = Math.max(...pts0.map(([x, y]) => Math.hypot(x - cx, y - cy))), sc = Math.min(1.12, .97 / R);
    const pts = pts0.map(([x, y]) => [(x - cx) * sc, (y - cy) * sc]);
    const depth = .2, bevel = .07, topY = depth + 2 * bevel;
    const body = bake(crumbleGeometry(bodyGeometry(shapeFrom(pts), depth, bevel, 6), .018, P.key), 1.1);
    // the print: one quad over the art square, alpha from the art, follows the crumb texture very slightly
    const tex = new THREE.CanvasTexture(art); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const bump = doughMaterial().bumpMap.clone(); bump.repeat.set(2.2, 2.2); bump.needsUpdate = true;
    const print = new THREE.MeshPhysicalMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2,
      roughness: .52, clearcoat: .35, clearcoatRoughness: .32, bumpMap: bump, bumpScale: .5 });
    saturate(print, globalThis.PRINT_SAT || 1.12);
    const quad = new THREE.PlaneGeometry(2 * sc, 2 * sc); quad.rotateX(-Math.PI / 2); quad.translate(-cx * sc, topY + .002, cy * sc);
    // for the crumbled state: the art on baked dough, with the same mapping as the body's shape coordinates
    const N = art.width, d = art.getContext('2d').getImageData(0, 0, N, N).data, M = new Uint8Array(N * N);
    for (let i = 0; i < N * N; i++) M[i] = d[i * 4 + 3] > 127 ? 1 : 0;
    this.pts = pts; this.ice = { N, colorCanvas: art, M }; this.uv = { cx, cy, sc };
    return [[body, doughMaterial()], [quad, print]];
  } };
}
