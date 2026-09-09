/* =======================================================================
   RENDERING LAYER — colour maps, field raster, canvas overlays
   ======================================================================= */
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const fmt = (v, n) => (isFinite(v) ? v.toFixed(n) : "—");
const TAU = Math.PI * 2;

/* ----------------------------------------------------------- constants */
const LX = 8.0, LY = 5.0;                     /* tank is 8 m x 5 m      */
const RES = [
  { W: 192, H: 120, name: "192×120 (coarse)" },
  { W: 256, H: 160, name: "256×160" },
  { W: 320, H: 200, name: "320×200" },
  { W: 400, H: 250, name: "400×250 (default)" },
  { W: 480, H: 300, name: "480×300" },
  { W: 560, H: 350, name: "560×350 (finest)" }
];
const MODES = [
  { id: "amp", short: "amp", name: "amplitude (signed)", legend: "−u blue · dark · amber +u" },
  { id: "int", short: "intensity", name: "intensity (time-avg)", legend: "0 → max time-averaged |u|²" },
  { id: "energy", short: "energy", name: "energy density", legend: "½(u̇² + c²|∇u|²) live" },
  { id: "phase", short: "phase", name: "phase (isochrons)", legend: "hue = phase, bright = |u|" },
  { id: "grad", short: "|grad u|", name: "gradient |∇u|", legend: "0 → max wavefront slope" },
  { id: "medium", short: "medium", name: "medium / barriers", legend: "index + wall/absorber map" },
  { id: "flow", short: "energy flow", name: "energy flow (Poynting)", legend: "hue = direction, bright = |S|" }
];
const TOOLS = [
  { id: "emit", key: "F", name: "emitter", hint: "click: add emitter · drag: move · Alt-click: delete" },
  { id: "select", key: "V", name: "select", hint: "click/drag sources & probes · Del removes" },
  { id: "probe", key: "P", name: "probe", hint: "click to drop a field probe (max 8)" },
  { id: "wall", key: "W", name: "wall", hint: "rigid barrier — reflects in phase" },
  { id: "slit", key: "T", name: "slit", hint: "drag: barrier with a slot at its middle" },
  { id: "absorb", key: "A", name: "absorber", hint: "damped region — eats the wave" },
  { id: "medium", key: "M", name: "medium", hint: "paint a new wave speed (index brush)" },
  { id: "lens", key: "L", name: "lens", hint: "drag a disc of slower medium" },
  { id: "erase", key: "E", name: "erase", hint: "back to plain water (also clears sources)" }
];
const WAVEFORMS = ["sine", "square", "tri", "burst", "pulse"];

/* --------------------------------------------------------------- state */
const P = {
  mode: "amp", exposure: 1.0, autoExp: true, persistence: 0, smooth: true,
  showMedium: true, arrows: true, arrowSkip: 16, unsafe: false,
  refFreq: 2.5, autosave: true
};
const Par = {                            /* mirrored into the solver     */
  res: 3, substeps: 3, dt: 0.006, speed: 1.0, damping: 0.25, boundary: "absorb"
};
let sim = null;
let scene = { sources: [], probes: [] };
let tool = "wall", brush = 5, indexBrush = 0.55;
let sel = null;                          /* selected source/probe object */
let paused = false, pendingSteps = 0, needFlow = false;
let idSeq = 1;
const key = {};                          /* keyboard state               */

/* ------------------------------------------------------------- canvases */
const cv = $("field"), ctx = cv.getContext("2d", { alpha: false });
let off = document.createElement("canvas"), octx = off.getContext("2d");
let img = null, dpr = 1, viewW = 0, viewH = 0, viewX = 0, viewY = 0, scale = 60;

function allocBuffers() {
  const W = Par.resW, H = Par.resH;
  off.width = W; off.height = H;
  img = octx.createImageData(W, H);
  const d = img.data;
  for (let i = 3; i < d.length; i += 4) d[i] = 255;
}

