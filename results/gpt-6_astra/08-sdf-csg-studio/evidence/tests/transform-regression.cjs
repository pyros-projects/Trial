const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');const SDF=vm.runInNewContext(html.match(/<script id="sdf-core">([\s\S]*?)<\/script>/)[1]+';SDF;');
assert.equal(typeof SDF.inverseRows,'function','Renderer transform coefficients must be computed once per object');
function forward(p,r){let [x,y,z]=p, [a,b,c]=r.map(v=>v*Math.PI/180),t;t=y;y=Math.cos(a)*y-Math.sin(a)*z;z=Math.sin(a)*t+Math.cos(a)*z;t=x;x=Math.cos(b)*x+Math.sin(b)*z;z=-Math.sin(b)*t+Math.cos(b)*z;t=x;x=Math.cos(c)*x-Math.sin(c)*y;y=Math.sin(c)*t+Math.cos(c)*y;return [x,y,z];}
for(const r of [[0,0,0],[90,0,0],[0,90,0],[0,0,90],[76,-22,-24],[-105,237,33]])for(const motion of ['none','spin']){
 const o=SDF.object('box',{rotation:r,motion}),time=1.37,p=[.3,-.72,1.13],effective=r.map((v,i)=>v+(motion==='spin'&&i===1?time*15:0));
 const world=forward(p,effective),rows=SDF.inverseRows(o,time),local=rows.map(row=>row.reduce((v,x,i)=>v+x*world[i],0));
 local.forEach((v,i)=>assert.ok(Math.abs(v-p[i])<1e-10,`${r} inverse transform mismatch`));
}
console.log('PASS: precomputed inverse matrices preserve XYZ rotation order and animated spin.');
