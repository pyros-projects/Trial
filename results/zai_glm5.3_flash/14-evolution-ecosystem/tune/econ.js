const SIM=require('../src/sim.js');
const {World}=SIM;

// A: herbivores only — measure carrying capacity & energy state
const a=new World({seed:42,preset:'meadow',overrides:{}});
a.organisms=a.organisms.filter(o=>o.role==='Herbivore');
for(let t=0;t<12000;t++){ a.step();
  if(t%2000===0){ const H=a.organisms; const avgE=H.reduce((s,o)=>s+o.energy,0)/(H.length||1);
    console.log(`A t=${t} H=${H.length} avgE=${avgE.toFixed(0)} plants=${a.plants.length} births=${a.stats.births} deaths=${a.stats.deaths} maxGen=${a.stats.maxGen}`);} }

// B: predators introduced into abundant prey world — kill rate per predator
const b=new World({seed:42,preset:'meadow'});
b.organisms=b.organisms.filter(o=>o.role==='Herbivore');
for(let t=0;t<6000;t++) b.step();
const nPrey=b.organisms.length;
for(let k=0;k<12;k++){ const prey=b.organisms[k*7%b.organisms.length];
  b.spawnOrganism('predator',prey.x+50,prey.y+50); }
console.log(`B: ${nPrey} prey, 12 predators introduced`);
const k0=b.deathCauses.predation||0;
for(let t=0;t<6000;t++){ b.step();
  if(t%1000===0){ const P=b.organisms.filter(o=>o.role==='Predator');
    const avgE=P.reduce((s,o)=>s+o.energy,0)/(P.length||1);
    console.log(`B t=${t} P=${P.length} avgE=${avgE.toFixed(0)} kills=${(b.deathCauses.predation||0)-k0} H=${b.organisms.filter(o=>o.role==='Herbivore').length}`);} }
