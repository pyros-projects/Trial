// Test-harness autopilot (NOT part of index.html). Installs a virtual gamepad via navigator.getGamepads
// and steers it with a pure-pursuit controller along the course centre-line, so all input still flows
// through the app's gamepad path (axis mapping, calibration, dead zone, inversion, quantisation).
(() => {
  if (window.__bot) clearInterval(window.__bot.timer);
  const pad = { id: 'APEX virtual test pad (harness)', index: 0, connected: true, mapping: 'standard', timestamp: 0,
    axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })) };
  navigator.getGamepads = () => [pad];
  const bot = window.__bot = { pad, on: true, vT: 12, look: 10, ticks: 0 };
  const clampv = (v, a, b) => Math.max(a, Math.min(b, v));
  bot.timer = setInterval(() => {
    const w = APEX.world, s = APEX.sim, d = s.drone, R = s.race, N = w.gates.length;
    if (!bot.on || !APEX.state().started) { pad.axes = [0, 0, 0, 0]; return; }
    bot.ticks++;
    let pts;
    if (!R.lapRunning && R.next === 0) pts = w.path.spawnPts.concat(w.path.loop.filter(p => p.seg === 0));
    else { const a = (R.next - 1 + N) % N; pts = w.path.loop.filter(p => p.seg === a).concat(w.path.loop.filter(p => p.seg === R.next)); }
    let bi = 0, bd = 1e9;
    pts.forEach((p, i) => { const dd = Math.hypot(p.x - d.p[0], p.y - d.p[1], p.z - d.p[2]); if (dd < bd) { bd = dd; bi = i; } });
    let acc = 0, j = bi;
    while (j < pts.length - 1 && acc < bot.look) { acc += Math.hypot(pts[j + 1].x - pts[j].x, pts[j + 1].z - pts[j].z); j++; }
    const t = pts[j];
    const f = Q.rot(d.q, [0, 0, -1]), fl = Math.hypot(f[0], f[2]) || 1, fx = f[0] / fl, fz = f[2] / fl, rx = -fz, rz = fx;
    const dx = t.x - d.p[0], dz = t.z - d.p[2];
    const eh = Math.atan2(dx * rx + dz * rz, dx * fx + dz * fz);
    const vf = d.v[0] * fx + d.v[2] * fz, vr = d.v[0] * rx + d.v[2] * rz;
    const yaw = clampv(eh * 2.4, -1, 1);
    const roll = clampv(-vr * 0.16 + eh * 0.5, -1, 1);
    const vT = bot.vT * (1 - Math.min(0.75, Math.abs(eh) / 1.0));
    const pitch = clampv((vT - vf) * 0.14, -0.9, 1);
    const ts = clampv(0.5 + (t.y - d.p[1]) * 0.14 - d.v[1] * 0.05, 0.08, 0.95);
    pad.axes = [yaw, -(ts * 2 - 1), roll, -pitch];
    pad.timestamp = performance.now();
  }, 16);
  return 'autopilot installed (virtual gamepad)';
})()
