// SquishDoku – App: Menüs (Squish-Attack-Design), Levelauswahl, Spiel, Sieg.
import {createBoard3D as createSquishBoard} from './board3d.mjs';
// Prototype look (tube.html sets window.SD_LOOK='tube'): neon silicone tubes instead of squishes.
const LOOK=window.SD_LOOK||'squish',TUBE=LOOK==='tube';
const createBoard3D=TUBE?(await import('./tube3d.mjs')).createTubeBoard:createSquishBoard;
import {createGameSound} from '../vendor/squish-attack/game/sound.mjs?v=launch-26';
import {createSdHaptics} from './haptics.mjs';
import {createConfetti} from '../vendor/squish-attack/game/confetti.mjs?v=launch-26';
import {installBackdrop} from '../vendor/squish-attack/game/home-menu.mjs?v=launch-26';
import {ICONS,TILE_ICONS} from '../vendor/squish-attack/game/aw-icons.mjs?v=launch-26';
import {createAdPacing} from '../vendor/squish-attack/game/ad-pacing.mjs';
import {createAdUI,AD_ICON_SVG} from './ad-ui.mjs';
import {createRulesBar,createTutorial} from './tutorial-ui.mjs';

const $=id=>document.getElementById(id);
let HOLD_MS=400; const TAP_MS=200, HEARTS=3;
const STORE=TUBE?'squishdoku-tube-v1':'squishdoku-v1';
const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)');
const wait=ms=>new Promise(r=>setTimeout(r,ms));

// ---------- Speicher ----------
// v2 (missions): the separate tutorial is gone. Old saves: old L1–2 dropped, old L3 → L1, old L4–10 → L3–9,
// L11+ unchanged (tools/missions.js). New L2 and L10 just appear unlocked if you were past them.
const mapOldId=id=>id<=2?0:id===3?1:id<=10?id-1:id;
// v3 (daily / stars+time / settings): adds times:{id:ms}, daily:{done,streak,best,last}, settings:{vibration}.
// Stars from v2 (= hearts left) stay as the best stars of each level; best times start empty.
function migrate(d){
  if(!(d.v>=2)){
    const remap=o=>{const n={};for(const [k,v] of Object.entries(o||{})){const id=mapOldId(+k);if(id)n[id]=Math.max(n[id]||0,v);}return n;};
    const u=+d.unlocked||1;
    d={...d,v:2,stars:remap(d.stars),revealed:remap(d.revealed),unlocked:u<=3?1:u<=10?u-1:u};
  }
  if(d.v<3)d={...d,v:3,times:d.times||{}};
  return d;
}
const baseStore=()=>({v:3,unlocked:1,stars:{},times:{},seenRules:false,revealed:{},rulesCollapsed:false,daily:{done:{},streak:0,best:0,last:null},settings:{vibration:true}});
function load(){
  const base=baseStore();
  try{const raw=localStorage.getItem(STORE);if(!raw)return base;const o=JSON.parse(raw),d=migrate(o);
    const m={...base,...d,times:{...d.times},daily:{...base.daily,...d.daily,done:{...d.daily?.done}},settings:{...base.settings,...d.settings}};
    if(d!==o)try{localStorage.setItem(STORE,JSON.stringify(m));}catch{}return m;}catch{return base;}
}
let store=load();
function save(){try{localStorage.setItem(STORE,JSON.stringify(store));}catch{}}
const totalStars=()=>Object.values(store.stars).reduce((a,b)=>a+b,0);

// ---------- Ton & Vibration (Squish Attack) ----------
// sound.mjs toggles through its own button; a hidden proxy keeps our speaker icon
const soundProxy=document.createElement('button');soundProxy.hidden=true;document.body.append(soundProxy);
const sound=createGameSound(soundProxy);
const haptics=createSdHaptics({isEnabled:()=>store.settings?.vibration!==false});
const confetti=createConfetti();
installBackdrop();
const POP_DETUNE=[1,1.1,.95,1.15,.9,1.05,.85]; // each pop of a swipe sounds a little different
const sfx=(kind,...a)=>{try{sound.play(kind,...a);}catch{}};
const buzz=k=>{try{haptics.pulse(k);}catch{}};

