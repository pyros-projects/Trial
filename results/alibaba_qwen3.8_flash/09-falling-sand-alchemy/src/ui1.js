/* =====================================================================
   RENDERER + UI
   ===================================================================== */

/* ---------- palette helpers ---------- */
function makeLUT(stops) {
  const lut = new Uint8Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    const u = i / 255;
    let a = stops[0], b = stops[stops.length - 1];
    for (let k = 0; k < stops.length - 1; k++) {
      if (u >= stops[k][0] && u <= stops[k + 1][0]) { a = stops[k]; b = stops[k + 1]; break; }
    }
    const span = (b[0] - a[0]) || 1;
    const t = (u - a[0]) / span;
    lut[i * 3] = Math.round(a[1] + (b[1] - a[1]) * t);
    lut[i * 3 + 1] = Math.round(a[2] + (b[2] - a[2]) * t);
    lut[i * 3 + 2] = Math.round(a[3] + (b[3] - a[3]) * t);
  }
  return lut;
}
const LUT_TEMP = makeLUT([
  [0.00, 18, 24, 86], [0.16, 32, 122, 190], [0.30, 92, 216, 210],
  [0.42, 226, 236, 214], [0.52, 246, 208, 92], [0.66, 246, 126, 42],
  [0.80, 214, 46, 32], [1.00, 120, 12, 22]
]);
const LUT_SPEED = makeLUT([
  [0.00, 14, 18, 26], [0.25, 40, 62, 120], [0.5, 132, 62, 168],
  [0.75, 244, 92, 128], [1.00, 255, 238, 210]
]);
const LUT_DENS = makeLUT([
  [0.00, 36, 46, 92], [0.35, 72, 176, 178], [0.6, 236, 206, 110],
  [0.8, 224, 112, 56], [1.0, 176, 40, 46]
]);
const LUT_CHG = makeLUT([
  [0.00, 22, 20, 40], [0.3, 118, 72, 178], [0.6, 255, 214, 64], [1.0, 255, 255, 246]
]);
const LUT_FUEL = makeLUT([
  [0.00, 42, 36, 34], [0.4, 132, 96, 52], [0.7, 122, 196, 92], [1.0, 214, 246, 150]
]);
const LUT_RXN = makeLUT([
  [0.00, 16, 18, 24], [0.3, 168, 62, 40], [0.65, 250, 158, 42], [1.0, 255, 250, 232]
]);
const LUT_ORDER = makeLUT([
  [0.00, 22, 30, 44], [0.25, 52, 130, 168], [0.5, 178, 232, 122],
  [0.75, 248, 210, 96], [1.0, 250, 96, 62]
]);

const MODES = [
  { id: 'material', name: 'Material', legend: 'true colours' },
  { id: 'temperature', name: 'Temperature', legend: '-40 → 1600 °C' },
  { id: 'velocity', name: 'Velocity', legend: 'still → fast' },
  { id: 'density', name: 'Density', legend: 'light → heavy' },
  { id: 'charge', name: 'Charge', legend: 'live current' },
  { id: 'fuel', name: 'Fuel', legend: 'burnt → full' },
  { id: 'reaction', name: 'Reaction', legend: 'rxn activity' },
  { id: 'order', name: 'Update order', legend: 'scan bands' }
];

/* ---------- DOM ---------- */
const view = document.getElementById('view');
const vctx = view.getContext('2d', { alpha: false });
const stage = document.getElementById('stage');
const panel = document.getElementById('panel');
const brushRing = document.getElementById('brush-ring');
const crosshair = document.getElementById('crosshair');
const toastHost = document.getElementById('toast-host');
const helpBox = document.getElementById('help');
const splash = document.getElementById('splash');
const hudEls = {
  fps: document.getElementById('h-fps'), grid: document.getElementById('h-grid'),
  active: document.getElementById('h-active'), cells: document.getElementById('h-cells'),
  temp: document.getElementById('h-temp'), rxn: document.getElementById('h-rxn'),
  tool: document.getElementById('h-tool'), speed: document.getElementById('h-speed'),
  mat: document.getElementById('h-mat'), state: document.getElementById('h-state'),
  mats: document.getElementById('h-mats'), mode: document.getElementById('h-mode'),
  steps: document.getElementById('h-steps'), simt: document.getElementById('h-simtime'),
  drawt: document.getElementById('h-drawtime'), legend: document.getElementById('h-legend')
};

let off = null, offCtx = null, imgData = null, pix32 = null;
let viewW = 0, viewH = 0, dpr = 1, cssW = 0, cssH = 0;
let opts = { heatGlow: true, streaks: true };

