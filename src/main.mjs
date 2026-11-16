// SquishDoku – App: Menüs (Squish-Attack-Design), Levelauswahl, Spiel, Sieg.
import {createBoard3D} from './board3d.mjs';
import {createGameSound} from '../vendor/squish-attack/game/sound.mjs?v=launch-26';
import {createHaptics} from '../vendor/squish-attack/game/haptics.mjs?v=launch-26';
import {createConfetti} from '../vendor/squish-attack/game/confetti.mjs?v=launch-26';
import {installBackdrop} from '../vendor/squish-attack/game/home-menu.mjs?v=launch-26';
import {ICONS,TILE_ICONS} from '../vendor/squish-attack/game/aw-icons.mjs?v=launch-26';
import {createAdPacing} from '../vendor/squish-attack/game/ad-pacing.mjs';
import {createAdUI,AD_ICON_SVG} from './ad-ui.mjs';

const $=id=>document.getElementById(id);
let HOLD_MS=400; const TAP_MS=200, HEARTS=3;
const STORE='squishdoku-v1';
const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)');
const wait=ms=>new Promise(r=>setTimeout(r,ms));

// ---------- Speicher ----------
function load(){try{return {unlocked:1,stars:{},seenRules:false,revealed:{},...JSON.parse(localStorage.getItem(STORE)||'{}')};}catch{return {unlocked:1,stars:{},seenRules:false,revealed:{}};}}
let store=load();
function save(){try{localStorage.setItem(STORE,JSON.stringify(store));}catch{}}
const totalStars=()=>Object.values(store.stars).reduce((a,b)=>a+b,0);

// ---------- Ton & Vibration (Squish Attack) ----------
// sound.mjs toggles through its own button; a hidden proxy keeps our speaker icon
const soundProxy=document.createElement('button');soundProxy.hidden=true;document.body.append(soundProxy);
const sound=createGameSound(soundProxy);
const haptics=createHaptics();
const confetti=createConfetti();
installBackdrop();
const POP_DETUNE=[1,1.1,.95,1.15,.9,1.05,.85]; // each pop of a swipe sounds a little different
const sfx=(kind,...a)=>{try{sound.play(kind,...a);}catch{}};
const buzz=k=>{try{haptics.pulse(k);}catch{}};

// ---------- Icons ----------
const SPEAKER='<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3.5 9h3.8L12.4 4.6c.7-.6 1.6-.1 1.6.8v13.2c0 .9-.9 1.4-1.6.8L7.3 15H3.5c-.6 0-1-.4-1-1v-4c0-.6.4-1 1-1z"/><path d="M17 8.5c1 1 1.6 2.2 1.6 3.5s-.6 2.5-1.6 3.5M19.4 6c1.6 1.6 2.6 3.7 2.6 6s-1 4.4-2.6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
const HEART=`<svg viewBox="0 0 32 30"><path class="h-ink" d="M16 28.5C6.5 22 1.5 16.5 1.5 10.2 1.5 5.4 5.1 1.8 9.6 1.8c2.8 0 5 1.4 6.4 3.6 1.4-2.2 3.6-3.6 6.4-3.6 4.5 0 8.1 3.6 8.1 8.4 0 6.3-5 11.8-14.5 18.3z" fill="#140a10"/><path class="h-fill" d="M16 25.6C8.2 20 4.3 15.4 4.3 10.4c0-3.2 2.4-5.8 5.4-5.8 2.6 0 4.4 1.7 6.3 4.6 1.9-2.9 3.7-4.6 6.3-4.6 3 0 5.4 2.6 5.4 5.8 0 5-3.9 9.6-11.7 15.2z" fill="#ff3b4e"/><ellipse class="h-shine" cx="9.6" cy="9.4" rx="2.6" ry="1.7" fill="#fff" transform="rotate(-25 9.6 9.4)"/></svg>`;
let starN=0;const STAR_SVG=TILE_ICONS.star;
// every copy needs its own gradient id: Chrome drops url(#id) fills when the first element with that id sits in a hidden screen
const starIcon=()=>{const id='sd-star-'+(++starN);return STAR_SVG.replace(/ti-star/g,id);};