// ---------- Icons ----------
const SPEAKER='<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3.5 9h3.8L12.4 4.6c.7-.6 1.6-.1 1.6.8v13.2c0 .9-.9 1.4-1.6.8L7.3 15H3.5c-.6 0-1-.4-1-1v-4c0-.6.4-1 1-1z"/><path d="M17 8.5c1 1 1.6 2.2 1.6 3.5s-.6 2.5-1.6 3.5M19.4 6c1.6 1.6 2.6 3.7 2.6 6s-1 4.4-2.6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
const VIBE='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7.2" y="3" width="9.6" height="18" rx="2.4" fill="currentColor"/><rect x="9.4" y="5.6" width="5.2" height="10.4" rx="1" fill="#3d47b4"/><path d="M4.4 8.2c-1.2 1.2-1.2 6.4 0 7.6M19.6 8.2c1.2 1.2 1.2 6.4 0 7.6M2 6.2c-2 2.4-2 9.2 0 11.6M22 6.2c2 2.4 2 9.2 0 11.6" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>';
const UNDO='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.2 4.2 3.6 9.4l5.6 5.2" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M4.6 9.4h8.6a6.4 6.4 0 0 1 0 12.8H9.6" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/></svg>';
const CLOCK='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="8.2" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M12 8.6V13l3 2" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M9.4 2.6h5.2" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';
let flameN=0;
const flameIcon=(on=true)=>{const id='sd-flame-'+(++flameN);return `<svg viewBox="0 0 32 40" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${on?'#ffe36b':'#aab0d8'}"/><stop offset=".55" stop-color="${on?'#ff9a24':'#7d84b8'}"/><stop offset="1" stop-color="${on?'#f0461a':'#555c94'}"/></linearGradient></defs><path d="M16 1.5c1.6 6.2 9.8 10.4 12 18.6 2.4 9.2-4 18.4-12 18.4S1.6 31.8 4 22.6c1.2-4.6 4.4-6.8 5.4-11 2.2 2.4 2.8 4.4 2.8 6.6C14.6 13.6 17.4 8.8 16 1.5z" fill="url(#${id})" stroke="#140a10" stroke-width="2.6" stroke-linejoin="round"/><path d="M16 23.4c2.2 3 5.4 4.6 5 8.6-.3 3.2-2.4 4.8-5 4.8s-4.8-1.8-5-4.6c-.2-3.4 3.4-4.8 5-8.8z" fill="${on?'#fff6b8':'#d6d9f0'}" opacity=".9"/></svg>`;};
const HEART=`<svg viewBox="0 0 32 30"><path class="h-ink" d="M16 28.5C6.5 22 1.5 16.5 1.5 10.2 1.5 5.4 5.1 1.8 9.6 1.8c2.8 0 5 1.4 6.4 3.6 1.4-2.2 3.6-3.6 6.4-3.6 4.5 0 8.1 3.6 8.1 8.4 0 6.3-5 11.8-14.5 18.3z" fill="#140a10"/><path class="h-fill" d="M16 25.6C8.2 20 4.3 15.4 4.3 10.4c0-3.2 2.4-5.8 5.4-5.8 2.6 0 4.4 1.7 6.3 4.6 1.9-2.9 3.7-4.6 6.3-4.6 3 0 5.4 2.6 5.4 5.8 0 5-3.9 9.6-11.7 15.2z" fill="#ff3b4e"/><ellipse class="h-shine" cx="9.6" cy="9.4" rx="2.6" ry="1.7" fill="#fff" transform="rotate(-25 9.6 9.4)"/></svg>`;
let starN=0;const STAR_SVG=TILE_ICONS.star;
// every copy needs its own gradient id: Chrome drops url(#id) fills when the first element with that id sits in a hidden screen
const starIcon=()=>{const id='sd-star-'+(++starN);return STAR_SVG.replace(/ti-star/g,id);};

// ---------- Tippen: sofortige Rückmeldung, kein Verrutschen der Seite ----------
// iOS Safari applies :active only when a touchstart listener exists (and then late), so buttons looked
// dead on the first tap. The pressed look now comes from the pointerdown itself and stays at least
// ~90 ms, so even a quick tap is visible; the action still runs on the click.
document.addEventListener('touchstart',()=>{},{passive:true});
let pressedBtn=null,pressedAt=0;
function unpress(){if(!pressedBtn)return;const b=pressedBtn,left=90-(performance.now()-pressedAt);pressedBtn=null;
  if(left>0)setTimeout(()=>b.classList.remove('is-pressed'),left);else b.classList.remove('is-pressed');}
// window capture: runs before the sound module's first-gesture AudioContext setup on the document
addEventListener('pointerdown',e=>{const b=e.target.closest?.('button');if(!b||b.disabled)return;unpress();pressedBtn=b;pressedAt=performance.now();b.classList.add('is-pressed');},{capture:true,passive:true});
for(const t of ['pointerup','pointercancel'])addEventListener(t,unpress,{capture:true,passive:true});
// The page itself never scrolls: only real scroll boxes (level list, long dialogs) may pan.
function scrollBoxOf(el){for(;el&&el!==document.body;el=el.parentElement){const o=getComputedStyle(el).overflowY;if((o==='auto'||o==='scroll')&&el.scrollHeight>el.clientHeight+1)return el;}return null;}
document.addEventListener('touchmove',e=>{if(e.touches.length>1||!scrollBoxOf(e.target))e.preventDefault();},{passive:false});
// iOS (above all as a home-screen app) sometimes leaves the page scrolled or the layout viewport a
// status bar too short after returning to the app / a toolbar change: a dark strip at the bottom and
// touches that no longer match the picture. Snap back and size from the real screen on every change.
const standalone=navigator.standalone===true||matchMedia('(display-mode: standalone)').matches;
if(standalone)document.documentElement.classList.add('is-standalone');
let fitKey='';
function fitViewport(){
  let moved=false;
  if(scrollX||scrollY){scrollTo(0,0);moved=true;}
  for(const el of [document.scrollingElement,document.documentElement,document.body])if(el&&(el.scrollTop||el.scrollLeft)){el.scrollTop=0;el.scrollLeft=0;moved=true;}
  if(standalone){
    const portrait=innerHeight>=innerWidth,sw=portrait?Math.min(screen.width,screen.height):Math.max(screen.width,screen.height),sh=portrait?Math.max(screen.width,screen.height):Math.min(screen.width,screen.height);
    // only when the app fills the screen width (not in an iPad split view)
    const h=Math.abs(innerWidth-sw)<2?Math.max(innerHeight,sh):innerHeight;
    document.documentElement.style.setProperty('--app-h',h+'px');
  }
  const key=`${innerWidth}x${innerHeight}:${visualViewport?.height|0}:${document.documentElement.style.getPropertyValue('--app-h')}`;
  if(moved||key!==fitKey){fitKey=key;window.SquishDoku?.board?.refresh?.();}
}
let fitTimer=0;
function fitSoon(){fitViewport();requestAnimationFrame(fitViewport);clearTimeout(fitTimer);fitTimer=setTimeout(fitViewport,350);}
for(const t of ['resize','orientationchange','pageshow'])addEventListener(t,fitSoon);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)fitSoon();});
visualViewport?.addEventListener('resize',fitSoon);visualViewport?.addEventListener('scroll',()=>{if(scrollY)fitSoon();});
addEventListener('scroll',()=>{if(scrollX||scrollY)scrollTo(0,0);},{passive:true});
fitViewport();

