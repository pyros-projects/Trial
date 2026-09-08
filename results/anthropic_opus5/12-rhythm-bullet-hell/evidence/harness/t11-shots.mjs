import { CDP, sleep } from './cdp.mjs';
const c = await CDP.attach(process.argv[2], 'index.html');
const J = async (e) => JSON.parse(await c.evalJS('JSON.stringify((()=>{const P=window.__pulse;' + e + '})())'));
const dir = 'evidence/screenshots/';
const log = [];
const dodge = async (ms) => { const t0 = Date.now();
  while (Date.now() - t0 < ms) { await c.keyDown('ArrowLeft'); await sleep(300); await c.keyUp('ArrowLeft');
    await c.keyDown('ArrowRight'); await sleep(300); await c.keyUp('ArrowRight'); } };

// --- phase 1, focus mode engaged so the hitbox is visible
await c.evalJS(`(()=>{const P=window.__pulse;P.S.lives=9;P.S.difficulty="normal";P.S.seed="1337";
  P.S.hitboxAlways=false;P.UI.closeDrawer();P.UI.syncAll();P.startRun("run");return 1})()`);
await sleep(2400);
await dodge(3500);
await c.keyDown('ShiftLeft'); await c.keyDown('KeyZ'); await sleep(700);
await c.shot(dir + '11-phase1-focus-hitbox.png');
log.push(['11-phase1-focus-hitbox.png', await J(`return {phase:P.game.phaseIdx+1,bullets:P.sim.nB,focus:P.sim.player.focus,combo:P.game.combo}`)]);
await c.keyUp('KeyZ'); await c.keyUp('ShiftLeft');

// --- deep phase: jump the encounter forward by clearing phases legitimately fast
await c.evalJS(`(()=>{const P=window.__pulse;P.S.autofire=true;window.__lock=setInterval(()=>{
  if(P.game.state==='PLAYING')P.sim.player.x=P.sim.boss.x;},16);return 1})()`);
let g = 0, ph = 0;
while (ph < 3 && g++ < 60) { await sleep(500); ph = (await J('return {p:P.game.phaseIdx}')).p; }
await c.evalJS(`clearInterval(window.__lock);window.__pulse.S.autofire=false`);
await sleep(1500);
await c.shot(dir + '12-phase4-overdrive.png');
log.push(['12-phase4-overdrive.png', await J(`return {phase:P.game.phaseIdx+1,bullets:P.sim.nB,
  lasers:P.sim.lasers.length,label:document.getElementById('bossPhase').textContent,score:P.game.score}`)]);

// --- pause screen
await c.tap('KeyP', 50); await sleep(500);
await c.shot(dir + '13-pause-screen.png');
log.push(['13-pause-screen.png', await J(`return {state:P.game.state,info:document.getElementById('pauseInfo').textContent}`)]);

// --- diagnostics panel with live values
await c.evalJS(`(()=>{const P=window.__pulse;P.UI.openDrawer("diag");
  ['diagBounds','diagRuler','diagSpawns','diagHist'].forEach(id=>{const e=document.getElementById(id);
    e.checked=true;e.dispatchEvent(new Event('change'));});P.UI.drawDiag();return 1})()`);
await sleep(400);
await c.evalJS(`document.getElementById('btnResume').click()`);
await sleep(1400);
await c.evalJS(`window.__pulse.UI.drawDiag()`);
await sleep(200);
await c.shot(dir + '14-diagnostics-overlays.png');
log.push(['14-diagnostics-overlays.png', await J(`return {bounds:P.S.diagBounds,ruler:P.S.diagRuler,
  spawns:P.S.diagSpawns,hist:P.S.diagHist,diagRows:document.querySelectorAll('#diagSched .k').length+
  document.querySelectorAll('#diagSim .k').length+document.querySelectorAll('#diagRender .k').length}`)]);

// --- audio panel with the live mixer meters
await c.evalJS(`(()=>{const P=window.__pulse;['diagBounds','diagRuler','diagSpawns','diagHist']
  .forEach(id=>{const e=document.getElementById(id);e.checked=false;e.dispatchEvent(new Event('change'));});
  P.UI.openDrawer("audio");return 1})()`);
await sleep(900);
await c.shot(dir + '15-audio-mixer.png');
log.push(['15-audio-mixer.png', await J(`return {preset:P.S.preset,scale:P.S.scale,
  meters:Object.keys(P.AudioEngine.busAn).map(k=>k+':'+P.AudioEngine.busAn[k].level.toFixed(3))}`)]);
await c.evalJS(`window.__pulse.UI.closeDrawer()`);
console.log(JSON.stringify(log, null, 1));
c.close();
