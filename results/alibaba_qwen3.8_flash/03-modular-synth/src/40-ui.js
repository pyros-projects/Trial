/* ============================================================
   MODSYN-8 — module 40: UI shell widgets, mixer, inspector, FX rack,
   pads + keyboard
   ============================================================ */

var $ = function (s, r) { return (r || document).querySelector(s); };
var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
var el = function (tag, cls, html) {
  var n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
};

function toast(msg, kind) {
  var box = $('#toasts');
  if (!box) return;
  var t = el('div', 'toast' + (kind ? ' ' + kind : ''), msg);
  box.appendChild(t);
  App.msg = msg;
  while (box.children.length > 5) box.removeChild(box.firstChild);
  setTimeout(function () { t.style.opacity = '0'; setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 500); }, 2600);
}

/* ---------- value formatting ---------- */
function fmtHz(v) { return v >= 1000 ? (v / 1000).toFixed(2) + 'k' : Math.round(v) + ''; }
function fmtHzs(v) { return (v > 0 ? '+' : '') + fmtHz(Math.abs(v) < 1000 ? v : v / 1) ; }
function fmtMs(v) { return Math.round(v * 1000) + 'ms'; }
function fmt2(v) { return v.toFixed(2); }
function fmtDb(v) { return (20 * Math.log10(Math.max(v, 1e-4))).toFixed(1) + 'dB'; }

/* ---------- knob widget ----------
   spec: {t, key, min, max, step, def, fmt, obj, kind:'knob'|'sel'|'tgl', opts}
   ---------- */
function makeKnob(host, spec) {
  var ctl = el('div', 'ctl' + (spec.wide ? ' wide' : ''));
  var k = el('div', 'knob');
  k.tabIndex = 0;
  k.setAttribute('role', 'slider');
  k.setAttribute('aria-label', spec.t);
  k.innerHTML = '<span class="arc"></span><span class="ptr"></span>';
  var cap = el('div', 'cap', spec.t);
  var val = el('div', 'val', '');
  ctl.appendChild(k); ctl.appendChild(cap); ctl.appendChild(val);
  host.appendChild(ctl);
  var w = {
    spec: spec, node: k,
    get: function () { return Number(spec.obj[spec.key]); },
    set: function (v, silent) {
      if (spec.step) v = Math.round(v / spec.step) * spec.step;
      v = clamp(v, spec.min, spec.max);
      spec.obj[spec.key] = v;
      paint(v);
      if (!silent) spec.onSet && spec.onSet(v);
    },
    paint: paint
  };
  function paint(v) {
    if (v === undefined) v = w.get();
    var n = (v - spec.min) / (spec.max - spec.min);
    k.style.setProperty('--p', n.toFixed(4));
    k.style.setProperty('--a', (n * 270).toFixed(2));
    k.setAttribute('aria-valuenow', String(round(v, 4)));
    val.textContent = (spec.fmt || fmt2)(v);
  }
  var drag = null;
  k.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    k.setPointerCapture(e.pointerId);
    drag = { y: e.clientY, x: e.clientX, v: w.get(), id: e.pointerId };
    k.classList.add('drag');
  });
  k.addEventListener('pointermove', function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    var dy = drag.y - e.clientY;
    var fine = e.shiftKey ? 0.22 : 1;
    var delta = (dy / 170) * (spec.max - spec.min) * fine;
    var v = drag.v + delta;
    w.set(v);
    App.dirty = true;
  });
  function endDrag(e) { if (drag && e.pointerId === drag.id) { drag = null; k.classList.remove('drag'); } }
  k.addEventListener('pointerup', endDrag);
  k.addEventListener('pointercancel', endDrag);
  k.addEventListener('lostpointercapture', function () { drag = null; k.classList.remove('drag'); });
  k.addEventListener('wheel', function (e) {
    e.preventDefault();
    var st = spec.step || (spec.max - spec.min) / 100;
    w.set(w.get() + (e.deltaY < 0 ? st : -st));
    App.dirty = true;
  }, { passive: false });
  k.addEventListener('dblclick', function () { w.set(spec.def !== undefined ? spec.def : (spec.min + spec.max) / 2); App.dirty = true; });
  k.addEventListener('keydown', function (e) {
    var st = spec.step || (spec.max - spec.min) / 50;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { w.set(w.get() + st); }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { w.set(w.get() - st); }
    else if (e.key === 'Home') { w.set(spec.min); }
    else if (e.key === 'End') { w.set(spec.max); }
    else return;
    e.preventDefault();
    App.dirty = true;
  });
  paint();
  return w;
}

