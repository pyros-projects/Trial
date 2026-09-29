const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const artifact = path.resolve(__dirname, '../../index.html');
let Physics;
if (fs.existsSync(artifact)) {
  const source = fs.readFileSync(artifact, 'utf8').match(/<script id="physics-core">([\s\S]*?)<\/script>/);
  if (source) { const context = vm.createContext({console, Math, Map, Set, performance}); vm.runInContext(source[1], context); Physics = context.Physics; }
}
function world(extra = {}) {
  assert.ok(Physics?.World, 'The delivered artifact must contain a working embedded physics engine');
  return new Physics.World({gravity:0, wind:0, damping:0, tearThreshold:4, substeps:3, iterations:8, ...extra});
}
function frames(w,n=60) { for(let i=0;i<n;i++) w.step(1/60); }
function finite(w) { assert.ok(w.particles.every(p=>[p.x,p.y,p.vx,p.vy].every(Number.isFinite)), 'all particle states stay finite'); }

test('gravity moves a free particle while a pin stays fixed', () => {
  const w=world({gravity:9.8}); const p=w.particle(400,120); const pin=w.particle(450,120,{pinned:true}); frames(w,20);
  assert.ok(p.y>150); assert.equal(pin.y,120); assert.equal(pin.x,450); finite(w);
});
test('structural stiffness changes the response to the same stretch', () => {
  function response(stiffness) { const w=world({stiffness,tearThreshold:5,iterations:6}); const a=w.particle(300,200,{pinned:true}); const b=w.particle(350,200); const c=w.distance(a,b); b.x=420; frames(w,1); return Math.abs(Math.hypot(b.x-a.x,b.y-a.y)-c.rest); }
  assert.ok(response(1)<response(.1)*.3, 'a stiff constraint should resist stretch more than a compliant one');
});
test('inflated membrane preserves area through deformation', () => {
  const w=world({pressure:1,damping:.04}); const b=w.soft(500,300,65,'balloon'); const original=b.baseArea;
  for(const p of b.ring) p.x=500+(p.x-500)*.65;
  frames(w,100); assert.ok(Math.abs(w.area(b.ring)/original-1)<.12); finite(w);
});
test('different dynamic balls resolve overlap and report a genuine contact', () => {
  const w=world(); const a=w.ball(420,300,35); const b=w.ball(450,300,35); w.step(1/60);
  assert.ok(Math.hypot(a.particles[0].x-b.particles[0].x,a.particles[0].y-b.particles[0].y)>69);
  assert.ok(w.stats.collisionPairs>0); finite(w);
});
test('static geometry supports deformable particles', () => {
  const w=world({gravity:9.8}); w.obstacle(500,550,{type:'circle',radius:65}); const p=w.particle(500,450,{radius:6}); frames(w,90);
  assert.ok(Math.hypot(p.x-500,p.y-550)>=70.8); finite(w);
});
test('a fast cutting segment permanently removes crossed cloth edges and triangles', () => {
  const w=world(); const b=w.cloth(200,100,300,180,16,10,'corners'); const before=w.constraints.filter(c=>c.alive).length; const tris=b.triangles.filter(t=>t.edges.every(c=>c.alive)).length;
  const removed=w.cut(180,190,530,190,3); assert.ok(removed>20); frames(w,2);
  assert.ok(w.constraints.filter(c=>c.alive).length<before); assert.ok(b.triangles.filter(t=>t.edges.every(c=>c.alive)).length<tris);
});
test('tear threshold breaks overstretched edges in the actual cloth graph', () => {
  const w=world({tearThreshold:1.3}); const b=w.cloth(200,100,240,160,13,9,'corners'); const p=b.particles[45]; p.x+=200; w.step(1/60);
  assert.ok(w.stats.broken>0); assert.ok(b.constraints.some(c=>!c.alive)); finite(w);
});
test('cutting a pressure membrane vents its area constraint', () => {
  const w=world(); const b=w.soft(500,300,60,'balloon'); const c=b.constraints.find(c=>c.edge); const x=(c.a.x+c.b.x)/2,y=(c.a.y+c.b.y)/2;
  assert.ok(w.cut(x-10,y-10,x+10,y+10,6)>0); assert.equal(b.vented,true);
});
test('pin toggling and mass-dependent impulse affect real particles', () => {
  const w=world(); const p=w.particle(400,300); w.pin(p); w.impulse(400,300,0,-1); frames(w,2); assert.equal(p.y,300);
  w.pin(p); w.impulse(400,300,0,-1); assert.ok(p.vy<0);
  const light=world({density:.5}),heavy=world({density:2}); const a=light.particle(400,300),b=heavy.particle(400,300); light.impulse(400,300,1,0); heavy.impulse(400,300,1,0);
  assert.ok(a.vx>b.vx*3);
});
test('substeps, collisions, and extreme controls keep a mixed world finite', () => {
  const w=world({gravity:25,wind:100,iterations:2,substeps:1,stiffness:.1,pressure:2,tearThreshold:1.1,damping:.05});
  w.cloth(220,70,310,210,18,12,'corners'); w.rope(700,80,340,25); w.soft(550,410,60,'soft'); w.soft(760,360,70,'balloon'); w.ball(600,200,30); w.obstacle(500,600,{type:'rect',width:220,height:40});
  frames(w,180); finite(w); assert.ok(w.particles.every(p=>p.x>=0&&p.x<=1200&&p.y>=0&&p.y<=800));
});
test('horizontal gravity accelerates a ball and a cloth particle equally', () => {
  const w=world({gravity:9.8,gravityAngle:0}); const a=w.particle(300,200);const b=w.ball(600,200,25).particles[0];w.step(1/60);
  assert.ok(Math.abs(a.vx-b.vx)<.001,'gravity must not be scaled by aerodynamic material factors');
});
test('tearing a rope removes bending links across the torn structural path', () => {
  const w=world({stiffness:1,bending:1,tearThreshold:1.1,substeps:1});const b=w.rope(300,200,200,5,{angle:0}),p=b.particles[2];p.x+=150;const start=p.x;w.tear();
  assert.equal(w.constraints.filter(c=>c.alive&&(c.a===p||c.b===p)).length,0,'a detached point must have no hidden live bending edges');frames(w,30);assert.ok(Math.abs(p.x-start)<1e-5,'the detached fragment must not be pulled back by an invisible tether');
});
test('paused dragging refreshes contacts and spatial cells from current positions', () => {
  const w=world();const a=w.ball(420,300,35).particles[0],b=w.ball(450,300,35).particles[0];w.step(1/60);assert.ok(w.stats.collisionPairs>0);w.drag={x:750,y:550,tear:false,points:[{p:b,dx:0,dy:0,weight:1}]};for(let i=0;i<8;i++)w.editDrag();
  assert.equal(w.stats.collisionPairs,0,'separated bodies must not retain old collision pairs');assert.equal(w.contacts.length,0);const key=Math.floor(b.x/w.cellSize)+','+Math.floor(b.y/w.cellSize);assert.ok(w.hash.get(key)?.includes(b),'spatial cells should contain the particle at its actual position');
});
test('area strain diagnostics report actual current geometry after paused deformation', () => {
  const w=world();const b=w.soft(600,300,60,'balloon'),p=b.ring[0];w.drag={x:p.x+70,y:p.y+30,tear:false,points:[{p,dx:0,dy:0,weight:1}]};w.editDrag();const strain=Math.abs(w.area(b.ring)-b.baseArea)/b.baseArea;
  assert.ok(strain>.0001,'the edit must cause measurable area deformation');assert.ok(Math.abs(b.areaConstraint.strain-strain)<1e-9,'reported area error must match live area geometry');
});
test('a free cloth sheet curves around static support instead of behaving as a rigid panel', () => {
  const w=new Physics.World();w.obstacle(453,562,{radius:120});w.obstacle(830,668,{type:'rect',width:155,height:92});const b=w.cloth(218,146,651,245,30,13,'none');for(const p of b.particles){p.y+=Math.sin((p.x-218)*.012)*15;p.vx=30;}w.soft(1000,360,56,'soft');frames(w,360);
  const row=b.particles.slice(180,210),a=row[0],z=row.at(-1),len=Math.hypot(z.x-a.x,z.y-a.y),curve=Math.max(...row.map(p=>Math.abs((z.x-a.x)*(p.y-a.y)-(z.y-a.y)*(p.x-a.x))/(len||1)));assert.ok(curve>20,'a cloth row should visibly bend around its supports');finite(w);
});
test('self-collision separates non-neighbor particles and the switch disables it', () => {
  function separation(enabled){const w=world({selfCollision:enabled}),b=w.body('rope','#999999',20),a=w.particle(500,200,{body:b}),z=w.particle(500,400,{body:b});a.y=z.y=300;w.step(1/60);return Math.hypot(a.x-z.x,a.y-z.y);}
  assert.ok(separation(true)>11.8);assert.equal(separation(false),0);
});
test('a loaded rope collides with a ball and deforms under its weight', () => {
  function setup(loaded){const w=world({gravity:9.8,damping:.03,tearThreshold:4});const r=w.rope(300,300,160,3,{angle:0,pinEnd:true});let ball;if(loaded)ball=w.ball(380,270,25);frames(w,90);return {w,r,ball};}
  const plain=setup(false),loaded=setup(true);assert.ok(loaded.r.particles[1].y>plain.r.particles[1].y+1,'the load should visibly deform the chain');assert.ok(loaded.ball.particles[0].y<400,'the ball should be supported by the rope instead of falling through');finite(loaded.w);
});
test('more solver iterations reduce constraint error under the same rope load', () => {
  function error(iterations){const w=world({gravity:9.8,stiffness:1,bending:0,substeps:1,iterations}),b=w.rope(600,100,300,31);frames(w,60);finite(w);return w.stats.maxError;}
  assert.ok(error(20)<error(2)*.5,'increased projection iterations should materially reduce length errors');
});
test('higher pressure expands a closed membrane to its requested area', () => {
  function area(pressure){const w=world({pressure}),b=w.soft(600,300,65,'balloon');frames(w,60);finite(w);return w.area(b.ring)/b.baseArea;}
  assert.ok(Math.abs(area(1)-1)<.05);assert.ok(area(2)>1.2);
});
test('attached points share a joint without colliding, then collide when the attachment breaks', () => {
  const w=world(),a=w.body('rope','#999999'),b=w.body('rope','#888888'),p=w.particle(500,300,{body:a}),q=w.particle(500,300,{body:b});const joint=w.distance(p,q,{type:'attachment',owner:a});w.step(1/60);
  assert.ok(Math.hypot(p.x-q.x,p.y-q.y)<.05,'a coincident attachment must not fight a collision between its own endpoints');assert.equal(w.stats.collisionPairs,0);
  w.break(joint);w.step(1/60);assert.ok(Math.hypot(p.x-q.x,p.y-q.y)>11.8,'cutting the joint must restore collisions between the separated bodies');assert.ok(w.stats.collisionPairs>0);finite(w);
});
