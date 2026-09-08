
/* =====================================================================
   MISSION DATA + PROCEDURAL GENERATION
   ===================================================================== */
const TILE = 32;
const PRESETS = {
  compact: { key: 'compact', name: 'PENTHOUSE JOB', w: 46, h: 34, rooms: [5, 6], guards: [2, 3], cameras: [1, 1], intel: [1, 1], valuables: [2, 3], terminals: [1, 1], locked: [1, 2], desc: 'A tight penthouse suite. One drive, a couple of patrols, quick in and out. Good first job — and a fast one.' },
  gallery: { key: 'gallery', name: 'THE GALLERY', w: 58, h: 42, rooms: [8, 10], guards: [5, 6], cameras: [3, 4], intel: [2, 2], valuables: [3, 5], terminals: [1, 2], locked: [2, 3], desc: 'Museum wings patrolled around the clock. Cameras sweep the halls; the good stuff is behind locked doors.' },
  vault: { key: 'vault', name: 'DATA VAULT', w: 66, h: 46, rooms: [10, 13], guards: [7, 9], cameras: [4, 5], intel: [3, 3], valuables: [4, 6], terminals: [2, 2], locked: [3, 5], desc: 'Deep in the corporate block. Heavy patrols, layered security, three drives to pull. Bring a plan.' },
  freestyle: { key: 'freestyle', name: 'FREESTYLE', w: 56, h: 40, rooms: [6, 11], guards: [4, 8], cameras: [1, 5], intel: [1, 3], valuables: [2, 6], terminals: [1, 2], locked: [1, 4], desc: 'Unpredictable layout and loadout. Every seed is a different job. Improvise.' },
};
const DIFFS = {
  rookie: { key: 'rookie', name: 'ROOKIE', vision: 0.82, fov: 1.12, sus: 0.72, react: 0.55, guards: 0.7, sound: 0.85, charges: 1 },
  operative: { key: 'operative', name: 'OPERATIVE', vision: 1.0, fov: 1.0, sus: 1.0, react: 0.3, guards: 1.0, sound: 1.0, charges: 0 },
  shadow: { key: 'shadow', name: 'SHADOW', vision: 1.22, fov: 0.9, sus: 1.4, react: 0.12, guards: 1.35, sound: 1.18, charges: 0 },
};
const GADGETS = [
  { key: 'noise', name: 'NOISE', icon: '◎', cd: 1.0, desc: ' audible decoy' },
  { key: 'smoke', name: 'SMOKE', icon: '☁', cd: 1.4, desc: ' vision blocker' },
  { key: 'emp', name: 'EMP', icon: '⚡', cd: 3.0, desc: ' kills cams + e-locks' },
];
const CODE_A = ['AMBER', 'VELVET', 'CRYSTAL', 'HOLLOW', 'SILENT', 'CRIMSON', 'GLASS', 'MIDNIGHT', 'PALE', 'IRON', 'FRACTURED', 'GILDED'];
const CODE_B = ['DAWN', 'SPIRE', 'FALCON', 'VESPER', 'MIRAGE', 'LEDGER', 'SERAPH', 'LANTERN', 'HARBOUR', 'ECHO', 'GARDEN', 'MERIDIAN'];

const idx = (W, x, y) => y * W + x;

/* ---------------- generation ---------------- */
function genMission(presetKey, seed, diffKey) {
  const P = PRESETS[presetKey] || PRESETS.compact, D = DIFFS[diffKey] || DIFFS.operative;
  for (let attempt = 0; attempt < 80; attempt++) {
    const rng = new RNG((seed >>> 0) + attempt * 7919);
    const m = tryGen(P, D, rng, presetKey, seed, diffKey);
    if (m) return m;
  }
  throw new Error('mission generation failed for seed ' + seed);
}

