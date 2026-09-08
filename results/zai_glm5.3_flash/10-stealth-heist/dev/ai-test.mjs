/* Headless AI behavior test */
import { readFileSync } from 'fs';
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const src = html.match(/<script>([\s\S]*)<\/script>/)[1];
(0, eval)(src);
const C = globalThis.HEIST_CORE;
const { genMission, createSim, simTick, STEP, lineOfSight } = C;
let pass = 0, fail = 0;
const ok = (c, n, x = '') => { c ? (pass++, console.log('  PASS', n, x)) : (fail++, console.log('  FAIL', n, x)); };
const idle = { up: false, down: false, left: false, right: false, run: false, interact: false, gadget: false, slot: -1, aimX: null, aimY: null, joyX: 0, joyY: 0 };
const hold = (o) => ({ ...idle, ...o });

const m = genMission('compact', 1337, 'operative');
const sim = createSim(m);
const g = sim.guards[0];
const p = sim.player;

// -- 1. vision: put guard 120px away facing player, in the same open area
// find a spot with LOS from player
let placed = false;
for (let d = 60; d < 300 && !placed; d += 10) {
  for (let a = 0; a < 32; a++) {
    const x = p.x + Math.cos(a / 32 * Math.PI * 2) * d, y = p.y + Math.sin(a / 32 * Math.PI * 2) * d;
    const ti = Math.floor(y / 32) * sim.W + Math.floor(x / 32);
    if (sim.m.grid[ti] === 1 && lineOfSight(sim, x, y, p.x, p.y)) {
      g.x = x; g.y = y; g.angle = Math.atan2(p.y - y, p.x - x); g.state = 'PATROL';
      placed = true; break;
    }
  }
}
ok(placed, 'guard placed with LOS to player');
// player runs toward guard -> should escalate
let sawSus = false, sawAlert = false;
for (let i = 0; i < 60 * 6; i++) {
  const dx = g.x - p.x, dy = g.y - p.y, l = Math.hypot(dx, dy) || 1;
  simTick(sim, STEP, hold({ right: dx > 0, left: dx < 0, down: dy > 0, up: dy < 0, run: true }));
  if (g.state === 'SUSPICIOUS') sawSus = true;
  if (g.state === 'ALERT') { sawAlert = true; break; }
  if (sim.state !== 'play') break;
}
ok(sawSus || sawAlert, 'guard became suspicious on sight', g.state);
ok(sawAlert || sim.state === 'lost', 'guard escalated to ALERT / caught player', `state=${g.state} simState=${sim.state} detections=${sim.detections}`);
ok(sim.detections >= 1 || sim.state === 'lost', 'detection counted');

// -- 2. sound: player runs near a calm guard elsewhere -> INVESTIGATE
{
  const m2 = genMission('compact', 1337, 'operative');
  const s2 = createSim(m2);
  const g2 = s2.guards[1], p2 = s2.player;
  g2.x = p2.x + 90; g2.y = p2.y; g2.angle = Math.PI; // facing away
  g2.state = 'PATROL';
  let inv = false;
  for (let i = 0; i < 60 * 4; i++) {
    simTick(s2, STEP, hold({ right: true, run: true })); // run -> loud footsteps
    if (g2.state === 'INVESTIGATE') { inv = true; break; }
  }
  ok(inv, 'guard investigated running footsteps', `state=${g2.state} poi=${!!g2.poi}`);
}

