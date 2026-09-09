/* =======================================================================
   CONTROLS, INPUT, HUD, MAIN LOOP, BOOT
   ======================================================================= */

/* (tool / brush / selection / pause flags live with the render layer)   */
let lastClamp = false, rtPhys = 0, rtWall2 = 0, rtFactor = 1;
let uiTick = 0, fps = 60, hudSub = 0, hudClamped = false;
let emitShape = "point", emitKind = "cw", emitFreq = 2.5, slitGap = 0.3;

/* -------------------------------------------------------------- physics UI */
function applyPhysics() {
  sim.p.dt = Par.dt;
  sim.p.c0 = Par.speed;
  sim.p.damping = Par.damping;
  sim.p.boundary = Par.boundary;
  sim.p.persistence = P.persistence;
  sim.p.refFreq = P.refFreq;
  sim.dirty = true;
  computeStride();
}
function applyResolution(keepScene) {
  const oldW = Par.resW;
  Par.resW = RES[Par.res].W; Par.resH = RES[Par.res].H;
  if (Par.resW === oldW) return;
  sim = WaveCore.create({ W: Par.resW, H: Par.resH, Lx: LX });
  sim.expScale = 0.6;
  allocBuffers();
  applyPhysics();
  if (!keepScene) applyPreset();
  else { rebuildAll(); rebuildScopes(); }
  fitCanvas(); drawLegend();
}
let presetIdx = 0;
function applyPreset() {
  const p = PRESETS[presetIdx];
  WaveCore.clearField(sim);
  p.run();
  sim.probes = scene.probes;
  rebuildAll();
  rebuildScopes();
  sel = null;
  refreshInspector();
  syncControls();
  computeStride();
}

