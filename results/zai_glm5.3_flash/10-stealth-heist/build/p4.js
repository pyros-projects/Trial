
/* =====================================================================
   SIMULATION — fixed-step, deterministic
   ===================================================================== */
const STEP = 1 / 60;

function createSim(mission) {
  const { W, H } = mission, D = DIFFS[mission.diff] || DIFFS.operative;
  const sim = {
    m: mission, W, H, diff: D, doorAt: new Map(),
    time: 0, state: 'play', result: null, caughtBy: -1,
    rng: new RNG(((mission.seed >>> 0) ^ 0x9e3779b9) >>> 0),
    player: null, guards: [], cameras: [], doors: [], terminals: [], loot: [],
    smokes: [], sounds: [], projectiles: [], emitters: [], empFx: null,
    alarmT: 0, alarmCd: 0, alarmCount: 0, sysOffline: false, shareT: 0,
    alert: 0, detections: 0, spottedT: 0, toasts: [],
  };
  for (const d of mission.doors) {
    let minx = 1e9, miny = 1e9, maxx = -1, maxy = -1;
    for (const t of d.tiles) { const tx = t % W, ty = (t / W) | 0; minx = Math.min(minx, tx); miny = Math.min(miny, ty); maxx = Math.max(maxx, tx); maxy = Math.max(maxy, ty); }
    const door = { id: d.id, axis: d.axis, tiles: d.tiles, minx, miny, maxx, maxy, locked: !!d.locked, elec: !!d.elec, empT: 0, open: 0, target: 0, autoT: 0 };
    door.cx = (minx + maxx + 1) * TILE / 2; door.cy = (miny + maxy + 1) * TILE / 2;
    for (const t of d.tiles) sim.doorAt.set(t, door);
    sim.doors.push(door);
  }
  sim.player = {
    x: (mission.entry.tx + 0.5) * TILE, y: (mission.entry.ty + 0.5) * TILE, r: 9, angle: -Math.PI / 2,
    moving: false, running: false, stepT: 0, noise: 0, bumpT: 0,
    gadgets: GADGETS.map(g => ({ count: (g.key === 'noise' ? 3 : 2) + D.charges, cd: 0 })),
    sel: 0, intel: 0, val: 0, inRestricted: false, light: 0.2,
    act: null, extractT: 0, prevInteract: false, prevGadget: false, aimX: null, aimY: null, target: null,
  };
  for (const gd of mission.guards) {
    const s = gd.route[0], n = gd.route[1] || gd.route[0];
    sim.guards.push({
      id: gd.id, x: (s.tx + 0.5) * TILE, y: (s.ty + 0.5) * TILE, r: 9,
      angle: Math.atan2((n.ty - s.ty), (n.tx - s.tx)),
      viewDist: 250 * D.vision, fov: 1.55 * D.fov, walk: 62, run: 118,
      state: 'PATROL', sus: 0, poi: null, lkp: null, lkpAge: 999, lostT: 999, visPlayer: false,
      reactT: 0, path: null, pi: 0, repathT: 0, waitT: 0, searchT: 0, detCd: 0, delayT: 0,
      route: gd.route.map(p => ({ x: (p.tx + 0.5) * TILE, y: (p.ty + 0.5) * TILE })), ri: 0,
      stuckT: 0, lx: 0, ly: 0,
    });
  }
  for (const cd of mission.cameras) {
    sim.cameras.push({ id: cd.id, x: (cd.tx + 0.5) * TILE, y: (cd.ty + 0.5) * TILE, base: cd.base, ang: cd.base, arc: cd.arc, speed: cd.speed, phase: cd.phase, range: cd.range * D.vision, sus: 0, disT: 0, on: true, beeped: false });
  }
  for (const T of mission.terminals) sim.terminals.push({ id: T.id, x: (T.tx + 0.5) * TILE, y: (T.ty + 0.5) * TILE, used: false });
  for (const L of mission.loot) sim.loot.push({ id: L.id, type: L.type, x: (L.tx + 0.5) * TILE, y: (L.ty + 0.5) * TILE, taken: false, seen: false });
  return sim;
}

