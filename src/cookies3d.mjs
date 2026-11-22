// SquishDoku cookie pieces (set F, approved by Sascha): a real 3D shortbread body cut in the animal's
// silhouette (baked rim, rounded edge, crumb texture) with the Pixar-style animal printed flat on top.
// Everything heavy is shared: one body/print geometry and one material set per animal, colour swatch
// list per animal for its crumbs (built once), shared lit/"wrong" material variants. Textures are small WebPs that
// start loading when this module is imported; `cookiesReady` resolves when all are decoded.
import {THREE} from '../vendor/squish-attack/squish/squish-graphics.js?v=play-sharp-1';

// game region value → animal art (yellow 6 is the glow colour, never a region)
export const ANIMAL={1:'pinguin',2:'fuchs',3:'frosch',4:'loewe',5:'eule',7:'schwein',8:'katze',9:'hase'};
const NAMES=[...new Set(Object.values(ANIMAL))];
export const animalOf=v=>ANIMAL[v]||ANIMAL[(v-1)%8+1]||'pinguin';
const BASE=new URL('./cookies/',import.meta.url),V='?v=f1';
const IMG={};let OUT=null;
const loadImg=n=>new Promise((res,rej)=>{const i=new Image();i.decoding='async';i.onload=()=>(i.decode?i.decode().catch(()=>{}):Promise.resolve()).then(()=>res(i));i.onerror=rej;i.src=new URL(n+'.webp'+V,BASE).href;});
export const cookiesReady=Promise.all([
  fetch(new URL('outlines.json'+V,BASE)).then(r=>r.json()).then(o=>{OUT=o;}),
  ...['dough','dough-bump',...NAMES].map(n=>loadImg(n).then(i=>{IMG[n]=i;})),
]).then(()=>true);

// ---------- small helpers ----------
function hash3(x,y,z){let h=(x*374761393+y*668265263+z*2147483647)|0;h=(h^(h>>>13))*1274126177|0;return((h^(h>>>16))>>>0)/4294967295;}
function vnoise(x,y,z){const xi=Math.floor(x),yi=Math.floor(y),zi=Math.floor(z),xf=x-xi,yf=y-yi,zf=z-zi,s=t=>t*t*(3-2*t),u=s(xf),v=s(yf),w=s(zf),L=(a,b,t)=>a+(b-a)*t,h=(i,j,k)=>hash3(xi+i,yi+j,zi+k);
  return L(L(L(h(0,0,0),h(1,0,0),u),L(h(0,1,0),h(1,1,0),u),v),L(L(h(0,0,1),h(1,0,1),u),L(h(0,1,1),h(1,1,1),u),v),w)*2-1;}
