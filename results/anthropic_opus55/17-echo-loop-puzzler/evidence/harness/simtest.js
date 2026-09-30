// Headless solvability + determinism tests for the simulation block of index.html (or the parts).
const fs = require('fs');
const path = require('path');
const file = process.argv[2];
let src;
if (file) {
  const html = fs.readFileSync(file, 'utf8');
  src = html.slice(html.indexOf('// @@SIM-BEGIN'), html.indexOf('// @@LEVELS-END'));
} else {
  const d = path.join(__dirname, 'parts');
  src = fs.readFileSync(path.join(d, 'p2_sim.js'), 'utf8') + fs.readFileSync(path.join(d, 'p3_levels.js'), 'utf8');
}
const api = new Function(src + '\nreturn {T,TPS,BIT,PHYS,BUILTIN,Session,worldHash,createWorld,stepWorld,sessionFromTrace,sanitizeLevel,validateLevel,cloneWorld,beamRect};')();
const { T, BIT, BUILTIN, Session, worldHash, sessionFromTrace, sanitizeLevel, validateLevel } = api;

// ---- bot step helpers: each returns a function (S, a) => bits | null (null = step done)
const cx = a => a.x + a.w / 2;
const goX = (x, tol = 2) => (S, a) => { const d = x - cx(a); if (Math.abs(d) <= tol && Math.abs(a.vx) < 0.9) return null; if (Math.abs(d) <= tol) return 0; return d > 0 ? BIT.R : BIT.L; };
const hold = (bits, n) => { let k = 0; return () => (k++ < n ? bits : null); };
const tap = bits => hold(bits, 2);
const waitT = t => S => (S.W.tick < t ? 0 : null);
const waitFn = (fn, bits = 0) => (S, a) => (fn(S, a) ? null : bits);
const both = (f, bits) => (S, a) => { const r = f(S, a); return r === null ? null : (r | bits); };
const commit = () => 'COMMIT';
// jump and steer toward target x until landing
const jumpTo = tx => { let k = 0, air = false; return (S, a) => { k++; if (!a.gr) air = true; if (air && a.gr) return null; const d = tx - cx(a); const h = Math.abs(d) < 3 ? 0 : d > 0 ? BIT.R : BIT.L; return (k <= 14 ? BIT.J : 0) | h; }; };

function runLoop(S, plan, maxT) {
  let i = 0;
  while (S.state === 'play') {
    if (S.W.tick >= (maxT || S.loopTicks)) return 'timeout';
    const a = S.player;
    let bits = null;
    while (i < plan.length) {
      bits = plan[i](S, a);
      if (bits === 'COMMIT') { S.endLoop('manual'); return 'committed'; }
      if (bits === null) { i++; continue; }
      break;
    }
    if (i >= plan.length) bits = 0;
    S.step(bits);
  }
  return S.state;
}

const results = [];
function check(name, cond, info) { results.push({ name, ok: !!cond, info }); console.log((cond ? 'PASS ' : 'FAIL ') + name + (info ? '  — ' + info : '')); }

function solve(idx, loopsF, label) {
  const loops = typeof loopsF === 'function' ? loopsF() : loopsF;
  const events = [];
  const S = new Session(BUILTIN[idx], { notify: (k, d) => events.push([k, d]) });
  let out;
  for (let li = 0; li < loops.length; li++) {
    out = runLoop(S, loops[li]);
    if (li < loops.length - 1 && out !== 'committed') { check(label, false, 'loop ' + (li + 1) + ' ended ' + out + ' at tick ' + S.W.tick + ' player@' + S.player.x.toFixed(1) + ',' + S.player.y.toFixed(1) + ' ' + JSON.stringify(events.filter(e => e[0] !== 'committed').map(e => [e[0], e[1] && (e[1].cause || e[1])]).slice(-3))); return null; }
  }
  const divs = events.filter(e => e[0] === 'diverge');
  const wantWin = !label.includes('negative');
  check(label, (S.state === 'won') === wantWin, 'state=' + S.state + ' tick=' + S.W.tick + ' loops=' + (S.n + 1) + ' simTicks=' + S.stats.ticks + (divs.length ? ' divergences=' + JSON.stringify(divs.map(d => [d[1].echo, d[1].t, d[1].cause, Math.round(d[1].d)])) : '') + (S.state !== 'won' ? ' player@' + S.player.x.toFixed(1) + ',' + S.player.y.toFixed(1) : ''));
  return S;
}