/* ---------------- helpers ---------------- */
function toast(sim, msg, cls) { sim.toasts.push({ msg, cls: cls || '', t: 0 }); if (sim.toasts.length > 4) sim.toasts.shift(); }
function panOf(sim, x, y) { const p = sim.player; return clamp((x - p.x) / 420, -0.85, 0.85); }
function volOf(sim, x, y) { const p = sim.player; return clamp(1 - dist(p.x, p.y, x, y) / 720, 0.04, 1); }
function tileI(sim, x, y) { return clamp(Math.floor(y / TILE), 0, sim.H - 1) * sim.W + clamp(Math.floor(x / TILE), 0, sim.W - 1); }
function isRestricted(sim, x, y) { const r = sim.m.roomAt[tileI(sim, x, y)]; return r >= 0 && sim.m.restricted.has(r); }
function lightAt(sim, x, y) {
  let v = 0.17;
  const r = sim.m.roomAt[tileI(sim, x, y)];
  if (r >= 0) v = 0.26;
  for (const L of sim.m.lamps) {
    const lx = (L.tx + 0.5) * TILE, ly = (L.ty + 0.5) * TILE, d = dist(x, y, lx, ly);
    if (d < L.r) v = Math.max(v, L.int * (1 - d / L.r) + 0.12);
  }
  return clamp(v, 0, 1);
}
function solidMoveTile(sim, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= sim.W || ty >= sim.H) return true;
  const i = ty * sim.W + tx;
  if (sim.m.grid[i] === 0 || sim.m.propSolid[i]) return true;
  const d = sim.doorAt.get(i);
  return !!d && d.open < 0.4;
}
function moveCircle(sim, ent, dx, dy) {
  const r = ent.r * 0.85; let bumped = false;
  if (dx !== 0) {
    ent.x += dx;
    const miny = Math.floor((ent.y - r) / TILE), maxy = Math.floor((ent.y + r) / TILE);
    if (dx > 0) {
      const tx = Math.floor((ent.x + r) / TILE);
      for (let ty = miny; ty <= maxy; ty++) if (solidMoveTile(sim, tx, ty)) { ent.x = Math.min(ent.x, tx * TILE - r - 0.01); bumped = true; }
    } else {
      const tx = Math.floor((ent.x - r) / TILE);
      for (let ty = miny; ty <= maxy; ty++) if (solidMoveTile(sim, tx, ty)) { ent.x = Math.max(ent.x, tx * TILE + TILE + r + 0.01); bumped = true; }
    }
  }
  if (dy !== 0) {
    ent.y += dy;
    const minx = Math.floor((ent.x - r) / TILE), maxx = Math.floor((ent.x + r) / TILE);
    if (dy > 0) {
      const ty = Math.floor((ent.y + r) / TILE);
      for (let tx = minx; tx <= maxx; tx++) if (solidMoveTile(sim, tx, ty)) { ent.y = Math.min(ent.y, ty * TILE - r - 0.01); bumped = true; }
    } else {
      const ty = Math.floor((ent.y - r) / TILE);
      for (let tx = minx; tx <= maxx; tx++) if (solidMoveTile(sim, tx, ty)) { ent.y = Math.max(ent.y, ty * TILE + TILE + r + 0.01); bumped = true; }
    }
  }
  ent.x = clamp(ent.x, r, sim.W * TILE - r); ent.y = clamp(ent.y, r, sim.H * TILE - r);
  return bumped;
}

/* ---------------- sound events (game state, not just visuals) ---------------- */
function emitSound(sim, x, y, intensity, type) {
  sim.sounds.push({ x, y, r0: intensity, age: 0, life: 0.7 + intensity / 240, type });
  if (sim.sounds.length > 40) sim.sounds.shift();
  const D = sim.diff;
  for (const g of sim.guards) {
    const d = dist(g.x, g.y, x, y);
    const occ = occlusion(sim, x, y, g.x, g.y);
    const eff = intensity * D.sound * Math.pow(0.55, occ);
    if (d > eff) continue;
    const prox = 1 - d / eff;
    if (g.state === 'ALERT') { // already hunting: refine last-known if plausible
      if ((!g.lkp || dist(g.lkp.x, g.lkp.y, x, y) > 70) && occ <= 1) { g.lkp = { x, y }; g.lkpAge = 0; }
      continue;
    }
    g.poi = { x, y };
    if (g.state !== 'INVESTIGATE') { g.state = 'INVESTIGATE'; g.path = null; g.delayT = 0.25 + 0.3 * sim.rng.next(); }
    g.sus = Math.max(g.sus, 0.25 + 0.45 * prox);
  }
}

