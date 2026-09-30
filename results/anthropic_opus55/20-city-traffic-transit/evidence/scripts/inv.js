(() => { // invariant checker injected by the test harness (not part of the app)
  const sim = window.__metroflow.sim; const errs = []; const seen = new Set();
  for (const l of sim.net.links) l.lv.forEach((arr, k) => { for (let i = 0; i < arr.length; i++) { const v = arr[i]; if (seen.has(v)) errs.push('dup ' + v.id); seen.add(v); if (i > 0 && v.s - v.len < arr[i-1].s - 0.05) errs.push('overlap ' + l.id + ' ' + arr[i-1].id + '/' + v.id); } });
  let conflicts = 0;
  for (const n of sim.net.nodes.values()) for (const v of n.box) { if (!v.inNode) continue; if (seen.has(v)) errs.push('both ' + v.id); seen.add(v);
    for (const cf of v.nextMov.conf) for (const o of n.box) if (o !== v && o.inNode && o.nextMov === cf.m && !cf.merge) { const fa = v.cs / v.curve.len, fb = o.cs / o.curve.len; if (fa > cf.f - v.len / v.curve.len && fa < cf.f + 0.02 && fb > cf.of - o.len / o.curve.len && fb < cf.of + 0.02) conflicts++; } }
  const lost = sim.veh.filter(v => !seen.has(v)).length;
  return JSON.stringify({ t: Math.round(sim.t), veh: sim.veh.length, errs: errs.slice(0, 5), nErr: errs.length, conflicts, lost });
})()
