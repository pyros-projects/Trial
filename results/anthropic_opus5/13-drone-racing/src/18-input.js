/* ============================================================================
   INPUT — keyboard, gamepad (with calibration / dead zone / inversion) and
   on-screen sticks. All three feed one normalised control vector:
     throttle 0..1, roll/pitch/yaw -1..1
   Keyboard throttle behaves like a real quad's left stick: it stays where you
   leave it instead of springing back, which is what makes it flyable.
   ========================================================================== */

const KEYMAP = {
  throttleUp: ['KeyW'], throttleDown: ['KeyS'],
  yawLeft: ['KeyA'], yawRight: ['KeyD'],
  pitchFwd: ['ArrowUp', 'KeyI'], pitchBack: ['ArrowDown', 'KeyK'],
  rollLeft: ['ArrowLeft', 'KeyJ'], rollRight: ['ArrowRight', 'KeyL'],
  boost: ['ShiftLeft', 'ShiftRight'], cut: ['ControlLeft', 'ControlRight']
};

const GAMEPAD_DEFAULT = {
  index: null,
  axis: { throttle: 1, yaw: 0, roll: 2, pitch: 3 },
  invert: { throttle: true, yaw: false, roll: false, pitch: true },
  deadzone: 0.08,
  cal: null,                 /* {min:[], max:[], center:[]} once calibrated */
  buttons: { reset: 0, restart: 1, camera: 2, mode: 3, pause: 9, ghost: 8 }
};

class InputSystem {
  constructor(opts) {
    this.keys = new Set();
    this.ctl = { throttle: 0, roll: 0, pitch: 0, yaw: 0 };
    this.raw = { throttle: 0, roll: 0, pitch: 0, yaw: 0 };
    this.source = 'keyboard';
    this.gp = Object.assign({}, GAMEPAD_DEFAULT, (opts && opts.gamepad) || {});
    this.gp.axis = Object.assign({}, GAMEPAD_DEFAULT.axis, this.gp.axis);
    this.gp.invert = Object.assign({}, GAMEPAD_DEFAULT.invert, this.gp.invert);
    this.gamepadConnected = false; this.gamepadId = ''; this.gamepadAxes = []; this.gamepadButtons = [];
    this.calibrating = false; this.calData = null;
    this.touch = { active: false, lx: 0, ly: 0, rx: 0, ry: 0, throttleMem: 0 };
    this.keyThrottle = 0;
    this.smoothing = 1.0;
    this.invertPitchKeys = false;
    this.actions = [];            /* queued discrete actions for the app */
    this.prevButtons = [];
    this.lastGamepadPoll = 0;
    this.enabled = true;
  }

  attach(el) {
    this._onKeyDown = e => {
      if (!this.enabled) return;
      if (e.repeat) { this._maybePreventDefault(e); return; }
      this.keys.add(e.code);
      const a = this._actionForKey(e);
      if (a) { this.actions.push(a); e.preventDefault(); return; }
      this._maybePreventDefault(e);
    };
    this._onKeyUp = e => { this.keys.delete(e.code); this._maybePreventDefault(e); };
    this._onBlur = () => this.keys.clear();
    window.addEventListener('keydown', this._onKeyDown, { passive: false });
    window.addEventListener('keyup', this._onKeyUp, { passive: false });
    window.addEventListener('blur', this._onBlur);
    window.addEventListener('gamepadconnected', e => {
      this.gamepadConnected = true; this.gamepadId = e.gamepad.id;
      if (this.gp.index === null) this.gp.index = e.gamepad.index;
      this.actions.push({ type: 'gamepad', connected: true, id: e.gamepad.id });
    });
    window.addEventListener('gamepaddisconnected', e => {
      this.gamepadConnected = false;
      this.actions.push({ type: 'gamepad', connected: false, id: e.gamepad.id });
    });
    this._attachSticks();
  }

  _maybePreventDefault(e) {
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab', 'Backspace'].indexOf(e.code) >= 0) e.preventDefault();
  }

  _actionForKey(e) {
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return null;
    switch (e.code) {
      case 'KeyC': return { type: 'camera', dir: e.shiftKey ? -1 : 1 };
      case 'KeyV': return { type: 'camera', dir: -1 };
      case 'KeyM': return { type: 'mode', dir: e.shiftKey ? -1 : 1 };
      case 'KeyR': return { type: 'recover' };
      case 'Backspace': return { type: 'restart' };
      case 'KeyP': case 'Escape': return { type: 'pause' };
      case 'Tab': return { type: 'panel' };
      case 'KeyG': return { type: 'ghost' };
      case 'KeyH': return { type: 'help' };
      case 'KeyO': return { type: 'diag' };
      case 'KeyN': return { type: 'line' };
      case 'KeyB': return { type: 'telemetry' };
      case 'F9': return { type: 'screenshot' };
      case 'Digit1': return { type: 'cameraSet', index: 0 };
      case 'Digit2': return { type: 'cameraSet', index: 1 };
      case 'Digit3': return { type: 'cameraSet', index: 2 };
      case 'Digit4': return { type: 'cameraSet', index: 3 };
      case 'BracketLeft': return { type: 'fov', d: -5 };
      case 'BracketRight': return { type: 'fov', d: 5 };
      default: return null;
    }
  }

