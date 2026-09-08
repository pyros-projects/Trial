'use strict';
/* =====================================================================
   FALLING-SAND ALCHEMY — cellular material engine
   Typed-array grid, chunked active-region updates, heat diffusion,
   phase changes, chemistry, charge transport, impulse fields,
   8-way gravity.  No external dependencies.
   ===================================================================== */

/* ---------- deterministic RNG (xorshift32) ---------- */
let _rs = 123456789;
function srand(s) { _rs = (s >>> 0) || 1; }
function rnd() {
  let x = _rs | 0;
  x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  _rs = x | 0;
  return (x >>> 0) / 4294967296;
}
function ri(n) { return (rnd() * n) | 0; }
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

/* ---------- material system ---------- */
const CAT_VOID = 0, CAT_SOLID = 1, CAT_POW = 2, CAT_LIQ = 3, CAT_GAS = 4;
const CAT_NAME = ['void', 'solid', 'powder', 'liquid', 'gas'];
const MATS = [], NAMES = [];
function def(name, o) {
  MATS.push({
    n: name,
    cat: o.cat,
    dens: o.dens == null ? 1 : o.dens,
    col: o.col || [140, 140, 140],
    vr: o.vr == null ? 8 : o.vr,
    cond: o.cond == null ? 0.08 : o.cond,
    elec: o.elec || 0,
    corr: o.corr || 0,
    ign: o.ign || 0,
    fuel: o.fuel || 0,
    to: o.to == null ? -1 : o.to,
    mob: o.mob == null ? 0 : o.mob,
    life: o.life || 0,
    t0: o.t0 == null ? null : o.t0,
    src: !!o.src,
    flame: !!o.flame,
    expl: o.expl || 0,
    trans: o.trans || null,
    paint: o.paint !== false,
    hint: o.hint || ''
  });
  NAMES.push(name);
  return MATS.length - 1;
}
function tr(v, to, way) { return { v: v, to: to, w: way }; }

const EMPTY = def('EMPTY', { cat: CAT_VOID, col: [8, 11, 16], vr: 3, paint: false });
const WALL = def('WALL', { cat: CAT_SOLID, col: [86, 92, 102], vr: 10, cond: 0.30, hint: 'immutable' });
const SAND = def('SAND', { cat: CAT_POW, col: [196, 172, 106], vr: 22, dens: 2.6, cond: 0.25, corr: 0.05, mob: 0.72, trans: [tr(1350, 20, 'u')], hint: 'melts to glass' });
const STONE = def('STONE', { cat: CAT_POW, col: [102, 104, 112], vr: 14, dens: 2.7, cond: 0.42, corr: 0.28, mob: 0.5, hint: 'quench crust, does not re-melt' });
const SOIL = def('SOIL', { cat: CAT_POW, col: [84, 60, 40], vr: 14, dens: 1.8, cond: 0.2, corr: 0.18, mob: 0.6 });
const SALT = def('SALT', { cat: CAT_POW, col: [224, 228, 232], vr: 16, dens: 2.16, cond: 0.3, elec: 0.5, corr: 0.4, mob: 0.66, hint: 'dissolves in water' });
const ASH = def('ASH', { cat: CAT_POW, col: [126, 122, 116], vr: 14, dens: 0.75, cond: 0.12, corr: 0.05, mob: 0.66 });
const CHAR = def('CHAR', { cat: CAT_POW, col: [40, 37, 38], vr: 10, dens: 0.9, cond: 0.35, elec: 0.85, corr: 0.1, ign: 240, fuel: 45, to: ASH, mob: 0.6, hint: 'slow burn' });
const RUST = def('RUST', { cat: CAT_POW, col: [142, 78, 40], vr: 16, dens: 5.0, cond: 0.22, elec: 0.3, corr: 0.06, mob: 0.58 });
const WOOD = def('WOOD', { cat: CAT_SOLID, col: [114, 76, 45], vr: 16, dens: 0.85, cond: 0.18, corr: 0.32, ign: 200, fuel: 16, to: CHAR, hint: 'smoulders to char' });
const PLANT = def('PLANT', { cat: CAT_SOLID, col: [56, 142, 60], vr: 30, dens: 0.6, cond: 0.16, elec: 0.35, corr: 0.5, ign: 110, fuel: 10, to: ASH, life: 46, hint: 'grows, drinks water' });
const GLASS = def('GLASS', { cat: CAT_SOLID, col: [148, 204, 214], vr: 14, dens: 2.5, cond: 0.55, corr: 0, hint: 'acid proof' });
const PLASTIC = def('PLASTIC', { cat: CAT_SOLID, col: [70, 82, 104], vr: 12, dens: 1.2, cond: 0.12, corr: 0.02, ign: 165, fuel: 26, trans: [tr(230, 17, 'u')], hint: 'melts then burns' });
const METAL = def('METAL', { cat: CAT_SOLID, col: [136, 146, 158], vr: 12, dens: 7.8, cond: 0.95, elec: 1, corr: 0.85, trans: [tr(1420, 20, 'u')], hint: 'conducts current + heat' });
const BATT = def('BATTERY', { cat: CAT_SOLID, col: [224, 178, 52], vr: 12, dens: 7.5, cond: 0.9, elec: 1, src: true, hint: 'always live' });
const WATER = def('WATER', { cat: CAT_LIQ, col: [42, 96, 190], vr: 20, dens: 1.0, cond: 0.55, elec: 0.4, corr: 0.02, mob: 0.85, trans: [tr(-1, 28, 'd'), tr(99, 24, 'u')], hint: 'quenches fire' });
const BRINE = def('BRINE', { cat: CAT_LIQ, col: [72, 132, 178], vr: 16, dens: 1.03, cond: 0.5, elec: 0.95, corr: 0.08, mob: 0.8, trans: [tr(-7, 28, 'd'), tr(103, 24, 'u')], hint: 'freezes at -7 C' });
const OIL = def('OIL', { cat: CAT_LIQ, col: [66, 48, 60], vr: 12, dens: 0.85, cond: 0.2, elec: 0.02, corr: 0.05, ign: 115, fuel: 55, mob: 0.62, hint: 'floats, burns' });
const ACID = def('ACID', { cat: CAT_LIQ, col: [126, 206, 52], vr: 22, dens: 1.2, cond: 0.45, elec: 0.9, corr: 0.02, mob: 0.7, life: 255, trans: [tr(112, 23, 'u')], hint: 'eats metal, wood, stone' });
const LAVA = def('LAVA', { cat: CAT_LIQ, col: [228, 96, 34], vr: 28, dens: 2.9, cond: 0.45, mob: 0.30, t0: 1500, src: true, trans: [tr(880, 3, 'd')], hint: 'molten rock' });
const MOLTEN = def('MOLTEN', { cat: CAT_LIQ, col: [242, 156, 66], vr: 22, dens: 7.8, cond: 0.9, elec: 1, mob: 0.5, t0: 1650, trans: [tr(1300, 13, 'd')], hint: 'dense + white hot' });
const GMOLT = def('GLASMOLT', { cat: CAT_LIQ, col: [236, 176, 152], vr: 18, dens: 2.4, cond: 0.5, mob: 0.36, t0: 1500, trans: [tr(1150, 11, 'd')], hint: 'cools to glass' });
const FIRE = def('FIRE', { cat: CAT_GAS, col: [255, 188, 78], vr: 46, dens: 0.30, cond: 0.75, flame: true, life: 22, mob: 0.72, t0: 760, hint: 'flame' });
const SMOKE = def('SMOKE', { cat: CAT_GAS, col: [84, 82, 84], vr: 16, dens: 0.35, cond: 0.4, life: 110, mob: 0.55 });
const STEAM = def('STEAM', { cat: CAT_GAS, col: [188, 214, 232], vr: 18, dens: 0.40, cond: 0.6, life: 170, mob: 0.7, t0: 108, trans: [tr(94, 15, 'd')], hint: 'condenses to water' });
const GAS = def('GAS', { cat: CAT_GAS, col: [150, 192, 150], vr: 20, dens: 0.22, cond: 0.35, ign: 85, fuel: 6, expl: 2.6, life: 200, mob: 0.78, hint: 'explosive vapour' });
const POWDER = def('GUNPOWDER', { cat: CAT_POW, col: [68, 64, 72], vr: 14, dens: 1.7, cond: 0.25, elec: 1, ign: 145, fuel: 6, expl: 8.5, mob: 0.7, hint: 'detonates' });
const SPARK = def('SPARK', { cat: CAT_GAS, col: [196, 240, 255], vr: 34, dens: 0.1, cond: 0.6, elec: 1, flame: true, life: 6, mob: 0.8, t0: 420, hint: 'live current' });
const ICE = def('ICE', { cat: CAT_SOLID, col: [140, 196, 228], vr: 16, dens: 0.92, cond: 0.75, corr: 0.25, trans: [tr(1, 15, 'u')], t0: -14, hint: 'freezes water it touches' });
const SNOW = def('SNOW', { cat: CAT_POW, col: [232, 240, 248], vr: 12, dens: 0.3, cond: 0.5, corr: 0.1, mob: 0.75, trans: [tr(1, 15, 'u')], t0: -14 });

