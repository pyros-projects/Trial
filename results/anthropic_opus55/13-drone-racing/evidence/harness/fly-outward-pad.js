// Harness: virtual gamepad that climbs above the terrain and flies radially away from the course centre
// (used to exercise the out-of-bounds warning + automatic recovery). Input goes through the gamepad path.
(() => {
  if (window.__bot) { clearInterval(window.__bot.timer); }
  const pad = { id: 'Harness outward pad (virtual)', index: 0, connected: true, mapping: 'standard', timestamp: 0, axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })) };
  navigator.getGamepads = () => [pad];
  const clampv = (v, a, b) => Math.max(a, Math.min(b, v));
  const bot = window.__bot = { pad, on: true, log: [] };
  bot.timer = setInterval(() => {
    const d = APEX.sim.drone, w = APEX.world;
    const f = Q.rot(d.q, [0, 0, -1]), fl = Math.hypot(f[0], f[2]) || 1, fx = f[0] / fl, fz = f[2] / fl, rx = -fz, rz = fx;
    const ox = d.p[0], oz = d.p[2], ol = Math.hypot(ox, oz) || 1, dx = ox / ol, dz = oz / ol;
    const eh = Math.atan2(dx * rx + dz * rz, dx * fx + dz * fz);
    const ground = w.T.height(d.p[0], d.p[2]), wantAlt = Math.max(ground, 70) + 25;
    const ts = clampv(0.5 + (wantAlt - d.p[1]) * 0.08, 0.1, 1);
    const high = d.p[1] > 75;
    pad.axes = [clampv(eh * 2, -1, 1), -(ts * 2 - 1), 0, high && Math.abs(eh) < 0.3 ? -1 : 0];
    pad.timestamp = performance.now();
  }, 16);
  return 'outward pad installed';
})()
