global.keyLabel = c => String(c);
const C = require('./core.js');
const {makeMission, Sim, snapshotMission, PRESETS, DIFFS, TILE, SIM_DT, PF, tileIdxAt} = C;

function autoPlay(m, diffId, opts={}){
  snapshotMission(m);
  const sim = new Sim(m, diffId);
  if(opts.noGuards) sim.guards.length=0;
  PF.bind(m);
  let path=null, pIdx=0, repath=0, stuck=0, lastx=0,lasty=0;
  const maxTicks = opts.maxTicks || 60*180;
  let t=0;
  while(sim.status==='playing' && t<maxTicks){
    t++;
    const p=sim.player;
    const goal = m.objective.taken ? m.exfil : m.objective;
    repath--;
    if(!path || repath<=0){
      const raw=PF.find(p.x,p.y,goal.x,goal.y,5200, opts.noGuards?40:1.6);
      path = raw? (opts.smooth? PF.smooth(raw) : raw.map(i=>PF.center(i))) : null;
      pIdx = path&&path.length>1?1:0; repath=45;
    }
    let mx=0,my=0;
    if(path && pIdx<path.length){
      let tgt=path[pIdx];
      if(Math.hypot(tgt.x-p.x,tgt.y-p.y)<14){ pIdx++; tgt=path[Math.min(pIdx,path.length-1)]; }
      if(tgt){ const a=Math.atan2(tgt.y-p.y,tgt.x-p.x); mx=Math.cos(a); my=Math.sin(a); }
    } else { const a=Math.atan2(goal.y-p.y,goal.x-p.x); mx=Math.cos(a); my=Math.sin(a); }
    if(Math.hypot(p.x-lastx,p.y-lasty)<0.05) { stuck++; if(stuck>25){ repath=0; stuck=0; } } else stuck=0;
    lastx=p.x; lasty=p.y;
    const use = !!sim.interact;
    sim.step(SIM_DT, {mx,my,run:!!opts.run,sneak:false,aim:Math.atan2(my,mx),use,gadget:false,slot:-1});
    sim.events.length=0;
  }
  return {status:sim.status, t:sim.t, ticks:t, sim};
}

// --- traversability: can a pathfinding bot reach objective + exfil? ---
let bad=0, n=0, times=[];
for(const p of PRESETS){
  for(const d of ['operative']){
    for(let s=0;s<8;s++){
      const seed=p.id.toUpperCase()+'-T'+s;
      const m=makeMission(seed,p.id,d);
      const r=autoPlay(m,d,{noGuards:true});
      n++;
      times.push(r.t);
      if(r.status!=='won'){ bad++; console.log('NOT COMPLETABLE', p.id, seed, r.status, 'ticks',r.ticks, 'objTaken',m.objective.taken); }
    }
  }
}
times.sort((a,b)=>a-b);
console.log(`traversability: ${n} missions, ${bad} not completable; median ${times[times.length>>1].toFixed(1)}s, max ${times[times.length-1].toFixed(1)}s`);

// --- stability with guards active on every difficulty ---
let crash=0, caught=0, won=0;
for(const p of PRESETS){ for(const d of DIFFS){
  const m=makeMission(p.id.toUpperCase()+'-G', p.id, d.id);
  try{
    const r=autoPlay(m,d.id,{run:true, maxTicks:60*120});
    if(r.status==='won')won++; else if(r.status==='lost')caught++;
  }catch(e){ crash++; console.log('CRASH', p.id, d.id, e.stack.split('\n').slice(0,3).join(' | ')); }
}}
console.log(`with guards: ${won} won, ${caught} caught, ${crash} crashes (a beeline sprint SHOULD often get caught)`);

// --- determinism: identical inputs => identical outcome ---
function scripted(m, diffId, seedTag){
  snapshotMission(m);
  const sim=new Sim(m,diffId);
  const R=new C.Rng(C.hashStr(seedTag));
  let mx=0,my=0;
  for(let t=0;t<60*45 && sim.status==='playing';t++){
    if(t%22===0){ const a=R.f(0,Math.PI*2); mx=Math.cos(a); my=Math.sin(a); }
    sim.step(SIM_DT,{mx,my,run:t%180<40,sneak:false,aim:Math.atan2(my,mx),
      use:(t%97===0), gadget:(t%211===0), slot: t%331===0? (t/331|0)%5 : -1});
    sim.events.length=0;
  }
  const p=sim.player;
  return [sim.tick, sim.status, p.x.toFixed(6), p.y.toFixed(6), sim.alarm.level, sim.stats.detections,
          sim.score(), sim.guards.map(g=>g.state+':'+g.x.toFixed(4)+','+g.y.toFixed(4)+','+g.aware.toFixed(6)).join('|')].join(' # ');
}
let dfail=0;
for(const p of ['annex','vermeil','cassiopeia','helix','marrow','random']){
  const m1=makeMission('DET-'+p,p,'operative');
  const m2=makeMission('DET-'+p,p,'operative');
  const a=scripted(m1,'operative','k'+p), b=scripted(m2,'operative','k'+p);
  if(a!==b){ dfail++; console.log('NONDETERMINISTIC',p); 
    const A=a.split(' # '), B=b.split(' # ');
    A.forEach((v,i)=>{ if(v!==B[i]) console.log('  field',i,'A=',v.slice(0,120),'B=',B[i].slice(0,120)); }); }
}
console.log(`determinism: ${dfail} mismatches out of 6 presets`);
