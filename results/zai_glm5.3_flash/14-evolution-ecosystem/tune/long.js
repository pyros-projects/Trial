const SIM=require('../src/sim.js');
const {World}=SIM;
const w=new World({seed:42,preset:'meadow'});
let minH=1e9,minP=1e9,maxP=0;
for(let t=1;t<=25000;t++){
  w.step();
  if(t%2500===0){
    const s=w.stats;
    console.log(`t=${t} H=${s.h} P=${s.p} S=${s.sc} plants=${s.plants} avgE=${s.avgE.toFixed(0)} avgGen=${s.avgGen.toFixed(1)} maxGen=${s.maxGen} sp=${s.species} div=${s.div.toFixed(3)}`);
  }
  minH=Math.min(minH,w.stats.h); minP=Math.min(minP,w.stats.p); maxP=Math.max(maxP,w.stats.p);
}
console.log(`mins: H=${minH} P=${minP} maxP=${maxP}`);
