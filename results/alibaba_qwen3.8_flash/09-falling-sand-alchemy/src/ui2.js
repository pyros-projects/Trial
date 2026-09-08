/* =====================================================================
   PRESETS
   ===================================================================== */
const PRESETS = [];
function preset(name, fn) { PRESETS.push({ name: name, fn: fn }); }

preset('Volcano & Ocean', function () {
  P.ambient = 24;
  const bedY = H - Math.max(3, Math.round(H * 0.09));
  rectFill(0, bedY, W, H - bedY, STONE);
  // ocean
  const ocW = Math.round(W * 0.36);
  const topY = Math.round(H * 0.46);
  for (let y = topY; y < bedY; y++) for (let x = 0; x < ocW; x++) putRaw(x, y, WATER, 14, null);
  // volcanic cone
  const apexX = Math.round(W * 0.66), apexY = Math.round(H * 0.16);
  const baseY = bedY;
  const slope = (baseY - apexY);
  for (let y = apexY; y < baseY; y++) {
    const t = (y - apexY) / slope;
    const halfW = Math.round(4 + t * t * W * 0.34);
    for (let x = Math.max(0, apexX - halfW); x < Math.min(W, apexX + halfW); x++) {
      const surf = Math.abs(x - apexX) > halfW - 4;
      putRaw(x, y, surf ? SAND : STONE, null, null);
    }
  }
  // conduit + magma chamber
  const conduit = Math.max(2, Math.round(W * 0.014));
  for (let y = bedY - 1; y > apexY + 2; y--) {
    for (let dx = -conduit; dx <= conduit; dx++) {
      const x = apexX + dx;
      if (!inb(x, y)) continue;
      putRaw(x, y, LAVA, 1520, null);
    }
  }
  discFill(apexX, apexY + 3, Math.max(3, conduit + 3), LAVA, null);
  discFill(Math.round(W * 0.5), bedY - 3, Math.round(W * 0.05), LAVA, null);
  // keep the conduit and the crater fed so the volcano stays alive
  addVent(apexX, apexY + 2, LAVA, 1520, 2, 2, 5);
  addVent(apexX, Math.round(H * 0.55), LAVA, 1480, 3, 1, 3);
  addVent(Math.max(2, apexX - Math.round(W * 0.22)) + 4, Math.round(H * 0.22), WATER, 6, 2, 2, 4);
  // eruption column: lava and ash thrown well above the crater so the
  // first thing you see is an eruption, not a still life
  for (let k = 0; k < 260; k++) {
    const x = apexX + ri(9) - 4, y = apexY - ri(34);
    if (!inb(x, y)) continue;
    putRaw(x, y, rnd() < 0.55 ? LAVA : SMOKE, rnd() < 0.55 ? 1450 : 320, null);
  }
  // a spring high on the wet flank keeps water running into the sea
  const rivX = Math.max(2, apexX - Math.round(W * 0.22));
  for (let y = Math.round(H * 0.3); y < bedY - 1; y++) {
    for (let dx = -1; dx <= 1; dx++) if (rnd() < 0.8) putRaw(rivX + dx, y, WATER, 8, null);
  }
  // vegetation on the wet side
  for (let k = 0; k < 22; k++) {
    const x = Math.round(ocW * 0.35) + ri(Math.round(W * 0.16));
    const y = topY - 2 - ri(3);
    if (!inb(x, y)) continue;
    putRaw(x, y, PLANT, 24, 40);
    if (rnd() < 0.4) putRaw(x, y - 1, PLANT, 24, 30);
    if (rnd() < 0.25) putRaw(x, y - 2, WOOD, 24, null);
  }
});

