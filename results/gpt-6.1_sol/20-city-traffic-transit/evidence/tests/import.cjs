const fs=require('fs'),vm=require('vm'),assert=require('assert');const html=fs.readFileSync('index.html','utf8'),box={};vm.createContext(box);vm.runInContext(html.match(/\/\* CORE START \*\/([\s\S]*?)\/\* CORE END \*\//)[1]+';globalThis.check=validateSnapshot;',box);
const real=JSON.parse(fs.readFileSync('evidence/exports/live-city.json','utf8')),copy=()=>JSON.parse(JSON.stringify(real));assert.doesNotThrow(()=>box.check(copy()),'a genuine exported complete snapshot must validate');
for(const [name,change]of [
 ['serial reused for future IDs',d=>d.sim.serial=1],
 ['unlinked onboard passenger',d=>{const p=d.sim.passengers.find(p=>p.status==='onboard');p.busId=999999;}],
 ['invalid reservations',d=>d.sim.reservations=null],
 ['invalid arrival history',d=>d.sim.completedLog[0].travel='unmeasured'],
 ['invalid transit toggle',d=>d.city.settings.transit='false'],
 ['invalid phase clock',d=>d.city.nodes.find(n=>n.signal).signal.offset=NaN],
 ['invalid camera position',d=>d.camera={x:Infinity,y:0,zoom:1}],
 ['vehicle beyond its edge',d=>d.sim.vehicles[0].pos=30000],
 ['incorrect path length',d=>d.sim.vehicles[0].path[0].length=1]
]){const data=copy();change(data);assert.throws(()=>box.check(data),undefined,name+' must be rejected before state replacement');}
console.log('PASS: genuine export plus nine malformed live-state / settings / camera inputs');
