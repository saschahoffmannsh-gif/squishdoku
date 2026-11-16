const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function voyageCurrent(state,levels){
 // Only completing the preceding islands opens the next campaign stage.
 // Developer test-level selection must never unlock the whole voyage.
 return (levels.find(l=>!state.completed.includes(l.id))||levels.at(-1)).id;
}
export function voyageAccess(state,id){return id===1||(Number.isInteger(id)&&id>1&&(state.unlocked.includes(id)||state.completed.includes(id))&&Array.from({length:id-1},(_,i)=>i+1).every(n=>state.completed.includes(n)));}
export function voyageIsland(index){
 const names=['palm','crescent','rock','cove'],turns=[-8,14,-19,26];
 return{asset:`./assets/voyage/island-${names[index%4]}.png`,rotation:turns[Math.floor(index/4)%4]+(index%4)*3,mirror:Math.floor(index/8)%2?-1:1};
}
export function voyageNodes(count,width,step,padding){
 return Array.from({length:count},(_,i)=>{const x=(.5+Math.sin(i*1.55-.35)*.16)*width;return{x,y:padding+i*step,stationX:clamp(x+(x<width*.5?1:-1)*width*.29,width*.23,width*.77)};});
}
export function voyagePoint(nodes,progress){
 const q=clamp(progress,0,nodes.length-1),i=Math.min(Math.floor(q),nodes.length-2),t=q-i;
 if(nodes.length===1)return{...nodes[0],angle:180};
 const a=nodes[Math.max(0,i-1)],b=nodes[i],c=nodes[i+1],d=nodes[Math.min(nodes.length-1,i+2)],t2=t*t,t3=t2*t;
 const value=k=>.5*((2*b[k])+(-a[k]+c[k])*t+(2*a[k]-5*b[k]+4*c[k]-d[k])*t2+(-a[k]+3*b[k]-3*c[k]+d[k])*t3);
 const slope=k=>.5*((-a[k]+c[k])+2*(2*a[k]-5*b[k]+4*c[k]-d[k])*t+3*(-a[k]+3*b[k]-3*c[k]+d[k])*t2);
 return{x:value('x'),y:value('y'),angle:Math.atan2(slope('y'),slope('x'))*180/Math.PI+90};
}
export function voyagePath(nodes){
 let path=`M${nodes[0].x},${nodes[0].y}`;
 for(let i=0;i<nodes.length-1;i++){const a=nodes[Math.max(0,i-1)],b=nodes[i],c=nodes[i+1],d=nodes[Math.min(nodes.length-1,i+2)];path+=` C${b.x+(c.x-a.x)/6},${b.y+(c.y-a.y)/6} ${c.x-(d.x-b.x)/6},${c.y-(d.y-b.y)/6} ${c.x},${c.y}`;}
 return path;
}
export function voyageProgress(current,scroll,anchor,step,count){return clamp(current+(scroll-anchor)/step,0,count-1);}
