// Set D · "Back-Ausstecher": natürlicher Mürbeteig-Ausstecher mit mehrlagigem, glänzendem Royal Icing.
// Each animal is a list of icing sections (puffy filled shapes on layers) and piped lines; the cookie
// outline is the icing outline grown by a baked rim. Height field → displaced mesh (big forms) +
// normal map (fine piping), colour map with subtle variation, alpha from the union of all sections.
import { THREE, saturate, fbm, bake, doughMaterial, canvas, heightMesh, crumbleGeometry, bodyGeometry, shapeFrom, polar } from './cookies.mjs';

const DARK = '#2a1610', CHOC = '#4a2416', CREAM = '#fff0d8', WHITE = '#fffaf4', PINK = '#f7a3b8', CHEEK = '#ff9fb2';
// ---------- section builder (unit coords, y up) ----------
function Sketch() {
  const items = [];
  const add = (o) => (items.push(o), o);
  const api = {
    items,
    // filled puffy section: draw(ctx,T,S) adds subpaths; z = base height, t = puff height
    fill(color, z, t, draw, o = {}) { return add({ kind: 'fill', color, z, t, draw, soft: o.soft ?? .055, color2: o.color2 }); },
    line(color, z, t, pts, w, o = {}) { return add({ kind: 'line', color, z, t, pts, w, smooth: o.smooth ?? true }); },
    ell(color, z, t, x, y, rx, ry, rot = 0, o) { return api.fill(color, z, t, (p, T, S) => { const [X, Y] = T(x, y); p.moveTo(X + S(rx) * Math.cos(-rot), Y + S(rx) * Math.sin(-rot)); p.ellipse(X, Y, S(rx), S(ry), -rot, 0, Math.PI * 2); }, o); },
    blob(color, z, t, pts, o) { return api.fill(color, z, t, (p, T) => closedSpline(p, pts.map(q => T(...q))), o); },
    // rounded polygon: offset blob through the corners with a round join
    tri(color, z, t, pts, round = .05, o) { return api.fill(color, z, t, (p, T, S) => roundPoly(p, pts.map(q => T(...q)), S(round)), o); },
    // Pixar-style eye looking in a direction: white sclera, dark iris shifted toward (lx,ly), big highlight; sq < 1 narrows a far-side eye
    look(x, y, r = .09, z = .12, lx = 0, ly = 0, sq = 1) { api.ell(WHITE, z, .04, x, y, r * 1.22 * sq, r * 1.32, 0, { soft: r * .5 });
      const ix = x + lx * r * .32 * sq, iy = y + ly * r * .3; api.ell(DARK, z + .035, .03, ix, iy, r * .9 * sq, r * 1.02, 0, { soft: r * .45 });
      api.ell(WHITE, z + .07, .012, ix - r * .28 * sq + lx * r * .1, iy + r * .38, r * .3 * sq, r * .3, 0, { soft: r * .15 }); api.ell(WHITE, z + .07, .008, ix + r * .3 * sq, iy - r * .25, r * .12, r * .12, 0, { soft: r * .07 }); },
    wink(x, y, r = .09, z = .12) { const pts = []; for (let i = 0; i <= 10; i++) { const a = Math.PI * (.15 + .7 * i / 10); pts.push([x + Math.cos(a) * r, y - r * .3 + Math.sin(a) * r * .7]); } api.line(DARK, z, .03, pts, .035); },
    eye(x, y, r = .08, z = .12) { api.ell(DARK, z, .045, x, y, r, r * 1.12, 0, { soft: r * .5 }); api.ell(WHITE, z + .04, .012, x - r * .32, y + r * .38, r * .3, r * .3, 0, { soft: r * .15 }); api.ell(WHITE, z + .04, .008, x + r * .3, y - r * .2, r * .13, r * .13, 0, { soft: r * .07 }); },
    smile(x, y, w = .09, z = .15, c = CHOC) { const L = [], R = []; for (let i = 0; i <= 10; i++) { const a = Math.PI * (1.05 + .9 * i / 10); L.push([x - w / 2 + Math.cos(a) * w / 2, y + .02 + Math.sin(a) * w / 2.2]); R.push([x + w / 2 + Math.cos(a) * w / 2, y + .02 + Math.sin(a) * w / 2.2]); } api.line(c, z, .018, L, .022); api.line(c, z, .018, R, .022); },
    whiskers(x, y, s = 1, z = .1, c = CHOC, len = .17) { for (const k of [-1, 0, 1]) api.line(c, z, .016, [[s * x, y + k * .05], [s * (x + len * .55), y + k * .062 + .006], [s * (x + len), y + k * .085 - .002]], .018); },
    cheeks(x, y, r = .07, z = .1) { api.ell(CHEEK, z, .02, -x, y, r, r * .66, 0, { soft: r * .6 }); api.ell(CHEEK, z, .02, x, y, r, r * .66, 0, { soft: r * .6 }); },
  };
  return api;
}
function closedSpline(p, P) { // Catmull-Rom through the points, closed
  const n = P.length; p.moveTo(...P[0]);
  for (let i = 0; i < n; i++) { const p0 = P[(i - 1 + n) % n], p1 = P[i], p2 = P[(i + 1) % n], p3 = P[(i + 2) % n];
    p.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]); }
  p.closePath();
}
function roundPoly(p, P, r) { const n = P.length; const m = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  for (let i = 0; i < n; i++) { const a = P[(i - 1 + n) % n], b = P[i], c = P[(i + 1) % n]; const la = Math.hypot(a[0] - b[0], a[1] - b[1]), lc = Math.hypot(c[0] - b[0], c[1] - b[1]); const s = m(b, a, Math.min(.45, r / la)), e = m(b, c, Math.min(.45, r / lc)); i ? p.lineTo(...s) : p.moveTo(...s); p.quadraticCurveTo(b[0], b[1], ...e); } p.closePath(); }
const shade = (hex, f) => { const c = new THREE.Color(hex); return '#' + (f > 0 ? c.lerp(new THREE.Color('#fff6e8'), f) : c.multiplyScalar(1 + f)).getHexString(); };