/* ---------------- player ---------------- */
function updatePlayer(sim, dt, inp) {
  const p = sim.player;
  p.aimX = inp.aimX; p.aimY = inp.aimY;
  let mx = (inp.right ? 1 : 0) - (inp.left ? 1 : 0), my = (inp.down ? 1 : 0) - (inp.up ? 1 : 0);
  const ml = Math.hypot(mx, my); if (ml > 1) { mx /= ml; my /= ml; }
  p.moving = ml > 0.01 || Math.abs(inp.joyX || 0) > 0.05 || Math.abs(inp.joyY || 0) > 0.05;
  if (p.moving && ml <= 0.01) { mx = inp.joyX; my = inp.joyY; }
  p.running = !!inp.run && p.moving;
  const sp = p.running ? 158 : 92;
  const bumped = moveCircle(sim, p, mx * sp * dt, my * sp * dt);
  if (inp.aimX != null) p.angle = angLerp(p.angle, Math.atan2(inp.aimY - p.y, inp.aimX - p.x), 1 - Math.pow(0.00002, dt));
  else if (p.moving) p.angle = angLerp(p.angle, Math.atan2(my, mx), 1 - Math.pow(0.0004, dt));
  let nTarget = p.moving ? (p.running ? 1 : 0.4) : 0;
  if (p.act) nTarget = Math.max(nTarget, 0.55);
  p.noise += (nTarget - p.noise) * Math.min(1, dt * 8);
  if (p.moving) {
    p.stepT -= dt * (p.running ? 1.7 : 1);
    if (p.stepT <= 0) {
      p.stepT = 0.34;
      emitSound(sim, p.x, p.y, p.running ? 150 : 62, 'step');
      Sfx.step(p.running, 1);
    }
  }
  if (bumped) { p.bumpT -= dt; if (p.bumpT <= 0) { p.bumpT = 0.5; emitSound(sim, p.x, p.y, 72, 'bump'); } } else p.bumpT = 0;
  p.inRestricted = isRestricted(sim, p.x, p.y);
  p.light = lightAt(sim, p.x, p.y);
  if (inp.slot >= 0 && inp.slot < GADGETS.length && inp.slot !== p.sel) p.sel = inp.slot;
  const gDown = !!inp.gadget;
  if (gDown && !p.prevGadget) useGadget(sim);
  p.prevGadget = gDown;
  handleInteraction(sim, dt, inp);
  /* extraction */
  const ex = sim.m.extract, exX = (ex.tx + 0.5) * TILE, exY = (ex.ty + 0.5) * TILE;
  if (dist(p.x, p.y, exX, exY) < 32 && p.intel >= sim.m.intelTotal) {
    if (inp.interact) {
      const prev = p.extractT; p.extractT += dt;
      if (Math.floor(p.extractT * 8) !== Math.floor(prev * 8)) Sfx.hackBeep(Math.floor(p.extractT * 8) % 5, 0, 0.5);
      if (p.extractT >= 0.9) winMission(sim);
    } else p.extractT = Math.max(0, p.extractT - dt * 2);
  } else p.extractT = 0;
}

function currentTarget(sim) {
  const p = sim.player; let best = null, bd = 1e9;
  const consider = (x, y, type, o, radius, pad) => {
    const d = dist(p.x, p.y, x, y) + pad;
    if (d < radius && d < bd) { bd = d; best = { type, o, x, y }; }
  };
  for (const L of sim.loot) if (!L.taken) consider(L.x, L.y, 'loot', L, 32, 0);
  for (const T of sim.terminals) if (!T.used) consider(T.x, T.y + 10, 'term', T, 44, 0);
  for (const dr of sim.doors) consider(dr.cx, dr.cy, 'door', dr, 46, 6);
  const ex = sim.m.extract;
  consider((ex.tx + 0.5) * TILE, (ex.ty + 0.5) * TILE, 'extract', null, 32, 8);
  return best;
}

