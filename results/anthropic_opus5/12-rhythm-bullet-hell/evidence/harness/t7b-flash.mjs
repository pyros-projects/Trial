import { CDP, sleep } from './cdp.mjs';
const c = await CDP.attach(process.argv[2], 'index.html');
const J = async (e) => JSON.parse(await c.evalJS('JSON.stringify((()=>{const P=window.__pulse;' + e + '})())'));
const R = {};
await c.evalJS(`(()=>{const P=window.__pulse;P.S.lives=9;P.S.bpm=128;P.S.reducedFlash=false;
  P.S.reducedMotion=false;P.S.shake=true;P.UI.syncAll();P.startRun("run");return 1})()`);
await sleep(5000);                                  // well past the spawn guard
const test = async (reduced) => {
  await c.evalJS(`(()=>{const el=document.getElementById('setReducedFlash');el.checked=${reduced};
    el.dispatchEvent(new Event('change'));const P=window.__pulse;P.fx.flash=0;P.fx.shake=0;P.game.bombs=5;
    P.sim.player.spawnT=0;return 1})()`);
  // sample the peak by hooking flashAdd rather than racing the decay
  await c.evalJS(`(()=>{const P=window.__pulse;window.__peak=0;const fa=P.fx.flashAdd;
    P.fx.flashAdd=function(a,col){fa.call(P.fx,a,col);window.__peak=Math.max(window.__peak,P.fx.flash);};return 1})()`);
  await c.tap('KeyC', 80); await sleep(120);
  const r = await J(`return {peakFlash:+(window.__peak||0).toFixed(3),shake:+P.fx.shake.toFixed(2),
    bombs:P.game.bombs,setting:P.S.reducedFlash,cleared:P.game.bulletsCleared}`);
  await c.evalJS(`(()=>{const P=window.__pulse;delete P.fx.flashAdd;return 1})()`);
  return r;
};
R.normalFlash = await test(false);
await sleep(1200);
R.reducedFlash = await test(true);
R.verdict = { flashSuppressed: R.reducedFlash.peakFlash < R.normalFlash.peakFlash,
  bombStillWorks: R.reducedFlash.bombs < 5 && R.reducedFlash.shake > 0 };
await c.evalJS(`(()=>{const el=document.getElementById('setReducedFlash');el.checked=false;el.dispatchEvent(new Event('change'));return 1})()`);
console.log(JSON.stringify(R, null, 1));
c.close();