// ---------- the 8 animals ----------
const ANIMALS = {
  lion(S, C) { const m1 = shade(C, -.04), m2 = shade(C, -.2), face = '#ffbf3f';
    const n = 13; for (let k = 0; k < n; k++) { const a = Math.PI / 2 + k / n * Math.PI * 2, da = Math.PI / n * 1.12, tw = .12;
      const pt = (r, aa) => [Math.cos(aa) * r, Math.sin(aa) * r];
      S.blob(k % 2 ? m2 : m1, 0, .07, [pt(.36, a - da * .9), pt(.64, a - da * 1.05), pt(.83, a - da * .7), pt(.92, a - da * .05 + tw * .12), pt(.86, a + da * .55), pt(.66, a + da * .98), pt(.36, a + da * .9)], { soft: .04 }); }
    for (const s of [-1, 1]) { S.ell(face, .06, .07, s * .42, .4, .17, .17, 0); S.ell(PINK, .12, .025, s * .42, .4, .09, .09, 0, { soft: .03 }); }
    S.ell(face, .07, .08, 0, -.03, .53, .47); S.ell(CREAM, .13, .045, 0, -.23, .28, .17, 0, { soft: .05 });
    S.tri(CHOC, .17, .035, [[-.075, -.08], [.075, -.08], [0, -.17]], .03, { soft: .03 }); S.line(CHOC, .16, .016, [[0, -.17], [0, -.21]], .02); S.smile(0, -.24, .1);
    S.eye(-.2, .08, .08, .14); S.eye(.2, .08, .08, .14); S.whiskers(.31, -.2, -1, .14); S.whiskers(.31, -.2, 1, .14); },
  fox(S, C) { const d = shade(C, -.18);
    for (const s of [-1, 1]) { S.tri(C, 0, .065, [[s * .2, .42], [s * .62, .86], [s * .7, .26]], .07); S.tri('#ffd9cc', .07, .03, [[s * .32, .44], [s * .6, .73], [s * .62, .33]], .05, { soft: .03 }); }
    S.blob(C, 0, .07, [[-.78, .1], [-.55, .42], [0, .52], [.55, .42], [.78, .1], [.7, -.3], [.35, -.58], [0, -.64], [-.35, -.58], [-.7, -.3]]);
    S.blob(d, .06, .03, [[-.08, .48], [.08, .48], [.06, .24], [0, .16], [-.06, .24]], { soft: .03 });
    for (const s of [-1, 1]) S.blob(WHITE, .07, .05, [[s * .08, -.18], [s * .32, -.06], [s * .62, -.08], [s * .66, -.26], [s * .4, -.5], [s * .12, -.56], [0, -.4]]);
    S.eye(-.27, .1, .082, .1); S.eye(.27, .1, .082, .1); S.ell(DARK, .14, .035, 0, -.2, .075, .055, 0, { soft: .03 }); S.ell(WHITE, .18, .01, -.025, -.185, .02, .015); S.line(DARK, .15, .015, [[0, -.25], [0, -.29]], .02); S.smile(0, -.32, .11, .15); S.cheeks(.44, -.14, .065, .13); },
  frog(S, C) { const lt = shade(C, .28);
    for (const s of [-1, 1]) S.ell(C, 0, .07, s * .44, .38, .3, .28);
    S.blob(C, 0, .07, [[-.9, -.12], [-.7, .25], [0, .32], [.7, .25], [.9, -.12], [.7, -.5], [0, -.66], [-.7, -.5]]);
    S.blob(lt, .06, .035, [[-.5, -.3], [0, -.18], [.5, -.3], [.38, -.52], [0, -.6], [-.38, -.52]], { soft: .05 });
    for (const s of [-1, 1]) { S.ell(CREAM, .07, .05, s * .44, .4, .19, .18); S.eye(s * .44, .38, .1, .13); }
    S.ell(shade(C, -.35), .07, .015, -.08, .04, .025, .02, 0, { soft: .015 }); S.ell(shade(C, -.35), .07, .015, .08, .04, .025, .02, 0, { soft: .015 });
    const sm = []; for (let i = 0; i <= 16; i++) { const a = Math.PI * (1.12 + .76 * i / 16); sm.push([Math.cos(a) * .42, .02 + Math.sin(a) * .3]); } S.line(CHOC, .11, .018, sm, .03);
    S.cheeks(.58, -.18, .08, .08); },
  penguin(S, C) { const d = shade(C, -.2);
    for (const s of [-1, 1]) { S.ell(d, 0, .055, s * .66, -.25, .17, .34, s * .35); S.ell('#ff9a2a', 0, .05, s * .2, -.84, .17, .09); }
    S.ell(C, 0, .07, 0, -.04, .7, .84);
    S.fill(WHITE, .065, .055, (p, T, S2) => { for (const [x, y, r] of [[-.21, .14, .27], [.21, .14, .27]]) { const [X, Y] = T(x, y); p.moveTo(X + S2(r), Y); p.arc(X, Y, S2(r), 0, Math.PI * 2); } const [X, Y] = T(0, -.22); p.moveTo(X + S2(.43), Y); p.ellipse(X, Y, S2(.43), S2(.42), 0, 0, Math.PI * 2); });
    S.eye(-.2, .12, .085, .13); S.eye(.2, .12, .085, .13); S.tri('#ff9a2a', .14, .04, [[-.1, -.04], [.1, -.04], [0, -.17]], .035, { soft: .03 }); S.cheeks(.36, -.06, .07, .13); },
  owl(S, C) { const d = shade(C, -.22), lt = shade(C, .55), mid = shade(C, .18);
    for (const s of [-1, 1]) S.tri(C, 0, .06, [[s * .24, .62], [s * .74, .88], [s * .7, .4]], .07);
    S.blob(C, 0, .07, [[-.74, .45], [0, .62], [.74, .45], [.78, -.2], [.55, -.68], [0, -.8], [-.55, -.68], [-.78, -.2]]);
    for (const s of [-1, 1]) S.blob(d, .06, .035, [[s * .74, .05], [s * .5, -.1], [s * .44, -.45], [s * .6, -.68], [s * .78, -.35]], { soft: .04 });
    S.ell(mid, .06, .035, 0, -.42, .34, .28, 0, { soft: .05 });
    for (const [x, y] of [[-.15, -.33], [.15, -.33], [0, -.45], [-.15, -.57], [.15, -.57]]) S.line(lt, .1, .014, [[x - .07, y + .04], [x, y - .02], [x + .07, y + .04]], .024);
    for (const s of [-1, 1]) { S.ell(lt, .07, .04, s * .25, .2, .25, .24); S.ell(CREAM, .11, .03, s * .25, .2, .15, .15); S.eye(s * .25, .19, .085, .14); }
    S.tri('#ffa62e', .1, .045, [[-.07, .02], [.07, .02], [0, -.15]], .03, { soft: .03 }); },
  pig(S, C) { const d = shade(C, -.2), lt = shade(C, .35);
    for (const s of [-1, 1]) { S.tri(C, 0, .06, [[s * .22, .5], [s * .7, .82], [s * .74, .3]], .09); S.tri(d, .065, .03, [[s * .36, .5], [s * .64, .7], [s * .64, .38]], .06, { soft: .03 }); }
    S.ell(C, 0, .07, 0, -.06, .8, .72);
    S.ell(lt, .07, .05, 0, -.22, .3, .2); for (const s of [-1, 1]) S.ell(shade(C, -.35), .12, .02, s * .1, -.22, .055, .075, 0, { soft: .03 });
    S.eye(-.3, .12, .088, .1); S.eye(.3, .12, .088, .1); S.smile(0, -.47, .075, .1); S.cheeks(.5, -.14, .085, .1); },
  cat(S, C) { const d = shade(C, -.22);
    for (const s of [-1, 1]) { S.tri(C, 0, .065, [[s * .18, .4], [s * .58, .88], [s * .74, .22]], .07); S.tri(PINK, .07, .03, [[s * .3, .42], [s * .56, .74], [s * .64, .32]], .05, { soft: .03 }); }
    S.ell(C, 0, .07, 0, -.1, .8, .66);
    for (const x of [-.09, 0, .09]) S.line(d, .07, .016, [[x * 1.1, .48], [x, .36]], .035);
    for (const s of [-1, 1]) S.ell(CREAM, .07, .045, s * .12, -.26, .16, .13);
    S.tri('#ff7fa0', .12, .035, [[-.06, -.13], [.06, -.13], [0, -.2]], .025, { soft: .025 }); S.smile(0, -.25, .08, .13);
    S.eye(-.29, .04, .085, .1); S.eye(.29, .04, .085, .1); S.whiskers(.33, -.2, -1, .1); S.whiskers(.33, -.2, 1, .1); S.cheeks(.48, -.14, .06, .1); },
  bunny(S, C) { const g = '#c9b8ae';
    for (const s of [-1, 1]) { S.ell(C, 0, .065, s * .24, .46, .17, .42, s * -.12); S.ell(PINK, .065, .03, s * .24, .46, .085, .3, s * -.12, { soft: .03 }); }
    S.ell(C, 0, .07, 0, -.3, .74, .58);
    S.eye(-.27, -.2, .08, .1); S.eye(.27, -.2, .08, .1); S.ell('#ff8fae', .1, .035, 0, -.36, .06, .045, 0, { soft: .03 }); S.smile(0, -.44, .08, .1, '#8a6a5c');
    S.whiskers(.18, -.4, -1, .1, g, .2); S.whiskers(.18, -.4, 1, .1, g, .2); S.cheeks(.46, -.36, .08, .1); },
};

