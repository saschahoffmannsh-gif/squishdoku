// SquishDoku – Tutorial (Level 1–3) und Regel-Leiste über dem Brett.
// Die Hand zeigt nur, was als Nächstes sinnvoll ist; spielen (halten, wischen) muss man selbst.
// Logik: src/tutorial.js (window.SquishTutorial) berechnet den nächsten Schritt aus dem Brett.
const T = window.SquishTutorial;

// ---------- Regel-Leiste ----------
// Eigene Mini-Animationen (Squish-Icons) statt Gitter: Farbe → einer leuchtet, der Rest ploppt;
// Reihe & Spalte → Kreuz ploppt; Berühren → ein zweiter Leuchter rückt heran und wird rot.
export const RULES = [
  { key: 'reg', label: '1 Leuchter pro Farbe', tip: 'Jede <b>Farbe</b> hat genau <b>einen</b> Leuchter – die anderen Squishs dieser Farbe können weg.' },
  { key: 'rowcol', label: '1 pro Reihe & Spalte', tip: 'In jeder <b>Reihe</b> und jeder <b>Spalte</b> leuchtet genau <b>ein</b> Squish.' },
  { key: 'touch', label: 'Leuchter berühren sich nie', tip: 'Leuchter berühren sich <b>nie</b> – auch nicht <b>schräg</b>.' },
];
function icon(key) {
  const sq = (cls, x, y) => `<i class="ri-sq ${cls}" style="--x:${x};--y:${y}"></i>`;
  if (key === 'reg') return sq('c1 is-pop', 0, 1) + sq('c1 is-star', 1, 1) + sq('c1 is-pop', 2, 1);
  if (key === 'rowcol') return [[0, 0, 'c2'], [1, 0, 'c3 is-pop'], [2, 0, 'c2'], [0, 1, 'c3 is-pop'], [1, 1, 'c3 is-star'], [2, 1, 'c3 is-pop'], [0, 2, 'c2'], [1, 2, 'c3 is-pop'], [2, 2, 'c2']]
    .map(([x, y, c]) => sq('ri-tiny ' + c, x, y)).join('');
  return sq('c4 is-star', 0, 1) + sq('c4 is-bump', 2, 1) + '<b class="ri-x"></b>';
}
export function createRulesBar(el, { store, save, onTip }) {
  el.innerHTML = `<div class="sd-rb-chips">${RULES.map((r, i) => `<button type="button" class="sd-rb-chip" data-rule="${r.key}" style="--i:${i}" aria-label="Regel: ${r.label} – antippen für die Mini-Animation"><span class="sd-rb-ico" aria-hidden="true">${icon(r.key)}</span><span class="sd-rb-txt">${r.label}</span></button>`).join('')}</div>
    <button type="button" class="sd-rb-toggle" aria-label="Regeln ein- oder ausklappen"><span class="sd-rb-pill">Regeln</span><i aria-hidden="true"></i></button>`;
  const chips = [...el.querySelectorAll('.sd-rb-chip')], toggle = el.querySelector('.sd-rb-toggle');
  function demo(chip) { chip.classList.remove('is-demo'); void chip.offsetWidth; chip.classList.add('is-demo'); clearTimeout(chip._t); chip._t = setTimeout(() => chip.classList.remove('is-demo'), 2300); }
  chips.forEach((c, i) => c.addEventListener('click', () => { if (c.classList.contains('is-locked')) return; demo(c); onTip?.(RULES[i]); }));
  toggle.addEventListener('click', () => { store.rulesCollapsed = !el.classList.contains('is-collapsed'); save(); el.classList.toggle('is-collapsed', store.rulesCollapsed); onTip?.(null); });
  return {
    // tutorial level n shows rules 1..n (the new one pulses and plays its demo); later levels: all, collapsible
    setLevel(L) {
      const n = L.tutorial || 3;
      el.classList.toggle('is-tut', !!L.tutorial);
      el.classList.toggle('is-collapsed', !L.tutorial && !!store.rulesCollapsed);
      chips.forEach((c, i) => { c.classList.toggle('is-locked', i >= n); c.classList.toggle('is-new', !!L.tutorial && i === n - 1); c.disabled = i >= n; });
      if (L.tutorial) setTimeout(() => demo(chips[n - 1]), 500);
    },
    demo: i => demo(chips[i]), chips,
  };
}

