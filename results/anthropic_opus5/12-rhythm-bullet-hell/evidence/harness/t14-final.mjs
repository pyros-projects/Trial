import { CDP, sleep } from './cdp.mjs';
const c = await CDP.attach(process.argv[2], 'index.html');
const J = async (e) => JSON.parse(await c.evalJS('JSON.stringify((()=>{const P=window.__pulse;' + e + '})())'));
const dir = 'evidence/screenshots/';
const R = {};
// (storage was cleared and the page reloaded by the shell before attaching)
R.firstRun = await J(`return {state:P.game.state,best:P.game.bestScore,diff:P.S.difficulty,bpm:P.S.bpm,
  preset:P.S.preset,quality:P.S.quality,storage:document.getElementById('storeState').textContent,
  titleShown:document.getElementById('screen-title').classList.contains('show')}`);
await c.shot(dir + '01-title-1280x800.png');

// real user gesture on the labelled control
const btn = await J(`const r=document.getElementById('btnEnableAudio').getBoundingClientRect();
  return {x:r.left+r.width/2,y:r.top+r.height/2,label:document.getElementById('btnEnableAudio').textContent}`);
await c.mouseDown(btn.x, btn.y); await c.mouseUp(btn.x, btn.y);
R.gesture = { clickedLabel: btn.label };
await sleep(600);
R.audioAfterGesture = await J(`return {state:P.game.state,ctx:P.AudioEngine.ctx&&P.AudioEngine.ctx.state,
  sampleRate:P.AudioEngine.ctx&&P.AudioEngine.ctx.sampleRate,
  countdownVisible:document.getElementById('countdown').classList.contains('show'),
  cdText:document.getElementById('cdnum').textContent}`);
await sleep(1400);
await c.shot(dir + '02-countdown.png');
await sleep(1400);

// play for a few measures with real input
const dodge = async (ms) => { const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    await c.keyDown('KeyA'); await sleep(260); await c.keyUp('KeyA');
    await c.keyDown('KeyD'); await sleep(260); await c.keyUp('KeyD'); } };
await c.keyDown('KeyZ');
await dodge(6000);
await c.keyDown('ShiftLeft'); await sleep(600);
await c.shot(dir + '03-gameplay-1280x800.png');
R.gameplay = await J(`return {state:P.game.state,bar:Math.floor(P.sim.pulseAcc/48)+1,bullets:P.sim.nB,
  score:P.game.score,combo:P.game.combo,graze:P.game.graze,lives:P.game.lives,
  perfect:P.game.perfect,good:P.game.good,off:P.game.offbeat,
  fps:document.getElementById('sb-fps').textContent,
  syncMs:+((P.Transport.pulseAt(P.Transport.nowT())-P.sim.pulseAcc)*P.Transport.spp()*1000).toFixed(2),
  ctx:P.AudioEngine.ctx.state,clock:P.Transport.audioClock?'audio':'system'}`);
await c.keyUp('ShiftLeft'); await c.keyUp('KeyZ');

// self test in the final build
await c.tap('KeyP', 50); await sleep(500);
await c.evalJS(`(()=>{const P=window.__pulse;P.UI.openDrawer("diag");document.getElementById('btnSelfTest').click();return 1})()`);
await sleep(1500);
R.selfTest = (await c.evalJS(`document.getElementById('selfTestOut').textContent`)).split('\n');
await c.evalJS(`window.__pulse.UI.closeDrawer()`);
await c.evalJS(`document.getElementById('btnResume').click()`);
await sleep(800);

// narrow viewport, same live run
await c.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
await c.evalJS(`(()=>{const P=window.__pulse;P.S.touch='on';P.UI.syncAll();P.UI.showScreen(null);return 1})()`);
await sleep(1200);
await dodge(2500);
await c.shot(dir + '04-narrow-390x844.png');
R.narrow = await J(`return {cw:P.R.cw,ch:P.R.ch,dpr:+P.R.dpr.toFixed(2),devicePixelRatio,
  backing:[P.R.w,P.R.h],state:P.game.state,bullets:P.sim.nB,
  hudStack:document.getElementById('stage').className,
  touchUI:document.getElementById('touchui').classList.contains('show'),
  horizontalOverflow:document.body.scrollWidth>window.innerWidth,
  fps:document.getElementById('sb-fps').textContent}`);
await c.send('Emulation.clearDeviceMetricsOverride');
await c.evalJS(`(()=>{const P=window.__pulse;P.S.touch='auto';P.UI.syncAll();return 1})()`);
console.log(JSON.stringify(R, null, 1));
c.close();
