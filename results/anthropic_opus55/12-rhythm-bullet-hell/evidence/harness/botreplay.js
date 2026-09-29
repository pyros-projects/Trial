// Test harness: headless dodging bot that records a replay in the app's own format (SYNC1 code).
window.__botReplay = function(diff, seed, startPhase, maxSec){
  const cfg = { mode:'story', seed, seedStr:String(seed), diff, bpm:132, preset:'neon', lab:null, startPhase };
  const sim = new SYNCOPATH.Sim(cfg); sim.quiet = true;
  const dirs=[[0,0]]; for(let i=0;i<8;i++) dirs.push([Math.cos(i*Math.PI/4), Math.sin(i*Math.PI/4)]);
  const entries=[]; let last=null; let cur=0;
  while(sim.state!=='dead' && sim.state!=='won' && sim.tick < maxSec*120){
    const P=sim.player;
    if (sim.tick % 3 === 0) { let bs=1e18;
      for(let d=0; d<dirs.length; d++){ const nx=P.x+dirs[d][0]*250*0.12, ny=P.y+dirs[d][1]*250*0.12; let sc=0;
        if(nx<20||nx>460||ny<260||ny>620) sc+=1e6;
        for(const b of sim.bullets){ const bx=b.x+b.vx*0.12, by=b.y+b.vy*0.12; const dx=bx-nx, dy=by-ny; const d2=dx*dx+dy*dy; if(d2<3600) sc+=1/(d2+1)*1e4; }
        for(const L of sim.lasers){ const ax=Math.cos(L.a), ay=Math.sin(L.a); const px=nx-L.ox, py=ny-L.oy; const t=Math.max(0,px*ax+py*ay); const dd=Math.hypot(px-ax*t, py-ay*t); if(dd<40) sc+=(40-dd)*50; }
        sc += Math.abs(nx - sim.boss.x)*0.6 + Math.abs(ny-560)*0.05; if(sc<bs){bs=sc;cur=d;} } }
    const d=dirs[cur]; const tick=sim.tick+1;
    const inp={mx:Math.round(d[0]*32), my:Math.round(d[1]*32), b:0, o:0};
    if(!last || last.mx!==inp.mx || last.my!==inp.my){ entries.push([tick, inp.mx, inp.my, 0, 0]); last=inp; }
    sim.step(inp);
  }
  let prev=0; const log=entries.map(e=>{ const s=(e[0]-prev).toString(36)+','+e[1]+','+e[2]+','+e[3]; prev=e[0]; return s; }).join(';');
  const rep={ v:1, game:'SYNCOPATH', m:'story', s:seed>>>0, ss:String(seed), d:diff, p:'neon', bpm:132, sp:startPhase, lab:null, n:sim.tick, log, ev:[], r:{ score:Math.round(sim.stats.score), hash:sim.stateHash(), state:sim.state }, at:'bot' };
  window.__botRep = rep; window.__botCode = SYNCOPATH.encodeReplay(rep);
  return JSON.stringify({ state:sim.state, t:(sim.tick/120).toFixed(1), lives:sim.player.lives, hits:sim.stats.hits, dmg:Math.round(sim.stats.dmg), clears:sim.stats.phaseClears, score:rep.r.score, hash:rep.r.hash, codeLen:window.__botCode.length });
};
'ok';
