const fs = require('fs'), vm = require('vm'), assert = require('assert/strict');
const html = fs.existsSync('index.html') ? fs.readFileSync('index.html','utf8') : '';
const engine = html.match(/<script id="engine">([\s\S]*?)<\/script>/);
assert(engine, 'the self-contained artifact must expose its real engine script');
const context={console, structuredClone};vm.createContext(context);vm.runInContext(engine[1],context);
const E=context.EmberEngine;
assert(E, 'engine is available');
let cases=0;
for(const style of ['ruins','cavern','fortress','crypt','arena']) for(let i=0;i<25;i++) {
 const config={seed:'validation-'+i,style,hero:'warden',difficulty:'normal',mode:'forgiving',preset:'standard'};
 const a=E.create(config), b=E.create(config);
 assert.equal(JSON.stringify(a),JSON.stringify(b),'same seed must give same state');
 for(let floor=1;floor<=3;floor++){
  const m=E.generate(config.seed,floor,style);const v=E.validateMap(m);
  assert(v.valid, JSON.stringify({style,i,floor,v}));
  assert(!m.hazards.some(h=>h.x===m.entry.x&&h.y===m.entry.y),'entry is safe');
  assert(m.enemies.every(e=>Math.abs(e.x-m.entry.x)+Math.abs(e.y-m.entry.y)>=5),'enemies are outside safe spawn');
  cases++;
 }
}
const a=E.create({seed:'turn-law',style:'arena',hero:'warden',difficulty:'normal',mode:'forgiving',preset:'standard'});
const b=structuredClone(a);
for(let i=0;i<8&&a.outcome==='active';i++){E.act(a,{type:'wait'});E.act(b,{type:'wait'});assert.equal(JSON.stringify(a),JSON.stringify(b));assert(a.enemies.every(e=>e.lastAct<=a.turn));}
const invalid=E.decode('{"schema":999}');assert.equal(invalid.ok,false);
const saved=E.decode(E.encode(a));assert(saved.ok);assert.equal(JSON.stringify(saved.state),JSON.stringify(a));
console.log('PASS: '+cases+' connected floors, deterministic runs/actions, safe spawns, exact state round-trip, invalid schema rejection');