function handleInteraction(sim, dt, inp) {
  const p = sim.player;
  const tgt = currentTarget(sim);
  p.target = tgt;
  const iDown = !!inp.interact;
  const rising = iDown && !p.prevInteract;
  if (rising && tgt && tgt.type === 'loot') {
    tgt.o.taken = true;
    emitSound(sim, tgt.x, tgt.y, 55, 'pickup');
    if (tgt.o.type === 'intel') { p.intel++; Sfx.pickupIntel(0); toast(sim, 'INTEL SECURED (' + p.intel + '/' + sim.m.intelTotal + ')', 'good'); }
    else { p.val++; Sfx.pickupVal(0); toast(sim, 'VALUABLE POCKETED', ''); }
  }
  if (rising && tgt && tgt.type === 'door') {
    const dr = tgt.o;
    const elecOpen = dr.elec && (dr.empT > 0 || sim.sysOffline);
    if (!dr.locked || elecOpen) {
      const opening = dr.open < 0.5;
      dr.target = opening ? 1 : 0; dr.autoT = 2.2;
      emitSound(sim, dr.cx, dr.cy, 95, 'door');
      Sfx.door(opening, panOf(sim, dr.cx, dr.cy), 1);
    } else Sfx.locked(panOf(sim, dr.cx, dr.cy), 1);
  }
  let hold = null;
  if (tgt && tgt.type === 'door') {
    const dr = tgt.o, elecOpen = dr.elec && (dr.empT > 0 || sim.sysOffline);
    if (dr.locked && !elecOpen) hold = { type: 'pick', o: dr, need: 2.2 };
  } else if (tgt && tgt.type === 'term') hold = { type: 'hack', o: tgt.o, need: 2.6 };
  if (hold && iDown) {
    if (!p.act || p.act.type !== hold.type || p.act.o !== hold.o) p.act = { type: hold.type, o: hold.o, t: 0, need: hold.need, tick: 0.01 };
    p.act.t += dt; p.act.tick -= dt;
    if (p.act.tick <= 0) {
      if (hold.type === 'pick') {
        p.act.tick = 0.5; const k = Math.floor(p.act.t / 0.5);
        Sfx.pickClick(k, panOf(sim, hold.o.cx, hold.o.cy), 1);
        emitSound(sim, hold.o.cx, hold.o.cy, 60, 'pick');
      } else {
        p.act.tick = 0.4; const k = Math.floor(p.act.t / 0.4);
        Sfx.hackBeep(k % 5, panOf(sim, hold.o.x, hold.o.y), 1);
        emitSound(sim, hold.o.x, hold.o.y, 45, 'hack');
      }
    }
    if (p.act.t >= hold.need) {
      if (hold.type === 'pick') { hold.o.locked = false; Sfx.unlock(panOf(sim, hold.o.cx, hold.o.cy), 1); toast(sim, 'LOCK PICKED', 'good'); }
      else { hold.o.used = true; hackTerminal(sim, hold.o); }
      p.act = null;
    }
  } else p.act = null;
  p.prevInteract = iDown;
}

function hackTerminal(sim, T) {
  sim.sysOffline = true;
  for (const dr of sim.doors) if (dr.elec && dr.locked) dr.locked = false;
  for (const c of sim.cameras) c.sus = 0;
  Sfx.hackDone(panOf(sim, T.x, T.y));
  toast(sim, 'SECURITY GRID OFFLINE — E-LOCKS RELEASED', 'good');
}

function useGadget(sim) {
  const p = sim.player, slot = p.gadgets[p.sel], def = GADGETS[p.sel];
  if (slot.count <= 0 || slot.cd > 0) { Sfx.deny(); return; }
  slot.count--; slot.cd = def.cd;
  const ax = p.aimX != null ? p.aimX : p.x + Math.cos(p.angle) * 120;
  const ay = p.aimY != null ? p.aimY : p.y + Math.sin(p.angle) * 120;
  if (def.key === 'emp') {
    Sfx.zap(); emitSound(sim, p.x, p.y, 85, 'emp');
    for (const c of sim.cameras) if (dist(c.x, c.y, p.x, p.y) < 190) c.disT = 9;
    for (const dr of sim.doors) if (dr.elec && dist(dr.cx, dr.cy, p.x, p.y) < 190) dr.empT = 9;
    sim.empFx = { x: p.x, y: p.y, age: 0 };
  } else {
    const d = Math.min(272, dist(p.x, p.y, ax, ay));
    const ang = Math.atan2(ay - p.y, ax - p.x);
    sim.projectiles.push({ sx: p.x, sy: p.y, ang, dist: d, trav: 0, key: def.key, x: p.x, y: p.y, spin: 0 });
    Sfx.noise({ dur: 0.08, freq: 500, vol: 0.1, type: 'highpass' });
  }
}