preset('Burning Building', function () {
  P.ambient = 21;
  const gY = H - Math.max(3, Math.round(H * 0.1));
  rectFill(0, gY, W, H - gY, SOIL);
  rectFill(0, gY - 2, W, 2, SAND);
  const bx = Math.round(W * 0.3), bw = Math.round(W * 0.4), by = Math.round(H * 0.3);
  // floor + walls
  rectFill(bx, gY - 3, bw, 3, WOOD);
  for (let y = by; y < gY - 2; y++) {
    putRaw(bx, y, WOOD, 24, null); putRaw(bx + 1, y, WOOD, 24, null);
    putRaw(bx + bw - 1, y, WOOD, 24, null); putRaw(bx + bw - 2, y, WOOD, 24, null);
    if ((y - by) % 9 === 0) rectFill(bx + 2, y, bw - 4, 1, WOOD);
  }
  rectFill(bx - 3, by - 3, bw + 6, 3, WOOD);
  // interior fuel
  rectFill(bx + 4, gY - 8, 7, 6, OIL);
  rectFill(bx + bw - 14, gY - 7, 8, 5, CHAR);
  rectFill(bx + 6, by + 10, 10, 4, POWDER);
  rectFill(bx + 3, by + 4, 6, 3, PLASTIC);
  // a fuse laid from the powder store out through the door and across the floor
  const fy = gY - 4;
  lineFill(bx + 6, fy, Math.round(W * 0.92), fy + 2, CHAR, 1);
  // water trough far from the fire
  rectFill(Math.round(W * 0.05), gY - 6, 12, 5, WATER, null);
  rectFill(Math.round(W * 0.05) - 1, gY - 7, 14, 1, METAL);
  // ignite the far end of the fuse
  const ex = Math.min(W - 3, Math.round(W * 0.92));
  for (let k = 0; k < 10; k++) putRaw(ex + ri(3), fy + ri(3), FIRE, 760, 22);
  putRaw(ex, fy, GAS, 90, 40);
  // a slow oil leak down the inside of the building keeps the blaze fed
  addVent(bx + Math.round(bw * 0.45), by - 4, OIL, 18, 5, 1, 2);
});

preset('Electrical Laboratory', function () {
  P.ambient = 22;
  rectFill(0, H - 4, W, 4, STONE);
  const top = Math.round(H * 0.2), bot = H - 6;
  const lft = Math.round(W * 0.1), rgt = Math.round(W * 0.86);
  // wiring: battery -> along the ceiling -> down the right -> through brine -> back to the battery
  const bx = lft + 2, by = Math.round(H * 0.34);
  rectFill(bx, by, 4, 3, BATT);
  lineFill(bx + 4, by + 1, rgt - 6, by + 1, METAL, 1);
  lineFill(rgt - 6, by + 1, rgt - 6, bot - 10, METAL, 1);
  lineFill(rgt - 6, bot - 10, lft + 20, bot - 10, METAL, 1);
  lineFill(lft + 20, bot - 10, lft + 20, by + 8, METAL, 1);
  lineFill(lft + 20, by + 8, bx + 4, by + 8, METAL, 1);
  // salt-water trough the current crosses
  rectFill(Math.round(W * 0.4), bot - 16, 26, 7, WATER);
  rectFill(Math.round(W * 0.4) - 1, bot - 17, 28, 1, GLASS);
  // acid bath eating a steel beam
  const ax = Math.round(W * 0.6);
  rectFill(ax, bot - 24, 22, 9, GLASS);
  for (let y = bot - 23; y < bot - 16; y++) for (let x = ax + 1; x < ax + 21; x++) putRaw(x, y, ACID, 26, null);
  rectFill(ax + 3, bot - 17, 16, 2, METAL);
  // gunpowder charge wired to the circuit
  const gx = Math.round(W * 0.18), gy = bot - 6;
  rectFill(gx, gy, 9, 5, POWDER);
  lineFill(gx + 4, gy - 1, lft + 20, by + 8, METAL, 1);
  // hot side: a molten pool that the wire dips into
  discFill(Math.round(W * 0.78), bot - 4, 6, LAVA, null);
});

preset('Acid Factory', function () {
  P.ambient = 23;
  rectFill(0, H - 5, W, 5, STONE);
  const y0 = Math.round(H * 0.22);
  for (let t = 0; t < 3; t++) {
    const x = Math.round(W * (0.14 + t * 0.27));
    rectFill(x, y0, 26, 16, GLASS);
    for (let y = y0 + 2; y < y0 + 15; y++) for (let i = x + 2; i < x + 24; i++) putRaw(i, y, ACID, 25, null);
    putRaw(x + 12, y0 + 16, EMPTY);
    putRaw(x + 13, y0 + 16, EMPTY);
    // metal beams under the drips
    rectFill(x + 4, y0 + 22, 18, 2, METAL);
    rectFill(x + 2, y0 + 28, 22, 3, WOOD);
  }
  // a sealed vent shaft for the hydrogen
  const vx = Math.round(W * 0.72);
  rectFill(vx, Math.round(H * 0.12), 2, Math.round(H * 0.6), GLASS);
  rectFill(vx + 14, Math.round(H * 0.12), 2, Math.round(H * 0.6), GLASS);
  rectFill(vx, Math.round(H * 0.1), 16, 2, GLASS);
  // salt store + a puddle that the acid will reach
  rectFill(Math.round(W * 0.1), H - 14, 20, 6, SALT);
  rectFill(Math.round(W * 0.4), H - 12, 26, 7, WATER);
  rectFill(Math.round(W * 0.62), H - 10, 16, 5, PLANT, 0.7);
});

