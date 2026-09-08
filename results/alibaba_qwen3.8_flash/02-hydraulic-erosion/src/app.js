/* =====================================================================
   Application shell: control panel, camera, pointer tools, render loop,
   diagnostics, import/export.  Depends on LAB (sim + renderer modules).
   ===================================================================== */

const APP = {};

const $ = (id) => document.getElementById(id);
const fix = (v, d) => (Number.isFinite(v) ? v.toFixed(d) : '\u2014');
const clampNum = (v, a, b) => (v < a ? a : v > b ? b : v);

let sim = null;
let renderer = null;

function toast(text, kind, ms) {
  const host = $('toasts');
  if (!host) return;
  const el = document.createElement('div');
  el.className = 'toast' + (kind ? ' ' + kind : '');
  el.textContent = text;
  host.appendChild(el);
  setTimeout(() => {
    el.classList.add('fade');
    setTimeout(() => el.remove(), 520);
  }, ms || 2600);
  while (host.children.length > 4) host.removeChild(host.firstChild);
  console.log('[lab] ' + text);
}

/* ------------------------------------------------------------------ */
/*  state                                                              */
/* ------------------------------------------------------------------ */

const DEFAULT_GEN = {
  style: 'mountain',
  relief: 0.34,
  scale: 4.5,
  octaves: 5,
  roughness: 0.45,
  ridge: 0.5,
  island: 0,
  seaLevel: 0.012,
  sediment: 0,
  warp: 0.6,
  springs: 5,
  seed: 'sierra-01',
};

const state = {
  running: true,
  speed: 1,
  substeps: 2,
  res: 128,
  params: Object.assign({}, LAB.DEFAULT_PARAMS),
  gen: Object.assign({}, DEFAULT_GEN),
  view: {
    mode: 'shaded',
    exaggeration: 1.6,
    waterOpacity: 0.8,
    contours: true,
    grid: false,
    sunAzimuth: 132,
    sunElevation: 36,
    shadowSteps: 8,
    subdivision: 2,
    fov: 50,
  },
  brush: { tool: 'raise', radius: 9, strength: 0.55 },
  preset: 'alpine',
};

const diag = { frames: 0, simMs: 0, drawMs: 0, fps: 0, lastFpsAt: 0, glErrors: 0 };

const settings = {
  modeIndex: 0,
  mode: 'shaded',
  exaggeration: 1.6,
  waterOpacity: 0.8,
  contours: true,
  grid: false,
  shadowSteps: 8,
  sunAzimuth: 132,
  sunElevation: 36,
  subdivision: 2,
  marker: [0.5, 0.5],
  markerOn: false,
};

const TOOLS = [
  { id: 'raise', label: 'Raise', kind: '' },
  { id: 'lower', label: 'Lower', kind: 'sink' },
  { id: 'smooth', label: 'Smooth', kind: 'sink' },
  { id: 'flatten', label: 'Flatten', kind: 'sink' },
  { id: 'water', label: 'Water', kind: 'water' },
  { id: 'sediment', label: 'Sediment', kind: 'water' },
  { id: 'dry', label: 'Dry', kind: 'sink' },
  { id: 'inspect', label: 'Inspect', kind: 'probe' },
];

const STYLES = [
  { id: 'mountain', label: 'Mountain dome' },
  { id: 'canyon', label: 'Canyon plateau' },
  { id: 'island', label: 'Island' },
  { id: 'valley', label: 'River valley' },
  { id: 'plateau', label: 'Plateau' },
  { id: 'plain', label: 'Low plain' },
];

const PRESETS = [
  {
    id: 'alpine',
    label: 'Mountain drainage',
    gen: { style: 'mountain', relief: 0.34, scale: 4.5, octaves: 5, roughness: 0.45, ridge: 0.5, island: 0, seaLevel: 0.012, springs: 5, sediment: 0, warp: 0.6 },
    params: { rain: 0.16, evap: 0.3, erode: 0.6, deposit: 0.5, capacity: 0.5, flow: 0.6, thermal: 0.1, talus: 55 },
    view: { mode: 'shaded', exaggeration: 1.8, waterOpacity: 0.8, contours: true, sunAzimuth: 132, sunElevation: 36 },
  },
  {
    id: 'canyon',
    label: 'Canyon cutting',
    gen: { style: 'canyon', relief: 0.3, scale: 3.2, octaves: 4, roughness: 0.4, ridge: 0.25, island: 0, seaLevel: 0.006, springs: 4, sediment: 0.4, warp: 0.45 },
    params: { rain: 0.3, evap: 0.35, erode: 1.4, deposit: 0.8, capacity: 0.9, flow: 0.75, thermal: 0.35, talus: 42 },
    view: { mode: 'shaded', exaggeration: 2.0, waterOpacity: 0.8, contours: true, sunAzimuth: 205, sunElevation: 26 },
  },
  {
    id: 'island',
    label: 'Island rainfall',
    gen: { style: 'island', relief: 0.3, scale: 5, octaves: 5, roughness: 0.5, ridge: 0.3, island: 0.85, seaLevel: 0.05, springs: 6, sediment: 0.2, warp: 0.7 },
    params: { rain: 0.5, evap: 0.35, erode: 0.8, deposit: 0.7, capacity: 0.6, flow: 0.65, thermal: 0.18, talus: 50 },
    view: { mode: 'shaded', exaggeration: 1.9, waterOpacity: 0.88, contours: false, sunAzimuth: 60, sunElevation: 34 },
  },
  {
    id: 'valley',
    label: 'River valley',
    gen: { style: 'valley', relief: 0.28, scale: 4, octaves: 5, roughness: 0.45, ridge: 0.35, island: 0, seaLevel: 0.01, springs: 4, sediment: 0.3, warp: 0.55 },
    params: { rain: 0.3, evap: 0.2, erode: 0.7, deposit: 0.6, capacity: 0.5, flow: 0.6, thermal: 0.12, talus: 52 },
    view: { mode: 'shaded', exaggeration: 1.9, waterOpacity: 0.82, contours: true, sunAzimuth: 300, sunElevation: 30 },
  },
  {
    id: 'delta',
    label: 'Delta + floodplain',
    gen: { style: 'plain', relief: 0.12, scale: 6, octaves: 5, roughness: 0.5, ridge: 0.2, island: 0, seaLevel: 0.035, springs: 3, sediment: 1.4, warp: 0.8 },
    params: { rain: 0.55, evap: 0.25, erode: 0.9, deposit: 1.2, capacity: 0.8, flow: 0.55, thermal: 0.1, talus: 48 },
    view: { mode: 'shaded', exaggeration: 2.4, waterOpacity: 0.86, contours: true, sunAzimuth: 150, sunElevation: 22 },
  },
  {
    id: 'stress',
    label: 'Aggressive stress test',
    gen: { style: 'mountain', relief: 0.42, scale: 7, octaves: 7, roughness: 0.6, ridge: 0.7, island: 0, seaLevel: 0, springs: 9, sediment: 0.6, warp: 1 },
    params: { rain: 1, evap: 0, erode: 2.6, deposit: 1.6, capacity: 2.4, flow: 2.2, thermal: 1.6, talus: 24 },
    view: { mode: 'shaded', exaggeration: 1.5, waterOpacity: 0.7, contours: false, sunAzimuth: 100, sunElevation: 40 },
    substeps: 3,
    speed: 2,
  },
];

