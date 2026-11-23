// SquishDoku – Missionen mit Anleitung (Level 1–6, je ein Lösungs-Trick) und Regel-Leiste über dem Brett.
// Die Hand zeigt nur, was als Nächstes sinnvoll ist; spielen (halten, wischen) muss man selbst.
// Logik: src/tutorial.js (window.SquishTutorial) berechnet den nächsten Schritt aus dem Brett.
const T = window.SquishTutorial;

// ---------- Regel-Leiste ----------
// Eigene Mini-Animationen (Squish-Icons) statt Gitter: Farbe → einer leuchtet, der Rest ploppt;
// Reihe & Spalte → Kreuz ploppt; Berühren → ein zweiter Leuchter rückt heran und wird rot.
export const RULES = [
  { key: 'reg', label: '1 Leuchter pro Farbe', tip: 'Jede <b>Farbe</b> hat genau <b>einen</b> Leuchter – die anderen Kekse dieser Farbe können weg.' },
  { key: 'rowcol', label: '1 pro Reihe & Spalte', tip: 'In jeder <b>Reihe</b> und jeder <b>Spalte</b> leuchtet genau <b>ein</b> Keks.' },
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
    // all three rules from the start; guided missions keep the bar open (no fold button)
    setLevel(L) {
      el.classList.toggle('is-tut', !!L.guide);
      el.classList.toggle('is-collapsed', !L.guide && !!store.rulesCollapsed);
      chips.forEach(c => { c.classList.remove('is-locked', 'is-new'); c.disabled = false; });
      if (L.guide === 'touch') setTimeout(() => demo(chips[2]), 500);
    },
    demo: i => demo(chips[i]), chips,
  };
}

