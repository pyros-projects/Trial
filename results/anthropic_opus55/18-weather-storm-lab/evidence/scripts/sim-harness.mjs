// Headless harness: extracts the CORE blocks (utilities + simulation) from index.html and runs presets in Node.
// Usage: node evidence/scripts/sim-harness.mjs <preset> <steps> [NX] [NZ] [every]
import fs from 'node:fs';
import path from 'node:path';
const html = fs.readFileSync(path.resolve(process.argv[6] || 'index.html'), 'utf8');
const blocks = [...html.matchAll(/\/\/ === CORE BEGIN ===([\s\S]*?)\/\/ === CORE END ===/g)].map(m => m[1]);
const code = blocks.join('\n') + '\n;globalThis.__core = { Sim, PRESETS, PRESET_ORDER, presetParams, genTerrain, RNG };';
new Function(code)();
const { Sim, PRESETS } = globalThis.__core;
const preset = process.argv[2] || 'squall', steps = +(process.argv[3] || 200), NX = +(process.argv[4] || 48), NZ = +(process.argv[5] || 16);
const every = +(process.env.EVERY || 20);
let t0 = performance.now();
const s = Sim.create(preset, 1234, NX, NZ, {});
const tInit = performance.now() - t0;
console.log(`preset=${preset} grid=${NX}x${NX}x${NZ} dx=${s.dx.toFixed(0)}m dz=${s.dz.toFixed(0)}m init=${tInit.toFixed(0)}ms (spinup ${PRESETS[preset].spinup||0})`);
t0 = performance.now();
for (let n = 1; n <= steps; n++) {
  s.step();
  if (n % every === 0 || n === steps) {
    const st = s.stats;
    console.log(`t=${(s.time/60).toFixed(1).padStart(6)}min clk=${s.clock.toFixed(2)} wMax=${st.maxW.toFixed(1).padStart(5)} wMin=${st.minW.toFixed(1).padStart(5)} spd=${st.maxSpeed.toFixed(1).padStart(5)} qcMax=${st.maxQc.toFixed(2)} cc=${(st.cloudCover*100).toFixed(0).padStart(3)}% pr=${st.precipRateMax.toFixed(1).padStart(5)}mm/h acc=${st.precipMean.toFixed(3)}mm fl=${st.flashCount} cfl=${st.cfl.toFixed(2)} dt=${s.dtEff.toFixed(1)} D=${st.diffNum.toFixed(3)} guard=${s.guardTotal} maxQ=${Math.max(...s.charge).toFixed(1)}`);
  }
}
const ms = (performance.now() - t0) / steps;
console.log(`avg step ${ms.toFixed(2)} ms  hash=${s.hash()}`);
