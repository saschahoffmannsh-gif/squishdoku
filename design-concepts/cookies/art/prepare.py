#!/usr/bin/env python3
"""Set F artwork: key the generated 1024² JPGs (art/src/*.jpg) to clean alpha PNG/WebP textures,
strip drawn cookie rims, push colours toward the game's region colours, and trace the cookie outline
(art silhouette grown by a baked rim) into outlines.json.   python3 design-concepts/cookies/art/prepare.py"""
import json, os, colorsys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

D = os.path.dirname(os.path.abspath(__file__))
OUT = 512          # texture size (square, art centred, transparent margin = room for the baked rim)
PAD = .085         # margin around the art bbox (fraction of the square side)
RIM = .034         # baked rim width (fraction of the square side)
# name: (strip drawn tan rim?, recolour)
ART = {'fuchs': (False, 'red'), 'schwein': (False, 'pink'), 'katze': (True, None), 'pinguin': (True, None),
       'hase': (True, None), 'eule': (True, 'purple'), 'frosch': (False, 'green'), 'loewe': (False, None)}

def hsv(a):
  r, g, b = [a[..., i] / 255. for i in range(3)]
  mx, mn = np.max(a[..., :3], -1) / 255., np.min(a[..., :3], -1) / 255.; d = mx - mn + 1e-9
  h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
  return h, np.where(mx > 0, d / (mx + 1e-9), 0), mx
def from_hsv(h, s, v):
  h = (h % 360) / 60; i = np.floor(h).astype(int) % 6; f = h - np.floor(h)
  p, q, t = v * (1 - s), v * (1 - s * f), v * (1 - s * (1 - f))
  r = np.choose(i, [v, q, p, p, t, v]); g = np.choose(i, [t, v, v, q, p, p]); b = np.choose(i, [p, p, t, v, v, q])
  return np.stack([r, g, b], -1) * 255

def key(name, strip):
  im = Image.open(f'{D}/src/{name}.jpg').convert('RGB'); a = np.asarray(im).astype(float); N = a.shape[0]
  bg = a[3, 3]; dist = np.sqrt(((a - bg) ** 2).sum(-1))
  passable = dist < 48
  if strip:  # drawn shortbread rim: warm tan/orange, medium saturation – flood through it from outside
    h, s, v = hsv(a); passable |= (h > 14) & (h < 48) & (s > .36) & (s < .9) & (v > .4)
  m = Image.fromarray(((~flood(passable)) * 255).astype(np.uint8))
  # clean: open (drop specks of the rim), fill holes, eat the anti-aliased fringe
  m = m.filter(ImageFilter.MinFilter(5)).filter(ImageFilter.MaxFilter(5))
  m = Image.fromarray(((~flood(np.asarray(m) < 128)) * 255).astype(np.uint8))
  m = m.filter(ImageFilter.MinFilter(7 if strip else 3))
  alpha = np.asarray(m.filter(ImageFilter.GaussianBlur(1.3))).astype(float)
  return a, alpha

def ramp(x, a, b): return np.clip((x - a) / (b - a), 0, 1)
def hue_win(h, lo, hi, soft=12):  # soft window [lo, hi] on the hue circle (lo may be > hi to wrap)
  if lo > hi: return np.maximum(hue_win(h, lo, 360 + soft, soft), hue_win(h, -soft, hi, soft))
  return ramp(h, lo - soft, lo) * (1 - ramp(h, hi, hi + soft))

# (hue window, min saturation, target hue, pull toward it, saturation gain, sat offset, sat cap, value gain)
RECOLOUR = {
  'pink':   ((300, 25), .06, 324, .85, 1.9, .08, .62, .98),   # pale pig → game Pink #f45bb8
  'red':    ((3, 38), .4, 356, 1.0, 1.05, 0, 1, .95),         # orange fox → game Red #e8263f (never reads as the lion)
  'green':  ((60, 160), .15, 125, .35, 1.3, 0, .9, .95),       # lime frog → game Green #2fc24e
  'purple': ((245, 300), .1, 268, .4, 1.35, 0, .85, .97),     # lavender owl → game Purple #8f45ff
}
def recolour(a, mode):
  if mode not in RECOLOUR: return a
  (lo, hi), smin, th, pull, sg, so, cap, vg = RECOLOUR[mode]
  h, s, v = hsv(a); w = hue_win(h, lo, hi) * ramp(s, smin, smin + .15) * ramp(v, .25, .4)
  dh = ((th - h + 180) % 360) - 180
  out = from_hsv(h + dh * pull, np.clip(s * sg + so, 0, cap), np.clip(v * vg, 0, 1))
  return a + (out - a) * w[..., None]

