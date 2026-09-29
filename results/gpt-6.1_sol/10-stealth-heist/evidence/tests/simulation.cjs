const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const file = require('node:path').resolve(__dirname, '../../index.html');
assert.ok(fs.existsSync(file), 'Delivered index.html must exist');
const html = fs.readFileSync(file, 'utf8');
const source = html.match(/<script id="simulation">([\s\S]*?)<\/script>/)?.[1];
assert.ok(source, 'Embedded simulation must be independently inspectable');
const context = vm.createContext({console, Math, Date});
vm.runInContext(source, context);
const {Engine, generate, findPath, lineClear, layoutHash} = context.HeistCore;
let count=0;
function test(name, f) {if(process.env.NIGHTJAR_TEST&&!name.includes(process.env.NIGHTJAR_TEST))return;f(); count++; console.log('PASS '+name);}
const center = (x,y)=>({x:x*32+16,y:y*32+16});
test('seeded missions are connected and primary objective is reachable',()=>{
 for(const preset of ['meridian','dryrun','blackglass']) for(const difficulty of ['rookie','operative','ghost']) for(let seed=0;seed<30;seed++) {
  const m=generate(String(seed),preset,difficulty);
  const reachable=findPath(m,m.entry,m.objective,true);
  assert.ok(reachable.length>0, `${preset} ${difficulty} ${seed} disconnected objective`);
  for(const obj of [...m.terminals,...m.loot,m.extraction]) assert.ok(findPath(m,m.entry,obj,true).length>0, 'inaccessible interaction');
  assert.equal(layoutHash(m),layoutHash(generate(String(seed),preset,difficulty)), 'same seed layout differs');
 }
});
test('walls and closed doors occlude vision; opened doors admit rays',()=>{
 const e=new Engine({seed:'smoke-test',preset:'dryrun',difficulty:'rookie'});
 const d=e.map.doors[0], a=center(d.tx,d.ty-1),b=center(d.tx,d.ty+1);
 d.open=0; assert.equal(lineClear(e.map,a,b),false);
 d.open=1; assert.equal(lineClear(e.map,a,b),true);
});
test('geometry stops movement and noise has position and decay',()=>{
 const e=new Engine({seed:'collision',preset:'dryrun',difficulty:'rookie'});e.start();
 e.player.x=48;e.player.y=48;
 for(let i=0;i<120;i++)e.update(1/60,{x:-1,y:0,run:true});
 assert.ok(e.player.x>=32+e.player.r-0.1,'passed outer wall');
 e.emitSound(e.player.x,e.player.y,220,'test'); const s=e.sounds.at(-1);
 assert.equal(s.x,e.player.x);assert.ok(s.intensity>0);const life=s.life;
 e.update(1/60,{});assert.ok(s.life<life);
});
test('guards investigate acoustic sources and return after local search',()=>{
 const e=new Engine({seed:'acoustic',preset:'dryrun',difficulty:'rookie'});e.start();
 const g=e.guards[0]; e.player.x=e.map.entry.x;e.player.y=e.map.entry.y;
 const acousticX=g.x+20; e.emitSound(acousticX,g.y,180,'decoy');e.update(1/60,{});
 assert.equal(g.state,'investigate');assert.ok(g.lastKnown);assert.equal(g.lastKnown.x,acousticX);
 // The source, not the hidden player, remains the investigation target.
 const sourceX=g.lastKnown.x; e.player.x=e.map.entry.x+10;e.player.y=e.map.entry.y;e.update(1/60,{});
 assert.equal(g.lastKnown.x,sourceX);
 e.sounds=[];for(let i=0;i<1200;i++)e.update(1/60,{});
 assert.ok(['patrol','idle','return'].includes(g.state),'failed to return to duty');
});
test('difficulty changes guards and gadgets consume finite charges',()=>{
 const a=new Engine({seed:'tools',preset:'meridian',difficulty:'rookie'}),b=new Engine({seed:'tools',preset:'meridian',difficulty:'ghost'});
 assert.ok(b.guards.length>a.guards.length);assert.ok(b.rules.view>a.rules.view);
 a.start(); const before=a.player.charges.smoke;a.useGadget('smoke');
 assert.equal(a.player.charges.smoke,before-1);assert.equal(a.smokes.length,1);
 assert.equal(a.useGadget('emp'),false,'shared cooldown must block immediate reuse'); for(let i=0;i<60;i++)a.update(1/60,{});a.useGadget('emp');assert.ok(a.security.empUntil>a.elapsed);
});
console.log(`${count} behavioral groups passed.`);