/* -------------------------------------------------------------- inspector */
let inspFields = {};
function buildInspector() {
  const host = $("pSrc");
  host.innerHTML = "";
  const head = el("div", { class: "row" }, host);
  el("span", { id: "inspTitle", class: "val", style: "min-width:0;color:var(--cy)", text: "nothing selected — pick the emitter tool (F) and click the tank", title: "nothing selected" }, head);

  const mk = (labelTxt, o) => {
    const r = row(host);
    r.dataset.dep = o.dep || "";
    const s = el("input", { type: "range", min: o.min, max: o.max, step: o.step, value: o.value }, r);
    const v = valSpan(r, "");
    const show = () => { v.textContent = o.fmt(+s.value); };
    show();
    s.addEventListener("input", () => { show(); o.on(+s.value); });
    inspFields[o.id] = { row: r, el: s, show, kind: "range" };
  };
  const mkBtns = (id, list, dep, on) => {
    const w = el("div", { class: "grid4", dep: dep }, host);
    w.dataset.dep = dep;
    const made = [];
    for (const it of list) {
      const b = el("button", { class: "big", text: it }, w);
      b.dataset.v = it;
      b.addEventListener("click", () => on(it));
      made.push(b);
    }
    inspFields[id] = { row: w, made, kind: "btns" };
  };

  mkBtns("kind", ["cw", "pulse"], "", (v) => { if (sel && sel.hist === undefined) { sel.kind = v; rebuildAll(); refreshInspector(); } });
  mkBtns("shape", ["point", "line", "array"], "src", (v) => {
    if (sel && sel.hist === undefined) { sel.shape = v; rebuildAll(); refreshInspector(); }
  });
  mk("frequency", { id: "freq", min: 0.2, max: 24, step: 0.1, value: 2.5, dep: "src", fmt: (x) => x.toFixed(2) + " Hz  λ " + (Par.speed / x).toFixed(3) + " m", on: (x) => { if (sel) { sel.freq = x; if (sel.hist === undefined) rebuildAll(); computeStride(); } } });
  mk("amplitude", { id: "amp", min: -3, max: 3, step: 0.05, value: 1, dep: "src", fmt: (x) => x.toFixed(2), on: (x) => { if (sel) sel.amp = x; } });
  mk("phase", { id: "phase", min: -360, max: 360, step: 1, value: 0, dep: "src", fmt: (x) => x.toFixed(0) + "°", on: (x) => { if (sel) sel.phase = x; } });
  mk("beam angle", { id: "angle", min: -180, max: 180, step: 1, value: 0, dep: "src", fmt: (x) => x.toFixed(0) + "°", on: (x) => { if (sel) { rebuildAll(); } } });
  mk("steer", { id: "steer", min: -60, max: 60, step: 0.5, value: 0, dep: "array", fmt: (x) => "sin θ = " + Math.sin(x * Math.PI / 180).toFixed(3), on: (x) => { if (sel) rebuildAll(); } });
  mk("curvature", { id: "curv", min: -80, max: 80, step: 0.5, value: 0, dep: "array", fmt: (x) => (Math.abs(x) < 1 ? "flat" : (x > 0 ? "concave R=" : "convex R=") + toM(Math.abs(x)).toFixed(2) + " m"), on: (x) => { if (sel) rebuildAll(); } });
  mk("elements", { id: "n", min: 1, max: 40, step: 1, value: 8, dep: "array", fmt: (x) => x.toFixed(0) + " el", on: (x) => { if (sel) rebuildAll(); } });
  mk("pitch", { id: "spacing", min: 1, max: 12, step: 0.25, value: 2, dep: "array", fmt: (x) => x.toFixed(2) + " cells = " + toM(x).toFixed(3) + " m", on: (x) => { if (sel) rebuildAll(); } });
  mk("aperture", { id: "len", min: 4, max: 250, step: 1, value: 60, dep: "line", fmt: (x) => x.toFixed(0) + " cells = " + toM(x).toFixed(2) + " m", on: (x) => { if (sel) rebuildAll(); } });
  mk("pulse length", { id: "pulseW", min: 0.01, max: 1.2, step: 0.01, value: 0.09, dep: "pulse", fmt: (x) => x.toFixed(2) + " s (" + (x * (sel ? sel.freq : 2.5)).toFixed(1) + " cyc)", on: (x) => { if (sel) sel.pulseW = x; } });
  mk("repeat", { id: "rep", min: 0, max: 1, step: 1, value: 1, dep: "pulse", fmt: (x) => (x ? "repeating train" : "single shot"), on: (x) => { if (sel) { sel.repeat = !!x; } } });
  const ar = row(host);
  ar.dataset.dep = "src";
  const on = el("input", { type: "checkbox", id: "srcOn" }, ar);
  el("label", { text: "source active (uncheck to watch the field decay)", for: "srcOn", style: "color:var(--ink2);font-size:11px" }, ar);
  on.addEventListener("change", () => { if (sel && sel.hist === undefined) { sel.active = on.checked; refreshActive(); refreshInspector(); } });
  inspFields["active"] = { row: ar, el: on, kind: "check" };
  const rr = row(host);
  rr.dataset.dep = "src";
  const b1 = el("button", { class: "big", text: "duplicate", style: "flex:1" }, rr);
  const b2 = el("button", { class: "big warn", text: "delete", style: "flex:1" }, rr);
  b1.addEventListener("click", () => {
    if (!sel || sel.hist !== undefined || scene.sources.length >= 24) return;
    const c = Object.assign({}, sel, { id: idSeq++ });
    delete c.cells;
    c.y = clamp(c.y + 12, 2, sim.H - 3);
    WaveCore.buildFootprint(sim, c);
    scene.sources.push(c); sel = c; refreshActive(); refreshInspector();
  });
  b2.addEventListener("click", () => { if (!sel) return; if (sel.hist !== undefined) removeSource(sel); else removeProbe(sel); });
  inspFields["ops"] = { row: rr };
}
function setDep(show) {
  for (const k in inspFields) {
    const f = inspFields[k];
    if (!f.row || !f.row.dataset.dep) continue;
    const d = f.row.dataset.dep;
    let want = false;
    if (!sel) want = false;
    else if (sel.hist !== undefined) want = d === "probe";
    else {
      if (d === "src") want = true;
      else if (d === "array") want = sel.shape === "array";
      else if (d === "line") want = sel.shape === "line";
      else if (d === "pulse") want = sel.kind === "pulse";
    }
    f.row.style.display = want ? "" : "none";
  }
}
function refreshInspector() {
  if (!inspFields.freq) return;
  const s = sel;
  const t = $("inspTitle");
  if (!s) {
    t.textContent = "nothing selected — emitter tool (F) + click to place";
  } else if (s.hist !== undefined) {
    t.textContent = "probe @ " + s.x.toFixed(2) + ", " + s.y.toFixed(2) + " m";
  } else {
    t.textContent = "emitter " + s.kind + " / " + s.shape + " @ " + s.x.toFixed(2) + ", " + s.y.toFixed(2) + " m · " + (s.nEl | 0) + " cells";
  }
  const set = (id, v) => { const f = inspFields[id]; if (f && f.kind === "range") { f.el.value = v; f.show(); } };
  if (s && s.hist === undefined) {
    set("freq", s.freq); set("amp", s.amp); set("phase", s.phase); set("angle", s.angle);
    set("steer", s.steer); set("curv", s.curv); set("n", s.n); set("spacing", s.spacing);
    set("len", s.len); set("pulseW", s.pulseW); set("rep", s.repeat ? 1 : 0);
    inspFields.active.el.checked = !!s.active;
    for (const b of inspFields.kind.made) b.classList.toggle("on", b.dataset.v === s.kind);
    for (const b of inspFields.shape.made) b.classList.toggle("on", b.dataset.v === s.shape);
  }
  setDep();
}

