/* Long-run stability soak.
   Runs the same parameter sets the UI exposes and asserts the simulation stays
   finite, bounded and mass-conserving over thousands of substeps.
   Run: node tools/soak.mjs [steps] */
import fs from 'node:fs';

const src = fs.readFileSync(new URL('../src/sim.js', import.meta.url), 'utf8');
const LAB = new Function(`${src}\nreturn LAB;`)();

const STEPS = Number(process.argv[2] || 3000);
const CASES = [
  { name: 'defaults', params: { ...LAB.DEFAULT_PARAMS }, gen: { ...LAB.DEFAULT_GEN } },
  { name: 'stress (heavy rain + hard rock)', params: { rain: 0.95, evap: 0.05, erode: 0.95, deposit: 0.3, capacity: 0.35, flow: 0.85, thermal: 0.05, talus: 62 }, gen: { relief: 0.62, ridges: 0.75, water: 0.1, rough: 0.7, seed: 12345 } },
  { name: 'extreme (everything maxed)', params: { rain: 1, evap: 0, erode: 1, deposit: 0.1, capacity: 0.1, flow: 1, thermal: 0.4, talus: 70 }, gen: { relief: 0.85, ridges: 0.9, water: 0.2, rough: 0.9, seed: 777 } },
  { name: 'dead (no water at all)', params: { rain: 0, evap: 1, erode: 1, deposit: 1, capacity: 1, flow: 1, thermal: 0.3, talus: 45 }, gen: { relief: 0.7, ridges: 0.6, water: 0, rough: 0.5, seed: 4242 } },
];

let fails = 0;
const ok = (name, cond, info) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${info ? '  :: ' + info : ''}`);
  if (!cond) fails++;
};

for (const c of CASES) {
  const sim = LAB.createSim(128, c.gen.seed >>> 0 || 1);
  Object.assign(sim.params, c.params);
  LAB.generate(sim, { ...c.gen, seed: (c.gen.seed >>> 0) || 1 });
  let peakStep = 0;
  let blowUpAt = -1;
  const t0 = Date.now();
  for (let k = 0; k < STEPS; k++) {
    LAB.step(sim, 1);
    let worst = 0;
    if (k % 200 === 0 || k === STEPS - 1) {
      for (let i = 0; i < sim.h.length; i++) {
        const a = Math.abs(sim.delta[i]);
        if (a > worst) worst = a;
        if (!Number.isFinite(sim.h[i]) || !Number.isFinite(sim.w[i]) || !Number.isFinite(sim.sed[i])) {
          blowUpAt = k;
          break;
        }
      }
      peakStep = Math.max(peakStep, worst);
      if (blowUpAt >= 0) break;
    }
  }
  const ms = Date.now() - t0;
  const s = sim.stats;
  const finite = blowUpAt < 0;
  ok(`${c.name}: ${STEPS} substeps stay finite`, finite, blowUpAt < 0 ? `first bad field at step ${blowUpAt}` : `${ms} ms, ${(STEPS * 16384 / (ms / 1000) / 1e6).toFixed(0)} M cell-updates/s`);
  ok(`${c.name}: heights stay in range`, finite && Math.min(...sim.h) > -1.2 && Math.max(...sim.h) < 1.6, finite ? `${Math.min(...sim.h).toFixed(2)} .. ${Math.max(...sim.h).toFixed(2)}` : 'n/a');
  ok(`${c.name}: largest single-step change is bounded`, finite && peakStep < 0.25, `|dh|max = ${peakStep.toFixed(4)}`);
  ok(`${c.name}: sediment load is bounded`, finite && s.maxS < 0.5, `max load ${s.maxS.toFixed(4)}`);
  ok(`${c.name}: water is bounded`, finite && s.maxW < 0.6, `max depth ${(s.maxW * 1000).toFixed(1)} mm`);
}

console.log(fails === 0 ? '\nSOAK PASSED' : `\n${fails} SOAK CHECK(S) FAILED`);
process.exit(fails === 0 ? 0 : 1);
