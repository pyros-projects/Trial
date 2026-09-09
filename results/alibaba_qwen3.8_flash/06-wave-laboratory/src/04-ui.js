/* =======================================================================
   CONTROLS, INPUT, PRESETS, INSTRUMENTS, MAIN LOOP
   ======================================================================= */
/* =======================================================================
   INSTRUMENTS, PRESETS, SERialsation
   ======================================================================= */
let activeSources = [], scopeCanvases = [];

/* ------------------------------------------------------------- tiny DOM */
function el(tag, attrs, parent) {
  const n = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    if (k === "text") n.textContent = attrs[k];
    else if (k === "html") n.innerHTML = attrs.k === undefined ? attrs.html : "";
    else n.setAttribute(k, attrs[k]);
  }
  if (parent) parent.appendChild(n);
  return n;
}
function row(parent) { const d = el("div", { class: "row" }, parent); return d; }
function label(parent, txt) { el("span", { class: "lbl", text: txt }, parent); }
function valSpan(parent, txt) { return el("span", { class: "val", text: txt }, parent); }

function slider(parent, opts) {
  const r = row(parent);
  label(r, opts.label);
  const s = el("input", { type: "range", min: opts.min, max: opts.max, step: opts.step, value: opts.value }, r);
  const v = valSpan(r, "");
  const show = (x) => { v.textContent = (opts.fmt ? opts.fmt(+x) : (+x).toFixed(opts.dec != null ? opts.dec : 3)) + (opts.unit || ""); };
  show(opts.value);
  s.addEventListener("input", () => { show(s.value); opts.on(+s.value, false); });
  s.addEventListener("change", () => opts.on(+s.value, true));
  return { el: s, val: v, set: (x) => { s.value = x; show(x); }, show };
}
function buttons(parent, list, cls) {
  const wrap = el("div", { class: "grid4" }, parent);
  const made = [];
  for (const it of list) {
    const b = el("button", { class: (cls || "") + " big", text: it.label, title: it.title || it.label }, wrap);
    b.dataset.id = it.id;
    made.push(b);
  }
  return { wrap, made };
}
function selectBox(parent, opts) {
  const r = row(parent);
  label(r, opts.label);
  const s = el("select", {}, r);
  for (const o of opts.items) {
    const op = document.createElement("option");
    op.value = o.id != null ? o.id : o; op.textContent = o.name || o;
    s.appendChild(op);
  }
  s.value = opts.value;
  s.addEventListener("change", () => opts.on(s.value));
  return s;
}
function check(parent, opts) {
  const r = row(parent);
  const c = el("input", { type: "checkbox", id: "cb" + opts.label }, r);
  c.checked = !!opts.value;
  const l = el("label", { text: opts.label, for: "cb" + opts.label, style: "color:var(--ink2);font-size:11px" }, r);
  c.addEventListener("change", () => opts.on(c.checked));
  return c;
}

/* --------------------------------------------------------------- toast */
let toastT = 0;
function toast(msg, bad) {
  const t = $("toast");
  t.textContent = msg;
  t.style.borderColor = bad ? "var(--rd)" : "var(--cy)";
  t.style.color = bad ? "var(--rd)" : "var(--cy)";
  t.classList.add("show");
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove("show"), 1800);
}

/* ------------------------------------------------------- scene utilities */
/* Spatial convention.  Source and probe positions/apertures/pitches are
   stored in CELL units — the units buildFootprint() and sampleBuf() work in
   — and are converted to metres only for display.  Barrier-painting helpers
   take metres and convert, because they are written per-scene.  Both paths
   resolve through sim.dx, so a scene looks the same at every grid size. */