// ---------- Level ----------
const levels=await (await fetch('src/levels.json')).json();
const HINTS=[
  'Halte einen Squish kurz <b>gedrückt</b> – richtig gewählt, <b>leuchtet</b> er!',
  '<b>Wische</b> über Squishs, die nicht leuchten können – sie <b>ploppen</b>.',
  'Pro <b>Reihe</b>, <b>Spalte</b> und <b>Farbe</b> leuchtet genau ein Squish.',
  'Leuchtende Squishs berühren sich nie – auch nicht <b>schräg</b>.',
  'Kein Raten nötig: Alles lässt sich <b>logisch</b> lösen.',
];
// Meilenstein-Tipps für die 50er-Rampe; dazwischen wechseln die Grundregeln
const MILESTONES={
  6:'Jedes Level hat einen <b>Einzel-Squish</b> – eine Farbe aus nur einem Feld. Fang dort an!',
  11:'Ab jetzt gibt es <b>kein Einzelfeld</b> mehr: Such eine kleine Farbe, die nur in <b>einer Reihe</b> liegt.',
  15:'Neu: <b>6×6</b>! Liegt eine Farbe nur in einer Spalte, gehört diese Spalte ihr.',
  21:'Prüf auch: Würde ein Squish hier eine Farbe <b>komplett blockieren</b>? Dann kann er nicht leuchten.',
  28:'Neu: <b>7×7</b> – und der <b>weiße</b> Squish ist eine eigene Farbe.',
  35:'Knifflig: Teilen sich <b>zwei Farben zwei Reihen</b>, gehören die Reihen nur ihnen.',
  41:'Neu: <b>8×8</b> mit acht Farben. Du schaffst das – Schritt für Schritt!',
  50:'Das letzte Level – zeig, was du gelernt hast!',
};
const hintFor=id=>MILESTONES[id]||HINTS[id-1]||HINTS[2+(id%3)];

