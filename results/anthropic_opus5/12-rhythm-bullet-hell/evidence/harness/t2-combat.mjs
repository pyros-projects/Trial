import { CDP, sleep } from './cdp.mjs';
const c = await CDP.attach(process.argv[2], 'index.html');
const J = async (e) => JSON.parse(await c.evalJS('JSON.stringify((()=>{const P=window.__pulse;' + e + '})())'));
const R = {};
await c.evalJS(`(()=>{const P=window.__pulse;P.S.seed="1337";P.startRun("run");return 1})()`);
await sleep(2600);
// re-install the sync probe with the presentation lead in place
await c.evalJS(`(()=>{const P=window.__pulse;window.__probe={sync:[]};const so=P.sim.onPulse.bind(P.sim);
  P.sim.onPulse=function(pulse){const n0=P.sim.nB;so(pulse);
    if(P.sim.nB>n0&&P.AudioEngine.ctx)window.__probe.sync.push(+((P.AudioEngine.ctx.currentTime-P.Transport.timeOf(pulse))*1000).toFixed(2));};return 1})()`);
// park the ship directly under the boss each tick, then hold fire
await c.evalJS(`(()=>{const P=window.__pulse;window.__lock=setInterval(()=>{P.sim.player.x=P.sim.boss.x;},16);return 1})()`);
await sleep(400);
const a = await J('return {hp:P.sim.boss.hp,inv:+P.sim.boss.invuln.toFixed(2),phase:P.game.phaseIdx}');
await c.keyDown('KeyZ'); await sleep(2500); await c.keyUp('KeyZ');
const b = await J('return {hp:P.sim.boss.hp,phase:P.game.phaseIdx,dmg:Math.round(P.game.damageDealt),score:P.game.score,shots:P.game.shots}');
R.aimedFire = { hpBefore: Math.round(a.hp), bossInvuln: a.inv, hpAfter: Math.round(b.hp),
  damageDealt: b.dmg, shots: b.shots, phaseBefore: a.phase, phaseAfter: b.phase };
// keep firing until a phase transition happens
let guard = 0, ph = b.phase;
await c.keyDown('KeyZ');
while (ph === b.phase && guard++ < 40) { await sleep(500); ph = (await J('return {p:P.game.phaseIdx}')).p; }
await c.keyUp('KeyZ');
R.phaseTransition = await J(`return {phase:P.game.phaseIdx,musicPhase:P.game.musicPhase,
  score:P.game.score,bossHp:Math.round(P.sim.boss.hp),bossHpMax:Math.round(P.sim.boss.hpMax),
  phaseName:P.PHASES[Math.min(P.game.phaseIdx,3)].name,
  bossPhaseLabel:document.getElementById('bossPhase').textContent,
  hpBarScale:document.getElementById('hpFill').style.transform}`);
await c.evalJS('clearInterval(window.__lock)');
R.sync = await J(`const s=window.__probe.sync;const n=s.length;const mean=n?s.reduce((a,b)=>a+b,0)/n:0;
  return {samples:n,meanMs:+mean.toFixed(2),
    sdMs:+Math.sqrt(s.reduce((a,b)=>a+(b-mean)*(b-mean),0)/n).toFixed(2),
    maxAbsMs:+Math.max(...s.map(Math.abs)).toFixed(2)}`);
console.log(JSON.stringify(R, null, 1));
c.close();
