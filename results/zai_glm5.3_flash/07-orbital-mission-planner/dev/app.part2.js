
/* ---------------- maneuver nodes ---------------- */
const Nodes = {
  list: [], nextId: 1,
  forCraft(idx) { return this.list.filter(nd => nd.craftIdx === idx); },
  add(craftIdx, t) {
    const nd = { id: this.nextId++, craftIdx, t, pro: 0, rad: 0, dvx: 0, dvy: 0, executed: false, useProRad: true };
    this.list.push(nd);
    return nd;
  },
  remove(id) { this.list = this.list.filter(nd => nd.id !== id); },
  removeForCraft(idx) { this.list = this.list.filter(nd => nd.craftIdx !== idx); },
  clear() { this.list = []; },
  magnitude(nd) { return hyp(nd.pro + 0, nd.rad + 0) !== 0 && nd.useProRad ? hyp(nd.pro, nd.rad) : hyp(nd.dvx, nd.dvy); },
  dvVector(nd, out) {
    // world-frame delta-v for craft nd.craftIdx, evaluated in the CURRENT state of `st`
    const i = nd.craftIdx;
    const prim = primaryOf(i);
    let dx, dy, dvx, dvy;
    if (prim >= 0) {
      dx = Sim.x[i] - Sim.x[prim]; dy = Sim.y[i] - Sim.y[prim];
      dvx = Sim.vx[i] - Sim.vx[prim]; dvy = Sim.vy[i] - Sim.vy[prim];
    } else { dx = 1; dy = 0; dvx = Sim.vx[i]; dvy = Sim.vy[i]; }
    const v = hyp(dvx, dvy);
    const px = v > 1e-12 ? dvx / v : 1, py = v > 1e-12 ? dvy / v : 0; // prograde unit
    // radial unit: component of r-hat perpendicular to prograde, pointing away from primary
    const rl = hyp(dx, dy) || 1;
    let rx = dx / rl - (dx / rl * px + dy / rl * py) * px;
    let ry = dy / rl - (dx / rl * px + dy / rl * py) * py;
    const rln = hyp(rx, ry);
    if (rln > 1e-9) { rx /= rln; ry /= rln; } else { rx = -py; ry = px; }
    out.x = nd.pro * px + nd.rad * rx + nd.dvx;
    out.y = nd.pro * py + nd.rad * ry + nd.dvy;
    return out;
  },
  applyDue() {
    const out = { x: 0, y: 0 };
    let fired = false;
    for (const nd of this.list) {
      if (nd.executed || nd.t > Sim.t) continue;
      if (!Sim.alive[nd.craftIdx]) { nd.executed = true; continue; }
      this.dvVector(nd, out);
      Sim.vx[nd.craftIdx] += out.x; Sim.vy[nd.craftIdx] += out.y;
      nd.executed = true;
      Sim.logEvent(`⚙ Maneuver ${nd.label || '#' + nd.id} executed by ${Sim.names[nd.craftIdx]}: ΔV=${fmtNum(hyp(out.x, out.y), 3)}`, 'node');
      fired = true;
    }
    if (fired) Predict.dirty = true;
  },
  snapshot() { return this.list.map(nd => ({ ...nd })); },
  restore(arr) { this.list = arr.map(nd => ({ ...nd })); },
};

/* ---------------- trajectory history (trails) ---------------- */
const Hist = {
  rows: [], maxRows: 900, sampleAcc: 0,
  clear() { this.rows.length = 0; this.sampleAcc = 0; },
  maybeSample(dt) {
    // sample roughly `maxRows` points across the trail window
    const interval = Math.max(P.trailWindow / this.maxRows, Sim.t ? 0 : 0);
    this.sampleAcc += dt;
    if (this.sampleAcc >= interval) { this.sampleAcc = 0; this.push(); }
    // trim old
    const cutoff = Sim.t - P.trailWindow * 1.05;
    let drop = 0;
    while (drop < this.rows.length && this.rows[drop].t < cutoff) drop++;
    if (drop > 0) this.rows.splice(0, drop);
    if (this.rows.length > this.maxRows + 50) this.rows.splice(0, this.rows.length - this.maxRows);
  },
  push() {
    this.rows.push({ t: Sim.t, xs: Float64Array.from(Sim.x), ys: Float64Array.from(Sim.y) });
  },
  seed() { this.clear(); this.push(); },
};

