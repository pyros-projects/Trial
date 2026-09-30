// ============================================================ GEOMETRY
const INF = 1e9;
const inb = (g, x, y) => x >= 0 && y >= 0 && x < g.w && y < g.h;
const gget = (g, x, y) => (x < 0 || y < 0 || x >= g.w || y >= g.h) ? T.WALL : g.t[y * g.w + x];
function gset(g, x, y, v) { if (x > 0 && y > 0 && x < g.w - 1 && y < g.h - 1) g.t[y * g.w + x] = v; }

// Diagonal steps are forbidden through doorways and when either orthogonal
// neighbour is a solid obstruction (no corner cutting). Shared by player,
// monsters, pathfinding and validation so every system agrees.
function diagOk(g, x0, y0, x1, y1) {
  if (x0 === x1 || y0 === y1) return true;
  const a = gget(g, x0, y0), b = gget(g, x1, y1);
  if (a === T.OPEN || a === T.DOOR || b === T.OPEN || b === T.DOOR) return false;
  if (tSolid(gget(g, x1, y0)) || tSolid(gget(g, x0, y1))) return false;
  return true;
}

// Symmetric shadowcasting (Albert Ford), exact integer slopes.
function shadowcast(g, ox, oy, radius, opaqueAt, mark) {
  mark(ox, oy);
  const r2 = radius * radius + radius;
  for (let q = 0; q < 4; q++) {
    const scan = (depth, sn, sd, en, ed) => {
      if (depth > radius) return;
      const minCol = Math.floor((2 * depth * sn + sd) / (2 * sd));
      const maxCol = Math.ceil((2 * depth * en - ed) / (2 * ed));
      let prev = -1;
      for (let col = minCol; col <= maxCol; col++) {
        let x, y;
        if (q === 0) { x = ox + col; y = oy - depth; } else if (q === 1) { x = ox + col; y = oy + depth; }
        else if (q === 2) { x = ox + depth; y = oy + col; } else { x = ox - depth; y = oy + col; }
        const wall = opaqueAt(x, y) ? 1 : 0;
        if ((wall || (col * sd >= depth * sn && col * ed <= depth * en)) && col * col + depth * depth <= r2 && inb(g, x, y)) mark(x, y);
        if (prev === 1 && !wall) { sn = 2 * col - 1; sd = 2 * depth; }
        if (prev === 0 && wall) scan(depth + 1, sn, sd, 2 * col - 1, 2 * depth);
        prev = wall;
      }
      if (prev === 0) scan(depth + 1, sn, sd, en, ed);
    };
    scan(1, -1, 1, 1, 1);
  }
}

class MinHeap {
  constructor() { this.k = []; this.v = []; }
  get size() { return this.k.length; }
  push(key, val) {
    const k = this.k, v = this.v; let i = k.length; k.push(key); v.push(val);
    while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= key) break; k[i] = k[p]; v[i] = v[p]; i = p; }
    k[i] = key; v[i] = val;
  }
  pop() {
    const k = this.k, v = this.v; const rk = k[0], rv = v[0]; const lk = k.pop(), lv = v.pop();
    if (k.length) {
      let i = 0; const n = k.length;
      for (;;) { let c = 2 * i + 1; if (c >= n) break; if (c + 1 < n && k[c + 1] < k[c]) c++; if (k[c] >= lk) break; k[i] = k[c]; v[i] = v[c]; i = c; }
      k[i] = lk; v[i] = lv;
    }
    this._k = rk; return rv;
  }
}
// Dijkstra "distance map" toward sources. cost(x,y) = cost to step INTO
// (x,y), or <0 when impassable. dist[i] = cost for a walker at i to reach a source.
function dmap(g, sources, cost, maxCost = INF) {
  const W = g.w, N = g.w * g.h; const dist = new Float64Array(N).fill(INF);
  const c = new Float64Array(N); for (let i = 0; i < N; i++) c[i] = cost(i % W, (i / W) | 0);
  const h = new MinHeap();
  for (const s of sources) { const i = s[1] * W + s[0]; const v = s[2] || 0; if (v < dist[i]) { dist[i] = v; h.push(v, i); } }
  while (h.size) {
    const i = h.pop(); const d = h._k; if (d > dist[i]) continue; if (d > maxCost) break;
    const x = i % W, y = (i - x) / W; const enter = c[i] < 0 ? 1 : c[i];
    for (let k = 0; k < 8; k++) {
      const nx = x + DIRS8[k][0], ny = y + DIRS8[k][1]; if (nx < 0 || ny < 0 || nx >= W || ny >= g.h) continue;
      const ni = ny * W + nx; if (c[ni] < 0) continue;
      if (k >= 4 && !diagOk(g, nx, ny, x, y)) continue;
      const nd = d + enter; if (nd < dist[ni]) { dist[ni] = nd; h.push(nd, ni); }
    }
  }
  return dist;
}
// Safe traversal used by generation/validation: doors are passable (they can
// be opened), locked doors only if allowLocked, hazards never.
function safeCost(g, allowLocked) {
  return (x, y) => {
    const t = g.t[y * g.w + x];
    if (t === T.DOOR || t === T.OPEN) return 1;
    if (t === T.LOCKED) return allowLocked ? 1 : -1;
    if (!tWalk(t) || TILES[t].hazard) return -1;
    return 1;
  };
}
function regionsOf(g, passFn) { // 8-dir connectivity using movement rules; returns {id:Int32Array,count,sizes}
  const W = g.w, N = W * g.h; const id = new Int32Array(N).fill(-1); const sizes = [];
  for (let s = 0; s < N; s++) {
    if (id[s] >= 0 || !passFn(s % W, (s / W) | 0)) continue;
    const r = sizes.length; let sz = 0; const st = [s]; id[s] = r;
    while (st.length) {
      const i = st.pop(); sz++; const x = i % W, y = (i - x) / W;
      for (let k = 0; k < 8; k++) {
        const nx = x + DIRS8[k][0], ny = y + DIRS8[k][1]; if (!inb(g, nx, ny)) continue; const ni = ny * W + nx;
        if (id[ni] >= 0 || !passFn(nx, ny)) continue; if (k >= 4 && !diagOk(g, x, y, nx, ny)) continue;
        id[ni] = r; st.push(ni);
      }
    }
    sizes.push(sz);
  }
  return { id, count: sizes.length, sizes };
}
const connPass = (g) => (x, y) => { const t = gget(g, x, y); return (tWalk(t) && !TILES[t].hazard) || t === T.DOOR || t === T.LOCKED; };