let cvOffX = 0, cvOffY = 0, dragState = null, slitGapShow = 0.3;
/* probe sampling stride: keep roughly 5 periods on the scope */
function computeStride() {
  let f = 1.5;
  for (const s of scene.sources) if (s.active && s.freq > f) f = s.freq;
  const n = 300;
  sim.pStr = clamp(Math.round(5 / (f * n * sim.p.dt)), 1, 60);
}

/* ------------------------------------------------------------- colormaps */
function rampLUT(stops, n) {
  const out = new Uint8Array(n * 3);
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1);
    let a = stops[0], b = stops[stops.length - 1];
    for (let k = 0; k < stops.length - 1; k++) {
      if (t >= stops[k][0] && t <= stops[k + 1][0]) { a = stops[k]; b = stops[k + 1]; break; }
    }
    const f = b[1] === a[1] ? 0 : (t - a[0]) / (b[1] - a[0]);
    out[i * 3] = a[2] + (b[2] - a[2]) * f;
    out[i * 3 + 1] = a[3] + (b[3] - a[3]) * f;
    out[i * 3 + 2] = a[4] + (b[4] - a[4]) * f;
  }
  return out;
}
/* [pos, r, g, b] — signed map: blue troughs, near-black zero, amber crests */
const LUT_AMP = rampLUT([
  [0.00, 40, 150, 255], [0.10, 20, 95, 225], [0.26, 12, 45, 120], [0.42, 10, 18, 44],
  [0.50, 8, 11, 20],
  [0.58, 48, 20, 12], [0.74, 150, 60, 12], [0.90, 255, 165, 35], [1.00, 255, 240, 150]
], 512);
const LUT_POS = rampLUT([
  [0.00, 6, 8, 16], [0.12, 32, 18, 66], [0.30, 96, 28, 96], [0.48, 168, 46, 70],
  [0.64, 224, 92, 40], [0.80, 250, 168, 60], [0.92, 254, 226, 130], [1.00, 255, 255, 245]
], 256);
const LUT_GRAD = rampLUT([
  [0.00, 4, 8, 14], [0.20, 18, 40, 74], [0.40, 22, 100, 108], [0.60, 52, 158, 84],
  [0.80, 150, 200, 60], [0.93, 240, 230, 80], [1.00, 255, 255, 250]
], 256);
const LUT_HUE = (() => {                     /* 720 steps of hue wheel    */
  const n = 720, out = new Uint8Array(n * 3);
  for (let i = 0; i < n; i++) {
    const h = ((i / n) * 6) % 6, f = h - Math.floor(h);
    const q = Math.floor(h) % 6, c = [
      [1, f, 0], [1 - f, 1, 0], [0, 1, f], [0, 1 - f, 1], [f, 0, 1], [1, 0, 1 - f]
    ][(q + 6) % 6];
    out[i * 3] = c[0] * 235 + 12; out[i * 3 + 1] = c[1] * 235 + 12; out[i * 3 + 2] = c[2] * 235 + 12;
  }
  return out;
})();
const COL_WALL = [132, 152, 170], COL_ABS = [126, 66, 160];

