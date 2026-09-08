(() => {
const B = window.__bh, P = B.P, V0 = [0,0,0];
const saved = JSON.parse(JSON.stringify({spin:P.spin, mass:P.mass, step:P.stepSize, ms:P.maxSteps,
                                         din:P.diskIn, dout:P.diskOut, hs:P.horizonScale}));
P.spin = 0; P.mass = 1; P.stepSize = 0.03; P.maxSteps = 3000;
P.diskIn = 1e4; P.diskOut = 1e4+1;               // disk out of the way
const res = {};

// helper: shoot a ray from (0,0,-R) toward +z with lateral offset b
function shoot(R, b, maxSteps){
  B.G.escape = 1e5;                               // integrate far into the asymptotic region
  const o = [0, 0, -R];
  const dir = [0, 0, 1];
  // aim so the impact parameter is exactly b: offset the start laterally
  const o2 = [b, 0, -R];
  return B.traceJS(o2, dir, {maxSteps: maxSteps||3000});
}
// 1. weak-field deflection alpha ~ 4M/b
res.weakField = [];
for(const b of [2000, 500, 200, 100, 50, 20]){
  const t = shoot(2e4, b);
  const pred = 4*P.mass/b;
  res.weakField.push({b, measured_deg:+(t.totalBend*180/Math.PI).toFixed(5),
                      predicted_deg:+(pred*180/Math.PI).toFixed(5),
                      rel_err:+(Math.abs(t.totalBend-pred)/pred).toFixed(4), outcome:t.outcome});
}
// 2. critical impact parameter should be 3*sqrt(3)*M = 5.19615
let lo = 1, hi = 12;
for(let i=0;i<50;i++){
  const mid = 0.5*(lo+hi);
  const t = shoot(2000, mid, 20000);
  if(t.outcome === 0) hi = mid; else lo = mid;
}
res.bCrit = { measured:+(0.5*(lo+hi)).toFixed(5), analytic:+(3*Math.sqrt(3)).toFixed(5),
              rel_err:+(Math.abs(0.5*(lo+hi) - 3*Math.sqrt(3))/(3*Math.sqrt(3))).toFixed(5) };
// 3. strong deflection: b slightly above critical must wind past 180 deg
res.strong = [3*Math.sqrt(3)*1.001, 3*Math.sqrt(3)*1.01, 3*Math.sqrt(3)*1.2, 3*Math.sqrt(3)*2].map(b=>{
  const t = shoot(2000, b, 20000);
  return {b:+b.toFixed(3), bend_deg:+(t.defl*180/Math.PI).toFixed(1), minR:+t.minR.toFixed(3),
          outcome:['sky','captured','budget','disk'][t.outcome]};
});
// 4. photon sphere: minimum approach for a marginally escaping ray -> 3M
res.photonSphere = { minR_at_bcrit_plus:+shoot(2000, 3*Math.sqrt(3)*1.0005, 20000).minR.toFixed(4),
                     analytic:3 };
// 5. conservation: |x cross v| must stay constant along a strongly deflected ray
{
  const t = shoot(200, 6, 5000);
  const p0 = t.path ? null : null;
  const tt = B.traceJS([6,0,-200],[0,0,1],{path:true, maxSteps:5000});
  const cr = (a,b)=>[a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
  const hs = [];
  for(let i=1;i<tt.path.length;i++){
    const dp = [tt.path[i][0]-tt.path[i-1][0], tt.path[i][1]-tt.path[i-1][1], tt.path[i][2]-tt.path[i-1][2]];
    const c = cr(tt.path[i], dp);
    const n = Math.hypot(c[0],c[1],c[2]) / Math.hypot(dp[0],dp[1],dp[2]);
    hs.push(n);
  }
  hs.sort((a,b)=>a-b);
  res.angularMomentum = { b_nominal:6, min:+hs[0].toFixed(4), max:+hs[hs.length-1].toFixed(4),
                          median:+hs[Math.floor(hs.length/2)].toFixed(4),
                          drift_pct:+((hs[hs.length-1]-hs[0])/hs[Math.floor(hs.length/2)]*100).toFixed(3) };
}
Object.assign(P, {spin:saved.spin, mass:saved.mass, stepSize:saved.step, maxSteps:saved.ms,
                  diskIn:saved.din, diskOut:saved.dout, horizonScale:saved.hs});
return JSON.stringify(res, null, 1);
})()
