// SquishDoku guided missions (browser + node). Level 1 teaches the no-touch rule, level 2 the
// "colour inside one row/column claims that line" trick.
// The guide never plays for you: it only computes the next sensible action from the current board
// (which squishes the learnt rules rule out → "wisch weg", or which squish is now forced → "halt gedrückt").
(function (root) {
  // rules each tutorial level may use for its hints (cumulative)
  // Strategy curriculum (missions 1–6): each mission adds one technique.
  //  touch  M1: Einzel-Keks → halten, Nachbarn/Reihe/Spalte/Farbe weg, letzter Keks → halten
  //  claim  M2: Farbe liegt nur in einer Reihe/Spalte → Rest der Linie weg
  //  recap  M3: alles Bisherige auf 5×5 Schritt für Schritt (der Lösungsweg)
  //  shared M4: alle Kekse einer Farbe "sehen" denselben fremden Keks → der kann weg
  //  pair   M5: zwei Farben teilen sich genau zwei Reihen/Spalten → die anderen dort weg
  //  whatif M6: würde ein Keks eine ganze Farbe/Reihe/Spalte auslöschen → er kann weg
  const BASE = ['reg', 'row', 'col', 'touch'];
  const RULES = { touch: BASE, recap: [...BASE, 'claim'], claim: [...BASE, 'claim'], shared: [...BASE, 'claim', 'shared'], pair: [...BASE, 'claim', 'shared', 'pair'], whatif: [...BASE, 'claim', 'shared', 'pair', 'whatif'] };
  const sees = (a, b) => a[0] === b[0] || a[1] === b[1] || (Math.abs(a[0] - b[0]) <= 1 && Math.abs(a[1] - b[1]) <= 1);
  // why does a glow at a forbid b? → first matching learnt rule, or null
  function why(reg, rules, a, b) {
    if (a[0] === b[0] && a[1] === b[1]) return null;
    const touch = Math.abs(a[0] - b[0]) <= 1 && Math.abs(a[1] - b[1]) <= 1;
    if (rules.includes('touch') && touch && a[0] !== b[0] && a[1] !== b[1]) return 'touch'; // diagonal: only the touch rule
    if (rules.includes('row') && a[0] === b[0]) return 'row';
    if (rules.includes('col') && a[1] === b[1]) return 'col';
    if (rules.includes('reg') && reg[a[0]][a[1]] === reg[b[0]][b[1]]) return 'reg';
    if (rules.includes('touch') && touch) return 'touch';
    return null;
  }
  // state: N×N of 'normal' | 'glow' | 'popped'. Returns the next step:
  //  {type:'pop', rule, cells, from}   squishes the learnt rules rule out (grouped by rule, touch first)
  //  {type:'hold', cell, kind, idx}    the only squish left in a region/row/column without a glow
  //  {type:'done'} | {type:'stuck'}
  function nextStep(level, state, opts = {}) {
    const N = level.N, reg = level.regions.map(r => r.split('').map(ch => ch.charCodeAt(0) - 97));
    const rules = opts.rules || RULES[level.guide] || RULES.touch;
    const glows = []; let normals = 0;
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { if (state[r][c] === 'glow') glows.push([r, c]); else if (state[r][c] === 'normal') normals++; }
    if (glows.length === N) return { type: 'done' };
    if (!opts.noPops) {
      const by = {};
      for (const g of glows) for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        if (state[r][c] !== 'normal') continue;
        const w = why(reg, rules, g, [r, c]); if (!w) continue;
        if (Object.values(by).some(x => x.cells.some(([rr, cc]) => rr === r && cc === c))) continue;
        (by[w] ??= { cells: [], from: g }).cells.push([r, c]);
      }
      if (opts.merge) { const k = ['row', 'col', 'reg'].filter(w => by[w]); if (k.length) { by.known = { cells: k.flatMap(w => by[w].cells), from: by[k[0]].from }; k.forEach(w => delete by[w]); } }
      for (const w of ['touch', 'row', 'col', 'reg', 'known']) if (by[w]) return { type: 'pop', rule: w, cells: by[w].cells, from: by[w].from };
    }
    const kinds = rules.includes('row') ? ['reg', 'row', 'col'] : ['reg'];
    for (const kind of kinds) for (let i = 0; i < N; i++) {
      const cells = [];
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        const inG = kind === 'reg' ? reg[r][c] === i : kind === 'row' ? r === i : c === i;
        if (inG) cells.push([r, c]);
      }
      if (cells.some(([r, c]) => state[r][c] === 'glow')) continue;
      const free = cells.filter(([r, c]) => state[r][c] === 'normal');
      if (free.length === 1) return { type: 'hold', cell: free[0], kind, idx: i };
    }
    // claim: all squishes a colour has left lie in ONE row (or column). Its glow must be in that line,
    // so every other squish of the line can go.  {type:'pop', rule:'claim', cells, from, region, area, line}
    const tech = {};
    tech.claim = () => {
      for (let k = 0; k < N; k++) {
        const all = [], free = [];
        for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (reg[r][c] === k) { all.push([r, c]); if (state[r][c] === 'normal') free.push([r, c]); }
        if (!free.length || all.some(([r, c]) => state[r][c] === 'glow')) continue;
        for (const [kind, i] of [['row', 0], ['col', 1]]) {
          if (!free.every(x => x[i] === free[0][i])) continue;
          const L = free[0][i], cells = [];
          for (let j = 0; j < N; j++) { const [r, c] = kind === 'row' ? [L, j] : [j, L]; if (state[r][c] === 'normal' && reg[r][c] !== k) cells.push([r, c]); }
          if (cells.length) return { type: 'pop', rule: 'claim', cells, from: free[0], region: k, area: free, line: { kind, idx: L } };
        }
      }
    };
    const groups = () => { const g = []; for (let i = 0; i < N; i++) for (const kind of ['reg', 'row', 'col']) { const cells = []; for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (kind === 'reg' ? reg[r][c] === i : kind === 'row' ? r === i : c === i) cells.push([r, c]); if (!cells.some(([r, c]) => state[r][c] === 'glow')) g.push({ kind, idx: i, free: cells.filter(([r, c]) => state[r][c] === 'normal') }); } return g; };
    const regFree = k => { const all = []; for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (reg[r][c] === k) all.push([r, c]); return all.some(([r, c]) => state[r][c] === 'glow') ? null : all.filter(([r, c]) => state[r][c] === 'normal'); };
    // shared: every squish a colour has left "sees" one foreign squish (same row, column or touching):
    // whichever of them glows, that one goes out → it can go now.  {rule:'shared', cells, region, area}
    tech.shared = () => {
      for (let k = 0; k < N; k++) {
        const F = regFree(k); if (!F || F.length < 2) continue;
        const cells = [];
        for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (state[r][c] === 'normal' && reg[r][c] !== k && F.every(f => sees(f, [r, c]))) cells.push([r, c]);
        if (cells.length) return { type: 'pop', rule: 'shared', cells, from: F[0], region: k, area: F };
      }
    };
    // pair: two colours whose squishes lie in the same two rows (columns) own those lines together →
    // every other squish there can go.  {rule:'pair', cells, regions, area, lines:{kind, idx:[a,b]}}
    tech.pair = () => {
      for (let a = 0; a < N; a++) for (let b = a + 1; b < N; b++) {
        const Fa = regFree(a), Fb = regFree(b); if (!Fa || !Fb || !Fa.length || !Fb.length) continue;
        for (const [kind, i] of [['row', 0], ['col', 1]]) {
          const lines = [...new Set([...Fa, ...Fb].map(x => x[i]))].sort((x, y) => x - y); if (lines.length !== 2) continue;
          const cells = [];
          for (const L of lines) for (let j = 0; j < N; j++) { const [r, c] = kind === 'row' ? [L, j] : [j, L]; if (state[r][c] === 'normal' && reg[r][c] !== a && reg[r][c] !== b) cells.push([r, c]); }
          if (cells.length) return { type: 'pop', rule: 'pair', cells, from: Fa[0], regions: [a, b], area: [...Fa, ...Fb], lines: { kind, idx: lines } };
        }
      }
    };
    // whatif: if this squish glowed, a whole colour (row, column) would have no squish left → it cannot glow.
    //  {rule:'whatif', cells:[x], from:x, area: the group's squishes, group:{kind, idx}}
    tech.whatif = () => {
      const G = groups();
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        if (state[r][c] !== 'normal') continue;
        const x = [r, c], gone = y => (y[0] === r && y[1] === c) || sees(x, y) || reg[y[0]][y[1]] === reg[r][c];
        for (const g of G) {
          if (!g.free.length || g.free.some(y => y[0] === r && y[1] === c)) continue;
          if (g.free.every(gone)) return { type: 'pop', rule: 'whatif', cells: [x], from: x, area: g.free, group: { kind: g.kind, idx: g.idx } };
        }
      }
    };
    // the mission's own technique first (so the lesson shows up as soon as it applies), then the others;
    // "was wäre wenn" stays last: it would also catch the easier cases and should only show its new trick
    const order = ['claim', 'shared', 'pair', 'whatif'].filter(t => rules.includes(t)).sort((a, b) => (b === level.guide && b !== 'whatif') - (a === level.guide && a !== 'whatif'));
    for (const t of order) { const s = tech[t](); if (s) return s; }
    // fallback: point at the next solution squish
    if (opts.solutionFallback) {
      for (let r = 0; r < N; r++) { const c = level.solution[r]; if (state[r][c] !== 'glow') return { type: 'hold', cell: [r, c], kind: 'guide', idx: reg[r][c] }; }
    }
    return { type: 'stuck', normals };
  }
  // simulate the whole guided flow (tests + level design). Returns the list of steps or throws.
  function simulate(level, opts = {}) {
    const N = level.N, st = Array.from({ length: N }, () => Array(N).fill('normal'));
    for (const [r, c] of level.prePopped || []) st[r][c] = 'popped';
    const steps = [];
    for (let i = 0; i < 200; i++) {
      const s = nextStep(level, st, opts); steps.push(s);
      if (s.type === 'done') return steps;
      if (s.type === 'stuck') throw new Error('stuck after ' + steps.length);
      if (s.type === 'pop') for (const [r, c] of s.cells) { if (level.solution[r] === c) throw new Error('would pop a solution squish'); st[r][c] = 'popped'; }
      if (s.type === 'hold') { const [r, c] = s.cell; if (level.solution[r] !== c) throw new Error('would glow a wrong squish'); st[r][c] = 'glow'; }
    }
    throw new Error('no end');
  }
  const api = { RULES, nextStep, simulate, why };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.SquishTutorial = api;
})(typeof window !== 'undefined' ? window : globalThis);
