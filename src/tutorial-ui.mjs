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
// Missionen 3–6: dieselben Grundschritte – plus je ein neuer Trick. Texte für die Tricks werden aus dem
// Brett gebaut (wer blockiert wen und wie: berührt / gleiche Reihe / gleiche Spalte / gleiche Farbe), damit
// das „Warum“ konkret ist. Ein Text kann eine Funktion (i) sein; i kommt aus explainInfo() unten.
const NUM = ['kein', 'ein', 'zwei', 'drei', 'vier', 'fünf', 'sechs'];
const cap = t => t.replace(/^(<b>)?(\S)/, (m, b, ch) => (b || '') + ch.toUpperCase());
// "Zwei goldene Kekse berühren ihn, einer steht in seiner Spalte." – how every gold squish reaches the target
function relSentence(rel, total) {
  const order = ['touch', 'col', 'row', 'reg'], parts = order.filter(k => rel[k]).map(k => [k, rel[k]]);
  const verb = { touch: ['berührt ihn', 'berühren ihn'], col: ['steht in <b>seiner Spalte</b>', 'stehen in <b>seiner Spalte</b>'], row: ['steht in <b>seiner Reihe</b>', 'stehen in <b>seiner Reihe</b>'], reg: ['hat <b>seine Farbe</b>', 'haben <b>seine Farbe</b>'] };
  const vb = (k, n) => (k === 'touch' ? verb[k][n > 1 ? 1 : 0].replace('berühr', '<b>berühr') + '</b>' : verb[k][n > 1 ? 1 : 0]);
  if (parts.length === 1) { const [k, n] = parts[0]; return n === 1 ? `Der goldene Keks ${vb(k, 1)}.` : `${n === 2 ? 'Beide' : 'Alle ' + NUM[n]} goldenen Kekse ${vb(k, n)}.`; }
  const out = parts.map(([k, n], i) => (i === 0 ? (n === 1 ? 'Ein goldener Keks' : `${cap(NUM[n])} goldene Kekse`) : (n === 1 ? 'einer' : NUM[n])) + ' ' + vb(k, n));
  return out.slice(0, -1).join(', ') + ' und ' + out[out.length - 1] + '.';
}
// whatif: how the imagined glow X reaches every squish of the group
function relFrom(rel, total, what) {
  const order = ['touch', 'col', 'row', 'reg'], parts = order.filter(k => rel[k]).map(k => [k, rel[k]]);
  const ph = { touch: n => (n === total ? (total === 1 ? 'er <b>berührt</b> ihn' : `er <b>berührt</b> ${total === 2 ? 'beide' : 'alle ' + NUM[total]}`) : `${NUM[n] === 'ein' ? 'einen' : NUM[n]} davon <b>berührt</b> er`), col: n => `${n === total ? (total === 1 ? 'er steht' : 'alle stehen') : (n === 1 ? 'einer steht' : NUM[n] + ' stehen')} in <b>seiner Spalte</b>`, row: n => `${n === total ? (total === 1 ? 'er steht' : 'alle stehen') : (n === 1 ? 'einer steht' : NUM[n] + ' stehen')} in <b>seiner Reihe</b>`, reg: n => `${n === total ? (total === 1 ? 'er hat' : 'alle haben') : (n === 1 ? 'einer hat' : NUM[n] + ' haben')} <b>seine Farbe</b>` };
  const out = parts.map(([k, n]) => ph[k](n));
  return cap(out.length === 1 ? out[0] : out.slice(0, -1).join(', ') + ' und ' + out[out.length - 1]) + '.';
}
const GROUP = { row: ['dieser Reihe', 'die Reihe'], col: ['dieser Spalte', 'die Spalte'], reg: ['der goldenen Farbe', 'die Farbe'] };
const which = i => (i.many ? 'den Keks mit den Linien' : 'den markierten Keks');
// leading explanation phases shown only the first time a mission explains its trick
const EXPLAIN_ONCE = { shared: 1 };
const BASICS = {
  hold_reg: ['Diese <b>Farbe</b> hat nur noch <b>einen</b> Keks – <b>halte ihn gedrückt!</b>', 'Nur noch <b>ein</b> Keks in dieser Farbe – <b>halten!</b>'],
  pop_touch: ['Rund um den Leuchter darf keiner leuchten – auch <b>schräg</b> nicht. <b>Wisch</b> die Nachbarn weg!', 'Wieder die <b>Nachbarn</b> – weg damit!'],
  pop_known: ['<b>Reihe</b>, <b>Spalte</b> und <b>Farbe</b> des Leuchters sind besetzt – <b>wisch</b> die anderen dort weg!', 'Und wieder: <b>Reihe</b>, <b>Spalte</b>, <b>Farbe</b> weg!'],
  hold_row: ['In dieser <b>Reihe</b> ist nur noch <b>ein</b> Keks übrig – <b>halte ihn!</b>'],
  hold_col: ['In dieser <b>Spalte</b> ist nur noch <b>ein</b> Keks übrig – <b>halte ihn!</b>'],
  pop_claim_row: ['<b>Reihen-Trick:</b> Die goldene Farbe hat nur noch Kekse in <b>dieser Reihe</b> – ihr Leuchter muss hier hin. Dann darf sonst <b>keiner</b> hier leuchten: <b>weg!</b>'],
  pop_claim_col: ['<b>Reihen-Trick:</b> Die goldene Farbe hat nur noch Kekse in <b>dieser Spalte</b> – ihr Leuchter muss hier hin. Dann darf sonst <b>keiner</b> hier leuchten: <b>weg!</b>'],
  pop_shared: [i => `<b>Kreuzfeuer</b> für ${which(i)}: ${relSentence(i.rel, i.total)} Egal welcher goldene leuchtet – er ist blockiert. <b>Weg damit!</b>`],
  pop_pair_row: ['<b>Doppel-Trick:</b> Beide goldenen Farben brauchen ihren Leuchter in <b>diesen zwei Reihen</b> – für andere ist dort kein Platz. <b>Weg!</b>'],
  pop_pair_col: ['<b>Doppel-Trick:</b> Beide goldenen Farben brauchen ihren Leuchter in <b>diesen zwei Spalten</b> – für andere ist dort kein Platz. <b>Weg!</b>'],
};
// Erklär-Schritte (mit „Weiter“) vor dem eigenen Trick einer Mission; danach kommt der kurze Handlungs-Text
const EXPLAIN = {
  shared: [
    () => 'Die goldene Farbe <b>muss</b> genau <b>einen</b> Leuchter bekommen. Nur <b>wo</b>, ist noch offen – aber das reicht!',
    i => `Prüf ${which(i)}: ${relSentence(i.rel, i.total)}`,
    i => `Egal welcher goldene leuchtet – ${i.many ? 'dieser Keks' : 'der markierte'} ist <b>blockiert</b>. ` + (i.no ? 'Der mit <b>rotem Ring</b> nicht: den blockiert <b>nicht jeder</b> goldene.' : 'Er kann also <b>nie</b> leuchten.'),
  ],
  pair: [
    i => `Die zwei goldenen Farben haben <b>nur</b> Kekse in <b>diesen zwei ${i.lineWord}</b>. Jede braucht einen Leuchter – also landen <b>beide</b> Leuchter hier.`,
    i => `Jede ${i.lineOne} hat aber nur <b>einen</b> Leuchter. Damit sind beide ${i.lineWord} <b>vergeben</b> – für andere Farben ist dort kein Platz.`,
  ],
  whatif: [
    i => `Stell dir vor, der markierte Keks <b>leuchtet</b>. Schau auf die goldenen Kekse ${GROUP[i.kind][0]}: ${relFrom(i.rel, i.total)}`,
    i => `Dann wären <b>alle</b> blockiert und ${GROUP[i.kind][1]} hätte <b>keinen</b> Leuchter – das geht nicht! Also darf der markierte <b>nie</b> leuchten.`,
  ],
};
Object.assign(TXT, {
  // Mission 3: der ganze Lösungsweg in vier Schritten (Einzel-Keks → ausräumen → Reihen-Trick → letzter Keks)
  recap: { ...BASICS,
    intro: ['Mission 3: Jetzt zeig ich dir den <b>ganzen Lösungsweg</b>. So gehst du ab jetzt jedes Level an!',
      '<b>1.</b> Einzel-Keks halten. <b>2.</b> Alles wegwischen, was er blockiert. <b>3.</b> Reihen-Trick. <b>4.</b> Letzten Keks halten.'],
    hold_reg: ['<b>Schritt 1:</b> Such den <b>Einzel-Keks</b> – diese Farbe hat nur <b>ein</b> Feld. Der <b>muss</b> leuchten: <b>halte ihn!</b>', '<b>Letzter Keks</b> seiner Farbe – <b>halten!</b>'],
    pop_touch: ['<b>Schritt 2:</b> Ausräumen! Erst die <b>Nachbarn</b> – auch die schrägen. <b>Weg damit!</b>', 'Wieder die <b>Nachbarn</b> – weg damit!'],
    pop_known: ['Dann seine <b>Reihe</b>, <b>Spalte</b> und <b>Farbe</b> – da leuchtet sonst keiner. <b>Wegwischen!</b>', 'Und wieder: <b>Reihe</b>, <b>Spalte</b>, <b>Farbe</b> weg!'],
    pop_claim_row: ['<b>Schritt 3:</b> Die goldene Farbe hat nur noch Kekse in <b>dieser Reihe</b>. Ihr Leuchter muss also hier hin – dann darf sonst <b>keiner</b> in der Reihe leuchten. <b>Weg!</b>'],
    pop_claim_col: ['<b>Schritt 3:</b> Die goldene Farbe hat nur noch Kekse in <b>dieser Spalte</b>. Ihr Leuchter muss also hier hin – dann darf sonst <b>keiner</b> in der Spalte leuchten. <b>Weg!</b>'],
    hold_row: ['<b>Schritt 4:</b> In dieser <b>Reihe</b> ist nur noch <b>ein</b> Keks übrig – <b>halte ihn!</b>'],
    hold_col: ['<b>Schritt 4:</b> In dieser <b>Spalte</b> ist nur noch <b>ein</b> Keks übrig – <b>halte ihn!</b>'],
    done: 'Super! Das ist der Weg: <b>Einzel-Keks → ausräumen → Reihen-Trick → letzter Keks</b>.',
  },
  // Mission 4: Kreuzfeuer – was ALLE Kekse einer Farbe blockieren, kann weg
  shared: { ...BASICS,
    intro: ['Mission 4: das <b>Kreuzfeuer</b>! Oft weißt du nicht, <b>wo</b> eine Farbe leuchtet – nur, dass sie <b>irgendwo</b> leuchten muss. Das reicht schon!'],
    pop_shared: [i => `Er kann also <b>nie</b> leuchten – <b>wisch ihn weg!</b>` + (i.many ? ' Bei den anderen markierten ist es genauso.' : '')],
    hold_reg: ['Siehst du? Jetzt hat diese Farbe nur noch <b>einen</b> Keks – <b>halte ihn!</b>', 'Nur noch <b>ein</b> Keks in dieser Farbe – <b>halten!</b>'],
    done: 'Stark! <b>Kreuzfeuer:</b> Was <b>jeder</b> Keks einer Farbe blockiert, kann immer weg.',
  },
  // Mission 5: Doppel-Trick – zwei Farben in denselben zwei Reihen (Spalten)
  pair: { ...BASICS,
    intro: ['Mission 5: der <b>Doppel-Trick</b> – wie der Reihen-Trick, nur mit <b>zwei</b> Farben und <b>zwei</b> Reihen.'],
    pop_pair_row: ['Also: Die anderen markierten Kekse in den zwei Reihen <b>wegwischen!</b>'],
    pop_pair_col: ['Also: Die anderen markierten Kekse in den zwei Spalten <b>wegwischen!</b>'],
    hold_reg: ['Siehst du? Jetzt hat diese Farbe nur noch <b>einen</b> Keks – <b>halte ihn!</b>', 'Nur noch <b>ein</b> Keks in dieser Farbe – <b>halten!</b>'],
    done: 'Klasse! Zwei Farben in <b>zwei Reihen</b> (oder Spalten)? Dann gehören die nur ihnen.',
  },
  // Mission 6: Was wäre wenn – ein Keks, der eine ganze Farbe/Reihe/Spalte auslöschen würde, kann weg
  whatif: { ...BASICS,
    intro: ['Letzte Mission: <b>Was wäre wenn?</b> Stell dir vor, ein Keks leuchtet – und schau, was dann übrig bliebe.', 'Erst räumen wir mit den bekannten Tricks auf. Folge der Hand!'],
    pop_whatif_row: ['<b>Wisch ihn weg!</b>'], pop_whatif_col: ['<b>Wisch ihn weg!</b>'], pop_whatif_reg: ['<b>Wisch ihn weg!</b>'],
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
  next.addEventListener('click', () => { if (!run) return; if (run.explaining) { run.exIdx++; if (run.exIdx >= run.explaining) { run.exDone.add(run.exId); run.exIdx = 0; } } else run.intro++; update(true); });
  window.addEventListener('resize', () => requestAnimationFrame(() => run && place()));

  function opts() { return { merge: true, solutionFallback: true }; }
  // how a reaches b: same row / same column / touching / same colour
  function relOf(a, b, reg) { return Math.abs(a[0] - b[0]) <= 1 && Math.abs(a[1] - b[1]) <= 1 ? 'touch' : a[0] === b[0] ? 'row' : a[1] === b[1] ? 'col' : reg && reg(a) === reg(b) ? 'reg' : null; }
  // facts for the "why" texts and the connector lines of a trick step
  function explainInfo(st, S) {
    const L = run.L, regOf = ([r, c]) => L.regions[r][c], i = { many: st.cells.length > 1 };
    if (st.rule === 'shared') {
      const T = st.path[0], rel = {}; st.area.forEach(g => { const k = relOf(g, T); rel[k] = (rel[k] || 0) + 1; });
      Object.assign(i, { T, rel, total: st.area.length, links: st.area.map(g => [g, T]) });
      // a counter-example: a squish some (not all) gold squishes block → stays
      let best = null, bs = -1;
      for (let r = 0; r < L.N; r++) for (let c = 0; c < L.N; c++) {
        const x = [r, c]; if (S.state[r][c] !== 'normal' || st.area.some(a => a[0] === r && a[1] === c) || st.cells.some(a => a[0] === r && a[1] === c) || regOf(x) === regOf(st.area[0])) continue;
        const n = st.area.filter(g => relOf(g, x)).length; if (!n || n === st.area.length) continue;
        const score = n * 10 - Math.hypot(r - T[0], c - T[1]); if (score > bs) { bs = score; best = x; }
      }
      i.no = best;
    } else if (st.rule === 'whatif') {
      const X = st.cells[0], rel = {}; st.area.forEach(g => { const k = relOf(X, g, regOf); rel[k] = (rel[k] || 0) + 1; });
      Object.assign(i, { rel, total: st.area.length, kind: st.group.kind, links: st.area.map(g => [X, g]) });
    } else if (st.rule === 'pair') {
      Object.assign(i, st.lines.kind === 'row' ? { lineWord: 'Reihen', lineOne: 'Reihe' } : { lineWord: 'Spalten', lineOne: 'Spalte' });
    }
    return i;
  }
  function say(html) { if (text.innerHTML !== html) { text.innerHTML = html; bubble.classList.remove('is-say'); void bubble.offsetWidth; bubble.classList.add('is-say'); } }
  function pick(key, info) { const list = TXT[run.L.guide][key]; const n = run.count[key] || 0; const t = list ? list[Math.min(n, list.length - 1)] : FALLBACK; return typeof t === 'function' ? t(info || {}) : t; }
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
    const st0 = run.step; if (!st0) return;
    const st = st0.explain ? st0.base : st0;
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
    // connector lines gold squish → target, lit one after another (opacity only: cheap, no stutter)
    const info = run.info || {};
    (info.links || []).forEach(([g, t], k) => {
      const a = at(g), b = at(t), d = Math.hypot(b.x - a.x, b.y - a.y), m = document.createElement('i'); m.className = 'sd-tut-mark is-link';
      Object.assign(m.style, { left: `${(a.x + b.x) / 2}px`, top: `${(a.y + b.y) / 2}px`, width: `${Math.max(0, d - a.s * .5)}px`, transform: `translate(-50%,-50%) rotate(${Math.atan2(b.y - a.y, b.x - a.x)}rad)`, animationDelay: `${k * .55}s`, animationDuration: `${Math.max(1.6, info.links.length * .55 + .6)}s` });
      layer.append(m);
    });
    if (info.no) { const p = at(info.no), m = document.createElement('i'); m.className = 'sd-tut-mark is-no'; Object.assign(m.style, { left: `${p.x}px`, top: `${p.y}px`, width: `${p.s * 1.05}px`, height: `${p.s * 1.05}px` }); layer.append(m); }
    const cells = st.type === 'hold' ? [st.cell] : st.cells;
    for (const cell of cells) { const p = at(cell), m = document.createElement('i'); m.className = 'sd-tut-mark ' + (st.type === 'hold' ? 'is-hold' : 'is-pop'); Object.assign(m.style, { left: `${p.x}px`, top: `${p.y}px`, width: `${p.s * (st.type === 'hold' ? 1.35 : 1.05)}px`, height: `${p.s * (st.type === 'hold' ? 1.35 : 1.05)}px` }); layer.append(m); }
    if (st0.explain) return; // explanation: marks only, the hand comes with the action
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
    // the mission's own trick: explain it first (Weiter), once per colour/area, then the action text
    run.info = st.type === 'pop' && ['shared', 'pair', 'whatif'].includes(st.rule) ? explainInfo(st, S) : null;
    run.explaining = 0;
    if (st.type === 'pop' && st.rule === L.guide && EXPLAIN[st.rule]) {
      const exId = st.rule + JSON.stringify(st.area);
      if (!run.exDone.has(exId)) {
        if (run.exId !== exId) { run.exId = exId; run.exIdx = run.exDone.size ? EXPLAIN_ONCE[st.rule] || 0 : 0; }
        run.explaining = EXPLAIN[st.rule].length;
        st = { type: 'intro', explain: true, rule: st.rule, base: st, text: EXPLAIN[st.rule][run.exIdx](run.info) }; key = 'explain';
      }
    }
    const sig = JSON.stringify(st) + run.intro;
    if (sig === run.sig && !force) return;
    // a finished step counts once, so the next one of the same kind gets the shorter text
    const cont = run.key === key && st.cells && run.step?.cells && st.cells.every(([r, c]) => run.step.cells.some(([rr, cc]) => rr === r && cc === c)); // same wipe, next stroke
    if (run.key && run.key !== 'intro' && run.key !== 'explain' && run.sig && run.sig !== sig && !cont) run.count[run.key] = (run.count[run.key] || 0) + 1;
    run.sig = sig; run.step = st; run.key = key;
    run.blocking = st.type === 'intro';
    next.hidden = st.type !== 'intro';
    bubble.classList.toggle('is-intro', st.type === 'intro');
    if (st.explain) say(st.text);
    else if (st.type === 'intro') say(intros[run.intro]);
    else if (st.type === 'done') { say(TXT[L.guide].done); clearMarks(); return; }
    else say(pick(key, run.info));
    place();
  }
  return {
    get active() { return !!run; },
    get blocking() { return !!run?.blocking; },
    get step() { return run?.step || null; },
    start(S) {
      run = { S, L: S.L, intro: 0, count: {}, sig: '', key: '', exDone: new Set(), exId: '', exIdx: 0, explaining: 0, info: null };
      kicker.textContent = `Mission ${S.L.id} · ${KICK[S.L.guide] || 'Anleitung'}`;
      stage.classList.add('is-tut'); bubble.hidden = false; layer.hidden = false; update(true);
    },
    stop() { run = null; clearMarks(); stage.classList.remove('is-tut'); bubble.hidden = true; layer.hidden = true; },
    // after every move (debounced so a swipe finishes before the next hint appears)
    changed() { clearTimeout(timer); timer = setTimeout(() => update(false), 160); },
    ouch() { if (!run) return; ouchUntil = performance.now() + 2200; say(OUCH); bubble.classList.add('is-ouch'); clearTimeout(timer); timer = setTimeout(() => { bubble.classList.remove('is-ouch'); run && (run.sig = '', update(true)); }, 2250); },
  };
}
