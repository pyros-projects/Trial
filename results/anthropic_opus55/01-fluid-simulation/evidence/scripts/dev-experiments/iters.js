(async () => {
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const setSlider = (id, v) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('input', {bubbles:true})); };
  const out = [];
  if (!fluidDebug.snapshot().paused) document.getElementById('pauseBtn').click();
  for (const it of [25, 50, 80]) {
    setSlider('pressureIterations', it);
    document.getElementById('resetBtn').click();
    await sleep(200);
    window.dispatchEvent(new KeyboardEvent('keydown', {key: 's'}));
    document.getElementById('stepBtn').click();
    await sleep(900);
    const s = fluidDebug.snapshot().stats;
    out.push({it, residual: +(s.divPost/s.divPre*100).toFixed(1), divPre: +s.divPre.toFixed(3), pMax: +s.pressureMax.toFixed(4)});
  }
  return JSON.stringify(out);
})()
