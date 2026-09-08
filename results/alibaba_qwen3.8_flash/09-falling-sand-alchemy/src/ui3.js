/* =====================================================================
   INPUT, PERSISTENCE, BOOTSTRAP
   ===================================================================== */

/* ---------- pointer input ---------- */
const stroke = { active: false, tool: null, mat: 0, lx: 0, ly: 0, dirx: 0, diry: 1 };

function gridFromEvent(e) {
  const r = view.getBoundingClientRect();
  const x = (e.clientX - r.left) / Math.max(1, r.width) * W;
  const y = (e.clientY - r.top) / Math.max(1, r.height) * H;
  return [x, y];
}
function cssFromGrid(gx, gy) {
  const r = view.getBoundingClientRect();
  return [gx / Math.max(1, W) * r.width, gy / Math.max(1, H) * r.height];
}
function pickAt(gx, gy) {
  const x = Math.round(gx), y = Math.round(gy);
  if (!inb(x, y)) return;
  const m = mat[y * W + x];
  if (m === EMPTY) { toast('empty cell', 'warn'); return; }
  ui.mat = m;
  markPressed('mat-grid', 'mat', String(m));
  toast('sampled ' + NAMES[m] + ' · ' + temp[y * W + x].toFixed(0) + '°C');
}
function updateCursor(gx, gy) {
  const p = cssFromGrid(gx, gy);
  const rect = view.getBoundingClientRect();
  const scale = rect.width / Math.max(1, W);
  const d = Math.max(3, ui.brush * 2 * scale);
  brushRing.style.display = 'block';
  brushRing.style.width = d + 'px';
  brushRing.style.height = d + 'px';
  brushRing.style.left = (view.offsetLeft + p[0]) + 'px';
  brushRing.style.top = (view.offsetTop + p[1]) + 'px';
  const cross = (ui.tool === 'fill' || ui.tool === 'pick');
  crosshair.style.display = cross ? 'block' : 'none';
  if (cross) {
    crosshair.style.left = (view.offsetLeft + p[0]) + 'px';
    crosshair.style.top = (view.offsetTop + p[1]) + 'px';
    crosshair.style.width = '0px';
  }
}

view.addEventListener('contextmenu', (e) => e.preventDefault());

view.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  view.focus();
  const g = gridFromEvent(e);
  let tool = ui.tool;
  if (e.button === 2) tool = 'erase';
  else if (e.button === 1) tool = 'pick';
  if (e.altKey && e.button === 0) tool = 'pick';
  stroke.active = true;
  stroke.tool = tool;
  stroke.mat = ui.mat;
  stroke.lx = g[0]; stroke.ly = g[1];
  stroke.dirx = 0; stroke.diry = 0;
  try { view.setPointerCapture(e.pointerId); } catch (err) { void err; }
  if (tool === 'pick') pickAt(g[0], g[1]);
  else if (tool === 'fill') fillArea(g[0], g[1], ui.mat);
  else if (tool === 'blast') {
    const p = 2.5 + P.blastPow * 5.5;
    explode(Math.round(g[0]), Math.round(g[1]), p, false);
    toast('blast · power ' + p.toFixed(1));
  } else {
    stampAt(g[0], g[1], 0, 0, tool, ui.mat);
  }
  updateCursor(g[0], g[1]);
}, { passive: false });

view.addEventListener('pointermove', (e) => {
  const list = (e.getCoalescedEvents && e.getCoalescedEvents().length > 0) ? e.getCoalescedEvents() : [e];
  for (let k = 0; k < list.length; k++) {
    const ev = list[k];
    const g = gridFromEvent(ev);
    if (stroke.active) {
      const tool = stroke.tool;
      if (tool === 'paint' || tool === 'erase' || tool === 'heat' || tool === 'cool' ||
        tool === 'wind' || tool === 'wall') {
        const dx = g[0] - stroke.lx, dy = g[1] - stroke.ly;
        const dist = Math.sqrt(dx * dx + dy * dy);
        let ux = stroke.dirx, uy = stroke.diry;
        if (dist > 0.35) { ux = dx / dist; uy = dy / dist; stroke.dirx = ux; stroke.diry = uy; }
        const gap = Math.max(0.55, ui.brush * 0.34);
        const n = Math.min(240, Math.max(1, Math.ceil(dist / gap)));
        for (let s = 1; s <= n; s++) {
          const t = s / n;
          stampAt(stroke.lx + dx * t, stroke.ly + dy * t, ux, uy, tool, stroke.mat);
        }
      }
      stroke.lx = g[0]; stroke.ly = g[1];
    }
    updateCursor(g[0], g[1]);
  }
}, { passive: true });

