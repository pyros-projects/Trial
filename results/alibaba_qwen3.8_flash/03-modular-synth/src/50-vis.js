/* ============================================================
   MODSYN-8 — module 50: canvas visuals, meters, status, RAF loop
   ============================================================ */

var Vis = { hist: [], lastStep: -1, q: 2, fTimes: [], clipCount: 0, clipHot: 0, n: 0 };
var HEAT = (function () {
  var out = [];
  for (var i = 0; i < 40; i++) {
    var f = i / 39;
    var r = Math.round(lerp(8, 255, Math.pow(f, 0.75)));
    var g = Math.round(lerp(20, 235, Math.pow(f, 1.5)));
    var b = Math.round(lerp(40, 255, 1 - Math.pow(f, 2.6)));
    out.push('rgb(' + r + ',' + g + ',' + b + ')');
  }
  return out;
})();

function fitCanvas(c) {
  var q = App.vis.quality;
  var dpr = Math.min(window.devicePixelRatio || 1, q >= 2 ? 2 : 1);
  var w = c.clientWidth, h = c.clientHeight;
  if (!w || !h) return null;
  var W = Math.max(1, Math.round(w * dpr)), H = Math.max(1, Math.round(h * dpr));
  if (c.width !== W || c.height !== H) { c.width = W; c.height = H; c._dirty = true; }
  var x = c.getContext('2d');
  x.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { x: x, w: w, h: h, W: W, H: H, dpr: dpr };
}

/* ---------- oscilloscope ---------- */
function drawScope() {
  var c = $('#scope');
  var f = fitCanvas(c);
  if (!f) return;
  var x = f.x, w = f.w, h = f.h;
  x.clearRect(0, 0, w, h);
  x.fillStyle = '#080c11'; x.fillRect(0, 0, w, h);
  var E = App.E;
  if (!E) return;
  /* grid */
  x.strokeStyle = 'rgba(80,110,140,.18)'; x.lineWidth = 1;
  x.beginPath();
  for (var gx = 1; gx < 8; gx++) { var px = w * gx / 8; x.moveTo(px, 0); x.lineTo(px, h); }
  x.moveTo(0, h / 2); x.lineTo(w, h / 2);
  x.stroke();
  var buf = E.bufScope;
  E.anScope.getFloatTimeDomainData(buf);
  var n = Math.min(1024, buf.length);
  var mid = h / 2, amp = h * 0.46;
  /* right channel (dim) */
  x.strokeStyle = 'rgba(255,93,143,.45)';
  x.beginPath();
  for (var i2 = 0; i2 < n; i2++) {
    var v2 = buf[i2 + n];
    var yy2 = mid - v2 * amp;
    if (i2 === 0) x.moveTo(0, yy2); else x.lineTo(i2 / n * w, yy2);
  }
  x.stroke();
  /* left channel */
  x.strokeStyle = '#39d7ee';
  x.lineWidth = 1.2;
  x.shadowColor = 'rgba(57,215,238,.6)'; x.shadowBlur = 4;
  x.beginPath();
  for (var i = 0; i < n; i++) {
    var v = buf[i];
    var yy = mid - v * amp;
    if (i === 0) x.moveTo(0, yy); else x.lineTo(i / n * w, yy);
  }
  x.stroke();
  x.shadowBlur = 0;
  if (App.playing) {
    var pos = vizPos();
    if (pos) {
      x.fillStyle = 'rgba(255,180,84,.85)';
      x.fillRect(w * (pos.f % 1) - 1, 0, 2, h);
    }
  }
}