/* ------------------------------------------------------------------ */
/*  camera                                                             */
/* ------------------------------------------------------------------ */

const cam = {
  yaw: 0.72,
  pitch: 0.52,
  distance: 2.0,
  target: [0.5, 0.04, 0.5],
  fov: 50,
  eye: [0, 0, 0],
  basis: { right: [1, 0, 0], up: [0, 1, 0], fwd: [0, 0, -1] },
  update() {
    const cp = Math.cos(this.pitch);
    const sp = Math.sin(this.pitch);
    const dx = Math.sin(this.yaw) * cp;
    const dy = sp;
    const dz = Math.cos(this.yaw) * cp;
    this.eye = [this.target[0] + dx * this.distance, this.target[1] + dy * this.distance, this.target[2] + dz * this.distance];
    const f = [-dx, -dy, -dz];
    /* right = forward x worldUp, up = right x forward (right-handed frame) */
    let rx = -f[2];
    let ry = 0;
    let rz = f[0];
    const l = Math.hypot(rx, ry, rz) || 1;
    const r = [rx / l, ry / l, rz / l];
    const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
    this.basis.fwd = f;
    this.basis.right = r;
    this.basis.up = u;
  },
  orbit(dx, dy) {
    this.yaw -= dx * 0.0055;
    this.pitch = clampNum(this.pitch + dy * 0.005, 0.02, 1.5);
    this.update();
  },
  pan(dx, dy) {
    const k = this.distance * 0.0011;
    const r = this.basis.right;
    const u = this.basis.up;
    for (let i = 0; i < 3; i++) this.target[i] += r[i] * -dx * k + r[1] * 0 + u[i] * dy * k;
    this.target[0] = clampNum(this.target[0], -0.6, 1.6);
    this.target[1] = clampNum(this.target[1], -0.4, 1.2);
    this.target[2] = clampNum(this.target[2], -0.6, 1.6);
    this.update();
  },
  zoom(factor) {
    this.distance = clampNum(this.distance * factor, 0.12, 7);
    this.update();
  },
  reset() {
    this.yaw = 0.72;
    this.target = [0.5, 0.04, 0.5];
    fitCamera();
  },
};

/* Frame the whole 1×1 terrain for the current canvas shape: a portrait phone
   needs a longer arm and a steeper look-down than a wide desktop window. */
function fitCamera() {
  const canvas = $('view');
  const aspect = (canvas ? canvas.width : 1280) / Math.max(1, canvas ? canvas.height : 800);
  cam.distance = aspect < 1 ? clampNum(1.3 / Math.max(0.4, aspect), 1.8, 3.2) : clampNum(1.7 + 0.6 / Math.max(1, aspect), 1.7, 2.6);
  cam.pitch = aspect < 1 ? 0.92 : 0.88;
  cam.update();
}

/* ------------------------------------------------------------------ */
/*  settings plumbing                                                  */
/* ------------------------------------------------------------------ */

function syncSettings() {
  const i = Math.max(0, LAB.MODES.findIndex((m) => m.id === state.view.mode));
  settings.modeIndex = i;
  settings.mode = LAB.MODES[i].id;
  settings.exaggeration = state.view.exaggeration;
  settings.waterOpacity = state.view.waterOpacity;
  settings.contours = state.view.contours;
  settings.grid = state.view.grid;
  settings.shadowSteps = state.view.shadowSteps;
  settings.sunAzimuth = state.view.sunAzimuth;
  settings.sunElevation = state.view.sunElevation;
  settings.subdivision = state.view.subdivision;
  cam.fov = state.view.fov;
  cam.update();
  if (renderer) renderer.setExag(state.view.exaggeration);
  const el = $('hudMode');
  if (el) el.textContent = LAB.MODES[i].label;
}

function setResolution(n) {
  if (n === sim.n) return;
  sim = LAB.createSim(n, state.params);
  LAB.generate(sim, state.gen.style, Object.assign({ seed: state.gen.seed }, state.gen));
  LAB.resetWater(sim);
  syncSettings();
  toast(`Simulation grid set to ${n}\u00b2 (${(n * n).toLocaleString()} cells)`);
}

/* ------------------------------------------------------------------ */
/*  boot                                                               */
/* ------------------------------------------------------------------ */

