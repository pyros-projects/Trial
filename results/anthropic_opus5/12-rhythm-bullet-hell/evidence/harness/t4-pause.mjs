import { CDP, sleep } from './cdp.mjs';
const c = await CDP.attach(process.argv[2], 'index.html');
const J = async (e) => JSON.parse(await c.evalJS('JSON.stringify((()=>{const P=window.__pulse;' + e + '})())'));
const snap = () => J(`return {state:P.game.state,pulse:+P.sim.pulseAcc.toFixed(3),tick:P.sim.tick,
  bullets:P.sim.nB,ctx:P.AudioEngine.ctx.state,bar:Math.floor(P.sim.pulseAcc/48)+1,
  beatPhase:+((P.sim.pulseAcc%48)/12).toFixed(3),voices:P.AudioEngine.voices.length,
  transportRunning:P.Transport.running,score:P.game.score}`);
const R = {};
await c.evalJS(`(()=>{const P=window.__pulse;P.S.lives=9;P.startRun("run");return 1})()`);
await sleep(4200);
R.beforePause = await snap();

// --- pause with the keyboard (P)
await c.tap('KeyP', 50); await sleep(400);
R.pausedImmediately = await snap();
await sleep(3000);                        // sit paused for ~1.6 musical bars
R.pausedAfter3s = await snap();
R.pauseScreenVisible = await J(`return {screen:document.getElementById('screen-pause').classList.contains('show'),
  info:document.getElementById('pauseInfo').textContent}`);

// --- resume with the labelled RESUME button and watch for a bullet backlog
await c.evalJS(`document.getElementById('btnResume').click()`);
const series = [];
for (let i = 0; i < 10; i++) { series.push(await snap()); await sleep(100); }
R.resumeSeries = series.map(s => ({ t: s.tick, pulse: s.pulse, blt: s.bullets, st: s.state }));
R.afterResume = series[series.length - 1];

// compare two samples taken WHILE paused; comparing against the pre-pause
// sample would include the frame between the snapshot and the keypress
const p0 = R.pausedImmediately.pulse, p1 = R.pausedAfter3s.pulse, p2 = series[0].pulse;
R.verdict = {
  preToPausePulseDelta: +(R.pausedImmediately.pulse - R.beforePause.pulse).toFixed(4),
  pulseFrozenWhilePaused: +(p1 - p0).toFixed(4),
  bulletsFrozenWhilePaused: R.pausedAfter3s.bullets - R.pausedImmediately.bullets,
  audioSuspendedWhilePaused: R.pausedAfter3s.ctx === 'suspended',
  voicesKilledOnPause: R.pausedAfter3s.voices,
  pulseJumpOnResume: +(p2 - p1).toFixed(4),
  maxBulletDeltaPer100ms: Math.max(...series.slice(1).map((s, i) => s.bullets - series[i].bullets)),
  bulletsRightAfterResume: series[0].bullets,
  musicalPositionPreserved: Math.abs(R.pausedAfter3s.beatPhase - R.pausedImmediately.beatPhase) < 0.001,
  tickFrozenWhilePaused: R.pausedAfter3s.tick - R.pausedImmediately.tick,
};

// --- second cycle using the status-bar PAUSE button, then restart
await sleep(1200);
await c.evalJS(`document.getElementById('btn-pause').click()`);
await sleep(600);
R.secondPause = await snap();
await c.evalJS(`document.getElementById('btn-pause').click()`);
await sleep(800);
R.secondResume = await snap();

// --- restart from pause
await c.tap('KeyP', 50); await sleep(300);
await c.evalJS(`document.getElementById('btnRestartFromPause').click()`);
await sleep(600);
R.afterRestart = await J(`return {state:P.game.state,tick:P.sim.tick,score:P.game.score,
  lives:P.game.lives,bullets:P.sim.nB,phase:P.game.phaseIdx,pulse:+P.sim.pulseAcc.toFixed(2)}`);
console.log(JSON.stringify(R, null, 1));
c.close();
