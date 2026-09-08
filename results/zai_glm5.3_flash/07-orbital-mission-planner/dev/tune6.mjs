import { makeState, run } from './physlib.mjs';
const fmt = (x, d = 4) => x.toFixed(d);
function energyT(s) {
  let E = 0;
  for (let i = 0; i < s.n; i++) E += 0.5 * s.m[i] * (s.vx[i] ** 2 + s.vy[i] ** 2);
  for (let i = 0; i < s.n; i++) for (let j = i + 1; j < s.n; j++) E -= s.m[i] * s.m[j] / Math.hypot(s.x[j] - s.x[i], s.y[j] - s.y[i]);
  return E;
}
// figure-8 ICs (Chenciner-Montgomery), scaled by s
const s8 = 3;
for (const [m3, dt] of [[1.0, 1e-4], [1.05, 1e-4], [1.1, 1e-4], [1.05, 2e-4]]) {
  const s = makeState([
    { name: 'A', m: 1, r: 0.2, x: s8 * 0.97000436, y: s8 * -0.24308753, vx: 0.4662036850 / Math.sqrt(s8), vy: 0.4323657300 / Math.sqrt(s8) },
    { name: 'B', m: 1, r: 0.2, x: s8 * -0.97000436, y: s8 * 0.24308753, vx: 0.4662036850 / Math.sqrt(s8), vy: 0.4323657300 / Math.sqrt(s8) },
    { name: 'C', m: m3, r: 0.2, x: 0, y: 0, vx: -0.93240737 / Math.sqrt(s8), vy: -0.86473146 / Math.sqrt(s8) },
    { name: 'Craft', m: 1e-6, r: 0.05, x: 5, y: 0, vx: 0, vy: Math.sqrt(3 / 5), craft: true },
  ]);
  const E0 = energyT(s);
  let minD = 1e9, maxR = 0, tChaotic = -1;
  run(s, 0, 60, dt, (t) => {
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) {
      const d = Math.hypot(s.x[i] - s.x[j], s.y[i] - s.y[j]);
      minD = Math.min(minD, d);
    }
    for (let i = 0; i < 3; i++) maxR = Math.max(maxR, Math.hypot(s.x[i], s.y[i]));
  });
  const E1 = energyT(s);
  console.log(`fig8 m3=${m3} dt=${dt}: minD=${fmt(minD, 3)} maxR=${fmt(maxR, 2)} dE=${((E1-E0)/Math.abs(E0)).toExponential(2)}`);
}