// Level 1: First Echo
const L1 = () => [
  [goX(7 * T), commit],
  [goX(26 * T)],
];
const S1 = solve(0, L1, 'L1 First Echo solvable in 2 loops');
// Level 1 negative: without an echo the door closes behind you
solve(0, () => [[goX(7 * T), goX(26 * T)]], 'L1 negative control: a single loop cannot win');

// Level 2: Stand Tall
const L2 = () => [
  [goX(8 * T), commit],
  [goX(8 * T), hold(BIT.J, 14), waitFn((S, a) => a.gr), waitT(0), hold(BIT.J | BIT.R, 20), goX(11 * T), commit],
  [goX(8 * T), hold(BIT.J, 14), waitFn((S, a) => a.gr), waitT(0), hold(BIT.J | BIT.R, 20), goX(26 * T)],
];
solve(1, L2, 'L2 Stand Tall solvable in 3 loops');

// Level 3: Handoff
const L3 = () => [
  [goX(7.5 * T + 4), waitFn((S, a) => a.gr && a.y > 11 * T), tap(BIT.I), tap(BIT.R), hold(BIT.J, 18), waitFn((S, a) => a.vy >= -0.5, BIT.J), tap(BIT.X), waitT(200), commit],
  [waitT(150), goX(5 * T), hold(BIT.R, 8), hold(BIT.R | BIT.J, 25), goX(10 * T),
    // push the crate into the pocket
    (S, a) => { const c = S.W.crates[0]; return c.x + c.w >= 16 * T + 20 ? null : BIT.R; },
    hold(BIT.L, 10), hold(BIT.R | BIT.J, 20), goX(26 * T), goX(29 * T)],
];
solve(2, L3, 'L3 Handoff solvable in 2 loops');

// Level 4: Rush Hour
const L4 = () => [
  [goX(3.5 * T), waitT(360), tap(BIT.I), waitT(380), commit],
  [waitFn((S, a) => a.gr && a.x > 13 * T + 4, BIT.R),
    (S, a) => { const l = S.W.lifts[0]; return l.x + l.w >= 20 * T - 0.5 ? null : 0; }, goX(22.5 * T),
    waitFn(S => S.W.lifts[1].y <= 6 * T + 0.5), goX(29 * T)],
];
solve(3, L4, 'L4 Rush Hour solvable in 2 loops');

// Level 5: Laser Waltz — cross each beam only when it will stay off long enough
const beamX = col => col * T + T / 2;
function crossBeam(col) {
  let go = false;
  return (S, a) => {
    const L = S.W.lasers.find(l => l.x === col * T);
    const ph = (S.W.tick + L.ph) % L.per;
    const offLeft = ph >= L.onT ? L.per - ph : 0;
    if (cx(a) > beamX(col) + 22) return null;
    if (!go && offLeft > 22) go = true;
    return go ? BIT.R : 0;
  };
}
const L5 = () => [
  [goX(8 * T - 12), crossBeam(8), goX(12 * T - 12), crossBeam(12), goX(16 * T - 12), crossBeam(16), goX(19 * T), commit],
  [goX(8 * T - 12), crossBeam(8), goX(12 * T - 12), crossBeam(12), goX(16 * T - 12), crossBeam(16), goX(28 * T)],
];
solve(4, L5, 'L5 Laser Waltz solvable in 2 loops');

// Level 6: Chorus (4-loop solution: plate echo, timer echo, lift-plate echo, player)
const pass6 = () => [goX(16 * T - 12), crossBeam(16), goX(20 * T - 12), crossBeam(20)];
const climb6 = () => [goX(21.5 * T), hold(BIT.J, 16), waitFn((S, a) => a.gr), goX(22.2 * T), hold(BIT.J | BIT.R, 14), waitFn((S, a) => a.gr), goX(23.5 * T)];
const L6 = () => [
  [goX(10 * T), commit],
  [...pass6(), ...climb6(), waitT(760), tap(BIT.I), waitT(770), commit],
  [...pass6(), goX(26 * T), waitT(690), goX(29 * T), waitT(720), commit],
  [...pass6(), goX(32 * T), waitFn(S => S.W.lifts[0].y <= 6 * T + 0.5), goX(37 * T)],
];
const S6 = solve(6, L6, 'L7 Chorus solvable in 4 loops');
// Level 6 with the crate trick: first echo parks the crate on the gate plate, then presses the sky timer
const L6b = () => [
  [goX(2.4 * T), tap(BIT.L), tap(BIT.I), goX(9.3 * T), tap(BIT.I), ...pass6(), ...climb6(), waitT(760), tap(BIT.I), waitT(770), commit],
  [...pass6(), goX(26 * T), waitT(690), goX(29 * T), waitT(720), commit],
  [...pass6(), goX(32 * T), waitFn(S => S.W.lifts[0].y <= 6 * T + 0.5), goX(37 * T)],
];
solve(6, L6b, 'L7 Chorus solvable in 3 loops with the crate trick (gold par)');
// Switchback (level 6): echo flips the lever after the player passed the inverted door
const LS = () => [
  [goX(1.5 * T), waitT(240), tap(BIT.I), waitT(250), commit],
  [goX(10.4 * T), jumpTo(12.9 * T), goX(13.5 * T), jumpTo(16.9 * T), goX(17.5 * T), jumpTo(21 * T), goX(20.4 * T), waitFn(S => S.W.doors[1].o === 12), goX(28 * T)],
];
solve(5, LS, 'L6 Switchback solvable in 2 loops');
solve(5, () => [[goX(1.5 * T), tap(BIT.I), goX(28 * T)]], 'L6 negative control: flipping the lever yourself cannot win');
solve(5, () => [[goX(10.4 * T), jumpTo(12.9 * T), goX(13.5 * T), jumpTo(16.9 * T), goX(17.5 * T), jumpTo(21 * T), goX(28 * T)]], 'L6 negative control: without the lever the far door stays shut');

