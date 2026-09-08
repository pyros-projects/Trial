
/* ============================================================
   Interaction (pointer, touch, keyboard)
   ============================================================ */
const Interact = {
  mode: 'idle', // idle | pan | dragBody | dragVel | dragNode | placeNode | pinch
  ptrs: new Map(),
  lastPan: null,
  pinchDist: 0,
  selNode: null,
  velArrowScale: 0.8,

  init() {
    const cv = el('cv');
    cv.style.touchAction = 'none';
    cv.addEventListener('pointerdown', e => this.onDown(e));
    window.addEventListener('pointermove', e => this.onMove(e));
    window.addEventListener('pointerup', e => this.onUp(e));
    window.addEventListener('pointercancel', e => this.onUp(e));
    cv.addEventListener('wheel', e => this.onWheel(e), { passive: false });
    window.addEventListener('keydown', e => this.onKey(e));
  },
  canvasPos(e) {
    const r = el('cv').getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  },
  hitBody(sx, sy) {
    let best = -1, bd = 1e9;
    for (let b = 0; b < Sim.n; b++) {
      if (!Sim.alive[b]) continue;
      const p = Render.bodyScreen(b);
      const r = Math.max(Render.drawRadius(b) + 5, 11);
      const d = hyp(sx - p.sx, sy - p.sy);
      if (d < r && d < bd) { bd = d; best = b; }
    }
    return best;
  },
  hitVelHandle(sx, sy) {
    const b = Sel.idx;
    if (b < 0 || !Sim.craft[b] || !Sim.alive[b]) return false;
    const p = Render.bodyScreen(b);
    const vpx = Frames.vpx(b), vpy = Frames.vpy(b);
    const v = hyp(vpx, vpy);
    if (v < 1e-9) return false;
    const len = clamp(v * Cam.zoom * this.velArrowScale, 30, 260);
    const tx = p.sx + (vpx / v) * len, ty = p.sy - (vpy / v) * len;
    return hyp(sx - tx, sy - ty) < 14;
  },
  hitNodeMarker(sx, sy) {
    for (const nd of Nodes.list) {
      if (nd.executed) continue;
      const path = Predict.pathFor(nd.craftIdx);
      if (!path) continue;
      let best = 0, bd = Infinity;
      for (let k = 0; k < path.rows.length; k++) {
        const d = Math.abs(path.rows[k].t - nd.t);
        if (d < bd) { bd = d; best = k; }
      }
      const row = path.rows[best];
      const fx = Frames.rowX(row, nd.craftIdx), fy = Frames.rowY(row, nd.craftIdx);
      if (hyp(sx - Cam.screenX(fx), sy - Cam.screenY(fy)) < 10) return nd.id;
    }
    return null;
  },
  onDown(e) {
    el('cv').setPointerCapture(e.pointerId);
    const p = this.canvasPos(e);
    this.ptrs.set(e.pointerId, p);
    if (this.ptrs.size === 2) {
      const pts = [...this.ptrs.values()];
      this.pinchDist = hyp(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      this.mode = 'pinch';
      return;
    }
    if (this.mode === 'placeNode') {
      this.placeNodeAt(p.x, p.y);
      this.mode = 'idle';
      UI.setPlaceMode(false);
      return;
    }
    // node marker?
    const nid = this.hitNodeMarker(p.x, p.y);
    if (nid !== null) {
      this.selNode = nid;
      this.mode = 'dragNode';
      UI.refreshNodeEditor();
      return;
    }
    // velocity handle first (it sits away from the body)
    if (P.paused && Sel.idx >= 0 && Sim.craft[Sel.idx] && this.hitVelHandle(p.x, p.y)) {
      this.mode = 'dragVel';
      return;
    }
    const body = this.hitBody(p.x, p.y);
    if (body >= 0 && body !== Sel.idx) {
      Sel.select(body);
      // fall through: also allow dragging if paused & craft
    }
    if (P.paused && body === Sel.idx && Sim.craft[body]) {
      this.mode = 'dragBody';
      return;
    }
    this.mode = 'pan';
    this.lastPan = p;
  },
  onMove(e) {
    if (!this.ptrs.has(e.pointerId)) return;
    const p = this.canvasPos(e);
    this.ptrs.set(e.pointerId, p);
    if (this.mode === 'pinch' && this.ptrs.size === 2) {
      const pts = [...this.ptrs.values()];
      const d = hyp(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (this.pinchDist > 0 && d > 0) {
        const f = d / this.pinchDist;
        Cam.zoom = clamp(Cam.zoom * f, 1e-4, 5e5);
        this.pinchDist = d;
      }
      return;
    }
    if (this.mode === 'pan' && this.lastPan) {
      Cam.cx -= (p.x - this.lastPan.x) / Cam.zoom;
      Cam.cy += (p.y - this.lastPan.y) / Cam.zoom;
      Cam.followIdx = -1;
      this.lastPan = p;
      return;
    }
    if (this.mode === 'dragBody' && Sel.idx >= 0) {
      const w = Cam.worldFromScreen(p.x, p.y);
      Sim.x[Sel.idx] = Render.unframeX(w.x, w.y);
      Sim.y[Sel.idx] = Render.unframeY(w.x, w.y);
      Sim.computeAccel();
      Predict.dirty = true;
      UI.refreshSelection(true);
      return;
    }
    if (this.mode === 'dragVel' && Sel.idx >= 0) {
      const w = Cam.worldFromScreen(p.x, p.y);
      const cfx = Frames.px(Sim.x[Sel.idx], Sim.y[Sel.idx]);
      const cfy = Frames.py(Sim.x[Sel.idx], Sim.y[Sel.idx]);
      // arrow tip -> frame-space velocity (frame units, zoom-independent)
      const newFrameV = { x: (w.x - cfx) / this.velArrowScale, y: (w.y - cfy) / this.velArrowScale };
      const oldFrameV = { x: Frames.vpx(Sel.idx), y: Frames.vpy(Sel.idx) };
      const d = this.frameDeltaToWorld(newFrameV.x - oldFrameV.x, newFrameV.y - oldFrameV.y);
      Sim.vx[Sel.idx] += d.x; Sim.vy[Sel.idx] += d.y;
      Sim.computeAccel();
      Predict.dirty = true;
      UI.refreshSelection(true);
      return;
    }
    if (this.mode === 'dragNode' && this.selNode !== null) {
      const nd = Nodes.list.find(n => n.id === this.selNode);
      if (nd) {
        const t = this.pickTimeOnPath(nd.craftIdx, p.x, p.y);
        if (t !== null && t > Sim.t + P.dt * 2) nd.t = t;
        Predict.dirty = true;
        UI.refreshNodeEditor(true);
      }
    }
  },
  frameDeltaToWorld(dx, dy) {
    if (Frames.mode === 'inertial') return { x: dx, y: dy };
    if (Frames.mode === 'body') return { x: dx, y: dy };
    const cos = Math.cos(Frames.theta), sin = Math.sin(Frames.theta);
    return { x: dx * cos - dy * sin, y: dx * sin + dy * cos };
  },
  onUp(e) {
    this.ptrs.delete(e.pointerId);
    if (this.mode === 'pinch' && this.ptrs.size < 2) this.mode = 'idle';
    else this.mode = 'idle';
    this.lastPan = null;
  },
  onWheel(e) {
    e.preventDefault();
    const p = this.canvasPos(e);
    const f = Math.exp(-e.deltaY * 0.0012);
    // zoom about cursor: keep frame-space point under cursor fixed
    const before = Cam.worldFromScreen(p.x, p.y);
    Cam.zoom = clamp(Cam.zoom * f, 1e-4, 5e5);
    const after = Cam.worldFromScreen(p.x, p.y);
    Cam.cx += before.x - after.x;
    Cam.cy += before.y - after.y;
  },
  onKey(e) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA')) return;
    switch (e.key) {
      case ' ': e.preventDefault(); UI.togglePause(); break;
      case '.': UI.singleStep(); break;
      case 'r': case 'R': UI.restart(); break;
      case 'c': case 'C': Checkpoints.saveManual(); break;
      case 'v': case 'V': Checkpoints.rewind(); break;
      case 'f': case 'F': UI.toggleFollow(); break;
      case 'n': case 'N': UI.enterPlaceMode(); break;
      case '1': UI.setFrame('inertial'); break;
      case '2': UI.setFrame('body'); break;
      case '3': UI.setFrame('rot'); break;
      case '+': case '=': UI.nudgeWarp(2); break;
      case '-': UI.nudgeWarp(0.5); break;
      case 'Escape': if (Interact.mode === 'placeNode') { Interact.mode = 'idle'; UI.setPlaceMode(false); } break;
    }
  },
  placeNodeAt(sx, sy) {
    const ci = Sel.craftIdx();
    if (ci < 0) { Sim.logEvent('Select a spacecraft first', 'warn'); return; }
    const path = Predict.pathFor(ci);
    let t = null;
    if (path && path.rows.length > 1) {
      t = this.pickTimeOnPath(ci, sx, sy, 22);
    }
    if (t === null) t = Sim.t + Math.max(1, (path?.dtP ?? 0.05) * 20);
    const nd = Nodes.add(ci, t);
    this.selNode = nd.id;
    Predict.dirty = true;
    Predict.run(true);
    UI.refreshNodeEditor();
    Sim.logEvent(`Node added: ${Sim.names[ci]} at ${fmtTimeShort(t - Sim.t)}`, 'ok');
  },
  pickTimeOnPath(ci, sx, sy, maxPx = 16) {
    const path = Predict.pathFor(ci);
    if (!path || path.rows.length < 2) return null;
    let bd = maxPx, bt = null;
    for (let k = 0; k < path.rows.length; k++) {
      const row = path.rows[k];
      const fx = Frames.rowX(row, ci), fy = Frames.rowY(row, ci);
      const d = hyp(sx - Cam.screenX(fx), sy - Cam.screenY(fy));
      if (d < bd) { bd = d; bt = row.t; }
    }
    return bt;
  },
};

/* ============================================================
   UI
   ============================================================ */
const UI = {
  placeMode: false,
  eventTimer: null,
  init() {
    // scenario select
    const sel = el('scenarioSel');
    Scenarios.forEach((sc, i) => {
      const o = document.createElement('option');
      o.value = i; o.textContent = sc.name;
      sel.appendChild(o);
    });
    sel.addEventListener('change', () => { this.loadScenarioIdx(+sel.value); });
    // top buttons
    el('btnAddCraft').addEventListener('click', () => this.addCraft());
    el('btnPlaceNode').addEventListener('click', () => this.enterPlaceMode());
    el('btnHelp').addEventListener('click', () => el('helpCard').classList.toggle('hidden'));
    el('btnCloseHelp').addEventListener('click', () => el('helpCard').classList.add('hidden'));
    el('btnDrawerL').addEventListener('click', () => this.toggleDrawer('leftPanel', 'rightPanel'));
    el('btnDrawerR').addEventListener('click', () => this.toggleDrawer('rightPanel', 'leftPanel'));
    el('scrim').addEventListener('click', () => { el('leftPanel').classList.remove('open'); el('rightPanel').classList.remove('open'); el('scrim').classList.remove('show'); });
    // time controls
    el('btnPlay').addEventListener('click', () => this.togglePause());
    el('btnStep').addEventListener('click', () => this.singleStep());
    el('btnRestart').addEventListener('click', () => this.restart());
    el('btnRewind').addEventListener('click', () => { Checkpoints.rewind(); this.syncAll(); });
    el('btnCkpt').addEventListener('click', () => Checkpoints.saveManual());
    el('tbPlay').addEventListener('click', () => this.togglePause());
    el('tbStep').addEventListener('click', () => this.singleStep());
    el('tbRestart').addEventListener('click', () => this.restart());
    el('tbRewind').addEventListener('click', () => { Checkpoints.rewind(); this.syncAll(); });
    el('tbWarpDown').addEventListener('click', () => this.nudgeWarp(0.5));
    el('tbWarpUp').addEventListener('click', () => this.nudgeWarp(2));
    el('tbFrame').addEventListener('click', () => {
      const order = ['inertial', 'body', 'rot'];
      const next = order[(order.indexOf(P.frameMode) + 1) % 3];
      this.setFrame(next);
    });
    // warp slider (log 0.02 .. 200)
    this.bindLogSlider('warp', 'warpVal', 0.02, 200, v => { P.warp = v; }, v => `${fmtNum(v, 3)} u/s  (×${fmtNum(v / sc0warp(), 2)} base)`);
    // dt slider (log 1e-5 .. 5e-2)
    this.bindLogSlider('dt', 'dtVal', 1e-5, 5e-2, v => { P.dt = v; }, v => `${v.toExponential(1)} u`);
    // G slider (log 0.05 .. 20)
    this.bindLogSlider('G', 'GVal', 0.05, 20, v => { Sim.G = v; Sim.rebaseline(); Predict.dirty = true; }, v => fmtNum(v, 4));
    // integrator select
    el('intSel').addEventListener('change', e => {
      P.integrator = e.target.value;
      el('tolRow').style.display = P.integrator === 'dp54' ? '' : 'none';
      Sim.dpDt = P.dt;
    });
    el('tolInput').addEventListener('change', e => { P.tol = Math.max(1e-12, +e.target.value || 1e-8); });
    // collision select
    el('collSel').addEventListener('change', e => { P.collisions = e.target.value; });
    // prediction
    this.bindLogSlider('horizon', 'horizonVal', 1, 1000, v => { P.predHorizon = v; Predict.dirty = true; }, v => `${fmtNum(v, 3)} u`);
    const resIn = el('resInput');
    resIn.addEventListener('change', () => { P.predRes = clamp(+resIn.value | 0, 50, 20000); resIn.value = P.predRes; Predict.dirty = true; });
    // trails
    this.bindLogSlider('trail', 'trailVal', 0.5, 2000, v => { P.trailWindow = v; }, v => `${fmtNum(v, 3)} u`);
    // body scale
    this.bindLogSlider('bodyScale', 'bodyScaleVal', 0.1, 20, v => { P.bodyScale = v; }, v => `×${fmtNum(v, 3)}`);
    // view toggles
    const toggles = [
      ['tglTrails', 'showTrails'], ['tglPred', 'showPred'], ['tglVel', 'showVel'], ['tglAcc', 'showAcc'],
      ['tglOrbit', 'showOrbit'], ['tglSOI', 'showSOI'], ['tglPot', 'showPotential'],
      ['tglEnc', 'showEncounters'], ['tglErr', 'showErrorGraph'], ['tglLabels', 'showLabels'],
    ];
    for (const [id, key] of toggles) {
      const cb = el(id);
      cb.addEventListener('change', () => { P[key] = cb.checked; });
    }
    // frame segmented control
    for (const btn of document.querySelectorAll('#frameSeg button')) {
      btn.addEventListener('click', () => this.setFrame(btn.dataset.mode));
    }
    el('frameCenterSel').addEventListener('change', e => { P.frameCenter = +e.target.value; Frames.update(); });
    el('framePartnerSel').addEventListener('change', e => { P.framePartner = +e.target.value; Frames.update(); });
    // body editors
    el('bMass').addEventListener('change', () => this.applyBodyEdit());
    el('bRadius').addEventListener('change', () => this.applyBodyEdit());
    for (const id of ['bX', 'bY', 'bVx', 'bVy']) el(id).addEventListener('change', () => this.applyBodyEdit());
    el('btnFollow').addEventListener('click', () => this.toggleFollow());
    el('btnFocus').addEventListener('click', () => {
      if (Sel.idx >= 0) { const p = Render.bodyScreen(Sel.idx); Cam.cx = p.fx; Cam.cy = p.fy; }
    });
    el('btnDelCraft').addEventListener('click', () => this.deleteCraft());
    // node editor
    el('ndT').addEventListener('change', () => this.applyNodeEdit());
    el('ndPro').addEventListener('input', () => { this.applyNodeEdit(true); });
    el('ndRad').addEventListener('input', () => { this.applyNodeEdit(true); });
    el('ndDvx').addEventListener('change', () => { this.applyNodeEdit(true, true); });
    el('ndDvy').addEventListener('change', () => { this.applyNodeEdit(true, true); });
    el('ndFlip').addEventListener('click', () => {
      const nd = this.selNodeObj(); if (!nd) return;
      nd.pro = -nd.pro; nd.rad = -nd.rad;
      el('ndPro').value = nd.pro; el('ndRad').value = nd.rad;
      Predict.dirty = true; Predict.run(true); this.refreshNodeEditor();
    });
    el('ndDelete').addEventListener('click', () => {
      if (Interact.selNode !== null) { Nodes.remove(Interact.selNode); Interact.selNode = null; Predict.dirty = true; Predict.run(true); this.refreshNodeEditor(); }
    });
    el('nodeList').addEventListener('click', e => {
      const item = e.target.closest('[data-node]');
      if (item) { Interact.selNode = +item.dataset.node; this.refreshNodeEditor(); }
    });
    this.syncAll();
  },
  bindLogSlider(id, valId, mn, mx, setter, fmtV) {
    const s = el(id), vEl = el(valId);
    s.min = 0; s.max = 1000; s.step = 1;
    s.addEventListener('input', () => {
      const v = sliderToVal(+s.value, mn, mx);
      setter(v);
      vEl.textContent = fmtV(v);
    });
    s._sync = (v) => { s.value = clamp(valToSlider(v, mn, mx), 0, 1000); vEl.textContent = fmtV(v); };
  },
  toggleDrawer(a, b) {
    el(b).classList.remove('open');
    el(a).classList.toggle('open');
    el('scrim').classList.toggle('show', el(a).classList.contains('open'));
  },
  loadScenarioIdx(i) {
    loadScenario(Scenarios[i]);
    this.syncAll();
    this.refreshSelection();
    this.refreshNodeEditor();
    Predict.run(true);
    Sim.logEvent(`Scenario loaded: ${Scenarios[i].name}`, 'ok');
  },
  syncAll() {
    el('warp')._sync(P.warp);
    el('dt')._sync(P.dt);
    el('G')._sync(Sim.G);
    el('horizon')._sync(P.predHorizon);
    el('trail')._sync(P.trailWindow);
    el('bodyScale')._sync(P.bodyScale);
    el('resInput').value = P.predRes;
    el('intSel').value = P.integrator;
    el('tolRow').style.display = P.integrator === 'dp54' ? '' : 'none';
    el('tolInput').value = P.tol;
    el('collSel').value = P.collisions;
    for (const [id, key] of [['tglTrails', 'showTrails'], ['tglPred', 'showPred'], ['tglVel', 'showVel'], ['tglAcc', 'showAcc'], ['tglOrbit', 'showOrbit'], ['tglSOI', 'showSOI'], ['tglPot', 'showPotential'], ['tglEnc', 'showEncounters'], ['tglErr', 'showErrorGraph'], ['tglLabels', 'showLabels']]) el(id).checked = P[key];
    // frame selects
    const opts = [];
    for (let i = 0; i < Sim.n; i++) opts.push(`<option value="${i}">${Sim.names[i]}</option>`);
    el('frameCenterSel').innerHTML = opts.join('');
    el('framePartnerSel').innerHTML = opts.join('');
    el('frameCenterSel').value = String(P.frameCenter);
    el('framePartnerSel').value = String(P.framePartner);
    this.setFrame(P.frameMode, true);
    this.updatePlayBtn();
  },
  setFrame(mode, silent) {
    P.frameMode = mode;
    if (mode === 'body' && (P.frameCenter < 0 || !Sim.alive[P.frameCenter])) P.frameCenter = Sel.idx >= 0 ? Sel.idx : 0;
    Frames.update();
    for (const btn of document.querySelectorAll('#frameSeg button')) btn.classList.toggle('active', btn.dataset.mode === mode);
    el('frameCenterRow').style.display = mode === 'body' ? '' : 'none';
    el('framePartnerRow').style.display = mode === 'rot' ? '' : 'none';
    el('tbFrame').textContent = mode === 'inertial' ? 'Frame: Inertial' : (mode === 'body' ? `Frame: ${Sim.names[P.frameCenter]}` : 'Frame: Rotating');
    if (!silent) Predict.dirty = true;
  },
  updatePlayBtn() {
    el('btnPlay').textContent = P.paused ? '▶' : '⏸';
    el('tbPlay').textContent = P.paused ? '▶' : '⏸';
    el('btnPlay').title = P.paused ? 'Run (Space)' : 'Pause (Space)';
  },
  togglePause() { P.paused = !P.paused; this.updatePlayBtn(); },
  singleStep() {
    P.paused = true; this.updatePlayBtn();
    const h0 = Sim.t;
    Sim.stepOnce();
    Hist.maybeSample(Sim.t - h0);
    Stats.sample(Sim.t - h0);
    Predict.dirty = true;
  },
  restart() {
    const idx = el('scenarioSel').value | 0;
    this.loadScenarioIdx(idx);
  },
  nudgeWarp(f) {
    P.warp = clamp(P.warp * f, 0.02, 200);
    el('warp')._sync(P.warp);
  },
  toggleFollow() {
    if (Sel.idx < 0) return;
    Cam.followIdx = Cam.followIdx === Sel.idx ? -1 : Sel.idx;
    Sim.logEvent(Cam.followIdx >= 0 ? `Camera following ${Sim.names[Sel.idx]}` : 'Camera free', 'ok');
  },
  setPlaceMode(on) {
    this.placeMode = on;
    Interact.mode = on ? 'placeNode' : 'idle';
    el('btnPlaceNode').classList.toggle('active', on);
    el('cv').style.cursor = on ? 'crosshair' : 'default';
  },
  enterPlaceMode() {
    if (Sel.craftIdx() < 0) {
      for (let i = 0; i < Sim.n; i++) if (Sim.craft[i] && Sim.alive[i]) { Sel.select(i); break; }
    }
    if (Sel.craftIdx() < 0) { Sim.logEvent('No spacecraft in scenario — add one first', 'warn'); return; }
    this.setPlaceMode(true);
  },
  addCraft() {
    // place at frame-space viewport center, circular orbit around dominant attractor
    const w = Cam.worldFromScreen(Render.w / 2, Render.h / 2);
    let wx = Render.unframeX(w.x, w.y), wy = Render.unframeY(w.x, w.y);
    // find dominant attractor near that point
    let best = -1, ba = -1;
    for (let j = 0; j < Sim.n; j++) {
      if (!Sim.alive[j] || Sim.craft[j]) continue;
      const dx = Sim.x[j] - wx, dy = Sim.y[j] - wy;
      const a = Sim.m[j] / Math.max(dx * dx + dy * dy, 1e-9);
      if (a > ba) { ba = a; best = j; }
    }
    let vx = 0, vy = 0;
    if (best >= 0) {
      const mu = Sim.G * Sim.m[best];
      const dx = wx - Sim.x[best], dy = wy - Sim.y[best];
      let d = Math.max(hyp(dx, dy), Sim.r[best] * 1.5);
      // keep the inserted orbit dynamically sensible: stay well inside the primary's SOI
      const prim = primaryOf(best);
      if (prim >= 0 && Sim.m[prim] > Sim.m[best]) {
        const dPrim = hyp(Sim.x[prim] - Sim.x[best], Sim.y[prim] - Sim.y[best]);
        const rsoi = dPrim * Math.pow(Sim.m[best] / Sim.m[prim], 0.4);
        d = Math.min(d, rsoi * 0.45);
      }
      const v = Math.sqrt(mu / d);
      vx = Sim.vx[best] - v * dy / d; vy = Sim.vy[best] + v * dx / d;
      wx = Sim.x[best] + dx / hyp(dx, dy) * d; wy = Sim.y[best] + dy / hyp(dx, dy) * d;
    }
    this.appendCraft({ name: `Craft-${Sim.n}`, m: 1e-6, r: 0.05, x: wx, y: wy, vx, vy, color: CRAFT_COLORS[(Sim.n) % CRAFT_COLORS.length], craft: true });
    Sim.logEvent(`Craft-${Sim.n - 1} inserted on circular orbit`, 'ok');
  },
  appendCraft(def) {
    // grow arrays by one (preserving history is impossible -> reset trails)
    const n = Sim.n + 1;
    const cp = (arr, T) => { const out = new T(n); out.set(arr); return out; };
    Sim.m = cp(Sim.m, Float64Array); Sim.r = cp(Sim.r, Float64Array);
    Sim.x = cp(Sim.x, Float64Array); Sim.y = cp(Sim.y, Float64Array);
    Sim.vx = cp(Sim.vx, Float64Array); Sim.vy = cp(Sim.vy, Float64Array);
    Sim.ax = cp(Sim.ax, Float64Array); Sim.ay = cp(Sim.ay, Float64Array);
    Sim.alive = cp(Sim.alive, Uint8Array); Sim.craft = cp(Sim.craft, Uint8Array);
    Sim.n = n;
    Sim.m[n - 1] = def.m; Sim.r[n - 1] = def.r;
    Sim.x[n - 1] = def.x; Sim.y[n - 1] = def.y; Sim.vx[n - 1] = def.vx; Sim.vy[n - 1] = def.vy;
    Sim.names[n - 1] = def.name; Sim.colors[n - 1] = def.color; Sim.craft[n - 1] = def.craft ? 1 : 0;
    RK4.ensure(n); DP54.ensure(n);
    Sim.computeAccel();
    Sim.rebaseline();
    Hist.seed();
    Predict.dirty = true;
    Predict.run(true);
    Sel.select(n - 1);
  },
  deleteCraft() {
    const i = Sel.idx;
    if (i < 0 || !Sim.craft[i]) return;
    Nodes.removeForCraft(i);
    Sim.alive[i] = 0; Sim.m[i] = 0;
    Sim.logEvent(`${Sim.names[i]} removed`, 'ok');
    Sim.rebaseline();
    Sel.idx = -1;
    Predict.dirty = true;
    Predict.run(true);
    this.refreshSelection();
  },
  selBodyEditRebaseline() {
    Sim.computeAccel();
    Sim.rebaseline();
    Predict.dirty = true;
    Hist.seed();
  },
  applyBodyEdit() {
    const i = Sel.idx;
    if (i < 0) return;
    const m = +el('bMass').value, r = +el('bRadius').value;
    if (m > 0) Sim.m[i] = m;
    if (r > 0) Sim.r[i] = r;
    const x = parseFloat(el('bX').value), y = parseFloat(el('bY').value);
    const vx = parseFloat(el('bVx').value), vy = parseFloat(el('bVy').value);
    if (Number.isFinite(x)) Sim.x[i] = x;
    if (Number.isFinite(y)) Sim.y[i] = y;
    if (Number.isFinite(vx)) Sim.vx[i] = vx;
    if (Number.isFinite(vy)) Sim.vy[i] = vy;
    this.selBodyEditRebaseline();
    this.refreshSelection(true);
  },
  selNodeObj() { return Nodes.list.find(n => n.id === Interact.selNode) || null; },
  applyNodeEdit(silent, cart) {
    const nd = this.selNodeObj();
    if (!nd) return;
    const t = parseFloat(el('ndT').value);
    if (Number.isFinite(t) && t > Sim.t + P.dt) nd.t = t;
    const pro = parseFloat(el('ndPro').value), rad = parseFloat(el('ndRad').value);
    if (Number.isFinite(pro)) nd.pro = pro;
    if (Number.isFinite(rad)) nd.rad = rad;
    if (cart) {
      const dvx = parseFloat(el('ndDvx').value), dvy = parseFloat(el('ndDvy').value);
      if (Number.isFinite(dvx)) nd.dvx = dvx;
      if (Number.isFinite(dvy)) nd.dvy = dvy;
      nd.useProRad = false;
    } else if (Number.isFinite(pro) || Number.isFinite(rad)) {
      nd.useProRad = true;
    }
    if (!silent) { }
    Predict.dirty = true;
    Predict.run(true);
    this.refreshNodeEditor(true);
  },
  refreshSelection(light) {
    const i = Sel.idx;
    const pane = el('bodyPane');
    if (i < 0 || !Sim.alive[i]) {
      pane.classList.add('disabled');
      el('selName').textContent = 'No selection';
      el('selType').textContent = 'click a body';
      return;
    }
    pane.classList.remove('disabled');
    el('selName').textContent = Sim.names[i];
    el('selName').style.color = Sim.colors[i];
    el('selType').textContent = Sim.craft[i] ? 'spacecraft' : (Sim.m[i] > 100 ? 'star' : 'body');
    el('bMass').value = Sim.m[i];
    el('bRadius').value = Sim.r[i];
    el('btnDelCraft').style.display = Sim.craft[i] ? '' : 'none';
    if (!light) {
      el('bX').value = Number(Sim.x[i].toPrecision(6));
      el('bY').value = Number(Sim.y[i].toPrecision(6));
      el('bVx').value = Number(Sim.vx[i].toPrecision(6));
      el('bVy').value = Number(Sim.vy[i].toPrecision(6));
      el('bMass').value = Sim.m[i];
      el('bRadius').value = Sim.r[i];
    }
    // telemetry
    const prim = primaryOf(i);
    const T = el('telemetry');
    if (prim < 0) { T.innerHTML = '<div class="tele-row"><span>primary</span><b>—</b></div>'; return; }
    const e = elementsOf(i, prim);
    const path = Predict.pathFor(i);
    let encStr = '—';
    if (path && path.encounters.length) {
      const en = path.encounters[0];
      encStr = `${Sim.names[en.body]} d=${fmtNum(en.dist, 3)} (${fmtTimeShort(en.t - Sim.t)})`;
    }
    let dvLeft = 0;
    for (const nd of Nodes.list) if (nd.craftIdx === i && !nd.executed) dvLeft += Nodes.magnitude(nd);
    const rows = [
      ['position', `${fmtNum(Sim.x[i], 4)}, ${fmtNum(Sim.y[i], 4)}`],
      ['velocity', `${fmtNum(Sim.vx[i], 4)}, ${fmtNum(Sim.vy[i], 4)}`],
      ['speed', fmtNum(e.v, 4)],
      ['primary', Sim.names[prim]],
      ['dist → primary', fmtNum(e.r, 4)],
      ['spec. energy ε', fmtNum(e.eps, 4)],
      ['ang. momentum h', fmtNum(e.h, 4)],
      ['eccentricity e', fmtNum(e.e, 4)],
      ['periapsis', e.e < 1 || e.e > 1 ? fmtNum(e.rp, 4) : '—'],
      ['apoapsis', e.e < 1 ? fmtNum(e.ra, 4) : '(escape)'],
      ['period', Number.isFinite(e.T) ? `${fmtNum(e.T, 4)} u` : '(hyperbolic)'],
      ['orbit state', e.e < 1 ? (e.e < 0.01 ? 'circular' : 'elliptic') : (e.eps > 0 ? 'hyperbolic' : 'near-parabolic')],
      ['ΔV remaining', dvLeft > 0 ? fmtNum(dvLeft, 3) : '0'],
      ['closest encounter', encStr],
    ];
    T.innerHTML = rows.map(r => `<div class="tele-row"><span>${r[0]}</span><b>${r[1]}</b></div>`).join('');
  },
  refreshNodeEditor(light) {
    const list = el('nodeList');
    const ci = Sel.craftIdx();
    const nodes = ci >= 0 ? Nodes.forCraft(ci) : Nodes.list;
    if (!light) {
      if (!nodes.length) {
        list.innerHTML = '<div class="hint">No maneuver nodes. Use “＋ Node”, then click the predicted path.</div>';
      } else {
        list.innerHTML = nodes.map(nd => `
          <div class="node-item ${nd.id === Interact.selNode ? 'sel' : ''} ${nd.executed ? 'done' : ''}" data-node="${nd.id}">
            <span class="node-dot"></span>
            <span>${nd.executed ? '✓' : '◇'} ${Sim.names[nd.craftIdx]} @ T+${fmtNum(nd.t, 3)}</span>
            <b>ΔV ${fmtNum(Nodes.magnitude(nd), 3)}</b>
          </div>`).join('');
      }
    }
    const nd = this.selNodeObj();
    const ed = el('nodeEditor');
    if (!nd) { ed.classList.add('disabled'); return; }
    ed.classList.remove('disabled');
    el('ndCraftName').textContent = `${Sim.names[nd.craftIdx]} — node #${nd.id}${nd.executed ? ' (executed)' : ''}`;
    el('ndT').value = Number(nd.t.toPrecision(6));
    el('ndTrel').textContent = `in ${fmtNum(nd.t - Sim.t, 3)} u`;
    el('ndPro').value = nd.pro;
    el('ndRad').value = nd.rad;
    el('ndProVal').textContent = fmtNum(nd.pro, 3);
    el('ndRadVal').textContent = fmtNum(nd.rad, 3);
    el('ndDvx').value = nd.dvx;
    el('ndDvy').value = nd.dvy;
    const mag = Nodes.magnitude(nd);
    el('ndMag').textContent = fmtNum(mag, 4);
    // before/after orbital comparison from prediction
    const path = Predict.pathFor(nd.craftIdx);
    const comp = el('ndCompare');
    if (path && path.nodeRows.has(nd.id)) {
      const post = path.nodeRows.get(nd.id).post;
      const before = elementsOf(nd.craftIdx, primaryOf(nd.craftIdx));
      if (post) {
        comp.innerHTML = `
          <table><tr><th></th><th>before</th><th>after</th></tr>
          <tr><td>a</td><td>${fmtNum(before.a, 4)}</td><td>${fmtNum(post.a, 4)}</td></tr>
          <tr><td>e</td><td>${fmtNum(before.e, 4)}</td><td>${fmtNum(post.e, 4)}</td></tr>
          <tr><td>rp</td><td>${fmtNum(before.rp, 4)}</td><td>${fmtNum(post.rp, 4)}</td></tr>
          <tr><td>ra</td><td>${Number.isFinite(before.ra) ? fmtNum(before.ra, 4) : '—'}</td><td>${Number.isFinite(post.ra) ? fmtNum(post.ra, 4) : '—'}</td></tr>
          </table>`;
      } else comp.innerHTML = '';
    } else if (nd.executed) {
      comp.innerHTML = '<div class="hint">Node already executed.</div>';
    } else comp.innerHTML = '<div class="hint">Predicting…</div>';
  },
  eventTick(msg, kind) {
    const ev = el('eventLine');
    ev.textContent = msg;
    ev.className = kind === 'impact' ? 'warn' : (kind === 'warn' ? 'warn' : (kind === 'ok' ? 'ok' : ''));
    ev.style.opacity = 1;
    clearTimeout(this.eventTimer);
    this.eventTimer = setTimeout(() => { ev.style.opacity = 0; }, 5200);
  },
};
function sc0warp() { return Scenarios[el('scenarioSel')?.value | 0]?.warp ?? 1; }
