/* Headless bot playthrough: find seeds the sneaker-bot can complete on compact/rookie */
import { readFileSync } from 'fs';
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const src = html.match(/<script>([\s\S]*)<\/script>/)[1];
(0, eval)(src);
const C = globalThis.HEIST_CORE;
const { genMission, createSim, simTick, STEP, lineOfSight, findPath } = C;

const IDLE = { up: false, down: false, left: false, right: false, run: false, interact: false, gadget: false, slot: -1, aimX: null, aimY: null };
const setK = (o) => ({ ...IDLE, ...o });
const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);

function playSeed(seed, diff, maxTicks = 60 * 240, verbose = false) {
  const m = genMission('compact', seed, diff);
  const sim = createSim(m);
  const p = sim.player;
  const intel = sim.loot.find(l => l.type === 'intel');
  const ex = m.extract;
  const stops = [ [intel.x, intel.y, 'intel'], [(ex.tx + .5) * 32, (ex.ty + .5) * 32, 'extract'] ];
  const path = findPath(sim, p.x, p.y, stops[0][0], stops[0][1], false);
  if (!path) return { ok: false, why: 'nopath' };
  const wp2 = findPath(sim, intel.x, intel.y, stops[1][0], stops[1][1], false);
  const route = [...path, ...((wp2 || []).slice(1))];
  let wpIdx = 0, holding = 0, t = 0;
  const dangerNear = () => {
    for (const g of sim.guards) {
      const d = dist(g.x, g.y, p.x, p.y);
      const ang = Math.atan2(p.y - g.y, p.x - g.x);
      const inFov = Math.abs(Math.atan2(Math.sin(ang - g.angle), Math.cos(ang - g.angle))) < g.fov / 2 + 0.2;
      if (g.state === 'ALERT' || (d < g.viewDist * 0.8 && inFov) || (d < 110 && g.sus > 0.1) || d < 90) return g;
    }
    return null;
  };
  let wpTicks = 0;
  while (t < maxTicks) {
    if (sim.state !== 'play') return { ok: false, why: 'lost@' + t, t };
    if (p.intel >= m.intelTotal && dist(p.x, p.y, stops[1][0], stops[1][1]) < 30) {
      simTick(sim, STEP, setK({ interact: true }));
      t++;
      if (sim.state === 'won') return { ok: true, t, det: sim.detections, alm: sim.alarmCount };
      continue;
    }
    const wp = route[Math.min(wpIdx, route.length - 1)];
    const wx = wp.x, wy = wp.y;
    if (dist(p.x, p.y, wx, wy) < 16 && wpTicks > 5) { wpIdx++; wpTicks = 0; if (wpIdx >= route.length) wpIdx = route.length - 1; continue; }
    wpTicks++;
    const g = dangerNear();
    if (g) {
      // hide: move away from guard, prefer breaking LOS; commit 1.2s
      const ang = Math.atan2(p.y - g.y, p.x - g.x);
      // scan 8 dirs, choose one increasing distance & out of cone
      let bestDir = ang, bestScore = -1e9;
      for (let a = 0; a < 8; a++) {
        const dir = a / 8 * Math.PI * 2;
        const px = p.x + Math.cos(dir) * 130, py = p.y + Math.sin(dir) * 130;
        const ti = Math.floor(py / 32) * sim.W + Math.floor(px / 32);
        const inside = px > 0 && py > 0 && px < sim.W * 32 && py < sim.H * 32;
        const okTile = inside && sim.m.grid[ti] === 1;
        const dd = dist(g.x, g.y, px, py);
        let score = Math.min(dd, 320) + (okTile ? 60 : -80);
        if (lineOfSight(sim, g.x, g.y, px, py)) score -= 140;
        if (score > bestScore) { bestScore = score; bestDir = dir; }
      }
      simTick(sim, STEP, setK({ right: Math.cos(bestDir) > 0.3, left: Math.cos(bestDir) < -0.3, down: Math.sin(bestDir) > 0.3, up: Math.sin(bestDir) < -0.3 }));
      t++;
      // commitment: keep fleeing briefly without reassessing
      for (let k = 0; k < 40 && sim.state === 'play'; k++) {
        simTick(sim, STEP, setK({ right: Math.cos(bestDir) > 0.3, left: Math.cos(bestDir) < -0.3, down: Math.sin(bestDir) > 0.3, up: Math.sin(bestDir) < -0.3 }));
        t++;
      }
      continue;
    }
    // move toward waypoint, open doors when blocked
    const prev = { x: p.x, y: p.y };
    let inp = setK({ run: true, right: wx > p.x + 6, left: wx < p.x - 6, down: wy > p.y + 6, up: wy < p.y - 6 });
    simTick(sim, STEP, inp);
    t++;
    if (dist(prev.x, prev.y, p.x, p.y) < 1.2) {
      // blocked: door ahead?
      let dr = null, bd = 1e9;
      for (const d of sim.doors) { const dd = dist(d.cx, d.cy, wx, wy); if (dd < 70 && dd < bd) { bd = dd; dr = d; } }
      if (dr) {
        if (dr.locked) {
          for (let k = 0; k < 2.7 * 60 && sim.state === 'play'; k++) { simTick(sim, STEP, setK({ interact: true })); t++; }
        } else if (dr.open < 0.5) {
          simTick(sim, STEP, setK({ interact: true }));
          for (let k = 0; k < 30 && sim.state === 'play'; k++) { simTick(sim, STEP, IDLE); t++; }
        } else { for (let k = 0; k < 20; k++) { simTick(sim, STEP, IDLE); t++; } }
      } else {
        for (let k = 0; k < 20; k++) { simTick(sim, STEP, IDLE); t++; }
        if (dist(p.x, p.y, wx, wy) > 24) wpIdx = Math.min(wpIdx + 1, route.length - 1);
      }
    }
  }
  return { ok: false, why: 'timeout', t };
}

const wins = [];
const t0 = Date.now();
for (let s = 0; s < 40; s++) {
  const seed = s * 137 + 11;
  const r = playSeed(seed, 'rookie');
  if (r.ok) wins.push({ seed, ...r });
  console.log('seed', seed, JSON.stringify(r));
}
console.log('WINS:', JSON.stringify(wins), 'in', ((Date.now() - t0) / 1000).toFixed(1) + 's');
