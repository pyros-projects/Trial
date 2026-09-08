import { makeState, run, elements, accel, stepVV } from './physlib.mjs';
const fmt = (x, d = 4) => x.toFixed(d);

// ---- Escape trace ----
{
  const vEscPlanet = Math.sqrt(2 * 10 / 2);
  const vPlanet = Math.sqrt(1000 / 60);
  const v = 1.15 * vEscPlanet;
  const s = makeState([
    { name: 'Star', m: 1000, r: 5, x: 0, y: 0, vx: 0, vy: 0 },
    { name: 'Planet', m: 10, r: 0.8, x: 60, y: 0, vx: 0, vy: vPlanet },
    { name: 'Craft', m: 1e-6, r: 0.05, x: 62, y: 0, vx: 0, vy: vPlanet + v, craft: true },
  ]);
  console.log('escape trace (t, rPlanet, vRelPlanet, epsPlanet, rStar, vStar, epsStar):');
  for (let k = 0; k < 12; k++) {
    run(s, k * 5, (k + 1) * 5, 0.002);
    const ep = elements(s, 2, 1), es = elements(s, 2, 0);
    const vRel = Math.hypot(s.vx[2] - s.vx[1], s.vy[2] - s.vy[1]);
    const vS = Math.hypot(s.vx[2] - s.vx[0], s.vy[2] - s.vy[0]);
    if (k % 2 === 0) console.log(` t=${(k + 1) * 5} rP=${fmt(ep.r, 1)} vRel=${fmt(vRel, 2)} epsP=${fmt(ep.eps, 2)} rS=${fmt(es.r, 1)} vS=${fmt(vS, 2)} epsS=${fmt(es.eps, 3)}`);
  }
}

// ---- Moon transfer: scan small phase offsets for safe miss ----
{
  const mu = 10, rC = 2.5, rM = 4;
  const at = (rC + rM) / 2;
  const vc = Math.sqrt(mu / rC);
  const vtp = Math.sqrt(mu * (2 / rC - 1 / at));
  const dv = vtp - vc;
  const tT = Math.PI * Math.sqrt(at ** 3 / mu);
  const wM = Math.sqrt(mu / rM ** 3);
  console.log('moon-transfer offset scan (offset deg, minD, post a, post e):');
  for (let off = -14; off <= 14; off += 2) {
    const th0 = Math.PI - wM * tT + off * Math.PI / 180;
    const s = makeState([
      { name: 'Planet', m: 10, r: 0.8, x: 0, y: 0, vx: 0, vy: 0 },
      { name: 'Moon', m: 0.05, r: 0.3, x: rM * Math.cos(th0), y: rM * Math.sin(th0), vx: -Math.sqrt(mu / rM) * Math.sin(th0), vy: Math.sqrt(mu / rM) * Math.cos(th0) },
      { name: 'Craft', m: 1e-6, r: 0.05, x: rC, y: 0, vx: 0, vy: vc, craft: true },
    ]);
    run(s, 0, 0.25, 0.002);
    progradeDVs(s, 2, 0, dv);
    let minD = 1e9;
    run(s, 0.25, 0.25 + tT + 4, 0.002, () => { minD = Math.min(minD, Math.hypot(s.x[2] - s.x[1], s.y[2] - s.y[1])); });
    const el = elements(s, 2, 0);
    console.log(`  off=${off} minD=${fmt(minD, 3)} a=${fmt(el.a, 3)} e=${fmt(el.e, 3)}`);
  }
}
function progradeDVs(s, i, k, dvMag) {
  const vrx = s.vx[i] - s.vx[k], vry = s.vy[i] - s.vy[k];
  const v = Math.hypot(vrx, vry);
  s.vx[i] += dvMag * vrx / v; s.vy[i] += dvMag * vry / v;
}

// ---- Slingshot fine scan between 62 and 68 deg, want minD in [0.45, 1.2], dE > 0.1 ----
{
  console.log('slingshot fine scan:');
  for (let deg = 62; deg <= 69; deg += 0.5) {
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
    if (minD > 0.4) console.log(`  deg=${deg} dE=${fmt(eps1 - eps0, 4)} minD=${fmt(minD, 3)}`);
  }
}

