import { makeState, run } from './physlib.mjs';
const fmt = (x, d = 4) => x.toFixed(d);
function energyT(s) {
  let E = 0;
  for (let i = 0; i < s.n; i++) E += 0.5 * s.m[i] * (s.vx[i] ** 2 + s.vy[i] ** 2);
  for (let i = 0; i < s.n; i++) for (let j = i + 1; j < s.n; j++) E -= s.m[i] * s.m[j] / Math.hypot(s.x[j] - s.x[i], s.y[j] - s.y[i]);
  return E;
}
const rows = [];
for (const spd of [0.8, 1.0, 1.2, 1.5]) {
  for (const b of [3, 5, 7, 9]) {
    for (const y0 of [-14, -18, -22]) {
      const dx = 0 - (-18 + b * 0.0), dy = 0 - b; // aim at point (0,-b/2): recompute below properly
      // start at (-y0? no) use x0=-22 fixed; aim at (0, -b/2)
      const x0 = -24, yStart = b;
      const tx = 0, ty = -b / 2;
      const ddx = tx - x0, ddy = ty - yStart;
      const L = Math.hypot(ddx, ddy);
      const cvx = spd * ddx / L, cvy = spd * ddy / L;
      const vc = Math.sqrt(12 / 8);
      const s = makeState([
        { name: 'A', m: 5, r: 0.45, x: 0, y: 2, vx: -0.7906, vy: 0 },
        { name: 'B', m: 5, r: 0.45, x: 0, y: -2, vx: 0.7906, vy: 0 },
        { name: 'C', m: 2, r: 0.35, x: x0, y: yStart, vx: cvx, vy: cvy },
        { name: 'Craft', m: 1e-6, r: 0.05, x: 8, y: 0, vx: 0, vy: vc, craft: true },
      ]);
      const E0 = energyT(s);
      let minD = 1e9, maxR = 0, tEj = -1;
      run(s, 0, 100, 5e-4, (t) => {
        for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) minD = Math.min(minD, Math.hypot(s.x[i] - s.x[j], s.y[i] - s.y[j]));
        for (let i = 0; i < 3; i++) {
          const rr = Math.hypot(s.x[i], s.y[i]);
          if (rr > 45 && tEj < 0) tEj = t;
          maxR = Math.max(maxR, rr);
        }
      });
      const E1 = energyT(s);
      const dE = Math.abs(E1 - E0) / Math.abs(E0);
      if (tEj > 0 && minD > 1.0 && dE < 1e-4) rows.push({ spd, b, minD, tEj, dE });
    }
  }
}
rows.sort((a, b2) => a.tEj - b2.tEj);
for (const r of rows.slice(0, 12)) console.log(`spd=${r.spd} b=${r.b}: minD=${fmt(r.minD, 2)} eject@t=${fmt(r.tEj, 1)} dE=${r.dE.toExponential(1)}`);
