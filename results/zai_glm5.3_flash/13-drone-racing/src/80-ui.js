'use strict';
/* ============================= UI: settings panel, toasts, help, results ============================= */
const UI = {
  panel: null, body: null, helpOpen: true, bindings: [],
};

UI.toast = function (msg, cls, ms) {
  const t = document.createElement('div');
  t.className = 'toast' + (cls ? ' ' + cls : '');
  t.textContent = msg;
  document.getElementById('toasts').appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity 0.3s'; setTimeout(() => t.remove(), 320); }, ms || 2600);
};

const UI_SCHEMA = [
  { section: 'Race', open: true, items: [
    { key: 'mode', label: 'Race mode', type: 'select', options: [['trial', 'Time trial'], ['free', 'Free flight']] },
    { key: 'preset', label: 'Course preset', type: 'select', options: PRESETS.map(p => [p.id, p.name]).concat([['custom', 'Custom']]) },
    { key: 'seed', label: 'Course seed', type: 'number', min: 0, max: 999999, step: 1 },
    { key: 'diff', label: 'Difficulty', type: 'range', min: 0, max: 1, step: 0.05, fmt: v => Math.round(v * 100) + '%' },
    { type: 'buttonrow', buttons: [{ id: 'rebuild', label: '↻ REBUILD COURSE' }, { id: 'restart', label: 'RESTART RUN' }, { id: 'random', label: 'RANDOM SEED' }] },
    { key: 'trialLaps', label: 'Trial laps', type: 'range', min: 1, max: 5, step: 1, fmt: v => v },
    { key: 'collisionPenalty', label: 'Collision +1s penalty', type: 'checkbox' },
    { key: 'ghostVisible', label: 'Ghost drone (best lap)', type: 'checkbox' },
    { key: 'ghostTrail', label: 'Best-lap racing line', type: 'checkbox' },
  ]},
  { section: 'Flight', items: [
    { key: 'flightMode', label: 'Flight mode', type: 'select', options: [['angle', 'Angle (self-level)'], ['horizon', 'Horizon'], ['acro', 'Acro (rate)']] },
    { key: 'autoLevel', label: 'Auto-level (acro assist)', type: 'range', min: 0, max: 1, step: 0.1, fmt: v => Math.round(v * 100) + '%' },
    { key: 'altHold', label: 'Altitude hold assist', type: 'checkbox' },
    { key: 'antiCrash', label: 'Anti-crash braking', type: 'checkbox' },
    { key: 'forgive', label: 'Collision forgiveness', type: 'range', min: 0, max: 1, step: 0.05, fmt: v => Math.round(v * 100) + '%' },
    { key: 'twr', label: 'Thrust / weight', type: 'range', min: 1.4, max: 4, step: 0.05, fmt: v => v.toFixed(2) },
    { key: 'gravity', label: 'Gravity m/s²', type: 'range', min: 3, max: 20, step: 0.1, fmt: v => v.toFixed(1) },
    { key: 'drag', label: 'Drag', type: 'range', min: 0.3, max: 2.2, step: 0.05, fmt: v => v.toFixed(2) },
    { key: 'throttleExpo', label: 'Throttle expo', type: 'range', min: 0, max: 0.8, step: 0.05, fmt: v => v.toFixed(2) },
    { key: 'expo', label: 'Stick expo', type: 'range', min: 0, max: 0.8, step: 0.05, fmt: v => v.toFixed(2) },
    { key: 'ratePitch', label: 'Pitch rate °/s', type: 'range', min: 120, max: 720, step: 10, fmt: v => v },
    { key: 'rateRoll', label: 'Roll rate °/s', type: 'range', min: 120, max: 720, step: 10, fmt: v => v },
    { key: 'rateYaw', label: 'Yaw rate °/s', type: 'range', min: 60, max: 540, step: 10, fmt: v => v },
    { key: 'angleMax', label: 'Angle limit °', type: 'range', min: 10, max: 60, step: 1, fmt: v => v },
    { key: 'angleGain', label: 'Angle response', type: 'range', min: 2, max: 8, step: 0.2, fmt: v => v.toFixed(1) },
  ]},
  { section: 'Video', items: [
    { key: 'quality', label: 'Quality preset', type: 'select', options: [['low', 'Low'], ['med', 'Medium'], ['high', 'High']] },
    { key: 'renderScale', label: 'Render resolution', type: 'range', min: 0.4, max: 1.25, step: 0.05, fmt: v => Math.round(v * 100) + '%' },
    { key: 'adaptive', label: 'Adaptive resolution', type: 'checkbox' },
    { key: 'postFX', label: 'Post FX (FPV lens)', type: 'checkbox' },
    { key: 'fov', label: 'Camera FOV °', type: 'range', min: 60, max: 130, step: 1, fmt: v => v },
    { key: 'camTilt', label: 'Camera tilt (up) °', type: 'range', min: 0, max: 45, step: 1, fmt: v => v },
    { key: 'shadows', label: 'Contact shadow', type: 'checkbox' },
    { key: 'haze', label: 'Atmospheric haze', type: 'checkbox' },
    { key: 'particles', label: 'Particle density', type: 'select', options: [['low', 'Low'], ['med', 'Medium'], ['high', 'High']] },
  ]},
  { section: 'Audio', items: [
    { key: 'volume', label: 'Master volume', type: 'range', min: 0, max: 1, step: 0.05, fmt: v => Math.round(v * 100) + '%' },
    { type: 'buttonrow', buttons: [{ id: 'mute', label: '🔇 MUTE (M)' }] },
    { type: 'note', text: 'Engine, wind and impact sounds are synthesized live (Web Audio). Press any key or click to unlock audio.' },
  ]},
  { section: 'Input', items: [
    { type: 'status', id: 'pad-status' },
    { key: 'deadzone', label: 'Gamepad dead zone', type: 'range', min: 0, max: 0.35, step: 0.01, fmt: v => v.toFixed(2) },
    { key: 'invertThrottle', label: 'Invert throttle axis', type: 'checkbox' },
    { key: 'invertYaw', label: 'Invert yaw axis', type: 'checkbox' },
    { key: 'invertPitch', label: 'Invert pitch axis', type: 'checkbox' },
    { key: 'invertRoll', label: 'Invert roll axis', type: 'checkbox' },
    { type: 'buttonrow', buttons: [{ id: 'calibrate', label: 'CALIBRATE GAMEPAD (6s)' }] },
    { type: 'note', text: 'No gamepad is required — keyboard flying is always active (W/S throttle, A/D yaw, arrows pitch/roll). Move any gamepad stick to take over; press a keyboard key to take it back. Standard Mode-2 mapping: left stick throttle/yaw, right stick pitch/roll.' },
  ]},
  { section: 'Diagnostics', items: [
    { key: 'showOverlay', label: 'Compact live overlay', type: 'checkbox' },
    { key: 'showGraph', label: 'Telemetry graph', type: 'checkbox' },
    { key: 'showDiag', label: 'Extended diagnostics', type: 'checkbox' },
    { key: 'showVolumes', label: 'Show gate volumes', type: 'checkbox' },
  ]},
  { section: 'Data', items: [
    { type: 'buttonrow', buttons: [{ id: 'export', label: '⭳ EXPORT JSON' }, { id: 'import', label: '⭱ IMPORT JSON' }, { id: 'shot', label: 'PNG SCREENSHOT' }] },
    { type: 'buttonrow', buttons: [{ id: 'resetbest', label: 'RESET BEST (this course)' }, { id: 'cleardata', label: 'CLEAR ALL DATA', warn: true }] },
    { type: 'status', id: 'best-status' },
    { type: 'note', text: 'Export bundles the current course, settings and best lap (with ghost) as JSON. Import validates strictly — bad files are rejected without changing anything.' },
  ]},
];

