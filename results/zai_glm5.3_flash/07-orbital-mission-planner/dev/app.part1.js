'use strict';
/* ============================================================
   Orbital Sandbox — orbital mechanics & mission planning
   Single-file app. No external dependencies.
   Units: normalized (G configurable, default 1). 1 time unit is
   displayed as 1 day of Mission Elapsed Time (MET).
   ============================================================ */

/* ---------------- utilities ---------------- */
const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const hyp = Math.hypot;
function fmtNum(x, sig = 4) {
  if (x === null || x === undefined || Number.isNaN(x)) return '—';
  if (!Number.isFinite(x)) return x > 0 ? '∞' : '−∞';
  const ax = Math.abs(x);
  if (ax !== 0 && (ax >= 1e5 || ax < 1e-3)) return x.toExponential(2);
  return String(Number(x.toPrecision(sig)));
}
function fmtTime(t) { // sim time units -> MET "DDDd HH:MM"
  const days = t; // 1 unit = 1 day
  const d = Math.floor(days);
  const hh = Math.floor((days - d) * 24);
  const mm = Math.floor((((days - d) * 24) - hh) * 60);
  return `T+${String(d).padStart(3, '0')}d ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
function fmtTimeShort(t) {
  if (Math.abs(t) < 2) return `${fmtNum(t, 3)} u`;
  return `T+${fmtNum(t, 3)}d`;
}
// log-mapping for sliders: slider 0..1000 <-> value log-space [min,max]
const sliderToVal = (s, mn, mx) => mn * Math.pow(mx / mn, s / 1000);
const valToSlider = (v, mn, mx) => 1000 * Math.log(v / mn) / Math.log(mx / mn);
function el(id) { return document.getElementById(id); }
function htmlToEl(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; }

/* ---------------- global params ---------------- */
const P = {
  G: 1,
  dt: 0.002,
  integrator: 'vv',            // 'vv' | 'rk4' | 'dp54'
  tol: 1e-8,
  maxStepsPerFrame: 40000,
  warp: 2,                     // sim units per real second
  paused: true,
  trailWindow: 30,             // sim-time window of history kept
  predHorizon: 80,
  predRes: 2400,
  bodyScale: 1.6,
  minBodyPix: 2.2,
  collisions: 'merge',         // 'merge' | 'bounce' | 'pass'
  showTrails: true,
  showPred: true,
  showVel: true,
  showAcc: false,
  showOrbit: true,
  showSOI: false,
  showPotential: false,
  showEncounters: true,
  showErrorGraph: false,
  showLabels: true,
  frameMode: 'inertial',       // 'inertial' | 'body' | 'rot'
  frameCenter: 0,
  framePartner: 1,
};

const CRAFT_COLORS = ['#f472b6', '#34d399', '#a78bfa', '#fb923c', '#22d3ee', '#facc15', '#f87171', '#4ade80'];

/* ---------------- simulation core (flat arrays) ----------------
   State layout: Float64Arrays x,y,vx,vy,ax,ay ; masses m; flags.
   Dead bodies (merged) keep arrays but alive=0 and exert no force. */
const Sim = {
  n: 0,
  m: null, r: null, alive: null, craft: null,
  names: [], colors: [],
  x: null, y: null, vx: null, vy: null, ax: null, ay: null,
  t: 0,
  G: 1,
  soft2: 1e-9,
  E0: 0, P0x: 0, P0y: 0,
  events: [],            // {t, msg, kind}
  mergeCount: 0,
  stepsLastFrame: 0,
  dpDt: 0.001,           // adaptive controller state

  alloc(nBodies) {
    this.n = nBodies;
    const F = () => new Float64Array(nBodies);
    this.m = F(); this.r = F();
    this.x = F(); this.y = F(); this.vx = F(); this.vy = F();
    this.ax = F(); this.ay = F();
    this.alive = new Uint8Array(nBodies).fill(1);
    this.craft = new Uint8Array(nBodies);
    this.names = []; this.colors = [];
    this.dpDt = 0.001;
  },
  accelOf(n, m, alive, x, y, ax, ay, G) {
    ax.fill(0); ay.fill(0);
    for (let i = 0; i < n; i++) {
      if (!alive[i] || m[i] === 0) continue;
      for (let j = i + 1; j < n; j++) {
        if (!alive[j] || m[j] === 0) continue;
        const dx = x[j] - x[i], dy = y[j] - y[i];
        const r2 = dx * dx + dy * dy + this.soft2;
        const inv = 1 / (r2 * Math.sqrt(r2));
        const fi = G * m[j] * inv, fj = G * m[i] * inv;
        ax[i] += fi * dx; ay[i] += fi * dy;
        ax[j] -= fj * dx; ay[j] -= fj * dy;
      }
    }
  },
  computeAccel() { this.accelOf(this.n, this.m, this.alive, this.x, this.y, this.ax, this.ay, this.G); },
  // --- integrators: advance state by exactly h ---
  stepVV(h) {
    const { n, x, y, vx, vy, ax, ay, m, alive } = this;
    const h2 = h / 2;
    for (let i = 0; i < n; i++) {
      if (!alive[i]) continue;
      x[i] += vx[i] * h + 0.5 * ax[i] * h * h;
      y[i] += vy[i] * h + 0.5 * ay[i] * h * h;
      vx[i] += ax[i] * h2; vy[i] += ay[i] * h2;
    }
    this.computeAccel();
    for (let i = 0; i < n; i++) {
      if (!alive[i]) continue;
      vx[i] += ax[i] * h2; vy[i] += ay[i] * h2;
    }
  },
  stepRK4(h) {
    const n = this.n, G = this.G, m = this.m, alive = this.alive;
    const k1x = RK4.s1x, k1y = RK4.s1y, k1vx = RK4.s2x, k1vy = RK4.s2y;
    const k2x = RK4.s3x, k2y = RK4.s4y, k2vx = RK4.s5x, k2vy = RK4.s6y;
    const k3x = RK4.s1y, k3y = RK4.s2y, k3vx = RK4.s3y, k3vy = RK4.s4y; // reuse (careful ordering below)
    // Simpler: dedicated buffers
    const bx = RK4.bx, by = RK4.by, bvx = RK4.bvx, bvy = RK4.bvy;
    const ax = RK4.ax, ay = RK4.ay;
    const x0 = RK4.x0, y0 = RK4.y0, vx0 = RK4.vx0, vy0 = RK4.vy0;
    x0.set(this.x); y0.set(this.y); vx0.set(this.vx); vy0.set(this.vy);
    // k1
    for (let i = 0; i < n; i++) { k1x[i] = this.vx[i]; k1y[i] = this.vy[i]; }
    this.accelOf(n, m, alive, this.x, this.y, ax, ay, G);
    for (let i = 0; i < n; i++) { k1vx[i] = ax[i]; k1vy[i] = ay[i]; }
    // k2 at h/2
    for (let i = 0; i < n; i++) { bx[i] = x0[i] + k1x[i] * h / 2; by[i] = y0[i] + k1y[i] * h / 2; bvx[i] = vx0[i] + k1vx[i] * h / 2; bvy[i] = vy0[i] + k1vy[i] * h / 2; }
    this.accelOf(n, m, alive, bx, by, ax, ay, G);
    for (let i = 0; i < n; i++) { k2x[i] = bvx[i]; k2y[i] = bvy[i]; k2vx[i] = ax[i]; k2vy[i] = ay[i]; }
    // k3 at h/2
    for (let i = 0; i < n; i++) { bx[i] = x0[i] + k2x[i] * h / 2; by[i] = y0[i] + k2y[i] * h / 2; bvx[i] = vx0[i] + k2vx[i] * h / 2; bvy[i] = vy0[i] + k2vy[i] * h / 2; }
    this.accelOf(n, m, alive, bx, by, ax, ay, G);
    const k3vx_ = RK4.k3vx, k3vy_ = RK4.k3vy, k3x_ = RK4.k3x, k3y_ = RK4.k3y;
    for (let i = 0; i < n; i++) { k3x_[i] = bvx[i]; k3y_[i] = bvy[i]; k3vx_[i] = ax[i]; k3vy_[i] = ay[i]; }
    // k4 at h
    for (let i = 0; i < n; i++) { bx[i] = x0[i] + k3x_[i] * h; by[i] = y0[i] + k3y_[i] * h; bvx[i] = vx0[i] + k3vx_[i] * h; bvy[i] = vy0[i] + k3vy_[i] * h; }
    this.accelOf(n, m, alive, bx, by, ax, ay, G);
    for (let i = 0; i < n; i++) {
      if (!alive[i]) continue;
      this.x[i] = x0[i] + h / 6 * (k1x[i] + 2 * k2x[i] + 2 * k3x_[i] + bvx[i]);
      this.y[i] = y0[i] + h / 6 * (k1y[i] + 2 * k2y[i] + 2 * k3y_[i] + bvy[i]);
      this.vx[i] = vx0[i] + h / 6 * (k1vx[i] + 2 * k2vx[i] + 2 * k3vx_[i] + ax[i]);
      this.vy[i] = vy0[i] + h / 6 * (k1vy[i] + 2 * k2vy[i] + 2 * k3vy_[i] + ay[i]);
    }
  },
  // Dormand-Prince 5(4) adaptive: takes a step no larger than hMax, returns h used
  stepDP54(hMax) {
    const D = DP54;
    D.ensure(this.n);
    const n = this.n, m = this.m, alive = this.alive, G = this.G;
    const tol = P.tol;
    let h = clamp(this.dpDt, 1e-8, hMax);
    for (let attempt = 0; attempt < 40; attempt++) {
      const ok = D.tryStep(this, h, tol);
      if (ok.accepted) {
        this.x.set(D.y5x); this.y.set(D.y5y); this.vx.set(D.y5vx); this.vy.set(D.y5vy);
        this.dpDt = clamp(h * ok.fac, 1e-9, hMax * 4);
        return h;
      }
      h = clamp(h * ok.fac, 1e-9, hMax);
      if (h < 1e-10) { // give up, accept anyway to avoid lock
        D.tryStep(this, h, tol);
        this.x.set(D.y5x); this.y.set(D.y5y); this.vx.set(D.y5vx); this.vy.set(D.y5vy);
        this.dpDt = h;
        return h;
      }
    }
    return h;
  },
  nextNodeTime() {
    let tmin = Infinity;
    for (const nd of Nodes.list) if (!nd.executed && nd.t > this.t - 1e-12 && nd.t < tmin) tmin = nd.t;
    return tmin;
  },
  stepOnce() {
    // advances exactly one integrator step, landing on node times exactly
    let h = P.dt;
    const tNode = this.nextNodeTime();
    if (Number.isFinite(tNode) && tNode > this.t && this.t + h > tNode) h = tNode - this.t;
    if (h <= 0) h = P.dt * 1e-6;
    let used = h;
    if (P.integrator === 'vv') this.stepVV(h);
    else if (P.integrator === 'rk4') this.stepRK4(h);
    else used = this.stepDP54(h);
    this.t += used;
    this.resolveCollisions();
    Nodes.applyDue();
    return used;
  },
  resolveCollisions() {
    const n = this.n;
    for (let i = 0; i < n; i++) {
      if (!this.alive[i]) continue;
      for (let j = i + 1; j < n; j++) {
        if (!this.alive[j]) continue;
        const dx = this.x[j] - this.x[i], dy = this.y[j] - this.y[i];
        const d = hyp(dx, dy);
        const rr = this.r[i] + this.r[j];
        if (d < rr && d > 0) {
          if (P.collisions === 'pass') continue;
          else if (P.collisions === 'merge') this.merge(i, j, d);
          else this.bounce(i, j, d);
        }
      }
    }
  },
  merge(i, j, d) {
    // combine into the more massive one; momentum & mass conserved
    const big = this.m[i] >= this.m[j] ? i : j;
    const small = big === i ? j : i;
    const M = this.m[i] + this.m[j];
    if (M > 0) {
      this.x[big] = (this.m[i] * this.x[i] + this.m[j] * this.x[j]) / M;
      this.y[big] = (this.m[i] * this.y[i] + this.m[j] * this.y[j]) / M;
      this.vx[big] = (this.m[i] * this.vx[i] + this.m[j] * this.vx[j]) / M;
      this.vy[big] = (this.m[i] * this.vy[i] + this.m[j] * this.vy[j]) / M;
    }
    this.r[big] = Math.cbrt(this.r[i] ** 3 + this.r[j] ** 3);
    this.alive[small] = 0; this.m[small] = 0;
    this.mergeCount++;
    const kind = this.craft[small] ? 'impact' : 'merge';
    this.logEvent(`${this.names[small]} collided with ${this.names[big]}${this.craft[small] ? ' — spacecraft lost' : ' (merged)'}`, kind);
    if (Sel.idx === small) Sel.select(big);
    if (Cam.followIdx === small) Cam.followIdx = -1;
    Predict.dirty = true;
  },
  bounce(i, j, d) {
    // perfectly elastic contact along the line of centers
    const nx = (this.x[j] - this.x[i]) / d, ny = (this.y[j] - this.y[i]) / d;
    const rr = this.r[i] + this.r[j];
    const rvx = this.vx[j] - this.vx[i], rvy = this.vy[j] - this.vy[i];
    const vn = rvx * nx + rvy * ny;
    if (vn < 0) {
      const imp = 2 * vn / (1 / this.m[i] + 1 / this.m[j]);
      this.vx[i] += imp * nx / this.m[i]; this.vy[i] += imp * ny / this.m[i];
      this.vx[j] -= imp * nx / this.m[j]; this.vy[j] -= imp * ny / this.m[j];
      if (this.craft[i] || this.craft[j]) this.logEvent(`Surface bounce: ${this.craft[i] ? this.names[i] : this.names[j]} rebounded off ${this.craft[i] ? this.names[j] : this.names[i]}`, 'impact');
    }
    const push = (rr - d) / 2 + 1e-9;
    const wi = this.m[j] / (this.m[i] + this.m[j]), wj = 1 - wi;
    this.x[i] -= nx * push * 2 * wi; this.y[i] -= ny * push * 2 * wi;
    this.x[j] += nx * push * 2 * wj; this.y[j] += ny * push * 2 * wj;
  },
  logEvent(msg, kind = 'info') {
    this.events.push({ t: this.t, msg, kind });
    if (this.events.length > 60) this.events.shift();
    UI.eventTick(msg, kind);
  },
  energy() {
    let E = 0;
    const n = this.n;
    for (let i = 0; i < n; i++) {
      if (!this.alive[i]) continue;
      E += 0.5 * this.m[i] * (this.vx[i] * this.vx[i] + this.vy[i] * this.vy[i]);
      for (let j = i + 1; j < n; j++) {
        if (!this.alive[j]) continue;
        E -= this.G * this.m[i] * this.m[j] / Math.max(hyp(this.x[j] - this.x[i], this.y[j] - this.y[i]), 1e-9);
      }
    }
    return E;
  },
  momentum() { let px = 0, py = 0; for (let i = 0; i < this.n; i++) if (this.alive[i]) { px += this.m[i] * this.vx[i]; py += this.m[i] * this.vy[i]; } return { px, py }; },
  aliveCount() { let c = 0; for (let i = 0; i < this.n; i++) c += this.alive[i]; return c; },
  rebaseline() { this.E0 = this.energy(); const p = this.momentum(); this.P0x = p.px; this.P0y = p.py; Stats.reset(); },
};

const RK4 = {
  ensure(n) {
    if (this.n === n) return;
    this.n = n;
    const F = () => new Float64Array(n);
    this.s1x = F(); this.s1y = F(); this.s2x = F(); this.s2y = F();
    this.s3x = F(); this.s3y = F(); this.s4x = F(); this.s4y = F();
    this.s5x = F(); this.s5y = F(); this.s6x = F(); this.s6y = F();
    this.bx = F(); this.by = F(); this.bvx = F(); this.bvy = F();
    this.ax = F(); this.ay = F();
    this.x0 = F(); this.y0 = F(); this.vx0 = F(); this.vy0 = F();
    this.k3x = F(); this.k3y = F(); this.k3vx = F(); this.k3vy = F();
  },
  n: 0,
};

/* Dormand-Prince RK5(4) with adaptive step (used when integrator = dp54) */
const DP54 = {
  n: 0,
  ensure(n) {
    if (this.n === n) return;
    this.n = n;
    const F = () => new Float64Array(n);
    for (let i = 1; i <= 7; i++) { this['k' + i + 'x'] = F(); this['k' + i + 'y'] = F(); this['k' + i + 'vx'] = F(); this['k' + i + 'vy'] = F(); }
    this.y5x = F(); this.y5y = F(); this.y5vx = F(); this.y5vy = F();
    this.sx = F(); this.sy = F(); this.svx = F(); this.svy = F();
    this.x0 = F(); this.y0 = F(); this.vx0 = F(); this.vy0 = F();
  },
  // Butcher tableau (Dormand-Prince 5(4))
  c: [0, 1 / 5, 3 / 10, 4 / 5, 8 / 9, 1, 1],
  a: [
    [],
    [1 / 5],
    [3 / 40, 9 / 40],
    [44 / 45, -56 / 15, 32 / 9],
    [19372 / 6561, -25360 / 2187, 64448 / 6561, -212 / 729],
    [9017 / 3168, -355 / 33, 46732 / 5247, 49 / 176, -5103 / 18656],
    [35 / 384, 0, 500 / 1113, 125 / 192, -2187 / 6784, 11 / 84],
  ],
  b5: [35 / 384, 0, 500 / 1113, 125 / 192, -2187 / 6784, 11 / 84, 0],
  e: [71 / 57600, 0, -71 / 16695, 71 / 1920, -17253 / 339200, 22 / 525, -1 / 40],
  tryStep(S, h, tol) {
    const n = S.n, m = S.m, alive = S.alive, G = S.G;
    this.x0.set(S.x); this.y0.set(S.y); this.vx0.set(S.vx); this.vy0.set(S.vy);
    for (let st = 0; st < 7; st++) {
      const kx = this['k' + (st + 1) + 'x'], ky = this['k' + (st + 1) + 'y'];
      const kvx = this['k' + (st + 1) + 'vx'], kvy = this['k' + (st + 1) + 'vy'];
      if (st === 0) {
        for (let i = 0; i < n; i++) { kx[i] = S.vx[i]; ky[i] = S.vy[i]; }
        S.accelOf(n, m, alive, S.x, S.y, this.svx, this.svy, G);
        for (let i = 0; i < n; i++) { kvx[i] = this.svx[i]; kvy[i] = this.svy[i]; }
      } else {
        const arow = this.a[st], cs = this.c[st] * h;
        for (let i = 0; i < n; i++) { this.sx[i] = this.x0[i]; this.sy[i] = this.y0[i]; this.svx[i] = this.vx0[i]; this.svy[i] = this.vy0[i]; }
        for (let j = 0; j < st; j++) {
          const w = arow[j] * h;
          const kjx = this['k' + (j + 1) + 'x'], kjy = this['k' + (j + 1) + 'y'];
          const kjvx = this['k' + (j + 1) + 'vx'], kjvy = this['k' + (j + 1) + 'vy'];
          for (let i = 0; i < n; i++) { this.sx[i] += w * kjx[i]; this.sy[i] += w * kjy[i]; this.svx[i] += w * kjvx[i]; this.svy[i] += w * kjvy[i]; }
        }
        S.accelOf(n, m, alive, this.sx, this.sy, this.svx2 || (this.svx2 = new Float64Array(n)), this.svy2 || (this.svy2 = new Float64Array(n)), G);
        for (let i = 0; i < n; i++) { kx[i] = this.svx[i]; ky[i] = this.svy[i]; kvx[i] = this.svx2[i]; kvy[i] = this.svy2[i]; }
      }
    }
    // 5th order solution + error
    let err2 = 0;
    for (let i = 0; i < n; i++) {
      let x5 = this.x0[i], y5 = this.y0[i], vx5 = this.vx0[i], vy5 = this.vy0[i];
      let ex = 0, ey = 0, evx = 0, evy = 0;
      for (let j = 0; j < 7; j++) {
        const kx = this['k' + (j + 1) + 'x'][i], ky = this['k' + (j + 1) + 'y'][i];
        const kvx = this['k' + (j + 1) + 'vx'][i], kvy = this['k' + (j + 1) + 'vy'][i];
        x5 += this.b5[j] * h * kx; y5 += this.b5[j] * h * ky;
        vx5 += this.b5[j] * h * kvx; vy5 += this.b5[j] * h * kvy;
        ex += this.e[j] * h * kx; ey += this.e[j] * h * ky;
        evx += this.e[j] * h * kvx; evy += this.e[j] * h * kvy;
      }
      this.y5x[i] = x5; this.y5y[i] = y5; this.y5vx[i] = vx5; this.y5vy[i] = vy5;
      const sc = tol * Math.max(1, Math.max(Math.abs(vx5), Math.abs(vy5)));
      err2 += ((ex / sc) ** 2 + (ey / sc) ** 2 + (evx / sc) ** 2 + (evy / sc) ** 2) / (4 * n);
    }
    const ratio = Math.sqrt(err2);
    if (ratio <= 1) return { accepted: true, fac: clamp(0.9 * Math.pow(Math.max(ratio, 1e-10), -0.2), 0.5, 4) };
    return { accepted: false, fac: clamp(0.9 * Math.pow(ratio, -0.25), 0.2, 0.9) };
  },
};

/* ---------------- osculating elements ---------------- */
function conicFromRel(rx, ry, vrx, vry, mu) {
  // conic elements from frame-space relative state
  const r = hyp(rx, ry), v2 = vrx * vrx + vry * vry;
  const eps = v2 / 2 - mu / Math.max(r, 1e-9);
  const h = rx * vry - ry * vrx;
  const rv = rx * vrx + ry * vry;
  const ex = ((v2 - mu / Math.max(r, 1e-9)) * rx - rv * vrx) / mu;
  const ey = ((v2 - mu / Math.max(r, 1e-9)) * ry - rv * vry) / mu;
  const e = hyp(ex, ey);
  const a = -mu / (2 * eps);
  return { r, v: Math.sqrt(v2), eps, h, e, a, ex, ey, rp: a * (1 - e), ra: e < 1 ? a * (1 + e) : NaN, T: eps < 0 ? TAU * Math.sqrt(a * a * a / mu) : NaN, om: Math.atan2(ey, ex) };
}
function primaryOf(idx) {
  // dominant gravitational attractor (excluding self & dead)
  let best = -1, bestAcc = -1;
  for (let j = 0; j < Sim.n; j++) {
    if (j === idx || !Sim.alive[j] || Sim.m[j] === 0) continue;
    const dx = Sim.x[j] - Sim.x[idx], dy = Sim.y[j] - Sim.y[idx];
    const acc = Sim.m[j] / Math.max(dx * dx + dy * dy, 1e-9);
    if (acc > bestAcc) { bestAcc = acc; best = j; }
  }
  return best;
}
function elementsOf(idx, prim) {
  const mu = Sim.G * (Sim.m[prim] + Sim.m[idx]);
  const rx = Sim.x[idx] - Sim.x[prim], ry = Sim.y[idx] - Sim.y[prim];
  const vrx = Sim.vx[idx] - Sim.vx[prim], vry = Sim.vy[idx] - Sim.vy[prim];
  const r = hyp(rx, ry), v2 = vrx * vrx + vry * vry;
  const eps = v2 / 2 - mu / Math.max(r, 1e-9);
  const h = rx * vry - ry * vrx;
  const rv = rx * vrx + ry * vry;
  const ex = ((v2 - mu / Math.max(r, 1e-9)) * rx - rv * vrx) / mu;
  const ey = ((v2 - mu / Math.max(r, 1e-9)) * ry - rv * vry) / mu;
  const e = hyp(ex, ey);
  const a = -mu / (2 * eps);
  const rp = a * (1 - e), ra = e < 1 ? a * (1 + e) : NaN;
  const T = eps < 0 ? TAU * Math.sqrt(a * a * a / mu) : NaN;
  return { mu, r, v: Math.sqrt(v2), eps, h, e, a, rp, ra, T, om: Math.atan2(ey, ex), ex, ey };
}
