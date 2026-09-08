/* ============================================================
   MODSYN-8 — module 60: persistence, WAV render, presets, boot
   ============================================================ */

var LSK = 'modsyn.project.v1';

/* ---------- snapshot / restore ---------- */
function snapshot() {
  var pr = App.proj;
  return {
    schema: SCHEMA,
    name: pr.name, tempo: pr.tempo, swing: pr.swing, master: pr.master,
    metro: !!pr.metro, steps: pr.steps, seed: pr.seed, root: pr.root, scale: pr.scale,
    fx: copy(pr.fx),
    tracks: pr.tracks.map(function (t) {
      var o = {
        id: t.id, name: t.name, kind: t.kind, color: t.color, on: t.on,
        mute: t.mute, solo: t.solo, vol: round(t.vol, 3), pan: round(t.pan, 3),
        sendD: round(t.sendD, 3), sendR: round(t.sendR, 3),
        octave: t.octave, pitch: t.pitch, gate: t.gate,
        inst: copy(t.inst)
      };
      if (t.kind === 'mel') o.notes = t.notes.map(function (n) { return [n.t, n.p, n.d, n.v]; });
      else o.steps = t.steps.slice();
      return o;
    })
  };
}

function restore(obj) {
  if (!obj || obj.schema !== SCHEMA || !Array.isArray(obj.tracks)) { toast('unrecognised project file', 'bad'); return false; }
  var pr = newProject(obj.name || 'Loaded');
  pr.tempo = clamp(num(obj.tempo, 100), 40, 220);
  pr.swing = clamp(num(obj.swing, 0), 0, 70);
  pr.master = clamp(num(obj.master, 0.8), 0, 1.3);
  pr.metro = !!obj.metro;
  pr.steps = clamp(num(obj.steps, DEFAULT_STEPS), 1, MAXSTEPS);
  pr.seed = num(obj.seed, 1337);
  pr.root = clamp(num(obj.root, 9), 0, 11);
  pr.scale = SCALES[obj.scale] ? obj.scale : 'minor';
  pr.fx = Object.assign(defaultFx(), obj.fx || {});
  pr.tracks = obj.tracks.map(function (t) {
    var base = t.kind === 'mel' ? melTrack(t.id, t.name || 'TRACK', t.color || '#39d7ee', {}) :
      percTrack(t.id, t.name || 'PERC', t.color || '#ff5d8f', {});
    var o = Object.assign(base, t);
    if (t.kind === 'mel') {
      o.notes = (t.notes || []).map(function (n) {
        return Array.isArray(n) ? { t: n[0], p: n[1], d: n[2], v: n[3] } : n;
      });
    } else {
      o.steps = (t.steps || new Array(MAXSTEPS).fill(0)).slice();
      while (o.steps.length < MAXSTEPS) o.steps.push(0);
    }
    return o;
  });
  setProject(pr);
  toast('project loaded · ' + pr.name, 'good');
  return true;
}

/* ---------- song presets ---------- */
function applySong(song) {
  var d = song.data;
  var pr = newProject(song.name);
  pr.tempo = d.tempo; pr.swing = d.swing; pr.steps = d.steps;
  pr.root = d.root; pr.scale = d.scale; pr.master = d.master;
  pr.fx = copy(d.fx);
  pr.tracks.forEach(function (t) {
    var src = d.tracks[t.id];
    if (!src) return;
    if (t.kind === 'mel' && src.notes) t.notes = src.notes.map(function (n) { return Object.assign({}, n); });
    if (t.kind === 'perc' && src.steps) t.steps = src.steps.slice();
  });
  setProject(pr);
  toast('song loaded · ' + song.name, 'good');
}

