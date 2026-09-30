const fs = require('fs'), path = require('path');
const src = (() => { const h = fs.readFileSync(path.join(__dirname, "..", "..", "index.html"), "utf8"); const js = h.match(/<script>\n([\s\S]*)<\/script>/)[1]; return js.slice(0, js.indexOf("// ------------------------------ rendering")); })();
const M = new Function(src + '\nreturn { Sim, SCENARIOS, SCENARIO_ORDER, validateCityJSON };')();
for (const key of ['downtown', 'stadium', 'bridge', 'brt']) {
  const s = M.SCENARIOS[key].build(); const a = new M.Sim(s.city, s.params, { headless: true });
  for (let i = 0; i < 1800; i++) a.stepOnce();
  const json = JSON.stringify(a.serialize(true)); const errs = M.validateCityJSON(JSON.parse(json));
  const b = M.Sim.fromJSON(JSON.parse(json), { headless: true });
  const h0 = [a.hash(), b.hash()];
  for (let i = 0; i < 3000; i++) { a.stepOnce(); b.stepOnce(); }
  console.log(key.padEnd(9), 'bytes', json.length, 'validation errs', errs.length, 'hash@save', h0.join(' vs '), 'hash@+3000', a.hash(), 'vs', b.hash(), a.hash() === b.hash() ? 'IDENTICAL' : 'DIVERGED', 'veh', a.veh.length, b.veh.length);
}