// ---------- Tutorial ----------
const HAND = '<svg viewBox="0 0 44 52" aria-hidden="true"><path d="M12 27V6.5a4 4 0 0 1 8 0V18a3.5 3.5 0 0 1 7 0v2a3.5 3.5 0 0 1 7 0v2.5a3.3 3.3 0 0 1 6.5 0V33c0 9-6 15-14 15h-3c-6 0-9-3-12-7.5l-6-9a3.6 3.6 0 0 1 6-4.2z" fill="#fff" stroke="#140a10" stroke-width="3" stroke-linejoin="round"/><path d="M20 18.5v6M27 20.5v5M34 23v5" stroke="#140a10" stroke-width="2.4" stroke-linecap="round"/><path d="M14.5 9.5c.3-2 1.4-3 3-3" stroke="#d6dcf0" stroke-width="2.2" stroke-linecap="round" fill="none"/></svg>';
const TXT = {
  1: {
    intro: ['Hallo! Hier bringst du Squishs zum <b>Leuchten</b>. Regel 1: <b>Jede Farbe</b> bekommt genau <b>einen Leuchter</b>.'],
    hold_reg: ['Diese Farbe hat nur <b>einen</b> Squish – also muss er leuchten. <b>Halte ihn gedrückt!</b>'],
    hold_guide: ['Super, er leuchtet! Jede Farbe braucht ihren Leuchter. <b>Halte</b> den Squish, auf den ich zeige.', 'Klasse! Der nächste – <b>gedrückt halten</b>.', 'Noch eine Farbe fehlt – <b>halten</b>!'],
  },
  2: {
    intro: ['Regel 2: In jeder <b>Reihe</b> und jeder <b>Spalte</b> leuchtet genau <b>ein</b> Squish.'],
    hold_reg: ['Fang bei der Farbe mit nur <b>einem</b> Squish an – <b>halten!</b>', 'Diese <b>Farbe</b> hat nur noch <b>einen</b> Squish – <b>halten!</b>'],
    pop_row: ['In seiner <b>Reihe</b> darf jetzt keiner mehr leuchten. <b>Wisch</b> mit dem Finger über diese Squishs!', 'Wieder seine <b>Reihe</b>: <b>wegwischen</b>!'],
    pop_col: ['Genauso in seiner <b>Spalte</b> – <b>wisch</b> sie weg!', 'Und die <b>Spalte</b> – weg damit!'],
    pop_reg: ['Diese <b>Farbe</b> hat schon ihren Leuchter – der Rest kann <b>weg</b>.'],
    hold_row: ['In dieser <b>Reihe</b> ist nur noch <b>ein</b> Squish übrig – <b>halte ihn!</b>'],
    hold_col: ['In dieser <b>Spalte</b> ist nur noch <b>ein</b> Squish übrig – <b>halte ihn!</b>'],
  },
  3: {
    intro: ['Regel 3: Leuchter <b>berühren sich nie</b> – auch nicht <b>schräg</b>!', 'Achtung: Ein <b>falscher</b> Squish kostet ein <b>Herz</b>. Sind alle drei weg, startest du neu.'],
    hold_reg: ['Los: Diese Farbe hat nur <b>einen</b> Squish – <b>halten!</b>', 'Diese <b>Farbe</b> hat nur noch <b>einen</b> Squish – <b>halten!</b>'],
    pop_touch: ['Rund um einen Leuchter darf keiner leuchten – <b>auch schräg nicht</b>. Wisch die <b>Nachbarn</b> weg!', 'Wieder die <b>Nachbarn</b> – auch die schrägen. <b>Weg damit!</b>'],
    pop_known: ['<b>Reihe</b>, <b>Spalte</b>, <b>Farbe</b> – kennst du schon. <b>Wegwischen!</b>', 'Und wieder: <b>Reihe</b>, <b>Spalte</b>, <b>Farbe</b> weg!'],
    hold_row: ['In dieser <b>Reihe</b> ist nur noch <b>ein</b> Squish übrig – <b>halte ihn!</b>'],
    hold_col: ['In dieser <b>Spalte</b> ist nur noch <b>ein</b> Squish übrig – <b>halte ihn!</b>'],
  },
};
const FALLBACK = 'Halte den Squish, auf den ich zeige.';
const OUCH = 'Autsch! Der durfte nicht – das kostet ein <b>Herz</b>. Folge der Hand!';

