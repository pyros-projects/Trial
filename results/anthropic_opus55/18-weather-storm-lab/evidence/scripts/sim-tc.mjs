// Tropical-cyclone diagnostics: azimuthal-mean tangential & radial wind at ~1 km and cloud fraction vs radius.
import fs from 'node:fs';
const html = fs.readFileSync('index.html', 'utf8');
const blocks = [...html.matchAll(/\/\/ === CORE BEGIN ===([\s\S]*?)\/\/ === CORE END ===/g)].map(m => m[1]);
new Function(blocks.join('\n') + '\n;globalThis.__core = { Sim };')();
const { Sim } = globalThis.__core;
const s = Sim.create('tropical', 1234, 48, 16, {});
for (const hours of [1, 2, 3, 4]) {
  while (s.time < hours * 3600) s.step();
  // find the low-level pressure minimum / vorticity centre: use column min of surface p'
  const NX = s.NX, NXY = s.N2, k = 1;
  let best = 0, bv = 1e9; for (let c = 0; c < NXY; c++) { const p = s.pressurePert(c + k * NXY, k, c); if (p < bv) { bv = p; best = c; } }
  const ci = best % NX, cj = Math.floor(best / NX);
  const bins = [0, 10, 20, 35, 50, 70, 90].map(r => r * 1000), vt = [], vr = [], cf = [], n = [];
  for (let b = 0; b < bins.length - 1; b++) { vt.push(0); vr.push(0); cf.push(0); n.push(0); }
  for (let j = 0; j < s.NY; j++) for (let i = 0; i < NX; i++) {
    const dx = (i - ci) * s.dx, dy = (j - cj) * s.dy, r = Math.hypot(dx, dy); if (r < 1) continue;
    const b = bins.findIndex((x, q) => q < bins.length - 1 && r >= x && r < bins[q + 1]); if (b < 0) continue;
    const id = i + j * NX + k * NXY, u = s.u[id], v = s.v[id];
    vt[b] += (-u * dy + v * dx) / r; vr[b] += (u * dx + v * dy) / r; n[b]++;
    let m = 0; for (let kk = 0; kk < s.NZ; kk++) m = Math.max(m, s.qc[i + j * NX + kk * NXY]); cf[b] += m > 0.05 ? 1 : 0;
  }
  console.log(`t=${hours}h centre=(${ci},${cj}) p'min=${bv.toFixed(2)}hPa maxW=${s.stats.maxW.toFixed(1)} maxSpd=${s.stats.maxSpeed.toFixed(1)} cc=${(s.stats.cloudCover*100).toFixed(0)}% fl=${s.stats.flashCount}`);
  console.log('   r(km)   ' + bins.slice(0, -1).map((x, q) => `${x / 1000}-${bins[q + 1] / 1000}`.padStart(8)).join(''));
  console.log('   v_tan   ' + vt.map((x, q) => (x / Math.max(1, n[q])).toFixed(1).padStart(8)).join(''));
  console.log('   v_rad   ' + vr.map((x, q) => (x / Math.max(1, n[q])).toFixed(1).padStart(8)).join(''));
  console.log('   cloud   ' + cf.map((x, q) => (x / Math.max(1, n[q])).toFixed(2).padStart(8)).join(''));
}
