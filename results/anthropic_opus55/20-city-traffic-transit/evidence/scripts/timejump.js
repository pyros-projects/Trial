const fs = require('fs'), path = require('path');
const src = (() => { const h = fs.readFileSync(path.join(__dirname, "..", "..", "index.html"), "utf8"); const js = h.match(/<script>\n([\s\S]*)<\/script>/)[1]; return js.slice(0, js.indexOf("// ------------------------------ rendering")); })();
const M = new Function(src + '\nreturn { Sim, SCENARIOS };')();
const s = M.SCENARIOS.downtown.build(); const sim = new M.Sim(s.city, s.params, { headless: true });
for (let i = 0; i < 1500; i++) sim.stepOnce();
const f0 = sim.m.fail; sim.act({ type: 'setTime', t: 20.5 * 3600 });
for (let i = 0; i < 1500; i++) sim.stepOnce();
const k = sim.kpis(); console.log('after jump to 20:30 + 5 min: fails', sim.m.fail - f0, JSON.stringify(sim.m.failBy), 'avgTT', Math.round(k.avgTT), 's p90', Math.round(k.p90), 'veh', k.active);
