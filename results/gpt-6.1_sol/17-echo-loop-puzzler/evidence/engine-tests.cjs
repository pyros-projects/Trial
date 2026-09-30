const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
assert.ok(fs.existsSync('index.html'),'Application engine must exist');
const html=fs.readFileSync('index.html','utf8');
const script=html.match(/<script id="engine">([\s\S]*?)<\/script>/);
assert.ok(script,'Embedded pure engine must exist');
const scope={};vm.runInNewContext(script[1],scope);const E=scope.EchoEngine;
const fixture={name:'Test chamber',duration:12,width:960,height:540,objects:[
{id:'spawn',type:'spawn',x:80,y:424,w:24,h:36},
{id:'floor',type:'solid',x:0,y:460,w:960,h:80},
{id:'plate',type:'plate',x:200,y:450,w:64,h:10,channel:'A'},
{id:'door',type:'door',x:510,y:250,w:32,h:210,channel:'A'},
{id:'goal',type:'goal',x:860,y:400,w:48,h:60},
{id:'crate',type:'crate',x:140,y:428,w:32,h:32},
{id:'toggle',type:'toggle',x:340,y:424,w:24,h:36,channel:'B'}]};
let pass=0;function test(name,fn){try{fn();console.log('PASS',name);pass++}catch(e){console.error('FAIL',name,e);process.exitCode=1}}
// Catches unbounded/unknown executable fields and broken object references.
test('validates and sanitizes imported JSON',()=>{assert.equal(E.validate(fixture).errors.length,0);assert.ok(E.validate({...fixture,duration:0}).errors.length);assert.ok(E.validate({...fixture,objects:[...fixture.objects,{id:'x',type:'script',x:0,y:0,w:1,h:1}]}).errors.length);assert.ok(E.validate({...fixture,objects:[...fixture.objects,{...fixture.objects[1]}]}).errors.length);const v=E.validate({...fixture,onload:'throw 1'});assert.equal(v.level.onload,undefined);assert.ok(E.validate(null).errors.length);assert.ok(E.validate({...fixture,objects:'bad'}).errors.length)});
// Catches floor tunneling and loss of edge-triggered grounded jump.
test('floor collisions and jumping are stable',()=>{let w=E.create(fixture);for(let i=0;i<180;i++)E.step(w,0);assert.equal(w.player.y,424);assert.equal(w.player.grounded,true);E.step(w,4);assert.ok(w.player.y<424);for(let i=0;i<90;i++)E.step(w,0);assert.equal(w.player.y,424);assert.equal(w.player.grounded,true)});
// Catches carry events failing to replay on the same fixed timestep.
test('echo repeats carry and movement independently',()=>{let w=E.create(fixture);for(let i=0;i<7;i++)E.step(w,2);E.step(w,8);assert.equal(w.player.carry,'crate');for(let i=0;i<35;i++)E.step(w,2);let record=E.record(w);let replay=E.create(fixture,[record]);for(let i=0;i<record.inputs.length;i++){E.step(replay,1);assert.ok(Math.abs(replay.actors[0].x-record.states[i].x)<.001);assert.ok(Math.abs(replay.actors[0].y-record.states[i].y)<.001)}assert.equal(replay.actors[0].carry,'crate');assert.ok(replay.player.x<100);assert.equal(replay.divergence.length,0)});
// Catches switches using visual state rather than actual overlaps.
test('echo holds plate and opens shared door',()=>{const f=JSON.parse(JSON.stringify(fixture));f.objects=f.objects.filter(o=>o.type!=='crate');let w=E.create(f);for(let i=0;i<38;i++)E.step(w,2);for(let i=0;i<10;i++)E.step(w,0);assert.equal(w.channels.A,true);let r=E.create(f,[E.record(w)]);for(let i=0;i<70;i++)E.step(r,0);assert.equal(r.channels.A,true);assert.equal(r.objects.find(o=>o.id==='door').open,true);assert.equal(r.player.x,80)});
// Catches world initial state leaking between attempts.
test('deterministic restart restores crates and switches',()=>{let a=E.create(fixture),b=E.create(fixture);for(let i=0;i<140;i++){const m=i<90?2:0;E.step(a,m);E.step(b,m)}assert.equal(JSON.stringify(a.player),JSON.stringify(b.player));assert.equal(JSON.stringify(a.objects),JSON.stringify(b.objects));let c=E.create(fixture);assert.equal(c.player.x,80);assert.equal(c.objects.find(o=>o.id==='crate').x,140);assert.equal(c.channels.A,undefined)});
// Catches a released overhead crate pulling its carrier upward during collision resolution.
test('dropping a carried core keeps the carrier on the floor',()=>{const w=E.create(fixture);for(let i=0;i<7;i++)E.step(w,2);E.step(w,8);E.step(w,0);E.step(w,8);for(let i=0;i<30;i++)E.step(w,0);assert.equal(w.player.y,424);assert.equal(w.player.grounded,true);assert.equal(w.player.carry,null)});
// Catches silent divergence when a new teammate changes recorded collision outcomes.
test('surfaces significant echo drift when a previously closed gate opens',()=>{const f=JSON.parse(JSON.stringify(fixture));f.objects=f.objects.filter(o=>o.type!=='crate');let w=E.create(f);for(let i=0;i<180;i++)E.step(w,2);assert.equal(w.player.x,486);let r=E.create(f,[E.record(w)]);for(let i=0;i<180;i++)E.step(r,i<38?2:0);assert.equal(r.channels.A,true);assert.ok(r.divergence.length>0);assert.equal(r.actors[0].warning,true)});
// Catches a throw that does not transfer velocity or whose input event cannot replay.
test('throws a core and replays the throw event',()=>{let w=E.create(fixture);for(let i=0;i<7;i++)E.step(w,2);E.step(w,8);E.step(w,0);E.step(w,16);assert.equal(w.player.carry,null);assert.equal(w.objects.find(o=>o.id==='crate').vx,300);assert.equal(w.events.find(e=>e.kind==='throw').frame,9);for(let i=0;i<35;i++)E.step(w,0);const r=E.create(fixture,[E.record(w)]);for(let i=0;i<w.frame;i++)E.step(r,1);const a=w.objects.find(o=>o.id==='crate'),b=r.objects.find(o=>o.id==='crate');assert.ok(Math.abs(a.x-b.x)<.001);assert.ok(Math.abs(a.y-b.y)<.001)});
// Catches echoes stopping forever after a hazard that the original player survived by respawning.
test('echo reproduces hazard respawns on the same frame',()=>{const f=JSON.parse(JSON.stringify(fixture));f.objects=f.objects.filter(o=>o.type!=='crate');f.objects.push({id:'danger',type:'hazard',x:210,y:424,w:16,h:36});let w=E.create(f);for(let i=0;i<85;i++)E.step(w,2);assert.ok(w.deaths>0);let r=E.create(f,[E.record(w)]);for(let i=0;i<85;i++){E.step(r,0);assert.ok(Math.abs(r.actors[0].x-w.states[i].x)<.001,'echo must follow recorded respawn');assert.ok(Math.abs(r.actors[0].y-w.states[i].y)<.001)}assert.equal(r.actors[0].maxDrift,0)});
const transit={name:'Transit collisions',duration:12,width:960,height:540,objects:[{id:'spawn',type:'spawn',x:80,y:364,w:24,h:36},{id:'floor',type:'solid',x:0,y:500,w:960,h:40},{id:'wall',type:'solid',x:300,y:280,w:32,h:220},{id:'lift',type:'lift',x:40,y:400,w:200,h:16,dx:300,dy:0,period:4,auto:true,channel:'A'},{id:'goal',type:'goal',x:850,y:436,w:48,h:64}]};
// Catches horizontal platform motion teleporting a rider to the top of a wall.
test('moving platform carries a rider into wall collision without climbing',()=>{assert.equal(E.validate(transit).errors.length,0);const w=E.create(transit);for(let i=0;i<100;i++){E.step(w,0);assert.ok(w.player.y>=364,'horizontal lift must not move rider up a wall');assert.ok(w.player.x+w.player.w<=300+.001)}});
// Catches a loose core failing to inherit grounded platform movement.
test('loose core rides a moving platform',()=>{const f=JSON.parse(JSON.stringify(transit));f.objects=f.objects.filter(o=>o.type!=='solid'||o.id==='floor');f.objects.push({id:'core',type:'crate',x:140,y:368,w:32,h:32});const w=E.create(f);for(let i=0;i<60;i++)E.step(w,0);const core=w.objects.find(o=>o.id==='core');assert.ok(core.x>270,'core should ride 150px to the right');assert.equal(core.y,368)});
// Catches loss of a user's saved draft while replacing or moving essential geometry.
test('restores unfinished editor drafts as safe data',()=>{const f=JSON.parse(JSON.stringify(fixture));f.name='Unfinished experiment';f.objects=f.objects.filter(o=>o.type!=='goal');const draft=E.restoreDraft(f);assert.equal(draft.name,'Unfinished experiment');assert.equal(draft.objects.length,6);assert.ok(E.validate(draft).errors.length);assert.equal(E.restoreDraft({...f,objects:[{id:'script',type:'script',x:0,y:0,w:20,h:20}]}),null);assert.equal(E.restoreDraft(null),null);assert.equal(E.restoreDraft({...f,objects:[]}).objects.length,0)});
// Catches an echo silently missing its recorded pickup after another actor takes the core.
test('surfaces a missed carry interaction even when positions stay in sync',()=>{const w=E.create(fixture);for(let i=0;i<7;i++)E.step(w,2);E.step(w,8);for(let i=0;i<45;i++)E.step(w,2);const replay=E.create(fixture,[E.record(w)]);for(let i=0;i<w.frame;i++)E.step(replay,i===0?8:0);assert.equal(replay.player.carry,'crate');assert.equal(replay.actors[0].carry,null);assert.equal(replay.actors[0].maxDrift,0);assert.equal(replay.actors[0].warning,true);assert.ok(replay.divergence.length>0)});
console.log(`${pass}/13 behavior checks passed`);
