import fs from 'node:fs';
const html = fs.readFileSync('index.html', 'utf8');
const blocks = [...html.matchAll(/\/\/ === CORE BEGIN ===([\s\S]*?)\/\/ === CORE END ===/g)].map(m => m[1]);
new Function(blocks.join('\n') + '\n;globalThis.__core = { Sim };')();
const { Sim } = globalThis.__core;
const s = Sim.create(process.argv[2] || 'squall', 1234, +(process.argv[3] || 48), +(process.argv[4] || 16), {});
const T = {};
for (const m of ['advect', 'sediment', 'forces', 'surface', 'diffuse', 'project', 'micro', 'lightningStep', 'fillSolids', 'guardAndStats', 'recordProbe']) {
  const f = s[m].bind(s); T[m] = 0;
  s[m] = (...a) => { const t = performance.now(); const r = f(...a); T[m] += performance.now() - t; return r; };
}
const n = 100; const t0 = performance.now();
for (let i = 0; i < n; i++) s.step();
const tot = performance.now() - t0;
console.log('total/step', (tot / n).toFixed(2));
for (const [k, v] of Object.entries(T)) console.log(k.padEnd(14), (v / n).toFixed(2));
