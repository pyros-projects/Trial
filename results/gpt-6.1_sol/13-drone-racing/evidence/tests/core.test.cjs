// Real delivered code; no mocks. These tests catch missing force response,
// mixed control axes, gate order/tunneling, invalid import acceptance and unstable integration.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.existsSync('index.html')?fs.readFileSync('index.html','utf8'):'';
const source=html.match(/<script id="flight-core">([\s\S]*?)<\/script>/)?.[1];
assert.ok(source,'Delivered simulator must contain executable FlightCore');
const context={Math,JSON,Number,Float32Array};vm.createContext(context);vm.runInContext(source,context);
const {Simulation,generateCourse,validateImport,gateCrossing}=context.FlightCore;
const course=generateCourse(4821,'canyon');
const cfg={gravity:9.81,twr:2.6,drag:.22,rates:180,expo:.25,level:1,hold:0,antiCrash:0,forgiveness:.35,mode:'angle'};
function sim(extra={}){return new Simulation(course,{...cfg,...extra});}
function advance(s,input,n=120){for(let i=0;i<n;i++)s.step(1/120,input);}
const neutral={throttle:1/2.6,pitch:0,roll:0,yaw:0};
let s=sim();const y=s.p[1];advance(s,{...neutral,throttle:.75});assert.ok(s.p[1]>y+2,'Throttle raises craft');
s=sim();advance(s,{...neutral,throttle:0});assert.ok(s.p[1]<y,'Gravity lowers craft');
s=sim();advance(s,{...neutral,yaw:.5});assert.ok(Math.abs(s.q[1])>.1 && Math.abs(s.q[0])<.01,'Yaw turns only yaw axis');
s=sim();advance(s,{...neutral,pitch:.4});assert.ok(Math.abs(s.q[0])>.05 && s.p[2]<13.8,'Pitch tilts and produces forward translation');
s=sim();advance(s,{...neutral,roll:.4});assert.ok(Math.abs(s.q[2])>.05 && s.p[0]>0,'Roll independently banks craft');
s=sim();s.q=context.FlightCore.qaxis([0,1,0],-Math.PI/2);advance(s,{...neutral,pitch:.4});assert.ok(s.p[0]>.2 && Math.abs(s.p[2]-14)<.05,'Leveling uses body axes after a 90 degree yaw');
s=sim({level:0});advance(s,{...neutral,pitch:.4});assert.ok(Math.abs(s.q[0])>.1,'Zero auto-level strength retains pilot authority');
const assisted=sim(),manual=sim({mode:'acro'});advance(assisted,{...neutral,roll:.5},60);advance(manual,{...neutral,roll:.5},60);advance(assisted,neutral,180);advance(manual,neutral,180);assert.ok(Math.abs(assisted.q[2])<Math.abs(manual.q[2]),'Angle levels, acro retains bank');
s=sim({mode:'acro'});advance(s,{throttle:.5,pitch:.8,roll:.6,yaw:.4},4000);assert.ok(s.p.every(Number.isFinite));assert.ok(Math.abs(Math.hypot(...s.q)-1)<1e-5,'Orientation stays normalized');
const g={p:[0,5,0],normal:[0,0,-1],right:[1,0,0],width:8,height:6};
assert.equal(gateCrossing([0,5,4],[0,5,-4],g),'pass','Swept plane catches fast crossing');
assert.equal(gateCrossing([6,5,4],[6,5,-4],g),'miss','Outside aperture misses');
assert.equal(gateCrossing([0,5,-4],[0,5,4],g),'reverse','Backwards cannot pass');
s=sim();s.checkGates([0,5,-60],[0,5,-80]);assert.equal(s.gate,0,'Later gate cannot advance course');
s=sim();s.checkGates([0,5,-20],[0,5,-30]);assert.equal(s.gate,1);s.checkGates([0,5,-65],[0,5,-75]);assert.equal(s.gate,2,'Two consecutive ordered checkpoints');
s=sim();s.p=[0,.3,12];s.v=[0,-12,0];s.step(1/120,{...neutral,throttle:0});assert.ok(s.collisions>0 && s.p[1]>=.22,'Ground collision resolves');
s=sim();advance(s,{...neutral,pitch:.3},100);s.reset();assert.deepEqual(Array.from(s.p),[0,2.6,14]);assert.equal(s.gate,0);assert.equal(s.time,0);
assert.equal(JSON.stringify(generateCourse(4821,'canyon')),JSON.stringify(course),'Seed deterministic');
assert.notEqual(JSON.stringify(generateCourse(4821,'industrial').gates),JSON.stringify(course.gates),'Curated industrial route differs from canyon');
assert.notEqual(JSON.stringify(generateCourse(4821,'forest').gates),JSON.stringify(course.gates),'Curated alpine route differs from canyon');
assert.throws(()=>validateImport({version:1,course:{seed:Infinity,preset:'canyon'}}));
assert.throws(()=>validateImport({version:1,course:{seed:4821,preset:'canyon'},replay:{frames:[[0,0,0,0,0,0,0,0]]}}));
const valid=validateImport({version:1,course:{seed:4821,preset:'canyon'},replay:null});assert.equal(valid.course.seed,4821);