UI.init = function () {
  UI.panel = document.getElementById('panel');
  UI.body = document.getElementById('panel-body');
  const frag = document.createDocumentFragment();
  for (const sec of UI_SCHEMA) {
    const det = document.createElement('details');
    if (sec.open) det.open = true;
    const sum = document.createElement('summary');
    sum.textContent = sec.section;
    det.appendChild(sum);
    for (const item of sec.items) det.appendChild(UI.buildItem(item));
    frag.appendChild(det);
  }
  UI.body.appendChild(frag);

  document.getElementById('btn-panel').addEventListener('click', () => UI.togglePanel());
  document.getElementById('panel-close').addEventListener('click', () => UI.togglePanel(false));
  document.getElementById('help-close').addEventListener('click', () => UI.toggleHelp(false));
  document.getElementById('help').addEventListener('click', (e) => { if (e.target.id === 'help') UI.toggleHelp(false); });
  document.getElementById('results-again').addEventListener('click', () => { UI.hideResults(); MAIN.restartRun(); });
  document.getElementById('results-free').addEventListener('click', () => { UI.hideResults(); P.mode = 'free'; UI.refresh(); MAIN.restartRun(); });
  document.getElementById('filein').addEventListener('change', UI.importFile);
};

UI.buildItem = function (item) {
  const div = document.createElement('div');
  if (item.type === 'note') { div.className = 'note'; div.textContent = item.text; return div; }
  if (item.type === 'status') { div.className = 'status'; div.id = item.id; div.textContent = '…'; return div; }
  if (item.type === 'buttonrow') {
    div.className = 'btnrow';
    for (const b of item.buttons) {
      const btn = document.createElement('button');
      btn.className = 'btn' + (b.warn ? ' warn' : '');
      btn.textContent = b.label;
      btn.dataset.action = b.id;
      btn.addEventListener('click', () => UI.action(b.id));
      div.appendChild(btn);
    }
    return div;
  }
  div.className = 'row';
  const label = document.createElement('label');
  label.textContent = item.label;
  div.appendChild(label);
  if (item.type === 'checkbox') {
    const inp = document.createElement('input');
    inp.type = 'checkbox';
    inp.checked = !!P[item.key];
    inp.addEventListener('change', () => { P[item.key] = inp.checked; settingsSave(); UI.afterParam(item.key); });
    div.appendChild(inp);
    UI.bindings.push({ key: item.key, el: inp, type: 'checkbox' });
  } else if (item.type === 'range') {
    const inp = document.createElement('input');
    inp.type = 'range'; inp.min = item.min; inp.max = item.max; inp.step = item.step; inp.value = P[item.key];
    const val = document.createElement('span');
    val.className = 'val';
    val.textContent = item.fmt(P[item.key]);
    inp.addEventListener('input', () => {
      P[item.key] = parseFloat(inp.value);
      val.textContent = item.fmt(P[item.key]);
      settingsSave();
      UI.afterParam(item.key);
    });
    div.appendChild(val); div.appendChild(inp);
    UI.bindings.push({ key: item.key, el: inp, type: 'range', val, fmt: item.fmt });
  } else if (item.type === 'select') {
    const inp = document.createElement('select');
    for (const [v, name] of item.options) {
      const o = document.createElement('option'); o.value = v; o.textContent = name; inp.appendChild(o);
    }
    inp.value = P[item.key];
    inp.addEventListener('change', () => { P[item.key] = inp.value; settingsSave(); UI.afterParam(item.key); });
    div.appendChild(inp);
    UI.bindings.push({ key: item.key, el: inp, type: 'select' });
  } else if (item.type === 'number') {
    const inp = document.createElement('input');
    inp.type = 'number'; inp.min = item.min; inp.max = item.max; inp.step = item.step; inp.value = P[item.key];
    inp.addEventListener('change', () => {
      P[item.key] = Math.round(clamp(parseFloat(inp.value) || 0, item.min, item.max));
      inp.value = P[item.key];
      settingsSave();
      UI.afterParam(item.key);
    });
    div.appendChild(inp);
    UI.bindings.push({ key: item.key, el: inp, type: 'number' });
  }
  return div;
};

