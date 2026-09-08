import { CDP, sleep } from './cdp.mjs';
const c = await CDP.attach(process.argv[2], 'index.html');
const J = async (e) => JSON.parse(await c.evalJS('JSON.stringify((()=>{const P=window.__pulse;' + e + '})())'));
const R = {};
await c.evalJS(`(()=>{const P=window.__pulse;P.S.lives=9;P.S.touch="on";P.UI.syncAll();P.startRun("run");return 1})()`);
await sleep(2600);
// measure the pad only once it is actually on screen
const pad = await J(`const r=document.getElementById('tpad').getBoundingClientRect();
  return {cx:r.left+r.width/2,cy:r.top+r.height/2,w:r.width,visible:r.width>0}`);
R.padRect = pad;
const before = await J('return {x:+P.sim.player.x.toFixed(1)}');
await c.mouseDown(pad.cx, pad.cy);
await c.mouseMove(pad.cx - pad.w * 0.45, pad.cy, 1);
await sleep(600);
const mid = await J(`return {x:+P.sim.player.x.toFixed(1),mask:P.Input.mask,
  nub:document.getElementById('tnub').style.transform,dir:P.Input.touchDir}`);
await c.mouseUp(pad.cx - pad.w * 0.45, pad.cy);
await sleep(250);
const afterUp = await J('return {mask:P.Input.mask,dir:P.Input.touchDir}');
R.virtualStick = { xBefore: before.x, xWhileHeld: mid.x, movedLeft: mid.x < before.x - 25,
  maskWhileHeld: mid.mask, nubTransform: mid.nub, maskAfterRelease: afterUp.mask,
  dirClearedOnRelease: afterUp.dir === null };

// ---- mouse pointer control: drag inside the arena, ship follows the cursor
await c.evalJS(`(()=>{const P=window.__pulse;P.S.pointer=true;P.S.touch="off";P.UI.syncAll();return 1})()`);
const target = await J(`const s=P.R.toScreen(200,700);const r=document.getElementById('game').getBoundingClientRect();
  return {x:r.left+s[0],y:r.top+s[1]}`);
await c.mouseDown(target.x, target.y);
await c.mouseMove(target.x, target.y, 1);
await sleep(700);
const drag = await J('return {x:+P.sim.player.x.toFixed(1),y:+P.sim.player.y.toFixed(1),down:P.Input.pointerDown}');
await c.mouseUp(target.x, target.y);
await sleep(200);
R.pointerDrag = { targetArena: [200, 700], playerAt: [drag.x, drag.y],
  withinTolerance: Math.abs(drag.x - 200) < 18 && Math.abs(drag.y - 700) < 18,
  releasedCleanly: !(await J('return {d:P.Input.pointerDown}')).d };

// ---- deterministic seeds, compared at the SAME simulation tick
const runSeed = async (seed) => {
  await c.evalJS(`(()=>{const P=window.__pulse;P.S.seed="${seed}";P.S.seedLock=true;P.S.difficulty="normal";
    P.S.adaptive=false;P.S.lives=9;P.S.pointer=false;P.startRun("run");return 1})()`);
  let t = 0, guard = 0;
  while (t < 640 && guard++ < 80) { await sleep(200); t = (await J('return {t:P.sim.tick}')).t; }
  return await J(`return {seed:P.S.seed,tick:P.sim.tick,checksumAt600:P.sim.checksum>>>0,
    rngCalls:P.sim.rngCalls,bossX:Math.round(P.sim.boss.x),bossY:Math.round(P.sim.boss.y)}`);
};
R.seedA1 = await runSeed('12345');
R.seedA2 = await runSeed('12345');
R.seedB  = await runSeed('99999');
R.seedVerdict = {
  sameSeedSameChecksum: R.seedA1.checksumAt600 === R.seedA2.checksumAt600,
  sameSeedSameRng: R.seedA1.rngCalls === R.seedA2.rngCalls,
  sameSeedSameBoss: R.seedA1.bossX === R.seedA2.bossX && R.seedA1.bossY === R.seedA2.bossY,
  differentSeedDiffers: R.seedA1.checksumAt600 !== R.seedB.checksumAt600 || R.seedA1.bossX !== R.seedB.bossX,
};
await c.evalJS(`(()=>{const P=window.__pulse;P.S.pointer=true;P.UI.syncAll();return 1})()`);
console.log(JSON.stringify(R, null, 1));
c.close();