function tryGen(P, D, rng, presetKey, seed, diffKey) {
  const W = P.w, H = P.h, N = W * H;
  const grid = new Uint8Array(N);            // 0 wall, 1 floor
  const roomAt = new Int16Array(N).fill(-1);
  const rooms = [];
  /* 1. rooms */
  let tries = 90;
  const wantRooms = rng.i(P.rooms[0], P.rooms[1]);
  while (rooms.length < wantRooms && tries-- > 0) {
    const w = rng.i(6, 12), h = rng.i(5, 9);
    const x = rng.i(2, W - w - 3), y = rng.i(2, H - h - 3);
    let ok = true;
    for (const r of rooms) if (!(x > r.x + r.w + 1 || x + w + 1 < r.x || y > r.y + r.h + 1 || y + h + 1 < r.y)) { ok = false; break; }
    if (!ok) continue;
    const id = rooms.length;
    rooms.push({ id, x, y, w, h, cx: (x + w / 2) * TILE, cy: (y + h / 2) * TILE });
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) { grid[idx(W, xx, yy)] = 1; roomAt[idx(W, xx, yy)] = id; }
  }
  if (rooms.length < Math.min(4, wantRooms)) return null;

  /* 2. corridors (MST + a loop edge) */
  const carve = (x, y) => { if (x > 0 && y > 0 && x < W - 1 && y < H - 1) grid[idx(W, x, y)] = 1; };
  const carveCorr = (a, b) => {
    let ax = Math.round(a.cx / TILE), ay = Math.round(a.cy / TILE), bx = Math.round(b.cx / TILE), by = Math.round(b.cy / TILE);
    const hFirst = rng.chance(0.5);
    const runH = () => { while (ax !== bx) { carve(ax, ay); carve(ax, ay + 1); ax += bx > ax ? 1 : -1; } };
    const runV = () => { while (ay !== by) { carve(ax, ay); carve(ax + 1, ay); ay += by > ay ? 1 : -1; } };
    if (hFirst) { runH(); runV(); } else { runV(); runH(); }
    carve(ax, ay); carve(ax, ay + 1); carve(ax + 1, ay); carve(ax + 1, ay + 1);
  };
  const connected = [0], rest = rooms.map(r => r.id).filter(i => i !== 0);
  while (rest.length) {
    let bi = -1, bj = -1, bd = 1e18;
    for (const a of connected) for (let k = 0; k < rest.length; k++) {
      const d = dist2(rooms[a].cx, rooms[a].cy, rooms[rest[k]].cx, rooms[rest[k]].cy);
      if (d < bd) { bd = d; bi = a; bj = k; }
    }
    carveCorr(rooms[bi], rooms[rest[bj]]); connected.push(rest[bj]); rest.splice(bj, 1);
  }
  for (let e = 0; e < rng.i(1, 2); e++) carveCorr(rooms[rng.i(0, rooms.length - 1)], rooms[rng.i(0, rooms.length - 1)]);

  /* 3. doors: threshold tiles between corridor and room */
  const isDoorTile = new Uint8Array(N);
  const doors = [];
  const cands = [];
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = idx(W, x, y);
    if (grid[i] !== 1 || roomAt[i] !== -1) continue;
    const nT = roomAt[i - W], sT = roomAt[i + W], wT = roomAt[i - 1], eT = roomAt[i + 1];
    const f = t => grid[t] === 1;
    let room = -1, axis = '';
    if (f(i - W) && f(i + W) && !f(i - 1) && !f(i + 1)) { axis = 'h'; room = (nT >= 0 ? nT : sT); }
    else if (f(i - 1) && f(i + 1) && !f(i - W) && !f(i + W)) { axis = 'v'; room = (wT >= 0 ? wT : eT); }
    else {
      // 2-wide passage: room on one side, corridor opposite, exactly one wall perpendicular
      if (wT >= 0 && f(i + 1) && roomAt[i + 1] === -1) { const wallN = !f(i - W), wallS = !f(i + W); if (wallN !== wallS && (f(i - W) || f(i + W))) { axis = 'v'; room = wT; } }
      else if (eT >= 0 && f(i - 1) && roomAt[i - 1] === -1) { const wallN = !f(i - W), wallS = !f(i + W); if (wallN !== wallS && (f(i - W) || f(i + W))) { axis = 'v'; room = eT; } }
      else if (nT >= 0 && f(i + W) && roomAt[i + W] === -1) { const wallW = !f(i - 1), wallE = !f(i + 1); if (wallW !== wallE && (f(i - 1) || f(i + 1))) { axis = 'h'; room = nT; } }
      else if (sT >= 0 && f(i - W) && roomAt[i - W] === -1) { const wallW = !f(i - 1), wallE = !f(i + 1); if (wallW !== wallE && (f(i - 1) || f(i + 1))) { axis = 'h'; room = sT; } }
    }
    if (room >= 0 && axis) cands.push({ x, y, i, axis, room });
  }
  cands.sort((a, b) => a.axis === b.axis ? (a.y - b.y || a.x - b.x) : a.axis < b.axis ? -1 : 1);
  const used = new Uint8Array(N);
  for (const c of cands) {
    if (used[c.i]) continue;
    const group = [c]; used[c.i] = 1;
    if (c.axis === 'h') { // grow along x
      for (let g = c.x + 1; g < W - 1; g++) { const t = cands.find(q => !used[q.i] && q.axis === 'h' && q.y === c.y && q.x === g && q.room === c.room); if (!t) break; used[t.i] = 1; group.push(t); }
      for (let g = c.x - 1; g > 0; g--) { const t = cands.find(q => !used[q.i] && q.axis === 'h' && q.y === c.y && q.x === g && q.room === c.room); if (!t) break; used[t.i] = 1; group.unshift(t); }
    } else {
      for (let g = c.y + 1; g < H - 1; g++) { const t = cands.find(q => !used[q.i] && q.axis === 'v' && q.x === c.x && q.y === g && q.room === c.room); if (!t) break; used[t.i] = 1; group.push(t); }
      for (let g = c.y - 1; g > 0; g--) { const t = cands.find(q => !used[q.i] && q.axis === 'v' && q.x === c.x && q.y === g && q.room === c.room); if (!t) break; used[t.i] = 1; group.unshift(t); }
    }
    let cx = 0, cy = 0; for (const t of group) { cx += t.x; cy += t.y; }
    doors.push({ id: doors.length, axis: c.axis, room: c.room, tiles: group.map(t => t.i), tx: cx / group.length, ty: cy / group.length });
  }
  const doorTile = new Map(); for (const d of doors) for (const t of d.tiles) doorTile.set(t, d);

  /* 4. entry / extraction rooms (bottom-most / top-most) */
  const byY = rooms.slice().sort((a, b) => a.cy - b.cy);
  const extractRoom = byY[0], entryRoom = byY[byY.length - 1];
  if (entryRoom === extractRoom) return null;

  /* 5. props (crates/pillars block sight, tables don't) */
  const propSolid = new Uint8Array(N), propSight = new Uint8Array(N), propType = new Uint8Array(N);
  const clearProp = (tx, ty) => { if (tx < 0 || ty < 0 || tx >= W || ty >= H) return; const i = idx(W, tx, ty); propSolid[i] = 0; propSight[i] = 0; propType[i] = 0; };
  const nearDoor = (tx, ty) => { for (const d of doors) for (const t of d.tiles) { const dx = t % W, dy = (t / W) | 0; if (Math.abs(dx - tx) <= 1 && Math.abs(dy - ty) <= 1) return true; } return false; };
  for (const r of rooms) {
    const n = rng.i(1, 4);
    for (let k = 0; k < n; k++) {
      const tx = rng.i(r.x + 1, r.x + r.w - 2), ty = rng.i(r.y + 1, r.y + r.h - 2);
      const i = idx(W, tx, ty);
      if (propSolid[i] || nearDoor(tx, ty)) continue;
      const t = rng.pick([1, 1, 2, 3]); // crate, crate, table, pillar
      propType[i] = t; propSolid[i] = 1; if (t !== 2) propSight[i] = 1;
    }
  }

  /* 6. vault rooms + loot */
  const entryD = r => Math.abs(r.cx - entryRoom.cx) + Math.abs(r.cy - entryRoom.cy);
  const candRooms = rooms.filter(r => r !== entryRoom && r !== extractRoom).sort((a, b) => entryD(b) - entryD(a)); // farthest first
  const nIntel = rng.i(P.intel[0], P.intel[1]);
  const vaultRooms = candRooms.slice(0, Math.min(nIntel, candRooms.length));
  const vaultSet = new Set(vaultRooms.map(r => r.id));
  const restricted = new Set(vaultSet);
  const freeTile = (r) => {
    for (let t = 0; t < 30; t++) {
      const tx = rng.i(r.x + 1, r.x + r.w - 2), ty = rng.i(r.y + 1, r.y + r.h - 2), i = idx(W, tx, ty);
      if (!propSolid[i] && !doorTile.has(i)) return { tx, ty };
    }
    return null;
  };
  const loot = [];
  for (const r of vaultRooms) {
    const p = freeTile(r); if (!p) return null;
    loot.push({ id: loot.length, type: 'intel', tx: p.tx, ty: p.ty });
  }
  const nVal = rng.i(P.valuables[0], P.valuables[1]);
  const otherRooms = rooms.filter(r => r !== entryRoom && !vaultSet.has(r.id));
  for (let k = 0; k < nVal; k++) {
    const r = rng.pick(otherRooms); const p = freeTile(r); if (!p) continue;
    loot.push({ id: loot.length, type: 'valuable', tx: p.tx, ty: p.ty });
  }

  /* 7. terminals */
  const terminals = [];
  const termRooms = rng.shuffle(rooms.filter(r => r !== entryRoom && r !== extractRoom)).slice(0, rng.i(P.terminals[0], P.terminals[1]));
  for (const r of termRooms) {
    let placed = null;
    for (let t = 0; t < 40 && !placed; t++) {
      const tx = rng.i(r.x + 1, r.x + r.w - 2), ty = rng.i(r.y + 1, r.y + r.h - 2), i = idx(W, tx, ty);
      if (propSolid[i] || doorTile.has(i)) continue;
      if (grid[i - W] === 0) placed = { tx, ty }; // against north wall
    }
    if (!placed) { const p = freeTile(r); if (p) placed = p; }
    if (placed) { terminals.push({ id: terminals.length, tx: placed.tx, ty: placed.ty, used: false }); restricted.add(r.id); clearAround(terminals[terminals.length - 1]); }
  }
  function clearAround(o) { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) clearProp(o.tx + dx, o.ty + dy); }

  /* locks on vault-room doors */
  const nLock = rng.i(P.locked[0], P.locked[1]);
  const vaultDoors = doors.filter(d => vaultSet.has(d.room));
  const shuffledVd = rng.shuffle(vaultDoors.slice());
  const lockSet = new Set(shuffledVd.slice(0, Math.max(1, Math.min(nLock, vaultDoors.length))).map(d => d.id));
  for (const d of doors) { if (lockSet.has(d.id)) { d.locked = true; d.elec = rng.chance(0.5); } else { d.locked = false; d.elec = false; } }

  /* 8. spawns */
  const spawnOf = (r, preferY) => {
    for (let t = 0; t < 60; t++) {
      const tx = rng.i(r.x + 1, r.x + r.w - 2);
      const ty = preferY === 'max' ? r.y + r.h - 2 : r.y + 1;
      const i = idx(W, tx, ty);
      if (!propSolid[i] && !doorTile.has(i)) return { tx, ty };
    }
    return { tx: Math.round(r.cx / TILE), ty: Math.round(r.cy / TILE) };
  };
  const entry = spawnOf(entryRoom, 'max'), extract = spawnOf(extractRoom, 'min');
  clearAround(entry); clearAround(extract);
  restricted.delete(entryRoom.id); restricted.delete(extractRoom.id);

  /* 9. cameras */
  const cameras = [];
  const camRooms = [];
  const prefCams = rooms.filter(r => restricted.has(r.id) || vaultSet.has(r.id));
  camRooms.push(...prefCams);
  const restRooms = rng.shuffle(rooms.filter(r => !camRooms.includes(r)));
  while (camRooms.length < Math.max(2, P.cameras[1]) && restRooms.length) camRooms.push(restRooms.pop());
  const nCam = Math.max(1, Math.min(rng.i(P.cameras[0], P.cameras[1]), camRooms.length));
  for (let k = 0; k < nCam; k++) {
    const r = camRooms[k % camRooms.length];
    let placed = null;
    const spots = [];
    for (let ty = r.y; ty < r.y + r.h; ty++) for (let tx = r.x; tx < r.x + r.w; tx++) {
      const i = idx(W, tx, ty);
      if (grid[i] !== 1 || propSolid[i] || doorTile.has(i)) continue;
      let wall = '', open = '';
      if (grid[i - W] === 0) { wall = 'n'; open = 's'; } else if (grid[i + W] === 0) { wall = 's'; open = 'n'; }
      else if (grid[i - 1] === 0) { wall = 'w'; open = 'e'; } else if (grid[i + 1] === 0) { wall = 'e'; open = 'w'; }
      if (wall) spots.push({ tx, ty, wall, open });
    }
    if (!spots.length) continue;
    placed = rng.pick(spots);
    const ang = { n: Math.PI / 2, s: -Math.PI / 2, w: 0, e: Math.PI }[placed.wall];
    cameras.push({ id: cameras.length, tx: placed.tx, ty: placed.ty, base: ang, arc: 0.62, speed: rng.f(0.5, 0.85), phase: rng.f(TAU), range: 205 });
  }
  if (!cameras.length) return null;

  /* 10. lamps */
  const lamps = [];
  for (const r of rooms) {
    if (rng.chance(0.55)) {
      const n = r.w * r.h > 60 ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const p = freeTile(r); if (!p) continue;
        lamps.push({ tx: p.tx, ty: p.ty, r: 118, int: 0.75, col: 'warm', flick: rng.f(0, TAU) });
      }
    }
  }
  lamps.push({ tx: extract.tx, ty: extract.ty, r: 95, int: 0.6, col: 'green', flick: 0 });
  lamps.push({ tx: entry.tx, ty: entry.ty, r: 85, int: 0.5, col: 'blue', flick: 0 });

  /* floor shade variation (render-only but seeded for determinism of screenshots) */
  const shade = new Uint8Array(N);
  for (let i = 0; i < N; i++) shade[i] = rng.i(0, 255);

  /* 11. guards + patrol routes (never through locked doors, never into the entry room) */
  const patrolRooms = rooms.filter(r => !vaultSet.has(r.id) && r !== entryRoom);
  const guards = [];
  const nGuard = Math.max(2, Math.round(rng.i(P.guards[0], P.guards[1]) * D.guards));
  for (let g = 0; g < nGuard; g++) {
    let route = null;
    for (let t = 0; t < 12 && !route; t++) {
      const k = rng.i(2, Math.min(4, patrolRooms.length));
      const rs = rng.shuffle(patrolRooms.slice()).slice(0, k);
      route = rs.map(r => { const p = freeTile(r); return p ? { tx: p.tx, ty: p.ty } : null; }).filter(Boolean);
      if (route.length < 2) route = null;
    }
    if (!route) return null;
    const start = route[0];
    guards.push({ id: g, route });
    clearAround(start);
  }

  /* 12. validation: unlocked-reachable flood fill from entry */
  const solidMove = i => grid[i] === 0 || propSolid[i] || (doorTile.has(i) && doorTile.get(i).locked);
  const seen = new Uint8Array(N);
  const q = [idx(W, entry.tx, entry.ty)]; seen[q[0]] = 1;
  while (q.length) {
    const i = q.pop(), x = i % W, y = (i / W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = idx(W, nx, ny);
      if (seen[j] || solidMove(j)) continue;
      seen[j] = 1; q.push(j);
    }
  }
  const reach = i => seen[i] === 1;
  if (!reach(idx(W, extract.tx, extract.ty))) return null;
  for (const L of loot) if (!reach(idx(W, L.tx, L.ty))) return null;
  for (const T of terminals) if (!reach(idx(W, T.tx, T.ty))) return null;
  for (const g of guards) { for (const p of g.route) if (!reach(idx(W, p.tx, p.ty))) return null; if (!reach(idx(W, g.route[0].tx, g.route[0].ty))) return null; }

  const rngName = new RNG(seed ^ 0x5f3759df);
  return {
    kind: 'heist-mission', v: 1, preset: presetKey, seed: seed >>> 0, diff: diffKey,
    name: PRESETS[presetKey].name, codename: rngName.pick(CODE_A) + ' ' + rngName.pick(CODE_B),
    W, H, grid, roomAt, rooms, doors, propSolid, propSight, propType, shade,
    loot, terminals, cameras, guards, lamps, entry, extract,
    restricted, intelTotal: nIntel, valTotal: loot.filter(l => l.type === 'valuable').length,
  };
}

