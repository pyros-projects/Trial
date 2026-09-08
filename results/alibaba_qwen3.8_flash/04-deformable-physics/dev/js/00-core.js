/* ============================================================================
 * PHYSICS CORE BEGIN  (DOM-free; extracted verbatim from the built index.html
 * by dev/test-physics.mjs, so the *delivered artifact* is what gets tested)
 * ----------------------------------------------------------------------------
 * Solver: position-based / XPBD-flavoured constraint projection.
 *  - semi-implicit Euler + per-substep constraint projection
 *  - substep-compensated stiffness  k_sub = 1-(1-k)^(1/substeps)
 *  - constraint families: structural / shear / bending / attachment (pair),
 *    polygon area + gas pressure (multi-particle), pin, world+shape contacts
 *  - dense uniform-grid broad phase (counting sort), narrow phase point/point
 *    (self + inter-body) and point/shape (circle, OBB, capsule)
 *  - strain tracked per constraint drives stress visualisation and tearing;
 *    torn constraints are removed from the graph permanently
 * ==========================================================================*/
/*==CORE-BEGIN==*/
const WORLD_W = 1600;
const WORLD_H = 1000;

const CL_STRUCT = 1;   /* structural distance */
const CL_SHEAR = 2;    /* shear diagonal      */
const CL_BEND = 3;     /* bending (skip-one)  */
const CL_ATTACH = 4;   /* attachment / weld   */

const BK_CLOTH = 1;
const BK_ROPE = 2;
const BK_BLOB = 3;
const BK_JELLY = 4;

const MAX_SPEED = 3000;
const TEAR_FACTOR = [1, 1, 1.3, 1.6, 0.9, 1];

function makeWorld(cfg) {
  cfg = cfg || {};
  const CAP = cfg.cap || 14000;
  const PCAP = cfg.pcap || 140000;
  const ACAP = cfg.acap || 6000;
  const POLY = cfg.poly || 90000;
  const CCAP = cfg.ccap || 40000;
  const W = {
    W: WORLD_W, H: WORLD_H,
    n: 0, cap: CAP,
    x: new Float64Array(CAP), y: new Float64Array(CAP),
    vx: new Float64Array(CAP), vy: new Float64Array(CAP),
    ox: new Float64Array(CAP), oy: new Float64Array(CAP),
    im: new Float64Array(CAP), imBase: new Float64Array(CAP),
    cr: new Float64Array(CAP),
    pin: new Uint8Array(CAP), act: new Uint8Array(CAP),
    body: new Int32Array(CAP),
    ta: new Int16Array(CAP), tb: new Int16Array(CAP), tmode: new Uint8Array(CAP),
    nx: new Float64Array(CAP), ny: new Float64Array(CAP), aero: new Uint8Array(CAP),
    px: new Float64Array(CAP), py: new Float64Array(CAP),
    pc: 0, pcap: PCAP,
    pa: new Int32Array(PCAP), pb: new Int32Array(PCAP),
    prest: new Float64Array(PCAP), pstr: new Float64Array(PCAP),
    palive: new Uint8Array(PCAP), pcls: new Uint8Array(PCAP),
    ac: 0, acap: ACAP,
    aOff: new Int32Array(ACAP), aCnt: new Int32Array(ACAP),
    aRest: new Float64Array(ACAP), aK: new Float64Array(ACAP),
    aStr: new Float64Array(ACAP), aAlive: new Uint8Array(ACAP),
    poly: new Int32Array(POLY), polyN: 0, polyCap: POLY,
    bodies: [], shapes: [],
    /* contact journal, rebuilt every collision pass: i, j, nx, ny, kind, cx, cy */
    cI: new Int32Array(CCAP), cJ: new Int32Array(CCAP),
    cNX: new Float64Array(CCAP), cNY: new Float64Array(CCAP),
    cK: new Uint8Array(CCAP), cX: new Float64Array(CCAP), cY: new Float64Array(CCAP),
    cc: 0, ccCap: CCAP,
    maxCr: 4,
    grid: null,
    t: 0,
    grab: null,
    gust: null,
    stats: {
      fps: 0, parts: 0, cons: 0, pairsTested: 0, contacts: 0, consTested: 0,
      maxErr: 0, maxStrain: 0, tears: 0, iters: 6, subs: 3,
      solveMs: 0, collideMs: 0, renderMs: 0
    },
    gbuf: new Float64Array(512)
  };
  for (let i = 0; i < CAP; i++) W.body[i] = -1;
  return W;
}

/* --------------------------------------------------------------- builders */

function addBody(W, spec) {
  const b = {
    id: W.bodies.length, dead: false, kind: BK_CLOTH, cols: 0, rows: 0,
    p0: W.n, pn: 0, closed: false, aero: false, col: '#7fd4c8',
    dampMul: 1, self: true, name: 'body',
    hsl: { h: 190, s: 45, l: 40 }, thick: 5, ring: 0, hull: null, rad: 0,
    sp: 20, c0: W.pc, c1: 0, ropeCol: null
  };
  for (const k in spec) b[k] = spec[k];
  W.bodies.push(b);
  return b;
}

function addP(W, x, y, im, r, b, ta, tb, tmode, aero) {
  if (W.n >= W.cap) return -1;
  const i = W.n++;
  W.x[i] = x; W.y[i] = y;
  W.vx[i] = 0; W.vy[i] = 0;
  W.ox[i] = x; W.oy[i] = y;
  W.im[i] = (im === undefined ? 1 : im);
  W.imBase[i] = W.im[i];
  W.cr[i] = (r === undefined ? 3 : r);
  if (W.cr[i] > W.maxCr) W.maxCr = W.cr[i];
  W.act[i] = 1; W.pin[i] = 0;
  W.body[i] = (b === undefined ? -1 : b.id);
  W.ta[i] = ta || 0; W.tb[i] = tb || 0; W.tmode[i] = tmode || 0;
  W.aero[i] = aero ? 1 : 0;
  W.nx[i] = 0; W.ny[i] = -1;
  return i;
}

function addPair(W, a, b, rest, cls, stiff) {
  if (W.pc >= W.pcap || a === b) return;
  const k = W.pc++;
  W.pa[k] = a; W.pb[k] = b;
  if (rest === undefined) {
    const dx = W.x[b] - W.x[a], dy = W.y[b] - W.y[a];
    rest = Math.sqrt(dx * dx + dy * dy) || 1;
  }
  W.prest[k] = rest;
  W.pcls[k] = cls;
  W.pstr[k] = 0;
  W.palive[k] = 1;
  void stiff;
}

