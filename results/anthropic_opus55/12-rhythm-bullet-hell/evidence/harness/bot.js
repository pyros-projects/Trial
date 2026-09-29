// Headless dodging bot (test harness only): runs a whole story fight in quiet mode.
window.__bot = function(diff, seed, maxSec){
  const S = SYNCOPATH.Sim; const sim = new S({mode:'story', seed, diff, bpm:132, preset:'neon', lab:null}); sim.quiet = true; if (window.__godLives) { sim.player.lives = 999; }
  const dirs=[[0,0]]; for(let i=0;i<8;i++) dirs.push([Math.cos(i*Math.PI/4), Math.sin(i*Math.PI/4)]);
  const log=[]; let lastPhase=-1; let maxB=0; const phMax={}; const t0=performance.now();
  while(sim.state!=='dead' && sim.state!=='won' && sim.tick < maxSec*120){
    const P=sim.player; let best=0, bs=1e18;
    if (sim.tick % 3 === 0) {
      for(let d=0; d<dirs.length; d++){
        const nx=P.x+dirs[d][0]*250*0.12, ny=P.y+dirs[d][1]*250*0.12; let sc=0;
        if(nx<20||nx>460||ny<200||ny>620) sc+=1e6;
        for(const b of sim.bullets){ const bx=b.x+b.vx*0.12, by=b.y+b.vy*0.12; const dx=bx-nx, dy=by-ny; const d2=dx*dx+dy*dy; if(d2<3600) sc+=1/(d2+1)*1e4; }
        for(const L of sim.lasers){ const ax=Math.cos(L.a), ay=Math.sin(L.a); const px=nx-L.ox, py=ny-L.oy; const t=Math.max(0,px*ax+py*ay); const qx=px-ax*t, qy=py-ay*t; const dd=Math.hypot(qx,qy); if(dd<40) sc+=(40-dd)*50; }
        sc += Math.abs(nx - sim.boss.x)*(window.__aimW||0.02);
        if(sc<bs){bs=sc;best=d;}
      }
      sim.__dir=best;
    }
    const d=dirs[sim.__dir||0];
    sim.step({mx:Math.round(d[0]*32), my:Math.round(d[1]*32), b:0, o:0});
    if(sim.bullets.length>maxB) maxB=sim.bullets.length; phMax[sim.boss.phase]=Math.max(phMax[sim.boss.phase]||0, sim.bullets.length);
    if(sim.boss.phase!==lastPhase){ lastPhase=sim.boss.phase; log.push('ph'+(lastPhase+1)+'@'+(sim.tick/120).toFixed(1)+'s'); }
  }
  const st=sim.stats;
  return JSON.stringify({diff, seed, end:sim.state, t:(sim.tick/120).toFixed(1), phases:log.join(' '), maxBullets:maxB, perPhaseMax:JSON.stringify(phMax), lives:sim.player.lives, hits:st.hits, graze:st.graze, clears:st.phaseClears, timeouts:st.timeouts, score:Math.round(st.score), dmg:Math.round(st.dmg), cpuMs:Math.round(performance.now()-t0)});
};
'bot ready';
