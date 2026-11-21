// SquishDoku "Neon-Schlauch" board (prototype, tube.html): a dark routed board with one coloured
// silicone neon tube per colour region, laid loosely on top of its groove. Hold = the tube is pressed
// into the groove and an LED under that cell glows through the silicone; swipe = pressed in dark;
// a fully pressed region lights up as a whole neon tube. Same API as board3d.mjs, so main.mjs and the
// engine are unchanged. Rendering: one WebGL pass, no post-processing (glow = emissive silicone +
// light spill decals on the board), on-demand frames only.
import {THREE,PARAMETERS as P} from '../vendor/squish-attack/squish/squish-graphics.js?v=play-sharp-1';
import {fitStoneBoard} from '../vendor/squish-attack/game/clean-screen.mjs?v=launch-26';
import {createChromeFrame} from '../vendor/squish-attack/game/chrome-frame.mjs?v=play-sharp-1';
import '../src/tube-paths.js';
const {layTubes}=globalThis.TubePaths;

// silicone colour (unlit jacket) and neon light colour per game colour value
const NEON={
  1:{base:'#1d8cff',emit:'#2a8fff'}, 2:{base:'#ff2350',emit:'#ff3a5c'}, 3:{base:'#1fd25a',emit:'#3dff7a'},
  4:{base:'#ff8a12',emit:'#ff9a2e'}, 5:{base:'#9440ff',emit:'#8a3dff'}, 7:{base:'#ff3fc0',emit:'#ff5ccc'},
  8:{base:'#18d6cc',emit:'#3ef2e6'}, 9:{base:'#eef1f7',emit:'#fff4e2'}, 6:{base:'#ffc828',emit:'#ffd447'},
};
const neonOf=v=>NEON[v]||NEON[((Math.max(1,v|0)-1)%8)+1]||NEON[1];
const MAXC=48;

// ---------------------------------------------------------------------------------------------
// shared GLSL: per-cell state (press depth, squash, led, red) interpolated along the tube
const CELL_GLSL=`
uniform vec4 uCell[${MAXC}];uniform float uCount,uPitch,uTop,uGD,uTW,uTH,uSqz,uSeed;
vec4 cellAt(float j){return uCell[int(clamp(j,0.,uCount-1.))];}
// plateau around every cell centre, smooth hand-over between neighbours (partition of unity)
vec4 cellState(float f){float j=floor(f);float t=smoothstep(.16,.84,f-j);return mix(cellAt(j),cellAt(j+1.),t);}
float ledAt(float f){float j=floor(f+.5),s=0.;for(int k=-1;k<=1;k++){float i=j+float(k);if(i<0.||i>uCount-1.)continue;float d=(f-i)/.4;s+=cellAt(i).z*exp(-d*d);}return s;}
float redAt(float f){float j=floor(f+.5),s=0.;for(int k=-1;k<=1;k++){float i=j+float(k);if(i<0.||i>uCount-1.)continue;float d=(f-i)/.45;s+=cellAt(i).w*exp(-d*d);}return s;}
`;

const TUBE_ATTR=`attribute vec3 aCenter;attribute vec2 aSide,aTan,aProf,aPN;attribute float aF,aCap;
varying float vF,vLed,vRed,vTop,vCap,vPress;varying vec2 vProf;`;
// deformation of the silicone tube by the per-cell state: sets transformed + objectNormal
const TUBE_DEFORM=`
  vec4 cs=cellState(aF);
  float e=.03;vec4 c0=cellState(aF-e),c1=cellState(aF+e);
  float press=cs.x,sq=cs.y;
  // pressed in: squeezed into the slightly narrower groove; finger: squashed flatter and wider
  float ws=mix(1.,uSqz,clamp(press,0.,1.))*(1.+.08*sq),hs=1.-.18*sq;
  // a loose tube never lies perfectly flat: soft memory curl lifts it a little here and there
  float loose=clamp(1.-press,0.,1.),cw=sin(aF*2.2+uSeed)*.5+.5,cw2=cos((aF+e)*2.2+uSeed)*2.2*.5;
  float yc=uTop+uTH*hs-uGD*press+uTH*.16*cw*cw*loose;
  float dyds=(-uGD*(c1.x-c0.x)+uTH*(-.18)*(c1.y-c0.y))/(2.*e*uPitch)+uTH*.16*2.*cw*cw2*loose/uPitch;
  vec3 T=vec3(aTan.x,0.,aTan.y),S=vec3(aSide.x,0.,aSide.y);
  vec3 objectNormal;
  if(aCap!=0.){objectNormal=normalize(T*aCap+vec3(0.,dyds*aCap,0.));}
  else{vec3 n=normalize(S*aPN.x/ws+vec3(0.,aPN.y/hs,0.));objectNormal=normalize(n-dyds*n.y*T);}
  vec3 transformed=aCenter+S*aProf.x*uTW*ws+vec3(0.,yc+aProf.y*uTH*hs,0.);
  vF=aF;vLed=ledAt(aF);vRed=redAt(aF);vTop=aPN.y;vCap=aCap;vProf=aProf;vPress=press;
`;
const NEON_FRAG_HEAD=`uniform vec3 uEmit;uniform float uLit,uLitFrom,uLitSpread,uLitGain,uFront;
varying float vF,vLed,vRed,vTop,vCap,vPress;varying vec2 vProf;
float glowAmount(){float d=abs(vF-uLitFrom);float lit=uLit*(1.-smoothstep(uLitSpread-.35,uLitSpread,d));
  float fr=(d-uLitSpread+.25)/.32;lit+=uFront*exp(-fr*fr)*uLit; // bright wave front running along the tube
  return clamp(vLed+lit*uLitGain,0.,3.);}
// light leaving the silicone: strongest on the top face (top-emitting neon flex), dimmer on the sides
vec3 neonLight(float g){float top=smoothstep(-.35,.95,vTop);float face=mix(.42,1.,top);
  if(vCap!=0.)face=.75+.6*(1.-smoothstep(.5,.7,length(vProf)));
  vec3 c=uEmit*face*g*.85;
  c+=mix(uEmit,vec3(1.),.3)*pow(top,8.)*clamp(g-.3,0.,2.)*.28;
  return c;}`;

