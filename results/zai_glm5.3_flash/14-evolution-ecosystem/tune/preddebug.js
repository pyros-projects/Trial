const SIM=require('../src/sim.js');
const {World}=SIM;
const w=new World({seed:7,preset:'meadow'});
let kills=0;
for(let t=0;t<8000;t++){
  w.step();
  if(t%500===0){
    const preds=w.organisms.filter(o=>o.role==='Predator');
    const avgE=preds.length?preds.reduce((s,o)=>s+o.energy,0)/preds.length:0;
    const hunting=preds.filter(o=>o.state==='Hunting').length;
    console.log(`t=${t} preds=${preds.length} avgE=${avgE.toFixed(1)} hunting=${hunting} predkills=${w.deathCauses.predation||0} H=${w.stats.h} plants=${w.plants.length}`);
  }
}
console.log('causes:',JSON.stringify(w.deathCauses));