// Can an obstacle be placed at (x,y) without cutting local connectivity?
const RING = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
function canBlock(g, x, y) {
  const t = gget(g, x, y); if (!tWalk(t) || t === T.DOWN || t === T.UP) return false;
  const p = RING.map(([dx, dy]) => { const u = gget(g, x + dx, y + dy); return (tWalk(u) && !TILES[u].hazard) || TILES[u].door === 1; });
  for (let k = 0; k < 8; k += 2) { const u = gget(g, x + RING[k][0], y + RING[k][1]); if (TILES[u].door) return false; }
  let groups = 0, all = true;
  for (let i = 0; i < 8; i++) { if (!p[i]) all = false; if (p[i] && !p[(i + 7) % 8]) groups++; }
  if (all) return true;
  // a diagonal-only group (corner) can't be entered anyway once we block: only count groups containing an orthogonal cell
  let orthGroups = 0;
  for (let i = 0; i < 8; i++) {
    if (p[i] && !p[(i + 7) % 8]) { let j = i, hasOrth = false; while (p[j % 8] && j < i + 8) { if (j % 2 === 0) hasOrth = true; j++; } if (hasOrth) orthGroups++; }
  }
  return orthGroups <= 1;
}

// ============================================================ GENERATION
function newGrid(w, h) { return { w, h, t: new Array(w * h).fill(T.WALL) }; }
function carveRect(g, r, v = T.FLOOR) { for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) gset(g, x, y, v); }
function carveL(g, rng, x0, y0, x1, y1) {
  const put = (x, y) => { if (gget(g, x, y) === T.WALL) gset(g, x, y, T.FLOOR); };
  if (rchance(rng, 0.5)) { for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) put(x, y0); for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) put(x1, y); }
  else { for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) put(x0, y); for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) put(x, y1); }
}
const rcx = (r) => r.x + (r.w >> 1), rcy = (r) => r.y + (r.h >> 1);
const roomPt = (rng, r) => [rint(rng, r.x, r.x + r.w - 1), rint(rng, r.y, r.y + r.h - 1)];
function connectRooms(g, rng, a, b) { const [x0, y0] = roomPt(rng, a), [x1, y1] = roomPt(rng, b); carveL(g, rng, x0, y0, x1, y1); }
function inRoom(r, x, y) { return x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h; }

function genBSP(rng, st) {
  const g = newGrid(st.w, st.h); const rooms = []; const MIN = 8;
  const split = (x, y, w, h, depth) => {
    const canH = h >= MIN * 2 + 1, canV = w >= MIN * 2 + 1;
    if (depth >= 5 || (!canH && !canV) || (depth >= 3 && w * h < 280 && rchance(rng, 0.3))) {
      const rw = rint(rng, Math.max(4, Math.floor(w * 0.45)), w - 2), rh = rint(rng, Math.max(4, Math.floor(h * 0.45)), h - 2);
      const room = { x: x + rint(rng, 1, w - rw - 1), y: y + rint(rng, 1, h - rh - 1), w: rw, h: rh };
      room.id = rooms.length; rooms.push(room); carveRect(g, room); return [room];
    }
    const horiz = canH && canV ? (h > w ? true : w > h * 1.2 ? false : rchance(rng, 0.5)) : canH;
    let A, B;
    if (horiz) { const cut = rint(rng, MIN, h - MIN); A = split(x, y, w, cut, depth + 1); B = split(x, y + cut, w, h - cut, depth + 1); }
    else { const cut = rint(rng, MIN, w - MIN); A = split(x, y, cut, h, depth + 1); B = split(x + cut, y, w - cut, h, depth + 1); }
    let best = null, bd = INF;
    for (const a of A) for (const b of B) { const d = Math.abs(rcx(a) - rcx(b)) + Math.abs(rcy(a) - rcy(b)); if (d < bd) { bd = d; best = [a, b]; } }
    connectRooms(g, rng, best[0], best[1]);
    return A.concat(B);
  };
  split(1, 1, st.w - 2, st.h - 2, 0);
  for (let k = 0; k < 3; k++) { // a few loops for tactical options
    const a = rpick(rng, rooms); const others = rooms.filter((b) => b !== a).sort((p, q) => (Math.abs(rcx(p) - rcx(a)) + Math.abs(rcy(p) - rcy(a))) - (Math.abs(rcx(q) - rcx(a)) + Math.abs(rcy(q) - rcy(a))));
    if (others[1]) connectRooms(g, rng, a, others[1]);
  }
  for (const r of rooms) if (r.w >= 8 && r.h >= 6 && rchance(rng, 0.5)) { // pillared halls
    for (let y = r.y + 1; y < r.y + r.h - 1; y += 3) for (let x = r.x + 1; x < r.x + r.w - 1; x += 3) {
      if (x === r.x + 1 || y === r.y + 1 || x >= r.x + r.w - 2 || y >= r.y + r.h - 2) { if (canBlock(g, x, y)) gset(g, x, y, T.PILLAR); }
    }
  }
  g.rooms = rooms; return g;
}