/* ---------- spectrum ---------- */
function drawSpec() {
  var c = $('#spec');
  var f = fitCanvas(c);
  if (!f) return;
  var x = f.x, w = f.w, h = f.h;
  x.clearRect(0, 0, w, h);
  x.fillStyle = '#080c11'; x.fillRect(0, 0, w, h);
  var E = App.E;
  if (!E) return;
  var d = E.bufSpec;
  E.anSpec.getFloatFrequencyData ? E.anSpec.getFloatFrequencyData(d) : E.anSpec.getByteFrequencyData(d);
  var bands = 56;
  var bw = w / bands;
  var nyq = E.ctx.sampleRate / 2;
  var bins = d.length;
  for (var b = 0; b < bands; b++) {
    var f0 = 30 * Math.pow(nyq / 30, b / bands);
    var f1 = 30 * Math.pow(nyq / 30, (b + 1) / bands);
    var i0 = Math.floor(f0 / nyq * bins), i1 = Math.max(i0 + 1, Math.floor(f1 / nyq * bins));
    var mx = -140;
    for (var i = i0; i < i1 && i < bins; i++) if (d[i] > mx) mx = d[i];
    var v = clamp((mx + 92) / 74, 0, 1);
    var bh = v * h;
    x.fillStyle = HEAT[Math.min(39, Math.floor(v * 39))];
    x.fillRect(b * bw + 0.5, h - bh, Math.max(1, bw - 1.2), bh);
  }
  x.fillStyle = 'rgba(120,140,160,.75)';
  x.font = '7px monospace';
  [100, 1000, 10000].forEach(function (hz) {
    var px = Math.log(hz / 30) / Math.log(nyq / 30) * w;
    x.fillRect(px, 0, 1, 5);
    x.fillText(hz >= 1000 ? (hz / 1000) + 'k' : hz + '', px + 2, 7);
  });
}

/* ---------- scrolling spectrogram ---------- */
function drawSpectro() {
  var c = $('#spectro');
  var f = fitCanvas(c);
  if (!f) return;
  var x = f.x, w = f.w, h = f.h;
  var E = App.E;
  if (!E) return;
  var buf = Vis.specBuf;
  if (!buf) { buf = document.createElement('canvas'); Vis.specBuf = buf; }
  if (buf.width !== f.W || buf.height !== f.H) {
    buf.width = f.W; buf.height = f.H;
    var b0 = buf.getContext('2d');
    b0.fillStyle = '#070a0e'; b0.fillRect(0, 0, f.W, f.H);
  }
  var bx = buf.getContext('2d');
  var step = 2;
  bx.globalCompositeOperation = 'copy';
  bx.drawImage(buf, -step, 0);
  bx.globalCompositeOperation = 'source-over';
  var d = E.bufSpec;
  E.anSpec.getFloatFrequencyData ? E.anSpec.getFloatFrequencyData(d) : E.anSpec.getByteFrequencyData(d);
  var rows = 30;
  var nyq = E.ctx.sampleRate / 2;
  var rh = h / rows;
  var bins = d.length;
  for (var r = 0; r < rows; r++) {
    var f1 = 30 * Math.pow(nyq / 30, (rows - r) / rows);
    var f0 = 30 * Math.pow(nyq / 30, (rows - r - 1) / rows);
    var i0 = Math.floor(f0 / nyq * bins), i1 = Math.max(i0 + 1, Math.floor(f1 / nyq * bins));
    var mx = -140;
    for (var i = i0; i < i1 && i < bins; i++) if (d[i] > mx) mx = d[i];
    var v = clamp((mx + 90) / 70, 0, 1);
    x.fillStyle = HEAT[Math.min(39, Math.floor(v * 39))];
    x.fillRect(w - step, r * rh, step, rh + 0.6);
  }
  x.drawImage(buf, 0, 0, f.W, f.H, 0, 0, w, h);
  x.fillStyle = 'rgba(160,180,200,.5)';
  x.font = '7px monospace';
  x.fillText('SPECTROGRAM · newest at right', 4, 8);
}