/* ---------------- prediction ---------------- */
const Predict = {
  dirty: true,
  lastRun: 0,
  paths: [], // per craft: {craftIdx, rows:[{t,xs,ys}], encounters:[{body,t,dist,ri}], impacts:[{body,t,ri}], nodeRows: Map(nodeId->{ri, post}) }
  cloneState() {
    return {
      n: Sim.n, G: Sim.G, m: Sim.m, r: Sim.r, alive: Sim.alive, craft: Sim.craft,
      x: Float64Array.from(Sim.x), y: Float64Array.from(Sim.y),
      vx: Float64Array.from(Sim.vx), vy: Float64Array.from(Sim.vy),
      ax: new Float64Array(Sim.n), ay: new Float64Array(Sim.n),
      accelOf: (n, m, alive, x, y, ax, ay, G) => Sim.accelOf(n, m, alive, x, y, ax, ay, G),
      t: Sim.t,
      nextNodeTime: () => { let tm = Infinity; for (const nd of Nodes.list) if (!nd.executed && nd.t >= this._t - 1e-12 && nd.t < tm) tm = nd.t; return tm; },
      _t: Sim.t,
    };
  },
  run(force) {
    const now = performance.now();
    if (!force && !this.dirty && (now - this.lastRun) < 150) return;
    if (P.paused && !force && !this.dirty) return;
    this.lastRun = now; this.dirty = false;
    const t0 = performance.now();
    this.paths = [];
    const horizon = P.predHorizon, res = clamp(P.predRes | 0, 50, 20000);
    const dtP = horizon / res;
    for (let ci = 0; ci < Sim.n; ci++) {
      if (!Sim.craft[ci] || !Sim.alive[ci]) continue;
      this.paths.push(this.predictOne(ci, dtP, horizon, res));
      if (performance.now() - t0 > 30) break; // budget guard
    }
    UI.refreshNodeEditor();
  },
  predictOne(ci, dtP, horizon, res) {
    const st = this.cloneState();
    st.accelOf(st.n, st.m, st.alive, st.x, st.y, st.ax, st.ay, st.G);
    const pending = Nodes.list.filter(nd => nd.craftIdx === ci && !nd.executed).map(nd => ({ nd, fired: false }));
    const rows = [];
    const bodies = [];
    for (let j = 0; j < st.n; j++) if (st.alive[j] && !st.craft[j]) bodies.push(j);
    // distance trackers: keep full history of craft distance to each massive body via sampling rows
    const enc = [], impacts = [];
    const nodeRows = new Map();
    let ri = 0;
    const sampleRow = () => { rows.push({ t: st._t, xs: Float64Array.from(st.x), ys: Float64Array.from(st.y) }); };
    sampleRow();
    let t = st._t;
    const dv = { x: 0, y: 0 };
    const step = (h) => {
      // velocity verlet on clone (fast path)
      const h2 = h / 2, n = st.n;
      for (let i = 0; i < n; i++) {
        if (!st.alive[i]) continue;
        st.x[i] += st.vx[i] * h + 0.5 * st.ax[i] * h * h;
        st.y[i] += st.vy[i] * h + 0.5 * st.ay[i] * h * h;
        st.vx[i] += st.ax[i] * h2; st.vy[i] += st.ay[i] * h2;
      }
      st.accelOf(n, st.m, st.alive, st.x, st.y, st.ax, st.ay, st.G);
      for (let i = 0; i < n; i++) { if (st.alive[i]) { st.vx[i] += st.ax[i] * h2; st.vy[i] += st.ay[i] * h2; } }
      st._t += h;
    };
    while (t < Sim.t + horizon - 1e-9 && ri < res * 3) {
      // node firing (exact timing like the real sim)
      let h = dtP;
      const nextNd = pending.find(p => !p.fired && p.nd.t >= t - 1e-12);
      if (nextNd && t + h > nextNd.nd.t) h = nextNd.nd.t - t;
      if (h <= 1e-12) {
        // fire node on clone
        const nd = nextNd.nd;
        this.nodeDVOnState(st, nd, dv);
        st.vx[ci] += dv.x; st.vy[ci] += dv.y;
        nextNd.fired = true;
        nodeRows.set(nd.id, { ri, post: this.elementsOnState(st, ci) });
        continue;
      }
      step(h); t = st._t; ri++;
      // collision with massive body?
      for (const j of bodies) {
        const d = hyp(st.x[ci] - st.x[j], st.y[ci] - st.y[j]);
        if (d < st.r[j] + st.r[ci] && P.collisions !== 'pass') { impacts.push({ body: j, t: st._t, ri: rows.length }); }
      }
      if (rows.length < P.predRes * 1.2 && (ri % Math.max(1, Math.floor(res / 900)) === 0)) sampleRow();
      if (impacts.length) break;
    }
    sampleRow();
    // encounters: local minima of distance to each massive body (excluding the orbited primary)
    const primCi = this.elementsOnState(st, ci) ? (() => {
      let prim = -1, bestAcc = -1;
      for (let j = 0; j < st.n; j++) {
        if (j === ci || !st.alive[j] || st.craft[j]) continue;
        const dx = st.x[j] - st.x[ci], dy = st.y[j] - st.y[ci];
        const acc = st.m[j] / Math.max(dx * dx + dy * dy, 1e-9);
        if (acc > bestAcc) { bestAcc = acc; prim = j; }
      }
      return prim;
    })() : -1;
    for (const j of bodies) {
      if (j === primCi) continue;
      for (let k = 1; k < rows.length - 1; k++) {
        const d0 = hyp(rows[k - 1].xs[j] - rows[k - 1].xs[ci], rows[k - 1].ys[j] - rows[k - 1].ys[ci]);
        const d1 = hyp(rows[k].xs[j] - rows[k].xs[ci], rows[k].ys[j] - rows[k].ys[ci]);
        const d2 = hyp(rows[k + 1].xs[j] - rows[k + 1].xs[ci], rows[k + 1].ys[j] - rows[k + 1].ys[ci]);
        if (d1 < d0 && d1 <= d2 && d1 < Sim.r[j] * 40) enc.push({ body: j, t: rows[k].t, dist: d1, ri: k });
      }
    }
    enc.sort((a, b) => a.t - b.t);
    return { craftIdx: ci, rows, encounters: enc.slice(0, 12), impacts, nodeRows, dtP };
  },
  nodeDVOnState(st, nd, out) {
    const i = nd.craftIdx;
    // primary by dominance on the cloned state
    let prim = -1, bestAcc = -1;
    for (let j = 0; j < st.n; j++) {
      if (j === i || !st.alive[j] || st.craft[j]) continue;
      const dx = st.x[j] - st.x[i], dy = st.y[j] - st.y[i];
      const acc = st.m[j] / Math.max(dx * dx + dy * dy, 1e-9);
      if (acc > bestAcc) { bestAcc = acc; prim = j; }
    }
    let dx = 1, dy = 0, dvx = st.vx[i], dvy = st.vy[i];
    if (prim >= 0) { dx = st.x[i] - st.x[prim]; dy = st.y[i] - st.y[prim]; dvx = st.vx[i] - st.vx[prim]; dvy = st.vy[i] - st.vy[prim]; }
    const v = hyp(dvx, dvy);
    const px = v > 1e-12 ? dvx / v : 1, py = v > 1e-12 ? dvy / v : 0;
    const rl = hyp(dx, dy) || 1;
    const rux = dx / rl, ruy = dy / rl;
    const dot = rux * px + ruy * py;
    let rx = rux - dot * px, ry = ruy - dot * py;
    const rln = hyp(rx, ry);
    if (rln > 1e-9) { rx /= rln; ry /= rln; } else { rx = -py; ry = px; }
    out.x = nd.pro * px + nd.rad * rx + nd.dvx;
    out.y = nd.pro * py + nd.rad * ry + nd.dvy;
  },
  elementsOnState(st, i) {
    let prim = -1, bestAcc = -1;
    for (let j = 0; j < st.n; j++) {
      if (j === i || !st.alive[j] || st.craft[j]) continue;
      const dx = st.x[j] - st.x[i], dy = st.y[j] - st.y[i];
      const acc = st.m[j] / Math.max(dx * dx + dy * dy, 1e-9);
      if (acc > bestAcc) { bestAcc = acc; prim = j; }
    }
    if (prim < 0) return null;
    const mu = st.G * (st.m[prim] + st.m[i]);
    const rx = st.x[i] - st.x[prim], ry = st.y[i] - st.y[prim];
    const vrx = st.vx[i] - st.vx[prim], vry = st.vy[i] - st.vy[prim];
    const r = hyp(rx, ry), v2 = vrx * vrx + vry * vry;
    const eps = v2 / 2 - mu / Math.max(r, 1e-9);
    const rv = rx * vrx + ry * vry;
    const ex = ((v2 - mu / Math.max(r, 1e-9)) * rx - rv * vrx) / mu;
    const ey = ((v2 - mu / Math.max(r, 1e-9)) * ry - rv * vry) / mu;
    const e = hyp(ex, ey);
    const a = -mu / (2 * eps);
    return { a, e, rp: a * (1 - e), ra: e < 1 ? a * (1 + e) : NaN };
  },
  pathFor(ci) { return this.paths.find(p => p.craftIdx === ci); },
};

