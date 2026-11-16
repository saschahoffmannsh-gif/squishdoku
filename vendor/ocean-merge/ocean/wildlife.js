import {shorelineAt,viewSpan} from './camera.js';
import {WILDLIFE_ASSETS} from './wildlife-assets.js';
const TAU=Math.PI*2;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const pointOnWater=(x,y)=>({x,y:Math.max(y,shorelineAt(x)+.035)});
function swimming(track,time,offset=0){const p=track(time),next=track(time+.05);return{...p,angle:Math.atan2((next.y-p.y)*1.5,next.x-p.x)+Math.PI/2,phase:time+offset};}
const FISH_SCHOOLS=[
 {count:5,cx:.25,cy:.46,rx:.16,ry:.048,speed:.21,phase:.4,variant:'gold',sizes:[17,20,23]},
 {count:5,cx:.72,cy:.67,rx:.18,ry:.085,speed:.15,phase:2.1,variant:'lagoon',sizes:[20,23,26]},
 {count:4,cx:.50,cy:.61,rx:.105,ry:.12,speed:-.18,phase:1.35,variant:'silver',sizes:[14,17,20]}
];
const fishTrack=(t,school)=>{const s=FISH_SCHOOLS[school],phase=t*s.speed+s.phase;return pointOnWater(s.cx+s.rx*Math.cos(phase),s.cy+s.ry*Math.sin(phase));};

const DART_POINTS=[[.14,.57],[.30,.51],[.63,.56],[.46,.65],[.82,.73],[.68,.81],[.25,.75]];
const DART_DURATIONS=[5.5,1,.55,1.3,.7,5,5];
function dartTrack(t){
 const total=DART_DURATIONS.reduce((a,b)=>a+b,0);let age=((t%total)+total)%total,index=0;
 while(age>=DART_DURATIONS[index]){age-=DART_DURATIONS[index++];}
 const count=DART_POINTS.length,p0=DART_POINTS[(index+count-1)%count],p1=DART_POINTS[index],p2=DART_POINTS[(index+1)%count],p3=DART_POINTS[(index+2)%count],u=age/DART_DURATIONS[index],u2=u*u,u3=u2*u;
 const value=axis=>(2*u3-3*u2+1)*p1[axis]+(u3-2*u2+u)*(p2[axis]-p0[axis])*.12+(-2*u3+3*u2)*p2[axis]+(u3-u2)*(p3[axis]-p1[axis])*.12;
 return{...pointOnWater(value(0),value(1)),darting:DART_DURATIONS[index]<1.5};
}
// Decorative world-space routes: no grid, input, inventory or save-state dependency.
export function wildlifeActors(time,reducedMotion=false){
 const t=reducedMotion?12:time,actors=[];
 for(let school=0;school<FISH_SCHOOLS.length;school++)for(let i=0;i<FISH_SCHOOLS[school].count;i++){
  const config=FISH_SCHOOLS[school];
  const a=swimming(s=>fishTrack(s,school),t-i*.8,school*2+i),side=(i%2?1:-1)*(.012+(i>>1)*.009),behind=(i>>1)*.024;
  const p=pointOnWater(a.x+Math.cos(a.angle)*side-Math.sin(a.angle)*behind,a.y+Math.sin(a.angle)*side+Math.cos(a.angle)*behind);
  actors.push({...a,...p,kind:'fish',id:`fish-${school}-${i}`,variant:config.variant,size:config.sizes[i%config.sizes.length],stretch:school===1?.88:school===2?1.16:1,alpha:.43+(i%2)*.10});
 }
 actors.push({kind:'fish',id:'dart-0',variant:'dart',...swimming(dartTrack,t+2),size:22,stretch:.94,alpha:.64});
 if(!reducedMotion)for(let i=0;i<3;i++){
  const period=61+i*13,flightTime=t*2.2,age=((flightTime+i*19+9)%period+period)%period,duration=32+i*3;if(age>duration)continue;const u=age/duration,reverse=i===1;
  const x=reverse?1.12-u*1.24:-.12+u*1.24,y=.045+i*.09+.20*u+.035*Math.sin(u*Math.PI*2+i),dx=reverse?-1.24:1.24,dy=.20+.035*TAU*Math.cos(u*TAU+i);
  actors.push({kind:'gull',id:`gull-${i}`,x,y,angle:Math.atan2(dy*1.5,dx)+Math.PI/2,phase:t*6.2+i*1.7,size:31+i*4,alpha:Math.min(1,age/3,(duration-age)/3)*.9});
 }
 return actors;
}

