// Worst-case solver settings: max timestep, max vorticity, minimum pressure
// iterations, zero dissipation, max interaction force. Look for NaN / blow-up.
(async () => {
  const set = (id, v) => { const el = document.getElementById(id); el.value = String(v); el.dispatchEvent(new Event('input', { bubbles: true })); };
  const f = window.fluxion, sleep = ms => new Promise(r => setTimeout(r, ms));
  set('rngSpeed', 3); set('rngVort', 60); set('rngPressIter', 1); set('rngPressure', 1);
  set('rngVelDiss', 0); set('rngDyeDiss', 0); set('rngForce', 3); set('rngVisc', 0);
  const log = [];
  for (let round = 0; round < 6; round++) {
    for (let i = 0; i < 10; i++) {                    // hammer it with hard splats
      f.splat(Math.random(), Math.random(), (Math.random() - 0.5) * 12000, (Math.random() - 0.5) * 12000, f.generateColor());
    }
    await sleep(900);
    const g = f.sampleField('velocity');
    const bad = g.data.filter(v => !isFinite(v)).length;
    const m = f.measure();
    log.push('round ' + round + ' steps=' + f.stats.steps + ' velE=' + m.velocityEnergy + ' dyeE=' + m.dyeEnergy + ' nonFinite=' + bad + ' fps=' + f.stats.fps);
  }
  return log.join('\n');
})()
