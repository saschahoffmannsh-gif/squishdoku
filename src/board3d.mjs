// SquishDoku 3D board: Squish Attack's ORIGINAL translucent gel squishes
// (the look before the comic restyle, squish-attack @ 281e8da / launch-5:
// ray-marched gel optics + diffuse glow + neon bands + HDR glass composite)
// on the Squish Attack glass table, seen from directly above. The rendering
// pieces are unmodified Squish Attack modules in /vendor/squish-attack
// (launch-26 copies, plus the launch-5 files neon-bands.mjs, fusion-gel.mjs
// and render-quality-gel.mjs); this file only arranges them for an N x N grid
// (modelled on launch-5's game/graphics-adapter.mjs).
// NOTE: import specifiers must match the vendor files' own specifiers
// (including ?v=…), otherwise ES modules would load twice.
import {createSquishGraphics,THREE,PARAMETERS} from '../vendor/squish-attack/squish/squish-graphics.js?v=play-sharp-1';
import {buildSquishy,createLabel,createGelMaterial,installGelOptics,bindGelOptics,initializeMotion,updateSquishy,PARAMETERS as HUD_PARAMETERS} from '../vendor/squish-attack/game/original-gel-models.js?v=menu-1';
import {comicSparkTexture} from '../vendor/squish-attack/game/comic-style.mjs?v=launch-26';
import {installNeonBands} from '../vendor/squish-attack/game/neon-bands.mjs?v=gel-clarity-c-1';
import {applyNeonGlassLighting,applyDiffuseGelGlow} from '../vendor/squish-attack/game/gel-lighting.mjs?v=launch-26';
import {applyGelSoftness,softWobblePower} from '../vendor/squish-attack/game/gel-softness.mjs?v=launch-26';
import {createContactSolver} from '../vendor/squish-attack/game/dense-contacts.mjs?v=dense-board-1';
import {configureRenderQuality} from '../vendor/squish-attack/game/render-quality-gel.mjs?v=foley-5';
import {installCleanScreen} from '../vendor/squish-attack/game/clean-screen.mjs?v=launch-26';
import {createFusion} from '../vendor/squish-attack/game/fusion-gel.mjs?v=fuse-6';

const P=PARAMETERS;
// Same press/drag/release/wobble springs as squish-graphics.js (Vh/Gh/Wh/bl),
// applied to our own bodies (the SDK only exposes them for its 5x5 tiles).
function press(s){const e=s.press;e.held=true;e.releaseQueued=false;e.age=0;e.compression=Math.max(.08,e.compression);e.velocity=0;e.hasSwipe=false;e.dragX=0;e.dragZ=0;e.inputX=0;e.inputZ=0;e.swipeVX=0;e.swipeVZ=0;}
function drag(s,x,z){const n=s.press;if(!n.held||Math.hypot(x,z)<.05&&!n.hasSwipe)return;const i=x-n.inputX,r=z-n.inputZ,o=Math.hypot(i,r);n.inputX=x;n.inputZ=z;if(o>.015){n.directionX=i/o;n.directionZ=r/o;}n.hasSwipe=true;const a=Math.min(P.motion.swipeGain,P.motion.swipeMaxOffset/Math.max(.001,Math.hypot(x,z)));n.dragX=x*a;n.dragZ=z*a;}
function release(s){if(s.press?.held)s.press.releaseQueued=true;}
function wobble(s,power=.25){s.amplitude=Math.max(s.amplitude,softWobblePower(power));}

