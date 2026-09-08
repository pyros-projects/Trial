/* ============================================================
   MODSYN-8 — module 30: scheduler, transport, live note input
   ============================================================ */

var App = {
  ctx: null, E: null, proj: null,
  playing: false,
  stepIdx: 0, nextTime: 0, tickId: null,
  lookahead: 0.055, tickMs: 25,
  markers: [], index: {},
  target: 'lead', oct: 0, playVel: 96,
  held: {}, ptr: {},
  lateCount: 0, driftMs: 0, schedLead: 0,
  audioReady: false, silentMode: false,
  vis: { quality: 2, frameMs: 0, skip: 0 },
  msg: 'ready', dirty: false
};

var PERC_IDS = ['kick', 'snare', 'hat', 'perc'];

/* ---------- helpers ---------- */
function trackById(id) {
  for (var i = 0; i < App.proj.tracks.length; i++) if (App.proj.tracks[i].id === id) return App.proj.tracks[i];
  return null;
}
function stepDur() { return 60 / clamp(App.proj.tempo, 20, 300) / 4; }
function swingAmt(sd) { return (clamp(App.proj.swing, 0, 80) / 100) * sd * 0.68; }

/* ---------- event index (rebuilt after edits) ---------- */
function rebuildIndex() {
  var pr = App.proj;
  var idx = {};
  pr.tracks.forEach(function (t) {
    if (t.kind !== 'mel') return;
    var by = new Array(Math.max(pr.steps, 32) + 2);
    t.notes.forEach(function (n) {
      var s = Math.round(n.t);
      if (s < 0 || s >= pr.steps) return;
      if (!by[s]) by[s] = [];
      by[s].push(n);
    });
    idx[t.id] = by;
  });
  App.index = idx;
}

/* ---------- step scheduling (audio-clock time) ---------- */
function scheduleStep(i, t) {
  var pr = App.proj, E = App.E;
  var sd = stepDur();
  var off = (i % 2 === 1) ? swingAmt(sd) : 0;
  var tt = t + off;
  for (var k = 0; k < pr.tracks.length; k++) {
    var tr = pr.tracks[k];
    if (!tr.on || tr.mute) continue;
    if (E.soloActive && !tr.solo) continue;
    if (tr.kind === 'perc') {
      var v = tr.steps[i];
      if (v > 0) {
        playNote(E, tr.id, tt, { sec: 0.25, v: v, chan: 'seq' });
        Vis.hist.push({ t: tt, p: 38 + (v / 127) * 30, col: tr.color, perc: true });
      }
    } else {
      var arr = App.index[tr.id] && App.index[tr.id][i];
      if (arr) {
        for (var n = 0; n < arr.length; n++) {
          var note = arr[n];
          playNote(E, tr.id, tt, { p: note.p, sec: Math.max(0.03, note.d * sd), v: note.v, chan: 'seq' });
          Vis.hist.push({ t: tt, p: note.p, col: tr.color, perc: false });
        }
      }
    }
  }
  if (pr.metro) clickAt(E, tt, i % 4 === 0);
  App.markers.push({ i: i, t: t });
  if (App.markers.length > 400) App.markers.splice(0, 200);
  if (Vis.hist.length > 420) Vis.hist.splice(0, 220);
}

/* ---------- the look-ahead scheduler ---------- */
function schedTick() {
  if (!App.playing || !App.E) return;
  var ctx = App.ctx;
  var now = ctx.currentTime;
  /* reclaim finished voices on every tick: voice bookkeeping must not depend on
     the render loop (rAF pauses in background tabs) or on new notes arriving */
  pruneActive(App.E, now);
  var guard = 0;
  var tickWall = performance.now();
  if (App.lastTickWall !== undefined && tickWall - App.lastTickWall > App.tickMs * 2.6) App.lateCount++;
  App.lastTickWall = tickWall;
  if (App.wallT0 === undefined) { App.wallT0 = tickWall; App.audioT0 = now; }
  else App.driftMs = ((tickWall - App.wallT0) / 1000 - (now - App.audioT0)) * 1000;
  while (App.nextTime < now + App.lookahead && guard++ < 96) {
    var len = clamp(App.proj.steps | 0, 1, MAXSTEPS);
    if (App.stepIdx >= len) App.stepIdx = App.stepIdx % len;
    scheduleStep(App.stepIdx, App.nextTime);
    var sd = stepDur();
    App.nextTime += sd;
    App.stepIdx = (App.stepIdx + 1) % len;
    if (guard > 40) { App.lateCount++; break; }
  }
  App.schedLead = Math.max(0, App.nextTime - now);
}