const NICE_MATS = [SAND, STONE, SOIL, SALT, ASH, CHAR, RUST, WOOD, PLANT, GLASS, PLASTIC, METAL, BATT, WATER, BRINE, OIL, ACID, LAVA, MOLTEN, GMOLT, FIRE, SMOKE, STEAM, GAS, POWDER, SPARK, ICE, SNOW, WALL];

/* ---------- tunable parameters ---------- */
const P = {
  speed: 60, substeps: 1, cellPx: 3,
  gdir: 0, grav: 1, ambient: 20, heatRate: 0.40, rxnRate: 1,
  mobility: 0.55, diffusion: 0.5, firePow: 1, blastPow: 1, mode: 0
};

/* ---------- grid buffers ---------- */
const CS = 16, CSH = 4;
let W = 0, H = 0, N = 0, WW = 0, HH = 0, NC = 0;
let mat, temp, vx, vy, life, chgA, chgB, flags, cvar, stamp, orderU, react, alive;
let actA, actB, lstA, lstB, lstAN = 0, lstBN = 0, inStep = false;
let cntBuf, posBuf, sortedBuf, rowStart;
let qa, qb, qaN = 0, qbN = 0, QCAP = 40000;
let gen = 1, stepNo = 0, rxnCount = 0, activeChunks = 0;
let shocks = [], emitters = [], vents = [];
let paused = false;

const GX8 = [[0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1], [1, 0], [1, 1]];
const GNAME = ['down', 'down-left', 'left', 'up-left', 'up', 'up-right', 'right', 'down-right'];
let MX = 0, MY = 1, LX = 1, LY = 0;

function setGravityDir(g) {
  P.gdir = ((g % 8) + 8) % 8;
  const v = GX8[P.gdir];
  MX = v[0]; MY = v[1];
  if (MX === 0) { LX = 1; LY = 0; }
  else if (MY === 0) { LX = 0; LY = 1; }
  else { LX = -MY; LY = MX; }
}
setGravityDir(0);

function allocWorld(w, h, seed) {
  W = w; H = h; N = w * h;
  WW = Math.ceil(w / CS); HH = Math.ceil(h / CS); NC = WW * HH;
  mat = new Uint8Array(N); temp = new Float32Array(N);
  vx = new Float32Array(N); vy = new Float32Array(N);
  life = new Uint8Array(N); chgA = new Uint8Array(N); chgB = new Uint8Array(N);
  flags = new Uint8Array(N); cvar = new Uint8Array(N); stamp = new Uint8Array(N);
  orderU = new Uint16Array(N); react = new Uint8Array(N); alive = new Uint8Array(N);
  actA = new Uint8Array(NC); actB = new Uint8Array(NC);
  lstA = new Int32Array(NC + 8); lstB = new Int32Array(NC + 8);
  cntBuf = new Int32Array(HH + 2); posBuf = new Int32Array(HH + 2);
  sortedBuf = new Int32Array(NC + 8); rowStart = new Int32Array(HH + 2);
  QCAP = Math.max(1024, Math.min(N, 100000));
  qa = new Int32Array(QCAP); qb = new Int32Array(QCAP);
  lstAN = 0; lstBN = 0; inStep = false; qaN = 0; qbN = 0;
  shocks = []; emitters = []; vents = []; activeChunks = 0;
  srand(seed == null ? 1337 : seed);
  for (let i = 0; i < N; i++) { temp[i] = P.ambient; cvar[i] = (rnd() * 255) | 0; }
}

/* ---------- region activation ----------
   actA/lstA hold the set to process on the NEXT step; actB/lstB collect the
   set after that.  wake() feeds the collection buffer (during a step) while
   wakeLive() feeds the pending set (between steps, e.g. from the pointer). */
function wake(c) {
  if (c < 0 || c >= NC || lstBN >= NC + 8) return;
  if (!actB[c]) { actB[c] = 1; lstB[lstBN++] = c; }
}
function wakeLive(c) {
  if (c < 0 || c >= NC || lstAN >= NC + 8) return;
  if (!actA[c]) { actA[c] = 1; lstA[lstAN++] = c; }
}
function mark(c) { if (inStep) wake(c); else wakeLive(c); }
function wakeAt(x, y) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const cx = x >> CSH, cy = y >> CSH;
  const c = cy * WW + cx;
  mark(c);
  if ((x & 15) === 0 && cx > 0) mark(c - 1);
  else if ((x & 15) === 15 && cx + 1 < WW) mark(c + 1);
  if ((y & 15) === 0 && cy > 0) mark(c - WW);
  else if ((y & 15) === 15 && cy + 1 < HH) mark(c + WW);
}
function wakeRect(x0, y0, x1, y1) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) wakeAt(x, y);
}
function inb(x, y) { return x >= 0 && x < W && y >= 0 && y < H; }
function at(x, y) { return inb(x, y) ? mat[y * W + x] : WALL; }
function tempAt(x, y) { return inb(x, y) ? temp[y * W + x] : P.ambient; }

/* ---------- editing ---------- */
function putRaw(x, y, m, t, lf) {
  if (!inb(x, y)) return;
  const i = y * W + x;
  mat[i] = m;
  if (t != null) temp[i] = t;
  life[i] = lf != null ? lf : (MATS[m].life || MATS[m].fuel || 0);
  flags[i] = 0;
  if (m === BATT && !(flags[i] & 4) && emitters.length < 4096) { flags[i] |= 4; emitters.push(i); }
  wakeAt(x, y);
}

/* ---------- density / displacement ---------- */
function canEnter(mi, mj) {
  if (mj === EMPTY) return true;
  const a = MATS[mi], b = MATS[mj];
  if (b.cat === CAT_SOLID) return false;
  if (a.cat === CAT_POW) {
    if (b.cat === CAT_LIQ || b.cat === CAT_GAS) return a.dens > b.dens * 1.12;
    if (b.cat === CAT_POW) return a.dens > b.dens * 1.45;
    return false;
  }
  if (a.cat === CAT_LIQ) {
    if (b.cat === CAT_LIQ) return a.dens > b.dens * 1.04;
    if (b.cat === CAT_GAS) return true;
    return false;
  }
  if (a.cat === CAT_GAS) {
    if (b.cat === CAT_LIQ) return a.dens < b.dens * 0.6;
    if (b.cat === CAT_GAS) return a.dens < b.dens * 0.7;
    return false;
  }
  return false;
}
function isMover(m) { const c = MATS[m].cat; return c === CAT_POW || c === CAT_LIQ || c === CAT_GAS; }

