'use strict';
/* =====================================================================
   SHADOW PROTOCOL — procedural stealth heist sandbox
   Single-file, dependency-free. All simulation is deterministic:
   fixed 60 Hz tick, seeded RNG, no Math.random / Date.now in sim code.
   ===================================================================== */

/* ---------------- utilities ---------------- */
const TAU = Math.PI * 2;
const IS_BROWSER = typeof window !== 'undefined' && typeof window.document !== 'undefined';
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function dist(ax, ay, bx, by) { return Math.hypot(bx - ax, by - ay); }
function dist2(ax, ay, bx, by) { const dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; }
function angNorm(a) { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; }
function angLerp(a, b, t) { return a + angNorm(b - a) * clamp(t, 0, 1); }
function fmtTime(s) { s = Math.max(0, Math.floor(s)); const m = Math.floor(s / 60); return String(m).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }
function fmtSeed(n) { return String(n >>> 0).toUpperCase().padStart(8, '0'); }

/* Deterministic PRNG (mulberry32). Every sim-random decision flows through this. */
class RNG {
  constructor(seed) { this.s = (seed >>> 0) || 1; }
  next() { let t = this.s += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }
  f(a = 1, b) { return b === undefined ? this.next() * a : a + this.next() * (b - a); }
  i(a, b) { return Math.floor(this.f(a, b + 1)); } // inclusive
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  chance(p) { return this.next() < p; }
  shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(this.next() * (i + 1)); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; }
}
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

