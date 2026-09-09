'use strict';
/* ============================= input: keyboard, gamepad, touch ============================= */
const Input = {
  keys: Object.create(null),
  kb: { throttle: 0, yaw: 0, pitch: 0, roll: 0 },
  out: { throttle: 0, yaw: 0, pitch: 0, roll: 0, source: 'kb' },
  pad: { connected: false, active: false, id: '', axes: [0, 0, 0, 0], raw: [0, 0, 0, 0] },
  calib: null, calibActive: false, calibT: 0, calibData: null,
  touch: { active: false, pts: {}, left: null, right: null },
  orbit: { dragging: false, lastX: 0, lastY: 0, dx: 0, dy: 0, wheel: 0 },
  anyKeyPress: false,
};

Input.init = function (canvas) {
  const isTyping = () => {
    const el = document.activeElement;
    return el && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
  };
  window.addEventListener('keydown', (e) => {
    if (isTyping()) return;
    Input.anyKeyPress = true;
    const c = e.code;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(c)) e.preventDefault();
    if (!Input.keys[c]) Input.onAction && Input.onAction(c, e);
    Input.keys[c] = true;
  });
  window.addEventListener('keyup', (e) => { Input.keys[e.code] = false; });
  window.addEventListener('blur', () => { Input.keys = Object.create(null); Input.orbit.dragging = false; });

  // pointer: orbit drag (mouse) + virtual sticks (touch)
  canvas.addEventListener('pointerdown', (e) => {
    Input.anyKeyPress = true;
    if (e.pointerType === 'touch') {
      Input.touch.active = true;
      const half = canvas.clientWidth / 2;
      const stick = e.clientX < half ? 'left' : 'right';
      const pt = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY };
      Input.touch.pts[e.pointerId] = pt;
      Input.touch[stick] = pt; pt.stick = stick;
    } else {
      Input.orbit.dragging = true; Input.orbit.lastX = e.clientX; Input.orbit.lastY = e.clientY;
    }
    canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') {
      const pt = Input.touch.pts[e.pointerId];
      if (pt) { pt.x = e.clientX; pt.y = e.clientY; }
    } else if (Input.orbit.dragging) {
      Input.orbit.dx += e.clientX - Input.orbit.lastX;
      Input.orbit.dy += e.clientY - Input.orbit.lastY;
      Input.orbit.lastX = e.clientX; Input.orbit.lastY = e.clientY;
    }
  });
  const endP = (e) => {
    if (e.pointerType === 'touch') {
      const pt = Input.touch.pts[e.pointerId];
      if (pt) { if (Input.touch[pt.stick] === pt) Input.touch[pt.stick] = null; delete Input.touch.pts[e.pointerId]; }
      if (!Object.keys(Input.touch.pts).length) Input.touch.active = false;
    } else Input.orbit.dragging = false;
  };
  canvas.addEventListener('pointerup', endP);
  canvas.addEventListener('pointercancel', endP);
  canvas.addEventListener('wheel', (e) => { Input.orbit.wheel += e.deltaY; e.preventDefault(); }, { passive: false });
};

Input.startCalibration = function () {
  Input.calibActive = true; Input.calibT = 6; Input.calibData = { axes: [] };
  for (let i = 0; i < 4; i++) Input.calibData.axes.push({ min: 1e9, max: -1e9, sum: 0, n: 0 });
};
Input.updateCalibration = function (rawAxes, dt) {
  if (!Input.calibActive) return;
  Input.calibT -= dt;
  for (let i = 0; i < 4; i++) {
    const c = Input.calibData.axes[i], v = rawAxes[i];
    c.min = Math.min(c.min, v); c.max = Math.max(c.max, v); c.sum += v; c.n++;
  }
  if (Input.calibT <= 0) {
    Input.calibActive = false;
    Input.calib = { axes: Input.calibData.axes.map((c) => ({ min: c.min, max: c.max, center: c.sum / c.n })) };
    try { localStorage.setItem('fpvdr.calib', JSON.stringify(Input.calib)); } catch (e) { }
    return true;
  }
  return false;
};
Input.loadCalib = function () {
  try { const s = localStorage.getItem('fpvdr.calib'); if (s) Input.calib = JSON.parse(s); } catch (e) { }
};
function applyCalib(raw, c) {
  if (!c) return raw;
  const half = raw >= c.center ? Math.max(0.05, c.max - c.center) : Math.max(0.05, c.center - c.min);
  return clamp((raw - c.center) / half, -1.2, 1.2);
}
function deadzone(x, dz) {
  const a = Math.abs(x);
  if (a < dz) return 0;
  return Math.sign(x) * (a - dz) / (1 - dz);
}

