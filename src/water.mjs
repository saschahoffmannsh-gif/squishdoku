// SquishDoku water: Sascha's OceanMerge water renderer (vendor/ocean-merge/ocean/water.js:
// same height-field simulation, swell/light settings and drop kernel) driven by a tiny loop here.
//  * the "seabed" is a flat near-black image, so the water is fully opaque black: nothing shows
//    beneath (Sascha: "keine Durchsicht"), only the moving glossy surface and the pop ripples;
//  * it fills the whole game screen (no table, no background) – squishes and UI float on it;
//  * small shader extension (uGloss, off by default): moving sky reflections + bright ring rims;
//    plus the EXT_color_buffer_half_float fallback for WebKit. The finger never moves the water.
import {WaterSurface,CanvasSurface} from '../vendor/ocean-merge/ocean/water.js';
import {resolveWaterSettings} from '../vendor/ocean-merge/ocean/water-settings.js';
import {BOAT_VOYAGE_PRESET} from '../vendor/ocean-merge/ocean/boat-voyage-preset.js';

export function createWater(parent,{reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches}={}){
  // full-screen: the black water is the whole background; squishes and the UI float on it
  const wrap=document.createElement('div');wrap.className='sd-water';wrap.setAttribute('aria-hidden','true');
  const canvas=document.createElement('canvas');canvas.className='sd-water-canvas';wrap.append(canvas);parent.prepend(wrap);
  // flat, fully opaque "seabed": the shader's refraction/caustic terms then add nothing
  const bed=document.createElement('canvas');bed.width=bed.height=4;const bx=bed.getContext('2d');bx.fillStyle='#000000';bx.fillRect(0,0,4,4);
  let renderer;
  try{renderer=new WaterSurface(canvas,bed);canvas.dataset.waterRenderer='webgl2';}
  catch(e){console.warn('water: webgl2 failed, canvas fallback',e);renderer=new CanvasSurface(canvas,bed);canvas.dataset.waterRenderer='canvas';}
  canvas.dataset.waterSim=renderer.floatSupported?'heightfield':'analytic';
  renderer.setOceanView(0);
  const settings=resolveWaterSettings({...BOAT_VOYAGE_PRESET.settings,light:100},reducedMotion);
  // SquishDoku gloss layer (vendor shader extension, off in OceanMerge): moving sky reflections + bright ring rims
  Object.assign(settings,{gloss:1,glossBend:.35,rimLo:.35,rimHi:.8});
  const fx=reducedMotion?BOAT_VOYAGE_PRESET.reducedMotion.fingerStrengthMultiplier:1;
  // Sascha: crisp, high-contrast surface. Shading runs at native density up to 2x; the wave
  // simulation itself stays at OceanMerge's 'high' grid (240 wide), so the cost grows only in the cheap shading pass.
  const dpr=Math.min(devicePixelRatio||1,2);
  let W=0,H=0;
  function fit(){const w=Math.max(1,wrap.clientWidth),h=Math.max(1,wrap.clientHeight);if(w===W&&h===H)return;W=w;H=h;renderer.resize(W,H,dpr,'high');try{renderer.advance(0,settings,[]);}catch{}}
  let raf=0,last=0,running=false,ambient=0;
  function frame(now){
    raf=requestAnimationFrame(frame);
    const dt=last?Math.min(BOAT_VOYAGE_PRESET.rendering.frameDtMaxSeconds,(now-last)/1000):0;last=now;
    // OceanMerge's ambient impulses keep the black surface alive (every 1.6 s)
    if(!reducedMotion&&now-ambient>1600){ambient=now;for(let i=0;i<4;i++)renderer.disturb(.05+.9*Math.random(),.05+.9*Math.random(),.022,9);}
    try{renderer.advance(dt,settings,[]);}catch(e){console.warn('water',e);stop();}
  }
  function start(){if(running||document.hidden)return;fit();running=true;last=0;raf=requestAnimationFrame(frame);}
  function stop(){running=false;cancelAnimationFrame(raf);raf=0;}
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();else if(wrap.isConnected&&wrap.offsetParent)start();});
  window.addEventListener('resize',()=>requestAnimationFrame(fit));
  const api={
    canvas,wrap,renderer,settings,fit,
    start,stop,get running(){return running;},
    // only game events (the pop) disturb the water – the finger never does. Client px in.
    splashAt(x,y,amp=.12,radius=6){const r=wrap.getBoundingClientRect();if(!r.width)return;renderer.disturb((x-r.left)/r.width,(y-r.top)/r.height,amp*fx,radius);},
    dispose(){stop();wrap.remove();},
  };
  return api;
}
