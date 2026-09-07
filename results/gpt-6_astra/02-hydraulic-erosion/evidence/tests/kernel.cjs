// Real embedded simulation tests. Removing flux, sediment exchange, validation,
// evaporation, or deterministic seeding must break the associated assertion.
const fs=require('fs'), vm=require('vm'), assert=require('node:assert/strict');
const path=require('path');
const html=fs.existsSync(path.join(__dirname,'../../index.html'))?fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8'):'';
const source=html.match(/<script id="sim-core">([\s\S]*?)<\/script>/)?.[1];
assert.ok(source,'The application must provide its real simulation kernel');
const ctx=vm.createContext({console});vm.runInContext(source+';globalThis.Simulation=Simulation;',ctx);const Sim=ctx.Simulation;
const sum=a=>a.reduce((x,y)=>x+y,0);
const advance=(s,steps=200)=>{for(let i=0;i<steps;i++)s.step(.04);};
const flat=()=>{const s=new Sim(32,42,'mountain');s.h.fill(10);s.initial.set(s.h);s.w.fill(0);s.s.fill(0);s.q.fill(0);Object.assign(s.p,{rain:0,evap:0,erosion:0,deposition:0,thermal:0,flow:1.5});return s;};
let tests=0;function test(name,f){f();console.log('PASS '+name);tests++;}
test('identical seed and parameters regenerate identical terrain',()=>{const a=new Sim(32,42,'mountain'),b=new Sim(32,42,'mountain'),c=new Sim(32,43,'mountain');assert.deepEqual(Array.from(a.h),Array.from(b.h));assert.notDeepEqual(Array.from(a.h),Array.from(c.h));});
test('water flows from high surface to lower neighbors, conserves water before reaching boundary',()=>{const s=flat(),i=16*32+16;s.w[i]=5;const before=sum(s.w);s.step(.04);assert.ok(s.w[i]<5);assert.ok(s.w[i+1]>0);assert.ok(Math.abs(sum(s.w)+s.drained-before)<1e-4);});
test('sediment follows water and is conserved with bed + boundary outflow',()=>{const s=flat(),i=16*32+16;s.w[i]=5;s.s[i]=2;const before=sum(s.h)+sum(s.s);advance(s,80);assert.ok(s.s[i]<2);assert.ok(s.s[i+1]>0);assert.ok(Math.abs(sum(s.h)+sum(s.s)+s.sedimentOut-before)<.03);});
test('gravity-driven water changes underlying height and produces sediment',()=>{const s=new Sim(48,95,'mountain');s.p.thermal=0;const before=Array.from(s.h);advance(s,400);const change=s.h.reduce((v,h,i)=>v+Math.abs(h-before[i]),0);assert.ok(change>1,'mutable geometry');assert.ok(sum(s.s)+s.sedimentOut>0.1,'sediment produced');assert.ok(s.eroded>0,'cumulative erosion');});
test('higher erosion creates more sediment for same seed',()=>{const a=new Sim(32,25,'mountain'),b=new Sim(32,25,'mountain');a.p.thermal=b.p.thermal=0;a.p.erosion=0;b.p.erosion=1;advance(a,300);advance(b,300);assert.equal(a.eroded,0);assert.ok(b.eroded>1);});
test('evaporation removes water without losing sediment',()=>{const s=flat();s.w.fill(1);s.s.fill(.2);s.p.flow=0;s.p.evap=.5;const mass=sum(s.h)+sum(s.s);advance(s,150);assert.ok(sum(s.w)<32*32*.06);assert.ok(Math.abs(sum(s.h)+sum(s.s)-mass)<.02);});
test('dry sediment deposits into actual terrain',()=>{const s=flat(),i=16*32+16;s.s[i]=2;s.step(.04);assert.ok(s.h[i]>10);assert.ok(s.s[i]<2);assert.ok(Math.abs(s.h[i]+s.s[i]-12)<1e-5);});
test('stress settings stay finite and nonnegative',()=>{const s=new Sim(48,52,'stress');Object.assign(s.p,{rain:.5,erosion:2,deposition:2,capacity:12,flow:5,thermal:1,evap:0});advance(s,1000);for(let i=0;i<s.h.length;i++){assert.ok(Number.isFinite(s.h[i])&&Number.isFinite(s.w[i])&&Number.isFinite(s.s[i]));assert.ok(s.w[i]>=0&&s.s[i]>=0&&s.h[i]>=-20&&s.h[i]<=250);}assert.equal(s.repairs,0);});
test('numerical recovery keeps primary layers, deltas, velocity and budgets finite',()=>{for(const key of ['h','w','s','q']){const s=new Sim(32,52,'mountain');s[key][500]=NaN;advance(s,10);assert.ok(s.repairs>0);for(const layer of ['h','w','s','q','delta','vx','vz'])assert.ok(s[layer].every(Number.isFinite),key+' poisoning '+layer);for(const [name,value]of Object.entries(s.metrics()))assert.ok(Number.isFinite(value),key+' poisoning metric '+name);}});
test('reported volumes use the same 200 by 200 meter domain at every resolution',()=>{for(const n of [64,128,256]){const s=new Sim(n,42,'mountain');s.w.fill(1);s.s.fill(.25);assert.ok(Math.abs(s.metrics().water-40000)<1e-6);assert.ok(Math.abs(s.metrics().sediment-10000)<1e-6);}});
console.log(`${tests} simulation checks passed`);
