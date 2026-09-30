// Headless checks against the simulation core embedded in the delivered index.html.
// Run: node evidence/tests/sim-tests.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, '..', '..', 'index.html'), 'utf8');
const src = html.slice(html.indexOf('/*SIM-START*/'), html.indexOf('/*SIM-END*/'));
const E = new Function(src + '\nreturn EvoSim;')();

let failed = 0;
const check = (name, ok, info) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); if (!ok) failed++; };
const run = (sim, n) => { for (let i = 0; i < n; i++) sim.step(); return sim; };

// 1. Deterministic seeds: same seed/preset/params -> identical trajectories; different seed differs.
{
  const a = run(new E.Simulation().init({ seed: 'det-1', preset: 'balanced' }), 2500);
  const b = run(new E.Simulation().init({ seed: 'det-1', preset: 'balanced' }), 2500);
  const c = run(new E.Simulation().init({ seed: 'det-2', preset: 'balanced' }), 2500);
  check('same seed reproduces run (hash @2500)', a.hash() === b.hash(), a.hash() + ' vs ' + b.hash());
  check('different seed gives different run', a.hash() !== c.hash(), c.hash());
  const i1 = new E.Simulation().init({ seed: 'det-1', preset: 'balanced' }), i2 = new E.Simulation().init({ seed: 'det-1', preset: 'balanced' });
  check('same seed reproduces initial conditions', i1.hash() === i2.hash() && i1.terrain.every((v, k) => v === i2.terrain[k]));
}

// 2. Save -> load preserves genotypes, lineage and continues bit-identically.
{
  const s = run(new E.Simulation().init({ seed: 'save-1', preset: 'balanced' }), 4000);
  s.setReserve({ x0: 100, y0: 100, x1: 500, y1: 400 });
  const js = JSON.stringify(s.serialize());
  const t = new E.Simulation().deserialize(JSON.parse(js));
  check('loaded state hash equals saved', s.hash() === t.hash());
  const o = s.orgs.reduce((x, y) => (y.gen > x.gen ? y : x));
  const p = t.idMap.get(o.id);
  check('deepest-generation organism genome preserved', p && p.g.every((v, i) => v === o.g[i]) && p.gen === o.gen && p.pa === o.pa && p.pb === o.pb, `#${o.id} gen ${o.gen}`);
  check('lineage archive preserved', t.arch.size === s.arch.size && [...s.arch.keys()].every(k => t.arch.get(k).pa === s.arch.get(k).pa));
  check('species table preserved', t.species.length === s.species.length && t.species.every((q, i) => q.count === s.species[i].count && q.parent === s.species[i].parent));
  run(s, 1500); run(t, 1500);
  check('continuation after load is identical (1500 ticks)', s.hash() === t.hash(), s.hash() + ' vs ' + t.hash());
  let err = '';
  try { new E.Simulation().deserialize({ format: 'nope' }); } catch (e) { err = e.message; }
  check('invalid save rejected with message', /Not an Evolution Lab save/.test(err), err);
}

// 3. Lineage accuracy: every archived child points at parents whose kids list contains it, generations are parent+1.
{
  const s = run(new E.Simulation().init({ seed: 'lin-1', preset: 'balanced' }), 6000);
  let bad = 0, checked = 0;
  for (const r of s.arch.values()) {
    const pa = r.pa ? s.arch.get(r.pa) : null, pb = r.pb ? s.arch.get(r.pb) : null;
    if (pa) { checked++; if (!pa.kids.includes(r.id)) bad++; const g = Math.max(pa.gen, pb ? pb.gen : 0) + 1; if (!pb || s.arch.has(r.pb)) if (r.gen !== g && !(r.pb && !pb)) bad++; }
  }
  check('parent/child links and generation numbers consistent', bad === 0 && checked > 500, `${checked} links, ${bad} bad`);
  const d = s.descendants(s.orgs[0].pa || s.orgs[0].id);
  check('descendant query returns living members', d.alive >= 0 && d.total >= d.alive);
}

