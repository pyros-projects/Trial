const fs = require('fs');
const vm = require('vm');
const assert = require('assert/strict');
if (!fs.existsSync('index.html')) { console.error('FAIL: delivered index.html and material engine do not exist yet'); process.exit(1); }
const html = fs.readFileSync('index.html', 'utf8');
const script = html.match(/<script id="simulation">([\s\S]*?)<\/script>/);
assert(script, 'embedded material engine exists');
vm.runInThisContext(script[1]);
const {World, M} = Alchemy;
let passed = 0;
function test(name, fn) { try {fn();passed++;console.log('PASS '+name);} catch(e){console.error('FAIL '+name+' — '+e.message);process.exitCode=1;} }
function world(){return new World(64,40,1234,{gravity:'none'});}
function ticks(w,n){for(let i=0;i<n;i++)w.tick();}
function count(w,id){return w.type.reduce((n,x)=>n+(x===id),0);}
test('lava and water become persistent steam and cooled rock',()=>{const w=world();for(let y=20;y<24;y++)for(let x=20;x<25;x++)w.set(x,y,M.LAVA);for(let y=16;y<20;y++)for(let x=20;x<25;x++)w.set(x,y,M.WATER);ticks(w,30);assert(count(w,M.STEAM)>0);assert(count(w,M.LAVA)<20);assert(w.reactionsTotal>0);});
test('fire consumes wood and produces combustion products',()=>{const w=world();for(let x=20;x<35;x++)w.set(x,30,M.WOOD);w.set(25,29,M.FIRE);ticks(w,100);assert(count(w,M.WOOD)<15);assert(count(w,M.SMOKE)+count(w,M.FIRE)+count(w,M.ASH)>0);});
test('electrical charge propagates through a metal path',()=>{const w=world();for(let x=10;x<40;x++)w.set(x,30,M.METAL);w.set(10,29,M.ELECTRICITY);let reached=false;for(let i=0;i<70;i++){w.tick();if(w.charge[30*w.w+35]>0.05)reached=true;}assert(reached);});
test('acid corrodes metal more readily than stone',()=>{const w=world();for(let x=10;x<24;x++){w.set(x,20,M.METAL);w.set(x,19,M.ACID);}for(let x=30;x<44;x++){w.set(x,20,M.STONE);w.set(x,19,M.ACID);}ticks(w,120);assert(count(w,M.METAL)<14);assert(count(w,M.STONE)>count(w,M.METAL));});
test('water supports growth of persistent plant cells',()=>{const w=world();for(let x=20;x<32;x++)w.set(x,30,M.WATER);w.set(25,29,M.PLANT);ticks(w,140);assert(count(w,M.PLANT)>1);});
test('salt dissolves into salinity carried by water',()=>{const w=world();for(let x=20;x<30;x++){w.set(x,20,M.WATER);w.set(x,19,M.SALT);}ticks(w,40);assert(count(w,M.SALT)<10);assert(w.salt.some(x=>x>0));});
test('temperature changes transform real cell materials',()=>{const w=world();w.set(20,20,M.WATER,-30);w.tick();assert.equal(w.type[20*w.w+20],M.ICE);w.set(30,20,M.ICE,50);w.tick();assert(count(w,M.WATER)>0);w.set(40,20,M.METAL,1600);w.tick();assert(count(w,M.MOLTEN)>0);});
test('denser sand sinks through water',()=>{const w=new World(64,40,123);for(let x=10;x<54;x++)for(let y=25;y<39;y++)w.set(x,y,M.WATER);w.set(32,24,M.SAND);ticks(w,25);const index=w.type.indexOf(M.SAND);assert(Math.floor(index/w.w)>25);});
test('state round trip preserves every persistent property and RNG',()=>{const w=world();w.preset('volcano',987);ticks(w,5);const saved=w.serialize();const restored=World.deserialize(saved);assert.equal(restored.w,w.w);assert.equal(restored.rng,w.rng);assert.equal(restored.steps,w.steps);for(const key of World.fields)assert.deepEqual(Array.from(restored[key]),Array.from(w[key]),key);w.tick();restored.tick();assert.deepEqual(Array.from(restored.type),Array.from(w.type));});
test('same preset seed creates the same world',()=>{const a=world(),b=world();a.preset('ecosystem',567);b.preset('ecosystem',567);assert.deepEqual(Array.from(a.type),Array.from(b.type));ticks(a,4);ticks(b,4);assert.deepEqual(Array.from(a.type),Array.from(b.type));});
test('explosion gives nearby cells a persistent impulse',()=>{const w=world();for(let x=20;x<35;x++)for(let y=20;y<30;y++)w.set(x,y,M.SAND);w.explode(25,25,10);assert(w.vx.some(v=>Math.abs(v)>1)||w.vy.some(v=>Math.abs(v)>1));assert(w.temp.some(t=>t>100));});
test('invalid state is rejected without silent partial data',()=>{assert.throws(()=>World.deserialize('{"version":1,"w":1000000}'));});
test('default world is stored as a compact state file',()=>{const w=new World();w.preset('volcano');assert(w.serialize().length<900000,'default state must fit below 900 kB');});
test('electrical laboratory preset energizes its connected circuit',()=>{const w=new World();w.preset('electrical');ticks(w,40);assert(w.charge.some(v=>v>.05),'electrode source must contact its metal circuit');});
test('fireworks preset chain reaches distant explosive charges',()=>{const w=new World();w.preset('fireworks');const far=()=>w.type.reduce((n,id,i)=>n+(id===M.TNT&&i%w.w>w.w*.6),0);const before=far();ticks(w,260);assert(far()<before,'chain reaction must reach charges beyond the starter');});
console.log(`${passed}/15 behavioral checks passed`);