function updateProjectiles(sim, dt) {
  for (let i = sim.projectiles.length - 1; i >= 0; i--) {
    const pr = sim.projectiles[i];
    pr.trav += 380 * dt; pr.spin += dt * 12;
    pr.x = pr.sx + Math.cos(pr.ang) * Math.min(pr.trav, pr.dist);
    pr.y = pr.sy + Math.sin(pr.ang) * Math.min(pr.trav, pr.dist);
    if (pr.trav >= pr.dist) {
      sim.projectiles.splice(i, 1);
      if (pr.key === 'noise') {
        sim.emitters.push({ x: pr.x, y: pr.y, until: sim.time + 6, next: 0.05 });
      } else if (pr.key === 'smoke') {
        sim.smokes.push({ x: pr.x, y: pr.y, r: 4, full: 58, age: 0, life: 9 });
        Sfx.smoke(0);
        emitSound(sim, pr.x, pr.y, 80, 'smoke');
      }
    }
  }
}

function updateEmitters(sim, dt) {
  for (let i = sim.emitters.length - 1; i >= 0; i--) {
    const e = sim.emitters[i]; e.next -= dt;
    if (e.next <= 0) {
      e.next = 0.8;
      emitSound(sim, e.x, e.y, 240, 'noise');
      Sfx.coinBeep(panOf(sim, e.x, e.y), volOf(sim, e.x, e.y) * 1.4);
    }
    if (sim.time > e.until) sim.emitters.splice(i, 1);
  }
}

function updateDoors(sim, dt) {
  const p = sim.player;
  for (const dr of sim.doors) {
    dr.empT = Math.max(0, dr.empT - dt);
    dr.open += clamp(dr.target - dr.open, -dt * 2.6, dt * 2.6);
    const overlapEnt = ent => Math.abs(ent.x - dr.cx) < TILE * 0.8 && Math.abs(ent.y - dr.cy) < TILE * 0.8;
    let blocker = overlapEnt(p);
    if (!blocker) for (const g of sim.guards) if (overlapEnt(g)) { blocker = true; break; }
    if (dr.target > 0.5 && dr.open > 0.05) {
      if (blocker) dr.autoT = 2.2;
      else { dr.autoT -= dt; if (dr.autoT <= 0) dr.target = 0; }
    }
    if (dr.target < 0.5 && blocker && dr.open > 0.1) dr.target = 1; // never crush
  }
}

function updateSmokes(sim, dt) {
  for (let i = sim.smokes.length - 1; i >= 0; i--) {
    const s = sim.smokes[i]; s.age += dt;
    const t = Math.min(1, s.age / 0.7);
    s.r = s.full * (1 - Math.pow(1 - t, 3));
    if (s.age > s.life) sim.smokes.splice(i, 1);
  }
  if (sim.empFx) { sim.empFx.age += dt; if (sim.empFx.age > 0.6) sim.empFx = null; }
}

/* ---------------- cameras ---------------- */
function updateCameras(sim, dt) {
  const p = sim.player, D = sim.diff;
  for (const c of sim.cameras) {
    if (c.disT > 0) { c.disT -= dt; c.on = false; } else c.on = !sim.sysOffline;
    if (!c.on) { c.sus = Math.max(0, c.sus - 0.5 * dt); continue; }
    c.phase += dt * c.speed;
    c.ang = c.base + Math.sin(c.phase) * c.arc;
    const d = dist(c.x, c.y, p.x, p.y);
    let seen = false;
    if (sim.state === 'play' && d < c.range) {
      const aTo = Math.atan2(p.y - c.y, p.x - c.x);
      if (Math.abs(angNorm(aTo - c.ang)) < c.arc + 0.06) {
        const hit = castRay(sim, c.x, c.y, aTo, d + 2, { mode: 'sight' });
        if (!hit.hit || hit.d >= d - 2) seen = true;
      }
    }
    if (seen) {
      const prox = 1 - d / c.range;
      c.sus += dt * (0.62 * D.sus) * (0.4 + 0.6 * prox) * (0.55 + 0.6 * p.light) * (p.inRestricted ? 1.35 : 1);
      if (!c.beeped && c.sus > 0.3) { c.beeped = true; Sfx.camTick(panOf(sim, c.x, c.y), volOf(sim, c.x, c.y)); }
      if (c.sus >= 1) {
        if (sim.alarmCd <= 0) { sim.detections++; c.sus = 0.4; raiseAlarm(sim, p.x, p.y); }
        else c.sus = 0.85;
      }
    } else { c.sus = Math.max(0, c.sus - 0.3 * dt); c.beeped = c.sus > 0.3; }
  }
}

