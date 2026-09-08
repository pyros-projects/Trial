import { CDP, sleep } from './cdp.mjs';
const c = await CDP.attach(process.argv[2], 'index.html');
const J = async (e) => JSON.parse(await c.evalJS('JSON.stringify((()=>{const P=window.__pulse;' + e + '})())'));
const R = {};
// ---- live resize while a run is in progress
await c.evalJS(`(()=>{const P=window.__pulse;P.S.lives=9;P.startRun("run");return 1})()`);
await sleep(2800);
R.beforeResize = await J(`return {cw:P.R.cw,ch:P.R.ch,w:P.R.w,h:P.R.h,scale:+P.R.scale.toFixed(4),
  bullets:P.sim.nB,pulse:+P.sim.pulseAcc.toFixed(2),bgCache:[P.R.bgCache.width,P.R.bgCache.height]}`);
await c.send('Emulation.setDeviceMetricsOverride', { width: 900, height: 620, deviceScaleFactor: 2, mobile: false });
await sleep(700);
R.afterResizeDpr2 = await J(`return {cw:P.R.cw,ch:P.R.ch,w:P.R.w,h:P.R.h,dpr:+P.R.dpr.toFixed(2),
  devicePixelRatio:devicePixelRatio,scale:+P.R.scale.toFixed(4),bullets:P.sim.nB,
  pulse:+P.sim.pulseAcc.toFixed(2),state:P.game.state,
  bgCache:[P.R.bgCache.width,P.R.bgCache.height],
  backingMatchesDpr:P.R.w===Math.round(P.R.cw*P.R.dpr),
  hudStack:document.getElementById('stage').className}`);
await c.send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });
await sleep(700);
R.afterResizeWide = await J(`return {cw:P.R.cw,ch:P.R.ch,scale:+P.R.scale.toFixed(4),state:P.game.state,
  bullets:P.sim.nB,fps:document.getElementById('sb-fps').textContent,
  hudStack:document.getElementById('stage').className}`);
await c.send('Emulation.clearDeviceMetricsOverride');
R.gamepad = await J(`return {padIndex:P.Input.padIndex,pill:document.getElementById('padState').textContent,
  getGamepadsPresent:typeof navigator.getGamepads==='function'}`);
console.log(JSON.stringify(R, null, 1));
c.close();