UI.refresh = function () {
  for (const b of UI.bindings) {
    if (b.type === 'checkbox') b.el.checked = !!P[b.key];
    else b.el.value = P[b.key];
    if (b.val) b.val.textContent = b.fmt(P[b.key]);
    if (b.type === 'select') b.el.value = P[b.key];
  }
};

UI.afterParam = function (key) {
  const courseKeys = ['env', 'seed', 'diff', 'preset'];
  if (courseKeys.includes(key)) {
    if (key === 'preset' && P.preset !== 'custom') {
      const preset = PRESETS.find(p => p.id === P.preset);
      if (preset) { P.env = preset.env; P.seed = preset.seed; P.diff = preset.diff; }
      UI.refresh();
    } else if (key !== 'preset') {
      P.preset = 'custom';
      const bind = UI.bindings.find(b => b.key === 'preset');
      if (bind) bind.el.value = 'custom';
    }
    MAIN.rebuildCourse();
  } else if (key === 'mode') {
    Race.finished = false; UI.hideResults();
    MAIN.restartRun();
  } else if (key === 'quality') {
    UI.applyQuality();
  } else if (key === 'renderScale') {
    G.userScale = P.renderScale;
  }
};

UI.applyQuality = function () {
  const q = { low: { renderScale: 0.55, postFX: false, particles: 'low', shadows: false, adaptive: true }, med: { renderScale: 0.8, postFX: true, particles: 'med', shadows: true, adaptive: true }, high: { renderScale: 1.0, postFX: true, particles: 'high', shadows: true, adaptive: true } }[P.quality];
  if (!q) return;
  Object.assign(P, q);
  G.userScale = P.renderScale;
  UI.refresh();
  settingsSave();
};