test('guards lose sight at closed geometry and search last known coordinates',()=>{
 const e=new Engine({seed:'perception',preset:'dryrun',difficulty:'rookie'});e.start();e.guards=e.guards.slice(0,1);e.cameras=[];const g=e.guards[0];Object.assign(g,center(4,10),{angle:0,path:[],state:'idle',idle:30});Object.assign(e.player,center(7,10));
 for(let i=0;i<160&&g.state!=='chase';i++)e.update(1/60,{});
 assert.equal(g.state,'chase');const seen={...g.lastKnown};Object.assign(e.player,e.map.entry);
 for(let i=0;i<110;i++)e.update(1/60,{});
 assert.equal(g.sees,false);assert.equal(g.state,'search');assert.equal(g.lastKnown.x,seen.x);assert.equal(g.lastKnown.y,seen.y);assert.ok(g.searchPoints.length>1);
});
test('walls attenuate sounds and local actions update the player noise signature',()=>{
 const e=new Engine({seed:'hearing',preset:'dryrun',difficulty:'rookie'});e.start();e.guards=e.guards.slice(0,1);e.cameras=[];const g=e.guards[0];Object.assign(g,center(4,10),{angle:0,state:'idle',idle:30});Object.assign(e.player,center(4,14));
 e.emitSound(e.player.x,e.player.y,225,'decoy');assert.equal(e.noise,225);e.update(1/60,{});assert.equal(g.state,'idle','a wall should attenuate the source below hearing range');
 e.emitSound(e.player.x,e.player.y,600,'decoy');e.update(1/60,{});assert.equal(g.state,'investigate');
});
test('canonical run integrity survives JSON key reordering but detects changed coordinates',()=>{
 const {hash,canonical}=context.HeistCore;const e=new Engine({seed:'record',preset:'dryrun',difficulty:'rookie'});e.start();e.update(1/60,{});const r=e.record();
 const reordered=JSON.parse(JSON.stringify(r.record));reordered.samples[0]={guards:reordered.samples[0].guards,objective:reordered.samples[0].objective,alert:reordered.samples[0].alert,y:reordered.samples[0].y,x:reordered.samples[0].x,t:reordered.samples[0].t};
 assert.equal(hash(canonical(reordered)),r.checksum);reordered.samples[0].x+=1;assert.notEqual(hash(canonical(reordered)),r.checksum);
});
test('locked doors can be picked, movement cancels work, and optional intel affects score',()=>{
 const e=new Engine({seed:'lockpick',preset:'dryrun',difficulty:'rookie'});e.start();e.guards=[];e.cameras=[];const door=e.map.doors.find(d=>d.locked);Object.assign(e.player,{x:door.x,y:door.y+32});e.interact();assert.equal(e.action.kind,'lockpick');e.update(1/60,{x:1});assert.equal(e.action,null);e.interact();for(let i=0;i<165;i++)e.update(1/60,{});assert.equal(door.locked,false);assert.equal(door.target,1);
 Object.assign(e.player,e.map.loot[0]);e.interact();assert.equal(e.metrics.loot,1);Object.assign(e.player,{x:e.map.objective.x,y:e.map.objective.y});e.interact();assert.equal(e.player.objective,true);Object.assign(e.player,e.map.extraction);e.interact();assert.equal(e.phase,'escaped');assert.equal(e.summary.loot,1);assert.ok(e.summary.score>2300);
});
console.log(`Final: ${count} behavioral groups passed.`);

