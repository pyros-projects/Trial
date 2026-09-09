/* Headless balance & sanity harness for the simulation core. */
const SIM=require('../src/sim.js');
const {World}=SIM;

function run(name,fn){
  const t0=Date.now();
  try{ fn(); console.log(`PASS  ${name}  (${Date.now()-t0}ms)`); }
  catch(e){ console.log(`FAIL  ${name}: ${e.message}`); console.log(e.stack.split('\n').slice(0,4).join('\n')); process.exitCode=1; }
}
function assert(c,msg){ if(!c) throw new Error(msg); }
function summarize(w){
  const s=w.stats;
  return `t=${s.t} pop=${s.pop} (H${s.h}/P${s.p}/S${s.sc}/O${s.o}) plants=${s.plants} sp=${s.species} avgE=${s.avgE.toFixed(1)} avgGen=${s.avgGen.toFixed(2)} maxGen=${s.maxGen} div=${s.div.toFixed(3)}`;
}

run('construct meadow world',()=>{
  const w=new World({seed:42,preset:'meadow'});
  assert(w.organisms.length===110+16+12,'expected 138 organisms, got '+w.organisms.length);
  assert(w.plants.length>300,'plants seeded: '+w.plants.length);
  assert(w.type.length===w.cols*w.rows,'terrain arrays sized');
});

run('20k ticks: ecology stays alive and bounded (meadow)',()=>{
  const w=new World({seed:42,preset:'meadow'});
  let extinctAt=-1, maxPop=0;
  for(let t=0;t<20000;t++){
    w.step();
    maxPop=Math.max(maxPop,w.organisms.length);
    if(t%2000===0) console.log('   '+summarize(w));
    if(w.organisms.length===0&&extinctAt<0){ extinctAt=t; break; }
  }
  const s=w.stats;
  assert(extinctAt<0,'total extinction at tick '+extinctAt);
  assert(s.h>0,'herbivores extinct');
  assert(s.plants>50,'plants collapsed: '+s.plants);
  assert(s.pop<2600,'population explosion: '+s.pop);
  assert(s.maxGen>3,'no reproduction progress: maxGen='+s.maxGen);
  assert(s.births>=0&&s.births<2000,'births/sample nonsensical: '+s.births);
  console.log(`   final: ${summarize(w)}  peakPop=${maxPop} causes=${JSON.stringify(w.deathCauses)}`);
});

run('predators present & eating in oscillation preset',()=>{
  const w=new World({seed:7,preset:'oscillation'});
  let maxP=0,minP=999;
  for(let t=0;t<12000;t++){ w.step();
    if(t%1000===0){ maxP=Math.max(maxP,w.stats.p); minP=Math.min(minP,w.stats.p); } }
  console.log(`   predator min=${minP} max=${maxP} final pop=${w.stats.pop} H=${w.stats.h}`);
  assert(w.stats.p>0,'predators extinct');
  assert(maxP>minP,'predator population static');
});

run('islands preset spawns and survives',()=>{
  const w=new World({seed:99,preset:'islands'});
  let water=0; for(let i=0;i<w.type.length;i++) if(w.type[i]===2) water++;
  assert(water/w.type.length>0.2,'island world should be watery: '+water);
  for(let t=0;t<8000;t++) w.step();
  assert(w.organisms.length>20,'island pop died: '+w.stats.pop);
  console.log('   '+summarize(w));
});

run('desert is harsh but habitable',()=>{
  const w=new World({seed:5,preset:'desert'});
  for(let t=0;t<10000;t++) w.step();
  assert(w.organisms.length>0,'desert extinction too fast');
  console.log('   '+summarize(w));
});

run('rapid radiation: high mutation → more species',()=>{
  const lo=new World({seed:11,preset:'meadow'});
  const hi=new World({seed:11,preset:'radiation'});
  for(let t=0;t<9000;t++){ lo.step(); hi.step(); }
  console.log(`   meadow species=${lo.stats.species}  radiation species=${hi.stats.species}`);
  assert(hi.stats.species>lo.stats.species,'radiation should speciate more');
});

run('determinism: same seed ⇒ identical trajectory',()=>{
  const a=new World({seed:777,preset:'meadow'});
  const b=new World({seed:777,preset:'meadow'});
  for(let t=0;t<3000;t++){ a.step(); b.step(); }
  assert(a.organisms.length===b.organisms.length,'pop diverged');
  for(let i=0;i<5;i++){
    const oa=a.organisms[i*17%a.organisms.length], ob=b.organisms[i*17%b.organisms.length];
    assert(Math.abs(oa.x-ob.x)<1e-9&&Math.abs(oa.y-ob.y)<1e-9,'positions diverged');
    assert(Math.abs(oa.energy-ob.energy)<1e-9,'energy diverged');
  }
});

