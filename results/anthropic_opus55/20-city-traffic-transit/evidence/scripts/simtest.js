// Headless harness: node simtest.js [scenario] [simSeconds]
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, 'parts');
const src = (() => { const h = fs.readFileSync(path.join(__dirname, "..", "..", "index.html"), "utf8"); const js = h.match(/<script>\n([\s\S]*)<\/script>/)[1]; return js.slice(0, js.indexOf("// ------------------------------ rendering")); })();
const mod = new Function(src + '\nreturn { Sim, SCENARIOS, SCENARIO_ORDER, cloneCity, validateCityJSON, planRoad, applyRoadPlan, snapPoint, makeRoundabout, deleteRoad, roadById, nodeById, findRoute, signalDiagnostics };')();
const { Sim, SCENARIOS, SCENARIO_ORDER } = mod;

function check(sim, label) {
  const errs = []; const seen = new Map();
  for (const l of sim.net.links) l.lv.forEach((arr, k) => {
    for (let i = 0; i < arr.length; i++) {
      const v = arr[i];
      if (seen.has(v)) errs.push(`veh ${v.id} twice`); seen.set(v, l.id);
      if (v.link !== l || v.lane !== k) errs.push(`veh ${v.id} lane mismatch`);
      if (i > 0 && arr[i - 1].s > v.s) errs.push(`unsorted ${l.id}/${k}`);
      if (i > 0 && v.s - v.len < arr[i - 1].s - 0.05) errs.push(`OVERLAP ${l.id}/${k} veh ${arr[i - 1].id}@${arr[i - 1].s.toFixed(2)} & ${v.id}@${v.s.toFixed(2)} len ${v.len}`);
    }
  });
  for (const n of sim.net.nodes.values()) for (const v of n.box) {
    if (v.inNode) { if (seen.has(v)) errs.push(`veh ${v.id} both lane & node`); seen.set(v, 'node' + n.id); }
    else if (!v.granted) errs.push(`veh ${v.id} in box but not granted`);
    // conflicting in-box occupancy before conflict point
    if (v.inNode) for (const cf of v.nextMov.conf) for (const o of n.box) if (o !== v && o.inNode && o.nextMov === cf.m && !cf.merge) {
      const fa = v.cs / v.curve.len, fb = o.cs / o.curve.len;
      const la = v.len / v.curve.len, lb = o.len / o.curve.len;
      if (fa > cf.f - la && fa < cf.f + 0.02 && fb > cf.of - lb && fb < cf.of + 0.02) errs.push(`CONFLICT node ${n.id} veh ${v.id} & ${o.id}`);
    }
  }
  for (const v of sim.veh) if (!seen.has(v) && !v.dead) errs.push(`veh ${v.id} lost`);
  if (errs.length) console.log(label, 'ERRORS', errs.slice(0, 8), errs.length);
  return errs.length;
}

const which = process.argv[2] ? [process.argv[2]] : SCENARIO_ORDER;
const secs = +(process.argv[3] || 900);
for (const key of which) {
  const s = SCENARIOS[key].build();
  const sim = new Sim(s.city, s.params, { headless: true });
  const t0 = Date.now(); let errs = 0; let maxV = 0;
  const steps = Math.round(secs / 0.2);
  for (let i = 0; i < steps; i++) {
    sim.stepOnce(); maxV = Math.max(maxV, sim.veh.length);
    if (i % 250 === 0) errs += check(sim, key + '@' + i);
  }
  errs += check(sim, key + ' end');
  const ms = Date.now() - t0; const k = sim.kpis();
  console.log(`${key.padEnd(11)} ${secs}s sim in ${ms}ms (${(ms / steps).toFixed(2)} ms/step) veh=${k.active} max=${maxV} done=${k.done} fail=${k.fail} ${JSON.stringify(sim.m.failBy)} avgTT=${k.avgTT | 0}s p90=${k.p90 | 0} spd=${k.speed.toFixed(1)}km/h queue=${k.queue} riders=${k.riders} wait=${k.waiting} trDone=${k.trDone} rr=${k.reroutes} errs=${errs}`);
}
