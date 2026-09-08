import { CDP, sleep } from './cdp.mjs';
const c = await CDP.attach(process.argv[2], 'index.html');
const J = async (e) => JSON.parse(await c.evalJS('JSON.stringify((()=>{const P=window.__pulse;' + e + '})())'));
const R = {};
await c.evalJS(`(()=>{const P=window.__pulse;P.S.lives=9;P.startRun("run");return 1})()`);
await sleep(3000);
// simulate a wedged audio device: resume() returns a promise that never settles
await c.evalJS(`(()=>{const P=window.__pulse;P.AudioEngine.__origResume=P.AudioEngine.resume;
  P.AudioEngine.resume=function(){return new Promise(()=>{});};return 1})()`);
await c.tap('KeyP', 50); await sleep(500);
R.paused = await J('return {state:P.game.state}');
await c.evalJS(`document.getElementById('btnResume').click()`);
await sleep(200);
R.at200ms = await J('return {state:P.game.state}');
await sleep(500);
R.at700ms = await J('return {state:P.game.state,tick:P.sim.tick,pulse:+P.sim.pulseAcc.toFixed(2)}');
await sleep(900);
R.at1600ms = await J('return {state:P.game.state,tick:P.sim.tick,pulse:+P.sim.pulseAcc.toFixed(2)}');
R.verdict = { recoveredDespiteWedgedAudio: R.at1600ms.state === 'PLAYING',
  simAdvancing: R.at1600ms.tick > R.at700ms.tick };
await c.evalJS(`(()=>{const P=window.__pulse;P.AudioEngine.resume=P.AudioEngine.__origResume;return 1})()`);
// and the normal path still works
await c.tap('KeyP', 50); await sleep(400);
await c.evalJS(`document.getElementById('btnResume').click()`);
await sleep(600);
R.normalResume = await J('return {state:P.game.state,ctx:P.AudioEngine.ctx.state}');
console.log(JSON.stringify(R, null, 1));
c.close();
