/* ============================================================================
 *  Control panel, camera input (orbit / pan / zoom / touch), presets,
 *  keyboard shortcuts, persistence.
 * ========================================================================= */
const UI = { refreshers: [], qualitySel: null, modeSel: null, pauseBtn: null, timeSlider: null };

function afterParam(){ markDirty(); saveSoon(); }

/* ---------------- widget builders ---------------- */
function ctlSlider(parent, label, min, max, step, get, set, fmtFn){
  const wrap = document.createElement('div'); wrap.className = 'ctl';
  const row  = document.createElement('div'); row.className = 'ctlrow';
  const lab  = document.createElement('label'); lab.textContent = label;
  const val  = document.createElement('span'); val.className = 'val';
  row.append(lab, val);
  const inp = document.createElement('input'); inp.type = 'range';
  inp.min = min; inp.max = max; inp.step = step; inp.value = get();
  const upd = v => { val.textContent = fmtFn(v); };
  upd(get());
  inp.addEventListener('input', () => { const v = parseFloat(inp.value); set(v); upd(v); });
  wrap.append(row, inp); parent.append(wrap);
  const ref = { refresh(){ const v = get(); inp.value = v; upd(v); } };
  UI.refreshers.push(ref);
  return ref;
}
function pSlider(parent, key, label, min, max, step, fmtFn, setOverride){
  return ctlSlider(parent, label, min, max, step,
    () => P[key],
    setOverride || (v => { P[key] = v; afterParam(); }),
    fmtFn);
}
function ctlCheck(parent, label, get, set){
  const lab = document.createElement('label'); lab.className = 'chk';
  const inp = document.createElement('input'); inp.type = 'checkbox'; inp.checked = get();
  inp.addEventListener('change', () => set(inp.checked));
  const span = document.createElement('span'); span.textContent = label;
  lab.append(inp, span); parent.append(lab);
  UI.refreshers.push({ refresh(){ inp.checked = get(); } });
}
function pCheck(parent, key, label){
  return ctlCheck(parent, label, () => P[key], v => { P[key] = v; afterParam(); });
}
function ctlSelect(parent, label, options, get, set){
  const wrap = document.createElement('div'); wrap.className = 'ctl';
  const row  = document.createElement('div'); row.className = 'ctlrow';
  const lab  = document.createElement('label'); lab.textContent = label;
  row.append(lab); wrap.append(row);
  const sel = document.createElement('select'); sel.className = 'sel';
  for(const [v, txt] of options){
    const o = document.createElement('option'); o.value = v; o.textContent = txt; sel.append(o);
  }
  sel.value = get();
  sel.addEventListener('change', () => set(sel.value));
  wrap.append(sel); parent.append(wrap);
  UI.refreshers.push({ refresh(){ sel.value = get(); } });
  return sel;
}
function ctlButton(parent, label, fn){
  const b = document.createElement('button'); b.className = 'btn'; b.textContent = label;
  b.addEventListener('click', fn);
  parent.append(b);
  return b;
}
function btnRow(parent){ const r = document.createElement('div'); r.className = 'btnrow'; parent.append(r); return r; }
function ctlNote(parent, html){ const n = document.createElement('div'); n.className = 'note'; n.innerHTML = html; parent.append(n); return n; }

/* ---------------- quality presets ---------------- */
function applyQuality(name){
  const q = QUALITY[name];
  if(q){ P.scale = q.scale; P.maxSteps = q.maxSteps; P.accumMax = q.accumMax; P.bloom = q.bloom; }
  P.quality = name;
  UI.refreshers.forEach(f => f.refresh());
  markDirty(); saveSoon();
}
function setQualityCustom(){ if(P.quality !== 'custom'){ P.quality = 'custom'; UI.refreshQualitySel(); } }
UI.refreshQualitySel = () => UI.refreshers.forEach(f => f.refresh());