/* closed polygon area / pressure constraint over a list of particle ids */
function addArea(W, idx, n, k) {
  if (W.ac >= W.acap || W.polyN + n > W.polyCap) return;
  const c = W.ac++;
  W.aOff[c] = W.polyN;
  W.aCnt[c] = n;
  for (let i = 0; i < n; i++) W.poly[W.polyN++] = idx[i];
  let A = 0;
  for (let i = 0; i < n; i++) {
    const a = idx[i], b = idx[(i + 1) % n];
    A += W.x[a] * W.y[b] - W.y[a] * W.x[b];
  }
  W.aRest[c] = Math.abs(A) * 0.5;
  W.aK[c] = k;
  W.aStr[c] = 0;
  W.aAlive[c] = 1;
}

function addShape(W, s) {
  s.alive = true;
  s.friction = (s.friction === undefined ? 0.55 : s.friction);
  s.restitution = (s.restitution === undefined ? 0.15 : s.restitution);
  s.kind = s.kind || 'circle';
  s.angle = s.angle || 0;      /* must be numeric: NaN silently kills OBB contacts */
  s.vx = 0; s.vy = 0; s.omg = 0;
  W.shapes.push(s);
  return s;
}

function pinP(W, i, x, y) {
  if (i < 0) return;
  W.pin[i] = 1;
  W.px[i] = (x === undefined ? W.x[i] : x);
  W.py[i] = (y === undefined ? W.y[i] : y);
  W.im[i] = 0;
  W.vx[i] = 0; W.vy[i] = 0;
}
function unpinP(W, i) {
  if (i < 0) return;
  W.pin[i] = 0;
  W.im[i] = W.imBase[i];
}

/* cloth sheet: rows x cols grid; structural + shear + bending (+area) */
function buildCloth(W, o) {
  const cols = o.cols, rows = o.rows, sp = o.sp;
  const b = addBody(W, {
    kind: BK_CLOTH, cols: cols, rows: rows, p0: W.n, pn: cols * rows,
    aero: true, self: true, col: o.col || '#5fd3c4', name: o.name || 'cloth',
    dampMul: 1, sp: sp, thick: sp * 0.3,
    hsl: { h: o.hue === undefined ? 168 : o.hue, s: 44, l: 42 }
  });
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      addP(W, o.x0 + c * sp, o.y0 + r * sp, o.im,
        (o.cr === undefined ? sp * 0.4 : o.cr), b, r, c, 1, true);
    }
  }
  const at = (r, c) => b.p0 + r * cols + c;
  const shear = o.shear !== false, bend = o.bend !== false;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (c + 1 < cols) addPair(W, at(r, c), at(r, c + 1), sp, CL_STRUCT);
      if (r + 1 < rows) addPair(W, at(r, c), at(r + 1, c), sp, CL_STRUCT);
      if (shear && c + 1 < cols && r + 1 < rows) {
        addPair(W, at(r, c), at(r + 1, c + 1), sp * 1.4142135, CL_SHEAR);
        addPair(W, at(r, c + 1), at(r + 1, c), sp * 1.4142135, CL_SHEAR);
      }
      if (bend && c + 2 < cols) addPair(W, at(r, c), at(r, c + 2), sp * 2, CL_BEND);
      if (bend && r + 2 < rows) addPair(W, at(r, c), at(r + 2, c), sp * 2, CL_BEND);
    }
  }
  return b;
}

/* open chain (rope) or closed pressurised ring */
function buildChain(W, o) {
  const n = o.n, seg = o.seg, closed = !!o.closed;
  const cnt = closed ? n : n + 1;
  const b = addBody(W, {
    kind: BK_ROPE, p0: W.n, pn: cnt, closed: closed,
    aero: true, self: true, col: o.col || '#e8b45a', name: o.name || 'rope',
    dampMul: 1, thick: o.thick || 5.5,
    ropeCol: o.ropeCol || 'rgba(228,178,94,0.96)',
    hsl: { h: o.hue === undefined ? 38 : o.hue, s: 60, l: 52 }
  });
  for (let i = 0; i < cnt; i++) {
    let x, y;
    if (closed) {
      const a = (i / n) * Math.PI * 2;
      x = o.cx + Math.cos(a) * o.r; y = o.y0 + Math.sin(a) * o.r;
    } else {
      /* (dx,dy) is a direction hint; spacing is always `seg` so the chain
         starts with zero strain */
      const L = Math.hypot(o.dx, o.dy) || 1;
      x = o.x0 + (o.dx / L) * seg * i;
      y = o.y0 + (o.dy / L) * seg * i;
    }
    addP(W, x, y, o.im, (o.cr === undefined ? seg * 0.4 : o.cr), b, i, 0, 2, o.aero !== false);
  }
  const last = closed ? cnt : cnt - 1;
  for (let i = 0; i < last; i++) {
    addPair(W, b.p0 + i, b.p0 + (i + 1) % cnt, seg, CL_STRUCT);
  }
  if (o.bend) {
    if (closed) {
      for (let i = 0; i < cnt; i++) {
        addPair(W, b.p0 + i, b.p0 + (i + 2) % cnt, seg * 2, CL_BEND);
      }
    } else {
      for (let i = 0; i + 2 < cnt; i++) addPair(W, b.p0 + i, b.p0 + i + 2, seg * 2, CL_BEND);
    }
  }
  if (closed && o.area !== false) {
    const idx = [];
    for (let i = 0; i < cnt; i++) idx.push(b.p0 + i);
    addArea(W, idx, cnt, 1);
  }
  return b;
}

/* pressurised soft body: N-gon shell + optional core, area + bending */
function buildBlob(W, o) {
  const n = o.n, r = o.r, ry = o.ry || o.r;
  const b = addBody(W, {
    kind: BK_BLOB, p0: W.n, pn: n, closed: true, aero: false, self: true,
    col: o.col || '#f2708a', name: o.name || 'blob', dampMul: 1.5,
    ring: n, rad: Math.max(r, ry), thick: (o.cr || 4) * 1.4,
    hsl: { h: o.hue === undefined ? 344 : o.hue, s: 70, l: 56 }
  });
  const start = W.n;
  const spc = (Math.PI * 2 * Math.max(r, ry) / n);        /* shell spacing */
  const cr0 = (o.cr === undefined ? spc * 0.45 : o.cr);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    addP(W, o.cx + Math.cos(a) * r, o.y0 + Math.sin(a) * ry,
      o.im, cr0, b, i, 0, 2, false);
  }
  const idx = [];
  for (let i = 0; i < n; i++) idx.push(start + i);
  for (let i = 0; i < n; i++) {
    addPair(W, start + i, start + (i + 1) % n, undefined, CL_STRUCT);
    addPair(W, start + i, start + (i + 2) % n, undefined, CL_BEND);
  }
  addArea(W, idx, n, 1);
  if (o.core) {
    const c = addP(W, o.cx, o.y0, o.im, cr0, b, 250, 0, 2, false);
    b.pn++;
    for (let i = 0; i < n; i++) addPair(W, c, start + i, undefined, CL_SHEAR);
  }
  return b;
}