// ---------- Tutorial ----------
const HAND = '<svg viewBox="0 0 44 52" aria-hidden="true"><path d="M12 27V6.5a4 4 0 0 1 8 0V18a3.5 3.5 0 0 1 7 0v2a3.5 3.5 0 0 1 7 0v2.5a3.3 3.3 0 0 1 6.5 0V33c0 9-6 15-14 15h-3c-6 0-9-3-12-7.5l-6-9a3.6 3.6 0 0 1 6-4.2z" fill="#fff" stroke="#140a10" stroke-width="3" stroke-linejoin="round"/><path d="M20 18.5v6M27 20.5v5M34 23v5" stroke="#140a10" stroke-width="2.4" stroke-linecap="round"/><path d="M14.5 9.5c.3-2 1.4-3 3-3" stroke="#d6dcf0" stroke-width="2.2" stroke-linecap="round" fill="none"/></svg>';
const TXT = {
  // Mission 1: alle Regeln, vor allem „Leuchter berühren sich nie“ + Herzen
  touch: {
    intro: ['Willkommen! In jeder <b>Farbe</b>, <b>Reihe</b> und <b>Spalte</b> leuchtet genau <b>ein</b> Keks. Und: Leuchter <b>berühren sich nie</b> – auch nicht <b>schräg</b>!', 'Achtung: Ein <b>falscher</b> Keks kostet ein <b>Herz</b>. Sind alle drei weg, startest du neu.'],
    hold_reg: ['Los: Diese Farbe hat nur <b>einen</b> Keks – <b>halte ihn gedrückt!</b>', 'Diese <b>Farbe</b> hat nur noch <b>einen</b> Keks – <b>halten!</b>'],
    pop_touch: ['Rund um einen Leuchter darf keiner leuchten – <b>auch schräg nicht</b>. <b>Wisch</b> die <b>Nachbarn</b> weg!', 'Wieder die <b>Nachbarn</b> – auch die schrägen. <b>Weg damit!</b>'],
    pop_known: ['Seine <b>Reihe</b>, <b>Spalte</b> und <b>Farbe</b> sind jetzt besetzt – <b>wisch</b> die anderen dort weg!', 'Und wieder: <b>Reihe</b>, <b>Spalte</b>, <b>Farbe</b> weg!'],
    hold_row: ['In dieser <b>Reihe</b> ist nur noch <b>ein</b> Keks übrig – <b>halte ihn!</b>'],
    hold_col: ['In dieser <b>Spalte</b> ist nur noch <b>ein</b> Keks übrig – <b>halte ihn!</b>'],
    done: 'Perfekt – alle Regeln sitzen!',
  },
  // Mission 2: Profi-Trick „eine Farbe liegt nur in einer Reihe → die Reihe gehört ihr“
  claim: {
    intro: ['Mission 2: ein <b>Profi-Trick</b>! Hier gibt es keine Farbe mit nur einem Keks. Trotzdem kannst du sicher starten – ich zeig dir wie.'],
    pop_claim_row: ['Schau: Diese Farbe liegt <b>nur in dieser Reihe</b>. Ihr Leuchter <b>muss</b> also hier sein – deshalb kann sonst <b>keiner</b> in der Reihe leuchten. <b>Wisch</b> die anderen weg!',
      'Gleicher Trick: Diese Farbe hat jetzt nur noch Kekse in <b>einer Reihe</b>. Ihr Leuchter gehört in diese Reihe – also können die <b>anderen</b> dort weg!'],
    pop_claim_col: ['Schau: Diese Farbe liegt <b>nur in dieser Spalte</b>. Ihr Leuchter <b>muss</b> also hier sein – deshalb kann sonst <b>keiner</b> in der Spalte leuchten. <b>Wisch</b> die anderen weg!',
      'Gleicher Trick: Diese Farbe hat jetzt nur noch Kekse in <b>einer Spalte</b>. Ihr Leuchter gehört in diese Spalte – also können die <b>anderen</b> dort weg!'],
    hold_reg: ['Siehst du? Durch den Trick hat diese Farbe nur noch <b>einen</b> Keks – <b>halte ihn!</b>', 'Diese <b>Farbe</b> hat nur noch <b>einen</b> Keks – <b>halten!</b>'],
    pop_touch: ['Jetzt wie immer: die <b>Nachbarn</b> des Leuchters (auch schräg) können weg!', 'Wieder die <b>Nachbarn</b> – weg damit!'],
    pop_known: ['Seine <b>Reihe</b>, <b>Spalte</b> und <b>Farbe</b> sind besetzt – <b>wegwischen!</b>', 'Und wieder: <b>Reihe</b>, <b>Spalte</b>, <b>Farbe</b> weg!'],
    hold_row: ['In dieser <b>Reihe</b> ist nur noch <b>ein</b> Keks übrig – <b>halte ihn!</b>'],
    hold_col: ['In dieser <b>Spalte</b> ist nur noch <b>ein</b> Keks übrig – <b>halte ihn!</b>'],
    done: 'Stark! Den <b>Reihen-Trick</b> brauchst du ab jetzt öfter – halte immer Ausschau nach Farben, die nur in einer Reihe oder Spalte liegen.',
  },
};
// Missionen 3–6: dieselben Grundschritte, kurz – plus je ein neuer Trick
const BASICS = {
  hold_reg: ['Diese <b>Farbe</b> hat nur noch <b>einen</b> Keks – <b>halte ihn gedrückt!</b>', 'Nur noch <b>ein</b> Keks in dieser Farbe – <b>halten!</b>'],
  pop_touch: ['Rund um den Leuchter darf keiner leuchten – auch <b>schräg</b> nicht. <b>Wisch</b> die Nachbarn weg!', 'Wieder die <b>Nachbarn</b> – weg damit!'],
  pop_known: ['<b>Reihe</b>, <b>Spalte</b> und <b>Farbe</b> des Leuchters sind besetzt – <b>wisch</b> die anderen dort weg!', 'Und wieder: <b>Reihe</b>, <b>Spalte</b>, <b>Farbe</b> weg!'],
  hold_row: ['In dieser <b>Reihe</b> ist nur noch <b>ein</b> Keks übrig – <b>halte ihn!</b>'],
  hold_col: ['In dieser <b>Spalte</b> ist nur noch <b>ein</b> Keks übrig – <b>halte ihn!</b>'],
  pop_claim_row: ['<b>Reihen-Trick:</b> Die goldene Farbe liegt nur in <b>dieser Reihe</b> – die Reihe gehört ihr. Die <b>anderen</b> dort können weg!'],
  pop_claim_col: ['<b>Reihen-Trick:</b> Die goldene Farbe liegt nur in <b>dieser Spalte</b> – die Spalte gehört ihr. Die <b>anderen</b> dort können weg!'],
  pop_shared: ['<b>Kreuzfeuer:</b> Jeder Keks der goldenen Farbe würde die markierten blockieren – <b>weg damit!</b>'],
  pop_pair_row: ['<b>Doppel-Trick:</b> Zwei goldene Farben, nur <b>zwei Reihen</b> – die gehören ihnen. Rest dort <b>weg!</b>'],
  pop_pair_col: ['<b>Doppel-Trick:</b> Zwei goldene Farben, nur <b>zwei Spalten</b> – die gehören ihnen. Rest dort <b>weg!</b>'],
};
const whatif = what => ['Was wäre, wenn <b>dieser</b> Keks leuchtet? Er würde alle Kekse ' + what + ' blockieren – dann gäbe es dort <b>keinen</b> Leuchter. Also: <b>weg damit!</b>',
  '<b>Was wäre wenn?</b> Dieser Keks würde ' + what + ' alles nehmen – <b>weg!</b>'];
