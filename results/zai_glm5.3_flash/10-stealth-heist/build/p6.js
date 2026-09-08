
/* =====================================================================
   INPUT — keyboard (remappable), mouse aim, touch controls
   ===================================================================== */
function formatKey(code) {
  if (!code) return '—';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  const map = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', ShiftLeft: 'L-Shift', ShiftRight: 'R-Shift', ControlLeft: 'L-Ctrl', Escape: 'Esc', Enter: '⏎', Space: 'Space' };
  return map[code] || code;
}

const Input = {
  keys: new Set(), mouseX: 0, mouseY: 0, mouseDown: false, mouseRDown: false,
  joyX: 0, joyY: 0, joyActive: false, joyId: -1, joyOx: 0, joyOy: 0,
  tbRun: false, tbInteract: false, tbGadget: false, uiSlot: -1, useTouch: false,

  init() {
    window.addEventListener('keydown', e => this.onKey(e, true));
    window.addEventListener('keyup', e => this.onKey(e, false));
    window.addEventListener('blur', () => { this.releaseAll(); UI.autoPause(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) { this.releaseAll(); UI.autoPause(); } });
    const boot = () => { Sfx.init(); Sfx.resume(); };
    window.addEventListener('pointerdown', boot, { once: false });
    window.addEventListener('keydown', boot, { once: false });

    const cv = Render.cv;
    cv.addEventListener('pointerdown', e => this.onPtr(e, true));
    cv.addEventListener('pointermove', e => this.onPtr(e, false));
    cv.addEventListener('pointerup', e => this.onPtrUp(e));
    cv.addEventListener('pointercancel', e => this.onPtrUp(e));
    cv.addEventListener('pointerleave', e => { if (e.pointerType !== 'touch') { this.mouseDown = false; this.mouseRDown = false; } });
    cv.addEventListener('contextmenu', e => e.preventDefault());

    const press = (el, on, off) => {
      el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); on(); });
      el.addEventListener('pointerup', e => { e.preventDefault(); off && off(); });
      el.addEventListener('pointercancel', () => off && off());
      el.addEventListener('pointerleave', () => off && off());
    };
    press(document.getElementById('tbUse'), () => this.tbInteract = true, () => this.tbInteract = false);
    press(document.getElementById('tbGadget'), () => this.tbGadget = true, () => this.tbGadget = false);
    const run = document.getElementById('tbRun');
    run.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); this.tbRun = !this.tbRun; run.classList.toggle('on', this.tbRun); });
    document.getElementById('tbSlot').addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation();
      this.uiSlot = (((UI.sim ? UI.sim.player.sel : 0)) + 1) % 3;
    });
    this.evalTouch();
    window.addEventListener('resize', () => this.evalTouch());
  },
  evalTouch() {
    let coarse = false;
    try { coarse = matchMedia('(pointer: coarse)').matches; } catch (e) { }
    this.useTouch = Settings.touch === 'always' || (Settings.touch === 'auto' && (coarse || innerWidth < 760));
    document.getElementById('touchUI').classList.toggle('hidden', !this.useTouch || UI.mode !== 'play');
  },
  releaseAll() { this.keys.clear(); this.mouseDown = this.mouseRDown = false; this.tbInteract = this.tbGadget = false; this.joyX = this.joyY = 0; this.joyActive = false; document.getElementById('joy').style.display = 'none'; },
  onKey(e, down) {
    const code = e.code;
    if (UI.captureBind) {
      e.preventDefault();
      if (down && code !== 'Escape') UI.setBinding(UI.captureBind, code);
      else if (down) { UI.captureBind = null; UI.renderBinds(); }
      return;
    }
    if (UI.mode === 'play' && (Settings.allCodes().has(code) || ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(code))) e.preventDefault();
    if (down) this.keys.add(code); else this.keys.delete(code);
    if (down) UI.actionKey(code);
  },
  onPtr(e, down) {
    const rect = Render.cv.getBoundingClientRect();
    this.mouseX = e.clientX - rect.left; this.mouseY = e.clientY - rect.top;
    if (e.pointerType === 'touch') {
      if (down && !this.joyActive && e.clientX - rect.left < rect.width * 0.55 && UI.mode === 'play' && !UI.paused) {
        this.joyActive = true; this.joyId = e.pointerId;
        this.joyOx = e.clientX - rect.left; this.joyOy = e.clientY - rect.top;
        const j = document.getElementById('joy');
        j.style.display = 'block'; j.style.left = (this.joyOx - 55) + 'px'; j.style.top = (this.joyOy - 55) + 'px';
      }
      return;
    }
    if (e.button === 0) this.mouseDown = down;
    if (e.button === 2) this.mouseRDown = down;
  },
  onPtrUp(e) {
    if (e.pointerType === 'touch') {
      if (e.pointerId === this.joyId) {
        this.joyActive = false; this.joyId = -1; this.joyX = this.joyY = 0;
        document.getElementById('joy').style.display = 'none';
      }
      return;
    }
    if (e.button === 0) this.mouseDown = false;
    if (e.button === 2) this.mouseRDown = false;
  },
  onPtrMoveRaw(e) {
    if (e.pointerType === 'touch' && e.pointerId === this.joyId) {
      const rect = Render.cv.getBoundingClientRect();
      let dx = (e.clientX - rect.left - this.joyOx) / 44, dy = (e.clientY - rect.top - this.joyOy) / 44;
      const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
      this.joyX = Math.abs(dx) < 0.14 ? 0 : dx; this.joyY = Math.abs(dy) < 0.14 ? 0 : dy;
      const k = document.getElementById('joyKnob');
      k.style.transform = `translate(calc(-50% + ${this.joyX * 32}px), calc(-50% + ${this.joyY * 32}px))`;
    }
  },
  build() {
    const b = Settings.bindings;
    const has = a => { for (const c of b[a]) if (this.keys.has(c)) return true; return false; };
    const up = has('up') || this.joyY < -0.35, down = has('down') || this.joyY > 0.35;
    const left = has('left') || this.joyX < -0.35, right = has('right') || this.joyX > 0.35;
    let slot = -1;
    if (has('slot1')) slot = 0; else if (has('slot2')) slot = 1; else if (has('slot3')) slot = 2;
    else if (this.uiSlot >= 0) { slot = this.uiSlot; this.uiSlot = -1; }
    let aimX = null, aimY = null;
    if (!this.useTouch && UI.sim) {
      const w = Render.screenToWorld(UI.sim, this.mouseX, this.mouseY);
      aimX = Math.round(w.x); aimY = Math.round(w.y);
    }
    return {
      up, down, left, right,
      run: has('run') || this.tbRun,
      interact: has('interact') || this.mouseDown || this.tbInteract,
      gadget: has('gadget') || this.mouseRDown || this.tbGadget,
      slot, aimX, aimY, joyX: this.joyX, joyY: this.joyY,
    };
  }
};
Render.cv; // (initialized before Input.init in boot)

