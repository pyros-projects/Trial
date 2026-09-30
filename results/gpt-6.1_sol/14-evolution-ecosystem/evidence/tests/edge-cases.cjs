const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8'),ctx={console,performance};vm.createContext(ctx);vm.runInContext(html.match(/<script id="engine">([\s\S]*?)<\/script>/)[1],ctx);
const {Ecosystem}=ctx.EcoCore;let failures=0;
function test(name,fn){try{fn();console.log('PASS',name);}catch(e){failures++;console.log('FAIL',name,e.message);}}
test('balanced meadow retains all roles at 180 simulation seconds',()=>{const s=new Ecosystem({seed:'meadow-42'});for(let i=0;i<1800;i++)s.step();const m=s.metrics();console.log('Measured role counts:',m.gatherer,m.predator,m.decomposer);assert.ok(m.gatherer>10);assert.ok(m.predator>0);assert.ok(m.decomposer>0);});
test('missing accounting state is rejected atomically',()=>{const d=new Ecosystem().serialize();delete d.totals;assert.throws(()=>Ecosystem.restore(d));});
test('invalid terrain coordinates are rejected',()=>{const d=new Ecosystem().serialize();d.terrain[0].x=null;assert.throws(()=>Ecosystem.restore(d));});
test('predator introduction with no open habitat does not hang',()=>{vm.runInContext('globalThis.emptyHabitat = new EcoCore.Ecosystem(); emptyHabitat.terrain.forEach(c=>c.barrier=true);',ctx);vm.runInContext('emptyHabitat.intervene("predators")',ctx,{timeout:150});assert.equal(ctx.emptyHabitat.organisms.length,196);});
test('invalid live mutation is rejected before state can be applied',()=>{const d=new Ecosystem().serialize();d.organisms[16].mutations=[null];assert.throws(()=>Ecosystem.restore(d));});
test('nextId cannot reuse a dead archived lineage id',()=>{const d=new Ecosystem().serialize();const removed=d.organisms.pop();d.lineage[removed.id].died=0;d.nextId=removed.id;assert.throws(()=>Ecosystem.restore(d));});
test('introductions respect the persistence-compatible population cap',()=>{const s=new Ecosystem({preset:'stress'});for(let i=0;i<140;i++)s.intervene('predators');assert.ok(s.organisms.length<=4000);assert.doesNotThrow(()=>Ecosystem.restore(s.serialize()));});
test('paused habitat loss removes dead agents from live counts and remains saveable',()=>{const s=new Ecosystem({size:'small'});for(let x=0;x<=1000;x+=200)for(let y=0;y<=800;y+=200)s.paint(x,y,'barrier',150);assert.equal(s.organisms.length,s.organisms.filter(o=>o.health>0).length);assert.equal(s.organisms.length,0);assert.doesNotThrow(()=>Ecosystem.restore(s.serialize()));});
test('unsafe imported identifiers are rejected',()=>{const d=new Ecosystem().serialize();d.nextId=1e30;assert.throws(()=>Ecosystem.restore(d));});
test('paused climate painting immediately updates visible fields',()=>{const s=new Ecosystem(),c=s.cellAt(800,550),before=c.temperature;s.paint(800,550,'climate',65,'warm');assert.ok(c.temperature>before);});
test('incomplete saved obstacle avoidance is rejected before continuation',()=>{const s=new Ecosystem();for(let i=0;i<3;i++)s.step();const d=JSON.parse(JSON.stringify(s.serialize()));d.organisms[16].obstacleTarget={d:0};assert.throws(()=>Ecosystem.restore(d));});
process.exitCode=failures?1:0;
