const fs = require('fs'), path = require('path');
const src = (() => { const h = fs.readFileSync(path.join(__dirname, "..", "..", "index.html"), "utf8"); const js = h.match(/<script>\n([\s\S]*)<\/script>/)[1]; return js.slice(0, js.indexOf("// ------------------------------ rendering")); })();
const M = new Function(src + '\nreturn { Sim, SCENARIOS };')();
let viol = 0, samples = 0, maxQ = 0, merges = 0;
for (const key of ['downtown', 'brt', 'crossroads']) {
  const s = M.SCENARIOS[key].build(); const sim = new M.Sim(s.city, s.params, { headless: true });
  for (let i = 0; i < 900; i++) sim.stepOnce();
  sim.params.incidentRate = 12; // lots of random incidents
  for (let i = 0; i < 9000; i++) {
    sim.stepOnce();
    for (const l of sim.net.links) for (const ic of l.inc) { const lane = l.lv[ic.lane]; for (const v of lane) if (v.s > ic.s - 4 && v.s - v.len < ic.s + 4) { viol++; if (viol < 4) console.log('VIOL', key, l.id, ic.lane, ic.s.toFixed(1), v.id, v.s.toFixed(1), v.state); } samples++; maxQ = Math.max(maxQ, l.qLen); }
  }
  console.log(key, 'incidents total', sim.m.incidents, 'fails', JSON.stringify(sim.m.failBy));
}
console.log('violations', viol, 'incident-samples', samples, 'max queue m', Math.round(maxQ));
