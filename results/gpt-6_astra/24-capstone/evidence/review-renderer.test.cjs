// Reproducible recording-context checks supplied by the independent final reviewer.
// These inspect the actual renderer, not browser pixels. Real browser tests are separate.
{
const fs=require('node:fs'), vm=require('node:vm'), assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
const renderer=html.slice(html.indexOf(' function drawCloth('),html.indexOf(' function renderSection('));
const sandbox={};vm.createContext(sandbox);vm.runInContext(html.match(/<script id="weave-core">([\s\S]*?)<\/script>/)[1],sandbox);
const W=sandbox.WeaveCore;let units=[];
function context(){const out={draws:[],drawImage(...a){this.draws.push(a)},createLinearGradient(){return {addColorStop(){}}},createPattern(c){return c}};return new Proxy(out,{get(o,k){return k in o?o[k]:(()=>{})}})}
Object.assign(sandbox,{W,geometry:null,view:{back:false,lens:true,zoom:1,threshold:2},selected:{x:0,y:0},tile:(color,axis)=>({color,axis}),document:{createElement(){const c={width:0,height:0,ctx:context(),getContext(){return this.ctx}};units.push(c);return c}}});
vm.runInContext(renderer,sandbox);
let configurations=0,selectedCrossings=0;
for(const n of [8,12,16])for(const rhythm of ['solid','alternating','bands'])for(const back of [false,true])for(const zoom of [0,1,2])for(const [w,h] of [[360,330],[870,400],[1500,980]]){
 const p={...W.initial(),n,rhythm,cells:Array.from({length:n},(_,y)=>Array.from({length:n},(_,x)=>((x*7+y*5)%11)>4?1:0))};
 sandbox.view={back,lens:true,zoom,threshold:2};units=[];sandbox.drawCloth(context(),w,h,p,{back,lens:true,zoom});const g=sandbox.geometry,U=W.repeatSpan(p);
 assert.ok(g.c>0&&g.nx%U===0&&g.ny%U===0);assert.ok(g.tileX>=0&&g.tileY>=0&&g.tileX+n<=g.nx&&g.tileY+n<=g.ny);
 const draws=units[0].ctx.draws;assert.equal(draws.length,2*U*U);
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  const vx=g.tileX+(back?n-1-x:x),vy=g.tileY+y;
  const sourceX=back?g.nx-1-vx:vx;
  assert.equal(W.mod(sourceX,n),x);assert.equal(W.mod(vy,n),y);
  const top=draws[2*((vy%U)*U+(vx%U))+1][0],bit=p.cells[y][x]^(back?1:0),axis=bit?'warp':'weft';
  assert.equal(top.axis,axis);assert.equal(top.color,W.yarn(p,axis,axis==='warp'?x:y));selectedCrossings++;
 }
 configurations++;
}
console.log(`PASS: actual drawCloth geometry and outlined-repeat top-yarn alignment across ${configurations} configurations / ${selectedCrossings} selected crossings.`);
}
{
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),html=fs.readFileSync('index.html','utf8'),s={};vm.createContext(s);vm.runInContext(html.match(/<script id="weave-core">([\s\S]*?)<\/script>/)[1],s);const W=s.WeaveCore;let units=[];
function ctx(){return new Proxy({lines:[],path:[],createLinearGradient(){return {addColorStop(){}}},createPattern(c){return c},beginPath(){this.path=[]},moveTo(x,y){this.path.push([x,y])},lineTo(x,y){this.path.push([x,y])},stroke(){this.lines.push({color:this.strokeStyle,path:this.path.slice()})}},{get(o,k){return k in o?o[k]:(()=>{})}})}
Object.assign(s,{W,geometry:null,view:{back:false,lens:true,zoom:1,threshold:2},selected:{x:0,y:0},tile:(color,axis)=>({color,axis}),document:{createElement(){const c={width:0,height:0,ctx:ctx(),getContext(){return this.ctx}};units.push(c);return c}}});vm.runInContext(html.slice(html.indexOf(' function drawCloth('),html.indexOf(' function renderSection(')),s);
function runLength(p,x,y,axis){const bit=p.cells[y][x],arr=axis==='warp'?p.cells.map(row=>row[x]):p.cells[y],i=axis==='warp'?y:x,n=p.n;if(arr.every(v=>v===bit))return Infinity;let len=1;for(let k=1;k<n&&arr[W.mod(i-k,n)]===bit;k++)len++;for(let k=1;k<n&&arr[(i+k)%n]===bit;k++)len++;return len}
let configurations=0,flagged=0;
for(const pattern of ['plain','unbound','satin','diamond'])for(const back of [false,true]){
 const p={...W.initial(),n:12,rhythm:'bands',cells:W.pattern(pattern,12)};s.view.back=back;units=[];s.drawCloth(ctx(),870,400,p,{back,lens:true,zoom:1});const U=W.repeatSpan(p),overlay=units[1],pitch=overlay.width/U,actual=new Map();
 for(const line of overlay.ctx.lines){const [a,b]=line.path,axis=a[0]===b[0]?'warp':'weft',x=Math.floor(((a[0]+b[0])/2)/pitch),y=Math.floor(((a[1]+b[1])/2)/pitch);actual.set(`${x},${y}`,{axis,color:line.color})}
 for(let y=0;y<U;y++)for(let x=0;x<U;x++){const sx=back?p.n-1-x%p.n:x%p.n,sy=y%p.n,axis=(p.cells[sy][sx]^(back?1:0))?'warp':'weft',len=runLength(p,sx,sy,axis),mark=actual.get(`${x},${y}`);assert.equal(!!mark,len>2,`${pattern} ${back} ${x},${y}`);if(mark){assert.equal(mark.axis,axis);assert.equal(mark.color,len===Infinity?'#a65a00':'#424dca');flagged++}}
 configurations++;
}
console.log(`PASS: actual expanded float overlay matches an independent per-cell cyclic-run check in ${configurations} front/reverse cases, including ${flagged} flagged cells.`)
}