function endStroke(e) {
  if (stroke.active) {
    try { view.releasePointerCapture(e.pointerId); } catch (err) { void err; }
  }
  stroke.active = false;
  stroke.tool = null;
}
view.addEventListener('pointerup', endStroke);
view.addEventListener('pointercancel', endStroke);
view.addEventListener('pointerleave', () => {
  brushRing.style.display = 'none';
  crosshair.style.display = 'none';
});
view.addEventListener('pointerenter', () => { brushRing.style.display = 'block'; });

view.addEventListener('wheel', (e) => {
  e.preventDefault();
  const dir = e.deltaY > 0 ? -1 : 1;
  if (e.shiftKey) {
    ui.amount = clamp(ui.amount + dir * 0.06, 0.05, 1);
    const el = document.getElementById('s-amount');
    el.value = String(Math.round(ui.amount * 100));
    document.getElementById('o-amount').textContent = Math.round(ui.amount * 100) + '%';
  } else {
    ui.brush = clamp(ui.brush + dir, 1, 40);
    const el = document.getElementById('s-brush');
    el.value = String(ui.brush);
    document.getElementById('o-brush').textContent = String(ui.brush);
  }
}, { passive: false });

/* ---------- keyboard ---------- */
const MAT_SLOTS = NICE_MATS.slice(0, 10);
const TOOL_KEYS = { b: 'paint', e: 'erase', i: 'pick', t: 'heat', q: 'cool', w: 'wind', x: 'blast', l: 'wall', f: 'fill' };
function singleStep() {
  for (let s = 0; s < P.substeps; s++) stepSim();
}
window.addEventListener('keydown', (e) => {
  const tag = (e.target && e.target.tagName) || '';
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
  const k = e.key;
  const low = k.toLowerCase();
  if (k === ' ' || k === 'Spacebar') { e.preventDefault(); togglePause(); return; }
  if (k === 'Escape') { helpBox.hidden = true; return; }
  if (k === '?' || k === 'h' || k === 'H') { helpBox.hidden = !helpBox.hidden; return; }
  if (k === 'Tab') { e.preventDefault(); panel.classList.toggle('open'); return; }
  if (k === 's' || k === 'S') { e.preventDefault(); singleStep(); toast('step ' + stepNo); return; }
  if (k === 'r' || k === 'R') { setPreset(curPreset, true); return; }
  if (k === 'c' || k === 'C') { clearWorld(); toast('grid cleared', 'warn'); return; }
  if (k === 'm' || k === 'M') { setMode((P.mode + 1) % MODES.length); toast('view: ' + MODES[P.mode].name); return; }
  if (k === 'g' || k === 'G') {
    const el = document.getElementById('s-gdir');
    el.value = String((parseInt(el.value, 10) + 1) % 8);
    el.dispatchEvent(new Event('input'));
    return;
  }
  if (k === 'p' || k === 'P') { exportPNG(); return; }
  if (k === 'o' || k === 'O') { saveFile(); return; }
  if (k === '[' || k === ']') {
    ui.brush = clamp(ui.brush + (k === ']' ? 2 : -2), 1, 40);
    const el = document.getElementById('s-brush');
    el.value = String(ui.brush);
    document.getElementById('o-brush').textContent = String(ui.brush);
    return;
  }
  if (TOOL_KEYS[low]) { setTool(TOOL_KEYS[low]); return; }
  if (k >= '0' && k <= '9') {
    const idx = k === '0' ? 9 : (parseInt(k, 10) - 1);
    if (MAT_SLOTS[idx] != null) setMaterial(MAT_SLOTS[idx]);
  }
});