/* ---------------- guards ---------------- */
function faceTo(g, x, y, t) { g.angle = angLerp(g.angle, Math.atan2(y - g.y, x - g.x), clamp(t, 0, 1)); }
function scanLook(sim, g, dt, rate) { g.angle += Math.sin(sim.time * 1.35 + g.id * 2.17) * rate * dt; }

function followPath(sim, g, dt, speed) {
  if (!g.path || g.pi >= g.path.length) return true;
  const n = g.path[g.pi];
  const ti = tileI(sim, n.x, n.y);
  const dr = sim.doorAt.get(ti);
  if (dr && dr.open < 0.75) {
    const elecOpen = dr.elec && (dr.empT > 0 || sim.sysOffline);
    if (!dr.locked || elecOpen) { dr.target = 1; return false; }
    // locked door ahead: path is stale, force repath
    g.path = null; g.repathT = 0; return false;
  }
  const d = dist(g.x, g.y, n.x, n.y);
  if (d < 7) { g.pi++; return g.pi >= g.path.length; }
  const a = Math.atan2(n.y - g.y, n.x - g.x);
  g.angle = angLerp(g.angle, a, Math.min(1, dt * 9));
  const ox = g.x, oy = g.y;
  moveCircle(sim, g, Math.cos(a) * speed * dt, Math.sin(a) * speed * dt);
  const moved = dist(ox, oy, g.x, g.y);
  if (moved < speed * dt * 0.25) {
    g.stuckT += dt;
    if (g.stuckT > 1.1) { g.stuckT = 0; g.path = null; g.repathT = 0; }
  } else g.stuckT = 0;
  return false;
}

function setPathTo(sim, g, x, y, throttle) {
  if (g.repathT <= 0) {
    g.repathT = throttle;
    g.path = findPath(sim, g.x, g.y, x, y, true);
    g.pi = 0;
  }
}

function triggerAlert(sim, g) {
  if (g.state === 'ALERT') return;
  g.sus = 1; g.state = 'ALERT'; g.reactT = sim.diff.react; g.path = null;
  if (g.detCd <= 0) { sim.detections++; g.detCd = 4; }
  sim.spottedT = 1.4;
  Sfx.alertS(panOf(sim, g.x, g.y), volOf(sim, g.x, g.y));
  broadcast(sim, g);
}

function broadcast(sim, from) {
  const range = sim.alarmT > 0 ? 1e9 : 430;
  for (const o of sim.guards) {
    if (o === from || o.state === 'ALERT') continue;
    if (sim.alarmT > 0 || dist(o.x, o.y, from.x, from.y) < range) {
      if (from.lkp) { o.poi = { x: from.lkp.x, y: from.lkp.y }; o.state = 'INVESTIGATE'; o.path = null; o.sus = Math.max(o.sus, 0.7); o.delayT = 0.3; }
    }
  }
}

function raiseAlarm(sim, x, y) {
  sim.alarmT = 24; sim.alarmCd = 6; sim.alarmCount++;
  Sfx.alarmOn();
  toast(sim, 'ALARM TRIGGERED', 'bad');
  for (const g of sim.guards) {
    if (g.state !== 'ALERT') {
      g.poi = { x, y }; g.lkp = { x, y }; g.lkpAge = 0;
      g.state = 'INVESTIGATE'; g.path = null; g.sus = Math.max(g.sus, 0.8); g.delayT = 0.2;
    }
  }
}

function alarmShare(sim, dt) {
  sim.shareT -= dt;
  if (sim.alarmT > 0 && sim.shareT <= 0) {
    sim.shareT = 3;
    let best = null;
    for (const g of sim.guards) if (g.lkp && (!best || g.lkpAge < best.lkpAge)) best = g;
    if (best) for (const g of sim.guards) if (g.state !== 'ALERT') { g.poi = { x: best.lkp.x, y: best.lkp.y }; g.state = 'INVESTIGATE'; g.path = null; }
  }
}

function capture(sim, g) {
  sim.state = 'lost'; sim.caughtBy = g.id;
  Sfx.caught(); Sfx.alarmOff();
}

function winMission(sim) {
  sim.state = 'won';
  Sfx.win(); Sfx.alarmOff();
}