/* swap in a whole project (rebuilds graph + UI) */
function setProject(pr) {
  App.proj = pr;
  pr.scaleSnapOn = true;
  rebuildIndex();
  if (App.ctx) {
    App.E = makeEngine(App.ctx, pr, { noiseSeed: (pr.seed | 0) || 7 });
    applySolo(App.E);
    setMetro(App.E, pr.metro);
    if (App.playing) { App.playing = false; transportPlay(true); }
  }
  buildTrackList();
  buildSeq();
  Seq.builtSteps = pr.steps;
  buildFxRack();
  if (!trackById(Roll.track) || trackById(Roll.track).kind !== 'mel') {
    Roll.track = (pr.tracks.filter(function (t) { return t.kind === 'mel'; })[0] || {}).id || 'lead';
  }
  rollFit(Roll.track);
  $('#roll-hint').textContent = (trackById(Roll.track) || {}).name + ' · ' + pr.scale +
    ' · drag note = move · alt/right-click = delete';
  rollFit(Roll.track);
  $('#roll-hint').textContent = (trackById(Roll.track) || {}).name + ' · ' + pr.scale + ' · drag = move · alt/right-click = delete';
  if (!trackById(App.target)) App.target = pr.tracks[0].id;
  buildInspector(App.target);
  Roll.dirty = true;
  syncTransport();
  syncTopBar();
  App.dirty = true;
}

/* ---------- localStorage ---------- */
var lastSave = 0;
function saveLS(force) {
  var now = performance.now();
  if (!force && now - lastSave < 1600) return;
  lastSave = now;
  try {
    localStorage.setItem(LSK, JSON.stringify(snapshot()));
    App.msg = 'autosaved to localStorage ' + new Date().toLocaleTimeString();
  } catch (e) {
    App.msg = 'localStorage unavailable: ' + (e && e.name);
  }
}
function loadLS() {
  try {
    var s = localStorage.getItem(LSK);
    if (!s) return false;
    var obj = JSON.parse(s);
    if (obj && obj.schema === SCHEMA) { App.pendingProject = obj; return true; }
  } catch (e) { }
  return false;
}

/* ---------- file save / load ---------- */
function download(name, blob) {
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 400);
  toast('downloaded ' + name, 'good');
}
function saveJson() {
  var s = JSON.stringify(snapshot(), null, 1);
  download((App.proj.name || 'modsyn').replace(/[^a-z0-9\-]+/gi, '_') + '.modsyn.json',
    new Blob([s], { type: 'application/json' }));
}
function loadJsonFile(file) {
  var r = new FileReader();
  r.onload = function () {
    try { restore(JSON.parse(r.result)); }
    catch (e) { toast('bad JSON: ' + e.message, 'bad'); }
  };
  r.onerror = function () { toast('could not read file', 'bad'); };
  r.readAsText(file);
}

/* ---------- offline render → WAV ---------- */
function encodeWav(buffer, targetPeak) {
  var nch = buffer.numberOfChannels, len = buffer.length, sr = buffer.sampleRate;
  var data = new Float32Array(len * nch);
  var chans = [];
  for (var c = 0; c < nch; c++) chans.push(buffer.getChannelData(c));
  var peak = 0;
  for (var i = 0; i < len; i++) {
    for (var c2 = 0; c2 < nch; c2++) {
      var v = chans[c2][i];
      if (!isFinite(v)) v = 0;
      if (Math.abs(v) > peak) peak = Math.abs(v);
      data[i * nch + c2] = v;
    }
  }
  var gain = 1;
  if (targetPeak && peak > targetPeak) gain = targetPeak / peak;
  var bytes = 44 + data.length * 2;
  var ab = new ArrayBuffer(bytes);
  var dv = new DataView(ab);
  function str(off, s) { for (var k = 0; k < s.length; k++) dv.setUint8(off + k, s.charCodeAt(k)); }
  str(0, 'RIFF'); dv.setUint32(4, bytes - 8, true); str(8, 'WAVE');
  str(12, 'fmt '); dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true); dv.setUint16(22, nch, true);
  dv.setUint32(24, sr, true); dv.setUint32(28, sr * nch * 2, true);
  dv.setUint16(32, nch * 2, true); dv.setUint16(34, 16, true);
  str(36, 'data'); dv.setUint32(40, data.length * 2, true);
  var o = 44, clipped = 0;
  for (var j = 0; j < data.length; j++) {
    var x = data[j] * gain;
    if (x > 0.999) { x = 0.999; clipped++; }
    if (x < -0.999) { x = -0.999; clipped++; }
    dv.setInt16(o, Math.round(x * 32767), true);
    o += 2;
  }
  return { blob: new Blob([ab], { type: 'audio/wav' }), peak: peak, gain: gain, clipped: clipped, size: bytes };
}

