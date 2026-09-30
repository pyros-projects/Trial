const fs = require('fs'), path = require('path');
const src = (() => { const h = fs.readFileSync(path.join(__dirname, "..", "..", "index.html"), "utf8"); const js = h.match(/<script>\n([\s\S]*)<\/script>/)[1]; return js.slice(0, js.indexOf("// ------------------------------ rendering")); })();
const M = new Function(src + '\nreturn { Sim, SCENARIOS, cloneCity, roadById, cycleOneWay };')();
const s = M.SCENARIOS.downtown.build(); const a = new M.Sim(s.city, s.params, { headless: true });
for (let i = 0; i < 600; i++) a.stepOnce();
a.log = []; a.hashes = []; const initial = JSON.stringify(a.serialize(true));
const edit = fn => { const c = M.cloneCity(a.city); fn(c); a.act({ type: 'city', city: c }); };
for (let i = 0; i < 4000; i++) {
  if (i === 300) edit(c => { M.roadById(c, 50).closed = true; });
  if (i === 800) a.act({ type: 'param', k: 'demandScale', v: 2 });
  if (i === 1200) a.act({ type: 'incident', link: a.net.links[20].id, lane: 0, s: 40, dur: 600 });
  if (i === 1600) edit(c => { M.cycleOneWay(c, 80); });
  if (i === 2000) a.act({ type: 'randIncident' });
  if (i === 2500) a.act({ type: 'param', k: 'transitOn', v: false });
  if (i === 3000) edit(c => { M.roadById(c, 50).closed = false; });
  a.stepOnce();
}
const checks = new Map(a.hashes.map(h => [h.step, h.h])); checks.set(a.step, a.hash());
const b = M.Sim.fromJSON(JSON.parse(initial), { headless: true }); let li = 0, ok = 0, bad = 0;
const log = a.log.slice();
while (b.step < a.step) {
  while (li < log.length && log[li].step === b.step) b.act(log[li++].a);
  b.stepOnce();
  const c = checks.get(b.step); if (c) { if (c === b.hash()) ok++; else { bad++; if (bad < 3) console.log('mismatch at step', b.step); } }
}
console.log('actions', log.length, 'checkpoints matched', ok, 'mismatched', bad, 'final', a.hash(), b.hash(), a.hash() === b.hash() ? 'IDENTICAL' : 'DIVERGED', 'veh', a.veh.length, b.veh.length, 'done', a.m.done, b.m.done);