/* -------------------------------------------------------------- panel body */
function buildPanels() {
  /* ---- tools ---- */
  const host = $("pTools");
  host.innerHTML = "";
  const g = el("div", { class: "grid4" }, host);
  toolBtns = [];
  for (const t of TOOLS) {
    const b = el("button", { class: "tool", title: t.name + " — " + t.hint }, g);
    b.innerHTML = t.name + "<kbd>" + t.key + "</kbd>";
    b.dataset.tool = t.id;
    b.addEventListener("click", () => setTool(t.id));
    toolBtns.push(b);
  }
  const hint = el("div", { class: "hint", id: "toolHint" }, host);
  hint.textContent = TOOLS.find((t) => t.id === tool).hint;
  const er = el("div", { class: "row wrap" }, host);
  el("span", { class: "lbl", text: "new emitter" }, er);
  for (const v of ["point", "line", "array"]) {
    const b = el("button", { class: "big", text: v }, er);
    b.dataset.e = v;
    if (v === emitShape) b.classList.add("on");
    b.addEventListener("click", () => { emitShape = v; for (const x of er.querySelectorAll("button")) x.classList.toggle("on", x.dataset.e === emitShape); });
  }
  const er2 = el("div", { class: "row wrap" }, host);
  el("span", { class: "lbl", text: "kind" }, er2);
  for (const v of ["cw", "pulse"]) {
    const b = el("button", { class: "big", text: v }, er2);
    b.dataset.e = v;
    if (v === emitKind) b.classList.add("on");
    b.addEventListener("click", () => { emitKind = v; for (const x of er2.querySelectorAll("button")) x.classList.toggle("on", x.dataset.e === emitKind); });
  }
  slider(host, { label: "emitter freq", min: 0.3, max: 16, step: 0.1, value: emitFreq, dec: 2, unit: " Hz", on: (v) => { emitFreq = v; } });
  slider(host, { label: "slit gap", min: 0.05, max: 1.5, step: 0.01, value: slitGap, dec: 2, unit: " m", on: (v) => { slitGap = v; slitGapShow = v; } });
  slider(host, { label: "brush radius", min: 1, max: 30, step: 0.5, value: brush, dec: 1, on0: 0, fmt: (v) => v.toFixed(1) + " cells = " + toM(v).toFixed(3) + " m", on: (v) => { brush = v; updateRing(); } });
  slider(host, { label: "index brush", min: 0.3, max: 1.6, step: 0.01, value: indexBrush, dec: 2, unit: " c", on: (v) => { indexBrush = v; } });
  el("div", { class: "hint", text: "wall = rigid (reflects in phase) · absorber = 1.7× wider tapered sponge · medium paints the slider speed · lens drags a disc of slow water" }, host);

  /* ---- physics ---- */
  const ph = $("pPhys");
  ph.innerHTML = "";
  selectBox(ph, { label: "grid", value: String(Par.res), items: RES.map((r, i) => ({ id: String(i), name: r.name })), on: (v) => { Par.res = +v; applyResolution(false); toast("grid → " + RES[Par.res].name + " (scene rebuilt)"); } });
  slider(ph, { label: "timestep dt", min: 0.0004, max: 0.03, step: 0.0002, value: Par.dt, dec: 4, unit: " s", on: (v) => { Par.dt = v; applyPhysics(); } });
  slider(ph, { label: "substeps", min: 1, max: 8, step: 1, value: Par.substeps, dec: 0, on: (v) => { Par.substeps = v | 0; } });
  slider(ph, { label: "wave speed c₀", min: 0.2, max: 1.6, step: 0.01, value: Par.speed, dec: 2, unit: " m/s", on: (v) => { Par.speed = v; applyPhysics(); } });
  slider(ph, { label: "bulk damping", min: 0, max: 8, step: 0.05, value: Par.damping, dec: 2, unit: " /s", on: (v) => { Par.damping = v; applyPhysics(); } });
  selectBox(ph, { label: "boundary", value: Par.boundary, items: ["absorb", "reflect", "periodic"], on: (v) => { Par.boundary = v; applyPhysics(); } });
  check(ph, { label: "unsafe mode (skip the CFL clamp)", value: P.unsafe, on: (v) => { P.unsafe = v; $("btnUnsafe").classList.toggle("on", v); } });
  el("div", { class: "hint", id: "cflHint" }, ph);

  /* ---- display ---- */
  const ds = $("pDisp");
  ds.innerHTML = "";
  selectBox(ds, { label: "view mode", value: P.mode, items: MODES, on: (v) => setMode(v) });
  check(ds, { label: "auto exposure", value: P.autoExp, on: (v) => { P.autoExp = v; } });
  slider(ds, { label: "exposure", min: 0.1, max: 8, step: 0.05, value: P.exposure, dec: 2, unit: "×", on: (v) => { P.exposure = v; } });
  slider(ds, { label: "persistence", min: 0, max: 1, step: 0.02, value: P.persistence, dec: 2, on: (v) => { P.persistence = v; sim.p.persistence = v; } });
  check(ds, { label: "smooth (bicubic) field", value: P.smooth, on: (v) => { P.smooth = v; } });
  check(ds, { label: "overlay barriers", value: P.showMedium, on: (v) => { P.showMedium = v; } });
  slider(ds, { label: "flow arrows every", min: 6, max: 40, step: 1, value: P.arrowSkip, dec: 0, unit: " cells", on: (v) => { P.arrowSkip = v | 0; } });
  slider(ds, { label: "phase reference f", min: 0.2, max: 20, step: 0.1, value: P.refFreq, dec: 2, unit: " Hz", on: (v) => { P.refFreq = v; sim.p.refFreq = v; } });

  /* ---- data ---- */
  const dt2 = $("pData");
  dt2.innerHTML = "";
  const r1 = row(dt2);
  const mkBtn = (txt, fn, title) => { const b = el("button", { class: "big", text: txt, style: "flex:1", title: title || "" }, r1); b.addEventListener("click", fn); return b; };
  mkBtn("save", () => { try { localStorage.setItem(LSKEY, serialize()); toast("scene + medium saved to localStorage"); } catch (e) { toast("save failed: " + e.message, true); } });
  mkBtn("load", () => { let s = null; try { s = localStorage.getItem(LSKEY); } catch (e) { toast("localStorage unavailable on this origin", true); return; } if (!s) { toast("nothing saved yet", true); return; } const err = deserialize(s); toast(err ? "load failed: " + err : "scene loaded", !!err); });
  const r2 = row(dt2);
  mkBtn("copy json", () => { const s = serialize(); navigator.clipboard && navigator.clipboard.writeText(s); $("expArea").value = s; toast("scene JSON copied (" + s.length + " chars), also in the box below"); });
  mkBtn("load json", () => { const err = deserialize($("expArea").value); toast(err ? "parse failed: " + err : "scene imported from the box", !!err); });
  const r3 = row(dt2);
  mkBtn("png", () => { download("wave-lab.png", cv.toDataURL("image/png")); toast("png saved"); });
  mkBtn("file", () => { download("wave-lab-scene.json", serialize()); toast("scene file downloaded"); });
  const ta = el("textarea", { id: "expArea", rows: 4, style: "width:100%;font:10px var(--mono);background:#0e141d;color:#9fb4c8;border:1px solid var(--line);border-radius:4px" }, dt2);
  check(dt2, { label: "autosave scene to localStorage", value: P.autosave, on: (v) => { P.autosave = v; } });
  el("div", { class: "hint", text: "scenes are stored with the grid size; a scene saved at another resolution will not import" }, dt2);

  /* ---- keys ---- */
  const k = $("pKeys");
  k.innerHTML = "";
  el("div", {
    class: "hint", style: "font-size:11px;line-height:1.6",
    html: "<b>space</b> pause/resume · <b>s</b> single step · <b>c</b> clear field · <b>r</b> rebuild scene<br>" +
      "<b>1…7</b> view modes · <b>[</b> / <b>]</b> brush size · <b>del</b> delete selection<br>" +
      "<b>alt+click</b> an emitter or probe deletes it · <b>drag</b> paints (mouse or touch)<br><br>" +
      "The tank is " + LX + " × " + LY + " m. Default grid 400×250 → dx = 0.0200 m; one wavelength at 2.5 Hz is 0.40 m = 20 cells, " +
      "and the stability limit dt ≤ 0.707·dx/c means dt up to 14 ms is safe here — the shown CFL ratio is the live check.<br><br>" +
      "Numerics: leapfrog in time, 5-point Laplacian, rigid walls use a zero-normal-derivative stencil, absorbers raise a local " +
      "damping term, and the boundary band is a graded sponge. Sources are injected additively over a Gaussian footprint."
  }, k);
}
let toolBtns = [];

