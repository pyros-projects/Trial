// read-only helper: screen (CSS px) position of a sim point (xm, ym metres, at terrain height) for targeting real mouse input
(function (xf, yf) {
  const sim = App.sim, cv = document.getElementById('gl'), r = cv.getBoundingClientRect();
  const xm = xf * sim.L, ym = yf * sim.L, c = Math.min(sim.NX - 1, Math.floor(xm / sim.dx)) + Math.min(sim.NY - 1, Math.floor(ym / sim.dy)) * sim.NX;
  const w = simToWorld(sim, xm, ym, 0); w[1] = terrainWorldY(sim, w[0], w[2]);
  const m = Cam.matrices(r.width / r.height), p = M4.xform(m.vp, [w[0], w[1], w[2], 1]);
  return JSON.stringify({ x: Math.round(r.left + (p[0] / p[3] * 0.5 + 0.5) * r.width), y: Math.round(r.top + (1 - (p[1] / p[3] * 0.5 + 0.5)) * r.height), i: c % sim.NX, j: Math.floor(c / sim.NX) });
})