/* ---------- select + toggle widgets ---------- */
function makeSelect(host, spec) {
  var ctl = el('div', 'ctl wide');
  var lab = el('div', 'cap', spec.t);
  var s = el('select');
  s.setAttribute('aria-label', spec.t);
  spec.opts.forEach(function (o) {
    var op = document.createElement('option');
    op.value = String(o); op.textContent = String(o);
    s.appendChild(op);
  });
  s.value = String(spec.obj[spec.key]);
  ctl.appendChild(lab); ctl.appendChild(s);
  host.appendChild(ctl);
  var w = {
    spec: spec, node: s,
    get: function () { return spec.obj[spec.key]; },
    set: function (v, silent) {
      spec.obj[spec.key] = v;
      s.value = String(v);
      if (!silent) spec.onSet && spec.onSet(v);
    }
  };
  s.addEventListener('change', function () {
    var v = s.value;
    if (/^-?[\d.]+$/.test(v)) v = Number(v);
    w.set(v);
    App.dirty = true;
  });
  return w;
}
function makeToggle(host, spec) {
  var t = el('div', 'sw' + (spec.obj[spec.key] ? ' on' : ''));
  t.tabIndex = 0;
  t.setAttribute('role', 'switch');
  t.setAttribute('aria-label', spec.t + ' bypass');
  t.setAttribute('aria-checked', spec.obj[spec.key] ? 'true' : 'false');
  var flip = function (on) {
    spec.obj[spec.key] = !!on;
    t.classList.toggle('on', !!on);
    t.setAttribute('aria-checked', on ? 'true' : 'false');
    spec.onSet && spec.onSet(!!on);
  };
  t.addEventListener('click', function () { flip(!spec.obj[spec.key]); App.dirty = true; });
  t.addEventListener('keydown', function (e) { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flip(!spec.obj[spec.key]); } });
  var w = { node: t, spec: spec, set: function (v) { flip(!!v); }, get: function () { return spec.obj[spec.key]; } };
  return w;
}

/* ============================================================
   Track strip (mixer row)
   ============================================================ */
var widgets = { track: {}, fx: {}, glob: {} };

function meterEl(cls) {
  var m = el('div', 'meter ' + (cls || ''));
  m.innerHTML = '<i></i><i></i>';
  m._a = m.children[0]; m._b = m.children[1];
  return m;
}

