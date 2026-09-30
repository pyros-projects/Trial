const fs = require('fs'), path = require('path');
const src = (() => { const h = fs.readFileSync(path.join(__dirname, "..", "..", "index.html"), "utf8"); const js = h.match(/<script>\n([\s\S]*)<\/script>/)[1]; return js.slice(0, js.indexOf("// ------------------------------ rendering")); })();
const M = new Function(src + '\nreturn { Sim, SCENARIOS, cloneCity };')();
const s = M.SCENARIOS.downtown.build(); const sim = new M.Sim(s.city, s.params, { headless: true });
for (let i = 0; i < 1500; i++) sim.stepOnce();
const R0 = [...sim.net.roads.values()].find(r => Math.abs(r.a.y-720)<1 && Math.abs(r.b.y-720)<1 && Math.min(r.a.x,r.b.x) === 780);
const c = M.cloneCity(sim.city); c.roads.find(r => r.id === R0.id).closed = true; sim.act({type:'city', city: c});
const f0 = sim.m.fail; for (let i = 0; i < 3000; i++) sim.stepOnce();
console.log('fails after closure (10 min):', sim.m.fail - f0, JSON.stringify(sim.m.failBy), 'on closed now:', R0.links.map(l => sim.net.linkById.get(l.id).lv.reduce((a,b)=>a+b.length,0)));