function moveTo(i, j) {
  mat[j] = mat[i]; temp[j] = temp[i];
  vx[j] = vx[i]; vy[j] = vy[i]; life[j] = life[i];
  flags[j] = flags[i]; cvar[j] = cvar[i];
  mat[i] = EMPTY; temp[i] = P.ambient;
  vx[i] = 0; vy[i] = 0; life[i] = 0; flags[i] = 0;
  stamp[j] = gen; stamp[i] = gen;
}
function swapC(i, j) {
  let t;
  t = mat[i]; mat[i] = mat[j]; mat[j] = t;
  t = temp[i]; temp[i] = temp[j]; temp[j] = t;
  t = vx[i]; vx[i] = vx[j]; vx[j] = t;
  t = vy[i]; vy[i] = vy[j]; vy[j] = t;
  t = life[i]; life[i] = life[j]; life[j] = t;
  t = flags[i]; flags[i] = flags[j]; flags[j] = t;
  t = cvar[i]; cvar[i] = cvar[j]; cvar[j] = t;
  t = chgA[i]; chgA[i] = chgA[j]; chgA[j] = t;
  stamp[i] = gen; stamp[j] = gen;
}

/* 8-neighbour offsets, allocated once (shared by combustion + corrosion) */
const D8X = Int8Array.from([-1, 0, 1, -1, 1, -1, 0, 1]);
const D8Y = Int8Array.from([-1, -1, -1, 0, 0, 1, 1, 1]);

/* ---------- combustion ---------- */
function isSmould(i) { return (flags[i] & 2) !== 0; }
function ignite(x, y, i) {
  const m = mat[i], d = MATS[m];
  if (m === EMPTY || m === FIRE) return;
  rxnCount++;
  react[i] = 255;
  if (d.expl > 0) {
    mat[i] = EMPTY; temp[i] = 950;
    explode(x, y, d.expl * P.blastPow * 1.3, true);
    return;
  }
  if (m === PLASTIC) {
    if (rnd() < 0.5) { mat[i] = OIL; life[i] = MATS[OIL].fuel; temp[i] = Math.max(temp[i], 270); }
    else { mat[i] = FIRE; life[i] = 10; temp[i] = 740; }
    return;
  }
  if (m === OIL || m === GAS) {
    mat[i] = FIRE; life[i] = m === GAS ? 5 : 14; temp[i] = m === GAS ? 950 : 720;
    if (m === GAS) explode(x, y, MATS[GAS].expl * P.blastPow, true);
    return;
  }
  if (isSmould(i)) return;
  flags[i] |= 2;
  if (life[i] === 0 || life[i] > 200) life[i] = d.fuel || 40;
  /* flaming combustion: if the fuel touches a gas gap a real flame appears
     there, which is what makes a fire climb through a structure */
  if (rnd() < 0.5 * P.firePow) {
    for (let n = 0; n < 8; n++) {
      const nx = x + D8X[n], ny = y + D8Y[n];
      if (!inb(nx, ny)) continue;
      const k = ny * W + nx;
      if (mat[k] === EMPTY || MATS[mat[k]].cat === CAT_GAS) {
        mat[k] = FIRE; life[k] = 12; temp[k] = Math.max(temp[k], 720);
        wakeAt(nx, ny);
        break;
      }
    }
  }
}

/* ---------- explosions: expanding pressure ring ---------- */
function explode(cx, cy, power, fromMaterial) {
  if (shocks.length > 44) return;
  const pw = clamp(power, 0.5, 40);
  shocks.push({ x: cx, y: cy, r: 1.2, max: 6 + pw * 2.8, st: pw * (fromMaterial ? 0.55 : 1), born: stepNo });
  const r0 = 1.2 + pw * 0.34;
  const y0 = Math.max(0, (cy - r0) | 0), y1 = Math.min(H - 1, (cy + r0) | 0);
  const x0 = Math.max(0, (cx - r0) | 0), x1 = Math.min(W - 1, (cx + r0) | 0);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx, dy = y - cy, d2 = dx * dx + dy * dy;
      if (d2 > r0 * r0) continue;
      const i = y * W + x, m = mat[i];
      if (m === EMPTY) { if (rnd() < 0.55) { mat[i] = FIRE; life[i] = 8 + ri(8); temp[i] = 900; } }
      else if (m === WATER || m === BRINE) { if (rnd() < 0.25) { mat[i] = STEAM; life[i] = 90; temp[i] = 130; } }
      else if (MATS[m].ign > 0 && m !== FIRE) { if (rnd() < 0.7) ignite(x, y, i); }
      else if (isMover(m)) {
        const d = Math.sqrt(d2) || 1, k = pw * 1.5 / d;
        vx[i] += dx / d * k; vy[i] += dy / d * k * 0.8;
      }
    }
  }
  wakeRect(Math.max(0, (cx - r0 - 1) | 0), Math.max(0, (cy - r0 - 1) | 0),
    Math.min(W - 1, (cx + r0 + 1) | 0), Math.min(H - 1, (cy + r0 + 1) | 0));
  rxnCount += 8;
}
function passShock() {
  for (let s = shocks.length - 1; s >= 0; s--) {
    const sw = shocks[s];
    sw.r += 1.5 + sw.st * 0.14;
    sw.st *= 0.85;
    if (sw.st < 0.06 || sw.r > sw.max) { shocks.splice(s, 1); continue; }
    const r = sw.r, band = 2.6;
    const x0 = Math.max(0, (sw.x - r - band) | 0), x1 = Math.min(W - 1, (sw.x + r + band) | 0);
    const y0 = Math.max(0, (sw.y - r - band) | 0), y1 = Math.min(H - 1, (sw.y + r + band) | 0);
    let touched = 0;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x - sw.x, dy = y - sw.y, d2 = dx * dx + dy * dy;
        if (d2 > r * r || d2 < (r - band) * (r - band)) continue;
        const i = y * W + x, m = mat[i];
        if (m === EMPTY || MATS[m].cat === CAT_SOLID) continue;
        const d = Math.sqrt(d2) || 1;
        const k = sw.st * 0.85 / (1 + d * 0.04);
        const ux = dx / d, uy = dy / d;
        vx[i] = vx[i] * 0.35 + ux * k;
        vy[i] = vy[i] * 0.35 + uy * k * 0.7;
        if (react[i] < 190) react[i] = 190;
        if (++touched % 20 === 0) wakeAt(x, y);
      }
    }
  }
}

