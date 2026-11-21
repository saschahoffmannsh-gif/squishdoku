// SquishDoku "Neon tube" look: lay ONE silicone tube through all cells of a colour region.
// Hamiltonian path over the region's cells (4-neighbours); when none exists, the fewest pieces
// (each piece is a separate tube with clean cut ends). Among equal piece counts the path with
// the fewest bends wins (calmer, more "hand-laid" look). Works in browser and node.
(function (root) {
  const DIRS = [[0, 1], [1, 0], [0, -1], [-1, 0]];
  function regionCells(rows, g) { const out = []; rows.forEach((row, r) => { for (let c = 0; c < row.length; c++) if (row.charCodeAt(c) - 97 === g) out.push([r, c]); }); return out; }
  function turns(path) { let t = 0; for (let i = 2; i < path.length; i++) { const a = path[i - 2], b = path[i - 1], c = path[i]; if ((b[0] - a[0]) !== (c[0] - b[0]) || (b[1] - a[1]) !== (c[1] - b[1])) t++; } return t; }
  // longest simple path search (exhaustive up to a node budget) over `cells` (array of [r,c])
  function bestPath(cells, budget, rand) {
    const key = (r, c) => r * 64 + c, set = new Map(cells.map((p, i) => [key(p[0], p[1]), i]));
    const nb = cells.map(([r, c]) => DIRS.map(([dr, dc]) => set.get(key(r + dr, c + dc))).filter(v => v !== undefined));
    const n = cells.length, used = new Uint8Array(n), path = [];
    let best = null, bestTurns = Infinity, nodes = 0;
    const deg1 = cells.map((_, i) => i).filter(i => nb[i].length <= 1);
    let starts = deg1.length ? deg1 : cells.map((_, i) => i);
    if (rand) starts = starts.slice().sort(() => rand() - .5);
    function score() {
      const p = path.map(i => cells[i]);
      if (!best || p.length > best.length || (p.length === best.length && turns(p) < bestTurns)) { best = p; bestTurns = turns(p); }
    }
    function rec(i, dir) {
      if (++nodes > budget) return;
      used[i] = 1; path.push(i);
      let ext = false;
      // prefer going straight, then Warnsdorff (fewest free neighbours)
      const opts = nb[i].filter(j => !used[j]).map(j => {
        const d = [cells[j][0] - cells[i][0], cells[j][1] - cells[i][1]];
        const straight = dir && d[0] === dir[0] && d[1] === dir[1];
        return { j, d, w: nb[j].filter(k => !used[k]).length * 2 + (straight ? 0 : 1) };
      }).sort((a, b) => a.w - b.w);
      for (const o of opts) { ext = true; rec(o.j, o.d); if (best && best.length === n && bestTurns <= Math.ceil(n / 3) && nodes > budget / 8) break; }
      if (!ext || path.length === n) score();
      path.pop(); used[i] = 0;
    }
    for (const s of starts) { if (nodes > budget) break; rec(s, null); }
    return best;
  }
  function components(cells) {
    const key = (r, c) => r * 64 + c, left = new Map(cells.map(p => [key(p[0], p[1]), p])), out = [];
    while (left.size) {
      const first = left.values().next().value, comp = [first], st = [first]; left.delete(key(first[0], first[1]));
      while (st.length) { const [r, c] = st.pop(); for (const [dr, dc] of DIRS) { const k = key(r + dr, c + dc); if (left.has(k)) { const q = left.get(k); left.delete(k); comp.push(q); st.push(q); } } }
      out.push(comp);
    }
    return out;
  }
  // cover all cells with as few simple paths as possible (greedy longest-first)
  function coverRegion(cells, budget = 60000) {
    const pieces = [];
    let todo = components(cells);
    while (todo.length) {
      const comp = todo.pop();
      const p = bestPath(comp, budget);
      pieces.push(p);
      const used = new Set(p.map(([r, c]) => r * 64 + c));
      const rest = comp.filter(([r, c]) => !used.has(r * 64 + c));
      if (rest.length) todo.push(...components(rest));
    }
    return pieces;
  }
  function layTubes(rows) {
    const ids = new Set(); rows.forEach(r => { for (const ch of r) ids.add(ch.charCodeAt(0) - 97); });
    return [...ids].sort((a, b) => a - b).map(g => ({ region: g, pieces: coverRegion(regionCells(rows, g)) }));
  }
  const api = { layTubes, coverRegion, turns };
  if (typeof module !== 'undefined') module.exports = api; else root.TubePaths = api;
})(typeof globalThis!=="undefined"?globalThis:this);