// ---------- Menüs ----------
const home=$('home'),screenEl=$('home-screen');
function button({label,icon,color='aw-green',size='',id,action}){
  const b=document.createElement('button');b.type='button';b.className=`aw-btn ${color} ${size}`.trim();if(id)b.id=id;
  b.innerHTML=`<span class="aw-ico">${ICONS[icon]||''}</span><span class="aw-label"><span></span></span>`;
  b.querySelector('.aw-label>span').textContent=label;
  b.addEventListener('click',()=>{tap();action?.(b);});return b;
}
function ribbon(text,tone){const r=document.createElement('div');r.className=`aw-ribbon ${tone}`;r.textContent=text;r.setAttribute('role','heading');r.setAttribute('aria-level','2');return r;}
function tap(){try{sound.unlock?.();}catch{}buzz('tap');sfx('land',2);}
function setItems(items){screenEl.replaceChildren(...items);items.forEach((el,i)=>el.style.setProperty('--i',i));}
function renderStars(){$('home-stars').querySelector('b').textContent=`${totalStars()}/${levels.length*3}`;}
const nextLevel=()=>Math.min(levels.length,Math.max(1,...levels.filter(l=>store.stars[l.id]).map(l=>l.id+1),1));
function showHome(screen='home'){
  closeDialog();
  $('game').hidden=true;home.hidden=false;document.documentElement.classList.add('home-open');
  home.dataset.screen=screen;renderStars();
  if(screen==='home'){
    const n=nextLevel(),played=Object.keys(store.stars).length>0;
    setItems([
      button({label:played?`Level ${n} spielen`:'Spielen',icon:'play',color:'aw-green',size:'aw-big',id:'btn-play',action:()=>startLevel(n)}),
      button({label:'Levels',icon:'grid',color:'aw-blue',id:'btn-levels',action:()=>showHome('levels')}),
      button({label:'Regeln',icon:'cap',color:'aw-purple',id:'btn-rules',action:()=>showHome('rules')}),
    ]);
  }else if(screen==='levels'){
    const grid=document.createElement('div');grid.className='sd-levels';
    let band=null;
    for(const l of levels){
      if(l.label!==band){band=l.label;const h=document.createElement('div');h.className='sd-lv-band';h.textContent=band;grid.append(h);}
      const locked=l.id>store.unlocked,stars=store.stars[l.id]||0;
      const t=document.createElement('button');t.type='button';t.className='aw-tile'+(locked?' is-locked':'')+(l.id===nextLevel()&&!stars?' is-current':'');t.dataset.level=l.id;
      t.innerHTML=`<span class="sd-lv-num">${l.id}</span><span class="sd-lv-size">${l.N}×${l.N}</span><span class="sd-lv-stars">${[1,2,3].map(i=>`<span class="${i<=stars?'':'off'}">${starIcon()}</span>`).join('')}</span>${locked?`<span class="sd-lock">${ICONS.lock}</span>`:''}`;
      t.setAttribute('aria-label',`Level ${l.id}, ${l.N} mal ${l.N}${locked?', gesperrt':`, ${stars} Sterne`}`);
      t.addEventListener('click',()=>{tap();if(locked){t.animate([{transform:'translateX(0)'},{transform:'translateX(-6px)'},{transform:'translateX(5px)'},{transform:'translateX(0)'}],{duration:260});return;}startLevel(l.id);});
      grid.append(t);
    }
    const solved=levels.filter(l=>store.stars[l.id]).length;
    const prog=document.createElement('div');prog.className='sd-lv-progress';prog.textContent=`${solved} / ${levels.length} gelöst`;
    const scroller=document.createElement('div');scroller.className='sd-levels-scroll';scroller.append(grid);
    const card=document.createElement('div');card.className='aw-card sd-levels-card';card.append(prog,scroller);
    // jump to the level you are on (the list is long now)
    requestAnimationFrame(()=>{const cur=grid.querySelector(`[data-level="${nextLevel()}"]`);if(cur)scroller.scrollTop=Math.max(0,cur.offsetTop-scroller.clientHeight/2+cur.offsetHeight/2);});
    setItems([ribbon('Levels','aw-r-blue'),card,button({label:'Zurück',icon:'back',color:'aw-slate',size:'aw-small',id:'btn-home',action:()=>showHome('home')})]);
  }else if(screen==='rules'){
    setItems([ribbon('So geht’s','aw-r-purple'),rulesCard(),button({label:'Zurück',icon:'back',color:'aw-slate',size:'aw-small',action:()=>showHome('home')})]);
  }
}
function rulesCard(){
  const c=document.createElement('div');c.className='aw-card sd-rules';
  const rows=[['✦','In jeder <b>Reihe</b>, jeder <b>Spalte</b> und jeder <b>Farbe</b> leuchtet genau <b>ein</b> Squish.'],
    ['✦','Leuchtende Squishs berühren sich <b>nie</b> – auch nicht schräg.'],
    ['●','Kurz <b>gedrückt halten</b>: Der Squish leuchtet.'],
    ['≋','<b>Wischen</b> (oder kurz antippen) lässt Squishs <b>ploppen</b>, die nicht leuchten können. Antippen holt sie zurück.'],
    ['♥','Falsch gehalten oder falsch geploppt kostet ein <b>Herz</b>. Ohne Herzen: nochmal!']];
  c.innerHTML=rows.map(([i,t])=>`<p><span class="sd-rule-ico">${i}</span><span>${t}</span></p>`).join('');
  return c;
}
const soundBtn=$('sound-toggle');soundBtn.innerHTML=SPEAKER;
const syncSound=()=>soundBtn.setAttribute('aria-pressed',String(sound.enabled));
soundBtn.addEventListener('click',()=>{soundProxy.click();syncSound();if(sound.enabled)tap();});
syncSound();
$('home-stars').querySelector('i').innerHTML=starIcon();

// ---------- Spiel ----------
const game=$('game'),stage=$('stage'),fx=$('fx');
$('btn-back').innerHTML=ICONS.back;$('btn-reset').innerHTML=ICONS.retry;
let board=null,S=null;
function ensureBoard(){if(!board){board=createBoard3D($('host'));bindInput();window.addEventListener('resize',()=>requestAnimationFrame(placePlate));}return board;}
function placePlate(){if(!board||game.hidden||!$('plate'))return;const r=board.frameRect(),p=$('plate'),pad=r.width*.012;Object.assign(p.style,{left:`${r.left-pad}px`,top:`${r.top-pad}px`,width:`${r.width+2*pad}px`,height:`${r.height+2*pad}px`});}