/* storage (localStorage guarded for headless testing) */
const Store = {
  get(k, d) { try { if (!IS_BROWSER) return d; const v = localStorage.getItem('heist.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { if (!IS_BROWSER) return; localStorage.setItem('heist.' + k, JSON.stringify(v)); } catch (e) { } }
};

/* ---------------- settings / bindings ---------------- */
const DEFAULT_BINDINGS = {
  up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
  run: ['ShiftLeft', 'ShiftRight'], interact: ['KeyE', 'Enter'], gadget: ['KeyG'],
  slot1: ['Digit1'], slot2: ['Digit2'], slot3: ['Digit3'],
  pause: ['Escape', 'KeyP'], help: ['KeyH'], diag: ['KeyO'],
};
const BIND_LABELS = { up: 'Move up', down: 'Move down', left: 'Move left', right: 'Move right', run: 'Run (hold)', interact: 'Interact / use', gadget: 'Use tool', slot1: 'Select tool 1', slot2: 'Select tool 2', slot3: 'Select tool 3', pause: 'Pause', help: 'Help', diag: 'Diagnostics' };
const Settings = {
  master: 0.8, fx: 0.9, reduced: false, statusHud: false, touch: 'auto', bindings: null,
  load() {
    const s = Store.get('settings', null);
    if (s) Object.assign(this, s);
    if (!this.bindings) this.bindings = JSON.parse(JSON.stringify(DEFAULT_BINDINGS));
    for (const k in DEFAULT_BINDINGS) if (!this.bindings[k] || !this.bindings[k].length) this.bindings[k] = DEFAULT_BINDINGS[k].slice();
    if (IS_BROWSER) { try { if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) this.reduced = true; } catch (e) { } }
  },
  save() { Store.set('settings', { master: this.master, fx: this.fx, reduced: this.reduced, statusHud: this.statusHud, touch: this.touch, bindings: this.bindings }); },
  bound(action) { return this.bindings[action] || []; },
  allCodes() { const s = new Set(); for (const k in this.bindings) for (const c of this.bindings[k]) s.add(c); return s; }
};

/* ---------------- audio (all synthesized, starts on user gesture) ---------------- */
const Sfx = {
  ctx: null, master: null, fx: null, started: false, alarmNodes: null, ambNodes: null,
  init() {
    if (this.ctx || !IS_BROWSER) return;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.gain.value = Settings.master; this.master.connect(this.ctx.destination);
    this.fx = this.ctx.createGain(); this.fx.gain.value = Settings.fx; this.fx.connect(this.master);
    this.startAmbient();
  },
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
  setVols() { if (this.master) this.master.gain.value = Settings.master; if (this.fx) this.fx.gain.value = Settings.fx; },
  ok() { return !!this.ctx && this.ctx.state !== 'closed'; },
  t0(d) { return this.ctx.currentTime + (d || 0); },
  env(g, t, a, peak, dur) { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(Math.max(0.0002, peak), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); },
  route(g, pan) {
    if (pan && this.ctx.createStereoPanner) { const p = this.ctx.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); g.connect(p); p.connect(this.fx); }
    else g.connect(this.fx);
  },
  tone(o) {
    if (!this.ok()) return;
    const { f0 = 440, f1 = 0, type = 'sine', dur = 0.15, vol = 0.4, pan = 0, delay = 0, a = 0.006 } = o;
    const t = this.t0(delay), osc = this.ctx.createOscillator();
    osc.type = type; osc.frequency.setValueAtTime(Math.max(1, f0), t);
    if (f1) osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const g = this.ctx.createGain(); this.env(g, t, a, vol, dur);
    osc.connect(g); this.route(g, pan); osc.start(t); osc.stop(t + dur + 0.06);
  },
  noise(o) {
    if (!this.ok()) return;
    const { dur = 0.14, vol = 0.3, freq = 1000, q = 1, type = 'bandpass', pan = 0, delay = 0, slide = 0 } = o;
    const t = this.t0(delay), sr = this.ctx.sampleRate, len = Math.max(1, Math.floor(sr * dur));
    const buf = this.ctx.createBuffer(1, len, sr), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const fl = this.ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(freq, t); fl.Q.value = q;
    if (slide) fl.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
    const g = this.ctx.createGain(); this.env(g, t, 0.005, vol, dur);
    src.connect(fl); fl.connect(g); this.route(g, pan); src.start(t); src.stop(t + dur + 0.05);
  },
  pos(px, py, x, y, range) {
    const d = dist(px, py, x, y), v = clamp(1 - d / (range * 1.7), 0, 1);
    return { vol: v * v, pan: clamp((x - px) / 420, -0.85, 0.85) };
  },
  /* --- concrete game sounds --- */
  ui() { this.tone({ f0: 660, dur: 0.06, vol: 0.12, type: 'square' }); },
  start() { this.tone({ f0: 220, f1: 440, dur: 0.4, vol: 0.2, type: 'triangle' }); this.noise({ dur: 0.5, freq: 400, vol: 0.08, type: 'lowpass' }); },
  step(run, v) { if (!this.ok()) return; this.noise({ dur: run ? 0.09 : 0.07, freq: run ? 620 : 480, q: 0.8, type: 'lowpass', vol: (run ? 0.20 : 0.085) * v }); },
  thud(v) { this.noise({ dur: 0.1, freq: 220, type: 'lowpass', vol: 0.22 * v }); this.tone({ f0: 90, f1: 55, dur: 0.1, vol: 0.14 * v, type: 'sine' }); },
  door(open, pan, v) { this.noise({ dur: 0.22, freq: open ? 300 : 240, slide: open ? 520 : 170, type: 'bandpass', q: 3, vol: 0.16 * v, pan }); },
  locked(pan, v) { this.tone({ f0: 160, dur: 0.09, vol: 0.14 * v, type: 'square', pan }); },
  pickClick(n, pan, v) { this.tone({ f0: 900 + n * 140, dur: 0.045, vol: 0.10 * v, type: 'square', pan }); },
  unlock(pan, v) { this.tone({ f0: 520, f1: 880, dur: 0.18, vol: 0.16 * v, type: 'triangle', pan }); },
  hackBeep(k, pan, v) { this.tone({ f0: 700 + k * 90, dur: 0.06, vol: 0.09 * v, type: 'sine', pan }); },
  hackDone(pan) { this.tone({ f0: 440, f1: 1320, dur: 0.5, vol: 0.2, type: 'sawtooth', pan }); this.tone({ f0: 880, dur: 0.3, vol: 0.12, type: 'sine', delay: 0.12 }); },
  pickupVal(pan) { this.tone({ f0: 1180, dur: 0.12, vol: 0.16, type: 'triangle', pan }); this.tone({ f0: 1560, dur: 0.16, vol: 0.13, type: 'triangle', pan, delay: 0.07 }); },
  pickupIntel(pan) { this.tone({ f0: 520, f1: 1040, dur: 0.3, vol: 0.2, type: 'triangle', pan }); this.tone({ f0: 780, f1: 1560, dur: 0.35, vol: 0.15, type: 'sine', pan, delay: 0.1 }); },
  smoke(pan) { this.noise({ dur: 0.5, freq: 900, slide: 200, type: 'lowpass', vol: 0.24, pan }); },
  zap() { this.tone({ f0: 1400, f1: 90, dur: 0.35, vol: 0.24, type: 'sawtooth' }); this.noise({ dur: 0.3, freq: 2400, slide: 200, vol: 0.16 }); },
  coinBeep(pan, v) { this.tone({ f0: 1650, dur: 0.05, vol: 0.1 * v, type: 'square', pan }); },
  camTick(pan, v) { this.tone({ f0: 1900, dur: 0.05, vol: 0.08 * v, type: 'square', pan }); },
  sus(pan, v) { this.tone({ f0: 620, f1: 930, dur: 0.16, vol: 0.15 * v, type: 'triangle', pan }); },
  alertS(pan, v) { this.tone({ f0: 980, f1: 490, dur: 0.3, vol: 0.22 * v, type: 'sawtooth', pan }); this.tone({ f0: 1960, f1: 980, dur: 0.28, vol: 0.1 * v, type: 'square', pan }); },
  caught() { this.tone({ f0: 400, f1: 60, dur: 1.1, vol: 0.3, type: 'sawtooth' }); this.noise({ dur: 0.8, freq: 300, slide: 80, vol: 0.2, type: 'lowpass' }); },
  win() { [523, 659, 784, 1047].forEach((f, i) => this.tone({ f0: f, dur: 0.5, vol: 0.16, type: 'triangle', delay: i * 0.13 })); },
  deny() { this.tone({ f0: 200, dur: 0.09, vol: 0.12, type: 'square' }); },
  alarmOn() {
    if (!this.ok() || this.alarmNodes) return;
    const g = this.ctx.createGain(); g.gain.value = 0.0; g.connect(this.fx);
    const o1 = this.ctx.createOscillator(), o2 = this.ctx.createOscillator();
    o1.type = 'sawtooth'; o2.type = 'sawtooth';
    const lfo = this.ctx.createOscillator(), lg = this.ctx.createGain();
    lfo.frequency.value = 1.6; lg.gain.value = 190;
    lfo.connect(lg); lg.connect(o1.frequency); lg.connect(o2.frequency);
    o1.frequency.value = 760; o2.frequency.value = 762;
    o1.connect(g); o2.connect(g);
    g.gain.linearRampToValueAtTime(0.085, this.t0(0.1));
    o1.start(); o2.start(); lfo.start();
    this.alarmNodes = { g, o1, o2, lfo };
  },
  alarmOff() {
    if (!this.alarmNodes) return; const n = this.alarmNodes, t = this.t0();
    n.g.gain.linearRampToValueAtTime(0.0001, t + 0.4);
    setTimeout(() => { try { n.o1.stop(); n.o2.stop(); n.lfo.stop(); } catch (e) { } }, 600);
    this.alarmNodes = null;
  },
  startAmbient() {
    if (!this.ok() || this.ambNodes) return;
    const g = this.ctx.createGain(); g.gain.value = 0.028; g.connect(this.master);
    const o = this.ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 52;
    const o2 = this.ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = 52.7;
    const fl = this.ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 130;
    const lfo = this.ctx.createOscillator(); lfo.frequency.value = 0.11;
    const lg = this.ctx.createGain(); lg.gain.value = 0.012; lfo.connect(lg); lg.connect(g.gain);
    o.connect(fl); o2.connect(fl); fl.connect(g);
    o.start(); o2.start(); lfo.start();
    this.ambNodes = { g, o, o2, lfo };
  }
};