let lightingApplied=false;
export function createBoard3D(host){
  if(!lightingApplied){
    applyNeonGlassLighting(P,HUD_PARAMETERS);applyGelSoftness(P,HUD_PARAMETERS);
    P.contactSolver=createContactSolver(P);
    // Top-down: clean-screen's fitStoneBoard tilts the reference camera up by
    // 13°, so a 77° reference elevation ends at exactly 90° (straight down).
    const el=THREE.MathUtils.degToRad(77),d=22;
    P.camera.position=[0,Math.sin(el)*d,Math.cos(el)*d];P.camera.target=[0,.1,0];
    lightingApplied=true;
  }
  const graphics=createSquishGraphics(host,{tiles:[],bindPointer:false,autoStart:false,alpha:true});
  graphics.camera.up.set(0,0,-1); // screen-up = far side of the table
  let dirty=true;
  function requestFrame({shadows=false}={}){dirty=true;if(shadows){if(graphics.quality?.invalidateShadows)graphics.quality.invalidateShadows();else graphics.renderer.shadowMap.needsUpdate=true;}}
  configureRenderQuality(graphics);
  const setSize=graphics.renderer.setSize.bind(graphics.renderer);
  graphics.renderer.setSize=(...a)=>{setSize(...a);requestFrame({shadows:true});};
  const setting=installCleanScreen(graphics,host); // HDR glass composite, as in launch-5
  const scene=graphics.scene,camera=graphics.camera;
  const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();
  const jobs=[];
  function ensureColor(v){if(v>8)P.colors[v]=HUD_PARAMETERS.colors[v]=P.colors[(v-1)%8+1];}
  const internals={THREE,PARAMETERS:P,HUD_PARAMETERS,setting,requestFrame,ensureColor,get onLand(){return null;},
    createHudMaterial,buildSquishy,createLabel,initializeMotion,bindGelOptics,softWobblePower,
    get paused(){return false;},get time(){return clock;},
    disposeGel,job(job){jobs.push(job);requestFrame();return job;},cancelJobs(){jobs.splice(0).forEach(j=>j.cancel?.());}};
  const fusion=createFusion({internals,graphics});
  // launch-5 graphics-adapter createHudMaterial: the original gel (optics + diffuse glow + neon bands + env map)
  function createHudMaterial(value,stretch=0){
    const optics=installGelOptics(createGelMaterial(value));
    if(stretch>0){
      const base=optics.onBeforeCompile,key=optics.customProgramCacheKey.bind(optics),tag=stretch.toFixed(4);
      optics.onBeforeCompile=function(shader,renderer){base.call(this,shader,renderer);
        shader.fragmentShader=shader.fragmentShader.replace('vec3 gelRest(vec3 p){','vec3 gelRest(vec3 p){p.x=sign(p.x)*max(abs(p.x)-'+tag+',0.0);');};
      optics.customProgramCacheKey=()=>key()+'|wide-'+tag;
    }
    const material=installNeonBands(applyDiffuseGelGlow(optics),value);
    material.envMap=scene.environment;material.envMapIntensity=P.gel.envMapIntensity;
    return material;
  }

  // ---------- board layout ----------
  let N=5,pitch=P.board.pitch,k=1,cells=[];
  const SPACING=1.0, BODY=.93; // body footprint relative to pitch (small glass gaps between squishes)
  function cellPos(r,c){return new THREE.Vector3((c-(N-1)/2)*pitch,P.board.floor,(r-(N-1)/2)*pitch);}
  function disposeGel(s){s.group.traverse(o=>{o.geometry?.dispose?.();for(const m of [].concat(o.material||[]))m.dispose?.();o.customDepthMaterial?.dispose?.();});scene.remove(s.group);}

  // glow halo on the glass under a glowing squish (soft additive disc)
  const haloTex=(()=>{const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');const g=x.createRadialGradient(64,64,0,64,64,64);
    g.addColorStop(0,'rgba(255,255,255,.62)');g.addColorStop(.46,'rgba(255,255,255,.5)');g.addColorStop(.6,'rgba(255,255,255,1)');g.addColorStop(.74,'rgba(255,255,255,.42)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,128,128);
    const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;})();
  const sparkTex=comicSparkTexture();
  // splat decal left on the glass by a popped squish (white, tinted per cell)
  const splatTex=(()=>{const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');x.fillStyle='#fff';
    let seed=7;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
    x.beginPath();for(let i=0;i<=24;i++){const a=i/24*Math.PI*2,r=34+rnd()*12+(i%3===0?10:0);const px=64+Math.cos(a)*r,py=64+Math.sin(a)*r;i?x.lineTo(px,py):x.moveTo(px,py);}x.closePath();x.fill();
    for(let i=0;i<9;i++){const a=rnd()*Math.PI*2,d=48+rnd()*12,rr=3+rnd()*5;x.beginPath();x.arc(64+Math.cos(a)*d,64+Math.sin(a)*d,rr,0,Math.PI*2);x.fill();}
    const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;})();
  const NAVY=new THREE.Color('#2a3156');
  const dull=(col,f)=>{const g=col.r*.3+col.g*.59+col.b*.11;return new THREE.Color(g,g,g).lerp(col,.35).lerp(NAVY,f);};
  const regionColor=v=>new THREE.Color(P.colors[v]||P.colors[(v-1)%8+1]);

  // A glowing squish becomes a gold gel cube (the yellow gel, value 6, which no region uses),
  // so it also lights the glass gold; the region colour comes back when it is switched off.
  const GLOW_VALUE=6;
  function setGel(cell,value){
    const s=cell.s;if(s.value===value&&s.body.material.userData.sdValue===value)return;
    const old=s.body.material;s.body.material=createHudMaterial(value);s.body.material.userData.sdValue=value;s.value=value;
    // glowing: the gold gel also shines from inside (emissive), so it reads as lit on the dark glass
    if(value===GLOW_VALUE){s.body.material.emissive.set('#ffb21a');s.body.material.emissiveIntensity=1.15;}
    bindGelOptics(s);s.label.visible=false;s.forceUpdate=true;old.dispose();requestFrame({shadows:true});
  }
  function build(level,colorOf){
    clear();
    N=level.N;pitch=P.board.pitch*5/N*SPACING;k=5/N*BODY/.96;
    for(let r=0;r<N;r++)for(let c=0;c<N;c++){
      const value=colorOf(level.regions[r].charCodeAt(c)-97);ensureColor(value);
      const s=buildSquishy(value,createHudMaterial(value));s.body.material.userData.sdValue=value;initializeMotion(s);bindGelOptics(s);
      s.label.visible=false; // SquishDoku squishes carry no digits (Sascha: cubes without numbers)
      s.group.name=`HUD_cell_${r}_${c}`;
      s.group.position.copy(cellPos(r,c));
      s.base=new THREE.Vector3(1.02*k,1.02*k/.92,1.02*k);s.group.scale.copy(s.base);
      s.phase=Math.random()*Math.PI*2;
      scene.add(s.group);setting.addHudShadow(s);
      const halo=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:haloTex,color:new THREE.Color('#ffae2b'),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,opacity:0}));
      halo.material.depthTest=false;halo.rotation.x=-Math.PI/2;halo.position.copy(cellPos(r,c));halo.position.y=P.board.floor+P.gel.height*1.6*k;halo.scale.setScalar(pitch*1.55);halo.renderOrder=8;halo.visible=false;scene.add(halo);
      const spark=new THREE.Sprite(new THREE.SpriteMaterial({map:sparkTex,color:0xffffff,transparent:true,depthTest:false,depthWrite:false,toneMapped:false}));
      spark.visible=false;spark.renderOrder=9;scene.add(spark);
      const splat=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:splatTex,color:dull(regionColor(value),.1),transparent:true,depthWrite:false,toneMapped:false,opacity:0}));
      splat.rotation.x=-Math.PI/2;splat.rotation.z=Math.random()*Math.PI*2;splat.position.copy(cellPos(r,c));splat.position.y=P.board.top+.015;splat.scale.setScalar(pitch*.98);splat.renderOrder=2;splat.visible=false;scene.add(splat);
      cells.push({r,c,value,s,halo,spark,splat,state:'normal',anim:null});
    }
    requestFrame({shadows:true});
  }
  function clear(){
    jobs.splice(0).forEach(j=>j.cancel?.());fusion.clear();
    for(const cell of cells){setting.removeHudShadow(cell.s);disposeGel(cell.s);scene.remove(cell.halo,cell.spark,cell.splat);cell.splat.geometry.dispose();cell.splat.material.dispose();cell.halo.geometry.dispose();cell.halo.material.dispose();cell.spark.material.dispose();}
    cells=[];requestFrame({shadows:true});
  }
  const cellAt=(r,c)=>cells[r*N+c];

  // ---------- picking / projection ----------
  function screenRay(x,y){const rc=graphics.renderer.domElement.getBoundingClientRect();pointer.set((x-rc.left)/rc.width*2-1,-(y-rc.top)/rc.height*2+1);ray.setFromCamera(pointer,camera);}
  const pickPlane=()=>new THREE.Plane(new THREE.Vector3(0,1,0),-(P.board.floor+P.gel.height*1.1*k));
  function pick(x,y){
    screenRay(x,y);const p=ray.ray.intersectPlane(pickPlane(),new THREE.Vector3());if(!p)return null;
    const c=Math.round(p.x/pitch+(N-1)/2),r=Math.round(p.z/pitch+(N-1)/2);
    if(r<0||c<0||r>=N||c>=N)return null;
    const local={x:p.x-(c-(N-1)/2)*pitch,z:p.z-(r-(N-1)/2)*pitch};
    return {r,c,local,world:p};
  }
  function worldOf(x,y){screenRay(x,y);return ray.ray.intersectPlane(pickPlane(),new THREE.Vector3());}
  function screenOf(r,c){
    const v=cellPos(r,c);v.y=P.board.floor+P.gel.height*1.2*k;v.project(camera);
    const rc=graphics.renderer.domElement.getBoundingClientRect();
    const v2=cellPos(r,c+1);v2.y=v.y;v2.project(camera);
    return {x:rc.left+(v.x+1)/2*rc.width,y:rc.top+(1-v.y)/2*rc.height,size:Math.abs(v2.x-v.x)/2*rc.width};
  }
  // screen rect of the chrome frame (outer edge) for the CSS glass plate under the canvas
  function frameRect(){
    const H=2*P.board.pitch+P.board.cavityHalf+.28+.12,rc=graphics.renderer.domElement.getBoundingClientRect();
    const pts=[[-H,-H],[H,H]].map(([x,z])=>{const v=new THREE.Vector3(x,P.board.top,z).project(camera);return [rc.left+(v.x+1)/2*rc.width,rc.top+(1-v.y)/2*rc.height];});
    return {left:pts[0][0],top:pts[0][1],width:pts[1][0]-pts[0][0],height:pts[1][1]-pts[0][1]};
  }
  function boardRect(){const a=screenOf(0,0),b=screenOf(N-1,N-1);const h=a.size*.6;return {left:a.x-h,top:a.y-h,width:b.x-a.x+2*h,height:b.y-a.y+2*h};}

  // ---------- animation helpers ----------
  let clock=0;
  function animate(cell,dur,fn,done){cell.anim={t0:clock,dur,fn,done};requestFrame();}
  const ease=t=>1-Math.pow(1-t,3);
  function setScale(cell,sx,sy){const b=cell.s.base;cell.s.group.scale.set(b.x*sx,b.y*sy,b.z*sx);}

  const api={
    graphics,fusion,get N(){return N;},get cells(){return cells;},
    build,clear,pick,worldOf,screenOf,boardRect,frameRect,cellAt,requestFrame,
    press(r,c){const cl=cellAt(r,c);if(cl.state==='popped')return;press(cl.s);requestFrame();},
    drag(r,c,x,z){const cl=cellAt(r,c);drag(cl.s,x/k,z/k);requestFrame();},
    release(r,c){const cl=cellAt(r,c);release(cl.s);requestFrame();},
    wobble(r,c,p=.5){const cl=cellAt(r,c);wobble(cl.s,p);requestFrame();},
    // finger brushes over a squish: the game's swipe reaction (press, lean along the stroke, spring back)
    brush(r,c,dx,dz){const cl=cellAt(r,c);if(cl.state==='popped')return;press(cl.s);drag(cl.s,dx,dz);setTimeout(()=>release(cl.s),90);requestFrame();},
    // wrong move: hard wobble plus a red flash ring around the cube
    wrong(r,c){const cl=cellAt(r,c);wobble(cl.s,.85);cl.s.press.held=false;
      const wasGlow=cl.state==='glow';cl.halo.material.color.set('#ff2a2a');cl.halo.visible=true;
      animate(cl,.65,t=>{cl.halo.material.opacity=.95*Math.sin(Math.min(1,t*1.2)*Math.PI);},()=>{cl.halo.material.color.set('#ffae2b');cl.halo.visible=cl.state==='glow';cl.halo.material.opacity=cl.state==='glow'?.95:0;});
      requestFrame();},
    // the game's comic balloon pop (fusion.popBody: torn skin, gel drops, burst flash), then a flat popped squish stays
    pop(r,c,{power=2.4,amount=1}={}){
      const cl=cellAt(r,c);if(cl.state==='popped')return false;
      cl.state='popped';cl.s.press.held=false;cl.s.press.releaseQueued=false;
      try{fusion.popBody(cl.s,{value:cl.value,power,amount});}catch(e){console.warn('pop',e);}
      // the gel bursts (debris from the body); what stays is a flat, dull splat on the glass
      cl.s.group.visible=false;setting.removeHudShadow(cl.s);
      cl.halo.visible=false;cl.spark.visible=false;
      cl.splat.visible=true;
      animate(cl,.32,t=>{const e=ease(t);cl.splat.material.opacity=.85*e;cl.splat.scale.setScalar(pitch*(.6+.38*e));},()=>{cl.splat.material.opacity=.85;});
      requestFrame({shadows:true});
      return true;
    },
    restore(r,c){
      const cl=cellAt(r,c);if(cl.state!=='popped')return;
      cl.state='normal';setGel(cl,cl.value);cl.s.group.visible=true;setting.addHudShadow(cl.s);setScale(cl,.3,.1);
      animate(cl,.28,t=>{const e=ease(t);setScale(cl,.3+.7*e,.1+.9*e);cl.splat.material.opacity=.85*(1-e);},()=>{setScale(cl,1,1);cl.splat.visible=false;wobble(cl.s,.6);});
    },
    glow(r,c,on){
      const cl=cellAt(r,c);
      if(on){cl.state='glow';setGel(cl,GLOW_VALUE);cl.halo.visible=true;cl.spark.visible=true;
        const top=cellPos(r,c);top.y=P.board.floor+P.gel.height*1.45*k;cl.spark.position.copy(top).add(new THREE.Vector3(-pitch*.22,0,-pitch*.22));
        animate(cl,.5,t=>{const e=ease(t);cl.halo.material.opacity=.95*e;const s=1+.18*Math.sin(t*Math.PI);setScale(cl,s,s);cl.spark.scale.setScalar(pitch*.55*(t<.5?t*2:1+.2*Math.sin((t-.5)*Math.PI*2)));cl.spark.material.rotation=t*2;},()=>{setScale(cl,1,1);cl.halo.material.opacity=.95;});
        wobble(cl.s,.5);
      }else{cl.state='normal';setGel(cl,cl.value);cl.halo.visible=false;cl.spark.visible=false;cl.halo.material.opacity=0;wobble(cl.s,.4);}
    },
    dispose(){clear();cancelAnimationFrame(raf);setting.dispose?.();graphics.dispose();},
    get stats(){return {frames,cells:cells.length,popped:cells.filter(c=>c.state==='popped').length};},
  };

  // ---------- render loop (same scheme as graphics-adapter: idle tables keep the last frame) ----------
  let last=null,raf=0,frames=0,renderedLast=false;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  function loop(now){
    raf=requestAnimationFrame(loop);
    try{
      const wall=last===null?0:(now-last)/1000;last=now;if(document.hidden)return;
      const dt=Math.min(P.motion.maximumFrameDelta,Math.max(0,wall));clock+=dt;
      for(let i=jobs.length-1;i>=0;i--)if(jobs[i].update(clock,dt))jobs.splice(i,1);
      let active=jobs.length>0;
      for(const cl of cells){
        if(cl.anim){const t=Math.min(1,(clock-cl.anim.t0)/cl.anim.dur);cl.anim.fn(t);if(t>=1){const d=cl.anim.done;cl.anim=null;d?.();}active=true;}
        const s=cl.s,p=s.press;
        const live=s.amplitude>.012||p.held||p.releaseQueued||p.compression!==0||p.velocity!==0||p.swipeX!==0||p.swipeZ!==0||s.forceUpdate;
        if(live||cl.anim){s.forceUpdate=false;updateSquishy(s,clock,dt,false);active=true;}
      }
      graphics.quality?.update?.(wall,now/1000,!active,renderedLast);
      if(active)dirty=true;
      renderedLast=dirty;
      if(dirty){graphics.render(dt);dirty=false;frames++;}
    }catch(e){console.warn('render loop',e);}
  }
  raf=requestAnimationFrame(loop);
  return api;
}
