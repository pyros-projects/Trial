global.keyLabel = c => String(c);
const C = require('./core.js');
const {makeMission, Sim, snapshotMission, PRESETS, DIFFS, TILE, SIM_DT, reachFrom, tileIdxAt} = C;

let fails=0, total=0, minRooms=1e9, maxGen=0, sumGen=0;
const t0=Date.now();
for(const p of PRESETS){
  for(const d of DIFFS){
    for(let s=0;s<12;s++){
      const seed = p.id.toUpperCase()+'-'+s;
      total++;
      const g0=Date.now();
      let m;
      try{ m = makeMission(seed, p.id, d.id); }
      catch(e){ console.log('THROW', p.id, d.id, seed, e.message); fails++; continue; }
      const gt=Date.now()-g0; sumGen+=gt; if(gt>maxGen)maxGen=gt;
      if(!m){ console.log('NULL', p.id,d.id,seed); fails++; continue; }
      // validate
      const seen = reachFrom(m.grid, m.entryTile, true);
      const probs=[];
      if(!seen[m.objTile]) probs.push('objective unreachable');
      if(!seen[m.exfilTile]) probs.push('exfil unreachable');
      if(m.rooms.length<4) probs.push('rooms='+m.rooms.length);
      if(m.guardSpawns.length<2) probs.push('guards='+m.guardSpawns.length);
      if(m.cameras.length<1) probs.push('cams=0');
      if(m.terminals.length<1) probs.push('terminals=0');
      if(m.doors.length<1) probs.push('doors=0');
      for(const gs of m.guardSpawns){ const ti=tileIdxAt(m,gs.x,gs.y); if(ti<0||!seen[ti]) probs.push('guard spawn unreachable'); }
      for(const r of m.routes) for(const w of r){ if(!seen[w.tileI]) probs.push('waypoint unreachable'); }
      if(m.entryTile===m.objTile) probs.push('entry==obj');
      minRooms=Math.min(minRooms,m.rooms.length);
      if(probs.length){ console.log('BAD', p.id, d.id, seed, probs.slice(0,3).join('; ')); fails++; }
    }
  }
}
console.log(`\ngeneration: ${total} missions, ${fails} failures, avg ${(sumGen/total).toFixed(1)}ms, max ${maxGen}ms, min rooms ${minRooms}, wall ${Date.now()-t0}ms`);