// ---------- Level ----------
const levels=await (await fetch('src/levels.json')).json();
if(TUBE){store.unlocked=levels.length;} // Vorschau: alle Level offen
const HINTS=[
  'Halte einen Squish kurz <b>gedrückt</b> – richtig gewählt, <b>leuchtet</b> er!',
  '<b>Wische</b> über Squishs, die nicht leuchten können – sie <b>ploppen</b>.',
  'Pro <b>Reihe</b>, <b>Spalte</b> und <b>Farbe</b> leuchtet genau ein Squish.',
  'Leuchtende Squishs berühren sich nie – auch nicht <b>schräg</b>.',
  'Kein Raten nötig: Alles lässt sich <b>logisch</b> lösen.',
];
// Meilenstein-Tipps für die 50er-Rampe; dazwischen wechseln die Grundregeln
const MILESTONES={
  3:'Jetzt allein: Jedes Level hier hat einen <b>Einzel-Squish</b> – eine Farbe aus nur einem Feld. Fang dort an!',
  11:'Ab jetzt gibt es <b>kein Einzelfeld</b> mehr: Such eine kleine Farbe, die nur in <b>einer Reihe</b> liegt.',
  15:'Neu: <b>6×6</b>! Liegt eine Farbe nur in einer Spalte, gehört diese Spalte ihr.',
  21:'Prüf auch: Würde ein Squish hier eine Farbe <b>komplett blockieren</b>? Dann kann er nicht leuchten.',
  28:'Neu: <b>7×7</b> – und der <b>weiße</b> Squish ist eine eigene Farbe.',
  35:'Knifflig: Teilen sich <b>zwei Farben zwei Reihen</b>, gehören die Reihen nur ihnen.',
  41:'Neu: <b>8×8</b> mit acht Farben. Du schaffst das – Schritt für Schritt!',
  50:'Das letzte Level – zeig, was du gelernt hast!',
};
const DAILY_HINTS=['Tagesrätsel: Heute für alle gleich – schaffst du es <b>ohne Fehler</b>?','Jeden Tag ein neues Rätsel. Halte deine <b>Serie</b> am Leben!','Kein Raten nötig: Alles lässt sich <b>logisch</b> lösen.'];
const hintFor=id=>typeof id!=='number'?DAILY_HINTS[(SquishDaily.dayNum(S?.L?.daily||todayKey()))%DAILY_HINTS.length]:MILESTONES[id]||HINTS[id-1]||HINTS[2+(id%3)];

// ---------- Sterne & Zeit ----------
// Zielzeit je Größe (Sekunden). 3★ = ohne Herzverlust UND ≤ Zielzeit; 2★ = ohne Herzverlust (egal wie lange)
// ODER höchstens 1 Herz verloren und ≤ 2× Zielzeit; 1★ = sonst gelöst. Missionen mit Anleitung (L1–2): nur Herzen.
const TARGET_S={4:45,5:60,6:90,7:120,8:150};
const targetMs=N=>(TARGET_S[N]||N*20)*1000;
function starsFor(L,hearts,ms){
  const lost=HEARTS-hearts;if(L.guide)return Math.max(1,3-lost);
  const T=targetMs(L.N);if(lost===0&&ms<=T)return 3;if(lost===0||(lost<=1&&ms<=2*T))return 2;return 1;
}
const fmtTime=ms=>{const t=Math.floor(Math.max(0,ms)/1000);return `${Math.floor(t/60)}:${String(t%60).padStart(2,'0')}`;};

