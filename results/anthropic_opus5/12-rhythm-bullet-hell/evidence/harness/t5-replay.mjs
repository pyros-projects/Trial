import { CDP, sleep } from './cdp.mjs';
const c = await CDP.attach(process.argv[2], 'index.html');
const J = async (e) => JSON.parse(await c.evalJS('JSON.stringify((()=>{const P=window.__pulse;' + e + '})())'));
const R = {};
// short, lethal run so it ends naturally and the log closes itself
await c.evalJS(`(()=>{const P=window.__pulse;P.S.lives=1;P.S.seed="4242";P.S.seedLock=true;
  P.S.difficulty="normal";P.S.offset=0;P.S.autofire=false;P.startRun("run");return 1})()`);
await sleep(2400);
// scripted, varied input so the log has real content
const script = [['ArrowLeft',380],['KeyZ',300],['ArrowRight',420],['ShiftLeft',250],
                ['KeyX',80],['ArrowUp',300],['KeyZ',500],['ArrowDown',260],['ArrowLeft',300]];
for (const [k, ms] of script) { await c.keyDown(k); await sleep(ms); await c.keyUp(k); }
// wait for death
let guard = 0, st = 'PLAYING';
while (st === 'PLAYING' && guard++ < 60) { await sleep(500); st = (await J('return {s:P.game.state}')).s;
  if (guard % 4 === 0) { await c.keyDown('ArrowRight'); await sleep(200); await c.keyUp('ArrowRight'); } }
R.runEnded = await J(`return {state:P.game.state,ticks:P.sim.tick,checksum:P.sim.checksum>>>0,
  score:P.game.score,graze:P.game.graze,hits:P.game.hits,maxCombo:P.game.maxCombo,
  bossHp:Math.round(P.sim.boss.hp),phase:P.game.phaseIdx}`);
// grab the exported log straight out of the UI textarea
await c.evalJS(`(()=>{const P=window.__pulse;P.UI.openDrawer("replay");
  document.getElementById("btnRepExport").click();return 1})()`);
await sleep(300);
const txt = await c.evalJS(`document.getElementById("repText").value`);
R.export = { bytes: txt.length, head: txt.slice(0, 190),
  events: JSON.parse(txt).ev.split(',').length, meta: (({ ev, ...m }) => m)(JSON.parse(txt)) };
// import + replay it
await c.evalJS(`document.getElementById("btnRepImport").click()`);
await sleep(500);
R.replayStarted = await J(`return {state:P.game.state,playing:P.Replay.playing,
  recState:document.getElementById('recState').textContent}`);
guard = 0; st = 'COUNTDOWN';
while ((st === 'PLAYING' || st === 'COUNTDOWN') && guard++ < 90) { await sleep(400); st = (await J('return {s:P.game.state}')).s; }
R.replayEnded = await J(`return {state:P.game.state,ticks:P.sim.tick,checksum:P.sim.checksum>>>0,
  score:P.game.score,graze:P.game.graze,hits:P.game.hits,maxCombo:P.game.maxCombo,
  bossHp:Math.round(P.sim.boss.hp),phase:P.game.phaseIdx,
  verify:document.getElementById('repVerify').textContent,
  verifyClass:document.getElementById('repVerify').className}`);
R.match = {
  ticks: R.runEnded.ticks === R.replayEnded.ticks,
  checksum: R.runEnded.checksum === R.replayEnded.checksum,
  score: R.runEnded.score === R.replayEnded.score,
  graze: R.runEnded.graze === R.replayEnded.graze,
  bossHp: R.runEnded.bossHp === R.replayEnded.bossHp,
  maxCombo: R.runEnded.maxCombo === R.replayEnded.maxCombo,
};
console.log(JSON.stringify(R, null, 1));
c.close();
