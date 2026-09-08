(() => {
const B = window.__bh, P = B.P;
B.setParam('accumMode','off'); B.setParam('adaptive', false); B.setParam('paused', true);
B.applyPreset(0);
B.CAM.dist = 32; B.CAM.yaw = 0.62; B.CAM.pitch = 0.145; P.fov = 35;
const sig = () => { B.signature(4); return B.signature(8); };
const diff = (a,b) => { let d=0; for(let i=0;i<a.length;i++) d += Math.abs(a[i]-b[i]); return +(d/a.length).toFixed(3); };
const base = sig();
const tests = [
  ['mass', 1.9], ['horizonScale', 1.7], ['spin', 0.0], ['spinDir', -1],
  ['diskIn', 9.0], ['diskOut', 13.0], ['diskH', 1.4], ['diskTilt', 0.9], ['diskAz', 2.2],
  ['temp', 24000], ['turb', 0.0], ['turbScale', 1.6], ['doppler', 0.0], ['redshift', 0.0],
  ['diskGain', 2.2], ['diskOpacity', 2.4], ['skyGain', 2.5],
  ['exposure', 1.6], ['contrast', 1.7], ['bloom', 1.4],
  ['stepSize', 0.35], ['maxSteps', 45], ['octaves', 5], ['rk4', 1],
  ['fov', 70], ['simTime', 140]
];
const out = [];
for(const [id, val] of tests){
  const old = P[id];
  B.setParam(id, val);
  const s = sig();
  out.push({ param:id, from:old, to:P[id], mean_abs_delta:diff(base, s) });
  B.setParam(id, old);
}
// camera controls
const camTests = [];
for(const [id, val] of [['camDist', 55], ['camPitch', 62], ['camYaw', 210]]){
  const before = sig();
  const old = (id==='camDist')?B.CAM.dist:(id==='camPitch'?B.CAM.pitch*57.2958:B.CAM.yaw*57.2958);
  B.setParam(id, val);
  camTests.push({ param:id, mean_abs_delta:diff(before, sig()) });
  B.setParam(id, old);
}
// accumulation behaviour: progressive must converge (successive frames get closer)
B.setParam('accumMode','progressive');
B.signature(4);
const a1 = B.signature(8), a2 = B.signature(8), a3 = B.signature(8);
const accum = { delta_frame1_2: diff(a1,a2), delta_frame2_3: diff(a2,a3) };
B.setParam('accumMode','off');
const o1 = B.signature(8), o2 = B.signature(8);
accum.delta_accum_off = diff(o1,o2);
B.setParam('accumMode','taa'); B.setParam('adaptive', true); B.setParam('paused', false);
return JSON.stringify({params:out, camera:camTests, accumulation:accum});
})()