/* ---------------- build the panel ---------------- */
function buildUI(){
  /* -- Simulation -- */
  const bA = $('bodyActions');
  const row1 = btnRow(bA);
  UI.pauseBtn = ctlButton(row1, '⏸ Pause (Space)', togglePause);
  ctlButton(row1, '⟲ Reset camera', () => applyCamPreset(0));
  const row2 = btnRow(bA);
  UI.timeSlider = ctlSlider(bA, 'Simulation time (s)', 0, 600, 0.5,
    () => R.simTime, v => { R.simTime = v; markDirty(); }, v => fmt(v, 1) + ' s');
  pSlider(bA, 'timeScale', 'Time speed ×', 0, 5, 0.05, v => fmt(v, 2) + '×');
  const row3 = btnRow(bA);
  ctlButton(row3, '⬇ Screenshot PNG', takeScreenshot);
  ctlButton(row3, '✖ Reset all', resetAll);

  /* -- Camera -- */
  const bC = $('bodyCam');
  pSlider(bC, 'fov', 'Field of view (°)', 25, 110, 1, v => fmt(v, 0) + '°');
  pCheck(bC, 'autoOrbit', 'Auto-orbit (slow cinematic drift)');
  ctlNote(bC, 'Left-drag orbits, wheel zooms, right-drag (or Shift-drag) pans. Two-finger pinch works on touch. All lensing is recomputed per frame.');

  /* -- Black hole -- */
  const bB = $('bodyBH');
  const bhSet = key => v => { P[key] = v; updBHNote(); afterParam(); };
  pSlider(bB, 'rs', 'Mass · lensing strength (rs)', 0.4, 2.5, 0.01, v => fmt(v, 2) + ' rs', bhSet('rs'));
  pSlider(bB, 'spin', 'Spin a/M (approximation)', -0.998, 0.998, 0.002, v => fmt(v, 3), bhSet('spin'));
  pSlider(bB, 'horizonK', 'Event horizon size ×', 0.4, 2.0, 0.01, v => fmt(v, 2) + '×', bhSet('horizonK'));
  UI.bhNote = ctlNote(bB, '');
  window.updBHNote = () => {
    UI.bhNote.innerHTML =
      'horizon r<sub>H</sub> = ' + fmt(horR()/P.rs, 3) + ' rs · ' +
      'photon orbit = ' + fmt(photonR()/P.rs, 3) + ' rs · ' +
      'ISCO = ' + fmt(iscoR(), 3) + ' rs (prograde, equatorial markers).<br>' +
      'Spin shifts horizon/ISCO/Doppler direction; ray bending uses the Schwarzschild term.';
  };
  updBHNote();

  /* -- Accretion disk -- */
  const bD = $('bodyDisk');
  pSlider(bD, 'diskIn', 'Disk inner radius (rs)', 1.2, 8, 0.05, v => fmt(v, 2));
  pSlider(bD, 'diskOut', 'Disk outer radius (rs)', 4, 30, 0.1, v => fmt(v, 1));
  pSlider(bD, 'diskH', 'Disk thickness (rs)', 0.02, 1.2, 0.01, v => fmt(v, 2));
  pSlider(bD, 'incl', 'Disk inclination (°)', -80, 80, 1, v => fmt(v, 0) + '°');
  pSlider(bD, 'temp', 'Disk temperature (K)', 2000, 20000, 100, v => fmt(v, 0) + ' K');
  pSlider(bD, 'turb', 'Turbulence', 0, 1, 0.01, v => fmt(v, 2));

  /* -- Relativistic effects -- */
  const bR = $('bodyRel');
  pSlider(bR, 'dopK', 'Doppler beaming strength', 0, 1, 0.01, v => fmt(v, 2));
  pSlider(bR, 'redK', 'Redshift strength', 0, 1, 0.01, v => fmt(v, 2));
  ctlNote(bR, 'Approaching side is beamed brighter and blueshifted (I ∝ δ³ᵏ, T ∝ δ); gravity redshifts and dims emission near the horizon (T, I ∝ g).');

  /* -- Rendering -- */
  const bQ = $('bodyRender');
  pSlider(bQ, 'exposure', 'Exposure', 0.2, 4, 0.05, v => fmt(v, 2));
  pSlider(bQ, 'contrast', 'Contrast', 0.6, 1.6, 0.01, v => fmt(v, 2));
  pSlider(bQ, 'bloom', 'Bloom', 0, 2, 0.05, v => fmt(v, 2));
  pSlider(bQ, 'stepMul', 'Ray step size ×', 0.25, 3, 0.05, v => fmt(v, 2));
  pSlider(bQ, 'maxSteps', 'Max integration steps', 64, 2048, 16, v => fmt(v, 0));
  pSlider(bQ, 'scale', 'Render resolution ×', 0.25, 1.5, 0.05,
    v => fmt(v, 2), v => { P.scale = v; setQualityCustom(); afterParam(); });
  pSlider(bQ, 'accumMax', 'Temporal accumulation (frames)', 1, 96, 1,
    v => fmt(v, 0) + ' fr', v => { P.accumMax = Math.round(v); setQualityCustom(); afterParam(); });
  UI.qualitySel = ctlSelect(bQ, 'Quality level',
    [['low','Low (fast)'], ['medium','Medium'], ['high','High'], ['ultra','Ultra'], ['auto','Auto (adaptive)'], ['custom','Custom']],
    () => P.quality, v => applyQuality(v));

  /* -- Visualization -- */
  const bV = $('bodyViz');
  UI.modeSel = ctlSelect(bV, 'Visualization mode',
    MODES.map((m, i) => [String(i), (i+1) + ' · ' + m]),
    () => String(R.mode), v => setMode(parseInt(v)));
  ctlCheck(bV, 'Overlay: event horizon', () => OV.hor, v => { OV.hor = v; });
  ctlCheck(bV, 'Overlay: photon sphere', () => OV.phot, v => { OV.phot = v; });
  ctlCheck(bV, 'Overlay: disk plane', () => OV.disk, v => { OV.disk = v; });
  ctlCheck(bV, 'Overlay: selected ray path', () => OV.ray, v => { OV.ray = v; });
  ctlCheck(bV, 'Overlay: shadow edge (2.6 rs)', () => OV.shadow, v => { OV.shadow = v; });
  ctlNote(bV, 'Click or tap the image to select a ray — its trajectory, a schematic diagram and its integration values appear bottom-left.');

  /* -- Presets -- */
  const bP = $('bodyPresets');
  const rowP = btnRow(bP);
  PRESETS.forEach((p, i) => ctlButton(rowP, p[0], () => applyCamPreset(i)));

  if(window.innerWidth < 700){
    $('panel').classList.add('collapsed');
    $('panelTog').textContent = 'open';
  } else {
    $('panelTog').textContent = 'hide';
  }
  $('panelHead').addEventListener('click', () => {
    const p = $('panel');
    p.classList.toggle('collapsed');
    $('panelTog').textContent = p.classList.contains('collapsed') ? 'open' : 'hide';
  });
}