/* soft lattice ("jelly"): structural + shear + bending + per-cell area */
function buildJelly(W, o) {
  const cols = o.cols, rows = o.rows, sp = o.sp;
  const b = addBody(W, {
    kind: BK_JELLY, cols: cols, rows: rows, p0: W.n, pn: cols * rows,
    aero: false, self: true, col: o.col || '#8ea6ff', name: o.name || 'jelly',
    dampMul: 1.3, sp: sp, thick: sp * 0.42,
    hsl: { h: o.hue === undefined ? 226 : o.hue, s: 62, l: 58 }
  });
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      addP(W, o.x0 + c * sp, o.y0 + r * sp, o.im,
        (o.cr === undefined ? sp * 0.4 : o.cr), b, r, c, 1, false);
    }
  }
  const at = (r, c) => b.p0 + r * cols + c;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (c + 1 < cols) addPair(W, at(r, c), at(r, c + 1), sp, CL_STRUCT);
      if (r + 1 < rows) addPair(W, at(r, c), at(r + 1, c), sp, CL_STRUCT);
      if (c + 1 < cols && r + 1 < rows) {
        addPair(W, at(r, c), at(r + 1, c + 1), sp * 1.4142135, CL_SHEAR);
        addPair(W, at(r, c + 1), at(r + 1, c), sp * 1.4142135, CL_SHEAR);
        addArea(W, [at(r, c), at(r, c + 1), at(r + 1, c + 1), at(r + 1, c)], 4, 1);
      }
      if (c + 2 < cols) addPair(W, at(r, c), at(r, c + 2), sp * 2, CL_BEND);
      if (r + 2 < rows) addPair(W, at(r, c), at(r + 2, c), sp * 2, CL_BEND);
    }
  }
  return b;
}

/* rigid-ish disc: dense particle cluster welded on a stiff lattice */
function buildCluster(W, o) {
  const r = o.r, sp = o.sp;
  const b = addBody(W, {
    kind: BK_JELLY, p0: W.n, pn: 0, aero: false, self: true,
    col: o.col || '#c9d3e8', name: o.name || 'rigid', dampMul: 2
  });
  const idx = [], pos = [];
  for (let y = -r; y <= r + 1e-6; y += sp) {
    for (let x = -r; x <= r + 1e-6; x += sp) {
      if (x * x + y * y <= r * r + 1e-6) {
        pos.push([o.cx + x, o.y0 + y]);
        idx.push(addP(W, o.cx + x, o.y0 + y, o.im,
          (o.cr === undefined ? sp * 0.5 : o.cr), b, 0, idx.length, 2, false));
      }
    }
  }
  b.pn = idx.length;
  b.hull = hullOf(W, b.p0, idx.length);
  b.rad = r;
  for (let i = b.p0; i < b.p0 + b.pn; i++) W.tmode[i] = 3;   /* rigid: no self CCP */
  const R2 = (sp * 2.05) * (sp * 2.05);
  for (let i = 0; i < idx.length; i++) {
    for (let j = i + 1; j < idx.length; j++) {
      const dx = pos[i][0] - pos[j][0], dy = pos[i][1] - pos[j][1];
      if (dx * dx + dy * dy <= R2) addPair(W, idx[i], idx[j], undefined, CL_STRUCT);
    }
  }
  return b;
}

/* ------------------------------------------------------------------ solver */

function computeAeroNormals(W) {
  const x = W.x, y = W.y, nx = W.nx, ny = W.ny, bodies = W.bodies;
  for (let bi = 0; bi < bodies.length; bi++) {
    const b = bodies[bi];
    if (!b.aero || b.dead) continue;
    if (b.kind === BK_CLOTH) {
      const cols = b.cols, rows = b.rows;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const i = b.p0 + r * cols + c;
          let gx = 0, gy = 0, cnt = 0;
          if (c > 0 && c + 1 < cols) {
            gx += x[b.p0 + r * cols + c + 1] - x[b.p0 + r * cols + c - 1];
            gy += y[b.p0 + r * cols + c + 1] - y[b.p0 + r * cols + c - 1];
            cnt++;
          }
          if (r > 0 && r + 1 < rows) {
            gx += x[b.p0 + (r + 1) * cols + c] - x[b.p0 + (r - 1) * cols + c];
            gy += y[b.p0 + (r + 1) * cols + c] - y[b.p0 + (r - 1) * cols + c];
            cnt++;
          }
          if (cnt === 0) { nx[i] = 0; ny[i] = -1; continue; }
          const l = Math.sqrt(gx * gx + gy * gy);
          if (l < 1e-9) { nx[i] = 0; ny[i] = -1; continue; }
          nx[i] = gy / l; ny[i] = -gx / l;
        }
      }
    } else if (b.kind === BK_ROPE) {
      const n = b.pn;
      for (let i = 0; i < n; i++) {
        const p = b.p0 + i;
        const prv = (i === 0) ? (b.closed ? n - 1 : 1) : i - 1;
        const nxt = (i === n - 1) ? (b.closed ? 0 : n - 2) : i + 1;
        const gx = x[b.p0 + nxt] - x[b.p0 + prv];
        const gy = y[b.p0 + nxt] - y[b.p0 + prv];
        const l = Math.sqrt(gx * gx + gy * gy);
        if (l < 1e-9) { nx[p] = 0; ny[p] = -1; continue; }
        nx[p] = gy / l; ny[p] = -gx / l;
      }
    }
  }
}

