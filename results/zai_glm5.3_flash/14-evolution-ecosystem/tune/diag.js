const SIM=require('../src/sim.js');
const {World,genomeDistance}=SIM;

// 1) species distance diagnostics in radiation preset
{
  const w=new World({seed:11,preset:'radiation'});
  for(let t=0;t<9000;t++) w.step();
  const orgs=w.organisms;
  let ds=[];
  for(let i=0;i<Math.min(orgs.length,60);i++)
    for(let j=i+1;j<Math.min(orgs.length,60);j++)
      ds.push(genomeDistance(orgs[i],orgs[j]));
  ds.sort((a,b)=>a-b);
  const q=p=>ds.length?ds[Math.floor(p*(ds.length-1))].toFixed(3):'-';
  console.log(`radiation pop=${orgs.length} pairwise d: p10=${q(.1)} p50=${q(.5)} p90=${q(.9)} max=${ds.length?ds[ds.length-1].toFixed(3):'-'}`);
  if(orgs.length){
    const sp=w.spById.get(orgs[0].spId);
    let dm=0; for(const o of orgs) dm=Math.max(dm,genomeDistance(o,sp.cent));
    console.log(`   max dist to centroid=${dm.toFixed(3)} threshold=${w.params.speciation}`);
  }
}

// 2) desert timeline
{
  const w=new World({seed:5,preset:'desert'});
  for(let t=0;t<=10000;t+=1000){
    while(w.tick<t) w.step();
    console.log(`desert t=${t} pop=${w.stats.pop} H=${w.stats.h} P=${w.stats.p} S=${w.stats.sc} plants=${w.stats.plants} avgE=${w.stats.avgE.toFixed(0)} causes=${JSON.stringify(w.deathCauses)}`);
  }
}

// 3) oscillation predator timeline
{
  const w=new World({seed:7,preset:'oscillation'});
  for(let t=0;t<=10000;t+=1000){
    while(w.tick<t) w.step();
    console.log(`osc t=${t} H=${w.stats.h} P=${w.stats.p} S=${w.stats.sc} plants=${w.stats.plants} predkills=${w.deathCauses.predation||0}`);
  }
}