/* ---------------------------------------------------------------- render */
function renderField() {
  const S = sim, W = S.W, H = S.H, N = W * H;
  const u = S.uc, I = S.I, env = S.env, q = S.q, flag = S.flag, los = S.los, spd = S.spd;
  const d = img.data;
  const mode = P.mode;
  /* Auto exposure.  The field spans three orders of magnitude (the driven
     cells sit ~50x above the far field), so a max-based scale would render
     everything but the source black.  Scale on the MEAN of |u| over a
     half-stride subsample, then compress with a sqrt so mid-levels stay
     legible.  "gain" is the per-mode constant that puts a typical cell at
     about half the colour bar. */
  let sum = 0, cnt = 0;
  if (P.autoExp) {
    if (mode === "flow") {
      const fx = S.fx, fy = S.fy;
      for (let y = 0; y < H; y += 2) {
        const row = y * W;
        for (let x = 0; x < W; x += 2) {
          const a = fx[row + x], b = fy[row + x];
          const m = Math.sqrt(a * a + b * b);
          if (m > 1e-7) { sum += m; cnt++; }
        }
      }
    } else {
    for (let y = 0; y < H; y += 2) {
      const row = y * W;
      for (let x = 0; x < W; x += 2) { const v = u[row + x]; sum += v < 0 ? -v : v; cnt++; }
    }
    }
    const want = clamp(sum / Math.max(1, cnt), 1e-4, 40);
    S.expScale += 0.12 * (want - S.expScale);
  }
  const gain = mode === "int" || mode === "energy" ? 4.2 : mode === "grad" ? 4.5 : 4.0;
  const exp = clamp((P.autoExp ? S.expScale : 0.05) * P.exposure, 1e-5, 1e4);
  const inv = 1 / Math.max(1e-6, gain * exp);
  const pers = P.persistence;
  const wr = TAU * clamp(P.refFreq, 0.05, 60);
  const wantFlow = mode === "flow";
  const uq = S.up;

  for (let y = 0; y < H; y++) {
    const row = y * W;
    for (let x = 0; x < W; x++) {
      const i = row + x, p = i * 4;
      const f = flag[i];
      let r = 0, g = 0, b = 0;
      if (f === 1) {                                   /* rigid wall        */
        if (mode === "medium") { r = COL_WALL[0]; g = COL_WALL[1]; b = COL_WALL[2]; }
        else { r = 26; g = 32; b = 42; }
        d[p] = r; d[p + 1] = g; d[p + 2] = b;
        continue;
      }
      const ls = los[i];
      if (mode === "medium") {
        if (ls > 2) {
          const t = clamp(ls / 30, 0, 1);
          r = 24 + COL_ABS[0] * t; g = 26 + COL_ABS[1] * t; b = 34 + COL_ABS[2] * t;
        } else {
          const s = spd[i];
          const t = clamp((s - 0.3) / 1.3, 0, 1);
          const li = (t * 255) | 0;
          r = LUT_GRAD[li * 3 + 2]; g = LUT_GRAD[li * 3 + 1]; b = LUT_GRAD[li * 3];
          if (s > 1.02) { r = 250; g = 150; b = 70; }
          else if (s < 0.98) { r = 40; g = 120; b = 220; }
          else { r = 16; g = 22; b = 30; }
        }
        d[p] = r; d[p + 1] = g; d[p + 2] = b;
        continue;
      }

      if (mode === "amp") {
        let v = u[i] * inv;
        if (pers > 0.001) { const e = env[i] * inv; if (e > (v < 0 ? -v : v)) v = v < 0 ? -e : e; }
        if (v > 1) v = 1; else if (v < -1) v = -1;
        /* sqrt compression keeps the quiet half of the tank readable */
        let t = (v < 0 ? -Math.sqrt(-v) : Math.sqrt(v)) * 255;
        const li = clamp((t + 256) | 0, 0, 511);
        r = LUT_AMP[li * 3]; g = LUT_AMP[li * 3 + 1]; b = LUT_AMP[li * 3 + 2];
      } else if (mode === "int") {
        let v = Math.sqrt(I[i]) * inv;
        if (pers > 0.001) { const e = env[i] * inv; if (e > v) v = e; }
        const li = clamp((v * 255) | 0, 0, 255);
        r = LUT_POS[li * 3]; g = LUT_POS[li * 3 + 1]; b = LUT_POS[li * 3 + 2];
      } else if (mode === "energy") {
        const ut = (u[i] - uq[i]) / Math.max(1e-9, sim.dtUsed || sim.p.dt);
        const gx = (x > 0 && x < W - 1) ? (u[i + 1] - u[i - 1]) * 0.5 : 0;
        const gy = (y > 0 && y < H - 1) ? (u[i + W] - u[i - W]) * 0.5 : 0;
        const e = 0.5 * (ut * ut + (gx * gx + gy * gy) * spd[i] * spd[i]);
        const v = clamp(Math.sqrt(e) * inv, 0, 1);
        const li = (v * 255) | 0;
        r = LUT_POS[li * 3]; g = LUT_POS[li * 3 + 1]; b = LUT_POS[li * 3 + 2];
      } else if (mode === "phase") {
        const a = u[i] * inv, bb = q[i] * wr * inv;
        const m = clamp(Math.sqrt(a * a + bb * bb), 0, 1.4);
        let ang = Math.atan2(a, -bb) / TAU + 0.5;
        ang = ang - Math.floor(ang);
        const li = (ang * 719) | 0;
        const k2 = clamp(m * 1.25, 0, 1);
        r = 8 + (LUT_HUE[li * 3] - 8) * k2;
        g = 10 + (LUT_HUE[li * 3 + 1] - 10) * k2;
        b = 14 + (LUT_HUE[li * 3 + 2] - 14) * k2;
      } else if (mode === "grad") {
        const gx = (x > 0 && x < W - 1) ? (u[i + 1] - u[i - 1]) * 0.5 : 0;
        const gy = (y > 0 && y < H - 1) ? (u[i + W] - u[i - W]) * 0.5 : 0;
        const v = clamp(Math.sqrt(gx * gx + gy * gy) * inv, 0, 1);
        const li = (v * 255) | 0;
        r = LUT_GRAD[li * 3]; g = LUT_GRAD[li * 3 + 1]; b = LUT_GRAD[li * 3 + 2];
      } else { /* flow */
        const fx = S.fx[i], fy = S.fy[i];
        const m = Math.sqrt(fx * fx + fy * fy);
        if (m < 1e-9) { r = 8; g = 10; b = 14; }
        else {
          let ang = Math.atan2(fy, fx) / TAU + 0.5;
          ang = ang - Math.floor(ang);
          const li = (ang * 719) | 0;
          const k2 = clamp(m * inv * 2.4, 0.05, 1);
          r = 6 + (LUT_HUE[li * 3] - 6) * k2;
          g = 8 + (LUT_HUE[li * 3 + 1] - 8) * k2;
          b = 12 + (LUT_HUE[li * 3 + 2] - 12) * k2;
        }
      }

      if (ls > 2 && P.showMedium) {                  /* absorber tint      */
        const t = clamp(ls / 30, 0, 1) * 0.55;
        r = r * (1 - t) + COL_ABS[0] * t;
        g = g * (1 - t) + COL_ABS[1] * t;
        b = b * (1 - t) + COL_ABS[2] * t;
      }
      d[p] = r; d[p + 1] = g; d[p + 2] = b;
    }
  }
  octx.putImageData(img, 0, 0);
}

