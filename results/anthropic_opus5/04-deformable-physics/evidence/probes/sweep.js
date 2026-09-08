// generic: apply a setting, let the world settle, record a probe value
(() => {
  const cfg = window.__cfg;
  loadScenario(cfg.scenario); afterScenario();
  window.__res = []; window.__done = 0;
  let ci = 0, t0 = performance.now();
  const apply = () => { const c = cfg.cases[ci]; for (const k in c) P[k] = c[k]; syncControls(); };
  apply();
  const tick = () => {
    if (performance.now() - t0 < cfg.settle) { requestAnimationFrame(tick); return; }
    window.__res.push(Object.assign({}, cfg.cases[ci], { v: cfg.probe() }));
    ci++;
    if (ci >= cfg.cases.length) { window.__done = 1; return; }
    if (cfg.reload) { loadScenario(cfg.scenario); afterScenario(); }
    apply(); t0 = performance.now(); requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return 'running';
})()
