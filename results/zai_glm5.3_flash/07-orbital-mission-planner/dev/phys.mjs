import { makeState, run, elements, progradeDV, accel } from './physlib.mjs';
const G=1;
const fmt=(x,d=4)=>x.toFixed(d);
// ============ 1. Default system sanity ============
{
  const s = makeState([
    { name: 'Star', m: 1000, r: 5, x: 0, y: 0, vx: 0, vy: 0 },
    { name: 'Planet', m: 10, r: 0.8, x: 60, y: 0, vx: 0, vy: Math.sqrt(1000 / 60) },
    { name: 'Moon', m: 0.05, r: 0.3, x: 64, y: 0, vx: 0, vy: Math.sqrt(1000 / 60) + Math.sqrt(10 / 4) },
    { name: 'Craft', m: 1e-6, r: 0.05, x: 62, y: 0, vx: 0, vy: Math.sqrt(1000 / 60) + Math.sqrt(10 / 2), craft: true },
  ]);
  const E0 = energyTotal(s);
  run(s, 0, 20, 0.002);
  const E1 = energyTotal(s);
  console.log(`[default] craft orbit e=${fmt(elements(s, 3, 1).e)} drift=${fmt((E1 - E0) / Math.abs(E0), 12)} moon e=${fmt(elements(s, 2, 1).e)}`);
}

function energyTotal(s) {
  let E = 0;
  for (let i = 0; i < s.n; i++) E += 0.5 * s.m[i] * (s.vx[i] ** 2 + s.vy[i] ** 2);
  for (let i = 0; i < s.n; i++) for (let j = i + 1; j < s.n; j++) E -= G * s.m[i] * s.m[j] / Math.hypot(s.x[j] - s.x[i], s.y[j] - s.y[i]);
  return E;
}

// ============ 2. Circular & ellipse sanity ============
{
  const s = makeState([
    { name: 'Planet', m: 10, r: 0.8, x: 0, y: 0, vx: 0, vy: 0 },
    { name: 'Craft', m: 1e-6, r: 0.05, x: 5, y: 0, vx: 0, vy: Math.sqrt(10 / 5), craft: true },
  ]);
  const el0 = elements(s, 1, 0);
  run(s, 0, 3 * el0.T, 0.001);
  const el1 = elements(s, 1, 0);
  console.log(`[circular] T=${fmt(el0.T, 3)} r start=${fmt(el0.r, 5)} end=${fmt(el1.r, 5)} e=${fmt(el1.e, 8)}`);
}
{
  const s = makeState([
    { name: 'Planet', m: 10, r: 0.8, x: 0, y: 0, vx: 0, vy: 0 },
    { name: 'Craft', m: 1e-6, r: 0.05, x: 2, y: 0, vx: 0, vy: Math.sqrt(10 * (2 / 2 - 1 / 5.5)), craft: true },
  ]);
  const el0 = elements(s, 1, 0);
  // find apoapsis r after one period
  let maxR = 0;
  run(s, 0, el0.T, 0.001, () => { maxR = Math.max(maxR, elements(s, 1, 0).r); });
  const el1 = elements(s, 1, 0);
  console.log(`[ellipse] target rp=2 ra=9 -> measured rp=${fmt(el1.rp, 4)} ra(measured max)=${fmt(maxR, 4)} e=${fmt(el1.e, 5)} T=${fmt(el0.T, 3)}`);
}

// ============ 3. Hohmann transfer (planet-only, r 6 -> 14) ============
{
  const mu = 10, r1 = 6, r2 = 14, at = (r1 + r2) / 2;
  const vp1 = Math.sqrt(mu / r1), va2 = Math.sqrt(mu / r2);
  const vt1 = Math.sqrt(mu * (2 / r1 - 1 / at)), vt2 = Math.sqrt(mu * (2 / r2 - 1 / at));
  const dv1 = vt1 - vp1, dv2 = va2 - vt2, tT = Math.PI * Math.sqrt(at ** 3 / mu);
  const s = makeState([
    { name: 'Planet', m: 10, r: 0.8, x: 0, y: 0, vx: 0, vy: 0 },
    { name: 'Craft', m: 1e-6, r: 0.05, x: 6, y: 0, vx: 0, vy: vp1, craft: true },
  ]);
  run(s, 0, 0.25, 0.002);
  progradeDV(s, 1, 0, dv1);
  run(s, 0.25, 0.25 + tT, 0.002);
  const mid = elements(s, 1, 0);
  progradeDV(s, 1, 0, dv2);
  run(s, 0.25 + tT, 0.25 + tT + 5, 0.002);
  const fin = elements(s, 1, 0);
  console.log(`[hohmann] dv1=${fmt(dv1)} dv2=${fmt(dv2)} tT=${fmt(tT, 3)}`);
  console.log(`          mid: rp=${fmt(mid.rp, 4)} ra=${fmt(mid.ra, 4)} | final: r=${fmt(fin.r, 5)} e=${fmt(fin.e, 6)} (target r=${r2})`);
}