test('resting locked doors block walking and tap routes until deliberately unlocked',()=>{
 const e=new Engine({seed:'review-pick',preset:'dryrun',difficulty:'rookie'});e.start();e.guards=[];e.cameras=[];
 const door=e.map.doors.find(d=>d.locked&&d.orientation==='h');Object.assign(e.player,center(door.tx,door.ty+1));
 e.navigatePlayer(center(door.tx,door.ty-1));for(let i=0;i<120;i++)e.update(1/60,{});
 assert.equal(door.open,0,'approach must not open a resting security door');assert.equal(door.target,0);assert.ok(e.player.y>door.y,'closed lock must prevent crossing');assert.equal(e.player.access,false);
 e.interact();assert.equal(e.action.kind,'lockpick');for(let i=0;i<165;i++)e.update(1/60,{});
 assert.equal(door.locked,false);assert.equal(door.target,1);e.navigatePlayer(center(door.tx,door.ty-1));for(let i=0;i<120;i++)e.update(1/60,{});assert.ok(e.player.y<door.y,'deliberately picked door permits crossing');
 // Closing an open door onto the player still reverses, avoiding a trap.
 Object.assign(e.player,{x:door.x,y:door.y});door.open=1;door.target=0;e.update(1/60,{});assert.equal(door.target,1);
});
test('off-center noise investigations reach local search and eventually resume duty',()=>{
 const e=new Engine({seed:'review-navigation',preset:'dryrun',difficulty:'rookie'});e.start();e.guards=e.guards.slice(0,1);e.cameras=[];
 const g=e.guards[0];Object.assign(g,center(4,10),{state:'idle',idle:30,path:[],angle:Math.PI});const source={x:191.5,y:351.5};assert.equal(e.collides(source.x,source.y),false);
 e.emitSound(source.x,source.y,225,'decoy');e.update(1/60,{});assert.equal(g.state,'investigate');
 for(let i=0;i<1800;i++)e.update(1/60,{});
 assert.ok(e.metrics.searches>0,'corner source must be reached instead of investigated forever');assert.ok(['return','idle','patrol'].includes(g.state));
});
test('pursuit closes the distance to a player away from tile centers',()=>{
 const e=new Engine({seed:'review-navigation',preset:'dryrun',difficulty:'rookie'});e.start();e.guards=e.guards.slice(0,1);e.cameras=[];const g=e.guards[0];
 Object.assign(g,center(4,10),{state:'idle',idle:30,path:[],angle:0});Object.assign(e.player,{x:191.5,y:351.5});assert.equal(e.collides(e.player.x,e.player.y),false);
 for(let i=0;i<600&&e.phase==='active';i++)e.update(1/60,{});assert.equal(e.phase,'failed','guards should catch a stationary visible player at a corner');
});
console.log(`Review regressions: ${count} behavioral groups passed.`);

test('dense patrols navigate an alarm response and search simultaneously without geometry errors',()=>{
 const e=new Engine({seed:'BG-20',preset:'blackglass',difficulty:'ghost'});e.start();assert.equal(e.guards.length,7);
 e.alarm('central security camera',center(21,14));let simultaneous=0;
 for(let i=0;i<1800;i++){e.update(1/60,{});simultaneous=Math.max(simultaneous,e.guards.filter(g=>g.state==='search').length);for(const g of e.guards){assert.ok(Number.isFinite(g.x)&&Number.isFinite(g.y));assert.equal(e.collides(g.x,g.y),false,'patrol navigation entered solid geometry');}}
 assert.ok(simultaneous>=3,'several guards should search at once');assert.ok(e.metrics.searches>=3);assert.ok(e.guards.every(g=>g.navVisits>0));assert.equal(e.phase,'active','alarm response should not track the player through a closed room');
});
console.log(`All checks: ${count} behavioral groups passed.`);