function renderWav(loops, opt) {
  opt = opt || {};
  var pr = App.proj;
  var OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!OAC) { toast('OfflineAudioContext not available', 'bad'); return Promise.resolve(null); }
  var wasPlaying = App.playing;
  transportStop(true);
  var sd = 60 / clamp(pr.tempo, 20, 300) / 4;
  var totalSteps = pr.steps * loops;
  var tail = 2.8;
  var dur = Math.min(150, totalSteps * sd + tail);
  var sr = (App.ctx && App.ctx.sampleRate) || 44100;
  var nFrames = Math.max(1, Math.ceil(dur * sr));
  toast('rendering ' + loops + ' loop' + (loops > 1 ? 's' : '') + ' offline · ' +
    (nFrames / sr).toFixed(1) + 's @ ' + sr + 'Hz', 'good');
  var t0 = performance.now();
  var oc;
  try {
    oc = new OAC(2, nFrames, sr);
  } catch (e) {
    toast('could not create offline context: ' + e.message, 'bad');
    return Promise.resolve(null);
  }
  var E = makeEngine(oc, pr, { offline: true, maxTotal: 96, noiseSeed: (pr.seed | 0) || 7 });
  applySolo(E);
  setMetro(E, pr.metro, 0.25);
  /* deterministic event pass */
  var idx = {};
  pr.tracks.forEach(function (t) {
    if (t.kind !== 'mel') return;
    var by = new Array(pr.steps + 2);
    t.notes.forEach(function (n) {
      var s = Math.round(n.t);
      if (s < 0 || s >= pr.steps) return;
      if (!by[s]) by[s] = [];
      by[s].push(n);
    });
    idx[t.id] = by;
  });
  var swingF = clamp(pr.swing, 0, 80) / 100 * 0.68;
  var t = 0.06;
  var events = 0;
  for (var loop = 0; loop < loops; loop++) {
    for (var s = 0; s < pr.steps; s++) {
      var off = (s % 2 === 1) ? swingF * sd : 0;
      var tt = t + off;
      if (tt > dur - 0.05) break;
      for (var k = 0; k < pr.tracks.length; k++) {
        var tr = pr.tracks[k];
        if (!tr.on || tr.mute) continue;
        if (E.soloActive && !tr.solo) continue;
        if (tr.kind === 'perc') {
          var v = tr.steps[s];
          if (v > 0) { playNote(E, tr.id, tt, { sec: 0.25, v: v, chan: 'seq' }); events++; }
        } else {
          var arr = idx[tr.id] && idx[tr.id][s];
          if (arr) {
            for (var n = 0; n < arr.length; n++) {
              playNote(E, tr.id, tt, { p: arr[n].p, sec: Math.max(0.03, arr[n].d * sd), v: arr[n].v, chan: 'seq' });
              events++;
            }
          }
        }
      }
      if (pr.metro) clickAt(E, tt, s % 4 === 0);
      t += sd;
    }
  }
  var t1 = performance.now();
  return oc.startRendering().then(function (buf) {
    var res = encodeWav(buf, opt.normalize ? 0.92 : 1);
    var t2 = performance.now();
    var name = (pr.name || 'modsyn').replace(/[^a-z0-9\-]+/gi, '_') + '_' + loops + 'loop.wav';
    download(name, res.blob);
    var msg = 'WAV ' + (buf.duration).toFixed(1) + 's · peak ' + gainToDb(res.peak) + 'dB' +
      (res.gain !== 1 ? ' (normalised ' + (20 * Math.log10(res.gain)).toFixed(1) + 'dB)' : '') +
      ' · schedule ' + Math.round(t1 - t0) + 'ms · render ' + Math.round(t2 - t1) + 'ms · ' +
      events + ' events';
    toast(msg, 'good');
    App.msg = msg;
    if (wasPlaying) transportPlay(true);
    return { seconds: buf.duration, peak: res.peak, events: events, ms: Math.round(t2 - t0) };
  }).catch(function (e) {
    toast('render failed: ' + (e && e.message || e), 'bad');
    if (wasPlaying) transportPlay(true);
    return null;
  });
}

