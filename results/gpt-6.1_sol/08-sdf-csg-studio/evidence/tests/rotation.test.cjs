const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8'),ctx={};vm.createContext(ctx);vm.runInContext(html.match(/<script id="scene-core">([\s\S]*?)<\/script>/)[1],ctx);
assert.equal(typeof ctx.SceneCore.inverseQuaternion,'function','primitive inverse rotations are precomputed');
function apply(q,v){const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],a=cross(q,v),b=cross(q,a);return v.map((x,i)=>x+2*(b[i]+q[3]*a[i]));}
function near(a,b){a.forEach((x,i)=>assert.ok(Math.abs(x-b[i])<1e-8,`${a} != ${b}`))}
near(apply(ctx.SceneCore.inverseQuaternion([0,0,90]),[1,0,0]),[0,-1,0]);
near(apply(ctx.SceneCore.inverseQuaternion([90,0,0]),[0,0,1]),[0,1,0]);
near(apply(ctx.SceneCore.inverseQuaternion([0,90,0]),[0,0,1]),[-1,0,0]);
const q=ctx.SceneCore.inverseQuaternion([31,24,-18]);assert.ok(Math.abs(Math.hypot(...q)-1)<1e-12);const pt=apply(q,[2,4,6]);assert.ok(Math.abs(Math.hypot(...pt)-Math.sqrt(56))<1e-8);
console.log('PASS: inverse quaternion orientation and distance preservation');