function genGrid(rng, st) { // crypt: tomb chambers on a jittered grid, spanning tree + loops
  const g = newGrid(st.w, st.h); const cols = 5, rows = 3; const cw = Math.floor((st.w - 2) / cols), ch = Math.floor((st.h - 2) / rows);
  const cells = []; const rooms = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x0 = 1 + c * cw, y0 = 1 + r * ch;
    if (rchance(rng, 0.84)) {
      const rw = rint(rng, 4, cw - 3), rh = rint(rng, 4, ch - 3);
      const room = { x: x0 + rint(rng, 1, cw - rw - 1), y: y0 + rint(rng, 1, ch - rh - 1), w: rw, h: rh, id: rooms.length };
      rooms.push(room); carveRect(g, room); cells.push({ room, r, c });
    } else {
      const node = { x: x0 + rint(rng, 2, cw - 3), y: y0 + rint(rng, 2, ch - 3), w: 1, h: 1 }; carveRect(g, node); cells.push({ room: node, r, c, node: true });
    }
  }
  const at = (r, c) => cells[r * cols + c]; const seen = new Set(); const edges = [];
  const stack = [at(rint(rng, 0, rows - 1), rint(rng, 0, cols - 1))]; seen.add(stack[0]);
  while (stack.length) {
    const cur = stack[stack.length - 1];
    const nb = [[0, 1], [1, 0], [0, -1], [-1, 0]].map(([dr, dc]) => [cur.r + dr, cur.c + dc]).filter(([r, c]) => r >= 0 && c >= 0 && r < rows && c < cols).map(([r, c]) => at(r, c)).filter((x) => !seen.has(x));
    if (!nb.length) { stack.pop(); continue; }
    const nx = rpick(rng, nb); seen.add(nx); edges.push([cur, nx]); stack.push(nx);
  }
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (c + 1 < cols && rchance(rng, 0.22)) edges.push([at(r, c), at(r, c + 1)]);
    if (r + 1 < rows && rchance(rng, 0.22)) edges.push([at(r, c), at(r + 1, c)]);
  }
  for (const [a, b] of edges) connectRooms(g, rng, a.room, b.room);
  for (const r of rooms) if (r.w >= 7 && r.h >= 5 && rchance(rng, 0.65)) { r.tomb = true; // sarcophagus rows
    for (let x = r.x + 1; x < r.x + r.w - 1; x += 2) for (const y of [r.y + 1, r.y + r.h - 2]) if (canBlock(g, x, y)) gset(g, x, y, T.PILLAR);
  }
  g.rooms = rooms; return g;
}

function genScatter(rng, st) { // ruins: scattered rooms, MST corridors
  const g = newGrid(st.w, st.h); const rooms = [];
  for (let tries = 0; tries < 400 && rooms.length < 13; tries++) {
    const w = rint(rng, 5, 11), h = rint(rng, 4, 8), x = rint(rng, 2, st.w - w - 2), y = rint(rng, 2, st.h - h - 2);
    if (rooms.some((r) => x < r.x + r.w + 2 && x + w + 2 > r.x && y < r.y + r.h + 2 && y + h + 2 > r.y)) continue;
    const room = { x, y, w, h, id: rooms.length }; rooms.push(room); carveRect(g, room);
  }
  const inTree = [rooms[0]]; const rest = rooms.slice(1);
  const dist = (a, b) => Math.abs(rcx(a) - rcx(b)) + Math.abs(rcy(a) - rcy(b));
  while (rest.length) {
    let best = null, bd = INF;
    for (const a of inTree) for (const b of rest) { const d = dist(a, b); if (d < bd) { bd = d; best = [a, b]; } }
    connectRooms(g, rng, best[0], best[1]); inTree.push(best[1]); rest.splice(rest.indexOf(best[1]), 1);
  }
  for (let k = 0; k < 3; k++) { const a = rpick(rng, rooms), b = rpick(rng, rooms); if (a !== b && dist(a, b) < 22) connectRooms(g, rng, a, b); }
  g.rooms = rooms; return g;
}

function genCaverns(rng, st) {
  const g = newGrid(st.w, st.h); const W = st.w, H = st.h;
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) g.t[y * W + x] = rchance(rng, 0.46) ? T.WALL : T.FLOOR;
  for (let it = 0; it < 5; it++) {
    const nt = g.t.slice();
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      let n1 = 0, n2 = 0;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const wall = gget(g, x + dx, y + dy) === T.WALL ? 1 : 0; if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) n1 += wall; n2 += wall;
      }
      nt[y * W + x] = (n1 >= 5 || (it < 3 && n2 <= 2)) ? T.WALL : T.FLOOR;
    }
    g.t = nt;
  }
  const pass4 = (x, y) => gget(g, x, y) !== T.WALL;
  const reg4 = () => { // 4-connected regions
    const id = new Int32Array(W * H).fill(-1); const lists = [];
    for (let s = 0; s < W * H; s++) {
      if (id[s] >= 0 || !pass4(s % W, (s / W) | 0)) continue; const L = []; const q = [s]; id[s] = lists.length;
      while (q.length) { const i = q.pop(); L.push(i); const x = i % W, y = (i - x) / W; for (const [dx, dy] of DIRS4) { const ni = (y + dy) * W + x + dx; if (inb(g, x + dx, y + dy) && id[ni] < 0 && pass4(x + dx, y + dy)) { id[ni] = lists.length; q.push(ni); } } }
      lists.push(L);
    }
    return lists;
  };
  let regs = reg4().sort((a, b) => b.length - a.length);
  for (const L of regs.slice(1)) if (L.length < 16) for (const i of L) g.t[i] = T.WALL;
  regs = reg4().sort((a, b) => b.length - a.length);
  const main = new Set(regs[0]);
  for (const L of regs.slice(1)) { // tunnel each region to the main cave
    let best = null, bd = INF;
    for (let k = 0; k < 40; k++) { const a = rpick(rng, L); for (let m = 0; m < 40; m++) { const b = rpick(rng, regs[0]); const d = Math.abs(a % W - b % W) + Math.abs(((a / W) | 0) - ((b / W) | 0)); if (d < bd) { bd = d; best = [a, b]; } } }
    carveL(g, rng, best[0] % W, (best[0] / W) | 0, best[1] % W, (best[1] / W) | 0); for (const i of L) main.add(i);
  }
  // pseudo-rooms at open-area centres (for placement)
  const open = dmap(g, [...Array(W * H).keys()].filter((i) => g.t[i] === T.WALL).map((i) => [i % W, (i / W) | 0]), () => 1);
  const cands = []; for (let i = 0; i < W * H; i++) if (g.t[i] === T.FLOOR && open[i] >= 2) cands.push(i);
  rshuffle(rng, cands); cands.sort((a, b) => open[b] - open[a]);
  const rooms = [];
  for (const i of cands) { const x = i % W, y = (i / W) | 0; if (rooms.some((r) => cheb(rcx(r), rcy(r), x, y) < 9)) continue; rooms.push({ x: x - 2, y: y - 2, w: 5, h: 5, id: rooms.length, cave: 1 }); if (rooms.length >= 12) break; }
  g.rooms = rooms; return g;
}