/* ---------- pause ---------- */
function togglePause() {
  paused = !paused;
  document.getElementById('pause-label').textContent = paused ? 'Resume' : 'Pause';
  document.getElementById('btn-pause').classList.toggle('primary', !paused);
  document.getElementById('run-flag').textContent = paused ? 'PAUSED' : 'RUNNING';
  document.getElementById('run-flag').classList.toggle('paused', paused);
}

/* ---------- persistence ---------- */
const LS_KEY = 'fsa.autosave.v1';
const ioStatus = document.getElementById('io-status');
let lastAuto = 0;

function serializeAll() {
  const st = encodeState();
  return JSON.stringify({ fsa: 1, w: W, h: H, params: Object.assign({}, P), state: st });
}
function restoreParams(o) {
  if (!o) return;
  const keepRes = P.cellPx;
  Object.keys(o).forEach(k => { if (k in P) P[k] = o[k]; });
  if (P.cellPx !== keepRes) { P.cellPx = keepRes; }
  setGravityDir(P.gdir == null ? 0 : P.gdir);
  syncControls();
}
function deserializeAll(str) {
  let o;
  try { o = JSON.parse(str); } catch (err) { return 'not valid JSON'; }
  if (!o || o.fsa !== 1 || !o.state) return 'not a sandbox state file';
  restoreParams(o.params);
  const err = decodeState(o.state);
  if (err) return err;
  setupBuffers();
  return null;
}
function download(name, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 500);
  return name;
}
function saveFile() {
  try {
    const t = performance.now();
    const s = serializeAll();
    const n = download('fsa-' + PRESETS[curPreset].name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' +
      Date.now() + '.json', new Blob([s], { type: 'application/json' }));
    ioStatus.textContent = 'saved ' + n + ' · ' + (s.length / 1024).toFixed(0) + ' KiB · ' +
      (performance.now() - t).toFixed(0) + ' ms';
    toast('state saved (' + (s.length / 1024).toFixed(0) + ' KiB)');
  } catch (err) {
    ioStatus.textContent = 'save failed: ' + err.message;
    toast('save failed: ' + err.message, 'bad');
  }
}
function exportPNG() {
  try {
    // stamp a caption into the bitmap so the export carries its own diagnostics
    const cap = PRESETS[curPreset].name + ' · ' + MODES[P.mode].name + ' · ' + W + 'x' + H +
      ' · ' + censusCells + ' cells · ' + fpsAvg.toFixed(0) + ' fps · step ' + stepNo;
    vctx.font = Math.max(11, Math.round(viewH / 45)) + 'px ui-monospace, monospace';
    vctx.fillStyle = 'rgba(6,10,15,.78)';
    const hh = Math.max(20, Math.round(viewH / 22));
    vctx.fillRect(0, viewH - hh, viewW, hh);
    vctx.fillStyle = '#9fe8ff';
    vctx.fillText(cap, 8, viewH - hh / 3);
    const url = view.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fsa-' + PRESETS[curPreset].name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' +
      MODES[P.mode].name.toLowerCase().replace(/\W+/g, '-') + '.png';
    document.body.appendChild(a); a.click();
    setTimeout(() => document.body.removeChild(a), 400);
    ioStatus.textContent = 'png exported ' + (W + 'x' + H);
    toast('PNG exported');
  } catch (err) {
    ioStatus.textContent = 'png failed: ' + err.message;
    toast('png export failed: ' + err.message, 'bad');
  }
}
function autosaveTick() {
  if (!document.getElementById('s-autosave').checked) return;
  if (paused) return;
  try {
    const st = encodeState();
    delete st.v;
    const payload = JSON.stringify({ fsa: 1, w: W, h: H, t: Date.now(), params: Object.assign({}, P), state: st });
    if (payload.length > 3200000) { ioStatus.textContent = 'autosave skipped: state too large (' + (payload.length / 1048576).toFixed(1) + ' MiB)'; return; }
    localStorage.setItem(LS_KEY, payload);
    lastAuto = performance.now();
    ioStatus.textContent = 'autosaved ' + (payload.length / 1024).toFixed(0) + ' KiB at step ' + stepNo;
  } catch (err) {
    ioStatus.textContent = 'autosave unavailable: ' + err.message;
    toast('autosave unavailable (storage blocked)', 'warn');
    document.getElementById('s-autosave').checked = false;
  }
}
function restoreAuto(manual) {
  let s = null;
  try { s = localStorage.getItem(LS_KEY); } catch (err) { void err; }
  if (!s) { if (manual) toast('no autosave found', 'warn'); return false; }
  const err = deserializeAll(s);
  if (err) { if (manual) toast('autosave could not load: ' + err, 'bad'); return false; }
  ioStatus.textContent = 'restored autosave · ' + (s.length / 1024).toFixed(0) + ' KiB';
  toast('autosave restored');
  return true;
}