// ---- determinism: restart and replay the same tapes → identical hashes
if (S1) {
  const tr = S1.exportTrace();
  const json = JSON.stringify(tr);
  const R = sessionFromTrace(JSON.parse(json));
  while (R.state === 'play') R.step(0);
  check('Trace re-import reproduces the win', R.state === 'won' && worldHash(R.W) === tr.result.hash, 'hash ' + worldHash(R.W) + ' vs ' + tr.result.hash + ' state ' + R.state);
  const v = S1.verify();
  check('Live loop re-simulates to identical hash', v.ok, v.a + ' / ' + v.b);
}
if (S6) {
  const tr = S6.exportTrace();
  const R = sessionFromTrace(JSON.parse(JSON.stringify(tr)));
  while (R.state === 'play') R.step(0);
  check('L7 4-loop trace replays deterministically', R.state === 'won' && worldHash(R.W) === tr.result.hash, worldHash(R.W) + ' vs ' + tr.result.hash);
  // divergence: replay L6 where the player blocks nothing but first echo is undone → later echoes should diverge/fail
}
// ---- divergence detection: in L2, undo echo 1 after echo 2 was recorded on top of it → echo 2 must diverge
{
  const ev = [];
  const S = new Session(BUILTIN[1], { notify: (k, d) => ev.push([k, d]) });
  const P2 = L2(); runLoop(S, P2[0]); runLoop(S, P2[1]);
  // remove echo #1 but keep echo #2 by rebuilding the session manually (the UI forbids this; we simulate the desync)
  const e2 = S.echoes[1];
  S.echoes = [e2]; S.restartLoop();
  for (let i = 0; i < 300; i++) S.step(0);
  const d = ev.filter(e => e[0] === 'diverge');
  check('Divergence surfaced when an echo loses the body it stood on', d.length > 0, d.length ? 'first: ' + d[0][1].cause + ' @' + d[0][1].t : 'none');
}
// ---- checkpoint: resumeFrom keeps determinism
{
  const S = new Session(BUILTIN[0], {});
  runLoop(S, L1()[0]);
  for (let i = 0; i < 90; i++) S.step(BIT.R);
  const hA = worldHash(S.previewAt(40));
  S.resumeFrom(40);
  check('Checkpoint resume restores exact tick-40 state', worldHash(S.W) === hA && S.W.tick === 40);
  for (let i = 0; i < 50; i++) S.step(BIT.R);
  check('After checkpoint, re-simulation still matches', S.verify().ok);
  const f = S.previewAt(S.loopTicks);
  check('Forecast preview reaches loop end without touching live world', f.tick === S.loopTicks && S.W.tick === 90);
}
// ---- import robustness
{
  const bad = [null, 42, 'x', [], { objects: 'no' }, { objects: [{ type: '__proto__' }, { type: 'constructor' }, { type: 'wall', x: 'a', w: 1e9 }, 7, null] }, { format: 'evil' }, JSON.parse('{"__proto__":{"polluted":1},"objects":[]}')];
  let ok = true;
  for (const b of bad) { try { const r = sanitizeLevel(b); if (r.level) validateLevel(r.level); } catch (e) { ok = false; console.log(e); } }
  check('Malformed levels never throw', ok && ({}).polluted === undefined);
}
const fails = results.filter(r => !r.ok);
console.log('\n' + (results.length - fails.length) + '/' + results.length + ' checks passed');
process.exit(fails.length ? 1 : 0);