function genArena(rng, st) { // compact, hand-shaped test arena with seeded variations
  const g = newGrid(st.w, st.h);
  const R = { west: { x: 2, y: 8, w: 6, h: 7 }, center: { x: 11, y: 6, w: 11, h: 11 }, east: { x: 25, y: 8, w: 6, h: 7 }, north: { x: 14, y: 1, w: 5, h: 3 }, south: { x: 13, y: 19, w: 7, h: 3 } };
  const rooms = Object.entries(R).map(([k, r], i) => Object.assign(r, { id: i, tag: k }));
  for (const r of rooms) carveRect(g, r);
  for (let x = 8; x <= 10; x++) gset(g, x, 11, T.FLOOR);
  for (let x = 22; x <= 24; x++) gset(g, x, 11, T.FLOOR);
  for (let y = 4; y <= 5; y++) gset(g, 16, y, T.FLOOR);
  for (let y = 17; y <= 18; y++) gset(g, 16, y, T.FLOOR);
  const pat = rint(rng, 0, 2); const c = R.center;
  const pil = pat === 0 ? [[13, 8], [19, 8], [13, 14], [19, 14]] : pat === 1 ? [[14, 9], [18, 9], [14, 13], [18, 13], [16, 11]] : [[13, 9], [13, 13], [19, 9], [19, 13]];
  for (const [x, y] of pil) gset(g, x, y, T.PILLAR);
  const gx = rchance(rng, 0.5) ? c.x : c.x + c.w - 3; for (let y = c.y; y < c.y + 3; y++) for (let x = gx; x < gx + 3; x++) if (gget(g, x, y) === T.FLOOR) gset(g, x, y, T.GRASS);
  const wy = rchance(rng, 0.5) ? c.y + c.h - 2 : c.y; const wx = gx === c.x ? c.x + c.w - 3 : c.x; for (let y = wy; y < wy + 2; y++) for (let x = wx; x < wx + 3; x++) if (gget(g, x, y) === T.FLOOR) gset(g, x, y, T.WATER);
  g.rooms = rooms; g.arena = R; return g;
}

function placeDoors(g, rng, p) {
  const cand = new Map();
  for (const r of g.rooms) {
    r.exits = [];
    if (r.cave) continue;
    const ring = [];
    for (let x = r.x; x < r.x + r.w; x++) { ring.push([x, r.y - 1, 0, -1]); ring.push([x, r.y + r.h, 0, 1]); }
    for (let y = r.y; y < r.y + r.h; y++) { ring.push([r.x - 1, y, -1, 0]); ring.push([r.x + r.w, y, 1, 0]); }
    for (const [x, y, dx, dy] of ring) {
      const v = gget(g, x, y); if (!tWalk(v) && v !== T.DOOR) continue;
      r.exits.push([x, y]);
      const sx = dy !== 0 ? 1 : 0, sy = dx !== 0 ? 1 : 0;
      const wallish = (xx, yy) => gget(g, xx, yy) === T.WALL;
      if (wallish(x + sx, y + sy) && wallish(x - sx, y - sy) && tWalk(gget(g, x + dx, y + dy)) && tWalk(gget(g, x - dx, y - dy))) cand.set(y * g.w + x, [x, y]);
    }
  }
  const keys = [...cand.keys()].sort((a, b) => a - b);
  for (const k of keys) {
    const [x, y] = cand.get(k);
    if (DIRS8.some(([dx, dy]) => gget(g, x + dx, y + dy) === T.DOOR)) continue;
    if (rchance(rng, p)) gset(g, x, y, T.DOOR);
  }
}

function caveDoors(g, rng) {
  const c = [];
  for (let y = 2; y < g.h - 2; y++) for (let x = 2; x < g.w - 2; x++) {
    if (gget(g, x, y) !== T.FLOOR) continue;
    const W_ = (dx, dy) => gget(g, x + dx, y + dy) === T.WALL, F = (dx, dy) => gget(g, x + dx, y + dy) === T.FLOOR;
    if ((W_(0, -1) && W_(0, 1) && F(-1, 0) && F(1, 0) && W_(-1, -1) && W_(1, -1) && W_(-1, 1) && W_(1, 1)) ||
        (W_(-1, 0) && W_(1, 0) && F(0, -1) && F(0, 1) && W_(-1, -1) && W_(1, -1) && W_(-1, 1) && W_(1, 1))) c.push([x, y]);
  }
  rshuffle(rng, c); let n = 0;
  for (const [x, y] of c) { if (n >= 2) break; if (DIRS8.some(([dx, dy]) => TILES[gget(g, x + dx * 2, y + dy * 2)].door)) continue; gset(g, x, y, T.DOOR); n++; }
}

function blob(g, rng, x, y, size, tile, onlyFrom = [T.FLOOR]) {
  const placed = []; let cx = x, cy = y;
  for (let k = 0; k < size * 3 && placed.length < size; k++) {
    if (onlyFrom.includes(gget(g, cx, cy)) && cx > 1 && cy > 1 && cx < g.w - 2 && cy < g.h - 2) { placed.push([cx, cy, gget(g, cx, cy)]); gset(g, cx, cy, tile); }
    const d = rpick(rng, DIRS4); cx += d[0]; cy += d[1];
    if (!inb(g, cx, cy)) { cx = x; cy = y; }
  }
  return placed;
}
function stillConnected(g) {
  const r = regionsOf(g, connPass(g));
  return r.count <= 1;
}