function buildTrackList() {
  var host = $('#tracklist');
  host.innerHTML = '';
  widgets.track = {};
  App.proj.tracks.forEach(function (t) {
    var row = el('div', 'trk' + (t.mute ? ' muted' : '') + (t.id === App.target ? ' sel' : ''));
    row.dataset.tid = t.id;
    var h = el('div', 'trk-h');
    var name = el('button', 'tname');
    name.type = 'button';
    name.innerHTML = '<span class="dot" style="background:' + t.color + '"></span>' + t.name +
      '<em class="tprio"> · ' + (t.kind === 'mel' ? 'POLY' : 'PERC') + '</em>';
    name.title = 'Select for editing / keyboard play';
    h.appendChild(name);
    var ms = el('div', 'ms');
    var mb = el('button', 'm' + (t.mute ? ' on' : ''), 'M');
    mb.title = 'Mute'; mb.type = 'button'; mb.setAttribute('aria-label', t.name + ' mute');
    var sb = el('button', 'solo' + (t.solo ? ' on' : ''), 'S');
    sb.title = 'Solo'; sb.type = 'button'; sb.setAttribute('aria-label', t.name + ' solo');
    ms.appendChild(mb); ms.appendChild(sb);
    mb.addEventListener('click', function () {
      t.mute = !t.mute;
      mb.classList.toggle('on', t.mute);
      mb.setAttribute('aria-pressed', t.mute ? 'true' : 'false');
      row.classList.toggle('muted', t.mute);
      onTrackGate(t);
      toast(t.name + (t.mute ? ' muted' : ' unmuted'));
      App.dirty = true;
    });
    sb.addEventListener('click', function () {
      t.solo = !t.solo;
      sb.classList.toggle('on', t.solo);
      sb.setAttribute('aria-pressed', t.solo ? 'true' : 'false');
      onTrackGate(t);
      toast(t.name + (t.solo ? ' soloed' : ' solo off'));
      App.dirty = true;
    });
    name.addEventListener('click', function () { selectTrack(t.id); });
    mb.setAttribute('aria-pressed', t.mute ? 'true' : 'false');
    sb.setAttribute('aria-pressed', t.solo ? 'true' : 'false');
    h.appendChild(ms);
    row.appendChild(h);

    var m = meterEl('trk-meter');
    row.appendChild(m);

    var ctl = el('div', 'trk-ctl');
    row.appendChild(ctl);
    host.appendChild(row);

    var rack = el('div', 'rack');
    rack.style.gridColumn = '1/-1';
    row.appendChild(rack);

    var w = { row: row, name: name, mute: mb, solo: sb, meter: m };
    widgets.track[t.id] = w;

    var onSet = function (v) { onTrackParam(t.id); };
    var fdr = el('div', 'fader');
    var lab = el('div', 'cap', 'VOL');
    var rng = document.createElement('input');
    rng.type = 'range'; rng.min = '0'; rng.max = '1.3'; rng.step = '0.01'; rng.value = String(t.vol);
    rng.setAttribute('aria-label', t.name + ' volume');
    fdr.appendChild(lab); fdr.appendChild(rng);
    ctl.appendChild(fdr);
    w.fader = rng;
    rng.addEventListener('input', function () { t.vol = Number(rng.value); onTrackParam(t.id); App.dirty = true; });

    [
      { t: 'PAN', key: 'pan', obj: t, min: -1, max: 1, step: 0.02, def: 0, fmt: function (v) { return (v === 0 ? 'C' : (v > 0 ? 'R' : 'L') + Math.round(Math.abs(v) * 100)); } },
      { t: 'DLY SEND', key: 'sendD', obj: t, min: 0, max: 1.2, step: 0.01, def: 0.2, fmt: fmt2 },
      { t: 'REV SEND', key: 'sendR', obj: t, min: 0, max: 1.2, step: 0.01, def: 0.2, fmt: fmt2 }
    ].forEach(function (sp) {
      sp.onSet = onSet;
      var k = makeKnob(ctl, sp);
      w[sp.key] = k;
    });
  });
}

/* ---------- param application: state -> live audio graph ---------- */
function onTrackParam(id) {
  var t = trackById(id), E = App.E;
  if (!t || !E || !E.T[id]) return;
  setTrackLevel(E, id, t.vol);
  setTrackPan(E, id, t.pan);
  setTrackSends(E, id, t.sendD, t.sendR);
  if (t.kind === 'mel') setLfo(E, t);
}
function onTrackGate(t) {
  var E = App.E;
  if (!E) return;
  applySolo(E);
}

/* ============================================================
   Inspector (per-track synth params)
   ============================================================ */
