import { CDP, sleep } from './cdp.mjs';
const c = await CDP.attach(process.argv[2], 'index.html');
const J = async (e) => JSON.parse(await c.evalJS('JSON.stringify((()=>{const P=window.__pulse;' + e + '})())'));
const R = {};
await c.evalJS(`(()=>{const P=window.__pulse;P.S.lives=9;P.S.difficulty="chill";P.S.autofire=true;
  P.S.seed="777";P.UI.syncAll();P.startRun("run");return 1})()`);
await sleep(2600);
// stay under the boss: an aiming assist for the test, not a change to the game
await c.evalJS(`window.__lock=setInterval(()=>{const P=window.__pulse;
  if(P.game.state==='PLAYING')P.sim.player.x=P.sim.boss.x;},16)`);
const phases = [];
let guard = 0, st = 'PLAYING';
while (st === 'PLAYING' && guard++ < 120) {
  await sleep(500);
  const s = await J(`return {s:P.game.state,ph:P.game.phaseIdx,mp:P.game.musicPhase,
    hp:Math.round(P.sim.boss.hp),lives:P.game.lives,score:P.game.score,
    label:document.getElementById('bossPhase').textContent}`);
  st = s.s;
  if (!phases.length || phases[phases.length - 1].ph !== s.ph) phases.push(s);
}
await c.evalJS(`clearInterval(window.__lock)`);
R.phaseProgression = phases.map(p => ({ phase: p.ph + 1, musicPhase: p.mp, label: p.label, lives: p.lives }));
R.victory = await J(`return {state:P.game.state,victory:P.game.victory,
  title:document.getElementById('overTitle').textContent,
  sub:document.getElementById('overSub').textContent,
  screenShown:document.getElementById('screen-over').classList.contains('show'),
  results:[...document.querySelectorAll('#resultList .k')].map((k,i)=>
    k.textContent+': '+document.querySelectorAll('#resultList .v')[i].textContent),
  score:P.game.score,best:P.game.bestScore,storedBest:JSON.parse(localStorage.getItem('pulsecannon.scores.v1')||'{}').best,
  runsStored:(JSON.parse(localStorage.getItem('pulsecannon.scores.v1')||'{}').runs||[]).length}`);
console.log(JSON.stringify(R, null, 1));
c.close();
