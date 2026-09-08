'use strict';
const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');
const fs = require('node:fs');
assert.ok(fs.existsSync(__dirname + '/model.js'), 'Atmosphere model implementation is missing');
const { Atmosphere, DEFAULT_PARAMS } = require('./model.js');
const fields = ['t','q','c','r','u','v','w','p'];
let passed = 0;
function test(name, fn) { if(process.env.MODEL_TEST_FILTER&&!name.includes(process.env.MODEL_TEST_FILTER))return; const start=performance.now(); fn(); passed++; console.log(`PASS ${name} (${(performance.now()-start).toFixed(1)} ms)`); }
function difference(a,b) { let d=0; for(let i=0;i<a.length;i++) d+=Math.abs(a[i]-b[i]); return d/a.length; }
function finite(sim) { for(const k of fields) assert.ok(sim[k].every(Number.isFinite), k+' finite'); for(const [k,v] of Object.entries(sim.stats())) if(typeof v==='number') assert.ok(Number.isFinite(v),k+' statistic finite'); }
function twin(sim) { return Atmosphere.fromState(JSON.parse(JSON.stringify(sim.serialize()))); }

test('same seed reproduces initial and evolved fields; different seed changes terrain',()=>{
  const a=new Atmosphere(),b=new Atmosphere(),c=new Atmosphere({seed:9284});
  for(const k of fields) assert.deepEqual(a[k],b[k]);
  assert.ok(difference(a.terrain,c.terrain)>0.001);
  for(let i=0;i<4;i++){a.step();b.step();}
  for(const k of fields) assert.deepEqual(a[k],b[k]);
});
test('default isolated developed clouds and all principal fields evolve',()=>{
  const a=new Atmosphere(); const before=twin(a), initial=a.stats();
  assert.ok(Math.max(...a.c)>0.5); assert.ok(initial.cloudCover>0.02 && initial.cloudCover<0.8);
  assert.ok(initial.maxUpdraft>3); assert.ok(initial.rain>0);
  for(let i=0;i<12;i++)a.step();
  assert.equal(a.time,36); assert.equal(a.steps,12);
  for(const k of fields) assert.ok(difference(a[k],before[k])>1e-6,k+' evolves');
  finite(a);
});
test('paused brushing is local and time independent; delayed moisture and heat cause cloud response',()=>{
  const a=new Atmosphere({preset:'cumulus',n:24,l:8}), b=twin(a), c=twin(a);
  const old=a.sample(0,1,0); a.brush('heat',0,0,5,3,1); a.brush('moisture',0,0,5,3,1);
  assert.equal(a.time,0); assert.ok(a.sample(0,1,0).temperature>old.temperature); assert.ok(a.sample(0,1,0).vapor>old.vapor);
  b.brush('moisture',0,0,5,1,0.2); c.brush('moisture',0,0,5,1,0.1); c.brush('moisture',0,0,5,1,0.1);
  assert.ok(difference(b.q,c.q)<1e-6);
  const control=new Atmosphere({preset:'cumulus',n:24,l:8});
  for(let i=0;i<60;i++){a.step();control.step();}
  assert.ok(difference(a.c,control.c)>1e-5,'cloud responds after transport and condensation');
  assert.ok(difference(a.r,control.r)>1e-7,'rain responds after cloud conversion');
});
test('wind, rotation and terrain coupling controls change flow',()=>{
  const a=new Atmosphere({n:24,l:8}),b=twin(a),c=twin(a),d=twin(a);
  b.params.wind=40;c.params.terrainInfluence=0;d.params.rotation=-2;
  for(let i=0;i<20;i++){a.step();b.step();c.step();d.step();}
  assert.ok(difference(a.u,b.u)>0.1);assert.ok(difference(a.w,c.w)>0.001);assert.ok(difference(a.v,d.v)>0.001);
});
test('precipitation falls, ground accumulation is monotonic, and zero precipitation disables new rain',()=>{
  const a=new Atmosphere({n:24,l:8}), b=twin(a); b.params.precipitation=0;
  let total=a.stats().precipTotal;
  for(let i=0;i<50;i++){a.step();b.step();assert.ok(a.stats().precipTotal>=total);total=a.stats().precipTotal;}
  assert.ok(total>0);assert.ok(difference(a.r,b.r)>0.0001);
});
test('condensation threshold selects whether identical supersaturated air forms cloud',()=>{
  const low=new Atmosphere({n:24,l:8,params:{dt:.25,substeps:1,wind:0,rotation:0,evaporation:0,precipitation:0,diffusion:0,buoyancy:0,terrainInfluence:0,humidity:110,condensation:.8}});
  low.terrain.fill(0);low.t.fill(20);low.q.fill(low.qSaturation(20)*1.1);
  for(const key of ['u','v','w','p','c','r'])low[key].fill(0);
  const high=twin(low);high.params.condensation=1.2;
  low.step();high.step();
  assert.ok(low.c.every(value=>value>0),'110% RH forms cloud above an 80% RH threshold');
  assert.ok(high.c.every(value=>value===0),'110% RH forms no cloud below a 120% RH threshold');
  assert.ok(low.q[0]<high.q[0],'condensation transfers vapor to cloud');
  assert.ok(low.t[0]>high.t[0],'condensation releases latent heat');
  console.log(' threshold response',JSON.stringify({lowThresholdCloud:low.c[0],highThresholdCloud:high.c[0]}));
});
test('cloud evaporation uses actual saturation separately from the condensation threshold',()=>{
  const humid=new Atmosphere({n:24,l:8,params:{dt:.25,substeps:1,wind:0,rotation:0,evaporation:0,precipitation:0,diffusion:0,buoyancy:0,terrainInfluence:0,humidity:110,condensation:1.2}});
  humid.terrain.fill(0);humid.t.fill(20);humid.q.fill(humid.qSaturation(20)*1.1);humid.c.fill(1);
  for(const key of ['u','v','w','p','r'])humid[key].fill(0);
  const dry=twin(humid);dry.q.fill(dry.qSaturation(20)*.9);
  humid.step();dry.step();
  // Only the independent weak mixing loss should act between 100% RH and the 120% threshold.
  assert.ok(humid.c.every(value=>value>.9999&&value<1),'supersaturated existing cloud survives below its formation threshold');
  assert.ok(dry.c.every(value=>value<.995),'sub-saturated air evaporates existing cloud');
  console.log(' cloud evaporation response',JSON.stringify({humidCloud:humid.c[0],dryCloud:dry.c[0]}));
});
test('sedimentation uses the donor fall speed across the freezing level',()=>{
  const a=new Atmosphere({n:24,l:8,params:{dt:.25,substeps:1,wind:0,rotation:0,evaporation:0,precipitation:0,diffusion:0,buoyancy:0,terrainInfluence:0,humidity:100}});
  a.terrain.fill(0);a.u.fill(0);a.v.fill(0);a.w.fill(0);a.p.fill(0);a.c.fill(0);a.r.fill(1);
  for(let y=0;y<a.l;y++)for(let j=0;j<a.n*a.n;j++){const i=j+a.n*a.n*y;a.t[i]=y<4?10:-10;a.q[i]=a.qSaturation(a.t[i]);}
  const start=Array.from(a.r).reduce((s,v)=>s+v,0)/(a.n*a.n);a.step();
  const after=Array.from(a.r).reduce((s,v)=>s+v,0)/(a.n*a.n)+a.precipTotal/(6000/7*1.08/1000);
  // The small tolerance allows evaporation driven by the quarter-second thermal source.
  assert.ok(Math.abs(after-start)<0.00003,`rain mass error across freezing level: ${after-start}`);
});
test('surface rainfall replenishes the local soil reservoir on elevated terrain',()=>{
  const wet=new Atmosphere({n:24,l:8,params:{dt:.25,substeps:1,wind:0,rotation:0,evaporation:0,precipitation:0,diffusion:0,buoyancy:0,terrainInfluence:0,humidity:100}});
  wet.terrain.fill(1);wet.surface.fill(0);wet.moisture.fill(.5);
  for(const key of ['u','v','w','p','c','r'])wet[key].fill(0);
  wet.t.fill(20);wet.q.fill(wet.qSaturation(20));
  const dry=twin(wet),nn=wet.n*wet.n;
  // y=0 is inside terrain; y=1 is the first atmospheric layer.
  wet.r.fill(10,nn,nn*2);wet.step();dry.step();
  assert.ok(wet.precipTotal>0,'precipitation reaches the raised ground boundary');
  assert.equal(dry.precipTotal,0);assert.equal(dry.moisture[0],.5);
  for(let j=0;j<nn;j++)assert.ok(wet.moisture[j]>dry.moisture[j],'surface rain must increase soil moisture');
  // A 100 mm available-water reservoir converts local rainfall mm to a 0..1 fraction.
  const gain=Array.from(wet.moisture).reduce((sum,value)=>sum+value-.5,0)/nn;
  assert.ok(Math.abs(gain*100-wet.precipTotal)<0.000003,'rainfall and soil-water gain use consistent units');
  console.log(' elevated-terrain rainfall',JSON.stringify({precipitationMm:wet.precipTotal,soilMoisture:wet.moisture[0],dryMoisture:dry.moisture[0]}));
});
test('exact dt, adaptive subdivisions and long stress stay finite',()=>{
  const a=new Atmosphere({preset:'stress',n:24,l:8,params:{dt:12,substeps:1}});
  a.step(11.25);assert.equal(a.time,11.25);assert.ok(a.stats().substeps>=1);assert.ok(a.stats().cfl<=0.91);
  a.u.fill(120);a.v.fill(120);a.w.fill(65);a.step(12);assert.ok(a.stats().substeps>1,'adaptive subdivision is exercised');
  for(let i=0;i<160;i++)a.step(); finite(a);assert.equal(a.time,1943.25);
  console.log(' stress statistics',JSON.stringify(a.stats()));
});
test('supercell remains cloudy after more than 1000 seconds',()=>{
  const a=new Atmosphere({n:24,l:8});for(let i=0;i<90;i++)a.step(12);
  finite(a);assert.ok(a.stats().cloud>0.005);assert.ok(a.stats().cloudCover>0.01);
  console.log(' long-run supercell statistics',JSON.stringify(a.stats()));
});
test('default supercell retains developed cloud structure throughout the first 1000 seconds',()=>{
  const a=new Atmosphere();
  for(const target of [210,420,630,1080]){
    while(a.time<target)a.step();
    const stats=a.stats();let peakCloud=0;for(const value of a.c)peakCloud=Math.max(peakCloud,value);
    console.log(' default storm development',JSON.stringify({time:a.time,cloudCover:stats.cloudCover,cloud:stats.cloud,peakCloud,maxUpdraft:stats.maxUpdraft,rain:stats.rain}));
    // Keep a substantial cloud footprint and open terrain, with room for numerical/resolution variation.
    assert.ok(stats.cloudCover>=.1&&stats.cloudCover<.65,'developed localized cloud cover at '+target+' seconds');
    assert.ok(stats.cloud>.02,'volume condensate remains developed at '+target+' seconds');
    assert.ok(peakCloud>.5,'developed condensate mass remains at '+target+' seconds');
    assert.ok(stats.maxUpdraft>3,'convective flow remains at '+target+' seconds');finite(a);
  }
});
test('all presets are deterministic, distinct, and snow starts below freezing',()=>{
  const ids=['cumulus','sea','mountain','squall','supercell','cyclone','front','heat','snow','stress']; const signatures=new Set();
  for(const preset of ids){const a=new Atmosphere({preset,n:24,l:8});finite(a);signatures.add(JSON.stringify([a.stats().temperature,a.stats().cloud,a.params.wind]));if(preset==='snow')assert.ok(a.sample(0,0,0).temperature<0);}
  assert.equal(signatures.size,ids.length);
});
test('state round trip preserves next-step fields and diagnostic metadata exactly',()=>{
  const a=new Atmosphere({n:24,l:8});a.brush('raise',0,0,3,2,0.4);a.brush('lake',2,1,2,1);for(let i=0;i<8;i++)a.step();
  const b=twin(a);assert.deepEqual(a.serialize(),b.serialize());a.step(8.7);b.step(8.7);
  for(const k of fields)assert.deepEqual(a[k],b[k]);assert.deepEqual(a.stats(),b.stats());
});
test('invalid imports reject missing fields, nonfinite values, bad types/ranges and unsupported grids',()=>{
  const a=new Atmosphere({n:24,l:8});const base=a.serialize();
  const changes=[s=>delete s.q,s=>s.t[2]=NaN,s=>s.c[0]=-1,s=>s.terrain[0]=9,s=>s.surface[0]=8,s=>s.surface[0]=1.2,s=>s.moisture[0]=-1,s=>s.n=31,s=>s.l=9,s=>s.rngState=-1,s=>s.time=-1,s=>s.steps=0.5,s=>s.params.dt=0,s=>s.params.substeps=1.5,s=>delete s.params.wind,s=>s.preset='bad',s=>s.seed='bad',s=>s.t.pop(),s=>s.version=2,s=>s.precipTotal=Infinity];
  for(const mutate of changes){const state=structuredClone(base);mutate(state);assert.throws(()=>Atmosphere.fromState(state));}
});
test('constructor and import reject non-string preset identifiers without coercion',()=>{
  const base=new Atmosphere({n:24,l:8}).serialize();
  for(const preset of [['supercell'],new String('supercell'),{toString:()=> 'supercell'},null,5]){
    assert.throws(()=>new Atmosphere({n:24,l:8,preset}),'constructor rejects non-string preset');
    assert.throws(()=>Atmosphere.fromState({...base,preset}),'state import rejects non-string preset');
  }
  const jsonState=JSON.parse(JSON.stringify({...base,preset:['supercell']}));
  assert.throws(()=>Atmosphere.fromState(jsonState),'JSON array-valued preset is rejected');
});
test('resize preserves time, parameters and approximate field means, and samples/columns agree',()=>{
  const a=new Atmosphere({n:24,l:8});a.step();const old=a.stats();const b=a.resize(48,16);
  assert.equal(b.n,48);assert.equal(b.l,16);assert.equal(b.time,a.time);assert.deepEqual(b.params,a.params);
  assert.equal(b.t.length,48*48*16);assert.equal(b.terrain.length,48*48);assert.ok(Math.abs(old.temperature-b.stats().temperature)<1);
  const col=b.column(0,0);assert.equal(col.length,16);assert.equal(col[0].altitude,0);assert.equal(col[15].altitude,6);
  assert.equal(col[5].temperature,b.sample(0,5/15*12,0).temperature);finite(b);
});
test('every brush is usable and terrain/surface edits are bounded',()=>{
  const a=new Atmosphere({n:24,l:8});const initial=a.serialize();
  for(const tool of ['cool','dry','wind','pressure','cloud','raise','lower','lake','forest','city','ocean'])assert.ok(a.brush(tool,0,0,3,2,0.5)>0);
  assert.ok(difference(initial.p,a.p)>0);assert.ok(difference(initial.u,a.u)>0);assert.ok(difference(initial.c,a.c)>0);assert.equal(a.time,0);
  assert.ok(a.terrain.every(v=>v>=0&&v<=3.8));assert.ok(a.surface.every(v=>v>=0&&v<=4));
});
test('default step runtime is measured',()=>{
  const a=new Atmosphere();for(let i=0;i<3;i++)a.step();const start=performance.now();for(let i=0;i<10;i++)a.step();
  console.log(` default 32×32×12: ${((performance.now()-start)/10).toFixed(2)} ms/step`);
  assert.equal(DEFAULT_PARAMS.dt,3);
});
console.log(`${passed} model checks passed`);