/* ---------- electrical conduction ---------- */
function live(m) { return m !== EMPTY && MATS[m].elec > 0; }
/* queue a charge injection that becomes visible on the next step */
function pushCharge(j, lvl) {
  if (qbN >= QCAP) return;
  if (chgB[j] === 0) qb[qbN++] = j;
  if (chgB[j] < lvl) chgB[j] = lvl;
}
/* inject into the live field (called between steps, e.g. by the paint tool) */
function chargeNow(i, lvl) {
  if (qaN >= QCAP) return;
  if (chgA[i] < lvl) chgA[i] = lvl;
  qa[qaN++] = i;
}
function passElec() {
  /* drain injections queued during last step's physics pass */
  if (qbN > 0) {
    for (let k = 0; k < qbN; k++) {
      const i = qb[k];
      const v = chgB[i];
      chgB[i] = 0;
      if (v > 1 && mat[i] !== EMPTY && qaN < QCAP) {
        if (chgA[i] < v) chgA[i] = v;
        qa[qaN++] = i;
      }
    }
    qbN = 0;
  }
  const cap = QCAP;
  for (let k = 0; k < qaN; k++) {
    const i = qa[k];
    const lvl = chgA[i];
    chgA[i] = 0;
    if (lvl <= 1 || mat[i] === EMPTY) continue;
    const x = i % W, y = (i / W) | 0;
    temp[i] += 0.4 + lvl * 0.012;
    const nl = lvl - 1;
    for (let n = 0; n < 4; n++) {
      const nx = x + (n === 0 ? -1 : n === 1 ? 1 : 0);
      const ny = y + (n === 2 ? -1 : n === 3 ? 1 : 0);
      if (!inb(nx, ny)) continue;
      const j = ny * W + nx;
      const mj = mat[j];
      if (live(mj) && rnd() < 0.5 + MATS[mj].elec * 0.5) {
        if (chgB[j] < nl) { pushCharge(j, nl); react[j] = 200; }
      } else if (mj === EMPTY && lvl > 6) {
        const gx = nx + (n === 0 ? -1 : n === 1 ? 1 : 0);
        const gy = ny + (n === 2 ? -1 : n === 3 ? 1 : 0);
        if (inb(gx, gy) && live(mat[gy * W + gx]) && rnd() < 0.4) {
          pushCharge(gy * W + gx, lvl - 3);
          if (mat[j] === EMPTY && rnd() < 0.5) { mat[j] = SPARK; life[j] = 4; temp[j] = 380; }
          wakeAt(nx, ny);
        }
      }
      const mm = mat[j];
      if (mm !== FIRE && MATS[mm].ign > 0 && rnd() < 0.2 * P.firePow) ignite(nx, ny, j);
      else if (mm === GAS && rnd() < 0.45) ignite(nx, ny, j);
      else if ((mm === WATER || mm === BRINE) && lvl > 12 && rnd() < 0.004 * P.rxnRate) {
        react[j] = 200; rxnCount++;
        if (rnd() < 0.3) { mat[j] = GAS; life[j] = 60; }
      }
    }
    if (k > 9000) break;
  }
  /* batteries keep pushing current into every conductor they touch */
  let w = 0;
  for (let k = 0; k < emitters.length; k++) {
    const i = emitters[k];
    if (mat[i] !== BATT) continue;
    const x = i % W, y = (i / W) | 0;
    pushCharge(i, 42);
    for (let n = 0; n < 4; n++) {
      const nx = x + (n === 0 ? -1 : n === 1 ? 1 : 0);
      const ny = y + (n === 2 ? -1 : n === 3 ? 1 : 0);
      if (!inb(nx, ny)) continue;
      const j = ny * W + nx;
      if (live(mat[j])) pushCharge(j, 40);
    }
    emitters[w++] = i;
    wakeAt(x, y);
  }
  emitters.length = w;
  const ta = chgA; chgA = chgB; chgB = ta;
  const tq = qa; qa = qb; qb = tq;
  qaN = qbN; qbN = 0;
}

/* ---------- heat diffusion ---------- */
let sortedN = 0;
function passHeat() {
  const k = P.heatRate;
  if (k <= 0) return;
  const amb = P.ambient;
  for (let idx = 0; idx < sortedN; idx++) {
    const c = sortedBuf[idx];
    const cx0 = (c % WW) * CS, cy0 = ((c / WW) | 0) * CS;
    const xe = Math.min(cx0 + CS, W), ye = Math.min(cy0 + CS, H);
    for (let y = cy0; y < ye; y++) {
      let i = y * W + cx0;
      for (let x = cx0; x < xe; x++, i++) {
        const m = mat[i];
        if (m === EMPTY) { continue; }
        const d = MATS[m];
        const t = temp[i];
        let sum = 0;
        if (x > 0) { const j = i - 1; if (mat[j] !== EMPTY) sum += (temp[j] - t) * (d.cond + MATS[mat[j]].cond) * 0.5; }
        if (x < W - 1) { const j = i + 1; if (mat[j] !== EMPTY) sum += (temp[j] - t) * (d.cond + MATS[mat[j]].cond) * 0.5; }
        if (y > 0) { const j = i - W; if (mat[j] !== EMPTY) sum += (temp[j] - t) * (d.cond + MATS[mat[j]].cond) * 0.5; }
        if (y < H - 1) { const j = i + W; if (mat[j] !== EMPTY) sum += (temp[j] - t) * (d.cond + MATS[mat[j]].cond) * 0.5; }
        let nt = t + sum * k * 0.25;
        if ((d.src || d.flame) && d.t0 != null) {
          /* flames and magma bodies are heat sources: they hold their
             temperature unless something cold (water/ice/brine) is in contact,
             which lets a quenched crust actually form instead of instantly
             re-melting */
          let quench = false;
          if (x > 0 && (mat[i - 1] === WATER || mat[i - 1] === BRINE || mat[i - 1] === ICE)) quench = true;
          if (!quench && x < W - 1 && (mat[i + 1] === WATER || mat[i + 1] === BRINE || mat[i + 1] === ICE)) quench = true;
          if (!quench && y > 0 && (mat[i - W] === WATER || mat[i - W] === BRINE || mat[i - W] === ICE)) quench = true;
          if (!quench && y < H - 1 && (mat[i + W] === WATER || mat[i + W] === BRINE || mat[i + W] === ICE)) quench = true;
          if (quench) { nt -= 26; react[i] = 200; }
          else nt += (d.t0 - nt) * 0.05;
        } else nt += (amb - t) * k * 0.016;
        if (nt !== t) {
          temp[i] = nt;
          if (nt > t + 0.05 || nt < t - 0.05) wakeAt(x, y);
        }
        if (react[i] > 2) react[i] -= 2; else react[i] = 0;
      }
    }
  }
}

/* ---------- movement ---------- */
function tryMove(x, y, i, dx, dy) {
  const nx = x + dx, ny = y + dy;
  if (nx < 0 || ny < 0 || nx >= W || ny >= H) return false;
  const j = ny * W + nx;
  if (j === i || stamp[j] === gen) return false;
  const m = mat[i], mj = mat[j];
  if (mj === EMPTY) { moveTo(i, j); wakeAt(x, y); wakeAt(nx, ny); return true; }
  if (canEnter(m, mj)) { swapC(i, j); wakeAt(x, y); wakeAt(nx, ny); return true; }
  return false;
}

function movePowder(x, y, i, d) {
  const sp = vy[i], lat = vx[i];
  const m = mat[i];
  if (rnd() < 0.10 + P.mobility * 0.9) {
    const steps = clamp(1 + Math.round(sp * 0.8), 1, 3);
    let nx = x, ny = y, n = 0, stopShort = false;
    while (n < steps) {
      const tx = nx + MX, ty = ny + MY;
      if (tx < 0 || ty < 0 || tx >= W || ty >= H) break;
      const j = ty * W + tx;
      if (j === i || stamp[j] === gen) break;
      const mj = mat[j];
      if (mj === EMPTY) { nx = tx; ny = ty; n++; continue; }
      if (canEnter(m, mj)) { nx = tx; ny = ty; stopShort = true; n++; }
      break;
    }
    if (n > 0) {
      const j = ny * W + nx;
      const sp2 = stopShort ? P.grav * 0.4 : Math.min(3.2, sp + P.grav * 0.55);
      if (mat[j] === EMPTY) moveTo(i, j); else swapC(i, j);
      vy[j] = sp2;
      vx[j] = lat * 0.8;
      wakeAt(nx, ny);
      return;
    }
  }
  const side = rnd() < 0.5 ? 1 : -1;
  const slip = 0.55 * (0.35 + d.mob * 0.85);
  let moved = false;
  if (rnd() < slip) {
    if (tryMove(x, y, i, MX + LX * side, MY + LY * side)) moved = true;
    else if (tryMove(x, y, i, MX - LX * side, MY - LY * side)) moved = true;
  }
  if (!moved) {
    if (rnd() < 0.25 && tryMove(x, y, i, LX * side, LY * side)) {
      vx[i] = lat * 0.5;
    } else {
      vx[i] = 0;
    }
    vy[i] = 0;
  } else {
    vy[i] = Math.max(0.6, sp * 0.7);
  }
}