/* ---------------- stats (energy history) ---------------- */
const Stats = {
  hist: [], acc: 0,
  reset() { this.hist = []; this.acc = 0; },
  sample(dt) {
    this.acc += dt;
    if (this.acc < 0.25) return;
    this.acc = 0;
    const E = Sim.energy(), p = Sim.momentum();
    const dE = (E - Sim.E0) / Math.max(Math.abs(Sim.E0), 1e-9);
    const dP = hyp(p.px - Sim.P0x, p.py - Sim.P0y) / Math.max(hyp(Sim.P0x, Sim.P0y), 1e-9);
    this.hist.push({ t: Sim.t, dE, dP });
    if (this.hist.length > 400) this.hist.shift();
  },
};

/* ---------------- checkpoints ---------------- */
const Checkpoints = {
  auto: [], manual: [], every: 4, acc: 0,
  snap() {
    return {
      t: Sim.t,
      x: Float64Array.from(Sim.x), y: Float64Array.from(Sim.y),
      vx: Float64Array.from(Sim.vx), vy: Float64Array.from(Sim.vy),
      ax: Float64Array.from(Sim.ax), ay: Float64Array.from(Sim.ay),
      m: Float64Array.from(Sim.m), r: Float64Array.from(Sim.r),
      alive: Uint8Array.from(Sim.alive),
      nodes: Nodes.snapshot(),
    };
  },
  restore(s) {
    Sim.t = s.t;
    Sim.x.set(s.x); Sim.y.set(s.y); Sim.vx.set(s.vx); Sim.vy.set(s.vy);
    Sim.ax.set(s.ax); Sim.ay.set(s.ay); Sim.m.set(s.m); Sim.r.set(s.r);
    Sim.alive.set(s.alive);
    Nodes.restore(s.nodes);
    Sim.computeAccel();
    Predict.dirty = true;
    Hist.clear();
  },
  maybeAuto(dt) {
    if (P.paused) return;
    this.acc += dt;
    if (this.acc >= this.every) {
      this.acc = 0;
      this.auto.push(this.snap());
      if (this.auto.length > 80) this.auto.shift();
    }
  },
  saveManual() { this.manual.push(this.snap()); if (this.manual.length > 20) this.manual.shift(); Sim.logEvent('Checkpoint saved', 'ok'); },
  rewind() {
    const s = this.manual.length ? this.manual.pop() : (this.auto.length ? this.auto.pop() : null);
    if (!s) { Sim.logEvent('No checkpoint available', 'warn'); return false; }
    this.restore(s);
    Sim.logEvent(`Rewound to checkpoint at ${fmtTime(s.t)}`, 'ok');
    return true;
  },
  clear() { this.auto = []; this.manual = []; this.acc = 0; },
};

