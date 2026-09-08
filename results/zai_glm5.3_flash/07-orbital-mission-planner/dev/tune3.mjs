import { makeState, run, elements } from './physlib.mjs';
const fmt = (x, d = 4) => x.toFixed(d);
function energyT(s) {
  let E = 0;
  for (let i = 0; i < s.n; i++) E += 0.5 * s.m[i] * (s.vx[i] ** 2 + s.vy[i] ** 2);
  for (let i = 0; i < s.n; i++) for (let j = i + 1; j < s.n; j++) E -= s.m[i] * s.m[j] / Math.hypot(s.x[j] - s.x[i], s.y[j] - s.y[i]);
  return E;
}

// binary + intruder scan
for (const spd of [1.0, 1.2, 1.4]) {
  for (const b of [2.0, 3.0, 4.0]) {
    // aim C at barycenter offset: velocity toward a point offset by -b/2 in y (impact parameter)
    const tx = 0, ty = -b / 2;
    const dx = tx - (-18), dy = ty - b;
    const L = Math.hypot(dx, dy);
    const cvx = spd * dx / L, cvy = spd * dy / L;
    // craft observer: circular around barycenter (total m=12) r=8
    const vc = Math.sqrt(12 / 8);
    const s = makeState([
      { name: 'A', m: 5, r: 0.45, x: 0, y: 2, vx: -0.7906, vy: 0 },
      { name: 'B', m: 5, r: 0.45, x: 0, y: -2, vx: 0.7906, vy: 0 },
      { name: 'C', m: 2, r: 0.35, x: -18, y: b, vx: cvx, vy: cvy },
      { name: 'Craft', m: 1e-6, r: 0.05, x: 8, y: 0, vx: 0, vy: vc, craft: true },
    ]);
    const E0 = energyT(s);
    let minD = 1e9, maxR = 0;
    run(s, 0, 40, 2e-4, () => {
      for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) minD = Math.min(minD, Math.hypot(s.x[i] - s.x[j], s.y[i] - s.y[j]));
      for (let i = 0; i < 3; i++) maxR = Math.max(maxR, Math.hypot(s.x[i], s.y[i]));
    });
    const E1 = energyT(s);
    console.log(`spd=${spd} b=${b}: minD=${fmt(minD, 3)} maxR=${fmt(maxR, 1)} dE=${fmt(Math.abs(E1 - E0) / Math.abs(E0), 6)}`);
  }
}
