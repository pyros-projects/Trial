(() => {
const B = window.__bh, P = B.P, C = B.CAM;
const sv = {spin:P.spin, dist:C.dist, fov:P.fov, ms:P.maxSteps, step:P.stepSize};
P.spin = 0; P.maxSteps = 4000; P.stepSize = 0.05;
const bc = 3*Math.sqrt(3)*P.mass;
const out = [];
for(const [dist, fov] of [[20,60],[32,35],[60,20],[95,12]]){
  C.dist = dist; P.fov = fov;
  // bisect horizontally across the shadow edge on screen (y = vertical centre)
  let lo = 640, hi = 20;                        // lo inside the shadow, hi outside
  for(let i=0;i<28;i++){
    const m = Math.round((lo+hi)/2*100)/100;
    B.selectRay(m, 400);
    (B.selection().trace.outcome === 1) ? (lo = m) : (hi = m);
  }
  B.selectRay(lo, 400);
  const s = B.selection().trace;
  out.push({ cam_dist:dist, fov, edge_px:+lo.toFixed(2), b:+s.b.toFixed(4),
             b_over_bcrit:+(s.b/bc).toFixed(4), minR:+s.minR.toFixed(3), steps:s.steps });
}
C.dist = sv.dist; P.fov = sv.fov; P.spin = sv.spin; P.maxSteps = sv.ms; P.stepSize = sv.step;
return JSON.stringify(out);
})()