/* ---------------- camera presets ---------------- */
const PRESETS = [
  ['Interstellar', 190, 5, 17.0],
  ['Overhead ¾',   152, 36, 19],
  ['Top-down',     120, 84, 20],
  ['Edge-on',      200, 1,  15],
  ['Photon skim',  232, 10, 4.6],
  ['Wide field',   165, 24, 34],
];
function applyCamPreset(i){
  const p = PRESETS[i];
  let toYaw = deg2rad(p[1]);
  const cur = ((cam.yaw % TAU) + TAU) % TAU, tgt = ((toYaw % TAU) + TAU) % TAU;
  let d = tgt - cur;
  if(d > Math.PI) d -= TAU;
  if(d < -Math.PI) d += TAU;
  cam.anim = {
    t0: performance.now(), dur: 1500,
    from: { yaw: cam.yaw, pitch: cam.pitch, dist: cam.dist, target: cam.target.slice() },
    to:   { yaw: cam.yaw + d, pitch: deg2rad(p[2]), dist: p[3]*P.rs, target: [0,0,0] },
  };
  cam.vyaw = cam.vpitch = 0;
}

/* ---------------- pause / mode ---------------- */
function togglePause(){
  R.paused = !R.paused;
  UI.pauseBtn.textContent = R.paused ? '▶ Resume (Space)' : '⏸ Pause (Space)';
  UI.pauseBtn.classList.toggle('on', R.paused);
}
function setMode(m){
  R.mode = clamp(m|0, 0, MODES.length-1);
  $('hudLegend').innerHTML = LEGENDS[R.mode] ? ('<b>' + MODES[R.mode] + '</b><br>' + LEGENDS[R.mode]) : '';
  if(UI.modeSel) UI.modeSel.value = String(R.mode);
  markDirty();
}