const toC = (m) => m / sim.dx;
const toM = (c) => c * sim.dx;
function toCells(mx, my) { return [mx / sim.dx, my / sim.dx]; }
function mkSource(o) {
  const s = Object.assign({
    id: idSeq++, kind: "cw", shape: "point", x: 200, y: 125, angle: 0,
    amp: 1, freq: 2.5, phase: 0, wf: "sine", steer: 0, curv: 0, focus: 0,
    spacing: 2, n: 8, len: 60, speed: 1, scale: 1, pulseW: 0.09,
    repeat: true, burstN: 3, active: true
  }, o);
  WaveCore.buildFootprint(sim, s);
  return s;
}
function clearNear(cx, cy, rCells) {
  for (const s of scene.sources) {
    if (Math.hypot(s.x - cx, s.y - cy) < rCells) {
      const cells = s.cells;
      if (cells) for (let i = 0; i < cells.length; i += 3) {
        const idx = cells[i];
        sim.flag[idx] = 0; sim.los[idx] = 0; sim.spd[idx] = 1;
      }
    }
  }
  sim.dirty = true;
}
function srcAt(cx, cy, radCells) {
  let best = null, bd = radCells;
  for (const s of scene.sources) {
    for (const p of sourceMarkers(s)) {
      const d = Math.hypot(p[0] - cx, p[1] - cy);
      if (d < bd) { bd = d; best = s; }
    }
  }
  return best;
}
function probeAt(cx, cy, radCells) {
  for (const p of scene.probes) if (Math.hypot(p.x - cx, p.y - cy) < radCells) return p;
  return null;
}
function removeSource(s) {
  scene.sources = scene.sources.filter((x) => x !== s);
  activeSources = scene.sources.filter((x) => x.active);
  if (sel === s) sel = null;
  refreshInspector();
}
function removeProbe(p) {
  scene.probes = scene.probes.filter((x) => x !== p);
  sim.probes = scene.probes;
  if (sel === p) sel = null;
  rebuildScopes();
}
function refreshActive() { activeSources = scene.sources.filter((s) => s.active); }
function rebuildAll() {
  for (const s of scene.sources) WaveCore.buildFootprint(sim, s);
  refreshActive();
  computeStride();
}