  /* ---------------- on-screen sticks (pointer + touch) ------------------ */
  _attachSticks() {
    const bind = (id, isLeft) => {
      const el = document.getElementById(id); if (!el) return;
      const knob = el.querySelector('.knob');
      let id0 = null;
      const set = (dx, dy) => {
        const r = el.clientWidth * 0.5 - 20;
        const l = Math.hypot(dx, dy), k = l > r ? r / l : 1;
        const x = dx * k, y = dy * k;
        knob.style.transform = `translate(${x}px,${y}px)`;
        const nx = clamp(x / r, -1, 1), ny = clamp(-y / r, -1, 1);
        if (isLeft) { this.touch.lx = nx; this.touch.ly = ny; }
        else { this.touch.rx = nx; this.touch.ry = ny; }
        this.touch.active = true;
      };
      el.addEventListener('pointerdown', e => {
        id0 = e.pointerId; el.setPointerCapture(e.pointerId);
        const b = el.getBoundingClientRect();
        set(e.clientX - (b.left + b.width / 2), e.clientY - (b.top + b.height / 2));
        e.preventDefault();
      });
      el.addEventListener('pointermove', e => {
        if (e.pointerId !== id0) return;
        const b = el.getBoundingClientRect();
        set(e.clientX - (b.left + b.width / 2), e.clientY - (b.top + b.height / 2));
        e.preventDefault();
      });
      const up = e => {
        if (e.pointerId !== id0) return; id0 = null;
        if (isLeft) { this.touch.throttleMem = clamp(this.touch.throttleMem + this.touch.ly * 0, 0, 1); this.touch.lx = 0; this.touch.ly = 0; }
        else { this.touch.rx = 0; this.touch.ry = 0; }
        knob.style.transform = 'translate(0px,0px)';
      };
      el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    };
    bind('tstickL', true); bind('tstickR', false);
  }

  /* ---------------- gamepad --------------------------------------------- */
  pollGamepad() {
    if (!navigator.getGamepads) return null;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let pad = null;
    if (this.gp.index != null && pads[this.gp.index]) pad = pads[this.gp.index];
    else for (let i = 0; i < pads.length; i++) if (pads[i]) { pad = pads[i]; this.gp.index = i; break; }
    this.gamepadConnected = !!pad;
    if (!pad) { this.gamepadAxes = []; this.gamepadButtons = []; return null; }
    this.gamepadId = pad.id;
    this.gamepadAxes = Array.from(pad.axes);
    this.gamepadButtons = Array.from(pad.buttons).map(b => (typeof b === 'object' ? b.value : b));
    return pad;
  }

  startCalibration() {
    const pad = this.pollGamepad(); if (!pad) return false;
    this.calibrating = true;
    this.calData = { min: pad.axes.map(v => v), max: pad.axes.map(v => v), center: pad.axes.map(v => v), t: 0 };
    return true;
  }
  finishCalibration(save) {
    if (!this.calibrating) return null;
    this.calibrating = false;
    if (save && this.calData) {
      const ok = this.calData.min.map((mn, i) => this.calData.max[i] - mn > 0.4);
      this.gp.cal = { min: this.calData.min.slice(), max: this.calData.max.slice(), center: this.calData.center.slice(), ok };
    }
    const r = this.calData; this.calData = null; return r;
  }
  _axisValue(pad, name) {
    const idx = this.gp.axis[name];
    if (idx == null || !pad.axes || idx >= pad.axes.length) return 0;
    let v = pad.axes[idx];
    const cal = this.gp.cal;
    if (cal && cal.ok && cal.ok[idx]) {
      const c = cal.center[idx];
      v = v >= c ? (v - c) / Math.max(1e-3, cal.max[idx] - c) : (v - c) / Math.max(1e-3, c - cal.min[idx]);
      v = clamp(v, -1, 1);
    }
    if (this.gp.invert[name]) v = -v;
    const dz = this.gp.deadzone;
    if (Math.abs(v) < dz) return 0;
    return sign(v) * (Math.abs(v) - dz) / (1 - dz);
  }

