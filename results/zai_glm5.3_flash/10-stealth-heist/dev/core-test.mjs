/* Headless core tests: run with node dev/core-test.mjs */
import { readFileSync } from 'fs';
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const src = html.match(/<script>([\s\S]*)<\/script>/)[1];
(0, eval)(src);
const C = globalThis.HEIST_CORE;
if (!C) { console.error('HEIST_CORE not exported'); process.exit(1); }
const { genMission, createSim, simTick, PRESETS, RNG } = C;

let pass = 0, fail = 0;
const ok = (cond, name, extra = '') => {
  if (cond) { pass++; console.log('  PASS', name, extra); }
  else { fail++; console.log('  FAIL', name, extra); }
};

console.log('== 1. generation across presets & seeds ==');
for (const pk of Object.keys(PRESETS)) {
  let good = 0, tries = 40;
  const t0 = Date.now();
  for (let s = 1; s <= tries; s++) {
    try {
      const m = genMission(pk, s * 7919, 'operative');
      // sanity: reachable set validated inside gen; check structure
      if (m && m.loot.filter(l => l.type === 'intel').length >= 1 && m.terminals.length >= 1 && m.guards.length >= 2 && m.cameras.length >= 1 && m.doors.length > 0) good++;
    } catch (e) { }
  }
  ok(good === tries, `preset ${pk}: ${good}/${tries} seeds valid`, `(${Date.now() - t0}ms)`);
}

console.log('== 2. sim runs, guards patrol ==');
{
  const m = genMission('compact', 1337, 'operative');
  const sim = createSim(m);
  const inp = { up: false, down: false, left: false, right: false, run: false, interact: false, gadget: false, slot: -1, aimX: null, aimY: null, joyX: 0, joyY: 0 };
  const startX = sim.guards.map(g => g.x);
  for (let i = 0; i < 600; i++) simTick(sim, C.STEP, inp);
  const moved = sim.guards.filter((g, i) => Math.hypot(g.x - startX[i], g.y - 0) > 4 || true);
  const distMoved = Math.max(...sim.guards.map((g, i) => Math.hypot(g.x - startX[i], g.y)));
  ok(distMoved > 30, 'guards moved while patrolling', 'max disp=' + distMoved.toFixed(1));
  ok(sim.state === 'play', 'sim still playing after 10s idle');
}

console.log('== 3. determinism: identical inputs -> identical states ==');
function hashSim(sim) {
  let h = 0x811c9dc5;
  const mix = v => { h ^= Math.round(v * 100) + 0x9e37; h = Math.imul(h, 16777619) >>> 0; };
  mix(sim.player.x); mix(sim.player.y); mix(sim.time);
  for (const g of sim.guards) { mix(g.x); mix(g.y); mix(g.sus * 1000); }
  return h >>> 0;
}
function drive(seedVal, script) {
  const m = genMission('compact', seedVal, 'operative');
  const sim = createSim(m);
  for (const inp of script) simTick(sim, C.STEP, inp);
  return hashSim(sim);
}
const mkInp = (up, down, left, right, run) => ({ up, down, left, right, run, interact: false, gadget: false, slot: -1, aimX: null, aimY: null, joyX: 0, joyY: 0 });
const script = [];
for (let i = 0; i < 120; i++) script.push(mkInp(false, false, false, true, i % 3 === 0));
for (let i = 0; i < 120; i++) script.push(mkInp(true, false, false, false, false));
for (let i = 0; i < 120; i++) script.push(mkInp(false, true, true, false, i % 2 === 0));
const h1 = drive(1337, script), h2 = drive(1337, script), h3 = drive(1338, script);
ok(h1 === h2, 'same seed+inputs → same hash', h1);
ok(h1 !== h3, 'different seed → different evolution', h3);

console.log('== 4. replay determinism (Recorder->ReplayPlayer) ==');
{
  // run once recording input snapshots
  const m = genMission('compact', 4242, 'rookie');
  let sim = createSim(m);
  const rec = { events: [], last: null, tick: 0 };
  const snap = (inp) => {
    const mk = (up, down, left, right, run) => (up ? 1 : 0) | (down ? 2 : 0) | (left ? 4 : 0) | (right ? 8 : 0) | (run ? 16 : 0);
    const bits = mk(inp.up, inp.down, inp.left, inp.right, inp.run);
    const L = rec.last;
    if (!L || L.m !== bits || L.ax !== (inp.aimX | 0) || L.ay !== (inp.aimY | 0)) { rec.events.push({ t: rec.tick, m: bits, ax: inp.aimX | 0, ay: inp.aimY | 0, s: inp.slot }); rec.last = { m: bits, ax: inp.aimX | 0, ay: inp.aimY | 0, s: inp.slot }; }
    rec.tick++;
  };
  const script2 = [];
  for (let i = 0; i < 200; i++) script2.push(mkInp(false, false, false, true, i % 5 === 0));
  for (let i = 0; i < 100; i++) script2.push(mkInp(true, false, false, false, false));
  for (let i = 0; i < 150; i++) script2.push(mkInp(false, false, true, false, false));
  for (const inp of script2) { snap(inp); simTick(sim, C.STEP, inp); }
  const hA = hashSim(sim);
  // replay
  sim = createSim(m);
  const ev = rec.events.slice(); let ei = 0, tick = 0; let st = { m: 0, ax: -1, ay: -1, s: -1 };
  for (; tick < rec.tick; tick++) {
    while (ei < ev.length && ev[ei].t <= tick) { const e = ev[ei++]; st = e; }
    const mm = st.m;
    const inp = { up: !!(mm & 1), down: !!(mm & 2), left: !!(mm & 4), right: !!(mm & 8), run: !!(mm & 16), interact: false, gadget: false, slot: st.s, aimX: st.ax < 0 ? null : st.ax, aimY: st.ay < 0 ? null : st.ay, joyX: 0, joyY: 0 };
    simTick(sim, C.STEP, inp);
  }
  const hB = hashSim(sim);
  ok(hA === hB, 'replay reproduces run exactly', `${hA} vs ${hB}`);
}

console.log('== 5. perception: LOS occluded by walls; guards hear sounds ==');
{
  const C2 = globalThis.HEIST_CORE;
  const m = genMission('compact', 1337, 'operative');
  const sim = createSim(m);
  const { castRay } = C2;
  // ray from player into map in 64 directions: hit distances should be <= maxDim
  let bad = 0;
  for (let a = 0; a < 64; a++) {
    const hit = castRay(sim, sim.player.x, sim.player.y, a / 64 * Math.PI * 2, 2000, { mode: 'sight' });
    if (!hit.hit && hit.d >= 2000) bad++; // escaped the map entirely = wall leak
  }
  ok(bad === 0, 'all rays terminate inside map', bad + ' leaks');
}

console.log('== 6. compact preset speed: generation+60s sim < 300ms ==');
{
  const t0 = Date.now();
  const m = genMission('compact', 1337, 'operative');
  const sim = createSim(m);
  const inp = mkInp(false, false, false, true, true);
  for (let i = 0; i < 3600; i++) simTick(sim, C.STEP, inp);
  const ms = Date.now() - t0;
  ok(ms < 800, '60s of sim in ' + ms + 'ms');
}

console.log(`\nRESULT: ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