/* -------------------------------------------------------------- persistence */
const LSKEY = "wavelab.scene.v1";
function rle(arr) {
  const out = [];
  let v = arr[0], c = 0;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] === v && c < 65000) c++;
    else { out.push(v, c); v = arr[i]; c = 1; }
  }
  out.push(v, c);
  return out;
}
function unrle(flat, len) {
  const out = new Uint8Array(len);
  let p = 0;
  for (let i = 0; i + 1 < flat.length; i += 2) {
    const v = flat[i], c = flat[i + 1];
    for (let k = 0; k < c && p < len; k++) out[p++] = v;
  }
  return out;
}
function packMedium() {
  const N = sim.N;
  const a = new Uint8Array(N), b = new Uint8Array(N), c = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    a[i] = sim.flag[i] ? 1 : 0;
    b[i] = Math.round(clamp((sim.spd[i] - 0.3) / 1.3, 0, 1) * 255);
    c[i] = Math.round(clamp(sim.los[i] / 80, 0, 1) * 255);
  }
  return { W: sim.W, H: sim.H, f: rle(Array.from(a)), s: rle(Array.from(b)), l: rle(Array.from(c)) };
}
function unpackMedium(o) {
  if (!o || !o.f) return false;
  if (o.W !== sim.W || o.H !== sim.H) return false;      /* res changed */
  try {
    const f = unrle(o.f, sim.N), s = unrle(o.s, sim.N), l = unrle(o.l, sim.N);
    for (let i = 0; i < sim.N; i++) {
      sim.flag[i] = f[i];
      sim.spd[i] = 0.3 + (s[i] / 255) * 1.3;
      sim.los[i] = (l[i] / 255) * 80;
    }
    sim.dirty = true;
    return true;
  } catch (e) { return false; }
}
function serialize() {
  return JSON.stringify({
    v: 1,
    params: { res: Par.res, dt: Par.dt, speed: Par.speed, damping: Par.damping, boundary: Par.boundary, substeps: Par.substeps },
    display: { mode: P.mode, exposure: P.exposure, autoExp: P.autoExp, persistence: P.persistence, refFreq: P.refFreq },
    medium: packMedium(),
    sources: scene.sources.map((s) => { const o = Object.assign({}, s); delete o.cells; return o; }),
    probes: scene.probes.map((p) => ({ x: p.x, y: p.y, id: p.id }))
  });
}
function deserialize(txt) {
  let o;
  try { o = JSON.parse(txt); } catch (e) { return "not valid JSON"; }
  if (!o || o.v !== 1) return "unknown format";
  if (o.params && o.params.res !== Par.res) {
    Par.res = o.params.res; applyResolution(false);
  }
  if (o.params) {
    Object.assign(Par, o.params);
    sim.p.dt = Par.dt; sim.p.c0 = Par.speed; sim.p.damping = Par.damping;
    sim.p.boundary = Par.boundary; sim.p.substeps = Par.substeps;
  }
  if (o.display) Object.assign(P, o.display);
  if (!unpackMedium(o.medium)) return "grid size does not match this scene";
  scene.sources = (o.sources || []).map((s) => WaveCore.buildFootprint(sim, Object.assign({ id: idSeq++ }, s)));
  scene.probes = (o.probes || []).map((p) => ({ id: p.id || idSeq++, x: p.x, y: p.y, hist: new Float32Array(WaveCore.HIST), n: 0, hp: 0 }));
  sim.probes = scene.probes;
  rebuildAll();
  rebuildScopes();
  syncControls();
  return null;
}
/* --------------------------------------------------------------- presets */
function water() { WaveCore.clearMedium(sim); }
function wallLine(x0, y0, x1, y1, rM, gapM) {
  const [a, b] = toCells(x0, y0), [c, d] = toCells(x1, y1);
  WaveCore.paintSlit(sim, a, b, c, d, Math.max(1, rM / sim.dx), gapM ? Math.max(2, gapM / sim.dx) : 0);
}
function disc(x, y, rM, mode, val) {
  const [a, b] = toCells(x, y);
  WaveCore.paintDisc(sim, a, b, Math.max(1, rM / sim.dx), mode, val);
}
function rect(x, y, w, h, mode, val) {
  const step = Math.max(sim.dx * 1.2, 0.02);
  for (let yy = y; yy <= y + h; yy += step)
    for (let xx = x; xx <= x + w; xx += step) disc(xx, yy, sim.dx * 1.6, mode, val);
}
function vwall(x, y0, y1, thickM) {          /* vertical barrier at column x */
  const t = Math.max(1, (thickM || 0.04) / sim.dx);
  for (let y = y0; y <= y1; y += sim.dx * 1.1) disc(x, y, t * sim.dx, 1, 0);
}
function hwall(y, x0, x1, thickM) {          /* horizontal barrier at row y  */
  const t = Math.max(1, (thickM || 0.04) / sim.dx);
  for (let x = x0; x <= x1; x += sim.dx * 1.1) disc(x, y, t * sim.dx, 1, 0);
}