var MEL_CTRLS = [
  { t: 'PRESET', key: '__preset', kind: 'selP', wide: true },
  { t: 'OSC A', key: 'wave1', kind: 'sel', opts: ['sine', 'square', 'sawtooth', 'triangle'] },
  { t: 'OSC B', key: 'wave2', kind: 'sel', opts: ['sine', 'square', 'sawtooth', 'triangle'] },
  { t: 'B LEVEL', key: 'osc2Level', min: 0, max: 1, step: 0.01, def: 0.3 },
  { t: 'B PITCH', key: 'osc2Semis', min: -24, max: 24, step: 1, def: 12, fmt: function (v) { return (v > 0 ? '+' : '') + v + 'st'; } },
  { t: 'DETUNE', key: 'detune', min: 0, max: 60, step: 0.5, def: 10, fmt: fmt2 },
  { t: 'NOISE', key: 'noise', min: 0, max: 1, step: 0.01, def: 0 },
  { t: 'POLY', key: 'poly', kind: 'sel', opts: [1, 2, 3, 4, 5, 6, 7, 8], wide: true },
  { t: 'GLIDE', key: 'glide', min: 0, max: 0.25, step: 0.002, def: 0, fmt: fmtHz },
  { t: 'ATTACK', key: 'aA', min: 0.001, max: 1.5, step: 0.001, def: 0.01, fmt: fmtHz },
  { t: 'DECAY', key: 'aD', min: 0.005, max: 2.5, step: 0.005, def: 0.2 },
  { t: 'SUSTAIN', key: 'aS', min: 0, max: 1, step: 0.01, def: 0.6 },
  { t: 'RELEASE', key: 'aR', min: 0.01, max: 3, step: 0.01, def: 0.3 },
  { t: 'FILTER', key: 'fType', kind: 'sel', opts: ['lowpass24', 'lowpass12', 'highpass', 'bandpass'], wide: true },
  { t: 'CUTOFF', key: 'cutoff', min: 30, max: 16000, step: 10, def: 2000, fmt: fmtHz },
  { t: 'RESO', key: 'res', min: 0, max: 25, step: 0.1, def: 6, fmt: fmt2 },
  { t: 'FLT ENV', key: 'fEnv', min: -6000, max: 6000, step: 20, def: 2000, fmt: function (v) { return (v > 0 ? '+' : '') + fmtHz(v); } },
  { t: 'F DECAY', key: 'fD', min: 0.005, max: 2.5, step: 0.005, def: 0.3 },
  { t: 'F SUST.', key: 'fS', min: 0, max: 1, step: 0.01, def: 0.4 },
  { t: 'LFO RATE', key: 'lfoRate', min: 0.03, max: 24, step: 0.01, def: 4, fmt: fmtHz },
  { t: 'LFO DEPTH', key: 'lfoDepth', min: 0, max: 1, step: 0.01, def: 0.2 },
  { t: 'LFO WAVE', key: 'lfoWave', kind: 'sel', opts: ['sine', 'triangle', 'square', 'sawtooth'] },
  { t: 'LFO ROUTE', key: 'lfoTarget', kind: 'selT', opts: ['none', 'pitch', 'cutoff', 'amp', 'pan'], wide: true }
];
var PERC_CTRLS = [
  { t: 'PRESET', key: '__preset', kind: 'selP', wide: true },
  { t: 'VOICE', key: 'voice', kind: 'sel', opts: ['kick', 'snare', 'clap', 'hat', 'tom', 'cowbell', 'rim', 'zap'], wide: true },
  { t: 'TUNE', key: 'tune', min: 0, max: 1, step: 0.01, def: 0.5 },
  { t: 'DECAY', key: 'decay', min: 0.02, max: 1, step: 0.01, def: 0.4 },
  { t: 'TONE', key: 'tone', min: 0, max: 1, step: 0.01, def: 0.5 },
  { t: 'DRIVE', key: 'drive', min: 0, max: 1, step: 0.01, def: 0.4 },
  { t: 'LEVEL', key: 'level', min: 0, max: 1.2, step: 0.01, def: 0.8 }
];