/* ---------- whole-song randomisation ---------- */
function randomizeSong(seed) {
  var pr = App.proj;
  pr.seed = seed;
  pr.tracks.forEach(function (t) { randomizeTrack(t.id, seed); });
  var scales = ['minor', 'dorian', 'phrygian', 'pentatonic', 'major', 'harmonic'];
  if (App.randScale) pr.scale = scales[seed % scales.length];
  rebuildIndex();
  buildSeq();
  Seq.builtSteps = pr.steps;
  Roll.dirty = true;
  App.dirty = true;
  toast('song randomised · seed ' + seed + ' · ' + pr.scale, 'good');
}

/* ---------- top bar sync ---------- */
function syncTopBar() {
  var pr = App.proj;
  $('#in-tempo').value = String(pr.tempo); $('#out-tempo').textContent = pr.tempo.toFixed(1);
  $('#in-swing').value = String(pr.swing); $('#out-swing').textContent = pr.swing + '%';
  $('#in-len').value = String(pr.steps); $('#out-len').textContent = String(pr.steps);
  $('#in-oct').value = String(App.oct); $('#out-oct').textContent = (App.oct >= 0 ? '+' : '') + App.oct;
  $('#in-master').value = String(Math.round(pr.master * 100));
  $('#out-master').textContent = gainToDb(pr.master).toFixed(1) + 'dB';
  $('#song-name').textContent = pr.name;
  if (widgets.presetSel) widgets.presetSel.node.value = '— current —';
  buildKeyboard();
}