APP.start = function () {
  const stage = $('stage');
  const canvas = $('view');
  const qs = new URLSearchParams(location.search);
  const force2d = qs.get('renderer') === '2d' || qs.get('force2d') === '1';

  loadSettings();

  sim = LAB.createSim(state.res, state.params);
  LAB.generate(sim, state.gen.style, Object.assign({ seed: state.gen.seed }, state.gen));
  LAB.resetWater(sim);

  try {
    renderer = LAB.createRenderer(canvas, force2d);
  } catch (err) {
    console.warn('[lab] renderer creation threw: ' + err.message);
  }
  if (!renderer) {
    try {
      renderer = LAB.createRenderer(canvas, true);
    } catch (err) {
      console.error('[lab] no renderer available: ' + err.message);
    }
  }
  if (!renderer) {
    document.body.insertAdjacentHTML('beforeend', '<div class="toast bad">No canvas renderer available in this browser.</div>');
    return;
  }
  console.log(`[lab] renderer ${renderer.backend} \u00b7 ${renderer.info.name} \u00b7 gpu=${renderer.info.gpu} \u00b7 floatLinear=${renderer.info.floatLinear}`);

  /* handle for automated inspection (also handy in the devtools console) */
  window.lab = {
    state,
    cam,
    settings,
    diag,
    get sim() {
      return sim;
    },
    get renderer() {
      return renderer;
    },
    setResolution,
    syncSettings,
    step(n) {
      LAB.step(sim, n || state.substeps);
      return sim.stats;
    },
    runPreset(id) {
      applyPreset(PRESETS.find((p) => p.id === id) || PRESETS[0]);
    },
    setRunning(v) {
      state.running = !!v;
      syncPanel();
    },
    setTool(t) {
      state.brush.tool = t;
      syncPanel();
    },
    probe: (x, y) => LAB.probe(sim, x, y),
    brush: (tool, x, y, r, s) => LAB.applyBrush(sim, tool, x, y, r, s),
    exportState: () => LAB.exportState(sim),
    importState(obj) {
      LAB.importState(sim, obj);
      if (sim.n !== state.res) {
        state.res = sim.n;
        syncPanel();
      }
      syncSettings();
    },
  };

  cam.update();
  requestAnimationFrame(() => {
    resizeCanvas();
    fitCamera();
  });
  buildPanel();
  buildToolbar();
  setupInput(stage);
  setupMinimap();
  syncSettings();

  /* ---------- stability guard ---------- */
  const guard = { recoveries: 0, damped: 0 };
  function checkStability() {
    if (sim.recoveries > guard.recoveries) {
      guard.recoveries = sim.recoveries;
      state.params.flow = Math.max(0.15, state.params.flow * 0.55);
      state.params.erode = Math.max(0.1, state.params.erode * 0.6);
      state.params.thermal = Math.max(0.02, state.params.thermal * 0.6);
      sim.params = Object.assign({}, state.params);
      sim.fx.fill(0);
      sim.fy.fill(0);
      guard.damped++;
      toast('Instability detected: non-finite values were clamped and flow/erosion damped to keep the run usable (dampings: ' + guard.damped + ').', 'bad', 5200);
      syncPanel();
    }
  }

  /* ---------- frame loop ---------- */
  const STEP_MS = 1000 / 60;
  let acc = 0;
  let last = performance.now();
  let hudAt = 0;
  let mmAt = 0;
  let slowFrames = 0;
  let lostNoted = false;

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(120, now - last);
    last = now;
    const t0 = performance.now();

    if (state.running) {
      acc += dt * state.speed;
      let steps = 0;
      const maxSteps = state.res > 192 ? 3 : 6;
      while (acc >= STEP_MS && steps < maxSteps) {
        LAB.step(sim, state.substeps);
        acc -= STEP_MS;
        steps++;
      }
      if (acc > STEP_MS * 8) acc = STEP_MS * 8;
      checkStability();
    } else {
      acc = 0;
    }
    const t1 = performance.now();

    if (renderer.lostContext && renderer.lostContext()) {
      if (!lostNoted) {
        lostNoted = true;
        toast('WebGL context was lost \u2014 reload the page to continue rendering.', 'bad', 6000);
      }
      return;
    }

    const err = renderer.render(sim, cam, settings);
    const t2 = performance.now();

    if (shotRequest) {
      const req = shotRequest;
      shotRequest = null;
      try {
        const cap = renderer.capture ? renderer.capture() : null;
        if (!cap) throw new Error('the renderer cannot read back pixels');
        const bytes = encodeCanvasPNG(cap);
        download(new Blob([bytes], { type: 'image/png' }), 'erosion-view-' + sim.n + 'px.png');
        toast('View snapshot exported (' + (bytes.length / 1024).toFixed(0) + ' KiB, ' + cap.w + '\u00d7' + cap.h + ')');
      } catch (err2) {
        req.fail(err2.message);
      }
    }

    if (pointerState.stroke && pointerState.mode === 'tool') heldToolApply(dt);

    diag.frames++;
    diag.simMs = diag.simMs * 0.9 + (t1 - t0) * 0.1;
    diag.drawMs = diag.drawMs * 0.9 + (t2 - t1) * 0.1;
    if (err) {
      diag.glErrors++;
      if (diag.glErrors === 2) toast('Renderer reported ' + err + ' (see console)', 'warn');
    }
    if (now - diag.lastFpsAt > 500) {
      diag.fps = (diag.frames * 1000) / (now - diag.lastFpsAt);
      diag.frames = 0;
      diag.lastFpsAt = now;
    }

    if (state.running && diag.simMs + diag.drawMs > 34) slowFrames++;
    else slowFrames = Math.max(0, slowFrames - 2);
    if (slowFrames > 90 && state.view.subdivision > 1) {
      state.view.subdivision = 1;
      slowFrames = 0;
      syncSettings();
      toast('Frame budget exceeded: mesh density reduced to 1\u00d7 cells to recover frame rate.', 'warn', 4200);
      syncPanel();
    }

    if (now - hudAt > 190) {
      hudAt = now;
      updateHud(sim);
    }
    if (now - mmAt > 260) {
      mmAt = now;
      APP.drawMinimap(sim);
    }
  }

  requestAnimationFrame(frame);
  toast('Lab ready \u00b7 ' + renderer.info.name + (renderer.info.gpu ? ' \u00b7 ' + renderer.info.gpu.slice(0, 46) : ''), null, 3600);
};

/* ------------------------------------------------------------------ */
/*  HUD                                                                */
/* ------------------------------------------------------------------ */

function updateHud(s) {
  const st = s.stats || { sumW: 0, sumS: 0, maxW: 0, maxS: 0, wetFrac: 0, cappedRatio: 0 };
  const N = s.n * s.n;
  $('vFps').textContent = fix(diag.fps, 0) + ' fps';
  $('vFrame').textContent = diag.simMs.toFixed(1) + '+' + diag.drawMs.toFixed(1) + ' ms';
  $('vGrid').textContent = s.n + '\u00b2 = ' + N.toLocaleString() + ' cells';
  $('vTime').textContent = s.step.toLocaleString() + ' steps \u00b7 ' + s.time.toFixed(1) + ' d';
  $('vWater').textContent = (st.sumW * 1000).toFixed(1) + ' mm\u00b3 \u00b7 max ' + (st.maxW * 1000).toFixed(1) + ' mm';
  $('vSed').textContent = (st.sumS * 1000).toFixed(2) + ' mm\u00b3 \u00b7 max ' + (st.maxS * 1000).toFixed(2);
  const bits = [];
  if (s.recoveries) bits.push(s.recoveries + '\u00d7 clamped');
  if (s.unstable) bits.push('watch');
  $('vStab').textContent = (bits.length ? bits.join(' \u00b7 ') : 'ok') + ' \u00b7 ' + (st.cappedRatio * 100).toFixed(0) + '% limited';
  const wet = clampNum(st.wetFrac || 0, 0, 1);
  $('bWet').style.width = (wet * 100).toFixed(1) + '%';
  $('tWet').textContent = (wet * 100).toFixed(0) + '%';
  const cap = clampNum(st.cappedRatio || 0, 0, 1);
  $('bCap').style.width = (cap * 100).toFixed(1) + '%';
  $('tCap').textContent = (cap * 100).toFixed(0) + '%';
  const cost = clampNum((diag.simMs || 0) / 16.7, 0, 1);
  $('bSim').style.width = (cost * 100).toFixed(0) + '%';
  $('tSim').textContent = (diag.simMs || 0).toFixed(1) + 'ms';
  const hs = $('hudState');
  hs.textContent = state.running ? 'running' : 'paused';
  hs.className = 'pill ' + (state.running ? 'run' : 'pause');
}

/* ------------------------------------------------------------------ */
/*  probe readout                                                      */
/* ------------------------------------------------------------------ */

function updateProbe(html) {
  const el = $('probe');
  if (!el || el._html === html) return;
  el._html = html;
  el.innerHTML = html;
}

/* ------------------------------------------------------------------ */
/*  minimap                                                            */
/* ------------------------------------------------------------------ */

function setupMinimap() {
  const cv = $('mmCanvas');
  const ctx = cv.getContext('2d');
  const S = 66;
  const img = ctx.createImageData(S, S);
  const tmp = document.createElement('canvas');
  tmp.width = S;
  tmp.height = S;
  const tmpCtx = tmp.getContext('2d');
  const shade = new Float32Array(S * S);

  APP.drawMinimap = function (s) {
    if (!ctx || document.hidden) return;
    const n = s.n;
    const d = img.data;
    const step = (n - 1) / (S - 1);
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const gx = Math.min(n - 1, Math.round(x * step));
        const gy = Math.min(n - 1, Math.round(y * step));
        shade[y * S + x] = s.h[gy * n + gx] + Math.min(s.w[gy * n + gx], 0.1);
      }
    }
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const k = (y * S + x) * 4;
        const gx = Math.min(n - 1, Math.round(x * step));
        const gy = Math.min(n - 1, Math.round(y * step));
        const si = gy * n + gx;
        const hL = shade[y * S + Math.max(0, x - 1)];
        const hR = shade[y * S + Math.min(S - 1, x + 1)];
        const hU = shade[Math.max(0, y - 1) * S + x];
        const hD = shade[Math.min(S - 1, y + 1) * S + x];
        const sh = Math.max(0.12, Math.min(1.4, 0.76 + (hU + hL - hR - hD) * 24));
        const w = s.w[si];
        const sed = s.sed[si];
        const h = s.h[si];
        let r;
        let g;
        let b;
        if (w > 0.0004) {
          const t = clampNum(w * 20, 0, 1);
          r = 46 + 70 * clampNum(sed * 80, 0, 1);
          g = 96 + 34 * clampNum(sed * 60, 0, 1);
          b = 156 - 34 * t;
        } else {
          const e = clampNum(h / 0.34, 0, 1);
          r = 58 + e * 155;
          g = 76 + e * 124;
          b = 60 + e * 116;
        }
        d[k] = clampNum(r * sh, 0, 255);
        d[k + 1] = clampNum(g * sh, 0, 255);
        d[k + 2] = clampNum(b * sh, 0, 255);
        d[k + 3] = 255;
      }
    }
    tmpCtx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tmp, 0, 0, S, S, 0, 0, cv.width, cv.height);
  };
}

