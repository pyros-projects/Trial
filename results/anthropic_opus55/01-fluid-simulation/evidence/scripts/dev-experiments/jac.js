(async () => {
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const set = (id, v) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('input', {bubbles:true})); };
  const out = {};
  document.querySelector('[data-solver=jacobi]').click();
  for (const it of [1, 40, 150]) { set('pressureIterations', it); await sleep(2000); const s = fluidDebug.snapshot().stats; out['jacobi' + it] = +(100 * s.divPost / s.divPre).toFixed(1); }
  document.querySelector('[data-solver=multigrid]').click(); await sleep(2000);
  const s = fluidDebug.snapshot().stats; out.mg3 = +(100 * s.divPost / s.divPre).toFixed(1);
  return JSON.stringify(out);
})()