/* ---------- stereo phase (Lissajous + correlation) ---------- */
function drawPhase() {
  var c = $('#phase');
  var f = fitCanvas(c);
  if (!f) return;
  var x = f.x, w = f.w, h = f.h;
  x.fillStyle = '#080c11'; x.fillRect(0, 0, w, h);
  var E = App.E;
  if (!E) return;
  E.anPk.getFloatTimeDomainData(E.bufPk);
  var n = 512;
  var m = Math.min(f.w, f.h);
  var cx = m / 2, cy = h / 2, rr = m / 2 - 3;
  x.strokeStyle = 'rgba(90,120,150,.3)';
  x.beginPath(); x.moveTo(cx, 2); x.lineTo(cx, h - 2); x.moveTo(2, cy); x.lineTo(w - 2, cy); x.stroke();
  x.strokeStyle = 'rgba(255,180,84,.25)';
  x.beginPath(); x.moveTo(2, 2); x.lineTo(w - 2, h - 2); x.stroke();
  x.strokeStyle = '#57e08a';
  x.lineWidth = 1;
  x.beginPath();
  for (var i = 0; i < n; i++) {
    var l = E.bufPk[i], r = E.bufPk[i + n];
    x.lineTo(cx + l * rr, cy - r * rr);
  }
  x.stroke();
  var mtr = readMaster(E);
  var bx = 3, by = h - 8, bw = w - 6;
  x.fillStyle = '#111721'; x.fillRect(bx, by, bw, 5);
  var cc = mtr.corr;
  x.fillStyle = cc > 0.2 ? '#39d7ee' : (cc < -0.2 ? '#ff5d8f' : '#ffb454');
  var cxp = bx + bw / 2;
  x.fillRect(cc >= 0 ? cxp : cxp + cc * bw / 2, by, Math.abs(cc) * bw / 2, 5);
  x.fillStyle = 'rgba(200,215,230,.7)';
  x.font = '7px monospace';
  x.fillText('PHASE ' + (cc >= 0 ? '+' : '') + cc.toFixed(2), 3, 8);
  App.lastCorr = cc;
}

/* ---------- note history ---------- */
function drawHistory() {
  var c = $('#history');
  var f = fitCanvas(c);
  if (!f) return;
  var x = f.x, w = f.w, h = f.h;
  x.fillStyle = '#080c11'; x.fillRect(0, 0, w, h);
  if (!App.ctx) return;
  var now = App.ctx.currentTime;
  var span = 3.0;
  x.strokeStyle = 'rgba(80,110,140,.15)';
  x.beginPath();
  for (var g = 1; g < 6; g++) { x.moveTo(w * g / 6, 0); x.lineTo(w * g / 6, h); }
  x.stroke();
  var H = Vis.hist;
  for (var i = 0; i < H.length; i++) {
    var e = H[i];
    var age = now - e.t;
    if (age > span || age < 0) continue;
    var px = w - (age / span) * w;
    var py = e.perc ? h - 6 : h - ((clamp(e.p, 24, 108) - 24) / 84) * (h - 10) - 4;
    var bh = e.perc ? 4 : 3;
    x.globalAlpha = clamp(1 - age / span, 0.08, 1);
    x.fillStyle = e.col;
    x.fillRect(px - 1.5, py - bh / 2, 3.4, bh);
  }
  x.globalAlpha = 1;
  x.fillStyle = 'rgba(200,215,230,.7)';
  x.font = '7px monospace';
  x.fillText('NOTE HISTORY', 4, 8);
  x.fillStyle = 'rgba(120,140,160,.4)';
  x.fillText('lo', 3, h - 3);
  x.fillText('hi', 3, 16);
}

