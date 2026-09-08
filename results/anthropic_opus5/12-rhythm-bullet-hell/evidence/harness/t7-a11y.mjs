import { CDP, sleep } from './cdp.mjs';
const c = await CDP.attach(process.argv[2], 'index.html');
const J = async (e) => JSON.parse(await c.evalJS('JSON.stringify((()=>{const P=window.__pulse;' + e + '})())'));
const R = {};
await c.evalJS(`(()=>{const P=window.__pulse;P.S.lives=9;P.startRun("run");P.UI.openDrawer("settings");return 1})()`);
await sleep(3000);

// --- reduced flash: a bomb must not push a full-screen flash
const flashTest = async (reduced) => {
  await c.evalJS(`(()=>{const el=document.getElementById('setReducedFlash');el.checked=${reduced};
    el.dispatchEvent(new Event('change'));return 1})()`);
  await c.evalJS(`window.__pulse.fx.flash=0;window.__pulse.game.bombs=5`);
  await c.tap('KeyC', 60); await sleep(60);
  return (await J('return {flash:+P.fx.flash.toFixed(3),shake:+P.fx.shake.toFixed(2),setting:P.S.reducedFlash}'));
};
R.flashNormal = await flashTest(false);
R.flashReduced = await flashTest(true);

// --- reduced motion: shake suppressed, particle budget cut
await c.evalJS(`(()=>{const el=document.getElementById('setReducedMotion');el.checked=true;
  el.dispatchEvent(new Event('change'));window.__pulse.fx.shake=0;return 1})()`);
await sleep(150);
await c.evalJS(`window.__pulse.fx.shakeAdd(30)`);
R.reducedMotion = await J(`return {shakeAfterAdd:+P.fx.shake.toFixed(2),
  htmlAttr:document.documentElement.getAttribute('data-motion'),
  particleMul:+P.fx.pmul().toFixed(3)}`);
await c.evalJS(`(()=>{const el=document.getElementById('setReducedMotion');el.checked=false;el.dispatchEvent(new Event('change'));
  const f=document.getElementById('setReducedFlash');f.checked=false;f.dispatchEvent(new Event('change'));return 1})()`);

// --- screen shake toggle
await c.evalJS(`(()=>{const el=document.getElementById('setShake');el.checked=false;el.dispatchEvent(new Event('change'));
  window.__pulse.fx.shake=0;window.__pulse.fx.shakeAdd(30);return 1})()`);
R.shakeOff = await J('return {shake:+P.fx.shake.toFixed(2),setting:P.S.shake}');
await c.evalJS(`(()=>{const el=document.getElementById('setShake');el.checked=true;el.dispatchEvent(new Event('change'));
  window.__pulse.fx.shakeAdd(30);return 1})()`);
R.shakeOn = await J('return {shake:+P.fx.shake.toFixed(2),setting:P.S.shake}');

// --- high contrast + colourblind palettes really change the drawn colours
const palTest = async (v) => {
  await c.evalJS(`(()=>{const el=document.getElementById('setPalette');el.value='${v}';el.dispatchEvent(new Event('change'));return 1})()`);
  await sleep(120);
  return await J(`return {palette:P.S.palette,bulletA:P.PALETTES[P.S.palette].a,
    spriteKeys:Object.keys(P.R.sprites).length,glowCacheCleared:Object.keys(P.R._glow).length}`);
};
R.paletteNeon = await palTest('neon');
R.paletteDeuter = await palTest('deuter');
R.paletteMono = await palTest('mono');
await c.evalJS(`(()=>{const el=document.getElementById('setContrast');el.checked=true;el.dispatchEvent(new Event('change'));return 1})()`);
await sleep(150);
R.highContrast = await J(`return {attr:document.documentElement.getAttribute('data-contrast'),
  bodyInk:getComputedStyle(document.body).color,setting:P.S.contrast}`);
await c.evalJS(`(()=>{const el=document.getElementById('setContrast');el.checked=false;el.dispatchEvent(new Event('change'));
  const p=document.getElementById('setPalette');p.value='neon';p.dispatchEvent(new Event('change'));return 1})()`);

// --- hitbox always on
await c.evalJS(`(()=>{const el=document.getElementById('setHitbox');el.checked=true;el.dispatchEvent(new Event('change'));return 1})()`);
R.hitboxAlways = await J('return {setting:P.S.hitboxAlways}');
await c.evalJS(`(()=>{const el=document.getElementById('setHitbox');el.checked=false;el.dispatchEvent(new Event('change'));return 1})()`);

// --- difficulty segmented control changes real bullet density
const diffTest = async (d) => {
  await c.evalJS(`document.querySelector('#segDiff button[data-d="${d}"]').click()`);
  await sleep(100);
  return await J(`const D=P.DIFFS[P.S.difficulty];
    return {diff:P.S.difficulty,dens:D.dens,spd:D.spd,
      btnOn:document.querySelector('#segDiff button.on').dataset.d}`);
};
R.diffChill = await diffTest('chill');
R.diffLunatic = await diffTest('lunatic');
await diffTest('normal');

// --- tempo slider retunes the live transport without losing musical position
const before = await J('return {bpm:P.Transport.bpm,pulse:+P.sim.pulseAcc.toFixed(2),beatPhase:+((P.sim.pulseAcc%48)/12).toFixed(3)}');
await c.evalJS(`(()=>{const el=document.getElementById('setBpm');el.value='164';el.dispatchEvent(new Event('input'));return 1})()`);
await sleep(60);
const mid = await J('return {bpm:P.Transport.bpm,pulse:+P.sim.pulseAcc.toFixed(2),label:document.getElementById("setBpmV").textContent}');
await sleep(1500);
const after = await J('return {bpm:P.Transport.bpm,pulse:+P.sim.pulseAcc.toFixed(2),state:P.game.state,bullets:P.sim.nB}');
R.tempoChange = { before, immediatelyAfter: mid, later: after,
  pulseJumpAtChange: +(mid.pulse - before.pulse).toFixed(3),
  pulsesPerSecondAfter: +((after.pulse - mid.pulse) / 1.5).toFixed(2),
  expectedPulsesPerSecond: +(164 / 60 * 12).toFixed(2) };
await c.evalJS(`(()=>{const el=document.getElementById('setBpm');el.value='128';el.dispatchEvent(new Event('input'));return 1})()`);
console.log(JSON.stringify(R, null, 1));
c.close();