/* ------------------------------------------------------------- toolbar/HUD */
function buildToolbar() {
  const tb = $("toolbar");
  tb.innerHTML = "";
  for (const m of MODES) {
    const b = el("button", { text: m.short, title: m.name }, tb);
    b.dataset.mode = m.id;
    if (m.id === P.mode) b.classList.add("on");
    b.addEventListener("click", () => setMode(m.id));
  }
}
function setMode(m) {
  P.mode = m;
  $("modeSel").value = m;
  for (const b of $("toolbar").querySelectorAll("button")) b.classList.toggle("on", b.dataset.mode === m);
  drawLegend();
}
function setTool(t) {
  if (!TOOLS.find((x) => x.id === t)) return;
  tool = t;
  for (const b of toolBtns) b.classList.toggle("sel", b.dataset.tool === t);
  $("toolHint").textContent = TOOLS.find((x) => x.id === t).hint;
  updateRing();
  if (t !== "select" && t !== "emit" && t !== "probe") { sel = null; refreshInspector(); }
  cv.style.cursor = (t === "select" || t === "emit" || t === "probe") ? "pointer" : "crosshair";
}
function updateRing() {
  const ring = $("brushring");
  const paint = tool === "wall" || tool === "slit" || tool === "absorb" || tool === "medium" || tool === "lens" || tool === "erase";
  ring.style.display = paint && lastPx ? "" : "none";
  if (paint && lastPx) {
    const d = 2 * brush * sim.dx * scale / dpr;
    ring.style.width = d + "px"; ring.style.height = d + "px";
    ring.style.left = (lastPx[0] + cvOffX) + "px"; ring.style.top = (lastPx[1] + cvOffY) + "px";
  }
}
let lastPx = null;
function updateHUD() {
  const S = sim;
  const cfl = S.cfl, lim = WaveCore.CFL_LIMIT;
  const ratio = cfl / lim;
  const box = $("stab");
  const used = (S.dtUsed || Par.dt);
  const nSub = hudSub;
  const rClamped = hudClamped;
  /* the badge has to say when the timestep was silently reduced: a clamped
     run reads as "CFL 0.700" which otherwise looks like plain good news */
  box.classList.toggle("bad", S.unstable && P.unsafe);
  box.classList.toggle("mid", rClamped || (ratio > 0.75 && !S.unstable));
  $("stabTxt").textContent = "CFL " + cfl.toFixed(3) + " / " + lim.toFixed(3) +
    (rClamped ? " · dt clamped " + (used * 1000).toFixed(1) + " of " + (Par.dt * 1000).toFixed(1) + " ms"
      : (S.unstable ? " · UNSTABLE" : ""));
  const rt = rtWall2 > 1 ? rtPhys / rtWall2 : 0;
  const rows = [
    "<span class='k'>grid</span><b>" + S.W + "×" + S.H + "</b> = " + (S.N / 1000).toFixed(0) + "k cells · dx " + S.dx.toFixed(4) + " m",
    "<span class='k'>dt</span>" + (used * 1000).toFixed(2) + " ms × " + nSub + " sub" + (rClamped ? " <span class='bad'>clamped</span>" : "") + " = <b>" + (used * nSub * 1000).toFixed(1) + " ms</b> physics/frame",
    "<span class='k'>c₀</span>" + Par.speed.toFixed(2) + " m/s · λ(ref) " + (S.lamCells).toFixed(1) + " cells · damping " + Par.damping.toFixed(2) + " · " + Par.boundary,
    "<span class='k'>t</span><b>" + S.time.toFixed(3) + " s</b> · step " + S.steps + " · " + rt.toFixed(2) + "× realtime",
    "<span class='k'>fps</span><b>" + fps.toFixed(0) + "</b> · " + workMs.toFixed(1) + " ms/frame work · " + (S.unstable ? "<span class='bad'>UNSTABLE</span>" : "stable") + (nSub === 0 ? " · <span class='paused'>PAUSED</span>" : ""),
    "<span class='k'>sources</span>" + activeSources.length + "/" + scene.sources.length + " · probes <b>" + scene.probes.length + "</b> · " + P.mode + " · " + tool
  ];
  const h = $("hud");
  if (h._last !== rows.join("|")) { h.innerHTML = rows.join("<br>"); h._last = rows.join("|"); }
}