const PRESETS = [
  { id: "tw", name: "1 · two-source interference",
    run() {
      water();
      P.mode = "amp"; Par.damping = 0.35; Par.boundary = "absorb";
      scene.sources = [
        mkSource({ x: toC(1.0), y: toC(2.0), shape: "point", freq: 2.6, amp: 1 }),
        mkSource({ x: toC(1.0), y: toC(3.0), shape: "point", freq: 2.6, amp: 1 })
      ];
      scene.probes = [mkProbe(toC(6.6), toC(2.5)), mkProbe(toC(6.6), toC(3.5))];
    } },
  { id: "slit", name: "2 · single-slit diffraction",
    run() {
      water();
      P.mode = "amp"; Par.damping = 0.4; Par.boundary = "absorb";
      vwall(3.0, 0.15, 2.25, 0.05);
      vwall(3.0, 2.75, 4.85, 0.05);
      
      scene.sources = [mkSource({ x: toC(1.5), y: toC(2.5), shape: "line", angle: 90, len: toC(1.3), freq: 3.1, amp: 0.85 })];
      scene.probes = [mkProbe(toC(4.6), toC(2.5)), mkProbe(toC(6.3), toC(1.35)), mkProbe(toC(6.3), toC(3.65))];
    } },
  { id: "dbar", name: "3 · double slit",
    run() {
      water();
      P.mode = "amp"; Par.damping = 0.4; Par.boundary = "absorb";
      vwall(2.6, 0.2, 1.85, 0.05);
      vwall(2.6, 2.15, 2.85, 0.05);
      vwall(2.6, 3.15, 4.8, 0.05);
      scene.sources = [mkSource({ x: toC(1.2), y: toC(2.5), shape: "line", angle: 90, len: toC(1.8), freq: 3.0, amp: 0.9 })];
      scene.probes = [mkProbe(toC(5.2), toC(2.5)), mkProbe(toC(6.6), toC(2.5)), mkProbe(toC(6.6), toC(1.6)), mkProbe(toC(6.6), toC(3.4))];
    } },
  { id: "lens", name: "4 · lens: refraction + focusing",
    run() {
      water();
      P.mode = "amp"; Par.damping = 0.3; Par.boundary = "absorb";
      disc(4.5, 2.5, 0.95, 4, 0);
      disc(4.5, 2.5, 0.6, 4, 0);
      scene.sources = [mkSource({ x: toC(1.1), y: toC(2.5), shape: "line", angle: 90, len: toC(2.4), freq: 3.0, amp: 0.9 })];
      scene.probes = [mkProbe(toC(3.1), toC(2.5)), mkProbe(toC(6.2), toC(2.5)), mkProbe(toC(6.2), toC(1.6))];
    } },
  { id: "deep", name: "5 · shallow-water step (n = 1.67)",
    run() {
      water();
      P.mode = "amp"; Par.damping = 0.3; Par.boundary = "absorb";
      rect(4.0, 0.0, 4.0, 5.0, 3, 0.6);
      scene.sources = [mkSource({ x: toC(0.9), y: toC(2.5), shape: "line", angle: 90, len: toC(3.4), freq: 3.0, amp: 0.95 })];
      scene.probes = [mkProbe(toC(3.3), toC(1.2)), mkProbe(toC(5.0), toC(1.2)), mkProbe(toC(6.6), toC(2.1))];
    } },
  { id: "array", name: "6 · phased array: steering & focusing",
    run() {
      water();
      P.mode = "flow"; Par.damping = 0.35; Par.boundary = "absorb";
      scene.sources = [
        mkSource({ x: toC(0.75), y: toC(2.5), shape: "array", angle: 90, n: 12, spacing: 2, curv: 0, steer: 0, freq: 5.0, amp: 0.85 }),
        mkSource({ x: toC(0.75), y: toC(0.62), shape: "array", angle: 90, n: 12, spacing: 2, curv: toC(1.3), steer: 0, freq: 5.0, amp: 0.85 })
      ];
      scene.probes = [mkProbe(toC(4.2), toC(2.5)), mkProbe(toC(4.2), toC(0.62)), mkProbe(toC(2.2), toC(3.6))];
    } },
  { id: "stand", name: "7 · standing wave (opposing emitters)",
    run() {
      water();
      P.mode = "int"; Par.damping = 0.12; Par.boundary = "reflect";
      scene.sources = [
        mkSource({ x: toC(0.35), y: toC(2.5), shape: "line", angle: 90, len: toC(4.2), freq: 4.4, amp: 0.8 }),
        mkSource({ x: toC(7.65), y: toC(2.5), shape: "line", angle: 90, len: toC(4.2), freq: 4.4, amp: 0.8, phase: 0 })
      ];
      scene.probes = [mkProbe(toC(4.0), toC(2.5)), mkProbe(toC(4.0), toC(1.3)), mkProbe(toC(2.4), toC(2.5))];
    } },
  { id: "echo", name: "8 · specular echo (mirror + baffle)",
    run() {
      water();
      P.mode = "amp"; Par.damping = 0.18; Par.boundary = "reflect";
      hwall(4.0, 1.6, 8.0, 0.045);
      rect(2.24, 0.4, 0.28, 2.0, 2, 0);
      scene.sources = [mkSource({ x: toC(0.8), y: toC(0.8), kind: "pulse", shape: "point", freq: 5, pulseW: 0.08, amp: 1.6, repeat: true })];
      scene.probes = [mkProbe(toC(6.0), toC(1.2)), mkProbe(toC(4.0), toC(2.0)), mkProbe(toC(5.0), toC(4.8))];
    } },
  { id: "clones", name: "9 · Young with a collimated pair",
    run() {
      water();
      P.mode = "int"; Par.damping = 0.35; Par.boundary = "absorb";
      vwall(1.6, 1.35, 3.65, 0.045);
      vwall(4.5, 0.6, 2.2, 0.05);
      vwall(4.5, 2.8, 4.4, 0.05);
      scene.sources = [mkSource({ x: toC(0.7), y: toC(2.5), shape: "point", freq: 3.0, amp: 1 })];
      scene.probes = [mkProbe(toC(6.5), toC(2.5)), mkProbe(toC(6.5), toC(1.5)), mkProbe(toC(6.5), toC(3.5)), mkProbe(toC(3.1), toC(2.5))];
    } },
  { id: "cancel", name: "10 · destructive cancellation",
    run() {
      water();
      P.mode = "amp"; Par.damping = 0.3; Par.boundary = "absorb";
      scene.sources = [
        mkSource({ x: toC(2.2), y: toC(1.3), shape: "point", freq: 3.2, amp: 1, phase: 0 }),
        mkSource({ x: toC(2.2), y: toC(3.7), shape: "point", freq: 3.2, amp: 1, phase: 180 })
      ];
      scene.probes = [mkProbe(toC(4.4), toC(2.5)), mkProbe(toC(3.0), toC(2.5)), mkProbe(toC(6.4), toC(2.5))];
    } },
  { id: "absorb", name: "11 · absorber vs mirror",
    run() {
      water();
      P.mode = "energy"; Par.damping = 0.2; Par.boundary = "reflect";
      vwall(2.4, 0.4, 2.1, 0.045);
      rect(2.4, 2.9, 0.55, 1.7, 2, 0);
      scene.sources = [mkSource({ x: toC(1.0), y: toC(2.5), shape: "line", angle: 90, len: toC(4.0), freq: 3.4, amp: 0.9 })];
      scene.probes = [mkProbe(toC(1.8), toC(1.2)), mkProbe(toC(4.6), toC(3.6)), mkProbe(toC(6.6), toC(1.2))];
    } },
  { id: "caustic", name: "12 · curved wall, caustics & turbulence",
    run() {
      water();
      P.mode = "amp"; Par.damping = 0.25; Par.boundary = "reflect";
      for (let k = 0; k <= 60; k++) {
        const t = k / 60;
        disc(2.2 + t * 2.4, 1.15 + 0.85 * Math.sin(t * Math.PI), sim.dx * 1.6, 1, 0);
      }
      rect(5.6, 2.9, 0.9, 0.9, 3, 0.62);
      rect(6.6, 1.2, 0.7, 0.7, 3, 1.45);
      scene.sources = [mkSource({ x: toC(0.9), y: toC(2.5), shape: "line", angle: 90, len: toC(3.2), freq: 3.6, amp: 0.95 })];
      scene.probes = [mkProbe(toC(4.1), toC(3.3)), mkProbe(toC(6.1), toC(3.35)), mkProbe(toC(3.4), toC(0.55))];
    } }
];
function mkProbe(x, y) {
  return { id: idSeq++, x, y, hist: new Float32Array(WaveCore.HIST), n: 0, hp: 0 };
}

