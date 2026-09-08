import { CDP, sleep } from './cdp.mjs';
const c = await CDP.attach(process.argv[2], 'index.html');
const J = async (e) => JSON.parse(await c.evalJS('JSON.stringify((()=>{const P=window.__pulse;' + e + '})())'));
const R = {};

// ---- virtual thumb stick (touch layout is forced on for this check)
const pad = await J(`const r=document.getElementById('tpad').getBoundingClientRect();
  return {cx:r.left+r.width/2,cy:r.top+r.height/2,w:r.width}`);
await c.evalJS(`(()=>{const P=window.__pulse;P.S.lives=9;P.startRun("run");return 1})()`);
await sleep(2600);
const before = await J('return {x:+P.sim.player.x.toFixed(1),y:+P.sim.player.y.toFixed(1)}');
await c.mouseDown(pad.cx, pad.cy);
await c.mouseMove(pad.cx - pad.w * 0.45, pad.cy, 1);
await sleep(600);
const mid = await J(`return {x:+P.sim.player.x.toFixed(1),mask:P.Input.mask,
  nub:document.getElementById('tnub').style.transform,dir:P.Input.touchDir}`);
await c.mouseUp(pad.cx - pad.w * 0.45, pad.cy);
await sleep(200);
const afterUp = await J('return {mask:P.Input.mask,dir:P.Input.touchDir,x:+P.sim.player.x.toFixed(1)}');
R.virtualStick = { xBefore: before.x, xWhileHeld: mid.x, movedLeft: mid.x < before.x - 30,
  maskWhileHeld: mid.mask, nubTransform: mid.nub, maskAfterRelease: afterUp.mask,
  dirClearedOnRelease: afterUp.dir === null };

// ---- touch FIRE button
const fireBox = await J(`const r=document.getElementById('tb-shoot').getBoundingClientRect();
  return {x:r.left+r.width/2,y:r.top+r.height/2}`);
const s0 = await J('return {shots:P.game.shots}');
await c.mouseDown(fireBox.x, fireBox.y); await sleep(500); await c.mouseUp(fireBox.x, fireBox.y);
const s1 = await J('return {shots:P.game.shots,mask:P.Input.mask}');
R.touchFire = { shotsBefore: s0.shots, shotsAfter: s1.shots, fired: s1.shots > s0.shots, maskAfter: s1.mask };

// ---- focus loss must clear held keys and auto-pause
await c.keyDown('ArrowLeft'); await c.keyDown('KeyZ'); await sleep(200);
const held = await J('return {mask:P.Input.mask,keys:Object.keys(P.Input.keys).length,state:P.game.state}');
await c.evalJS(`window.dispatchEvent(new Event('blur'))`);
await sleep(300);
const blurred = await J('return {mask:P.Input.mask,keys:Object.keys(P.Input.keys).length,state:P.game.state,pauseInfo:document.getElementById("pauseInfo").textContent}');
await c.keyUp('ArrowLeft'); await c.keyUp('KeyZ');
R.focusLoss = { maskWhileHeld: held.mask, keysWhileHeld: held.keys, stateWhileHeld: held.state,
  maskAfterBlur: blurred.mask, keysAfterBlur: blurred.keys, stateAfterBlur: blurred.state,
  pauseReason: blurred.pauseInfo.slice(0, 60) };
await c.evalJS(`document.getElementById('btnResume').click()`); await sleep(400);
R.resumedAfterBlur = await J('return {state:P.game.state}');

// ---- deterministic seeds: same seed -> identical bullet field, different seed -> different
const snapshotField = async (seed) => {
  await c.evalJS(`(()=>{const P=window.__pulse;P.S.seed="${seed}";P.S.seedLock=true;P.S.difficulty="normal";
    P.S.adaptive=false;P.S.lives=9;P.startRun("run");return 1})()`);
  await sleep(5200);   // count-in + ~1.7 bars, no player input at all
  return await J(`let h=0;const B=[];
    for(let i=0;i<2600;i++){const b=P.sim.bullets[i];if(!b||!b.alive)continue;
      B.push([Math.round(b.x),Math.round(b.y),Math.round(b.vx),Math.round(b.vy)]);}
    B.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
    const str=JSON.stringify(B);for(let i=0;i<str.length;i++){h=(Math.imul(h,31)+str.charCodeAt(i))|0;}
    return {seed:P.S.seed,bullets:B.length,fieldHash:h>>>0,bossX:Math.round(P.sim.boss.x),
      tick:P.sim.tick,rngCalls:P.sim.rngCalls}`);
};
R.seedA1 = await snapshotField('12345');
R.seedA2 = await snapshotField('12345');
R.seedB = await snapshotField('99999');
R.seedVerdict = {
  sameSeedIdenticalField: R.seedA1.fieldHash === R.seedA2.fieldHash && R.seedA1.bullets === R.seedA2.bullets,
  sameSeedSameBossPath: R.seedA1.bossX === R.seedA2.bossX,
  differentSeedDiffersField: R.seedA1.fieldHash !== R.seedB.fieldHash,
};
console.log(JSON.stringify(R, null, 1));
c.close();