/* ------------------------------------------------------- view / overlays */
function fitCanvas() {
  const wrap = $("cvwrap");
  const dprW = window.devicePixelRatio || 1;
  dpr = Math.min(2, dprW);
  const cw = Math.max(80, wrap.clientWidth - 2), ch = Math.max(80, wrap.clientHeight - 2);
  const s = Math.min(cw / LX, ch / LY);
  const w = Math.floor(LX * s), h = Math.floor(LY * s);
  cv.style.width = w + "px"; cv.style.height = h + "px";
  const bw = Math.round(w * dpr), bh = Math.round(h * dpr);
  if (cv.width !== bw || cv.height !== bh) { cv.width = bw; cv.height = bh; }
  scale = bw / LX; viewW = bw; viewH = bh;
  cvOffX = (wrap.clientWidth - w) / 2; cvOffY = (wrap.clientHeight - h) / 2;
}

function toPx(mx, my) { return [mx * scale / dpr, my * scale / dpr]; }


function drawOverlays(t) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.drawImage(off, 0, 0, sim.W, sim.H, 0, 0, cv.width / dpr, cv.height / dpr);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.save();
  ctx.scale(dpr, dpr);
  const pxPerM = (viewW / dpr) / LX;

  /* energy-flow arrows */
  if (P.mode === "flow" && P.arrows) {
    const sk = Math.max(6, P.arrowSkip);
    ctx.strokeStyle = "rgba(255,255,255,.75)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let y = sk >> 1; y < sim.H; y += sk) {
      for (let x = sk >> 1; x < sim.W; x += sk) {
        const i = y * sim.W + x;
        if (sim.flag[i] === 1) continue;
        const fx = sim.fx[i], fy = sim.fy[i];
        const m = Math.hypot(fx, fy);
        if (m < 0.02) continue;
        const cxp = (x + 0.5) * sim.dx * pxPerM, cyp = (y + 0.5) * sim.dx * pxPerM;
        const L = Math.min(9, 2 + m * 26);
        const ux = fx / m, uy = fy / m;
        ctx.moveTo(cxp - ux * L * .5, cyp - uy * L * .5);
        ctx.lineTo(cxp + ux * L * .5, cyp + uy * L * .5);
        ctx.moveTo(cxp + ux * L * .5, cyp + uy * L * .5);
        ctx.lineTo(cxp + ux * L * .5 - ux * 3 - uy * 2, cyp + uy * L * .5 - uy * 3 + ux * 2);
      }
    }
    ctx.stroke();
  }

  const cpm = pxPerM * sim.dx;          /* css px per cell                */
  const cp = (cx, cy) => [cx * cpm, cy * cpm];

  /* sources */
  for (const s of scene.sources) {
    const pts = sourceMarkers(s);
    const col = !s.active ? "#5d6b7a" : (s.kind === "pulse" ? "#ff9d3d" : "#37d6c4");
    ctx.strokeStyle = col; ctx.fillStyle = col;
    ctx.lineWidth = sel === s ? 2.4 : 1.4;
    ctx.beginPath();
    for (const [mx, my] of pts) {
      const [x, y] = cp(mx, my);
      ctx.moveTo(x + 3.2, y); ctx.arc(x, y, 3.2, 0, TAU);
    }
    ctx.stroke();
    if (sel === s) {
      ctx.strokeStyle = "rgba(255,255,255,.55)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      const a = -Math.PI / 2 + s.angle * Math.PI / 180;
      const [x0, y0] = cp(s.x, s.y);
      ctx.moveTo(x0, y0);
      ctx.lineTo(x0 + Math.cos(a) * 26, y0 + Math.sin(a) * 26);
      ctx.stroke();
      ctx.fillStyle = "rgba(55,214,196,.15)";
      ctx.beginPath(); ctx.arc(x0, y0, 15, 0, TAU); ctx.fill();
    }
    if (!s.active) {
      const [x, y] = cp(s.x, s.y);
      ctx.strokeStyle = "#ff5d6c"; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(x - 5, y - 5); ctx.lineTo(x + 5, y + 5);
      ctx.moveTo(x + 5, y - 5); ctx.lineTo(x - 5, y + 5); ctx.stroke();
    }
  }

  /* probes */
  for (const pr of scene.probes) {
    const [x, y] = cp(pr.x, pr.y);
    ctx.strokeStyle = sel === pr ? "#ffe66d" : "#8fd0ff";
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(x, y, 5.5, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 9, y); ctx.lineTo(x + 9, y);
    ctx.moveTo(x, y - 9); ctx.lineTo(x, y + 9); ctx.stroke();
    ctx.fillStyle = "rgba(255,230,109,.9)";
    ctx.font = "9px ui-monospace,monospace";
    ctx.fillText("P" + (scene.probes.indexOf(pr) + 1), x + 7, y - 5);
  }

  /* slit preview */
  if (dragState && dragState.mode === "slit") {
    const [a, b] = toPx(dragState.x0, dragState.y0), [c, d] = toPx(dragState.x1, dragState.y1);
    ctx.strokeStyle = "#ff5d6c"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.stroke();
    const g2 = slitGapShow * pxPerM;
    const mx = (a + c) / 2, my = (b + d) / 2;
    ctx.strokeStyle = "#ffe66d";
    ctx.beginPath(); ctx.arc(mx, my, g2 / 2, 0, TAU); ctx.stroke();
  }

  /* ruler */
  ctx.fillStyle = "rgba(190,215,235,.65)";
  ctx.font = "9px ui-monospace,monospace";
  ctx.strokeStyle = "rgba(190,215,235,.35)";
  ctx.lineWidth = 1;
  const stepM = 1;
  ctx.beginPath();
  for (let m = stepM; m < LX; m += stepM) {
    const [x] = toPx(m, 0);
    ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, viewH / dpr);
  }
  ctx.stroke();
  ctx.restore();
}

