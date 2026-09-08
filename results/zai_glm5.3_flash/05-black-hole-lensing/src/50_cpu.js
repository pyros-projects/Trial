/* ============================================================================
 *  CPU mirror of the shader's disk physics + high-resolution CPU integration
 *  of one selected screen ray (drives the info panel, path overlay, diagram).
 * ========================================================================= */
const fractJ = x => x - Math.floor(x);
function hash12J(px, py){
  let x = fractJ(px*0.1031), y = fractJ(py*0.1031), z = fractJ(px*0.1031);
  const d = x*(y+33.33) + y*(x+33.33) + z*(x+33.33);
  x += d; y += d; z += d;
  return fractJ((x+y)*z);
}
function vnoise2J(px, py){
  const ix = Math.floor(px), iy = Math.floor(py);
  const fx = px-ix, fy = py-iy;
  const ux = fx*fx*(3-2*fx), uy = fy*fy*(3-2*fy);
  const a = hash12J(ix, iy),     b = hash12J(ix+1, iy);
  const c = hash12J(ix, iy+1),   d = hash12J(ix+1, iy+1);
  return lerp(lerp(a, b, ux), lerp(c, d, ux), uy);
}
function fbm2J(px, py){
  let a = 0.5, s = 0;
  for(let i=0;i<5;i++){ s += a*vnoise2J(px, py); px = px*2.03+17.1; py = py*2.03+9.2; a *= 0.5; }
  return s;
}
const jsMod = (x,y) => x - y*Math.floor(x/y);

function blackbodyCSS(T){
  const t = clamp(T, 1000, 40000)*0.01;
  let r, g, b;
  r = t <= 66 ? 1 : clamp(1.29293*Math.pow(t-60, -0.1332047), 0, 1);
  g = t <= 66 ? clamp(0.3900819*Math.log(t) - 0.6318414, 0, 1)
              : clamp(1.1298909*Math.pow(t-60, -0.0755148), 0, 1);
  b = t >= 66 ? 1 : (t <= 19 ? 0 : clamp(0.5432068*Math.log(t-10) - 1.1962541, 0, 1));
  return 'rgb(' + Math.round(r*255) + ',' + Math.round(g*255) + ',' + Math.round(b*255) + ')';
}

function sampleDiskJS(p, vn){
  const { N, U, V } = diskBasis();
  const hgt = v3.dot(p, N);
  const pf = v3.sub(p, v3.scale(N, hgt));
  const r = v3.len(pf);
  const phi = Math.atan2(v3.dot(pf, V), v3.dot(pf, U));
  const H = P.diskH*(0.3 + 0.7*smoothstepJS(P.diskIn, P.diskOut*0.85, r));
  const vz = Math.exp(-0.5*hgt*hgt/(H*H));
  const omega = 1.5/Math.pow(Math.max(r, 0.05), 1.5);
  const phiR = jsMod(phi - R.simTime*omega, TAU);
  const q0 = Math.log(Math.max(r, 0.05))*3.2, q1 = phiR*(12/TAU);
  const n1 = fbm2J(q0, q1), n2 = fbm2J(q0*2.2+4.7, q1*2.9+1.3);
  const m = clamp(0.62*n1 + 0.50*n2, 0, 1.2);
  let dens = lerp(1, smoothstepJS(0.14, 0.95, m), P.turb);
  dens *= smoothstepJS(P.diskIn, P.diskIn*1.07, r)*(1 - smoothstepJS(P.diskOut*0.6, P.diskOut, r));
  dens *= vz;
  const g = Math.sqrt(Math.max(1 - P.rs/Math.max(r, P.rs*1.02), 0.02));
  const beta = Math.min(Math.sqrt(P.rs/(2*Math.max(r, P.rs*0.55))), 0.72)*(P.spin >= 0 ? 1 : -1);
  const tg = v3.norm(v3.cross(N, pf));
  const gam = 1/Math.sqrt(Math.max(1 - beta*beta, 1e-4));
  const dop = 1/(gam*(1 + v3.dot(v3.scale(tg, beta), vn)));
  const temp = P.temp*Math.pow(P.diskIn/Math.max(r, 0.05), 0.75);
  const tempObs = temp*lerp(1, g, P.redK)*Math.pow(dop, 0.6*P.dopK);
  return { r, phi, dop, g, temp: tempObs, dens, pos: p.slice() };
}

const STATE_NAMES = ['escaped to infinity', 'captured by the event horizon', 'step budget exhausted', 'absorbed by the disk'];

function traceRayCPU(px, py){
  const t0 = performance.now();
  const b = camBasis();
  const uvx = (2*px - R.cssW)/R.cssH;
  const uvy = (R.cssH - 2*py)/R.cssH;
  const focal = 1/Math.tan(deg2rad(P.fov)/2);
  const rd = v3.norm(v3.add(v3.scale(b.fwd, focal),
              v3.add(v3.scale(b.right, uvx), v3.scale(b.up, uvy))));
  const ro = b.pos;
  const rs = P.rs, hor = horR(), esc = escRadius();
  const { N: Nd } = diskBasis();

  let p = ro.slice(), vel = rd.slice();
  const am = v3.cross(p, vel);
  const h2 = v3.dot(am, am);
  let minR = v3.len(p), state = 2, steps = 0;
  const pts = [p.slice()];
  const crossings = [];

  for(let i = 0; i < 12000; i++){
    steps = i;
    const r2 = v3.dot(p, p), r = Math.sqrt(r2);
    minR = Math.min(minR, r);
    if(r < hor){ state = 1; break; }
    if(r > esc && v3.dot(p, vel) > 0){ state = 0; break; }
    const dt = 0.5*P.stepMul*rs*clamp(0.09*(r/rs - 0.85), 0.018, 1.4);
    const acc1 = v3.scale(p, -1.5*rs*h2/(r2*r2*r));
    const k1 = v3.add(v3.scale(vel, dt), v3.scale(acc1, 0.5*dt*dt));
    const pm = v3.add(p, k1);
    const r2m = v3.dot(pm, pm), rm = Math.sqrt(r2m);
    const acc2 = v3.scale(pm, -1.5*rs*h2/(r2m*r2m*rm));
    const vn = v3.add(vel, v3.scale(v3.add(acc1, acc2), 0.5*dt));

    const s0 = v3.dot(p, Nd), s1 = v3.dot(pm, Nd);
    if(s0*s1 < 0 && crossings.length < 8){
      const t = s0/(s0 - s1);
      const pc = [lerp(p[0], pm[0], t), lerp(p[1], pm[1], t), lerp(p[2], pm[2], t)];
      const rrc = v3.len(v3.sub(pc, v3.scale(Nd, v3.dot(pc, Nd))));
      if(rrc >= P.diskIn && rrc <= P.diskOut){
        crossings.push(sampleDiskJS(pc, v3.norm(vn)));
      }
    }
    p = pm; vel = vn;
    if(pts.length < 1400) pts.push(p.slice());
  }
  const endDir = v3.norm(vel);
  const defl = state === 1 ? Math.PI : Math.acos(clamp(v3.dot(rd, endDir), -1, 1));
  return {
    ro, rd, pts, crossings, steps, state, minR,
    b: Math.sqrt(h2)/P.rs,
    defl, endDist: v3.len(v3.sub(p, ro)), endDir, endPos: p,
    ms: performance.now() - t0,
  };
}
