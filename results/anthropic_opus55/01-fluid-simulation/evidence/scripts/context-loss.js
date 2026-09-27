(async () => {
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const gl = document.getElementById('fluid').getContext('webgl2') || document.getElementById('fluid').getContext('webgl');
  const ext = gl.getExtension('WEBGL_lose_context');
  const before = fluidDebug.snapshot().frame;
  ext.loseContext();
  await sleep(800);
  const during = { frame: fluidDebug.snapshot().frame, toast: document.getElementById('toast').textContent, lost: gl.isContextLost() };
  ext.restoreContext();
  await sleep(3000);
  const s = fluidDebug.snapshot();
  return JSON.stringify({ before, during, after: { frame: s.frame, running: s.running, lost: gl.isContextLost(), simTime: +s.simTime.toFixed(2), dyeMass: s.stats && +s.stats.dye.toFixed(3), speedMax: s.stats && +s.stats.speedMax.toFixed(3), fatalShown: !document.getElementById('fatal').hidden } });
})()