/* ---------- piano roll drawing ---------- */
function rollCacheKey(g) {
  return [g.w, g.h, Math.round(g.rowH * 100), g.lo, g.hi, App.proj.steps, Roll.snapScale ? 1 : 0,
    App.proj.root, App.proj.scale].join('|');
}
function drawRoll() {
  var c = $('#roll');
  var f = fitCanvas(c);
  if (!f) return;
  var x = f.x, w = f.w, h = f.h;
  var g = rollGeo();
  var t = rollTrack();
  var key = rollCacheKey(g);
  if (!Roll.cache || Roll.cache.key !== key || Roll.dirty) {
    var buf = Roll.cache && Roll.cache.buf;
    if (!buf) { buf = document.createElement('canvas'); Roll.cache = { buf: buf }; }
    if (buf.width !== f.W || buf.height !== f.H) { buf.width = f.W; buf.height = f.H; }
    var bx = buf.getContext('2d');
    bx.setTransform(f.dpr, 0, 0, f.dpr, 0, 0);
    bx.fillStyle = '#0b0f15'; bx.fillRect(0, 0, w, h);
    /* rows */
    var blacks = [1, 3, 6, 8, 10];
    for (var r = 0; r < g.rows; r++) {
      var pitch = g.hi - 1 - r;
      var isBlack = blacks.indexOf(((pitch % 12) + 12) % 12) >= 0;
      bx.fillStyle = isBlack ? '#0e131a' : '#121822';
      bx.fillRect(Roll.gutter, r * g.rowH, w - Roll.gutter, g.rowH);
      var inKey = scaleHas(App.proj.root, App.proj.scale, pitch);
      if (Roll.snapScale && inKey) {
        bx.fillStyle = 'rgba(57,215,238,.07)';
        bx.fillRect(Roll.gutter, r * g.rowH, w - Roll.gutter, g.rowH);
      }
      /* piano key strip */
      bx.fillStyle = isBlack ? '#1a212b' : '#c8d3e0';
      bx.fillRect(0, r * g.rowH + 0.5, Roll.gutter - 4, g.rowH - 1.5);
      bx.fillStyle = isBlack ? '#7f8ea3' : '#1b222c';
      bx.font = '7px monospace';
      bx.fillText(midiName(pitch), 3, r * g.rowH + g.rowH - 3.2);
      if (pitch % 12 === 0) {
        bx.strokeStyle = 'rgba(255,180,84,.35)';
        bx.beginPath(); bx.moveTo(Roll.gutter, r * g.rowH); bx.lineTo(w, r * g.rowH); bx.stroke();
      }
    }
    /* columns */
    for (var s = 0; s <= g.steps; s++) {
      var px = Roll.gutter + s * g.colW;
      bx.strokeStyle = s % 16 === 0 ? 'rgba(255,255,255,.28)' : (s % 4 === 0 ? 'rgba(255,255,255,.14)' : 'rgba(255,255,255,.05)');
      bx.beginPath(); bx.moveTo(px, 0); bx.lineTo(px, g.plotH); bx.stroke();
    }
    /* velocity lane */
    bx.fillStyle = '#0d1118';
    bx.fillRect(0, g.plotH, w, g.lane);
    bx.fillStyle = 'rgba(140,160,180,.55)';
    bx.font = '7px monospace';
    bx.fillText('VELOCITY', 3, g.plotH + 8);
    Roll.cache.key = key;
    Roll.dirty = false;
    Vis.rollRepaints = (Vis.rollRepaints || 0) + 1;
  }
  x.drawImage(Roll.cache.buf, 0, 0, f.W, f.H, 0, 0, w, h);
  if (!t) {
    x.fillStyle = '#5d6a7a';
    x.font = '10px monospace';
    x.fillText('percussion track — use the step grid above (velocity: shift+click)', 8, 18);
    return;
  }
  /* notes */
  var notes = t.notes;
  for (var i = 0; i < notes.length; i++) {
    var n = notes[i];
    if (n.p < g.lo - 1 || n.p > g.hi) continue;
    var nx = Roll.gutter + n.t * g.colW;
    var nw = Math.max(2.5, n.d * g.colW - 1.5);
    var ny = (g.hi - 1 - n.p) * g.rowH;
    var a = 0.35 + (n.v / 127) * 0.65;
    x.fillStyle = 'rgba(57,215,238,' + a.toFixed(2) + ')';
    x.fillRect(nx + 0.5, ny + 0.5, nw, Math.max(2, g.rowH - 1.5));
    x.strokeStyle = 'rgba(210,245,255,.5)';
    x.lineWidth = 0.7;
    x.strokeRect(nx + 0.5, ny + 0.5, nw, Math.max(2, g.rowH - 1.5));
    if (n === Roll.sel) {
      x.strokeStyle = '#ffb454';
      x.lineWidth = 1.4;
      x.strokeRect(nx, ny, nw + 1, g.rowH);
    }
    /* velocity bar */
    if (n.t < g.steps) {
      var vx = Roll.gutter + n.t * g.colW;
      var vh = (n.v / 127) * (g.lane - 6);
      x.fillStyle = n.v >= 110 ? 'rgba(255,180,84,.9)' : 'rgba(87,224,138,.75)';
      x.fillRect(vx + 0.5, g.plotH + g.lane - 3 - vh, Math.max(2, g.colW - 1.4), vh);
    }
  }
  /* playhead */
  var pos = App.playing ? vizPos() : null;
  if (pos) {
    var phx = Roll.gutter + pos.pos * g.colW;
    x.strokeStyle = 'rgba(255,255,255,.85)';
    x.lineWidth = 1.2;
    x.beginPath(); x.moveTo(phx, 0); x.lineTo(phx, g.plotH); x.stroke();
    x.fillStyle = 'rgba(255,93,143,.25)';
    x.fillRect(phx, 0, g.colW, g.plotH);
  }
}