function liquidCan(x, y) {
  const m = mat[y * W + x];
  return m === EMPTY || (isMover(m) && canEnter(WATER, m));
}

function moveLiquid(x, y, i, d) {
  if (rnd() > P.mobility * (0.35 + d.mob * 0.9)) return;
  const m = mat[i];
  const side = rnd() < 0.5 ? 1 : -1;
  let sp = vy[i];
  if (tryMove(x, y, i, MX, MY)) {
    const nx = x + MX, ny = y + MY;
    if (inb(nx, ny)) { const j = ny * W + nx; vy[j] = Math.min(3.4, sp + P.grav * 0.7); vx[j] = vx[i] * 0.85; }
    return;
  }
  if (tryMove(x, y, i, MX + LX * side, MY + LY * side)) { vy[i] = sp * 0.6; return; }
  if (tryMove(x, y, i, MX - LX * side, MY - LY * side)) { vy[i] = sp * 0.6; return; }
  sp *= 0.5;
  /* short-range levelling: jump to the farthest clear cell that can drip */
  const flow = 2 + Math.round(P.mobility * d.mob * 7);
  let bestD = 0, bestStep = -99, bestDrop = false;
  for (let dir = -1; dir <= 1; dir += 2) {
    let px = x, py = y, foundAt = -1;
    for (let n = 0; n < flow; n++) {
      const tx = px + LX * dir, ty = py + LY * dir;
      if (!inb(tx, ty)) break;
      if (!liquidCan(tx, ty)) break;
      px = tx; py = ty;
      const dxp = px + MX, dyp = py + MY;
      if (inb(dxp, dyp) && liquidCan(dxp, dyp)) { foundAt = n + 1; break; }
    }
    if (foundAt > 0) {
      if (foundAt > bestD) { bestD = foundAt; bestStep = dir * foundAt; bestDrop = true; }
    } else if (py !== y || px !== x) {
      const dist = Math.abs(px - x) + Math.abs(py - y);
      if (dist > bestD * 0.6 && bestDrop === false && rnd() < 0.6) {
        bestD = Math.max(1, Math.round(dist * 0.6));
        bestStep = dir * bestD;
      }
    }
  }
  if (bestStep !== -99) {
    const sx = LX * bestStep, sy = LY * bestStep;
    if (tryMoveMulti(x, y, i, sx, sy)) {
      const nx = x + sx, ny = y + sy;
      if (inb(nx, ny)) {
        const j = ny * W + nx;
        vx[j] = bestStep * 0.7;
        vy[j] = bestDrop ? P.grav * 0.6 : sp * 0.5;
      }
      wakeAt(nx, ny);
      return;
    }
  }
  if (rnd() < 0.35) tryMove(x, y, i, LX * side, LY * side);
  vx[i] = 0; vy[i] = sp * 0.4;
}

/* multi-cell slide along the lateral axis, only if the whole corridor is open */
function tryMoveMulti(x, y, i, sx, sy) {
  const len = Math.abs(sx) + Math.abs(sy);
  if (len < 1) return false;
  const ux = (sx / len) | 0, uy = (sy / len) | 0;
  const m = mat[i];
  let cur = i, cx = x, cy = y;
  for (let n = 0; n < len; n++) {
    const nx = cx + ux, ny = cy + uy;
    if (!inb(nx, ny)) return false;
    const j = ny * W + nx;
    if (j === i || stamp[j] === gen) return false;
    const mj = mat[j];
    if (mj !== EMPTY && !canEnter(m, mj)) return false;
    cur = j; cx = nx; cy = ny;
  }
  if (cur === i) return false;
  if (mat[cur] === EMPTY) moveTo(i, cur); else swapC(i, cur);
  stamp[cur] = gen;
  wakeAt(x, y); wakeAt(cx, cy);
  return true;
}

function moveGas(x, y, i, d) {
  if (d.life > 0 && !d.flame) {
    let lf = life[i];
    if (lf === 0) lf = d.life;
    lf -= (rnd() < 0.5 ? 1 : 2);
    if (lf <= 0) { mat[i] = EMPTY; temp[i] = P.ambient; wakeAt(x, y); return; }
    life[i] = lf;
  }
  if (rnd() > P.diffusion * (0.35 + d.mob * 0.9)) return;
  const side = rnd() < 0.5 ? 1 : -1;
  const upx = -MX, upy = -MY;
  if (tryMove(x, y, i, upx, upy)) return;
  if (tryMove(x, y, i, upx + LX * side, upy + LY * side)) return;
  if (rnd() < 0.6) tryMove(x, y, i, LX * side, LY * side);
}

