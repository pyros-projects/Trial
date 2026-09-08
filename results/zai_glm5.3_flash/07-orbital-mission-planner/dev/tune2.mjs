import { makeState, run, elements } from './physlib.mjs';
const fmt = (x, d = 4) => x.toFixed(d);

function energyT(s) {
  let E = 0;
  for (let i = 0; i < s.n; i++) E += 0.5 * s.m[i] * (s.vx[i] ** 2 + s.vy[i] ** 2);
  for (let i = 0; i < s.n; i++) for (let j = i + 1; j < s.n; j++) E -= s.m[i] * s.m[j] / Math.hypot(s.x[j] - s.x[i], s.y[j] - s.y[i]);
  return E;
}

// escape multiplier scan
for (const mult of [1.3, 1.5, 1.8]) {
  const vEscPlanet = Math.sqrt(2 * 10 / 2);
  const vPlanet = Math.sqrt(1000 / 60);
  const v = mult * vEscPlanet;
  const s = makeState([
    { name: 'Star', m: 1000, r: 5, x: 0, y: 0, vx: 0, vy: 0 },
    { name: 'Planet', m: 10, r: 0.8, x: 60, y: 0, vx: 0, vy: vPlanet },
    { name: 'Craft', m: 1e-6, r: 0.05, x: 62, y: 0, vx: 0, vy: vPlanet + v, craft: true },
  ]);
  run(s, 0, 60, 0.002);
  const elS = elements(s, 2, 0), elP = elements(s, 2, 1);
  console.log(`[escape mult=${mult}] t=60 rS=${fmt(elS.r, 1)} epsS=${fmt(elS.eps, 3)} eS=${fmt(elS.e, 4)} rP=${fmt(elP.r, 1)}`);
}

// three-body with different VV dt, to t=30
for (const dt of [2e-4, 1e-4]) {
  const s = makeState([
    { name: 'B3', m: 3, r: 0.4, x: 1, y: 3, vx: 0, vy: 0 },
    { name: 'B4', m: 4, r: 0.45, x: -2, y: -1, vx: 0, vy: 0 },
    { name: 'B5', m: 5, r: 0.5, x: 1, y: -1, vx: 0, vy: 0 },
    { name: 'Craft', m: 1e-6, r: 0.05, x: -8, y: 5, vx: 0, vy: 0.4, craft: true },
  ]);
  const E0 = energyT(s);
  const t0 = performance.now();
  run(s, 0, 30, dt);
  const ms = (performance.now() - t0).toFixed(0);
  const E1 = energyT(s);
  console.log(`[threebody vv dt=${dt}] t=30 wall=${ms}ms dE/E0=${fmt((E1 - E0) / Math.abs(E0), 6)} dE=${fmt(E1 - E0, 8)}`);
}