UI.action = function (id) {
  AU.init(); AU.resume();
  switch (id) {
    case 'rebuild': MAIN.rebuildCourse(true); break;
    case 'restart': MAIN.restartRun(); break;
    case 'random': P.seed = Math.floor(Math.random() * 999999); P.preset = 'custom'; UI.refresh(); settingsSave(); MAIN.rebuildCourse(); break;
    case 'mute': AU.muted = !AU.muted; UI.toast(AU.muted ? 'Audio muted' : 'Audio on'); break;
    case 'calibrate':
      if (!Input.pad.connected) { UI.toast('No gamepad connected — connect one, press a button, then calibrate', 'err', 3400); break; }
      Input.startCalibration();
      UI.toast('Calibrating: move every stick through full range for 6 seconds…', null, 5000);
      break;
    case 'export': {
      const data = Race.exportJSON(W, P);
      const blob = new Blob([data], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'fpv-drone-' + P.env + '-' + P.seed + '.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      UI.toast('Course + best lap exported', 'good');
      break;
    }
    case 'import': document.getElementById('filein').click(); break;
    case 'shot': MAIN.screenshot(); break;
    case 'resetbest': Race.resetBest(W); UI.toast('Best lap cleared for this course'); break;
    case 'cleardata':
      try {
        const kill = [];
        for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('fpvdr.')) kill.push(k); }
        kill.forEach(k => localStorage.removeItem(k));
      } catch (e) { }
      UI.toast('All stored data cleared — reloading…');
      setTimeout(() => location.reload(), 800);
      break;
  }
};

UI.importFile = function (e) {
  const f = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!f) return;
  const rd = new FileReader();
  rd.onload = () => {
    const res = Race.importJSON(String(rd.result), W, P);
    if (res.ok) {
      UI.refresh();
      settingsSave();
      MAIN.rebuildCourse();
      UI.toast('Imported course "' + ENVS[P.env].label + '" seed ' + P.seed + (Race.best ? ' with best lap ' + Race.best.time.toFixed(2) + 's' : ''), 'good', 3600);
    } else {
      UI.toast('Import failed: ' + res.error, 'err', 4200);
      console.warn('Import rejected:', res.error);
    }
  };
  rd.onerror = () => UI.toast('Import failed: could not read file', 'err');
  rd.readAsText(f);
};

UI.togglePanel = function (force) {
  const open = force !== undefined ? force : !UI.panel.classList.contains('open');
  UI.panel.classList.toggle('open', open);
  if (open) { UI.updateStatuses(); document.getElementById('panel-body').focus; }
};
UI.toggleHelp = function (force) {
  const el = document.getElementById('help');
  UI.helpOpen = force !== undefined ? force : el.hidden;
  el.hidden = !UI.helpOpen;
};
UI.showResults = function (res) {
  const el = document.getElementById('results');
  const box = document.getElementById('results-laps');
  box.innerHTML = '';
  res.laps.forEach((t, i) => {
    const d = document.createElement('div');
    d.textContent = 'Lap ' + (i + 1) + '  ' + HUD.fmtTime(t);
    if (Race.best && Math.abs(t - Race.best.time) < 0.001) d.className = 'best';
    box.appendChild(d);
  });
  const tot = document.createElement('div');
  tot.style.marginTop = '8px';
  tot.textContent = 'Total ' + HUD.fmtTime(res.laps.reduce((a, b) => a + b, 0)) + (res.penalties ? '  ·  ' + res.penalties + ' collision penalty' : '');
  box.appendChild(tot);
  el.hidden = false;
};
UI.hideResults = function () { document.getElementById('results').hidden = true; };

UI.updateStatuses = function () {
  const pad = document.getElementById('pad-status');
  if (pad) {
    if (Input.pad.connected) {
      pad.textContent = 'Gamepad: ' + Input.pad.id.slice(0, 44) + (Input.pad.active ? ' — ACTIVE' : ' — detected (move a stick to fly)');
      pad.className = 'status';
    } else {
      pad.textContent = 'No gamepad detected — keyboard controls active (W/S/A/D + arrows)';
      pad.className = 'status off';
    }
  }
  const bs = document.getElementById('best-status');
  if (bs) bs.textContent = 'Best lap (' + W.courseKey + '): ' + (Race.best ? Race.best.time.toFixed(3) + 's · ' + Race.best.date.slice(0, 10) : 'none yet');
};
setInterval(() => { if (UI.panel.classList.contains('open')) UI.updateStatuses(); }, 700);