/* ---------- wiring ---------- */
function wireTopBar() {
  function bindRange(sel, outSel, get, set, fmt) {
    var el0 = $(sel), out = $(outSel);
    el0.addEventListener('input', function () {
      var v = Number(el0.value);
      set(v);
      if (out) out.textContent = fmt(v);
      App.dirty = true;
    });
  }
  bindRange('#in-tempo', '#out-tempo', null, function (v) { App.proj.tempo = clamp(v, 40, 220); }, function (v) { return v.toFixed(1); });
  bindRange('#in-swing', '#out-swing', null, function (v) { App.proj.swing = clamp(v, 0, 70); }, function ( v) { return v + '%'; });
  bindRange('#in-len', '#out-len', null, function (v) {
    App.proj.steps = clamp(v | 0, 1, MAXSTEPS);
    rebuildIndex();
    if (Seq.builtSteps !== App.proj.steps) { buildSeq(); Seq.builtSteps = App.proj.steps; }
    else repaintSeq();
    Roll.dirty = true;
  }, function (v) { return String(v); });
  bindRange('#in-oct', '#out-oct', null, function (v) {
    App.oct = clamp(v | 0, -3, 3);
    buildKeyboard();
  }, function (v) { return (v >= 0 ? '+' : '') + v; });
  bindRange('#in-master', '#out-master', null, function (v) {
    App.proj.master = clamp(v / 100, 0, 1.2);
    if (App.E) masterVolume(App.E, App.proj.master);
  }, function (v) { return (20 * Math.log10(Math.max(v / 100, 1e-4))).toFixed(1) + 'dB'; });
  bindRange('#in-vel', '#vel-label', null, function (v) { App.playVel = clamp(v | 0, 1, 127); }, function (v) { return String(v); });

  $('#btn-play').addEventListener('click', function () {
    if (App.playing) transportStop(false); else transportPlay(!App.playing ? App.stepIdx === 0 : false);
  });
  $('#btn-stop').addEventListener('click', function () { transportStop(true); });
  $('#btn-restart').addEventListener('click', function () { transportRestart(); });
  $('#btn-metro').addEventListener('click', function () {
    App.proj.metro = !App.proj.metro;
    if (App.E) setMetro(App.E, App.proj.metro, 0.25);
    syncTransport();
    toast('metronome ' + (App.proj.metro ? 'on' : 'off'));
    App.dirty = true;
  });
  $('#btn-oct-dn').addEventListener('click', function () {
    App.oct = clamp(App.oct - 1, -3, 3); $('#in-oct').value = String(App.oct);
    $('#out-oct').textContent = (App.oct >= 0 ? '+' : '') + App.oct;
    buildKeyboard();
  });
  $('#btn-oct-up').addEventListener('click', function () {
    App.oct = clamp(App.oct + 1, -3, 3); $('#in-oct').value = String(App.oct);
    $('#out-oct').textContent = (App.oct >= 0 ? '+' : '') + App.oct;
    buildKeyboard();
  });
  $('#sel-snap').addEventListener('change', function () { Roll.snap = Number($('#sel-snap').value); Roll.dirty = true; });
  $('#sel-scale').addEventListener('change', function () {
    App.proj.scaleSnapOn = $('#sel-scale').value === 'on';
    Roll.snapScale = App.proj.scaleSnapOn;
    Roll.cache = null; Roll.dirty = true;
  });
  $('#btn-roll-clear').addEventListener('click', function () {
    var t = rollTrack();
    if (!t) return toast('no melodic track selected');
    t.notes = [];
    rebuildIndex(); repaintSeq(); Roll.dirty = true; App.dirty = true;
    toast('piano roll cleared');
  });
  $('#btn-roll-scale').addEventListener('click', function () {
    var t = rollTrack();
    if (!t) return;
    var pr = App.proj, snap = Roll.snap;
    t.notes.forEach(function (n) {
      n.t = clamp(Math.round(n.t / snap) * snap, 0, pr.steps - 1);
      n.p = snapToScale(pr.root, pr.scale, n.p);
    });
    rebuildIndex(); repaintSeq();
    Roll.cache = null; Roll.dirty = true; App.dirty = true;
    toast('notes snapped to grid + ' + pr.scale, 'good');
  });
}

