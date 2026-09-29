// Harness waypoint pilot (virtual gamepad). bot.go(point, F) flies to point-F*8 then through point along F.
// Used to cross a gate plane OUTSIDE its opening (missed gate) or to fly through a later gate (wrong gate).
(() => {
  if (window.__bot) clearInterval(window.__bot.timer);
  const pad = { id: 'Harness waypoint pad (virtual)', index: 0, connected: true, mapping: 'standard', timestamp: 0, axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })) };
  navigator.getGamepads = () => [pad];
  const clampv = (v, a, b) => Math.max(a, Math.min(b, v));
  const bot = window.__bot = { pad, on: true, wp: null, stage: 0 };
  bot.go = (pt, F) => { bot.wp = { pt, F }; bot.stage = 0; };
  bot.timer = setInterval(() => {
    const d = APEX.sim.drone; if (!bot.wp) { pad.axes = [0, 0, 0, 0]; return; }
    const { pt, F } = bot.wp;
    const pre = [pt[0] - F[0] * 9, pt[1], pt[2] - F[2] * 9], post = [pt[0] + F[0] * 12, pt[1], pt[2] + F[2] * 12];
    if (bot.stage === 0 && Math.hypot(pre[0] - d.p[0], pre[2] - d.p[2]) < 3) bot.stage = 1;
    const t = bot.stage === 0 ? pre : post;
    if (bot.stage === 1 && Math.hypot(post[0] - d.p[0], post[2] - d.p[2]) < 3) { bot.wp = null; return; }
    const f = Q.rot(d.q, [0, 0, -1]), fl = Math.hypot(f[0], f[2]) || 1, fx = f[0] / fl, fz = f[2] / fl, rx = -fz, rz = fx;
    const dx = t[0] - d.p[0], dz = t[2] - d.p[2], dist = Math.hypot(dx, dz);
    const eh = Math.atan2(dx * rx + dz * rz, dx * fx + dz * fz);
    const vf = d.v[0] * fx + d.v[2] * fz, vr = d.v[0] * rx + d.v[2] * rz;
    const vT = Math.min(9, dist * 0.8) * (1 - Math.min(0.8, Math.abs(eh)));
    pad.axes = [clampv(eh * 2.4, -1, 1), -(clampv(0.5 + (t[1] - d.p[1]) * 0.14 - d.v[1] * 0.05, 0.08, 0.95) * 2 - 1), clampv(-vr * 0.18 + eh * 0.4, -1, 1), -clampv((vT - vf) * 0.14, -0.9, 1)];
    pad.timestamp = performance.now();
  }, 16);
  return 'waypoint pilot installed';
})()