function buildInspector(tid) {
  var t = trackById(tid);
  var host = $('#inspector');
  host.innerHTML = '';
  widgets.insp = [];
  if (!t) return;
  $('#insp-title').textContent = t.name + (t.kind === 'mel' ? ' · polyphonic synth' : ' · percussion');
  var pr = App.proj;

  /* common row: keyboard routing + scale + gate */
  var top = el('div', 'selrow');
  top.innerHTML = '<label>KEY</label>';
  var selKey = el('select');
  ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].forEach(function (n, i) {
    var o = document.createElement('option'); o.value = String(i); o.textContent = n; selKey.appendChild(o);
  });
  selKey.value = String(pr.root);
  selKey.setAttribute('aria-label', 'song key');
  top.appendChild(selKey);
  var selScale = el('select');
  Object.keys(SCALES).forEach(function (k) {
    var o = document.createElement('option'); o.value = k; o.textContent = k; selScale.appendChild(o);
  });
  selScale.value = pr.scale;
  selScale.setAttribute('aria-label', 'song scale');
  var labSc = el('label', null, 'SCALE');
  top.appendChild(labSc); top.appendChild(selScale);
  var mkTog = function (label, on, fn) {
    var b = el('button', 'mini' + (on ? ' on' : ''), label);
    b.type = 'button';
    b.addEventListener('click', function () {
      var v = !b.classList.contains('on');
      b.classList.toggle('on', v);
      fn(v);
      App.dirty = true;
    });
    top.appendChild(b);
    return b;
  };
  mkTog('TRACK ON', t.on, function (v) { t.on = v; onTrackGate(t); repaintSeq(); });
  host.appendChild(top);

  var top2 = el('div', 'selrow');
  top2.innerHTML = '<label>EDIT PITCH</label>';
  var pitchSel = el('select');
  var pRange = [];
  for (var p = 24; p <= 96; p++) pRange.push(p);
  pRange.forEach(function (p) {
    var o = document.createElement('option'); o.value = String(p); o.textContent = midiName(p); pitchSel.appendChild(o);
  });
  pitchSel.value = String(clamp(t.pitch || 60, 24, 96));
  pitchSel.setAttribute('aria-label', 'edit pitch');
  top2.appendChild(pitchSel);
  var labG = el('label', null, 'GATE');
  top2.appendChild(labG);
  var gateIn = document.createElement('input');
  gateIn.type = 'range'; gateIn.min = '1'; gateIn.max = '16'; gateIn.step = '1';
  gateIn.value = String(t.gate || 2);
  gateIn.setAttribute('aria-label', 'note gate length');
  top2.appendChild(gateIn);
  var gateOut = el('span', 'tag', (t.gate || 2) + '×16');
  top2.appendChild(gateOut);
  host.appendChild(top2);
  widgets.gate = { sel: pitchSel, input: gateIn, out: gateOut };
  pitchSel.addEventListener('change', function () {
    t.pitch = Number(pitchSel.value);
    Roll.hint = midiName(t.pitch);
    App.dirty = true;
  });
  gateIn.addEventListener('input', function () {
    t.gate = Number(gateIn.value);
    gateOut.textContent = t.gate + '×16';
    App.dirty = true;
  });

  /* randomise / clear row */
  var top3 = el('div', 'selrow');
  top3.innerHTML = '<label>TRACK TOOLS</label>';
  var bRnd = el('button', 'mini', 'RANDOMISE');
  bRnd.type = 'button';
  bRnd.addEventListener('click', function () {
    var sd = (App.randSeed || App.proj.seed) + Math.floor(Math.random() * 100000);
    randomizeTrack(t.id, sd);
    rebuildIndex(); repaintSeq(); Roll.dirty = true;
    toast('randomised ' + t.name + ' · seed ' + sd, 'good');
    App.dirty = true;
  });
  var bClr = el('button', 'mini', 'CLEAR');
  bClr.type = 'button';
  bClr.addEventListener('click', function () {
    if (t.kind === 'perc') t.steps = new Array(MAXSTEPS).fill(0);
    else t.notes = [];
    rebuildIndex(); repaintSeq(); Roll.dirty = true;
    toast('cleared ' + t.name);
    App.dirty = true;
  });
  top3.appendChild(bRnd); top3.appendChild(bClr);
  host.appendChild(top3);

  /* parameter rack */
  var rack = el('div', 'rack');
  host.appendChild(rack);
  var specs = (t.kind === 'mel' ? MEL_CTRLS : PERC_CTRLS);
  var obj = t.inst;
  specs.forEach(function (sp) {
    var spec = Object.assign({}, sp, { obj: obj, onSet: function () { onTrackParam(t.id); } });
    if (sp.kind === 'sel') {
      spec.opts = sp.opts.slice();
      var w = makeSelect(rack, spec);
      widgets.insp.push(w);
    } else if (sp.kind === 'selT') {
      var w2 = makeSelect(rack, spec);
      widgets.insp.push(w2);
    } else if (sp.kind === 'selP') {
      var list = t.kind === 'mel' ? TRACK_PRESETS.mel : TRACK_PRESETS.perc;
      spec.kind = 'sel';
      spec.opts = list.map(function (x) { return x[0]; });
      var w3 = makeSelect(rack, spec);
      w3.node.addEventListener('change', function () {
        var hit = list.filter(function (x) { return x[0] === w3.node.value; })[0];
        if (hit && hit[1]) {
          Object.assign(t.inst, hit[1]);
          rebuildInspectorWidgets(t);
          onTrackParam(t.id);
          toast(t.name + ' → ' + hit[0], 'good');
        } else {
          w3.node.value = list[0][0];
        }
        App.dirty = true;
      });
      widgets.insp.push(w3);
      widgets.presetSel = w3;
    } else {
      widgets.insp.push(makeKnob(rack, spec));
    }
  });
}
function rebuildInspectorWidgets(t) {
  /* re-paint knobs/selects from the (newly assigned) inst object */
  var host = $('#inspector');
  var keep = $('#insp-title').textContent;
  buildInspector(t.id);
  $('#insp-title').textContent = keep;
}

