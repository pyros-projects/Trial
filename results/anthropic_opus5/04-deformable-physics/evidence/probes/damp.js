(() => {
  window.__res = []; window.__done = 0;
  const cases = [0, 0.3, 1.0, 2.5];
  let ci = 0, t0 = 0;
  const setup = () => {
    clearWorld(); P.wind = 0; P.gravity = 0; P.damping = cases[ci]; syncControls();
    for (let k = 0; k < 6; k++) {
      const b = makeBall(world.w * (0.2 + k * 0.12), world.h * 0.5, 20, {});
      S.vx[b.idx[0]] = 600; S.vy[b.idx[0]] = -260;
    }
    applyDensity(); t0 = performance.now();
  };
  setup();
  const tick = () => {
    if (performance.now() - t0 < 1500) { requestAnimationFrame(tick); return; }
    let ke = 0; for (let i = 0; i < S.n; i++) ke += Math.hypot(S.vx[i], S.vy[i]);
    window.__res.push({ damping: cases[ci], speedSum: +ke.toFixed(0), retainedPct: +(ke / (6 * Math.hypot(600, 260)) * 100).toFixed(1) });
    ci++;
    if (ci >= cases.length) { window.__done = 1; P.gravity = 1500; syncControls(); loadScenario(0); afterScenario(); return; }
    setup(); requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return 'running';
})()
