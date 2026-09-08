/* ============================================================
   PULSEFALL — rhythm-synchronized bullet hell
   Single-file arcade game. All synthesis, logic and art inline.
   ============================================================ */
'use strict';

/* ---------------- constants & utils ---------------- */
const TAU = Math.PI * 2;
const W = 540, H = 720;                    // logical playfield
const SIM_DT = 1 / 240;                    // fixed simulation step
const LS_SET = 'pulsefall.settings.v1';
const LS_BEST = 'pulsefall.best.v1';

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const dist2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function hash32(n) { n = Math.imul(n ^ n >>> 16, 0x45d9f3b); n = Math.imul(n ^ n >>> 16, 0x45d9f3b); return (n ^ n >>> 16) >>> 0; }
function fnv1a(str) { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; }
const $ = id => document.getElementById(id);

function toast(msg, err) {
  const box = $('toast'); if (!box) return;
  const el = document.createElement('div');
  el.className = 'toast' + (err ? ' err' : ''); el.textContent = msg;
  box.appendChild(el);
  while (box.children.length > 4) box.removeChild(box.firstChild);
  setTimeout(() => el.remove(), 3500);
}

/* ---------------- settings ---------------- */
const DEFAULT_BINDINGS = {
  left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'],
  up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'],
  fire: ['KeyZ', 'Space'], focus: ['ShiftLeft', 'ShiftRight'],
  dash: ['KeyX'], bomb: ['KeyC'], pause: ['Escape', 'KeyP'],
};
const BIND_LABELS = {
  left: 'Move left', right: 'Move right', up: 'Move up', down: 'Move down',
  fire: 'Fire (hold)', focus: 'Focus (hold)', dash: 'Dash', bomb: 'Bomb', pause: 'Pause',
};
function defaultSettings() {
  return {
    tempo: 118, offsetMs: 0, difficulty: 'normal', preset: 'neon',
    master: 0.8,
    tracks: { drums: 0.9, bass: 0.85, lead: 0.75, pad: 0.55 },
    mutes: { drums: false, bass: false, lead: false, pad: false },
    particles: 1, shake: true, shakeAmp: 1,
    reducedMotion: false, reducedFlash: false, contrast: false, quality: 'high',
    bindings: JSON.parse(JSON.stringify(DEFAULT_BINDINGS)),
    showDiagHint: true,
  };
}
let SETTINGS = defaultSettings();
function loadSettings() {
  try {
    const raw = localStorage.getItem(LS_SET);
    if (raw) {
      const s = JSON.parse(raw);
      for (const k of Object.keys(SETTINGS)) {
        if (s[k] === undefined) continue;
        if (k === 'tracks' || k === 'mutes' || k === 'bindings') Object.assign(SETTINGS[k], s[k]);
        else SETTINGS[k] = s[k];
      }
    }
  } catch (e) { /* storage unavailable — run in-memory */ }
  try {
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) SETTINGS.reducedMotion = true;
  } catch (e) { }
}
function saveSettings() { try { localStorage.setItem(LS_SET, JSON.stringify(SETTINGS)); } catch (e) { } }
function saveBest(b) { try { localStorage.setItem(LS_BEST, JSON.stringify(b)); } catch (e) { } }
function loadBest() { try { return JSON.parse(localStorage.getItem(LS_BEST)); } catch (e) { return null; } }

const DIFFS = {
  easy:    { label: 'EASY',    spd: 0.72, den: 0.75, hp: 2400, hearts: 5, bombs: 3 },
  normal:  { label: 'NORMAL',  spd: 1.00, den: 1.00, hp: 3000, hearts: 4, bombs: 2 },
  hard:    { label: 'HARD',    spd: 1.22, den: 1.25, hp: 3600, hearts: 3, bombs: 2 },
  lunatic: { label: 'LUNATIC', spd: 1.45, den: 1.55, hp: 4200, hearts: 2, bombs: 3 },
};

/* ---------------- input ---------------- */
const INPUT = {
  down: new Set(),            // raw keyboard codes currently held
  vdown: new Set(),           // virtual action state (replay / synthesized edges)
  edges: [],                  // action edges awaiting sim consumption [{a,down,t}]
  touch: { fire: false, focus: false, dash: false, bomb: false },
  pointer: { active: false, x: W / 2, y: H * 0.78 },
  gp: { axes: [0, 0], prev: {}, holds: new Set(), seen: false },
  capturing: null,            // action name while rebinding
  codeMap: {},                // code -> [actions]
  rebuildMap() {
    this.codeMap = {};
    for (const a of Object.keys(SETTINGS.bindings))
      for (const c of SETTINGS.bindings[a])
        (this.codeMap[c] = this.codeMap[c] || []).push(a);
  },
  isDown(a) {
    for (const c of SETTINGS.bindings[a] || []) if (this.down.has(c)) return true;
    if (this.vdown.has(a)) return true;
    if (this.touch[a]) return true;
    if (this.gp.holds.has(a)) return true;
    return false;
  },
  moveAxis() {  // returns {x,y} in -1..1 from keys/gamepad (8-dir)
    let x = 0, y = 0;
    if (this.isDown('left')) x -= 1; if (this.isDown('right')) x += 1;
    if (this.isDown('up')) y -= 1; if (this.isDown('down')) y += 1;
    if (x === 0 && y === 0 && this.gp.seen) {
      x = this.gp.axes[0]; y = this.gp.axes[1];
    }
    const m = Math.hypot(x, y);
    if (m > 1) { x /= m; y /= m; }
    return { x, y };
  },
  press(a, immediateOK) {
    if (immediateOK !== false && a === 'pause') { UI.togglePause(); return; }
    this.edges.push({ a, down: true, t: CLOCK.game() });
    recordEdge(a, true);
  },
  release(a) { this.edges.push({ a, down: false, t: CLOCK.game() }); recordEdge(a, false); },
  releaseAll() {
    this.down.clear(); this.vdown.clear(); this.gp.holds.clear(); this.edges.length = 0;
    for (const k in this.touch) this.touch[k] = false;
    this.pointer.active = false;
    for (const id of ['t-fire', 't-focus', 't-dash', 't-bomb']) { const el = $(id); if (el) el.classList.remove('on'); }
  },
};

