/* ============================================================
   MODSYN-8 — module 45: step grid + piano roll editor
   ============================================================ */

var Roll = {
  dirty: true, lo: 45, rows: 30, lane: 24, gutter: 44,
  track: 'lead', snap: 1, snapScale: true,
  sel: null, mode: null, drag: null, hint: ''
};

/* keep the visible register around the music of the edited track */
function rollFit(tid) {
  var notes = notesOf(Roll.track);
  if (!notes || !notes.length) { Roll.lo = 45; Roll.rows = 30; Roll.dirty = true; return; }
  var lo = 127, hi = 0;
  notes.forEach(function (n) { if (n.p < lo) lo = n.p; if (n.p > hi) hi = n.p; });
  var span = clamp((hi - lo) + 7, 13, 36);
  var start = clamp(lo - 3, 12, 127 - span);
  if (hi > start + span) start = clamp(hi - span + 3, 12, 127 - span);
  Roll.lo = start;
  Roll.rows = span;
  Roll.dirty = true;
}

/* ---------- geometry (shared by draw + hit-test) ---------- */
function rollGeo() {
  var c = $('#roll');
  var w = c.clientWidth || 420, h = c.clientHeight || 200;
  var plotH = Math.max(40, h - Roll.lane);
  /* never draw rows thinner than ~6.5px: fewer visible semitones, but readable
     and clickable. Shared by painter + hit-test, so what you see is what you hit. */
  var rows = clamp(Roll.rows || 30, 8, 48);
  rows = clamp(Math.min(rows, Math.floor(plotH / 6.6)), 8, 48);
  var lo = clamp(Roll.lo, 0, 127 - rows);
  return {
    w: w, h: h, plotH: plotH, rows: rows, lo: lo, hi: lo + rows,
    rowH: (plotH / rows), colW: Math.max(3, (w - Roll.gutter) / Math.max(1, App.proj.steps)),
    steps: App.proj.steps, lane: Roll.lane
  };
}
function notesOf(tid) {
  var t = trackById(tid);
  return t && t.kind === 'mel' ? t.notes : null;
}
function rollTrack() {
  var t = trackById(Roll.track);
  return t && t.kind === 'mel' ? t : null;
}
function findNote(notes, t, p) {
  for (var i = notes.length - 1; i >= 0; i--) {
    var n = notes[i];
    if (n.p === p && t >= n.t && t < n.t + n.d) return n;
  }
  return null;
}
function rollHit(x, y) {
  var g = rollGeo();
  var notes = notesOf(Roll.track);
  if (!notes) return null;
  if (y >= g.plotH) return { type: 'lane', x: x };
  var row = Math.floor(y / g.rowH);
  var p = g.hi - 1 - row;
  if (x < Roll.gutter) return null;
  var tf = (x - Roll.gutter) / g.colW;
  var t = Math.floor(tf);
  /* find the note whose rect contains this pixel */
  for (var i = notes.length - 1; i >= 0; i--) {
    var n = notes[i];
    if (n.p !== p) continue;
    if (tf >= n.t && tf < n.t + n.d) {
      var edge = (n.t + n.d - tf) * g.colW;
      return { type: edge < 6 ? 'resize' : 'move', note: n, t: t, p: p };
    }
  }
  return { type: 'empty', t: t, p: p };
}

/* ---------- sequencer grid ---------- */
var Seq = { cells: {}, colCells: [], geo: { labw: 76, cellw: 21 } };

