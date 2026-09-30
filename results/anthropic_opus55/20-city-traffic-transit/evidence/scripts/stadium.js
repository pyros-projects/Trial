const fs = require('fs'), path = require('path');
const src = (() => { const h = fs.readFileSync(path.join(__dirname, "..", "..", "index.html"), "utf8"); const js = h.match(/<script>\n([\s\S]*)<\/script>/)[1]; return js.slice(0, js.indexOf("// ------------------------------ rendering")); })();
const M = new Function(src + '\nreturn { Sim, SCENARIOS };')();
const s = M.SCENARIOS.stadium.build(); const sim = new M.Sim(s.city, s.params, { headless: true });
const ev = sim.city.zones.find(z => z.type === 'evt');
for (let m = 0; m <= 90; m += 15) {
  if (m) for (let i = 0; i < 4500; i++) sim.stepOnce();
  const lots = [...sim.lotRT].map(([id, r]) => `${sim.city.lots.find(l => l.id === id).name.replace('Stadium ', '')}:${r.occ}/${sim.city.lots.find(l => l.id === id).cap}`).join(' ');
  const sh = [...sim.rrt.values()].find(r => r.src.name.includes('Shuttle'));
  const z = sim.net.zones.get(ev.id);
  console.log(`${(sim.t/3600).toFixed(2).padStart(5)}h veh=${sim.veh.length} arr/h=${Math.round(z.evArr||0)} lots ${lots} shuttle riders=${sh.stats.board} fail=${JSON.stringify(sim.m.failBy)}`);
}