// Style-specific dressing that must not break connectivity (verified).
function dressFloor(g, rng, style, n) {
  const W = g.w;
  if (style === 'ruins') {
    for (let y = 2; y < g.h - 2; y++) for (let x = 2; x < W - 2; x++) { // erosion: crumbled walls become rubble
      if (gget(g, x, y) !== T.WALL || g.protect?.has(y * W + x)) continue;
      const nf = DIRS4.filter(([dx, dy]) => tWalk(gget(g, x + dx, y + dy))).length;
      if (nf >= 1 && rchance(rng, 0.06)) gset(g, x, y, T.RUBBLE);
    }
    const grid = []; const cs = 6; const gw = Math.ceil(W / cs) + 2, gh = Math.ceil(g.h / cs) + 2;
    for (let i = 0; i < gw * gh; i++) grid.push(rnext(rng));
    const noise = (x, y) => { const fx = x / cs, fy = y / cs, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
      const v = (a, b) => grid[b * gw + a]; const l1 = v(ix, iy) * (1 - tx) + v(ix + 1, iy) * tx, l2 = v(ix, iy + 1) * (1 - tx) + v(ix + 1, iy + 1) * tx; return l1 * (1 - ty) + l2 * ty; };
    for (let y = 1; y < g.h - 1; y++) for (let x = 1; x < W - 1; x++) if (gget(g, x, y) === T.FLOOR && noise(x, y) > 0.6) gset(g, x, y, T.GRASS);
    for (let k = 0; k < 3; k++) { const r = rpick(rng, g.rooms); blob(g, rng, rcx(r), rcy(r), rint(rng, 5, 12), T.WATER, [T.FLOOR, T.GRASS]); }
    for (let y = 2; y < g.h - 2; y++) for (let x = 2; x < W - 2; x++) if (gget(g, x, y) === T.GRASS && rchance(rng, 0.07) && canBlock(g, x, y)) gset(g, x, y, T.PILLAR); // ancient trees
  } else if (style === 'caverns') {
    for (let k = 0; k < 3; k++) { const r = rpick(rng, g.rooms); blob(g, rng, rcx(r) + rint(rng, -2, 2), rcy(r) + rint(rng, -2, 2), rint(rng, 8, 20), T.WATER); }
    if (n >= 2 && n < LAST_FLOOR) for (let k = 0; k < 2; k++) { const r = rpick(rng, g.rooms); const placed = blob(g, rng, rcx(r), rcy(r), rint(rng, 6, 14), T.CHASM); if (!stillConnected(g)) for (const [x, y, t] of placed) gset(g, x, y, t); }
    if (n >= 3) for (let k = 0; k < 2; k++) { const r = rpick(rng, g.rooms); const placed = blob(g, rng, rcx(r), rcy(r), rint(rng, 5, 12), T.LAVA); if (!stillConnected(g)) for (const [x, y, t] of placed) gset(g, x, y, t); }
    caveDoors(g, rng);
    for (let y = 1; y < g.h - 1; y++) for (let x = 1; x < W - 1; x++) if (gget(g, x, y) === T.FLOOR && rchance(rng, 0.03)) gset(g, x, y, T.RUBBLE);
  } else if (style === 'crypt') {
    for (let y = 1; y < g.h - 1; y++) for (let x = 1; x < W - 1; x++) if (gget(g, x, y) === T.FLOOR && rchance(rng, 0.025)) gset(g, x, y, T.RUBBLE);
    if (n >= 3) { const r = rpick(rng, g.rooms); if (r.w >= 6 && r.h >= 5) { const placed = blob(g, rng, rcx(r), rcy(r), 6, T.CHASM); if (!stillConnected(g)) for (const [x, y, t] of placed) gset(g, x, y, t); } }
  } else if (style === 'fortress' || style === 'sanctum') {
    if (style === 'sanctum' || n >= 3) { const r = rpick(rng, g.rooms); const placed = blob(g, rng, rcx(r), rcy(r), rint(rng, 4, 9), T.LAVA); if (!stillConnected(g)) for (const [x, y, t] of placed) gset(g, x, y, t); }
    const r = rpick(rng, g.rooms); blob(g, rng, rcx(r), rcy(r), rint(rng, 4, 8), T.WATER);
  }
}

function roomTiles(g, r, pred) { const out = []; for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (inb(g, x, y) && pred(gget(g, x, y), x, y)) out.push([x, y]); return out; }
const floorish = (t) => t === T.FLOOR || t === T.GRASS || t === T.RUBBLE || t === T.ASH || t === T.WATER || t === T.BRIDGE;
const placeable = (t) => t === T.FLOOR || t === T.RUBBLE || t === T.ASH || t === T.GRASS;
const againstWall = (g, x, y) => DIRS4.some(([dx, dy]) => gget(g, x + dx, y + dy) === T.WALL);

function styleForFloor(params, n) {
  if (params.style === 'mixed') {
    if (n === LAST_FLOOR) return 'sanctum';
    const r = makeRng(params.seed + '|styles');
    const first = rpick(r, ['ruins', 'fortress']);
    const rest = rshuffle(r, ['caverns', 'crypt', first === 'ruins' ? 'fortress' : 'ruins']);
    return [first, ...rest][n - 1];
  }
  return params.style;
}

function generateFloor(params, n) {
  const style = styleForFloor(params, n);
  const log = [];
  for (let attempt = 0; attempt < 30; attempt++) {
    const fl = tryGenerate(params, n, style, attempt);
    log.push({ attempt, ok: fl.validation.ok, failed: fl.validation.checks.filter((c) => !c.ok).map((c) => c.name) });
    if (fl.validation.ok) { fl.genLog = log; return fl; }
  }
  const fl = tryGenerate(params, n, 'arena', 99); fl.genLog = log; fl.fallbackFrom = style; return fl;
}

