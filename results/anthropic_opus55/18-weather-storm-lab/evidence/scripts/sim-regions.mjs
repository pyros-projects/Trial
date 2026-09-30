// Regional precipitation / cloud diagnostics for orographic (mountain) and lake-effect (snowband) presets.
import fs from 'node:fs';
const html = fs.readFileSync('index.html', 'utf8');
const blocks = [...html.matchAll(/\/\/ === CORE BEGIN ===([\s\S]*?)\/\/ === CORE END ===/g)].map(m => m[1]);
new Function(blocks.join('\n') + '\n;globalThis.__core = { Sim };')();
const { Sim } = globalThis.__core;
const id = process.argv[2], minutes = +(process.argv[3] || 90);
const s = Sim.create(id, 1234, 48, 16, {});
while (s.time < minutes * 60) s.step();
const NX = s.NX, NXY = s.N2;
const band = (x0, x1, f) => { let a = 0, n = 0; for (let j = 0; j < s.NY; j++) for (let i = Math.floor(x0 * NX); i < Math.floor(x1 * NX); i++) { a += f(i + j * NX); n++; } return a / n; };
const cloudCol = c => { let m = 0; for (let k = s.kg[c]; k < s.NZ; k++) m = Math.max(m, s.qc[c + k * NXY]); return m > 0.05 ? 1 : 0; };
const cols = [[0, 0.2], [0.2, 0.4], [0.4, 0.55], [0.55, 0.7], [0.7, 0.85], [0.85, 1]];
console.log(`${id} after ${minutes} min: x-band | precip acc (mm) | snow (mm) | cloud frac | mean ground h (m) | water frac`);
for (const [a, b] of cols) console.log(`  x ${a.toFixed(2)}-${b.toFixed(2)} | ${band(a, b, c => s.precipAcc[c]).toFixed(3)} | ${band(a, b, c => s.snow[c]).toFixed(3)} | ${band(a, b, cloudCol).toFixed(2)} | ${band(a, b, c => s.hgt[c]).toFixed(0)} | ${band(a, b, c => s.fWater[c]).toFixed(2)}`);