/* ---------------- screenshot ---------------- */
function takeScreenshot(){
  try {
    const a = document.createElement('a');
    a.download = 'black-hole-' + Date.now() + '.png';
    a.href = $('gl').toDataURL('image/png');
    a.click();
  } catch(e){ console.warn('screenshot failed', e); }
}

/* ---------------- persistence ---------------- */
let saveT = 0;
function saveSoon(){ clearTimeout(saveT); saveT = setTimeout(saveState, 400); }
function saveState(){
  try {
    localStorage.setItem('bh-explorer-v2', JSON.stringify({
      P, mode: R.mode,
      cam: { yaw: cam.yaw, pitch: cam.pitch, dist: cam.dist, target: cam.target },
    }));
  } catch(e){}
}
function loadState(){
  try {
    const s = JSON.parse(localStorage.getItem('bh-explorer-v2') || 'null');
    if(s && s.P){
      Object.assign(P, s.P);
      if(s.cam){ cam.yaw = s.cam.yaw; cam.pitch = s.cam.pitch; cam.dist = s.cam.dist; cam.target = s.cam.target; }
      R.mode = clamp(s.mode|0, 0, MODES.length-1);
      return true;
    }
  } catch(e){}
  return false;
}
function resetAll(){
  try { localStorage.removeItem('bh-explorer-v2'); } catch(e){}
  Object.assign(P, {
    fov:60, timeScale:1, autoOrbit:true, rs:1.0, spin:0.6, horizonK:1.0,
    diskIn:3.0, diskOut:13.0, diskH:0.18, incl:0, temp:9200, turb:0.62,
    dopK:0.75, redK:1.0, exposure:1.3, contrast:1.06, bloom:0.6,
    stepMul:1.0, maxSteps:480, scale:0.78, quality:'high', accumMax:32,
  });
  cam.yaw = deg2rad(190); cam.pitch = deg2rad(5); cam.dist = 17; cam.target = [0,0,0];
  R.simTime = 47; R.sel = null; $('rayPanel').classList.remove('show');
  if(R.softwareGL){
    P.scale = Math.min(P.scale, 0.32);
    P.maxSteps = Math.min(P.maxSteps, 128);
    P.accumMax = Math.min(P.accumMax, 2);
  }
  updBHNote(); setMode(0);
  UI.refreshers.forEach(f => f.refresh());
  markDirty();
}

