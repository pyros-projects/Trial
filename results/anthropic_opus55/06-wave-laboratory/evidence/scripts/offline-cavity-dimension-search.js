// find odd-odd cavity modes (centre-driven) with best isolation from other odd-odd modes
const res=[];
for (let Lx=0.80; Lx<=0.95; Lx+=0.01) for (let Ly=0.45; Ly<=0.62; Ly+=0.01) {
  const modes=[];
  for (let m=1;m<=25;m+=2) for (let n=1;n<=25;n+=2) modes.push({m,n,f:0.5*Math.hypot(m/Lx,n/Ly)});
  for (const t of modes) { if (t.f<6.5||t.f>11) continue;
    let gap=1e9; for (const o of modes) if (o!==t) gap=Math.min(gap,Math.abs(o.f-t.f));
    res.push({Lx:+Lx.toFixed(2),Ly:+Ly.toFixed(2),m:t.m,n:t.n,f:+t.f.toFixed(3),gap:+gap.toFixed(3),rel:gap/t.f});
  }
}
res.sort((a,b)=>b.gap-a.gap); console.log(res.slice(0,15));