// ---------- Set E: same baked style, varied poses (profile, three-quarter, looking around, winking) ----------
const ANIMALS_E = {
  lion: ANIMALS.lion,
  owl(S, C) { const d = shade(C, -.22), lt = shade(C, .55), mid = shade(C, .18); // head tilted, looking to the side
    for (const s of [-1, 1]) S.tri(C, 0, .06, [[s * .24, .62], [s * .74, .88], [s * .7, .4]], .07);
    S.blob(C, 0, .07, [[-.74, .45], [0, .62], [.74, .45], [.78, -.2], [.55, -.68], [0, -.8], [-.55, -.68], [-.78, -.2]]);
    for (const s of [-1, 1]) S.blob(d, .06, .035, [[s * .74, .05], [s * .5, -.1], [s * .44, -.45], [s * .6, -.68], [s * .78, -.35]], { soft: .04 });
    S.ell(mid, .06, .035, 0, -.42, .34, .28, 0, { soft: .05 });
    for (const [x, y] of [[-.15, -.33], [.15, -.33], [0, -.45], [-.15, -.57], [.15, -.57]]) S.line(lt, .1, .014, [[x - .07, y + .04], [x, y - .02], [x + .07, y + .04]], .024);
    for (const s of [-1, 1]) { S.ell(lt, .07, .04, s * .25, .2, .25, .24); S.look(s * .25, .19, .13, .1, .9, .25); }
    S.tri('#ffa62e', .1, .045, [[-.04, .02], [.1, .02], [.04, -.15]], .03, { soft: .03 }); },
  frog(S, C) { const lt = shade(C, .28); // winking
    for (const s of [-1, 1]) S.ell(C, 0, .07, s * .44, .38, .3, .28);
    S.blob(C, 0, .07, [[-.9, -.12], [-.7, .25], [0, .32], [.7, .25], [.9, -.12], [.7, -.5], [0, -.66], [-.7, -.5]]);
    S.blob(lt, .06, .035, [[-.5, -.3], [0, -.18], [.5, -.3], [.38, -.52], [0, -.6], [-.38, -.52]], { soft: .05 });
    S.look(-.44, .38, .14, .07, .3, -.2); S.wink(.44, .4, .14, .08);
    const sm = []; for (let i = 0; i <= 16; i++) { const a = Math.PI * (1.12 + .76 * i / 16); sm.push([.05 + Math.cos(a) * .42, .02 + Math.sin(a) * .3]); } S.line(CHOC, .11, .018, sm, .03);
    S.ell('#ff7fa0', .1, .03, .22, -.3, .1, .08, 0, { soft: .04 }); S.cheeks(.6, -.16, .08, .08); },
  fox(S, C) { const d = shade(C, -.2); // side profile, facing left
    S.tri(d, 0, .055, [[.08, .42], [.36, .9], [.5, .34]], .07); S.tri(C, 0, .065, [[-.28, .42], [-.08, .95], [.16, .38]], .07); S.tri('#ffd9cc', .07, .03, [[-.17, .45], [-.06, .78], [.06, .43]], .05, { soft: .03 });
    S.blob(C, 0, .07, [[.64, .08], [.55, .42], [.2, .58], [-.22, .52], [-.48, .3], [-.68, .06], [-.9, -.1], [-.88, -.24], [-.56, -.32], [-.2, -.5], [.3, -.56], [.62, -.3]]);
    S.blob(WHITE, .07, .05, [[-.86, -.2], [-.55, -.13], [-.15, -.2], [.18, -.12], [.48, -.26], [.3, -.52], [-.2, -.5], [-.56, -.33]]);
    S.ell(DARK, .14, .035, -.88, -.12, .075, .065, 0, { soft: .03 }); S.ell(WHITE, .18, .01, -.9, -.09, .022, .016);
    S.look(-.3, .17, .135, .08, -.9, .1, .85);
    S.line(CHOC, .13, .016, [[-.8, -.22], [-.72, -.28], [-.62, -.29], [-.54, -.24]], .022); S.ell(CHEEK, .13, .02, -.02, -.12, .07, .05, 0, { soft: .04 }); },
  penguin(S, C) { const d = shade(C, -.2); // three-quarter, looking left, waving
    S.ell(d, 0, .055, .66, .2, .15, .34, -.7); S.ell(d, 0, .055, -.62, -.32, .14, .3, .35);
    for (const x of [-.26, .14]) S.ell('#ff9a2a', 0, .05, x, -.85, .17, .09);
    S.ell(C, 0, .07, 0, -.05, .68, .84);
    S.fill(WHITE, .065, .055, (p, T, S2) => { for (const [x, y, r] of [[-.3, .14, .25], [.08, .14, .28]]) { const [X, Y] = T(x, y); p.moveTo(X + S2(r), Y); p.arc(X, Y, S2(r), 0, Math.PI * 2); } const [X, Y] = T(-.1, -.22); p.moveTo(X + S2(.41), Y); p.ellipse(X, Y, S2(.41), S2(.42), 0, 0, Math.PI * 2); });
    S.look(-.34, .13, .085, .12, -.8, .1, .85); S.look(.06, .13, .1, .12, -.8, .1);
    S.tri('#ff9a2a', .14, .045, [[-.24, .0], [-.24, -.15], [-.58, -.08]], .035, { soft: .03 }); S.ell(CHEEK, .12, .02, .26, -.08, .07, .05, 0, { soft: .04 }); },
  pig(S, C) { const d = shade(C, -.2), lt = shade(C, .35); // side profile, facing right
    S.tri(d, 0, .055, [[-.5, .38], [-.4, .82], [-.12, .44]], .08);
    S.ell(C, 0, .07, -.12, -.06, .7, .66);
    S.blob(C, .02, .06, [[.25, .12], [.66, .14], [.72, -.36], [.25, -.34]]);
    S.ell(lt, .08, .05, .72, -.11, .17, .25); for (const [x, y] of [[.68, -.04], [.74, -.19]]) S.ell(shade(C, -.35), .13, .02, x, y, .04, .06, 0, { soft: .025 });
    S.tri(C, .06, .06, [[-.1, .4], [.12, .84], [.4, .38]], .08); S.tri(d, .12, .025, [[0, .45], [.14, .72], [.3, .44]], .06, { soft: .03 });
    S.look(.22, .14, .1, .1, .9, .05, .9); S.line(CHOC, .1, .016, [[.4, -.3], [.46, -.36], [.54, -.36], [.6, -.31]], .022); S.ell(CHEEK, .1, .02, .08, -.2, .09, .06, 0, { soft: .05 }); },
  cat(S, C) { const d = shade(C, -.22); // three-quarter, facing right
    S.tri(C, 0, .065, [[-.62, .3], [-.56, .92], [-.12, .5]], .07); S.tri(PINK, .07, .03, [[-.5, .38], [-.48, .76], [-.22, .5]], .05, { soft: .03 });
    S.tri(d, 0, .06, [[.22, .48], [.6, .88], [.72, .3]], .07); S.tri(PINK, .07, .025, [[.34, .48], [.58, .74], [.64, .36]], .05, { soft: .03 });
    S.ell(C, 0, .07, 0, -.1, .8, .66);
    for (const x of [.05, .15, .25]) S.line(d, .07, .016, [[x * 1.1, .48], [x, .36]], .035);
    S.ell(CREAM, .07, .045, .26, -.26, .15, .13); S.ell(CREAM, .07, .045, .48, -.25, .12, .12);
    S.tri('#ff7fa0', .12, .035, [[.31, -.12], [.43, -.12], [.37, -.2]], .025, { soft: .025 }); S.smile(.37, -.25, .08, .13);
    S.look(-.18, .05, .1, .1, .8, .1); S.look(.52, .06, .08, .1, .8, .1, .75);
    S.whiskers(.6, -.22, 1, .12, CHOC, .22); S.whiskers(-.12, -.24, -1, .12, CHOC, .16); S.cheeks(.0, -.14, .065, .1); },
  bunny(S, C) { const g = '#c9b8ae'; // three-quarter, one ear flopped
    S.ell(C, 0, .065, -.22, .48, .16, .42, .12); S.ell(PINK, .065, .03, -.22, .48, .08, .3, .12, { soft: .03 });
    S.blob(C, 0, .065, [[.02, .22], [.2, .58], [.5, .76], [.84, .62], [.82, .44], [.52, .48], [.32, .22]]); S.blob(PINK, .065, .03, [[.2, .4], [.36, .6], [.6, .66], [.76, .56], [.5, .54], [.32, .36]], { soft: .03 });
    S.ell(C, 0, .07, 0, -.3, .74, .58);
    S.look(-.18, -.18, .085, .1, .8, -.1); S.look(.36, -.18, .07, .1, .8, -.1, .78);
    S.ell('#ff8fae', .12, .035, .22, -.34, .06, .045, 0, { soft: .03 }); S.smile(.22, -.42, .08, .12, '#8a6a5c');
    S.whiskers(.36, -.4, 1, .12, g, .22); S.whiskers(-.02, -.42, -1, .12, g, .16); S.cheeks(.5, -.36, .07, .1); },
};