/* Marker geometry, in CELL units — the same units buildFootprint() uses. */
function sourceMarkers(s) {
  const pts = [];
  const a = s.angle * Math.PI / 180;
  const ux = Math.cos(a), uy = Math.sin(a), vx = -uy, vy = Math.cos(a);
  if (s.shape === "point") pts.push([s.x, s.y]);
  else if (s.shape === "line") {
    const n = Math.max(2, Math.round(Math.max(1, s.len) / 3.5));
    for (let k = 0; k < n; k++) {
      const u = (k / (n - 1) - 0.5) * s.len;
      pts.push([s.x + ux * u, s.y + uy * u]);
    }
  } else {
    const n = Math.max(1, s.n | 0), sp = s.spacing;
    const R = Math.abs(s.curv) < 1 ? 0 : s.curv;
    for (let k = 0; k < n; k++) {
      const u = (k - (n - 1) / 2) * sp;
      const v = R === 0 ? 0 : -(u * u) / (2 * R);
      pts.push([s.x + ux * u + vx * v, s.y + uy * u + vy * v]);
    }
  }
  return pts;
}
/* cell -> css px */
function cToPx(cx, cy, cpm) { return [cx * cpm, cy * cpm]; }

/* ------------------------------------------------------------ legend HUD */
function drawLegend() {
  const c = $("legC"), g = c.getContext("2d");
  const mode = P.mode, w = c.width, h = c.height;
  const im = g.createImageData(w, h);
  for (let x = 0; x < w; x++) {
    const t = x / (w - 1);
    let r, gg, b;
    if (mode === "amp") { const li = clamp((t * 511) | 0, 0, 511); r = LUT_AMP[li * 3]; gg = LUT_AMP[li * 3 + 1]; b = LUT_AMP[li * 3 + 2]; }
    else if (mode === "phase" || mode === "flow") { const li = clamp((t * 719) | 0, 0, 719); r = LUT_HUE[li * 3]; gg = LUT_HUE[li * 3 + 1]; b = LUT_HUE[li * 3 + 2]; }
    else if (mode === "medium") { r = 40 + t * 190; gg = 120 - t * 40; b = 220 - t * 170; }
    else { const li = clamp((t * 255) | 0, 0, 255); r = LUT_POS[li * 3]; gg = LUT_POS[li * 3 + 1]; b = LUT_POS[li * 3 + 2]; }
    for (let y = 0; y < h; y++) { const p = (y * w + x) * 4; im.data[p] = r; im.data[p + 1] = gg; im.data[p + 2] = b; im.data[p + 3] = 255; }
  }
  g.putImageData(im, 0, 0);
  const m = MODES.find((x) => x.id === mode);
  $("legTitle").textContent = m ? m.name : mode;
  $("legMin").textContent = m ? m.legend : "";
}