  /* ---------------- per-frame update ------------------------------------ */
  update(dt) {
    dt = clamp(dt, 0, 0.1);
    const K = this.keys, held = c => KEYMAP[c].some(k => K.has(k));
    /* keyboard: throttle integrates, attitude springs back */
    const rate = 2.3 * this.smoothing, spring = 8.5 * this.smoothing, ret = 11 * this.smoothing;
    if (held('boost')) this.keyThrottle = Math.min(1, this.keyThrottle + rate * 2.6 * dt);
    else if (held('cut')) this.keyThrottle = Math.max(0, this.keyThrottle - rate * 2.6 * dt);
    else if (held('throttleUp')) this.keyThrottle = Math.min(1, this.keyThrottle + rate * dt);
    else if (held('throttleDown')) this.keyThrottle = Math.max(0, this.keyThrottle - rate * dt);
    const axis = (neg, pos, cur) => {
      let target = 0;
      if (held(pos)) target += 1;
      if (held(neg)) target -= 1;
      const k = target === 0 ? ret : spring;
      return cur + (target - cur) * clamp(k * dt, 0, 1);
    };
    this._kr = axis('rollLeft', 'rollRight', this._kr || 0);
    this._kp = axis('pitchBack', 'pitchFwd', this._kp || 0);
    this._ky = axis('yawLeft', 'yawRight', this._ky || 0);

    let thr = this.keyThrottle;
    /* keyboard "pitch forward" means nose down, i.e. a negative pitch command */
    let roll = this._kr, pitch = -this._kp * (this.invertPitchKeys ? -1 : 1), yaw = this._ky;
    this.source = 'keyboard';

    /* on-screen sticks add in */
    if (this.touch.active) {
      const tThr = clamp(this.touch.throttleMem + this.touch.ly * dt * 1.5, 0, 1);
      this.touch.throttleMem = tThr;
      if (Math.abs(this.touch.ly) > 0.02) { thr = tThr; this.source = 'touch'; }
      if (Math.abs(this.touch.lx) > 0.02) { yaw = this.touch.lx; this.source = 'touch'; }
      if (Math.abs(this.touch.rx) > 0.02 || Math.abs(this.touch.ry) > 0.02) {
        roll = this.touch.rx; pitch = this.touch.ry; this.source = 'touch';
      }
    }

    /* gamepad wins whenever it is being moved */
    const pad = this.pollGamepad();
    if (pad) {
      if (this.calibrating && this.calData) {
        for (let i = 0; i < pad.axes.length; i++) {
          this.calData.min[i] = Math.min(this.calData.min[i], pad.axes[i]);
          this.calData.max[i] = Math.max(this.calData.max[i], pad.axes[i]);
        }
        this.calData.t += dt;
      }
      const gThr = this._axisValue(pad, 'throttle'), gYaw = this._axisValue(pad, 'yaw');
      const gRoll = this._axisValue(pad, 'roll'), gPitch = this._axisValue(pad, 'pitch');
      const any = Math.abs(gThr) + Math.abs(gYaw) + Math.abs(gRoll) + Math.abs(gPitch);
      if (any > 0.02 || this._gpEngaged) {
        this._gpEngaged = true;
        thr = clamp((gThr + 1) * 0.5, 0, 1); roll = gRoll; pitch = gPitch; yaw = gYaw;
        this.source = 'gamepad';
      }
      const B = this.gp.buttons, prev = this.prevButtons;
      const pressed = i => this.gamepadButtons[i] > 0.5 && !(prev[i] > 0.5);
      if (pressed(B.reset)) this.actions.push({ type: 'recover' });
      if (pressed(B.restart)) this.actions.push({ type: 'restart' });
      if (pressed(B.camera)) this.actions.push({ type: 'camera', dir: 1 });
      if (pressed(B.mode)) this.actions.push({ type: 'mode', dir: 1 });
      if (pressed(B.pause)) this.actions.push({ type: 'pause' });
      if (pressed(B.ghost)) this.actions.push({ type: 'ghost' });
      this.prevButtons = this.gamepadButtons.slice();
    } else this._gpEngaged = false;

    this.raw.throttle = thr; this.raw.roll = roll; this.raw.pitch = pitch; this.raw.yaw = yaw;
    this.ctl.throttle = clamp(thr, 0, 1);
    this.ctl.roll = clamp(roll, -1, 1);
    this.ctl.pitch = clamp(pitch, -1, 1);
    this.ctl.yaw = clamp(yaw, -1, 1);
    return this.ctl;
  }

  takeActions() { const a = this.actions; this.actions = []; return a; }
  setThrottle(v) { this.keyThrottle = clamp(v, 0, 1); this.touch.throttleMem = clamp(v, 0, 1); }
  status() {
    return {
      source: this.source, gamepad: this.gamepadConnected, gamepadId: this.gamepadId,
      axes: this.gamepadAxes.map(v => +v.toFixed(3)), deadzone: this.gp.deadzone,
      mapping: this.gp.axis, invert: this.gp.invert, calibrated: !!this.gp.cal
    };
  }
}
