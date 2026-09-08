(() => {
const B = window.__bh, P = B.P;
const sv = JSON.parse(JSON.stringify({spin:P.spin, mass:P.mass, step:P.stepSize, ms:P.maxSteps,
                                      din:P.diskIn, dout:P.diskOut}));
P.spin = 0; P.mass = 1; P.stepSize = 0.03; P.maxSteps = 20000;
P.diskIn = 1e4; P.diskOut = 1e4+1;
B.G.escape = 1e5;
const res = {};

// 1. deflection vs the post-Newtonian series alpha = 4M/b + 15 pi M^2/(4 b^2)
res.deflection = [2000,500,200,100,50,20,12].map(b=>{
  const t = B.traceJS([b,0,-2e4],[0,0,1],{maxSteps:20000});
  const a1 = 4/b, a2 = a1 + 15*Math.PI/(4*b*b);
  return { b, measured_deg:+(t.totalBend*180/Math.PI).toFixed(5),
           first_order_deg:+(a1*180/Math.PI).toFixed(5),
           second_order_deg:+(a2*180/Math.PI).toFixed(5),
           err_vs_2nd_order:+(Math.abs(t.totalBend-a2)/a2).toFixed(5) };
});

// 2. conserved quantities along a strongly bent ray:
//    h = |x x v| exactly conserved; energy gives |v|^2 = 1 + 2 M h^2 / r^3.
//    From the recorded polyline we can only get |x x dx|/|dx| = h/|v|; compare with theory.
{
  const b = 6;
  const t = B.traceJS([b,0,-400],[0,0,1],{path:true, maxSteps:20000});
  const cr=(a,c)=>[a[1]*c[2]-a[2]*c[1], a[2]*c[0]-a[0]*c[2], a[0]*c[1]-a[1]*c[0]];
  let worst = 0, n = 0;
  for(let i=1;i<t.path.length;i++){
    const p = t.path[i];
    const dp = [p[0]-t.path[i-1][0], p[1]-t.path[i-1][1], p[2]-t.path[i-1][2]];
    const c = cr(p, dp);
    const meas = Math.hypot(c[0],c[1],c[2]) / Math.hypot(dp[0],dp[1],dp[2]);
    const r = Math.hypot(p[0],p[1],p[2]);
    const pred = b / Math.sqrt(1 + 2*b*b/(r*r*r));
    worst = Math.max(worst, Math.abs(meas-pred)/pred); n++;
  }
  res.conservation = { b, samples:n, max_rel_err_vs_theory:+worst.toFixed(5), minR:+t.minR.toFixed(4) };
}

// 3. shadow angular radius vs the static-observer formula sin(theta) = b_c/r * sqrt(1-2M/r)
res.shadowAngle = [10, 20, 50, 200].map(R=>{
  const o = [0,0,-R], toBH = [0,0,1];
  let lo = 0, hi = 1.4;
  for(let i=0;i<40;i++){
    const m = 0.5*(lo+hi);
    const d = [Math.sin(m), 0, Math.cos(m)];
    if(B.traceJS(o, d, {maxSteps:20000}).outcome === 0) hi = m; else lo = m;
  }
  const meas = 0.5*(lo+hi);
  const pred = Math.asin(Math.min(1, 3*Math.sqrt(3)/R*Math.sqrt(Math.max(1-2/R,0))));
  return { r_obs:R, measured_deg:+(meas*180/Math.PI).toFixed(4),
           analytic_deg:+(pred*180/Math.PI).toFixed(4),
           rel_err:+(Math.abs(meas-pred)/pred).toFixed(5) };
});

// 4. spin breaks the symmetry: prograde vs retrograde capture angle
{
  P.spin = 0.9;
  const R = 20, o = [0,0,-R];
  const cap = (sgn)=>{ let lo=0, hi=1.2;
    for(let i=0;i<32;i++){ const m=0.5*(lo+hi);
      const d=[sgn*Math.sin(m),0,Math.cos(m)];
      if(B.traceJS(o,d,{maxSteps:20000}).outcome===0) hi=m; else lo=m; }
    return 0.5*(lo+hi); };
  const a = cap(1), c = cap(-1);
  P.spin = 0;
  const iso = (()=>{ let lo=0,hi=1.2;
    for(let i=0;i<32;i++){ const m=0.5*(lo+hi);
      if(B.traceJS(o,[Math.sin(m),0,Math.cos(m)],{maxSteps:20000}).outcome===0) hi=m; else lo=m; }
    return 0.5*(lo+hi); })();
  res.spinAsymmetry = { a09_side1_deg:+(a*180/Math.PI).toFixed(4), a09_side2_deg:+(c*180/Math.PI).toFixed(4),
                        a0_deg:+(iso*180/Math.PI).toFixed(4),
                        asymmetry_pct:+(Math.abs(a-c)/((a+c)/2)*100).toFixed(2) };
}
Object.assign(P, {spin:sv.spin, mass:sv.mass, stepSize:sv.step, maxSteps:sv.ms, diskIn:sv.din, diskOut:sv.dout});
return JSON.stringify(res);
})()