/* ---------- visual playhead position (audio-locked) ---------- */
function vizPos() {
  if (!App.playing || !App.E) return null;
  var now = App.ctx.currentTime;
  var m = App.markers;
  if (!m.length) return null;
  var i = m.length - 1;
  while (i > 0 && m[i].t > now) i--;
  var cur = m[i];
  var frac = clamp((now - cur.t) / stepDur(), 0, 1.2);
  return { i: cur.i, f: frac, pos: cur.i + frac };
}

/* ---------- transport ---------- */
function transportPlay(fromStart) {
  if (!ensureAudio()) return;
  var ctx = App.ctx;
  if (ctx.state !== 'running' && ctx.resume) ctx.resume();
  if (fromStart) { App.stepIdx = 0; App.markers.length = 0; Vis.hist.length = 0; }
  App.playing = true;
  App.wallT0 = undefined;
  App.driftMs = 0;
  App.nextTime = Math.max(App.nextTime, ctx.currentTime + 0.045);
  if (App.nextTime < ctx.currentTime) App.nextTime = ctx.currentTime + 0.045;
  if (App.tickId) clearInterval(App.tickId);
  App.tickId = setInterval(schedTick, App.tickMs);
  schedTick();
  if (App.ui && App.ui.syncTransport) App.ui.syncTransport();
}
function transportStop(killVoices) {
  App.playing = false;
  if (App.tickId) { clearInterval(App.tickId); App.tickId = null; }
  if (killVoices !== false && App.E) {
    App.E.active.slice().forEach(function (v) { try { v.kill(); } catch (e) { } });
    App.E.active.length = 0;
    releaseAllNotes(true);
  }
  App.markers.length = 0;
  App.stepIdx = 0;
  App.nextTime = 0;
  if (App.ui && App.ui.syncTransport) App.ui.syncTransport();
}
function transportRestart() {
  transportStop(true);
  transportPlay(true);
}

/* ---------- live note input (keyboard / mouse / touch) ---------- */
function targetTrack() {
  var t = trackById(App.target);
  if (!t || !t.on || t.mute) {
    for (var i = 0; i < App.proj.tracks.length; i++) {
      if (App.proj.tracks[i].kind === 'mel' && App.proj.tracks[i].on && !App.proj.tracks[i].mute) return App.proj.tracks[i];
    }
  }
  return t;
}
function noteOn(trackId, midi, vel, tag) {
  if (!App.audioReady || !App.E) return null;
  var T = App.E.T[trackId];
  if (!T) return null;
  var def = T.def;
  if (!def.on || def.mute) return null;
  if (App.E.soloActive && !def.solo) return null;
  var sd = stepDur();
  var t0 = App.ctx.currentTime + 0.002;
  var rec = playNote(App.E, trackId, t0, {
    p: midi, sec: Math.min(3.2, Math.max(0.35, sd * 8)), v: vel, chan: 'key'
  });
  if (rec) { rec.tag = tag; rec.trackId = trackId; }
  return rec;
}
function noteOffTag(tag) {
  var E = App.E;
  if (!E) return;
  for (var i = 0; i < E.active.length; i++) {
    if (E.active[i].tag === tag && E.active[i].chan === 'key') E.active[i].kill();
  }
}
function releaseAllNotes(silent) {
  App.held = {}; App.ptr = {};
  if (!App.E) return;
  for (var i = 0; i < App.E.active.length; i++) {
    if (App.E.active[i].chan === 'key') App.E.active[i].kill();
  }
  if (App.ui && App.ui.clearPadLights) App.ui.clearPadLights();
  if (!silent) toast('all notes released', 'good');
}

/* computer keyboard → semitone offsets (piano layout, 2 octaves) */
var KEYMAP = {
  KeyA: 0, KeyW: 1, KeyS: 2, KeyE: 3, KeyD: 4, KeyF: 5, KeyT: 6,
  KeyG: 7, KeyY: 8, KeyH: 9, KeyU: 10, KeyJ: 11, KeyK: 12, KeyO: 13,
  KeyL: 14, KeyP: 15, Semicolon: 16, Quote: 17, Backslash: 18
};
var OCTKEYS = { KeyZ: -1, KeyX: 1 };
var PADKEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8'];

