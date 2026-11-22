// SquishDoku 3D board: Squish Attack's current comic gel squishes on the
// Squish Attack glass table, with Squish Attack's own tilted camera view. All rendering pieces
// are the unmodified Squish Attack modules in /vendor/squish-attack (copied
// from saschahoffmannsh-gif/squish-attack @ 9a61cc9, worktree launch-26);
// this file only arranges them for an N x N grid (modelled on the game's
// game/graphics-adapter.mjs).
// NOTE: import specifiers must match the vendor files' own specifiers
// (including ?v=…), otherwise ES modules would load twice.
import {createSquishGraphics,THREE,PARAMETERS} from '../vendor/squish-attack/squish/squish-graphics.js?v=play-sharp-1';
import {buildSquishy,createLabel,bindGelOptics,initializeMotion,updateSquishy,PARAMETERS as HUD_PARAMETERS} from '../vendor/squish-attack/game/original-gel-models.js?v=menu-1';
import {applyComic,comicBodyMaterial,comicColors,comicSparkTexture,INK} from '../vendor/squish-attack/game/comic-style.mjs?v=launch-26';
import {applyNeonGlassLighting} from '../vendor/squish-attack/game/gel-lighting.mjs?v=launch-26';
import {applyGelSoftness,softWobblePower} from '../vendor/squish-attack/game/gel-softness.mjs?v=launch-26';
import {createContactSolver} from '../vendor/squish-attack/game/dense-contacts.mjs?v=dense-board-1';
import {configureRenderQuality} from '../vendor/squish-attack/game/render-quality.mjs?v=launch-26';
import {installCleanScreen} from '../vendor/squish-attack/game/clean-screen.mjs?v=launch-26';
import {createFusion} from '../vendor/squish-attack/game/fusion.mjs?v=launch-26';
import {makeCookie,createCrumbs,warmSet,cutSlot,releaseSlot,COOKIE_TOP} from './cookies3d.mjs';

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
    // SquishDoku squishes carry no digits: the stock label factory builds and re-curves a subdivided
    // 3D text mesh per squish (by far the slowest part of a level build, and its vertices were deformed
    // every animated frame although hidden). An invisible one-triangle stand-in keeps the interface.
    HUD_PARAMETERS.labelFactory=()=>{
      const g=new THREE.BufferGeometry();
      g.setAttribute('position',new THREE.Float32BufferAttribute([0,.01,0,0,.01,0,0,.01,0],3));
      g.setAttribute('normal',new THREE.Float32BufferAttribute([0,1,0,0,1,0,0,1,0],3));
      const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({visible:false,transparent:true}));
      m.userData.rest=g.attributes.position.array.slice();m.name='Editable_number';m.castShadow=false;m.visible=false;return m;
    };
    // Camera: Squish Attack's own view (PARAMETERS.camera + clean-screen's fitStoneBoard), unchanged.
    lightingApplied=true;
  }
  const graphics=createSquishGraphics(host,{tiles:[],bindPointer:false,autoStart:false,alpha:true});
  graphics.bloom.enabled=false;
  let dirty=true;
  function requestFrame({shadows=false}={}){dirty=true;if(shadows){if(graphics.quality?.invalidateShadows)graphics.quality.invalidateShadows();else graphics.renderer.shadowMap.needsUpdate=true;}}
  configureRenderQuality(graphics);
  const setSize=graphics.renderer.setSize.bind(graphics.renderer);
  graphics.renderer.setSize=(...a)=>{setSize(...a);requestFrame({shadows:true});};
  const setting=installCleanScreen(graphics,host,{direct:true});
  const scene=graphics.scene,camera=graphics.camera;
  // installCleanScreen re-fits the camera from its own ResizeObserver; this one is created after it,
  // so it runs after the re-fit and redraws: the on-demand renderer would otherwise keep showing the
  // old picture while touches already map through the new camera.
  const refit=new ResizeObserver(()=>requestFrame({shadows:true}));refit.observe(host);if(host.parentElement?.querySelector(':scope > .board-slot'))refit.observe(host.parentElement.querySelector(':scope > .board-slot'));
  const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();
  const jobs=[];
  function ensureColor(v){if(v===9){P.colors[9]=HUD_PARAMETERS.colors[9]='#e9edf5';return;} /* white gel (8 regions) */if(v>8)P.colors[v]=HUD_PARAMETERS.colors[v]=P.colors[(v-1)%8+1];}
  const internals={THREE,PARAMETERS:P,HUD_PARAMETERS,setting,requestFrame,ensureColor,get onLand(){return null;},
    createHudMaterial:(value,stretch,options={})=>comicBodyMaterial(value,null,options),buildSquishy,createLabel,initializeMotion,bindGelOptics,softWobblePower,
    get paused(){return false;},get time(){return clock;},
    disposeGel,job(job){jobs.push(job);requestFrame();return job;},cancelJobs(){jobs.splice(0).forEach(j=>j.cancel?.());}};
  const fusion=createFusion({internals,graphics});
  const crumbs=createCrumbs(scene,camera);
  // crumbs slide on the plane the cookies lie on; it fills the whole screen (Sascha), so it has no edge:
  // they trickle downhill until they leave the bottom of the screen and are recycled
  crumbs.setPlate({y:P.board.top+.005,hx:1e6,hz:1e6}); // pooled crumb particles of popped cookies (in the scene from the start: linked by the prewarm)

  // ---------- board layout ----------
  let N=5,pitch=P.board.pitch,k=1,cells=[],size=1,Y0=P.board.top-.02,HU=.3;
  // cookies: Y0 = underside on the glass, HU = height unit (lift 1.2 = cookie top, like the old gel height)
  const SPACING=1.03, BODY=.93; // body footprint relative to pitch (small glass gaps between squishes)
  function cellPos(r,c){return new THREE.Vector3((c-(N-1)/2)*pitch,P.board.floor,(r-(N-1)/2)*pitch);}
  function disposeGel(s){s.group.traverse(o=>{o.geometry?.dispose?.();for(const m of [].concat(o.material||[]))m.dispose?.();o.customDepthMaterial?.dispose?.();});scene.remove(s.group);}

  // glow halo on the glass under a glowing squish (soft additive disc)
  const haloTex=(()=>{const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');const g=x.createRadialGradient(64,64,0,64,64,64);
    g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(.46,'rgba(255,255,255,.04)');g.addColorStop(.6,'rgba(255,255,255,1)');g.addColorStop(.74,'rgba(255,255,255,.42)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,128,128);
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

  const GOLD=new THREE.Color('#ffd23f'),WARM_HI=new THREE.Color('#ff9800'),WARM_LO=new THREE.Color('#c24a06');
  // shared per-animal material variants (normal / golden lit / red wrong): a swap, no per-cell materials
  function setBodyTone(cell,mode){cell.s.ck.tone(mode==='popped'?'normal':mode);requestFrame();}
  // cookie motion: press squash, lean along the finger, spring back with a little wobble (replaces the gel solver)
  const CRUMBLE_T=.55; // s for the crumble edge to cross a cookie
  function endCrumble(cl){const sl=cl.dissolve;if(!sl)return;cl.dissolve=null;releaseSlot(sl);const ck=cl.s.ck;ck.inner.visible=false;ck.body.castShadow=true;ck.tone('normal');requestFrame({shadows:true});}
  // a crumbled cookie has nothing left to wobble: stop its springs so idle frames end with the crumble
  function calm(s){const p=s.press,t=s.tilt;s.amplitude=0;p.held=p.releaseQueued=false;p.compression=p.velocity=0;t.x=t.z=t.vx=t.vz=0;s.ck.inner.scale.set(1,1,1);s.ck.inner.rotation.set(0,0,0);}
  function cookieLive(s){const p=s.press,t=s.tilt;return s.amplitude>.02||p.held||p.releaseQueued||p.compression!==0||p.velocity!==0||t.x!==0||t.z!==0||t.vx!==0||t.vz!==0;}
  function updateCookie(s,dt){
    const p=s.press,t=s.tilt;dt=Math.min(dt,1/30);
    if(p.releaseQueued){p.held=false;p.releaseQueued=false;p.velocity-=1.4;s.amplitude=Math.max(s.amplitude,.3);}
    const target=p.held?.11:0,K=p.held?320:210,C=p.held?30:10;
    p.velocity+=(K*(target-p.compression)-C*p.velocity)*dt;p.compression+=p.velocity*dt;
    if(!p.held&&Math.abs(p.compression)<.002&&Math.abs(p.velocity)<.02){p.compression=0;p.velocity=0;}
    const lim=.28,tx=p.held?Math.max(-lim,Math.min(lim,p.dragZ*.45)):0,tz=p.held?Math.max(-lim,Math.min(lim,-p.dragX*.45)):0;
    t.vx+=(170*(tx-t.x)-11*t.vx)*dt;t.vz+=(170*(tz-t.z)-11*t.vz)*dt;t.x+=t.vx*dt;t.z+=t.vz*dt;
    if(!p.held&&Math.abs(t.x)+Math.abs(t.z)<.002&&Math.abs(t.vx)+Math.abs(t.vz)<.02){t.x=t.z=t.vx=t.vz=0;}
    s.wt+=dt;s.amplitude=s.amplitude>.02?Math.min(1,s.amplitude)*Math.exp(-dt*6):0;
    const w=s.amplitude*.09*Math.sin(s.wt*21),c=p.compression;
    s.ck.inner.scale.set(1+c*.45+w*.6,Math.max(.5,1-c-w),1+c*.45+w*.6);
    s.ck.inner.rotation.set(t.x+s.amplitude*.05*Math.sin(s.wt*17),0,t.z+s.amplitude*.05*Math.cos(s.wt*15));
  }

  function build(level,colorOf){
    const old=clear(true);
    N=level.N;pitch=P.board.pitch*5/N*SPACING;k=5/N*BODY/.96;size=pitch*.5;HU=COOKIE_TOP*size/1.2;
    for(let r=0;r<N;r++)for(let c=0;c<N;c++){
      const value=colorOf(level.regions[r].charCodeAt(c)-97);ensureColor(value);
      // set F cookie of the region's animal (shared geometry/materials); `s` keeps the squish interface
      const ck=makeCookie(value);
      const s={ck,group:ck.group,body:ck.body,value,amplitude:0,wt:Math.random()*9,forceUpdate:false,label:{visible:false},tilt:{x:0,z:0,vx:0,vz:0},
        press:{held:false,releaseQueued:false,age:0,compression:0,velocity:0,hasSwipe:false,dragX:0,dragZ:0,inputX:0,inputZ:0,swipeVX:0,swipeVZ:0,swipeX:0,swipeZ:0,directionX:0,directionZ:0}};
      s.group.name=`HUD_cell_${r}_${c}`;
      s.group.position.copy(cellPos(r,c));s.group.position.y=Y0;s.group.rotation.y=(Math.random()-.5)*.22;
      s.base=new THREE.Vector3(size,size,size);s.group.scale.copy(s.base);
      scene.add(s.group);
      const halo=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:haloTex,color:new THREE.Color('#ffae2b'),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,opacity:0}));
      halo.material.depthTest=false;halo.rotation.x=-Math.PI/2;halo.position.copy(cellPos(r,c));halo.position.y=Y0+HU*1.3;halo.scale.setScalar(pitch*1.55);halo.renderOrder=8;halo.visible=false;scene.add(halo);
      const spark=new THREE.Sprite(new THREE.SpriteMaterial({map:sparkTex,color:0xffffff,transparent:true,depthTest:false,depthWrite:false,toneMapped:false}));
      spark.visible=false;spark.renderOrder=9;scene.add(spark);
      const splat=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:splatTex,color:dull(comicColors(value).mid,.15),transparent:true,depthWrite:false,toneMapped:false,opacity:0}));
      splat.rotation.x=-Math.PI/2;splat.rotation.z=Math.random()*Math.PI*2;splat.position.copy(cellPos(r,c));splat.position.y=P.board.top+.015;splat.scale.setScalar(pitch*.98);splat.renderOrder=2;splat.visible=false;scene.add(splat);
      cells.push({r,c,value,s,halo,spark,splat,state:'normal',anim:null});
    }
    prewarm();
    disposeCells(old);
    requestFrame({shadows:true});
  }
  // Same pre-warm as Squish Attack's graphics-adapter entry: link the squish, glow, splat and
  // pop (fusion skin/drop/flash) programs at level load so the first glow or pop does not hitch.
  // The warm holder (tiny, 80 units under the table) stays in the scene: disposing it would free the
  // pop programs again (three.js releases a program with its last material), and the first real pop would relink.
  let warmOn=false;const warmed=new Set(); // animals whose looks are linked already (materials are shared and never freed)
  function prewarm(){
    const glowOn=cells.length?cells[0]:null;
    if(glowOn){glowOn.halo.visible=glowOn.spark.visible=glowOn.splat.visible=true;}
    // a hidden set of every cookie look (lit, wrong, crumbled) of this level's animals: links the
    // programs and uploads the textures now; the materials are shared and kept, so it can go again.
    let warm=null;
    const fresh=[...new Set(cells.map(c=>c.value))].filter(v=>!warmed.has(v));
    try{if(fresh.length){warm=warmSet(fresh);fresh.forEach(v=>warmed.add(v));scene.add(warm);}graphics.renderer.compile(scene,camera);graphics.render(0);}catch(e){console.warn('prewarm',e);}
    finally{if(warm)scene.remove(warm);if(glowOn){glowOn.halo.visible=glowOn.spark.visible=glowOn.splat.visible=false;}}
  }
  function disposeCells(list){
    for(const cell of list){scene.remove(cell.s.group);scene.remove(cell.halo,cell.spark,cell.splat);cell.splat.geometry.dispose();cell.splat.material.dispose();cell.halo.geometry.dispose();cell.halo.material.dispose();cell.spark.material.dispose();}
  }
  // keep=true: detach the old cells but free them only after the new level is built and compiled.
  // three.js releases a shader program with its last material, so disposing first made every
  // level start relink all squish/glow/splat programs (the bulk of a level start on a phone).
  function clear(keep=false){
    jobs.splice(0).forEach(j=>j.cancel?.());fusion.clear();crumbs.clear();
    for(const cl of cells)if(cl.dissolve){cl.anim=null;endCrumble(cl);}
    const old=cells;cells=[];
    if(keep){for(const cell of old){cell.s.group.visible=cell.halo.visible=cell.spark.visible=cell.splat.visible=false;}}
    else disposeCells(old);
    requestFrame({shadows:true});
    return old;
  }
  const cellAt=(r,c)=>cells[r*N+c];

  // ---------- picking / projection ----------
  // The canvas rect is read fresh on every call (no cached rect), so rules bar folding, the tutorial
  // bubble or an iOS viewport change can never shift the touch mapping.
  function screenRay(x,y){const rc=graphics.renderer.domElement.getBoundingClientRect();pointer.set((x-rc.left)/rc.width*2-1,-(y-rc.top)/rc.height*2+1);ray.setFromCamera(pointer,camera);}
  const pickPlane=()=>new THREE.Plane(new THREE.Vector3(0,1,0),-(Y0+HU*1.1));
  const glassPlane=()=>new THREE.Plane(new THREE.Vector3(0,1,0),-P.board.top);
  const cellOfPoint=p=>{if(!p)return null;const c=Math.round(p.x/pitch+(N-1)/2),r=Math.round(p.z/pitch+(N-1)/2);return r<0||c<0||r>=N||c>=N?null:cellAt(r,c);};
  const _hits=[],_box=new THREE.Box3(),_size=new THREE.Vector3(),_hp=new THREE.Vector3();
  // Which squish body is visible under the finger? With the tilted camera a squish shows its top and
  // its front side; a plane at squish-top height mapped the lower ~third of every squish to the row
  // below. So: raycast the squish bodies (nearest wins), then their ink outline (a slightly inflated
  // box), and only where no squish is drawn fall back to the cell footprint on the glass.
  function bodyUnderRay(){
    let best=null,bd=Infinity;
    for(const cl of cells){
      if(cl.state==='popped'||!cl.s.group.visible)continue;
      _hits.length=0;cl.s.body.raycast(ray,_hits);
      for(const h of _hits)if(h.distance<bd){bd=h.distance;best=cl;}
    }
    if(best)return best;
    for(const cl of cells){
      if(cl.state==='popped'||!cl.s.group.visible)continue;
      const g=cl.s.body.geometry;if(!g.boundingBox)g.computeBoundingBox();
      _box.copy(g.boundingBox);_box.getSize(_size);_box.expandByVector(_size.multiplyScalar(.035)).applyMatrix4(cl.s.body.matrixWorld);
      const p=ray.ray.intersectBox(_box,_hp);if(p){const d=p.distanceTo(ray.ray.origin);if(d<bd){bd=d;best=cl;}}
    }
    return best;
  }
  function pick(x,y){
    screenRay(x,y);
    const top=ray.ray.intersectPlane(pickPlane(),new THREE.Vector3());
    const cl=bodyUnderRay()||cellOfPoint(ray.ray.intersectPlane(glassPlane(),new THREE.Vector3()));
    if(!cl)return null;
    const {r,c}=cl,p=top||cellPos(r,c);
    return {r,c,local:{x:p.x-(c-(N-1)/2)*pitch,z:p.z-(r-(N-1)/2)*pitch},world:p};
  }
  function worldOf(x,y){screenRay(x,y);return ray.ray.intersectPlane(pickPlane(),new THREE.Vector3());}
  // lift: height in squish heights (1.2 = top); dz: offset toward the camera in cell pitches
  function screenOf(r,c,lift=1.2,dz=0){
    const v=cellPos(r,c);v.y=Y0+HU*lift;v.z+=dz*pitch;v.project(camera);
    const rc=graphics.renderer.domElement.getBoundingClientRect();
    const v2=cellPos(r,c+1);v2.y=Y0+HU*lift;v2.z+=dz*pitch;v2.project(camera);
    return {x:rc.left+(v.x+1)/2*rc.width,y:rc.top+(1-v.y)/2*rc.height,size:Math.abs(v2.x-v.x)/2*rc.width};
  }
  // screen rect of the chrome frame (outer edge) for the CSS glass plate under the canvas
  function frameRect(){
    const H=2*P.board.pitch+P.board.cavityHalf+.28+.12,rc=graphics.renderer.domElement.getBoundingClientRect();
    const pts=[[-H,-H],[H,-H],[-H,H],[H,H]].map(([x,z])=>{const v=new THREE.Vector3(x,P.board.top,z).project(camera);return [rc.left+(v.x+1)/2*rc.width,rc.top+(1-v.y)/2*rc.height];});
    const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]),l=Math.min(...xs),t=Math.min(...ys);
    return {left:l,top:t,width:Math.max(...xs)-l,height:Math.max(...ys)-t};
  }
  function boardRect(){const a=screenOf(0,0),b=screenOf(N-1,N-1);const h=a.size*.6;return {left:a.x-h,top:a.y-h,width:b.x-a.x+2*h,height:b.y-a.y+2*h};}

  // ---------- animation helpers ----------
  let clock=0;
  function animate(cell,dur,fn,done){cell.anim={t0:clock,dur,fn,done};requestFrame();}
  const ease=t=>1-Math.pow(1-t,3);
  function setScale(cell,sx,sy){const b=cell.s.base;cell.s.group.scale.set(b.x*sx,b.y*sy,b.z*sx);}

  // pop sequence timing (seconds) and shape
  const POP_GAP=.11;let lastBoom=-1,popIndex=0; // min. spacing between two BOOMs in a swipe (s)
  const SEQ={squash:.09,spring:.08,wobble:.15,swell:.1,flat:.42,bulge:.2,overshoot:.12,amount:.2};
  const backOut=t=>{const c=1.9;return 1+(c+1)*Math.pow(t-1,3)+c*Math.pow(t-1,2);};
  function squashSequence(cl,withSwell,done){
    const s=cl.s;s.press.held=false;s.press.releaseQueued=false;
    const a=SEQ.squash,b=a+SEQ.spring,w=b+SEQ.wobble,T=w+(withSwell?SEQ.swell:0);
    let wobbled=false;
    animate(cl,T,t=>{
      const x=t*T;
      if(x<a){const e=Math.sin(x/a*Math.PI/2);setScale(cl,1+SEQ.bulge*e,1-SEQ.flat*e);}
      else if(x<b){const e=backOut((x-a)/SEQ.spring);setScale(cl,1+SEQ.bulge*(1-e),1-SEQ.flat*(1-e));}
      else if(x<w){if(!wobbled){wobbled=true;setScale(cl,1,1);wobble(s,1);}}
      else{const e=1-Math.pow(1-(x-w)/SEQ.swell,2);setScale(cl,1+SEQ.amount*e,1+SEQ.amount*1.2*e);}
    },done);
  }
  const api={
    graphics,fusion,crumbs,SEQ,get N(){return N;},get cells(){return cells;},
    build,clear,pick,worldOf,screenOf,boardRect,frameRect,cellAt,requestFrame,
    press(r,c){const cl=cellAt(r,c);if(cl.state==='popped')return;press(cl.s);requestFrame();},
    drag(r,c,x,z){const cl=cellAt(r,c);drag(cl.s,x/k,z/k);requestFrame();},
    release(r,c){const cl=cellAt(r,c);release(cl.s);requestFrame();},
    wobble(r,c,p=.5){const cl=cellAt(r,c);wobble(cl.s,p);requestFrame();},
    // finger brushes over a squish: the game's swipe reaction (press, lean along the stroke, spring back)
    brush(r,c,dx,dz){const cl=cellAt(r,c);if(cl.state==='popped')return;press(cl.s);drag(cl.s,dx,dz);setTimeout(()=>release(cl.s),90);requestFrame();},
    wrong(r,c){const cl=cellAt(r,c);setBodyTone(cl,'wrong');squashSequence(cl,false,()=>{setScale(cl,1,1);if(cl.state!=='popped')setBodyTone(cl,cl.state==='glow'?'glow':'normal');});requestFrame();},
    // the game's comic balloon pop (fusion.popBody: torn skin, gel drops, burst flash), then a flat popped squish stays
    pop(r,c,{power=2.4,amount=1}={}){
      const cl=cellAt(r,c);if(cl.state==='popped')return false;
      cl.state='popped';cl.s.press.held=false;cl.s.press.releaseQueued=false;
      setBodyTone(cl,'popped');cl.s.value=cl.value;
      cl.halo.visible=false;cl.spark.visible=false;
      // the cookie crumbles away from the top (far side) down to the bottom edge: a clip edge moves over it
      // and sheds crumbs along the way, which trickle down out of the screen; then the cell is empty glass
      const ck=cl.s.ck,amt=Math.max(.6,Math.min(1.4,amount||1)),slot=cutSlot();calm(cl.s);setScale(cl,1,1);
      if(!slot){try{crumbs.emit(ck,{amount:amt});}catch(e){console.warn('crumbs',e);}ck.inner.visible=false;requestFrame({shadows:true});return true;}
      slot.print.map=ck.K.map;ck.body.material=slot.dough;ck.print.material=slot.print;ck.body.castShadow=false;cl.dissolve=slot;
      const bb=ck.K.bodyGeo.boundingBox,z0=bb.min.z-.02,z1=bb.max.z+.02;let prev=z0;
      slot.dough.userData.cut.value=slot.print.userData.cut.value=z0;requestFrame({shadows:true});
      animate(cl,CRUMBLE_T,t=>{const z=z0+(z1-z0)*t;slot.dough.userData.cut.value=slot.print.userData.cut.value=z;
        try{crumbs.emit(ck,{amount:amt*(z-prev)/(z1-z0),z0:prev,z1:z});}catch(e){}prev=z;},()=>endCrumble(cl));
      return true;
    },
    // Tap/swipe pop (Sascha's sequence): 1 squash flat under the finger, 2 spring back up with a
    // little overshoot, 3 visible wobble (Squish Attack's wobble spring), 4 swell, 5 the real pop.
    // Each squish runs its own clock-driven sequence (no timers), so a swipe overlaps several naturally.
    popSequence(r,c,{onPop,power,amount}={}){
      const cl=cellAt(r,c);if(cl.state==='popped'||cl.state==='popping')return false;
      cl.state='popping';
      // squash/spring/wobble start at once under the finger; the inflate + BOOM waits for its slot so
      // a swipe over several squishes pops them one after another (Sascha: hear several pops, not one bang)
      squashSequence(cl,false,()=>{
        if(cl.state!=='popping')return;
        const boomAt=Math.max(clock+SEQ.swell,lastBoom+POP_GAP);lastBoom=boomAt;
        const swell=()=>animate(cl,SEQ.swell,t=>{const e=1-Math.pow(1-t,2);setScale(cl,1+SEQ.amount*e,1+SEQ.amount*1.2*e);},()=>{
          if(cl.state!=='popping')return;cl.state='normal';api.pop(r,c,{power,amount});onPop?.(popIndex++);});
        const wait=boomAt-SEQ.swell-clock;
        if(wait>.004)animate(cl,wait,t=>{const j=.012*Math.sin(t*wait*40);setScale(cl,1+j,1-j);},()=>{if(cl.state==='popping')swell();});else swell();
      });
      return true;
    },
    // start state "already popped" (tutorial): empty glass without the burst
    vanish(r,c){const cl=cellAt(r,c);if(cl.dissolve){cl.anim=null;endCrumble(cl);}cl.state='popped';setBodyTone(cl,'popped');cl.halo.visible=false;cl.spark.visible=false;cl.anim=null;const ck=cl.s.ck;calm(cl.s);ck.inner.visible=false;setScale(cl,1,1);requestFrame({shadows:true});},
    restore(r,c){
      const cl=cellAt(r,c);
      if(cl.state==='popping'){cl.anim=null;cl.state='normal';setScale(cl,1,1);wobble(cl.s,.4);requestFrame();return;}
      if(cl.state!=='popped')return;
      if(cl.dissolve){cl.anim=null;endCrumble(cl);}
      cl.state='normal';setBodyTone(cl,'normal');cl.s.value=cl.value;cl.anim=null;cl.s.ck.inner.visible=true;cl.s.group.visible=true;setScale(cl,.25,.25);
      animate(cl,.3,t=>{const e=backOut(t);setScale(cl,.25+.75*e,.25+.75*e);},()=>{setScale(cl,1,1);wobble(cl.s,.6);});requestFrame({shadows:true});
    },
    glow(r,c,on){
      const cl=cellAt(r,c);
      if(on){cl.state='glow';setBodyTone(cl,'glow');cl.s.value=6; /* glass reflection/contact glow under it: gold, never the old region colour */requestFrame({shadows:true});cl.halo.visible=true;cl.spark.visible=true;
        const top=cellPos(r,c);top.y=Y0+HU*1.45;cl.spark.position.copy(top).add(new THREE.Vector3(-pitch*.22,0,-pitch*.22));
        animate(cl,.5,t=>{const e=ease(t);cl.halo.material.opacity=.95*e;const s=1+.18*Math.sin(t*Math.PI);setScale(cl,s,s);cl.spark.scale.setScalar(pitch*.55*(t<.5?t*2:1+.2*Math.sin((t-.5)*Math.PI*2)));cl.spark.material.rotation=t*2;},()=>{setScale(cl,1,1);cl.halo.material.opacity=.95;});
        wobble(cl.s,.5);
      }else{cl.state='normal';setBodyTone(cl,'normal');cl.s.value=cl.value;requestFrame({shadows:true});cl.halo.visible=false;cl.spark.visible=false;cl.halo.material.opacity=0;wobble(cl.s,.4);}
    },
    refresh(){requestFrame({shadows:true});},
    dispose(){clear();refit.disconnect();cancelAnimationFrame(raf);setting.dispose?.();graphics.dispose();},
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
      if(crumbs.alive){crumbs.update(dt);active=true;}
      for(const cl of cells){
        if(cl.anim){const t=Math.min(1,(clock-cl.anim.t0)/cl.anim.dur);cl.anim.fn(t);if(t>=1){const d=cl.anim.done;cl.anim=null;d?.();}active=true;}
        const s=cl.s;
        if(cookieLive(s)||s.forceUpdate){s.forceUpdate=false;updateCookie(s,dt);active=true;}
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
