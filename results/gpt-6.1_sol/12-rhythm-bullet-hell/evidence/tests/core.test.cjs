const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const path=require('node:path').resolve(__dirname,'../../index.html');
assert.ok(fs.existsSync(path),'standalone index.html deliverable exists');
const html=fs.readFileSync(path,'utf8');
const script=html.match(/<script id="engine">([\s\S]*?)<\/script>/);
assert.ok(script,'embedded deterministic simulation exists');
const box={};vm.createContext(box);vm.runInContext(script[1],box);const C=box.PulseCore;
let count=0;function test(name,f){f();console.log('PASS '+name);count++;}
const neutral={dx:0,dy:0,focus:false,dash:false,pulse:false,tx:-1,ty:-1};
test('tempo segments preserve beat/time mapping',()=>{const t=new C.Timeline(120);t.addTempo(8,180);assert.equal(t.timeAtBeat(8),4);assert.equal(t.timeAtBeat(14),6);assert.equal(t.beatAtTime(6),14);for(let i=0;i<96;i++)assert.ok(Math.abs(t.beatAtTime(t.timeAtBeat(i/4))-i/4)<1e-7);});
test('seed and action sequence reproduce a full simulation',()=>{const run=seed=>{const s=new C.Sim({seed,mode:'lab',pattern:'spiral',bpm:128,density:0.7,speed:1,subdivision:4});for(let i=0;i<1440;i++)s.step({...neutral,dx:i<180?1:0,focus:i>600,dash:i===300});return JSON.stringify({p:s.player,b:s.bullets.slice(0,20),score:s.score,graze:s.grazes,hp:s.health});};assert.equal(run('A'),run('A'));assert.notEqual(run('A'),run('B'));});
test('focus is slower and diagonal movement is normalized',()=>{const a=new C.Sim({mode:'lab'}),b=new C.Sim({mode:'lab'}),d=new C.Sim({mode:'lab'});for(let i=0;i<30;i++){a.step({...neutral,dx:1});b.step({...neutral,dx:1,focus:true});d.step({...neutral,dx:1,dy:-1});}assert.ok(a.player.x-b.player.x>20);assert.ok(Math.abs(Math.hypot(d.player.x-400,d.player.y-565)-(a.player.x-400))<0.1);});
test('swept collision catches a crossing projectile and grants invulnerability',()=>{const s=new C.Sim({mode:'lab'});s.bullets.push({id:1,x:350,y:565,px:350,py:565,vx:12000,vy:0,r:5,age:0,life:12,color:0,turn:0,accel:0,grazed:false});s.step(neutral);assert.equal(s.health,3);assert.ok(s.player.invul>0);s.bullets.push({id:2,x:s.player.x,y:s.player.y,vx:0,vy:0,r:5,age:0,life:12,color:0,turn:0,accel:0,grazed:false});s.step(neutral);assert.equal(s.health,3);});
test('dash has a real cooldown and timing awards',()=>{const s=new C.Sim({mode:'lab'});s.step({...neutral,dash:true});assert.equal(s.stats.perfect,1);assert.ok(s.player.dash>0);let n=s.stats.perfect;for(let i=0;i<30;i++)s.step({...neutral,dash:true});assert.equal(s.stats.perfect,n);assert.ok(s.player.cooldown>0);});
test('pattern grid changes actual emission count',()=>{const a=new C.Sim({mode:'lab',grid:Array(16).fill(0)}),b=new C.Sim({mode:'lab',grid:Array(16).fill(1)});for(let i=0;i<180;i++){a.step(neutral);b.step(neutral);}assert.equal(a.emitted,0);assert.ok(b.emitted>0);});
test('musical phases change at measure boundaries',()=>{const s=new C.Sim({mode:'lab',bpm:120,grid:Array(16).fill(0)});for(let i=0;i<1921;i++)s.step(neutral);assert.equal(s.phase,1);});
test('replay schema rejects malformed settings and unsorted actions',()=>{const valid={format:'pulse-vector',version:1,config:{seed:'A',bpm:128,difficulty:'normal',mode:'lab'},actions:[[0,0,0,0,0,-1,-1]],changes:[],ticks:600};assert.ok(C.validateReplay(valid));assert.throws(()=>C.validateReplay({...valid,config:{...valid.config,bpm:0}}));assert.throws(()=>C.validateReplay({...valid,actions:[[20,0,0,0,0,-1,-1],[10,0,0,0,0,-1,-1]]}));});
test('expired projectile cannot damage the player',()=>{const s=new C.Sim({mode:'lab',grid:Array(16).fill(0)});s.bullets.push({id:77,x:400,y:565,px:400,py:565,vx:0,vy:0,r:5,age:12,life:12,color:0,turn:0,accel:0,grazed:false});s.step(neutral);assert.equal(s.health,4);assert.ok(!s.bullets.some(b=>b.id===77));});
console.log(count+' behavior tests passed');