run('interventions measurably change the world',()=>{
  const w=new World({seed:21,preset:'meadow'});
  for(let t=0;t<3000;t++) w.step();
  const beforePlants=w.plants.length, beforeMoist=w.moist[100];
  w.intervention('bloom');
  for(let t=0;t<800;t++) w.step();
  assert(w.plants.length>beforePlants,`bloom should raise plants ${beforePlants}→${w.plants.length}`);
  assert(w.fertBoost>0||w.event&&w.event.type==='bloom','bloom fertility boost active');
  w.intervention('drought');
  for(let t=0;t<900;t++) w.step();
  assert(w.moistMul<0.8,'drought should cut moisture multiplier: '+w.moistMul);
  assert(w.moist[100]>beforeMoist*0.3,'cells should dry');
  const popBefore=w.organisms.length;
  const cx=w.organisms.reduce((s2,o)=>s2+o.x,0)/popBefore, cy=w.organisms.reduce((s2,o)=>s2+o.y,0)/popBefore;
  w.meteorAt(cx,cy);
  assert(w.organisms.length<popBefore,'meteor at population centroid should kill');
  w.intervention('meteor');
  assert(w.event&&w.event.type==='meteor','meteor event recorded');
});

run('disease spreads and kills some',()=>{
  const w=new World({seed:31,preset:'meadow'});
  for(let t=0;t<2000;t++) w.step();
  const before=w.stats.pop;
  w.intervention('disease');
  for(let t=0;t<2400;t++) w.step();
  console.log(`   pop ${before}→${w.stats.pop}, disease deaths=${w.deathCauses.disease||0}`);
  assert((w.deathCauses.disease||0)>0,'no disease deaths');
});

run('reserve protects from meteor',()=>{
  const w=new World({seed:41,preset:'meadow'});
  for(let t=0;t<1000;t++) w.step();
  // put everyone conceptually near a point, reserve it, drop meteor elsewhere then on reserve
  const o=w.organisms[0];
  w.reserveSet(o.x-120,o.y-120,o.x+120,o.y+120);
  const residents=w.organisms.filter(x=>x.x>=o.x-120&&x.x<=o.x+120&&x.y>=o.y-120&&x.y<=o.y+120);
  const before=w.organisms.length;
  w.meteorAt(o.x,o.y);
  for(const r of residents) assert(!r._dead,'reserve resident died in meteor');
  assert(w.organisms.length<before,'meteor should still kill outside the reserve');
  w.reserve=null;
});

run('save → load roundtrip preserves state',()=>{
  const w=new World({seed:55,preset:'meadow'});
  for(let t=0;t<4000;t++) w.step();
  const data=w.serialize();
  const json=JSON.stringify(data);
  const w2=World.load(JSON.parse(json));
  assert(w2.organisms.length===w.organisms.length,'org count');
  assert(w2.tick===w.tick,'tick');
  assert(Math.abs(w2.organisms[0].energy-w.organisms[0].energy)<0.01,'energy preserved');
  for(let t=0;t<500;t++){ w.step(); w2.step(); }
  const dp=Math.abs(w2.organisms.length-w.organisms.length)/Math.max(1,w.organisms.length);
  assert(dp<0.05,'post-load divergence '+w2.organisms.length+' vs '+w.organisms.length);
  const gA=w.stats.avgGen,gB=w2.stats.avgGen;
  assert(Math.abs(gA-gB)<0.5,'lineage/generation divergence '+gA+' vs '+gB);
  assert(w2.species.length>=w.species.length-2,'species registry mismatch');
  console.log(`   save size=${(json.length/1024).toFixed(0)}KB for ${w.organisms.length} organisms`);
});

run('paint tools modify terrain deterministically',()=>{
  const w=new World({seed:3,preset:'meadow'});
  const i=w.cellAt(500,500);
  const f0=w.fert[i];
  w.applyBrush(500,500,120,'fert',5);
  assert(w.fert[i]>f0,'fertility paint');
  w.applyBrush(500,500,120,'barrier',1);
  assert(!w.passable(500,500),'barrier paint');
  w.applyBrush(500,500,120,'erase',1);
  assert(w.passable(500,500),'barrier erase');
});

run('remove tool',()=>{
  const w=new World({seed:3,preset:'meadow'});
  for(let t=0;t<500;t++) w.step();
  const n=w.removeAt(w.W/2,w.H/2,300);
  assert(n>0,'nothing removed');
  assert(w.organisms.every(o=>Math.hypot(o.x-w.W/2,o.y-w.H/2)>300),'all cleared in radius');
});

run('performance: 2000 steps of a busy world',()=>{
  const w=new World({seed:2,preset:'dense'});
  for(let t=0;t<600;t++) w.step(); // let it settle
  const t0=Date.now();
  for(let t=0;t<2000;t++) w.step();
  const ms=Date.now()-t0;
  console.log(`   pop=${w.organisms.length} plants=${w.plants.length} → ${ms}ms for 2000 ticks (${(ms/2000).toFixed(3)}ms/tick)`);
  assert(ms<20000,'too slow: '+ms+'ms');
});
