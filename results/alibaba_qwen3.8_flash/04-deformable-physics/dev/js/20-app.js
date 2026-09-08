/* ==========================================================================
 * APP — UI wiring, pointer/keyboard tools, main loop, HUD, persistence.
 * =========================================================================*/

const DEFAULTS = {
  gravity: 900, gravDir: 90, wind: 220, windDir: 0, windTurb: 0.55,
  damping: 0.8, restitution: 0.12, friction: 0.5, thick: 6,
  iters: 6, substeps: 3, dtScale: 1.0,
  kStruct: 0.9, kShear: 0.4, kBend: 0.16, pressure: 0.55,
  tear: 0.5, tearOn: true, selfCollide: true, pairCollide: true,
  density: 1.5, grabRadius: 44, grabK: 0.55,
  hud: true, spark: true
};

const SPAWN_TYPES = [
  { id: 'cloth', name: 'Cloth sheet' },
  { id: 'rope', name: 'Rope / chain' },
  { id: 'blob', name: 'Soft body (pressurised)' },
  { id: 'balloon', name: 'Balloon' },
  { id: 'jelly', name: 'Jelly lattice' },
  { id: 'ball', name: 'Rigid puck' },
  { id: 'circle', name: 'Static circle' },
  { id: 'box', name: 'Static box' },
  { id: 'spinner', name: 'Spinning paddle' }
];

const TOOL_ORDER = ['grab', 'pin', 'cut', 'push', 'wind', 'spawn', 'erase'];

const TOOL_HINT = {
  grab: 'Drag particles. <kbd>Space</kbd> pause · <kbd>N</kbd> step · <kbd>R</kbd> reset · <kbd>V</kbd> viz mode · <kbd>1-7</kbd> tools · <kbd>[</kbd><kbd>]</kbd> radius',
  pin: 'Click or drag to pin points; drag over pinned points to unpin them. <kbd>2</kbd> = this tool.',
  cut: 'Drag across the mesh to sever constraints. Tearing stays torn — the graph really changes.',
  push: 'Drag to punch impulses into the material (direction = drag direction).',
  wind: 'Hold to blow a local wind gust; drag to steer it.',
  spawn: 'Press and drag to size a new object, release to drop it. Pick the type in the panel.',
  erase: 'Click or drag over a body to delete that body and its constraints.'
};