/* ============================================================
   FX rack
   ============================================================ */
var FX_RACK = [
  {
    id: 'delay', name: 'STEREO DELAY', byp: false,
    ctrls: [
      { t: 'TIME', key: 'time', min: 0.02, max: 1.5, step: 0.005, def: 0.375, fmt: fmtMs },
      { t: 'FEEDBACK', key: 'fb', min: 0, max: 0.92, step: 0.01, def: 0.44 },
      { t: 'MIX', key: 'mix', min: 0, max: 1.2, step: 0.01, def: 0.32 },
      { t: 'DAMPING', key: 'damp', min: 0, max: 1, step: 0.01, def: 0.42 },
      { t: 'WIDTH', key: 'width', min: 0, max: 1, step: 0.01, def: 0.75 }
    ]
  },
  {
    id: 'verb', name: 'HALL · generated IR', byp: false,
    ctrls: [
      { t: 'SIZE', key: 'size', min: 0.2, max: 5, step: 0.05, def: 2.1, fmt: function (v) { return v.toFixed(2) + 's'; } },
      { t: 'DECAY', key: 'decay', min: 0.5, max: 10, step: 0.1, def: 3.1, fmt: fmt2 },
      { t: 'DAMP', key: 'damp', min: 0, max: 1, step: 0.01, def: 0.55 },
      { t: 'MIX', key: 'mix', min: 0, max: 1.2, step: 0.01, def: 0.34 },
      { t: 'PRE-DLY', key: 'predelay', min: 0, max: 0.12, step: 0.001, def: 0.012, fmt: fmtMs }
    ]
  },
  {
    id: 'sat', name: 'SATURATION', byp: true,
    ctrls: [
      { t: 'DRIVE', key: 'drive', min: 1, max: 22, step: 0.1, def: 1.7, fmt: fmt2 },
      { t: 'MIX', key: 'mix', min: 0, max: 1, step: 0.01, def: 0.42 },
      { t: 'TONE', key: 'tone', min: 0, max: 1, step: 0.01, def: 0.45 }
    ]
  },
  {
    id: 'tone', name: 'TONE · 3-BAND', byp: true,
    ctrls: [
      { t: 'LOW', key: 'low', min: -16, max: 16, step: 0.2, def: 1, fmt: fmtDb },
      { t: 'MID', key: 'mid', min: -16, max: 16, step: 0.2, def: -1.8, fmt: fmtDb },
      { t: 'HIGH', key: 'high', min: -16, max: 16, step: 0.2, def: 2.4, fmt: fmtDb },
      { t: 'F LOW', key: 'fLow', min: 40, max: 900, step: 5, def: 190, fmt: fmtHz },
      { t: 'F MID', key: 'fMid', min: 200, max: 6000, step: 10, def: 1300, fmt: fmtHz },
      { t: 'F HIGH', key: 'fHigh', min: 900, max: 14000, step: 10, def: 3600, fmt: fmtHz }
    ]
  },
  {
    id: 'lim', name: 'LIMITER', byp: true, gr: true,
    ctrls: [
      { t: 'THRESH', key: 'thr', min: -48, max: 0, step: 0.5, def: -7.5, fmt: fmtDb },
      { t: 'RATIO', key: 'ratio', min: 1, max: 24, step: 0.5, def: 14, fmt: fmt2 },
      { t: 'ATTACK', key: 'atk', min: 0.0005, max: 0.1, step: 0.0005, def: 0.004, fmt: fmtHz },
      { t: 'RELEASE', key: 'rel', min: 0.01, max: 0.9, step: 0.005, def: 0.17, fmt: fmtHz },
      { t: 'MAKEUP', key: 'makeup', min: 0.2, max: 2.5, step: 0.01, def: 1.12, fmt: fmtDb }
    ]
  }
];

