import { CDP, sleep } from './cdp.mjs';
const WS = process.argv[2];
const c = await CDP.attach(WS, 'index.html');
const J = async (e) => await c.evalJS('JSON.stringify((()=>{const P=window.__pulse;' + e + '})())').then(JSON.parse);
const R = {};

// ---- clean run from a known seed
await c.evalJS(`(()=>{const P=window.__pulse;P.S.seed="1337";P.S.seedLock=true;P.S.difficulty="normal";
  P.S.offset=0;P.S.lives=3;P.UI.closeDrawer();P.startRun("run");return 1})()`);
await sleep(300);
R.afterStart = await J('return {state:P.game.state,lives:P.game.lives,seed:P.S.seed}');

// install sync probes: when the sim fires patterns for pulse P, how far is the
// audio clock from the time that pulse was scheduled to sound?
await c.evalJS(`(()=>{const P=window.__pulse;window.__probe={sync:[],spawnPulses:[],kicks:[]};
  const so=P.sim.onPulse.bind(P.sim);
  P.sim.onPulse=function(pulse){const n0=P.sim.nB;so(pulse);
    if(P.sim.nB>n0){const A=P.AudioEngine.ctx;window.__probe.spawnPulses.push(pulse);
      if(A)window.__probe.sync.push(+( (A.currentTime - P.Transport.timeOf(pulse))*1000 ).toFixed(2));}};
  const ko=P.AudioEngine.kick.bind(P.AudioEngine);
  P.AudioEngine.kick=function(t,v){window.__probe.kicks.push(+t.toFixed(4));return ko(t,v)};
  return 1})()`);

// ---- wait out the count-in, then play several measures
await sleep(2600);
R.playing = await J('return {state:P.game.state,bar:Math.floor(P.sim.pulseAcc/48)+1}');

// hold LEFT for 500ms -> player must move left
const p0 = await J('return {x:P.sim.player.x,y:P.sim.player.y}');
await c.keyDown('ArrowLeft'); await sleep(500); await c.keyUp('ArrowLeft');
const p1 = await J('return {x:P.sim.player.x,y:P.sim.player.y}');
R.moveLeft = { from: +p0.x.toFixed(1), to: +p1.x.toFixed(1), dx: +(p1.x - p0.x).toFixed(1) };

// hold RIGHT + UP diagonally
await c.keyDown('KeyD'); await c.keyDown('KeyW'); await sleep(400);
await c.keyUp('KeyD'); await c.keyUp('KeyW');
const p2 = await J('return {x:P.sim.player.x,y:P.sim.player.y}');
R.moveDiag = { dx: +(p2.x - p1.x).toFixed(1), dy: +(p2.y - p1.y).toFixed(1) };

// focus mode: same hold duration must cover clearly less ground + hitbox shown
await c.keyDown('ShiftLeft'); await c.keyDown('ArrowLeft'); await sleep(500);
const foc = await J('return {focus:P.sim.player.focus}');
await c.keyUp('ArrowLeft'); await c.keyUp('ShiftLeft');
const p3 = await J('return {x:P.sim.player.x}');
R.focusMove = { focusFlag: foc.focus, dx: +(p3.x - p2.x).toFixed(1),
  ratioVsNormal: +Math.abs((p3.x - p2.x) / (p1.x - p0.x)).toFixed(3) };

// shooting must damage the boss
const hp0 = await J('return {hp:P.sim.boss.hp,score:P.game.score,shots:P.game.shots}');
await c.keyDown('KeyZ'); await sleep(1600); await c.keyUp('KeyZ');
const hp1 = await J('return {hp:P.sim.boss.hp,score:P.game.score,shots:P.game.shots,perfect:P.game.perfect,good:P.game.good,off:P.game.offbeat}');
R.shooting = { hpBefore: Math.round(hp0.hp), hpAfter: Math.round(hp1.hp),
  damage: Math.round(hp0.hp - hp1.hp), shotsFired: hp1.shots - hp0.shots,
  perfect: hp1.perfect, good: hp1.good, offbeat: hp1.off, scoreGain: hp1.score - hp0.score };

// dash: costs energy, grants i-frames
const e0 = await J('return {e:P.game.energy,inv:P.sim.player.invuln,combo:P.game.combo}');
await c.tap('KeyX', 60); await sleep(60);
const e1 = await J('return {e:P.game.energy,inv:+P.sim.player.invuln.toFixed(3),dash:+P.sim.player.dash.toFixed(3)}');
R.dash = { energyBefore: +e0.e.toFixed(1), energyAfter: +e1.e.toFixed(1),
  cost: +(e0.e - e1.e).toFixed(1), invulnGranted: e1.inv, dashActive: e1.dash > 0 };

// bomb: clears bullets, costs a bomb, damages the boss
await sleep(900);
const b0 = await J('return {bombs:P.game.bombs,bullets:P.sim.nB,hp:P.sim.boss.hp,cleared:P.game.bulletsCleared}');
await c.tap('KeyC', 60); await sleep(200);
const b1 = await J('return {bombs:P.game.bombs,bullets:P.sim.nB,hp:P.sim.boss.hp,cleared:P.game.bulletsCleared,inv:+P.sim.player.invuln.toFixed(2)}');
R.bomb = { bombsBefore: b0.bombs, bombsAfter: b1.bombs, bulletsBefore: b0.bullets,
  bulletsAfter: b1.bullets, clearedDelta: b1.cleared - b0.cleared,
  bossDamage: Math.round(b0.hp - b1.hp), invuln: b1.inv };

// ---- graze + combo by flying into traffic near the boss
await c.keyDown('KeyW'); await sleep(900); await c.keyUp('KeyW');
const g0 = await J('return {graze:P.game.graze,combo:P.game.combo,maxCombo:P.game.maxCombo,mult:+P.mult().toFixed(2)}');
R.graze = g0;

// ---- audio/visual sync over the measures played so far
R.sync = await J(`const s=window.__probe.sync;const n=s.length;
  const mean=n?s.reduce((a,b)=>a+b,0)/n:0;
  const sd=n?Math.sqrt(s.reduce((a,b)=>a+(b-mean)*(b-mean),0)/n):0;
  return {samples:n,meanMs:+mean.toFixed(2),sdMs:+sd.toFixed(2),
    maxAbsMs:+Math.max(...s.map(Math.abs)).toFixed(2),
    first8:s.slice(0,8),
    spawnPulseGrid:window.__probe.spawnPulses.slice(0,16),
    kickCount:window.__probe.kicks.length}`);

R.finalState = await J(`return {state:P.game.state,lives:P.game.lives,score:P.game.score,
  combo:P.game.combo,graze:P.game.graze,bullets:P.sim.nB,hits:P.game.hits,
  fps:document.getElementById('sb-fps').textContent,
  bar:Math.floor(P.sim.pulseAcc/48)+1,
  simVsTransportMs:+((P.Transport.pulseAt(P.Transport.nowT())-P.sim.pulseAcc)*P.Transport.spp()*1000).toFixed(2),
  ctxState:P.AudioEngine.ctx.state, clock:P.Transport.audioClock?'audio':'system'}`);
console.log(JSON.stringify(R, null, 1));
c.close();
