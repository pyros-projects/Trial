/* ============================================================================
 *  Global state, parameter store, small math helpers.
 * ========================================================================= */
const $ = id => document.getElementById(id);
const TAU = Math.PI*2;
const clamp = (x,a,b) => x<a?a:(x>b?b:x);
const lerp = (a,b,t) => a+(b-a)*t;
const smoothstepJS = (a,b,x) => { const t = clamp((x-a)/(b-a),0,1); return t*t*(3-2*t); };
const deg2rad = d => d*Math.PI/180;
const rad2deg = r => r*180/Math.PI;
const fmt = (x,n=2) => Number(x).toFixed(n);
const v3 = {
  sub:(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],
  add:(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],
  scale:(a,s)=>[a[0]*s,a[1]*s,a[2]*s],
  dot:(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],
  cross:(a,b)=>[a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]],
  len:a=>Math.hypot(a[0],a[1],a[2]),
  norm(a){ const l=Math.hypot(a[0],a[1],a[2])||1; return [a[0]/l,a[1]/l,a[2]/l]; },
};

/* ---------------- user parameters ---------------- */
const P = {
  fov: 60, timeScale: 1, autoOrbit: true,
  rs: 1.0,               // Schwarzschild radius = mass / lensing strength
  spin: 0.6,             // dimensionless spin a/M (approximation)
  horizonK: 1.0,         // event-horizon size multiplier
  diskIn: 3.0, diskOut: 13.0, diskH: 0.18,
  incl: 0,               // disk inclination (deg, tilt of disk plane)
  temp: 9200, turb: 0.62,
  dopK: 0.75, redK: 1.0,
  exposure: 1.3, contrast: 1.06, bloom: 0.6,
  stepMul: 1.0, maxSteps: 480,
  scale: 0.78, quality: 'high', accumMax: 32,
};
const QUALITY = {
  low:    { scale:0.5,  maxSteps:220, accumMax:1,  bloom:0   },
  medium: { scale:0.62, maxSteps:320, accumMax:16, bloom:0.6 },
  high:   { scale:0.78, maxSteps:480, accumMax:32, bloom:0.6 },
  ultra:  { scale:1.0,  maxSteps:800, accumMax:48, bloom:0.7 },
  auto:   { scale:0.7,  maxSteps:380, accumMax:24, bloom:0.6 },
};
const OV = { hor:true, phot:true, disk:true, ray:true, shadow:true };   // overlay toggles

/* ---------------- runtime state ---------------- */
const R = {
  gl:null, mode:0, paused:false, simTime:47.0, uiHidden:false,
  accN:0, frame:0, dirty:true, sel:null, selData:null,
  enc:0, floatOK:false, fps:0, msEMA:0,
  cssW:2, cssH:2, dpr:1, renderW:2, renderH:2,
  adaptiveMsg:'', lastSelCompute:0, bootT:performance.now(),
  gpu:'webgl2', selSteps:0, selMs:0,
};

const MODES = [
  'Final image', 'Ray step count', 'Deflection magnitude',
  'Redshift · Doppler', 'Disk intersection coords',
  'Distance to black hole', 'Escape / failure class',
];
const LEGENDS = [
  '',
  'step fraction of max integration budget',
  'deflection angle θ (turbo): <span style="color:#5aa">0</span> → <span style="color:#e9a23b">π</span>',
  'combined g·δ at primary disk image: <span style="color:#ff5a2a">redshifted</span> · <span style="color:#fff">≈1</span> · <span style="color:#5599ff">blueshifted</span>',
  'R = r/r_out · G = φ/2π · B = density (grid every 1/8)',
  'distance travelled (turbo, log scale, units of rs)',
  '<i style="background:#0da64d"></i>escaped &nbsp;<i style="background:#eb1a14"></i>captured &nbsp;<i style="background:#f2d11f"></i>step-limit &nbsp;<i style="background:#9940f2"></i>disk-absorbed',
];

/* ---------------- derived black-hole geometry ---------------- */
function horR(){            // event-horizon radius (Kerr, horizonK multiplier)
  const rg = P.rs/2, a = clamp(P.spin,-0.999,0.999);
  return P.horizonK*rg*(1 + Math.sqrt(Math.max(0, 1-a*a)));
}
function photonR(){         // prograde equatorial photon orbit (marker, follows spin sign)
  const rg = P.rs/2, a = Math.abs(clamp(P.spin,-0.998,0.998));
  return rg*2*(1 + Math.cos((2/3)*Math.acos(-a)));
}
function iscoR(){           // signed-spin prograde ISCO in rs units (marker / reference)
  const a = clamp(P.spin,-0.998,0.998), s = a >= 0 ? 1 : -1, m = Math.abs(a);
  const Z1 = 1 + Math.cbrt(1-m*m)*(Math.cbrt(1+m) + Math.cbrt(1-m));
  const Z2 = Math.sqrt(3*m*m + Z1*Z1);
  return (3 + Z2 - s*Math.sqrt((3-Z1)*(3+Z1+2*Z2)))*P.rs/2 / P.rs; // in units of rs
}
function diskBasis(){
  const i = deg2rad(P.incl), c = Math.cos(i), s = Math.sin(i);
  const N = [0, c, s];
  const U = [1, 0, 0];
  const V = [0, s, -c];      // U × V = N
  return { N, U, V };
}
function escRadius(){ return Math.max(P.diskOut*1.45, cam.dist*1.3 + 2, P.rs*28); }

/* ---------------- camera ---------------- */
const cam = {
  yaw: deg2rad(190), pitch: deg2rad(5), dist: 17,
  target: [0,0,0], vyaw: 0, vpitch: 0,
  anim: null,               // preset animation {t0, dur, from:{...}, to:{...}}
};
function camBasis(){
  const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  const cy = Math.cos(cam.yaw),   sy = Math.sin(cam.yaw);
  const dir = [cp*sy, sp, cp*cy];
  const pos = v3.add(cam.target, v3.scale(dir, cam.dist));
  const fwd = v3.scale(dir, -1);
  let right = v3.cross(fwd, [0,1,0]);
  const rl = v3.len(right);
  right = rl < 1e-5 ? [1,0,0] : v3.scale(right, 1/rl);
  const up = v3.cross(right, fwd);
  return { pos, fwd, right, up, dir };
}
function markDirty(){ R.dirty = true; }
function camDistRs(){ return cam.dist/P.rs; }