function buildFxRack() {
  var host = $('#fxrack');
  host.innerHTML = '';
  widgets.fx = {};
  FX_RACK.forEach(function (f) {
    var box = el('div', 'fx');
    var head = el('div', 'fx-h');
    head.appendChild(el('b', null, f.name));
    if (f.byp) {
      var sw = makeToggle(head, {
        t: f.name, key: 'on', obj: App.proj.fx[f.id],
        onSet: function (v) {
          if (!App.E) return;
          setFxOn(App.E, f.id, v);
          toast(f.name + (v ? ' engaged' : ' bypassed'));
        }
      });
      head.appendChild(sw.node);
      widgets.fx[f.id + '.on'] = sw;
    } else {
      head.appendChild(el('span', 'tag', null));
      head.lastChild.textContent = 'always on';
    }
    box.appendChild(head);
    var rack = el('div', 'rack');
    box.appendChild(rack);
    f.ctrls.forEach(function (c) {
      var spec = Object.assign({}, c, {
        obj: App.proj.fx[f.id],
        onSet: function (v) { if (App.E) setFx(App.E, f.id, c.key, v, true); }
      });
      widgets.fx[f.id + '.' + c.key] = makeKnob(rack, spec);
    });
    if (f.gr) {
      var gr = el('div', 'gr', '<i></i>');
      box.appendChild(gr);
      widgets.gr = gr.firstChild;
    }
    host.appendChild(box);
  });
}

/* ============================================================
   Pads + keyboard
   ============================================================ */
function buildPads() {
  var host = $('#padrow');
  host.innerHTML = '';
  widgets.pads = [];
  PADDEFS.forEach(function (pd, i) {
    var b = el('button', 'pad');
    b.type = 'button';
    b.innerHTML = '<b>' + pd[0] + '</b><span>' + pd[1] + '</span>';
    b.dataset.i = String(i);
    b.setAttribute('aria-label', 'pad ' + pd[0]);
    host.appendChild(b);
    widgets.pads.push(b);
  });
  if (window.innerWidth < 760) host.style.gridTemplateColumns = 'repeat(4,minmax(0,1fr))';
}

function padAt(i) { return PADDEFS[i]; }

function hitPad(i, vel) {
  var pd = padAt(i);
  if (!pd) return;
  var trackId = PERC_IDS[pd[2]];
  if (!trackById(trackId)) return;
  var e = App.E;
  if (!e) return;
  var pad = [pd[0], pd[1], pd[2], pd[3], vel];
  playNote(e, trackId, e.ctx.currentTime + 0.002, { v: vel, sec: 0.4, chan: 'key', pad: pad });
  lightPad(i);
}
function lightPad(i) {
  var b = widgets.pads && widgets.pads[i];
  if (!b) return;
  b.classList.add('hit');
  setTimeout(function () { b.classList.remove('hit'); }, 110);
}

/* piano keyboard layout */
function buildKeyboard() {
  var host = $('#keyboard');
  host.innerHTML = '';
  var base = 48 + App.oct * 12;
  var lo = base - 1, hi = base + 22;
  var whites = [], all = [];
  for (var p = lo; p <= hi; p++) {
    var pc = p % 12;
    var isWhite = [0, 2, 4, 5, 7, 9, 11].indexOf(pc) >= 0;
    all.push({ p: p, white: isWhite });
    if (isWhite) whites.push(p);
  }
  var nw = whites.length;
  var wPct = 100 / nw;
  var labelFor = {};
  Object.keys(KEYMAP).forEach(function (code) {
    var semi = KEYMAP[code];
    if (code.indexOf('Key') === 0 && semi < 0) return;
    labelFor[base + semi] = code.replace('Key', '').replace('Digit', '#').substring(0, 2);
  });
  all.forEach(function (k) {
    var isWhite = k.white;
    var d = el('div', isWhite ? 'wkey' : 'bkey');
    d.dataset.p = String(k.p);
    var lbl = labelFor[k.p];
    if (lbl) d.innerHTML = '<span class="klabel">' + lbl + '</span>';
    else d.innerHTML = '<span class="klabel">' + midiName(k.p).slice(0, 2) + '</span>';
    if (isWhite) {
      d.style.width = 'calc(' + wPct.toFixed(3) + '% - 1px)';
      d.style.flex = '0 0 auto';
      host.appendChild(d);
    } else {
      var idxWhite = whites.filter(function (w) { return w < k.p; }).length;
      d.style.left = 'calc(' + (idxWhite * wPct).toFixed(3) + '% - ' + (wPct * 0.3).toFixed(3) + '%)';
      d.style.width = (wPct * 0.62).toFixed(3) + '%';
      host.appendChild(d);
    }
    d.dataset.tag = 'kb' + k.p;
    widgets['k' + k.p] = d;
  });
  $('#oct-label').textContent = 'C' + (Math.floor(base / 12) - 1);
}
function lightKey(midi, on) {
  var d = widgets['k' + midi];
  if (d) d.classList.toggle('down', !!on);
}