/* =====================================================================
   RAYCASTING / LOS / PATHFINDING
   ===================================================================== */
function makeSolidFn(m, doorOpenFn) {
  // returns fn(i) for sight-blocking; doorOpenFn(i)->open amount or -1
  return function (i) {
    if (m.grid[i] === 0) return true;
    if (m.propSight[i]) return true;
    const o = doorOpenFn(i);
    return o >= 0 && o < 0.4;
  };
}

/* Cast a ray; returns {d, x, y, hit}. opt.mode: 'sight' (walls+closed doors+tall props+smoke) or 'move' (walls+closed doors+all props) */
function castRay(sim, x, y, ang, maxD, opt) {
  const mode = (opt && opt.mode) || 'sight';
  const dx = Math.cos(ang), dy = Math.sin(ang);
  let tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
  const stepX = dx > 0 ? 1 : -1, stepY = dy > 0 ? 1 : -1;
  const tdx = dx !== 0 ? Math.abs(TILE / dx) : 1e30, tdy = dy !== 0 ? Math.abs(TILE / dy) : 1e30;
  let tmx = dx > 0 ? ((tx + 1) * TILE - x) / dx : dx < 0 ? (tx * TILE - x) / dx : 1e30;
  let tmy = dy > 0 ? ((ty + 1) * TILE - y) / dy : dy < 0 ? (ty * TILE - y) / dy : 1e30;
  const { W, H, m } = sim;
  const smoke = mode === 'sight' ? sim.smokes : null;
  const block = i => {
    if (m.grid[i] === 0) return true;
    if (mode === 'move' ? m.propSolid[i] : m.propSight[i]) return true;
    const d = sim.doorAt.get(i);
    return !!d && d.open < 0.4;
  };
  for (let k = 0; k < 400; k++) {
    let t;
    if (tmx < tmy) { t = tmx; tmx += tdx; tx += stepX; } else { t = tmy; tmy += tdy; ty += stepY; }
    if (t > maxD) return { d: maxD, x: x + dx * maxD, y: y + dy * maxD, hit: false };
    if (tx < 0 || ty < 0 || tx >= W || ty >= H) return { d: t, x: x + dx * t, y: y + dy * t, hit: true };
    const i = ty * W + tx;
    if (block(i)) return { d: t, x: x + dx * t, y: y + dy * t, hit: true };
    if (smoke) for (let s = 0; s < smoke.length; s++) {
      const sm = smoke[s];
      if (dist2(x + dx * t, y + dy * t, sm.x, sm.y) < sm.r * sm.r) return { d: t, x: x + dx * t, y: y + dy * t, hit: true };
    }
  }
  return { d: maxD, x: x + dx * maxD, y: y + dy * maxD, hit: false };
}

