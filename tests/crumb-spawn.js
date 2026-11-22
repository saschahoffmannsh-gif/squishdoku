// Regression: a freshly spawned crumb must never be drawn with an identity matrix (iPhone bug: a cell-sized
// faceted block at the board centre after a pop). Prints count/identity per pool (identity must be 0).
const { chromium } = require('playwright-core');
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const p=await (await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto(process.env.U||'http://localhost:8792/index.html');await p.waitForFunction(()=>document.documentElement.dataset.ready==='1');
await p.evaluate(()=>SquishDoku.startLevel(10));await new Promise(r=>setTimeout(r,3000));
console.log(await p.evaluate(()=>{const B=SquishDoku.board;B.pop(2,2);B.crumbs.emit(B.cellAt(2,2).s.ck,{amount:.05,z0:-.2,z1:.2});
 const out=[];for(const P of B.crumbs.pools){const M=P.mesh.instanceMatrix.array;let ident=0;for(let i=0;i<P.mesh.count;i++){const j=i*16;if(M[j]===1&&M[j+5]===1&&M[j+10]===1&&M[j+12]===0&&M[j+14]===0)ident++;}out.push(P.mesh.count+'/'+ident);}return 'count/identity '+out.join(' ');}));
await new Promise(r=>setTimeout(r,4000));await p.screenshot({path:'/workspace/squish-doku/shots/ck-popped-center-390x844.png'});
console.log(await p.evaluate(()=>{const B=SquishDoku.board,ck=B.cellAt(2,2).s.ck;return JSON.stringify({inner:ck.inner.visible,dissolve:!!B.cellAt(2,2).dissolve,alive:B.crumbs.alive,counts:B.crumbs.pools.map(P=>P.mesh.count)});}),errs);
await b.close();})();