/* ------------------------------------------------------------------ */
/*  control panel                                                      */
/* ------------------------------------------------------------------ */

const registry = [];

function group(title, open) {
  const d = document.createElement('details');
  d.className = 'group';
  d.open = open !== false;
  const s = document.createElement('summary');
  s.textContent = title;
  d.appendChild(s);
  const body = document.createElement('div');
  body.className = 'body';
  d.appendChild(body);
  $('panelBody').appendChild(d);
  return body;
}

function slider(host, label, opts) {
  const wrap = document.createElement('div');
  wrap.className = 'ctl';
  const lab = document.createElement('label');
  const out = document.createElement('output');
  lab.append(document.createTextNode(label));
  lab.append(out);
  const inp = document.createElement('input');
  inp.type = 'range';
  inp.min = opts.min;
  inp.max = opts.max;
  inp.step = opts.step;
  inp.value = opts.get();
  inp.setAttribute('aria-label', label);
  const show = () => {
    out.textContent = opts.fmt ? opts.fmt(Number(inp.value)) : String(inp.value);
  };
  show();
  inp.addEventListener('input', () => {
    opts.set(Number(inp.value));
    show();
    saveSettings();
  });
  wrap.append(lab, inp);
  host.appendChild(wrap);
  registry.push({ sync: () => { inp.value = opts.get(); show(); } });
}

function toggle(host, label, opts) {
  const wrap = document.createElement('label');
  wrap.className = 'check';
  const inp = document.createElement('input');
  inp.type = 'checkbox';
  inp.checked = !!opts.get();
  inp.setAttribute('aria-label', label);
  const span = document.createElement('span');
  span.textContent = label;
  wrap.append(inp, span);
  host.appendChild(wrap);
  inp.addEventListener('change', () => {
    opts.set(inp.checked);
    saveSettings();
  });
  registry.push({ sync: () => { inp.checked = !!opts.get(); } });
}

function selectBox(host, label, opts) {
  const wrap = document.createElement('div');
  wrap.className = 'ctl';
  const lab = document.createElement('label');
  lab.append(document.createTextNode(label));
  wrap.appendChild(lab);
  const sel = document.createElement('select');
  sel.setAttribute('aria-label', label);
  for (const o of opts.options) {
    const op = document.createElement('option');
    op.value = o.id;
    op.textContent = o.label;
    sel.appendChild(op);
  }
  sel.value = opts.get();
  wrap.appendChild(sel);
  host.appendChild(wrap);
  sel.addEventListener('change', () => {
    opts.set(sel.value);
    saveSettings();
  });
  registry.push({ sync: () => { sel.value = opts.get(); } });
}

function buttonRow(host, buttons, cls) {
  const wrap = document.createElement('div');
  wrap.className = cls || 'row2';
  for (const b of buttons) {
    const el = document.createElement('button');
    el.className = 'btn';
    el.type = 'button';
    el.textContent = b.label;
    if (b.title) el.title = b.title;
    el.dataset.key = b.key || b.label;
    el.addEventListener('click', () => b.onClick(el));
    wrap.appendChild(el);
  }
  host.appendChild(wrap);
}

function note(host, text) {
  const p = document.createElement('p');
  p.className = 'note';
  p.textContent = text;
  host.appendChild(p);
}