// ---------- Werbung (wie Squish Attack: ad-pacing + native-ads; im Browser Dummy) ----------
const adPacing=createAdPacing();
const adUI=createAdUI({sound,haptics,onAdStart:()=>{try{sound.pause();}catch{}},onAdEnd:()=>{try{sound.resume();}catch{}}});
let starting=false;
// Zwischenwerbung nur zwischen zwei Leveln: fällig nach jedem 5. Sieg, gezeigt beim Start des nächsten Levels.
async function startLevel(id){
  if(starting)return;
  if(adPacing.takeInterstitial()){starting=true;closeDialog();try{await adUI.interstitial();}catch{}finally{starting=false;}}
  beginLevel(id);
}
function beginLevel(id){
  const L=levels[id-1];
  home.hidden=true;document.documentElement.classList.remove('home-open');game.hidden=false;closeDialog();
  ensureBoard();
  S={L,id,N:L.N,state:Array.from({length:L.N},()=>Array(L.N).fill('normal')),hearts:HEARTS,glow:0,done:false,locked:false};
  board.build(L,g=>L.colors[g]);
  $('lvl-num').textContent=id;$('lvl-name').textContent=L.label;
  $('glow-total').textContent=L.N;
  $('hint').innerHTML=hintFor(id);
  renderHearts();renderProgress();renderAdTip();
  requestAnimationFrame(()=>requestAnimationFrame(placePlate));setTimeout(placePlate,120);
  if(id===1&&!store.seenRules){store.seenRules=true;save();showRulesDialog();}
}
function renderHearts(){
  const h=$('hearts');h.replaceChildren();for(let i=0;i<HEARTS;i++){const d=document.createElement('span');d.className='sd-heart'+(i>=S.hearts?' is-lost':'');d.innerHTML=HEART;h.append(d);}
  h.setAttribute('aria-label',`${S.hearts} Herzen`);
}
function renderProgress(){$('glow-count').textContent=S.glow;renderAdTip();}
// Tipp per Werbung: beliebig oft je Level, jeder Clip enthüllt einen weiteren richtigen Squish,
// bis alle leuchten. Gemerkt wird je Level, wie viele Tipps genutzt wurden.
const adTip=$('btn-adtip');adTip.innerHTML=`<i>${AD_ICON_SVG}</i><span>Tipp per Werbung</span>`;
function renderAdTip(){if(!S)return;const off=S.locked||S.glow>=S.N;adTip.disabled=off;adTip.setAttribute('aria-disabled',String(off));}
async function useAdTip(){
  if(!S||S.locked||S.glow>=S.N||adUI.isOpen)return;
  tap();const s0=S,left=S.N-S.glow;
  const ok=await adUI.offerReveal({left});
  if(!ok||S!==s0||S.locked||S.glow>=S.N)return;
  const rows=[];for(let r=0;r<S.N;r++)if(S.state[r][S.L.solution[r]]!=='glow')rows.push(r);
  const r=rows[Math.floor(Math.random()*rows.length)],c=S.L.solution[r];
  store.revealed[S.id]=(store.revealed[S.id]||0)+1;save();
  revealAt(r,c);
}
adTip.addEventListener('click',()=>void useAdTip());
function revealAt(r,c){
  if(S.state[r][c]==='popped')S.state[r][c]='normal',board.restore(r,c);
  const p=board.screenOf(r,c),f=document.createElement('div');f.className='sd-reveal';
  f.style.cssText=`left:${p.x}px;top:${p.y}px;--s:${p.size*2.6}px`;f.innerHTML='<i></i><i></i><b></b>';fx.append(f);setTimeout(()=>f.remove(),1300);
  board.wobble(r,c,1);sfx('star',3);
  setTimeout(()=>{if(S&&S.state[r][c]!=='glow')glowAt(r,c);},260);
}
const isSol=(r,c)=>S.L.solution[r]===c;
const regionOf=(r,c)=>S.L.regions[r].charCodeAt(c)-97;

function loseHeart(r,c){
  S.hearts=Math.max(0,S.hearts-1);
  const hearts=[...$('hearts').children];const h=hearts[S.hearts];if(h){h.classList.add('is-lost');}
  $('hearts').setAttribute('aria-label',`${S.hearts} Herzen`);
  const p=board.screenOf(r,c),f=document.createElement('div');f.className='sd-float';f.innerHTML=HEART.replace('#ff3b4e','#ff3b4e');f.style.left=p.x+'px';f.style.top=p.y+'px';fx.append(f);setTimeout(()=>f.remove(),1000);
  if(!reduceMotion.matches){stage.classList.remove('is-shake');void stage.offsetWidth;stage.classList.add('is-shake');}
  buzz('big');
  if(S.hearts===0){S.locked=true;setTimeout(showLose,900);}
}
function wrongAt(r,c){board.wrong(r,c);sfx('land',2);sfx('squish');loseHeart(r,c);}
function popAt(r,c,opts){if(S.state[r][c]!=='normal')return false;S.state[r][c]='popped';board.pop(r,c,opts);return true;}
function glowAt(r,c){
  S.state[r][c]='glow';S.glow++;board.glow(r,c,true);renderProgress();sfx('magic');buzz('merge');
  // Nichts ploppt automatisch: nur der Spieler wischt Squishs weg.
  if(S.glow===S.N){S.done=true;S.locked=true;setTimeout(win,700);}
}
function unglowAt(r,c){S.state[r][c]='normal';S.glow--;board.glow(r,c,false);renderProgress();sfx('tap');buzz('tap');}
function restoreAt(r,c){S.state[r][c]='normal';board.restore(r,c);sfx('tap');buzz('tap');}

