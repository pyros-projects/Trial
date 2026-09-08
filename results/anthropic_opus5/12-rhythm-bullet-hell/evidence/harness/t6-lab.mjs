import { CDP, sleep } from './cdp.mjs';
const c = await CDP.attach(process.argv[2], 'index.html');
const J = async (e) => JSON.parse(await c.evalJS('JSON.stringify((()=>{const P=window.__pulse;' + e + '})())'));
const R = {};
const instrument = () => c.evalJS(`(()=>{const P=window.__pulse;window.__em=[];
  if(!P.sim.__wrapped){const eo=P.sim.emit.bind(P.sim);
    P.sim.emit=function(id,over){window.__em.push({id:id,pulse:Math.round(P.sim.pulseAcc),
      step:Math.round(P.sim.pulseAcc)%48/3,count:over&&over.count});return eo(id,over)};P.sim.__wrapped=1;}
  window.__em=[];return 1})()`);

// ---- enter practice through the labelled button
await c.evalJS(`document.getElementById('btnOverTitle').click()`);
await sleep(300);
await c.evalJS(`document.getElementById('btnPracticeFromTitle').click()`);
await sleep(2600);
R.labEntered = await J(`return {state:P.game.state,mode:P.game.mode,labRunning:P.UI.lab.running,
  status:document.getElementById('labStatus').textContent,drawer:P.UI.drawerOpen,tab:P.UI.curTab,
  bossBarHidden:!document.getElementById('hud-boss').classList.contains('show')}`);

// ---- single pattern under test: spiral on 1/8 (6 pulses)
await c.evalJS(`(()=>{const P=window.__pulse;const L=P.UI.lab;
  L.lanes.forEach(l=>l.cells.fill(0));           // isolate the pattern channel
  const sel=document.getElementById('labPattern');sel.value='spiral';sel.dispatchEvent(new Event('change'));
  const sub=document.getElementById('labSub');sub.value='6';sub.dispatchEvent(new Event('change'));
  const d=document.getElementById('labDensity');d.value='5';d.dispatchEvent(new Event('input'));
  return 1})()`);
await instrument(); await sleep(3000);
R.singlePattern = await J(`const e=window.__em;const ids=[...new Set(e.map(x=>x.id))];
  const gaps=e.slice(1).map((x,i)=>x.pulse-e[i].pulse);
  return {events:e.length,patternsSeen:ids,pulseGaps:[...new Set(gaps)],
    countRequested:e.length?e[0].count:null,bullets:P.sim.nB,
    labSub:P.UI.lab.sub,labDensity:P.UI.lab.density}`);

// ---- change subdivision live to 1/16 (3 pulses) and confirm the gaps change
await c.evalJS(`(()=>{const s=document.getElementById('labSub');s.value='3';s.dispatchEvent(new Event('change'));return 1})()`);
await instrument(); await sleep(2500);
R.subdivisionChanged = await J(`const e=window.__em;const gaps=e.slice(1).map((x,i)=>x.pulse-e[i].pulse);
  return {events:e.length,pulseGaps:[...new Set(gaps)],labSub:P.UI.lab.sub}`);

// ---- step grid: clear the single-pattern channel, light 3 cells in lane 0
await c.evalJS(`(()=>{const P=window.__pulse;const s=document.getElementById('labSub');
  s.value='48';s.dispatchEvent(new Event('change'));   // 1 per bar so the grid dominates
  const sel=document.getElementById('labPattern');sel.value='aimed';sel.dispatchEvent(new Event('change'));
  P.UI.lab.lanes.forEach(l=>l.cells.fill(0));
  const cells=document.querySelectorAll('#stepgrid .cell[data-lane="0"]');
  [0,6,10].forEach(i=>cells[i].click());
  P.UI.lab.lanes[0].pattern='wall';
  return {lane0:P.UI.lab.lanes[0].cells.join(''),pattern:P.UI.lab.lanes[0].pattern}})()`);
await instrument(); await sleep(4200);
R.stepGrid = await J(`const e=window.__em.filter(x=>x.id==='wall');
  const steps=[...new Set(e.map(x=>x.step))].sort((a,b)=>a-b);
  return {wallEvents:e.length,firedOnSteps:steps,
    gridCells:P.UI.lab.lanes[0].cells.join(''),
    litCells:document.querySelectorAll('#stepgrid .cell.on').length,
    counter:document.getElementById('gridCount').textContent}`);

// ---- toggling a cell off must stop that spawn
await c.evalJS(`document.querySelectorAll('#stepgrid .cell[data-lane="0"]')[6].click()`);
await instrument(); await sleep(4200);
R.cellToggledOff = await J(`const e=window.__em.filter(x=>x.id==='wall');
  return {firedOnSteps:[...new Set(e.map(x=>x.step))].sort((a,b)=>a-b),
    gridCells:P.UI.lab.lanes[0].cells.join('')}`);

// ---- a preset must change pattern, subdivision and tempo for real
await c.evalJS(`document.querySelectorAll('#labPresets [data-preset]')[13].click()`);
await sleep(200);
await instrument(); await sleep(2200);
R.preset = await J(`const e=window.__em;
  return {presetName:'NIGHTMARE',bpm:P.Transport.bpm,bpmSetting:P.S.bpm,
    labPattern:P.UI.lab.pattern,labSub:P.UI.lab.sub,labDensity:P.UI.lab.density,
    emitted:[...new Set(e.map(x=>x.id))],events:e.length,bullets:P.sim.nB,
    bpmLabel:document.getElementById('setBpmV').textContent}`);
console.log(JSON.stringify(R, null, 1));
c.close();
