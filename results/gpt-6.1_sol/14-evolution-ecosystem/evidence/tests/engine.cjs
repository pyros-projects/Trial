const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const file = path.resolve(__dirname, '../../index.html');
assert.ok(fs.existsSync(file), 'Standalone application index.html exists');
const html = fs.readFileSync(file, 'utf8');
const script = html.match(/<script id="engine">([\s\S]*?)<\/script>/);
assert.ok(script, 'Simulation engine is embedded in the delivered HTML');
const ctx = { console, performance }; vm.createContext(ctx); vm.runInContext(script[1], ctx);
const { Ecosystem } = ctx.EcoCore;
const test = (name, fn) => { fn(); console.log('PASS', name); };
const fresh = opts => new Ecosystem({seed:'meadow-42', preset:'meadow', ...opts});
test('same seed reproduces initial conditions and deterministic steps', () => {
 const a=fresh(), b=fresh(); assert.equal(JSON.stringify(a.serialize()), JSON.stringify(b.serialize()));
 for(let i=0;i<350;i++){a.step();b.step();} assert.equal(JSON.stringify(a.serialize()),JSON.stringify(b.serialize()));
});
test('actual ecology feeds, reproduces, mutates, dies and records history', () => {
 const a=fresh(); const initial=a.organisms.length; for(let i=0;i<1800;i++)a.step();
 assert.ok(a.totals.fed>0); assert.ok(a.totals.births>0); assert.ok(a.totals.deaths>0);
 assert.notEqual(a.organisms.length,initial); assert.ok(a.history.length>10);
 const children=Object.values(a.lineage).filter(x=>x.parent); assert.ok(children.length>0);
 assert.ok(children.some(x=>x.mutations.length>0));
 children.forEach(x=>{assert.ok(a.lineage[x.parent]);assert.equal(x.generation,a.lineage[x.parent].generation+1);});
 assert.ok(a.organisms.every(x=>Number.isFinite(x.energy)&&x.energy>=0&&x.health>0));
});
test('saved state preserves genes, lineage, PRNG, fields and deterministic continuation', () => {
 const a=fresh(); for(let i=0;i<400;i++)a.step();
 const data=JSON.parse(JSON.stringify(a.serialize())); const b=Ecosystem.restore(data);
 assert.equal(JSON.stringify(a.serialize()),JSON.stringify(b.serialize()));
 for(let i=0;i<100;i++){a.step();b.step();}assert.equal(JSON.stringify(a.serialize()),JSON.stringify(b.serialize()));
});
test('reproductive energy transfer cannot create energy', () => {
 const a=fresh(), p=a.organisms[0]; p.energy=140;p.age=30;p.cooldown=0;
 const before=p.energy; const child=a.reproduce(p);
 assert.ok(child);assert.ok(p.energy+child.energy<before);assert.equal(child.parent,p.id);
 assert.equal(child.generation,p.generation+1);assert.ok(a.lineage[p.id].children.includes(child.id));
});
test('intervention has measurable resource and climate effects', () => {
 const a=fresh();const b=Ecosystem.restore(JSON.parse(JSON.stringify(a.serialize())));
 b.intervene('drought');for(let i=0;i<500;i++){a.step();b.step();}
 assert.ok(b.metrics().resources<a.metrics().resources);assert.ok(b.metrics().moisture<a.metrics().moisture);
});
test('invalid state is rejected without a partial simulation', () => {
 assert.throws(()=>Ecosystem.restore({version:1}));
 const d=fresh().serialize();d.organisms[0].energy=NaN;assert.throws(()=>Ecosystem.restore(d));
});
console.log('All engine checks passed');
