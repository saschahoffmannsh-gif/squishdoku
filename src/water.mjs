// SquishDoku water: Sascha's OceanMerge water renderer (vendor/ocean-merge/ocean/water.js,
// unchanged: same shaders, height-field simulation, swell/light settings and drop kernel)
// driven by a tiny loop here. Differences to the OceanMerge scene adapter, all outside the module:
//  * the "seabed" texture is a flat near-black image, so the water is fully opaque black:
//    nothing shows beneath (no sand, no caustics), only the moving surface, its glossy sun
//    glints and the finger ripples (Sascha: "keine Durchsicht");
//  * the canvas is mapped onto the Squish Attack table floor with a CSS homography
//    (matrix3d), so the flat simulation lies in the tilted camera's perspective;
//  * no wildlife/coast layers.
import {WaterSurface,CanvasSurface} from '../vendor/ocean-merge/ocean/water.js';
import {resolveWaterSettings} from '../vendor/ocean-merge/ocean/water-settings.js';
import {BOAT_VOYAGE_PRESET} from '../vendor/ocean-merge/ocean/boat-voyage-preset.js';

const SIZE=512; // CSS px of the untransformed square (the homography stretches it onto the table)
// 4x4 homography that maps the square [0,S]x[0,S] onto quad p0..p3 (tl,tr,br,bl), as CSS matrix3d
function squareToQuad(S,p){
  const [x0,y0]=p[0],[x1,y1]=p[1],[x2,y2]=p[2],[x3,y3]=p[3];
  const dx1=x1-x2,dx2=x3-x2,dy1=y1-y2,dy2=y3-y2,sx=x0-x1+x2-x3,sy=y0-y1+y2-y3;
  let g=0,h=0;const den=dx1*dy2-dx2*dy1;
  if(Math.abs(den)>1e-9){g=(sx*dy2-dx2*sy)/den;h=(dx1*sy-sx*dy1)/den;}
  const a=x1-x0+g*x1,b=x3-x0+h*x3,c=x0,d=y1-y0+g*y1,e=y3-y0+h*y3,f=y0;
  // unit square -> quad: [a b c; d e f; g h 1]; scale input by 1/S
  const m=[a/S,d/S,0,g/S, b/S,e/S,0,h/S, 0,0,1,0, c,f,0,1];
  return `matrix3d(${m.map(v=>+v.toFixed(8)).join(',')})`;
}

export function createWater(parent,{reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches}={}){
  const wrap=document.createElement('div');wrap.className='sd-water';wrap.setAttribute('aria-hidden','true');
  const canvas=document.createElement('canvas');canvas.className='sd-water-canvas';wrap.append(canvas);parent.prepend(wrap);
  // flat, fully opaque "seabed": the shader's refraction/caustic terms then add nothing
  const bed=document.createElement('canvas');bed.width=bed.height=4;const bx=bed.getContext('2d');bx.fillStyle='#070b14';bx.fillRect(0,0,4,4);
  let renderer;
  try{renderer=new WaterSurface(canvas,bed);canvas.dataset.waterRenderer='webgl2';}
  catch{renderer=new CanvasSurface(canvas,bed);canvas.dataset.waterRenderer='canvas';}
  renderer.setOceanView(0);
  const settings=resolveWaterSettings({...BOAT_VOYAGE_PRESET.settings,light:100},reducedMotion) // black water: full light so the wave fronts read glossy;
  const finger=reducedMotion?BOAT_VOYAGE_PRESET.reducedMotion.fingerStrengthMultiplier:1;
  const dpr=Math.min(devicePixelRatio||1,BOAT_VOYAGE_PRESET.rendering.devicePixelRatioCap.auto); // 1.5, as OceanMerge "auto"
  wrap.style.width=wrap.style.height=SIZE+'px';canvas.style.width=canvas.style.height='100%';
  renderer.resize(SIZE,SIZE,dpr,'auto');renderer.advance(0,settings,[]);
  let raf=0,last=0,running=false,ambient=0;
  function frame(now){
    raf=requestAnimationFrame(frame);
    const dt=last?Math.min(BOAT_VOYAGE_PRESET.rendering.frameDtMaxSeconds,(now-last)/1000):0;last=now;
    // OceanMerge's ambient impulses keep the black surface alive between touches (every 2.1 s)
    if(!reducedMotion&&now-ambient>2100){ambient=now;const t=renderer.time||0;for(let i=0;i<4;i++){const x=.15+.7*Math.random(),y=.15+.7*Math.random();renderer.disturb(x,y,.035*(.85+.15*Math.sin(t+i)),9);}}
    try{renderer.advance(dt,settings,[]);}catch(e){console.warn('water',e);stop();}
  }
  function start(){if(running||document.hidden)return;running=true;last=0;raf=requestAnimationFrame(frame);}
  function stop(){running=false;cancelAnimationFrame(raf);raf=0;}
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();else if(wrap.isConnected&&!wrap.hidden)start();});
  // finger feedback, as OceanMerge's VoyageTouch: start 0.10, moves 0.12+min(0.14,dist/180) split into
  // up to 4 drops (each / sqrt(n)), radius 5.5, sampled at most every 32 ms
  let lastTouch=null,lastTouchT=0;
  const api={
    canvas,wrap,renderer,settings,
    place(quad){wrap.style.transform=squareToQuad(SIZE,quad);},
    start,stop,get running(){return running;},
    // only game events (the pop) disturb the water – the finger never does
    splash(u,v,amp=.12,radius=6){renderer.disturb(u,v,amp*finger,radius);},
    dispose(){stop();wrap.remove();},
  };
  return api;
}
