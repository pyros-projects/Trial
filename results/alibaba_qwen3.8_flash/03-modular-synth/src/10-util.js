/* ============================================================
   MODSYN-8 — module 10: utils, state schema, presets
   ============================================================ */
'use strict';

window.__errs = [];
window.addEventListener('error', function (ev) {
  try { window.__errs.push(String(ev.message) + ' @' + String(ev.filename || '').slice(-28) + ':' + ev.lineno); } catch (e) { }
});

var SCHEMA = 'modsyn-project-v1';
var MAXSTEPS = 64;
var DEFAULT_STEPS = 32;

/* ---------- tiny helpers ---------- */
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function num(v, d) { return (typeof v === 'number' && isFinite(v)) ? v : d; }
function lerp(a, b, t) { return a + (b - a) * t; }
function round(v, n) { var p = Math.pow(10, n || 0); return Math.round(v * p) / p; }
function copy(o) { return JSON.parse(JSON.stringify(o)); }
function dbToGain(db) { return Math.pow(10, db / 20); }
function gainToDb(g) { return 20 * Math.log10(Math.max(g, 1e-7)); }

/* deterministic PRNG — mulberry32 */
function rng(seed) {
  var a = (seed >>> 0) || 1;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    var t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s) {
  var h = 2166136261 >>> 0;
  for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

var NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
function midiName(p) { return NOTES[((p % 12) + 12) % 12] + (Math.floor(p / 12) - 1); }

/* ---------- musical scales (semitone sets, root-relative) ---------- */
var SCALES = {
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  major: [0, 2, 4, 5, 7, 9, 11],
  mixo: [0, 2, 4, 5, 7, 9, 10],
  harmonic: [0, 2, 3, 5, 7, 8, 11],
  pentatonic: [0, 3, 5, 7, 10],
  pentMajor: [0, 2, 4, 7, 9],
  japanese: [0, 1, 5, 7, 8],
  whole: [0, 2, 4, 6, 8, 10]
};
function scaleHas(root, scaleName, pitch) {
  var s = SCALES[scaleName] || SCALES.chromatic;
  return s.indexOf((((pitch - root) % 12) + 12) % 12) >= 0;
}
function snapToScale(root, scaleName, pitch) {
  if (scaleHas(root, scaleName, pitch)) return pitch;
  for (var d = 1; d < 7; d++) {
    if (scaleHas(root, scaleName, pitch + d)) return pitch + d;
    if (scaleHas(root, scaleName, pitch - d)) return pitch - d;
  }
  return pitch;
}

/* ---------- velocity names ---------- */
function velName(v) { return v >= 110 ? 'ACC' : v >= 80 ? 'HI' : v >= 55 ? 'MID' : 'LO'; }

/* ---------- default synth / drum instances ---------- */
function melInst(o) {
  return Object.assign({
    wave1: 'sawtooth', wave2: 'square', osc2Level: 0.28, osc2Semis: 12, detune: 8,
    noise: 0.0, glide: 0.0, poly: 6, glideMode: 'always',
    aA: 0.006, aD: 0.22, aS: 0.62, aR: 0.35,
    fType: 'lowpass24', cutoff: 2600, res: 6.5, fEnv: 2400,
    fA: 0.004, fD: 0.28, fS: 0.35, fR: 0.25,
    lfoRate: 4.6, lfoDepth: 0.22, lfoTarget: 'cutoff', lfoWave: 'sine',
    fLo: 40, fHi: 12000
  }, o || {});
}
function percInst(o) {
  return Object.assign({
    voice: 'kick', tune: 0.5, decay: 0.5, tone: 0.5, drive: 0.45, level: 0.85, tune2: 0.5
  }, o || {});
}

/* ---------- track factory ---------- */
function melTrack(id, name, color, opts) {
  var t = {
    id: id, name: name, kind: 'mel', color: color, on: true, mute: false, solo: false,
    vol: 0.6, pan: 0, sendD: 0.28, sendR: 0.3,
    root: 9, scale: 'minor', octave: 0, pitch: 69, gate: 2,
    inst: melInst(), notes: []
  };
  return Object.assign(t, opts || {});
}
function percTrack(id, name, color, opts) {
  var t = {
    id: id, name: name, kind: 'perc', color: color, on: true, mute: false, solo: false,
    vol: 0.72, pan: 0, sendD: 0.12, sendR: 0.16,
    inst: percInst(), steps: new Array(MAXSTEPS).fill(0)
  };
  return Object.assign(t, opts || {});
}

/* ---------- pattern encoding ----------
   percussion: 32 (or N) chars — '.' off · '-' 60 · 'o' 98 · 'X' 127
   rolls:      "step:pitch:dur:vel" tuples separated by spaces
   ------------------------------------------------- */
function parsePerc(str, velMap) {
  var out = new Array(MAXSTEPS).fill(0);
  var map = velMap || { '.': 0, '-': 60, 'o': 98, 'X': 127, 'x': 74 };
  for (var i = 0; i < MAXSTEPS && i < str.length; i++) {
    var c = str[i];
    out[i] = Object.prototype.hasOwnProperty.call(map, c) ? map[c] : 0;
  }
  return out;
}
function parseRoll(str) {
  var out = [];
  if (!str) return out;
  str.trim().split(/\s+/).forEach(function (tok) {
    var p = tok.split(':');
    if (p.length < 2) return;
    out.push({
      t: +p[0], p: +p[1],
      d: p.length > 2 ? +p[2] : 2,
      v: p.length > 3 ? +p[3] : 96
    });
  });
  out.sort(function (a, b) { return a.t - b.t || a.p - b.p; });
  return out;
}
function fmtPerc(arr) {
  var s = '';
  for (var i = 0; i < arr.length; i++) s += arr[i] >= 110 ? 'X' : arr[i] >= 85 ? 'o' : arr[i] > 0 ? '-' : '.';
  return s;
}
function fmtRoll(notes) {
  return notes.map(function (n) { return n.t + ':' + n.p + ':' + n.d + ':' + n.v; }).join(' ');
}

/* ---------- master FX defaults ---------- */
function defaultFx() {
  return {
    delay: { on: true, time: 0.375, fb: 0.44, mix: 0.32, damp: 0.42, width: 0.75, sync: 'dotted8th' },
    verb: { on: true, size: 2.1, decay: 3.1, damp: 0.55, mix: 0.34, predelay: 0.012, seed: 7 },
    sat: { on: true, drive: 1.7, mix: 0.42, tone: 0.45 },
    tone: { on: true, low: 1.2, mid: -1.8, high: 2.4, fLow: 190, fMid: 1300, fHigh: 3600 },
    lim: { on: true, thr: -7.5, ratio: 14, atk: 0.004, rel: 0.17, makeup: 1.12 }
  };
}

/* ---------- project state ---------- */
function newProject(songName) {
  var p = {
    schema: SCHEMA,
    name: songName || 'Untitled',
    tempo: 100, swing: 14, master: 0.82, metro: false,
    steps: DEFAULT_STEPS, seed: 1337,
    root: 9, scale: 'minor',
    fx: defaultFx(),
    tracks: makeDefaultTracks()
  };
  return p;
}

function makeDefaultTracks() {
  return [
    melTrack('lead', 'LEAD', '#39d7ee', {
      vol: 0.54, pan: 0.12, sendD: 0.42, sendR: 0.44, octave: 1, pitch: 76, gate: 4,
      inst: melInst({
        wave1: 'sawtooth', wave2: 'sawtooth', osc2Level: 0.34, osc2Semis: 0, detune: 22,
        poly: 4, aA: 0.012, aD: 0.3, aS: 0.7, aR: 0.45,
        cutoff: 3400, res: 5.5, fEnv: 1500, lfoRate: 4.2, lfoDepth: 0.14, lfoTarget: 'cutoff'
      })
    }),
    melTrack('arps', 'ARPS', '#57e08a', {
      vol: 0.42, pan: -0.24, sendD: 0.5, sendR: 0.4, octave: 1, pitch: 72, gate: 1,
      inst: melInst({
        wave1: 'square', wave2: 'sine', osc2Level: 0.5, osc2Semis: 12, detune: 4,
        poly: 3, aA: 0.003, aD: 0.16, aS: 0.0, aR: 0.22,
        cutoff: 2100, res: 9, fEnv: 3400, fD: 0.2, lfoRate: 7, lfoDepth: 0.1, lfoTarget: 'amp'
      })
    }),
    melTrack('pad', 'PAD', '#b98cff', {
      vol: 0.34, pan: -0.05, sendD: 0.3, sendR: 0.62, octave: 0, pitch: 64, gate: 8,
      inst: melInst({
        wave1: 'sawtooth', wave2: 'triangle', osc2Level: 0.42, osc2Semis: -12, detune: 31,
        poly: 5, aA: 0.42, aD: 1.1, aS: 0.72, aR: 1.3,
        cutoff: 1500, res: 3.4, fEnv: 900, fA: 0.3, fD: 0.9, fS: 0.4,
        lfoRate: 0.28, lfoDepth: 0.34, lfoTarget: 'cutoff'
      })
    }),
    melTrack('bass', 'BASS', '#ffb454', {
      vol: 0.66, pan: 0, sendD: 0.06, sendR: 0.08, octave: -1, pitch: 33, gate: 2,
      inst: melInst({
        wave1: 'sawtooth', wave2: 'square', osc2Level: 0.4, osc2Semis: -12, detune: 6,
        poly: 1, glide: 0.035, aA: 0.004, aD: 0.3, aS: 0.55, aR: 0.14,
        cutoff: 780, res: 11, fEnv: 1900, fD: 0.24, lfoRate: 3.1, lfoDepth: 0.08, lfoTarget: 'cutoff'
      })
    }),
    percTrack('kick', 'KICK', '#ff5d8f', { vol: 0.86, sendD: 0.03, sendR: 0.05, inst: percInst({ voice: 'kick', tune: 0.44, decay: 0.42, tone: 0.3, drive: 0.62, level: 0.95 }) }),
    percTrack('snare', 'SNARE', '#ff8f5d', { vol: 0.6, pan: 0.08, sendD: 0.14, sendR: 0.3, inst: percInst({ voice: 'snare', tune: 0.52, decay: 0.4, tone: 0.55, drive: 0.4, level: 0.72 }) }),
    percTrack('hat', 'HAT', '#7fd4ff', { vol: 0.34, pan: -0.14, sendD: 0.1, sendR: 0.18, inst: percInst({ voice: 'hat', tune: 0.62, decay: 0.22, tone: 0.6, drive: 0.22, level: 0.6 }) }),
    percTrack('perc', 'PERC', '#8fe8b0', { vol: 0.4, pan: 0.3, sendD: 0.24, sendR: 0.42, inst: percInst({ voice: 'tom', tune: 0.46, decay: 0.42, tone: 0.5, drive: 0.35, level: 0.62 }) })
  ];
}

/* ============================================================
   Song presets — hand-authored demos
   ============================================================ */
function songPreset(name, meta) {
  return { name: name, data: meta };
}

/* Am — F — C — G over 2 bars, 100bpm, swung 16ths */
var SONG_NEON = {
  name: 'Neon Drift',
  tempo: 100, swing: 14, steps: 32, root: 9, scale: 'minor', master: 0.82,
  fx: {
    delay: { on: true, time: 0.375, fb: 0.44, mix: 0.32, damp: 0.42, width: 0.75, sync: 'dotted8th' },
    verb: { on: true, size: 2.1, decay: 3.1, damp: 0.55, mix: 0.34, predelay: 0.012, seed: 7 },
    sat: { on: true, drive: 1.7, mix: 0.42, tone: 0.45 },
    tone: { on: true, low: 1.2, mid: -1.8, high: 2.4, fLow: 190, fMid: 1300, fHigh: 3600 },
    lim: { on: true, thr: -7.5, ratio: 14, atk: 0.004, rel: 0.17, makeup: 1.12 }
  },
  tracks: {
    lead: { notes: parseRoll('0:76:4:100 4:72:2:86 6:74:2:82 8:81:4:98 13:77:2:80 15:79:1:74 16:76:4:104 20:79:2:88 22:76:2:84 24:71:3:92 27:74:3:86 30:76:2:90') },
    arps: { notes: parseRoll('0:69:1:96 2:72:1:82 4:76:1:92 6:81:1:104 8:65:1:92 10:69:1:80 12:72:1:90 14:77:1:104 16:60:1:94 18:64:1:82 20:67:1:90 22:72:1:104 24:59:1:92 26:62:1:80 28:67:1:90 30:71:1:104') },
    pad: { notes: parseRoll('0:57:8:74 0:60:8:66 0:64:8:62 8:53:8:72 8:57:8:64 8:60:8:60 16:60:8:72 16:64:8:64 16:67:8:60 24:55:8:72 24:59:8:64 24:62:8:60') },
    bass: { notes: parseRoll('0:33:2:104 2:33:2:70 4:33:2:94 6:36:2:76 8:33:2:98 10:31:2:74 12:31:2:88 14:28:2:72 16:33:2:104 18:36:2:74 20:38:2:92 22:38:2:70 24:40:2:98 26:38:2:76 28:36:2:90 30:35:2:78') },
    kick: { steps: parsePerc('X.......o..o..o.' + 'X.......o..o...X') },
    snare: { steps: parsePerc('....X.......X...' + '....X.....o..oX.') },
    hat: { steps: parsePerc('o.o.o.oXo.o.o.oX' + 'o.o.o.oXo.oXoXoX') },
    perc: { steps: parsePerc('..............-.' + '......-.......-.') }
  }
};

/* A phrygian acid, 108bpm */
var SONG_ACID = {
  name: 'Acid Chapel',
  tempo: 108, swing: 22, steps: 32, root: 9, scale: 'phrygian', master: 0.8,
  fx: {
    delay: { on: true, time: 0.281, fb: 0.56, mix: 0.4, damp: 0.3, width: 0.9, sync: 'dotted8th' },
    verb: { on: true, size: 2.6, decay: 4.2, damp: 0.42, mix: 0.42, predelay: 0.02, seed: 21 },
    sat: { on: true, drive: 2.4, mix: 0.5, tone: 0.3 },
    tone: { on: true, low: 2.6, mid: -3.2, high: 3.4, fLow: 220, fMid: 900, fHigh: 4200 },
    lim: { on: true, thr: -6, ratio: 16, atk: 0.003, rel: 0.14, makeup: 1.2 }
  },
  tracks: {
    lead: { notes: parseRoll('0:81:3:96 4:80:2:82 6:79:4:100 12:76:2:78 14:77:2:70 16:81:3:98 20:84:2:84 22:83:4:94 28:80:2:76 30:79:2:88') },
    arps: { notes: parseRoll('2:72:1:74 6:75:1:78 10:77:1:74 14:79:1:80 18:72:1:72 22:75:1:76 26:83:1:78 30:84:1:82') },
    pad: { notes: parseRoll('0:57:16:56 0:60:16:48 8:61:8:44 16:57:16:54 16:60:16:46 24:61:8:42') },
    bass: { notes: parseRoll('0:33:1:104 2:33:1:72 3:45:1:66 4:33:2:96 7:34:1:74 8:33:2:98 11:33:1:70 12:40:2:88 15:38:1:72 16:33:2:104 19:33:1:70 20:36:2:92 23:38:1:74 24:40:2:96 27:38:1:72 28:33:2:94 31:31:1:80') },
    kick: { steps: parsePerc('X......oX...o..o' + 'X......oX....o.o') },
    snare: { steps: parsePerc('....X......-X...' + '....X..o....-oX.') },
    hat: { steps: parsePerc('.o.oXo.o.oXo.o.X' + 'o.o.Xo.oXo.oXo.X') },
    perc: { steps: parsePerc('.......o......o.' + '..-.....X.....o.') }
  }
};

/* slow dub / ambient, 82bpm */
var SONG_MOON = {
  name: 'Moon Temple',
  tempo: 82, swing: 8, steps: 32, root: 2, scale: 'minor', master: 0.78,
  fx: {
    delay: { on: true, time: 0.549, fb: 0.62, mix: 0.44, damp: 0.55, width: 0.85, sync: 'dotted8th' },
    verb: { on: true, size: 3.0, decay: 5.2, damp: 0.62, mix: 0.48, predelay: 0.03, seed: 42 },
    sat: { on: true, drive: 1.3, mix: 0.32, tone: 0.6 },
    tone: { on: true, low: 2.2, mid: -2.4, high: 1.6, fLow: 240, fMid: 1600, fHigh: 5200 },
    lim: { on: true, thr: -9, ratio: 12, atk: 0.006, rel: 0.22, makeup: 1.05 }
  },
  tracks: {
    lead: { notes: parseRoll('0:74:6:88 8:72:4:76 14:76:6:92 22:79:4:80 28:77:4:72') },
    arps: { notes: parseRoll('4:81:2:70 12:83:2:68 20:86:2:70 26:84:2:66') },
    pad: { notes: parseRoll('0:50:16:50 0:53:16:44 0:57:16:40 16:48:16:48 16:52:16:42 16:55:16:38') },
    bass: { notes: parseRoll('0:26:6:100 8:26:4:82 12:31:4:88 18:29:6:84 24:24:4:92 28:26:4:80') },
    kick: { steps: parsePerc('X.......o.......' + 'X.......o......o') },
    snare: { steps: parsePerc('....X.......X...' + '....X.......X...') },
    hat: { steps: parsePerc('..o...o...o...o.' + '..o...o...o...o.') },
    perc: { steps: parsePerc('...........o...o' + '.......o........') }
  }
};

/* fast industrial / glitch, 128bpm */
var SONG_TOYS = {
  name: 'Broken Toys',
  tempo: 128, swing: 0, steps: 32, root: 4, scale: 'whole', master: 0.76,
  fx: {
    delay: { on: true, time: 0.188, fb: 0.38, mix: 0.28, damp: 0.22, width: 1, sync: 'sixteenth' },
    verb: { on: true, size: 1.5, decay: 2.4, damp: 0.35, mix: 0.26, predelay: 0.006, seed: 99 },
    sat: { on: true, drive: 3.2, mix: 0.6, tone: 0.25 },
    tone: { on: true, low: -1.4, mid: 2.8, high: 3.8, fLow: 160, fMid: 2200, fHigh: 5600 },
    lim: { on: true, thr: -5.5, ratio: 18, atk: 0.002, rel: 0.1, makeup: 1.25 }
  },
  tracks: {
    lead: { notes: parseRoll('0:84:1:104 3:86:1:86 5:84:1:92 8:91:2:98 12:88:1:84 14:86:1:90 16:84:1:100 19:91:1:88 21:89:2:94 26:93:1:82 28:91:2:96') },
    arps: { notes: parseRoll('1:72:1:70 5:79:1:72 9:84:1:70 13:91:1:74 17:74:1:70 21:81:1:72 25:86:1:70 29:88:1:74') },
    pad: { notes: parseRoll('0:45:14:44 0:52:14:38 16:43:14:42 16:50:14:36') },
    bass: { notes: parseRoll('0:28:1:104 2:28:1:78 4:29:1:92 6:28:1:74 8:30:1:96 10:28:1:76 12:27:1:88 14:28:1:72 16:28:1:100 18:35:1:86 20:33:1:92 22:28:1:74 24:31:1:94 26:30:1:78 28:28:1:96 30:23:1:84') },
    kick: { steps: parsePerc('X..o..X...o..o.X' + 'X..o..X...o..o.X') },
    snare: { steps: parsePerc('....X..o..X..oX-' + 'o...X..X..X..oXX') },
    hat: { steps: parsePerc('ooXoooXoooXoooXo' + 'oXoooXooXoooXoXo') },
    perc: { steps: parsePerc('..o....o....o..o' + 'o...o..o..X...o.') }
  }
};

var SONGS = [
  songPreset('Neon Drift', SONG_NEON),
  songPreset('Acid Chapel', SONG_ACID),
  songPreset('Moon Temple', SONG_MOON),
  songPreset('Broken Toys', SONG_TOYS)
];

/* ---------- per-track synth presets ---------- */
var TRACK_PRESETS = {
  mel: [
    ['— current —', null],
    ['Saw Lead', { wave1: 'sawtooth', wave2: 'sawtooth', osc2Level: 0.34, osc2Semis: 0, detune: 22, poly: 4, aA: 0.012, aD: 0.3, aS: 0.7, aR: 0.45, cutoff: 3400, res: 5.5, fEnv: 1500, lfoRate: 4.2, lfoDepth: 0.14, lfoTarget: 'cutoff' }],
    ['Pluck', { wave1: 'square', wave2: 'sine', osc2Level: 0.5, osc2Semis: 12, detune: 4, poly: 3, aA: 0.003, aD: 0.16, aS: 0, aR: 0.22, cutoff: 2100, res: 9, fEnv: 3400, fD: 0.2, lfoRate: 7, lfoDepth: 0.1, lfoTarget: 'amp' }],
    ['Acid 303', { wave1: 'sawtooth', wave2: 'square', osc2Level: 0.2, osc2Semis: 12, detune: 12, poly: 1, glide: 0.05, aA: 0.002, aD: 0.34, aS: 0.35, aR: 0.12, cutoff: 620, res: 21, fEnv: 4200, fD: 0.26, lfoRate: 0.7, lfoDepth: 0.1, lfoTarget: 'cutoff' }],
    ['Dark Pad', { wave1: 'triangle', wave2: 'sawtooth', osc2Level: 0.4, osc2Semis: -12, detune: 34, poly: 5, aA: 0.55, aD: 1.2, aS: 0.7, aR: 1.6, cutoff: 980, res: 4, fEnv: 700, fA: 0.4, fD: 1, fS: 0.4, lfoRate: 0.24, lfoDepth: 0.4, lfoTarget: 'cutoff' }],
    ['Bell FM', { wave1: 'sine', wave2: 'sine', osc2Level: 0.45, osc2Semis: 19, detune: 2, poly: 6, aA: 0.002, aD: 0.85, aS: 0.02, aR: 0.9, cutoff: 6500, res: 2.5, fEnv: -2200, fD: 0.6, lfoRate: 5.5, lfoDepth: 0.12, lfoTarget: 'pitch' }],
    ['Metal Drone', { wave1: 'square', wave2: 'square', osc2Level: 0.4, osc2Semis: 7, detune: 41, poly: 2, aA: 0.2, aD: 0.6, aS: 0.5, aR: 0.8, cutoff: 2600, res: 16, fEnv: 3000, lfoRate: 0.9, lfoDepth: 0.55, lfoTarget: 'pan' }],
    ['Key Click', { wave1: 'square', wave2: 'triangle', osc2Level: 0.3, osc2Semis: 24, detune: 0, noise: 0.35, poly: 8, aA: 0.001, aD: 0.09, aS: 0.05, aR: 0.1, cutoff: 4200, res: 7, fEnv: 5200, fD: 0.07, lfoRate: 9, lfoDepth: 0.06, lfoTarget: 'amp' }]
  ],
  perc: [
    ['— current —', null],
    ['808 Kick', { voice: 'kick', tune: 0.42, decay: 0.55, tone: 0.28, drive: 0.7, level: 0.95 }],
    ['Tight Kick', { voice: 'kick', tune: 0.55, decay: 0.22, tone: 0.5, drive: 0.45, level: 0.85 }],
    ['Snare Dry', { voice: 'snare', tune: 0.5, decay: 0.24, tone: 0.45, drive: 0.5, level: 0.72 }],
    ['Clap', { voice: 'clap', tune: 0.55, decay: 0.3, tone: 0.5, drive: 0.42, level: 0.7 }],
    ['Closed Hat', { voice: 'hat', tune: 0.6, decay: 0.14, tone: 0.65, drive: 0.2, level: 0.55 }],
    ['Open Hat', { voice: 'hat', tune: 0.72, decay: 0.55, tone: 0.72, drive: 0.18, level: 0.5 }],
    ['Lo Tom', { voice: 'tom', tune: 0.3, decay: 0.5, tone: 0.4, drive: 0.4, level: 0.7 }],
    ['Cowbell', { voice: 'cowbell', tune: 0.55, decay: 0.28, tone: 0.6, drive: 0.3, level: 0.55 }],
    ['Rim', { voice: 'rim', tune: 0.5, decay: 0.1, tone: 0.5, drive: 0.35, level: 0.6 }],
    ['Zap', { voice: 'zap', tune: 0.62, decay: 0.16, tone: 0.7, drive: 0.8, level: 0.5 }]
  ]
};

var PADDEFS = [
  ['KICK', 'kick', 0, 0, 127], ['KICK↓', 'kick', 0, -0.35, 74],
  ['SNARE', 'snare', 1, 0, 116], ['CLAP', 'clap', 1, 0, 100],
  ['HAT', 'hat', 2, 0, 96], ['OHAT', 'hat', 2, 0.55, 127],
  ['TOM', 'tom', 3, 0, 104], ['COWBL', 'cowbell', 3, 0, 88],
  ['RIM', 'rim', 3, 0, 74], ['ZAP', 'zap', 3, 0.25, 110],
  ['KICK·', 'kick', 0, 0.2, 52], ['SNR··', 'snare', 1, 0.25, 56]
];