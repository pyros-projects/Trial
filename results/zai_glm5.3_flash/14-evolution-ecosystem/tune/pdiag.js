const SIM=require('../src/sim.js');
const {World}=SIM;
const w=new World({seed:42,preset:'meadow'});
const causeOf=o=>o.cause;
let lastP=[];
for(let t=0;t<=12000;t+=500){
  while(w.tick<t) w.step();
  const P=w.organisms.filter(o=>o.role==='Predator');
  const avgE=P.length?(P.reduce((s,o)=>s+o.energy,0)/P.length).toFixed(0):'-';
  const states=P.reduce((m,o)=>{m[o.state]=(m[o.state]||0)+1;return m;},{});
  console.log(`t=${t} H=${w.stats.h} P=${P.length} avgE=${avgE} plants=${w.stats.plants} kills=${w.deathCauses.predation||0} states=${JSON.stringify(states)}`);
  if(P.length) lastP=P;
}
// what killed the predators? we can't see dead ones... track via running counter instead