/* ------------------------------------------------------------- pointer I/O */
/* Pointer input is metres + css px; source/probe objects live in cells.   */
let drag = null;
function canvasPos(e) {
  const r = cv.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width * LX;
  const y = (e.clientY - r.top) / r.height * LY;
  return [x, y, e.clientX - r.left, e.clientY - r.top];
}
function paintAt(x, y) {
  const [cx, cy] = toCells(x, y);
  if (tool === "wall") WaveCore.paintDisc(sim, cx, cy, brush, 1, 0);
  else if (tool === "absorb") WaveCore.paintDisc(sim, cx, cy, brush, 2, 0);
  else if (tool === "medium") WaveCore.paintDisc(sim, cx, cy, brush, 3, indexBrush);
  else if (tool === "erase") { WaveCore.paintDisc(sim, cx, cy, brush, 0, 0); clearNear(cx, cy, brush * 1.2); }
  sim.dirty = true;
}
function onDown(e) {
  const [x, y, px, py] = canvasPos(e);
  lastPx = [px, py];
  if (x < 0 || y < 0 || x > LX || y > LY) return;
  const [cx, cy] = toCells(x, y);
  const del = e.altKey || e.ctrlKey;
  const hitR = Math.max(3, brush * 0.6);
  if (tool === "emit" || tool === "select") {
    const s = srcAt(cx, cy, hitR);
    const p = probeAt(cx, cy, hitR);
    if (del && (s || p)) { if (s) removeSource(s); else removeProbe(p); toast("deleted"); return; }
    if (s) { sel = s; drag = { mode: "move", o: s }; refreshInspector(); return; }
    if (p) { sel = p; drag = { mode: "move", o: p }; refreshInspector(); return; }
    if (tool === "emit") {
      if (scene.sources.length >= 24) { toast("24 emitters is the cap", true); return; }
      const s = mkSource({
        x: cx, y: cy, shape: emitShape, kind: emitKind, freq: emitFreq, amp: 1,
        pulseW: 0.09, repeat: emitKind !== "pulse", len: toC(1.2)
      });
      scene.sources.push(s); sel = s; refreshActive(); refreshInspector();
      drag = { mode: "move", o: s };
      toast("new " + s.kind + " " + s.shape + " emitter — tune it in the Source inspector");
    } else { sel = null; refreshInspector(); }
    return;
  }
  if (tool === "probe") {
    const p = probeAt(cx, cy, Math.max(3, brush * 0.6));
    if (p) { sel = p; drag = { mode: "move", o: p }; refreshInspector(); return; }
    if (scene.probes.length >= WaveCore.MAXPROBE) { toast("probe cap is " + WaveCore.MAXPROBE, true); return; }
    const np = mkProbe(cx, cy);
    scene.probes.push(np); sim.probes = scene.probes; sel = np;
    rebuildScopes(); refreshInspector();
    return;
  }
  if (tool === "slit") { drag = { mode: "slit", x0: x, y0: y, x1: x, y1: y }; return; }
  if (tool === "lens") {
    drag = { mode: "lens", x0: cx, y0: cy };
    WaveCore.paintDisc(sim, cx, cy, Math.max(1, brush * 0.7), 4, 0);
    sim.dirty = true;
    return;
  }
  drag = { mode: "paint", lx: x, ly: y };
  paintAt(x, y);
}
function paintSeg(x0, y0, x1, y1) {
  const d = Math.hypot(x1 - x0, y1 - y0);
  const step = Math.max(sim.dx * 0.8, brush * sim.dx * 0.5);
  const n = Math.max(1, Math.ceil(d / step));
  for (let k = 0; k <= n; k++) paintAt(x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n);
}
function onMove(e) {
  const [x, y, px, py] = canvasPos(e);
  lastPx = [px, py];
  updateRing();
  if (!drag) return;
  if (drag.mode === "paint") { paintSeg(drag.lx, drag.ly, x, y); drag.lx = x; drag.ly = y; }
  else if (drag.mode === "move") {
    const o = drag.o;
    o.x = clamp(x / sim.dx, 1, sim.W - 2);
    o.y = clamp(y / sim.dx, 1, sim.H - 2);
    if (o.hist === undefined) rebuildAll();
  } else if (drag.mode === "slit") { drag.x1 = x; drag.y1 = y; }
  else if (drag.mode === "lens") {
    const cx = x / sim.dx, cy = y / sim.dx;
    WaveCore.paintDisc(sim, drag.x0, drag.y0, Math.max(1, Math.hypot(cx - drag.x0, cy - drag.y0)), 4, 0);
    sim.dirty = true;
  }
}
function onUp() {
  const d = drag;
  drag = null;
  if (!d) return;
  if (d.mode === "move" && d.o && d.o.hist === undefined) rebuildAll();
  if (d.mode === "slit") {
    const n = WaveCore.paintSlit(sim, d.x0 / sim.dx, d.y0 / sim.dx, d.x1 / sim.dx, d.y1 / sim.dx,
                                Math.max(1, brush), Math.max(2.5, slitGap / sim.dx));
    sim.dirty = true;
    toast(n ? "barrier painted with a " + slitGap.toFixed(2) + " m slot" : "drag further to lay a barrier", !n);
  }
}