function integrate(W, S, h) {
  const n = W.n, x = W.x, y = W.y, vx = W.vx, vy = W.vy;
  const ox = W.ox, oy = W.oy, im = W.im, act = W.act;
  const aero = W.aero, nx = W.nx, ny = W.ny;
  const damp = Math.exp(-S.damping * h);
  const windOn = S.wind > 1;
  const wa = S.wind, wt = S.windTurb, t = W.t;
  const g = W.gust;
  const lim = MAX_SPEED;
  for (let i = 0; i < n; i++) {
    if (!act[i] || im[i] === 0) continue;
    let axx = S.gx, ayy = S.gy;
    if (windOn) {
      const nz = Math.sin(x[i] * 0.011 + t * 2.7 + y[i] * 0.007) *
        Math.cos(y[i] * 0.013 - t * 1.9 + x[i] * 0.004);
      const wdx = S.windDx * wa * (1 + wt * nz);
      const wdy = S.windDy * wa * (1 + wt * nz);
      if (aero[i]) {
        const rvx = wdx - vx[i], rvy = wdy - vy[i];
        const nnx = nx[i], nny = ny[i];
        const fn = rvx * nnx + rvy * nny;
        let f = 1.1 * fn * (fn > 0 ? fn : -fn) * 0.0018;
        if (f > 2600) f = 2600; else if (f < -2600) f = -2600;
        axx += f * nnx; ayy += f * nny;
        axx += (wdx - vx[i]) * 0.05; ayy += (wdy - vy[i]) * 0.05;
      } else {
        axx += (wdx - vx[i]) * 0.02; ayy += (wdy - vy[i]) * 0.02;
      }
    }
    if (g) {   /* pointer wind gust: radial push inside the tool radius */
      const dx = x[i] - g.x, dy = y[i] - g.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < g.r * g.r && d2 > 1e-9) {
        const d = Math.sqrt(d2);
        const k = (1 - d / g.r) * g.k;
        axx += (g.dx / d) * k * d * 0.08 + dx / d * k * 260;
        ayy += (g.dy / d) * k * d * 0.08 + dy / d * k * 260;
      }
    }
    let nvx = (vx[i] + axx * h) * damp;
    let nvy = (vy[i] + ayy * h) * damp;
    const sp2 = nvx * nvx + nvy * nvy;
    if (sp2 > lim * lim) {
      const sc = lim / Math.sqrt(sp2);
      nvx *= sc; nvy *= sc;
    }
    vx[i] = nvx; vy[i] = nvy;
    ox[i] = x[i]; oy[i] = y[i];
    x[i] += nvx * h;
    y[i] += nvy * h;
  }
}

/* pointer spring: pulls the grabbed particle set toward the cursor */
function solveGrab(W, S) {
  const g = W.grab;
  if (!g || !g.idx || g.n === 0) return;
  const kk = Math.min(1, S.grabK);
  for (let m = 0; m < g.n; m++) {
    const i = g.idx[m];
    if (i < 0 || !W.act[i] || W.pin[i]) continue;
    let dx = g.tx - W.x[i], dy = g.ty - W.y[i];
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < 1e-9) continue;
    if (d > 320) { const s = 320 / d; dx *= s; dy *= s; }
    W.x[i] += dx * kk * 0.6;
    W.y[i] += dy * kk * 0.6;
  }
}

function solvePairs(W, S, stat) {
  const pa = W.pa, pb = W.pb, prest = W.prest, palive = W.palive, pcls = W.pcls;
  const x = W.x, y = W.y, im = W.im;
  const sub = S.substeps;
  const kS = 1 - Math.pow(1 - S.kStruct, 1 / sub);
  const kSh = 1 - Math.pow(1 - S.kShear, 1 / sub);
  const kB = 1 - Math.pow(1 - S.kBend, 1 / sub);
  let maxErr = 0, maxStrain = 0;
  for (let k = 0; k < W.pc; k++) {
    if (!palive[k]) continue;
    const a = pa[k], b = pb[k];
    const dx = x[b] - x[a], dy = y[b] - y[a];
    const d2 = dx * dx + dy * dy;
    if (d2 < 1e-16) continue;
    const d = Math.sqrt(d2);
    const rest = prest[k];
    const C = d - rest;
    const wa = im[a], wb = im[b];
    const w = wa + wb;
    if (w <= 0) continue;
    stat.consTested++;
    const ac = C < 0 ? -C : C;
    if (ac > maxErr) maxErr = ac;
    const strain = ac / rest;
    if (strain > maxStrain) maxStrain = strain;
    if (ac < 1e-9) continue;
    const cls = pcls[k];
    const kk = cls === CL_SHEAR ? kSh : (cls === CL_BEND ? kB : kS);
    const s = kk * C / w;
    const nx = dx / d, ny = dy / d;
    x[a] += s * wa * nx; y[a] += s * wa * ny;
    x[b] -= s * wb * nx; y[b] -= s * wb * ny;
  }
  if (maxErr > stat.maxErr) stat.maxErr = maxErr;
  if (maxStrain > stat.maxStrain) stat.maxStrain = maxStrain;
}

/* area / gas-pressure constraint (2D volume conservation) */
function solveArea(W, S, stat) {
  if (W.ac === 0 || S.pressure <= 0.0001) return;
  const x = W.x, y = W.y, im = W.im, poly = W.poly;
  const infl = 0.12 * S.pressure;                       /* target inflation */
  const stiff = Math.min(1, 0.2 + S.pressure * 0.9);
  const kk = 1 - Math.pow(1 - stiff, 1 / S.substeps);
  let g = W.gbuf;
  for (let c = 0; c < W.ac; c++) {
    if (!W.aAlive[c]) continue;
    const off = W.aOff[c], cnt = W.aCnt[c];
    if (cnt * 2 > g.length) { g = W.gbuf = new Float64Array(Math.max(512, cnt * 4)); }
    let A = 0;
    for (let i = 0; i < cnt; i++) {
      const a = poly[off + i], b = poly[off + (i + 1) % cnt];
      A += x[a] * y[b] - y[a] * x[b];
    }
    A *= 0.5;
    const Aabs = A < 0 ? -A : A;
    const sA = A < 0 ? -1 : 1;
    const target = W.aRest[c] * (1 + infl);
    const C = Aabs - target;
    if (Math.abs(C) < 1e-9) continue;
    let den = 0;
    for (let i = 0; i < cnt; i++) {
      const i0 = poly[off + (i - 1 + cnt) % cnt];
      const i1 = poly[off + i];
      const i2 = poly[off + (i + 1) % cnt];
      /* exact gradient of the signed area:
           dA/dx_i = 0.5*(y_{i+1} - y_{i-1}),  dA/dy_i = 0.5*(x_{i-1} - x_{i+1});
         scaled by sign(A) so it always points outward (increasing |A|) */
      const gx = (y[i2] - y[i0]) * 0.5 * sA;
      const gy = (x[i0] - x[i2]) * 0.5 * sA;
      const ww = im[i1];
      g[i * 2] = gx; g[i * 2 + 1] = gy;
      den += ww * (gx * gx + gy * gy);
    }
    if (den < 1e-14) continue;
    const lam = -kk * C / den;
    for (let i = 0; i < cnt; i++) {
      const p = poly[off + i];
      const w = im[p];
      if (w === 0) continue;
      let dxp = lam * w * g[i * 2];
      let dyp = lam * w * g[i * 2 + 1];
      const dd = Math.sqrt(dxp * dxp + dyp * dyp);
      if (dd > 2.5) { const sc = 2.5 / dd; dxp *= sc; dyp *= sc; }
      x[p] += dxp; y[p] += dyp;
    }
    const str = Math.abs(C) / (W.aRest[c] + 1e-9);
    W.aStr[c] = str;
    if (str > stat.maxStrain) stat.maxStrain = str;
  }
}