def flood(passable):  # region of `passable` connected to the image border (iterative constrained dilation)
  r = np.zeros_like(passable); r[0, :] = passable[0, :]; r[-1, :] = passable[-1, :]; r[:, 0] = passable[:, 0]; r[:, -1] = passable[:, -1]
  while True:
    g = r.copy(); g[1:] |= r[:-1]; g[:-1] |= r[1:]; g[:, 1:] |= r[:, :-1]; g[:, :-1] |= r[:, 1:]; g &= passable
    if (g == r).all(): return r
    r = g

def trace(mask):  # Moore-neighbour boundary tracing of the largest blob → list of (x, y) pixel coords
  H, W = mask.shape; ys, xs = np.nonzero(mask); i = np.lexsort((xs, ys))[0]; start = (xs[i], ys[i])
  nb = [(1, 0), (1, 1), (0, 1), (-1, 1), (-1, 0), (-1, -1), (0, -1), (1, -1)]
  pts, cur, d = [start], start, 6
  for _ in range(20 * (H + W)):
    for k in range(8):
      dd = (d + k) % 8; nx, ny = cur[0] + nb[dd][0], cur[1] + nb[dd][1]
      if 0 <= nx < W and 0 <= ny < H and mask[ny, nx]: cur = (nx, ny); d = (dd + 5) % 8; break
    if cur == start: break
    pts.append(cur)
  return pts

def smooth_resample(pts, n=240, it=6):
  p = np.array(pts, float)
  for _ in range(it): p = (np.roll(p, 1, 0) + 2 * p + np.roll(p, -1, 0)) / 4
  seg = np.sqrt(((np.roll(p, -1, 0) - p) ** 2).sum(1)); cum = np.concatenate([[0], np.cumsum(seg)])
  t = np.linspace(0, cum[-1], n, endpoint=False); x = np.interp(t, cum, np.append(p[:, 0], p[0, 0])); y = np.interp(t, cum, np.append(p[:, 1], p[0, 1]))
  return np.stack([x, y], 1)

outlines = {}
for name, (strip, mode) in ART.items():
  a, alpha = key(name, strip); a = recolour(a, mode)
  ys, xs = np.nonzero(alpha > 20); x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
  side = max(x1 - x0, y1 - y0) / (1 - 2 * PAD); cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
  box = (int(cx - side / 2), int(cy - side / 2), int(cx + side / 2), int(cy + side / 2))
  rgba = Image.fromarray(np.dstack([np.clip(a, 0, 255), alpha]).astype(np.uint8), 'RGBA')
  tex = rgba.crop(box).resize((OUT, OUT), Image.LANCZOS)
  tex.save(f'{D}/{name}.png', optimize=True); tex.save(f'{D}/{name}.webp', quality=86, method=6)
  # cookie outline: art silhouette grown by the rim (gaussian grow = rounded), holes filled, traced, smoothed
  A = np.asarray(tex)[..., 3] > 110
  g = Image.fromarray((A * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(RIM * OUT * .72))
  big = np.asarray(g) > 22
  big = ~flood(~big)
  c = smooth_resample(trace(big))
  outlines[name] = [[round(x / OUT * 2 - 1, 4), round(1 - y / OUT * 2, 4)] for x, y in c]
  print(name, 'bbox', box, 'outline pts', len(c), 'png', os.path.getsize(f'{D}/{name}.png') // 1024, 'KB webp', os.path.getsize(f'{D}/{name}.webp') // 1024, 'KB')
json.dump(outlines, open(f'{D}/outlines.json', 'w'), separators=(',', ':'))
