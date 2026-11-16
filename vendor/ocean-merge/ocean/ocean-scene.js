import {WaterSurface,CanvasSurface} from './water.js';
import {CoastCamera} from './camera.js';
import {SEA_FEEL} from './game-feel.js';
import {CoastalWildlife} from './wildlife.js';
import {resolveWaterSettings} from './water-settings.js';
import {VoyageTouch} from './voyage-touch.js';
import {createOceanAudio} from './ocean-audio.js';

// Portable lifecycle/input adapter. The actual renderer, shaders, wave model,
// camera, wildlife, route geometry and touch sampler are the original files.
export class OceanScene{
 constructor(root,{settings={},wildlife=true,touch=true,reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches,travel=0}={}){
  if(!root)throw Error('Ein Container für das Meer fehlt.');
  Object.assign(this,{root,reducedMotion,travel});this.settings=resolveWaterSettings(settings,reducedMotion);this.camera=new CoastCamera();this.audio=createOceanAudio(this.settings);this.destroyed=false;this.width=1;this.height=1;this.dpr=1;this.raf=0;this.lastFrame=0;this.lastAmbient=0;this.calmUntil=0;this.particles=[];this.vortices=[];this.activePointers=new Map();this.interactionWaves=[];this.frames=new Set();this.resizes=new Set();this.bindings=new Set();this.nodes=[];this.abort=new AbortController();
  root.classList.add('ocean-scene');this.makeLayer('div','ocean-backdrop');this.water=this.makeLayer('canvas','ocean-water');this.water.tabIndex=0;this.water.setAttribute('aria-label','Interaktives Meer: berühren oder darüber wischen.');
  this.fish=this.makeLayer('canvas','ocean-fish');this.air=this.makeLayer('canvas','ocean-air');this.spray=this.makeLayer('canvas','ocean-spray');this.sprayContext=this.spray.getContext('2d');this.makeLayer('div','ocean-scene-shade');this.makeLayer('div','ocean-voyage-shade');
  this.wildlife=wildlife?new CoastalWildlife(this.fish,this.air,this.camera,reducedMotion):null;
  this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(root);
  document.addEventListener('visibilitychange',()=>{if(document.hidden){this.stop();this.releaseAll();this.audio.context?.suspend().catch(()=>{});}else{this.start();if(this.settings.sound&&this.hasInteracted)this.audio.start().catch(()=>{});}},{signal:this.abort.signal});
  if(touch)this.bindDirectInput();this.ready=this.init();
 }
 makeLayer(tag,name){const el=document.createElement(tag);el.className=name;if(tag!=='canvas')el.setAttribute('aria-hidden','true');else if(name!=='ocean-water')el.setAttribute('aria-hidden','true');this.root.append(el);this.nodes.push(el);return el;}
 async init(){
  this.wildlife?.prepare();const image=this.image=new Image();image.src=new URL('./assets/coast-no-tent-v4.png',import.meta.url).href;await image.decode();if(this.destroyed)return this;
  try{this.renderer=new WaterSurface(this.water,image);this.water.dataset.waterRenderer='webgl2';this.bindContext();}
  catch{const old=this.water,replacement=old.cloneNode(false);old.replaceWith(replacement);this.nodes[this.nodes.indexOf(old)]=replacement;this.water=replacement;this.renderer=new CanvasSurface(replacement,image);this.water.dataset.waterRenderer='canvas';}
  this.renderer.setOceanView(this.travel);this.resize();this.renderer.advance(0,this.settings,[]);this.start();return this;
 }
 bindContext(){
  this.water.addEventListener('webglcontextlost',event=>{event.preventDefault();this.stop();},{signal:this.abort.signal});
  this.water.addEventListener('webglcontextrestored',()=>{if(this.destroyed)return;try{this.renderer=new WaterSurface(this.water,this.image);this.renderer.setOceanView(this.travel);this.resize();this.renderer.advance(0,this.settings,[]);this.start();}catch(error){this.root.dispatchEvent(new CustomEvent('oceanerror',{detail:error}));}},{signal:this.abort.signal});
 }
 resize(){
  const rect=this.root.getBoundingClientRect();this.width=Math.max(1,rect.width);this.height=Math.max(1,rect.height);const cap=this.settings.quality==='high'?2:this.settings.quality==='eco'?1:1.5;this.dpr=Math.min(window.devicePixelRatio||1,cap);
  this.renderer?.resize(this.width,this.height,this.dpr,this.settings.quality);this.spray.width=Math.round(this.width*this.dpr);this.spray.height=Math.round(this.height*this.dpr);this.wildlife?.resize(this.width,this.height,this.dpr);for(const fn of this.resizes)fn(this.width,this.height);
 }
 start(){if(this.destroyed||!this.renderer||this.raf||document.hidden)return;this.lastFrame=0;this.raf=requestAnimationFrame(now=>this.frame(now));}
 stop(){if(this.raf)cancelAnimationFrame(this.raf);this.raf=0;this.lastFrame=0;}
 onFrame(fn){this.frames.add(fn);return()=>this.frames.delete(fn);}
 onResize(fn){this.resizes.add(fn);return()=>this.resizes.delete(fn);}
 setTravel(travel){if(Number.isFinite(travel))this.travel=travel;}
 setSettings(patch){const resolved=resolveWaterSettings({...this.settings,...patch},this.reducedMotion);Object.assign(this.settings,resolved);if('quality'in patch)this.resize();if('sound'in patch){if(this.settings.sound&&this.hasInteracted)this.audio.start().catch(()=>{});else if(!this.settings.sound)this.audio.stop().catch(()=>{});}}
 interact(){this.hasInteracted=true;this.calmUntil=0;if(this.settings.sound)this.audio.start().catch(()=>{});}
 disturb(x,y,amplitude=.17,radius=4,withSplash=false,nearField=false){
  if(!this.renderer||!Number.isFinite(x+y+amplitude+radius))return;this.renderer.disturb(x,y,amplitude,radius);this.interactionWaves.push({x:x*this.width,y:y*this.height,power:Math.max(-2,Math.min(2,amplitude/.27)),nearField,start:performance.now()});if(this.interactionWaves.length>48)this.interactionWaves.shift();if(withSplash)this.splashes(x,y,Math.min(1.7,amplitude*5));
 }
 motionWake(x,y,dx,dy,power=1){
  if(this.reducedMotion||!this.renderer)return;const distance=Math.hypot(dx,dy);if(distance<1)return;const ux=dx/distance,uy=dy/distance;
  this.disturb(x+ux*12/this.width,y+uy*12/this.height,.31*power,6.2,false,true);this.disturb(x-ux*16/this.width,y-uy*16/this.height,-.17*power,5.2,false,true);if(power>.8)this.splashes(x+ux*12/this.width,y+uy*12/this.height,.55,3);
 }
 splashes(x,y,power=1,count=8){
  if(this.reducedMotion)return;for(let i=0;i<count;i++){const angle=Math.random()*Math.PI*2,speed=(17+Math.random()*42)*power;this.particles.push({x:x*this.width,y:y*this.height,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed*.4-35*power,life:0,maxLife:.35+Math.random()*.32,size:.9+Math.random()*1.4});}if(this.particles.length>150)this.particles.splice(0,this.particles.length-150);
 }
 paintSpray(dt){
  const c=this.sprayContext;c.setTransform(this.dpr,0,0,this.dpr,0,0);c.clearRect(0,0,this.width,this.height);this.particles=this.particles.filter(p=>p.life<p.maxLife);
  for(const p of this.particles){p.life+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=160*dt;const alpha=Math.max(0,1-p.life/p.maxLife);c.beginPath();c.ellipse(p.x,p.y,p.size*alpha,p.size*alpha*1.5,.15,0,Math.PI*2);c.fillStyle=`rgba(238,255,244,${alpha*.8})`;c.fill();}
 }
 frame(now){
  this.raf=0;if(this.destroyed||!this.renderer||document.hidden)return;const dt=Math.min((now-(this.lastFrame||now-16.67))/1000,.04);this.lastFrame=now;
  this.camera.step(dt);this.renderer.setCamera(this.camera.x,this.camera.y);for(const fn of this.frames)fn(now,dt,this);this.renderer.setOceanView(this.travel);
  for(const v of this.vortices)v.strength+=(v.target-v.strength)*Math.min(1,dt*(v.released?1.5:3.7));this.vortices=this.vortices.filter(v=>!v.released||v.strength>.015);
  for(const state of this.activePointers.values())if(state.vortex&&now-state.lastDrop>110){this.disturb(state.x,state.y,-.045,4);state.lastDrop=now;}else if(state.mode==='flow'&&now-state.lastDrop>110){this.disturb(state.x,state.y,.035,4);state.lastDrop=now;}
  // Original offshore impulse cadence, strengths and irregular crest profile.
  if(now-this.lastAmbient>SEA_FEEL.ambientInterval&&now>this.calmUntil&&!this.reducedMotion&&this.settings.swell>3){const phase=this.renderer.time||0;for(let i=0;i<12;i++){const x=(i+.5)/12;this.disturb(x,.91+Math.sin(x*6.+phase*.24)*.008,(.008+this.settings.swell*.00032)*(.85+.15*Math.sin(x*7.+phase)),12);}this.lastAmbient=now;}
  const liveSettings=now<this.calmUntil?{...this.settings,swell:2}:this.settings;this.renderer.advance(dt,liveSettings,this.vortices);this.paintSpray(dt);this.wildlife?.draw(dt);this.interactionWaves=this.interactionWaves.filter(p=>now-p.start<SEA_FEEL.waveLifetime);this.raf=requestAnimationFrame(t=>this.frame(t));
 }
 bindScrollSurface(element,{travelWithScroll=false}={}){
  const abort=new AbortController(),signal=abort.signal,gesture=new VoyageTouch({disturb:(...args)=>this.disturb(...args),rect:()=>this.root.getBoundingClientRect(),active:()=>!this.destroyed,reducedMotion:this.reducedMotion});let touchActive=false,pointer=null;
  const sample=(e,begin=false)=>gesture.sample(e.clientX,e.clientY,performance.now(),{begin});
  element.addEventListener('touchstart',e=>{this.interact();touchActive=true;if(e.touches.length===1)sample(e.touches[0],true);},{passive:true,signal});
  element.addEventListener('touchmove',e=>{if(e.touches.length===1)sample(e.touches[0]);},{passive:true,signal});
  const endTouch=()=>{touchActive=false;gesture.end();},endPointer=()=>{pointer=null;if(!touchActive)gesture.end();};
  for(const type of ['touchend','touchcancel'])element.addEventListener(type,endTouch,{passive:true,signal});
  element.addEventListener('pointerdown',e=>{this.interact();if(e.pointerType!=='touch'){pointer=e.pointerId;sample(e,true);}},{passive:true,signal});
  element.addEventListener('pointermove',e=>{if(e.pointerType!=='touch'&&e.pointerId===pointer)sample(e);},{passive:true,signal});
  for(const type of ['pointerup','pointercancel'])window.addEventListener(type,endPointer,{passive:true,signal});
  element.addEventListener('wheel',e=>{this.interact();gesture.sample(e.clientX,e.clientY,performance.now(),{energy:e.deltaY});},{passive:true,signal});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){endTouch();endPointer();}},{signal});
  if(travelWithScroll)element.addEventListener('scroll',()=>this.setTravel(element.scrollTop/Math.max(400,this.height)*.34),{passive:true,signal});
  const unbind=()=>{abort.abort();gesture.end();this.bindings.delete(unbind);};this.bindings.add(unbind);return unbind;
 }
 bindDirectInput(){
  const signal=this.abort.signal,point=e=>{const r=this.water.getBoundingClientRect();return{x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))};};
  this.root.addEventListener('pointerdown',e=>{if(e.target!==this.water||!this.renderer||e.button>0)return;e.preventDefault();this.interact();this.water.setPointerCapture(e.pointerId);const p=point(e),state={...p,id:e.pointerId,previousX:p.x,previousY:p.y,lastDrop:performance.now(),mode:this.settings.mode,vortex:null};this.activePointers.set(e.pointerId,state);
   if(state.mode==='vortex'){state.vortex={x:p.x,y:p.y,strength:0,target:.95,released:false};this.vortices.push(state.vortex);if(this.vortices.length>4)this.vortices.shift();this.disturb(p.x,p.y,.09,4,true);}else this.disturb(p.x,p.y,state.mode==='flow'?.12:.23,state.mode==='flow'?3.5:5,true);this.audio.plop();if(navigator.vibrate)navigator.vibrate(5);
  },{signal});
  this.root.addEventListener('pointermove',e=>{const state=this.activePointers.get(e.pointerId);if(!state)return;e.preventDefault();const p=point(e),now=performance.now(),distance=Math.hypot((p.x-state.x)*this.width,(p.y-state.y)*this.height);state.previousX=state.x;state.previousY=state.y;state.x=p.x;state.y=p.y;if(state.vortex){state.vortex.x=p.x;state.vortex.y=p.y;return;}
   if(distance>1.5&&now-state.lastDrop>15){const steps=Math.min(7,Math.max(1,Math.floor(distance/7)));for(let i=1;i<=steps;i++){const f=i/steps;this.disturb(state.previousX+(p.x-state.previousX)*f,state.previousY+(p.y-state.previousY)*f,state.mode==='flow'?.095:.07,state.mode==='flow'?3.7:2.5);}if(distance>9&&Math.random()>.5)this.splashes(p.x,p.y,.55,2);state.lastDrop=now;}
  },{signal});
  const release=e=>{const state=this.activePointers.get(e.pointerId);if(!state)return;if(state.vortex){state.vortex.released=true;state.vortex.target=0;}else if(e.type==='pointerup')this.disturb(state.x,state.y,.075,3);this.activePointers.delete(e.pointerId);if(this.water.hasPointerCapture(e.pointerId))this.water.releasePointerCapture(e.pointerId);};
  for(const type of ['pointerup','pointercancel','lostpointercapture'])this.root.addEventListener(type,release,{signal});this.root.addEventListener('contextmenu',e=>{if(e.target===this.water)e.preventDefault();},{signal});
 }
 releaseAll(){for(const state of this.activePointers.values()){if(state.vortex){state.vortex.released=true;state.vortex.target=0;}if(this.water.hasPointerCapture(state.id))this.water.releasePointerCapture(state.id);}this.activePointers.clear();}
 calm(){this.renderer?.calm();this.releaseAll();this.vortices=[];this.particles=[];this.interactionWaves=[];this.calmUntil=performance.now()+9000;}
 destroy(){if(this.destroyed)return;this.destroyed=true;this.stop();this.releaseAll();this.abort.abort();this.resizeObserver.disconnect();for(const unbind of [...this.bindings])unbind();this.frames.clear();this.resizes.clear();this.audio.context?.close().catch(()=>{});this.renderer?.gl?.getExtension('WEBGL_lose_context')?.loseContext();for(const node of this.nodes)node.remove();this.root.classList.remove('ocean-scene');}
}
