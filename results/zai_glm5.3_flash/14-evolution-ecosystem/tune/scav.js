const SIM=require('../src/sim.js');
const {World}=SIM;
for(const seed of [42,7,99]){
  const w=new World({seed,preset:'meadow'});
  for(let t=0;t<15000;t++) w.step();
  const s=w.stats;
  console.log(`seed ${seed}: t=${s.t} S=${s.sc} P=${s.p} H=${s.h} corpses=${w.corpses.length}`);
}