Object.assign(TXT, {
  // Mission 3: der ganze Lösungsweg in vier Schritten (Einzel-Keks → ausräumen → Reihen-Trick → letzter Keks)
  recap: { ...BASICS,
    intro: ['Mission 3: Jetzt zeig ich dir den <b>ganzen Lösungsweg</b>. So gehst du ab jetzt jedes Level an!',
      '<b>1.</b> Einzel-Keks halten. <b>2.</b> Alles wegwischen, was er blockiert. <b>3.</b> Reihen-Trick. <b>4.</b> Letzten Keks halten.'],
    hold_reg: ['<b>Schritt 1:</b> Such den <b>Einzel-Keks</b> – diese Farbe hat nur <b>ein</b> Feld. Der <b>muss</b> leuchten: <b>halte ihn!</b>', '<b>Letzter Keks</b> seiner Farbe – <b>halten!</b>'],
    pop_touch: ['<b>Schritt 2:</b> Ausräumen! Erst die <b>Nachbarn</b> – auch die schrägen. <b>Weg damit!</b>', 'Wieder die <b>Nachbarn</b> – weg damit!'],
    pop_known: ['Dann seine <b>Reihe</b>, <b>Spalte</b> und <b>Farbe</b> – da leuchtet sonst keiner. <b>Wegwischen!</b>', 'Und wieder: <b>Reihe</b>, <b>Spalte</b>, <b>Farbe</b> weg!'],
    pop_claim_row: ['<b>Schritt 3:</b> Kein Einzel-Keks mehr? Die goldene Farbe liegt nur in <b>einer Reihe</b> – die gehört ihr. Rest dort <b>weg!</b>'],
    pop_claim_col: ['<b>Schritt 3:</b> Kein Einzel-Keks mehr? Die goldene Farbe liegt nur in <b>einer Spalte</b> – die gehört ihr. Rest dort <b>weg!</b>'],
    hold_row: ['<b>Schritt 4:</b> In dieser <b>Reihe</b> ist nur noch <b>ein</b> Keks übrig – <b>halte ihn!</b>'],
    hold_col: ['<b>Schritt 4:</b> In dieser <b>Spalte</b> ist nur noch <b>ein</b> Keks übrig – <b>halte ihn!</b>'],
    done: 'Super! Das ist der Weg: <b>Einzel-Keks → ausräumen → Reihen-Trick → letzter Keks</b>.',
  },
  // Mission 4: Kreuzfeuer – was ALLE Kekse einer Farbe blockieren, kann weg
  shared: { ...BASICS,
    intro: ['Mission 4: das <b>Kreuzfeuer</b>! Du kannst Kekse wegwischen, auch wenn du noch nicht weißt, wo der Leuchter sitzt.'],
    pop_shared: ['Die <b>goldene</b> Farbe bekommt sicher einen Leuchter – und <b>jeder</b> ihrer Kekse würde die markierten blockieren. Also: <b>weg damit!</b>',
      'Wieder <b>Kreuzfeuer</b>: Alle goldenen Kekse blockieren die markierten – <b>wegwischen!</b>'],
    hold_reg: ['Siehst du? Jetzt hat diese Farbe nur noch <b>einen</b> Keks – <b>halte ihn!</b>', 'Nur noch <b>ein</b> Keks in dieser Farbe – <b>halten!</b>'],
    done: 'Stark! <b>Kreuzfeuer:</b> Was <b>alle</b> Kekse einer Farbe blockieren, kann immer weg.',
  },
  // Mission 5: Doppel-Trick – zwei Farben in denselben zwei Reihen (Spalten)
  pair: { ...BASICS,
    intro: ['Mission 5: der <b>Doppel-Trick</b> – wie der Reihen-Trick, nur mit <b>zwei</b> Farben und <b>zwei</b> Reihen.'],
    pop_pair_row: ['Die zwei <b>goldenen</b> Farben liegen nur in <b>diesen zwei Reihen</b>. Zwei Farben = zwei Leuchter – beide Reihen sind voll. Rest dort: <b>weg!</b>',
      'Wieder <b>zwei Farben in zwei Reihen</b> – die anderen dort können weg!'],
    pop_pair_col: ['Die zwei <b>goldenen</b> Farben liegen nur in <b>diesen zwei Spalten</b>. Zwei Farben = zwei Leuchter – beide Spalten sind voll. Rest dort: <b>weg!</b>',
      'Wieder <b>zwei Farben in zwei Spalten</b> – die anderen dort können weg!'],
    hold_reg: ['Siehst du? Jetzt hat diese Farbe nur noch <b>einen</b> Keks – <b>halte ihn!</b>', 'Nur noch <b>ein</b> Keks in dieser Farbe – <b>halten!</b>'],
    done: 'Klasse! Zwei Farben in <b>zwei Reihen</b> (oder Spalten)? Dann gehören die nur ihnen.',
  },
  // Mission 6: Was wäre wenn – ein Keks, der eine ganze Farbe/Reihe/Spalte auslöschen würde, kann weg
  whatif: { ...BASICS,
    intro: ['Letzte Mission: <b>Was wäre wenn?</b> Stell dir vor, ein Keks leuchtet – und schau, was dann übrig bliebe.', 'Erst räumen wir mit den bekannten Tricks auf. Folge der Hand!'],
    pop_whatif_row: whatif('der <b>goldenen Reihe</b>'), pop_whatif_col: whatif('der <b>goldenen Spalte</b>'), pop_whatif_reg: whatif('der <b>goldenen Farbe</b>'),
    done: 'Geschafft – du kennst jetzt <b>alle Tricks</b>! Ab jetzt löst du allein.',
  },
});
// Kicker über der Sprechblase
const KICK = { touch: 'Anleitung', claim: 'Profi-Trick', recap: 'Lösungsweg', shared: 'Kreuzfeuer', pair: 'Doppel-Trick', whatif: 'Was wäre wenn' };
const FALLBACK = 'Halte den Keks, auf den ich zeige.';
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

  function opts() { return { merge: true, solutionFallback: true }; }
  function say(html) { if (text.innerHTML !== html) { text.innerHTML = html; bubble.classList.remove('is-say'); void bubble.offsetWidth; bubble.classList.add('is-say'); } }
  function pick(key) { const list = TXT[run.L.guide][key]; const n = run.count[key] || 0; return list ? list[Math.min(n, list.length - 1)] : FALLBACK; }
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
    // the reason for the wipe: the line(s) a colour claims (band) and the squishes that force it (gold)
    const N = run.L.N, bandOf = (kind, idx) => {
      const ends = kind === 'row' ? [[idx, 0], [idx, N - 1]] : [[0, idx], [N - 1, idx]];
      const a = at(ends[0]), b = at(ends[1]), band = document.createElement('i'); band.className = 'sd-tut-mark is-band';
      Object.assign(band.style, { left: `${(a.x + b.x) / 2}px`, top: `${(a.y + b.y) / 2}px`, width: `${Math.hypot(b.x - a.x, b.y - a.y) + (a.s + b.s) / 2 * 1.15}px`, height: `${(a.s + b.s) / 2 * 1.2}px`, transform: `translate(-50%,-50%) rotate(${Math.atan2(b.y - a.y, b.x - a.x)}rad)` });
      layer.append(band);
    };
    if (st.line) bandOf(st.line.kind, st.line.idx);
    if (st.lines) st.lines.idx.forEach(i => bandOf(st.lines.kind, i));
    if (st.group && st.group.kind !== 'reg') bandOf(st.group.kind, st.group.idx);
    if (st.area) for (const cell of st.area) { const p = at(cell), m = document.createElement('i'); m.className = 'sd-tut-mark is-claim'; Object.assign(m.style, { left: `${p.x}px`, top: `${p.y}px`, width: `${p.s * 1.12}px`, height: `${p.s * 1.12}px` }); layer.append(m); }
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
    const L = run.L, intros = TXT[L.guide].intro;
    let st, key;
    if (run.intro < intros.length) { st = { type: 'intro', hearts: L.guide === 'touch' && run.intro === 1 }; key = 'intro'; }
    else { st = T.nextStep(L, S.state, opts(L)); if (st.type === 'pop') st.path = strokes(st.cells, st.from)[0]; const sub = st.line?.kind || st.lines?.kind || st.group?.kind; key = st.type === 'pop' ? 'pop_' + st.rule + (sub ? '_' + sub : '') : st.type === 'hold' ? 'hold_' + st.kind : st.type; }
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
    else if (st.type === 'done') { say(TXT[L.guide].done); clearMarks(); return; }
    else say(pick(key));
    place();
  }
  return {
    get active() { return !!run; },
    get blocking() { return !!run?.blocking; },
    get step() { return run?.step || null; },
    start(S) {
      run = { S, L: S.L, intro: 0, count: {}, sig: '', key: '' };
      kicker.textContent = `Mission ${S.L.id} · ${KICK[S.L.guide] || 'Anleitung'}`;
      stage.classList.add('is-tut'); bubble.hidden = false; layer.hidden = false; update(true);
    },
    stop() { run = null; clearMarks(); stage.classList.remove('is-tut'); bubble.hidden = true; layer.hidden = true; },
    // after every move (debounced so a swipe finishes before the next hint appears)
    changed() { clearTimeout(timer); timer = setTimeout(() => update(false), 160); },
    ouch() { if (!run) return; ouchUntil = performance.now() + 2200; say(OUCH); bubble.classList.add('is-ouch'); clearTimeout(timer); timer = setTimeout(() => { bubble.classList.remove('is-ouch'); run && (run.sig = '', update(true)); }, 2250); },
  };
}