function updateGuard(sim, g, dt) {
  const p = sim.player, D = sim.diff;
  g.detCd = Math.max(0, g.detCd - dt);
  g.repathT = Math.max(0, g.repathT - dt);
  g.lkpAge += dt; g.lostT += dt;
  if (g.delayT > 0) {
    g.delayT -= dt;
    if (g.poi) faceTo(g, g.poi.x, g.poi.y, dt * 6);
    return;
  }
  /* --- vision --- */
  let vis = false, vd = 0;
  const d = dist(g.x, g.y, p.x, p.y);
  if (sim.state === 'play' && d < g.viewDist) {
    const aTo = Math.atan2(p.y - g.y, p.x - g.x);
    if (Math.abs(angNorm(aTo - g.angle)) < g.fov / 2 + (d < 30 ? 0.8 : 0)) {
      const hit = castRay(sim, g.x, g.y, aTo, d + 2, { mode: 'sight' });
      if (!hit.hit || hit.d >= d - 2) { vis = true; vd = d; }
    }
  }
  g.visPlayer = vis;
  if (vis) {
    g.lostT = 0; g.lkp = { x: p.x, y: p.y }; g.lkpAge = 0;
    const prox = 1 - vd / g.viewDist;
    let rate = 0.95 * D.sus * (0.3 + 0.7 * prox);
    rate *= (0.5 + 0.65 * p.light);
    if (p.inRestricted) rate *= 1.5;
    if (p.running) rate *= 1.3;
    if (vd < 46) rate *= 2.4;
    g.sus += rate * dt;
    if (g.sus >= 1) triggerAlert(sim, g);
    else if (g.sus > 0.15 && g.state !== 'ALERT' && g.state !== 'SUSPICIOUS') {
      g.state = 'SUSPICIOUS'; g.path = null;
      Sfx.sus(panOf(sim, g.x, g.y), volOf(sim, g.x, g.y));
    }
  } else {
    g.sus = Math.max(0, g.sus - (g.state === 'ALERT' ? 0.04 : 0.11) * dt);
  }
  switch (g.state) {
    case 'PATROL': {
      const wp = g.route[g.ri];
      if (!g.path) { g.path = findPath(sim, g.x, g.y, wp.x, wp.y, true); g.pi = 0; if (!g.path) { g.ri = (g.ri + 1) % g.route.length; break; } }
      if (followPath(sim, g, dt, g.walk)) { g.state = 'WAIT'; g.waitT = 0.9 + sim.rng.f(0, 1.5); g.path = null; }
      break;
    }
    case 'WAIT':
      g.waitT -= dt; scanLook(sim, g, dt, 1.15);
      if (g.waitT <= 0) { g.ri = (g.ri + 1) % g.route.length; g.state = 'PATROL'; g.path = null; }
      break;
    case 'SUSPICIOUS':
      if (vis) {
        faceTo(g, p.x, p.y, dt * 8);
        if (vd > 70) { setPathTo(sim, g, p.x, p.y, 0.5); if (g.path) followPath(sim, g, dt, 46); }
      }
      if (!vis && g.lostT > 1.3) { g.state = 'INVESTIGATE'; g.poi = g.lkp ? { x: g.lkp.x, y: g.lkp.y } : null; g.path = null; g.delayT = 0.25; }
      else if (!vis && g.sus <= 0.02) { g.state = 'PATROL'; g.path = null; }
      break;
    case 'INVESTIGATE': {
      if (g.poi) {
        if (!g.path) setPathTo(sim, g, g.poi.x, g.poi.y, 0.8);
        if (g.path && followPath(sim, g, dt, 74)) { g.state = 'LOOK'; g.waitT = 2.0 + sim.rng.f(0, 1.6); g.path = null; }
        else if (!g.path && g.repathT <= 0) { g.state = 'LOOK'; g.waitT = 1.6; }
      } else { g.state = 'LOOK'; g.waitT = 1.5; }
      break;
    }
    case 'LOOK':
      g.waitT -= dt; scanLook(sim, g, dt, 1.5);
      if (g.waitT <= 0) { g.state = 'RETURN'; g.path = null; }
      break;
    case 'ALERT': {
      if (g.reactT > 0) { g.reactT -= dt; faceTo(g, g.lkp ? g.lkp.x : p.x, g.lkp ? g.lkp.y : p.y, dt * 10); break; }
      if (vis) {
        g.lostT = 0;
        setPathTo(sim, g, p.x, p.y, 0.4);
        if (g.path) followPath(sim, g, dt, g.run);
      } else {
        const tgt = g.lkp || { x: p.x, y: p.y };
        if (!g.path) setPathTo(sim, g, tgt.x, tgt.y, 0.6);
        const arr = g.path ? followPath(sim, g, dt, g.run) : true;
        if ((arr && g.lostT > 1.5) || g.lostT > 8) { g.state = 'SEARCH'; g.searchT = 7 + sim.rng.f(0, 3); g.path = null; }
      }
      if (sim.state === 'play' && ((vis && vd < 22) || d < 12)) capture(sim, g);
      break;
    }
    case 'SEARCH': {
      g.searchT -= dt;
      if (g.searchT <= 0) { g.state = 'RETURN'; g.path = null; break; }
      if (!g.path) {
        const base = g.lkp || g.poi || { x: g.x, y: g.y };
        for (let t = 0; t < 10; t++) {
          const a = sim.rng.f(TAU), rr = sim.rng.f(1.5, 6) * TILE;
          const nx = base.x + Math.cos(a) * rr, ny = base.y + Math.sin(a) * rr;
          const ti = tileI(sim, nx, ny);
          if (sim.m.grid[ti] === 1 && !sim.m.propSolid[ti]) {
            const pa = findPath(sim, g.x, g.y, nx, ny, true);
            if (pa) { g.path = pa; g.pi = 0; break; }
          }
        }
      }
      if (g.path && followPath(sim, g, dt, 70)) g.path = null;
      scanLook(sim, g, dt, 1.2);
      break;
    }
    case 'RETURN': {
      const wp = g.route[g.ri];
      if (!g.path) setPathTo(sim, g, wp.x, wp.y, 0.8);
      if (g.path && followPath(sim, g, dt, g.walk)) { g.state = 'PATROL'; g.path = null; }
      else if (!g.path && g.repathT <= 0) { g.state = 'PATROL'; }
      break;
    }
  }
  if (sim.state === 'play' && g.state !== 'ALERT' && vis && vd < 16) capture(sim, g);
}