Input.pollPads = function (dt) {
  const pads = (navigator.getGamepads && navigator.getGamepads()) || [];
  let pad = null;
  for (const p of pads) { if (p && p.connected) { pad = p; break; } }
  Input.pad.connected = !!pad;
  if (pad) {
    Input.pad.id = pad.id;
    const raw = [0, 0, 0, 0];
    if (pad.mapping === 'standard') {
      raw[0] = pad.axes[0] || 0; raw[1] = pad.axes[1] || 0; raw[2] = pad.axes[2] || 0; raw[3] = pad.axes[3] || 0;
    } else if (pad.axes.length >= 4) {
      raw[0] = pad.axes[0] || 0; raw[1] = pad.axes[1] || 0; raw[2] = pad.axes[2] || 0; raw[3] = pad.axes[3] || 0;
    }
    Input.pad.raw = raw;
    if (Input.updateCalibration(raw, dt)) UI.toast('Gamepad calibrated');
    const cal = Input.calib ? Input.calib.axes : null;
    const dz = P.deadzone;
    const ax = [
      deadzone(applyCalib(raw[0], cal && cal[0]), dz),
      deadzone(applyCalib(raw[1], cal && cal[1]), dz),
      deadzone(applyCalib(raw[2], cal && cal[2]), dz),
      deadzone(applyCalib(raw[3], cal && cal[3]), dz),
    ];
    Input.pad.axes = ax;
    let bActive = false;
    if (pad.buttons) for (const b of pad.buttons) if (b && b.value > 0.3) bActive = true;
    const axisAny = Math.abs(ax[0]) + Math.abs(ax[1]) + Math.abs(ax[2]) + Math.abs(ax[3]) > 0.05;
    if (axisAny || bActive) Input.pad.active = true;
    Input.pad.anyInput = axisAny || bActive;
  } else {
    Input.pad.active = false;
    Input.pad.anyInput = false;
  }
};

Input.update = function (dt) {
  Input.pollPads(dt);
  const K = Input.keys, kb = Input.kb;
  // throttle: hold position like a transmitter stick
  if (K['KeyW']) kb.throttle += 1.15 * dt;
  if (K['KeyS']) kb.throttle -= 1.15 * dt;
  kb.throttle = clamp(kb.throttle, 0, 1);
  // spring axes
  const move = (cur, neg, pos, dt) => {
    let t = 0;
    if (K[pos]) t += 1;
    if (K[neg]) t -= 1;
    if (t !== 0) return clamp(cur + t * 6.5 * dt, -1, 1);
    const dec = 9 * dt;
    return Math.abs(cur) < dec ? 0 : cur - Math.sign(cur) * dec;
  };
  kb.yaw = move(kb.yaw, 'KeyA', 'KeyD', dt);
  kb.pitch = move(kb.pitch, 'ArrowDown', 'ArrowUp', dt);
  kb.roll = move(kb.roll, 'ArrowLeft', 'ArrowRight', dt);

  // touch sticks
  let tThrottle = null, tYaw = 0, tPitch = 0, tRoll = 0;
  if (Input.touch.left) {
    const pt = Input.touch.left;
    const dx = clamp((pt.x - pt.x0) / 70, -1, 1), dy = clamp((pt.y0 - pt.y) / 90, -1, 1);
    tYaw = dx; tThrottle = clamp((kb.throttle + dy), 0, 1);
  }
  if (Input.touch.right) {
    const pt = Input.touch.right;
    tRoll = clamp((pt.x - pt.x0) / 70, -1, 1);
    tPitch = clamp((pt.y0 - pt.y) / 70, -1, 1);
  }

  const padDrives = Input.pad.active && Input.pad.anyInput;
  const o = Input.out;
  if (tThrottle !== null || Input.touch.right) {
    o.source = 'touch';
    o.throttle = tThrottle !== null ? tThrottle : kb.throttle;
    o.yaw = tYaw; o.pitch = tPitch; o.roll = tRoll;
    Input.pad.active = false;
  } else if (padDrives) {
    o.source = 'pad';
    o.throttle = clamp((P.invertThrottle ? -Input.pad.axes[1] : Input.pad.axes[1]) * 0.5 + 0.5, 0, 1);
    o.yaw = P.invertYaw ? -Input.pad.axes[0] : Input.pad.axes[0];
    o.pitch = P.invertPitch ? -Input.pad.axes[3] : Input.pad.axes[3];
    o.roll = P.invertRoll ? -Input.pad.axes[2] : Input.pad.axes[2];
  } else {
    if (Input.pad.active && !Input.pad.anyInput && (K['KeyW'] || K['KeyS'] || K['KeyA'] || K['KeyD'] || K['ArrowUp'] || K['ArrowDown'] || K['ArrowLeft'] || K['ArrowRight'])) Input.pad.active = false;
    o.source = 'kb';
    o.throttle = kb.throttle;
    o.yaw = kb.yaw; o.pitch = kb.pitch; o.roll = kb.roll;
  }
  return o;
};

Input.consumeOrbit = function () {
  const r = { dx: Input.orbit.dx, dy: Input.orbit.dy, wheel: Input.orbit.wheel };
  Input.orbit.dx = 0; Input.orbit.dy = 0; Input.orbit.wheel = 0;
  return r;
};