function tryGenerate(params, n, style, attempt) {
  const st = STYLES[style]; const rng = makeRng(`${params.seed}|${style}|F${n}|A${attempt}`);
  const g = st.gen === 'bsp' ? genBSP(rng, st) : st.gen === 'grid' ? genGrid(rng, st) : st.gen === 'scatter' ? genScatter(rng, st) : st.gen === 'caverns' ? genCaverns(rng, st) : genArena(rng, st);
  g.style = style; g.n = n; g.attempt = attempt; g.protect = new Set();
  if (st.gen !== 'caverns') placeDoors(g, rng, st.doorP);
  const W = g.w; const diff = DIFFICULTY[params.difficulty] || DIFFICULTY.normal; const final = n >= LAST_FLOOR;
  const C = { enemies: [], items: [], traps: [], entry: null, exit: null, key: null, vault: null, bossRoom: null, rooms: g.rooms };

  // --- entry room: medium room, preferably with 2+ exits
  const rooms = g.rooms.slice();
  let entryRoom;
  if (style === 'arena') entryRoom = g.rooms.find((r) => r.tag === 'west');
  else {
    const good = rooms.filter((r) => r.cave || (r.w * r.h >= 20 && r.w * r.h <= 90 && r.exits.length >= 2));
    entryRoom = good.length ? rpick(rng, good) : rpick(rng, rooms);
  }
  const eTiles = roomTiles(g, entryRoom, (t) => t === T.FLOOR || t === T.RUBBLE || t === T.GRASS).sort((a, b) => cheb(a[0], a[1], rcx(entryRoom), rcy(entryRoom)) - cheb(b[0], b[1], rcx(entryRoom), rcy(entryRoom)));
  if (!eTiles.length) return failFloor(g, C, 'no entry tile');
  const [ex, ey] = eTiles[0]; C.entry = { x: ex, y: ey };

  // --- vault: dead-end room behind a single door → locked, key elsewhere
  if (st.gen !== 'caverns' && !final || style === 'arena') {
    const vaults = rooms.filter((r) => r !== entryRoom && r.exits && r.exits.length === 1 && gget(g, r.exits[0][0], r.exits[0][1]) === T.DOOR && r.w * r.h >= 6 && !r.cave);
    if (style === 'arena') { const nr = g.rooms.find((r) => r.tag === 'north'); if (nr.exits.length === 1 && gget(g, nr.exits[0][0], nr.exits[0][1]) === T.DOOR) vaults.splice(0, vaults.length, nr); }
    if (vaults.length && rchance(rng, style === 'arena' ? 1 : 0.8)) {
      const v = rpick(rng, vaults); const [dx, dy] = v.exits[0]; gset(g, dx, dy, T.LOCKED); C.vault = { room: v.id, door: { x: dx, y: dy } }; v.vault = true;
      for (let y = v.y - 1; y <= v.y + v.h; y++) for (let x = v.x - 1; x <= v.x + v.w; x++) g.protect.add(y * W + x);
    }
  }
  gset(g, ex, ey, T.UP);
  dressFloor(g, rng, style, n);
  if (gget(g, ex, ey) !== T.UP) gset(g, ex, ey, T.UP);

  const dist = dmap(g, [[ex, ey]], safeCost(g, false));
  const reach = (x, y) => dist[y * W + x] < INF;
  const vaultRoom = C.vault ? g.rooms[C.vault.room] : null;
  const notVault = (x, y) => !vaultRoom || !inRoom(vaultRoom, x, y);
  const fovE = new Uint8Array(W * g.h); shadowcast(g, ex, ey, 11, (x, y) => tOpaque(gget(g, x, y)), (x, y) => { fovE[y * W + x] = 1; });
  const occupied = new Set([ey * W + ex]);
  const take = (x, y) => occupied.add(y * W + x);
  const free = (x, y) => !occupied.has(y * W + x);

  // --- exit / boss lair: farthest room
  const roomD = (r) => { let best = 0; for (const [x, y] of roomTiles(g, r, (t) => floorish(t))) if (dist[y * W + x] < INF) best = Math.max(best, dist[y * W + x]); return best; };
  const far = rooms.filter((r) => r !== entryRoom && !r.vault).sort((a, b) => roomD(b) - roomD(a));
  if (!far.length) return failFloor(g, C, 'no far room');
  if (!final) {
    const r = style === 'arena' ? g.rooms.find((q) => q.tag === 'east') : far[0];
    const cand = roomTiles(g, r, (t, x, y) => placeable(t) && reach(x, y) && !DIRS8.some(([dx, dy]) => TILES[gget(g, x + dx, y + dy)].door)).sort((a, b) => dist[b[1] * W + b[0]] - dist[a[1] * W + a[0]]);
    if (!cand.length) return failFloor(g, C, 'no exit tile');
    const [sx, sy] = cand[0]; gset(g, sx, sy, T.DOWN); C.exit = { x: sx, y: sy }; take(sx, sy);
  } else {
    const big = far.slice(0, 4).sort((a, b) => b.w * b.h - a.w * a.h)[0];
    const r = style === 'arena' ? g.rooms.find((q) => q.tag === 'east') : big; C.bossRoom = r.id;
    const cand = roomTiles(g, r, (t, x, y) => placeable(t) && reach(x, y)).sort((a, b) => cheb(a[0], a[1], rcx(r), rcy(r)) - cheb(b[0], b[1], rcx(r), rcy(r)));
    if (!cand.length) return failFloor(g, C, 'no boss tile');
    const [bx, by] = cand[0]; C.enemies.push({ k: 'boss', x: bx, y: by, state: 'guarding', post: { x: bx, y: by } }); take(bx, by); C.boss = { x: bx, y: by };
    let guards = 0;
    for (const [x, y] of cand.slice(3)) { if (guards >= 2) break; if (cheb(x, y, bx, by) >= 2 && cheb(x, y, bx, by) <= 3 && free(x, y)) { C.enemies.push({ k: 'sentinel', x, y, state: 'guarding', post: { x, y } }); take(x, y); guards++; } }
    for (const [x, y] of [[r.x, r.y], [r.x + r.w - 1, r.y], [r.x, r.y + r.h - 1], [r.x + r.w - 1, r.y + r.h - 1]]) if (placeable(gget(g, x, y)) && free(x, y) && canBlock(g, x, y)) gset(g, x, y, T.BRAZIER);
  }

  // --- key for the vault
  if (C.vault) {
    const kc = []; for (const r of rooms) { if (r === vaultRoom || r === entryRoom) continue; for (const [x, y] of roomTiles(g, r, (t, x, y) => placeable(t) && reach(x, y) && dist[y * W + x] >= 5)) kc.push([x, y]); }
    if (!kc.length) { gset(g, C.vault.door.x, C.vault.door.y, T.DOOR); C.vault = null; }
    else {
      const [kx, ky] = rpick(rng, kc); C.items.push({ k: 'key', qty: 1, x: kx, y: ky }); take(kx, ky); C.key = { x: kx, y: ky };
      const vt = roomTiles(g, vaultRoom, (t) => placeable(t)); rshuffle(rng, vt);
      const tier = Math.min(3, 1 + Math.floor(n / 2) + (rchance(rng, 0.4) ? 1 : 0));
      const loot = [rpick(rng, GEAR_BY_TIER[tier]), rweighted(rng, CONSUMABLE_TABLE), 'gold'];
      loot.forEach((k, i) => { if (vt[i]) { C.items.push({ k, qty: k === 'gold' ? rint(rng, 25, 45) * n : 1, x: vt[i][0], y: vt[i][1], vault: 1 }); take(vt[i][0], vt[i][1]); } });
      if (n >= 2) { // sentinel posted outside the vault door
        const { x: vx, y: vy } = C.vault.door;
        for (const [dx, dy] of DIRS4) { const x = vx + dx, y = vy + dy; if (placeable(gget(g, x, y)) && notVault(x, y) && reach(x, y) && dist[y * W + x] >= 10 && free(x, y)) { C.enemies.push({ k: 'sentinel', x, y, state: 'guarding', post: { x, y } }); take(x, y); break; } }
      }
    }
  }

  // --- start room dressing: warm light, a nearby pick-up and a chest
  const eR = entryRoom;
  if (!eR.cave) {
    const corners = [[eR.x, eR.y], [eR.x + eR.w - 1, eR.y], [eR.x, eR.y + eR.h - 1], [eR.x + eR.w - 1, eR.y + eR.h - 1]];
    let lit = 0; for (const [x, y] of rshuffle(rng, corners)) { if (lit >= 2) break; if (placeable(gget(g, x, y)) && free(x, y) && canBlock(g, x, y) && cheb(x, y, ex, ey) >= 2) { gset(g, x, y, T.BRAZIER); lit++; } }
  } else {
    let lit = 0; for (const [dx, dy] of rshuffle(rng, RING.map((d) => [d[0] * 2, d[1] * 2]))) { if (lit >= 2) break; const x = ex + dx, y = ey + dy; if (placeable(gget(g, x, y)) && againstWall(g, x, y) && canBlock(g, x, y)) { gset(g, x, y, T.BRAZIER); lit++; } }
  }
  const near = []; for (let y = ey - 3; y <= ey + 3; y++) for (let x = ex - 3; x <= ex + 3; x++) if (inb(g, x, y) && placeable(gget(g, x, y)) && free(x, y) && fovE[y * W + x] && cheb(x, y, ex, ey) >= 2 && reach(x, y)) near.push([x, y]);
  if (near.length) { const [x, y] = rpick(rng, near); C.items.push({ k: rweighted(rng, [['heal', 3], ['firebomb', 2], ['knives', 2], ['smokebomb', 1], ['scrollMap', 1]]), qty: 1, x, y }); take(x, y); }
  const chestSpot = (r) => roomTiles(g, r, (t, x, y) => placeable(t) && free(x, y) && againstWall(g, x, y) && canBlock(g, x, y) && cheb(x, y, ex, ey) >= 2);
  { const cs = chestSpot(eR); if (cs.length && rchance(rng, 0.7)) { const [x, y] = rpick(rng, cs); gset(g, x, y, T.CHEST); } }

  // --- specials: shrine, chests, extra braziers
  const others = rooms.filter((r) => r !== eR && !r.vault && r.id !== C.bossRoom);
  if (others.length && rchance(rng, 0.6)) { const r = rpick(rng, others); const cs = chestSpot(r); if (cs.length) { const [x, y] = rpick(rng, cs); gset(g, x, y, T.SHRINE); } }
  for (let k = rint(rng, 1, 2); k > 0 && others.length; k--) { const r = rpick(rng, others); const cs = chestSpot(r); if (cs.length) { const [x, y] = rpick(rng, cs); gset(g, x, y, T.CHEST); } }
  for (const r of others) if (rchance(rng, style === 'fortress' || style === 'sanctum' ? 0.55 : 0.3)) { const cs = chestSpot(r); if (cs.length) { const [x, y] = rpick(rng, cs); gset(g, x, y, T.BRAZIER); } }

  // re-verify connectivity after furniture; then recompute distances
  const dist2 = dmap(g, [[ex, ey]], safeCost(g, false));
  const reach2 = (x, y) => dist2[y * W + x] < INF;

  // --- loot
  const lootTiles = []; for (let y = 1; y < g.h - 1; y++) for (let x = 1; x < W - 1; x++) if (placeable(gget(g, x, y)) && reach2(x, y) && free(x, y) && notVault(x, y) && dist2[y * W + x] >= 3) lootTiles.push([x, y]);
  rshuffle(rng, lootTiles);
  const nCons = rint(rng, 4, 6) + (params.difficulty === 'easy' ? 1 : 0) - (style === 'arena' ? 2 : 0);
  const nGold = rint(rng, 3, 5) - (style === 'arena' ? 2 : 0);
  const gearTier = Math.min(3, 1 + Math.floor((n - 1) / 2));
  const spawnItem = (k, qty) => { const p = lootTiles.pop(); if (p) { C.items.push({ k, qty, x: p[0], y: p[1] }); take(p[0], p[1]); } };
  for (let i = 0; i < nCons; i++) spawnItem(rweighted(rng, CONSUMABLE_TABLE), 1);
  for (let i = 0; i < nGold; i++) spawnItem('gold', rint(rng, 4, 12) * n);
  spawnItem(rpick(rng, GEAR_BY_TIER[gearTier]), 1);
  if (rchance(rng, 0.7)) spawnItem('arrows', rint(rng, 4, 9));

  // --- traps: hidden, never near the entry, never on doors/stairs
  const nTraps = Math.round((2 + n) * st.traps * (params.difficulty === 'hard' ? 1.3 : params.difficulty === 'easy' ? 0.7 : 1));
  const trapTiles = lootTiles.filter(([x, y]) => gget(g, x, y) === T.FLOOR && dist2[y * W + x] >= 6 && !DIRS8.some(([dx, dy]) => { const t = gget(g, x + dx, y + dy); return t === T.DOWN || TILES[t].door; }));
  rshuffle(rng, trapTiles);
  for (let i = 0; i < nTraps && trapTiles.length; i++) { const [x, y] = trapTiles.pop(); if (!free(x, y)) continue; C.traps.push({ x, y, k: rweighted(rng, [['spike', 3], ['gas', 2], ['alarm', 1.5], ['fire', 1.5], ['net', 1.5]]), hidden: 1, armed: 1 }); take(x, y); }

  // --- enemies: out of sight of the entry and at least 9 steps away
  const table = SPAWN_TABLE[Math.min(n, 5)];
  let budget = (style === 'arena' ? 3 + n : 5 + 2 * n) + diff.count;
  if (final) budget = Math.max(3, budget - 5);
  const spawnTiles = []; for (let y = 1; y < g.h - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x; if (floorish(gget(g, x, y)) && reach2(x, y) && dist2[i] >= 9 && !(fovE[i] && cheb(x, y, ex, ey) <= 11) && free(x, y) && notVault(x, y)) spawnTiles.push([x, y]);
  }
  rshuffle(rng, spawnTiles);
  let packId = 1;
  while (budget > 0 && spawnTiles.length) {
    const k = rweighted(rng, table); const [ax, ay] = spawnTiles.pop(); if (!free(ax, ay)) continue;
    const asleep = rchance(rng, 0.55);
    if (ENEMIES[k].ai === 'pack') {
      const size = k === 'rat' ? rint(rng, 3, 4) : rint(rng, 2, 3); const pid = packId++;
      const spots = [[ax, ay]]; for (const [dx, dy] of rshuffle(rng, DIRS8.slice())) { const x = ax + dx, y = ay + dy; if (spots.length >= size) break; const i = y * W + x; if (floorish(gget(g, x, y)) && free(x, y) && reach2(x, y) && dist2[i] >= 9 && !(fovE[i] && cheb(x, y, ex, ey) <= 11) && notVault(x, y)) spots.push([x, y]); }
      for (const [x, y] of spots) { C.enemies.push({ k, x, y, state: asleep ? 'asleep' : 'idle', pack: pid }); take(x, y); }
      budget -= Math.ceil(spots.length / 2) + 1;
    } else { C.enemies.push({ k, x: ax, y: ay, state: asleep ? 'asleep' : 'idle' }); take(ax, ay); budget -= (k === 'brute' || k === 'wraith') ? 2 : 1; }
  }
  const fl = finishFloor(g, C);
  fl.validation = validateFloor(fl);
  return fl;
}
function failFloor(g, C, why) { const fl = finishFloor(g, C); fl.validation = { ok: false, checks: [{ name: 'Layout placement', ok: false, detail: why }] }; return fl; }
function finishFloor(g, C) {
  return { style: g.style, n: g.n, attempt: g.attempt, w: g.w, h: g.h, t: g.t, rooms: (g.rooms || []).map((r) => ({ x: r.x, y: r.y, w: r.w, h: r.h, id: r.id, vault: r.vault ? 1 : 0, tomb: r.tomb ? 1 : 0 })),
    entry: C.entry, exit: C.exit, key: C.key, vault: C.vault, bossRoom: C.bossRoom, boss: C.boss || null, spawn: { enemies: C.enemies, items: C.items, traps: C.traps } };
}

