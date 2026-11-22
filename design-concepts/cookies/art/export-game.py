#!/usr/bin/env python3
"""Game assets for the set F cookies → src/cookies/: small WebP prints, a compact outlines.json and
tileable shortbread colour/bump textures.   python3 design-concepts/cookies/art/export-game.py"""
import json, os
import numpy as np
from PIL import Image
D = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(D, '../../../src/cookies'); os.makedirs(OUT, exist_ok=True)
SIZE, PTS = 320, 96
for n in ['pinguin', 'fuchs', 'frosch', 'loewe', 'eule', 'schwein', 'katze', 'hase']:
  im = Image.open(f'{D}/{n}.png').convert('RGBA').resize((SIZE, SIZE), Image.LANCZOS)
  im.save(f'{OUT}/{n}.webp', quality=84, method=6)
o = json.load(open(f'{D}/outlines.json')); small = {}
for k, pts in o.items():
  p = np.array(pts); idx = np.linspace(0, len(p), PTS, endpoint=False).astype(int); small[k] = [[round(x, 3), round(y, 3)] for x, y in p[idx]]
json.dump(small, open(f'{OUT}/outlines.json', 'w'), separators=(',', ':'))
# tileable value-noise fbm
rng = np.random.default_rng(7)
def vnoise(n, cells):
  g = rng.random((cells, cells)); y, x = np.mgrid[0:n, 0:n] / n * cells; xi, yi = x.astype(int), y.astype(int); xf, yf = x - xi, y - yi
  s = lambda t: t * t * (3 - 2 * t); u, v = s(xf), s(yf); a = g[yi % cells, xi % cells]; b = g[yi % cells, (xi + 1) % cells]; c = g[(yi + 1) % cells, xi % cells]; d = g[(yi + 1) % cells, (xi + 1) % cells]
  return (a + (b - a) * u) + ((c + (d - c) * u) - (a + (b - a) * u)) * v
N = 256
def fbm(base, oct=4): return sum(vnoise(N, base * 2 ** i) * .5 ** (i + 1) for i in range(oct)) * 2 - 1
big, fine, pit = fbm(4, 3), fbm(24, 3), vnoise(N, 64)
k = .5 + .5 * big
col = np.dstack([236 - 26 * k + 12 * fine, 196 - 40 * k + 10 * fine, 140 - 46 * k + 8 * fine])
Image.fromarray(np.clip(col, 0, 255).astype(np.uint8)).save(f'{OUT}/dough.webp', quality=82)
h = 128 + 60 * fine + 40 * big - np.where(pit > .62, 90, 0)
Image.fromarray(np.clip(h, 0, 255).astype(np.uint8)).save(f'{OUT}/dough-bump.webp', quality=82)
for f in sorted(os.listdir(OUT)): print(f, os.path.getsize(f'{OUT}/{f}'))
