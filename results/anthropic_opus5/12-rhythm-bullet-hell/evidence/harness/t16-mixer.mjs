import { CDP, sleep } from './cdp.mjs';
const c = await CDP.attach(process.argv[2], 'index.html');
const J = async (e) => JSON.parse(await c.evalJS('JSON.stringify((()=>{const P=window.__pulse;' + e + '})())'));
await c.evalJS(`(()=>{const P=window.__pulse;P.S.lives=9;P.startRun("run");return 1})()`);
await sleep(3000);
await c.evalJS(`window.__pulse.UI.openDrawer("audio")`);
await sleep(1200);
const r = await J(`return {ctx:P.AudioEngine.ctx.state,clock:P.Transport.audioClock?'audio':'system',
  meters:Object.keys(P.AudioEngine.busAn).map(k=>k+'='+P.AudioEngine.busAn[k].level.toFixed(3)),
  meterBars:[...document.querySelectorAll('#mixerRows .lvl > i')].map(e=>e.style.transform),
  preset:P.S.preset,scale:P.S.scale,bpm:P.S.bpm,
  analyserNonZero:(()=>{const d=P.AudioEngine.freqData;let s=0;for(let i=0;i<d.length;i++)s+=d[i];return s})()}`);
await c.shot('evidence/screenshots/14-audio-mixer.png');
await c.evalJS(`window.__pulse.UI.closeDrawer()`);
console.log(JSON.stringify(r, null, 1));
c.close();