function buildSeq() {
  var host = $('#seqgrid');
  host.innerHTML = '';
  Seq.cells = {};
  Seq.colCells = [];
  var pr = App.proj;
  var steps = clamp(pr.steps | 0, 1, MAXSTEPS);

  /* ruler row */
  var ruler = el('div', 'srow');
  var rl = el('div', 'slab', 'STEP');
  ruler.appendChild(rl);
  var rc = el('div', 'cells');
  for (var s = 0; s < steps; s++) {
    var mk = el('div', 'cell ruler-cell' + (s % 4 === 0 ? ' beat' : ''));
    mk.style.pointerEvents = 'none';
    mk.style.opacity = '.5';
    mk.textContent = (s % 4 === 0) ? (s / 4 + 1) : '';
    mk.style.fontSize = '8px';
    mk.style.color = '#4b5563';
    rc.appendChild(mk);
  }
  ruler.appendChild(rc);
  host.appendChild(ruler);

  pr.tracks.forEach(function (t) {
    var row = el('div', 'srow');
    row.dataset.tid = t.id;
    var lab = el('div', 'slab' + (t.id === App.target ? ' sel' : ''));
    lab.innerHTML = '<span class="dot" style="background:' + t.color + '"></span>' + t.name;
    lab.dataset.tid = t.id;
    row.appendChild(lab);
    var cells = el('div', 'cells');
    var arr = [];
    for (var s2 = 0; s2 < steps; s2++) {
      var b = el('button', 'cell' + (s2 % 4 === 0 ? ' beat' : ''));
      b.type = 'button';
      b.dataset.t = t.id;
      b.dataset.s = String(s2);
      b.setAttribute('aria-label', t.name + ' step ' + (s2 + 1));
      cells.appendChild(b);
      arr.push(b);
    }
    Seq.cells[t.id] = arr;
    row.appendChild(cells);
    host.appendChild(row);
  });
  var ph = el('div', 'playhead-outer');
  ph.id = 'colhead';
  ph.style.cssText = 'position:absolute;top:0;left:0;width:21px;height:100%;pointer-events:none;' +
    'background:linear-gradient(180deg,rgba(255,255,255,.16),rgba(255,255,255,.03));' +
    'border-left:1px solid rgba(255,255,255,.6);opacity:0;z-index:3';
  host.appendChild(ph);
  Seq.head = ph;
  Seq.builtSteps = clamp(App.proj.steps | 0, 1, MAXSTEPS);
  App.proj.tracks.forEach(function (t) {
    for (var s = 0; s < Seq.builtSteps; s++) cellClass(t, s);
  });
}

function cellClass(t, s) {
  var pr = App.proj;
  var arr = Seq.cells[t.id];
  if (!arr || !arr[s]) return;
  var b = arr[s];
  var on = false, vel = 0, txt = '';
  if (t.kind === 'perc') {
    vel = t.steps[s] || 0;
    on = vel > 0;
  } else {
    var notes = (App.index[t.id] && App.index[t.id][s]) || [];
    if (notes.length) {
      on = true;
      vel = Math.max.apply(null, notes.map(function (n) { return n.v; }));
      txt = notes.length > 1 ? '•' + notes.length : midiName(notes[0].p);
    }
  }
  b.classList.toggle('on', on);
  b.classList.toggle('acc', on && vel >= 110);
  b.classList.toggle('v1', on && vel < 70);
  b.classList.toggle('v2', on && vel >= 98 && vel < 110);
  if (b.textContent !== txt) b.textContent = txt;
}

function repaintSeq() {
  var pr = App.proj;
  var steps = clamp(pr.steps | 0, 1, MAXSTEPS);
  var first = pr.tracks[0];
  if (!first || !Seq.cells[first.id] || Seq.builtSteps !== steps) {
    Seq.builtSteps = steps;
    buildSeq();
    return;
  }
  pr.tracks.forEach(function (t) {
    for (var s = 0; s < steps; s++) cellClass(t, s);
  });
}

function stepAtTime(tid, s) {
  var t = trackById(tid);
  if (!t) return 0;
  if (t.kind === 'perc') return t.steps[s] || 0;
  var n = App.index[t.id] && App.index[t.id][s];
  return n && n.length ? Math.max.apply(null, n.map(function (x) { return x.v; })) : 0;
}