function separation(sim) {
  for (let i = 0; i < sim.guards.length; i++) for (let j = i + 1; j < sim.guards.length; j++) {
    const a = sim.guards[i], b = sim.guards[j];
    const d = dist(a.x, a.y, b.x, b.y);
    if (d < 18 && d > 0.01) {
      const push = (18 - d) / 2, ax = (a.x - b.x) / d, ay = (a.y - b.y) / d;
      a.x += ax * push * 0.5; a.y += ay * push * 0.5;
      b.x -= ax * push * 0.5; b.y -= ay * push * 0.5;
    }
  }
}

function computeAlert(sim) {
  let a = 0;
  if (sim.alarmT > 0) a = 3;
  else {
    for (const g of sim.guards) {
      if (g.state === 'ALERT') a = Math.max(a, 2);
      else if (g.state === 'INVESTIGATE' || g.state === 'SEARCH') a = Math.max(a, 1.5);
      else if (g.state === 'SUSPICIOUS' || g.sus > 0.15) a = Math.max(a, 0.8);
    }
    for (const c of sim.cameras) if (c.sus > 0.15) a = Math.max(a, 0.8);
  }
  sim.alert = a;
}

/* ---------------- tick ---------------- */
function simTick(sim, dt, inp) {
  if (sim.state !== 'play') return;
  sim.time += dt;
  const wasAlarm = sim.alarmT > 0;
  sim.alarmT = Math.max(0, sim.alarmT - dt);
  sim.alarmCd = Math.max(0, sim.alarmCd - dt);
  sim.spottedT = Math.max(0, sim.spottedT - dt);
  if (wasAlarm && sim.alarmT <= 0) { Sfx.alarmOff(); toast(sim, 'alarm faded — patrols resetting', ''); }
  for (const slot of sim.player.gadgets) slot.cd = Math.max(0, slot.cd - dt);
  updatePlayer(sim, dt, inp);
  updateProjectiles(sim, dt);
  updateEmitters(sim, dt);
  updateDoors(sim, dt);
  updateSmokes(sim, dt);
  for (let i = sim.sounds.length - 1; i >= 0; i--) { const s = sim.sounds[i]; s.age += dt; if (s.age > s.life) sim.sounds.splice(i, 1); }
  updateCameras(sim, dt);
  for (const g of sim.guards) updateGuard(sim, g, dt);
  separation(sim);
  alarmShare(sim, dt);
  computeAlert(sim);
}