// ============ 4. Moon transfer: phase moon so craft apo meets moon ============
{
  const mu = 10, rC = 2.5, rM = 4;
  const at = (rC + rM) / 2;
  const vc = Math.sqrt(mu / rC);
  const vtp = Math.sqrt(mu * (2 / rC - 1 / at));
  const dv = vtp - vc;
  const tT = Math.PI * Math.sqrt(at ** 3 / mu);
  const wM = Math.sqrt(mu / rM ** 3);
  const th0 = Math.PI - wM * tT; // moon starts here so it is at 180deg when craft arrives
  const s = makeState([
    { name: 'Planet', m: 10, r: 0.8, x: 0, y: 0, vx: 0, vy: 0 },
    { name: 'Moon', m: 0.05, r: 0.3, x: rM * Math.cos(th0), y: rM * Math.sin(th0), vx: 0, vy: Math.sqrt(mu / rM) },
    { name: 'Craft', m: 1e-6, r: 0.05, x: rC, y: 0, vx: 0, vy: vc, craft: true },
  ]);
  accel(s); // moon velocity needs to be tangential: rebuild properly below
  // rebuild moon velocity tangential (vy only correct if moon at angle: v tangential = w x r)
  s.vx[1] = -Math.sqrt(mu / rM) * Math.sin(th0);
  s.vy[1] = Math.sqrt(mu / rM) * Math.cos(th0);
  run(s, 0, 0.25, 0.002);
  progradeDV(s, 2, 0, dv);
  let minD = 1e9, tMin = 0;
  run(s, 0.25, 0.25 + tT + 4, 0.002, (t) => {
    const d = Math.hypot(s.x[2] - s.x[1], s.y[2] - s.y[1]);
    if (d < minD) { minD = d; tMin = t; }
  });
  const el = elements(s, 2, 0);
  console.log(`[moon-transfer] dv=${fmt(dv)} th0=${fmt(th0 * 180 / Math.PI, 2)}deg tT=${fmt(tT, 3)} minD-moon=${fmt(minD, 4)} @t=${fmt(tMin, 3)} post e=${fmt(el.e, 4)} a=${fmt(el.a, 4)}`);
}

// ============ 5. Slingshot: scan moon phase for max energy gain ============
// Craft: elliptic rp=2 ra=9 around planet(m=10). Moon r=4. Scan moon angle.
{
  const results = [];
  for (let deg = 0; deg < 360; deg += 5) {
    const th0 = deg * Math.PI / 180;
    const s = makeState([
      { name: 'Planet', m: 10, r: 0.8, x: 0, y: 0, vx: 0, vy: 0 },
      { name: 'Moon', m: 0.05, r: 0.3, x: 4 * Math.cos(th0), y: 4 * Math.sin(th0), vx: -Math.sqrt(10 / 4) * Math.sin(th0), vy: Math.sqrt(10 / 4) * Math.cos(th0) },
      { name: 'Craft', m: 1e-6, r: 0.05, x: 2, y: 0, vx: 0, vy: Math.sqrt(10 * (2 / 2 - 1 / 5.5)), craft: true },
    ]);
    const eps0 = elements(s, 2, 0).eps;
    let minD = 1e9;
    run(s, 0, 12, 0.001, () => { minD = Math.min(minD, Math.hypot(s.x[2] - s.x[1], s.y[2] - s.y[1])); });
    const eps1 = elements(s, 2, 0).eps;
    results.push({ deg, dE: eps1 - eps0, minD });
  }
  results.sort((a, b) => Math.abs(b.dE) - Math.abs(a.dE));
  console.log('[slingshot-scan] top energy changes (deg, dE, minD):');
  for (const r of results.slice(0, 8)) console.log(`   ${r.deg}deg dE=${fmt(r.dE, 4)} minD=${fmt(r.minD, 3)}`);
}

// ============ 6. Pythagorean three-body ============
{
  const s = makeState([
    { name: 'B3', m: 3, r: 0.4, x: 1, y: 3, vx: 0, vy: 0 },
    { name: 'B4', m: 4, r: 0.45, x: -2, y: -1, vx: 0, vy: 0 },
    { name: 'B5', m: 5, r: 0.5, x: 1, y: -1, vx: 0, vy: 0 },
    { name: 'Craft', m: 1e-6, r: 0.05, x: -8, y: 5, vx: 0, vy: 0.4, craft: true },
  ]);
  const E0 = energyTotal(s);
  // adaptive-ish: fixed small dt with DP54 would be better; check with small VV dt
  let ejected = -1;
  run(s, 0, 70, 0.0005, (t) => {
    for (let i = 0; i < 3; i++) {
      const r = Math.hypot(s.x[i], s.y[i]);
      if (r > 40 && ejected < 0) ejected = t;
    }
  });
  const E1 = energyTotal(s);
  console.log(`[threebody] ejected@t=${fmt(ejected, 2)} dE=${fmt((E1 - E0) / Math.abs(E0), 10)} pos3=(${fmt(s.x[0], 2)},${fmt(s.y[0], 2)}) pos4=(${fmt(s.x[1], 2)},${fmt(s.y[1], 2)}) pos5=(${fmt(s.x[2], 2)},${fmt(s.y[2], 2)})`);
}

// ============ 7. Escape ============
{
  const vEscPlanet = Math.sqrt(2 * 10 / 2);
  const vPlanet = Math.sqrt(1000 / 60);
  const v = 1.15 * vEscPlanet;
  const s = makeState([
    { name: 'Star', m: 1000, r: 5, x: 0, y: 0, vx: 0, vy: 0 },
    { name: 'Planet', m: 10, r: 0.8, x: 60, y: 0, vx: 0, vy: vPlanet },
    { name: 'Craft', m: 1e-6, r: 0.05, x: 62, y: 0, vx: 0, vy: vPlanet + v, craft: true },
  ]);
  run(s, 0, 60, 0.002);
  const elP = elements(s, 2, 1), elS = elements(s, 2, 0);
  console.log(`[escape] t=60: dist-planet=${fmt(elP.r, 2)} eps-planet=${fmt(elP.eps, 3)} dist-star=${fmt(elS.r, 2)} eps-star=${fmt(elS.eps, 3)} e-star=${fmt(elS.e, 4)} (want eps-star>0)`);
}