function lineOfSight(sim, x0, y0, x1, y1) {
  const d = dist(x0, y0, x1, y1);
  if (d < 1) return true;
  const hit = castRay(sim, x0, y0, Math.atan2(y1 - y0, x1 - x0), d, { mode: 'sight' });
  return !hit.hit || hit.d >= d - 1;
}

/* count sight-blocking boundaries between two points (sound occlusion) */
function occlusion(sim, x0, y0, x1, y1) {
  const d = dist(x0, y0, x1, y1); if (d < 1) return 0;
  const steps = Math.max(1, Math.floor(d / 10));
  const ang = Math.atan2(y1 - y0, x1 - x0), dx = Math.cos(ang), dy = Math.sin(ang);
  let count = 0, lastSolid = false;
  const { W, H, m } = sim;
  for (let s = 1; s <= steps; s++) {
    const px = clamp(Math.floor((x0 + dx * d * s / steps) / TILE), 0, W - 1);
    const py = clamp(Math.floor((y0 + dy * d * s / steps) / TILE), 0, H - 1);
    const i = py * W + px;
    const solid = m.grid[i] === 0 || m.propSight[i] === 1;
    if (solid && !lastSolid) count++;
    lastSolid = solid;
    if (count >= 4) break;
  }
  return count;
}