// 4. Populations are resource-bounded: without plant growth everything starves out.
{
  const s = new E.Simulation().init({ seed: 'bound-1', preset: 'balanced', params: { foodGrowth: 0 } });
  const start = s.orgs.length;
  run(s, 9000);
  check('no plant growth -> population collapses', s.orgs.length < start * 0.15, `${start} -> ${s.orgs.length}`);
  const r = new E.Simulation().init({ seed: 'bound-2', preset: 'balanced', params: { foodGrowth: 3 } });
  let peak = 0; for (let i = 0; i < 12000; i++) { r.step(); peak = Math.max(peak, r.orgs.length); }
  check('3x food growth -> population still bounded', peak < 6000, 'peak ' + peak);
}

// 5. Reserve: no predation deaths inside the protected rectangle.
{
  const s = run(new E.Simulation().init({ seed: 'res-1', preset: 'predprey' }), 600);
  s.setReserve({ x0: 200, y0: 200, x1: 900, y1: 700 });
  let inside = 0, outside = 0;
  s.deathHook = o => { if (o.cause === 0) { if (s.inReserve(o.x, o.y)) inside++; else outside++; } };
  run(s, 3000);
  check('no predation kills inside reserve', inside === 0 && outside > 20, `inside ${inside}, outside ${outside}`);
}

// 6. Inheritance: offspring genomes stay close to parents; mutation rate 0 -> exact copies (asexual).
{
  const s = new E.Simulation().init({ seed: 'inh-1', preset: 'balanced', params: { mutRate: 0, sexual: 0 } });
  const born = []; const add = s.addOrg.bind(s); s.addOrg = o => { if (s.tick > 0) born.push(o); add(o); };
  run(s, 2500);
  let exact = 0, tot = 0;
  for (const c of born) { const p = s.arch.get(c.pa); const po = s.idMap.get(c.pa); const pg = po ? po.g : null; if (!pg) continue; tot++; if (c.g.every((v, i) => v === pg[i])) exact++; }
  check('mutation rate 0 -> offspring identical to parent', tot > 20 && exact === tot, `${exact}/${tot}`);
  const m = new E.Simulation().init({ seed: 'inh-1', preset: 'balanced', params: { mutRate: 0.3 } });
  let muts = 0, kids = 0; const add2 = m.addOrg.bind(m); m.addOrg = o => { if (m.tick > 0) { kids++; muts += o.mut; } add2(o); };
  run(m, 2500);
  check('mutation rate 0.3 -> ~0.3 x 23 mutations per birth', kids > 50 && Math.abs(muts / kids - 0.3 * E.NG) < 1.5, (muts / kids).toFixed(2));
}

// 7. Energy bookkeeping sanity: no NaN, energies within [0, max].
{
  const s = run(new E.Simulation().init({ seed: 'nan-1', preset: 'radiation' }), 5000);
  const bad = s.orgs.filter(o => !(o.e >= 0 && o.e <= o.maxE + 1e-9 && o.hp <= o.maxH + 1e-9 && Number.isFinite(o.x) && Number.isFinite(o.y)));
  let fbad = 0; for (let i = 0; i < s.N; i++) if (!Number.isFinite(s.food[i]) || s.food[i] < -1e-6) fbad++;
  check('organism state finite and within limits', bad.length === 0, `${s.orgs.length} organisms`);
  check('plant field finite and non-negative', fbad === 0);
}

// 8. Every disaster runs and changes state.
{
  for (const k of Object.keys(E.DISASTERS)) {
    const s = run(new E.Simulation().init({ seed: 'dis-1', preset: 'balanced' }), 200);
    const before = s.hash();
    const ok = s.disaster(k, 0.8);
    run(s, 5);
    check(`disaster ${k} applies`, ok && s.hash() !== before && s.markers.some(m => m.label.startsWith(E.DISASTERS[k])));
  }
}

console.log(failed ? `\n${failed} check(s) FAILED` : '\nall checks passed');
process.exitCode = failed ? 1 : 0;
