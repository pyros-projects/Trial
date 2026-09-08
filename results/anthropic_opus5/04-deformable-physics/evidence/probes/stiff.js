(() => {
  // purpose-built rig: a 6x12 sheet pinned along the top carrying a heavy weight
  window.__res = []; window.__done = 0;
  const cases = [0.1, 0.35, 0.6, 0.85, 0.99];
  let ci = 0, t0 = performance.now();
  const build = () => {
    clearWorld();
    P.tear = 3.0; P.wind = 0; P.kStruct = cases[ci];
    addObstacle({ kind: 'box', x: world.w * 0.5, y: world.h - 20, hw: world.w * 0.6, hh: 22 });
    const c = makeCloth(world.w * 0.5 - 65, 80, 6, 12, 26, { pin: 'top' });
    const w = makeBall(world.w * 0.5, 80 + 11 * 26 + 30, 26, { dens: 8 });
    attach(c.idx[11 * 6 + 2], w.idx[0], 30);
    attach(c.idx[11 * 6 + 3], w.idx[0], 30);
    window.__c = c;
    applyDensity(); updateSkips(); syncControls();
  };
  build();
  const tick = () => {
    if (performance.now() - t0 < 2200) { requestAnimationFrame(tick); return; }
    const b = window.__c;
    let my = -1e9; for (const p of b.idx) my = Math.max(my, S.py[p]);
    const rest = (b.ny - 1) * b.spacing;
    window.__res.push({ kStruct: cases[ci], sheetHeight: +(my - 80).toFixed(1), rest: rest,
                        stretchPct: +(((my - 80) / rest - 1) * 100).toFixed(1),
                        err: +(stats.maxErr * 100).toFixed(1) });
    ci++;
    if (ci >= cases.length) { window.__done = 1; return; }
    build(); t0 = performance.now(); requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return 'running';
})()