/* ---------- reactions ---------- */
function stepWater(x, y, i, T) {
  for (let n = 0; n < 4; n++) {
    const nx = x + (n === 0 ? -1 : n === 1 ? 1 : 0);
    const ny = y + (n === 2 ? -1 : n === 3 ? 1 : 0);
    if (!inb(nx, ny)) continue;
    const j = ny * W + nx;
    const mm = mat[j];
    if (mm === FIRE) {
      if (rnd() < 0.55) { mat[j] = EMPTY; temp[j] = 130; }
      if (rnd() < 0.3) { mat[i] = STEAM; life[i] = 110; temp[i] = 102; rxnCount++; react[i] = 255; wakeAt(x, y); return; }
      react[i] = 200; rxnCount++;
    } else if (mm === LAVA) {
      if (rnd() < 0.45) { mat[i] = STEAM; life[i] = 130; temp[i] = 160; rxnCount++; react[i] = 255; }
      temp[j] -= 420 * P.rxnRate;
      if (temp[j] < 880) { mat[j] = STONE; temp[j] = Math.max(temp[j], 140); }
      react[j] = 255;
      rxnCount += 2;
      wakeAt(x, y);
      return;
    } else if (mm === MOLTEN) {
      if (rnd() < 0.3) { mat[i] = STEAM; life[i] = 110; temp[i] = 150; }
      temp[j] -= 220;
      if (temp[j] < 1300) { mat[j] = METAL; }
      rxnCount++;
      return;
    } else if (mm === ACID && rnd() < 0.002 * P.rxnRate) {
      mat[j] = BRINE; life[j] = 0; rxnCount++;
    }
  }
}
function stepLava(x, y, i, T) {
  for (let n = 0; n < 4; n++) {
    const nx = x + (n === 0 ? -1 : n === 1 ? 1 : 0);
    const ny = y + (n === 2 ? -1 : n === 3 ? 1 : 0);
    if (!inb(nx, ny)) continue;
    const j = ny * W + nx;
    const mm = mat[j];
    if (MATS[mm].ign > 0 && mm !== FIRE && rnd() < 0.06 * P.firePow) ignite(nx, ny, j);
    if (mm === WATER && rnd() < 0.3) { mat[j] = STEAM; life[j] = 120; temp[j] = 160; rxnCount++; react[i] = 255; }
    else if (mm === ICE && rnd() < 0.5) { mat[j] = STEAM; life[j] = 100; temp[j] = 140; rxnCount++; }
  }
}
function stepSalt(x, y, i, T) {
  if (T < -3) return;
  if (rnd() > 0.22 * P.rxnRate) return;
  for (let n = 0; n < 4; n++) {
    const nx = x + (n === 0 ? -1 : n === 1 ? 1 : 0);
    const ny = y + (n === 2 ? -1 : n === 3 ? 1 : 0);
    if (!inb(nx, ny)) continue;
    const j = ny * W + nx;
    const mm = mat[j];
    if (mm === WATER || mm === BRINE) {
      mat[i] = BRINE; life[i] = 0; temp[i] = T - 1.5;
      react[i] = 255; rxnCount++;
      wakeAt(x, y);
      return;
    }
  }
}
function stepAcid(x, y, i, T) {
  let st = life[i];
  if (st === 0) st = 255;
  for (let n = 0; n < 4; n++) {
    const nx = x + (n === 0 ? -1 : n === 1 ? 1 : 0);
    const ny = y + (n === 2 ? -1 : n === 3 ? 1 : 0);
    if (!inb(nx, ny)) continue;
    const j = ny * W + nx;
    const mm = mat[j];
    const sus = MATS[mm].corr;
    if (sus > 0 && rnd() < 0.055 * P.rxnRate * sus) {
      let prod = EMPTY;
      if (mm === METAL) prod = rnd() < 0.74 ? RUST : GAS;
      else if (mm === RUST) prod = EMPTY;
      else if (mm === SALT) prod = BRINE;
      else if (mm === ICE) prod = WATER;
      mat[j] = prod;
      if (prod === GAS) life[j] = 90;
      st -= 1;
      rxnCount += 2;
      react[i] = 255; react[j] = 255;
      temp[i] += 1.6;
      wakeAt(x, y);
    } else if (mm === WATER && rnd() < 0.0012 * P.rxnRate) {
      mat[i] = WATER; life[i] = 0; rxnCount++; wakeAt(x, y); return;
    }
  }
  if (st <= 0) { mat[i] = EMPTY; wakeAt(x, y); return; }
  life[i] = st;
}
function stepPlant(x, y, i, T) {
  if (T < 3 || T > 46) return;
  let budget = life[i];
  if (budget === 0) { budget = MATS[PLANT].life; life[i] = budget; }
  if (budget <= 1 || rnd() > 0.055 * P.rxnRate) return;
  let wx = -1, wy = -1;
  for (let dy = -3; dy <= 3 && wx < 0; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      const nx = x + dx, ny = y + dy;
      if (!inb(nx, ny)) continue;
      const mm = mat[ny * W + nx];
      if (mm === WATER || mm === BRINE || mm === ICE) { wx = nx; wy = ny; break; }
    }
  }
  if (wx < 0) return;
  const cand = [[0, -1], [0, -2], [-1, -1], [1, -1], [-1, 0], [1, 0], [-2, -1], [2, -1], [0, 1]];
  const pick = cand[ri(cand.length)];
  const nx = x + pick[0], ny = y + pick[1];
  if (!inb(nx, ny)) return;
  const j = ny * W + nx;
  if (mat[j] !== EMPTY) return;
  let open = 0;
  if (ny >= 1 && mat[(ny - 1) * W + nx] === EMPTY) open++;
  if (ny >= 2 && mat[(ny - 2) * W + nx] === EMPTY) open++;
  if (open === 0) return;
  mat[j] = PLANT;
  life[j] = budget - 2;
  life[i] = budget - 1;
  mat[wy * W + wx] = EMPTY;
  react[i] = 255; react[j] = 255;
  rxnCount++;
  wakeAt(nx, ny); wakeAt(wx, wy);
}
function stepIce(x, y, i, T) {
  if (T > -2) return;
  if (rnd() < 0.06 * P.rxnRate) {
    for (let n = 0; n < 4; n++) {
      const nx = x + (n === 0 ? -1 : n === 1 ? 1 : 0);
      const ny = y + (n === 2 ? -1 : n === 3 ? 1 : 0);
      if (!inb(nx, ny)) continue;
      const j = ny * W + nx;
      if (mat[j] === WATER) {
        if (rnd() < 0.35) { mat[j] = ICE; life[j] = 0; rxnCount++; react[j] = 200; wakeAt(nx, ny); }
        break;
      }
    }
  }
  if (T < -25 && y > 0 && mat[i - W] === STEAM && rnd() < 0.2) {
    mat[i - W] = SNOW; rxnCount++; wakeAt(x, y - 1);
  }
}

/* ---------- per-cell update ---------- */
let orderCounter = 0;
function stepCell(x, y) {
  const i = y * W + x;
  let m = mat[i];
  if (m === EMPTY) return;
  if (stamp[i] === gen) return;
  alive[i] = gen;
  orderU[i] = orderCounter++;
  let d = MATS[m];
  let T = temp[i];

  /* phase transitions */
  if (d.trans) {
    for (let k = 0; k < d.trans.length; k++) {
      const t = d.trans[k];
      if ((t.w === 'u' && T > t.v) || (t.w === 'd' && T < t.v)) {
        mat[i] = t.to;
        life[i] = MATS[t.to].life || MATS[t.to].fuel || 0;
        rxnCount++; react[i] = 255;
        wakeAt(x, y);
        m = mat[i]; d = MATS[m];
        break;
      }
    }
  }
  if (m === SALT) { stepSalt(x, y, i, T); if (mat[i] !== SALT) { m = mat[i]; d = MATS[m]; } }
  if (m === SPARK) {
    if (life[i] > 0) life[i]--;
    else { mat[i] = EMPTY; wakeAt(x, y); return; }
    for (let n = 0; n < 4; n++) {
      const nx = x + (n === 0 ? -1 : n === 1 ? 1 : 0);
      const ny = y + (n === 2 ? -1 : n === 3 ? 1 : 0);
      if (!inb(nx, ny)) continue;
      const j = ny * W + nx;
      if (live(mat[j])) pushCharge(j, 30);
      else if (MATS[mat[j]].ign > 0) ignite(nx, ny, j);
    }
  }

  /* combustion */
  if (d.ign > 0 && !isSmould(i) && m !== FIRE) {
    if (T >= d.ign && life[i] !== 0 && rnd() < 0.10 * P.rxnRate * P.firePow) { ignite(x, y, i); return; }
  }

  /* smouldering fuel */
  if (isSmould(i)) {
    T = Math.max(T, 340);
    temp[i] = T;
    life[i] = life[i] > 0 ? life[i] - 1 : 0;
    if (rnd() < 0.12) {
      for (let n = 0; n < 4; n++) {
        const nx = x + (n === 0 ? -1 : n === 1 ? 1 : 0);
        const ny = y + (n === 2 ? -1 : n === 3 ? 1 : 0);
        if (inb(nx, ny)) temp[ny * W + nx] += 14 * P.firePow;
      }
    }
    /* embers keep lighting nearby gas pockets, so the front keeps breathing */
    if (rnd() < 0.16) {
      for (let n = 0; n < 4; n++) {
        const nx = x + (n === 0 ? -1 : n === 1 ? 1 : 0);
        const ny = y + (n === 2 ? -1 : n === 3 ? 1 : 0);
        if (!inb(nx, ny)) continue;
        const j = ny * W + nx;
        if (mat[j] === EMPTY && rnd() < 0.4) { mat[j] = FIRE; life[j] = 11; temp[j] = 700; wakeAt(nx, ny); break; }
      }
    }
    /* an ember passes the flame onward even without a free-floating flame */
    if (rnd() < 0.12 * P.firePow * P.rxnRate) {
      for (let n = 0; n < 4; n++) {
        const nx = x + (n === 0 ? -1 : n === 1 ? 1 : 0);
        const ny = y + (n === 2 ? -1 : n === 3 ? 1 : 0);
        if (!inb(nx, ny)) continue;
        const j = ny * W + nx;
        if (j !== i && MATS[mat[j]].ign > 0 && !isSmould(j)) { ignite(nx, ny, j); break; }
      }
    }
    if (life[i] <= 0) {
      const ash = MATS[m].to;
      flags[i] = 0;
      mat[i] = ash >= 0 ? ash : EMPTY;
      wakeAt(x, y);
      return;
    }
    if (rnd() < 0.13 && y > 0 && mat[i - W] === EMPTY) {
      mat[i - W] = SMOKE; life[i - W] = 40 + ri(50); temp[i - W] = T; wakeAt(x, y - 1);
    }
    if (rnd() < 0.5) {
      let wet = false;
      for (let n = 0; n < 4; n++) {
        const nx = x + (n === 0 ? -1 : n === 1 ? 1 : 0);
        const ny = y + (n === 2 ? -1 : n === 3 ? 1 : 0);
        if (!inb(nx, ny)) continue;
        const mm = mat[ny * W + nx];
        if (mm === WATER || mm === BRINE || mm === ICE) { wet = true; break; }
      }
      if (wet) {
        flags[i] = 0;
        temp[i] = Math.min(T, 96);
        react[i] = 255; rxnCount++;
        wakeAt(x, y);
      }
    }
    return;
  }

  /* chemistry */
  if (m === FIRE) { stepFire(x, y, i, T); return; }
  else if (m === ACID) stepAcid(x, y, i, T);
  else if (m === PLANT) stepPlant(x, y, i, T);
  else if (m === ICE) stepIce(x, y, i, T);
  else if (m === LAVA) stepLava(x, y, i, T);
  else if (m === WATER || m === BRINE) stepWater(x, y, i, T);

  m = mat[i];
  if (m === EMPTY) return;
  d = MATS[m];
  if (d.cat === CAT_SOLID) return;
  if (d.cat === CAT_POW) movePowder(x, y, i, d);
  else if (d.cat === CAT_LIQ) moveLiquid(x, y, i, d);
  else moveGas(x, y, i, d);
}