function setupBuffers() {
  off = document.createElement('canvas');
  off.width = W; off.height = H;
  offCtx = off.getContext('2d', { alpha: false });
  imgData = offCtx.createImageData(W, H);
  pix32 = new Uint32Array(imgData.data.buffer);
}

/* ---------- colour per mode ---------- */
const OPTS = { mode: 0 };
function buildPixels() {
  const mode = P.mode;
  const n = N;
  if (mode === 0) {
    for (let i = 0; i < n; i++) {
      const m = mat[i];
      if (m === EMPTY) { pix32[i] = 0xff080b10; continue; }
      const d = MATS[m];
      const c = d.col;
      let r = c[0], g = c[1], b = c[2];
      const v = (cvar[i] & 31);
      const k = (v - 15) * (d.vr / 15);
      r += k; g += k * 0.9; b += k * 0.8;
      const T = temp[i];
      if (opts.heatGlow && T > 90) {
        const h = Math.min(1, (T - 90) / 620);
        r += (255 - r) * h * 0.85;
        g += (150 - g) * h * 0.55;
        b += (40 - b) * h * 0.7;
      }
      if (opts.streaks) {
        const s = Math.abs(vx[i]) + Math.abs(vy[i]);
        if (s > 0.35) {
          const a = Math.min(0.55, s * 0.16);
          r = r * (1 - a) + 236 * a; g = g * (1 - a) + 236 * a; b = b * (1 - a) + 250 * a;
        }
      }
      if (chgA[i] > 3) { r = 200; g = 236; b = 255; }
      pix32[i] = 0xff000000 | (clamp(b | 0, 0, 255) << 16) | (clamp(g | 0, 0, 255) << 8) | clamp(r | 0, 0, 255);
    }
    return;
  }
  if (mode === 1) {
    for (let i = 0; i < n; i++) {
      if (mat[i] === EMPTY) { pix32[i] = 0xff06080c; continue; }
      let u = (temp[i] + 40) / 1640;
      u = u < 0 ? 0 : (u > 1 ? 1 : u);
      const k = (u * 255) | 0;
      pix32[i] = 0xff000000 | (LUT_TEMP[k * 3 + 2] << 16) | (LUT_TEMP[k * 3 + 1] << 8) | LUT_TEMP[k * 3];
    }
    return;
  }
  if (mode === 2) {
    for (let i = 0; i < n; i++) {
      if (mat[i] === EMPTY) { pix32[i] = 0xff06080c; continue; }
      const s = Math.sqrt(vx[i] * vx[i] + vy[i] * vy[i]);
      let u = s * 0.36;
      u = u > 1 ? 1 : u;
      const k = (u * 255) | 0;
      pix32[i] = 0xff000000 | (LUT_SPEED[k * 3 + 2] << 16) | (LUT_SPEED[k * 3 + 1] << 8) | LUT_SPEED[k * 3];
    }
    return;
  }
  if (mode === 3) {
    for (let i = 0; i < n; i++) {
      const m = mat[i];
      if (m === EMPTY) { pix32[i] = 0xff06080c; continue; }
      let u = Math.log(MATS[m].dens + 0.05) / 2.2 + 0.35;
      u = u < 0 ? 0 : (u > 1 ? 1 : u);
      const k = (u * 255) | 0;
      let r = LUT_DENS[k * 3], g = LUT_DENS[k * 3 + 1], b = LUT_DENS[k * 3 + 2];
      const st = Math.abs(vx[i]) + Math.abs(vy[i]);
      if (st > 0.5) { const a = Math.min(0.6, st * 0.2); r = r * (1 - a) + 255 * a; g = g * (1 - a) + 90 * a; b = b * (1 - a) + 90 * a; }
      pix32[i] = 0xff000000 | (b << 16) | (g << 8) | r;
    }
    return;
  }
  if (mode === 4) {
    for (let i = 0; i < n; i++) {
      const m = mat[i];
      const c = chgA[i];
      if (m === EMPTY && c === 0) { pix32[i] = 0xff06080c; continue; }
      let u = c / 42;
      if (m === SPARK || m === FIRE) u = Math.max(u, 0.75);
      if (u > 1) u = 1;
      const k = (u * 255) | 0;
      pix32[i] = 0xff000000 | (LUT_CHG[k * 3 + 2] << 16) | (LUT_CHG[k * 3 + 1] << 8) | LUT_CHG[k * 3];
    }
    return;
  }
  if (mode === 5) {
    for (let i = 0; i < n; i++) {
      const m = mat[i];
      if (m === EMPTY) { pix32[i] = 0xff06080c; continue; }
      const d = MATS[m];
      let u = 0;
      if (d.ign > 0 || d.flame) {
        const f = life[i];
        u = (d.fuel ? f / d.fuel : f / 40);
        if (u > 1) u = 1;
      }
      const k = (u * 255) | 0;
      pix32[i] = 0xff000000 | (LUT_FUEL[k * 3 + 2] << 16) | (LUT_FUEL[k * 3 + 1] << 8) | LUT_FUEL[k * 3];
    }
    return;
  }
  if (mode === 6) {
    for (let i = 0; i < n; i++) {
      if (mat[i] === EMPTY && react[i] < 4) { pix32[i] = 0xff06080c; continue; }
      let u = react[i] / 255;
      if (u > 1) u = 1;
      const k = (u * 255) | 0;
      pix32[i] = 0xff000000 | (LUT_RXN[k * 3 + 2] << 16) | (LUT_RXN[k * 3 + 1] << 8) | LUT_RXN[k * 3];
    }
    return;
  }
  for (let i = 0; i < n; i++) {
    if (mat[i] === EMPTY) { pix32[i] = 0xff06080c; continue; }
    if (alive[i] !== gen) { pix32[i] = 0xff10151d; continue; }
    const k = ((orderU[i] & 63) * 4) | 0;
    const kk = k > 255 ? 255 : k;
    pix32[i] = 0xff000000 | (LUT_ORDER[kk * 3 + 2] << 16) | (LUT_ORDER[kk * 3 + 1] << 8) | LUT_ORDER[kk * 3];
  }
}