/* ---------------- camera & frames ---------------- */
const Cam = {
  cx: 0, cy: 0, zoom: 30, followIdx: -1,
  w: 800, h: 600,
  screenX(fx) { return (fx - this.cx) * this.zoom + this.w / 2; },
  screenY(fy) { return this.h / 2 - (fy - this.cy) * this.zoom; },
  worldFromScreen(sx, sy) {
    // inverse of the *current frame* mapping (frame transform inverted by caller for live objects)
    return { x: (sx - this.w / 2) / this.zoom + this.cx, y: (this.h / 2 - sy) / this.zoom + this.cy };
  },
};

const Frames = {
  // live transform data, recomputed each frame
  ok: true, mode: 'inertial', center: -1, partner: -1,
  cx: 0, cy: 0, vcx: 0, vcy: 0, theta: 0, omega: 0,
  update() {
    this.mode = P.frameMode;
    if (this.mode === 'inertial') { this.center = -1; this.ok = true; return; }
    let c = P.frameCenter;
    if (c < 0 || c >= Sim.n || !Sim.alive[c]) {
      // fall back to primary of selection or most massive
      c = Sel.idx >= 0 ? primaryOf(Sel.idx) : 0;
      if (c < 0) { this.mode = 'inertial'; this.ok = false; return; }
    }
    this.center = c;
    this.cx = Sim.x[c]; this.cy = Sim.y[c]; this.vcx = Sim.vx[c]; this.vcy = Sim.vy[c];
    this.ok = true;
    if (this.mode === 'rot') {
      let s = P.framePartner;
      if (s === c || s < 0 || s >= Sim.n || !Sim.alive[s]) s = primaryOf(c) >= 0 ? primaryOf(c) : -1;
      this.partner = s;
      if (s < 0) { this.mode = 'body'; return; }
      const rx = Sim.x[s] - Sim.x[c], ry = Sim.y[s] - Sim.y[c];
      const r = hyp(rx, ry);
      this.theta = Math.atan2(ry, rx);
      const vsx = Sim.vx[s] - Sim.vx[c], vsy = Sim.vy[s] - Sim.vy[c];
      this.omega = r > 1e-9 ? (rx * vsy - ry * vsx) / (r * r) : 0;
    }
  },
  name() {
    if (this.mode === 'inertial') return 'Inertial';
    const cn = this.center >= 0 ? Sim.names[this.center] : '?';
    if (this.mode === 'body') return `${cn}-centered`;
    const sn = this.partner >= 0 ? Sim.names[this.partner] : '?';
    return `${cn}–${sn} rotating`;
  },
  // live position -> frame coords
  px(x, y) {
    if (this.mode === 'inertial') return x;
    const dx = x - this.cx, dy = y - this.cy;
    if (this.mode === 'body') return dx;
    const cos = Math.cos(-this.theta), sin = Math.sin(-this.theta);
    return dx * cos - dy * sin;
  },
  py(x, y) {
    if (this.mode === 'inertial') return y;
    const dx = x - this.cx, dy = y - this.cy;
    if (this.mode === 'body') return dy;
    const cos = Math.cos(-this.theta), sin = Math.sin(-this.theta);
    return dx * sin + dy * cos;
  },
  // history/prediction row -> frame coords (row has xs, ys arrays)
  rowX(row, i) {
    if (this.mode === 'inertial') return row.xs[i];
    const cx = row.xs[this.center], cy = row.ys[this.center];
    const dx = row.xs[i] - cx, dy = row.ys[i] - cy;
    if (this.mode === 'body') return dx;
    const th = Math.atan2(row.ys[this.partner] - cy, row.xs[this.partner] - cx);
    const cos = Math.cos(-th), sin = Math.sin(-th);
    return dx * cos - dy * sin;
  },
  rowY(row, i) {
    if (this.mode === 'inertial') return row.ys[i];
    const cx = row.xs[this.center], cy = row.ys[this.center];
    const dx = row.xs[i] - cx, dy = row.ys[i] - cy;
    if (this.mode === 'body') return dy;
    const th = Math.atan2(row.ys[this.partner] - cy, row.xs[this.partner] - cx);
    const cos = Math.cos(-th), sin = Math.sin(-th);
    return dx * sin + dy * cos;
  },
  // live velocity -> frame coords
  vpx(i) {
    if (this.mode === 'inertial') return Sim.vx[i];
    let vx = Sim.vx[i] - this.vcx, vy = Sim.vy[i] - this.vcy;
    if (this.mode === 'body') return vx;
    const cos = Math.cos(-this.theta), sin = Math.sin(-this.theta);
    let rx = Sim.x[i] - this.cx, ry = Sim.y[i] - this.cy;
    const rxp = rx * cos - ry * sin, ryp = rx * sin + ry * cos;
    const rvx = vx * cos - vy * sin, rvy = vx * sin + vy * cos;
    // subtract omega x r (rotating-frame derivative)
    return rvx + this.omega * ryp;
  },
  vpy(i) {
    if (this.mode === 'inertial') return Sim.vy[i];
    let vx = Sim.vx[i] - this.vcx, vy = Sim.vy[i] - this.vcy;
    if (this.mode === 'body') return vy;
    const cos = Math.cos(-this.theta), sin = Math.sin(-this.theta);
    let rx = Sim.x[i] - this.cx, ry = Sim.y[i] - this.cy;
    const rxp = rx * cos - ry * sin, ryp = rx * sin + ry * cos;
    const rvx = vx * cos - vy * sin, rvy = vx * sin + vy * cos;
    return rvy - this.omega * rxp;
  },
};