// ---- DP54 (Dormand-Prince) check on Pythagorean three-body ----
function accelF(s) { accel(s); }
function dp54(s, t, dtTry, tol) {
  // Dormand-Prince RK5(4) embedded; returns {dtUsed, err}
  const n = s.n;
  const save = { x: Float64Array.from(s.x), y: Float64Array.from(s.y), vx: Float64Array.from(s.vx), vy: Float64Array.from(s.vy) };
  const k = [];
  const deriv = () => { accel(s); return { dx: s.vx, dy: s.vy, dvx: s.ax, dvy: s.ay }; };
  const stages = [
    [0, []],
    [1 / 5, [1 / 5]],
    [3 / 10, [3 / 40, 9 / 40]],
    [4 / 5, [44 / 45, -56 / 15, 32 / 9]],
    [8 / 9, [19372 / 6561, -25360 / 2187, 64448 / 6561, -212 / 729]],
    [1, [9017 / 3168, -355 / 33, 46732 / 5247, 49 / 176, -5103 / 18656]],
    [1, [35 / 384, 0, 500 / 1113, 125 / 192, -2187 / 6784, 11 / 84]],
  ];
  const ks = [];
  let dt = dtTry;
  for (let attempt = 0; attempt < 30; attempt++) {
    ks.length = 0;
    for (const [c, a] of stages) {
      // restore start, add a_i k_i * dt
      s.x.set(save.x); s.y.set(save.y); s.vx.set(save.vx); s.vy.set(save.vy);
      for (let j = 0; j < a.length; j++) {
        const kj = ks[j];
        for (let i = 0; i < n; i++) {
          s.x[i] += a[j] * kj.dx[i] * dt; s.y[i] += a[j] * kj.dy[i] * dt;
          s.vx[i] += a[j] * kj.dvx[i] * dt; s.vy[i] += a[j] * kj.dvy[i] * dt;
        }
      }
      const d = deriv();
      ks.push({ dx: Float64Array.from(d.dx), dy: Float64Array.from(d.dy), dvx: Float64Array.from(d.dvx), dvy: Float64Array.from(d.dvy) });
    }
    // error estimate (4th vs 5th): weights
    const eW = [71 / 57600, 0, -71 / 16695, 71 / 1920, -17253 / 339200, 22 / 525, -1 / 40];
    let err = 0, scale = 0;
    const y5 = { x: Float64Array.from(save.x), y: Float64Array.from(save.y), vx: Float64Array.from(save.vx), vy: Float64Array.from(save.vy) };
    const b = [35 / 384, 0, 500 / 1113, 125 / 192, -2187 / 6784, 11 / 84, 0];
    for (let j = 0; j < 7; j++) for (let i = 0; i < n; i++) {
      y5.x[i] += b[j] * ks[j].dx[i] * dt; y5.y[i] += b[j] * ks[j].dy[i] * dt;
      y5.vx[i] += b[j] * ks[j].dvx[i] * dt; y5.vy[i] += b[j] * ks[j].dvy[i] * dt;
    }
    for (let j = 0; j < 7; j++) for (let i = 0; i < n; i++) {
      const ex = (eW[j] * ks[j].dx[i] * dt), ey = eW[j] * ks[j].dy[i] * dt;
      const evx = eW[j] * ks[j].dvx[i] * dt, evy = eW[j] * ks[j].dvy[i] * dt;
      err += ex * ex + ey * ey + evx * evx + evy * evy;
      scale += (tol + tol * Math.max(Math.abs(y5.vx[i]), Math.abs(y5.vy[i]))) ** 2;
    }
    err = Math.sqrt(err / (4 * n)); scale = Math.sqrt(scale / (4 * n));
    const ratio = err / scale;
    if (ratio <= 1) {
      s.x.set(y5.x); s.y.set(y5.y); s.vx.set(y5.vx); s.vy.set(y5.vy);
      const fac = Math.min(5, Math.max(0.2, 0.9 * ratio ** -0.2));
      return { dtUsed: dt, next: dt * fac, err: ratio };
    }
    dt *= Math.max(0.2, 0.9 * ratio ** -0.25);
  }
  return { dtUsed: dt, next: dt, err: 1e9 };
}
{
  function energyT(s) {
    let E = 0;
    for (let i = 0; i < s.n; i++) E += 0.5 * s.m[i] * (s.vx[i] ** 2 + s.vy[i] ** 2);
    for (let i = 0; i < s.n; i++) for (let j = i + 1; j < s.n; j++) E -= Math.hypot(s.x[j] - s.x[i], s.y[j] - s.y[i]) ** -1 * s.m[i] * s.m[j];
    return E;
  }
  const s = makeState([
    { name: 'B3', m: 3, r: 0.4, x: 1, y: 3, vx: 0, vy: 0 },
    { name: 'B4', m: 4, r: 0.45, x: -2, y: -1, vx: 0, vy: 0 },
    { name: 'B5', m: 5, r: 0.5, x: 1, y: -1, vx: 0, vy: 0 },
    { name: 'Craft', m: 1e-6, r: 0.05, x: -8, y: 5, vx: 0, vy: 0.4, craft: true },
  ]);
  const E0 = energyT(s);
  let t = 0, dt = 0.001, steps = 0;
  while (t < 70) {
    const r = dp54(s, t, dt, 1e-9);
    t += r.dtUsed; dt = Math.min(r.next, 0.01); steps++;
  }
  const E1 = energyT(s);
  console.log(`[threebody-dp54 tol=1e-9] steps=${steps} dE=${fmt((E1 - E0) / Math.abs(E0), 12)}`);
  console.log(`  final: b3=(${fmt(s.x[0], 1)},${fmt(s.y[0], 1)}) b4=(${fmt(s.x[1], 1)},${fmt(s.y[1], 1)}) b5=(${fmt(s.x[2], 1)},${fmt(s.y[2], 1)}) craft=(${fmt(s.x[3], 1)},${fmt(s.y[3], 1)})`);
}
