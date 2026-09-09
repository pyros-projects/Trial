'use strict';
/* ============================= settings ============================= */
const P = {
  mode: 'trial', preset: 'canyon-sprint', env: 'canyon', seed: 1337, diff: 0.35,
  trialLaps: 3, collisionPenalty: true, ghostVisible: true, ghostTrail: false,
  flightMode: 'angle', autoLevel: 1, altHold: true, antiCrash: true, forgive: 0.35,
  twr: 2.3, gravity: 9.81, drag: 1, throttleExpo: 0.25, expo: 0.3,
  ratePitch: 320, rateRoll: 360, rateYaw: 220, angleMax: 35, angleGain: 4.2,
  quality: 'high', renderScale: 1, adaptive: true, postFX: true, fov: 100, camTilt: 18,
  shadows: true, haze: true, particles: 'med',
  volume: 0.7,
  deadzone: 0.09, invertThrottle: false, invertYaw: false, invertPitch: false, invertRoll: false,
  showOverlay: true, showGraph: true, showDiag: false, showVolumes: false,
};
function settingsLoad() {
  try {
    const s = JSON.parse(localStorage.getItem('fpvdr.settings.v1') || '{}');
    for (const k of Object.keys(P)) {
      if (k in s && typeof s[k] === typeof P[k]) P[k] = s[k];
    }
  } catch (e) { }
  G.userScale = P.renderScale;
}
let _saveT = null;
function settingsSave() {
  clearTimeout(_saveT);
  _saveT = setTimeout(() => {
    try { localStorage.setItem('fpvdr.settings.v1', JSON.stringify(P)); } catch (e) { }
  }, 250);
}

/* ============================= main ============================= */
let W = null, D = null;
const diag = { fps: 60, substeps: 0, physMs: 0, rendMs: 0, lastContacts: 0, tris: 0, adaptScale: 1 };

const MAIN = {};
MAIN.rebuildCourse = function (announce) {
  W = worldBuild(P);
  FX.W = W;
  Race._gdata = null; Race._gdataKey = null; Race._gpts = null; Race._gptsKey = null;
  Race.reset(W, D);
  diag.tris = (W.meshTerrain.count + W.meshProps.count + W.meshPad.count) / 3 + W.gates.length * (W.meshGate.count / 3);
  Cam.trackIdx = -1; Cam.chaseInit = false;
  HUD.hintT = Math.max(HUD.hintT, 3);
  UI.updateStatuses();
  if (announce) UI.toast('Course rebuilt: ' + ENVS[P.env].label + ' · seed ' + P.seed + ' · ' + W.gates.length + ' gates', 'good');
};
MAIN.restartRun = function () {
  Race.finished = false; UI.hideResults();
  Race.reset(W, D);
  Cam.chaseInit = false;
  UI.updateStatuses();
};

const EVENTS = {
  crash(pos, res) {
    FX.burstSparks(pos, 30, 1.3);
    FX.burstDust(pos, 24, res.nx, res.ny, res.nz, 1.6);
    AU.thud(res.impact);
    Cam.addShake(1.1);
    Race.onCrash(P);
    UI.toast('CRASH' + (P.collisionPenalty && Race.lapActive ? ' — +1s penalty' : ''), 'err');
  },
  bump(pos, res) {
    FX.burstSparks(pos, 8, 0.6);
    FX.burstDust(pos, 10, res.nx, res.ny, res.nz, 0.8);
    AU.thud(res.impact * 0.45);
    Cam.addShake(0.4);
  },
  touch(pos) { FX.burstDust(pos, 3, 0, 1, 0, 0.35); },
  crashBounce(pos, imp) { if (imp > 3) { FX.burstDust(pos, 6, 0, 1, 0, 0.5); Cam.addShake(0.2); } },
};
Race.events = {
  gate(i, split, delta) {
    AU.gate();
    FX.gateFlash(W.gates[i], [0.35, 1, 0.55]);
  },
  lapStart(n) { UI.toast('LAP ' + n + ' — GO!', 'good', 1600); AU.beep(660, 0.1, 'sine', 0.25); },
  lapDone(t) {
    UI.toast('LAP ' + HUD.fmtTime(t) + (Race.lastLap && Race.lastLap.penalty ? ' (incl. +' + Race.lastLap.penalty.toFixed(1) + 's penalty)' : ''), 'good', 2800);
    AU.lap();
  },
  lapInvalid() { UI.toast('LAP NOT COUNTED — you missed a gate', 'err', 3200); AU.warn(); },
  newBest(t) { UI.toast('NEW BEST LAP ' + t.toFixed(2) + 's — ghost saved', 'good', 3600); AU.best(); },
  missed() { AU.warn(); },
  wrongWay() { AU.warn(); },
  penalty() { },
  trialDone(res) { UI.showResults(res); AU.lap(); },
};

