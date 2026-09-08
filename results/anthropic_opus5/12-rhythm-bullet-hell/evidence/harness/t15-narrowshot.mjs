import { CDP, sleep } from './cdp.mjs';
const c = await CDP.attach(process.argv[2], 'index.html');
const J = async (e) => JSON.parse(await c.evalJS('JSON.stringify((()=>{const P=window.__pulse;' + e + '})())'));
await c.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
await c.evalJS(`(()=>{const P=window.__pulse;P.S.lives=5;P.S.touch='on';P.UI.syncAll();P.startRun("run");return 1})()`);
await sleep(2600);
const t0 = Date.now();
while (Date.now() - t0 < 5000) {
  await c.keyDown('KeyA'); await sleep(240); await c.keyUp('KeyA');
  await c.keyDown('KeyD'); await sleep(240); await c.keyUp('KeyD');
}
await c.keyDown('KeyZ'); await c.keyDown('ShiftLeft'); await sleep(700);
await c.shot('evidence/screenshots/04-narrow-390x844.png');
const r = await J(`return {state:P.game.state,bullets:P.sim.nB,score:P.game.score,combo:P.game.combo,
  lives:P.game.lives,touchUI:document.getElementById('touchui').classList.contains('show'),
  fps:document.getElementById('sb-fps').textContent,cw:P.R.cw,ch:P.R.ch,backing:[P.R.w,P.R.h],
  overflow:document.body.scrollWidth>innerWidth,
  bossTop:getComputedStyle(document.getElementById('hud-boss')).top}`);
await c.keyUp('KeyZ'); await c.keyUp('ShiftLeft');
await c.send('Emulation.clearDeviceMetricsOverride');
await c.evalJS(`(()=>{const P=window.__pulse;P.S.touch='auto';P.S.lives=3;P.UI.syncAll();return 1})()`);
console.log(JSON.stringify(r, null, 1));
c.close();
