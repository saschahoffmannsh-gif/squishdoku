// SquishDoku engine (from /workspace/glowdoku/engine.js): solver + generator (works in browser and node)
(function (root) {
  // regions: array of N strings, each char = region id (a..z)
  function parse(rows) {
    const N = rows.length;
    const reg = rows.map(r => r.split('').map(ch => ch.charCodeAt(0) - 97));
    return { N, reg };
  }
  // count solutions up to `limit`; returns {count, solution}
  function solve(rows, limit = 2) {
    const { N, reg } = parse(rows);
    let count = 0, first = null;
    const pos = new Array(N);
    function rec(r, colMask, regMask) {
      if (count >= limit) return;
      if (r === N) { count++; if (!first) first = pos.slice(); return; }
      for (let c = 0; c < N; c++) {
        if (colMask & (1 << c)) continue;
        const g = reg[r][c];
        if (regMask & (1 << g)) continue;
        if (r > 0 && Math.abs(pos[r - 1] - c) <= 1) continue;
        pos[r] = c;
        rec(r + 1, colMask | (1 << c), regMask | (1 << g));
      }
    }
    rec(0, 0, 0);
    return { count, solution: first };
  }
  function validate(rows) {
    const { N, reg } = parse(rows);
    const ids = new Set();
    for (const row of reg) { if (row.length !== N) return 'row length'; row.forEach(g => ids.add(g)); }
    if (ids.size !== N) return 'region count ' + ids.size;
    // connectivity
    for (const g of ids) {
      const cells = [];
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (reg[r][c] === g) cells.push([r, c]);
      const seen = new Set([cells[0].join()]); const st = [cells[0]];
      while (st.length) { const [r, c] = st.pop(); for (const [dr, dc] of [[1,0],[-1,0],[0,1],[0,-1]]) { const rr=r+dr, cc=c+dc; if (rr>=0&&rr<N&&cc>=0&&cc<N&&reg[rr][cc]===g&&!seen.has(rr+','+cc)) { seen.add(rr+','+cc); st.push([rr,cc]); } } }
      if (seen.size !== cells.length) return 'region ' + g + ' not connected';
    }
    return null;
  }
  function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  function shuffle(a, rand) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function randomPlacement(N, rand) {
    const pos = [];
    function rec(r, used) {
      if (r === N) return true;
      for (const c of shuffle([...Array(N).keys()], rand)) {
        if (used & (1 << c)) continue;
        if (r > 0 && Math.abs(pos[r - 1] - c) <= 1) continue;
        pos[r] = c; if (rec(r + 1, used | (1 << c))) return true;
      }
      return false;
    }
    return rec(0, 0) ? pos : null;
  }
  function toRows(grid) { return grid.map(row => row.map(g => String.fromCharCode(97 + g)).join('')); }
  // generate a puzzle with a unique solution
  function generate(N, seed) {
    const rand = rng(seed || (Math.random() * 2 ** 32));
    for (let attempt = 0; attempt < 400; attempt++) {
      const pos = randomPlacement(N, rand);
      const grid = Array.from({ length: N }, () => Array(N).fill(-1));
      const frontier = [];
      pos.forEach((c, r) => { grid[r][c] = r; });
      let filled = N;
      // random growth
      while (filled < N * N) {
        const r = Math.floor(rand() * N), c = Math.floor(rand() * N);
        if (grid[r][c] !== -1) continue;
        const nb = [[1,0],[-1,0],[0,1],[0,-1]].map(([dr,dc]) => [r+dr,c+dc]).filter(([rr,cc]) => rr>=0&&rr<N&&cc>=0&&cc<N&&grid[rr][cc]!==-1);
        if (!nb.length) continue;
        const [rr, cc] = nb[Math.floor(rand() * nb.length)];
        grid[r][c] = grid[rr][cc]; filled++;
      }
      // hill-climb: move border cells between regions to reduce solution count
      let best = solve(toRows(grid), 50).count;
      for (let it = 0; it < 600 && best > 1; it++) {
        const r = Math.floor(rand() * N), c = Math.floor(rand() * N);
        if (pos[r] === c) continue; // keep seeds
        const nb = [[1,0],[-1,0],[0,1],[0,-1]].map(([dr,dc]) => [r+dr,c+dc]).filter(([rr,cc]) => rr>=0&&rr<N&&cc>=0&&cc<N&&grid[rr][cc]!==grid[r][c]);
        if (!nb.length) continue;
        const [rr, cc] = nb[Math.floor(rand() * nb.length)];
        const old = grid[r][c]; grid[r][c] = grid[rr][cc];
        const rows = toRows(grid);
        if (validate(rows)) { grid[r][c] = old; continue; }
        const cnt = solve(rows, 50).count;
        if (cnt >= 1 && cnt <= best) best = cnt; else grid[r][c] = old;
      }
      if (best === 1) {
        // relabel regions by first appearance for nicer colors
        const rows = toRows(grid); const map = {}; let k = 0;
        const out = rows.map(row => row.split('').map(ch => (map[ch] ??= String.fromCharCode(97 + k++))).join(''));
        return out;
      }
    }
    return null;
  }
  // ---------- Human-style step solver ----------
  // marks: N x N, 0 = leer, 1 = ✕, 2 = leuchtender Squish
  // names: German region names by region index
  function groupsOf(N, reg) {
    const g = [];
    for (let r = 0; r < N; r++) g.push({ kind: 'row', idx: r, cells: [...Array(N).keys()].map(c => [r, c]) });
    for (let c = 0; c < N; c++) g.push({ kind: 'col', idx: c, cells: [...Array(N).keys()].map(r => [r, c]) });
    for (let k = 0; k < N; k++) { const cells = []; for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (reg[r][c] === k) cells.push([r, c]); g.push({ kind: 'reg', idx: k, cells }); }
    return g;
  }
  function attacks(reg, a, b) { // does a firefly at a forbid cell b?
    if (a[0] === b[0] && a[1] === b[1]) return false;
    return a[0] === b[0] || a[1] === b[1] || reg[a[0]][a[1]] === reg[b[0]][b[1]] || (Math.abs(a[0] - b[0]) <= 1 && Math.abs(a[1] - b[1]) <= 1);
  }
  function gname(g, names) { return g.kind === 'row' ? `Zeile ${g.idx + 1}` : g.kind === 'col' ? `Spalte ${g.idx + 1}` : names[g.idx]; }
  function joinNames(arr) { return arr.length === 1 ? arr[0] : arr.slice(0, -1).join(', ') + ' und ' + arr[arr.length - 1]; }
  function combos(arr, k, start = 0, pre = [], out = []) {
    if (pre.length === k) { out.push(pre.slice()); return out; }
    for (let i = start; i < arr.length; i++) { pre.push(arr[i]); combos(arr, k, i + 1, pre, out); pre.pop(); }
    return out;
  }
  // build candidate grid from marks (cells that are empty and not forbidden by a placed firefly)
  function analyse(N, reg, marks) {
    const flies = []; for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (marks[r][c] === 2) flies.push([r, c]);
    const cand = Array.from({ length: N }, (_, r) => Array.from({ length: N }, (_, c) => marks[r][c] === 0 && !flies.some(f => attacks(reg, f, [r, c]))));
    return { flies, cand };
  }
  const key = ([r, c]) => r + ',' + c;

  function findStep(rows, marks, names, opts = {}) {
    const { N, reg } = parse(rows);
    const groups = groupsOf(N, reg);
    const { flies, cand } = analyse(N, reg, marks);
    const hasFly = g => g.cells.some(([r, c]) => marks[r][c] === 2);
    const open = groups.filter(g => !hasFly(g));
    const candsOf = g => g.cells.filter(([r, c]) => cand[r][c]);

    // (2) Around a placed firefly: same row/column/colour and the 8 neighbours -> ✕
    for (const f of flies) {
      const t = [];
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (marks[r][c] === 0 && attacks(reg, f, [r, c])) t.push([r, c]);
      if (t.length) return {
        tech: 2, value: 'x', targets: t, area: [f],
        text: `Neben diesem leuchtender Squish (auch schräg) und in seiner Zeile, Spalte und Farbe darf kein weiteres leuchten – alles dort bekommt ein ✕.`
      };
    }
    // (1) Single: a row/column/colour has exactly one free cell
    for (const kind of ['reg', 'row', 'col']) for (const g of open.filter(g => g.kind === kind)) {
      const cs = candsOf(g);
      if (cs.length === 1) return {
        tech: 1, value: 'fly', targets: cs, area: g.cells,
        text: g.cells.length === 1 ? `${names[g.idx]} besteht nur aus einem einzigen Feld – dort muss das leuchtender Squish hin.` : `${gname(g, names)} hat nur noch ein freies Feld – dort muss das leuchtender Squish hin.`
      };
    }
    const maxT = opts.maxTech || 9;
    if (maxT < 3) return null;
    // (3) Colour confined to one row/column -> rest of that line ✕ ; line confined to one colour -> rest of colour ✕
    for (const g of open.filter(g => g.kind === 'reg')) {
      const cs = candsOf(g); if (!cs.length) continue;
      for (const [lk, li, ln] of [['row', 0, 'Zeile'], ['col', 1, 'Spalte']]) {
        const lines = new Set(cs.map(x => x[li]));
        if (lines.size !== 1) continue;
        const L = [...lines][0];
        const line = groups.find(h => h.kind === lk && h.idx === L);
        const t = candsOf(line).filter(([r, c]) => reg[r][c] !== g.idx);
        if (t.length) return {
          tech: 3, value: 'x', targets: t, area: cs.concat(line.cells.filter(x => !cs.some(y => key(y) === key(x)))),
          text: `${names[g.idx]} hat nur noch Platz in ${ln} ${L + 1}. Das leuchtender Squish dieser ${ln} ist also ${names[g.idx]} – der Rest der ${ln} bekommt ✕.`
        };
      }
    }
    for (const g of open.filter(g => g.kind !== 'reg')) {
      const cs = candsOf(g); if (!cs.length) continue;
      const regs = new Set(cs.map(([r, c]) => reg[r][c]));
      if (regs.size !== 1) continue;
      const k = [...regs][0];
      const rg = groups.find(h => h.kind === 'reg' && h.idx === k);
      const t = candsOf(rg).filter(x => !cs.some(y => key(y) === key(x)));
      if (t.length) return {
        tech: 3, value: 'x', targets: t, area: g.cells,
        text: `In ${gname(g, names)} sind nur noch Felder von ${names[k]} frei. ${names[k]} bekommt sein leuchtender Squish also in ${gname(g, names)} – alle anderen Felder von ${names[k]} bekommen ✕.`
      };
    }
    if (maxT < 4) return null;
    // (4) A firefly here would leave some row/column/colour without any free cell -> ✕
    for (const kind of ['reg', 'row', 'col']) for (const g of open.filter(g => g.kind === kind)) {
      const cs = candsOf(g); if (!cs.length) continue;
      const t = [];
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        if (!cand[r][c] || cs.some(y => y[0] === r && y[1] === c)) continue;
        if (cs.every(y => attacks(reg, [r, c], y))) t.push([r, c]);
      }
      if (t.length) return {
        tech: 4, value: 'x', targets: t, area: cs,
        text: `${t.length > 1 ? 'Ein leuchtender Squish auf einem dieser Felder' : 'Ein leuchtender Squish auf diesem Feld'} würde ${g.kind === 'reg' ? names[g.idx] : gname(g, names)} komplett blockieren (alle freien Felder dort liegen daneben oder in derselben Linie). Also: ✕.`
      };
    }
    if (maxT < 5) return null;
    // (5) k colours confined to k rows/columns (and the inverse)
    const openRegs = open.filter(g => g.kind === 'reg');
    for (let k = 2; k < openRegs.length; k++) {
      for (const [lk, li, ln, lnP] of [['row', 0, 'Zeile', 'Zeilen'], ['col', 1, 'Spalte', 'Spalten']]) {
        const openLines = open.filter(g => g.kind === lk);
        // colours -> lines
        for (const set of combos(openRegs, k)) {
          const cs = set.flatMap(candsOf);
          const lines = [...new Set(cs.map(x => x[li]))].sort((a, b) => a - b);
          if (lines.length !== k) continue;
          const ids = new Set(set.map(g => g.idx));
          const t = []; for (const L of lines) for (const x of candsOf(groups.find(h => h.kind === lk && h.idx === L))) if (!ids.has(reg[x[0]][x[1]])) t.push(x);
          if (t.length) return {
            tech: 5, value: 'x', targets: t, area: set.flatMap(g => g.cells),
            text: `${joinNames(set.map(g => names[g.idx]))} liegen komplett in ${lnP} ${joinNames(lines.map(L => String(L + 1)))}. Diese ${k} ${lnP} gehören also ihnen – alle anderen Farben dort bekommen ✕.`
          };
        }
        // lines -> colours
        for (const set of combos(openLines, k)) {
          const cs = set.flatMap(candsOf);
          const regs = [...new Set(cs.map(([r, c]) => reg[r][c]))];
          if (regs.length !== k) continue;
          const ls = new Set(set.map(g => g.idx));
          const t = []; for (const R of regs) for (const x of candsOf(groups.find(h => h.kind === 'reg' && h.idx === R))) if (!ls.has(x[li])) t.push(x);
          if (t.length) return {
            tech: 5, value: 'x', targets: t, area: set.flatMap(g => g.cells),
            text: `In ${lnP} ${joinNames(set.map(g => String(g.idx + 1)))} sind nur noch Felder von ${joinNames(regs.map(R => names[R]))} frei. Diese ${k} Farben bekommen ihre leuchtender Squish also dort – ihre übrigen Felder bekommen ✕.`
          };
        }
      }
    }
    if (opts.noLookahead || maxT < 6) return null;
    // (6) Lookahead: try a firefly, follow forced singles; if something runs out of space -> ✕
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      if (!cand[r][c]) continue;
      const dead = tryContradiction(N, reg, groups, marks, cand, [r, c]);
      if (dead) return {
        tech: 6, value: 'x', targets: [[r, c]], area: dead.cells,
        text: `Probier's gedanklich: Ein leuchtender Squish hier erzwingt weitere leuchtender Squish – und am Ende hätte ${gname(dead, names)} keinen Platz mehr. Also: ✕.`
      };
    }
    return null;
  }
  function tryContradiction(N, reg, groups, marks, cand0, start) {
    const cand = cand0.map(row => row.slice());
    const placed = [];
    const place = p => { placed.push(p); for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (attacks(reg, p, [r, c]) || (r === p[0] && c === p[1])) cand[r][c] = false; };
    place(start);
    for (let guard = 0; guard < N * 2; guard++) {
      let progressed = false;
      for (const g of groups) {
        if (g.cells.some(([r, c]) => marks[r][c] === 2 || placed.some(p => p[0] === r && p[1] === c))) continue;
        const cs = g.cells.filter(([r, c]) => cand[r][c]);
        if (cs.length === 0) return g;
        if (cs.length === 1) { place(cs[0]); progressed = true; break; }
      }
      if (!progressed) return null;
    }
    return null;
  }
  // Hint for the player's board: first point out mistakes, then the easiest logical step
  function hint(rows, marks, names, solution) {
    const N = rows.length;
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (marks[r][c] === 2 && solution[r] !== c)
      return { tech: 0, value: 'clear', targets: [[r, c]], area: [[r, c]], error: true, text: 'Dieses leuchtender Squish sitzt falsch – nimm es lieber wieder weg.' };
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (marks[r][c] === 1 && solution[r] === c)
      return { tech: 0, value: 'clear', targets: [[r, c]], area: [[r, c]], error: true, text: 'Dieses ✕ ist voreilig – das Feld ist noch nicht ausgeschlossen.' };
    const s = findStep(rows, marks, names);
    if (s) return s;
    const r = solution.findIndex((c, r) => marks[r][c] !== 2);
    if (r < 0) return null;
    return { tech: 7, value: 'fly', targets: [[r, solution[r]]], area: [[r, solution[r]]], text: 'Hier wird es richtig knifflig – ich verrate dir ein leuchtender Squish.' };
  }
  // Solve from an empty board using only logical steps; reports techniques used
  function stepSolve(rows, names, opts = {}) {
    const N = rows.length;
    const marks = Array.from({ length: N }, () => Array(N).fill(0));
    const used = {}; const log = [];
    for (let i = 0; i < 500; i++) {
      const flies = marks.flat().filter(v => v === 2).length;
      if (flies === N) return { solved: true, used, log, marks };
      const s = findStep(rows, marks, names, opts);
      if (!s) return { solved: false, used, log, marks };
      used[s.tech] = (used[s.tech] || 0) + 1; log.push(s);
      for (const [r, c] of s.targets) marks[r][c] = s.value === 'fly' ? 2 : 1;
    }
    return { solved: false, used, log, marks };
  }
  const api = { solve, validate, generate, parse, findStep, hint, stepSolve };
  if (typeof module !== 'undefined') module.exports = api; else root.SquishEngine = api;
})(this);