Input.onAction = function (code, e) {
  AU.init(); AU.resume();
  if (UI.helpOpen) { UI.toggleHelp(false); return; }
  switch (code) {
    case 'KeyR': MAIN.restartRun(); UI.toast('Run restarted'); break;
    case 'Space':
      if (Race.lapActive) { droneRespawn(D); UI.toast('Recovered to last gate'); }
      else { dronePlaceAtSpawn(D, W); }
      break;
    case 'KeyC': Cam.cycle(1); break;
    case 'Digit1': Cam.setMode('fpv'); break;
    case 'Digit2': Cam.setMode('chase'); break;
    case 'Digit3': Cam.setMode('orbit'); break;
    case 'Digit4': Cam.setMode('trackside'); break;
    case 'KeyF': {
      const order = ['angle', 'horizon', 'acro'];
      P.flightMode = order[(order.indexOf(P.flightMode) + 1) % 3];
      UI.refresh(); settingsSave();
      UI.toast('Flight mode: ' + P.flightMode.toUpperCase());
      break;
    }
    case 'KeyG': P.ghostVisible = !P.ghostVisible; UI.refresh(); settingsSave(); break;
    case 'KeyH': UI.toggleHelp(); break;
    case 'KeyM': AU.muted = !AU.muted; UI.toast(AU.muted ? 'Audio muted' : 'Audio on'); break;
    case 'KeyP': MAIN.screenshot(); break;
    case 'KeyT':
      P.mode = P.mode === 'trial' ? 'free' : 'trial';
      UI.refresh(); settingsSave();
      MAIN.restartRun();
      UI.toast(P.mode === 'trial' ? 'Time trial — cross the start gate to begin' : 'Free flight — race timing off');
      break;
    case 'Tab': e.preventDefault(); UI.togglePanel(); break;
    case 'Escape': UI.togglePanel(false); UI.toggleHelp(false); break;
    case 'F3': e.preventDefault(); P.showDiag = !P.showDiag; UI.refresh(); settingsSave(); break;
    case 'F4': e.preventDefault(); P.showGraph = !P.showGraph; UI.refresh(); settingsSave(); break;
  }
};

MAIN.screenshot = function () {
  try {
    renderFrame(D.simTime, 0);
    HUD.draw(D.simTime, 0, diag);
    const c = document.createElement('canvas');
    c.width = G.canvas.width; c.height = G.canvas.height;
    const cx = c.getContext('2d');
    cx.drawImage(G.canvas, 0, 0);
    cx.drawImage(HUD.canvas, 0, 0, c.width, c.height);
    const a = document.createElement('a');
    a.href = c.toDataURL('image/png');
    a.download = 'fpv-drone-' + W.envId + '-' + W.seed + '-' + Date.now() + '.png';
    a.click();
    UI.toast('Screenshot saved (PNG)', 'good');
  } catch (err) {
    UI.toast('Screenshot failed: ' + err.message, 'err');
    console.error(err);
  }
};

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const scale = clamp((G.userScale || 1) * (diag.adaptScale || 1), 0.35, 1.3);
  const cw = Math.max(2, window.innerWidth), ch = Math.max(2, window.innerHeight);
  let bw = Math.round(cw * dpr * scale), bh = Math.round(ch * dpr * scale);
  const maxDim = 2200;
  if (Math.max(bw, bh) > maxDim) { const k = maxDim / Math.max(bw, bh); bw = Math.round(bw * k); bh = Math.round(bh * k); }
  G.canvas.width = bw; G.canvas.height = bh;
  G.width = bw; G.height = bh;
  G.dpr = dpr;
  HUD.resize();
}

/* ============================= frame loop ============================= */
const PHYS_H = 1 / 240;
let acc = 0, lastT = performance.now(), fpsAcc = 0, fpsN = 0, frameAvg = 16, adaptN = 0;

