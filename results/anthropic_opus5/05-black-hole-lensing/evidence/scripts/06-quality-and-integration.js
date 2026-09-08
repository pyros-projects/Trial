(() => {
const B = window.__bh, out = {};
B.setParam('adaptive', false); B.setParam('accumMode','off');
// --- quality presets drive resolution / steps / octaves / integrator
out.presets = ['low','medium','high','ultra'].map(q=>{
  B.applyQuality(q);
  B.signature(2);                                   // forces a resize + render
  B.signature(2);
  const m = B.metrics();
  return { quality:q, W:m.W, H:m.H, scale:B.P.renderScale, maxSteps:B.P.maxSteps,
           octaves:B.P.octaves, integrator:B.P.rk4?'RK4':'Verlet', stepSize:B.P.stepSize };
});
// --- selecting a control manually flips the preset label to "custom"
B.applyQuality('high');
B.setParam('maxSteps', 512);
out.customSwitch = { afterManualEdit: B.P.quality, maxSteps: B.P.maxSteps };
// --- integrator agreement: Verlet vs RK4 on the same strongly bent ray
{
  const P = B.P, sv = {rk4:P.rk4, step:P.stepSize, ms:P.maxSteps, spin:P.spin};
  P.spin = 0; P.maxSteps = 20000;
  const runs = {};
  for(const st of [0.30, 0.14, 0.06, 0.02]){
    P.stepSize = st;
    const t = B.traceJS([6,0,-400],[0,0,1],{maxSteps:20000});
    runs['step_'+st] = { steps:t.steps, bend_deg:+(t.totalBend*180/Math.PI).toFixed(4),
                         minR:+t.minR.toFixed(4) };
  }
  Object.assign(P, sv);
  out.stepConvergence = runs;
}
// --- step size / max steps visibly change the rendered image
{
  const sigs = {};
  for(const ms of [40, 120, 400]){
    B.setParam('maxSteps', ms); B.signature(2);
    const s = B.signature(6);
    sigs['maxSteps_'+ms] = +(s.reduce((a,b)=>a+b,0)/s.length).toFixed(2);
  }
  out.maxStepsEffect = sigs;
}
B.applyQuality('low'); B.setParam('adaptive', true); B.setParam('accumMode','taa');
return JSON.stringify(out);
})()