function makeTubeMaterial(env,uniforms,base){
  const bc=new THREE.Color(base);
  const m=new THREE.MeshPhysicalMaterial({
    color:bc,roughness:.46,metalness:0,
    clearcoat:.35,clearcoatRoughness:.32,sheen:1,sheenRoughness:.55,sheenColor:new THREE.Color('#ffffff').lerp(bc,.5),
    specularIntensity:.45,envMap:env,envMapIntensity:.8,
  });
  m.userData.u=uniforms;
  m.onBeforeCompile=sh=>{
    Object.assign(sh.uniforms,uniforms);
    sh.vertexShader=sh.vertexShader
      .replace('#include <common>',`#include <common>
${CELL_GLSL}
${TUBE_ATTR}`)
      .replace('#include <beginnormal_vertex>',TUBE_DEFORM)
      .replace('#include <begin_vertex>','');
    sh.fragmentShader=sh.fragmentShader
      .replace('#include <common>',`#include <common>
${NEON_FRAG_HEAD}`)
      .replace('#include <color_fragment>',`#include <color_fragment>
  float glowAmt=glowAmount();
  // cut end: coloured jacket ring, milky diffuser core, dark slot for the LED strip
  if(vCap!=0.){float r=length(vProf);float core=1.-smoothstep(.56,.66,r);
    diffuseColor.rgb=mix(diffuseColor.rgb,mix(vec3(.93,.92,.95),diffuseColor.rgb,.25),core);
    float slot=(1.-smoothstep(.26,.32,abs(vProf.x)))*(1.-smoothstep(-.52,-.44,vProf.y));
    diffuseColor.rgb*=mix(1.,.2,slot*core);}
  // lit silicone: lighter, desaturated diffuse (light scatters inside)
  diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*.6+.22,clamp(glowAmt,0.,1.)*.2);
  {float rd=clamp(vRed,0.,1.);float l=dot(diffuseColor.rgb,vec3(.3,.59,.11));diffuseColor.rgb=mix(diffuseColor.rgb,vec3(l*.4+.45,.05,.06),rd*.85);}`)
      .replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
  {vec3 V=normalize(vViewPosition);float fres=pow(1.-abs(dot(normal,V)),2.);
   totalEmissiveRadiance+=neonLight(glowAmt);
   // milky silicone: light scattered inside the jacket glows softly at the rims
   totalEmissiveRadiance+=diffuseColor.rgb*(.05+.16*fres)*(1.-clamp(glowAmt,0.,1.)*.5);
   totalEmissiveRadiance+=vec3(1.,.06,.08)*clamp(vRed,0.,1.)*.55;}`);
  };
  m.customProgramCacheKey=()=>'sd-neon-tube-2';
  return m;
}
// the same tube, emitting only its neon light: rendered small for the bloom halo
function makeGlowMaterial(uniforms){
  return new THREE.ShaderMaterial({uniforms,
    vertexShader:`${CELL_GLSL}
${TUBE_ATTR}
void main(){${TUBE_DEFORM}
  gl_Position=projectionMatrix*modelViewMatrix*vec4(transformed,1.);}`,
    fragmentShader:`${NEON_FRAG_HEAD}
void main(){float g=glowAmount();gl_FragColor=vec4(neonLight(g)+vec3(1.,.04,.05)*clamp(vRed,0.,1.)*.7,1.);}`});
}

// light spill + contact shadow on the board around a tube (premultiplied: rgb adds, alpha darkens)
function makeSpillMaterial(uniforms){
  return new THREE.ShaderMaterial({
    uniforms,transparent:true,depthWrite:false,
    blending:THREE.CustomBlending,blendSrc:THREE.OneFactor,blendDst:THREE.OneMinusSrcAlphaFactor,blendEquation:THREE.AddEquation,
    vertexShader:`${CELL_GLSL}
attribute float aF,aU;varying float vF,vU,vLed,vPress;
void main(){vF=aF;vU=aU;vLed=ledAt(aF);vPress=cellState(aF).x;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`uniform vec3 uEmit;uniform float uLit,uLitFrom,uLitSpread,uLitGain;varying float vF,vU,vLed,vPress;
void main(){
  float lit=uLit*(1.-smoothstep(uLitSpread-.35,uLitSpread,abs(vF-uLitFrom)));
  float g=clamp(vLed*.8+lit*uLitGain,0.,3.);
  float spill=exp(-vU*vU*3.2)*.55+exp(-vU*vU*14.)*.45;
  // contact shadow: a loose tube (not pressed) lies on top and shades the board, offset away from the light
  float su=vU-.08;float sh=exp(-su*su*9.)*mix(.42,.16,clamp(vPress,0.,1.))*(1.-clamp(g,0.,1.)*.8);
  vec3 col=uEmit*g*spill*.55;
  gl_FragColor=vec4(col,sh);
  #include <colorspace_fragment>
}`,
  });
}

// soft studio environment: dark navy room, big softbox above, two strip lights, a warm gold kicker
function makeEnvironment(renderer){
  const s=new THREE.Scene();
  const room=new THREE.Mesh(new THREE.BoxGeometry(40,24,40),new THREE.MeshBasicMaterial({color:new THREE.Color('#070a18'),side:THREE.BackSide}));room.position.y=6;s.add(room);
  const panel=(w,h,col,k,pos,rot)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:new THREE.Color(col).multiplyScalar(k),side:THREE.DoubleSide}));m.position.set(...pos);m.rotation.set(...rot);s.add(m);};
  panel(9,5,'#ffffff',2.6,[-3,15,-9],[Math.PI/2.6,0,0]);   // softbox, behind and above
  panel(2.2,14,'#dfe8ff',1.6,[-15,8,0],[0,Math.PI/2,0]);  // cool strip left
  panel(2.2,14,'#ffd9a0',1.2,[15,7,-3],[0,-Math.PI/2,0]); // warm (gold) strip right
  panel(26,1.4,'#c8d4ff',.8,[0,3,-19],[0,0,0]);           // horizon line
  const pm=new THREE.PMREMGenerator(renderer);const rt=pm.fromScene(s,.03);pm.dispose();
  s.traverse(o=>{o.geometry?.dispose?.();o.material?.dispose?.();});
  return rt.texture;
}