/* ------------------------------------------------------------------- main loop */
let raf = 0, lastFrameT = 0, workMs = 0;
function step(nSub) {
  const wantFlux = P.mode === "flow";
  const r = WaveCore.stepFrame(sim, nSub, activeSources, { unsafe: P.unsafe, flux: wantFlux });
  if (r.clamped) {
    if (!lastClamp) toast("dt above the stability limit — auto-reduced to " + (r.dt * 1000).toFixed(2) + " ms", true);
    lastClamp = true;
  } else lastClamp = false;
  return r;
}
function frame(now) {
  raf = requestAnimationFrame(frame);
  const t0 = performance.now();
  let nSub = 0;
  if (!paused) nSub = Par.substeps;
  else if (pendingSteps > 0) { nSub = Par.substeps; pendingSteps--; }
  let r = null;
  if (nSub > 0) r = step(nSub);
  /* paused + energy-flow view: refresh the flux vectors over the frozen
     field so the arrows are not stuck on whatever the last run left behind */
  else if (P.mode === "flow") WaveCore.stepFrame(sim, 0, [], { unsafe: P.unsafe, flux: true });
  hudSub = nSub; hudClamped = !!(r && r.clamped);
  renderField();
  drawOverlays(now);
  uiTick++;
  if (uiTick % 4 === 0) updateHUD();
  if (uiTick % 3 === 0 && scene.probes.length && (nSub > 0 || uiTick % 24 === 0)) drawScopes();
  const ms = performance.now() - t0;
  const interval = now - lastFrameT; lastFrameT = now;
  if (interval > 0 && interval < 500) fps += 0.06 * (1000 / interval - fps);
  workMs = ms;
  if (nSub > 0) {
    rtPhys += (sim.dtUsed || Par.dt) * nSub;
    rtWall2 += ms / 1000;
    if (uiTick % 45 === 0) { rtPhys *= 0.5; rtWall2 *= 0.5; }
  }
  if (P.autosave && uiTick % 900 === 0) { try { localStorage.setItem(LSKEY, serialize()); } catch (e) { } }
}