function renderFrame() {
  if (!off || viewW <= 0 || viewH <= 0) return;
  buildPixels();
  offCtx.putImageData(imgData, 0, 0);
  vctx.imageSmoothingEnabled = false;
  vctx.globalCompositeOperation = 'source-over';
  vctx.drawImage(off, 0, 0, viewW, viewH);
}

/* ---------- tool state ---------- */
const TOOLS = [
  { id: 'paint', label: 'Paint', key: 'B' },
  { id: 'erase', label: 'Erase', key: 'E' },
  { id: 'pick', label: 'Eyedropper', key: 'I' },
  { id: 'heat', label: 'Heat', key: 'T' },
  { id: 'cool', label: 'Cool', key: 'Q' },
  { id: 'wind', label: 'Wind', key: 'W' },
  { id: 'blast', label: 'Explode', key: 'X' },
  { id: 'wall', label: 'Wall', key: 'L' },
  { id: 'fill', label: 'Fill area', key: 'F' }
];
const ui = {
  tool: 'paint', mat: WATER,
  brush: 6, shape: 'circle', amount: 0.7, scatter: 0.15,
  paintTemp: 20, tempAuto: true, vel: 0
};

function toast(msg, cls) {
  const d = document.createElement('div');
  d.className = 'toast' + (cls ? ' ' + cls : '');
  d.textContent = msg;
  toastHost.appendChild(d);
  while (toastHost.children.length > 4) toastHost.removeChild(toastHost.firstChild);
  setTimeout(() => { if (d.parentNode) d.parentNode.removeChild(d); }, 2600);
}

/* ---------- brush application ---------- */
function inBrush(gx, gy, r, shape) {
  const dx = gx, dy = gy;
  if (shape === 'square') return Math.abs(dx) <= r && Math.abs(dy) <= r;
  if (shape === 'ring') {
    const d = Math.sqrt(dx * dx + dy * dy);
    return d <= r && d >= r - Math.max(1, r * 0.28);
  }
  return dx * dx + dy * dy <= r * r;
}

