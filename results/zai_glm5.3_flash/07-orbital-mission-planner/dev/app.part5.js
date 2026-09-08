
/* ============================================================
   Main loop & boot
   ============================================================ */
const App = {
  last: performance.now(),
  fps: 60, fpsAcc: 0, fpsN: 0, fpsShown: 0,
  hudTimer: 0,
  running: true,

  init() {
    Render.init();
    Interact.init();
    const idx = Math.max(0, Scenarios.findIndex(s => s.id === 'sandbox'));
    el('scenarioSel').value = String(idx);
    loadScenario(Scenarios[idx], { paused: false });
    UI.init();
    UI.refreshSelection();
    UI.refreshNodeEditor();
    Predict.run(true);
    Sim.logEvent('Welcome — press Space to pause/resume, N to add a node', 'ok');
    requestAnimationFrame(ts => this.frame(ts));
  },
  frame(ts) {
    if (!this.running) return;
    const now = performance.now();
    let dtReal = (now - this.last) / 1000;
    this.last = now;
    dtReal = Math.min(dtReal, 0.1);
    // fps
    this.fpsAcc += dtReal; this.fpsN++;
    if (this.fpsAcc > 0.4) { this.fpsShown = this.fpsN / this.fpsAcc; this.fpsAcc = 0; this.fpsN = 0; }

    // physics — fixed-step accumulator; stepOnce may briefly shrink steps to land on node times
    let steps = 0;
    if (!P.paused) {
      this.stepAcc = (this.stepAcc || 0) + Math.min(dtReal, 0.05) * P.warp;
      while (this.stepAcc >= P.dt) {
        Sim.stepOnce();
        this.stepAcc -= P.dt;
        steps++;
        if (steps > P.maxStepsPerFrame) { this.stepAcc = 0; break; }
      }
      const simDt = Sim.t - (this.frameT0 ?? Sim.t);
      this.frameT0 = Sim.t;
      Hist.maybeSample(simDt);
      Stats.sample(simDt);
      Checkpoints.maybeAuto(simDt);
      // follow
      if (Cam.followIdx >= 0 && Sim.alive[Cam.followIdx]) {
        const p = Render.bodyScreen(Cam.followIdx);
        Cam.cx = p.fx; Cam.cy = p.fy;
      }
    } else {
      this.frameT0 = Sim.t;
    }
    Sim.stepsLastFrame = steps;

    Frames.update(); // keep live frame transform in sync with physics
    // prediction (budgeted)
    Predict.run(false);

    Render.frame();
    this.hud(now);

    requestAnimationFrame(t2 => this.frame(t2));
  },
  hud(now) {
    if (now - this.hudTimer < 100) return;
    this.hudTimer = now;
    const p = Sim.momentum();
    const dE = (Sim.energy() - Sim.E0) / Math.max(Math.abs(Sim.E0), 1e-9);
    const dP = hyp(p.px - Sim.P0x, p.py - Sim.P0y);
    el('hFps').textContent = fmtNum(this.fpsShown || 0, 3);
    el('hMet').textContent = fmtTime(Sim.t);
    el('hWarp').textContent = `${fmtNum(P.warp, 3)} u/s`;
    el('hSteps').textContent = String(Sim.stepsLastFrame);
    el('hBodies').textContent = `${Sim.aliveCount()}/${Sim.n}`;
    el('hEnergy').textContent = `${dE >= 0 ? '+' : ''}${dE.toExponential(1)}`;
    el('hEnergy').style.color = Math.abs(dE) < 1e-4 ? '#7ee2a8' : (Math.abs(dE) < 1e-2 ? '#fbd38d' : '#f88');
    el('hFrame').textContent = Frames.name();
    el('hPause').textContent = P.paused ? 'PAUSED' : 'RUNNING';
    el('hPause').style.color = P.paused ? '#fbd38d' : '#7ee2a8';
    el('hErr2').textContent = `ΔE ${(dE * 100).toExponential(1)}% · |ΔP| ${fmtNum(dP, 3)}`;
    el('hMerges').textContent = String(Sim.mergeCount);
    el('hCkpts').textContent = String(Checkpoints.auto.length + Checkpoints.manual.length);
    if (!P.paused) UI.refreshSelection(true);
    if (!P.paused) UI.refreshNodeEditor(true);
  },
};

window.addEventListener('error', e => {
  try { UI.eventTick('Error: ' + e.message, 'warn'); } catch (_) { }
});

document.addEventListener('DOMContentLoaded', () => App.init());