// These fail when out-of-order crossings have no feedback or corrupt optional
// replay metadata is admitted and later crashes UI timing.
s=sim();s.checkGates([0,5,-60],[0,5,-80]);assert.ok(s.events.some(e=>e.type==='outoforder'),'Out-of-order crossing reports the required gate');
const frames=[[0,0,5,14,0,0,0,1],[1,0,5,-10,0,0,0,1]];
assert.throws(()=>validateImport({version:1,course:{seed:4821,preset:'canyon'},replay:{time:1,frames,sectors:'invalid'}}),'Corrupt sector metadata rejected');
assert.throws(()=>validateImport({version:1,course:{seed:4821,preset:'canyon',difficulty:'unknown'},replay:null}));
assert.equal(validateImport({version:1,course:{seed:4821,preset:'canyon',difficulty:'pro'},replay:null}).course.difficulty,'pro','Course difficulty survives export/import');
const replay={time:1,frames};const sample=context.FlightCore.sampleReplay(replay,.5);assert.deepEqual(Array.from(sample.p),[0,5,2]);assert.ok(Math.abs(Math.hypot(...sample.q)-1)<1e-8);

s=sim();s.p=[0,.3,14];s.v=[0,-5,0];s.resolveCollisions([0,.7,14]);assert.ok(s.p[1]>=.53,'Starting pad top is a solid landing surface');
// Visual surfaces must agree with physical obstacle contact at different heights.
const obstacle={type:'canyon',x:0,z:0,r:10,h:20,seed:.5};
const isolated={gates:[],obstacles:[obstacle],bounds:{minX:-100,maxX:100,minZ:-100,maxZ:100}};
s=new Simulation(isolated,cfg);s.p=[11,.5,0];s.v=[-10,0,0];s.resolveCollisions([12,.5,0]);assert.ok(s.collisions>0,'Wide mesa base is solid');
s=new Simulation(isolated,cfg);s.p=[9,19,0];s.v=[-10,0,0];s.resolveCollisions([9.1,19,0]);assert.equal(s.collisions,0,'Empty space beside tapered mesa is flyable');
const tree={type:'forest',x:0,z:0,r:10,h:20,seed:.5};
s=new Simulation({...isolated,obstacles:[tree]},cfg);s.p=[5,.5,0];s.v=[-10,0,0];s.resolveCollisions([5.1,.5,0]);assert.equal(s.collisions,0,'Space below pine canopy is flyable');
s=new Simulation({...isolated,obstacles:[tree]},cfg);s.p=[5,6,0];s.v=[-10,0,0];s.resolveCollisions([5.1,6,0]);assert.ok(s.collisions>0,'Pine canopy has a collision surface');
for(const invalid of ['toString','constructor','__proto__'])assert.throws(()=>validateImport({version:1,course:{seed:1,preset:invalid},replay:null}),'Inherited preset is rejected');
for(const invalid of ['',0,false])assert.throws(()=>validateImport({version:1,course:{seed:1,preset:'canyon',difficulty:invalid},replay:null}),'Supplied invalid difficulty is rejected');
console.log('PASS: flight/race/determinism/import/obstacle suite');