/* ------------------------------------------------------------------- boot */
function syncControls() {
  $("modeSel").value = P.mode;
  for (const b of $("toolbar").querySelectorAll("button")) b.classList.toggle("on", b.dataset.mode === P.mode);
  drawLegend();
  const ph = $("pPhys");
  if (!ph.querySelector("input[type=range]")) return;
  const s = ph.querySelectorAll("input[type=range]");
  if (s.length >= 4) {
    s[0].value = Par.dt; s[1].value = Par.substeps; s[2].value = Par.speed; s[3].value = Par.damping;
    for (const x of s) x.dispatchEvent(new Event("input"));
  }
  const rs = ph.querySelector("select");
  if (rs) rs.value = String(Par.res);
}
function download(name, text) {
  const a = document.createElement("a");
  a.href = text.startsWith("data:") ? text : URL.createObjectURL(new Blob([text], { type: "application/json" }));
  a.download = name; a.click();
}
function boot() {
  /* mode selector in the top bar */
  const ms = $("modeSel");
  for (const m of MODES) { const o = document.createElement("option"); o.value = m.id; o.textContent = m.name; ms.appendChild(o); }
  ms.value = P.mode;
  ms.addEventListener("change", () => setMode(ms.value));
  const ps = $("presetSel");
  for (const p of PRESETS) { const o = document.createElement("option"); o.value = p.id; o.textContent = p.name; ps.appendChild(o); }
  ps.addEventListener("change", () => {
    presetIdx = PRESETS.findIndex((p) => p.id === ps.value);
    applyPreset(); toast("preset: " + PRESETS[presetIdx].name);
  });
  ps.value = PRESETS[presetIdx].id;

  $("btnPause").addEventListener("click", togglePause);
  $("btnStep").addEventListener("click", () => { pendingSteps = 1; if (!paused) togglePause(true); });
  $("btnUnsafe").addEventListener("click", () => {
    P.unsafe = !P.unsafe;
    $("btnUnsafe").classList.toggle("on", P.unsafe);
    $("btnUnsafe").classList.toggle("warn", P.unsafe);
    toast(P.unsafe ? "unsafe mode: the CFL clamp is off, the field may blow up" : "safe mode: dt is auto-clamped to the stability limit", P.unsafe);
  });

  /* first sim + scene: build the chrome first so the preset can sync it */
  Par.resW = RES[Par.res].W; Par.resH = RES[Par.res].H;
  sim = WaveCore.create({ W: Par.resW, H: Par.resH, Lx: LX });
  sim.expScale = 0.6;
  allocBuffers();
  applyPhysics();
  scene.sources = []; scene.probes = [];
  buildPanels();
  buildToolbar();
  buildInspector();
  fitCanvas();
  applyPreset();
  drawLegend();
  setTool("wall");
  syncControls();

  /* pointer */
  cv.addEventListener("pointerdown", (e) => {
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events */ }
    onDown(e);
    if (e.pointerType === "mouse") onMove(e);
    e.preventDefault();
  });
  cv.addEventListener("pointermove", (e) => { onMove(e); e.preventDefault(); });
  cv.addEventListener("pointerup", (e) => { onUp(e); });
  cv.addEventListener("pointercancel", () => { drag = null; });
  cv.addEventListener("pointerleave", () => { lastPx = null; updateRing(); });
  cv.addEventListener("wheel", (e) => {
    brush = clamp(brush + (e.deltaY > 0 ? -1 : 1), 1, 40);
    updateRing();
    e.preventDefault();
  }, { passive: false });
  window.addEventListener("resize", () => { fitCanvas(); layoutScopes(); drawLegend(); });

  /* keyboard */
  window.addEventListener("keydown", (e) => {
    const t = e.target && e.target.tagName;
    if (t === "INPUT" || t === "SELECT" || t === "TEXTAREA") return;
    const k = e.key;
    if (k === " ") { togglePause(); e.preventDefault(); }
    else if (k === "s") { pendingSteps = 1; if (!paused) togglePause(true); }
    else if (k === "c") { WaveCore.clearField(sim); toast("field cleared"); }
    else if (k === "r") { applyPreset(); toast("scene rebuilt"); }
    else if (k === "Enter") { WaveCore.clearMedium(sim); applyPreset(); toast("medium + field cleared"); }
    else if (k === "[") { brush = clamp(brush - 1, 1, 40); updateRing(); }
    else if (k === "]") { brush = clamp(brush + 1, 1, 40); updateRing(); }
    else if (k === "Delete" || k === "Backspace") { if (sel) { if (sel.hist !== undefined) removeProbe(sel); else removeSource(sel); toast("deleted"); } }
    else if (/^[1-7]$/.test(k)) { setMode(MODES[+k - 1].id); }
    else {
      const t2 = TOOLS.find((x) => x.key.toLowerCase() === k.toLowerCase());
      if (t2) setTool(t2.id);
    }
  });
  function togglePause(force) {
    paused = force === true ? true : !paused;
    $("btnPause").classList.toggle("on", !paused);
    $("btnPause").textContent = paused ? "▶ Run" : "⏸ Pause";
  }

  /* collapsible sections */
  for (const s of document.querySelectorAll(".sec > .h")) {
    s.addEventListener("click", () => {
      s.parentNode.classList.toggle("collapsed");
      s.querySelector(".tw").textContent = s.parentNode.classList.contains("collapsed") ? "▸" : "▾";
    });
  }
  /* start */
  raf = requestAnimationFrame(frame);

  /* debug/automation hook */
  window.__lab = {
    get sim() { return sim; }, get scene() { return scene; }, get P() { return P; }, get Par() { return Par; },
    tool: (t) => setTool(t), mode: (m) => setMode(m), preset: (i) => { presetIdx = i; applyPreset(); },
    step: (n) => { for (let i = 0; i < (n || 1); i++) step(Par.substeps); },
    stepOnce: () => step(1), pause: (v) => { paused = v !== false; },
    stats: () => ({
      fps: Math.round(fps), workMs: +workMs.toFixed(2), time: sim.time, steps: sim.steps, maxAbs: sim.maxAbs,
      cfl: sim.cfl, unstable: !!sim.unstable, sources: scene.sources.length,
      probes: scene.probes.length, mode: P.mode, paused: paused
    }),
    sample: (x, y) => WaveCore.sample(sim, x / sim.dx, y / sim.dx),
    addProbe: (x, y) => { const p = mkProbe(x, y); scene.probes.push(p); sim.probes = scene.probes; rebuildScopes(); return p; },
    addSource: (o) => { const s = mkSource(o); scene.sources.push(s); refreshActive(); return s; },
    serialize, deserialize
  };
}

boot();