// cheap neon bloom: the glowing tubes alone, rendered at 1/4 size, blurred twice, added on screen
function createBloom(renderer){
  const mk=()=>new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:true});
  const a=mk(),b=mk(),c=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:false}),d=c.clone();
  const quadScene=new THREE.Scene(),cam=new THREE.Camera(),quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2));quad.frustumCulled=false;quadScene.add(quad);
  const vs='varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
  const blur=new THREE.ShaderMaterial({uniforms:{tMap:{value:null},uDir:{value:new THREE.Vector2()}},vertexShader:vs,depthTest:false,depthWrite:false,
    fragmentShader:`varying vec2 vUv;uniform sampler2D tMap;uniform vec2 uDir;
void main(){vec3 s=texture2D(tMap,vUv).rgb*.2270;
s+=(texture2D(tMap,vUv+uDir*1.3846).rgb+texture2D(tMap,vUv-uDir*1.3846).rgb)*.3162;
s+=(texture2D(tMap,vUv+uDir*3.2308).rgb+texture2D(tMap,vUv-uDir*3.2308).rgb)*.0703;
gl_FragColor=vec4(s,1.);}`});
  const comp=new THREE.ShaderMaterial({uniforms:{tA:{value:a.texture},tC:{value:c.texture},uK:{value:1}},vertexShader:vs,depthTest:false,depthWrite:false,transparent:true,
    blending:THREE.CustomBlending,blendSrc:THREE.OneFactor,blendDst:THREE.OneFactor,blendSrcAlpha:THREE.OneFactor,blendDstAlpha:THREE.OneFactor,
    fragmentShader:`varying vec2 vUv;uniform sampler2D tA,tC;uniform float uK;
void main(){vec3 g=(texture2D(tA,vUv).rgb*.9+texture2D(tC,vUv).rgb*1.1)*uK;
  g=1.-exp(-g); // soft knee: bright halos never clip to flat white
  gl_FragColor=vec4(g,max(g.r,max(g.g,g.b)));}`});
  let w=1,h=1;
  return {
    setSize(W,H){w=Math.max(8,Math.round(W/4));h=Math.max(8,Math.round(H/4));a.setSize(w,h);b.setSize(w,h);c.setSize(Math.max(4,w>>1),Math.max(4,h>>1));d.setSize(Math.max(4,w>>1),Math.max(4,h>>1));},
    render(glowScene,camera,k){
      const tm=renderer.toneMapping,ac=renderer.autoClear;renderer.toneMapping=THREE.NoToneMapping;
      renderer.setRenderTarget(a);renderer.setClearColor(0,1);renderer.clear();renderer.render(glowScene,camera);
      quad.material=blur;
      const pass=(src,dst,x,y)=>{blur.uniforms.tMap.value=src.texture;blur.uniforms.uDir.value.set(x/src.width,y/src.height);renderer.setRenderTarget(dst);renderer.render(quadScene,cam);};
      pass(a,b,1,0);pass(b,a,0,1);       // 1/4: tight halo
      pass(a,d,1.6,0);pass(d,c,0,1.6);   // 1/8: wide halo
      pass(c,d,2.2,0);pass(d,c,0,2.2);
      renderer.setRenderTarget(null);renderer.setClearColor(0,0);renderer.toneMapping=tm;
      comp.uniforms.uK.value=k;quad.material=comp;renderer.autoClear=false;renderer.render(quadScene,cam);renderer.autoClear=ac;
    },
    dispose(){[a,b,c,d].forEach(t=>t.dispose());blur.dispose();comp.dispose();quad.geometry.dispose();},
  };
}

// ---------------------------------------------------------------------------------------------
// tube centreline: cell centres -> straight runs with filleted 90° bends, cell coordinate f per sample
function centreline(cells,p,cellPos){
  const pts=cells.map(([r,c])=>cellPos(r,c));
  const R=.42*p,E=.31*p,out=[];
  const push=(v,f)=>out.push({x:v.x,z:v.z,f});
  if(pts.length===1){const a=pts[0];for(let i=0;i<=8;i++){const t=i/8;push({x:a.x-E+2*E*t,z:a.z},-E/p+2*E/p*t);}return finishLine(out);}
  const dir=(a,b)=>{const dx=b.x-a.x,dz=b.z-a.z,l=Math.hypot(dx,dz);return {x:dx/l,z:dz/l};};
  const seg=(a,b,fa,fb,n)=>{for(let i=1;i<=n;i++){const t=i/n;push({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t},fa+(fb-fa)*t);}};
  const d0=dir(pts[0],pts[1]);
  const start={x:pts[0].x-d0.x*E,z:pts[0].z-d0.z*E};push(start,-E/p);
  let cur=start,fc=-E/p;
  const step=p/14;
  for(let i=0;i<pts.length;i++){
    const v=pts[i];
    if(i===pts.length-1){const dn=dir(pts[i-1],v);const end={x:v.x+dn.x*E,z:v.z+dn.z*E};const L=Math.hypot(end.x-cur.x,end.z-cur.z);seg(cur,end,fc,i+E/p,Math.max(2,Math.ceil(L/step)));break;}
    if(i===0)continue;
    const di=dir(pts[i-1],v),dn=dir(v,pts[i+1]);
    const straight=Math.abs(di.x*dn.x+di.z*dn.z)>.99;
    if(straight)continue;
    // fillet: from v-di*R to v+dn*R, quarter circle
    const a={x:v.x-di.x*R,z:v.z-di.z*R},b={x:v.x+dn.x*R,z:v.z+dn.z*R};
    const L=Math.hypot(a.x-cur.x,a.z-cur.z);seg(cur,a,fc,i-R/p,Math.max(1,Math.ceil(L/step)));
    const cx=a.x+dn.x*R,cz=a.z+dn.z*R; // circle centre
    const a0=Math.atan2(a.z-cz,a.x-cx),a1=Math.atan2(b.z-cz,b.x-cx);let da=a1-a0;while(da>Math.PI)da-=2*Math.PI;while(da<-Math.PI)da+=2*Math.PI;
    const n=12;for(let k=1;k<=n;k++){const t=k/n,ang=a0+da*t;push({x:cx+Math.cos(ang)*R,z:cz+Math.sin(ang)*R},i-R/p+2*R/p*t);}
    cur=b;fc=i+R/p;
  }
  return finishLine(out);
}
function finishLine(out){
  for(let i=0;i<out.length;i++){const a=out[Math.max(0,i-1)],b=out[Math.min(out.length-1,i+1)];const dx=b.x-a.x,dz=b.z-a.z,l=Math.hypot(dx,dz)||1;out[i].tx=dx/l;out[i].tz=dz/l;out[i].sx=-dz/l;out[i].sz=dx/l;}
  let s=0;for(let i=0;i<out.length;i++){if(i)s+=Math.hypot(out[i].x-out[i-1].x,out[i].z-out[i-1].z);out[i].s=s;}
  return out;
}
// rounded-rectangle (superellipse) silicone cross-section, unit half extents
function profile(M,n=3.4){const pts=[];for(let i=0;i<M;i++){const a=i/M*Math.PI*2,c=Math.cos(a),s=Math.sin(a);const x=Math.sign(c)*Math.pow(Math.abs(c),2/n),y=Math.sign(s)*Math.pow(Math.abs(s),2/n);
  // superellipse normal ∝ (sign(x)|x|^(n-1), sign(y)|y|^(n-1)) for unit extents
  let nx=Math.sign(x)*Math.pow(Math.abs(x),n-1),ny=Math.sign(y)*Math.pow(Math.abs(y),n-1);const l=Math.hypot(nx,ny)||1;pts.push({x,y,nx:nx/l,ny:ny/l});}return pts;}
