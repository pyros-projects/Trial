(async () => {
  const set = (id, v) => { const el = document.getElementById(id); el.value = String(v); el.dispatchEvent(new Event('input', { bubbles: true })); };
  const f = window.fluxion;
  f.clearDye();
  set('rngVelDiss', 4);            // max damping: drain the flow
  await new Promise(r => setTimeout(r, 2500));
  set('rngVelDiss', 0.12);         // restore the default
  return 'quiesced velE=' + f.measure().velocityEnergy + ' dyeE=' + f.measure().dyeEnergy;
})()