function wireIoPanel() {
  var sel = $('#sel-song');
  SONGS.forEach(function (s) {
    var o = document.createElement('option');
    o.value = s.name; o.textContent = s.name;
    sel.appendChild(o);
  });
  sel.addEventListener('change', function () {
    var s = SONGS.filter(function (x) { return x.name === sel.value; })[0];
    if (s) applySong(s);
  });
  $('#in-seed').addEventListener('input', function () {
    App.proj.seed = Number($('#in-seed').value) || 1;
    App.randSeed = App.proj.seed;
  });
  $('#btn-seed').addEventListener('click', function () {
    var s = Math.floor(Math.random() * 99999) + 1;
    $('#in-seed').value = String(s);
    App.proj.seed = s; App.randSeed = s;
    randomizeSong(s);
  });
  $('#btn-rnd-song').addEventListener('click', function () {
    var s = (App.randSeed || App.proj.seed);
    randomizeSong(s);
  });
  $('#btn-clear-song').addEventListener('click', function () {
    App.proj.tracks.forEach(function (t) {
      if (t.kind === 'perc') t.steps = new Array(MAXSTEPS).fill(0);
      else t.notes = [];
    });
    rebuildIndex(); buildSeq(); Seq.builtSteps = App.proj.steps;
    Roll.dirty = true; App.dirty = true;
    toast('all patterns cleared');
  });
  $('#btn-save').addEventListener('click', function () { saveJson(); });
  $('#btn-load').addEventListener('click', function () { $('#file-json').click(); });
  $('#file-json').addEventListener('change', function (e) {
    if (e.target.files && e.target.files[0]) loadJsonFile(e.target.files[0]);
    e.target.value = '';
  });
  $('#btn-ls-save').addEventListener('click', function () { saveLS(true); toast('saved to localStorage', 'good'); });
  $('#btn-ls-load').addEventListener('click', function () {
    if (!loadLS() || !App.pendingProject) toast('nothing stored in localStorage', 'bad');
    else { restore(App.pendingProject); }
  });
  $('#btn-wav1').addEventListener('click', function () { renderWav(1, {}); });
  $('#btn-wav2').addEventListener('click', function () { renderWav(Math.min(4, Math.ceil(24 / App.proj.steps) * 2 || 2), {}); });
  $('#btn-wav4').addEventListener('click', function () { renderWav(Math.max(2, Math.min(8, Math.ceil(30 / (App.proj.steps * 60 / App.proj.tempo / 4)))), { normalize: true }); });
}

/* ---------- global keyboard ---------- */
function wireKeyboard() {
  var blocked = ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'];
  document.addEventListener('keydown', function (e) {
    if (e.repeat) return;
    var tag = e.target && e.target.tagName ? e.target.tagName : '';
    if (blocked.indexOf(tag) >= 0 || (e.target && e.target.isContentEditable)) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var code = e.code || e.key;
    var known = KEYMAP[code] !== undefined || PADKEYS.indexOf(code) >= 0 ||
      OCTKEYS[code] !== undefined || code === 'Space' || code === 'Enter';
    if (!known) return;
    e.preventDefault();
    if (!App.audioReady) return;
    keyEventDown(code, e.shiftKey);
  });
  document.addEventListener('keyup', function (e) {
    var code = e.code || e.key;
    if (KEYMAP[code] !== undefined) keyEventUp(code);
  });
  window.addEventListener('blur', function () { releaseAllNotes(true); });
  document.addEventListener('visibilitychange', function () { if (document.hidden) releaseAllNotes(true); });
}

/* ---------- audio bootstrap ---------- */
function ensureAudio() {
  if (App.audioReady && App.ctx && App.ctx.state === 'running') return true;
  var AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) { toast('Web Audio API unavailable in this browser', 'bad'); return false; }
  try {
    if (!App.ctx) {
      App.ctx = new AC({ latencyHint: 'interactive' });
      App.E = makeEngine(App.ctx, App.proj, { noiseSeed: (App.proj.seed | 0) || 7 });
      applySolo(App.E);
      setMetro(App.E, App.proj.metro, 0.25);
      App.proj.tracks.forEach(function (t) { onTrackParam(t.id); });
      App.audioReady = true;
      App.msg = 'audio ' + App.ctx.sampleRate + 'Hz · baseLatency ' + Math.round((App.ctx.baseLatency || 0) * 1000) + 'ms';
    }
    var p = App.ctx.resume ? App.ctx.resume() : Promise.resolve();
    if (p && p.then) {
      return true;
    }
    return true;
  } catch (e) {
    toast('audio init failed: ' + (e && e.message || e), 'bad');
    App.audioReady = false;
    return false;
  }
}