function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - lastT) / 1000;
  lastT = now;
  dt = clamp(dt, 0, 0.05);
  frameAvg = frameAvg * 0.92 + dt * 1000 * 0.08;
  fpsAcc += dt; fpsN++;

  const inp = Input.update(dt);
  const orb = Input.consumeOrbit();

  /* physics with fixed substeps */
  const t0 = performance.now();
  vcopy(D.prevPos, D.pos);
  acc += dt;
  let steps = 0;
  while (acc >= PHYS_H && steps < 12) { droneStep(D, W, P, inp, PHYS_H, EVENTS); acc -= PHYS_H; steps++; }
  if (steps >= 12) acc = 0;
  diag.substeps = steps;
  diag.physMs = diag.physMs * 0.9 + (performance.now() - t0) * 0.1;
  diag.lastContacts = D._res.contacts;
  D.propSpin = (D.propSpin || 0) + D.motorAvg * 52 * dt;

  /* crash recovery timer */
  if (D.crashed && D.crashT <= 0) { droneRespawn(D); UI.toast('Back on track — recover and fly!', null, 1500); }

  /* out-of-bounds recovery zone */
  if (Math.abs(D.pos[0]) > W.half + 25 || Math.abs(D.pos[2]) > W.half + 25) {
    dronePlaceAtSpawn(D, W);
    UI.toast('Left the course area — reset to start', 'err');
  }

  Race.update(D.simTime, dt, D, W, P);

  /* fx + audio */
  FX.update(dt);
  FX.propWash(D, null, D.motorAvg);
  AU.update(D, vlen(D.vel));

  Cam.update(dt, D, W, P, orb);

  /* adaptive resolution */
  if (P.adaptive) {
    adaptN++;
    if (adaptN >= 45) {
      adaptN = 0;
      if (frameAvg > 22 && diag.adaptScale > 0.45) { diag.adaptScale = Math.max(0.45, diag.adaptScale * 0.88); resize(); }
      else if (frameAvg < 12.5 && diag.adaptScale < 1) { diag.adaptScale = Math.min(1, diag.adaptScale * 1.05); resize(); }
    }
  } else if (diag.adaptScale !== 1) { diag.adaptScale = 1; resize(); }

  /* render + hud */
  const t1 = performance.now();
  renderFrame(D.simTime, dt);
  diag.rendMs = diag.rendMs * 0.9 + (performance.now() - t1) * 0.1;
  if (fpsAcc >= 0.5) { diag.fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; }
  HUD.pushGraph(D);
  HUD.draw(D.simTime, dt, diag);
}

/* ============================= boot ============================= */
function boot() {
  settingsLoad();
  const canvas = document.getElementById('glc');
  const gl = glInit(canvas);
  if (!gl) {
    document.getElementById('fail').hidden = false;
    document.getElementById('btn-panel').hidden = true;
    return;
  }
  G.progs.lit = makeProgram(gl, SHADERS.litVS, SHADERS.litFS, 'lit');
  G.progs.sky = makeProgram(gl, SHADERS.skyVS, SHADERS.skyFS, 'sky');
  G.progs.post = makeProgram(gl, SHADERS.postVS, SHADERS.postFS, 'post');
  G.progs.particle = makeProgram(gl, SHADERS.particleVS, SHADERS.particleFS, 'particle');
  G.progs.line = makeProgram(gl, SHADERS.lineVS, SHADERS.lineFS, 'line');
  G.progs.prop = makeProgram(gl, SHADERS.propVS, SHADERS.propFS, 'prop');
  G.progs.blob = makeProgram(gl, SHADERS.blobVS, SHADERS.blobFS, 'blob');
  renderInit(gl);
  FX.init(gl);
  HUD.init(document.getElementById('hud'));
  Input.init(canvas);
  Input.loadCalib();
  D = droneCreate();
  UI.init();
  MAIN.rebuildCourse();
  resize();
  UI.toggleHelp(true);
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 120));
  window.addEventListener('pointerdown', () => { AU.init(); AU.resume(); });
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    const f = document.getElementById('fail');
    f.hidden = false;
    document.getElementById('fail-msg').textContent = 'The WebGL context was lost (GPU reset). Reload the page to restart the simulator.';
  });
  requestAnimationFrame(frame);
}

boot();

/* read-only diagnostics hook for live inspection */
window.SIM = {
  get version() { return 'fpv-drone-racing v1'; },
  state() {
    const att = droneAttitude(D);
    return {
      pos: D.pos.slice(), vel: D.vel.slice(), speed: vlen(D.vel),
      q: D.q.slice(), wBody: D.w.slice(), ratesDeg: D.w.map(v => v / DEG),
      pitchDeg: att.pitch / DEG, rollDeg: att.roll / DEG, yawDeg: att.yaw / DEG,
      throttleIn: Input.out.throttle, inputSource: Input.out.source,
      motorAvg: D.motorAvg, battery: D.battery, voltage: D.voltage,
      crashed: D.crashed, onGround: D.onGround, collisions: D.collisionCount,
      simTime: D.simTime, fps: diag.fps, renderW: G.width, renderH: G.height,
      flightMode: P.flightMode, raceMode: P.mode, camera: Cam.mode,
      nextGate: Race.nextGate, gateCount: W.gates.length, lapCount: Race.lapCount,
      lapActive: Race.lapActive, lapElapsed: Race.lapActive ? D.simTime - Race.lapStart : 0,
      splits: Race.splits.slice(), best: Race.best ? Race.best.time : null,
      missed: Race.missed, penalty: Race.penalty, finished: Race.finished,
      courseKey: W.courseKey, seed: P.seed, env: P.env, diff: P.diff,
      gatePos: W.gates.map(g => g.c.slice()),
      altAGL: D.pos[1] - W.height(D.pos[0], D.pos[2]),
    };
  },
  course() { return { gates: W.gates.length, key: W.courseKey, spawn: W.spawn.pos.slice(), gatePos: W.gates.map(g => g.c.slice()), len: W.courseLen }; },
  rebuild() { MAIN.rebuildCourse(true); },
  restart() { MAIN.restartRun(); },
};