/* =====================================================================
   REPLAY — deterministic input recording/playback
   ===================================================================== */
class Recorder {
  constructor() { this.events = []; this.last = null; this.tick = 0; }
  snapshot(inp) {
    const m = (inp.up ? 1 : 0) | (inp.down ? 2 : 0) | (inp.left ? 4 : 0) | (inp.right ? 8 : 0) | (inp.run ? 16 : 0) | (inp.interact ? 32 : 0) | (inp.gadget ? 64 : 0);
    const ax = inp.aimX == null ? -1 : inp.aimX | 0, ay = inp.aimY == null ? -1 : inp.aimY | 0;
    const s = inp.slot | 0;
    const L = this.last;
    if (!L || L.m !== m || L.ax !== ax || L.ay !== ay || L.s !== s) { this.events.push({ t: this.tick, m, ax, ay, s }); this.last = { m, ax, ay, s }; }
    this.tick++;
  }
}
class ReplayPlayer {
  constructor(data) { this.ev = data.events || []; this.i = 0; this.st = { m: 0, ax: -1, ay: -1, s: -1 }; this.tick = 0; this.endTick = data.endTick || 0; }
  input() {
    while (this.i < this.ev.length && this.ev[this.i].t <= this.tick) { const e = this.ev[this.i++]; this.st = { m: e.m, ax: e.ax, ay: e.ay, s: e.s }; }
    this.tick++;
    const m = this.st.m;
    return {
      up: !!(m & 1), down: !!(m & 2), left: !(m & 4) ? false : true, right: !!(m & 8),
      run: !!(m & 16), interact: !!(m & 32), gadget: !!(m & 64),
      slot: this.st.s, aimX: this.st.ax < 0 ? null : this.st.ax, aimY: this.st.ay < 0 ? null : this.st.ay, joyX: 0, joyY: 0,
    };
  }
}

/* =====================================================================
   PERSISTENCE / SCORE
   ===================================================================== */
