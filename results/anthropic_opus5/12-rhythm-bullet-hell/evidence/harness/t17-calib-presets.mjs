import { CDP, sleep } from './cdp.mjs';
const c = await CDP.attach(process.argv[2], 'index.html');
const J = async (e) => JSON.parse(await c.evalJS('JSON.stringify((()=>{const P=window.__pulse;' + e + '})())'));
const R = {};
await c.evalJS(`(()=>{const P=window.__pulse;P.S.lives=9;P.S.offset=0;P.UI.syncAll();P.startRun("run");return 1})()`);
await sleep(2600);

// ---- tap calibration: press SPACE close to each beat for 8 beats
await c.evalJS(`(()=>{const P=window.__pulse;P.UI.openDrawer("settings");
  document.getElementById('btnCalib').click();return 1})()`);
await sleep(200);
R.calibStarted = await J(`return {active:P.Calib?1:0,state:document.getElementById('calibState').textContent,
  val:document.getElementById('calibVal').textContent,metronomeOn:P.S.click}`);
// tap on the beat: wait until the transport is just before a beat boundary, then hit SPACE
for (let i = 0; i < 8; i++) {
  for (;;) {
    const p = await c.evalJS(`(()=>{const P=window.__pulse;const pp=P.Transport.pulseAt(P.Transport.nowT());
      return (pp%12+12)%12})()`);
    if (p > 10.4) break;                       // just short of the next beat
    await sleep(6);
  }
  await c.tap('Space', 25);
  await sleep(260);
}
await sleep(400);
R.calibResult = await J(`return {state:document.getElementById('calibState').textContent,
  val:document.getElementById('calibVal').textContent,offset:P.S.offset,
  slider:document.getElementById('setOffset').value,
  label:document.getElementById('setOffsetV').textContent,
  statusOffsetShown:document.getElementById('sb-offset').textContent}`);
// reset it back
await c.evalJS(`document.getElementById('btnCalibReset').click()`);
R.calibReset = await J(`return {offset:P.S.offset,label:document.getElementById('setOffsetV').textContent}`);

// ---- musical presets / scale / root really change the notes that get scheduled
await c.evalJS(`(()=>{const P=window.__pulse;window.__notes=[];const A=P.AudioEngine;
  if(!A.__wrapNotes){const bo=A.bassNote.bind(A),lo=A.leadNote.bind(A);
    A.bassNote=function(t,m,d,v,dr){window.__notes.push('b'+m);return bo(t,m,d,v,dr)};
    A.leadNote=function(t,m,d,v,k,s){window.__notes.push('l'+m);return lo(t,m,d,v,k,s)};
    A.__wrapNotes=1;}
  window.__notes=[];P.UI.openDrawer("audio");return 1})()`);
const gather = async (ms) => { await c.evalJS('window.__notes=[]'); await sleep(ms);
  return await c.evalJS(`JSON.stringify([...new Set(window.__notes)].sort())`).then(JSON.parse); };
R.notesDefault = { preset: 'neonPhrygian', notes: await gather(3000) };
await c.evalJS(`(()=>{const s=document.getElementById('setPreset');s.value='glassLydian';
  s.dispatchEvent(new Event('change'));return 1})()`);
await sleep(400);
R.notesLydian = { preset: await c.evalJS('window.__pulse.S.preset'),
  scale: await c.evalJS('window.__pulse.S.scale'),
  bpm: await c.evalJS('window.__pulse.Transport.bpm'),
  notes: await gather(3000) };
await c.evalJS(`(()=>{const s=document.getElementById('setRoot');s.value='52';
  s.dispatchEvent(new Event('change'));return 1})()`);
await sleep(300);
R.notesRootShift = { root: await c.evalJS('window.__pulse.S.root'), notes: await gather(3000) };
await c.evalJS(`(()=>{const s=document.getElementById('setPreset');s.value='neonPhrygian';
  s.dispatchEvent(new Event('change'));return 1})()`);

// ---- track mute really silences a bus
await c.evalJS(`(()=>{const e=document.getElementById('mute_bass');e.checked=true;
  e.dispatchEvent(new Event('change'));return 1})()`);
await sleep(700);
R.muteBass = await J(`return {gain:+P.AudioEngine.bus.bass.gain.value.toFixed(4),setting:P.S.muteBass}`);
await c.evalJS(`(()=>{const e=document.getElementById('mute_bass');e.checked=false;
  e.dispatchEvent(new Event('change'));return 1})()`);
await sleep(500);
R.unmuteBass = await J(`return {gain:+P.AudioEngine.bus.bass.gain.value.toFixed(4)}`);
// ---- metronome toggle
await c.evalJS(`(()=>{const e=document.getElementById('setClick');e.checked=true;e.dispatchEvent(new Event('change'));return 1})()`);
R.metronome = await J('return {click:P.S.click}');
await c.evalJS(`(()=>{const e=document.getElementById('setClick');e.checked=false;e.dispatchEvent(new Event('change'));
  window.__pulse.UI.closeDrawer();return 1})()`);
console.log(JSON.stringify(R, null, 1));
c.close();