// Wischen über einen Squish
function swipeCell(r,c,stroke){
  const st=S.state[r][c];
  if(st!=='normal')return;
  if(isSol(r,c)){if(!stroke.wrong.has(r*S.N+c)){stroke.wrong.add(r*S.N+c);wrongAt(r,c);}return;}
  // wobble -> swell -> pop (the pop sound and buzz land on the actual burst)
  if(S.state[r][c]!=='normal')return;S.state[r][c]='popped';
  sfx('squish');buzz('tap');
  board.popSequence(r,c,{onPop:i=>{sfx('pop',1,{detune:POP_DETUNE[i%POP_DETUNE.length]});buzz('move');}});
}
function holdFire(r,c){
  const st=S.state[r][c];
  if(st==='glow'){unglowAt(r,c);return;}
  if(st==='popped')return;
  if(isSol(r,c))glowAt(r,c);else wrongAt(r,c);
}

// ---------- Eingabe: Halten = Leuchten, Wischen = Ploppen ----------
// Kein Ladering: Rückmeldung beim Halten gibt nur der Squish selbst (er wird eingedrückt).
const showRing=()=>{},hideRing=()=>{};
function bindInput(){
  const host=$('host');let g=null;
  host.addEventListener('pointerdown',e=>{
    if(!S||S.locked||g)return;
    const hit=board.pick(e.clientX,e.clientY);if(!hit)return;
    e.preventDefault();host.setPointerCapture?.(e.pointerId);
    try{sound.unlock?.();}catch{}
    const {r,c}=hit;
    g={id:e.pointerId,r,c,x:e.clientX,y:e.clientY,t:e.timeStamp,mode:'pending',last:{r,c},lx:e.clientX,ly:e.clientY,stroke:{wrong:new Set(),seen:new Set([r*S.N+c])}};
    if(S.state[r][c]!=='popped'){board.press(r,c);showRing(r,c);sfx('squish');}
    g.timer=setTimeout(()=>{
      if(!g||g.mode!=='pending')return;
      g.mode='held';hideRing(true);board.release(r,c);holdFire(r,c);
    },HOLD_MS);
  });
  host.addEventListener('pointermove',e=>{
    if(!g||e.pointerId!==g.id||!S)return;
    const moved=Math.hypot(e.clientX-g.x,e.clientY-g.y);
    if(g.mode==='pending'){
      const hit=board.pick(e.clientX,e.clientY);
      const left=hit&&(hit.r!==g.r||hit.c!==g.c);
      if(moved>14||left){
        clearTimeout(g.timer);hideRing(false);board.release(g.r,g.c);
        g.mode='swipe';if(!S.locked)swipeCell(g.r,g.c,g.stroke);
      }else{const w=board.worldOf(e.clientX,e.clientY),w0=board.worldOf(g.x,g.y);if(w&&w0)board.drag(g.r,g.c,w.x-w0.x,w.z-w0.z);}
    }
    if(g.mode==='swipe'&&!S.locked){
      // Strecke abtasten, damit schnelle Wischer keine Squishs überspringen
      const steps=Math.max(1,Math.ceil(Math.hypot(e.clientX-g.lx,e.clientY-g.ly)/8));
      for(let i=1;i<=steps&&!S.locked;i++){
        const x=g.lx+(e.clientX-g.lx)*i/steps,y=g.ly+(e.clientY-g.ly)*i/steps,hit=board.pick(x,y);
        if(!hit)continue;const key=hit.r*S.N+hit.c;
        if(!g.stroke.seen.has(key)){
          g.stroke.seen.add(key);
          const w=board.worldOf(x,y),w0=board.worldOf(g.lx,g.ly);
          if(w&&w0)board.brush(hit.r,hit.c,(w.x-w0.x)*.6,(w.z-w0.z)*.6);
          swipeCell(hit.r,hit.c,g.stroke);
        }
      }
    }
    g.lx=e.clientX;g.ly=e.clientY;
  });
  const end=e=>{
    if(!g||e.pointerId!==g.id)return;
    clearTimeout(g.timer);
    if(g.mode==='pending'&&S&&!S.locked){
      hideRing(false);board.release(g.r,g.c);
      const dt=e.timeStamp-g.t,st=S.state[g.r][g.c];
      if(e.type==='pointerup'&&dt<TAP_MS){if(st==='popped')restoreAt(g.r,g.c);else if(st==='normal')swipeCell(g.r,g.c,g.stroke);}
    }else if(g.mode==='pending'){hideRing(false);board.release(g.r,g.c);}
    g=null;
  };
  host.addEventListener('pointerup',end);host.addEventListener('pointercancel',end);
  host.addEventListener('contextmenu',e=>e.preventDefault());
}

