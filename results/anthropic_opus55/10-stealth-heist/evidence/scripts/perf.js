const fs=require('fs'); const mod={}; new Function('mod', fs.readFileSync('core.js','utf8')+'\nObject.assign(mod,{generateMission,createSim,simStep,PRESETS,enterChase,enterSearch,G_STATES});')(mod);
const p=mod.PRESETS[3]; const P={seed:p.seed,size:p.size,guards:p.guards,cams:p.cams,diff:'professional',bias:p.bias};
const m=mod.generateMission(P); m.seedKey='x'; const s=mod.createSim(m,'professional');
const cmd={mx:0,my:0,run:false,sneak:false,act:false,ev:[]};
for(let i=0;i<120;i++) mod.simStep(s,cmd);
// force every guard into pursuit of a last-known position near the middle, player parked far away out of sight
for(const g of s.guards){ g.lkp={x:m.W/2,y:m.H/2}; mod.enterChase(s,g); g.seeing=false; }
s.player.x=m.entry.x; s.player.y=m.entry.y;
const times=[]; const hist={};
for(let i=0;i<60*30;i++){ const t0=process.hrtime.bigint(); mod.simStep(s,cmd); times.push(Number(process.hrtime.bigint()-t0)/1e6); for(const g of s.guards) hist[g.state]=(hist[g.state]||0)+1; }
times.sort((a,b)=>a-b);
console.log('guards',s.guards.length,'steps',times.length,'median ms',times[times.length>>1].toFixed(3),'p95',times[Math.floor(times.length*0.95)].toFixed(3),'max',times[times.length-1].toFixed(2));
console.log('state tick-hits during stress', JSON.stringify(hist), 'outcome', JSON.stringify(s.outcome));