function bootApp(api, makeScenarios, createRenderer) {
  const doc = document;
  const canvas = doc.getElementById('sim');
  const stage = doc.getElementById('stage');
  const hud = doc.getElementById('hud');
  const hintEl = doc.getElementById('hint');
  const toastEl = doc.getElementById('toast');
  const sparkC = doc.getElementById('spark');
  const sparkCtx = sparkC ? sparkC.getContext('2d') : null;

  const A = api;
  const scen = makeScenarios(api);
  let W = A.makeWorld();
  const S = Object.assign({
    gx: 0, gy: 900, windDx: 1, windDy: 0, maxStep: 9, cellSize: 15,
    substeps: 3, iters: 6
  }, DEFAULTS);

  const view = {
    paused: false, stepOnce: false, mode: 'render', tool: 'grab',
    spawnType: 'cloth', panelOpen: true, fps: 60
  };
  const app = {
    W: W, S: S, mode: 'render', tool: 'grab',
    pointer: { x: 0, y: 0, inside: false, down: false, px: 0, py: 0, dx: 0, dy: 0 },
    grabs: [], cutTrail: [], spawnGhost: null,
    toasts: [], errors: [], keys: TOOL_ORDER.slice(), sceneId: 'cascade'
  };

  /* --------------------------------------------------------------- helpers */
  function toast(msg, isErr) {
    const d = doc.createElement('div');
    d.className = 'toast' + (isErr ? ' err' : '');
    d.textContent = msg;
    toastEl.appendChild(d);
    app.toasts.push({ el: d, t: performance.now(), msg: msg, err: !!isErr });
    while (app.toasts.length > 4) {
      const old = app.toasts.shift();
      if (old.el.parentNode) old.el.parentNode.removeChild(old.el);
    }
    setTimeout(() => { if (d.parentNode) d.parentNode.removeChild(d); }, 2600);
  }

  const fmt = {
    int: (v) => String(Math.round(v)),
    f1: (v) => v.toFixed(1),
    f2: (v) => v.toFixed(2)
  };

  /* ------------------------------------------------------------- renderer  */
  const R = createRenderer(canvas);
  app.R = R;

  function refit() {
    const rect = stage.getBoundingClientRect();
    const cr = canvas.getBoundingClientRect();
    R.resize(cr.width || rect.width, cr.height || rect.height, A.WORLD_W, A.WORLD_H);
    drawSpark();
  }

  /* ------------------------------------------------------------- scenarios */
  function applyScenarioDefaults(sc) {
    if (sc.settings) Object.assign(S, sc.settings);
    if (sc.tool) { app.tool = sc.tool; syncToolButtons(); }
    rebuildForces();
    syncControls();
  }

  function loadScenario(id, quiet) {
    const sc = scen.byId(id);
    app.sceneId = sc.id;
    W = A.makeWorld();
    app.W = W;
    Object.assign(S, DEFAULTS);
    applyScenarioDefaults(sc);
    sc.build(W, S);
    doc.getElementById('blurb').textContent = sc.name + ' — ' + sc.blurb;
    if (!quiet) toast('Scenario: ' + sc.name);
    refit();
    saveSession();
  }

  function rebuildForces() {
    const th = (S.gravDir * Math.PI) / 180;
    S.gx = Math.cos(th) * S.gravity;
    S.gy = Math.sin(th) * S.gravity;
    const wa = (S.windDir * Math.PI) / 180;
    S.windDx = Math.cos(wa);
    S.windDy = Math.sin(wa);
  }

  /* ------------------------------------------------------------ tool setup */
  const toolsWrap = doc.getElementById('tools');
  function buildToolButtons() {
    toolsWrap.innerHTML = '';
    for (const t of TOOL_ORDER) {
      const b = doc.createElement('button');
      b.className = 'tool' + (t === app.tool ? ' active' : '');
      b.dataset.tool = t;
      b.title = TOOL_INFO[t].name + '  (' + TOOL_INFO[t].key + ')';
      b.innerHTML = '<span>' + TOOL_INFO[t].name + '</span><small>' + TOOL_INFO[t].key + '</small>';
      b.addEventListener('click', () => setTool(t));
      toolsWrap.appendChild(b);
    }
  }
  function syncToolButtons() {
    for (const b of toolsWrap.querySelectorAll('.tool')) {
      b.classList.toggle('active', b.dataset.tool === app.tool);
    }
    canvas.style.cursor = app.tool === 'grab' ? 'grab'
      : (app.tool === 'cut' ? 'cell' : app.tool === 'erase' ? 'not-allowed' : 'crosshair');
    hintEl.innerHTML = TOOL_HINT[app.tool] || '';
  }
  function setTool(t) {
    if (!TOOL_INFO[t]) return;
    app.tool = t;
    if (t !== 'grab') { W.grab = null; app.grabs = []; }
    app.cutTrail.length = 0;
    app.spawnGhost = null;
    syncToolButtons();
    saveSession();
  }

  /* mode select */
  const modeSel = doc.getElementById('mode');
  for (const m of MODES) {
    const o = doc.createElement('option');
    o.value = m.id;
    o.textContent = m.name;
    o.title = m.hint;
    modeSel.appendChild(o);
  }
  modeSel.addEventListener('change', () => {
    app.mode = modeSel.value;              /* never touches the world */
    saveSession();
  });

  /* scenario select */
  const scenSel = doc.getElementById('scenario');
  for (const sc of scen.list) {
    const o = doc.createElement('option');
    o.value = sc.id;
    o.textContent = sc.name;
    o.title = sc.blurb;
    scenSel.appendChild(o);
  }
  scenSel.addEventListener('change', () => loadScenario(scenSel.value));

  /* spawn type select */
  const spawnSel = doc.getElementById('spawnType');
  for (const t of SPAWN_TYPES) {
    const o = doc.createElement('option');
    o.value = t.id;
    o.textContent = t.name;
    spawnSel.appendChild(o);
  }

  /* ------------------------------------------------------------- controls */
  const ctrls = Array.from(doc.querySelectorAll('[data-s],[data-c]'));
  function syncControls() {
    for (const el of ctrls) {
      const key = el.dataset.s || el.dataset.c;
      if (!(key in S)) continue;
      if (el.type === 'checkbox') el.checked = !!S[key];
      else {
        el.value = String(S[key]);
        const out = el.parentNode.querySelector('output');
        if (out) out.textContent = (fmt[el.dataset.fmt] || fmt.f2)(S[key]);
      }
    }
    modeSel.value = app.mode;
    spawnSel.value = app.spawnType;
    scenSel.value = app.sceneId;
  }

  function onControl(el) {
    const key = el.dataset.s || el.dataset.c;
    if (el.type === 'checkbox') S[key] = el.checked;
    else {
      S[key] = parseFloat(el.value);
      const out = el.parentNode.querySelector('output');
      if (out) out.textContent = (fmt[el.dataset.fmt] || fmt.f2)(S[key]);
    }
    if (key === 'gravity' || key === 'gravDir' || key === 'wind' || key === 'windDir') rebuildForces();
    saveSession();
  }
  for (const el of ctrls) {
    el.addEventListener('input', () => onControl(el));
    el.addEventListener('change', () => onControl(el));
  }

  /* ---------------------------------------------------------- persistence */
  const LS_KEY = 'softplay.session.v1';
  let saveTimer = 0;
  function saveSession() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        const data = { v: 1, scene: app.sceneId, mode: app.mode, tool: app.tool,
          spawn: app.spawnType, paused: view.paused, s: {} };
        for (const el of ctrls) {
          const key = el.dataset.s || el.dataset.c;
          data.s[key] = el.type === 'checkbox' ? el.checked : parseFloat(el.value);
        }
        localStorage.setItem(LS_KEY, JSON.stringify(data));
      } catch (e) { /* storage unavailable (file:// without perms) — ignore */ }
    }, 260);
  }
  function loadSession() {
    let data = null;
    try { data = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch (e) { data = null; }
    if (!data || !data.s) return null;
    Object.assign(S, data.s);
    app.mode = data.mode || 'render';
    app.tool = data.tool || 'grab';
    app.spawnType = data.spawn || 'cloth';
    view.paused = !!data.paused;
    return data.scene || 'cascade';
  }

  /* --------------------------------------------------------------- transport */
  const btnPause = doc.getElementById('btnPause');
  function setPaused(p) {
    view.paused = p;
    btnPause.classList.toggle('on', p);
    btnPause.textContent = p ? '▶ Resume' : '⏸ Pause';
    saveSession();
  }
  btnPause.addEventListener('click', () => setPaused(!view.paused));
  doc.getElementById('btnStep').addEventListener('click', () => {
    view.stepOnce = true;
    if (!view.paused) setPaused(true);
  });
  doc.getElementById('btnReset').addEventListener('click', () => loadScenario(app.sceneId));
  doc.getElementById('btnClear').addEventListener('click', () => {
    W = A.makeWorld();
    app.W = W;
    W.grab = null;
    app.grabs = [];
    toast('World cleared — use the Spawn tool or pick a scenario');
    refit();
  });
  doc.getElementById('btnCentre').addEventListener('click', refit);
  doc.getElementById('btnDefaults').addEventListener('click', () => {
    Object.assign(S, DEFAULTS);
    rebuildForces();
    syncControls();
    toast('Settings restored to defaults');
    saveSession();
  });

  /* panel drawer */
  const panel = doc.getElementById('panel');
  const fab = doc.getElementById('fab');
  function setPanel(open) {
    view.panelOpen = open;
    panel.classList.toggle('hidden', !open);
    fab.setAttribute('aria-expanded', open ? 'true' : 'false');
    fab.textContent = open ? 'Controls ✕' : '☰ Controls';
  }
  fab.addEventListener('click', () => setPanel(!view.panelOpen));
  if (window.innerWidth < 820) setPanel(false);

  /* --------------------------------------------------------- export/import */
  function serializeWorld() {
    const w = app.W;
    const r3 = (v) => Math.round(v * 1000) / 1000;
    const parts = [];
    for (let i = 0; i < w.n; i++) {
      parts.push([r3(w.x[i]), r3(w.y[i]), r3(w.vx[i]), r3(w.vy[i]), w.im[i],
        w.cr[i], w.pin[i], w.ta[i], w.tb[i], w.tmode[i], w.aero[i], w.act[i], w.body[i],
        r3(w.px[i]), r3(w.py[i])]);
    }
    const pairs = [];
    for (let k = 0; k < w.pc; k++) {
      pairs.push([w.pa[k], w.pb[k], r3(w.prest[k]), w.pcls[k], w.palive[k]]);
    }
    const areas = [];
    for (let k = 0; k < w.ac; k++) {
      const idx = [];
      for (let j = 0; j < w.aCnt[k]; j++) idx.push(w.poly[w.aOff[k] + j]);
      areas.push([r3(w.aRest[k]), w.aAlive[k], idx]);
    }
    const bodies = w.bodies.map((b) => ({
      kind: b.kind, cols: b.cols, rows: b.rows, p0: b.p0, pn: b.pn, closed: b.closed,
      aero: b.aero, name: b.name, hsl: b.hsl, thick: b.thick, ring: b.ring,
      rad: b.rad, sp: b.sp, dead: b.dead, hull: !!b.hull
    }));
    const shapes = w.shapes.map((s) => {
      const o = {};
      for (const k in s) if (typeof s[k] !== 'function') o[k] = s[k];
      return o;
    });
    return {
      v: 1, app: 'softplay', scene: app.sceneId, settings: { ...S },
      n: w.n, polyN: w.polyN, parts, pairs, areas, bodies, shapes
    };
  }

  function deserializeWorld(data) {
    if (!data || data.v !== 1 || !Array.isArray(data.parts) || !Array.isArray(data.pairs)) {
      throw new Error('not a softplay world file');
    }
    const w = A.makeWorld();
    if (data.parts.length > w.cap) throw new Error('file needs ' + data.parts.length + ' particles (max ' + w.cap + ')');
    for (const s of (data.shapes || [])) A.addShape(w, { ...s });
    for (const p of data.parts) {
      A.addP(w, p[0], p[1], p[4], p[5], undefined, p[7], p[8], p[9], !!p[10]);
    }
    for (let i = 0; i < data.parts.length; i++) {
      const p = data.parts[i];
      w.act[i] = p[11]; w.body[i] = p[12];
      w.px[i] = p[13]; w.py[i] = p[14];
      if (p[6]) { w.pin[i] = 1; w.im[i] = 0; }
    }
    for (const pr of data.pairs) {
      if (!pr[4]) continue;
      A.addPair(w, pr[0], pr[1], pr[2], pr[3]);
    }
    for (const a of (data.areas || [])) {
      if (!a[1]) continue;
      const c = w.ac;
      A.addArea(w, a[2], a[2].length, 1);
      w.aRest[c] = a[0];
    }
    for (const b of (data.bodies || [])) {
      const spec = { ...b, dead: !!b.dead };
      delete spec.hull;
      const nb = A.addBody(w, spec);
      if (b.hull) nb.hull = A.hullOf(w, nb.p0, nb.pn);
    }
    if (data.settings) {
      Object.assign(S, data.settings);
      rebuildForces();
      syncControls();
    }
    app.W = W = w;
    app.grabs = [];
    W.grab = null;
    refit();
    return true;
  }

  doc.getElementById('btnSave').addEventListener('click', () => {
    try {
      const json = JSON.stringify(serializeWorld());
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = doc.createElement('a');
      a.href = url;
      a.download = 'softplay-' + app.sceneId + '-' + Date.now() + '.json';
      doc.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(url); doc.body.removeChild(a); }, 500);
      toast('World exported (' + Math.round(json.length / 1024) + ' KB)');
    } catch (e) {
      toast('Export failed: ' + e.message, true);
    }
  });

  const fileEl = doc.getElementById('fileImport');
  doc.getElementById('btnLoad').addEventListener('click', () => fileEl.click());
  fileEl.addEventListener('change', () => {
    const f = fileEl.files && fileEl.files[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onerror = () => toast('Could not read that file', true);
    rd.onload = () => {
      try {
        deserializeWorld(JSON.parse(String(rd.result)));
        toast('World loaded: ' + f.name);
      } catch (e) {
        toast('Load failed: ' + e.message, true);
      }
    };
    rd.readAsText(f);
    fileEl.value = '';
  });

  /* -------------------------------------------------------------- spawning */
  const SPAWN_LIMIT = 9200;
  function imFor(kind) {
    const vol = kind === 'cluster' ? 2.4 : (kind === 'jelly' ? 1.0 : (kind === 'rope' ? 0.4 : 0.6));
    return 1 / Math.max(0.2, S.density * vol);
  }

  function spawnAt(type, x0, y0, x1, y1) {
    const w = app.W;
    if (w.n > SPAWN_LIMIT) { toast('Particle budget reached (' + SPAWN_LIMIT + ')', true); return null; }
    const dx = x1 - x0, dy = y1 - y0;
    const adx = Math.abs(dx), ady = Math.abs(dy);
    const sgn = (v) => (v < 0 ? -1 : 1);
    const clampX = (v) => Math.max(8, Math.min(A.WORLD_W - 8, v));
    const clampY = (v) => Math.max(8, Math.min(A.WORLD_H - 8, v));
    let desc = '';
    switch (type) {
      case 'cloth': {
        const cw = Math.min(560, Math.max(60, adx || 240));
        const ch = Math.min(430, Math.max(40, ady || 220));
        const cols = Math.max(3, Math.round(cw / 21)), rows = Math.max(3, Math.round(ch / 21));
        const ox = clampX(x0 - (dx < 0 ? cw : 0)), oy = clampY(y0 - (dy < 0 ? ch : 0));
        A.buildCloth(w, { x0: ox, y0: oy, cols: cols, rows: rows, sp: 21, im: imFor('cloth'), hue: 168 });
        desc = 'cloth ' + cols + '×' + rows;
        break;
      }
      case 'rope': {
        const n = Math.max(4, Math.min(70, Math.round(Math.max(120, Math.hypot(dx, dy)) / 20)));
        const dirx = Math.abs(dx) < 1 ? 0.05 : sgn(dx), diry = Math.abs(dy) < 1 ? 0.9 : sgn(dy);
        A.buildChain(w, { x0: clampX(x0), y0: clampY(y0), dx: dirx, dy: diry, n: n, seg: 20, im: imFor('rope') });
        desc = 'rope ' + n + ' links';
        break;
      }
      case 'blob': {
        const r = Math.max(24, Math.min(170, Math.max(adx, ady) * 0.5 || 60));
        A.buildBlob(w, { cx: clampX(x0), y0: clampY(y0), r: r, n: Math.round(Math.max(16, r / 3.4)), im: imFor('blob'), hue: 344 });
        desc = 'soft body r=' + Math.round(r);
        break;
      }
      case 'balloon': {
        const r = Math.max(24, Math.min(170, Math.max(adx, ady) * 0.5 || 62));
        A.buildBlob(w, { cx: clampX(x0), y0: clampY(y0), r: r, n: Math.round(Math.max(16, r / 3.2)), im: imFor('blob') * 0.55, hue: 300, core: true });
        desc = 'balloon r=' + Math.round(r);
        break;
      }
      case 'jelly': {
        const cw = Math.min(300, Math.max(40, adx || 150)), ch = Math.min(300, Math.max(40, ady || 130));
        const cols = Math.max(3, Math.round(cw / 26)), rows = Math.max(3, Math.round(ch / 26));
        A.buildJelly(w, {
          x0: clampX(x0 - (dx < 0 ? cw : 0)), y0: clampY(y0 - (dy < 0 ? ch : 0)),
          cols: cols, rows: rows, sp: 26, im: imFor('jelly'), hue: 214
        });
        desc = 'jelly ' + cols + '×' + rows;
        break;
      }
      case 'ball': {
        const r = Math.max(20, Math.min(120, Math.max(adx, ady) * 0.5 || 44));
        A.buildCluster(w, { cx: clampX(x0), y0: clampY(y0), r: r, sp: 15, im: imFor('cluster'), name: 'puck' });
        desc = 'rigid puck r=' + Math.round(r);
        break;
      }
      case 'circle': {
        const r = Math.max(16, Math.min(200, Math.max(adx, ady) * 0.5 || 70));
        A.addShape(w, { kind: 'circle', cx: clampX(x0), cy: clampY(y0), r: r });
        desc = 'static circle r=' + Math.round(r);
        break;
      }
      case 'box': {
        const hw = Math.max(12, Math.min(280, adx * 0.5 || 90)), hh = Math.max(12, Math.min(280, ady * 0.5 || 60));
        A.addShape(w, { kind: 'box', cx: clampX(x0), cy: clampY(y0), hw: hw, hh: hh, angle: 0 });
        desc = 'static box';
        break;
      }
      case 'spinner': {
        const hw = Math.max(30, Math.min(260, adx * 0.5 || 120)), hh = Math.max(8, Math.min(60, ady * 0.5 || 12));
        A.addShape(w, { kind: 'box', cx: clampX(x0), cy: clampY(y0), hw: hw, hh: hh, angle: 0, spin: 1.6 });
        desc = 'spinning paddle';
        break;
      }
      default: return null;
    }
    saveSession();
    return desc;
  }

  doc.getElementById('btnDrop').addEventListener('click', () => {
    const d = spawnAt(app.spawnType, A.WORLD_W * 0.5, 140, A.WORLD_W * 0.5 + 150, 240);
    if (d) toast('Dropped ' + d);
  });

  /* ---------------------------------------------------------------- pointer */
  const pointers = new Map();

  function toWorld(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return R.screenToWorld(clientX - rect.left, clientY - rect.top);
  }

  function beginTool(p, e) {
    const w = app.W;
    const rad = S.grabRadius;
    switch (app.tool) {
      case 'grab': {
        const idx = [];
        let best = -1, bd = 1e18;
        for (let i = 0; i < w.n; i++) {
          if (!w.act[i]) continue;
          const dx = w.x[i] - p.x, dy = w.y[i] - p.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < rad * rad) {
            idx.push(i);
            if (d2 < bd) { bd = d2; best = i; }
          }
        }
        if (idx.length > 44) {           /* keep the strongest, closest ones */
          idx.sort((a, b) => {
            const da = (w.x[a] - p.x) ** 2 + (w.y[a] - p.y) ** 2;
            const db = (w.x[b] - p.x) ** 2 + (w.y[b] - p.y) ** 2;
            return da - db;
          });
          idx.length = 44;
        }
        p.grab = { idx: idx, n: idx.length, tx: p.x, ty: p.y };
        if (!idx.length) {
          toast('Nothing within ' + Math.round(rad) + ' u — widen the radius with [ ]', true);
        }
        break;
      }
      case 'pin': {
        const i = A.nearestParticle(w, p.x, p.y, 18);
        p.pinMode = (i >= 0 && w.pin[i]) ? 'unpin' : 'pin';
        applyPin(p);
        break;
      }
      case 'cut': {
        p.cut = A.cutSegment(w, p.px, p.py, p.x, p.y);
        app.cutTrail.length = 0;
        app.cutTrail.push(p.x, p.y);
        break;
      }
      case 'push':
      case 'wind':
        break;
      case 'spawn': {
        app.spawnGhost = { x: p.x, y: p.y, w: 0, h: 0 };
        break;
      }
      case 'erase': {
        const b = A.eraseBody(w, p.x, p.y, 26);
        if (b) toast('Deleted ' + b.name + ' (' + b.pn + ' particles)');
        else toast('No body under the cursor', true);
        break;
      }
    }
    void e;
  }

  function applyPin(p) {
    const w = app.W;
    const r = 14;
    let n = 0;
    for (let i = 0; i < w.n; i++) {
      if (!w.act[i]) continue;
      const dx = w.x[i] - p.x, dy = w.y[i] - p.y;
      if (dx * dx + dy * dy > r * r) continue;
      if (p.pinMode === 'pin' && !w.pin[i]) { A.pinP(w, i, w.x[i], w.y[i]); n++; }
      else if (p.pinMode === 'unpin' && w.pin[i]) { A.unpinP(w, i); n++; }
    }
    return n;
  }

  function moveTool(p) {
    const w = app.W;
    switch (app.tool) {
      case 'grab':
        if (p.grab) { p.grab.tx = p.x; p.grab.ty = p.y; }
        break;
      case 'pin':
        applyPin(p);
        break;
      case 'cut': {
        const n = A.cutSegment(w, p.px, p.py, p.x, p.y);
        p.cut = (p.cut || 0) + n;
        if (app.cutTrail.length > 90) { app.cutTrail.splice(0, 2); }
        app.cutTrail.push(p.x, p.y);
        break;
      }
      case 'push': {
        const sp = Math.hypot(p.dx, p.dy);
        if (sp > 0.6) {
          const k = Math.min(6, sp * 0.55) * (0.4 + S.grabK);
          A.applyImpulse(w, p.x, p.y, S.grabRadius, p.dx, p.dy, k);
        }
        break;
      }
      case 'wind': {
        const sp = Math.hypot(p.dx, p.dy);
        let ux = 0, uy = 0;
        if (sp > 0.4) { ux = p.dx / sp; uy = p.dy / sp; }
        else { ux = S.windDx; uy = S.windDy; }
        w.gust = { x: p.x, y: p.y, r: Math.max(40, S.grabRadius * 1.5),
          k: 0.6 + S.grabK * 1.8, dx: ux, dy: uy };
        break;
      }
      case 'spawn': {
        if (app.spawnGhost) {
          app.spawnGhost.w = p.x - app.spawnGhost.ox;
          app.spawnGhost.h = p.y - app.spawnGhost.oy;
        }
        break;
      }
      case 'erase': {
        const b = A.eraseBody(w, p.x, p.y, 20);
        if (b) toast('Deleted ' + b.name);
        break;
      }
    }
  }

  function endTool(p) {
    if (app.tool === 'spawn' && app.spawnGhost) {
      const g = app.spawnGhost;
      const d = spawnAt(app.spawnType, g.ox, g.oy, g.ox + g.w, g.oy + g.h);
      if (d) toast('Spawned ' + d);
      app.spawnGhost = null;
    }
    if (app.tool === 'cut' && p.cut) toast('Severed ' + p.cut + ' constraints');
    if (app.tool === 'wind') app.W.gust = null;
    if (p.grab) p.grab = null;
  }

  function syncGrab() {
    const idx = [];
    for (const p of pointers.values()) if (p.grab && p.grab.idx) idx.push(...p.grab.idx);
    if (!idx.length) { app.W.grab = null; app.grabs = []; return; }
    const g = { idx: idx, n: idx.length, tx: 0, ty: 0 };
    let cx = 0, cy = 0;
    for (const p of pointers.values()) if (p.grab) { cx += p.grab.tx; cy += p.grab.ty; }
    const k = pointers.size || 1;
    g.tx = cx / k; g.ty = cy / k;
    app.W.grab = g;
    app.grabs = Array.from(pointers.values()).filter((p) => p.grab).map((p) => p.grab);
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const [wx, wy] = toWorld(e.clientX, e.clientY);
    canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
    const p = { id: e.pointerId, x: wx, y: wy, px: wx, py: wy, dx: 0, dy: 0, t: performance.now() };
    pointers.set(e.pointerId, p);
    app.pointer.x = wx; app.pointer.y = wy; app.pointer.inside = true;
    app.pointer.down = true;
    app.pointer.px = wx; app.pointer.py = wy;
    beginTool(p, e);
    syncGrab();
    e.preventDefault();
  });

  canvas.addEventListener('pointermove', (e) => {
    const [wx, wy] = toWorld(e.clientX, e.clientY);
    let p = pointers.get(e.pointerId);
    if (!p) {
      p = { id: e.pointerId, x: wx, y: wy, px: wx, py: wy, dx: 0, dy: 0, t: performance.now() };
      if (!view.paused || !app.pointer.down) { /* hover tracking only */ }
    }
    const now = performance.now();
    const dt = Math.max(8, now - p.t) / 1000;
    p.dx = (wx - p.x) / dt / 26;
    p.dy = (wy - p.y) / dt / 26;
    p.px = p.x; p.py = p.y;
    p.x = wx; p.y = wy; p.t = now;
    if (!pointers.has(e.pointerId)) pointers.set(e.pointerId, p);
    app.pointer.x = wx; app.pointer.y = wy; app.pointer.inside = true;
    app.pointer.dx = p.dx; app.pointer.dy = p.dy;
    if (app.pointer.down) { moveTool(p); syncGrab(); }
  });

  function releasePointer(e) {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    endTool(p);
    pointers.delete(e.pointerId);
    if (!pointers.size) {
      app.pointer.down = false;
      app.W.gust = null;
      app.W.grab = null;
      app.grabs = [];
      app.cutTrail.length = 0;
    }
    syncGrab();
  }
  canvas.addEventListener('pointerup', releasePointer);
  canvas.addEventListener('pointercancel', releasePointer);
  canvas.addEventListener('pointerleave', (e) => {
    app.pointer.inside = false;
    releasePointer(e);
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  /* -------------------------------------------------------------- keyboard */
  const KEYMAP = { '1': 'grab', '2': 'pin', '3': 'cut', '4': 'push', '5': 'wind', '6': 'spawn', '7': 'erase' };
  doc.addEventListener('keydown', (e) => {
    if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    const k = e.key;
    if (k === ' ' || k === 'Spacebar') { setPaused(!view.paused); e.preventDefault(); }
    else if (k === 'n' || k === 'N') { doc.getElementById('btnStep').click(); }
    else if (k === 'r' || k === 'R') { loadScenario(app.sceneId); }
    else if (k === 'x' || k === 'X') { doc.getElementById('btnClear').click(); }
    else if (k === 'v' || k === 'V') {
      const i = MODES.findIndex((m) => m.id === app.mode);
      const nx = e.shiftKey ? (i + MODES.length - 1) % MODES.length : (i + 1) % MODES.length;
      app.mode = MODES[nx].id;
      modeSel.value = app.mode;
      toast('View: ' + MODES[nx].name + ' — ' + MODES[nx].hint);
      saveSession();
    }
    else if (KEYMAP[k]) setTool(KEYMAP[k]);
    else if (k === '[') { S.grabRadius = Math.max(6, S.grabRadius - 6); syncControls(); saveSession(); }
    else if (k === ']') { S.grabRadius = Math.min(160, S.grabRadius + 6); syncControls(); saveSession(); }
    else if (k === ',') { S.substeps = Math.max(1, S.substeps - 1); syncControls(); saveSession(); }
    else if (k === '.') { S.substeps = Math.min(8, S.substeps + 1); syncControls(); saveSession(); }
    else if (k === 'h' || k === 'H') { S.hud = !S.hud; syncControls(); saveSession(); }
    else if (k === 'p' || k === 'P') setPanel(!view.panelOpen);
    else if (k === 'Escape') { pointers.clear(); app.W.grab = null; app.grabs = []; }
    else return;
    e.preventDefault();
  });

  /* shortcut legend */
  doc.getElementById('keys').innerHTML =
    '<b>Space</b> pause · <b>N</b> step · <b>R</b> reset · <b>X</b> clear<br>' +
    '<b>1-7</b> tools · <b>V</b> / <b>Shift+V</b> viz mode<br>' +
    '<b>[ ]</b> tool radius · <b>, .</b> substeps · <b>H</b> hud · <b>P</b> panel';

  /* --------------------------------------------------------------- the HUD */
  const fpsHist = new Float32Array(120);
  let fpsIdx = 0;
  let hudText = '';
  function updateHud(fps, fpsAvg) {
    if (!S.hud) { hud.style.display = 'none'; return; }
    hud.style.display = 'block';
    const st = app.W.stats;
    const err = st.maxErr.toFixed(1);
    const strain = (st.maxStrain * 100).toFixed(1);
    const ti = TOOL_INFO[app.tool] || TOOL_INFO.grab;
    const modeName = (MODES.find((m) => m.id === app.mode) || MODES[0]).name;
    const sc = scen.byId(app.sceneId);
    const lines = [
      (view.paused ? '‖ PAUSED  ' : '▶ RUNNING ') + '  ' + fps.toFixed(1) + ' fps (avg ' + fpsAvg.toFixed(1) + ')',
      'particles <b>' + st.parts + '</b>   constraints <b>' + st.cons + '</b>   bodies ' + app.W.bodies.filter((b) => !b.dead).length,
      'collision pairs <b>' + st.pairsTested + '</b>   contacts ' + st.contacts + '   tears ' + st.tears,
      'solver ' + st.iters + ' it × ' + st.subs + ' sub   step ' + st.solveMs.toFixed(2) + ' ms   draw ' + st.renderMs.toFixed(2) + ' ms',
      'max link error <b>' + err + ' u</b>   strain ' + strain + ' %   skin ' + S.thick.toFixed(1),
      'tool <b>' + ti.name + '</b>   view <b>' + modeName + '</b>   r=' + Math.round(S.grabRadius) + ' u',
      'scenario <b>' + sc.name + '</b>   g ' + Math.round(S.gravity) + ' u/s² @ ' + Math.round(S.gravDir) + '°   wind ' + Math.round(S.wind)
    ];
    const t = lines.join('\n');
    if (t !== hudText) { hud.innerHTML = t; hudText = t; }
    if (S.spark && sparkCtx) drawSpark();
  }

  function drawSpark() {
    if (!sparkCtx || !S.spark) return;
    const c = sparkCtx, wpx = sparkC.width, hpx = sparkC.height;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, wpx, hpx);
    c.fillStyle = '#0d1826';
    c.fillRect(0, 0, wpx, hpx);
    c.strokeStyle = 'rgba(110,231,255,0.35)';
    c.beginPath();
    const y60 = hpx - (60 / 90) * hpx;
    c.moveTo(0, y60); c.lineTo(wpx, y60);
    c.stroke();
    c.fillStyle = 'rgba(140,170,200,0.65)';
    c.font = '9px ui-monospace,monospace';
    c.fillText('60 fps', 3, y60 - 3);
    c.beginPath();
    const n = fpsHist.length;
    for (let i = 0; i < n; i++) {
      const v = fpsHist[(fpsIdx + i) % n];
      const x = (i / (n - 1)) * wpx;
      const y = hpx - Math.min(90, v) / 90 * hpx;
      if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
    }
    c.strokeStyle = '#5fe3d0';
    c.lineWidth = 1.5;
    c.stroke();
  }

  /* ------------------------------------------------------------- main loop */
  let last = performance.now();
  let acc = 0, frames = 0, fps = 60, fpsAvg = 60, lastHud = 0;
  let stepCounter = 0;

  function loop(now) {
    requestAnimationFrame(loop);
    const dtReal = Math.min(80, now - last);
    last = now;
    acc += dtReal; frames++;
    if (acc >= 250) {
      fps = (frames * 1000) / acc;
      fpsAvg = fpsAvg * 0.6 + fps * 0.4;
      fpsHist[fpsIdx % fpsHist.length] = fps;
      fpsIdx++;
      acc = 0; frames = 0;
    }
    const t0 = performance.now();
    if (!view.paused || view.stepOnce) {
      view.stepOnce = false;
      rebuildForces();
      const dt = (1 / 60) * S.dtScale;
      const ts = performance.now();
      A.stepFrame(app.W, S, dt);
      app.W.stats.solveMs = performance.now() - ts;
      stepCounter++;
    }
    const t1 = performance.now();
    R.draw(app.W, S, app);
    app.W.stats.renderMs = performance.now() - t1;
    app.W.stats.fps = fps;
    if (now - lastHud > 110) { updateHud(fps, fpsAvg); lastHud = now; }
    void t0;
  }

  /* ------------------------------------------------------------------ boot */
  const saved = loadSession();
  buildToolButtons();
  syncToolButtons();
  loadScenario(saved || (scen.list.find((s) => s.default) || scen.list[0]).id, true);
  syncControls();
  setPaused(view.paused);
  refit();

  let ro = null;
  if (window.ResizeObserver) {
    ro = new ResizeObserver(() => refit());
    ro.observe(stage);
  }
  window.addEventListener('resize', () => { refit(); });

  /* debug / harness hook */
  window.SOFTPLAY = {
    version: '1.0.0',
    api: api,
    app: app,
    get world() { return app.W; },
    stats() {
      const st = app.W.stats;
      return { fps: Math.round(st.fps * 10) / 10, particles: st.parts, constraints: st.cons,
        pairs: st.pairsTested, contacts: st.contacts, iters: st.iters, substeps: st.subs,
        maxErr: st.maxErr, tool: app.tool, mode: app.mode, scene: app.sceneId,
        paused: view.paused, solveMs: Math.round(st.solveMs * 100) / 100 };
    },
    setTool(t) { setTool(t); },
    setMode(m) { app.mode = m; modeSel.value = m; },
    setScenario(id) { scenSel.value = id; loadScenario(id); },
    setSetting(k, v) { S[k] = v; syncControls(); },
    spawn(type, x, y, w, h) { return spawnAt(type || app.spawnType, x, y, x + (w || 0), y + (h || 0)); },
    /* scripted pointer for automated checks: real DOM PointerEvents */
    drag(sx, sy, ex, ey, steps) {
      const mk = (type, x, y, id) => {
        const ev = new PointerEvent(type, {
          pointerType: 'mouse', pointerId: id || 1, button: 0, buttons: type === 'pointerup' ? 0 : 1,
          clientX: x, clientY: y, bubbles: true, cancelable: true
        });
        canvas.dispatchEvent(ev);
      };
      const n = steps || 8;
      mk('pointermove', sx, sy);
      mk('pointerdown', sx, sy);
      for (let i = 1; i <= n; i++) {
        const t = i / n;
        mk('pointermove', sx + (ex - sx) * t, sy + (ey - sy) * t);
      }
      mk('pointerup', ex, ey);
      return true;
    },
    screenToWorld: (x, y) => R.screenToWorld(x, y),
    refit: refit,
    errors: app.errors
  };
  window.addEventListener('error', (e) => {
    app.errors.push(String(e.message));
    if (app.errors.length > 20) app.errors.shift();
  });

  requestAnimationFrame(loop);
  return app;
}