export function createTutorial({ stage, board, getS }) {
  const layer = document.createElement('div'); layer.className = 'sd-tut-layer'; layer.setAttribute('aria-hidden', 'true');
  const hand = document.createElement('div'); hand.className = 'sd-tut-hand'; hand.innerHTML = HAND;
  const bubble = document.createElement('div'); bubble.className = 'sd-tut-bubble'; bubble.id = 'tut-bubble'; bubble.setAttribute('role', 'status'); bubble.setAttribute('aria-live', 'polite');
  bubble.innerHTML = '<span class="sd-tut-kicker"></span><p class="sd-tut-text"></p><button type="button" class="sd-tut-next" id="tut-next">Weiter</button>';
  layer.append(hand); stage.append(layer, bubble);
  const text = bubble.querySelector('.sd-tut-text'), next = bubble.querySelector('#tut-next'), kicker = bubble.querySelector('.sd-tut-kicker');
  let run = null, anim = null, timer = 0, ouchUntil = 0;
  next.addEventListener('click', () => { if (!run) return; run.intro++; update(true); });
  window.addEventListener('resize', () => requestAnimationFrame(() => run && place()));

  function opts(L) { return L.tutorial === 1 ? { noPops: true, solutionFallback: true } : { merge: L.tutorial === 3, solutionFallback: true }; }
  function say(html) { if (text.innerHTML !== html) { text.innerHTML = html; bubble.classList.remove('is-say'); void bubble.offsetWidth; bubble.classList.add('is-say'); } }
  function pick(key) { const list = TXT[run.L.tutorial][key]; const n = run.count[key] || 0; return list ? list[Math.min(n, list.length - 1)] : FALLBACK; }
  function clearMarks() { layer.querySelectorAll('.sd-tut-mark').forEach(m => m.remove()); anim?.cancel(); anim = null; hand.classList.remove('is-hold', 'is-on'); }
  // split the squishes to wipe into strokes the finger can draw without touching anything else:
  // neighbours (no diagonals) in one stroke, nearest one first. The hand shows the first stroke;
  // when it is done the step is recomputed and the hand moves on.
  function strokes(cells, from) {
    const left = cells.slice(), out = []; let cur = from;
    const near = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1;
    while (left.length) {
      let bi = 0, bd = 1e9; left.forEach(([r, c], i) => { const d = Math.hypot(r - cur[0], c - cur[1]); if (d < bd) { bd = d; bi = i; } });
      const run = [left.splice(bi, 1)[0]];
      for (;;) { const i = left.findIndex(x => near(x, run[run.length - 1])); if (i < 0) break; run.push(left.splice(i, 1)[0]); }
      out.push(run); cur = run[run.length - 1];
    }
    return out;
  }
  function place() {
    clearMarks();
    const st = run.step; if (!st) return;
    const sr = stage.getBoundingClientRect();
    const at = ([r, c]) => { const p = board.screenOf(r, c); return { x: p.x - sr.left, y: p.y - sr.top, s: p.size }; };
    if (st.type === 'intro') {
      if (st.hearts) { const h = document.getElementById('hearts').getBoundingClientRect(); const m = document.createElement('i'); m.className = 'sd-tut-mark is-hearts'; Object.assign(m.style, { left: `${h.left - sr.left + h.width / 2}px`, top: `${h.top - sr.top + h.height / 2}px`, width: `${h.width + 18}px`, height: `${h.height + 14}px` }); layer.append(m); }
      return;
    }
    const cells = st.type === 'hold' ? [st.cell] : st.cells;
    for (const cell of cells) { const p = at(cell), m = document.createElement('i'); m.className = 'sd-tut-mark ' + (st.type === 'hold' ? 'is-hold' : 'is-pop'); Object.assign(m.style, { left: `${p.x}px`, top: `${p.y}px`, width: `${p.s * (st.type === 'hold' ? 1.35 : 1.05)}px`, height: `${p.s * (st.type === 'hold' ? 1.35 : 1.05)}px` }); layer.append(m); }
    const pts = (st.type === 'hold' ? [st.cell] : st.path).map(at); hand.classList.add('is-on');
    if (pts.length === 1) {
      Object.assign(hand.style, { left: `${pts[0].x}px`, top: `${pts[0].y}px` }); hand.classList.add('is-hold');
    } else {
      const frames = [], n = pts.length, seg = 1 / (n + 2);
      frames.push({ left: `${pts[0].x}px`, top: `${pts[0].y}px`, opacity: 0, offset: 0 });
      frames.push({ left: `${pts[0].x}px`, top: `${pts[0].y}px`, opacity: 1, offset: seg * .6 });
      pts.forEach((p, i) => frames.push({ left: `${p.x}px`, top: `${p.y}px`, opacity: 1, offset: seg * (1 + i) }));
      frames.push({ left: `${pts[n - 1].x}px`, top: `${pts[n - 1].y}px`, opacity: 0, offset: Math.min(1, seg * (n + 1.4)) });
      frames.push({ left: `${pts[n - 1].x}px`, top: `${pts[n - 1].y}px`, opacity: 0, offset: 1 });
      anim = hand.animate(frames, { duration: 500 + n * 380, iterations: Infinity, easing: 'linear' });
    }
  }
  function update(force) {
    const S = getS(); if (!run || !S || S !== run.S) return;
    if (!force && performance.now() < ouchUntil) return;
    const L = run.L, intros = TXT[L.tutorial].intro;
    let st, key;
    if (run.intro < intros.length) { st = { type: 'intro', hearts: L.tutorial === 3 && run.intro === 1 }; key = 'intro'; }
    else { st = T.nextStep(L, S.state, opts(L)); if (st.type === 'pop') st.path = strokes(st.cells, st.from)[0]; key = st.type === 'pop' ? 'pop_' + st.rule : st.type === 'hold' ? 'hold_' + st.kind : st.type; }
    const sig = JSON.stringify(st) + run.intro;
    if (sig === run.sig && !force) return;
    // a finished step counts once, so the next one of the same kind gets the shorter text
    const cont = run.key === key && st.cells && run.step?.cells && st.cells.every(([r, c]) => run.step.cells.some(([rr, cc]) => rr === r && cc === c)); // same wipe, next stroke
    if (run.key && run.key !== 'intro' && run.sig && run.sig !== sig && !cont) run.count[run.key] = (run.count[run.key] || 0) + 1;
    run.sig = sig; run.step = st; run.key = key;
    run.blocking = st.type === 'intro';
    next.hidden = st.type !== 'intro';
    bubble.classList.toggle('is-intro', st.type === 'intro');
    if (st.type === 'intro') say(intros[run.intro]);
    else if (st.type === 'done') { say(L.tutorial === 3 ? 'Perfekt – alle drei Regeln sitzen!' : 'Geschafft! Weiter geht’s.'); clearMarks(); return; }
    else say(pick(key));
    place();
  }
  return {
    get active() { return !!run; },
    get blocking() { return !!run?.blocking; },
    get step() { return run?.step || null; },
    start(S) {
      run = { S, L: S.L, intro: 0, count: {}, sig: '', key: '' };
      kicker.textContent = `Tutorial ${S.L.tutorial}/3`;
      stage.classList.add('is-tut'); bubble.hidden = false; layer.hidden = false; update(true);
    },
    stop() { run = null; clearMarks(); stage.classList.remove('is-tut'); bubble.hidden = true; layer.hidden = true; },
    // after every move (debounced so a swipe finishes before the next hint appears)
    changed() { clearTimeout(timer); timer = setTimeout(() => update(false), 160); },
    ouch() { if (!run) return; ouchUntil = performance.now() + 2200; say(OUCH); bubble.classList.add('is-ouch'); clearTimeout(timer); timer = setTimeout(() => { bubble.classList.remove('is-ouch'); run && (run.sig = '', update(true)); }, 2250); },
  };
}
