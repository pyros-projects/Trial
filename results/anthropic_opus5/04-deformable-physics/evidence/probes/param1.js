// measure the settled max constraint error as a function of solver work
(() => {
  loadScenario(3); afterScenario();          // bridge: heavy static load, good convergence probe
  window.__res = [];
  const cases = [[1,1],[1,3],[3,1],[3,3],[5,3],[5,8],[10,8]];
  let ci = 0, t0 = performance.now(), settle = 900;
  const tick = () => {
    if (ci >= cases.length) { window.__done = 1; return; }
    const [sub, it] = cases[ci];
    if (performance.now() - t0 < settle) { requestAnimationFrame(tick); return; }
    window.__res.push({sub, it, err: +(stats.maxErr*100).toFixed(2), sim: +stats.simMs.toFixed(2)});
    ci++;
    if (ci < cases.length) { P.substeps = cases[ci][0]; P.iters = cases[ci][1]; syncControls(); }
    t0 = performance.now();
    requestAnimationFrame(tick);
  };
  P.substeps = cases[0][0]; P.iters = cases[0][1]; syncControls();
  window.__done = 0;
  requestAnimationFrame(tick);
  return 'running';
})()