preset('Steam Engine', function () {
  P.ambient = 18;
  rectFill(0, H - 4, W, 4, STONE);
  const bx = Math.round(W * 0.18), by = Math.round(H * 0.42), bw = Math.round(W * 0.22), bh = Math.round(H * 0.3);
  // sealed boiler
  rectFill(bx, by, bw, 3, METAL);
  rectFill(bx, by + bh, bw, 3, METAL);
  rectFill(bx, by, 3, bh, METAL);
  rectFill(bx + bw - 3, by, 3, bh, METAL);
  for (let y = by + 6; y < by + bh - 3; y++) for (let x = bx + 4; x < bx + bw - 4; x++) putRaw(x, y, WATER, 30, null);
  // furnace under it
  rectFill(bx + 2, by + bh + 4, bw - 4, 5, LAVA);
  rectFill(bx - 2, by + bh + 3, bw + 4, 1, METAL);
  // steam pipe up and over to a cold condensing dome
  const px = bx + bw + 2, ex = Math.round(W * 0.66);
  const py = by + 6;
  for (let x = px; x < ex; x++) { putRaw(x, py, GLASS); putRaw(x, py + 1, GLASS); }
  for (let x = px; x < ex; x++) { putRaw(x, py + 12, GLASS); putRaw(x, py + 13, GLASS); }
  for (let y = py + 2; y < py + 12; y++) { putRaw(ex, y, GLASS); putRaw(ex + 12, y, GLASS); }
  rectFill(ex + 1, py + 2, 11, 10, ICE);
  rectFill(ex + 1, py - 4, 11, 4, SNOW);
  rectFill(ex - 8, py + 2, 6, 10, SNOW);
  // return line back down to the boiler
  for (let y = py + 14; y < by + bh - 4; y++) for (let x = ex - 4; x < ex; x++) putRaw(x, y, GLASS);
  for (let x = bx + bw - 2; x < ex - 3; x++) { putRaw(x, by + bh - 4, GLASS); }
  // a charge of gunpowder near the flue for a surprise
  addVent(bx + 3, by - 2, STEAM, 130, 4, 1, 2);
  discFill(Math.round(W * 0.86), Math.round(H * 0.7), 4, POWDER, null);
  discFill(Math.round(W * 0.9), Math.round(H * 0.66), 3, GAS, null);
});

preset('Frozen Lake', function () {
  P.ambient = -16;
  const surf = Math.round(H * 0.44), bot = H - 4;
  for (let y = surf; y < bot; y++) for (let x = 0; x < W; x++) putRaw(x, y, WATER, 3, null);
  for (let y = surf - 9; y < surf; y++) for (let x = 0; x < W; x++) putRaw(x, y, ICE, -8, null);
  for (let x = 0; x < W; x++) {
    const h = 2 + ri(4);
    for (let y = surf - 10 - h; y < surf - 9; y++) if (rnd() < 0.7) putRaw(x, y, SNOW, -12, null);
  }
  // geothermal plume under the ice
  discFill(Math.round(W * 0.5), bot - 3, Math.round(W * 0.07), LAVA, null);
  rectFill(Math.round(W * 0.2), bot - 6, 18, 4, STONE);
  rectFill(Math.round(W * 0.74), bot - 6, 20, 4, STONE);
  // a few conifers on the ice
  for (let k = 0; k < 9; k++) {
    const x = 6 + ri(Math.max(2, W - 12));
    const y = surf - 12 - ri(4);
    putRaw(x, y, WOOD, -6, null);
    putRaw(x, y - 1, PLANT, -6, 40);
    putRaw(x - 1, y - 1, PLANT, -6, 40);
    putRaw(x + 1, y - 1, PLANT, -6, 40);
  }
});

