// Parameter calibration sweep (dev tool).  Prints erosion diagnostics for
// several coefficient sets so defaults can be tuned against real behaviour.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const LAB = new Function(`${fs.readFileSync(path.join(dir, '../src/sim.js'), 'utf8')}\nreturn LAB;`)();

const P = { rain: 1, evap: 0.2, erode: 1, deposit: 0.45, capacity: 1, flow: 0.6, thermal: 0.25, talus: 40 };

function run(label, n, steps, params, tune) {
  Object.assign(LAB.K, tune);
  const s = LAB.createSim(n, Object.assign({}, P, params));
  LAB.generate(s, 'mountain', { seed: 'cal' });
  LAB.resetWater(s);
  const h0 = Float32Array.from(s.h);
  for (let k = 0; k < steps; k++) LAB.step(s, 2);
  let carve = 0;
  let fill = 0;
  let maxD = 0;
  let deep = 0;
  let wet = 0;
  let sumW = 0;
  let maxW = 0;
  let sumS = 0;
  let maxS = 0;
  for (let i = 0; i < n * n; i++) {
    const d = s.h[i] - h0[i];
    if (d < -0.0015) carve++;
    if (d > 0.0015) fill++;
    if (Math.abs(d) > maxD) maxD = Math.abs(d);
    if (d < -0.02) deep++;
    if (s.w[i] > 1e-4) wet++;
    sumW += s.w[i];
    if (s.w[i] > maxW) maxW = s.w[i];
    sumS += s.sed[i];
    if (s.sed[i] > maxS) maxS = s.sed[i];
  }
  console.log(
    `${label.padEnd(28)} wet=${((wet / (n * n)) * 100).toFixed(1).padStart(5)}%  maxDepth=${maxW.toFixed(4)}  ` +
      `erodeCells=${((carve / (n * n)) * 100).toFixed(1).padStart(5)}%  depCells=${((fill / (n * n)) * 100).toFixed(1).padStart(5)}%  ` +
      `maxDh=${maxD.toFixed(4)}  deep=${deep}  sumSed=${sumS.toFixed(2)}  capped=${s.stats.cappedRatio.toFixed(3)}  unstable=${s.unstable}`,
  );
  return s;
}

console.log('--- rainfall sweep (n=128, 600 steps x2 substeps) ---');
for (const rain of [0.02, 0.05, 0.12, 0.3, 1]) {
  run(`rain=${rain} (K.rain=${LAB.K.rain})`, 128, 600, { rain }, {});
}
console.log('\n--- K.rain sweep (rain param 1) ---');
for (const kr of [0.00012, 0.00025, 0.0005, 0.0011]) {
  run(`K.rain=${kr}`, 128, 600, { rain: 1 }, { rain: kr });
}
console.log('\n--- capacity sweep (K.rain=0.00025) ---');
for (const ck of [0.006, 0.02, 0.055, 0.15]) {
  run(`K.capK=${ck}`, 128, 600, { rain: 1 }, { rain: 0.00025, capK: ck });
}
console.log('\n--- erosion coefficient sweep (capK=0.02) ---');
for (const ek of [0.0015, 0.0055, 0.02]) {
  run(`K.eroK=${ek}`, 128, 600, { rain: 1 }, { rain: 0.00025, capK: 0.02, eroK: ek });
}