/* ---------------- selection ---------------- */
const Sel = {
  idx: -1,
  select(i) {
    this.idx = (i === this.idx) ? i : i;
    Predict.dirty = true;
    UI.refreshSelection();
  },
  craftIdx() { return Sim.craft[this.idx] ? this.idx : -1; },
};

/* ---------------- scenarios ---------------- */
function circ(mu, r) { return Math.sqrt(mu / r); }
const Scenarios = [
  {
    id: 'sandbox', name: 'Sandbox — Star · Planet · Moon · Craft',
    desc: 'Default system. The spacecraft circles the planet at r=2 while the moon orbits at r=4; all bodies perturb one another.',
    G: 1, dt: 0.002, warp: 2, horizon: 80, res: 2400, trail: 40, cam: { cx: 60, cy: 6, zoom: 11 }, collisions: 'merge',
    bodies: [
      { name: 'Star', m: 1000, r: 5, color: '#ffd27a', x: 0, y: 0, vx: 0, vy: 0 },
      { name: 'Planet', m: 10, r: 0.8, color: '#7dd3fc', x: 60, y: 0, vx: 0, vy: circ(1000, 60) },
      { name: 'Moon', m: 0.05, r: 0.3, color: '#cbd5e1', x: 64, y: 0, vx: 0, vy: circ(1000, 60) + circ(10.05, 4) },
      { name: 'Craft', m: 1e-6, r: 0.05, color: '#f472b6', x: 62, y: 0, vx: 0, vy: circ(1000, 60) + circ(10.05, 2), craft: true },
    ],
    frame: { mode: 'inertial', sel: 3 },
  },
  {
    id: 'circular', name: 'Circular orbit',
    desc: 'A perfect circular orbit (e=0). Watch the energy error stay flat — the symplectic leapfrog conserves it.',
    G: 1, dt: 0.002, warp: 3, horizon: 70, res: 2000, trail: 80, cam: { cx: 0, cy: 0, zoom: 26 }, collisions: 'merge',
    bodies: [
      { name: 'Planet', m: 10, r: 0.8, color: '#7dd3fc', x: 0, y: 0, vx: 0, vy: 0 },
      { name: 'Craft', m: 1e-6, r: 0.05, color: '#f472b6', x: 5, y: 0, vx: 0, vy: circ(10, 5), craft: true },
    ],
    frame: { mode: 'body', center: 0, sel: 1 },
  },
  {
    id: 'ellipse', name: 'Elliptical orbit (e = 0.64)',
    desc: 'An ellipse with periapsis 2 and apoapsis 9. Periapsis/apoapsis markers and the osculating orbit guide are shown.',
    G: 1, dt: 0.001, warp: 2, horizon: 60, res: 2400, trail: 60, cam: { cx: 0, cy: 0, zoom: 20 }, collisions: 'merge',
    bodies: [
      { name: 'Planet', m: 10, r: 0.8, color: '#7dd3fc', x: 0, y: 0, vx: 0, vy: 0 },
      { name: 'Craft', m: 1e-6, r: 0.05, color: '#f472b6', x: 2, y: 0, vx: 0, vy: Math.sqrt(10 * (2 / 2 - 1 / 5.5)), craft: true },
    ],
    frame: { mode: 'body', center: 0, sel: 1 },
  },
  {
    id: 'hohmann', name: 'Hohmann transfer (r 6 → 14)',
    desc: 'Two pre-planned maneuver nodes raise a circular orbit from r=6 to r=14. Second burn fires automatically at apoapsis.',
    G: 1, dt: 0.002, warp: 4, horizon: 75, res: 2600, trail: 90, cam: { cx: 4, cy: 0, zoom: 13 }, collisions: 'merge',
    bodies: [
      { name: 'Planet', m: 10, r: 0.8, color: '#7dd3fc', x: 0, y: 0, vx: 0, vy: 0 },
      { name: 'Craft', m: 1e-6, r: 0.05, color: '#f472b6', x: 6, y: 0, vx: 0, vy: circ(10, 6), craft: true },
    ],
    frame: { mode: 'body', center: 0, sel: 1 },
    nodes: [
      { craft: 1, t: 0.3, pro: 0.2365, rad: 0 },
      { craft: 1, t: 31.95, pro: 0.1905, rad: 0 },
    ],
  },
  {
    id: 'moontransfer', name: 'Moon transfer (phased)',
    desc: 'A prograde burn raises apoapsis to the moon\'s orbit with phasing timed so the craft arrives for a close lunar flyby.',
    G: 1, dt: 0.001, warp: 1.5, horizon: 30, res: 2600, trail: 40, cam: { cx: 0, cy: 0, zoom: 24 }, collisions: 'merge',
    bodies: (function () {
      const mu = 10, rM = 4, rC = 2.5, at = (rC + rM) / 2;
      const tT = Math.PI * Math.sqrt(at ** 3 / mu);
      const th0 = Math.PI - Math.sqrt(mu / rM ** 3) * tT - 14 * Math.PI / 180;
      return [
        { name: 'Planet', m: 10, r: 0.8, color: '#7dd3fc', x: 0, y: 0, vx: 0, vy: 0 },
        { name: 'Moon', m: 0.05, r: 0.3, color: '#cbd5e1', x: rM * Math.cos(th0), y: rM * Math.sin(th0), vx: -Math.sqrt(mu / rM) * Math.sin(th0), vy: Math.sqrt(mu / rM) * Math.cos(th0) },
        { name: 'Craft', m: 1e-6, r: 0.05, color: '#f472b6', x: rC, y: 0, vx: 0, vy: circ(mu, rC), craft: true },
      ];
    })(),
    frame: { mode: 'inertial', sel: 2 },
    nodes: [{ craft: 2, t: 0.25, pro: 0.2188, rad: 0 }],
  },
  {
    id: 'slingshot', name: 'Gravity slingshot',
    desc: 'An elliptical orbit grazes the moon from behind: the flyby adds energy and pumps the orbit larger (watch specific energy jump).',
    G: 1, dt: 0.001, warp: 1.5, horizon: 40, res: 2600, trail: 50, cam: { cx: 0, cy: 0, zoom: 18 }, collisions: 'merge',
    bodies: (function () {
      const th0 = 63.5 * Math.PI / 180;
      return [
        { name: 'Planet', m: 10, r: 0.8, color: '#7dd3fc', x: 0, y: 0, vx: 0, vy: 0 },
        { name: 'Moon', m: 0.05, r: 0.3, color: '#cbd5e1', x: 4 * Math.cos(th0), y: 4 * Math.sin(th0), vx: -Math.sqrt(10 / 4) * Math.sin(th0), vy: Math.sqrt(10 / 4) * Math.cos(th0) },
        { name: 'Craft', m: 1e-6, r: 0.05, color: '#f472b6', x: 2, y: 0, vx: 0, vy: Math.sqrt(10 * (2 / 2 - 1 / 5.5)), craft: true },
      ];
    })(),
    frame: { mode: 'body', center: 0, partner: 1, sel: 2 },
  },
  {
    id: 'threebody', name: 'Unstable three-body dance',
    desc: 'Three near-equal masses (1, 1, 1.05) in a fragile figure-8 choreography. The imbalance slowly destroys it — watch chaos emerge. Tiny dt recommended.',
    G: 1, dt: 1e-4, warp: 0.5, horizon: 8, res: 1600, trail: 8, cam: { cx: 0, cy: 0, zoom: 60 }, collisions: 'bounce',
    bodies: [
      { name: 'A', m: 1, r: 0.2, color: '#7dd3fc', x: 3 * 0.97000436, y: 3 * -0.24308753, vx: 0.4662036850 / Math.sqrt(3), vy: 0.4323657300 / Math.sqrt(3) },
      { name: 'B', m: 1, r: 0.2, color: '#fbbf24', x: 3 * -0.97000436, y: 3 * 0.24308753, vx: 0.4662036850 / Math.sqrt(3), vy: 0.4323657300 / Math.sqrt(3) },
      { name: 'C', m: 1.05, r: 0.2, color: '#f472b6', x: 0, y: 0, vx: -0.93240737 / Math.sqrt(3), vy: -0.86473146 / Math.sqrt(3) },
      { name: 'Craft', m: 1e-6, r: 0.05, color: '#34d399', x: 5, y: 0, vx: 0, vy: Math.sqrt(3.05 / 5), craft: true },
    ],
    frame: { mode: 'inertial', sel: 3 },
  },
  {
    id: 'escape', name: 'Escape trajectory',
    desc: 'The craft leaves the planet at 1.3× local escape velocity, prograde — enough to break out of the star\'s gravity too. Specific energy goes positive.',
    G: 1, dt: 0.002, warp: 4, horizon: 150, res: 2200, trail: 120, cam: { cx: 60, cy: 20, zoom: 7 }, collisions: 'merge',
    bodies: [
      { name: 'Star', m: 1000, r: 5, color: '#ffd27a', x: 0, y: 0, vx: 0, vy: 0 },
      { name: 'Planet', m: 10, r: 0.8, color: '#7dd3fc', x: 60, y: 0, vx: 0, vy: circ(1000, 60) },
      { name: 'Craft', m: 1e-6, r: 0.05, color: '#f472b6', x: 62, y: 0, vx: 0, vy: circ(1000, 60) + 1.3 * Math.sqrt(2 * 10 / 2), craft: true },
    ],
    frame: { mode: 'inertial', sel: 2 },
  },
];

