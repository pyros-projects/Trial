const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const html=fs.readFileSync('index.html','utf8');const context={console};vm.createContext(context);vm.runInContext(html.match(/<script id="engine">([\s\S]*?)<\/script>/)[1],context);const E=context.EmberEngine;
const s=E.create({seed:'EMBER-7241',style:'ruins'}),m=s.map;
assert.equal(E.los(m,{x:2,y:1},{x:6,y:3}),E.los(m,{x:6,y:3},{x:2,y:1}),'corner LOS must be reciprocal');
for(const change of [s=>s.telegraphs=[null],s=>s.sounds=[null],s=>s.map.loot=[{x:8,y:15,type:'unknown-relic',amount:1}],s=>s.enemies[0].maxHp=null,s=>s.player.status.poison='forever',s=>s.enemies[0].status=null]){const bad=E.clone(s);change(bad);assert.equal(E.decode(E.encode(bad)).ok,false,'malformed nested save must be rejected');}
const replay=E.create({seed:'EMBER-7241',style:'ruins'});for(const a of [{type:'move',dx:1,dy:0},{type:'move',dx:0,dy:-1},{type:'guard'},{type:'wait'}])assert(E.act(replay,a).ok);assert.equal(E.fingerprint(E.replay(replay).state),E.fingerprint(replay));
console.log('PASS: reciprocal corner LOS, malformed nested saves rejected, action replay remains exact');
// A marked cross must allow two normal cardinal actions before it resolves.
const boss=E.create({seed:'cross-regression',style:'arena',preset:'final'});boss.player.x=15;boss.player.y=9;boss.map.hazards=[];const w=boss.enemies.find(e=>e.type==='warden');w.x=19;w.y=9;w.home={x:19,y:9};w.cd=0;boss.enemies=[w];E.updateFov(boss);assert(E.act(boss,{type:'wait'}).ok);assert.equal(boss.telegraphs[0].due-boss.turn,2);const hp=boss.player.hp;assert(E.act(boss,{type:'move',dx:-1,dy:0}).ok);assert(E.act(boss,{type:'move',dx:0,dy:1}).ok);assert.equal(boss.player.hp,hp,'two cardinal moves evade the cross');
const journal=E.create({seed:'journal'});E.act(journal,{type:'wait'});assert.equal(journal.log.at(-1).turn,1,'player action must carry its committed turn');
for(const style of Object.keys(E.STYLES)){
 const m=E.generate('symmetry-sweep',1,style);const points=[];m.tiles.forEach((t,i)=>{if(t===1)points.push({x:i%m.w,y:Math.floor(i/m.w)})});
 for(let i=0;i<points.length;i+=3)for(let j=i+1;j<Math.min(points.length,i+30);j+=4)assert.equal(E.los(m,points[i],points[j]),E.los(m,points[j],points[i]));
}
console.log('PASS: boss cross dodge, correct journal turns, reciprocal LOS across five styles');