/* ---------- boot ---------- */
function boot(silent) {
  $('#app').hidden = false;
  $('#gate').classList.add('gone');
  try {
    bootInner(silent);
  } catch (e) {
    window.__bootErr = String((e && e.stack) || e);
    toast('boot error: ' + (e && e.message), 'bad');
  }
  return true;
}
function bootInner(silent) {
  var mm = $('#master-meter');
  mm._a = mm.children[0]; mm._b = mm.children[1];
  $('#app').hidden = false;
  $('#gate').classList.add('gone');
  var fromStore = !silent && loadLS() && App.pendingProject;
  if (fromStore) {
    App.proj = null;
    if (restore(App.pendingProject)) toast('loaded saved project from localStorage', 'good');
    else applySong(SONGS[0]);
  } else {
    applySong(SONGS[0]);
  }
  buildTrackList();
  buildSeq();
  Seq.builtSteps = App.proj.steps;
  buildFxRack();
  buildPads();
  buildKeyboard();
  buildInspector(App.target);
  wireTopBar();
  wireIoPanel();
  wireKeyboard();
  initSeqInput();
  initRoll();
  initPlayInput();
  syncTopBar();
  syncTransport();
  window.addEventListener('resize', function () {
    clearTimeout(App.rz);
    App.rz = setTimeout(function () {
      Roll.cache = null; Roll.dirty = true;
      if (window.innerWidth < 760) $('#padrow').style.gridTemplateColumns = 'repeat(4,minmax(0,1fr))';
      else $('#padrow').style.gridTemplateColumns = '';
    }, 140);
  });
  if (!silent) {
    ensureAudio();
    if (App.audioReady) { setTimeout(function () { transportPlay(true); }, 60); }
  }
  if (!rafId) rafId = requestAnimationFrame(frame);
  App.ui = {
    syncTransport: syncTransport,
    syncTop: syncTopBar,
    lightKey: lightKey,
    lightPad: lightPad,
    hitPad: hitPad,
    clearPadLights: function () { (widgets.pads || []).forEach(function (b) { b.classList.remove('hit'); }); },
    repaintSeq: function () { repaintSeq(); },
    buildInspector: buildInspector,
    selectTrack: selectTrack
  };
  window.MODSYN = {
    version: SCHEMA,
    app: App,
    roll: Roll,
    songs: SONGS,
    pads: PADDEFS,
    geo: { rollGeo: function () { return rollGeo(); }, hit: function (x, y) { return rollHit(x, y); } },
    api: {
      play: function () { transportPlay(true); },
      select: function (tid) { selectTrack(tid); return App.target; },
      stop: function () { transportStop(true); },
      renderWav: renderWav,
      snapshot: snapshot,
      restore: restore,
      setProject: setProject,
      applySong: applySong,
      stats: function () {
        var m = App.E ? readMaster(App.E) : { rms: 0, peak: 0, corr: 0 };
        return {
          ctx: App.ctx ? App.ctx.state : 'none',
          playing: App.playing,
          step: (vizPos() || { i: -1 }).i,
          voices: App.E ? App.E.active.length : 0,
          dropped: App.E ? App.E.dropped : 0,
          errors: App.E ? App.E.errors : [],
          rms: m.rms, peak: m.peak, corr: m.corr,
          frameMs: App.vis.frameMs, quality: App.vis.quality,
          lateTicks: App.lateCount, driftMs: App.driftMs
        };
      },
      note: function (tid, midi, vel) { return noteOn(tid, midi, vel || 100, 'api' + Math.random()); }
    }
  };
  return true;
}

/* ---------- gate + start ---------- */
function initGate() {
  var foot = $('#gate-foot');
  var stored = null;
  try { stored = localStorage.getItem(LSK); } catch (e) { }
  foot.textContent = stored
    ? 'saved project found in localStorage - ENABLE AUDIO will load it'
    : 'no saved project - factory demo loop: Neon Drift';
  $('#btn-enable').addEventListener('click', function () { boot(false); });
  $('#btn-enable-silent').addEventListener('click', function () { boot(true); });
  $('#btn-reset-gate').addEventListener('click', function () {
    try { localStorage.removeItem(LSK); } catch (e) { }
    App.pendingProject = null;
    foot.textContent = 'stored project cleared - factory demo loop: Neon Drift';
    toast('stored project cleared');
  });
}
initGate();