/* A* on the tile grid. forGuard: locked doors are walls. Returns array of world points. */
function findPath(sim, sx, sy, tx, ty, forGuard) {
  const { W, H, m } = sim;
  let s = idx(W, clamp(Math.floor(sx / TILE), 0, W - 1), clamp(Math.floor(sy / TILE), 0, H - 1));
  let t = idx(W, clamp(Math.floor(tx / TILE), 0, W - 1), clamp(Math.floor(ty / TILE), 0, H - 1));
  const walkable = i => {
    if (m.grid[i] === 0 || m.propSolid[i]) return false;
    const d = sim.doorAt.get(i);
    if (d && d.locked && forGuard) return false;
    return true;
  };
  if (!walkable(t)) { // nudge to nearest walkable neighbor
    const txp = t % W, typ = (t / W) | 0; let found = -1;
    for (let r = 1; r <= 2 && found < 0; r++) for (let dy = -r; dy <= r && found < 0; dy++) for (let dx = -r; dx <= r && found < 0; dx++) {
      const nx = txp + dx, ny = typ + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx; if (walkable(j)) found = j;
    }
    if (found < 0) return null; t = found;
  }
  if (s === t) return [{ x: tx, y: ty }];
  const g = new Float32Array(W * H).fill(Infinity), f = new Float32Array(W * H).fill(Infinity);
  const from = new Int32Array(W * H).fill(-1), closed = new Uint8Array(W * H);
  const h = i => { const x = i % W, y = (i / W) | 0, x2 = t % W, y2 = (t / W) | 0; const ax = Math.abs(x - x2), ay = Math.abs(y - y2); return Math.max(ax, ay) + 0.414 * Math.min(ax, ay); };
  const open = []; // binary heap of [f, i]
  const push = (fi, i) => { open.push({ fi, i }); let c = open.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (open[p].fi <= open[c].fi) break; const tmp = open[p]; open[p] = open[c]; open[c] = tmp; c = p; } };
  const pop = () => { const top = open[0], last = open.pop(); if (open.length) { open[0] = last; let c = 0; for (; ;) { let l = c * 2 + 1, r = l + 1, s2 = c; if (l < open.length && open[l].fi < open[s2].fi) s2 = l; if (r < open.length && open[r].fi < open[s2].fi) s2 = r; if (s2 === c) break; const tmp = open[s2]; open[s2] = open[c]; open[c] = tmp; c = s2; } } return top; };
  g[s] = 0; f[s] = h(s); push(f[s], s);
  const tx2 = t % W, ty2 = (t / W) | 0;
  let iter = 0;
  while (open.length && iter++ < 9000) {
    const cur = pop(); const ci = cur.i;
    if (closed[ci]) continue; closed[ci] = 1;
    if (ci === t) break;
    const cx = ci % W, cy = (ci / W) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const ni = ny * W + nx;
      if (closed[ni] || !walkable(ni)) continue;
      if (dx && dy) { if (!walkable(cy * W + nx) || !walkable(ny * W + cx)) continue; } // no corner cutting
      const cost = (dx && dy) ? 1.414 : 1;
      const ng = g[ci] + cost;
      if (ng < g[ni]) { g[ni] = ng; f[ni] = ng + h(ni); from[ni] = ci; push(f[ni], ni); }
    }
  }
  if (from[t] < 0 && s !== t) return null;
  const path = [];
  let c = t;
  while (c >= 0 && c !== s) { path.push({ x: (c % W) * TILE + TILE / 2, y: (((c / W) | 0)) * TILE + TILE / 2 }); c = from[c]; }
  path.reverse();
  path.push({ x: tx, y: ty });
  /* string-pull smoothing with move-mode LOS */
  const out = []; let a = { x: sx, y: sy }, k = 0;
  while (k < path.length) {
    let j = path.length - 1;
    for (; j > k; j--) {
      const hit = castRay(sim, a.x, a.y, Math.atan2(path[j].y - a.y, path[j].x - a.x), dist(a.x, a.y, path[j].x, path[j].y), { mode: 'move' });
      if (!hit.hit) break;
    }
    out.push(path[j]); a = path[j]; k = j + 1;
  }
  return out.length ? out : [{ x: tx, y: ty }];
}
