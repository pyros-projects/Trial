(async () => {
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const setSlider = (id, v) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('input', {bubbles:true})); };
  const out = [];
  if (!fluidDebug.snapshot().paused) document.getElementById('pauseBtn').click();
  document.querySelector('[data-solver=multigrid]').click();
  setSlider('vorticity', 22);
  for (const cyc of [1, 2, 4, 8]) {
    setSlider('pressureCycles', cyc);
    document.getElementById('resetBtn').click();
    await sleep(150);
    window.dispatchEvent(new KeyboardEvent('keydown', {key: 's'}));
    const res = [];
    for (let k = 0; k < 5; k++) { document.getElementById('stepBtn').click(); await sleep(500); const s = fluidDebug.snapshot().stats; res.push(+(s.divPost/s.divPre*100).toFixed(1)); }
    out.push({cyc, res});
  }
  setSlider('pressureCycles', 2);
  document.getElementById('pauseBtn').click();
  return JSON.stringify(out);
})()