function buildPanel() {
  const P = state.params;
  const G = state.gen;
  const V = state.view;
  const B = state.brush;
  let g = group('Simulation', true);

  buttonRow(g, [
    { label: '\u23f8 Pause', key: 'pause', title: 'Pause / resume (Space)', onClick: () => toggleRun() },
    { label: '\u2934 Single step', key: 'step', title: 'One simulation step (S)', onClick: () => singleStep() },
    { label: '\u21ba Reset water + time', key: 'reset', onClick: () => resetRun() },
    { label: '\u26f0 Regenerate terrain', key: 'regen', onClick: () => regenerate('Terrain regenerated') },
  ]);
  selectBox(g, 'Simulation resolution (cells per side)', {
    get: () => String(state.res),
    options: [64, 96, 128, 160, 192, 256].map((n) => ({ id: String(n), label: n + ' \u00d7 ' + n + (n === 128 ? ' (default)' : n > 192 ? ' \u2014 heavy' : '') })),
    set: (v) => setResolution(Number(v)),
  });
  slider(g, 'Simulation speed (steps per 1/60 s)', { min: 0.25, max: 4, step: 0.25, get: () => state.speed, set: (v) => { state.speed = v; }, fmt: (v) => v.toFixed(2) + '\u00d7' });
  slider(g, 'Substeps per step', { min: 1, max: 6, step: 1, get: () => state.substeps, set: (v) => { state.substeps = v; }, fmt: (v) => String(v) });
  note(g, 'Cost per frame is roughly speed \u00d7 substeps \u00d7 cells. The HUD shows the measured simulation cost so you can see when a setting is too expensive.');

  g = group('Water, flow and sediment', true);
  slider(g, 'Rainfall / water injection', { min: 0, max: 1, step: 0.01, get: () => P.rain, set: (v) => { P.rain = v; }, fmt: (v) => v.toFixed(2) });
  slider(g, 'Evaporation + infiltration', { min: 0, max: 4, step: 0.02, get: () => P.evap, set: (v) => { P.evap = v; }, fmt: (v) => v.toFixed(2) });
  slider(g, 'Erosion rate (hydraulic)', { min: 0, max: 3, step: 0.02, get: () => P.erode, set: (v) => { P.erode = v; }, fmt: (v) => v.toFixed(2) });
  slider(g, 'Deposition rate', { min: 0, max: 3, step: 0.02, get: () => P.deposit, set: (v) => { P.deposit = v; }, fmt: (v) => v.toFixed(2) });
  slider(g, 'Sediment carrying capacity', { min: 0, max: 3, step: 0.02, get: () => P.capacity, set: (v) => { P.capacity = v; }, fmt: (v) => v.toFixed(2) });
  slider(g, 'Flow strength (water momentum)', { min: 0.05, max: 3, step: 0.05, get: () => P.flow, set: (v) => { P.flow = v; }, fmt: (v) => v.toFixed(2) });
  slider(g, 'Thermal / talus erosion strength', { min: 0, max: 3, step: 0.02, get: () => P.thermal, set: (v) => { P.thermal = v; }, fmt: (v) => v.toFixed(2) });
  slider(g, 'Talus angle (angle of repose)', { min: 5, max: 80, step: 1, get: () => P.talus, set: (v) => { P.talus = v; }, fmt: (v) => v.toFixed(0) + '\u00b0' });
  note(g, 'Capacity, erosion and deposition are coupled: faster water carries more load, so channels cut down while floodplains and deltas build up.');

  g = group('Terrain generation', false);
  selectBox(g, 'Relief style', {
    get: () => G.style,
    options: STYLES,
    set: (v) => {
      G.style = v;
      regenerate('Relief style: ' + v);
    },
  });
  slider(g, 'Relief (height range)', { min: 0.05, max: 0.6, step: 0.01, get: () => G.relief, set: (v) => { G.relief = v; }, fmt: (v) => v.toFixed(2) });
  slider(g, 'Feature scale (wavelength)', { min: 1.5, max: 12, step: 0.1, get: () => G.scale, set: (v) => { G.scale = v; }, fmt: (v) => v.toFixed(1) });
  slider(g, 'Octaves (detail levels)', { min: 1, max: 9, step: 1, get: () => G.octaves, set: (v) => { G.octaves = v; }, fmt: (v) => String(v) });
  slider(g, 'Roughness (persistence)', { min: 0.2, max: 0.9, step: 0.01, get: () => G.roughness, set: (v) => { G.roughness = v; }, fmt: (v) => v.toFixed(2) });
  slider(g, 'Ridge amount', { min: 0, max: 1, step: 0.05, get: () => G.ridge, set: (v) => { G.ridge = v; }, fmt: (v) => v.toFixed(2) });
  slider(g, 'Island falloff', { min: 0, max: 1, step: 0.05, get: () => G.island, set: (v) => { G.island = v; }, fmt: (v) => v.toFixed(2) });
  slider(g, 'Domain warp', { min: 0, max: 1.5, step: 0.05, get: () => G.warp, set: (v) => { G.warp = v; }, fmt: (v) => v.toFixed(2) });
  slider(g, 'Initial water level (sea)', { min: 0, max: 0.12, step: 0.002, get: () => G.seaLevel, set: (v) => { G.seaLevel = v; }, fmt: (v) => v.toFixed(3) });
  slider(g, 'Initial sediment layer', { min: 0, max: 3, step: 0.05, get: () => G.sediment, set: (v) => { G.sediment = v; }, fmt: (v) => v.toFixed(2) });
  slider(g, 'Spring sources', { min: 0, max: 12, step: 1, get: () => G.springs, set: (v) => { G.springs = v; }, fmt: (v) => String(v) });

  const seedWrap = document.createElement('div');
  seedWrap.className = 'ctl';
  const seedLabel = document.createElement('label');
  seedLabel.append(document.createTextNode('Deterministic seed'));
  seedWrap.appendChild(seedLabel);
  const seedRow = document.createElement('div');
  seedRow.className = 'row2';
  const seedInput = document.createElement('input');
  seedInput.type = 'text';
  seedInput.value = G.seed;
  seedInput.setAttribute('aria-label', 'Deterministic seed');
  seedInput.addEventListener('change', () => {
    G.seed = seedInput.value || 'seed';
    regenerate('Terrain regenerated from seed ' + G.seed);
  });
  const dice = document.createElement('button');
  dice.className = 'btn';
  dice.type = 'button';
  dice.textContent = '\ud83c\udfb2 Random seed';
  dice.addEventListener('click', () => {
    G.seed = Math.random().toString(36).slice(2, 10);
    seedInput.value = G.seed;
    regenerate('Terrain regenerated from seed ' + G.seed);
  });
  seedRow.append(seedInput, dice);
  seedWrap.appendChild(seedRow);
  g.appendChild(seedWrap);
  registry.push({ sync: () => { seedInput.value = G.seed; } });
  buttonRow(g, [
    { label: 'Apply generation', onClick: () => regenerate('Terrain rebuilt from the current generation settings') },
    { label: 'Generation defaults', onClick: () => { Object.assign(G, DEFAULT_GEN); regenerate('Generation defaults restored'); } },
  ]);

  g = group('Pointer brush tools', true);
  const toolsWrap = document.createElement('div');
  toolsWrap.className = 'tools';
  for (const t of TOOLS) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'btn';
    el.dataset.tool = t.id;
    el.textContent = t.label;
    el.title = 'Select the ' + t.label + ' tool (key ' + (TOOLS.indexOf(t) + 1) + ')';
    el.addEventListener('click', () => setTool(t.id));
    toolsWrap.appendChild(el);
  }
  g.appendChild(toolsWrap);
  registry.push({ sync: () => toolsWrap.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.tool === state.brush.tool)) });
  slider(g, 'Brush radius (cells)', { min: 1, max: 40, step: 0.5, get: () => B.radius, set: (v) => { B.radius = v; }, fmt: (v) => v.toFixed(1) });
  slider(g, 'Brush strength', { min: 0.02, max: 1, step: 0.01, get: () => B.strength, set: (v) => { B.strength = v; }, fmt: (v) => v.toFixed(2) });
  note(g, 'Left-drag paints with the selected tool. Shift+left-drag or middle-drag pans, right-drag orbits, wheel zooms, so editing never fights the camera.');

  g = group('Visualisation', true);
  const modesWrap = document.createElement('div');
  modesWrap.className = 'modes';
  for (const m of LAB.MODES) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'btn';
    el.dataset.mode = m.id;
    el.textContent = m.label;
    el.addEventListener('click', () => setMode(m.id));
    modesWrap.appendChild(el);
  }
  g.appendChild(modesWrap);
  registry.push({ sync: () => modesWrap.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.mode === state.view.mode)) });
  slider(g, 'Vertical exaggeration', { min: 0.5, max: 8, step: 0.1, get: () => V.exaggeration, set: (v) => { V.exaggeration = v; syncSettings(); }, fmt: (v) => v.toFixed(1) + '\u00d7' });
  slider(g, 'Water visibility', { min: 0, max: 1, step: 0.02, get: () => V.waterOpacity, set: (v) => { V.waterOpacity = v; syncSettings(); }, fmt: (v) => (v * 100).toFixed(0) + '%' });
  toggle(g, 'Contour lines (20 m interval)', { get: () => V.contours, set: (v) => { V.contours = v; syncSettings(); } });
  toggle(g, 'Simulation grid overlay', { get: () => V.grid, set: (v) => { V.grid = v; syncSettings(); } });
  slider(g, 'Sun azimuth', { min: 0, max: 360, step: 1, get: () => V.sunAzimuth, set: (v) => { V.sunAzimuth = v; syncSettings(); }, fmt: (v) => v.toFixed(0) + '\u00b0' });
  slider(g, 'Sun elevation', { min: 5, max: 85, step: 1, get: () => V.sunElevation, set: (v) => { V.sunElevation = v; syncSettings(); }, fmt: (v) => v.toFixed(0) + '\u00b0' });
  selectBox(g, 'Cast shadow quality', {
    get: () => String(V.shadowSteps),
    options: [{ id: '0', label: 'Off' }, { id: '4', label: 'Low (4 samples)' }, { id: '8', label: 'Medium (8 samples)' }, { id: '16', label: 'High (16 samples)' }],
    set: (v) => { V.shadowSteps = Number(v); syncSettings(); },
  });
  selectBox(g, 'Mesh density', {
    get: () => String(V.subdivision),
    options: [{ id: '1', label: '1\u00d7 cells (fast)' }, { id: '2', label: '2\u00d7 cells (sharp)' }, { id: '3', label: '3\u00d7 cells (heavy)' }],
    set: (v) => { V.subdivision = Number(v); syncSettings(); },
  });
  slider(g, 'Field of view', { min: 25, max: 80, step: 1, get: () => V.fov, set: (v) => { V.fov = v; syncSettings(); }, fmt: (v) => v.toFixed(0) + '\u00b0' });

  g = group('Presets', false);
  const pw = document.createElement('div');
  pw.className = 'presets';
  for (const p of PRESETS) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'btn';
    el.dataset.preset = p.id;
    el.textContent = p.label;
    el.addEventListener('click', () => applyPreset(PRESETS.find((x) => x.id === p.id)));
    pw.appendChild(el);
  }
  g.appendChild(pw);
  registry.push({ sync: () => pw.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.preset === state.preset)) });

  g = group('Data in / out', false);
  buttonRow(g, [
    { label: 'Heightfield PNG', onClick: () => exportPNG('elevation') },
    { label: 'Water depth PNG', onClick: () => exportPNG('water') },
    { label: 'Sediment PNG', onClick: () => exportPNG('sediment') },
    { label: 'Screenshot PNG', onClick: () => screenshot() },
    { label: 'Export state JSON', onClick: () => exportState() },
    { label: 'Import state JSON', onClick: () => $('fileIn').click() },
  ]);
  buttonRow(g, [
    { label: 'Save settings', onClick: () => saveSettings(true) },
    { label: 'Restore settings', onClick: () => { loadSettings(true); regenerate('Settings restored'); } },
  ]);
  note(g, 'PNG export writes the live heightfield (or a diagnostic field) as 16-bit grayscale. JSON export/import carries the complete terrain, water and sediment state plus every parameter.');
}