// Generation validation — also shown in the diagnostics panel.
function validateFloor(fl, live) {
  const g = fl; const W = g.w; const checks = []; const add = (name, ok, detail = '') => checks.push({ name, ok: !!ok, detail });
  const E = fl.entry; const sp = live || fl.spawn;
  if (!E) { add('Entry placed', false); return { ok: false, checks }; }
  const et = gget(g, E.x, E.y);
  add('Entry on walkable, non-hazard tile', tWalk(et) && !TILES[et].hazard, `(${E.x},${E.y}) ${TILES[et].name}`);
  const dNo = dmap(g, [[E.x, E.y]], safeCost(g, false)); const dLk = dmap(g, [[E.x, E.y]], safeCost(g, true));
  if (fl.exit) { const d = dNo[fl.exit.y * W + fl.exit.x]; add('Exit stairs reachable without keys', d < INF, d < INF ? `${d} steps` : 'unreachable'); add('Exit on stairs tile', gget(g, fl.exit.x, fl.exit.y) === T.DOWN); }
  else { const b = fl.boss; const d = b ? dNo[b.y * W + b.x] : INF; add('Boss lair reachable without keys', d < INF, d < INF ? `${d} steps` : 'missing'); }
  let total = 0, un = 0; for (let i = 0; i < W * g.h; i++) { const t = g.t[i]; if ((tWalk(t) && !TILES[t].hazard) || t === T.DOOR || t === T.LOCKED) { total++; if (dLk[i] >= INF) un++; } }
  add('Every walkable tile connected to the entry', un === 0, `${total} tiles, ${un} unreachable`);
  if (fl.vault) { const k = fl.key; add('Vault key reachable without the vault', k && dNo[k.y * W + k.x] < INF, k ? `key at (${k.x},${k.y})` : 'no key'); }
  const fov = new Uint8Array(W * g.h); shadowcast(g, E.x, E.y, 11, (x, y) => tOpaque(gget(g, x, y)), (x, y) => { fov[y * W + x] = 1; });
  let nearest = INF, seen = 0, badPos = 0; const occ = new Set();
  for (const e of sp.enemies) { const i = e.y * W + e.x; nearest = Math.min(nearest, dNo[i]); if (fov[i] && cheb(e.x, e.y, E.x, E.y) <= 11) seen++; const t = gget(g, e.x, e.y); if (!tWalk(t) || TILES[t].hazard || occ.has(i) || (e.x === E.x && e.y === E.y)) badPos++; occ.add(i); }
  add('No enemy within 8 steps of the entry', nearest > 8, nearest >= INF ? 'none reachable' : `nearest ${nearest} steps`);
  add('No enemy in line of sight of the entry', seen === 0, `${seen} visible`);
  add('Enemies on legal, unshared tiles', badPos === 0, `${sp.enemies.length} enemies`);
  let badItem = 0; for (const it of sp.items) { const t = gget(g, it.x, it.y); if (!tWalk(t) || TILES[t].hazard) badItem++; }
  add('Items on walkable tiles', badItem === 0, `${sp.items.length} items`);
  const nearTrap = sp.traps.filter((t) => dNo[t.y * W + t.x] < 6 && t.armed).length;
  add('No traps within 5 steps of the entry', nearTrap === 0, `${sp.traps.length} traps`);
  const ok = checks.every((c) => c.ok);
  return { ok, checks };
}
