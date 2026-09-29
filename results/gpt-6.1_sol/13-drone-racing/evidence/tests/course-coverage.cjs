// Exercises the actual delivered dynamics on seeded approaches; no state stubs.
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),c={};vm.createContext(c);vm.runInContext(fs.readFileSync('index.html','utf8').match(/<script id="flight-core">([\s\S]*?)<\/script>/)[1],c);const F=c.FlightCore;
let approachCount=0,clearanceCount=0;
for(const preset of ['canyon','industrial','forest'])for(const seed of [0,1,3,42,4821,20026,4294967295]){
 const course=F.generateCourse(seed,preset),cfg={gravity:9.81,twr:2.6,drag:.24,rates:180,expo:.25,level:1,hold:1,antiCrash:.7,forgiveness:.35,mode:'angle'};
 // Pro-sized apertures verify that the corrected canyon landmark cannot block gate 07.
 course.gates.forEach(g=>{g.width=6;g.height=5;});const s=new F.Simulation(course,cfg);
 for(let gate=0;gate<8;gate++){s.recover();for(let i=0;i<650&&s.gate===gate;i++)s.step(1/120,{throttle:1/2.6,pitch:.85,roll:0,yaw:0});assert.equal(s.gate,gate+1,`Finishable ${preset}, seed ${seed}, gate ${gate+1}`);approachCount++;}
 assert.equal(s.collisions,0,`Unobstructed course ${preset} seed ${seed}`);assert.ok(s.finished);
}
// Construction clearance: route corridor remains clear for 3000 varied generated courses.
for(const preset of ['canyon','industrial','forest'])for(let seed=0;seed<1000;seed++){
 const course=F.generateCourse(seed,preset);let a=[0,5,14];for(const g of course.gates){const dx=g.p[0]-a[0],dz=g.p[2]-a[2];for(const o of course.obstacles){const t=Math.max(0,Math.min(1,((o.x-a[0])*dx+(o.z-a[2])*dz)/(dx*dx+dz*dz))),distance=Math.hypot(a[0]+dx*t-o.x,a[2]+dz*t-o.z);const bound=o.type==='canyon'?o.r*1.28:o.type==='industrial'?Math.SQRT2*(o.r+.35):o.r;assert.ok(distance>bound+8,`Clear lane seed ${seed} / ${preset}`);clearanceCount++;}a=g.p;}
}
console.log(`PASS: ${approachCount} physically flown checkpoint approaches; ${clearanceCount} obstacle/route clearance checks across 3000 courses.`);
