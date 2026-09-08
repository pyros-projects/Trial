import { CDP, sleep } from './cdp.mjs';
const c = await CDP.attach(process.argv[2], 'index.html');
const J = async (e) => JSON.parse(await c.evalJS('JSON.stringify((()=>{const P=window.__pulse;' + e + '})())'));
// remove Web Audio entirely before the page boots
await c.send('Page.enable');
await c.send('Page.addScriptToEvaluateOnNewDocument', {
  source: 'delete window.AudioContext; delete window.webkitAudioContext;' });
await c.send('Page.navigate', { url: 'http://127.0.0.1:8712/index.html' });
await sleep(2000);
const R = {};
R.boot = await J(`return {hasAudioCtor:!!(window.AudioContext||window.webkitAudioContext),
  pulse:typeof window.__pulse,state:P.game.state}`);
await c.evalJS(`document.getElementById('btnEnableAudio').click()`);
await sleep(800);
R.afterEnable = await J(`return {state:P.game.state,ctx:P.AudioEngine.ctx,failed:P.AudioEngine.failed,
  ready:P.AudioEngine.ready,clock:P.Transport.audioClock?'audio':'system',
  audioPill:document.getElementById('sb-audio').textContent,
  toast:document.getElementById('toast').textContent}`);
await sleep(3500);
// play with real input and make sure the game is fully functional without audio
await c.keyDown('ArrowLeft'); await sleep(500); await c.keyUp('ArrowLeft');
await c.keyDown('KeyZ'); await sleep(800); await c.keyUp('KeyZ');
R.playing = await J(`return {state:P.game.state,bar:Math.floor(P.sim.pulseAcc/48)+1,bullets:P.sim.nB,
  playerX:+P.sim.player.x.toFixed(1),shots:P.game.shots,score:P.game.score,tick:P.sim.tick,
  fps:document.getElementById('sb-fps').textContent,
  audioState:document.getElementById('sb-audio').textContent}`);
// pause/resume without audio
await c.tap('KeyP', 50); await sleep(600);
const p1 = await J('return {state:P.game.state,pulse:+P.sim.pulseAcc.toFixed(3)}');
await sleep(1500);
const p2 = await J('return {state:P.game.state,pulse:+P.sim.pulseAcc.toFixed(3)}');
await c.evalJS(`document.getElementById('btnResume').click()`); await sleep(700);
const p3 = await J('return {state:P.game.state,pulse:+P.sim.pulseAcc.toFixed(3),bullets:P.sim.nB}');
R.pauseNoAudio = { paused: p1, afterWait: p2, resumed: p3,
  frozenWhilePaused: Math.abs(p2.pulse - p1.pulse) < 0.001, resumedOk: p3.state === 'PLAYING' };
// self test in a silent build
await c.tap('KeyP', 50); await sleep(400);
await c.evalJS(`(()=>{const P=window.__pulse;P.UI.openDrawer("diag");
  document.getElementById('btnSelfTest').click();return 1})()`);
await sleep(1500);
R.selfTest = (await c.evalJS(`document.getElementById('selfTestOut').textContent`)).split('\n');
await c.send('Page.addScriptToEvaluateOnNewDocument', { source: '' });
console.log(JSON.stringify(R, null, 1));
c.close();