preset('Plant Ecosystem', function () {
  P.ambient = 26;
  const soilY = Math.round(H * 0.7);
  rectFill(0, soilY, W, H - soilY, SOIL);
  for (let x = 0; x < W; x++) if (rnd() < 0.35) putRaw(x, soilY - 1, SOIL, 22, null);
  // pond with a shallow shore
  const pondX = Math.round(W * 0.08), pondW = Math.round(W * 0.24);
  for (let y = soilY - 5; y < soilY + 3; y++) for (let x = pondX; x < pondX + pondW; x++) putRaw(x, y, WATER, 22, null);
  rectFill(pondX + pondW, soilY - 5, 3, 8, SAND);
  // damp mossy band that will crawl across the soil
  for (let k = 0; k < 16; k++) {
    const x = pondX + pondW + 2 + ri(6);
    putRaw(x, soilY - 2 - ri(2), PLANT, 25, 44);
  }
  for (let k = 0; k < 10; k++) {
    const x = Math.round(W * 0.4) + ri(Math.max(2, Math.round(W * 0.5)));
    putRaw(x, soilY - 2, PLANT, 25, 44);
    if (rnd() < 0.5) putRaw(x, soilY - 3, WATER, 22, null);
  }
  // a shallow glass lid keeps the humidity in
  for (let x = Math.round(W * 0.32); x < W - 4; x++) putRaw(x, Math.round(H * 0.3), GLASS);
  discFill(Math.round(W * 0.5), Math.round(H * 0.86), 5, SOIL, null);
});

preset('Fireworks Chain', function () {
  P.ambient = 22;
  rectFill(0, H - 5, W, 5, STONE);
  rectFill(0, H - 8, W, 3, SAND);
  // powder trail from a battery across the floor
  lineFill(4, H - 10, W - 6, H - 10, POWDER, 2);
  rectFill(3, H - 13, 5, 4, BATT);
  lineFill(8, H - 11, W - 8, H - 12, CHAR, 1);
  // suspended shells on wires
  const nShells = Math.max(4, Math.round(W / 44));
  for (let k = 0; k < nShells; k++) {
    const x = Math.round(W * (0.16 + k * 0.13));
    const y = Math.round(H * (0.24 + (k % 3) * 0.14));
    lineFill(x, 2, x, y, METAL, 1);
    discFill(x, y + 5, 4 + (k % 2), POWDER, null);
    rectFill(x - 6, y + 10, 12, 3, CHAR);
    if (k % 2 === 1) discFill(x + 12, y, 5, GAS, null);
    if (k % 3 === 0) rectFill(x - 8, y + 14, 16, 3, OIL);
  }
  // a stacked magazine in the corner
  rectFill(Math.round(W * 0.82), Math.round(H * 0.5), 16, 14, POWDER);
  rectFill(Math.round(W * 0.82) - 2, Math.round(H * 0.5) - 3, 20, 3, WOOD);
  discFill(Math.round(W * 0.68), Math.round(H * 0.72), 6, GAS, null);
  lineFill(10, H - 9, 26, H - 20, POWDER, 1);
});

preset('Dense Stress Test', function () {
  addVent(Math.round(W * 0.2), 6, GAS, 24, 8, 2, 3);
  addVent(Math.round(W * 0.8), 6, GAS, 24, 8, 2, 3);
  P.ambient = 30;
  const kinds = [SAND, WATER, OIL, SALT, WOOD, PLANT, STONE, METAL, ACID, GAS, POWDER, STEAM,
  RUST, CHAR, SOIL, BRINE, SNOW, GLASS, PLASTIC, MOLTEN, LAVA, ASH];
  rectFill(0, H - 10, W, 10, LAVA);
  rectFill(0, 0, W, 6, WATER);
  const blobs = Math.max(120, Math.round(W * H / 130));
  for (let k = 0; k < blobs; k++) {
    const m = kinds[ri(kinds.length)];
    const x = ri(W), y = ri(H);
    const r = 2 + ri(7);
    discFill(x, y, r, m, 0.55 + rnd() * 0.4);
  }
  for (let k = 0; k < 40; k++) {
    const x = ri(W), y = ri(H);
    rectFill(x, y, 3 + ri(9), 3 + ri(9), rnd() < 0.5 ? FIRE : STEAM, 0.7);
  }
});

