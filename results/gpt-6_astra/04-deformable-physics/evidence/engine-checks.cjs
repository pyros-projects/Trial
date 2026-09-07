const fs = require('fs');
const vm = require('vm');
const assert = require('node:assert/strict');
const path = require('path');
const file = path.join(__dirname, '..', 'index.html');
assert.ok(fs.existsSync(file), 'Delivered index.html and physics engine must exist');
const html = fs.readFileSync(file, 'utf8');
const script = html.match(/<script id="physics">([\s\S]*?)<\/script>/);
assert.ok(script, 'Embedded pure physics engine must exist');
const sandbox = { console, performance };
vm.createContext(sandbox);
vm.runInContext(script[1], sandbox);
const { World, defaults } = sandbox.Physics;
function world(config={}) { return new World({...defaults, ...config}); }
const checks=[];
function check(name, fn) { fn(); checks.push(name); console.log('PASS', name); }
check('Gravity moves free particles; pinned particles stay exact', () => {
 const w=world(); const a=w.particle(100,100), b=w.particle(200,100); w.pin(b);
 for(let i=0;i<60;i++) w.step();
 assert.ok(a.y>150); assert.equal(b.x,200); assert.equal(b.y,100);
});
check('Distance constraints converge under displacement', () => {
 const w=world({gravity:0,wind:0}); const a=w.particle(200,200), b=w.particle(250,200); w.pin(a); w.link(a,b,'structural'); b.x=350;
 for(let i=0;i<15;i++) w.step();
 assert.ok(Math.abs(Math.hypot(b.x-a.x,b.y-a.y)-50)<2);
});
check('Different bodies resolve overlapping particles', () => {
 const w=world({gravity:0,wind:0}); const a=w.particle(300,300,{body:1,r:10}), b=w.particle(305,300,{body:2,r:10});
 w.step(); assert.ok(Math.hypot(b.x-a.x,b.y-a.y)>=19.9); assert.ok(w.stats.contacts>0);
});
check('Swept cuts remove graph edges permanently', () => {
 const w=world({gravity:0,wind:0}); const a=w.particle(200,200), b=w.particle(300,200); const c=w.link(a,b,'structural');
 const n=w.cut(250,100,250,300,2); assert.equal(n,1); assert.equal(c.active,false);
 w.step(); assert.equal(c.active,false); assert.equal(w.activeConstraints(),0);
});
check('Pressure body keeps finite area under gravity and floor contacts', () => {
 const w=world({wind:0}); const body=w.blob(500,450,50,'balloon'); const area=body.restArea;
 for(let i=0;i<240;i++) w.step();
 assert.ok(w.particles.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
 const ratio=Math.abs(w.area(body.points))/area; assert.ok(ratio>0.7&&ratio<1.3, 'area ratio '+ratio);
 assert.ok(Math.max(...body.points.map(p=>p.y))<w.floor+1);
});
console.log(JSON.stringify({passed:checks.length,checks},null,2));
