(() => {
const B = window.__bh, P = B.P;
const sv = {spin:P.spin, mass:P.mass, step:P.stepSize, ms:P.maxSteps, din:P.diskIn, dout:P.diskOut};
P.spin = 0; P.mass = 1; P.stepSize = 0.03; P.maxSteps = 20000; P.diskIn = 1e4; P.diskOut = 1e4+1;
B.G.escape = 1e5;
// A camera ray is emitted with |v| = 1 in coordinate directions, so its impact parameter,
// normalised to the asymptotic |v|=1 used by b_crit, is b = r sin(t)/sqrt(1 - 2M sin^2(t)/r).
// Setting that equal to 3*sqrt(3) M gives sin(t) = sqrt(27 / (r^2 + 54/r)).
const out = [10,20,32,50,200].map(R=>{
  let lo=0, hi=1.4;
  for(let i=0;i<44;i++){ const m=0.5*(lo+hi);
    if(B.traceJS([0,0,-R],[Math.sin(m),0,Math.cos(m)],{maxSteps:20000}).outcome===0) hi=m; else lo=m; }
  const meas = 0.5*(lo+hi);
  const pred = Math.asin(Math.sqrt(27/(R*R + 54/R)));
  const staticObs = Math.asin(Math.min(1, 3*Math.sqrt(3)/R*Math.sqrt(Math.max(1-2/R,0))));
  return { r_obs:R, measured_deg:+(meas*180/Math.PI).toFixed(4),
           coord_frame_analytic_deg:+(pred*180/Math.PI).toFixed(4),
           rel_err:+(Math.abs(meas-pred)/pred).toFixed(6),
           static_observer_deg:+(staticObs*180/Math.PI).toFixed(4) };
});
Object.assign(P, {spin:sv.spin, mass:sv.mass, stepSize:sv.step, maxSteps:sv.ms, diskIn:sv.din, diskOut:sv.dout});
return JSON.stringify(out);
})()