function scoreRun(sim) {
  let s = 600 + sim.player.intel * 300 + sim.player.val * 120 + Math.max(0, 480 - sim.time) * 1.2 - sim.detections * 100 - sim.alarmCount * 150;
  if (sim.detections === 0 && sim.alarmCount === 0) s += 150;
  s = Math.max(50, Math.round(s));
  const rank = s >= 1500 ? 'S' : s >= 1150 ? 'A' : s >= 850 ? 'B' : s >= 550 ? 'C' : 'D';
  return { score: s, rank };
}
function saveHistory(res, mission) {
  const h = Store.get('history', []);
  h.unshift({ preset: mission.preset, seed: mission.seed, diff: mission.diff, ...res });
  Store.set('history', h.slice(0, 30));
}
function parseSeed(s) {
  s = String(s).trim();
  if (!s) return null;
  let n;
  if (/^0x[0-9a-f]+$/i.test(s)) n = parseInt(s, 16);
  else if (/^\d+$/.test(s)) n = parseInt(s, 10);
  else n = hashStr(s);
  return (n >>> 0) || 1;
}
function randomSeed() { return Math.floor(Math.random() * 0xfffffff) + 1; }
function downloadJSON(obj, name) {
  try {
    const blob = new Blob([JSON.stringify(obj)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  } catch (e) { }
}

/* =====================================================================
   UI
   ===================================================================== */
const UI = {
  mode: 'menu', paused: false, replaying: false,
  sim: null, mission: null, replay: null, record: null, lastRun: null,
  captureBind: null, settingsReturn: 'screenMenu',
  els: {}, hudAcc: 0, lastObjStr: '', keyEmitted: {},

  $(id) { return document.getElementById(id); },
  init() {
    const ids = ['game', 'hud', 'status', 'statusA', 'statusB', 'objList', 'alertFill', 'alertLabel', 'gadgetBar', 'prompt', 'toasts', 'spotted', 'replayBanner', 'diagPanel',
      'screenMenu', 'presetList', 'seedInput', 'btnDice', 'diffList', 'btnStart', 'btnHelp', 'btnSettings', 'btnImport', 'briefName', 'briefDesc', 'menuMap', 'briefStats', 'briefObj', 'histWrap', 'histTable',
      'screenPause', 'btnResume', 'btnRestart', 'btnNewSeed', 'btnPauseSettings', 'btnPauseHelp', 'btnQuit',
      'screenEnd', 'endTitle', 'rankBadge', 'endStats', 'btnReplay', 'btnExportRun', 'btnRetry', 'btnNext', 'btnMenu2', 'endHint',
      'screenHelp', 'helpTable', 'btnHelpClose', 'screenSettings', 'volMaster', 'volMasterOut', 'volFx', 'volFxOut', 'setReduced', 'setStatusHud', 'touchSeg', 'bindList', 'btnBindReset', 'btnSettingsClose',
      'screenImport', 'impText', 'btnImpLoadRun', 'btnImpLoadMission', 'impFile', 'btnImpCancel', 'impMsg'];
    for (const id of ids) this.els[id] = this.$(id);
    document.addEventListener('pointermove', e => Input.onPtrMoveRaw(e));

    /* menu segments */
    for (const pk in PRESETS) {
      const b = document.createElement('button');
      b.className = 'btn ghost'; b.textContent = PRESETS[pk].name; b.dataset.k = pk;
      b.onclick = () => { this.presetSel = pk; Sfx.ui(); this.updateBriefing(); };
      this.els.presetList.appendChild(b);
    }
    for (const dk in DIFFS) {
      const b = document.createElement('button');
      b.className = 'btn ghost'; b.textContent = DIFFS[dk].name; b.dataset.k = dk;
      b.onclick = () => { this.diffSel = dk; Sfx.ui(); this.updateBriefing(); };
      this.els.diffList.appendChild(b);
    }
    this.presetSel = Store.get('lastPreset', 'compact');
    this.diffSel = Store.get('lastDiff', 'operative');
    this.els.seedInput.value = Store.get('lastSeed', 1337);

    /* buttons */
    this.els.btnDice.onclick = () => { this.els.seedInput.value = randomSeed(); Sfx.ui(); this.updateBriefing(); };
    this.els.seedInput.oninput = () => this.updateBriefing();
    this.els.btnStart.onclick = () => this.startMission(false);
    this.els.btnHelp.onclick = () => { this.settingsReturn = 'screenMenu'; this.showHelp(); };
    this.els.btnSettings.onclick = () => { this.settingsReturn = 'screenMenu'; this.showScreen('screenSettings'); };
    this.els.btnImport.onclick = () => { this.showScreen('screenImport'); this.els.impMsg.textContent = ''; };
    this.els.btnResume.onclick = () => this.togglePause(false);
    this.els.btnRestart.onclick = () => { Sfx.ui(); this.restart(); };
    this.els.btnNewSeed.onclick = () => { Sfx.ui(); this.els.seedInput.value = randomSeed(); this.startMissionFromSeed(parseSeed(this.els.seedInput.value)); };
    this.els.btnPauseSettings.onclick = () => { this.settingsReturn = 'screenPause'; this.showScreen('screenSettings'); };
    this.els.btnPauseHelp.onclick = () => { this.settingsReturn = 'screenPause'; this.showHelp(); };
    this.els.btnQuit.onclick = () => { Sfx.alarmOff(); this.toMenu(); };
    this.els.btnRetry.onclick = () => { Sfx.ui(); this.startMissionFromSeed(this.lastMissionParams()); };
    this.els.btnNext.onclick = () => { Sfx.ui(); this.els.seedInput.value = randomSeed(); this.startMissionFromSeed(parseSeed(this.els.seedInput.value)); };
    this.els.btnMenu2.onclick = () => this.toMenu();
    this.els.btnReplay.onclick = () => { if (this.lastRun) this.startReplay(this.lastRun); };
    this.els.btnExportRun.onclick = () => {
      if (!this.lastRun) return;
      downloadJSON(this.lastRun, `shadow-protocol-run-${this.lastRun.seed}.json`);
      this.els.endHint.textContent = 'Run exported — import it later to watch the replay.';
    };
    this.els.btnHelpClose.onclick = () => this.showScreen(this.settingsReturn);
    this.els.btnSettingsClose.onclick = () => { Settings.save(); this.showScreen(this.settingsReturn); if (this.settingsReturn === 'screenPause') this.showScreen('screenPause'); };
    this.els.btnBindReset.onclick = () => { Settings.bindings = JSON.parse(JSON.stringify(DEFAULT_BINDINGS)); Settings.save(); this.renderBinds(); this.renderHelp(); };
    this.els.btnImpCancel.onclick = () => this.toMenu();
    this.els.btnImpLoadRun.onclick = () => this.importJSON('run');
    this.els.btnImpLoadMission.onclick = () => this.importJSON('mission');
    this.els.impFile.onchange = e => {
      const f = e.target.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = () => { this.els.impText.value = r.result; };
      r.readAsText(f);
    };

    /* settings widgets */
    this.els.volMaster.value = Settings.master * 100; this.els.volMasterOut.textContent = Math.round(Settings.master * 100);
    this.els.volFx.value = Settings.fx * 100; this.els.volFxOut.textContent = Math.round(Settings.fx * 100);
    this.els.volMaster.oninput = e => { Settings.master = e.target.value / 100; this.els.volMasterOut.textContent = e.target.value; Sfx.setVols(); Settings.save(); };
    this.els.volFx.oninput = e => { Settings.fx = e.target.value / 100; this.els.volFxOut.textContent = e.target.value; Sfx.setVols(); Settings.save(); };
    this.els.setReduced.checked = Settings.reduced;
    this.els.setReduced.onchange = e => { Settings.reduced = e.target.checked; document.body.classList.toggle('reduced', Settings.reduced); Settings.save(); };
    document.body.classList.toggle('reduced', Settings.reduced);
    this.els.setStatusHud.checked = Settings.statusHud;
    this.els.setStatusHud.onchange = e => { Settings.statusHud = e.target.checked; Settings.save(); };
    for (const [label, val] of [['AUTO', 'auto'], ['ALWAYS', 'always'], ['OFF', 'off']]) {
      const b = document.createElement('button');
      b.className = 'btn ghost'; b.textContent = label; b.dataset.v = val;
      b.onclick = () => { Settings.touch = val; Settings.save(); this.renderTouchSeg(); Input.evalTouch(); };
      this.els.touchSeg.appendChild(b);
    }
    this.renderTouchSeg();
    this.renderBinds();
    this.renderHelp();
    this.renderHistory();

    /* diagnostics */
    const dmap = { d_nav: 'nav', d_state: 'state', d_rays: 'rays', d_sound: 'sound', d_lkp: 'lkp', d_coll: 'coll', d_frame: 'frame', d_light: 'light' };
    for (const id in dmap) this.$(id).onchange = e => { Render.diag[dmap[id]] = e.target.checked; };
    this.updateBriefing();
  },

  presetSel: 'compact', diffSel: 'operative',

  showScreen(id) {
    for (const s of ['screenMenu', 'screenPause', 'screenEnd', 'screenHelp', 'screenSettings', 'screenImport']) this.els[s].classList.add('hidden');
    if (id) { this.els[id].classList.remove('hidden'); Render.diagShown = false; }
    this.els.diagPanel.classList.toggle('hidden', !Render.diagShown);
  },
  toggleDiag() {
    Render.diagShown = !Render.diagShown;
    this.els.diagPanel.classList.toggle('hidden', !Render.diagShown);
  },
  toMenu() {
    this.mode = 'menu'; this.paused = false; this.replaying = false; this.sim = null;
    this.els.hud.classList.add('hidden');
    Input.evalTouch();
    this.showScreen('screenMenu');
    this.updateBriefing(); this.renderHistory();
    Sfx.alarmOff();
  },
  autoPause() { if (this.mode === 'play' && !this.paused && !this.replaying) this.togglePause(true); },
  togglePause(on) {
    if (this.mode !== 'play') return;
    this.paused = on === undefined ? !this.paused : on;
    if (this.paused) { this.showScreen('screenPause'); Input.releaseAll(); }
    else this.showScreen(null);
  },
  lastMissionParams() {
    const m = this.lastRun && this.lastRun.result && !this.replaying ? this.lastRun : this.mission || { preset: this.presetSel, seed: parseSeed(this.els.seedInput.value) || 1337, diff: this.diffSel };
    return m;
  },
  startMissionFromSeed(params) {
    const seed = (params && params.seed) || 1337;
    this.els.seedInput.value = seed;
    try {
      const m = genMission(this.presetSel, seed, this.diffSel);
      this.startMissionCore(m, false);
    } catch (e) { this.toastMsg('Generation failed: ' + e.message, 'bad'); }
  },
  startMission(usePreview) {
    const seed = parseSeed(this.els.seedInput.value) || 1337;
    Store.set('lastPreset', this.presetSel); Store.set('lastDiff', this.diffSel); Store.set('lastSeed', seed);
    try {
      const m = genMission(this.presetSel, seed, this.diffSel);
      this.startMissionCore(m, false);
    } catch (e) { this.toastMsg('Generation failed: ' + e.message, 'bad'); }
  },
  startMissionCore(mission, replayData) {
    this.mission = mission;
    this.sim = createSim(mission);
    this.replaying = !!replayData;
    if (replayData) this.replay = new ReplayPlayer(replayData);
    else { this.replay = null; this.record = new Recorder(); }
    this.mode = 'play'; this.paused = false; this.lastRun = null;
    this.showScreen(null);
    this.els.hud.classList.remove('hidden');
    this.els.replayBanner.classList.toggle('hidden', !this.replaying);
    this.els.spotted.classList.add('hidden');
    this.buildGadgetBar();
    this.lastObjStr = '';
    this.toastMsg(mission.codename + ' — ' + mission.name + ' · find the intel, reach EXFIL', '');
    Sfx.init(); Sfx.resume(); Sfx.start();
    Input.evalTouch();
    Render.cam.init = false;
  },
  startReplay(runData) {
    try {
      const m = genMission(runData.preset, runData.seed, runData.diff);
      this.startMissionCore(m, runData);
    } catch (e) { this.toastMsg('Replay failed: ' + e.message, 'bad'); }
  },
  restart() {
    if (!this.mission) return;
    const m = genMission(this.mission.preset, this.mission.seed, this.mission.diff);
    this.startMissionCore(m, null);
  },
  stepOnce() {
    if (!this.sim) return;
    let inp;
    if (this.replaying) inp = this.replay.input();
    else {
      inp = Input.build();
      if (this.record) this.record.snapshot(inp);
    }
    simTick(this.sim, STEP, inp);
    if (this.sim.state !== 'play') this.endRun();
    else if (this.replaying && this.replay.tick > this.replay.endTick + 40) this.endRun(true);
  },
  endRun(stopped) {
    if (this.mode !== 'play') return;
    const sim = this.sim;
    this.mode = 'end';
    this.els.hud.classList.add('hidden');
    Input.evalTouch();
    const won = sim.state === 'won';
    const sc = won ? scoreRun(sim) : { score: 0, rank: '—' };
    if (!this.replaying && !stopped) {
      this.lastRun = {
        kind: 'heist-run', v: 1, preset: sim.m.preset, seed: sim.m.seed, diff: sim.m.diff,
        events: this.record.events, endTick: this.record.tick,
        result: { state: sim.state, time: +sim.time.toFixed(1), intel: sim.player.intel, intelTotal: sim.m.intelTotal, val: sim.player.val, valTotal: sim.m.valTotal, detections: sim.detections, alarms: sim.alarmCount, score: sc.score, rank: sc.rank },
      };
      saveHistory(this.lastRun.result, sim.m);
    }
    this.els.endTitle.textContent = this.replaying ? ('REPLAY — ' + (won ? 'COMPLETE' : 'CAPTURED')) : won ? 'MISSION COMPLETE' : 'CAUGHT';
    this.els.endTitle.style.color = won ? 'var(--ok)' : 'var(--bad)';
    this.els.rankBadge.textContent = sc.rank;
    this.els.rankBadge.style.borderColor = won ? 'var(--acc)' : 'var(--bad)';
    this.els.rankBadge.style.color = won ? 'var(--acc)' : 'var(--bad)';
    const rows = [
      ['OUTCOME', won ? 'EXFILTRATED' : 'CAPTURED BY PATROL ' + (sim.caughtBy + 1)],
      ['TIME', fmtTime(sim.time)],
      ['INTEL', sim.player.intel + ' / ' + sim.m.intelTotal],
      ['VALUABLES (OPT.)', sim.player.val + ' / ' + sim.m.valTotal],
      ['DETECTIONS', sim.detections],
      ['ALARMS', sim.alarmCount],
      ['SCORE', won ? sc.score : '—'],
    ];
    this.els.endStats.innerHTML = rows.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('');
    this.els.btnReplay.classList.toggle('hidden', !this.lastRun);
    this.els.btnExportRun.classList.toggle('hidden', !this.lastRun);
    this.els.endHint.textContent = this.lastRun ? 'Seed ' + fmtSeed(sim.m.seed) + ' · the replay is deterministic input playback.' : '';
    this.showScreen('screenEnd');
    this.replaying = false;
    this.els.replayBanner.classList.add('hidden');
  },
  actionKey(code) {
    const b = Settings.bindings;
    if (b.pause.includes(code) && this.mode === 'play') this.togglePause();
    else if (b.help.includes(code)) {
      if (this.mode === 'play') this.togglePause(true);
      this.settingsReturn = this.mode === 'play' ? 'screenPause' : 'screenMenu';
      this.showHelp();
    }
    else if (b.diag.includes(code)) this.toggleDiag();
  },

  /* ---------- briefing ---------- */
  updateBriefing() {
    const seed = parseSeed(this.els.seedInput.value) || 1337;
    for (const b of this.els.presetList.children) b.classList.toggle('on', b.dataset.k === this.presetSel);
    for (const b of this.els.diffList.children) b.classList.toggle('on', b.dataset.k === this.diffSel);
    const P = PRESETS[this.presetSel], D = DIFFS[this.diffSel];
    this.els.briefName.textContent = 'OPERATION ' + (P.name) + ' · ' + D.name;
    this.els.briefDesc.textContent = P.desc + ' Difficulty alters guard count, vision, reaction speed and your tool charges.';
    let m;
    try { m = genMission(this.presetSel, seed, this.diffSel); }
    catch (e) { this.els.briefStats.textContent = 'GENERATION FAILED: ' + e.message; return; }
    this.mission = m;
    const locked = m.doors.filter(d => d.locked).length;
    this.els.briefStats.textContent =
      `GUARDS ${m.guards.length} · CAMERAS ${m.cameras.length} · LOCKED DOORS ${locked}\n` +
      `ROOMS ${m.rooms.length} · TERMINALS ${m.terminals.length} · SIZE ${m.W}×${m.H}`;
    this.els.briefObj.innerHTML =
      `<div style="color:var(--acc)">◆ INTEL ×${m.intelTotal} — required</div>` +
      `<div style="color:var(--dim)">◇ VALUABLES ×${m.valTotal} — optional bonus</div>` +
      `<div style="color:var(--ok)">▶ REACH EXTRACTION</div>`;
    /* preview map */
    const cv = this.els.menuMap, ctx = cv.getContext('2d');
    const s = Math.min(cv.width / m.W, cv.height / m.H);
    ctx.fillStyle = '#070b14'; ctx.fillRect(0, 0, cv.width, cv.height);
    const ox = (cv.width - m.W * s) / 2, oy = (cv.height - m.H * s) / 2;
    ctx.fillStyle = '#1a2438';
    for (let i = 0; i < m.W * m.H; i++) if (m.grid[i] === 1) ctx.fillRect(ox + (i % m.W) * s, oy + ((i / m.W) | 0) * s, s, s);
    for (const r of m.rooms) if (m.restricted.has(r.id)) { ctx.fillStyle = 'rgba(255,80,80,0.22)'; ctx.fillRect(ox + r.x * s, oy + r.y * s, r.w * s, r.h * s); }
    ctx.strokeStyle = 'rgba(89,224,255,0.35)';
    for (const g of m.guards) {
      ctx.beginPath();
      g.route.forEach((p, i) => { const x = ox + (p.tx + 0.5) * s, y = oy + (p.ty + 0.5) * s; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      ctx.closePath(); ctx.stroke();
    }
    for (const L of m.loot) { ctx.fillStyle = L.type === 'intel' ? '#ffd75e' : '#59e0ff'; ctx.fillRect(ox + L.tx * s - 1.5, oy + L.ty * s - 1.5, 3, 3); }
    for (const T of m.terminals) { ctx.fillStyle = '#59e0ff'; ctx.fillRect(ox + T.tx * s - 1.5, oy + T.ty * s - 1.5, 3, 3); }
    for (const d of m.doors) if (d.locked) { ctx.fillStyle = '#ff5d5d'; ctx.fillRect(ox + (d.tx | 0) * s - 1, oy + (d.ty | 0) * s - 1, 3, 3); }
    ctx.fillStyle = '#6fe3a0'; ctx.fillRect(ox + m.extract.tx * s - 2.5, oy + m.extract.ty * s - 2.5, 5, 5);
    ctx.strokeStyle = '#6fe3a0'; ctx.strokeRect(ox + m.extract.tx * s - 3.5, oy + m.extract.ty * s - 3.5, 7, 7);
    ctx.fillStyle = '#59a0ff'; ctx.fillRect(ox + m.entry.tx * s - 2.5, oy + m.entry.ty * s - 2.5, 5, 5);
  },
  renderHistory() {
    const h = Store.get('history', []);
    this.els.histWrap.classList.toggle('hidden', !h.length);
    if (!h.length) return;
    let best = 0;
    for (const r of h) if (r.score > best) best = r.score;
    this.els.histTable.innerHTML = '<tr><th>RESULT</th><th>MISSION</th><th>SEED</th><th>DIFF</th><th>TIME</th><th>LOOT</th><th>DET</th><th>ALM</th><th>SCORE</th></tr>' +
      h.slice(0, 8).map((r, i) => `<tr class="${r.score === best && best > 0 ? 'best' : ''}" data-i="${i}" style="cursor:pointer"><td>${r.state === 'won' ? r.rank : '✗'}</td><td>${PRESETS[r.preset] ? PRESETS[r.preset].name : r.preset}</td><td>${fmtSeed(r.seed)}</td><td>${DIFFS[r.diff] ? DIFFS[r.diff].name : r.diff}</td><td>${fmtTime(r.time)}</td><td>${r.intel}/${r.intelTotal}+${r.val}</td><td>${r.detections}</td><td>${r.alarms}</td><td>${r.score}</td></tr>`).join('');
    for (const tr of this.els.histTable.querySelectorAll('tr[data-i]')) {
      tr.onclick = () => {
        const r = h[parseInt(tr.dataset.i)];
        this.presetSel = r.preset; this.diffSel = r.diff;
        this.els.seedInput.value = r.seed;
        this.updateBriefing();
      };
    }
  },

  /* ---------- help / settings ---------- */
  showHelp() { this.renderHelp(); this.showScreen('screenHelp'); },
  renderHelp() {
    const rows = [];
    for (const k in BIND_LABELS) rows.push(`<tr><td>${BIND_LABELS[k]}</td><td>${Settings.bindings[k].map(formatKey).map(k => `<span class="keycap">${k}</span>`).join('')}</td></tr>`);
    rows.push(`<tr><td>Aim / throw tool</td><td><span class="keycap">MOUSE</span> aim · <span class="keycap">LMB</span> use · <span class="keycap">RMB</span> throw tool</td></tr>`);
    rows.push(`<tr><td>Touch</td><td>left half = joystick · USE / TOOL / RUN / SWAP buttons</td></tr>`);
    this.els.helpTable.innerHTML = rows.join('');
  },
  renderTouchSeg() {
    for (const b of this.els.touchSeg.children) b.classList.toggle('on', b.dataset.v === Settings.touch);
  },
  renderBinds() {
    const list = ['up', 'down', 'left', 'right', 'run', 'interact', 'gadget', 'slot1', 'slot2', 'slot3', 'pause', 'help', 'diag'];
    this.els.bindList.innerHTML = '';
    for (const a of list) {
      const row = document.createElement('div'); row.className = 'bindRow';
      row.innerHTML = `<span>${BIND_LABELS[a]}</span>`;
      const btn = document.createElement('button');
      btn.className = 'btn ghost cap keycap'; btn.textContent = formatKey(Settings.bindings[a][0]);
      btn.onclick = () => {
        this.captureBind = a; btn.textContent = 'PRESS…'; btn.classList.add('listen');
      };
      row.appendChild(btn);
      this.els.bindList.appendChild(row);
    }
  },
  setBinding(action, code) {
    Settings.bindings[action] = [code];
    Settings.save();
    this.captureBind = null;
    this.renderBinds(); this.renderHelp();
    this.toastMsg('BOUND ' + action.toUpperCase() + ' → ' + formatKey(code), 'good');
  },

  /* ---------- import/export ---------- */
  importJSON(kind) {
    let data = null;
    try { data = JSON.parse(this.els.impText.value); }
    catch (e) { this.els.impMsg.textContent = 'INVALID JSON: ' + e.message; return; }
    if (!data || (data.kind !== 'heist-run' && data.kind !== 'heist-mission')) { this.els.impMsg.textContent = 'Not a Shadow Protocol file (missing kind).'; return; }
    if (data.kind === 'heist-run' && kind === 'run') {
      this.presetSel = PRESETS[data.preset] ? data.preset : 'compact';
      this.diffSel = DIFFS[data.diff] ? data.diff : 'operative';
      this.els.seedInput.value = data.seed;
      try {
        const m = genMission(this.presetSel, data.seed >>> 0, this.diffSel);
        this.startMissionCore(m, data);
        this.toastMsg('REPLAY LOADED — watching recorded run', '');
      } catch (e) { this.els.impMsg.textContent = 'Load failed: ' + e.message; }
    } else if (data.kind === 'heist-mission') {
      this.presetSel = PRESETS[data.preset] ? data.preset : 'compact';
      this.diffSel = DIFFS[data.diff] ? data.diff : 'operative';
      this.els.seedInput.value = data.seed;
      this.toMenu();
      this.toastMsg('Mission parameters loaded', 'good');
    } else this.els.impMsg.textContent = 'File kind (' + data.kind + ') does not match requested load mode.';
  },

  /* ---------- HUD ---------- */
  buildGadgetBar() {
    const p = this.sim.player;
    this.els.gadgetBar.innerHTML = '';
    GADGETS.forEach((g, i) => {
      const d = document.createElement('div');
      d.className = 'slot'; d.id = 'slot' + i;
      d.innerHTML = `<span class="ic">${g.icon}</span><span class="nm">${g.name}</span><span class="ct"></span><span class="cd"></span><span class="key">${i + 1}</span>`;
      d.onclick = () => { Input.uiSlot = i; };
      this.els.gadgetBar.appendChild(d);
    });
  },
  hud(dt) {
    if (this.mode !== 'play') return;
    const sim = this.sim, p = sim.player;
    this.hudAcc += dt;
    /* prompt (every frame) */
    const tgt = p.target;
    let prompt = '';
    const key = formatKey(Settings.bindings.interact[0]);
    if (tgt) {
      if (tgt.type === 'loot') prompt = `<b>${key}</b> — ${tgt.o.type === 'intel' ? 'TAKE INTEL' : 'POCKET VALUABLE'}`;
      else if (tgt.type === 'term') prompt = `HOLD <b>${key}</b> — HACK TERMINAL`;
      else if (tgt.type === 'door') {
        const dr = tgt.o, elecOpen = dr.elec && (dr.empT > 0 || sim.sysOffline);
        prompt = dr.locked && !elecOpen ? `HOLD <b>${key}</b> — PICK LOCK${dr.elec ? ' (ELECTRONIC)' : ''}` : `<b>${key}</b> — ${dr.open > 0.5 ? 'CLOSE' : 'OPEN'} DOOR`;
      } else if (tgt.type === 'extract') {
        prompt = p.intel >= sim.m.intelTotal ? `HOLD <b>${key}</b> — EXFILTRATE` : `EXTRACTION NEEDS INTEL (${p.intel}/${sim.m.intelTotal})`;
      }
    }
    if (prompt) { this.els.prompt.innerHTML = prompt; this.els.prompt.classList.remove('hidden'); }
    else this.els.prompt.classList.add('hidden');
    /* toasts */
    while (sim.toasts.length) {
      const t = sim.toasts.shift();
      const div = document.createElement('div');
      div.className = 'toast ' + (t.cls || '');
      div.textContent = t.msg;
      this.els.toasts.appendChild(div);
      setTimeout(() => { div.style.opacity = '0'; div.style.transition = 'opacity .4s'; setTimeout(() => div.remove(), 450); }, 2400);
    }
    /* spotted */
    this.els.spotted.classList.toggle('hidden', sim.spottedT <= 0);
    this.els.replayBanner.classList.toggle('hidden', !this.replaying);
    if (this.hudAcc < 0.12) return;
    this.hudAcc = 0;
    /* status */
    this.els.status.classList.toggle('hidden', Settings.statusHud);
    let cnt = { P: 0, S: 0, I: 0, A: 0 };
    for (const g of sim.guards) {
      if (g.state === 'ALERT') cnt.A++;
      else if (g.state === 'SUSPICIOUS') cnt.S++;
      else if (g.state === 'INVESTIGATE' || g.state === 'LOOK' || g.state === 'SEARCH') cnt.I++;
      else cnt.P++;
    }
    const alertLabel = sim.alert >= 3 ? 'ALARM' : sim.alert >= 2 ? 'ALERT' : sim.alert >= 1.5 ? 'SEARCHING' : sim.alert >= 0.8 ? 'WARY' : 'CALM';
    const noiseBar = '▁▂▃▄▅▆▇'[Math.round(clamp(p.noise, 0, 1) * 6)];
    const slot = p.gadgets[p.sel];
    this.els.statusA.textContent = `FPS ${Render.fps | 0} · SEED ${fmtSeed(sim.m.seed)} · T ${fmtTime(sim.time)} · ${this.paused ? '⏸ PAUSED' : this.replaying ? '▶ REPLAY' : '● LIVE'}${sim.sysOffline ? ' · GRID OFFLINE' : ''}`;
    this.els.statusB.textContent = `ALERT ${alertLabel} · INTEL ${p.intel}/${sim.m.intelTotal} · VAL ${p.val} · G ${cnt.P}P ${cnt.S}S ${cnt.I}I ${cnt.A}A · NOISE ${noiseBar} · ${GADGETS[p.sel].icon}×${slot.count}`;
    /* objectives */
    const objStr = `${p.intel}|${sim.m.intelTotal}|${p.val}|${sim.m.valTotal}`;
    if (objStr !== this.lastObjStr) {
      this.lastObjStr = objStr;
      const ready = p.intel >= sim.m.intelTotal;
      this.els.objList.innerHTML =
        `<div class="main${p.intel >= sim.m.intelTotal ? ' done' : ''}">◆ INTEL ${p.intel}/${sim.m.intelTotal}</div>` +
        `<div class="opt">◇ VALUABLES ${p.val}/${sim.m.valTotal} (optional)</div>` +
        `<div class="${ready ? 'done' : 'main'}">▶ ${ready ? 'EXFIL READY — GET OUT' : 'REACH EXTRACTION'}</div>`;
    }
    /* alert bar */
    let maxSus = 0;
    for (const g of sim.guards) maxSus = Math.max(maxSus, g.state === 'ALERT' ? 1 : g.sus);
    for (const c of sim.cameras) maxSus = Math.max(maxSus, c.sus);
    const fill = sim.alarmT > 0 ? 1 : maxSus;
    this.els.alertFill.style.width = (fill * 100).toFixed(0) + '%';
    this.els.alertFill.style.background = sim.alarmT > 0 || sim.alert >= 2 ? 'var(--bad)' : sim.alert >= 0.8 ? 'var(--warn)' : 'var(--ok)';
    this.els.alertLabel.textContent = alertLabel;
    /* gadget slots */
    GADGETS.forEach((g, i) => {
      const el = this.$('slot' + i); if (!el) return;
      const st = p.gadgets[i];
      el.classList.toggle('active', p.sel === i);
      el.classList.toggle('empty', st.count <= 0);
      el.querySelector('.ct').textContent = '×' + st.count;
      el.querySelector('.cd').style.setProperty('--cd', st.cd > 0 ? ((st.cd / g.cd) * 100).toFixed(0) + '%' : '0%');
    });
  },
  toastMsg(msg, cls) {
    const div = document.createElement('div');
    div.className = 'toast ' + (cls || '');
    div.textContent = msg;
    this.els.toasts.appendChild(div);
    setTimeout(() => { div.style.opacity = '0'; div.style.transition = 'opacity .4s'; setTimeout(() => div.remove(), 450); }, 2600);
  },
};

/* =====================================================================
   MAIN LOOP + BOOT
   ===================================================================== */
let lastFrame = 0, acc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - lastFrame) / 1000 || 0.016);
  lastFrame = now;
  if (UI.mode === 'play' && !UI.paused) {
    acc += dt;
    let n = 0;
    while (acc >= STEP && n < 6) { UI.stepOnce(); acc -= STEP; n++; }
    if (n >= 6) acc = 0;
  } else acc = 0;
  Render.render(UI.sim, dt, Settings.reduced);
  UI.hud(dt);
}

/* expose core for headless tests + console diagnostics */
if (typeof globalThis !== 'undefined') {
  globalThis.HEIST_CORE = { RNG, genMission, createSim, simTick, castRay, findPath, lineOfSight, occlusion, PRESETS, DIFFS, GADGETS, STEP, idx, TILE };
}
if (IS_BROWSER) {
  window.HEIST_DEBUG = {
    get sim() { return UI.sim; }, UI, Render, Input, Settings, Store,
    genMission, createSim, simTick,
  };
  Settings.load();
  Render.init();
  UI.init();
  Input.init();
  UI.showScreen('screenMenu');
  requestAnimationFrame(frame);
}