/* ---------- meters ---------- */
function updateMeters() {
  var E = App.E;
  if (!E) return;
  var mm = readMaster(E);
  var mEl = $('#master-meter');
  if (mEl) {
    var lvl = clamp(mm.rms * 2.6, 0, 1);
    var pk = clamp(mm.peak, 0, 1);
    var v = Math.max(lvl, pk * 0.92);
    mEl._a.style.transform = 'scaleX(' + v.toFixed(3) + ')';
    mEl._b.style.transform = 'scaleX(' + (v * 0.94).toFixed(3) + ')';
  }
  App.outLvl = mm.rms;
  App.outPeak = mm.peak;
  if (mm.peak > 0.999) { Vis.clipCount++; Vis.clipHot = 6; }
  if (Vis.clipHot > 0) Vis.clipHot--;
  var clip = $('#clip-led');
  if (clip) clip.classList.toggle('hot', Vis.clipHot > 0);
  App.proj.tracks.forEach(function (t) {
    var w = widgets.track[t.id];
    if (!w || !w.meter) return;
    var v2 = readTrack(E, t.id);
    var s = clamp(v2 * 3.2, 0, 1);
    w.meter._a.style.transform = 'scaleX(' + s.toFixed(3) + ')';
    var act = 0;
    for (var i = 0; i < E.active.length; i++) if (E.active[i].t === t.id) act++;
    w.meter._b.style.transform = 'scaleX(' + Math.min(1, act / 6).toFixed(3) + ')';
    w.meter.title = t.name + ' · rms ' + Math.round(gainToDb(v2)) + 'dB · ' + act + ' voices';
  });
}