/* ---- editing ---- */
function setStep(tid, s, mode, srcVel) {
  var pr = App.proj;
  var t = trackById(tid);
  if (!t || s < 0 || s >= pr.steps) return false;
  var changed = false;
  if (t.kind === 'perc') {
    var cur = t.steps[s];
    if (mode === 'off' || mode === 'clear') { if (cur) { t.steps[s] = 0; changed = true; } }
    else if (mode === 'cycle') {
      t.steps[s] = (cur === 0) ? 60 : (cur <= 60 ? 98 : (cur < 110 ? 127 : 0));
      changed = true;
    } else {
      var v = srcVel || 98;
      if (!cur) { t.steps[s] = v; changed = true; }
    }
  } else {
    var notes = t.notes;
    if (mode === 'off' || mode === 'clear') {
      for (var i = notes.length - 1; i >= 0; i--) {
        if (notes[i].t === s) { notes.splice(i, 1); changed = true; }
      }
    } else {
      var exists = false;
      for (var j = 0; j < notes.length; j++) if (notes[j].t === s) exists = true;
      if (!exists || mode === 'add') {
        if (!exists) {
          notes.push({ t: s, p: clamp(t.pitch || 60, 12, 108), d: clamp(t.gate || 2, 1, 32), v: srcVel || 98 });
          changed = true;
        }
      }
    }
  }
  if (changed) {
    rebuildIndex();
    cellClass(t, s);
    Roll.dirty = true;
    App.dirty = true;
  }
  return changed;
}

function shiftNotePitch(tid, s, semis) {
  var t = trackById(tid);
  if (!t || t.kind !== 'mel') return false;
  var pr = App.proj;
  var hit = false;
  t.notes.forEach(function (n) {
    if (Math.round(n.t) === s) {
      var np = clamp(n.p + semis, 12, 108);
      if (pr.scaleSnapOn) np = snapToScale(pr.root, pr.scale, np);
      if (np !== n.p) { n.p = np; hit = true; }
    }
  });
  if (hit) { rebuildIndex(); cellClass(t, s); Roll.dirty = true; App.dirty = true; }
  return hit;
}

/* pointer interaction on the grid */
function initSeqInput() {
  var host = $('#seqgrid');
  var paint = null;
  host.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  host.addEventListener('pointerdown', function (e) {
    var b = e.target.closest ? e.target.closest('.cell') : null;
    if (!b || !b.dataset.t) return;
    e.preventDefault();
    var tid = b.dataset.t, s = Number(b.dataset.s);
    var t = trackById(tid);
    if (!t) return;
    selectTrack(tid);
    var mode;
    if (e.button === 2 || e.altKey) mode = 'clear';
    else if (e.shiftKey) mode = 'cycle';
    else {
      var on = stepAtTime(tid, s) > 0;
      mode = on ? 'off' : 'on';
      if (t.kind === 'mel' && on && !e.shiftKey && !e.altKey) mode = 'pitch';
    }
    if (mode !== 'pitch') setStep(tid, s, mode === 'on' ? 'add' : mode, App.playVel);
    paint = { tid: tid, mode: mode, last: tid + ':' + s, startS: s, startP: t.pitch, y0: e.clientY };
    try { host.setPointerCapture(e.pointerId); } catch (err) { }
  });
  host.addEventListener('pointermove', function (e) {
    if (!paint || !e.buttons) return;
    var b = document.elementFromPoint(e.clientX, e.clientY);
    b = b && b.closest ? b.closest('.cell') : null;
    if (b && b.dataset && b.dataset.t) {
      var key = b.dataset.t + ':' + b.dataset.s;
      if (key !== paint.last) {
        paint.last = key;
        if (paint.mode !== 'pitch') {
          var on = stepAtTime(b.dataset.t, Number(b.dataset.s)) > 0;
          var m = paint.mode === 'on' ? (on ? 'none' : 'add') : paint.mode;
          if (m !== 'none' && m !== 'pitch') setStep(b.dataset.t, Number(b.dataset.s), m, App.playVel);
        }
      }
    }
    if (paint.mode === 'pitch') {
      var dy = paint.y0 - e.clientY;
      var delta = Math.round(dy / 7);
      if (delta !== 0 && Math.abs(delta - (paint.lastD || 0)) >= 1) {
        paint.lastD = delta;
        var t = trackById(paint.tid);
        t.notes.slice().forEach(function (n) {
          if (Math.round(n.t) === paint.startS) { n.p = clamp(n.p + delta, 12, 108); }
        });
        rebuildIndex();
        cellClass(t, paint.startS);
        Roll.dirty = true;
        App.dirty = true;
      }
    }
  });
  function endPaint() { paint = null; }
  host.addEventListener('pointerup', endPaint);
  host.addEventListener('pointercancel', endPaint);
  host.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var b = e.target.closest ? e.target.closest('.cell') : null;
    if (!b || !b.dataset.t) return;
    e.preventDefault();
    setStep(b.dataset.t, Number(b.dataset.s), 'add', App.playVel);
  });
}

