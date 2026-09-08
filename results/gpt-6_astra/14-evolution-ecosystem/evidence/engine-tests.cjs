const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
assert.ok(fs.existsSync('index.html'),'Complete application has not been implemented');
const source=fs.readFileSync('index.html','utf8').match(/<script id="simulation-engine">([\s\S]*?)<\/script>/)?.[1];
assert.ok(source,'Simulation engine is present');
const ctx={console};vm.createContext(ctx);vm.runInContext(source,ctx);const E=ctx.EcoEngine;
const a=new E('meadow-42','balanced','medium'),b=new E('meadow-42','balanced','medium');
assert.equal(a.serialize(),b.serialize(),'Same seed reproduces initial conditions');
const initial=a.organisms.length;
for(let i=0;i<1800;i++)a.step();
assert.ok(a.totals.fed>0,'Organisms actually feed');
assert.ok(a.totals.births>0,'Energy-funded reproduction occurs');
assert.ok(a.totals.deaths>0,'Organisms die');
assert.ok(a.history.length>30,'History retains actual samples');
for(const o of a.organisms){assert.ok(Number.isFinite(o.x)&&Number.isFinite(o.energy));assert.ok(o.energy>=0);assert.ok(o.x>=0&&o.x<=a.width);if(o.parent){assert.ok(a.lineage[o.parent].children.includes(o.id));assert.equal(o.generation,a.lineage[o.parent].generation+1);}}
let verifiedChildren=0,verifiedMutations=0;
for(const child of Object.values(a.lineage)){
 if(!child.parent)continue;
 const parent=a.lineage[child.parent];assert.ok(parent.children.includes(child.id));assert.equal(child.root,parent.root);assert.equal(child.generation,parent.generation+1);assert.equal(child.role,parent.role);
 for(const [trait,value] of Object.entries(child.genes)){
  const mutation=child.mutations.find(m=>m.trait===trait);
  if(mutation){assert.equal(mutation.from,parent.genes[trait]);assert.equal(mutation.to,value);verifiedMutations++;}
  else assert.ok(Math.abs(value-parent.genes[trait])<=1e-7,'Unmutated inheritance stays coherent');
 }
 verifiedChildren++;
}
assert.ok(verifiedChildren>0&&verifiedMutations>0);console.log(JSON.stringify({inheritancePass:true,verifiedChildren,verifiedMutations}));
const restored=E.restore(a.serialize());assert.equal(restored.serialize(),a.serialize(),'Round trip preserves evolved state');
for(let i=0;i<40;i++){a.step();restored.step();}assert.equal(restored.serialize(),a.serialize(),'Continuation after restore stays deterministic');
assert.throws(()=>E.restore('{"version":1}'));
const before=a.cells.reduce((s,c)=>s+c.food,0);a.intervene('pulse');assert.ok(a.cells.reduce((s,c)=>s+c.food,0)>before,'Food pulse adds finite food');
const pop=a.organisms.length;a.intervene('extinction');assert.ok(a.organisms.length<pop,'Extinction reduces population');
const corrupted=JSON.parse(a.serialize());corrupted.history[0].energy='invalid';assert.throws(()=>E.restore(JSON.stringify(corrupted)),'Reject invalid history before it reaches the chart');
const lineageBroken=JSON.parse(a.serialize());const record=Object.values(lineageBroken.lineage)[0];record.children='invalid';assert.throws(()=>E.restore(JSON.stringify(lineageBroken)),'Reject malformed lineage archive');
console.log(JSON.stringify({pass:true,initial,population:a.organisms.length,tick:a.tick,totals:a.totals,species:a.species.length,history:a.history.length,generation:Math.max(...a.organisms.map(o=>o.generation),0)}));