// ---------- Tagesrätsel ----------
let todayOverride=null; // tests: SquishDoku.today='2026-11-23'
const todayKey=()=>todayOverride||SquishDaily.dateKey();
const dayLabel=(key,o={weekday:'short',day:'numeric',month:'short'})=>new Intl.DateTimeFormat('de-DE',{...o,timeZone:'UTC'}).format(new Date(SquishDaily.dayNum(key)*864e5));
const dailyPlan=key=>SquishDaily.PLAN[SquishDaily.weekday(key)];
// streak counts consecutive days; it is still alive today if the last solved day was today or yesterday
function curStreak(){const D=store.daily,t=todayKey();return D.last===t||D.last===SquishDaily.addDays(t,-1)?D.streak:0;}
let dailyTable=null;const dailyCache=new Map();let dailyWorker=null;const dailyWaiters=new Map();
const loadDailyTable=()=>dailyTable??=fetch('src/daily.json').then(r=>r.ok?r.json():{}).catch(()=>({}));
function buildDailyOffThread(key){
  return new Promise((res,rej)=>{
    try{if(!dailyWorker){dailyWorker=new Worker('src/daily-worker.js');dailyWorker.onmessage=e=>{const w=dailyWaiters.get(e.data.key);if(!w)return;dailyWaiters.delete(e.data.key);e.data.puzzle?w.res(e.data.puzzle):w.rej(new Error(e.data.error));};}
      dailyWaiters.set(key,{res,rej});dailyWorker.postMessage(key);}catch(err){rej(err);}
  });
}
async function dailyPuzzle(key){
  if(dailyCache.has(key))return dailyCache.get(key);
  const t=await loadDailyTable();let p=t[key];
  if(!p){try{const c=JSON.parse(localStorage.getItem('squishdoku-daily-cache')||'null');if(c?.key===key)p=c.p;}catch{}}
  if(!p){p=await buildDailyOffThread(key);try{localStorage.setItem('squishdoku-daily-cache',JSON.stringify({key,p:{N:p.N,regions:p.regions,solution:p.solution,colors:p.colors}}));}catch{}}
  const L={id:'daily',daily:key,N:p.N,label:dailyPlan(key).label,regions:p.regions,solution:p.solution,colors:p.colors};
  dailyCache.set(key,L);return L;
}
function recordDaily(key,stars,ms,hearts){
  const D=store.daily,prev=D.done[key],t=todayKey(),y=SquishDaily.addDays(t,-1);
  D.done[key]={stars:Math.max(prev?.stars||0,stars),ms:Math.min(prev?.ms??Infinity,ms),hearts:Math.max(prev?.hearts||0,hearts)};
  let grew=false;
  // only today's puzzle (or yesterday's, if you started it before midnight) moves the streak, once per day
  if(!prev&&(key===t||key===y)&&(!D.last||key>D.last)){
    D.streak=D.last===SquishDaily.addDays(key,-1)?D.streak+1:1;D.last=key;D.best=Math.max(D.best||0,D.streak);grew=true;
  }
  // keep the save small: results of the last 120 days
  const cut=SquishDaily.addDays(t,-120);for(const k of Object.keys(D.done))if(k<cut)delete D.done[k];
  return {prev,grew};
}

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
  closeDialog();tut?.stop();
  $('game').hidden=true;home.hidden=false;document.documentElement.classList.add('home-open');
  home.dataset.screen=screen;renderStars();vibeBtn.hidden=!haptics.supported;
  if(screen==='home'){
    const n=nextLevel(),played=Object.keys(store.stars).length>0;
    setItems([
      button({label:played?`Level ${n} spielen`:'Spielen',icon:'play',color:'aw-green',size:'aw-big',id:'btn-play',action:()=>startLevel(n)}),
      dailyCard(),
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
      const bt=store.times[l.id];
      t.setAttribute('aria-label',`Level ${l.id}, ${l.N} mal ${l.N}${locked?', gesperrt':`, ${stars} Sterne${bt?`, Bestzeit ${fmtTime(bt)}`:''}`}`);
      t.addEventListener('click',()=>{tap();if(locked){t.animate([{transform:'translateX(0)'},{transform:'translateX(-6px)'},{transform:'translateX(5px)'},{transform:'translateX(0)'}],{duration:260});return;}startLevel(l.id);});
      grid.append(t);
    }
    const solved=levels.filter(l=>store.stars[l.id]).length;
    const prog=document.createElement('div');prog.className='sd-lv-progress';prog.innerHTML=`${solved} / ${levels.length} gelöst<span class="sd-lv-total"><i>${starIcon()}</i>${totalStars()} / ${levels.length*3}</span>`;
    const scroller=document.createElement('div');scroller.className='sd-levels-scroll';scroller.append(grid);
    const card=document.createElement('div');card.className='aw-card sd-levels-card';card.append(prog,scroller);
    // jump to the level you are on (the list is long now)
    requestAnimationFrame(()=>{const cur=grid.querySelector(`[data-level="${nextLevel()}"]`);if(cur)scroller.scrollTop=Math.max(0,cur.offsetTop-scroller.clientHeight/2+cur.offsetHeight/2);});
    setItems([ribbon('Levels','aw-r-blue'),card,button({label:'Zurück',icon:'back',color:'aw-slate',size:'aw-small',id:'btn-home',action:()=>showHome('home')})]);
  }else if(screen==='rules'){
    setItems([ribbon('So geht’s','aw-r-purple'),rulesCard(),button({label:'Zurück',icon:'back',color:'aw-slate',size:'aw-small',action:()=>showHome('home')})]);
  }
}
// prominent Tagesrätsel card on the start screen: date, size, status, streak flame
function dailyCard(){
  const key=todayKey(),plan=dailyPlan(key),res=store.daily.done[key],streak=curStreak(),best=store.daily.best||0;
  const b=document.createElement('button');b.type='button';b.id='btn-daily';b.className='aw-card sd-daily'+(res?' is-solved':'');
  const wd=dayLabel(key,{weekday:'short'}).replace('.','').toUpperCase(),dd=dayLabel(key,{day:'numeric'}).replace('.','');
  const status=res?`<span class="sd-daily-stars">${[1,2,3].map(i=>`<span class="${i<=res.stars?'':'off'}">${starIcon()}</span>`).join('')}</span><span class="sd-daily-time">${fmtTime(res.ms)}</span>`
    :`<span class="sd-daily-size">${plan.N}×${plan.N} · ${plan.label}</span>`;
  b.innerHTML=`<span class="sd-daily-cal" aria-hidden="true"><b>${wd}</b><i>${dd}</i></span>
    <span class="sd-daily-main"><span class="sd-daily-title">Tagesrätsel</span><span class="sd-daily-sub">${status}</span></span>
    <span class="sd-daily-flame${streak?'':' is-out'}" aria-hidden="true">${flameIcon(streak>0)}<b>${streak}</b></span>
    ${res?'<span class="sd-daily-badge is-done" aria-hidden="true">✓</span>':'<span class="sd-daily-badge" aria-hidden="true">NEU</span>'}`;
  b.setAttribute('aria-label',`Tagesrätsel vom ${dayLabel(key,{weekday:'long',day:'numeric',month:'long'})}, ${res?`gelöst in ${fmtTime(res.ms)}, ${res.stars} Sterne`:`${plan.N} mal ${plan.N}, ${plan.label}`}. Serie ${streak} Tage, Rekord ${best}.`);
  b.dataset.status=res?'solved':'new';
  b.addEventListener('click',()=>{tap();if(res)showDailyDone(key);else startDaily(key);});
  return b;
}
const msToMidnight=()=>{const now=new Date(),p=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Berlin',hour:'numeric',minute:'numeric',second:'numeric',hourCycle:'h23'}).formatToParts(now),g=t=>+p.find(x=>x.type===t).value;return (24*3600-(g('hour')*3600+g('minute')*60+g('second')))*1000;};
function fmtLeft(ms){const m=Math.max(1,Math.round(ms/60000)),h=Math.floor(m/60);return h?`${h} Std. ${m%60} Min.`:`${m} Min.`;}
function streakBox(streak,best,grew){
  const d=document.createElement('div');d.className='sd-streak'+(grew?' is-grew':'')+(streak?'':' is-out');
  d.innerHTML=`<span class="sd-streak-flame">${flameIcon(streak>0)}</span><span class="sd-streak-text"><span><b>${streak} ${streak===1?'Tag':'Tage'}</b> in Folge</span><small>Rekord: ${best} ${best===1?'Tag':'Tage'}</small></span>`;
  return d;
}
function showDailyDone(key){
  const res=store.daily.done[key];
  const st=document.createElement('div');st.className='sd-stars sd-stars-static';st.innerHTML=[0,1,2].map(i=>`<i class="${i<res.stars?'on':''}">${starIcon()}</i>`).join('');
  const p=document.createElement('p');p.className='sd-center';p.innerHTML=`Heute schon gelöst – in <b>${fmtTime(res.ms)}</b>.<br>Neues Rätsel in ${fmtLeft(msToMidnight())}.`;
  openDialog([ribbon('Tagesrätsel','aw-r-green'),st,streakBox(curStreak(),store.daily.best||0,false),p,
    button({label:'Nochmal spielen',icon:'retry',color:'aw-orange',id:'btn-daily-again',action:()=>startDaily(key)}),
    button({label:'Zurück',icon:'back',color:'aw-slate',size:'aw-small',id:'btn-daily-close',action:closeDialog})],'daily');
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
// Vibration an/aus (only where the device can vibrate: Android browsers, later the native shell; iOS Safari can't)
const vibeBtn=$('vibe-toggle');vibeBtn.innerHTML=VIBE;vibeBtn.hidden=!haptics.supported;
const syncVibe=()=>{const on=store.settings.vibration!==false;vibeBtn.setAttribute('aria-pressed',String(on));vibeBtn.setAttribute('aria-label',on?'Vibration an':'Vibration aus');};
vibeBtn.addEventListener('click',()=>{try{sound.unlock?.();}catch{}store.settings.vibration=store.settings.vibration===false;save();syncVibe();sfx('land',2);buzz('light');});
syncVibe();
$('home-stars').querySelector('i').innerHTML=starIcon();

// ---------- Spiel ----------
const game=$('game'),stage=$('stage'),fx=$('fx');
$('btn-back').innerHTML=ICONS.back;$('btn-reset').innerHTML=ICONS.retry;
const undoBtn=$('btn-undo');undoBtn.innerHTML=UNDO;$('timer').querySelector('i').innerHTML=CLOCK;
let board=null,S=null;
let tut=null,rulesBar=null,tipTimer=0;
// Regel-Chip antippen: Mini-Animation + Erklärung kurz unten statt des Tipps
function ruleTip(rule){clearTimeout(tipTimer);if(!S)return;if(!rule){$('hint').innerHTML=hintFor(S.id);return;}
  $('hint').innerHTML=rule.tip;tipTimer=setTimeout(()=>{if(S)$('hint').innerHTML=hintFor(S.id);},3800);}
function ensureBoard(){if(!board){board=createBoard3D($('host'));bindInput();
  if(TUBE)board.onTubeLit=()=>{sfx('magic');setTimeout(()=>sfx('star',3),120);buzz('big');};
  tut=createTutorial({stage,board,getS:()=>S});tut.stop();
  rulesBar=createRulesBar($('rulesbar'),{store,save:()=>save(),onTip:ruleTip});window.addEventListener('resize',()=>requestAnimationFrame(placePlate));}return board;}
function placePlate(){if(!board||game.hidden||!$('plate'))return;const r=board.frameRect(),p=$('plate'),pad=r.width*.012;Object.assign(p.style,{left:`${r.left-pad}px`,top:`${r.top-pad}px`,width:`${r.width+2*pad}px`,height:`${r.height+2*pad}px`});}

// ---------- Werbung (wie Squish Attack: ad-pacing + native-ads; im Browser Dummy) ----------
const adPacing=createAdPacing();
const adUI=createAdUI({sound,haptics,onAdStart:()=>{try{sound.pause();}catch{}},onAdEnd:()=>{try{sound.resume();}catch{}}});
let starting=false;
// Zwischenwerbung nur zwischen zwei Leveln: fällig nach jedem 5. Sieg, gezeigt beim Start des nächsten Levels.
// Das Tagesrätsel läuft im selben Takt wie ein normales Level (Sieg zählt, Zwischenwerbung nur beim Start).
async function startLevel(id,L=levels[id-1]){
  if(starting||!L)return;
  // In den Missionen mit Anleitung (Level 1–2) gibt es keine Werbung
  if(!L.guide&&adPacing.takeInterstitial()){starting=true;closeDialog();try{await adUI.interstitial();}catch{}finally{starting=false;}}
  beginLevel(id,L);
}
async function startDaily(key=todayKey()){
  if(starting)return;
  let L=dailyCache.get(key);
  if(!L){starting=true;const b=$('btn-daily');b?.classList.add('is-loading');
    try{L=await dailyPuzzle(key);}catch{L=null;}finally{starting=false;b?.classList.remove('is-loading');}
    if(!L)return;}
  return startLevel('daily',L);
}
const restart=()=>{if(!S)return;if(S.L.daily)startDaily(S.L.daily);else startLevel(S.id);};
function setLevelCard(id,L){
  $('lvl-kind').textContent=L.daily?'TAGESRÄTSEL':'LEVEL';$('lvl-num').textContent=L.daily?'':id;
  $('lvl-name').textContent=L.daily?dayLabel(L.daily):L.label;$('level-card').classList.toggle('is-daily',!!L.daily);
}
function beginLevel(id,L=levels[id-1]){
  home.hidden=true;document.documentElement.classList.remove('home-open');game.hidden=false;closeDialog();
  if(!board&&!beginLevel.deferred){beginLevel.deferred=true;
    // First level of the session: WebGL setup + shader linking take a moment on a phone. Show the
    // game screen first (the tap answers at once), build the table right after that frame is painted.
    setLevelCard(id,L);$('glow-total').textContent=L.N;$('glow-count').textContent=0;$('timer-text').textContent='0:00';
    $('hint').innerHTML=hintFor(id);
    starting=true;requestAnimationFrame(()=>setTimeout(()=>{starting=false;if(!game.hidden)beginLevel(id,L);},0));
    return;
  }
  ensureBoard();
  S={L,id,N:L.N,state:Array.from({length:L.N},()=>Array(L.N).fill('normal')),hearts:HEARTS,glow:0,done:false,locked:false,hist:[],ms:0,tRun:false};
  board.build(L,g=>L.colors[g]);
  for(const [r,c] of L.prePopped||[]){S.state[r][c]='popped';board.vanish(r,c);} // optional: schon leeres Glas
  S.fixed=new Set((L.prePopped||[]).map(([r,c])=>r*L.N+c));
  setLevelCard(id,L);
  $('glow-total').textContent=L.N;
  $('hint').innerHTML=hintFor(id);clearTimeout(tipTimer);
  rulesBar.setLevel(L);
  renderHearts();renderProgress();renderAdTip();renderTimer(true);renderUndo();
  if(L.guide)tut.start(S);else tut.stop();
  requestAnimationFrame(()=>requestAnimationFrame(placePlate));setTimeout(placePlate,120);
}
function renderHearts(){
  const h=$('hearts');h.replaceChildren();for(let i=0;i<HEARTS;i++){const d=document.createElement('span');d.className='sd-heart'+(i>=S.hearts?' is-lost':'');d.innerHTML=HEART;h.append(d);}
  h.setAttribute('aria-label',`${S.hearts} Herzen`);
}
function renderProgress(){$('glow-count').textContent=S.glow;renderAdTip();}

// ---------- Zeit: läuft nur, solange du wirklich spielst ----------
// pauses while the app is in the background, a dialog/ad is open or the menu is shown
let tLast=performance.now(),tShown=-1;
const timerRuns=()=>!!S&&!S.locked&&!game.hidden&&!document.hidden&&$('veil').hidden&&!adUI.isOpen;
function tick(){
  const now=performance.now(),run=timerRuns();
  if(S&&run&&S.tRun)S.ms+=Math.min(now-tLast,1000);
  if(S)S.tRun=run;tLast=now;renderTimer();
}
function renderTimer(force){if(!S)return;const sec=Math.floor(S.ms/1000);if(sec===tShown&&!force)return;tShown=sec;$('timer-text').textContent=fmtTime(S.ms);}
setInterval(tick,250);
document.addEventListener('visibilitychange',tick);

// ---------- Rückgängig ----------
// One step = one player action: lighting a squish, switching it off again, a whole swipe (all squishes it
// popped) or tapping a popped squish back. Wrong moves change nothing on the board and are no step:
// a lost heart stays lost (otherwise undo would make mistakes free). Not in the guided missions.
const canUndo=()=>!!S&&!S.locked&&!S.L.guide&&S.hist.length>0;
function renderUndo(){const off=!canUndo();undoBtn.disabled=off;undoBtn.setAttribute('aria-disabled',String(off));}
function pushStep(step){S.hist.push(step);if(S.hist.length>200)S.hist.shift();renderUndo();return step;}
function undo(){
  if(!canUndo()||tut?.blocking)return false;
  const a=S.hist.pop(),st=(r,c)=>S.state[r][c];
  if(a.t==='glow'){if(st(a.r,a.c)==='glow'){S.state[a.r][a.c]='normal';S.glow--;board.glow(a.r,a.c,false);}}
  else if(a.t==='unglow'){if(st(a.r,a.c)==='normal'){S.state[a.r][a.c]='glow';S.glow++;board.glow(a.r,a.c,true);}}
  else if(a.t==='pop'){for(const [r,c] of a.cells.slice().reverse())if(st(r,c)==='popped'&&!S.fixed?.has(r*S.N+c)){S.state[r][c]='normal';board.restore(r,c);}}
  else if(a.t==='restore'){if(st(a.r,a.c)==='normal'){S.state[a.r][a.c]='popped';board.pop(a.r,a.c,{power:1.6});}}
  renderProgress();renderUndo();sfx('tap');buzz('undo');tut.changed();
  if(!reduceMotion.matches)undoBtn.animate([{transform:'rotate(0)'},{transform:'rotate(-40deg)'},{transform:'rotate(0)'}],{duration:320,easing:'cubic-bezier(.3,1.6,.5,1)'});
  checkSolved();
  return true;
}
undoBtn.addEventListener('click',()=>{try{sound.unlock?.();}catch{}undo();});
// Tipp per Werbung: beliebig oft je Level, jeder Clip enthüllt einen weiteren richtigen Squish,
// bis alle leuchten. Gemerkt wird je Level, wie viele Tipps genutzt wurden.
const adTip=$('btn-adtip');adTip.innerHTML=`<i>${AD_ICON_SVG}</i><span>Tipp per Werbung</span>`;
function renderAdTip(){if(!S)return;const off=S.locked||S.glow>=S.N||!!S.L.guide;adTip.disabled=off;adTip.setAttribute('aria-disabled',String(off));}
async function useAdTip(){
  if(!S||S.locked||S.glow>=S.N||adUI.isOpen||S.L.guide)return;
  tap();const s0=S,left=S.N-S.glow;
  const ok=await adUI.offerReveal({left});
  if(!ok||S!==s0||S.locked||S.glow>=S.N)return;
  const rows=[];for(let r=0;r<S.N;r++)if(S.state[r][S.L.solution[r]]!=='glow')rows.push(r);
  const r=rows[Math.floor(Math.random()*rows.length)],c=S.L.solution[r];
  if(!S.L.daily){store.revealed[S.id]=(store.revealed[S.id]||0)+1;save();}
  revealAt(r,c);
}
adTip.addEventListener('click',()=>void useAdTip());
function revealAt(r,c){
  if(S.state[r][c]==='popped')S.state[r][c]='normal',board.restore(r,c);
  const p=board.screenOf(r,c),f=document.createElement('div');f.className='sd-reveal';
  f.style.cssText=`left:${p.x}px;top:${p.y}px;--s:${p.size*2.6}px`;f.innerHTML='<i></i><i></i><b></b>';fx.append(f);setTimeout(()=>f.remove(),1300);
  board.wobble(r,c,1);sfx('star',3);
  setTimeout(()=>{if(S&&S.state[r][c]!=='glow')glowAt(r,c,false);},260); // a paid hint is no undo step
}
const isSol=(r,c)=>S.L.solution[r]===c;
const regionOf=(r,c)=>S.L.regions[r].charCodeAt(c)-97;

function loseHeart(r,c){
  S.hearts=Math.max(0,S.hearts-1);
  const hearts=[...$('hearts').children];const h=hearts[S.hearts];if(h){h.classList.add('is-lost');}
  $('hearts').setAttribute('aria-label',`${S.hearts} Herzen`);
  const p=board.screenOf(r,c),f=document.createElement('div');f.className='sd-float';f.innerHTML=HEART.replace('#ff3b4e','#ff3b4e');f.style.left=p.x+'px';f.style.top=p.y+'px';fx.append(f);setTimeout(()=>f.remove(),1000);
  if(!reduceMotion.matches){stage.classList.remove('is-shake');void stage.offsetWidth;stage.classList.add('is-shake');}
  buzz('wrong');
  if(S.hearts===0){S.locked=true;renderUndo();setTimeout(showLose,900);}
}
function wrongAt(r,c){board.wrong(r,c);sfx('land',2);sfx('squish');loseHeart(r,c);if(tut.active)tut.ouch();}
function popAt(r,c,opts){if(S.state[r][c]!=='normal')return false;S.state[r][c]='popped';board.pop(r,c,opts);return true;}
function checkSolved(){if(S.glow===S.N&&!S.done){tick();S.done=true;S.locked=true;renderUndo();setTimeout(win,700);}}
function glowAt(r,c,record=true){
  S.state[r][c]='glow';S.glow++;board.glow(r,c,true);if(record)pushStep({t:'glow',r,c});renderProgress();sfx('magic');buzz('light');
  // Nichts ploppt automatisch: nur der Spieler wischt Squishs weg.
  checkSolved();
  tut.changed();
}
function unglowAt(r,c){S.state[r][c]='normal';S.glow--;board.glow(r,c,false);pushStep({t:'unglow',r,c});renderProgress();sfx('tap');buzz('tap');tut.changed();}
function restoreAt(r,c){if(S.fixed?.has(r*S.N+c))return;S.state[r][c]='normal';pushStep({t:'restore',r,c});tut.changed();board.restore(r,c);sfx('tap');buzz('tap');}

// Wischen über einen Squish
function swipeCell(r,c,stroke){
  const st=S.state[r][c];
  if(st!=='normal')return;
  if(isSol(r,c)){if(!stroke.wrong.has(r*S.N+c)){stroke.wrong.add(r*S.N+c);wrongAt(r,c);}return;}
  // wobble -> swell -> pop (the pop sound and buzz land on the actual burst)
  if(S.state[r][c]!=='normal')return;S.state[r][c]='popped';tut.changed();
  (stroke.step||=pushStep({t:'pop',cells:[]})).cells.push([r,c]); // the whole swipe is one undo step
  sfx('squish');buzz('tap');
  board.popSequence(r,c,{onPop:i=>{if(TUBE)sfx('land');else sfx('pop',1,{detune:POP_DETUNE[i%POP_DETUNE.length]});buzz('pop');}});
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
    if(!S||S.locked||g||tut?.blocking)return;
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
      const left=hit&&(hit.r!==g.r||hit.c!==g.c)&&moved>6; // the pressed squish shrinks under the finger
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
  const id=S.id,L=S.L,ms=Math.round(S.ms),stars=starsFor(L,S.hearts,ms),daily=L.daily;
  if(!L.guide)adPacing.levelWon(); // Werbe-Takt wie Squish Attack: jede 5. gewonnene Runde (Missionen mit Anleitung zählen nicht; das Tagesrätsel zählt wie ein Level)
  let prevBest,dailyRes=null;
  if(daily){prevBest=store.daily.done[daily]?.ms;dailyRes=recordDaily(daily,stars,ms,S.hearts);}
  else{prevBest=store.times[id];store.stars[id]=Math.max(store.stars[id]||0,stars);store.times[id]=Math.min(prevBest??Infinity,ms);store.unlocked=Math.max(store.unlocked,Math.min(levels.length,id+1));}
  save();
  const newBest=prevBest!=null&&ms<prevBest;
  sfx('record');buzz('win');
  // Jubel-Welle über die leuchtenden Squishs
  if(TUBE)board.celebrate();
  else for(let r=0;r<S.N;r++){const c=L.solution[r];setTimeout(()=>board.wobble(r,c,.8),r*70);}
  const rect=board.boardRect();confetti.burst(rect,{reduced:reduceMotion.matches});
  const s0=S;await wait(1100);
  if(S!==s0||game.hidden)return; // left the level meanwhile
  const last=!daily&&id===levels.length;
  const items=[ribbon(last?'Alles geschafft!':daily?'Tagesrätsel!':'Geschafft!','aw-r-green')];
  const st=document.createElement('div');st.className='sd-stars';st.innerHTML=[0,1,2].map(()=>`<i>${starIcon()}</i>`).join('');items.push(st);
  // Zeit + Bestzeit
  const best=daily?store.daily.done[daily].ms:store.times[id];
  const tm=document.createElement('div');tm.className='sd-result'+(newBest?' is-best':'');tm.id='win-time';
  tm.innerHTML=`<span class="sd-res-time"><i>${CLOCK}</i><b>${fmtTime(ms)}</b></span>`+(newBest?'<span class="sd-res-badge">Neue Bestzeit!</span>':prevBest!=null?`<span class="sd-res-best">Bestzeit ${fmtTime(best)}</span>`:'');
  items.push(tm);
  if(daily)items.push(streakBox(curStreak(),store.daily.best||0,dailyRes.grew));
  const p=document.createElement('p');p.className='sd-center';
  const lost=HEARTS-S.hearts,T=targetMs(L.N);
  p.innerHTML=L.guide==='touch'?'Mission 1 geschafft – du kennst jetzt alle Regeln!':L.guide==='claim'?'Mission 2 geschafft – den Reihen-Trick brauchst du ab jetzt öfter!':last?`Alle ${levels.length} Level gelöst – du bist ein Squish-Profi!`
    :stars===3?(daily?'Perfekt – ohne Fehler und flott! Morgen wartet das nächste.':`Level ${id}: perfekt – ohne Fehler und flott!`)
    :`${daily?'Gelöst!':`Level ${id} gelöst.`} Für 3 Sterne: ${lost?'ohne Fehler':''}${lost&&ms>T?' und ':''}${ms>T?`unter ${fmtTime(T)}`:''}.`;
  items.push(p);
  if(daily){
    items.push(button({label:'Super!',icon:'play',color:'aw-green',size:'aw-big',id:'btn-daily-ok',action:()=>showHome('home')}));
    items.push(button({label:'Nochmal',icon:'retry',color:'aw-orange',id:'btn-again',action:()=>startDaily(daily)}));
  }else{
    if(!last)items.push(button({label:'Weiter',icon:'play',color:'aw-green',size:'aw-big',id:'btn-next',action:()=>startLevel(id+1)}));
    items.push(button({label:'Nochmal',icon:'retry',color:'aw-orange',id:'btn-again',action:()=>startLevel(id)}));
    items.push(button({label:'Levels',icon:'grid',color:'aw-slate',size:'aw-small',id:'btn-to-levels',action:()=>showHome('levels')}));
  }
  openDialog(items,'win');st.dataset.stars=stars;
  [...st.children].forEach((s,i)=>{if(i<stars)setTimeout(()=>{s.classList.add('on');sfx('star',i+1);buzz(i===2?'win':'light');},380+i*280);});
}
function showLose(){
  openDialog([ribbon('Oh nein!',''),Object.assign(document.createElement('p'),{textContent:'Keine Herzen mehr. Versuch’s gleich nochmal!'}),
    button({label:'Nochmal',icon:'retry',color:'aw-orange',size:'aw-big',id:'btn-retry',action:restart}),
    S.L.daily?button({label:'Zum Start',icon:'back',color:'aw-slate',size:'aw-small',action:()=>showHome('home')}):button({label:'Levels',icon:'grid',color:'aw-slate',size:'aw-small',action:()=>showHome('levels')})],'lose');
}
function showRulesDialog(){
  openDialog([ribbon('So geht’s','aw-r-purple'),rulesCard(),button({label:'Los geht’s',icon:'play',color:'aw-green',size:'aw-big',id:'btn-rules-ok',action:closeDialog})],'rules');
}
function openDialog(items,kind){tick();const v=$('veil'),d=$('dialog');d.replaceChildren(...items);d.dataset.kind=kind;v.hidden=false;}
function closeDialog(){tick();$('veil').hidden=true;const d=$('dialog');d.replaceChildren();delete d.dataset.kind;}

$('btn-back').addEventListener('click',()=>{tap();tut?.stop();showHome(S?.L?.daily?'home':'levels');});
$('btn-reset').addEventListener('click',()=>{tap();restart();});

// ---------- Test-/Debug-Zugriff ----------
window.SquishDoku={act:{hold:(r,c)=>holdFire(r,c),swipe:(r,c)=>swipeCell(r,c,{wrong:new Set(),seen:new Set()}),tap:(r,c)=>{if(S.state[r][c]==='popped')restoreAt(r,c);}},adUI,adPacing,get tutorial(){return tut;},get rulesBar(){return rulesBar;},get state(){return S;},get board(){return board;},levels,startLevel,startDaily,dailyPuzzle,showHome,undo,starsFor,targetMs,haptics,get today(){return todayKey();},set today(v){todayOverride=v;},curStreak,get store(){return store;},get holdMs(){return HOLD_MS;},set holdMs(v){HOLD_MS=v;},TAP_MS,
  reset(){localStorage.removeItem(STORE);store=load();},reload(){store=load();}};
const startAt=+new URLSearchParams(location.search).get('level');
if(startAt>=1&&startAt<=levels.length)startLevel(startAt);else showHome('home');
// warm the daily table in the background; refresh the card when the day changed while the app slept
setTimeout(()=>loadDailyTable(),1200);
let shownDay=todayKey();
document.addEventListener('visibilitychange',()=>{if(document.hidden)return;const t=todayKey();if(t!==shownDay){shownDay=t;if(!home.hidden&&home.dataset.screen==='home'&&$('veil').hidden)showHome('home');}});
document.documentElement.dataset.ready='1';