/* pointer/touch play on the keyboard + pads */
function initPlayInput() {
  var kb = $('#keyboard');
  var active = {};   /* pointerId -> {tag, midi} */
  function keyFromEvent(e) {
    var t = document.elementFromPoint(e.clientX, e.clientY);
    var el2 = t && t.closest ? t.closest('[data-p]') : null;
    if (!el2 || !kb.contains(el2)) {
      var r = kb.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return null;
      el2 = kb.querySelector('[data-p]');
    }
    return el2;
  }
  function velFromY(e, rect) {
    var f = clamp((e.clientY - rect.top) / Math.max(8, rect.height), 0, 1);
    return Math.round(lerp(122, 46, f));
  }
  function down(e) {
    var host = e.currentTarget;
    if (e.button === 2) return;
    var target = e.target.closest ? e.target.closest('.pad,[data-p]') : null;
    if (!target) return;
    e.preventDefault();
    if (host.setPointerCapture) { try { host.setPointerCapture(e.pointerId); } catch (err) { } }
    var rect = host.getBoundingClientRect();
    var vel = e.pointerType === 'mouse' ? App.playVel : velFromY(e, rect);
    if (target.classList.contains('pad')) {
      var i = Number(target.dataset.i);
      var tag = 'pad' + i + ':' + e.pointerId;
      active[e.pointerId] = { tag: tag };
      hitPad(i, vel);
      return;
    }
    var midi = Number(target.dataset.p);
    var tag2 = 'kp' + e.pointerId;
    var tr = targetTrack();
    if (!tr) return;
    if (active[e.pointerId]) noteOffTag(active[e.pointerId].tag);
    var rec = noteOn(tr.id, midi, vel, tag2);
    if (rec) {
      active[e.pointerId] = { tag: tag2, midi: midi };
      lightKey(midi, true);
    }
  }
  function move(e) {
    if (!active[e.pointerId]) return;
    var target = document.elementFromPoint(e.clientX, e.clientY);
    target = target && target.closest ? target.closest('[data-p]') : null;
    if (!target) return;
    var midi = Number(target.dataset.p);
    if (isNaN(midi)) return;
    if (active[e.pointerId].midi === midi) return;
    noteOffTag(active[e.pointerId].tag);
    lightKey(active[e.pointerId].midi, false);
    var tr = targetTrack();
    if (!tr) return;
    var tag = 'kp' + e.pointerId;
    var rec = noteOn(tr.id, midi, App.playVel, tag);
    if (rec) { active[e.pointerId] = { tag: tag, midi: midi }; lightKey(midi, true); }
  }
  function up(e) {
    var a = active[e.pointerId];
    if (!a) return;
    if (a.tag.indexOf('kp') === 0) {
      noteOffTag(a.tag);
      lightKey(a.midi, false);
    }
    delete active[e.pointerId];
  }
  [kb, $('#padrow')].forEach(function (host) {
    host.addEventListener('pointerdown', down);
    host.addEventListener('pointermove', function (e) { if (e.buttons) move(e); });
    host.addEventListener('pointerup', up);
    host.addEventListener('pointercancel', function (e) {
      var a = active[e.pointerId];
      if (a) { noteOffTag(a.tag); if (a.midi != null) lightKey(a.midi, false); delete active[e.pointerId]; }
    });
    host.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  });
  document.addEventListener('pointerup', function (e) { up(e); });
  document.addEventListener('pointercancel', function (e) {
    if (active[e.pointerId]) {
      var a = active[e.pointerId];
      noteOffTag(a.tag);
      if (a.midi != null) lightKey(a.midi, false);
      delete active[e.pointerId];
    }
  });
  window.addEventListener('blur', function () { releaseAllNotes(true); });
  document.addEventListener('visibilitychange', function () { if (document.hidden) releaseAllNotes(true); });
}

/* ---------- transport / top bar sync ---------- */
function syncTransport() {
  var p = $('#btn-play');
  p.classList.toggle('on', App.playing);
  p.querySelector('label').textContent = App.playing ? 'PLAYING' : 'PLAY';
  $('#btn-metro').classList.toggle('on', !!App.proj.metro);
}