function syncPanel() {
  for (const r of registry) {
    try {
      r.sync();
    } catch (e) {
      void e;
    }
  }
  const p = $('btnPause');
  if (p) {
    p.classList.toggle('on', state.running);
    p.innerHTML = state.running ? '\u23f8 Pause <kbd>space</kbd>' : '\u25b6 Resume <kbd>space</kbd>';
  }
}

/* ------------------------------------------------------------------ */
/*  actions                                                            */
/* ------------------------------------------------------------------ */

function toggleRun() {
  state.running = !state.running;
  syncPanel();
  toast(state.running ? 'Running' : 'Paused \u2014 the terrain is frozen while you paint');
}

function singleStep() {
  state.running = false;
  LAB.step(sim, state.substeps);
  syncPanel();
  toast('Single step (' + state.substeps + ' substep' + (state.substeps > 1 ? 's' : '') + ')');
}

function resetRun() {
  LAB.resetWater(sim);
  sim.recoveries = 0;
  sim.unstable = false;
  toast('Water, sediment, time and stability counters reset');
}

function regenerate(why) {
  LAB.generate(sim, state.gen.style, Object.assign({ seed: state.gen.seed }, state.gen));
  LAB.resetWater(sim);
  toast(why || 'Terrain regenerated');
}

function setTool(id) {
  state.brush.tool = id;
  const stage = $('stage');
  if (stage) stage.className = id === 'inspect' ? 'probe' : '';
  if (cursorEl) cursorEl.style.display = 'none';
  syncPanel();
}

function setMode(id) {
  state.view.mode = id;
  syncSettings();
  syncPanel();
  const m = LAB.MODES.find((x) => x.id === id);
  toast('View: ' + (m ? m.label : id));
}

function applyPreset(preset) {
  if (!preset) return;
  Object.assign(state.params, preset.params);
  Object.assign(state.gen, preset.gen);
  Object.assign(state.view, preset.view || {});
  if (preset.substeps) state.substeps = preset.substeps;
  if (preset.speed) state.speed = preset.speed;
  state.preset = preset.id;
  sim.params = Object.assign({}, state.params);
  regenerate('Preset: ' + preset.label);
  syncSettings();
  syncPanel();
  saveSettings();
}

/* ------------------------------------------------------------------ */
/*  persistence                                                        */
/* ------------------------------------------------------------------ */

const LS_KEY = 'hydr-erosion-lab.settings.v1';

function saveSettings(force) {
  try {
    localStorage.setItem(
      LS_KEY,
      JSON.stringify({ params: state.params, gen: state.gen, view: state.view, brush: state.brush, res: state.res, speed: state.speed, substeps: state.substeps, preset: state.preset }),
    );
    if (force) toast('Settings saved in this browser');
  } catch (e) {
    if (force) toast('Could not save settings: ' + e.message, 'warn');
  }
}

function loadSettings(force) {
  let raw = null;
  try {
    raw = localStorage.getItem(LS_KEY);
  } catch (e) {
    if (force) toast('Local storage is not available here', 'warn');
    return;
  }
  if (!raw) return;
  try {
    const d = JSON.parse(raw);
    if (d.params) Object.assign(state.params, d.params);
    if (d.gen) Object.assign(state.gen, d.gen);
    if (d.view) Object.assign(state.view, d.view);
    if (d.brush) Object.assign(state.brush, d.brush);
    if (Number.isFinite(d.res)) state.res = clampNum(d.res, 32, 256);
    if (Number.isFinite(d.speed)) state.speed = clampNum(d.speed, 0.25, 4);
    if (Number.isFinite(d.substeps)) state.substeps = clampNum(d.substeps, 1, 6);
    if (d.preset) state.preset = d.preset;
    if (force) toast('Settings restored from this browser');
  } catch (e) {
    if (force) toast('Saved settings were unreadable', 'warn');
  }
}

/* ------------------------------------------------------------------ */
/*  export / import                                                    */
/* ------------------------------------------------------------------ */

function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 2000);
}

function exportPNG(mode) {
  try {
    const png = LAB.fieldPNG(sim, mode);
    download(new Blob([png.bytes], { type: 'image/png' }), 'erosion-' + (mode === 'elevation' ? 'heightfield' : mode) + '-' + sim.n + 'px.png');
    toast((mode === 'elevation' ? 'Heightfield' : mode) + ' exported as ' + sim.n + '\u00d7' + sim.n + ' grayscale PNG (' + (png.bytes.length / 1024).toFixed(0) + ' KiB)');
  } catch (err) {
    toast('PNG export failed: ' + err.message, 'bad');
  }
}

function screenshot() {
  shotRequest = { fail: (m) => toast('Screenshot failed: ' + m, 'warn') };
}

/* readback happens in the frame loop, immediately after the draw call,
   because the default framebuffer is not guaranteed to survive presentation */
let shotRequest = null;

