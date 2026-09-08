(() => {
const B = window.__bh, P = B.P;
B.setParam('accumMode','off'); B.setParam('adaptive', false); B.setParam('paused', true);
const sig = () => { B.signature(4); return B.signature(8); };
const diff = (a,b)=>{let d=0;for(let i=0;i<a.length;i++)d+=Math.abs(a[i]-b[i]);return +(d/a.length).toFixed(3);};
const out = {};
// (a) disk azimuth only means something once the disk is tilted
B.setParam('diskTilt', 0.7);
const t0 = sig();
B.setParam('diskAz', 2.2);
out.diskAz_with_tilt = diff(t0, sig());
B.setParam('diskAz', 0); B.setParam('diskTilt', 0);
// (b) the shadow is set by the photon capture radius, not by r_h, until r_h exceeds 3M
const shadowRadius = () => {                    // traced capture boundary, in degrees
  const b = B.camBasis(), toBH = [0,0,0].map((_,i)=>-b.pos[i]);
  const n = Math.hypot(...toBH), d0 = toBH.map(v=>v/n);
  const ax = [d0[1], -d0[0], 0]; const an = Math.hypot(...ax); const a2 = ax.map(v=>v/an);
  let lo = 0, hi = 0.9;
  for(let i=0;i<26;i++){ const m=0.5*(lo+hi);
    const dd = d0.map((v,i2)=>v*Math.cos(m)+a2[i2]*Math.sin(m));
    (B.traceJS(b.pos, dd, {maxSteps:3000}).outcome === 0) ? hi=m : lo=m; }
  return +(0.5*(lo+hi)*57.2958).toFixed(4);
};
out.horizonScale_shadow_deg = {};
for(const hs of [0.5, 1.0, 1.5, 1.63, 1.8, 2.0]){
  B.setParam('horizonScale', hs);
  out.horizonScale_shadow_deg['x'+hs+' (r_h='+B.G.rh.toFixed(2)+')'] = shadowRadius();
}
B.setParam('horizonScale', 1.0);
B.setParam('accumMode','taa'); B.setParam('adaptive', true); B.setParam('paused', false);
return JSON.stringify(out);
})()