function stepFire(x, y, i, T) {
  let lf = life[i];
  if (lf <= 0) lf = 8;
  lf -= (rnd() < 0.5 ? 1 : 2);
  let air = 0, water = 0, fuel = 0;
  for (let n = 0; n < 4; n++) {
    const nx = x + (n === 0 ? -1 : n === 1 ? 1 : 0);
    const ny = y + (n === 2 ? -1 : n === 3 ? 1 : 0);
    if (!inb(nx, ny)) continue;
    const j = ny * W + nx;
    const mm = mat[j];
    if (mm === EMPTY || MATS[mm].cat === CAT_GAS) air++;
    if (mm === WATER || mm === BRINE || mm === ICE) water++;
    if (mm !== FIRE && MATS[mm].ign > 0) fuel++;
    if (mm !== FIRE && MATS[mm].ign > 0 && !isSmould(j) && T >= MATS[mm].ign * 0.35) {
      if (rnd() < 0.25 * P.firePow * P.rxnRate) ignite(nx, ny, j);
    }
    if (rnd() < 0.45) temp[j] += 11 * P.firePow;
  }
  if (water > 0 && rnd() < 0.4 * P.firePow) {
    mat[i] = STEAM; life[i] = 60; temp[i] = 100;
    react[i] = 255; rxnCount++; wakeAt(x, y); return;
  }
  if (lf <= 0 || (air === 0 && fuel === 0) || T < 170) {
    if (rnd() < 0.5) { mat[i] = SMOKE; life[i] = 40 + ri(60); temp[i] = T * 0.8; }
    else { mat[i] = EMPTY; temp[i] = P.ambient; }
    wakeAt(x, y);
    return;
  }
  life[i] = lf;
  if (T < 640) temp[i] = 640 + rnd() * 80;
  if (rnd() < 0.85) {
    const side = rnd() < 0.5 ? 1 : -1;
    if (!tryMove(x, y, i, -MX, -MY)) {
      if (!tryMove(x, y, i, -MX + LX * side, -MY + LY * side)) {
        if (rnd() < 0.45) tryMove(x, y, i, LX * side, LY * side);
      }
    }
  }
}

/* ---------- chunk order + step ---------- */
function buildOrder() {
  const n = lstAN;
  cntBuf.fill(0, 0, HH + 1);
  for (let k = 0; k < n; k++) cntBuf[((lstA[k] / WW) | 0) + 1]++;
  let acc = 0;
  for (let r = 0; r < HH; r++) { rowStart[r] = acc; acc += cntBuf[r + 1]; }
  rowStart[HH] = acc;
  for (let r = 0; r < HH; r++) posBuf[r] = rowStart[r];
  for (let k = 0; k < n; k++) {
    const c = lstA[k];
    const r = (c / WW) | 0;
    sortedBuf[posBuf[r]++] = c;
  }
  sortedN = n;
  activeChunks = n;
}

/* ---------- vents: cells that keep pumping material ----------
   Without these, every scene relaxes into a still life after a couple of
   seconds. A vent re-fills its patch each cycle, so an eruption keeps
   erupting and a spring keeps running until the user clears the grid. */
function addVent(x, y, m, tv, every, rad, amount) {
  if (vents.length >= 48) return;
  vents.push({ x: x, y: y, m: m, t: tv, every: Math.max(1, every), rad: Math.max(1, rad || 2), n: amount || 4 });
}
function passVents() {
  if (vents.length === 0) return;
  for (let k = 0; k < vents.length; k++) {
    const v = vents[k];
    if (stepNo % v.every !== (k % v.every)) continue;
    if (mat[v.y * W + v.x] !== v.m) {
      const i0 = v.y * W + v.x;
      if (mat[i0] === EMPTY) { mat[i0] = v.m; temp[i0] = v.t; life[i0] = MATS[v.m].life || 0; wakeAt(v.x, v.y); }
    }
    for (let q = 0; q < v.n; q++) {
      const x = v.x + ri(v.rad * 2 + 1) - v.rad, y = v.y + ri(v.rad * 2 + 1) - v.rad;
      if (!inb(x, y)) continue;
      const i = y * W + x;
      if (mat[i] !== EMPTY) continue;
      mat[i] = v.m; temp[i] = v.t; life[i] = MATS[v.m].life || 0;
      wakeAt(x, y);
    }
  }
}

function passPhysics() {
  for (let r = HH - 1; r >= 0; r--) {
    const s0 = rowStart[r], s1 = rowStart[r + 1];
    if (s1 === s0) continue;
    for (let k = s0; k < s1; k++) {
      const c = sortedBuf[k];
      const cx0 = (c % WW) * CS;
      const cy0 = r * CS;
      const xe = Math.min(cx0 + CS, W);
      const ye = Math.min(cy0 + CS, H);
      for (let y = ye - 1; y >= cy0; y--) {
        if (((y + P.gdir + stepNo) & 1) === 0) {
          for (let x = cx0; x < xe; x++) stepCell(x, y);
        } else {
          for (let x = xe - 1; x >= cx0; x--) stepCell(x, y);
        }
      }
    }
  }
}