/* ------------------------------------------------------- scope instruments */
const FFTN = 256, BARS = 26;
const fre = new Float64Array(FFTN), fim = new Float64Array(FFTN), mag = new Float64Array(FFTN / 2);
function fft(re, im, n) {
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ar = re[i + k], ai = im[i + k];
        const br = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const bi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ar + br; im[i + k] = ai + bi;
        re[i + k + len / 2] = ar - br; im[i + k + len / 2] = ai - bi;
        const ncr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = ncr;
      }
    }
  }
}
function rebuildScopes() {
  const host = $("scopes");
  host.innerHTML = "";
  scopeCanvases = [];
  if (!scene.probes.length) {
    el("div", { id: "noscopes", html: "probes: pick the <b>probe</b> tool (P) and click the tank — each probe gets a live trace, amplitude, dominant frequency and spectrum" }, host);
    return;
  }
  for (let i = 0; i < scene.probes.length; i++) {
    const p = scene.probes[i];
    const box = el("div", { class: "scope" }, host);
    const c = el("canvas", { class: "scopeCv" }, box);
    scopeCanvases.push({ probe: p, cv: c, box: box });
  }
  layoutScopes();
}
function layoutScopes() {
  const n = scopeCanvases.length;
  if (!n) return;
  const avail = Math.max(200, $("scopes").clientWidth - 12 - (n - 1) * 8);
  const w = clamp(Math.floor(avail / n), 190, 430);
  const h = clamp(($("scopes").clientHeight || 140) - 10, 90, 200);
  for (const s of scopeCanvases) {
    s.cv.style.width = w + "px"; s.cv.style.height = h + "px";
    s.cv.width = Math.round(w * dpr); s.cv.height = Math.round(h * dpr);
  }
}
function drawScopes() {
  if (!scopeCanvases.length) return;
  const S = sim;
  const ref = scene.sources.find((s) => s.active && s.kind !== "pulse");
  const fref = ref ? ref.freq : P.refFreq;
  for (const sc of scopeCanvases) {
    const p = sc.probe, c = sc.cv;
    const g = c.getContext("2d");
    const W = c.width, H = c.height;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = "#0a0f16"; g.fillRect(0, 0, W, H);
    const n = Math.min(p.n, 300);
    const dtS = Math.max(1e-4, S.pStr * (S.dtUsed || S.p.dt));
    const tw = n * dtS;
    /* ---- waveform panel ---- */
    const wl = Math.floor(W * 0.6);
    let peak = 0, rms = 0;
    for (let k = 0; k < n; k++) {
      const v = p.hist[(p.hp - n + k + 2 * WaveCore.HIST) % WaveCore.HIST];
      const a = Math.abs(v); if (a > peak) peak = a; rms += v * v;
    }
    rms = Math.sqrt(rms / Math.max(1, n));
    const sc2 = Math.max(1e-6, peak * 1.15);
    g.strokeStyle = "rgba(120,150,175,.25)"; g.lineWidth = 1;
    g.beginPath(); g.moveTo(0, H / 2); g.lineTo(wl, H / 2); g.stroke();
    g.strokeStyle = "#37d6c4"; g.lineWidth = 1.1;
    g.beginPath();
    for (let px = 0; px < wl; px++) {
      const k = Math.floor(px / wl * n);
      const v = p.hist[(p.hp - n + k + 2 * WaveCore.HIST) % WaveCore.HIST];
      const y = H * 0.55 - (v / sc2) * H * 0.42;
      if (px === 0) g.moveTo(px, y); else g.lineTo(px, y);
    }
    g.stroke();
    /* ---- spectrum panel ---- */
    const x0 = wl + 6, w2 = W - x0 - 4;
    if (n > 64) {
      for (let k = 0; k < FFTN; k++) {
        const k2 = n - FFTN + k;
        const w0 = 0.5 - 0.5 * Math.cos(TAU * k / (FFTN - 1));
        fre[k] = p.hist[(p.hp - n + k2 + 2 * WaveCore.HIST) % WaveCore.HIST] * w0;
        fim[k] = 0;
      }
      fft(fre, fim, FFTN);
      let mmax = 1e-9;
      for (let k = 1; k < FFTN / 2; k++) {
        const m = Math.hypot(fre[k], fim[k]);
        mag[k] = m; if (m > mmax) mmax = m;
      }
      const fmax = Math.min(14, 0.5 / dtS);
      const bw = w2 / BARS;
      for (let b = 0; b < BARS; b++) {
        const f0 = fmax * b / BARS, f1 = fmax * (b + 1) / BARS;
        let m = 0;
        const k0 = Math.max(1, Math.floor(f0 * FFTN * dtS)), k1 = Math.min(FFTN / 2 - 1, Math.ceil(f1 * FFTN * dtS));
        for (let k = k0; k <= k1; k++) if (mag[k] > m) m = mag[k];
        const hgt = Math.pow(m / mmax, 0.6) * (H - 14);
        g.fillStyle = b % 2 ? "#3b6ea8" : "#4aa3ff";
        g.fillRect(x0 + b * bw, H - 4 - hgt, Math.max(1, bw - 1), hgt);
      }
      if (ref) {
        const bx = x0 + (fref / fmax) * w2;
        g.strokeStyle = "#ffb454"; g.setLineDash([2, 2]);
        g.beginPath(); g.moveTo(bx, 3); g.lineTo(bx, H - 3); g.stroke();
        g.setLineDash([]);
      }
      /* dominant frequency, parabolic peak */
      let bi = 1;
      for (let k = 2; k < FFTN / 2; k++) if (mag[k] > mag[bi]) bi = k;
      const y0v = mag[bi - 1] || 1e-9, y1v = mag[bi] || 1e-9, y2v = mag[bi + 1] || 1e-9;
      const dk = 0.5 * (y0v - y2v) / Math.max(1e-12, y0v - 2 * y1v + y2v);
      const fdom = (bi + clamp(dk, -0.5, 0.5)) / (FFTN * dtS);
      /* ---- phase vs reference (Hann projection at fref) ---- */
      let phTxt = "";
      if (ref && fref > 0.05 && fref < 0.5 / dtS - 0.05) {
        let A = 0, B = 0;
        for (let k = 0; k < n; k++) {
          const v = p.hist[(p.hp - n + k + 2 * WaveCore.HIST) % WaveCore.HIST];
          const trel = (k - n + 1) * dtS;
          const w0 = 0.5 - 0.5 * Math.cos(TAU * k / (n - 1));
          A += v * w0 * Math.cos(TAU * fref * trel);
          B += v * w0 * Math.sin(TAU * fref * trel);
        }
        let ph = Math.atan2(B, A) * 180 / Math.PI - ref.phase;
        ph = ((ph + 180) % 360 + 360) % 360 - 180;
        const amp = Math.hypot(A, B) / n;
        phTxt = "  Δφ " + ph.toFixed(0) + "°";
        /* phasor dial */
        const cx = W - 16, cy = 14, r = 9;
        g.strokeStyle = "rgba(255,180,84,.6)";
        g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.stroke();
        const a = (ph + ref.phase) * Math.PI / 180;
        g.strokeStyle = amp > 1e-5 ? "#ffe66d" : "#5f7488";
        g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); g.stroke();
      }
      g.fillStyle = "#8ea3b8";
      g.font = Math.round(9 * dpr) + "px ui-monospace,monospace";
      g.fillText("|u| " + peak.toFixed(3) + " rms " + rms.toFixed(3) + phTxt, 4, 10);
      g.fillStyle = "#cfe0ee";
      g.fillText("f₀ " + fdom.toFixed(2) + " Hz", 4, H - 5);
      g.fillStyle = "#5f7488";
      g.fillText("probe " + (p.x * sim.dx).toFixed(2) + "," + (p.y * sim.dx).toFixed(2) + "  " + tw.toFixed(1) + " s win", x0, 10);
    } else {
      g.fillStyle = "#5f7488";
      g.font = Math.round(10 * dpr) + "px ui-monospace,monospace";
      g.fillText("collecting…", x0, 20);
      g.fillStyle = "#8ea3b8";
      g.fillText("|u| " + peak.toFixed(3), 4, 12);
    }
  }
}
