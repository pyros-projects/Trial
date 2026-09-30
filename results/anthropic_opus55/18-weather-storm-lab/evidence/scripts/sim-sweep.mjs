// Runs every preset for a given simulated duration and prints a compact evolution table.
import fs from 'node:fs';
const html = fs.readFileSync('index.html', 'utf8');
const blocks = [...html.matchAll(/\/\/ === CORE BEGIN ===([\s\S]*?)\/\/ === CORE END ===/g)].map(m => m[1]);
new Function(blocks.join('\n') + '\n;globalThis.__core = { Sim, PRESET_ORDER, PRESETS };')();
const { Sim, PRESET_ORDER, PRESETS } = globalThis.__core;
const minutes = +(process.argv[2] || 60), only = process.argv[3];
for (const id of PRESET_ORDER) {
  if (only && !only.split(',').includes(id)) continue;
  const t0 = performance.now();
  const s = Sim.create(id, 1234, 48, 16, {});
  const tI = performance.now() - t0;
  let line = [], nSteps = 0; const t1 = performance.now();
  let nextReport = s.time + minutes * 60 / 6;
  while (s.time < minutes * 60) {
    s.step(); nSteps++;
    if (s.time >= nextReport) { const st = s.stats; line.push(`${(s.time/60).toFixed(0)}m w${st.maxW.toFixed(0)}/${st.minW.toFixed(0)} cc${(st.cloudCover*100).toFixed(0)} pr${st.precipRateMax.toFixed(0)} fl${st.flashCount}`); nextReport += minutes * 60 / 6; }
  }
  const st = s.stats;
  console.log(`${id.padEnd(10)} init ${tI.toFixed(0)}ms step ${((performance.now()-t1)/nSteps).toFixed(1)}ms dt~${s.dtEff.toFixed(1)} cfl${st.cfl.toFixed(2)} guard${s.guardTotal} acc${st.precipMean.toFixed(2)}mm snow${(s.snow.reduce((a,b)=>a+b,0)/s.N2).toFixed(2)} | ` + line.join(' | '));
}
