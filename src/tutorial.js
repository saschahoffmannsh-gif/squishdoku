// SquishDoku guided missions (browser + node). Level 1 teaches the no-touch rule, level 2 the
// "colour inside one row/column claims that line" trick.
// The guide never plays for you: it only computes the next sensible action from the current board
// (which squishes the learnt rules rule out → "wisch weg", or which squish is now forced → "halt gedrückt").
(function (root) {
  // rules each tutorial level may use for its hints (cumulative)
  const RULES = { touch: ['reg', 'row', 'col', 'touch'], claim: ['reg', 'row', 'col', 'touch', 'claim'] };
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
    if (rules.includes('claim')) {
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
    }
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