function loadScenario(sc, opts = {}) {
  Sim.alloc(sc.bodies.length);
  sc.bodies.forEach((b, i) => {
    Sim.m[i] = b.m; Sim.r[i] = b.r;
    Sim.x[i] = b.x; Sim.y[i] = b.y; Sim.vx[i] = b.vx; Sim.vy[i] = b.vy;
    Sim.names[i] = b.name; Sim.colors[i] = b.color || '#94a3b8';
    Sim.craft[i] = b.craft ? 1 : 0;
  });
  // barycentric correction: remove net momentum so system doesn't drift
  let px = 0, py = 0, M = 0;
  for (let i = 0; i < Sim.n; i++) { px += Sim.m[i] * Sim.vx[i]; py += Sim.m[i] * Sim.vy[i]; M += Sim.m[i]; }
  const keepMomentum = sc.keepMomentum;
  if (!keepMomentum && M > 0) {
    // apply correction only via most massive body to preserve relative orbits
    let big = 0; for (let i = 1; i < Sim.n; i++) if (Sim.m[i] > Sim.m[big]) big = i;
    Sim.vx[big] -= px / Sim.m[big]; Sim.vy[big] -= py / Sim.m[big];
  }
  Sim.G = sc.G ?? 1;
  Sim.t = 0; Sim.events = []; Sim.mergeCount = 0;
  P.dt = sc.dt ?? P.dt; P.warp = sc.warp ?? P.warp;
  P.predHorizon = sc.horizon ?? P.predHorizon; P.predRes = sc.res ?? P.predRes;
  P.trailWindow = sc.trail ?? P.trailWindow;
  P.collisions = sc.collisions ?? 'merge';
  P.frameMode = sc.frame?.mode ?? 'inertial';
  P.frameCenter = sc.frame?.center ?? 0;
  P.framePartner = sc.frame?.partner ?? (P.frameCenter === 0 ? 1 : 0);
  if (P.framePartner === P.frameCenter) P.framePartner = P.framePartner === 0 ? 1 : 0;
  Sim.computeAccel();
  Sim.rebaseline();
  Nodes.clear();
  (sc.nodes || []).forEach(sn => { const nd = Nodes.add(sn.craft, sn.t); nd.pro = sn.pro || 0; nd.rad = sn.rad || 0; nd.dvx = sn.dvx || 0; nd.dvy = sn.dvy || 0; nd.useProRad = sn.dvx === undefined; nd.label = sn.label; });
  Checkpoints.clear();
  Hist.seed();
  Stats.reset();
  Predict.dirty = true;
  Sel.idx = sc.frame?.sel ?? 0;
  Cam.cx = sc.cam?.cx ?? 0; Cam.cy = sc.cam?.cy ?? 0; Cam.zoom = sc.cam?.zoom ?? 30;
  Cam.followIdx = -1;
  P.paused = !!opts.paused;
  Frames.update();
}