function stampAt(cx, cy, dirx, diry, toolId, matId) {
  const r = Math.max(0, ui.brush - 1);
  const tool = toolId || ui.tool;
  const m = (matId != null) ? matId : ui.mat;
  const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(W - 1, Math.ceil(cx + r));
  const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(H - 1, Math.ceil(cy + r));
  const ptemp = ui.tempAuto ? (MATS[m].t0 != null ? MATS[m].t0 : P.ambient) : ui.paintTemp;
  const vv = ui.vel / 22;
  let changed = false;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (!inBrush(x - cx, y - cy, r, ui.shape)) continue;
      const i = y * W + x;
      if (ui.scatter > 0 && rnd() < ui.scatter * 0.85) continue;
      if (tool === 'paint' || tool === 'wall') {
        const mm = mat[i];
        if (mm === WALL || mm === m) continue;
        if (rnd() > ui.amount) continue;
        const target = tool === 'wall' ? WALL : m;
        if (target === EMPTY) { mat[i] = EMPTY; temp[i] = P.ambient; }
        else {
          mat[i] = target;
          temp[i] = ptemp;
          life[i] = MATS[target].life || MATS[target].fuel || 0;
          flags[i] = 0;
          if (target === BATT && emitters.length < 4096) { flags[i] |= 4; emitters.push(i); }
          if (target === SPARK) chargeNow(i, 34);
        }
        if (vv > 0.02) {
          vx[i] = dirx * vv + (rnd() - 0.5) * vv * 0.5;
          vy[i] = diry * vv + (rnd() - 0.5) * vv * 0.5;
        }
        changed = true;
      } else if (tool === 'erase') {
        if (mat[i] === WALL) continue;
        mat[i] = EMPTY; temp[i] = P.ambient;
        vx[i] = 0; vy[i] = 0; life[i] = 0; flags[i] = 0; chgA[i] = 0;
        changed = true;
      } else if (tool === 'heat') {
        temp[i] += 22 + ui.vel * 0.25;
        changed = true;
      } else if (tool === 'cool') {
        temp[i] -= 22 + ui.vel * 0.25;
        changed = true;
      } else if (tool === 'wind') {
        if (mat[i] === EMPTY || MATS[mat[i]].cat === CAT_SOLID) continue;
        const p = 0.55 + ui.vel * 0.06;
        vx[i] = vx[i] * 0.3 + dirx * p;
        vy[i] = vy[i] * 0.3 + diry * p;
        changed = true;
      }
    }
  }
  if (changed) wakeRect(Math.max(0, x0 - 1), Math.max(0, y0 - 1), Math.min(W - 1, x1 + 1), Math.min(H - 1, y1 + 1));
}

function fillArea(cx, cy, matId) {
  const x0 = Math.round(cx), y0 = Math.round(cy);
  if (!inb(x0, y0)) return;
  if (mat[y0 * W + x0] !== EMPTY) { toast('cursor must be on an empty cavity', 'warn'); return; }
  const seen = new Uint8Array(N);
  const stack = [y0 * W + x0];
  seen[y0 * W + x0] = 1;
  const cells = [];
  let open = false;
  const LIMIT = 60000;
  while (stack.length) {
    const i = stack.pop();
    cells.push(i);
    if (cells.length > LIMIT) { open = true; break; }
    const x = i % W, y = (i / W) | 0;
    if (x === 0 || y === 0 || x === W - 1 || y === H - 1) { open = true; }
    for (let n = 0; n < 4; n++) {
      const nx = x + (n === 0 ? -1 : n === 1 ? 1 : 0);
      const ny = y + (n === 2 ? -1 : n === 3 ? 1 : 0);
      if (!inb(nx, ny)) { open = true; continue; }
      const j = ny * W + nx;
      if (seen[j]) continue;
      if (mat[j] !== EMPTY) continue;
      seen[j] = 1;
      stack.push(j);
    }
  }
  if (open) { toast('region is not enclosed — nothing filled', 'warn'); return; }
  const m = matId != null ? matId : ui.mat;
  for (let k = 0; k < cells.length; k++) {
    const i = cells[k];
    mat[i] = m;
    temp[i] = ui.tempAuto ? (MATS[m].t0 != null ? MATS[m].t0 : P.ambient) : ui.paintTemp;
    life[i] = MATS[m].life || MATS[m].fuel || 0;
    const x = i % W, y = (i / W) | 0;
    wakeAt(x, y);
  }
  toast('filled ' + cells.length + ' cells');
}

/* ---------- preset builders ---------- */
function rectFill(x, y, w, h, m, prob) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    if (!inb(x + i, y + j)) continue;
    if (prob != null && rnd() > prob) continue;
    putRaw(x + i, y + j, m, null, null);
  }
}
function discFill(cx, cy, r, m, prob) {
  for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(H - 1, cy + r); y++) {
    for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(W - 1, cx + r); x++) {
      const dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy > r * r) continue;
      if (prob != null && rnd() > prob) continue;
      putRaw(x, y, m, null, null);
    }
  }
}
function lineFill(x0, y0, x1, y1, m, wdt) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  if (steps === 0) { putRaw(x0 | 0, y0 | 0, m, null, null); return; }
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const x = Math.round(x0 + (x1 - x0) * t), y = Math.round(y0 + (y1 - y0) * t);
    if (wdt <= 1) putRaw(x, y, m, null, null);
    else for (let k = 0; k < wdt; k++) { putRaw(x + k, y, m, null, null); putRaw(x - k, y, m, null, null); }
  }
}