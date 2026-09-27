(async () => {
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const setSlider = (id, v) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('input', {bubbles:true})); };
  const out = [];
  if (!fluidDebug.snapshot().paused) document.getElementById('pauseBtn').click();
  for (const [solver, eps] of [['multigrid', 0], ['multigrid', 22], ['jacobi', 0]]) {
    document.querySelector(`[data-solver=${solver}]`).click();
    setSlider('vorticity', eps);
    document.getElementById('resetBtn').click();
    await sleep(150);
    window.dispatchEvent(new KeyboardEvent('keydown', {key: 's'}));
    const res = [];
    for (let k = 0; k < 6; k++) {
      document.getElementById('stepBtn').click();
      await sleep(450);
      const s = fluidDebug.snapshot().stats;
      res.push(+(s.divPost/s.divPre*100).toFixed(1));
    }
    out.push({solver, eps, residualPerStep: res});
  }
  return JSON.stringify(out);
})()