function encodeCanvasPNG(cap) {
  const w = cap.w;
  const h = cap.h;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d');
  const flipped = new ImageData(w, h);
  if (cap.bottomUp) {
    for (let y = 0; y < h; y++) {
      const src = (h - 1 - y) * w * 4;
      for (let x = 0; x < w * 4; x++) flipped.data[y * w * 4 + x] = cap.data[src + x];
    }
  } else {
    flipped.data.set(cap.data);
  }
  ctx.putImageData(flipped, 0, 0);
  const url = out.toDataURL('image/png');
  const bin = atob(url.slice(url.indexOf(',') + 1));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function exportState() {
  try {
    const json = JSON.stringify(LAB.exportState(sim));
    download(new Blob([json], { type: 'application/json' }), 'erosion-state.json');
    toast('Full simulation state exported (' + (json.length / 1024).toFixed(0) + ' KiB)');
  } catch (err) {
    toast('State export failed: ' + err.message, 'bad');
  }
}

function importStateText(text) {
  let obj = null;
  try {
    obj = JSON.parse(text);
  } catch (e) {
    toast('Import failed: the file is not valid JSON', 'bad');
    return;
  }
  try {
    const before = sim.n;
    LAB.importState(sim, obj);
    if (sim.n !== before) state.res = sim.n;
    Object.assign(state.params, sim.params);
    syncSettings();
    syncPanel();
    toast('State imported \u2014 terrain, water and sediment restored');
  } catch (err) {
    toast('Import rejected: ' + err.message, 'bad', 4200);
  }
}

/* ------------------------------------------------------------------ */
/*  toolbar, keyboard, resize                                          */
/* ------------------------------------------------------------------ */

function buildToolbar() {
  $('btnPause').addEventListener('click', () => toggleRun());
  $('btnStep').addEventListener('click', () => singleStep());
  $('btnReset').addEventListener('click', () => resetRun());
  $('btnRegen').addEventListener('click', () => regenerate('Terrain regenerated'));
  $('btnCam').addEventListener('click', () => {
    cam.reset();
    toast('Camera reset');
  });
  $('btnStab').addEventListener('click', () => {
    const P = state.params;
    P.flow = Math.min(P.flow, 1);
    P.erode = Math.min(P.erode, 1.2);
    P.capacity = Math.min(P.capacity, 1.2);
    P.thermal = Math.min(P.thermal, 0.6);
    P.rain = Math.min(P.rain, 0.6);
    sim.params = Object.assign({}, P);
    sim.fx.fill(0);
    sim.fy.fill(0);
    sim.unstable = false;
    syncPanel();
    toast('Parameters clamped into the stable range and the flux state cleared');
  });

  const panel = $('panel');
  const flip = () => {
    panel.classList.toggle('open');
    $('toolToggle').setAttribute('aria-expanded', panel.classList.contains('open') ? 'true' : 'false');
  };
  $('toolToggle').addEventListener('click', flip);
  $('panelClose').addEventListener('click', () => {
    panel.classList.remove('open');
    $('toolToggle').setAttribute('aria-expanded', 'false');
  });
  if (window.innerWidth <= 900) {
    // narrow screens: fold the probe into the status card and keep the
    // control drawer closed so the terrain gets the whole canvas
    $('hud').appendChild($('probe'));
    panel.classList.remove('open');
  }

  $('fileIn').addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => importStateText(String(r.result));
    r.onerror = () => toast('Could not read that file', 'bad');
    r.readAsText(f);
    e.target.value = '';
  });

  window.addEventListener('keydown', (e) => {
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key;
    if (k === ' ') { e.preventDefault(); toggleRun(); }
    else if (k === 's' || k === 'S') singleStep();
    else if (k === 't' || k === 'T') resetRun();
    else if (k === 'r' || k === 'R') regenerate('Terrain regenerated');
    else if (k === 'c' || k === 'C') { cam.reset(); toast('Camera reset'); }
    else if (k === 'z' || k === 'Z') cycleMode(-1);
    else if (k === 'x' || k === 'X') cycleMode(1);
    else if (k === 'p' || k === 'P') $('toolToggle').click();
    else if (/^[1-8]$/.test(k)) setTool(TOOLS[Number(k) - 1].id);
    else if (k === 'ArrowLeft') { e.preventDefault(); cam.orbit(-14, 0); }
    else if (k === 'ArrowRight') { e.preventDefault(); cam.orbit(14, 0); }
    else if (k === 'ArrowUp') { e.preventDefault(); cam.orbit(0, -12); }
    else if (k === 'ArrowDown') { e.preventDefault(); cam.orbit(0, 12); }
    else if (k === '+' || k === '=') cam.zoom(0.88);
    else if (k === '-' || k === '_') cam.zoom(1.14);
  });

  requestAnimationFrame(resizeCanvas);
}

function cycleMode(dir) {
  const ids = LAB.MODES.map((m) => m.id);
  const i = Math.max(0, ids.indexOf(state.view.mode));
  setMode(ids[(i + dir + ids.length) % ids.length]);
}

