const fs = require('fs'), path = require('path');
const src = (() => { const h = fs.readFileSync(path.join(__dirname, "..", "..", "index.html"), "utf8"); const js = h.match(/<script>\n([\s\S]*)<\/script>/)[1]; return js.slice(0, js.indexOf("// ------------------------------ rendering")); })();
const M = new Function(src + '\nreturn { Sim, SCENARIOS, cloneCity };')();
const run = widen => { const s = M.SCENARIOS.induced.build(); const sim = new M.Sim(s.city, s.params, { headless: true });
  for (let i = 0; i < 6000; i++) sim.stepOnce();
  if (widen) { const c = M.cloneCity(sim.city); for (const r of c.roads) if (r.name === 'Old Post Rd') { r.lf = 3; r.lb = 3; } sim.act({ type: 'city', city: c }); }
  const g0 = [...sim.zrt.values()].reduce((a, z) => a + z.made, 0);
  for (let i = 0; i < 9000; i++) sim.stepOnce();
  const g1 = [...sim.zrt.values()].reduce((a, z) => a + z.made, 0); const k = sim.kpis();
  return `${widen ? 'widened 3+3' : 'baseline 1+1'}: trips generated in 30 min=${g1 - g0} elastic=${sim.elastic.toFixed(2)} avgTT=${Math.round(k.avgTT)}s speed=${k.speed.toFixed(1)}km/h veh=${k.active}`; };
console.log(run(false)); console.log(run(true));