/* ---------- control wiring ---------- */
const boundRuns = [];
function wireControls() {
  const R = bindRange;
  boundRuns.length = 0;
  R('s-speed', 'o-speed', v => v + '/s', v => { P.speed = v; });
  R('s-sub', 'o-sub', v => String(v), v => { P.substeps = v; });
  R('s-res', 'o-res', v => v + ' px/cell', v => {
    if (v === P.cellPx) return;
    P.cellPx = v;
    const oldW = W, oldH = H;
    const r = stage.getBoundingClientRect();
    const nw = Math.max(24, Math.floor(Math.max(80, r.width) / v));
    const nh = Math.max(24, Math.floor(Math.max(80, r.height) / v));
    if (nw !== oldW || nh !== oldH) {
      rebuildGrid(nw, nh, N > 0);
      setupBuffers();
      toast('grid rebuilt ' + nw + '×' + nh);
    }
  });
  R('s-gdir', 'o-gdir', v => GNAME[v], v => { setGravityDir(v); });
  R('s-grav', 'o-grav', v => v.toFixed(2), v => { P.grav = v; });
  R('s-amb', 'o-amb', v => v + ' °C', v => { P.ambient = v; });
  R('s-heat', 'o-heat', v => v + '%', v => { P.heatRate = v / 100 * 0.9; });
  R('s-rxn', 'o-rxn', v => v + '%', v => { P.rxnRate = v / 100; });
  R('s-mob', 'o-mob', v => v + '%', v => { P.mobility = v / 100; });
  R('s-diff', 'o-diff', v => v + '%', v => { P.diffusion = v / 100; });
  R('s-fire', 'o-fire', v => v + '%', v => { P.firePow = v / 100; });
  R('s-blast', 'o-blast', v => v + '%', v => { P.blastPow = v / 100; });
  R('s-brush', 'o-brush', v => String(v), v => { ui.brush = v; });
  R('s-amount', 'o-amount', v => v + '%', v => { ui.amount = v / 100; });
  R('s-temp', 'o-temp', v => v + ' °C', v => { ui.paintTemp = v; });
  R('s-vel', 'o-vel', v => String(v), v => { ui.vel = v; });
  R('s-scatter', 'o-scatter', v => v + '%', v => { ui.scatter = v / 100; });
  R('s-grav', 'o-grav', v => v.toFixed(2), v => { P.grav = v; });
  bindCheck('s-tempauto', v => { ui.tempAuto = v; });
  bindCheck('s-heatglow', v => { opts.heatGlow = v; });
  bindCheck('s-particles', v => { opts.streaks = v; });
  const shape = document.getElementById('s-shape');
  shape.addEventListener('change', () => { ui.shape = shape.value; });
  document.getElementById('btn-pause').addEventListener('click', togglePause);
  document.getElementById('btn-step').addEventListener('click', () => { singleStep(); });
  document.getElementById('btn-reset').addEventListener('click', () => setPreset(curPreset, true));
  document.getElementById('btn-clear').addEventListener('click', () => { clearWorld(); toast('grid cleared', 'warn'); });
  document.getElementById('btn-help').addEventListener('click', () => { helpBox.hidden = !helpBox.hidden; });
  document.getElementById('help-close').addEventListener('click', () => { helpBox.hidden = true; });
  document.getElementById('btn-panel').addEventListener('click', () => panel.classList.toggle('open'));
  document.getElementById('btn-save').addEventListener('click', saveFile);
  document.getElementById('btn-png').addEventListener('click', exportPNG);
  document.getElementById('btn-load').addEventListener('click', () => document.getElementById('file-state').click());
  document.getElementById('file-state').addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const fr = new FileReader();
    fr.onload = () => {
      const err = deserializeAll(String(fr.result));
      if (err) { toast('load failed: ' + err, 'bad'); ioStatus.textContent = 'load failed: ' + err; }
      else { toast('loaded ' + f.name + ' (' + (fr.result.length / 1024).toFixed(0) + ' KiB)'); ioStatus.textContent = 'loaded ' + f.name; }
    };
    fr.onerror = () => { toast('could not read file', 'bad'); };
    fr.readAsText(f);
    e.target.value = '';
  });
  document.getElementById('btn-restore').addEventListener('click', () => restoreAuto(true));
  document.getElementById('btn-copy').addEventListener('click', () => {
    try {
      const s = serializeAll();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(s).then(() => toast('state JSON copied (' + (s.length / 1024).toFixed(0) + ' KiB)'),
          () => toast('clipboard blocked', 'warn'));
      } else toast('no clipboard API here', 'warn');
    } catch (err) { toast('copy failed: ' + err.message, 'bad'); }
  });
  document.getElementById('btn-reroll').addEventListener('click', () => {
    const el = document.getElementById('s-seed');
    el.value = String((Math.random() * 100000) | 0);
    setPreset(curPreset, true);
  });
  document.getElementById('s-seed').addEventListener('change', () => setPreset(curPreset, true));
  setInterval(autosaveTick, 10000);
}
function syncControls() {
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = String(val);
  };
  set('s-speed', P.speed); document.getElementById('o-speed').textContent = P.speed + '/s';
  set('s-sub', P.substeps); document.getElementById('o-sub').textContent = String(P.substeps);
  set('s-res', P.cellPx); document.getElementById('o-res').textContent = P.cellPx + ' px/cell';
  set('s-gdir', P.gdir); document.getElementById('o-gdir').textContent = GNAME[P.gdir];
  set('s-heat', Math.round(P.heatRate / 0.9 * 100)); document.getElementById('o-heat').textContent = Math.round(P.heatRate / 0.9 * 100) + '%';
  set('s-rxn', Math.round(P.rxnRate * 100)); document.getElementById('o-rxn').textContent = Math.round(P.rxnRate * 100) + '%';
  set('s-mob', Math.round(P.mobility * 100)); document.getElementById('o-mob').textContent = Math.round(P.mobility * 100) + '%';
  set('s-diff', Math.round(P.diffusion * 100)); document.getElementById('o-diff').textContent = Math.round(P.diffusion * 100) + '%';
  set('s-fire', Math.round(P.firePow * 100)); document.getElementById('o-fire').textContent = Math.round(P.firePow * 100) + '%';
  set('s-blast', Math.round(P.blastPow * 100)); document.getElementById('o-blast').textContent = Math.round(P.blastPow * 100) + '%';
  set('s-grav', P.grav); document.getElementById('o-grav').textContent = P.grav.toFixed(2);
  set('s-amb', P.ambient); document.getElementById('o-amb').textContent = P.ambient + ' °C';
}