/* ---------- playhead + status ---------- */
function updatePlayhead() {
  var ph = Seq.head;
  if (!ph) return;
  var pos = vizPos();
  if (!pos) { ph.style.opacity = '0'; return; }
  ph.style.opacity = '1';
  ph.style.transform = 'translateX(' + seqHeadX(pos.pos) + 'px)';
  var st = Math.floor(pos.pos) % App.proj.steps;
  if (st !== Vis.lastStep) {
    var prev = Vis.lastStep;
    if (prev >= 0) {
      App.proj.tracks.forEach(function (t) {
        var arr = Seq.cells[t.id];
        if (arr && arr[prev]) arr[prev].classList.remove('cur');
      });
    }
    App.proj.tracks.forEach(function (t2) {
      var arr2 = Seq.cells[t2.id];
      if (arr2 && arr2[st]) arr2[st].classList.add('cur');
    });
    Vis.lastStep = st;
    $('#seq-pos').textContent = (st + 1) + ' / ' + App.proj.steps;
  }
}
function statusText() {
  var E = App.E;
  var st = App.ctx ? App.ctx.state : 'none';
  $('#c-ctx').textContent = 'CTX · ' + st + (E ? ' @' + Math.round(App.ctx.sampleRate / 100) / 10 + 'k' : '');
  $('#c-bpm').textContent = 'BPM · ' + App.proj.tempo.toFixed(1) + '  swing ' + App.proj.swing + '%';
  var pos = vizPos();
  $('#c-step').textContent = 'STEP · ' + (pos ? (Math.floor(pos.pos) % App.proj.steps + 1) + '/' + App.proj.steps : 'idle');
  $('#c-la').textContent = 'LOOK-AHEAD · ' + Math.round(App.lookahead * 1000) + 'ms · lead ' +
    (App.schedLead !== undefined ? Math.round(App.schedLead * 1000) : 0) + 'ms';
  var act = E ? E.active.length : 0;
  $('#c-vox').textContent = 'VOICES · ' + act + '/' + (E ? E.maxTotal : 48) + (E && E.dropped ? ' drop ' + E.dropped : '');
  var fm = App.vis.frameMs || 0;
  $('#c-load').textContent = 'GFX · ' + fm.toFixed(1) + 'ms/f · Q' + App.vis.quality +
    ' · tick-late ' + App.lateCount;
  var rms = App.outLvl || 0;
  $('#c-out').textContent = 'OUT · ' + (rms > 0.0002 ? gainToDb(rms).toFixed(1) : '-∞') + ' dB rms · pk ' +
    ((App.outPeak || 0) > 0.0002 ? gainToDb(App.outPeak).toFixed(1) : '-∞');
  var cc = $('#c-clip');
  cc.textContent = 'CLIP · ' + (Vis.clipCount ? Vis.clipCount + ' hits' : 'none');
  cc.className = 'chip' + (Vis.clipHot > 0 ? ' bad' : (Vis.clipCount ? ' warn' : ''));
  var dr = App.driftMs || 0;
  $('#c-drift').textContent = 'DRIFT · ' + (dr >= 0 ? '+' : '') + dr.toFixed(2) + 'ms';
  $('#c-msg').textContent = App.msg;
}

/* ---------- main loop ---------- */
var rafId = null;
function frame() {
  rafId = requestAnimationFrame(frame);
  var t0 = performance.now();
  Vis.n++;
  if (!App.audioReady) { if (Vis.n % 20 === 0) statusText(); return; }
  if (App.playing) pruneActive(App.E, App.ctx.currentTime);
  var q = App.vis.quality;
  if (App.playing) { updatePlayhead(); }
  else if (Seq.head) { Seq.head.style.opacity = '0'; Vis.lastStep = -1; }
  drawRoll();
  var phase = Vis.n % 2;
  if (q >= 1 || phase === 0) {
    drawScope();
    drawSpec();
  }
  if (App.playing) {
    if (q >= 2 || phase === 0) drawSpectro();
    if (q >= 1 || phase === 1) drawPhase();
    if (q >= 1) drawHistory();
  } else {
    drawPhase();
    if (q >= 1 && phase === 0) drawHistory();
  }
  if (q >= 2 || phase === 0) updateMeters();
  if (Vis.n % 6 === 0) statusText();
  /* history harvest happens in the scheduler */
  var dt = performance.now() - t0;
  Vis.fTimes.push(dt);
  if (Vis.fTimes.length > 45) {
    Vis.fTimes.shift();
    var avg = Vis.fTimes.reduce(function (a, b) { return a + b; }, 0) / Vis.fTimes.length;
    App.vis.frameMs = avg;
    if (Vis.n % 90 === 0) {
      if (avg > 20 && App.vis.quality > 0) { App.vis.quality--; toast('visuals degraded to Q' + App.vis.quality + ' (frame ' + avg.toFixed(1) + 'ms)'); }
      else if (avg < 8 && App.vis.quality < 2) { App.vis.quality++; }
    }
  } else if (Vis.fTimes.length === 44) {
    App.vis.frameMs = Vis.fTimes.reduce(function (a, b) { return a + b; }, 0) / Vis.fTimes.length;
  }
}