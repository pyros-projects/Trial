const fs = require('fs'), path = require('path');
const src = (() => { const h = fs.readFileSync(path.join(__dirname, "..", "..", "index.html"), "utf8"); const js = h.match(/<script>\n([\s\S]*)<\/script>/)[1]; return js.slice(0, js.indexOf("// ------------------------------ rendering")); })();
const M = new Function(src + '\nreturn { Sim, SCENARIOS, SCENARIO_ORDER, signalDiagnostics };')();
for (const k of M.SCENARIO_ORDER) { const s = M.SCENARIOS[k].build(); const sim = new M.Sim(s.city, s.params, {headless:true}); let e = 0, w = 0, n = 0; const msgs = new Set();
  for (const nd of sim.net.nodes.values()) if (nd.sig) { n++; for (const d of M.signalDiagnostics(nd)) { if (d.lvl === 'err') { e++; msgs.add(d.msg.replace(/Phase \d+: /,'')); } else w++; } }
  console.log(k.padEnd(11), 'signals', n, 'errors', e, 'warns', w, [...msgs].slice(0,3).join(' | ')); }