// ---------- rasterise sections into height / colour / alpha ----------
function boxBlur(src, N, r) { const tmp = new Float32Array(N * N), out = new Float32Array(N * N), w = 2 * r + 1;
  for (let y = 0; y < N; y++) { let acc = 0; for (let x = -r; x <= r; x++) acc += src[y * N + Math.min(N - 1, Math.max(0, x))]; for (let x = 0; x < N; x++) { tmp[y * N + x] = acc / w; acc += src[y * N + Math.min(N - 1, x + r + 1)] - src[y * N + Math.max(0, x - r)]; } }
  for (let x = 0; x < N; x++) { let acc = 0; for (let y = -r; y <= r; y++) acc += tmp[Math.min(N - 1, Math.max(0, y)) * N + x]; for (let y = 0; y < N; y++) { out[y * N + x] = acc / w; acc += tmp[Math.min(N - 1, y + r + 1) * N + x] - tmp[Math.max(0, y - r) * N + x]; } }
  return out; }
export function rasterize(animal, color, N = 1024, set = 'D') {
  const S = Sketch(); (set === 'E' ? ANIMALS_E : ANIMALS)[animal](S, color);
  const T = (x, y) => [(x + 1) / 2 * N, (1 - y) / 2 * N], SC = r => r / 2 * N;
  const H = new Float32Array(N * N), cC = canvas(N), xC = cC.getContext('2d'), cU = canvas(N), xU = cU.getContext('2d');
  xU.fillStyle = '#000'; xU.fillRect(0, 0, N, N); xC.fillStyle = color; xC.fillRect(0, 0, N, N);
  const m = canvas(N), mx = m.getContext('2d', { willReadFrequently: true }), b = canvas(N), bx = b.getContext('2d', { willReadFrequently: true });
  for (const it of S.items) {
    const path = new Path2D();
    mx.setTransform(1, 0, 0, 1, 0, 0); mx.clearRect(0, 0, N, N); mx.fillStyle = mx.strokeStyle = '#fff'; mx.lineCap = mx.lineJoin = 'round';
    if (it.kind === 'fill') { it.draw(path, T, SC); mx.fill(path); xC.fillStyle = it.color; xC.fill(path); xU.fillStyle = '#fff'; xU.fill(path); }
    else { const P = it.pts.map(q => T(...q)); P.forEach((q, i) => i ? path.lineTo(...q) : path.moveTo(...q)); mx.lineWidth = SC(it.w); mx.stroke(path); for (const [c, s] of [[xC, it.color], [xU, '#fff']]) { c.lineCap = c.lineJoin = 'round'; c.lineWidth = SC(it.w); c.strokeStyle = s; c.stroke(path); } }
    const soft = it.kind === 'line' ? it.w * .45 : it.soft;
    bx.clearRect(0, 0, N, N); bx.filter = `blur(${Math.max(1, SC(soft) * .55)}px)`; bx.drawImage(m, 0, 0); bx.filter = 'none';
    const a = mx.getImageData(0, 0, N, N).data, bl = bx.getImageData(0, 0, N, N).data;
    let amax = 0; for (let i = 3; i < a.length; i += 4) if (a[i] > 128 && bl[i] > amax) amax = bl[i];
    amax = Math.max(amax, 30) / 255;
    for (let i = 0, p = 3; i < N * N; i++, p += 4) { const c = a[p] / 255; if (c <= 0) continue;
      const v = Math.min(1, Math.max(0, (bl[p] / 255 - .12) / (amax - .12))); const h = it.z + it.t * 1.2 * Math.pow(v, .42);
      if (h > H[i]) H[i] = H[i] + (h - H[i]) * c; }
  }
  // fine detail → normal map; colour: slightly darker on the steep flanks (icing is thinner there) + subtle mottling
  const r = Math.max(2, Math.round(N / 200)), Hb = boxBlur(boxBlur(H, N, r), N, r), nC = canvas(N), nx = nC.getContext('2d'), nd = nx.createImageData(N, N);
  const col = xC.getImageData(0, 0, N, N), cd = col.data, un = xU.getImageData(0, 0, N, N).data, M = new Uint8Array(N * N), k = N / 2 * 1.0;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const i = y * N + x, p = i * 4;
    const d = (j) => H[j] - Hb[j], xl = Math.max(0, x - 1), xr = Math.min(N - 1, x + 1), yu = Math.max(0, y - 1), yd = Math.min(N - 1, y + 1);
    const sx = (d(y * N + xr) - d(y * N + xl)) * k / 2, sy = (d(yd * N + x) - d(yu * N + x)) * k / 2;
    let ux = -sx, uy = sy, uz = 1; const l = Math.hypot(ux, uy, uz); ux /= l; uy /= l; uz /= l;
    nd.data[p] = (ux * .5 + .5) * 255; nd.data[p + 1] = (uy * .5 + .5) * 255; nd.data[p + 2] = (uz * .5 + .5) * 255; nd.data[p + 3] = 255;
    // steepness of the full field for the flank darkening
    const gx = (H[y * N + xr] - H[y * N + xl]) * k / 2, gy = (H[yd * N + x] - H[yu * N + x]) * k / 2, st = Math.min(1, Math.hypot(gx, gy) * 1.4);
    const mott = 1 + .045 * fbm(x / N * 9, y / N * 9, 4.2, 3), f = (1 - .16 * st) * mott;
    cd[p] = Math.min(255, cd[p] * f); cd[p + 1] = Math.min(255, cd[p + 1] * f); cd[p + 2] = Math.min(255, cd[p + 2] * f);
    M[i] = un[p] > 127 ? 1 : 0; }
  nx.putImageData(nd, 0, 0); xC.putImageData(col, 0, 0);
  return { H, Hgeo: Hb, M, N, colorCanvas: cC, normalCanvas: nC, unionCanvas: cU };
}