let auditTick = 0;
function audit() {
  auditTick++;
  if (auditTick % 60 !== 0) return;
  if (W < 2 || H < 2) return;
  const samples = Math.min(4000, N);
  for (let k = 0; k < samples; k++) {
    const x = ri(W), y = ri(H);
    const i = y * W + x;
    const m = mat[i];
    if (m === EMPTY) continue;
    const d = MATS[m];
    let need = false;
    if (d.cat !== CAT_SOLID) {
      const gx = d.cat === CAT_GAS ? x - MX : x + MX;
      const gy = d.cat === CAT_GAS ? y - MY : y + MY;
      if (inb(gx, gy) && mat[gy * W + gx] === EMPTY) need = true;
    }
    if (!need) {
      if (d.ign > 0 && temp[i] > d.ign) need = true;
      else if (d.trans) {
        for (let t = 0; t < d.trans.length; t++) {
          const tt = d.trans[t];
          if ((tt.w === 'u' && temp[i] > tt.v - 60) || (tt.w === 'd' && temp[i] < tt.v + 60)) need = true;
        }
      }
    }
    if (!need) {
      for (let n = 0; n < 4; n++) {
        const nx = x + (n === 0 ? -1 : n === 1 ? 1 : 0);
        const ny = y + (n === 2 ? -1 : n === 3 ? 1 : 0);
        if (inb(nx, ny) && Math.abs(temp[ny * W + nx] - temp[i]) > 2.5) { need = true; break; }
      }
    }
    if (need) wakeAt(x, y);
  }
}

function clearWorld() {
  mat.fill(0); vx.fill(0); vy.fill(0); life.fill(0); flags.fill(0);
  chgA.fill(0); chgB.fill(0); react.fill(0); alive.fill(0); orderU.fill(0);
  stamp.fill(0);
  for (let i = 0; i < N; i++) temp[i] = P.ambient;
  actA.fill(0); actB.fill(0);
  lstAN = 0; lstBN = 0; inStep = false; qaN = 0; qbN = 0;
  shocks = []; emitters = []; vents = []; sortedN = 0; activeChunks = 0;
  gen = 1;
}

/* rebuild at a new resolution, keeping whatever still fits */
function rebuildGrid(w, h, keep) {
  const ow = W, oh = H;
  const om = keep ? mat.slice() : null;
  const ot = keep ? temp.slice() : null;
  const ovx = keep ? vx.slice() : null;
  const ovy = keep ? vy.slice() : null;
  const olf = keep ? life.slice() : null;
  const ofl = keep ? flags.slice() : null;
  allocWorld(w, h, (Math.random() * 1e9) | 0);
  if (!keep || !ow || !oh) return;
  const cw = Math.min(ow, w), ch = Math.min(oh, h);
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const o = y * ow + x, n = y * w + x;
      mat[n] = om[o]; temp[n] = ot[o]; vx[n] = ovx[o]; vy[n] = ovy[o];
      life[n] = olf[o]; flags[n] = ofl[o];
      if (mat[n] !== EMPTY) wakeAt(x, y);
      if (mat[n] === BATT && emitters.length < 4096) { flags[n] |= 4; emitters.push(n); }
    }
  }
}

function stepSim() {
  inStep = true;
  gen++;
  if (gen > 250) { stamp.fill(0); alive.fill(0); gen = 1; }
  rxnCount = 0; stepNo++;
  buildOrder();
  passVents();
  passElec();
  passHeat();
  orderCounter = 0;
  passPhysics();
  passShock();
  audit();
  const nCur = lstAN, nNext = lstBN;
  const ta = actA; actA = actB; actB = ta;
  const tl = lstA; lstA = lstB; lstB = tl;
  lstAN = nNext;
  lstBN = 0;
  /* the buffer that becomes the collection target still carries the flags of
     the set we just processed — clear exactly those entries */
  for (let k = 0; k < nCur; k++) actB[tl[k]] = 0;
  inStep = false;
}

/* ---------- serialisation (compact RLE of the complete grid state) ---------- */
function encodeState() {
  const mRuns = [];
  let i = 0;
  while (i < N) {
    const m = mat[i]; let n = 1;
    while (i + n < N && mat[i + n] === m && n < 65535) n++;
    mRuns.push(m, n);
    i += n;
  }
  const tRuns = [];
  i = 0;
  while (i < N) {
    const q = clamp(Math.round(temp[i] * 2) + 4096, 0, 65535);
    let n = 1;
    while (i + n < N && clamp(Math.round(temp[i + n] * 2) + 4096, 0, 65535) === q && n < 65535) n++;
    tRuns.push(q, n);
    i += n;
  }
  const vRuns = [];
  i = 0;
  while (i < N) {
    const q = clamp(Math.round(vx[i] * 20) + 128, 0, 255) * 256 + clamp(Math.round(vy[i] * 20) + 128, 0, 255);
    let n = 1;
    while (i + n < N &&
      clamp(Math.round(vx[i + n] * 20) + 128, 0, 255) * 256 + clamp(Math.round(vy[i + n] * 20) + 128, 0, 255) === q && n < 65535) n++;
    vRuns.push(q, n);
    i += n;
  }
  return { w: W, h: H, s: stepNo, m: mRuns, t: tRuns, v: vRuns };
}

function decodeState(o) {
  if (!o || !o.w || !o.h || !o.m) return 'not a sandbox state file';
  if (o.w < 4 || o.h < 4 || o.w * o.h > 4000000) return 'grid too large';
  const nw = o.w, nh = o.h;
  const same = (nw === W && nh === H);
  if (!same) allocWorld(nw, nh, (Math.random() * 1e9) | 0);
  else clearWorld();
  const n = nw * nh;
  let p = 0;
  for (let k = 0; k < o.m.length; k += 2) {
    const m = o.m[k] | 0, c = o.m[k + 1] | 0;
    for (let e = 0; e < c && p < n; e++, p++) {
      if (m >= 0 && m < MATS.length) {
        mat[p] = m;
        life[p] = MATS[m].life || MATS[m].fuel || 0;
        if (m === BATT && emitters.length < 4096) { flags[p] |= 4; emitters.push(p); }
        const x = p % nw, y = (p / nw) | 0;
        wakeAt(x, y);
      }
    }
  }
  if (o.t) {
    p = 0;
    for (let k = 0; k < o.t.length && p < n; k += 2) {
      const q = o.t[k] | 0, c = o.t[k + 1] | 0;
      const tv = (q - 4096) / 2;
      for (let e = 0; e < c && p < n; e++, p++) temp[p] = tv;
    }
  }
  if (o.v) {
    p = 0;
    for (let k = 0; k < o.v.length && p < n; k += 2) {
      const q = o.v[k] | 0, c = o.v[k + 1] | 0;
      const a = ((q >> 8) & 255) - 128, b = (q & 255) - 128;
      for (let e = 0; e < c && p < n; e++, p++) { vx[p] = a / 20; vy[p] = b / 20; }
    }
  }
  stepNo = o.s | 0;
  return null;
}

/* ---------- live census for the overlay ---------- */
const countsAcc = new Int32Array(MATS.length);
const counts = new Int32Array(MATS.length);
let censusCells = 0, censusTemp = 0, censusPhase = 0;
function censusSlice() {
  if (!N) return;
  countsAcc.fill(0);
  let cells = 0, tsum = 0;
  const slice = Math.max(1024, (N / 4) | 0);
  for (let pass = 0; pass < 4; pass++) {
    const start = pass * slice;
    const end = Math.min(N, start + slice);
    for (let i = start; i < end; i++) {
      const m = mat[i];
      if (m !== EMPTY) { countsAcc[m]++; tsum += temp[i]; }
    }
  }
  for (let k = 0; k < counts.length; k++) counts[k] = countsAcc[k];
  for (let i = 0; i < counts.length; i++) if (countsAcc[i]) cells += countsAcc[i];
  censusCells = cells;
  censusTemp = cells ? tsum / cells : 0;
}