/* ---------------------------------------------------------------- collisions */

function buildGrid(W, S) {
  const cs = S.cellSize;
  let G = W.grid;
  if (!G || G.cs !== cs) {
    const gw = Math.ceil(WORLD_W / cs) + 2;
    const gh = Math.ceil(WORLD_H / cs) + 2;
    G = W.grid = {
      cs: cs, gw: gw, gh: gh, nc: gw * gh, mcr: W.maxCr,
      count: new Int32Array(gw * gh),
      start: new Int32Array(gw * gh + 1),
      cursor: new Int32Array(gw * gh + 1),
      items: new Int32Array(W.cap + 64),
      cell: new Int32Array(W.cap + 64)
    };
  }
  if (G.items.length < W.n + 8) {
    G.items = new Int32Array(W.n + 4096);
    G.cell = new Int32Array(W.n + 4096);
  }
  const count = G.count, start = G.start, cursor = G.cursor;
  const items = G.items, cell = G.cell;
  count.fill(0, 0, G.nc);
  const n = W.n, x = W.x, y = W.y, act = W.act;
  const gw = G.gw, gh = G.gh, cs2 = G.cs;
  for (let i = 0; i < n; i++) {
    if (!act[i]) continue;
    let cx = (x[i] / cs2 + 1) | 0;
    let cy = (y[i] / cs2 + 1) | 0;
    if (cx < 0) cx = 0; else if (cx >= gw) cx = gw - 1;
    if (cy < 0) cy = 0; else if (cy >= gh) cy = gh - 1;
    const c = cy * gw + cx;
    cell[i] = c;
    count[c]++;
  }
  start[0] = 0;
  for (let c = 0; c < G.nc; c++) start[c + 1] = start[c] + count[c];
  for (let c = 0; c <= G.nc; c++) cursor[c] = start[c];
  for (let i = 0; i < n; i++) {
    if (!act[i]) continue;
    items[cursor[cell[i]]++] = i;
  }
}

function collidePairs(W, S, stat) {
  const G = W.grid;
  if (!G) return;
  if (!S.selfCollide && !S.pairCollide) return;
  const x = W.x, y = W.y, cr = W.cr, act = W.act, im = W.im;
  const body = W.body, tmode = W.tmode, ta = W.ta, tb = W.tb;
  const start = G.start, items = G.items, cell = G.cell;
  const gw = G.gw, gh = G.gh;
  const ts = S.ts === undefined ? 1 : S.ts;
  for (let i = 0; i < W.n; i++) {
    if (!act[i] || im[i] === 0) continue;
    const ci = cell[i];
    const gx0 = ci % gw, gy0 = (ci / gw) | 0;
    const ri = cr[i] * ts;
    const wi = im[i];
    for (let dy = -1; dy <= 1; dy++) {
      const yy = gy0 + dy;
      if (yy < 0 || yy >= gh) continue;
      for (let dx = -1; dx <= 1; dx++) {
        const xx = gx0 + dx;
        if (xx < 0 || xx >= gw) continue;
        const c = yy * gw + xx;
        const s0 = start[c], s1 = start[c + 1];
        for (let s = s0; s < s1; s++) {
          const j = items[s];
          if (j <= i || !act[j] || im[j] === 0) continue;
          const bi = body[i], bj = body[j];
          if (bi === bj) {
            if (!S.selfCollide) continue;
            const m = tmode[i];
            if (m === 3) continue;        /* rigid cluster: no self CCP */
            if (m === 1) {
              let d1 = ta[i] - ta[j]; if (d1 < 0) d1 = -d1;
              let d2 = tb[i] - tb[j]; if (d2 < 0) d2 = -d2;
              if (d1 <= 2 && d2 <= 2) continue;
            } else if (m === 2) {
              let d1 = ta[i] - ta[j]; if (d1 < 0) d1 = -d1;
              if (d1 <= 3) continue;
            }
          } else if (!S.pairCollide) continue;
          stat.pairsTested++;
          /* skin factor 1.25: a contact distance below the node spacing
             lets one lattice slide through the gaps of another */
          const d0 = (ri + cr[j] * ts) * (bi === bj ? 0.8 : 1.25);
          const ddx = x[j] - x[i], ddy = y[j] - y[i];
          const d2 = ddx * ddx + ddy * ddy;
          if (d2 >= d0 * d0 || d2 < 1e-12) continue;
          const d = Math.sqrt(d2);
          const nx = ddx / d, ny = ddy / d;
          const pen = (d0 - d) * 0.85;
          const wj = im[j];
          const wt = wi + wj;
          x[i] -= nx * pen * (wi / wt); y[i] -= ny * pen * (wi / wt);
          x[j] += nx * pen * (wj / wt); y[j] += ny * pen * (wj / wt);
          stat.contacts++;
          if (W.cc < W.ccCap) {
            const q = W.cc;
            W.cI[q] = i; W.cJ[q] = j;
            W.cNX[q] = nx; W.cNY[q] = ny; W.cK[q] = 0;
            W.cX[q] = x[i]; W.cY[q] = y[i];
            W.cc++;
          }
        }
      }
    }
  }
}