/* ---------------- pointer / wheel / keyboard input ---------------- */
function initInput(){
  const cv = $('gl');
  const pointers = new Map();
  let dragMode = null, downX = 0, downY = 0, downT = 0, moved = 0, pinchD = 0;

  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('pointerdown', e => {
    try { cv.setPointerCapture(e.pointerId); } catch(err){}
    pointers.set(e.pointerId, { x:e.clientX, y:e.clientY });
    R.pointerCount = pointers.size;
    if(pointers.size === 1){
      dragMode = (e.button === 2 || e.button === 1 || e.shiftKey || e.ctrlKey) ? 'pan' : 'orbit';
      downX = e.clientX; downY = e.clientY; downT = performance.now(); moved = 0;
      cam.vyaw = cam.vpitch = 0;
    } else if(pointers.size === 2){
      const pts = [...pointers.values()];
      pinchD = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      dragMode = 'pinch';
    }
  });
  cv.addEventListener('pointermove', e => {
    if(!pointers.has(e.pointerId)) return;
    const prev = pointers.get(e.pointerId);
    const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
    pointers.set(e.pointerId, { x:e.clientX, y:e.clientY });
    moved += Math.abs(dx) + Math.abs(dy);
    const s = 0.0052*(P.fov/60);
    if(dragMode === 'orbit'){
      cam.yaw   -= dx*s;
      cam.pitch  = clamp(cam.pitch + dy*s, -1.55, 1.55);
      cam.vyaw = -dx*s; cam.vpitch = dy*s;
      cam.anim = null; markDirty();
    } else if(dragMode === 'pan'){
      const b = camBasis();
      const k = cam.dist*0.0012;
      cam.target = v3.add(cam.target, v3.add(v3.scale(b.right, -dx*k), v3.scale(b.up, dy*k)));
      const tl = v3.len(cam.target);
      if(tl > 12) cam.target = v3.scale(cam.target, 12/tl);
      markDirty();
    } else if(dragMode === 'pinch' && pointers.size === 2){
      const pts = [...pointers.values()];
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if(pinchD > 0) cam.dist = clamp(cam.dist*pinchD/Math.max(d, 4), 1.05*horR(), 300);
      pinchD = d;
      markDirty();
    }
  });
  const endPointer = e => {
    pointers.delete(e.pointerId);
    R.pointerCount = pointers.size;
    if(pointers.size === 0){
      if(dragMode === 'orbit' && moved < 6 && performance.now()-downT < 600){
        R.sel = { x:e.clientX, y:e.clientY };   // click / tap → select ray
        $('rayPanel').classList.add('show');
        markDirty();
      }
      dragMode = null;
    }
  };
  cv.addEventListener('pointerup', endPointer);
  cv.addEventListener('pointercancel', endPointer);
  cv.addEventListener('wheel', e => {
    e.preventDefault();
    cam.dist = clamp(cam.dist*Math.exp(e.deltaY*0.0011), 1.05*horR(), 300);
    cam.anim = null;
    markDirty();
  }, { passive:false });

  window.addEventListener('keydown', e => {
    if(e.target && /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
    if(e.code === 'Space'){ e.preventDefault(); togglePause(); }
    else if(e.key >= '1' && e.key <= '7') setMode(parseInt(e.key)-1);
    else if(e.key === 'h' || e.key === 'H'){ R.uiHidden = !R.uiHidden; document.body.classList.toggle('uihidden', R.uiHidden); }
    else if(e.key === 'r' || e.key === 'R') applyCamPreset(0);
    else if(e.key === 'p' || e.key === 'P') $('panelHead').click();
    else if(e.key === 'o' || e.key === 'O'){ P.autoOrbit = !P.autoOrbit; UI.refreshers.forEach(f => f.refresh()); }
    else if(e.key === 'ArrowLeft'){ cam.yaw += 0.05; markDirty(); }
    else if(e.key === 'ArrowRight'){ cam.yaw -= 0.05; markDirty(); }
    else if(e.key === 'ArrowUp'){ cam.pitch = clamp(cam.pitch + 0.04, -1.55, 1.55); markDirty(); }
    else if(e.key === 'ArrowDown'){ cam.pitch = clamp(cam.pitch - 0.04, -1.55, 1.55); markDirty(); }
  });
}
