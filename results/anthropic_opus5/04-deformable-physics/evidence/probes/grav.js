(() => {
  // free-fall probe: one unobstructed ball, measure displacement direction per gravity angle
  window.__res = []; window.__done = 0;
  const angles = [90, 0, 180, 270, 45];
  let ci = 0, t0 = 0, p0 = null, phase = 0;
  const setup = () => {
    clearWorld(); P.gravDeg = angles[ci]; P.wind = 0; syncControls();
    const b = makeBall(world.w * 0.5, world.h * 0.5, 20, {});
    applyDensity(); window.__ball = b.idx[0];
    p0 = [S.px[window.__ball], S.py[window.__ball]];
    t0 = performance.now(); phase = 1;
  };
  setup();
  const tick = () => {
    if (performance.now() - t0 < 420) { requestAnimationFrame(tick); return; }
    const i = window.__ball;
    const dx = S.px[i] - p0[0], dy = S.py[i] - p0[1];
    let a = Math.atan2(dy, dx) * 180 / Math.PI; if (a < 0) a += 360;
    window.__res.push({ gravDeg: angles[ci], moveDeg: +a.toFixed(1), dist: +Math.hypot(dx, dy).toFixed(0) });
    ci++;
    if (ci >= angles.length) { window.__done = 1; P.gravDeg = 90; syncControls(); loadScenario(0); afterScenario(); return; }
    setup(); requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return 'running';
})()