function resizeCanvas() {
  const canvas = $('view');
  if (!canvas) return;
  const rect = canvas.parentElement.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.max(64, Math.round(rect.width * dpr));
  const h = Math.max(64, Math.round(rect.height * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
    console.log('[lab] canvas resized to ' + w + '\u00d7' + h + ' (dpr ' + dpr.toFixed(2) + ')');
  }
}

/* ------------------------------------------------------------------ */
/*  pointer + camera input                                             */
/* ------------------------------------------------------------------ */

let cursorEl = null;

const pointerState = {
  strokes: new Map(),
  stroke: false,
  mode: null,
  gesture: null,
};

function heldToolApply(dt) {
  let hit = null;
  for (const s of pointerState.strokes.values()) {
    if (s.mode === 'tool' && s.hit) hit = s.hit;
  }
  if (!hit) return;
  if (state.brush.tool === 'inspect') return;
  LAB.applyBrush(sim, state.brush.tool, hit.x, hit.y, state.brush.radius, state.brush.strength * Math.min(2, (dt / 16.7) * 0.7));
}

function setupInput(stage) {
  cursorEl = $('cursor');
  const cursor = cursorEl;

  function local(e) {
    const rect = stage.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top, rect };
  }

  function hitTest(e) {
    if (!renderer) return null;
    const { x, y, rect } = local(e);
    if (renderer.backend === '2d') {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const p = renderer.pick(sim, cam, Math.max(1, Math.round(rect.width * dpr)), Math.max(1, Math.round(rect.height * dpr)), x, y);
      if (!p) return null;
      return p;
    }
    const ndcX = (x / rect.width) * 2 - 1;
    const ndcY = 1 - (y / rect.height) * 2;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const ray = renderer.screenRay(cam, Math.max(1, Math.round(rect.width * dpr)), Math.max(1, Math.round(rect.height * dpr)), ndcX, ndcY);
    const hit = renderer.pick(sim, ray.origin, ray.dir, 12);
    return hit;
  }

  function brushPx(hit) {
    if (!hit) return 10;
    const rect = stage.getBoundingClientRect();
    const worldR = (state.brush.radius / sim.n) * 1.15;
    const dist = Math.max(0.06, hit.dist || cam.distance);
    const px = (worldR * rect.height * 0.5) / (Math.tan(((cam.fov * Math.PI) / 180) / 2) * dist);
    return clampNum(px, 5, 360);
  }

  function moveCursor(e, hit) {
    const rect = stage.getBoundingClientRect();
    cursor.style.left = e.clientX - rect.left + 'px';
    cursor.style.top = e.clientY - rect.top + 'px';
    cursor.style.display = 'block';
    cursor.style.width = brushPx(hit).toFixed(1) + 'px';
    cursor.style.height = cursor.style.width;
    const tool = TOOLS.find((t) => t.id === state.brush.tool);
    cursor.className = tool ? tool.kind : '';
  }

  function setMarker(on, u, v) {
    settings.markerOn = !!on;
    if (on && u !== undefined) settings.marker = [u, v];
  }

  function showProbe(hit) {
    if (!hit) {
      setMarker(false);
      return;
    }
    const p = LAB.probe(sim, hit.x, hit.y);
    if (!p) return;
    setMarker(true, hit.u, hit.v);
    const rockName = p.rock > 0.7 ? 'bedrock' : p.rock > 0.4 ? 'weathered rock' : 'loose soil';
    const uu = (hit.u * 100).toFixed(1);
    const vv = (hit.v * 100).toFixed(1);
    updateProbe(
      '<b>cell ' + p.x + ',' + p.y + '  (' + uu + '%, ' + vv + '%)</b>' +
        '<div class="prow"><span class="pk">elevation</span><span>' + p.elevation.toFixed(4) + ' \u00b7 ' + (p.elevation * 1000).toFixed(0) + ' m</span></div>' +
        '<div class="prow"><span class="pk">water depth</span><span>' + (p.water * 1000).toFixed(2) + ' mm' + (p.water > 0.0004 ? '' : ' (dry)') + '</span></div>' +
        '<div class="prow"><span class="pk">suspended load</span><span>' + (p.sediment * 1000).toFixed(3) + ' mm</span></div>' +
        '<div class="prow"><span class="pk">slope</span><span>' + p.slopeDeg.toFixed(1) + '\u00b0</span></div>' +
        '<div class="prow"><span class="pk">flow</span><span>' + (p.speed > 1e-5 ? p.speed.toFixed(5) + ' @ ' + p.flowDir.toFixed(0) + '\u00b0' : 'still') + '</span></div>' +
        '<div class="prow"><span class="pk">net \u0394 height</span><span>' + (p.delta < -1e-6 ? 'eroding ' : p.delta > 1e-6 ? 'building ' : 'steady ') + Math.abs(p.delta * 1000).toFixed(3) + ' mm</span></div>' +
        '<div class="prow"><span class="pk">erodibility</span><span>' + p.rock.toFixed(2) + ' (' + rockName + ')</span></div>',
    );
  }

  function paint(hit, scale) {
    if (!hit || state.brush.tool === 'inspect') return;
    LAB.applyBrush(sim, state.brush.tool, hit.x, hit.y, state.brush.radius, state.brush.strength * scale);
  }

  function segmentPaint(from, to) {
    if (!to) return;
    if (!from) {
      paint(to, 0.5);
      return;
    }
    const d = Math.hypot(to.x - from.x, to.y - from.y);
    const steps = clampNum(Math.round(d / Math.max(1.2, state.brush.radius * 0.45)), 1, 26);
    for (let k = 1; k <= steps; k++) {
      const t = k / steps;
      paint({ x: Math.round(from.x + (to.x - from.x) * t), y: Math.round(from.y + (to.y - from.y) * t) }, 0.42 / steps + 0.1);
    }
  }

  stage.addEventListener('contextmenu', (e) => e.preventDefault());

  stage.addEventListener('pointerdown', (e) => {
    if (e.button > 2) return;
    e.preventDefault();
    resizeCanvas();
    const { x, y } = local(e);
    let mode;
    if (pointerState.strokes.size >= 2) mode = 'gesture';
    else if (e.button === 2) mode = 'orbit';
    else if (e.button === 1) mode = 'pan';
    else if (e.shiftKey) mode = 'pan';
    else if (e.altKey) mode = 'orbit';
    else mode = state.brush.tool === 'inspect' ? 'probeDown' : 'tool';

    let hit = null;
    if (mode === 'tool' || mode === 'probeDown') hit = hitTest(e);
    pointerState.strokes.set(e.pointerId, { mode, x, y, hit });
    try {
      stage.setPointerCapture(e.pointerId);
    } catch (err) {
      void err;
    }
    if (pointerState.strokes.size === 2) {
      const ids = [...pointerState.strokes.keys()];
      const a = pointerState.strokes.get(ids[0]);
      const b = pointerState.strokes.get(ids[1]);
      for (const id of ids) pointerState.strokes.get(id).mode = 'gesture';
      pointerState.gesture = { dist: Math.hypot(a.x - b.x, a.y - b.y), angle: Math.atan2(b.y - a.y, b.x - a.x) };
      mode = 'gesture';
    }
    pointerState.stroke = true;
    pointerState.mode = mode;
    stage.className = mode === 'tool' ? '' : mode === 'probeDown' ? 'probe' : 'grabbing';

    if (mode === 'tool') {
      paint(hit, 0.5);
      moveCursor(e, hit);
    } else if (mode === 'probeDown') {
      showProbe(hit);
      moveCursor(e, hit);
    }
  });

  stage.addEventListener('pointermove', (e) => {
    const { x, y } = local(e);
    const s = pointerState.strokes.get(e.pointerId);

    if (!s) {
      const hit = hitTest(e);
      if (hit) {
        showProbe(hit);
        moveCursor(e, hit);
      } else {
        cursor.style.display = 'none';
        setMarker(false);
      }
      return;
    }

    const dx = x - s.x;
    const dy = y - s.y;
    s.x = x;
    s.y = y;

    if (s.mode === 'orbit') {
      cam.orbit(dx, dy);
    } else if (s.mode === 'pan') {
      cam.pan(dx, dy);
    } else if (s.mode === 'gesture' && pointerState.gesture && pointerState.strokes.size === 2) {
      const ids = [...pointerState.strokes.keys()];
      const a = pointerState.strokes.get(ids[0]);
      const b = pointerState.strokes.get(ids[1]);
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      if (pointerState.gesture.dist > 10) cam.zoom(clampNum(pointerState.gesture.dist / Math.max(10, d), 0.72, 1.38));
      let da = ang - pointerState.gesture.angle;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      cam.orbit(da * 210, 0);
      pointerState.gesture = { dist: d, angle: ang };
    } else if (s.mode === 'tool' || s.mode === 'probeDown') {
      const hit = hitTest(e);
      if (s.mode === 'tool') {
        segmentPaint(s.hit, hit);
        s.hit = hit;
      } else {
        showProbe(hit);
      }
      moveCursor(e, hit);
    }
  });

  function endPointer(e) {
    const s = pointerState.strokes.get(e.pointerId);
    if (!s && !pointerState.stroke) return;
    try {
      if (stage.hasPointerCapture && stage.hasPointerCapture(e.pointerId)) stage.releasePointerCapture(e.pointerId);
    } catch (err) {
      void err;
    }
    pointerState.strokes.delete(e.pointerId);
    if (pointerState.strokes.size === 0) {
      pointerState.stroke = false;
      pointerState.mode = null;
      pointerState.gesture = null;
      stage.className = state.brush.tool === 'inspect' ? 'probe' : '';
    }
  }

  stage.addEventListener('pointerup', endPointer);
  stage.addEventListener('pointercancel', endPointer);
  stage.addEventListener('pointerleave', (e) => {
    if (!pointerState.stroke) {
      cursor.style.display = 'none';
      setMarker(false);
    }
    void e;
  });

  stage.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (e.ctrlKey || e.altKey) {
      state.brush.radius = clampNum(state.brush.radius * (e.deltaY > 0 ? 0.9 : 1.11), 1, 40);
      syncPanel();
      return;
    }
    cam.zoom(e.deltaY > 0 ? 1.11 : 0.9);
  }, { passive: false });

  window.addEventListener('resize', () => {
    resizeCanvas();
  });

  window.addEventListener('orientationchange', () => {
    setTimeout(resizeCanvas, 200);
  });
}

/* ------------------------------------------------------------------ */
/*  start                                                              */
/* ------------------------------------------------------------------ */

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => APP.start());
else APP.start();