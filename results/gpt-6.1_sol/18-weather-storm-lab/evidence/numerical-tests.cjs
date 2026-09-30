const fs=require('fs'),vm=require('vm'),assert=require('assert');
const file=fs.existsSync('index.html')?fs.readFileSync('index.html','utf8'):'';
const core=file.match(/<script id="simulation-core">([\s\S]*?)<\/script>/);
assert(core,'self-contained simulation core is present');
const c={console,Float32Array,Uint8Array,Math,JSON};vm.createContext(c);vm.runInContext(core[1]+';globalThis.Simulation=Simulation;',c);
const a=new c.Simulation(24,8,731,'mountain'),b=new c.Simulation(24,8,731,'mountain');
assert.deepStrictEqual(Array.from(a.f.q),Array.from(b.f.q),'same seed reproduces vapor');
const start=Object.fromEntries(Object.entries(a.f).map(([k,v])=>[k,Array.from(v)]));
for(let t=0;t<50;t++)a.step(.12);
for(const k of ['u','v','w','t','q','c','r','p']) assert(a.f[k].some((v,i)=>Math.abs(v-start[k][i])>1e-5),k+' evolves');
assert(a.stats().rain>0,'precipitation emerges');
const control=new c.Simulation(24,8,731,'fair'),heated=new c.Simulation(24,8,731,'fair');
for(let i=0;i<8;i++){heated.brush('heat',.48,.52,.2,1,.2);heated.brush('moisture',.48,.52,.2,1,.2);}
for(let t=0;t<70;t++){control.step(.12);heated.step(.12);}
assert(heated.stats().cloud>control.stats().cloud+1e-4,'heat and moisture increase later cloud');
const state=a.serialize();const loaded=new c.Simulation();loaded.load(state);assert.deepStrictEqual(Array.from(loaded.f.q),Array.from(a.f.q),'state roundtrip');
const before=JSON.stringify(loaded.serialize());assert.throws(()=>loaded.load({version:1,n:999999}));assert.equal(JSON.stringify(loaded.serialize()),before,'invalid import is atomic');
state.fields.q[0]=null;assert.throws(()=>loaded.load(state),'null field rejected');
for(const preset of ['fair','sea','mountain','squall','supercell','cyclone','front','city','snow','stress']){const s=new c.Simulation(24,8,42,preset);for(let i=0;i<20;i++)s.step(.25);for(const v of Object.values(s.f))assert(v.every(Number.isFinite),'finite '+preset);}
console.log('PASS: deterministic fields, all eight evolving fields, rain, intervention coupling, exact state roundtrip, atomic malformed rejection, ten stable presets');
