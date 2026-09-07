const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
if(fs.existsSync(__dirname+'/physics.js')) require('./physics.js');
const O=globalThis.Orbital;
const cfg={G:1,dt:0.02,softening:0,collision:'pass',horizon:10,resolution:100};
const body=(id,mass,x,y,vx,vy,type='planet',primary=null,radius=.01)=>({id,name:id,mass,x,y,vx,vy,type,primary,radius,scale:1,alive:true});
const state=bodies=>({bodies,time:0,nodes:[],events:[],energyOffset:0,momentumOffset:{x:0,y:0}});
const near=(a,b,t=1e-9)=>assert.ok(Math.abs(a-b)<t,`${a} ≠ ${b} within ${t}`);
function binary(){return state([body('p',100,-.1,0,0,-.01),body('c',1,10,0,0,1,'craft','p')]);}
test('engine exposes numerical API',()=>assert.equal(typeof O?.advance,'function'));
test('isolated circular binary closes and conserves energy and momentum',()=>{
 const s=state([body('p',100,-10/101,0,0,-Math.sqrt(10.1)/101),body('c',1,1000/101,0,0,100*Math.sqrt(10.1)/101,'craft','p')]);
 const initial=O.invariants(s,cfg), period=2*Math.PI*Math.sqrt(1000/101);
 const startX=s.bodies[0].x; O.advance(s,period/4,cfg); assert.ok(Math.abs(s.bodies[0].x-startX)>.05);
 O.advance(s,3*period/4,cfg); const end=O.invariants(s,cfg);
 near(Math.hypot(s.bodies[1].x-s.bodies[0].x,s.bodies[1].y-s.bodies[0].y),10,.02);
 near(end.energy/initial.energy,1,1e-7); near(end.px,initial.px,1e-10);near(end.py,initial.py,1e-10);
});
test('scheduled cartesian impulse executes exactly once at boundary and offsets intentional changes',()=>{
 const s=state([body('c',2,0,0,1,0,'craft')]); s.nodes=[{id:'n',craftId:'c',primaryId:null,time:.073,dx:2,dy:3,mode:'cartesian',executed:false}];
 const initial=O.invariants(s,cfg);O.advance(s,.2,cfg);O.advance(s,.2,cfg);
 near(s.bodies[0].x,.073+3*(.4-.073));near(s.bodies[0].y,3*(.4-.073));near(s.time,.4);
 assert.equal(s.events.length,1);near(s.events[0].time,.073);assert.equal(s.nodes[0].executed,true);
 const end=O.invariants(s,cfg);near(end.energy-s.energyOffset,initial.energy);near(end.px-s.momentumOffset.x,initial.px);near(end.py-s.momentumOffset.y,initial.py);
});
test('orbital burn uses relative velocity and outward radial direction',()=>{
 const s=state([body('p',1,0,0,3,4),body('c',1,10,0,3,6,'craft','p')]);s.nodes=[{id:'n',craftId:'c',primaryId:'p',time:0,prograde:2,radial:-1,mode:'orbital'}];
 O.advance(s,0,cfg);near(s.bodies[1].vx,2);near(s.bodies[1].vy,8);
});
test('prediction matches live dynamics and leaves source untouched',()=>{
 const s=binary();s.nodes=[{id:'n',craftId:'c',primaryId:'p',time:1.337,mode:'orbital',prograde:.02,radial:.01}];const before=JSON.stringify(s);
 const pred=O.predict(s,cfg);assert.equal(JSON.stringify(s),before);assert.equal(pred.samples.length,101);near(pred.final.time,10);near(pred.samples[0].time,0);
 const actual=O.clone(s);O.advance(actual,10,cfg);actual.bodies.forEach((b,i)=>{near(b.x,pred.final.bodies[i].x,5e-4);near(b.y,pred.final.bodies[i].y,5e-4);});
 assert.ok(pred.closest.some(x=>x.craftId==='c'&&x.bodyId==='p'&&x.distance>0));assert.equal(pred.events.filter(e=>e.type==='burn').length,1);
});
test('reference frame centers body and removes rotating moon velocity',()=>{
 const s=state([body('p',100,5,8,3,4),body('m',1,5,18,1,4,'moon','p')]);const f=O.frame(s,'rotating',null,'p');
 const p=O.transform(s.bodies[0],f),m=O.transform(s.bodies[1],f),v=O.transformVelocity(s.bodies[1],f);near(p.x,0);near(p.y,0);near(m.x,10);near(m.y,0);near(v.x,0);near(v.y,0);
});
test('merge preserves mass and momentum and redirects child primaries',()=>{
 const s=state([body('p',3,0,0,2,0,'planet',null,1),body('m',1,.5,0,-2,0,'moon','p',.5),body('c',.01,10,0,0,0,'craft','m')]); const initial=O.invariants(s,cfg);
 O.step(s,.0001,{...cfg,collision:'merge',softening:.1});const live=s.bodies.filter(b=>b.alive!==false);assert.equal(live.length,2);near(live.reduce((a,b)=>a+b.mass,0),4.01);assert.equal(live.find(b=>b.id==='c').primary,'p');
 const end=O.invariants(s,cfg);near(end.px,initial.px,1e-9);near(end.py,initial.py,1e-9);assert.equal(s.events[0].type,'collision');
});
test('elastic bounce reverses approaching equal masses',()=>{
 const s=state([body('a',1,-.49,0,1,0,'planet',null,.5),body('b',1,.49,0,-1,0,'planet',null,.5)]);O.step(s,.001,{...cfg,G:0,collision:'bounce'});near(s.bodies[0].vx,-1);near(s.bodies[1].vx,1);
});
test('osculating elements distinguish circular and escape orbits',()=>{
 const p=body('p',100,0,0,0,0), c=body('c',0,10,0,0,Math.sqrt(10),'craft','p');let e=O.elements(c,p,cfg);near(e.eccentricity,0);near(e.periapsis,10);near(e.apoapsis,10);assert.ok(e.period>0);
 c.vy=5;e=O.elements(c,p,cfg);assert.ok(e.eccentricity>1);assert.equal(e.apoapsis,null);assert.equal(e.period,null);
});
test('all seven presets remain finite through their prediction horizon',()=>{
 for(const key of ['circular','elliptical','hohmann','moon','slingshot','threebody','escape']){const p=O.scenario(key);const pred=O.predict(p.state,{...p.cfg,resolution:24});assert.equal(pred.samples.length,25);for(const b of pred.final.bodies)for(const k of ['x','y','vx','vy'])assert.ok(Number.isFinite(b[k]),`${key}.${b.id}.${k}`);}
});
test('invalid input and singular unsoftened force throw instead of returning NaN',()=>{
 assert.throws(()=>O.advance(binary(),1,{...cfg,dt:0}));assert.throws(()=>O.step(state([body('a',1,0,0,0,0),body('b',1,0,0,0,0)]),.1,cfg));
});
test('lunar intercept preset reaches the neighborhood of Luna',()=>{
 const p=O.scenario('moon'),pred=O.predict(p.state,p.cfg),approach=pred.closest.find(q=>q.craftId==='odyssey'&&q.bodyId==='luna');assert.ok(approach.distance<20,`Luna miss distance ${approach.distance}`);
});
test('prediction samples preserve pre-contact mass and bounce velocity until collision event',()=>{
 for(const collision of ['merge','bounce']){
  const s=state([body('a',2,-1.01,0,1,0,'planet',null,1),body('b',1,1.01,0,-1,0,'planet',null,1)]);
  const pred=O.predict(s,{...cfg,G:0,dt:.04,softening:.02,collision,horizon:.04,resolution:4});
  near(pred.events[0].time,.04);
  for(const sample of pred.samples){near(sample.bodies.filter(b=>b.alive!==false).reduce((sum,b)=>sum+b.mass,0),3);if(sample.time<.04){near(sample.bodies[0].mass,2);near(sample.bodies[0].vx,1);near(sample.bodies[1].vx,-1);assert.equal(sample.bodies[1].alive,true);}}
  if(collision==='merge')assert.equal(pred.final.bodies[1].alive,false);else assert.ok(pred.final.bodies[0].vx<0);
 }
});
test('positive duration below clock precision throws while zero duration remains valid',()=>{
 const s=state([body('c',1,0,0,1,0,'craft')]);s.time=1e16;
 assert.throws(()=>O.advance(s,1,cfg),/precision/);near(s.time,1e16);assert.equal(O.advance(s,0,cfg),0);
 s.time=1;assert.throws(()=>O.advance(s,1e-20,cfg),/precision/);
});