function initInput() {
  INPUT.rebuildMap();
  document.addEventListener('keydown', e => {
    if (INPUT.capturing) {
      e.preventDefault();
      if (e.code !== 'Escape') {
        SETTINGS.bindings[INPUT.capturing] = [e.code];
        saveSettings();
      }
      const act = INPUT.capturing; INPUT.capturing = null;
      INPUT.rebuildMap(); UI.refreshBinds();
      return;
    }
    const acts = INPUT.codeMap[e.code];
    if (!acts) return;
    if (e.code === 'Space' || e.code.startsWith('Arrow') || e.code === 'Tab') e.preventDefault();
    if (e.repeat) return;
    INPUT.down.add(e.code);
    for (const a of acts) INPUT.press(a);
  });
  document.addEventListener('keyup', e => {
    const acts = INPUT.codeMap[e.code]; if (!acts) return;
    INPUT.down.delete(e.code);
    for (const a of acts) INPUT.release(a);
  });

  // pointer on canvas — drag to steer
  const cv = $('game');
  const toField = e => {
    const r = cv.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
  };
  cv.addEventListener('pointerdown', e => {
    if (e.pointerType === 'touch') document.body.classList.add('touch');
    try { cv.setPointerCapture(e.pointerId); } catch (err) { }
    const p = toField(e);
    INPUT.pointer.active = true; INPUT.pointer.x = p.x; INPUT.pointer.y = p.y;
    recordEdge('__pd', true);
    e.preventDefault();
  });
  cv.addEventListener('pointermove', e => {
    if (!INPUT.pointer.active) return;
    const p = toField(e);
    INPUT.pointer.x = p.x; INPUT.pointer.y = p.y;
  });
  const pUp = () => { if (INPUT.pointer.active) recordEdge('__pu', true); INPUT.pointer.active = false; };
  cv.addEventListener('pointerup', pUp);
  cv.addEventListener('pointercancel', pUp);
  cv.addEventListener('contextmenu', e => e.preventDefault());

  // touch buttons
  const tmap = { 't-fire': 'fire', 't-focus': 'focus', 't-dash': 'dash', 't-bomb': 'bomb' };
  for (const id of Object.keys(tmap)) {
    const el = $(id), a = tmap[id];
    el.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation();
      INPUT.touch[a] = true; el.classList.add('on');
      if (a === 'dash' || a === 'bomb') INPUT.press(a);
      if (document.body.classList.contains('touch') === false) document.body.classList.add('touch');
    });
    const off = e => { INPUT.touch[a] = false; el.classList.remove('on'); };
    el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off);
    el.addEventListener('pointerleave', off);
  }

  window.addEventListener('blur', () => {
    INPUT.releaseAll();
    if (GAME && (GAME.state === 'run' || GAME.state === 'countdown' || GAME.state === 'lab') && !GAME.paused) UI.pauseGame();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && GAME && (GAME.state === 'run' || GAME.state === 'countdown' || GAME.state === 'lab') && !GAME.paused) UI.pauseGame();
  });

  // gamepad polling happens each frame in main loop
}
function pollGamepad() {
  if (!navigator.getGamepads) return;
  let gp = null;
  try { gp = navigator.getGamepads()[0] || [...navigator.getGamepads()].find(g => g && g.connected); } catch (e) { return; }
  if (!gp) { INPUT.gp.prev = {}; INPUT.gp.holds.clear(); return; }
  INPUT.gp.seen = true;
  const dz = 0.22;
  const ax = Math.abs(gp.axes[0]) > dz ? gp.axes[0] : 0;
  const ay = Math.abs(gp.axes[1]) > dz ? gp.axes[1] : 0;
  INPUT.gp.axes[0] = ax; INPUT.gp.axes[1] = ay;
  if (gp.buttons[12] && gp.buttons[12].pressed) INPUT.gp.axes[1] = -1;
  if (gp.buttons[13] && gp.buttons[13].pressed) INPUT.gp.axes[1] = 1;
  if (gp.buttons[14] && gp.buttons[14].pressed) INPUT.gp.axes[0] = -1;
  if (gp.buttons[15] && gp.buttons[15].pressed) INPUT.gp.axes[0] = 1;
  const map = { 0: 'fire', 7: 'fire', 1: 'dash', 2: 'bomb', 4: 'focus', 6: 'focus', 5: 'focus' };
  const now = {};
  for (let i = 0; i < gp.buttons.length; i++) if (gp.buttons[i] && gp.buttons[i].pressed) now[i] = true;
  for (const k of Object.keys(map)) {
    const i = +k, a = map[k];
    if (now[i] && !INPUT.gp.prev[i]) {
      if (a === 'dash' || a === 'bomb') INPUT.press(a); else INPUT.gp.holds.add(a);
    } else if (!now[i] && INPUT.gp.prev[i]) {
      if (!(a === 'dash' || a === 'bomb')) INPUT.gp.holds.delete(a);
      else INPUT.release(a);
    }
  }
  if (now[9] && !INPUT.gp.prev[9]) INPUT.press('pause');
  INPUT.gp.prev = now;
}
