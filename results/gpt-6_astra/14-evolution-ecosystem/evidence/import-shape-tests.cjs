const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');const c={};vm.createContext(c);vm.runInContext(fs.readFileSync('index.html','utf8').match(/<script id="simulation-engine">([\s\S]*?)<\/script>/)[1],c);const e=new c.EcoEngine('shape','balanced','small');
let s=JSON.parse(e.serialize());s.organisms[0].decision.extra='invalid';assert.throws(()=>c.EcoEngine.restore(JSON.stringify(s)),'Reject unrecognized decision fields before any later tab can render them');
s=JSON.parse(e.serialize());s.lineage[1].genes.extra='invalid';assert.throws(()=>c.EcoEngine.restore(JSON.stringify(s)),'Reject unrecognized archived gene fields before genome modal rendering');
console.log('PASS: complete controller and archived genome shapes validated.');
