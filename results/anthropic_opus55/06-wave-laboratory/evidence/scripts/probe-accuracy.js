(() => { const L = waveLab, s = L.scene.sources[0], W = L.sim.W;
  const r = L.scene.probes.map(p => Math.hypot(p.u*W - s.u*W, p.v - s.v));
  const st = L.scene.probes.map((_, i) => L.probeStats(i));
  const d = (a,b) => { let x = (b - a) * 180/Math.PI; return ((x + 540) % 360) - 180; };
  const m360 = (x) => ((x % 360) + 540) % 360 - 180;
  const k = 2*Math.PI*s.freq/L.settings.c0, C = L.settings.c0*L.sim.dt/L.sim.dx;
  const kNum = (2/L.sim.dx)*Math.asin(Math.sin(2*Math.PI*s.freq*L.sim.dt/2)/C);
  return JSON.stringify({ t: +L.sim.t.toFixed(2), f_src: s.freq, r: r.map(v=>+v.toFixed(4)),
    f_meas: st.map(q=>+q.fdom.toFixed(3)), A_lockin: st.map(q=>+q.lockAmp.toFixed(4)),
    'dphi(P1->P3, dr=λ/4, rotated 90°)_meas': +d(st[0].phase, st[2].phase).toFixed(2),
    '_exact': +m360(-(k*(r[2]-r[0]))*180/Math.PI).toFixed(2), '_axisGridDisp': +m360(-(kNum*(r[2]-r[0]))*180/Math.PI).toFixed(2),
    'A(P2)/A(P1)_meas': +(st[1].lockAmp/st[0].lockAmp).toFixed(4), 'sqrt(r1/r2)': +Math.sqrt(r[0]/r[1]).toFixed(4),
    'dphi(P1->P2, dr=0.3)_meas': +d(st[0].phase, st[1].phase).toFixed(1), '_exact': +m360(-k*(r[1]-r[0])*180/Math.PI).toFixed(1), '_axisGridDisp ': +m360(-kNum*(r[1]-r[0])*180/Math.PI).toFixed(1) }); })()
