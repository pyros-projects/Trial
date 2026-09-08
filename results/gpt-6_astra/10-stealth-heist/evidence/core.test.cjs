const fs = require('fs');
const vm = require('vm');
const assert = require('node:assert/strict');
const html = fs.existsSync('index.html') ? fs.readFileSync('index.html', 'utf8') : '';
const match = html.match(/<script id="simulation">([\s\S]*?)<\/script>/);
assert.ok(match, 'The delivered artifact must provide its real simulation core');
const box = {console, Math, Set, Map, performance};
vm.createContext(box); vm.runInContext(match[1], box);
const C = box.HeistCore;
let checks = 0;
function test(name, f) {f(); checks++; console.log('PASS', name);}
test('Same seed regenerates the same facility', () => {
 assert.equal(JSON.stringify(C.generate('NIGHT-017','dockside','ghost')),JSON.stringify(C.generate('NIGHT-017','dockside','ghost')));
 assert.notEqual(JSON.stringify(C.generate('NIGHT-017','dockside','ghost').grid),JSON.stringify(C.generate('NIGHT-018','dockside','ghost').grid));
});
test('All mission seeds connect entry, terminal, loot, objective and extraction', () => {
 for(const preset of ['dockside','glasshouse','blackvault']) for(const difficulty of ['ghost','operative','elite']) for(let n=0;n<30;n++) {
  const m=C.generate('CHECK-'+n,preset,difficulty);
  for(const item of [...m.terminals,...m.loot,m.objective,m.exit]) assert.ok(C.path(m,m.spawn,item,true).length, `${preset}/${difficulty}/${n}: unreachable ${JSON.stringify(item)}`);
  for(const g of m.guards) for(const point of g.route) assert.ok(C.path(m,g,point,true).length, 'unreachable patrol waypoint');
 }
});
const fixture = () => ({w:7,h:5,grid:['#######','#..#..#','#.....#','#..#..#','#######'].map(r=>[...r].map(c=>c==='#'?1:0)),doors:[],smokes:[]});
test('Sight stops at walls and closed doors; open doors admit sight',()=>{
 const m=fixture();assert.equal(C.los(m,{x:1.5,y:1.5},{x:5.5,y:1.5}),false);
 assert.equal(C.los(m,{x:1.5,y:2.5},{x:5.5,y:2.5}),true);
 m.doors=[{x:3,y:2,open:false}];assert.equal(C.los(m,{x:1.5,y:2.5},{x:5.5,y:2.5}),false);
 m.doors[0].open=true;assert.equal(C.los(m,{x:1.5,y:2.5},{x:5.5,y:2.5}),true);
});
test('Pathfinding routes around solid walls without diagonal corner cutting',()=>{
 const m=fixture(), p=C.path(m,{x:1.5,y:1.5},{x:5.5,y:1.5},false);assert.ok(p.length>=7);
 for(let i=0;i<p.length;i++){assert.equal(m.grid[Math.floor(p[i].y)][Math.floor(p[i].x)],0);if(i)assert.equal(Math.abs(p[i].x-p[i-1].x)+Math.abs(p[i].y-p[i-1].y),1);}
});
test('Sound loses strength behind geometry and with distance',()=>{
 const m=fixture(),sound={x:1.5,y:1.5,intensity:8,age:0,ttl:3};
 assert.ok(C.heard(m,sound,{x:1.5,y:2.5})>C.heard(m,sound,{x:5.5,y:1.5}));
 const initial=C.heard(m,sound,{x:1.5,y:2.5});sound.age=2.9;assert.ok(C.heard(m,sound,{x:1.5,y:2.5})<initial);
});
console.log(`${checks} simulation contracts passed`);