// ---------- Sieg / Niederlage ----------
async function win(){
  const id=S.id,stars=S.hearts;
  adPacing.levelWon(); // Werbe-Takt wie Squish Attack: jede 5. gewonnene Runde
  store.stars[id]=Math.max(store.stars[id]||0,stars);store.unlocked=Math.max(store.unlocked,Math.min(levels.length,id+1));save();
  sfx('record');buzz('big');
  // Jubel-Welle über die leuchtenden Squishs
  for(let r=0;r<S.N;r++){const c=S.L.solution[r];setTimeout(()=>board.wobble(r,c,.8),r*70);}
  const rect=board.boardRect();confetti.burst(rect,{reduced:reduceMotion.matches});
  await wait(1100);
  const last=id===levels.length;
  const items=[ribbon(last?'Alles geschafft!':'Geschafft!','aw-r-green')];
  const st=document.createElement('div');st.className='sd-stars';st.innerHTML=[0,1,2].map(()=>`<i>${starIcon()}</i>`).join('');items.push(st);
  const p=document.createElement('p');p.textContent=last?`Alle ${levels.length} Level gelöst – du bist ein Squish-Profi!`:`Level ${id} gelöst${stars===3?' – ohne Fehler!':'.'}`;items.push(p);
  if(!last)items.push(button({label:'Weiter',icon:'play',color:'aw-green',size:'aw-big',id:'btn-next',action:()=>startLevel(id+1)}));
  items.push(button({label:'Nochmal',icon:'retry',color:'aw-orange',id:'btn-again',action:()=>startLevel(id)}));
  items.push(button({label:'Levels',icon:'grid',color:'aw-slate',size:'aw-small',id:'btn-to-levels',action:()=>showHome('levels')}));
  openDialog(items,'win');
  [...st.children].forEach((s,i)=>{if(i<stars)setTimeout(()=>{s.classList.add('on');sfx('star',i+1);buzz(i===2?'big':'merge');},380+i*280);});
}
function showLose(){
  openDialog([ribbon('Oh nein!',''),Object.assign(document.createElement('p'),{textContent:'Keine Herzen mehr. Versuch’s gleich nochmal!'}),
    button({label:'Nochmal',icon:'retry',color:'aw-orange',size:'aw-big',id:'btn-retry',action:()=>startLevel(S.id)}),
    button({label:'Levels',icon:'grid',color:'aw-slate',size:'aw-small',action:()=>showHome('levels')})],'lose');
}
function showRulesDialog(){
  openDialog([ribbon('So geht’s','aw-r-purple'),rulesCard(),button({label:'Los geht’s',icon:'play',color:'aw-green',size:'aw-big',id:'btn-rules-ok',action:closeDialog})],'rules');
}
function openDialog(items,kind){const v=$('veil'),d=$('dialog');d.replaceChildren(...items);d.dataset.kind=kind;v.hidden=false;}
function closeDialog(){$('veil').hidden=true;$('dialog').replaceChildren();}

$('btn-back').addEventListener('click',()=>{tap();showHome('levels');});
$('btn-reset').addEventListener('click',()=>{tap();if(S)startLevel(S.id);});

// ---------- Test-/Debug-Zugriff ----------
window.SquishDoku={adUI,adPacing,get state(){return S;},get board(){return board;},levels,startLevel,showHome,get store(){return store;},get holdMs(){return HOLD_MS;},set holdMs(v){HOLD_MS=v;},TAP_MS,
  reset(){localStorage.removeItem(STORE);store=load();}};
showHome('home');
document.documentElement.dataset.ready='1';
