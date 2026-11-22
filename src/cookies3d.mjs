// SquishDoku cookie pieces (set F, approved by Sascha): a real 3D shortbread body cut in the animal's
// silhouette (baked rim, rounded edge, crumb texture) with the Pixar-style animal printed flat on top.
// Everything heavy is shared: one body/print geometry and one material set per animal, one crumble
// kit per animal (built once), shared lit/"wrong" material variants. Textures are small WebPs that
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
// broken pieces + crumbs of one animal (built once, on first use)
function crumbleKit(K){
  if(K.crumble)return K.crumble;const S=shared();
  let sd=K.name.length*977+13;const rnd=()=>(sd=(sd*16807)%2147483647)/2147483647;
  // cap texture: the print on baked dough, mapped like the body's shape coordinates
  const n=IMG[K.name].width,c=document.createElement('canvas');c.width=c.height=n;const x=c.getContext('2d');x.fillStyle='#e2b071';x.fillRect(0,0,n,n);x.drawImage(IMG[K.name],0,0);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.repeat.set(.5/K.uv.sc,.5/K.uv.sc);t.offset.set(.5+K.uv.cx*.5,.5+K.uv.cy*.5);
  const cap=new THREE.MeshStandardMaterial({map:t,roughness:.5});saturate(cap,1.3);
  const ang=([px,py])=>(Math.atan2(py,px)+Math.PI*4)%(Math.PI*2),cuts=[],NP=rnd()<.5?3:4;for(let k=0;k<NP;k++)cuts.push(k/NP*Math.PI*2+.5+(rnd()-.5)*Math.PI*2/NP*.55);
  const pieces=[];
  for(let k=0;k<NP;k++){
    const a0=cuts[k],a1=cuts[(k+1)%NP]+(k===NP-1?Math.PI*2:0),up=a=>{while(a<a0)a+=Math.PI*2;return a;};
    const arc=K.pts.filter(p=>up(ang(p))<=a1).sort((p,q)=>up(ang(p))-up(ang(q)));if(arc.length<3)continue;
    const jag=(a,out)=>{const L=[];for(let s=1;s<=5;s++){const r=s/6*.85,j=(rnd()-.5)*.16;L.push([Math.cos(a+j)*r,Math.sin(a+j)*r]);}return out?L:L.reverse();};
    const geo=body(shapeFrom([[(rnd()-.5)*.08,(rnd()-.5)*.08],...jag(a0,true),...arc,...jag(a1,false)]),.15,.045,2,k+3);
    const mid=(a0+a1)/2,push=.2+rnd()*.12;
    pieces.push({geo,to:new THREE.Vector3(Math.cos(mid)*push,.03+rnd()*.05,-Math.sin(mid)*push),rot:new THREE.Euler((rnd()-.5)*.5,(rnd()-.5)*.6,(rnd()-.5)*.5)});
  }
  const crumbs=[];for(let k=0;k<12;k++){const a=rnd()*Math.PI*2,r=.45+rnd()*.55,s=.05+rnd()*.07;crumbs.push({s,to:new THREE.Vector3(Math.cos(a)*r,s*.6,Math.sin(a)*r),rot:new THREE.Euler(rnd()*3,rnd()*3,rnd()*3)});}
  return K.crumble={cap,pieces,crumbs};
}
// ---------- one cookie instance ----------
// group (position/anim scale) > inner (press/wobble/tilt) > body + print
export function makeCookie(v){
  const K=kit(v),S=shared(),group=new THREE.Group(),inner=new THREE.Group();group.add(inner);
  const b=new THREE.Mesh(K.bodyGeo,S.dough);b.castShadow=true;b.receiveShadow=true;b.name='Cookie_body';
  const pr=new THREE.Mesh(K.printGeo,K.print);pr.renderOrder=1;pr.name='Cookie_print';
  inner.add(b,pr);
  const crumble=new THREE.Group();crumble.visible=false;crumble.rotation.y=(Math.random()-.5)*.8;group.add(crumble);
  return {group,inner,body:b,print:pr,crumble,K,tone(mode){b.material=mode==='glow'?S.doughLit:S.dough;pr.material=mode==='glow'?K.printLit:mode==='wrong'?K.printWrong:K.print;}};
}
// build the crumble meshes for a cookie (cheap: shared geometry/materials) and return an animator t∈[0,1]
export function crumbleOf(ck){
  const C=crumbleKit(ck.K),S=shared(),g=ck.crumble;
  if(!g.children.length){
    for(const p of C.pieces){const m=new THREE.Mesh(p.geo,[C.cap,S.dough]);m.castShadow=true;m.receiveShadow=true;m.scale.setScalar(.8);m.userData=p;g.add(m);}
    for(const c of C.crumbs){const m=new THREE.Mesh(S.crumbGeo,S.crumb);m.castShadow=true;m.userData=c;g.add(m);}
  }
  return t=>{const e=1-Math.pow(1-t,3),hop=4*t*(1-t);
    for(const m of g.children){const d=m.userData;
      if(d.geo){m.position.set(d.to.x*e,d.to.y*e+hop*.18,d.to.z*e);m.rotation.set(d.rot.x*e,d.rot.y*e,d.rot.z*e);}
      else{m.position.set(d.to.x*e,d.to.y+hop*.3,d.to.z*e);m.rotation.set(d.rot.x*e,d.rot.y*e,d.rot.z*e);m.scale.setScalar(d.s*(.3+.7*Math.min(1,t*3)));}}};
}
// a hidden set (one cookie in each look + one crumble) so every program/texture is linked at level load
export function warmSet(values){
  const g=new THREE.Group();g.position.set(0,-80,0);
  for(const v of values){for(const mode of ['normal','glow','wrong']){const c=makeCookie(v);c.tone(mode);g.add(c.group);}}
  // one crumbled cookie per animal: builds its broken pieces now, not on the first pop
  for(const v of values){const c=makeCookie(v);c.inner.visible=false;c.crumble.visible=true;crumbleOf(c)(1);g.add(c.group);}
  g.traverse(o=>{o.frustumCulled=false;});return g;
}
