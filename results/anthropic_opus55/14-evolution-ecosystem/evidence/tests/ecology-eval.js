// Multi-seed ecology summary: node evalr.js preset ticks seeds... (TPL overrides via env TPL='{"predator":{"fert":0.2}}')
const fs = require('fs');
let src = fs.readFileSync(__dirname + '/../../index.html', 'utf8');
src = src.slice(src.indexOf('/*SIM-START*/'), src.indexOf('/*SIM-END*/'));
const E = new Function(src + '\nreturn EvoSim;')();
if (process.env.TUNE) E.tune(...JSON.parse(process.env.TUNE));
if (process.env.TPL) { const o = JSON.parse(process.env.TPL); for (const k in o) Object.assign(E.TEMPLATES[k], o[k]); }
const preset = process.argv[2], T = +process.argv[3], seeds = process.argv.slice(4);
for (const seed of seeds) {
  const s = new E.Simulation().init({ seed, preset });
  const ext = {}, acc = [[], [], [], []], names = ['H', 'O', 'P', 'S'];
  for (let t = 1; t <= T; t++) { s.step(); if (t % 300 === 0) { const r = [0, 0, 0, 0]; for (const o of s.orgs) r[o.role]++; r.forEach((v, i) => { acc[i].push(v); if (!v && ext[names[i]] == null) ext[names[i]] = t; }); } }
  const st = a => { const m = a.reduce((x, y) => x + y, 0) / a.length; return `${Math.min(...a)}/${m.toFixed(0)}/${Math.max(...a)}`; };
  const late = a => (a.slice(a.length / 2).reduce((x, y) => x + y, 0) / (a.length / 2)).toFixed(0);
  console.log(`${seed.padEnd(8)} H ${st(acc[0])} O ${st(acc[1])} P ${st(acc[2])} S ${st(acc[3])} | 2nd-half mean H:${late(acc[0])} O:${late(acc[1])} P:${late(acc[2])} S:${late(acc[3])} | extinct ${JSON.stringify(ext)} | species now ${s.species.filter(q => q.count > 0).length} maxgen ${Math.max(...s.orgs.map(o => o.gen))}`);
}