const PROF=profile(32);

function tubeGeometry(line){
  const M=PROF.length,rings=line.length;
  const center=[],side=[],tan=[],prof=[],pn=[],fs=[],cap=[],pos=[],idx=[];
  const vert=(q,px,py,nx,ny,capv)=>{center.push(q.x,0,q.z);side.push(q.sx,q.sz);tan.push(q.tx,q.tz);prof.push(px,py);pn.push(nx,ny);fs.push(q.f);cap.push(capv);pos.push(q.x,0,q.z);return fs.length-1;};
  for(let i=0;i<rings;i++)for(let j=0;j<=M;j++){const pp=PROF[j%M];vert(line[i],pp.x,pp.y,pp.nx,pp.ny,0);}
  for(let i=0;i<rings-1;i++)for(let j=0;j<M;j++){const a=i*(M+1)+j,b=a+M+1;idx.push(a,b,a+1,b,b+1,a+1);}
  // flat cut ends: centre + inner ring (core edge) + outer ring
  for(const [q,sgn] of [[line[0],-1],[line[rings-1],1]]){
    const c=vert(q,0,0,0,0,sgn),ring=[];
    for(const k of [.6,.62,1])for(let j=0;j<M;j++){const pp=PROF[j];ring.push(vert(q,pp.x*k,pp.y*k,0,0,sgn));}
    for(let j=0;j<M;j++){const j1=(j+1)%M;const t=(a,b,c2)=>sgn>0?idx.push(a,b,c2):idx.push(a,c2,b);
      t(c,ring[j],ring[j1]);
      for(let r=0;r<2;r++){const a=ring[r*M+j],b=ring[r*M+j1],a2=ring[(r+1)*M+j],b2=ring[(r+1)*M+j1];t(a,a2,b2);t(a,b2,b);}}
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('aCenter',new THREE.Float32BufferAttribute(center,3));
  g.setAttribute('aSide',new THREE.Float32BufferAttribute(side,2));
  g.setAttribute('aTan',new THREE.Float32BufferAttribute(tan,2));
  g.setAttribute('aProf',new THREE.Float32BufferAttribute(prof,2));
  g.setAttribute('aPN',new THREE.Float32BufferAttribute(pn,2));
  g.setAttribute('normal',new THREE.Float32BufferAttribute(pn.flatMap((v,i)=>i%2?[]:[0,1,0]),3));
  g.setAttribute('aF',new THREE.Float32BufferAttribute(fs,1));
  g.setAttribute('aCap',new THREE.Float32BufferAttribute(cap,1));
  g.setIndex(idx);
  return g;
}
// flat ribbon on the board top (spill / shadow), half width w
function ribbonGeometry(line,y,w){
  const pos=[],fs=[],us=[],idx=[];
  const ext=w; // reach beyond the tube ends
  const pts=[{...line[0],x:line[0].x-line[0].tx*ext*.5,z:line[0].z-line[0].tz*ext*.5,f:line[0].f-.25},...line,{...line[line.length-1],x:line[line.length-1].x+line[line.length-1].tx*ext*.5,z:line[line.length-1].z+line[line.length-1].tz*ext*.5,f:line[line.length-1].f+.25}];
  pts.forEach(q=>{for(const u of [-1,-.5,0,.5,1]){pos.push(q.x+q.sx*u*w,y,q.z+q.sz*u*w);fs.push(q.f);us.push(u*2);}});
  for(let i=0;i<pts.length-1;i++)for(let j=0;j<4;j++){const a=i*5+j,b=a+5;idx.push(a,b,a+1,b,b+1,a+1);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('aF',new THREE.Float32BufferAttribute(fs,1));g.setAttribute('aU',new THREE.Float32BufferAttribute(us,1));g.setIndex(idx);return g;
}
// routed groove interior (open U profile with a small chamfer at the top edge, rounded ends)
function grooveGeometry(line,top,gw,gd,p){
  const b=.03*p,rr=.06*p;
  // half profile from the centre of the floor out to the top edge: [lateral d, y, nd, ny]
  const half=[[0,-gd,0,1],[gw-rr,-gd,0,1],[gw-rr*.3,-gd+rr*.3,-.7,.7],[gw,-gd+rr,-1,0],[gw,-b,-1,0],[gw+b,0,-.5,.85]];
  const pos=[],nor=[],fs=[],idx=[],ss=[],ds=[];
  const add=(x,y,z,nx,ny,nz,f,sv,dv)=>{pos.push(x,y+top,z);nor.push(nx,ny,nz);fs.push(f);ss.push(sv);ds.push(dv);return fs.length-1;};
  const prof=[...half.slice().reverse().map(([d,y,nd,ny])=>[-d,y,-nd,ny]),...half.slice(1)];
  const W=prof.length;
  line.forEach(q=>{for(const [d,y,nd,ny] of prof)add(q.x+q.sx*d,y,q.z+q.sz*d,q.sx*nd,ny,q.sz*nd,q.f,q.s,d/gw);});
  for(let i=0;i<line.length-1;i++)for(let j=0;j<W-1;j++){const a=i*W+j,c=a+W;idx.push(a,a+1,c,c,a+1,c+1);}
  // rounded ends: sweep the half profile through 180°
  for(const [q,sgn] of [[line[0],-1],[line[line.length-1],1]]){
    const base=fs.length,K=12;
    for(let k=0;k<=K;k++){const a=-Math.PI/2+Math.PI*k/K;const dx=q.sx*Math.cos(a)*-1+q.tx*sgn*Math.sin(a)*0,dz=0;
      // direction in plane: rotate the side vector towards the tangent
      const cx=Math.sin(a)*q.sx+Math.cos(a)*q.tx*sgn,cz=Math.sin(a)*q.sz+Math.cos(a)*q.tz*sgn;
      for(const [d,y,nd,ny] of half)add(q.x+cx*d,y,q.z+cz*d,cx*nd,ny,cz*nd,q.f,q.s+sgn*Math.cos(a)*d,Math.sin(a)*d/gw);}
    const H=half.length;
    for(let k=0;k<K;k++)for(let j=0;j<H-1;j++){const a=base+k*H+j,c=a+H;if(sgn>0)idx.push(a,c,a+1,c,c+1,a+1);else idx.push(a,a+1,c,c,a+1,c+1);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));g.setAttribute('aF',new THREE.Float32BufferAttribute(fs,1));g.setAttribute('aS',new THREE.Float32BufferAttribute(ss,1));g.setAttribute('aD',new THREE.Float32BufferAttribute(ds,1));g.setIndex(idx);return g;
}
// groove outline polygon (for the hole in the board top): offset both sides + round router ends
function grooveOutline(line,gw){
  const L=[],Rr=[];line.forEach(q=>{L.push(new THREE.Vector2(q.x+q.sx*gw,q.z+q.sz*gw));Rr.push(new THREE.Vector2(q.x-q.sx*gw,q.z-q.sz*gw));});
  const capPts=(q,sgn)=>{const out=[];for(let k=1;k<12;k++){const a=Math.PI*k/12;const cx=Math.cos(a)*q.sx*sgn+Math.sin(a)*q.tx*sgn,cz=Math.cos(a)*q.sz*sgn+Math.sin(a)*q.tz*sgn;out.push(new THREE.Vector2(q.x+cx*gw,q.z+cz*gw));}return out;};
  const e=line[line.length-1],s=line[0];
  return [...L,...capPts(e,1),...Rr.reverse(),...capPts(s,-1)];
}

// ---------------------------------------------------------------------------------------------
export function createTubeBoard(host){
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
  const ios=/iP(hone|ad|od)/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  const DPR=Math.min(devicePixelRatio||1,2.5); // 2.5x + MSAA: indistinguishable from 3x, ~30% less fill
  renderer.setPixelRatio(DPR);
  renderer.toneMapping=THREE.NeutralToneMapping;renderer.toneMappingExposure=1.0;
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.setClearColor(0,0);
  host.append(renderer.domElement);Object.assign(renderer.domElement.style,{width:'100%',height:'100%',display:'block',touchAction:'none'});
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(P.camera.fov,1,.5,200);
  const env=makeEnvironment(renderer);scene.environment=env;
  scene.add(new THREE.HemisphereLight('#c9d6ff','#10142a',.55));
  const key=new THREE.DirectionalLight('#fff6ea',1.6);key.position.set(-6,14,6);scene.add(key);
  const rim=new THREE.DirectionalLight('#9fb6ff',.5);rim.position.set(7,6,-10);scene.add(rim);

  const TOP=P.board.top,BOT=P.board.bottom;
  const bloom=createBloom(renderer),glowScene=new THREE.Scene();
  const occluder=new THREE.MeshBasicMaterial({color:0x000000});
  const frame=createChromeFrame({scene:{environment:env}});scene.add(frame.group);
  const FH=frame.measures.outerHalf,FC=frame.measures.outerCorner;
  const rrect=(path,h,r)=>{path.moveTo(-h+r,-h);path.lineTo(h-r,-h);path.quadraticCurveTo(h,-h,h,-h+r);path.lineTo(h,h-r);path.quadraticCurveTo(h,h,h-r,h);path.lineTo(-h+r,h);path.quadraticCurveTo(-h,h,-h,h-r);path.lineTo(-h,-h+r);path.quadraticCurveTo(-h,-h,-h+r,-h);return path;};

  // board materials: deep navy acrylic, glossy; routed channels frosted (matte, a little lighter)
  const boardMat=new THREE.MeshPhysicalMaterial({color:new THREE.Color('#121b44'),roughness:.55,metalness:0,clearcoat:1,clearcoatRoughness:.06,envMap:env,envMapIntensity:.7,specularIntensity:.4});
  // faint etched grid (cell borders + small corner marks) so rows and columns stay readable
  const gridU={uPitch:{value:1},uHalf:{value:4.85}};
  boardMat.onBeforeCompile=sh=>{Object.assign(sh.uniforms,gridU);
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 vGrid;').replace('#include <begin_vertex>','#include <begin_vertex>\nvGrid=position.xz;');
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform float uPitch,uHalf;varying vec2 vGrid;')
      .replace('#include <color_fragment>',`#include <color_fragment>
  {vec2 g=(vGrid+uHalf)/uPitch;vec2 d=abs(fract(g)-.5);float inside=step(-.02,g.x)*step(g.x,uHalf*2./uPitch+.02)*step(-.02,g.y)*step(g.y,uHalf*2./uPitch+.02);
   vec2 w=fwidth(g);
   float line=max(smoothstep(.5-w.x*1.4-.004,.5-.004,d.x),smoothstep(.5-w.y*1.4-.004,.5-.004,d.y));
   float corner=(1.-smoothstep(.028,.028+w.x*1.5,length(.5-d)));
   diffuseColor.rgb+=vec3(.13,.16,.3)*(line*.16+corner*.55)*inside;}`);};
  boardMat.customProgramCacheKey=()=>'sd-board-grid-1';
  const sideMat=new THREE.MeshPhysicalMaterial({color:new THREE.Color('#0a0f26'),roughness:.5,clearcoat:.8,clearcoatRoughness:.15,envMap:env,envMapIntensity:.7});
  // routed channel: frosted walls; on the floor the white LED strip with its small chips (like the reference)
  const grooveMat=new THREE.MeshStandardMaterial({color:new THREE.Color('#3a4472'),roughness:.9,metalness:0,envMap:env,envMapIntensity:.4,side:THREE.DoubleSide});
  const grooveU={uPitch:{value:1},uFloor:{value:0}};
  grooveMat.onBeforeCompile=sh=>{Object.assign(sh.uniforms,grooveU);
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nattribute float aS,aD;varying float vS,vD,vY;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvS=aS;vD=aD;vY=position.y;');
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform float uPitch,uFloor;varying float vS,vD,vY;')
      .replace('#include <color_fragment>',`#include <color_fragment>
  float fl=1.-smoothstep(uFloor+.004,uFloor+.02,vY);
  float strip=fl*(1.-smoothstep(.62,.7,abs(vD)));
  float q=fract(vS/(uPitch*.25))-.5;float chip=strip*(1.-smoothstep(.13,.17,abs(q)))*(1.-smoothstep(.3,.36,abs(vD)));
  diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.86,.86,.84),strip);
  diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.98,.82,.42),chip);
  float pad=strip*(1.-chip)*(1.-smoothstep(.06,.09,abs(abs(q)-.3)))*(1.-smoothstep(.45,.5,abs(vD)));
  diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.75,.62,.4),pad*.6);`);};
  grooveMat.customProgramCacheKey=()=>'sd-groove-1';
  // board slab + side band are rebuilt per level (the slab top must sit under the channel floor)
  let slab=null,band=null;
  function makeSlab(depthTop){
    for(const m of [slab,band])if(m){scene.remove(m);m.geometry.dispose();}
    const g=new THREE.ExtrudeGeometry(rrect(new THREE.Shape(),FH-.02,FC),{depth:depthTop-BOT-.04,bevelEnabled:true,bevelThickness:.02,bevelSize:.02,bevelSegments:2,curveSegments:10});
    g.rotateX(-Math.PI/2);g.translate(0,BOT+.02,0);slab=new THREE.Mesh(g,sideMat);scene.add(slab);
    const s2=rrect(new THREE.Shape(),FH,FC);s2.holes.push(rrect(new THREE.Path(),FH-.14,Math.max(.05,FC-.14)));
    const g2=new THREE.ExtrudeGeometry(s2,{depth:TOP-depthTop+.02,bevelEnabled:false,curveSegments:10});g2.rotateX(-Math.PI/2);g2.translate(0,depthTop-.02,0);
    band=new THREE.Mesh(g2,sideMat);scene.add(band);
  }
  let topMesh=null;

  // slot fitting (same camera as Squish Attack: fitStoneBoard on the board's outer box)
  const slot=host.parentElement?.querySelector(':scope > .board-slot');
  const bounds=new THREE.Box3(new THREE.Vector3(-P.board.size/2,BOT,-P.board.size/2),new THREE.Vector3(P.board.size/2,TOP,P.board.size/2));
  let W=1,H=1;
  function fit(){
    const rc=host.getBoundingClientRect();W=Math.max(1,rc.width);H=Math.max(1,rc.height);
    renderer.setSize(W,H,false);bloom.setSize(W*renderer.getPixelRatio(),H*renderer.getPixelRatio());
    const s=slot?{left:slot.offsetLeft-host.offsetLeft,top:slot.offsetTop-host.offsetTop,width:slot.offsetWidth,height:slot.offsetHeight}:{left:0,top:0,width:W,height:H};
    fitStoneBoard(camera,W,H,bounds,s);
    dirty=true;
  }
  const ro=new ResizeObserver(fit);ro.observe(host);if(slot)ro.observe(slot);

  // ---------- level ----------
  let N=5,p=P.board.pitch,cells=[],pieces=[],regions=new Map(),levelGroup=null,glowLevel=null;
  let TW,TH,GW,GD;
  const cellPos=(r,c)=>new THREE.Vector3((c-(N-1)/2)*p,TOP,(r-(N-1)/2)*p);
  function disposeLevel(){
    if(!levelGroup)return;
    levelGroup.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose?.();}});
    glowLevel.traverse(o=>{if(o.isMesh&&o.material!==occluder)o.material.dispose?.();});
    scene.remove(levelGroup);glowScene.remove(glowLevel);levelGroup=null;glowLevel=null;
  }
  function build(level,colorOf){
    disposeLevel();
    N=level.N;p=9.7/N;
    TW=.15*p;TH=.19*p;GW=TW*.82;GD=.33*p;
    grooveU.uPitch.value=p;grooveU.uFloor.value=TOP-GD;gridU.uPitch.value=p;gridU.uHalf.value=N*p/2;
    levelGroup=new THREE.Group();levelGroup.name='Neon_level';
    glowLevel=new THREE.Group();glowScene.add(glowLevel);
    cells=[];for(let r=0;r<N;r++)for(let c=0;c<N;c++)cells.push({r,c,state:'normal',region:level.regions[r].charCodeAt(c)-97,piece:null,j:0,
      press:0,pressT:0,pressV:0,squash:0,squashT:0,led:0,ledT:0,red:0,lift:0,liftV:0,seat:null});
    regions=new Map();pieces=[];
    const holes=[];
    for(const {region,pieces:ps} of layTubes(level.regions)){
      const value=colorOf(region),col=neonOf(value);
      const reg={region,value,pieces:[],cells:[],lit:false};regions.set(region,reg);
      for(const path of ps){
        const line=centreline(path,p,cellPos);
        const cell=new Array(MAXC).fill(0).map(()=>new THREE.Vector4());
        const u={uCell:{value:cell},uCount:{value:path.length},uPitch:{value:p},uTop:{value:TOP},uGD:{value:GD},uTW:{value:TW},uTH:{value:TH},uSqz:{value:.84},uSeed:{value:pieces.length*1.7+region*.9},
          uEmit:{value:new THREE.Color(col.emit)},uLit:{value:0},uLitFrom:{value:0},uLitSpread:{value:0},uLitGain:{value:0},uFront:{value:0}};
        const tube=new THREE.Mesh(tubeGeometry(line),makeTubeMaterial(env,u,col.base));tube.frustumCulled=false;tube.renderOrder=3;
        const spill=new THREE.Mesh(ribbonGeometry(line,TOP+.004,.62*p),makeSpillMaterial(u));spill.renderOrder=2;spill.frustumCulled=false;
        const groove=new THREE.Mesh(grooveGeometry(line,TOP,GW,GD,p),grooveMat);
        levelGroup.add(groove,spill,tube);
        const glow=new THREE.Mesh(tube.geometry,makeGlowMaterial(u));glow.frustumCulled=false;glowLevel.add(glow);
        holes.push(grooveOutline(line,GW+.03*p));
        const piece={reg,path,line,u,tube,spill,cells:[]};
        path.forEach(([r,c],j)=>{const cl=cells[r*N+c];cl.piece=piece;cl.j=j;piece.cells.push(cl);reg.cells.push(cl);});
        reg.pieces.push(piece);pieces.push(piece);
      }
    }
    // board top with the routed channels cut out
    const shape=rrect(new THREE.Shape(),FH-.01,FC);
    for(const h of holes){const path=new THREE.Path(h.map(v=>new THREE.Vector2(v.x,-v.y)));shape.holes.push(path);}
    const tg=new THREE.ShapeGeometry(shape,6);tg.rotateX(-Math.PI/2);tg.translate(0,TOP,0);
    // ShapeGeometry is built in XY with y = -z (see the hole flip above), rotateX(-90°) maps y -> -z
    topMesh=new THREE.Mesh(tg,boardMat);levelGroup.add(topMesh);
    const occ=new THREE.Mesh(tg,occluder);glowLevel.add(occ); // the board hides glow under its surface
    makeSlab(TOP-GD-.03);
    scene.add(levelGroup);
    syncUniforms();prewarm();dirty=true;
  }
  function prewarm(){try{renderer.compile(scene,camera);renderer.compile(glowScene,camera);renderer.render(scene,camera);bloom.render(glowScene,camera,0);}catch(e){console.warn('prewarm',e);}}
  function syncUniforms(){
    for(const pc of pieces){const a=pc.u.uCell.value;pc.cells.forEach((cl,j)=>a[j].set(cl.press,cl.squash,cl.led,cl.red));}
  }

  // ---------- picking ----------
  const ray=new THREE.Raycaster(),ptr=new THREE.Vector2();
  function screenRay(x,y){const rc=renderer.domElement.getBoundingClientRect();ptr.set((x-rc.left)/rc.width*2-1,-(y-rc.top)/rc.height*2+1);ray.setFromCamera(ptr,camera);}
  const pickY=()=>TOP+(TH||.3)*1.2;
  const plane=()=>new THREE.Plane(new THREE.Vector3(0,1,0),-pickY());
  function pick(x,y){screenRay(x,y);const w=ray.ray.intersectPlane(plane(),new THREE.Vector3());if(!w)return null;
    const c=Math.round(w.x/p+(N-1)/2),r=Math.round(w.z/p+(N-1)/2);if(r<0||c<0||r>=N||c>=N)return null;
    return {r,c,local:{x:w.x-(c-(N-1)/2)*p,z:w.z-(r-(N-1)/2)*p},world:w};}
  function worldOf(x,y){screenRay(x,y);return ray.ray.intersectPlane(plane(),new THREE.Vector3());}
  function screenOf(r,c,lift=1.2,dz=0){
    const y=TOP+(TH||.3)*2*Math.min(1.4,lift/1.2);
    const v=cellPos(r,c);v.y=y;v.z+=dz*p;v.project(camera);
    const v2=cellPos(r,c+1);v2.y=y;v2.z+=dz*p;v2.project(camera);
    const rc=renderer.domElement.getBoundingClientRect();
    return {x:rc.left+(v.x+1)/2*rc.width,y:rc.top+(1-v.y)/2*rc.height,size:Math.abs(v2.x-v.x)/2*rc.width};
  }
  function frameRect(){
    const h=FH,rc=renderer.domElement.getBoundingClientRect();
    const pts=[[-h,-h],[h,-h],[-h,h],[h,h]].map(([x,z])=>{const v=new THREE.Vector3(x,TOP,z).project(camera);return [rc.left+(v.x+1)/2*rc.width,rc.top+(1-v.y)/2*rc.height];});
    const xs=pts.map(q=>q[0]),ys=pts.map(q=>q[1]),l=Math.min(...xs),t=Math.min(...ys);return {left:l,top:t,width:Math.max(...xs)-l,height:Math.max(...ys)-t};
  }
  function boardRect(){const a=screenOf(0,0),b=screenOf(N-1,N-1);const h=a.size;return {left:a.x-h,top:a.y-h,width:b.x-a.x+2*h,height:b.y-a.y+2*h};}

  // ---------- animation ----------
  let clock=0,dirty=true,frames=0;
  const timers=[];const at=(t,fn)=>{timers.push({t:clock+t,fn});dirty=true;};
  const litAnims=[];
  function regionCheck(reg){
    const full=reg.cells.every(cl=>cl.state==='glow'||cl.state==='popped');
    if(full&&!reg.lit){
      reg.lit=true;
      const ledCell=reg.cells.find(cl=>cl.state==='glow');
      reg.pieces.forEach((pc,i)=>{
        const from=ledCell&&ledCell.piece===pc?ledCell.j:0;
        const len=pc.cells.length;
        pc.u.uLitFrom.value=from;
        litAnims.push({pc,t0:clock+(ledCell&&ledCell.piece===pc?0:.35),dur:.45+.09*len,reach:Math.max(from,len-1-from)+1.2,on:true});
      });
      if(!celebrating)api.onTubeLit?.(reg.region);
    }else if(!full&&reg.lit){
      reg.lit=false;
      reg.pieces.forEach(pc=>litAnims.push({pc,t0:clock,dur:.25,on:false,g0:pc.u.uLitGain.value}));
    }
  }
  function stepCell(cl,dt){
    // press: stiff spring with a little overshoot (silicone snapping into the channel)
    const k=cl.pressT>=.99?520:300,d=cl.pressT>=.99?30:22;
    const a=(cl.pressT-cl.press)*k-cl.pressV*d;cl.pressV+=a*dt;cl.press+=cl.pressV*dt;
    if(cl.press>1.04){cl.press=1.04;cl.pressV=Math.min(0,cl.pressV)*-.25;}
    if(cl.press<-.6){cl.press=-.6;cl.pressV=0;}
    cl.squash+=(cl.squashT-cl.squash)*Math.min(1,dt*22);
    cl.led+=(cl.ledT-cl.led)*Math.min(1,dt*(cl.ledT>cl.led?9:12));
    cl.red=Math.max(0,cl.red-dt*1.6);
    const busy=Math.abs(cl.pressT-cl.press)>.002||Math.abs(cl.pressV)>.01||Math.abs(cl.squashT-cl.squash)>.003||Math.abs(cl.ledT-cl.led)>.003||cl.red>0;
    if(!busy){cl.press=cl.pressT;cl.pressV=0;cl.squash=cl.squashT;cl.led=cl.ledT;}
    return busy;
  }
  const glowing=()=>cells.some(cl=>cl.led>.01||cl.red>0)||pieces.some(pc=>pc.u.uLit.value>0);
  let last=null,raf=0;
  function loop(now){
    raf=requestAnimationFrame(loop);const loopT0=performance.now();
    try{
      const wall=last===null?0:(now-last)/1000;last=now;if(document.hidden)return;
      const dt=Math.min(.1,Math.max(0,wall));clock+=dt;
      for(let i=timers.length-1;i>=0;i--)if(timers[i].t<=clock){const t=timers.splice(i,1)[0];t.fn();}
      let active=timers.length>0;
      // springs integrate in fixed small steps (stable on slow frames too)
      const nSub=Math.max(1,Math.ceil(dt*120)),h=dt/nSub;
      for(const cl of cells){let b=false;for(let k=0;k<nSub;k++)b=stepCell(cl,h)||b;if(b)active=true;}
      for(let i=litAnims.length-1;i>=0;i--){const L=litAnims[i],u=L.pc.u;const t=Math.min(1,Math.max(0,(clock-L.t0)/L.dur));active=true;
        if(L.on){const e=1-Math.pow(1-t,1.8);u.uLit.value=1;u.uLitSpread.value=.15+L.reach*e;u.uLitGain.value=1+.55*(1-t);u.uFront.value=1.4*(1-t*t);}
        else{u.uLitGain.value=L.g0*(1-t);if(t>=1){u.uLit.value=0;u.uLitSpread.value=0;}}
        if(t>=1){if(L.on){u.uLitGain.value=1;u.uFront.value=0;}litAnims.splice(i,1);}
      }
      if(active){syncUniforms();dirty=true;}
      if(dirty){
        const pf=window.__tubePerf,t0=pf?performance.now():0;
        renderer.render(scene,camera);
        // bloom only while something glows (an LED or a lit tube)
        if(glowing())bloom.render(glowScene,camera,1.35);
        if(pf){pf.js.push(performance.now()-t0+(t0-loopT0));if(pf.lastR)pf.frames.push(t0-pf.lastR);pf.lastR=t0;}
        dirty=false;frames++;}
    }catch(e){console.warn('tube loop',e);}
  }
  raf=requestAnimationFrame(loop);

  let celebrating=false;
  const cellAt=(r,c)=>cells[r*N+c];
  const POP_GAP=.1;let lastSeat=-1,seatIndex=0;
  const api={
    get N(){return N;},get cells(){return cells;},get pieces(){return pieces;},get regions(){return regions;},renderer,scene,camera,
    build(l,c){celebrating=false;build(l,c);fit();lastSeat=-1;seatIndex=0;litAnims.length=0;timers.length=0;},
    clear(){disposeLevel();cells=[];pieces=[];dirty=true;},
    pick,worldOf,screenOf,boardRect,frameRect,cellAt,
    requestFrame(){dirty=true;},refresh(){fit();},
    // finger down: the silicone gives a little under the fingertip
    press(r,c){const cl=cellAt(r,c);if(!cl||cl.state!=='normal')return;cl.pressT=.32;cl.squashT=1;dirty=true;},
    drag(){},
    release(r,c){const cl=cellAt(r,c);if(!cl)return;cl.squashT=0;if(cl.state==='normal'&&!cl.seat)cl.pressT=0;dirty=true;},
    wobble(r,c,pw=.5){const cl=cellAt(r,c);if(!cl)return;cl.pressV-=2.2*pw*(cl.state==='normal'?1:.55);dirty=true;},
    brush(r,c){const cl=cellAt(r,c);if(!cl||cl.state!=='normal')return;cl.pressT=Math.max(cl.pressT,.35);cl.squashT=.8;at(.09,()=>{if(cl.state==='normal'&&!cl.seat){cl.pressT=0;}cl.squashT=0;});},
    // wrong: the tube springs back up out of the groove with a wobble and flashes red
    wrong(r,c){const cl=cellAt(r,c);if(!cl)return;cl.red=1;cl.squashT=0;if(cl.state==='normal'){cl.seat=null;cl.pressT=0;cl.pressV=-7;}dirty=true;},
    // swipe: pressed in dark, one seat after another (each its own "thock")
    popSequence(r,c,{onPop}={}){
      const cl=cellAt(r,c);if(!cl||cl.state!=='normal')return false;
      cl.state='popped';const t=Math.max(clock,lastSeat+POP_GAP);lastSeat=t;cl.seat=t;
      cl.pressT=Math.max(cl.pressT,.35);
      at(t-clock,()=>{if(cl.state!=='popped')return;cl.seat=null;cl.squashT=0;cl.pressT=1;cl.pressV=Math.max(cl.pressV,6);onPop?.(seatIndex++);regionCheck(cl.piece.reg);});
      dirty=true;return true;
    },
    pop(r,c){const cl=cellAt(r,c);if(!cl||cl.state==='popped')return false;cl.state='popped';cl.pressT=1;cl.pressV=6;regionCheck(cl.piece.reg);dirty=true;return true;},
    vanish(r,c){const cl=cellAt(r,c);cl.state='popped';cl.press=cl.pressT=1;regionCheck(cl.piece.reg);syncUniforms();dirty=true;},
    restore(r,c){const cl=cellAt(r,c);if(!cl||cl.state!=='popped')return;cl.state='normal';cl.seat=null;cl.pressT=0;cl.pressV=-5;regionCheck(cl.piece.reg);dirty=true;},
    glow(r,c,on){
      const cl=cellAt(r,c);if(!cl)return;
      if(on){cl.state='glow';cl.pressT=1;cl.pressV=Math.max(cl.pressV,5);cl.squashT=0;cl.led=Math.max(cl.led,.2);cl.ledT=1;
        // a short flash as the LED comes on, then steady
        cl.ledT=2;at(.2,()=>{if(cl.state==='glow')cl.ledT=1.3;});}
      else{cl.state='normal';cl.pressT=0;cl.pressV=-4;cl.ledT=0;}
      regionCheck(cl.piece.reg);dirty=true;
    },
    onTubeLit:null,
    // solved: every tube still lying loose snaps into its groove, one after another, and all tubes light up
    celebrate(){
      celebrating=true;const rest=cells.filter(cl=>cl.state==='normal').sort((a,b)=>(a.r+a.c)-(b.r+b.c));
      const step=Math.min(.035,.75/Math.max(1,rest.length));
      rest.forEach((cl,i)=>at(.05+i*step,()=>{if(cl.state!=='normal')return;cl.state='popped';cl.pressT=1;cl.pressV=6;regionCheck(cl.piece.reg);}));
      for(const reg of regions.values())regionCheck(reg);
    },
    dispose(){cancelAnimationFrame(raf);ro.disconnect();disposeLevel();renderer.dispose();renderer.domElement.remove();},
    get stats(){return {frames,cells:cells.length,pieces:pieces.length,popped:cells.filter(c=>c.state==='popped').length,dpr:renderer.getPixelRatio()};},
    get clock(){return clock;},
  };
  fit();
  return api;
}