const fbm=(x,y,z,o=3)=>{let a=0,f=1,m=.5;for(let i=0;i<o;i++){a+=m*vnoise(x*f,y*f,z*f);f*=2.03;m*=.5;}return a;};
// lifts saturation in the shader (the game's glass-table tone mapping washes colours out)
function saturate(m,k){m.onBeforeCompile=sh=>{sh.fragmentShader=sh.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
  diffuseColor.rgb=max(mix(vec3(dot(diffuseColor.rgb,vec3(.299,.587,.114))),diffuseColor.rgb,${k.toFixed(2)}),0.);`);};m.customProgramCacheKey=()=>'sat'+k;}
function tex(img,{srgb=true,repeat=1}={}){const t=new THREE.Texture(img);if(srgb)t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;if(repeat!==1){t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(repeat,repeat);}t.needsUpdate=true;return t;}
const shapeFrom=pts=>{const s=new THREE.Shape();pts.forEach(([x,y],i)=>i?s.lineTo(x,y):s.moveTo(x,y));s.closePath();return s;};
function body(shape,depth,bevel,seg,seed){
  const g=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelThickness:bevel,bevelSize:bevel*.9,bevelSegments:seg,curveSegments:1,steps:1});
  g.rotateX(-Math.PI/2);g.translate(0,bevel,0);
  const p=g.attributes.position;let R=0,Y=0;
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),n=fbm(x*3.1+seed,y*3.1,z*3.1),f=fbm(x*14,y*14+seed,z*14,2),r=Math.hypot(x,z)||1,k=.018*(n*.8+f*.35);p.setXYZ(i,x+x/r*k,y+k*.4,z+z/r*k);}
  for(let i=0;i<p.count;i++){R=Math.max(R,Math.hypot(p.getX(i),p.getZ(i)));Y=Math.max(Y,p.getY(i));}
  // golden-brown baking: darker toward the rim and the underside
  const col=new Float32Array(p.count*3),pale=new THREE.Color('#fff2de'),gold=new THREE.Color('#e0a35a'),brown=new THREE.Color('#9a5a26'),c=new THREE.Color();
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),r=Math.hypot(x,z)/R,n=fbm(x*2.3,y*2.3,z*2.3);
    const t=Math.min(1,Math.max(0,(Math.min(1,Math.max(0,(r-.72)/.28))*.65+(1-y/Y)*.55+n*.25)*1.1));
    c.copy(pale).lerp(gold,Math.min(1,t*1.6));if(t>.6)c.lerp(brown,(t-.6)/.4*.8);col[i*3]=c.r;col[i*3+1]=c.g;col[i*3+2]=c.b;}
  g.setAttribute('color',new THREE.BufferAttribute(col,3));g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();return g;
}

// ---------- per-animal kit ----------
export const COOKIE={depth:.2,bevel:.07};export const COOKIE_TOP=COOKIE.depth+2*COOKIE.bevel; // in cookie units (radius ≈ 1)
const KIT={};let SHARED=null;
function shared(){
  if(SHARED)return SHARED;
  const map=tex(IMG.dough,{repeat:.55}),bump=tex(IMG['dough-bump'],{srgb:false,repeat:.55});
  const dough=new THREE.MeshStandardMaterial({map,bumpMap:bump,bumpScale:2,roughness:.82,vertexColors:true});saturate(dough,1.05);
  const doughLit=dough.clone();doughLit.emissive=new THREE.Color('#ff9d2a');doughLit.emissiveIntensity=.16;saturate(doughLit,1.05);
  const crumb=new THREE.MeshStandardMaterial({color:'#d9a15c',map,bumpMap:bump,bumpScale:3,roughness:.9});
  const cg=new THREE.IcosahedronGeometry(1,0),p=cg.attributes.position;
  for(let i=0;i<p.count;i++){const f=1+.3*fbm(p.getX(i)*2,p.getY(i)*2,p.getZ(i)*2,2);p.setXYZ(i,p.getX(i)*f,p.getY(i)*f*.7,p.getZ(i)*f);}cg.computeVertexNormals();
  const pb=bump.clone();pb.repeat.set(2.2,2.2);
  return SHARED={dough,doughLit,crumb,crumbGeo:cg,printBump:pb};
}
export function kit(v){
  const name=animalOf(v);if(KIT[name])return KIT[name];
  if(!OUT)throw new Error('cookies not loaded');
  const S=shared(),pts0=OUT[name],xs=pts0.map(p=>p[0]),ys=pts0.map(p=>p[1]);
  const cx=(Math.min(...xs)+Math.max(...xs))/2,cy=(Math.min(...ys)+Math.max(...ys))/2,R=Math.max(...pts0.map(([x,y])=>Math.hypot(x-cx,y-cy))),sc=Math.min(1.12,.97/R);
  const pts=pts0.map(([x,y])=>[(x-cx)*sc,(y-cy)*sc]),seed=NAMES.indexOf(name)+1;
  const bodyGeo=body(shapeFrom(pts),COOKIE.depth,COOKIE.bevel,3,seed);
  const printGeo=new THREE.PlaneGeometry(2*sc,2*sc);printGeo.rotateX(-Math.PI/2);printGeo.translate(-cx*sc,COOKIE_TOP+.003,cy*sc);
  const map=tex(IMG[name]);
  const print=new THREE.MeshStandardMaterial({map,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,roughness:.5,bumpMap:S.printBump,bumpScale:.5});saturate(print,1.3);
  const printLit=print.clone();printLit.color=new THREE.Color('#ffe7a0');printLit.emissive=new THREE.Color('#ffae3a');printLit.emissiveMap=map;printLit.emissiveIntensity=.42;saturate(printLit,1.3);
  const printWrong=print.clone();printWrong.color=new THREE.Color('#ffb0b0');printWrong.emissive=new THREE.Color('#ff2a2a');printWrong.emissiveMap=map;printWrong.emissiveIntensity=.35;saturate(printWrong,1.3);
  return KIT[name]={name,pts,uv:{cx,cy,sc},bodyGeo,printGeo,print,printLit,printWrong,map,crumble:null};
}
// print colours of one animal (sampled once from its art): a crumb bit carries the colour of the spot it broke from
function swatches(K){
  if(K.sw)return K.sw;const img=IMG[K.name],n=64,c=document.createElement('canvas');c.width=c.height=n;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(img,0,0,n,n);
  const d=x.getImageData(0,0,n,n).data,out=[];
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){const o=(j*n+i)*4;if(d[o+3]<200)continue;
    const ax=(i+.5)/n*2-1,ay=1-(j+.5)/n*2;out.push({x:(ax-K.uv.cx)*K.uv.sc,z:-(ay-K.uv.cy)*K.uv.sc,col:new THREE.Color().setRGB(d[o]/255,d[o+1]/255,d[o+2]/255,THREE.SRGBColorSpace)});}
  return K.sw=out;
}
// ---------- one cookie instance ----------
// group (position/anim scale) > inner (press/wobble/tilt) > body + print
export function makeCookie(v){
  const K=kit(v),S=shared(),group=new THREE.Group(),inner=new THREE.Group();group.add(inner);
  const b=new THREE.Mesh(K.bodyGeo,S.dough);b.castShadow=true;b.receiveShadow=true;b.name='Cookie_body';
  const pr=new THREE.Mesh(K.printGeo,K.print);pr.renderOrder=1;pr.name='Cookie_print';
  inner.add(b,pr);
  return {group,inner,body:b,print:pr,K,tone(mode){b.material=mode==='glow'?S.doughLit:S.dough;pr.material=mode==='glow'?K.printLit:mode==='wrong'?K.printWrong:K.print;}};
}
// ---------- crumble: pooled instanced particles ----------
// A popped cookie shatters into many small pieces: dough crumbs and icing bits (top = the print colour
// of the spot they came from, sides = dough). They burst up and toward the viewer, spin, and fall with
// gravity out of the screen, then their slot is recycled. Two preallocated InstancedMeshes, one draw
// call each, no allocation per pop.
export function createCrumbs(scene,camera,{crumbs=480,bits=320}={}){
  const S=shared();
  const bitGeo=new THREE.BoxGeometry(1,.42,1,1,1,1),bp=bitGeo.attributes.position,mask=new Float32Array(bp.count*3);
  for(let i=0;i<bp.count;i++){const top=bp.getY(i)>.2?1:0;mask[i*3]=mask[i*3+1]=mask[i*3+2]=top;bp.setXYZ(i,bp.getX(i)*(1+.25*hash3(i,1,2)),bp.getY(i),bp.getZ(i)*(1+.25*hash3(i,3,4)));}
  bitGeo.setAttribute('color',new THREE.BufferAttribute(mask,3));bitGeo.computeVertexNormals();
  const bitMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.55,map:null});
  bitMat.onBeforeCompile=sh=>{sh.vertexShader=sh.vertexShader.replace('#include <color_vertex>',`#include <color_vertex>
    #ifdef USE_INSTANCING_COLOR
      vColor.xyz=mix(vec3(.80,.55,.30),instanceColor.xyz,color.r);
    #endif`);};bitMat.customProgramCacheKey=()=>'crumbBit';
  const crumbMat=new THREE.MeshStandardMaterial({map:S.crumb.map,bumpMap:S.crumb.bumpMap,bumpScale:3,roughness:.9});
  const mk=(geo,mat,n)=>{const m=new THREE.InstancedMesh(geo,mat,n);m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);m.setColorAt(0,new THREE.Color(1,1,1));m.instanceColor.setUsage(THREE.DynamicDrawUsage);
    m.count=0;m.frustumCulled=false;m.castShadow=false;m.receiveShadow=false;m.renderOrder=6;scene.add(m);return m;};
  const pools=[{mesh:mk(S.crumbGeo,crumbMat,crumbs),n:crumbs},{mesh:mk(bitGeo,bitMat,bits),n:bits}];
  for(const P of pools){const n=P.n;Object.assign(P,{p:new Float32Array(n*3),v:new Float32Array(n*3),r:new Float32Array(n*3),w:new Float32Array(n*3),sc:new Float32Array(n*3),age:new Float32Array(n),alive:new Uint8Array(n),next:0,live:0});}
  const m4=new THREE.Matrix4(),q=new THREE.Quaternion(),e=new THREE.Euler(),pos=new THREE.Vector3(),scl=new THREE.Vector3(),pr=new THREE.Vector3(),col=new THREE.Color();
  const tones=['#f2cf98','#e3ad66','#d18f45','#b8733a','#f6dcb0'].map(c=>new THREE.Color(c));
  let rs=12345;const rnd=()=>(rs=(rs*16807)%2147483647)/2147483647;
  function spawn(P,x,y,z,size,c,sx,sy,sz){
    let i=P.next;P.next=(i+1)%P.n;if(!P.alive[i]){P.alive[i]=1;P.live++;} // ring buffer: the oldest piece gives its slot
    const a=Math.atan2(z-P.cz,x-P.cx)+(rnd()-.5)*.9,out=(1.1+rnd()*2.2)*size;
    P.p.set([x,y,z],i*3);P.v.set([Math.cos(a)*out,(2.4+rnd()*2.8)*size,Math.sin(a)*out+(1.4+rnd()*2.4)*size],i*3);
    P.r.set([rnd()*6,rnd()*6,rnd()*6],i*3);P.w.set([(rnd()-.5)*14,(rnd()-.5)*10,(rnd()-.5)*14],i*3);P.sc.set([sx,sy,sz],i*3);P.age[i]=0;
    P.mesh.setColorAt(i,c);P.mesh.count=Math.max(P.mesh.count,i+1);
  }
  return {
    pools,
    get alive(){return pools[0].live+pools[1].live;},
    // ck: the cookie (its group gives position, yaw and size)
    emit(ck,{amount=1}={}){
      const g=ck.group;g.updateMatrixWorld(true);const size=g.scale.x,top=COOKIE_TOP,sw=swatches(ck.K);
      for(const P of pools){P.cx=g.position.x;P.cz=g.position.z;}
      const nb=Math.round(34*amount),nc=Math.round(44*amount);
      for(let k=0;k<nb;k++){const s0=sw[(rnd()*sw.length)|0];pr.set(s0.x,top*(.75+rnd()*.25),s0.z).applyMatrix4(g.matrixWorld);
        const b=size*(.12+rnd()*.13);spawn(pools[1],pr.x,pr.y,pr.z,size,s0.col,b,b*(.8+rnd()*.6),b*(.7+rnd()*.6));}
      for(let k=0;k<nc;k++){const s0=sw[(rnd()*sw.length)|0];pr.set(s0.x*(.9+rnd()*.2),top*rnd(),s0.z*(.9+rnd()*.2)).applyMatrix4(g.matrixWorld);
        const b=size*(.045+rnd()*.07);col.copy(tones[(rnd()*tones.length)|0]);spawn(pools[0],pr.x,pr.y,pr.z,size,col,b,b*.8,b);}
      for(const P of pools)P.mesh.instanceColor.needsUpdate=true;
    },
    update(dt){
      if(!this.alive)return 0;const G=26;
      for(const P of pools){
        if(!P.live)continue;let top=0;
        for(let i=0;i<P.mesh.count;i++){
          const o=i*3;
          if(P.alive[i]){
            P.age[i]+=dt;P.v[o+1]-=G*dt;const drag=Math.exp(-dt*.6);P.v[o]*=drag;P.v[o+2]*=drag;
            P.p[o]+=P.v[o]*dt;P.p[o+1]+=P.v[o+1]*dt;P.p[o+2]+=P.v[o+2]*dt;
            for(let a=0;a<3;a++)P.r[o+a]+=P.w[o+a]*dt;
            pos.set(P.p[o],P.p[o+1],P.p[o+2]);pr.copy(pos).project(camera);
            if(P.age[i]>4||pr.y<-1.15||Math.abs(pr.x)>1.3){P.alive[i]=0;P.live--;}
          }
          if(P.alive[i]){top=i+1;e.set(P.r[o],P.r[o+1],P.r[o+2]);q.setFromEuler(e);scl.set(P.sc[o],P.sc[o+1],P.sc[o+2]);m4.compose(pos,q,scl);}
          else m4.makeScale(0,0,0);
          P.mesh.setMatrixAt(i,m4);
        }
        P.mesh.count=top;P.mesh.instanceMatrix.needsUpdate=true;
      }
      return this.alive;
    },
    clear(){for(const P of pools){P.alive.fill(0);P.live=0;P.mesh.count=0;}},
  };
}
// a hidden set (one cookie in each look) so every program/texture is linked at level load
export function warmSet(values){
  const g=new THREE.Group();g.position.set(0,-80,0);
  for(const v of values){for(const mode of ['normal','glow','wrong']){const c=makeCookie(v);c.tone(mode);g.add(c.group);}}
  g.traverse(o=>{o.frustumCulled=false;});return g;
}
// After the textures are in, build every animal's cookie + crumble pieces in idle time (one animal per idle
// slice), so neither a level start nor the first crumble has to build geometry.
const idle=f=>(globalThis.requestIdleCallback?requestIdleCallback(f,{timeout:3000}):setTimeout(f,60));
cookiesReady.then(()=>{const todo=Object.keys(ANIMAL).map(Number);const step=()=>{const v=todo.shift();if(v==null)return;try{swatches(kit(v));}catch(e){console.warn('cookie prep',e);}idle(step);};idle(step);}).catch(()=>{});