/* ---------- resize ---------- */
let resizeTimer = 0;
function onResize() {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { resizeCanvas(); }, 60);
}
window.addEventListener('resize', onResize);
if (window.ResizeObserver) {
  const ro = new ResizeObserver(() => { resizeCanvas(); });
  ro.observe(stage);
}

/* ---------- debug / test API ---------- */
window.FSA = {
  version: '1.0',
  get stats() {
    let movers = 0, hot = 0;
    for (let i = 0; i < N; i += 3) {
      if (Math.abs(vx[i]) + Math.abs(vy[i]) > 0.2) movers++;
      if (temp[i] > 90) hot++;
    }
    return {
      w: W, h: H, cells: censusCells, activeChunks: activeChunks,
      avgTemp: +censusTemp.toFixed(2), rxn: rxnCount, step: stepNo,
      paused: paused, fps: +fpsAvg.toFixed(1), mode: MODES[P.mode].name,
      tool: ui.tool, material: NAMES[ui.mat],
      movers: movers * 3, hot: hot * 3,
      preset: PRESETS[curPreset] ? PRESETS[curPreset].name : null,
      params: Object.assign({}, P)
    };
  },
  cell(x, y) {
    if (!inb(x, y)) return null;
    const i = y * W + x;
    return { m: mat[i], name: NAMES[mat[i]], t: +temp[i].toFixed(2), life: life[i], chg: chgA[i] };
  },
  region(x0, y0, x1, y1) {
    const out = {};
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (!inb(x, y)) continue;
      const n = NAMES[mat[y * W + x]];
      out[n] = (out[n] || 0) + 1;
    }
    return out;
  },
  setMaterial(n) {
    const i = NAMES.indexOf(n);
    if (i >= 0) setMaterial(i);
  },
  setTool(t) { setTool(t); },
  setMode(n) { const i = MODES.findIndex(m => m.name === n); if (i >= 0) setMode(i); },
  paint(x, y, r, n) {
    const i = NAMES.indexOf(n);
    if (i < 0) return false;
    ui.brush = r; ui.mat = i; ui.tool = 'paint';
    stampAt(x, y, 0, 0, 'paint', i);
    return true;
  },
  drag(x0, y0, x1, y1, r, n, tool) {
    const i = NAMES.indexOf(n);
    ui.brush = r; ui.tool = tool || 'paint';
    if (i >= 0) ui.mat = i;
    const dx = x1 - x0, dy = y1 - y0;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const ux = dist ? dx / dist : 0, uy = dist ? dy / dist : 0;
    const nn = Math.max(1, Math.ceil(dist));
    for (let k = 0; k <= nn; k++) {
      const t = k / nn;
      stampAt(x0 + dx * t, y0 + dy * t, ux, uy, ui.tool, ui.mat);
    }
    return true;
  },
  explode(x, y, p) { explode(x, y, p == null ? 8 : p, false); },
  mode(n) {
    const i = typeof n === 'number' ? n : MODES.findIndex(m => m.name.toLowerCase() === String(n).toLowerCase());
    if (i < 0 || i >= MODES.length) return false;
    setMode(i);
    return true;
  },
  set(tool, mat) {
    if (tool) setTool(tool);
    if (mat) { const i = NAMES.indexOf(mat); if (i >= 0) setMaterial(i); }
    return { tool: ui.tool, mat: NAMES[ui.mat] };
  },
  hash() {
    const d = vctx.getImageData(0, 0, view.width, view.height).data;
    let h = 2166136261;
    for (let i = 0; i < d.length; i += 97) { h ^= d[i]; h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(16);
  },
  step(n) { for (let k = 0; k < (n || 1); k++) stepSim(); },
  pause(v) { paused = (v == null) ? !paused : !!v; },
  clear() { clearWorld(); },
  preset(n) { const i = PRESETS.findIndex(p => p.name === n); if (i >= 0) setPreset(i, true); },
  count(name) { const i = NAMES.indexOf(name); return i < 0 ? 0 : counts[i]; },
  encode() { return serializeAll(); },
  load(str) { return deserializeAll(str); }
};

/* ---------- bootstrap ---------- */
function boot() {
  resizeCanvas();
  buildUI();
  wireControls();
  syncControls();
  const auto = document.getElementById('s-autosave').checked;
  let restored = false;
  if (auto) restored = restoreAuto(false);
  if (!restored) setPreset(0, true);
  document.getElementById('btn-pause').classList.toggle('primary', !paused);
  requestAnimationFrame(loop);
  void lastAuto;
}
try {
  boot();
} catch (err) {
  console.error('bootstrap failed', err);
  toast('bootstrap error: ' + err.message, 'bad');
}
