import { CDP, sleep } from './cdp.mjs';
const c = await CDP.attach(process.argv[2], 'index.html');
const J = async (e) => JSON.parse(await c.evalJS('JSON.stringify((()=>{const P=window.__pulse;' + e + '})())'));
// plenty of lives so the measurement window is not cut short by a death
await c.evalJS(`(()=>{const P=window.__pulse;P.S.lives=9;P.S.seed="1337";P.S.offset=0;P.startRun("run");
  window.__probe={sync:[],pulses:[],kick:[],snare:[]};
  const so=P.sim.onPulse.bind(P.sim);
  P.sim.onPulse=function(pulse){const n0=P.sim.nB;so(pulse);
    if(P.sim.nB>n0){window.__probe.pulses.push(pulse);
      window.__probe.sync.push(+((P.Transport.nowT()-P.Transport.timeOf(pulse))*1000).toFixed(2));}};
  const A=P.AudioEngine,ko=A.kick.bind(A),sn=A.snare.bind(A);
  A.kick=function(t,v){window.__probe.kick.push(+((t-P.Transport.startTime)/P.Transport.spp()).toFixed(3));return ko(t,v)};
  A.snare=function(t,v){window.__probe.snare.push(+((t-P.Transport.startTime)/P.Transport.spp()).toFixed(3));return sn(t,v)};
  return 1})()`);
// dodge left/right the whole time so the run stays alive and inputs stay live
const t0 = Date.now();
while (Date.now() - t0 < 14000) {
  await c.keyDown('ArrowLeft'); await sleep(420); await c.keyUp('ArrowLeft');
  await c.keyDown('ArrowRight'); await sleep(420); await c.keyUp('ArrowRight');
}
const R = await J(`const p=window.__probe,s=p.sync,n=s.length;
  const mean=s.reduce((a,b)=>a+b,0)/n;
  const sd=Math.sqrt(s.reduce((a,b)=>a+(b-mean)*(b-mean),0)/n);
  const kickPulses=p.kick.map(x=>+x.toFixed(1));
  const offGrid=kickPulses.filter(x=>Math.abs(x-Math.round(x))>0.02).length;
  const kickOn16=kickPulses.filter(x=>Math.abs(Math.round(x)%3)<0.001).length;
  const snareBeats=p.snare.map(x=>+((Math.round(x)%48)/12).toFixed(2));
  return {state:P.game.state,lives:P.game.lives,bar:Math.floor(P.sim.pulseAcc/48)+1,
    clock:P.Transport.audioClock?'audio':'system',ctxState:P.AudioEngine.ctx.state,
    spawnEvents:n, syncMeanMs:+mean.toFixed(2), syncSdMs:+sd.toFixed(2),
    syncMaxAbsMs:+Math.max(...s.map(Math.abs)).toFixed(2),
    syncP95Ms:+s.map(Math.abs).sort((a,b)=>a-b)[Math.floor(n*0.95)].toFixed(2),
    kicksScheduled:p.kick.length, kicksOffPulseGrid:offGrid, kicksOn16thGrid:kickOn16,
    snareBeatPositions:[...new Set(snareBeats)].sort(),
    simVsTransportMs:+((P.Transport.pulseAt(P.Transport.nowT())-P.sim.pulseAcc)*P.Transport.spp()*1000).toFixed(2),
    graze:P.game.graze,score:P.game.score,combo:P.game.combo,bullets:P.sim.nB,
    fps:document.getElementById('sb-fps').textContent}`);
console.log(JSON.stringify(R, null, 1));
c.close();
