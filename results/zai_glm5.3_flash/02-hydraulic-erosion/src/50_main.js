/* ================= main loop & boot ================= */

const FPS = { acc: [], ema: 60 };
let lastT = performance.now(), stepAcc = 0, statAcc = 0, lastStats = null, lastFlowCalc = 0;

function doSteps(n){
  const t0 = performance.now();
  let ran = 0;
  for(let q=0; q<n; q++){
    simStep(DT);
    ran++;
    if(S.steps % 64 === 0) sanitize();
  }
  S.simMs = performance.now() - t0;
  return ran;
}

function frame(now){
  const dtF = clamp((now-lastT)/1000, 0.0005, 0.1);
  lastT = now;

  let ran = 0;
  if(!S.paused){
    stepAcc += P.substeps * P.speed * (dtF/(1/60));
    let n = Math.min(Math.floor(stepAcc), 24);
    if(n > 0){
      const t0 = performance.now();
      while(ran < n && performance.now()-t0 < 14){
        simStep(DT); ran++;
        if(S.steps % 64 === 0) sanitize();
      }
      S.simMs = performance.now() - t0;
      stepAcc = clamp(stepAcc - ran, 0, 3);
      S.cappedNotice = ran < n;
    }
  }
  S.stepsPerSec = S.stepsPerSec*0.9 + (ran/dtF)*0.1;

  // hover probe + brush ring (real raycast every frame)
  if(UI.stroke){
    applyBrush(UI.stroke.gx, UI.stroke.gz, P.tool, 0.45);
    updateRing(UI.stroke.gx, UI.stroke.gz);
  } else if(UI.mouse && !UI.camDrag){
    const hit = pickTerrain(UI.mouse.x, UI.mouse.y);
    if(hit){
      if(!UI.pinned) updateProbeCard(hit, false);
      updateRing(hit.gx, hit.gz);
    } else {
      UI.ringPts = null;
      if(!UI.pinned){ ['pr-pos','pr-h','pr-w','pr-s','pr-v','pr-slope','pr-dh'].forEach(id=>$(id).textContent='–'); $('probe').classList.remove('pin'); }
    }
  }
  if(UI.pinned){
    const [wx, wz] = gridToWorld(UI.pinned.gx, UI.pinned.gz);
    updateProbeCard({gx:UI.pinned.gx, gz:UI.pinned.gz, x:wx, z:wz, h:sampleHeight(UI.pinned.gx,UI.pinned.gz)}, true);
  }

  statAcc += dtF;
  if(S.flowDirty && now-lastFlowCalc > 500){ lastFlowCalc = now; computeFlowAccumulation(); }
  if(statAcc >= 0.25){ statAcc = 0; lastStats = computeStats(); }
  if(lastStats) updateStatus(dtF, lastStats);

  const t0 = performance.now();
  render(dtF);
  S.frameMs = performance.now() - t0;

  requestAnimationFrame(frame);
}

function boot(){
  if(!initGL()) return;
  allocState(P.res);
  generateTerrain();
  buildMesh(S.N);
  allocTextures();
  initUI();
  initInput();
  CAM.dist = CAM.ddist = S.N*0.95;
  CAM.ty = CAM.dty = S.genMax*0.35*P.ex;
  $('st-pause').textContent = 'running';

  window.__lab = {
    S, P, DT, computeStats, simStep, generateTerrain, resetSim, sanitize, computeFlowAccumulation,
    checksum(){
      let hsh = 2166136261>>>0;
      const a = S.h;
      for(let k=0;k<a.length;k++){
        hsh = (hsh ^ Math.round(a[k]*8192)) >>> 0;
        hsh = Math.imul(hsh, 16777619) >>> 0;
      }
      return (hsh>>>0).toString(16);
    },
  };
  requestAnimationFrame(frame);
}

window.addEventListener('DOMContentLoaded', boot);
window.addEventListener('scroll', ()=>window.scrollTo(0,0));  // fullscreen app: never scroll