function collideShapes(W, S, stat) {
  const shapes = W.shapes;
  if (!shapes.length || !S.pairCollide) return;
  const G = W.grid;
  if (!G) return;
  const x = W.x, y = W.y, cr = W.cr, act = W.act, im = W.im;
  const ts = S.ts === undefined ? 1 : S.ts;
  for (let si = 0; si < shapes.length; si++) {
    const sh = shapes[si];
    if (!sh.alive) continue;
    let minX, minY, maxX, maxY;
    if (sh.kind === 'circle') {
      minX = sh.cx - sh.r; maxX = sh.cx + sh.r;
      minY = sh.cy - sh.r; maxY = sh.cy + sh.r;
    } else if (sh.kind === 'box') {
      const ca = Math.abs(Math.cos(sh.angle)), sa = Math.abs(Math.sin(sh.angle));
      const ex = sh.hw * ca + sh.hh * sa, ey = sh.hw * sa + sh.hh * ca;
      minX = sh.cx - ex; maxX = sh.cx + ex;
      minY = sh.cy - ey; maxY = sh.cy + ey;
    } else {
      minX = Math.min(sh.x0, sh.x1) - sh.r; maxX = Math.max(sh.x0, sh.x1) + sh.r;
      minY = Math.min(sh.y0, sh.y1) - sh.r; maxY = Math.max(sh.y0, sh.y1) + sh.r;
    }
    const pad = 16;
    let c0 = ((minX - pad) / G.cs + 1) | 0, c1 = ((maxX + pad) / G.cs + 1) | 0;
    let r0 = ((minY - pad) / G.cs + 1) | 0, r1 = ((maxY + pad) / G.cs + 1) | 0;
    if (c0 < 0) c0 = 0;
    if (r0 < 0) r0 = 0;
    if (c1 >= G.gw) c1 = G.gw - 1;
    if (r1 >= G.gh) r1 = G.gh - 1;
    for (let cy = r0; cy <= r1; cy++) {
      for (let cx = c0; cx <= c1; cx++) {
        const c = cy * G.gw + cx;
        const s0 = G.start[c], s1 = G.start[c + 1];
        for (let s = s0; s < s1; s++) {
          const i = G.items[s];
          if (!act[i] || im[i] === 0) continue;
          const px = x[i], py = y[i];
          const rr = cr[i] * ts + 0.5;
          let hx = 0, hy = 0, hp = 0, got = false;
          if (sh.kind === 'circle') {
            const dx = px - sh.cx, dy = py - sh.cy;
            const need = sh.r + rr;
            const d2 = dx * dx + dy * dy;
            if (d2 < need * need) {
              const d = Math.sqrt(d2);
              if (d > 1e-9) { hx = dx / d; hy = dy / d; hp = need - d; got = true; }
              else { hx = 0; hy = -1; hp = need; got = true; }
            }
          } else if (sh.kind === 'seg') {
            const ax = sh.x0, ay = sh.y0;
            const ex = sh.x1 - ax, ey = sh.y1 - ay;
            const l2 = ex * ex + ey * ey;
            let t = l2 > 0 ? ((px - ax) * ex + (py - ay) * ey) / l2 : 0;
            if (t < 0) t = 0; else if (t > 1) t = 1;
            const qx = ax + ex * t, qy = ay + ey * t;
            const dx = px - qx, dy = py - qy;
            const need = sh.r + rr;
            const d2 = dx * dx + dy * dy;
            if (d2 < need * need && d2 > 1e-12) {
              const d = Math.sqrt(d2);
              hx = dx / d; hy = dy / d; hp = need - d; got = true;
            }
          } else {
            const ca = Math.cos(-sh.angle), sa = Math.sin(-sh.angle);
            const dx0 = px - sh.cx, dy0 = py - sh.cy;
            const lx = dx0 * ca - dy0 * sa, ly = dx0 * sa + dy0 * ca;
            const inX = lx >= -sh.hw && lx <= sh.hw;
            const inY = ly >= -sh.hh && ly <= sh.hh;
            let nxl = 0, nyl = 0, pen = 0;
            if (inX && inY) {
              const ex1 = sh.hw - Math.abs(lx), ey1 = sh.hh - Math.abs(ly);
              if (ex1 < ey1) { nxl = lx < 0 ? -1 : 1; pen = ex1 + rr; }
              else { nyl = ly < 0 ? -1 : 1; pen = ey1 + rr; }
              const cb = Math.cos(sh.angle), sb = Math.sin(sh.angle);
              hx = nxl * cb - nyl * sb; hy = nxl * sb + nyl * cb; hp = pen;
              got = true;
            } else {
              const qx = lx < -sh.hw ? -sh.hw : (lx > sh.hw ? sh.hw : lx);
              const qy = ly < -sh.hh ? -sh.hh : (ly > sh.hh ? sh.hh : ly);
              const dx = lx - qx, dy = ly - qy;
              const d2 = dx * dx + dy * dy;
              if (d2 < rr * rr && d2 > 1e-12) {
                const d = Math.sqrt(d2);
                const nlx = dx / d, nly = dy / d;
                const cb = Math.cos(sh.angle), sb = Math.sin(sh.angle);
                hx = nlx * cb - nly * sb; hy = nlx * sb + nly * cb;
                hp = rr - d; got = true;
              }
            }
          }
          if (!got) continue;
          stat.contacts++;
          x[i] += hx * hp; y[i] += hy * hp;
          if (W.cc < W.ccCap) {
            const q = W.cc;
            W.cI[q] = i; W.cJ[q] = -2 - si;
            W.cNX[q] = hx; W.cNY[q] = hy; W.cK[q] = 1;
            W.cX[q] = px; W.cY[q] = py;
            W.cc++;
          }
        }
      }
    }
  }
}

function bounds(W, S) {
  const x = W.x, y = W.y, act = W.act, im = W.im, cr = W.cr;
  const ts = S.ts === undefined ? 1 : S.ts;
  for (let i = 0; i < W.n; i++) {
    if (!act[i] || im[i] === 0) continue;
    const r = cr[i] * ts;
    let hit = false, nx = 0, ny = 0;
    if (x[i] < r) { x[i] = r; hit = true; nx = 1; ny = 0; }
    else if (x[i] > W.W - r) { x[i] = W.W - r; hit = true; nx = -1; ny = 0; }
    if (y[i] < r) { y[i] = r; hit = true; nx = 0; ny = 1; }
    else if (y[i] > W.H - r) { y[i] = W.H - r; hit = true; nx = 0; ny = -1; }
    if (!hit) continue;
    if (W.cc < W.ccCap) {
      const q = W.cc;
      W.cI[q] = i; W.cJ[q] = -9999;
      W.cNX[q] = nx; W.cNY[q] = ny; W.cK[q] = 2;
      W.cX[q] = x[i]; W.cY[q] = y[i];
      W.cc++;
    }
  }
}

