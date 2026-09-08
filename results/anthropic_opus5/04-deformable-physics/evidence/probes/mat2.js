(() => {
  window.__res = []; window.__done = 0;
  const mode = window.__MODE, cases = window.__CASES;
  let ci = 0, t0 = 0, touched = false, apex = 1e9, x0 = 0;
  const setup = () => {
    clearWorld(); P.wind = 0; P.gravDeg = 90; P.gravity = 1500; P.damping = 0.09;
    for (const k in cases[ci]) P[k] = cases[ci][k];
    syncControls();
    if (mode === 'restitution') {
      addObstacle({ kind: 'box', x: world.w * 0.5, y: world.h - 40, hw: world.w * 0.6, hh: 40 });
      const b = makeBall(world.w * 0.5, 300, 26, {});
      window.__p = b.idx[0];
    } else {                      // friction: a ball released on a 20 degree ramp
      addObstacle({ kind: 'box', x: world.w * 0.5, y: world.h * 0.55, hw: 300, hh: 18, ang: 0.35 });
      const b = makeBall(world.w * 0.5 - 220, world.h * 0.55 - 220 * 0.36 - 46, 24, {});
      window.__p = b.idx[0];
    }
    applyDensity(); updateSkips();
    touched = false; apex = 1e9; x0 = S.px[window.__p]; t0 = performance.now();
  };
  setup();
  const tick = () => {
    const p = window.__p;
    if (mode === 'restitution') {
      if (!touched && S.py[p] > world.h - 80 - 34) touched = true;
      if (touched) apex = Math.min(apex, S.py[p]);
    }
    if (performance.now() - t0 < (mode === "friction" ? 1200 : 2800)) { requestAnimationFrame(tick); return; }
    const v = mode === 'restitution'
      ? { reboundPx: +(world.h - 80 - 26 - apex).toFixed(0) }
      : { slidPx: +(S.px[p] - x0).toFixed(0), speed: +Math.hypot(S.vx[p], S.vy[p]).toFixed(0) };
    window.__res.push(Object.assign({}, cases[ci], v));
    ci++;
    if (ci >= cases.length) { window.__done = 1; return; }
    setup(); requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return 'running';
})()
