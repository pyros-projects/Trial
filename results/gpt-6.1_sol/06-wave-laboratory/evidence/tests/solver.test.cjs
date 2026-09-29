const fs = require('fs');
const vm = require('vm');
const assert = require('node:assert/strict');
const html = fs.existsSync('index.html') ? fs.readFileSync('index.html','utf8') : '';
const code = html.match(/<script id="solver">([\s\S]*?)<\/script>/)?.[1] || '';
const sandbox = {Float32Array, Uint8Array, Math, Map, WeakMap, console};
sandbox.globalThis=sandbox;vm.createContext(sandbox);vm.runInContext(code,sandbox);
let failed=0,passed=0;
function test(name,fn){try{fn();console.log('PASS '+name);passed++;}catch(e){console.log('FAIL '+name+': '+e.message);failed++;}}
function make(){assert.equal(typeof sandbox.WaveSolver,'function','numerical solver must exist');return new sandbox.WaveSolver(120,80);}
function energy(s,x0=0,x1=s.nx){let sum=0;for(let y=1;y<s.ny-1;y++)for(let x=Math.max(1,x0);x<Math.min(s.nx-1,x1);x++)sum+=s.u[y*s.nx+x]**2;return sum;}
const source=(phase=0)=>({id:'s'+phase,x:3,y:4,type:'point',mode:'continuous',frequency:1.2,amplitude:1,phase,waveform:'sine',active:true,start:0,duration:1});
test('unforced zero field remains zero',()=>{let s=make();for(let i=0;i<100;i++)s.step([]);assert.equal(energy(s),0);});
test('point forcing propagates locally with a finite wavefront',()=>{let s=make();s.configure({dt:.02,speed:1.6,damping:0});for(let i=0;i<20;i++)s.step([source()]);assert.ok(energy(s,20,45)>0.0001);assert.equal(energy(s,95,110),0);});
test('opposite-phase coincident sources destructively cancel',()=>{let s=make();for(let i=0;i<240;i++)s.step([source(0),source(180)]);assert.ok(energy(s)<1e-8,'linear cancellation must arise in computed field');});
test('reflecting wall blocks transmission across entire domain',()=>{let s=make();for(let y=0;y<s.ny;y++)s.walls[y*s.nx+60]=1;for(let i=0;i<600;i++)s.step([source()]);assert.ok(energy(s,1,60)>0.001);assert.equal(energy(s,61,119),0);for(let y=0;y<s.ny;y++)assert.equal(s.u[y*s.nx+60],0);});
test('large requested timestep clamps CFL below one',()=>{let s=make();s.index.fill(.5);s.configure({dt:.1,speed:5});assert.ok(s.dt<.1);assert.ok(s.cfl<=.921);for(let i=0;i<150;i++)s.step([source()]);assert.ok(Array.from(s.u).every(Number.isFinite));});
test('higher refractive index delays propagation',()=>{let fast=make(),slow=make();slow.index.fill(2);fast.configure({dt:.02,damping:0});slow.configure({dt:.02,damping:0});let src=source();for(let i=0;i<75;i++){fast.step([src]);slow.step([src]);}assert.ok(energy(fast,49,53)>energy(slow,49,53)*20+1e-8,'wavefront must travel more slowly in n=2');});
test('continuous sources share the simulation phase clock',()=>{let s=make(),a=source(0),b={...source(180),start:.43};s.time=2;for(let i=0;i<200;i++)s.step([a,b]);assert.ok(energy(s)<1e-8,'placement time must not change relative phase of continuous sources');});
test('clear removes current, previous and accumulated field',()=>{let s=make();for(let i=0;i<80;i++)s.step([source()]);assert.ok(energy(s)>0);s.clear();assert.equal(energy(s),0);assert.ok(s.prev.every(v=>v===0));assert.ok(s.avg.every(v=>v===0));});
test('line emitter strength remains consistent across resolutions',()=>{assert.equal(typeof sandbox.WaveSolver,'function');function rms(nx){let s=new sandbox.WaveSolver(nx,nx*2/3),src={...source(),type:'line',x:2,y:1,x2:2,y2:7,amplitude:.1,frequency:1.25};let sum=0;for(let i=0;i<850;i++){s.step([src]);if(i>=650)sum+=s.sample(8,4)**2;}return Math.sqrt(sum/200);}let ratio=rms(360)/rms(180);assert.ok(Math.abs(ratio-1)<.15,'doubling resolution must not double source strength; ratio='+ratio);});
console.log(`${passed} passed, ${failed} failed`);process.exitCode=failed?1:0;