/* velocity-level restitution + Coulomb friction from the contact journal */
function resolveVelocities(W, S) {
  const vx = W.vx, vy = W.vy, im = W.im, act = W.act, x = W.x, y = W.y;
  const n = W.cc;
  const rest = S.restitution, mu = S.friction;
  for (let c = 0; c < n; c++) {
    const i = W.cI[c], j = W.cJ[c];
    const nx = W.cNX[c], ny = W.cNY[c], kind = W.cK[c];
    if (i < 0 || !act[i] || im[i] === 0) continue;
    let svx = 0, svy = 0, wsum = im[i];
    if (kind === 0) {
      if (j < 0 || !act[j] || im[j] === 0) continue;
      wsum = im[i] + im[j];
    } else if (kind === 1) {
      const sh = W.shapes[-2 - j];
      if (sh && (sh.vx || sh.vy || sh.omg)) {
        const dxc = x[i] - sh.cx, dyc = y[i] - sh.cy;
        svx = sh.vx - sh.omg * dyc;
        svy = sh.vy + sh.omg * dxc;
      }
    }
    const rvx = (kind === 0 ? vx[j] - vx[i] : vx[i] - svx);
    const rvy = (kind === 0 ? vy[j] - vy[i] : vy[i] - svy);
    const vn = rvx * nx + rvy * ny;
    const tx = -ny, ty = nx;
    const vt = kind === 0
      ? (vx[j] - vx[i]) * tx + (vy[j] - vy[i]) * ty
      : (vx[i] - svx) * tx + (vy[i] - svy) * ty;
    const inv = 1 / wsum;
    /* normal impulse (restitution).  For a pair the two equal-and-opposite
       impulses already produce the full relative change; for a static or
       kinematic obstacle the whole change has to go into the one particle. */
    if (vn < -18) {
      const p = -(1 + rest) * vn * inv;
      if (kind === 0) {
        vx[i] -= p * nx * im[i]; vy[i] -= p * ny * im[i];
        vx[j] += p * nx * im[j]; vy[j] += p * ny * im[j];
      } else {
        vx[i] += p * nx * im[i]; vy[i] += p * ny * im[i];
      }
    }
    /* tangential friction, clamped by mu * normal load proxy */
    const load = Math.abs(vn < 0 ? vn : 0) + 14;
    const jtMax = mu * load * inv;
    let jt = -vt * inv;
    if (jt > jtMax) jt = jtMax; else if (jt < -jtMax) jt = -jtMax;
    if (kind === 0) {
      vx[i] += jt * tx * im[i]; vy[i] += jt * ty * im[i];
      vx[j] -= jt * tx * im[j]; vy[j] -= jt * ty * im[j];
    } else if (im[i] > 0) {
      vx[i] += jt * tx * im[i]; vy[i] += jt * ty * im[i];
    }
    void x; void y;
  }
}

/* convex hull (monoutone chain) of a particle range -> array of indices */
function hullOf(W, start, count) {
  const pts = [];
  for (let i = 0; i < count; i++) pts.push([W.x[start + i], W.y[start + i], start + i]);
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  const out = [];
  for (const p of lower) out.push(p[2]);
  for (let i = 1; i + 1 < upper.length; i++) out.push(upper[i][2]);
  return out;
}

/* kinematic / static collider motion (spinner, orbiter, slider) */
function updateShapes(W, dt) {
  for (let i = 0; i < W.shapes.length; i++) {
    const sh = W.shapes[i];
    if (!sh.alive) continue;
    if (sh.spin) {
      sh.angle += sh.spin * dt;
      sh.omg = sh.spin;
      sh.vx = 0; sh.vy = 0;
    } else if (sh.slide) {
      const s2 = sh.slide;
      sh.cx += s2.vx * dt;
      if (sh.cx < s2.min) { sh.cx = s2.min; s2.vx = -s2.vx; }
      else if (sh.cx > s2.max) { sh.cx = s2.max; s2.vx = -s2.vx; }
      sh.vx = s2.vx; sh.vy = 0; sh.omg = 0;
    } else {
      sh.omg = 0; sh.vx = 0; sh.vy = 0;
    }
  }
}

/* ------------------------------------------------------------------ stepping */

function checkTear(W, S) {
  let tears = 0;
  const thr = S.tear;
  const x = W.x, y = W.y;
  for (let k = 0; k < W.pc; k++) {
    if (!W.palive[k]) continue;
    const a = W.pa[k], b = W.pb[k];
    const dx = x[b] - x[a], dy = y[b] - y[a];
    const d = Math.sqrt(dx * dx + dy * dy);
    const rest = W.prest[k];
    const strain = (d - rest) / rest;
    if (strain > thr / (TEAR_FACTOR[W.pcls[k]] || 1)) {
      W.palive[k] = 0; W.pstr[k] = 1; tears++;
    }
  }
  W.stats.tears += tears;
}