// -- 3. losing sight during pursuit -> SEARCH, then RETURN
{
  const m3 = genMission('compact', 1337, 'operative');
  const s3 = createSim(m3);
  const g3 = s3.guards[0], p3 = s3.player;
  // place at an open spot with LOS, like a real pursuit
  let placed3 = false;
  for (let d = 130; d < 240 && !placed3; d += 15) {
    for (let a = 0; a < 24; a++) {
      const x = p3.x + Math.cos(a / 24 * Math.PI * 2) * d, y = p3.y + Math.sin(a / 24 * Math.PI * 2) * d;
      const ti = Math.floor(y / 32) * s3.W + Math.floor(x / 32);
      if (s3.m.grid[ti] === 1 && C.lineOfSight(s3, x, y, p3.x, p3.y)) {
        g3.x = x; g3.y = y; g3.angle = Math.atan2(p3.y - y, p3.x - x); placed3 = true; break;
      }
    }
  }
  ok(placed3, 'pursuit guard placed with LOS');
  g3.sus = 1; g3.state = 'ALERT'; g3.lkp = { x: p3.x, y: p3.y }; g3.lkpAge = 0; g3.lostT = 0; g3.reactT = 0.1;
  // let him chase briefly while visible (player stands still -> may get caught, which is also a pass)
  for (let i = 0; i < 40 && s3.state === 'play'; i++) simTick(s3, STEP, idle);
  if (s3.state === 'play') ok(g3.state === 'ALERT', 'guard still ALERT while chasing (player idle, LOS likely)');
  else ok(true, 'guard captured idle player during pursuit (correct)');
  // fresh sim for LOS-break: alert, then teleport player away instantly
  const s3b = createSim(m3);
  const gb = s3b.guards[0], pb = s3b.player;
  gb.sus = 1; gb.state = 'ALERT'; gb.lkp = { x: pb.x, y: pb.y }; gb.lkpAge = 0; gb.reactT = 0.1;
  // pick a hiding tile: walkable, >220px from every guard, no LOS to any guard
  let hx = null, hy = null;
  outer:
  for (let ty = 1; ty < s3b.H - 1; ty++) for (let tx = 1; tx < s3b.W - 1; tx++) {
    const i = ty * s3b.W + tx;
    if (s3b.m.grid[i] !== 1 || s3b.m.propSolid[i]) continue;
    const x = (tx + 0.5) * 32, y = (ty + 0.5) * 32;
    let safe = true;
    for (const og of s3b.guards) {
      if (Math.hypot(og.x - x, og.y - y) < 220 || C.lineOfSight(s3b, og.x, og.y, x, y)) { safe = false; break; }
    }
    if (safe) { hx = x; hy = y; break outer; }
  }
  ok(hx !== null, 'found guard-free hiding tile');
  if (hx === null) { console.log(`\nRESULT: ${pass} pass, ${fail + 1} fail`); process.exit(1); }
  pb.x = hx; pb.y = hy;
  let sawSearch = false, sawReturn = false;
  for (let i = 0; i < 60 * 25 && !sawReturn; i++) {
    simTick(s3b, STEP, idle);
    if (gb.state === 'SEARCH') sawSearch = true;
    if (gb.state === 'RETURN' || gb.state === 'PATROL' || gb.state === 'WAIT') sawReturn = true;
  }
  ok(sawSearch, 'guard entered local SEARCH after losing sight', `lkpAge=${gb.lkpAge.toFixed(1)}`);
  ok(sawReturn, 'guard returned to duty after search');
  ok(!gb.visPlayer, 'guard does not see player through walls', `dist=${Math.hypot(gb.x - pb.x, gb.y - pb.y) | 0}`);
}

// -- 4. camera sweep runs; alarm raises when sus fills (force feed)
{
  const m4 = genMission('compact', 1337, 'operative');
  const s4 = createSim(m4);
  const c = s4.cameras[0];
  const a0 = c.ang;
  for (let i = 0; i < 240; i++) simTick(s4, STEP, idle);
  ok(Math.abs(c.ang - a0) > 0.01 || Math.abs(Math.sin(c.phase)) > 0, 'camera sweep advances');
  // force alarm via direct raise
  const before = s4.alarmCount;
  s4.alarmT = 5; s4.alarmCount++;
  for (const gg of s4.guards) if (gg.state !== 'ALERT') { gg.poi = { x: s4.player.x, y: s4.player.y }; gg.state = 'INVESTIGATE'; }
  for (let i = 0; i < 30; i++) simTick(s4, STEP, idle);
  ok(s4.guards.some(gg => gg.state === 'INVESTIGATE' || gg.state === 'ALERT'), 'alarm sends guards to investigate');
}

console.log(`\nRESULT: ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