function selectTrack(tid) {
  if (App.target === tid) return;
  App.target = tid;
  var t = trackById(tid);
  if (t && t.kind === 'mel') { Roll.track = tid; rollFit(tid); }
  $$('#tracklist .trk').forEach(function (r) { r.classList.toggle('sel', r.dataset.tid === tid); });
  $$('#seqgrid .slab').forEach(function (l) { l.classList.toggle('sel', l.dataset.tid === tid); });
  buildInspector(tid);
}

/* ============================================================
   Piano roll interaction
   ============================================================ */
function initRoll() {
  var c = $('#roll');
  c.tabIndex = 0;
  var drag = null;
  function pos(e) {
    var r = c.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  c.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  c.addEventListener('pointerdown', function (e) {
    var t = rollTrack();
    if (!t) { toast('select a melodic track to use the piano roll'); return; }
    var p = pos(e);
    if (p.x < Roll.gutter) {
      /* click on a piano key = play it */
      var g = rollGeo();
      var row = Math.floor(p.y / g.rowH);
      var midi = g.hi - 1 - row;
      if (midi >= 0 && midi < 128) {
        App.oct = clamp(Math.floor((midi - 48) / 12), -3, 3);
        noteOn(t.id, midi, App.playVel, 'roll' + e.pointerId);
      }
      return;
    }
    e.preventDefault();
    try { c.setPointerCapture(e.pointerId); } catch (err) { }
    var hit = rollHit(p.x, p.y);
    if (!hit) return;
    var notes = t.notes;
    if (e.button === 2 || e.altKey) {
      if (hit.note) { notes.splice(notes.indexOf(hit.note), 1); Roll.dirty = true; App.dirty = true; rebuildIndex(); repaintSeq(); }
      drag = { mode: 'erase' };
      return;
    }
    if (e.shiftKey && hit.type === 'move') {
      drag = { mode: 'vel', note: hit.note };
      applyLaneVel(hit.note, p.y, e);
      return;
    }
    if (hit.type === 'lane') {
      var n2 = findNoteByX(notes, p.x);
      if (n2) { drag = { mode: 'vel', note: n2 }; applyLaneVel(n2, p.y, e); }
      return;
    }
    if (hit.type === 'move') {
      drag = { mode: 'move', note: hit.note, x0: p.x, y0: p.y, t0: hit.note.t, p0: hit.note.p, moved: false };
      Roll.sel = hit.note;
      Roll.dirty = true;
      return;
    }
    if (hit.type === 'resize') {
      drag = { mode: 'resize', note: hit.note, x0: p.x, d0: hit.note.d, tOrt: hit.note.t };
      Roll.sel = hit.note;
      Roll.dirty = true;
      return;
    }
    /* empty: draw a note (drag paints more) */
    if (placeNote(t, hit.t, hit.p)) {
      drag = { mode: 'draw' };
      Roll.dirty = true;
      App.dirty = true;
    }
  });
  function findNoteByX(notes, x) {
    var g = rollGeo();
    var tf = (x - Roll.gutter) / g.colW;
    for (var i = notes.length - 1; i >= 0; i--) {
      var n = notes[i];
      if (tf >= n.t && tf < n.t + n.d) return n;
    }
    return null;
  }
  function applyLaneVel(note, y, e) {
    var g = rollGeo();
    var f = clamp((y - g.plotH) / Math.max(6, g.lane), 0, 1);
    var v = Math.round(lerp(127, 16, f));
    if (Math.abs(v - note.v) > 0) { note.v = v; Roll.dirty = true; App.dirty = true; rebuildIndex(); repaintSeq(); }
  }
  function placeNote(t, s, pitch) {
    var pr = App.proj;
    var p = clamp(pitch, 12, 108);
    var g0 = rollGeo();
    if (p < g0.lo + 1 || p >= g0.hi - 1) rollFit(t.id);
    if (Roll.snapScale) p = snapToScale(pr.root, pr.scale, p);
    if (s < 0 || s >= pr.steps) return false;
    if (findNote(t.notes, s, p)) return false;
    var d = clamp(Roll.snap, 1, pr.steps - s);
    for (var k = 0; k < d; k++) {
      if (findNote(t.notes, s + k, p)) { d = k; break; }
    }
    d = Math.max(1, d);
    t.notes.push({ t: s, p: p, d: d, v: App.playVel });
    rebuildIndex();
    repaintSeq();
    return true;
  }
  c.addEventListener('pointermove', function (e) {
    if (!drag) return;
    var t = rollTrack();
    if (!t) return;
    var p = pos(e);
    var g = rollGeo();
    if (drag.mode === 'erase') {
      var h = rollHit(p.x, p.y);
      if (h && h.note) {
        var idx = t.notes.indexOf(h.note);
        if (idx >= 0) { t.notes.splice(idx, 1); rebuildIndex(); repaintSeq(); Roll.dirty = true; App.dirty = true; }
      }
      return;
    }
    if (drag.mode === 'draw') {
      var h2 = rollHit(p.x, p.y);
      if (h2 && h2.type === 'empty') {
        if (placeNote(t, h2.t, h2.p)) { Roll.dirty = true; App.dirty = true; }
      }
      return;
    }
    if (drag.mode === 'vel') { applyLaneVel(drag.note, p.y, e); return; }
    var tf = (p.x - Roll.gutter) / g.colW;
    if (drag.mode === 'move') {
      var dt = Math.round(tf - (drag.x0 - Roll.gutter) / g.colW);
      var row = Math.floor(p.y / g.rowH);
      var np = g.hi - 1 - row;
      if (Roll.snapScale) np = snapToScale(App.proj.root, App.proj.scale, np);
      np = clamp(np, 12, 108);
      var nt = clamp(drag.t0 + dt, 0, App.proj.steps - 1);
      if (nt !== drag.note.t || np !== drag.note.p) {
        var conflict = findNote(t.notes.filter(function (n) { return n !== drag.note; }), nt, np);
        if (!conflict) {
          drag.note.t = nt; drag.note.p = np;
          rebuildIndex(); repaintSeq(); Roll.dirty = true; App.dirty = true;
        }
      }
      return;
    }
    if (drag.mode === 'resize') {
      var tf2 = (p.x - Roll.gutter) / g.colW;
      var nd2 = clamp(Math.round(tf2) - Math.round(drag.tOrt), 1, App.proj.steps);
      if (nd2 !== drag.note.d) { drag.note.d = nd2; rebuildIndex(); repaintSeq(); Roll.dirty = true; App.dirty = true; }
    }
  });
  function endDrag(e) {
    if (drag && drag.mode === 'move' && drag.note) Roll.sel = null;
    drag = null;
  }
  c.addEventListener('pointerup', endDrag);
  c.addEventListener('pointercancel', endDrag);
  c.addEventListener('lostpointercapture', function () { drag = null; });
  c.addEventListener('keydown', function (e) {
    var t = rollTrack();
    if (!t) return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (Roll.sel && t.notes.indexOf(Roll.sel) >= 0) {
        t.notes.splice(t.notes.indexOf(Roll.sel), 1);
        Roll.sel = null; rebuildIndex(); repaintSeq(); Roll.dirty = true; App.dirty = true;
        e.preventDefault();
      }
    }
  });
  c.addEventListener('dblclick', function (e) {
    var t = rollTrack();
    if (!t) return;
    var p = pos(e);
    var h = rollHit(p.x, p.y);
    if (h && h.note) {
      t.notes.splice(t.notes.indexOf(h.note), 1);
      rebuildIndex(); repaintSeq(); Roll.dirty = true; App.dirty = true;
      e.preventDefault();
    }
  });
}
function startResizeDrag(drag, note, x0) {
  drag.tOrt = note.t;
  drag.x0 = x0;
}
/* playhead x inside the scrolling grid content (label column = 74px + 2px gap) */
function seqHeadX(pos) { return 76 + pos * 21; }
