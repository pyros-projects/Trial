// Independent routing expectations. A regression removing one-way, turn, or closure
// filtering must fail these tests. Fixtures have hand-derived expected routes.
const fs=require('fs'),vm=require('vm'),assert=require('assert');
let html=fs.existsSync('index.html')?fs.readFileSync('index.html','utf8'):'';
let src=html.match(/\/\* CORE START \*\/([\s\S]*?)\/\* CORE END \*\//)?.[1];
assert.ok(src,'Simulation routing core is not implemented yet');
const box={}; vm.createContext(box); vm.runInContext(src+';globalThis.Core={planRoute,validateSnapshot};',box);
const nodes=[{id:1,x:0,y:0},{id:2,x:100,y:0},{id:3,x:100,y:100},{id:4,x:0,y:100}];
const roads=[{id:1,a:1,b:2,lanes:1,speed:40,oneWay:1},{id:2,a:2,b:3,lanes:1,speed:40,oneWay:0},{id:3,a:3,b:4,lanes:1,speed:40,oneWay:0},{id:4,a:4,b:1,lanes:1,speed:40,oneWay:0}];
const city={nodes,roads,stops:[],routes:[],zones:[],settings:{routing:'distance'},size:1000};
const r=(a,b,via=null)=>box.Core.planRoute(city,a,b,via).map(e=>e.to).join(',');
assert.equal(r(2,1),'3,4,1','reverse one-way must take long route');
assert.equal(r(1,3),'2,3','shortest path travels actual edges');
roads[1].closed=true;
assert.equal(r(1,3),'4,3','closure must reroute');
roads[2].closed=true;
assert.equal(r(1,3),'','disconnection must return no path');
roads[1].closed=false;roads[2].closed=false;
nodes[1].banned=['right'];
assert.equal(r(1,3),'4,3','turn restriction must exclude right at node 2');
assert.throws(()=>box.Core.validateSnapshot({version:1,city:{...city,roads:[{...roads[0],b:999}]}}),/road|node|endpoint/i,'invalid references must be rejected');
console.log('PASS: shortest routing, one-way detour, closure reroute, disconnection, turn restriction, invalid endpoint rejection');