/* =====================================================================
   MAIN LOOP, CONTROLS, INPUT, PERSISTENCE
   ===================================================================== */
let curPreset = 0, curSeed = 1337;

function resizeCanvas() {
  const r = stage.getBoundingClientRect();
  cssW = Math.max(80, r.width); cssH = Math.max(80, r.height);
  dpr = Math.min(2.5, window.devicePixelRatio || 1);
  const nw = Math.max(24, Math.floor(cssW / P.cellPx));
  const nh = Math.max(24, Math.floor(cssH / P.cellPx));
  viewW = Math.round(cssW * dpr); viewH = Math.round(cssH * dpr);
  if (view.width !== viewW || view.height !== viewH) { view.width = viewW; view.height = viewH; }
  if (nw !== W || nh !== H) {
    const keep = N > 0;
    rebuildGrid(nw, nh, keep);
    setupBuffers();
  }
}

/* ---------- timing ---------- */
let lastT = 0, acc = 0, fpsAvg = 60, stepMs = 0, drawMs = 0, frames = 0, fpsFrames = 0, fpsTime = 0;
let hudWindow = 0, lastHudMs = 0;
let stepCountThisSec = 0;

function loop(now) {
  if (!lastT) lastT = now;
  let dt = (now - lastT) / 1000;
  lastT = now;
  if (dt > 0.25) dt = 0.25;
  fpsTime += dt; frames++; fpsFrames++;
  if (fpsTime >= 0.5) { fpsAvg = fpsFrames / fpsTime; fpsTime = 0; fpsFrames = 0; }
  const t0 = performance.now();
  if (!paused) {
    acc += dt;
    const sdt = 1 / Math.max(1, P.speed);
    let guard = 0;
    while (acc >= sdt && guard < 8) {
      for (let s = 0; s < P.substeps; s++) stepSim();
      acc -= sdt;
      guard++;
      stepCountThisSec++;
      if (performance.now() - t0 > 15) { acc = 0; break; }
    }
  } else { acc = 0; }
  stepMs = stepMs * 0.8 + (performance.now() - t0) * 0.2;
  const t1 = performance.now();
  renderFrame();
  drawMs = drawMs * 0.8 + (performance.now() - t1) * 0.2;
  if (performance.now() - lastHudMs > 250) { updateHud((performance.now() - lastHudMs) / 1000); lastHudMs = performance.now(); }
  if (frames % 30 === 0) censusSlice();
  requestAnimationFrame(loop);
}

/* ---------- HUD ---------- */
const topMats = [];
function updateHud(win) {
  const secs = Math.max(0.05, win);
  hudEls.fps.textContent = fpsAvg.toFixed(0);
  hudEls.grid.textContent = W + '×' + H;
  hudEls.active.textContent = activeChunks + ' ch';
  hudEls.cells.textContent = censusCells;
  hudEls.temp.textContent = censusTemp.toFixed(1) + '°C';
  hudEls.rxn.textContent = rxnCount;
  const tl = TOOLS.find(t => t.id === ui.tool);
  hudEls.tool.textContent = tl ? tl.label : ui.tool;
  hudEls.speed.textContent = (stepCountThisSec / secs).toFixed(0) + ' eff/s';
  hudEls.mat.textContent = NAMES[ui.mat];
  hudEls.state.textContent = paused ? 'PAUSED' : 'RUNNING';
  hudEls.mode.textContent = MODES[P.mode].name;
  hudEls.steps.textContent = (stepCountThisSec / secs).toFixed(0) + ' st/s';
  stepCountThisSec = 0;
  hudEls.simt.textContent = stepMs.toFixed(1) + ' ms';
  hudEls.drawt.textContent = drawMs.toFixed(1) + ' ms';
  hudEls.legend.textContent = MODES[P.mode].legend;
  // material leaderboard
  let total = 0;
  for (let i = 1; i < counts.length; i++) total += counts[i];
  topMats.length = 0;
  for (let i = 1; i < counts.length; i++) if (counts[i] > 0) topMats.push(i);
  topMats.sort((a, b) => counts[b] - counts[a]);
  const take = topMats.slice(0, 8);
  let html = '';
  for (const mi of take) {
    const c = MATS[mi].col;
    const pct = total ? (counts[mi] * 100 / total) : 0;
    html += '<span><i style="background:rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')"></i>' +
      NAMES[mi] + '<b>' + pct.toFixed(1) + '%</b></span>';
  }
  hudEls.mats.innerHTML = html;
}