export class CoastalWildlife{
 constructor(water,air,camera,reducedMotion=false){this.water=water;this.air=air;this.camera=camera;this.reducedMotion=reducedMotion;this.waterContext=water.getContext('2d');this.airContext=air.getContext('2d');this.images=new Map();this.time=0;this.elapsed=0;this.frameReady=false;this.width=1;this.height=1;this.dpr=1;}
 async prepare(){await Promise.all(Object.entries(WILDLIFE_ASSETS).map(async([kind,asset])=>{try{const image=new Image();image.src=new URL(asset.src,import.meta.url).href;await image.decode();this.images.set(kind,{image,...asset});this.frameReady=false;}catch{/* A missing decorative sprite must never stop the game. */}}));}
 resize(width,height,dpr){this.width=width;this.height=height;this.dpr=Math.min(1.5,dpr);for(const c of [this.water,this.air]){c.width=Math.round(width*this.dpr);c.height=Math.round(height*this.dpr);}this.frameReady=false;}
 project(x,y){const span=viewSpan(this.width,this.height);return{x:((x-.5-this.camera.x)/span.x+.5)*this.width,y:(y-this.camera.y)/span.y*this.height};}
 sprite(ctx,asset,w,h){const [sx,sy,sw,sh]=asset.box;ctx.drawImage(asset.image,sx,sy,sw,sh,-w/2,-h/2,w,h);}
 // Bird wings bend independently around the stable body.
 articulated(ctx,asset,w,h,flap){const [sx,sy,sw,sh]=asset.box,edge=.36,core=1-edge*2;
  for(const side of [-1,1]){ctx.save();ctx.translate(side*core*w/2,0);ctx.rotate(side*flap);const start=side<0?0:1-edge;ctx.drawImage(asset.image,sx+start*sw,sy,sw*edge,sh,side<0?-edge*w:0,-h/2,edge*w,h);ctx.restore();}
  ctx.drawImage(asset.image,sx+sw*edge,sy,sw*core,sh,-core*w/2,-h/2,core*w,h);
 }
 draw(dt){
  if(!this.reducedMotion)this.time+=Math.min(dt,.04);this.elapsed+=dt;
  const cameraMoved=this.lastX!==this.camera.x||this.lastY!==this.camera.y;
  if(this.frameReady&&!cameraMoved&&this.reducedMotion)return;
  this.elapsed=0;this.lastX=this.camera.x;this.lastY=this.camera.y;this.frameReady=true;
  for(const ctx of [this.waterContext,this.airContext]){ctx.setTransform(this.dpr,0,0,this.dpr,0,0);ctx.clearRect(0,0,this.width,this.height);}
  const unit=clamp(this.width/390,.78,1.3);
  for(const actor of wildlifeActors(this.time,this.reducedMotion)){
   const asset=this.images.get(actor.kind);if(!asset)continue;const p=this.project(actor.x,actor.y),size=actor.size*unit;if(p.x< -size||p.x>this.width+size||p.y< -size||p.y>this.height+size)continue;
   const ctx=actor.kind==='gull'?this.airContext:this.waterContext,[,,aw,ah]=asset.box,h=actor.kind==='gull'?size*ah/aw:size,w=actor.kind==='gull'?size:size*aw/ah*(actor.stretch||1);
   ctx.save();ctx.translate(p.x,p.y);ctx.rotate(actor.angle);ctx.globalAlpha=actor.alpha;
   if(actor.kind==='gull'){
    const flap=Math.sin(actor.phase)*.20*(.5+.5*Math.sin(actor.phase*.13));this.articulated(ctx,asset,w,h,flap);
   }else{
    ctx.globalCompositeOperation='multiply';
    ctx.filter=actor.variant==='lagoon'?'hue-rotate(150deg) saturate(.78) brightness(1.08)':actor.variant==='silver'?'grayscale(.58) sepia(.18) hue-rotate(155deg) brightness(1.18)':actor.variant==='dart'?'saturate(1.35) brightness(1.08)':'none';
    const sway=this.reducedMotion?0:Math.sin(actor.phase*(actor.darting?22:11))*.07;ctx.rotate(sway);ctx.scale(1+Math.sin(actor.phase*(actor.darting?22:11))*.07,1);this.sprite(ctx,asset,w,h);
   }
   ctx.restore();
  }
 }
}
