import fs from 'node:fs';
const html = fs.readFileSync('index.html', 'utf8');
const blocks = [...html.matchAll(/\/\/ === CORE BEGIN ===([\s\S]*?)\/\/ === CORE END ===/g)].map(m => m[1]);
new Function(blocks.join('\n') + '\n;globalThis.__core = { Sim, GAMMA_D };')();
const { Sim, GAMMA_D } = globalThis.__core;
const s = Sim.create(process.argv[2] || 'squall', 1234, 48, 16, {});
const steps = +(process.argv[3] || 700);
for (let n = 1; n <= steps; n++) {
  // inspect before guard: wrap guardAndStats
  if (n === 1) {
    const g = s.guardAndStats.bind(s);
    s.guardAndStats = (dt) => {
      const { N, u, v, w, th, qv, qc, qr, solid, NX, NY } = s; const NXY = NX * NY;
      const bad = {};
      for (let id = 0; id < N; id++) { if (solid[id]) continue; const k = Math.floor(id / NXY), te = s.thEnv[k];
        const chk = (name, val, lo, hi) => { if (!(val > lo && val < hi)) { bad[name] = (bad[name] || 0) + 1; if (!bad[name + '_ex']) bad[name + '_ex'] = `k=${k} val=${val.toFixed(2)} te=${te.toFixed(1)} qc=${qc[id].toFixed(2)} qr=${qr[id].toFixed(2)} w=${w[id].toFixed(1)}`; } };
        chk('u', u[id], -90, 90); chk('v', v[id], -90, 90); chk('w', w[id], -60, 60); chk('th', th[id], te - 60, te + 60); chk('qv', qv[id], -1e-9, 45); chk('qc', qc[id], -1e-9, 15); chk('qr', qr[id], -1e-9, 25); }
      if (Object.keys(bad).length) console.log(`t=${(s.time/60).toFixed(1)}`, JSON.stringify(bad));
      return g(dt);
    };
  }
  s.step();
}