/* ---------- controls ---------- */
function bindRange(id, outId, fmt, apply) {
  const el = document.getElementById(id), out = document.getElementById(outId);
  const run = () => { const v = parseFloat(el.value); out.textContent = fmt(v); apply(v); };
  el.addEventListener('input', run);
  el.addEventListener('change', run);
  run();
}
function bindCheck(id, apply) {
  const el = document.getElementById(id);
  el.addEventListener('change', () => apply(el.checked));
  apply(el.checked);
}

function buildUI() {
  // tools
  const tg = document.getElementById('tool-grid');
  TOOLS.forEach(t => {
    const b = document.createElement('button');
    b.textContent = t.label + ' [' + t.key + ']';
    b.dataset.tool = t.id;
    b.setAttribute('aria-pressed', String(t.id === ui.tool));
    b.addEventListener('click', () => setTool(t.id));
    tg.appendChild(b);
  });
  // materials
  const mg = document.getElementById('mat-grid');
  NICE_MATS.forEach((mi, idx) => {
    const b = document.createElement('button');
    const c = MATS[mi].col;
    b.innerHTML = '<i style="background:rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')"></i><span>' + NAMES[mi] + '</span>';
    b.dataset.mat = String(mi);
    b.title = NAMES[mi] + ' — ' + (MATS[mi].hint || CAT_NAME[MATS[mi].cat]) +
      ' · d=' + MATS[mi].dens + (idx < 10 ? ' · key ' + ((idx + 1) % 10) : '');
    b.setAttribute('aria-pressed', String(mi === ui.mat));
    b.addEventListener('click', () => setMaterial(mi));
    mg.appendChild(b);
  });
  // view modes
  const vg = document.getElementById('view-grid');
  MODES.forEach((m, i) => {
    const b = document.createElement('button');
    b.textContent = m.name;
    b.dataset.mode = String(i);
    b.setAttribute('aria-pressed', String(i === P.mode));
    b.addEventListener('click', () => setMode(i));
    vg.appendChild(b);
  });
  // presets
  const pg = document.getElementById('preset-grid');
  PRESETS.forEach((p, i) => {
    const b = document.createElement('button');
    b.textContent = p.name;
    b.dataset.preset = String(i);
    b.setAttribute('aria-pressed', String(i === curPreset));
    b.addEventListener('click', () => { setPreset(i, true); });
    pg.appendChild(b);
  });
  markPressed('tool-grid', 'tool', ui.tool);
  markPressed('mat-grid', 'mat', String(ui.mat));
  markPressed('view-grid', 'mode', String(P.mode));
  markPressed('preset-grid', 'preset', String(curPreset));
}
function markPressed(gridId, attr, val) {
  const g = document.getElementById(gridId);
  if (!g) return;
  Array.prototype.forEach.call(g.children, (el) => {
    el.setAttribute('aria-pressed', String(el.dataset[attr] === String(val)));
  });
}
function setTool(id) {
  ui.tool = id;
  markPressed('tool-grid', 'tool', id);
  view.classList.toggle('pick', id === 'pick' || id === 'fill');
  const t = TOOLS.find(x => x.id === id);
  if (t) toast('tool: ' + t.label);
}
function setMaterial(mi) {
  ui.mat = mi;
  markPressed('mat-grid', 'mat', String(mi));
  if (ui.tool === 'erase' || ui.tool === 'fill') setTool('paint');
  toast('material: ' + NAMES[mi]);
}
function setMode(i) {
  P.mode = i;
  markPressed('view-grid', 'mode', String(i));
}
function setPreset(i, reseed) {
  curPreset = i;
  if (reseed) { /* keep seed, deterministic rebuild */ }
  const s = parseInt(document.getElementById('s-seed').value, 10);
  curSeed = isNaN(s) ? 1337 : s;
  srand(curSeed);
  clearWorld();
  P.ambient = 20;
  PRESETS[i].fn();
  setGravityDir(P.gdir);
  markPressed('preset-grid', 'preset', String(i));
  toast('preset: ' + PRESETS[i].name + '  (seed ' + curSeed + ')');
  for (let k = 0; k < 4; k++) censusSlice();
  updateHud();
}