function keyEventDown(code, shift) {
  var pr = App.proj;
  if (code === 'Space') { App.playing ? transportStop(false) : transportPlay(false); return; }
  if (code === 'Enter') { transportRestart(); return; }
  if (OCTKEYS[code] !== undefined) {
    App.oct = clamp(App.oct + OCTKEYS[code], -3, 3);
    buildKeyboard();
    if (App.ui && App.ui.syncTop) App.ui.syncTop();
    return;
  }
  if (PADKEYS.indexOf(code) >= 0) {
    if (App.ui && App.ui.hitPad) App.ui.hitPad(PADKEYS.indexOf(code), shift ? 127 : 96);
    return;
  }
  if (Object.prototype.hasOwnProperty.call(KEYMAP, code)) {
    var tag = 'k' + code;
    if (App.held[tag]) return;
    var base = 48 + App.oct * 12;
    var midi = clamp(base + KEYMAP[code], 12, 108);
    var t = targetTrack();
    if (!t) return;
    App.held[tag] = { t: t.id, midi: midi };
    noteOn(t.id, midi, shift ? 124 : App.playVel, tag);
    if (App.ui && App.ui.lightKey) App.ui.lightKey(midi, true, tag);
  }
}
function keyEventUp(code) {
  var tag = 'k' + code;
  if (App.held[tag]) {
    var h = App.held[tag];
    delete App.held[tag];
    noteOffTag(tag);
    if (App.ui && App.ui.lightKey) App.ui.lightKey(h.midi, false, tag);
  }
}

/* ---------- randomisation (seeded, deterministic) ---------- */
function genPerc(id, rnd) {
  var pr = App.proj;
  var dens = { kick: 0.34, snare: 0.2, hat: 0.66, perc: 0.2 }[id] || 0.3;
  var out = new Array(MAXSTEPS).fill(0);
  for (var i = 0; i < pr.steps; i++) {
    var strong = (i % 8 === 0) ? 1 : (i % 4 === 0 ? 0.7 : (i % 2 === 0 ? 0.42 : 0.24));
    var p = dens * (strong * 1.35 + 0.2);
    if (rnd() < p) out[i] = Math.round(52 + rnd() * 58 + strong * 22);
  }
  if (id === 'kick') { out[0] = 127; if (pr.steps > 8) out[8] = 104; }
  if (id === 'snare') {
    for (var b = 0; b + 4 < pr.steps; b += 8) out[b + 4] = 127;
    for (var j = 0; j < pr.steps; j++) if (j % 8 !== 4 && rnd() < 0.14) out[j] = Math.round(48 + rnd() * 42);
  }
  if (id === 'hat') {
    for (var k = 0; k < pr.steps; k++) if (k % 2 === 1 && rnd() < 0.42) out[k] = Math.round(46 + rnd() * 46);
    if (pr.steps > 4) out[pr.steps - 1] = 127;
  }
  return out;
}

function genMel(id, rnd) {
  var pr = App.proj;
  var sc = SCALES[pr.scale] || SCALES.minor;
  var notes = [];
  var i;
  if (id === 'pad') {
    for (i = 0; i < pr.steps; i += 8) {
      var deg = Math.floor(rnd() * sc.length);
      for (var k = 0; k < 3; k++) {
        var di = (deg + k * 2) % sc.length;
        var octv = Math.floor((deg + k * 2) / sc.length) * 12;
        notes.push({ t: i, p: 55 + sc[di] + octv, d: 8, v: 52 + Math.floor(rnd() * 24) });
      }
    }
  } else if (id === 'bass') {
    var last = 33;
    for (i = 0; i < pr.steps; i += 2) {
      var p;
      if (rnd() < 0.4) p = last;
      else p = 29 + sc[Math.floor(rnd() * sc.length)] + (rnd() < 0.2 ? 12 : 0);
      p = clamp(p, 24, 48);
      notes.push({ t: i, p: p, d: 2, v: rnd() < 0.16 ? 118 : 72 + Math.floor(rnd() * 38) });
      last = p;
    }
  } else {
    var stepLen = id === 'arps' ? 1 : 2;
    var pool = [];
    for (var o = 0; o < 3; o++) for (var s = 0; s < sc.length; s++) pool.push(60 + sc[s] + o * 12);
    var idx = Math.floor(rnd() * pool.length);
    for (i = 0; i < pr.steps; i += stepLen) {
      var density = id === 'arps' ? 0.8 : 0.5;
      if (rnd() < density) {
        var jump = rnd() < 0.3 ? 2 : 1;
        idx = clamp(idx + (rnd() < 0.5 ? -jump : jump), 0, pool.length - 1);
        notes.push({
          t: i, p: pool[idx],
          d: id === 'arps' ? 1 : 1 + Math.floor(rnd() * 3),
          v: 68 + Math.floor(rnd() * 56)
        });
      }
    }
  }
  return notes;
}

function randomizeTrack(id, seed) {
  var tr = trackById(id);
  if (!tr) return;
  var rnd = rng(hashStr((seed || App.proj.seed) + '|' + id + '|' + App.proj.scale));
  if (tr.kind === 'perc') tr.steps = genPerc(id, rnd);
  else tr.notes = genMel(id, rnd);
}