// ---------- cookie D ----------
export function designD(P, set = 'D') {
  return { top: .42, build() {
    const N = globalThis.COOKIE_N || 1024, ice = rasterize(P.animal, P.hex, N, set);
    // baked rim: the icing outline grown by ~.09 and slightly uneven
    const g = canvas(256), gx = g.getContext('2d', { willReadFrequently: true }); gx.filter = 'blur(6px)'; gx.drawImage(ice.unionCanvas, 0, 0, 256, 256);
    const gd = gx.getImageData(0, 0, 256, 256).data, inside = (x, y) => { const X = Math.round((x + 1) / 2 * 255), Y = Math.round((1 - y) / 2 * 255); return X >= 0 && Y >= 0 && X < 256 && Y < 256 && gd[(Y * 256 + X) * 4] > 10; };
    const pts = polar(inside, 260, 1.15).map(([x, y]) => { const a = Math.atan2(y, x), f = 1 + .012 * fbm(Math.cos(a) * 3 + P.key, Math.sin(a) * 3, 1, 3); return [x * f, y * f]; });
    // fit into the unit cell (cookie radius ≤ .97)
    // centre the cookie on its bounding box (profiles are lopsided), then fit
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    pts.forEach(p => { p[0] -= cx; p[1] -= cy; });
    const R = Math.max(...pts.map(([x, y]) => Math.hypot(x, y))), sc = Math.min(1.08, .97 / R);
    const body = bake(crumbleGeometry(bodyGeometry(shapeFrom(pts.map(([x, y]) => [x * sc, y * sc])), .17, .075, 6), .02, P.key), 1.1);
    const topY = .17 + .15;
    const geo = heightMesh({ H: ice.Hgeo, M: ice.M, N: ice.N }, 230, sc, topY - .012, 1);
    geo.translate(-cx * sc, 0, cy * sc);
    const tex = new THREE.CanvasTexture(ice.colorCanvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const nrm = new THREE.CanvasTexture(ice.normalCanvas); nrm.anisotropy = 8; const alpha = new THREE.CanvasTexture(ice.unionCanvas);
    const icing = new THREE.MeshPhysicalMaterial({ map: tex, normalMap: nrm, normalScale: new THREE.Vector2(1, 1), alphaMap: alpha, alphaTest: .5,
      roughness: .36, clearcoat: .85, clearcoatRoughness: .1, clearcoatNormalMap: nrm, clearcoatNormalScale: new THREE.Vector2(.6, .6), });
    saturate(icing, 1.3);
    this.pts = pts.map(([x, y]) => [x * sc, y * sc]); this.ice = ice; this.uv = { cx, cy, sc };
    // pale-golden, finely porous shortbread: own material with stronger pores
    const dough = doughMaterial().clone(); dough.bumpScale = 2; dough.roughness = .85;
    return [[body, dough], [geo, icing]];
  } };
}
