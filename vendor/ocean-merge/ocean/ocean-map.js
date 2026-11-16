import {voyageCurrent,voyageAccess,voyageIsland,voyageNodes,voyagePoint,voyagePath,voyageProgress} from './voyage-model.js';
import {LEVELS} from './level-data.js';
const icon=id=>`<svg aria-hidden="true"><use href="#${id}"/></svg>`;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
// Original map methods below; only the game's callbacks/data are adapted.
export class OceanMap{
 constructor(scene,{state={levelId:1,unlocked:[1],completed:[],seaMoves:0,phase:'collect',inventory:{}},runs={},onLevel=()=>{}}={}){
  this.scene=scene;this.world=scene.root;this.screen='map';this.width=scene.width;this.height=scene.height;this.wakes=[];this.nodes=[];this.lastWake=0;this.angle=180;this.direction=1;this.startAtFirst=true;this.reducedMotion=scene.reducedMotion;
  this.game={state,store:{runs},busy:false};this.interact=()=>scene.interact();this.disturb=(...args)=>scene.disturb(...args);this.onLevel=onLevel;
  const $=id=>this.world.querySelector(id);this.scroll=$('#voyage-scroll');this.content=$('#voyage-content');this.viewport=$('#voyage-viewport');this.boat=$('#voyage-boat');this.wakeCanvas=$('#voyage-wake');this.context=this.wakeCanvas.getContext('2d');this.resume=$('#voyage-resume');this.center=$('#voyage-center');this.mapButton=document.createElement('button');
  this.abort=new AbortController();const signal=this.abort.signal;
  this.center.addEventListener('click',()=>this.centerCurrent(),{signal});this.resume.addEventListener('click',()=>this.openLevel(this.current),{signal});
  this.content.addEventListener('click',e=>{const b=e.target.closest('[data-level]');if(b&&!b.disabled)this.openLevel(Number(b.dataset.level));},{signal});
  const refresh=this.refresh.bind(this);this.refresh=()=>{refresh();this.resolveAssets();};
  this.unbindScroll=scene.bindScrollSurface(this.scroll,{travelWithScroll:true});this.refresh();this.layout(true);
  this.offFrame=scene.onFrame((now,dt)=>{this.update(now,dt);scene.setTravel(this.oceanTravel);});this.offResize=scene.onResize((width,height)=>this.resize(width,height));
 }
 resolveAssets(){for(const img of this.world.querySelectorAll('img')){const src=img.getAttribute('src');if(src?.startsWith('./assets/'))img.src=new URL(src,import.meta.url).href;}}
 openLevel(id){if(!voyageAccess(this.game.state,id))return false;this.interact();this.onLevel(id);return true;}
 setProgress(state,runs={}){this.game.state=state;this.game.store.runs=runs;this.refresh();this.startAtFirst=false;this.layout(true);}
 destroy(){this.abort.abort();this.unbindScroll();this.offFrame();this.offResize();}
 refresh(){
  const state=this.game.state;this.current=voyageCurrent(state,LEVELS);this.currentIndex=LEVELS.findIndex(l=>l.id===this.current);this.buttons=[];this.content.replaceChildren();
  const ns='http://www.w3.org/2000/svg';this.route=document.createElementNS(ns,'svg');this.route.classList.add('voyage-route');this.route.setAttribute('aria-hidden','true');this.route.innerHTML='<path class="route-shadow"/><path class="route-ahead"/><path class="route-done"/>';this.content.append(this.route);
  for(const [i,l]of LEVELS.entries()){
   const open=voyageAccess(state,l.id),done=state.completed.includes(l.id),current=l.id===this.current,run=l.id===state.levelId?state:this.game.store.runs[l.id],b=document.createElement('button');b.type='button';b.dataset.level=String(l.id);b.className=`level-station${done?' station-done':''}${current?' station-current':''}${open?'':' station-locked'}`;b.disabled=!open;b.setAttribute('aria-label',`Level ${l.id}: ${l.name} · ${!open?'Noch verschlossen':run&&run.phase!=='won'?'Fortsetzen':done?'Erneut spielen':'Spielen'}`);if(current)b.setAttribute('aria-current','step');
   const island=voyageIsland(i);b.style.setProperty('--island-turn',`${island.rotation}deg`);b.style.setProperty('--island-mirror',island.mirror);b.dataset.island=String(i);
   b.innerHTML=`<span class="station-land"><img class="island-art" src="${island.asset}" alt="" draggable="false"><span class="station-label">${icon('i-play')}<strong>${l.id}</strong></span></span>${!open?`<span class="station-lock" aria-hidden="true">${icon('i-lock')}</span>`:done?`<span class="station-check">${icon('i-check')}</span>`:''}${current?'<span class="station-current-label">DEIN NÄCHSTES ZIEL</span>':''}`;this.content.append(b);this.buttons.push(b);
  }
  this.world.querySelector('#voyage-progress').textContent=`${state.completed.length} von ${LEVELS.length} Etappen gemeistert`;
  const run=this.current===state.levelId?state:this.game.store.runs[this.current],continuing=run&&run.phase!=='won'&&(run.seaMoves>0||run.phase!=='collect'||Object.keys(run.inventory).length>0);
  this.resume.innerHTML=`<span class="resume-play">${icon('i-play')}</span><span><small>${continuing?'DEIN STRANDGLÜCK WARTET':'DEIN NÄCHSTES ZIEL'}</small><strong>Level ${this.current} ${continuing?'fortsetzen':'spielen'}</strong></span>${icon('i-arrow')}`;
 }
 layout(center=false){
  if(this.screen!=='map')return;const rect=this.viewport.getBoundingClientRect();this.mapWidth=rect.width;this.mapHeight=rect.height;this.step=Math.min(164,Math.max(68,this.mapHeight*.27));this.padding=this.mapHeight*.22;this.nodes=voyageNodes(LEVELS.length,this.mapWidth,this.step,this.padding);this.contentHeight=(LEVELS.length-1)*this.step+this.mapHeight;this.content.style.height=`${this.contentHeight}px`;this.content.style.setProperty('--island-width',`${Math.min(132,this.mapWidth*.34,this.mapHeight*.31)}px`);
  this.route.setAttribute('viewBox',`0 0 ${this.mapWidth} ${this.contentHeight}`);this.route.style.height=`${this.contentHeight}px`;const path=voyagePath(this.nodes);for(const p of this.route.querySelectorAll('path'))p.setAttribute('d',path);this.route.querySelector('.route-done').setAttribute('d',voyagePath(this.nodes.slice(0,Math.max(1,this.currentIndex+1))));
  this.buttons.forEach((b,i)=>{b.style.left=`${this.nodes[i].stationX}px`;b.style.top=`${this.nodes[i].y}px`;b.style.setProperty('--station-delay',`${i*-.4}s`);});
  const dpr=Math.min(devicePixelRatio||1,1.5);this.wakeDpr=dpr;this.wakeCanvas.width=Math.round(this.mapWidth*dpr);this.wakeCanvas.height=Math.round(this.mapHeight*dpr);this.mapTop=rect.top-this.world.getBoundingClientRect().top;
  this.anchor=this.currentIndex*this.step;if(center){this.scroll.scrollTop=this.startAtFirst?0:this.anchor;this.scrollY=this.scroll.scrollTop;this.progress=voyageProgress(0,this.scrollY,0,this.step,LEVELS.length);this.lastProgress=this.progress;this.direction=1;this.angle=voyagePoint(this.nodes,this.progress).angle;this.update(performance.now(),0);}
 }
 resize(width,height){const progress=this.progress||0;this.width=width;this.height=height;this.layout(false);if(this.screen==='map'){this.scroll.scrollTop=progress*this.step;this.lastProgress=progress;}}
 centerCurrent(){this.interact();this.scroll.scrollTo({top:this.anchor,behavior:this.reducedMotion?'instant':'smooth'});}
 update(now,dt){
  this.mapButton.disabled=this.game.busy;if(this.screen!=='map'||!this.nodes.length)return;
  const scroll=this.scroll.scrollTop;this.scrollY=scroll;const progress=voyageProgress(0,scroll,0,this.step,LEVELS.length),delta=progress-(this.lastProgress??progress),moving=Math.abs(delta)>.00012;
  if(moving)this.direction=Math.sign(delta);const p=voyagePoint(this.nodes,progress),target=p.angle+(this.direction<0?180:0),angleDelta=((target-this.angle+540)%360)-180;this.angle+=angleDelta*(this.reducedMotion?1:1-Math.exp(-dt*12));const bob=this.reducedMotion?0:Math.sin(now*.0022)*1.6;
  this.boat.style.transform=`translate3d(${p.x}px,${p.y-scroll+bob}px,0) translate(-50%,-50%) rotate(${this.angle}deg)`;this.boat.classList.toggle('sailing',moving);this.boat.dataset.progress=progress.toFixed(3);this.progress=progress;
  if(moving&&!this.reducedMotion&&now-this.lastWake>65){
   const trail=voyagePoint(this.nodes,clamp(progress-this.direction*.25,0,LEVELS.length-1));this.wakes.push({x:trail.x,y:trail.y,age:0,angle:this.angle});if(this.wakes.length>34)this.wakes.shift();this.lastWake=now;
   this.disturb(p.x/this.width,(this.mapTop+p.y-scroll)/this.height,.11+Math.min(.13,Math.abs(delta)*3),4.5);
  }
  const c=this.context;c.setTransform(this.wakeDpr,0,0,this.wakeDpr,0,0);c.clearRect(0,0,this.mapWidth,this.mapHeight);this.wakes=this.wakes.filter(w=>w.age<1.35);
  for(const wake of this.wakes){wake.age+=dt;const age=wake.age;c.save();c.translate(wake.x,wake.y-scroll);c.rotate(wake.angle*Math.PI/180);c.fillStyle=`rgba(239,255,242,${Math.max(0,(1-age/1.35)*.47)})`;for(const side of [-1,1]){c.beginPath();c.ellipse(side*(9+age*15),age*7,4+age*6,1.7+age*2,-side*.35,0,Math.PI*2);c.fill();}c.restore();}
  this.buttons.forEach((b,i)=>{const y=this.nodes[i].y-scroll;b.classList.toggle('in-view',y> -80&&y<this.mapHeight+80);});this.lastProgress=progress;
 }
 get oceanTravel(){return this.screen==='map'?(this.scrollY||0)/Math.max(400,this.height)*.34:.10;}
}
