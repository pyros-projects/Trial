global.keyLabel=c=>String(c);
const C=require('./core.js');
const {makeMission,Sim,snapshotMission,GS,TILE,SIM_DT,PF,losClear,tileIdxAt,blocksMoveTile}=C;
// A cautious keyboard-style bot: sneaks, freezes when watched, sprints when chased.
function play(m,diffId,maxT){
  snapshotMission(m); const sim=new Sim(m,diffId); PF.bind(m);
  let path=null,pIdx=0,repath=0,lx=0,ly=0,stuck=0;
  const maxTicks=(maxT||150)*60;
  while(sim.status==='playing' && sim.tick<maxTicks){
    const p=sim.player, goal=m.objective.taken? m.exfil : m.objective;
    let mx=0,my=0,run=false,sneak=true;
    // threat assessment
    let th=null;
    for(const g of sim.guards){ const d=Math.hypot(g.x-p.x,g.y-p.y);
      if(d>11*TILE) continue;
      if(!losClear(m,g.x,g.y,p.x,p.y,15,sim.smokes)) continue;
      if(!th||d<th.d) th={g,d}; }
    if(th && (th.g.state===GS.CHASE || th.g.aware>0.6)){
      const base=Math.atan2(p.y-th.g.y,p.x-th.g.x); let bA=null,bS=-1e9;
      for(let k=-6;k<=6;k++){ const a=base+k*0.28;
        const dd=C.castRay? C.castRay(m,p.x,p.y,a,8*TILE,15) : 0;
        if(dd<30) continue;
        const nx=p.x+Math.cos(a)*dd, ny=p.y+Math.sin(a)*dd;
        const sc=dd*0.5+Math.hypot(nx-th.g.x,ny-th.g.y)*1.0-Math.abs(k)*5;
        if(sc>bS){bS=sc;bA=a;} }
      if(bA!==null){ mx=Math.cos(bA); my=Math.sin(bA); }
      run=true; sneak=false; path=null;
    } else if(th && th.g.aware>0.12 && th.d<6*TILE){
      mx=0;my=0;  // freeze
    } else {
      repath--;
      if(!path||repath<=0){ const raw=PF.find(p.x,p.y,goal.x,goal.y,5200,40);
        path=raw?raw.map(i=>PF.center(i)):null; pIdx=path&&path.length>1?1:0; repath=30; }
      if(path&&pIdx<path.length){ let t=path[pIdx];
        while(t&&Math.hypot(t.x-p.x,t.y-p.y)<15&&pIdx<path.length-1){pIdx++;t=path[pIdx];}
        if(t){const a=Math.atan2(t.y-p.y,t.x-p.x);mx=Math.cos(a);my=Math.sin(a);} }
      if(Math.hypot(p.x-lx,p.y-ly)<0.05){stuck++; if(stuck>30){repath=0;stuck=0;}} else stuck=0;
      lx=p.x;ly=p.y;
    }
    sim.step(SIM_DT,{mx,my,run,sneak,aim:Math.atan2(my,mx)||0,use:!!sim.interact,gadget:false,slot:-1});
    sim.events.length=0;
  }
  return sim;
}
const results=[];
for(let n=1;n<=60;n++){
  const seed='ANNEX-'+String(n).padStart(2,'0');
  for(const diff of ['rookie','operative']){
    const m=makeMission(seed,'annex',diff);
    const sim=play(m,diff,120);
    if(sim.status==='won') results.push({seed,diff,t:+sim.t.toFixed(1),det:sim.stats.detections,
      loot:sim.stats.lootCount+'/'+m.loot.length,score:sim.score(),rank:sim.rank(),
      guards:m.guardSpawns.length,rooms:m.rooms.length,doors:m.doors.length,terms:m.terminals.length});
  }
}
results.sort((a,b)=>a.t-b.t);
console.log('winnable seeds (cautious bot):', results.length);
console.log(JSON.stringify(results.slice(0,12),null,0));