function stepFrame(W, S, dt) {
  const stat = W.stats;
  updateShapes(W, dt);
  const subs = Math.max(1, S.substeps | 0);
  const iters = Math.max(1, S.iters | 0);
  stat.pairsTested = 0; stat.contacts = 0; stat.maxErr = 0;
  stat.consTested = 0;
  stat.maxStrain = 0; stat.tears = 0;
  stat.iters = iters; stat.subs = subs;
  /* Contact skin scales with the discretisation spacing: a skin smaller
     than the particle spacing lets one body slip through another, because
     the two lattices never generate enough overlapping pairs. */
  const ts = Math.max(0.2, Math.min(2.4, S.thick / 6));
  S.ts = ts;
  const skin = W.maxCr * 2 * ts;
  S.maxStep = Math.max(4, skin);
  const wantCell = Math.max(10, Math.round(skin * 1.3));
  if (W.grid && (W.grid.cs !== wantCell || W.grid.mcr !== W.maxCr)) W.grid = null;
  S.cellSize = wantCell;
  const h = dt / subs;
  computeAeroNormals(W);
  const collide = S.selfCollide || S.pairCollide;
  for (let s = 0; s < subs; s++) {
    integrate(W, S, h);
    for (let it = 0; it < iters; it++) {
      solvePairs(W, S, stat);
      solveArea(W, S, stat);
      if (it % 2 === 1) solveGrab(W, S);
    }
    solveGrab(W, S);
    /* one contact journal per substep: stale normals must not leak over */
    W.cc = 0;
    if (collide) {
      buildGrid(W, S);
      if (S.pairCollide) collideShapes(W, S, stat);
      collidePairs(W, S, stat);
    }
    bounds(W, S);                       /* the world box always contains */
    /* velocity update from the corrected positions */
    const x = W.x, y = W.y, vx = W.vx, vy = W.vy, ox = W.ox, oy = W.oy;
    const im = W.im, act = W.act, pin = W.pin;
    for (let i = 0; i < W.n; i++) {
      if (!act[i] || im[i] === 0) continue;
      if (pin[i]) { x[i] = W.px[i]; y[i] = W.py[i]; vx[i] = 0; vy[i] = 0; continue; }
      vx[i] = (x[i] - ox[i]) / h;
      vy[i] = (y[i] - oy[i]) / h;
    }
    if (collide) resolveVelocities(W, S);
    if (S.tearOn) checkTear(W, S);
    W.t += h;
  }
  /* final strain snapshot for the stress visualisation */
  const x2 = W.x, y2 = W.y;
  for (let k = 0; k < W.pc; k++) {
    if (!W.palive[k]) continue;
    const a = W.pa[k], b = W.pb[k];
    const dx = x2[b] - x2[a], dy = y2[b] - y2[a];
    const d = Math.sqrt(dx * dx + dy * dy);
    const st = (d - W.prest[k]) / W.prest[k];
    W.pstr[k] = st < 0 ? -st : st;
  }
  let parts = 0;
  for (let i = 0; i < W.n; i++) if (W.act[i]) parts++;
  let cons = 0;
  for (let k = 0; k < W.pc; k++) if (W.palive[k]) cons++;
  for (let k = 0; k < W.ac; k++) if (W.aAlive[k]) cons++;
  stat.parts = parts; stat.cons = cons;
}

function nearestParticle(W, x, y, r) {
  let best = -1, bd = r * r;
  for (let i = 0; i < W.n; i++) {
    if (!W.act[i]) continue;
    const dx = W.x[i] - x, dy = W.y[i] - y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bd) { bd = d2; best = i; }
  }
  return best;
}

/* weld particle i to the closest particle of `body` with an attachment link */
function weldNearest(W, i, body, maxDist) {
  let best = -1, bd = (maxDist || 1e9) * (maxDist || 1e9);
  for (let k = body.p0; k < body.p0 + body.pn; k++) {
    if (!W.act[k] || k === i) continue;
    const dx = W.x[k] - W.x[i], dy = W.y[k] - W.y[i];
    const d2 = dx * dx + dy * dy;
    if (d2 < bd) { bd = d2; best = k; }
  }
  if (best >= 0) addPair(W, i, best, undefined, CL_ATTACH);
  return best;
}

function applyImpulse(W, x, y, r, dx, dy, k) {
  let n = 0;
  for (let i = 0; i < W.n; i++) {
    if (!W.act[i] || W.im[i] === 0 || W.pin[i]) continue;
    const ddx = W.x[i] - x, ddy = W.y[i] - y;
    const d2 = ddx * ddx + ddy * ddy;
    if (d2 > r * r) continue;
    const f = k * (1 - Math.sqrt(d2) / r);
    W.vx[i] += dx * f; W.vy[i] += dy * f;
    n++;
  }
  return n;
}

function cutSegment(W, x0, y0, x1, y1) {
  let cut = 0;
  const ex = x1 - x0, ey = y1 - y0;
  const l2 = ex * ex + ey * ey;
  if (l2 < 1e-9) {
    for (let k = 0; k < W.pc; k++) {
      if (!W.palive[k]) continue;
      const a = W.pa[k], b = W.pb[k];
      const mx = (W.x[a] + W.x[b]) * 0.5 - x0, my = (W.y[a] + W.y[b]) * 0.5 - y0;
      if (mx * mx + my * my < 100) { W.palive[k] = 0; cut++; }
    }
    return cut;
  }
  for (let k = 0; k < W.pc; k++) {
    if (!W.palive[k]) continue;
    const a = W.pa[k], b = W.pb[k];
    const ax = W.x[a], ay = W.y[a];
    const c1x = W.x[b] - ax, c1y = W.y[b] - ay;
    const den = ex * c1y - ey * c1x;
    if (den > -1e-9 && den < 1e-9) continue;
    const rx = ax - x0, ry = ay - y0;
    const t = (rx * c1y - ry * c1x) / den;
    if (t < 0 || t > 1) continue;
    const u = (rx * ey - ry * ex) / den;
    if (u >= 0 && u <= 1) { W.palive[k] = 0; cut++; }
  }
  return cut;
}

function eraseBody(W, x, y, r) {
  for (let bi = W.bodies.length - 1; bi >= 0; bi--) {
    const b = W.bodies[bi];
    if (b.dead) continue;
    let found = false;
    for (let i = b.p0; i < b.p0 + b.pn; i++) {
      if (!W.act[i]) continue;
      const dx = W.x[i] - x, dy = W.y[i] - y;
      if (dx * dx + dy * dy < r * r) { found = true; break; }
    }
    if (!found) continue;
    b.dead = true;
    for (let i = b.p0; i < b.p0 + b.pn; i++) W.act[i] = 0;
    for (let k = 0; k < W.pc; k++) {
      if (W.palive[k] && (!W.act[W.pa[k]] || !W.act[W.pb[k]])) W.palive[k] = 0;
    }
    for (let k = 0; k < W.ac; k++) {
      if (!W.aAlive[k]) continue;
      for (let j = 0; j < W.aCnt[k]; j++) {
        if (!W.act[W.poly[W.aOff[k] + j]]) { W.aAlive[k] = 0; break; }
      }
    }
    return b;
  }
  return null;
}

const CORE_API = {
  makeWorld, addBody, addP, addPair, addArea, addShape, pinP, unpinP,
  buildCloth, buildChain, buildBlob, buildJelly, buildCluster, hullOf,
  updateShapes, stepFrame, nearestParticle, cutSegment, eraseBody,
  weldNearest, applyImpulse,
  CL_STRUCT, CL_SHEAR, CL_BEND, CL_ATTACH, BK_CLOTH, BK_ROPE, BK_BLOB,
  BK_JELLY, WORLD_W, WORLD_H
};
/*==CORE-END==*/

/* ============================================================================
 * PHYSICS CORE END
 * ==========================================================================*/