/* ============================================================================
   APPLICATION — boot, fixed-step loop, event wiring, diagnostics surface.
   ========================================================================== */
class App {
  constructor() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, loadSettings() || {});
    this.errors = [];
    this.toastEls = [];
    this.acc = 0; this.time = 0; this.simTime = 0;
    this.frame = 0; this.fps = 0; this.frameMs = 0; this.frameMsAvg = 16;
    this.timing = { sim: 0, render: 0, hud: 0, total: 0 };
    this.paused = false; this.launched = false; this.ready = false;
    this.adaptiveScale = 1;
    this.oob = 0; this.oobTimer = 0;
    this.events = [];
    this.ghost = { visible: false, pos: V3.new(), quat: Q.new(), active: false };
    this.prevPos = V3.new();
    this.captureRequest = null;
    this.lastDust = 0;
    this.orbitDrag = false;
    this._statAcc = 0; this._teleAcc = 0; this._uiAcc = 0;
  }

  /* ------------------------------------------------------------ booting */
  boot() {
    const glCanvas = document.getElementById('gl');
    this.hudCanvas = document.getElementById('hud');
    this.glc = new GLContext(glCanvas, {});
    if (!this.glc.ok) {
      const f = document.getElementById('fatal');
      f.classList.add('on');
      document.getElementById('fatalMsg').textContent =
        this.glc.fatal || 'This browser did not provide a WebGL2 or WebGL1 rendering context, so the simulator cannot start.';
      document.getElementById('fatalDetail').textContent =
        'Diagnostics: ' + (this.glc.diag.attempts.join(' | ') || 'getContext returned null for webgl2, webgl and experimental-webgl.');
      document.getElementById('startOverlay').classList.add('hidden');
      return false;
    }
    try {
      this.renderer = new Renderer(this.glc);
    } catch (e) {
      const f = document.getElementById('fatal');
      f.classList.add('on');
      document.getElementById('fatalMsg').textContent = 'WebGL started but the shaders could not be compiled on this driver.';
      document.getElementById('fatalDetail').textContent = String(e && e.message || e).slice(0, 900);
      document.getElementById('startOverlay').classList.add('hidden');
      this.errors.push(String(e && e.message || e));
      return false;
    }
    this.hud = new Hud(this.hudCanvas);
    this.telemetry = new TelemetryGraph(document.getElementById('telegraph'));
    this.camera = new CameraRig();
    this.audio = new AudioEngine();
    this.input = new InputSystem();
    this.input.attach();
    this.drone = new Drone(this.flightParams());
    this.ui = new SettingsUI(this);

    /* the software rasteriser cannot carry the default preset */
    if (this.glc.software && !loadSettings()) {
      this.settings.quality = 'low';
      this.settings.renderScale = 0.7;
    }

    this.rebuildCourse(true);
    this.applyAllSettings();
    this.wireDom();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 120));
    this.watchDpr();
    window.addEventListener('error', e => this.noteError(e.message + ' @' + (e.filename || '') + ':' + (e.lineno || 0)));
    window.addEventListener('unhandledrejection', e => this.noteError('unhandled rejection: ' + (e.reason && e.reason.message || e.reason)));
    glCanvas.addEventListener('webglcontextlost', e => { e.preventDefault(); this.noteError('WebGL context lost'); this.paused = true; });
    /* browsers can suspend the context later (tab switch, policy); the first
       real interaction after that resumes it */
    const resumeAudio = () => { if (this.audio.ready) this.audio.resume(); };
    for (const evt of ['pointerdown', 'keydown', 'touchstart'])
      window.addEventListener(evt, resumeAudio, { passive: true });
    this.ui.build();
    this.ready = true;
    this.last = performance.now();
    requestAnimationFrame(t => this.loop(t));
    return true;
  }

  flightParams() {
    const s = this.settings;
    return {
      mass: s.mass, twr: s.twr, gravity: s.gravity, dragScale: s.dragScale,
      rateRoll: s.rateRoll, ratePitch: s.ratePitch, rateYaw: s.rateYaw,
      expo: s.expo, throttleExpo: s.throttleExpo, angleMax: s.angleMax,
      autoLevel: s.autoLevel, altHold: s.altHold, antiCrash: s.antiCrash,
      collisionForgiveness: s.collisionForgiveness, motorTau: s.motorTau, batteryDrain: s.batteryDrain
    };
  }

  /* ------------------------------------------------------------- course */
  rebuildCourse(initial) {
    const s = this.settings;
    const t0 = performance.now();
    this.course = generateCourse({
      env: s.env, seed: s.seed, gateCount: s.gateCount,
      difficulty: s.difficulty, obstacleDensity: s.obstacleDensity
    });
    this.world = new CollisionWorld(this.course);
    this.renderer.loadCourse(this.course, this.settings.quality);
    const keepBest = this.race ? this.race.best : null;
    this.race = new Race(this.course, s.raceMode);
    const stored = loadBest(courseKey(s));
    if (stored) this.race.loadBest(stored);
    this.renderer.setRacingLine(this.race.bestGhost ? this.race.bestGhost.frames : null);
    this.resetDrone(true);
    this.camera.chaseInit = false;
    this.buildTime = performance.now() - t0;
    if (!initial) this.toast(`Course "${s.seed}" rebuilt — ${this.course.gates.length} gates, ${(this.course.path.totalLen).toFixed(0)} m`, 'good');
    if (this.ui) this.ui.refreshLive();
  }
  randomSeed() {
    const words = ['RAPTOR', 'NEON', 'VECTOR', 'HALON', 'CINDER', 'QUARTZ', 'ZEPHYR', 'ORBIT', 'PYLON', 'DELTA'];
    this.settings.seed = words[Math.floor(Math.random() * words.length)] + '-' + Math.floor(Math.random() * 900 + 100);
    this.settings.preset = 'custom';
    this.rebuildCourse();
    this.ui.build();
  }
  applyPreset(id) {
    const p = COURSE_PRESETS.find(x => x.id === id);
    if (!p) return false;
    this.settings.env = p.env; this.settings.seed = p.seed;
    this.settings.gateCount = p.gates; this.settings.difficulty = p.difficulty;
    return true;
  }

  resetDrone(full) {
    const c = this.course;
    let pos, quat;
    const lastGate = this.race && this.race.armed ? (this.race.nextGate - 1 + c.gates.length) % c.gates.length : -1;
    if (!full && lastGate >= 0) {
      const g = c.gates[lastGate];
      pos = V3.new(g.pos[0] - g.n[0] * 6, g.pos[1] - g.n[1] * 6 + 0.6, g.pos[2] - g.n[2] * 6);
      pos[1] = Math.max(pos[1], c.terrain.at(pos[0], pos[2]) + 2.2);
      quat = Q.copy(Q.new(), g.q);
    } else {
      pos = V3.copy(V3.new(), c.start.pos);
      quat = Q.copy(Q.new(), c.start.quat);
    }
    this.drone.P = Object.assign(this.drone.P, this.flightParams());
    this.drone.reset(pos, quat, { keepBattery: !full });
    V3.copy(this.prevPos, pos);
    this.input.setThrottle(0);
    this.oob = 0; this.oobTimer = 0;
    this.camera.chaseInit = false;
    if (full) { this.renderer.particles.clear(); }
  }
  restartRun() {
    this.race.reset(true);
    this.race.mode = this.settings.raceMode;
    this.resetDrone(true);
    this.banner('RESTART', 'Fly through the START gate to arm the clock', '#00e5ff', 1.4);
  }
  recover() {
    this.resetDrone(false);
    this.drone.crashed = false;
    this.banner('RECOVERED', 'Clock keeps running', '#ffc23d', 1.0);
    this.audio.blip(420, 0.12, 'triangle', 0.16, 620);
  }

  /* ------------------------------------------------------------ settings */
  onSetting(key, value, live) {
    const s = this.settings;
    if (key === 'preset' && value !== 'custom') {
      if (this.applyPreset(value)) { this.rebuildCourse(); this.ui.build(); }
    } else if (COURSE_KEYS.indexOf(key) >= 0) {
      s.preset = 'custom';
      clearTimeout(this._rebuildT);
      this._rebuildT = setTimeout(() => this.rebuildCourse(), 130);
    } else if (key === 'raceMode') {
      this.race.mode = value; this.restartRun();
    } else if (key === 'camera') {
      this.camera.set(value | 0); this.syncQuickBar();
    } else if (key === 'flightMode') {
      this.syncQuickBar();
    } else if (key === 'volume' || key === 'muted') {
      this.audio.setVolume(s.volume); this.audio.setMuted(s.muted);
    } else if (key === 'touchSticks') {
      document.getElementById('touch').classList.toggle('on', !!value);
      document.getElementById('touch').style.display = value ? '' : 'none';
    } else if (key === 'telemetry') {
      document.getElementById('telemetry').classList.toggle('hidden', !value);
    } else if (key === 'renderScale' || key === 'quality') {
      this.adaptiveScale = 1;
      if (key === 'quality') this.renderer.buildTerrainMesh(s.quality);
      this.resize();
    }
    this.drone.P = Object.assign(this.drone.P, this.flightParams());
    this.camera.fov = s.fov; this.camera.tilt = s.camTilt;
    this.input.smoothing = s.keySmoothing;
    this.input.invertPitchKeys = s.invertPitchKeys;
    this.input.gp.deadzone = s.gpDeadzone;
    this.input.gp.axis = { throttle: s.gpAxisThrottle, yaw: s.gpAxisYaw, roll: s.gpAxisRoll, pitch: s.gpAxisPitch };
    this.input.gp.invert = { throttle: s.gpInvThrottle, yaw: s.gpInvYaw, roll: s.gpInvRoll, pitch: s.gpInvPitch };
    clearTimeout(this._saveT);
    this._saveT = setTimeout(() => saveSettings(this.settings), 400);
  }
  applyAllSettings() {
    const s = this.settings;
    this.camera.set(s.camera | 0); this.camera.fov = s.fov; this.camera.tilt = s.camTilt;
    this.audio.setVolume(s.volume); this.audio.setMuted(s.muted);
    this.input.smoothing = s.keySmoothing; this.input.invertPitchKeys = s.invertPitchKeys;
    this.input.gp.deadzone = s.gpDeadzone;
    this.input.gp.axis = { throttle: s.gpAxisThrottle, yaw: s.gpAxisYaw, roll: s.gpAxisRoll, pitch: s.gpAxisPitch };
    this.input.gp.invert = { throttle: s.gpInvThrottle, yaw: s.gpInvYaw, roll: s.gpInvRoll, pitch: s.gpInvPitch };
    document.getElementById('touch').style.display = s.touchSticks ? '' : 'none';
    document.getElementById('touch').classList.toggle('on', !!s.touchSticks);
    document.getElementById('telemetry').classList.toggle('hidden', !s.telemetry);
    this.syncQuickBar();
  }
  resetPhysicsDefaults() {
    for (const k of ['twr', 'mass', 'gravity', 'dragScale', 'motorTau', 'rateRoll', 'ratePitch', 'rateYaw', 'expo', 'throttleExpo', 'angleMax', 'autoLevel', 'antiCrash', 'collisionForgiveness']) {
      this.settings[k] = DEFAULT_SETTINGS[k];
    }
    this.drone.P = Object.assign(this.drone.P, this.flightParams());
    this.ui.build(); this.toast('Physics reset to defaults', 'good');
  }
  trimHover() {
    const h = this.drone.hoverStick();
    this.input.setThrottle(h);
    this.toast(`Throttle set to hover (${(h * 100).toFixed(0)}%)`, 'good');
  }

  /* Dragging a window between a 1x and a 2x display changes devicePixelRatio
     without firing a resize event, so watch the resolution media query too. */
  watchDpr() {
    if (!window.matchMedia) return;
    const arm = () => {
      const dpr = window.devicePixelRatio || 1;
      if (this._dprMq) { try { this._dprMq.removeEventListener('change', this._dprCb); } catch (e) { } }
      this._dprMq = window.matchMedia(`(resolution: ${dpr}dppx)`);
      this._dprCb = () => { this.resize(); arm(); };
      try { this._dprMq.addEventListener('change', this._dprCb); }
      catch (e) { try { this._dprMq.addListener(this._dprCb); } catch (e2) { } }
    };
    arm();
    /* belt and braces for engines that do not fire the query: cheap poll */
    setInterval(() => {
      const dpr = clamp(window.devicePixelRatio || 1, 1, 3);
      if (Math.abs(dpr - (this.dpr || 1)) > 0.01) this.resize();
    }, 1000);
  }

  /* ------------------------------------------------------------- resize */
  resize() {
    const w = Math.max(1, window.innerWidth), h = Math.max(1, window.innerHeight);
    const dpr = clamp(window.devicePixelRatio || 1, 1, 3);
    this.cssW = w; this.cssH = h; this.dpr = dpr;
    const scale = clamp(this.settings.renderScale * this.adaptiveScale, 0.2, 2);
    this.renderer.resize(w, h, dpr, scale);
    this.hud.resize(w, h, dpr);
    this.telemetry.resize(dpr);
    const gc = document.getElementById('gl');
    gc.style.width = w + 'px'; gc.style.height = h + 'px';
    /* measure the live-stats card so the HUD can lay out around it */
    const st = document.getElementById('stats');
    this.insetLeft = st ? st.getBoundingClientRect().right + 10 : 0;
  }

  /* --------------------------------------------------------------- loop */
  loop(now) {
    requestAnimationFrame(t => this.loop(t));
    const t0 = performance.now();
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (!isFin(dt)) dt = 0.016;
    dt = clamp(dt, 0, 0.1);
    this.frameMs = dt * 1000;
    this.frameMsAvg = this.frameMsAvg * 0.9 + this.frameMs * 0.1;
    this.fps = 1000 / Math.max(0.1, this.frameMsAvg);
    this.time += dt;
    this.frame++;

    const ctl = this.input.update(dt);
    this.handleActions();

    const tSim = performance.now();
    let stepped = 0;
    if (!this.paused) {
      this.acc += dt;
      /* A physics substep costs a few microseconds, so the cap only exists to
         stop a stalled tab from replaying minutes of simulation at once. It is
         set high enough that the sim keeps real time down to ~6 fps instead of
         silently sliding into slow motion on weak hardware. */
      const maxSteps = 40;
      let n = 0;
      const ctlObj = {
        throttle: this.launched ? ctl.throttle : 0,
        roll: this.launched ? ctl.roll : 0,
        pitch: this.launched ? ctl.pitch : 0,
        yaw: this.launched ? ctl.yaw : 0,
        mode: this.settings.flightMode
      };
      while (this.acc >= FIXED_DT && n < maxSteps) {
        V3.copy(this.prevPos, this.drone.p);
        this.drone.step(FIXED_DT, ctlObj, this.world);
        const impact = this.world.resolve(this.drone, this.drone.P, this.events);
        if (impact > 0) this.onImpact(impact);
        this.race.substep(this.prevPos, this.drone.p, this.drone);
        this.acc -= FIXED_DT; n++; stepped++;
      }
      if (n >= maxSteps) this.acc = Math.min(this.acc, FIXED_DT * 4);
      const simDt = stepped * FIXED_DT;
      this.simTime += simDt;
      this.race.tick(simDt);
      this.race.updateBehind(this.drone.p);
      if (this.race.armed && !this.drone.crashed) {
        this.race.recorder.push(this.race.lapTime, this.drone.p, this.drone.q, this.drone.motorLoad());
      }
      this.updateCrash(dt);
      this.updateBounds(dt);
      this.drainRaceEvents();
      this.updateParticles(dt);
    }
    this.timing.sim = performance.now() - tSim;

    this.camera.update(dt, this.drone, this.course, { orbitDrag: this.orbitDrag });
    this.updateGhost();
    if (this.audio.ready) {
      const rel = V3.new();
      V3.sub(rel, this.drone.p, this.camera.pos);
      const d = V3.len(rel) || 1;
      const radial = (this.drone.v[0] * rel[0] + this.drone.v[1] * rel[1] + this.drone.v[2] * rel[2]) / d;
      this.audio.update(this.drone, dt, this.camera.id === 'fpv' ? 0 : -radial);
    }

    const tRender = performance.now();
    this.buildDebugLines();
    const state = this.renderState(ctl);
    try { this.renderer.render(state); }
    catch (e) { this.noteError('render: ' + (e && e.message || e)); this.paused = true; }
    this.timing.render = performance.now() - tRender;

    const tHud = performance.now();
    this.hud.draw(state);
    this.timing.hud = performance.now() - tHud;

    if (this.captureRequest) { const cb = this.captureRequest; this.captureRequest = null; cb(); }

    this._teleAcc += dt;
    if (this._teleAcc > 0.05) {
      this._teleAcc = 0;
      if (this.settings.telemetry) {
        this.telemetry.push({
          alt: this.drone.altAGL, speed: this.drone.speed(), throttle: ctl.throttle,
          roll: this.drone.w[2], pitch: this.drone.w[0]
        });
        this.telemetry.draw();
      }
    }
    this._statAcc += dt;
    if (this._statAcc > 0.12) { this._statAcc = 0; this.updateStats(ctl); this.syncQuickBar(); }
    this._uiAcc += dt;
    if (this._uiAcc > 0.28) { this._uiAcc = 0; if (this.ui) this.ui.refreshLive(); }
    this.updateAdaptive(dt);
    this.watchdog(dt);
    this.timing.total = performance.now() - t0;
  }

  renderState(ctl) {
    return {
      camera: this.camera, drone: this.drone, course: this.course, race: this.race,
      settings: this.settings, time: this.time, ctl, renderer: this.renderer,
      ghost: this.ghost, showLine: this.settings.showLine && this.renderer.lineStripN > 1,
      insetLeft: this.insetLeft || 0,
      oob: this.oob, oobTimer: Math.max(0, 4 - this.oobTimer)
    };
  }

  /* ------------------------------------------------------- sim reactions */
  onImpact(speed) {
    const forgive = this.settings.collisionForgiveness;
    const thresh = lerp(4.0, 15.0, forgive);
    const d = this.drone;
    d.lastImpact = speed;
    if (speed > 1.2) {
      const n = Math.round(clamp(speed * 1.6, 2, 26) * clamp(this.settings.particles, 0, 2.5));
      this.renderer.particles.burst(d.p, n, {
        speed: clamp(speed * 0.5, 1.5, 9), life: 0.55, size: 0.12 + speed * 0.008,
        color: d.contactKind === 'terrain' ? [0.75, 0.66, 0.5] : [1.0, 0.72, 0.28], kind: 1
      });
      this.camera.shake = Math.min(1.6, this.camera.shake + speed * 0.05);
      this.audio.impact(clamp(speed / 16, 0.05, 1), d.contactKind);
    }
    if (speed > thresh && !d.crashed) {
      d.crashed = true; d.crashTimer = 0;
      this.race.crashes = (this.race.crashes || 0) + 1;
      this.renderer.particles.burst(d.p, Math.round(34 * clamp(this.settings.particles, 0, 2.5)), {
        speed: 10, life: 1.0, size: 0.2, color: [1, 0.5, 0.15], kind: 1
      });
      this.camera.shake = 1.8;
      this.audio.crash();
      this.banner('CRASH', 'R to recover · the clock keeps running', '#ff4d4d', 1.6);
    }
  }
  updateCrash(dt) {
    const d = this.drone;
    if (!d.crashed) return;
    if (d.crashTimer > 2.4) this.recover();
  }
  updateBounds(dt) {
    const over = this.world.outOfBounds(this.drone.p);
    this.oob = over;
    if (over > 0) {
      this.oobTimer += dt;
      /* a soft push back toward the course, then a hard reset */
      const b = this.course.bounds;
      const rad = Math.hypot(this.drone.p[0], this.drone.p[2]);
      if (rad > b.radius) {
        const k = -0.9 * dt * clamp(over, 0, 40);
        this.drone.v[0] += this.drone.p[0] / rad * k;
        this.drone.v[2] += this.drone.p[2] / rad * k;
      }
      if (this.drone.p[1] > b.ceiling) this.drone.v[1] -= 5 * dt * clamp(over, 0, 20);
      if (this.oobTimer > 4) { this.recover(); this.oobTimer = 0; this.toast('Returned to the course — out of bounds', 'warn'); }
    } else this.oobTimer = 0;
  }
  updateParticles(dt) {
    const P = this.renderer.particles, d = this.drone, s = this.settings;
    const density = clamp(s.particles, 0, 2.5);
    P.update(dt, d.P.gravity);
    if (density <= 0.01) return;
    /* rotor wash near the ground */
    if (d.altAGL < 2.4 && d.motorLoad() > 0.12 && this.time - this.lastDust > 0.035) {
      this.lastDust = this.time;
      const g = this.course.terrain.at(d.p[0], d.p[2]);
      for (let i = 0; i < Math.round(2 * density); i++) {
        const a = Math.random() * TAU, r = 0.4 + Math.random() * 1.5;
        P.spawn(
          V3.new(d.p[0] + Math.cos(a) * r, g + 0.06, d.p[2] + Math.sin(a) * r),
          V3.new(Math.cos(a) * 2.4, 0.5 + Math.random(), Math.sin(a) * 2.4),
          0.55 + Math.random() * 0.4, 0.35 + Math.random() * 0.3,
          [0.62, 0.58, 0.5], 0, 1.9);
      }
    }
    /* speed streaks past the camera when it is quick */
    const spd = d.speed();
    if (spd > 14 && this.camera.id === 'fpv' && Math.random() < clamp((spd - 14) / 30, 0, 0.9) * density) {
      const c = this.camera;
      const off = V3.new((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 8, 0);
      const fwd = V3.new(-c.pos[0], 0, 0);
      const p = V3.new(
        c.pos[0] + this.renderer.camRight[0] * off[0] + this.renderer.camUp[0] * off[1] + this.renderer.camFwd[0] * 14,
        c.pos[1] + this.renderer.camRight[1] * off[0] + this.renderer.camUp[1] * off[1] + this.renderer.camFwd[1] * 14,
        c.pos[2] + this.renderer.camRight[2] * off[0] + this.renderer.camUp[2] * off[1] + this.renderer.camFwd[2] * 14);
      P.spawn(p, V3.mul(V3.new(), d.v, -0.55), 0.30, 0.10, [0.65, 0.85, 1.0], 2, 0.2);
    }
  }
  updateGhost() {
    const g = this.ghost, s = this.settings;
    g.visible = false; g.active = false;
    if (!s.ghost || !this.race.ghostPlayer || this.race.mode === 'free') return;
    if (!this.race.armed) {
      if (this.race.ghostPlayer.sample(0, g.pos, g.quat)) { g.visible = true; g.active = true; }
      return;
    }
    if (this.race.ghostPlayer.sample(this.race.lapTime, g.pos, g.quat)) { g.visible = true; g.active = true; }
  }
  drainRaceEvents() {
    const ev = this.race.events;
    if (!ev.length) return;
    for (const e of ev) {
      if (e.type === 'start') {
        this.banner('GO', 'Clock running', '#39ff88', 1.0);
        this.audio.blip(880, 0.12, 'triangle', 0.24);
      } else if (e.type === 'gate') {
        if (e.gate !== 0) {
          this.banner(`GATE ${e.gate + 1}`, `sector ${e.sector.toFixed(2)}s`, '#00e5ff', 0.85);
          this.audio.gate(e.gate, this.course.gates.length);
        }
        this.renderer.particles.burst(this.course.gates[e.gate].pos, Math.round(14 * clamp(this.settings.particles, 0, 2.5)), {
          speed: 7, life: 0.6, size: 0.3, color: [0.2, 1, 1], kind: 1, drag: 2.4
        });
      } else if (e.type === 'lap') {
        this.banner(e.best ? 'NEW BEST LAP' : `LAP ${e.lap}`, fmtTime(e.time) + (e.penalty ? `  (+${e.penalty.toFixed(1)}s penalty)` : ''), e.best ? '#39ff88' : '#eafcff', 2.2);
        this.audio.lap(e.best);
        if (e.best) {
          saveBest(courseKey(this.settings), this.race.exportBest());
          this.renderer.setRacingLine(this.race.bestGhost.frames);
          this.toast(`Best lap saved: ${fmtTime(e.time)}`, 'good');
        }
      } else if (e.type === 'missed') {
        this.banner('GATE MISSED', `+${e.penalty.toFixed(1)}s penalty`, '#ff4d4d', 1.6);
        this.toast(`Missed gate ${e.gate + 1} — +${e.penalty.toFixed(1)}s`, 'bad');
        this.audio.miss();
      } else if (e.type === 'nearmiss') {
        this.toast(`Gate ${e.gate + 1} missed — you passed outside the frame`, 'warn');
        this.audio.warn();
      } else if (e.type === 'wronggate') {
        this.toast(`Wrong gate — fly gate ${e.want + 1} next`, 'warn');
      } else if (e.type === 'wrongway') {
        this.toast('Wrong way', 'warn');
      }
    }
    ev.length = 0;
  }

  /* Adaptive resolution that proves itself: after each downscale it checks
     whether the frame time actually improved. If it did not, the bottleneck is
     not fill rate (a throttled rAF, a CPU-bound page, a 30 Hz panel), so the
     resolution is restored and the controller backs off instead of grinding
     the image down for nothing. */
  updateAdaptive(dt) {
    const s = this.settings;
    if (!s.adaptive) { if (this.adaptiveScale !== 1) { this.adaptiveScale = 1; this.resize(); } return; }
    if (this.time < 3) return;            /* let the page settle before judging */
    this._adaptAcc = (this._adaptAcc || 0) + dt;
    if (this._adaptAcc < 0.8) return;
    this._adaptAcc = 0;
    const ms = this.frameMsAvg;
    if (this._probe) {
      const p = this._probe; this._probe = null;
      if (p.dir < 0 && (p.before - ms) < p.before * 0.04) {
        this.adaptiveScale = p.prev; this.resize();
        this.adaptiveLockUntil = this.time + 25;
        this.adaptiveVerdict = `no gain from ${(p.prev).toFixed(2)}→${(p.to).toFixed(2)} (${p.before.toFixed(0)}→${ms.toFixed(0)} ms) — not fill-rate bound`;
        return;
      }
      this.adaptiveVerdict = p.dir < 0
        ? `scaled down ${(p.prev).toFixed(2)}→${(p.to).toFixed(2)}, ${p.before.toFixed(0)}→${ms.toFixed(0)} ms`
        : `scaled up ${(p.prev).toFixed(2)}→${(p.to).toFixed(2)}`;
      return;
    }
    if (this.time < (this.adaptiveLockUntil || 0)) return;
    let sc = this.adaptiveScale;
    if (ms > 21 && sc > 0.55) { const to = Math.max(0.55, sc - 0.1); this._probe = { before: ms, prev: sc, to, dir: -1 }; sc = to; }
    else if (ms < 13.5 && sc < 1) { const to = Math.min(1, sc + 0.07); this._probe = { before: ms, prev: sc, to, dir: 1 }; sc = to; }
    if (Math.abs(sc - this.adaptiveScale) > 0.001) { this.adaptiveScale = sc; this.resize(); }
  }

  /* Hard safety net, independent of the adaptive-resolution toggle: if frames
     become pathological the simulator sheds quality rather than locking up the
     tab. Steps down one preset at a time and says so. */
  watchdog(dt) {
    const order = ['high', 'medium', 'low', 'potato'];
    if (this.frameMsAvg > 400) this._slow = (this._slow || 0) + dt; else this._slow = 0;
    if (this._slow < 2.5) return;
    this._slow = 0;
    const i = order.indexOf(this.settings.quality);
    let acted = false;
    if (i >= 0 && i < order.length - 1) {
      this.settings.quality = order[i + 1];
      this.renderer.buildTerrainMesh(this.settings.quality);
      acted = true;
    }
    if (this.settings.renderScale > 0.55) { this.settings.renderScale = 0.55; acted = true; }
    if (acted) {
      this.resize();
      this.toast(`Frames were taking ${this.frameMsAvg.toFixed(0)} ms — quality reduced to ${this.settings.quality} @ ${(this.settings.renderScale * 100).toFixed(0)}%`, 'warn');
      if (this.ui) this.ui.build();
      saveSettings(this.settings);
    }
  }

  /* --------------------------------------------------------- debug lines */
  buildDebugLines() {
    const R = this.renderer, s = this.settings, d = this.drone;
    R.lineReset();
    const a = V3.new(), b = V3.new();
    if (s.showAxes) {
      const L = 1.2;
      const axes = [[VEC_RIGHT, [1, 0.25, 0.25, 1]], [VEC_UP, [0.3, 1, 0.35, 1]], [V3.new(0, 0, -1), [0.35, 0.55, 1, 1]]];
      for (const [ax, col] of axes) {
        Q.rot(a, d.q, ax);
        V3.addScaled(b, d.p, a, L);
        R.line(d.p, b, col);
      }
    }
    if (s.showVectors) {
      V3.addScaled(b, d.p, d.v, 0.25);
      R.line(d.p, b, [1, 0.95, 0.2, 1]);
      V3.addScaled(b, d.p, d.accel, 0.06);
      R.line(d.p, b, [1, 0.2, 0.9, 1]);
      const up = Q.rot(V3.new(), d.q, VEC_UP);
      V3.addScaled(b, d.p, up, d.thrustN / Math.max(0.001, d.P.mass * d.P.gravity) * 0.6);
      R.line(d.p, b, [0.3, 1, 1, 1]);
    }
    if (s.showBounds) {
      const seg = 22;
      for (let axis = 0; axis < 3; axis++) {
        for (let i = 0; i < seg; i++) {
          const a0 = i / seg * TAU, a1 = (i + 1) / seg * TAU;
          const mk = (ang) => {
            const c = Math.cos(ang) * DRONE_RADIUS, s2 = Math.sin(ang) * DRONE_RADIUS;
            return axis === 0 ? [c, s2, 0] : axis === 1 ? [c, 0, s2] : [0, c, s2];
          };
          const p0 = mk(a0), p1 = mk(a1);
          R.line(V3.new(d.p[0] + p0[0], d.p[1] + p0[1], d.p[2] + p0[2]),
            V3.new(d.p[0] + p1[0], d.p[1] + p1[1], d.p[2] + p1[2]), [0.2, 1, 0.6, 0.85]);
        }
      }
    }
    if (s.showGateVolumes) {
      for (const g of this.course.gates) {
        const col = g.i === this.race.nextGate ? [0.1, 1, 1, 0.9] : [0.6, 0.7, 0.9, 0.4];
        const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, w]) => V3.new(
          g.pos[0] + g.u[0] * u * g.hw + g.w[0] * w * g.hh,
          g.pos[1] + g.u[1] * u * g.hw + g.w[1] * w * g.hh,
          g.pos[2] + g.u[2] * u * g.hw + g.w[2] * w * g.hh));
        for (let i = 0; i < 4; i++) R.line(corners[i], corners[(i + 1) % 4], col);
        V3.addScaled(b, g.pos, g.n, 4);
        R.line(g.pos, b, col);
      }
    }
    if (s.showPath) {
      const p = this.course.path, step = p.totalLen / 160;
      for (let i = 0; i < 160; i++) {
        p.atArc(i * step, a); p.atArc((i + 1) * step, b);
        R.line(a, b, [1, 0.5, 0.9, 0.55]);
      }
    }
    if (this.race && !this.drone.crashed) {
      const g = this.race.target();
      if (g && this.settings.showGateVolumes) R.line(d.p, g.pos, [0.2, 0.9, 1, 0.28]);
    }
  }

  /* ---------------------------------------------------------- DOM & UI */
  wireDom() {
    const S = this.settings;
    const startSel = document.getElementById('startPreset');
    for (const p of COURSE_PRESETS) startSel.appendChild(el('option', { value: p.id, text: `${p.name} — ${p.desc}` }));
    startSel.value = COURSE_PRESETS.find(p => p.id === S.preset) ? S.preset : COURSE_PRESETS[0].id;
    document.getElementById('startSeed').value = S.seed;
    document.getElementById('startModeSel').value = S.raceMode;
    startSel.addEventListener('change', e => {
      if (this.applyPreset(e.target.value)) {
        this.settings.preset = e.target.value;
        document.getElementById('startSeed').value = this.settings.seed;
        this.rebuildCourse();
      }
    });
    document.getElementById('startSeed').addEventListener('change', e => {
      this.settings.seed = e.target.value || 'RAPTOR-1';
      this.settings.preset = 'custom';
      this.rebuildCourse();
    });
    document.getElementById('startModeSel').addEventListener('change', e => {
      this.settings.raceMode = e.target.value; this.race.mode = e.target.value;
    });
    document.getElementById('btnStart').addEventListener('click', () => this.launch('timetrial'));
    document.getElementById('btnStartFree').addEventListener('click', () => this.launch('free'));
    document.getElementById('btnResume').addEventListener('click', () => this.setPaused(false));
    document.getElementById('btnPauseReset').addEventListener('click', () => { this.setPaused(false); this.recover(); });
    document.getElementById('btnPauseRestart').addEventListener('click', () => { this.setPaused(false); this.restartRun(); });
    document.getElementById('btnPauseHelp').addEventListener('click', () => { this.setPaused(false); this.showHelp(); });
    document.getElementById('qHelp').addEventListener('click', () => this.showHelp());
    document.getElementById('qCam').addEventListener('click', () => this.cycleCamera(1));
    document.getElementById('qMode').addEventListener('click', () => this.cycleMode(1));
    document.getElementById('qReset').addEventListener('click', () => this.recover());
    document.getElementById('qRestart').addEventListener('click', () => this.restartRun());
    document.getElementById('qPause').addEventListener('click', () => this.setPaused(!this.paused));
    document.getElementById('qPanel').addEventListener('click', () => this.togglePanel());
    document.getElementById('telePause').addEventListener('click', e => {
      this.telemetry.paused = !this.telemetry.paused;
      e.target.textContent = this.telemetry.paused ? 'run' : 'hold';
      e.target.classList.toggle('on', this.telemetry.paused);
    });
    /* orbit camera dragging + wheel zoom on the canvas */
    const gl = document.getElementById('gl');
    gl.addEventListener('pointerdown', e => {
      if (this.camera.id !== 'orbit') return;
      this.orbitDrag = true; this._lastPtr = [e.clientX, e.clientY];
      gl.setPointerCapture(e.pointerId);
    });
    gl.addEventListener('pointermove', e => {
      if (!this.orbitDrag) return;
      const dx = e.clientX - this._lastPtr[0], dy = e.clientY - this._lastPtr[1];
      this._lastPtr = [e.clientX, e.clientY];
      this.camera.orbitYaw -= dx * 0.006;
      this.camera.orbitPitch = clamp(this.camera.orbitPitch + dy * 0.005, -1.2, 1.35);
    });
    const endDrag = () => { this.orbitDrag = false; };
    gl.addEventListener('pointerup', endDrag); gl.addEventListener('pointercancel', endDrag);
    gl.addEventListener('wheel', e => {
      if (this.camera.id !== 'orbit') return;
      e.preventDefault();
      this.camera.orbitDist = clamp(this.camera.orbitDist * (1 + Math.sign(e.deltaY) * 0.12), 1.6, 90);
    }, { passive: false });
  }

  launch(mode) {
    this.settings.raceMode = mode || this.settings.raceMode;
    this.race.mode = this.settings.raceMode;
    const ok = this.audio.init();
    if (ok) this.audio.setVolume(this.settings.volume);
    document.getElementById('startOverlay').classList.add('hidden');
    this.launched = true;
    this.paused = false;
    this.camera.set(this.settings.camera | 0);
    this.restartRun();
    this.banner('THROTTLE UP', 'W to spool the motors · fly through the gold START gate', '#00e5ff', 2.6);
    this.syncQuickBar();
    if (!ok) this.toast('Audio unavailable: ' + (this.audio.lastErr || 'unknown'), 'warn');
  }
  showHelp() { document.getElementById('startOverlay').classList.remove('hidden'); this.setPaused(true); }
  setPaused(p) {
    this.paused = !!p;
    document.getElementById('pauseOverlay').classList.toggle('hidden', !this.paused || !document.getElementById('startOverlay').classList.contains('hidden'));
    document.getElementById('qPause').textContent = this.paused ? 'Resume' : 'Pause';
    document.getElementById('qPause').classList.toggle('on', this.paused);
    if (this.paused) {
      const d = this.drone;
      document.getElementById('pauseStats').innerHTML =
        `Frozen at <b>${d.p[0].toFixed(1)}, ${d.p[1].toFixed(1)}, ${d.p[2].toFixed(1)}</b> · ` +
        `${d.speed().toFixed(1)} m/s · gate ${this.race.nextGate + 1}/${this.race.gateCount} · lap ${fmtTime(this.race.lapTime)}`;
    } else if (this.audio.ready) this.audio.resume();
  }
  togglePanel() {
    const p = document.getElementById('panel');
    p.classList.toggle('hidden');
    document.getElementById('qPanel').classList.toggle('on', !p.classList.contains('hidden'));
    if (!p.classList.contains('hidden')) this.ui.build();
  }
  cycleCamera(d) {
    this.camera.cycle(d);
    this.settings.camera = this.camera.mode;
    this.syncQuickBar();
    this.toast('Camera: ' + CAMERA_MODES[this.camera.mode].name, 'good');
    saveSettings(this.settings);
    if (this.ui && this.ui.tab === 'camera') this.ui.build();
  }
  cycleMode(d) {
    const i = FLIGHT_MODES.findIndex(m => m.id === this.settings.flightMode);
    const n = (i + (d || 1) + FLIGHT_MODES.length) % FLIGHT_MODES.length;
    this.settings.flightMode = FLIGHT_MODES[n].id;
    this.syncQuickBar();
    this.banner(FLIGHT_MODES[n].short, FLIGHT_MODES[n].name, '#00e5ff', 1.2);
    this.audio.blip(520 + n * 110, 0.09, 'triangle', 0.18);
    saveSettings(this.settings);
    if (this.ui && this.ui.tab === 'flight') this.ui.build();
  }
  syncQuickBar() {
    const m = FLIGHT_MODES.find(x => x.id === this.settings.flightMode) || FLIGHT_MODES[0];
    document.getElementById('qCam').textContent = 'Cam: ' + CAMERA_MODES[this.camera.mode].name;
    document.getElementById('qMode').textContent = 'Mode: ' + m.short;
    document.getElementById('stMode2').textContent = m.short;
  }

  handleActions() {
    for (const a of this.input.takeActions()) {
      switch (a.type) {
        case 'camera': this.cycleCamera(a.dir); break;
        case 'cameraSet': this.camera.set(a.index); this.settings.camera = a.index; this.syncQuickBar(); break;
        case 'mode': this.cycleMode(a.dir); break;
        case 'recover': this.recover(); break;
        case 'restart': this.restartRun(); break;
        case 'pause': this.setPaused(!this.paused); break;
        case 'panel': this.togglePanel(); break;
        case 'ghost': this.settings.ghost = !this.settings.ghost; this.toast('Ghost ' + (this.settings.ghost ? 'on' : 'off'), 'good'); break;
        case 'line': this.settings.showLine = !this.settings.showLine; this.toast('Racing line ' + (this.settings.showLine ? 'on' : 'off'), 'good'); break;
        case 'diag':
          this.settings.showAxes = this.settings.showVectors = this.settings.showBounds = this.settings.showGateVolumes = !this.settings.showAxes;
          this.settings.showSticks = this.settings.showAxes;
          this.toast('Diagnostics ' + (this.settings.showAxes ? 'on' : 'off'), 'good');
          if (this.ui && this.ui.tab === 'diag') this.ui.build();
          break;
        case 'telemetry':
          this.settings.telemetry = !this.settings.telemetry;
          document.getElementById('telemetry').classList.toggle('hidden', !this.settings.telemetry);
          break;
        case 'help': this.showHelp(); break;
        case 'screenshot': this.screenshot(); break;
        case 'fov': this.settings.fov = clamp(this.settings.fov + a.d, 45, 150); this.camera.fov = this.settings.fov; this.toast('FOV ' + this.settings.fov + '°', 'good'); break;
        case 'gamepad':
          this.toast(a.connected ? 'Gamepad connected: ' + a.id : 'Gamepad disconnected', a.connected ? 'good' : 'warn');
          if (this.ui && this.ui.tab === 'input') this.ui.build();
          break;
      }
    }
  }

  /* ------------------------------------------------------------ overlay */
  updateStats(ctl) {
    const d = this.drone, r = this.race, R = this.renderer;
    const set = (id, v, cls) => {
      const e = document.getElementById(id); if (!e) return;
      if (e.textContent !== v) e.textContent = v;
      if (cls !== undefined) e.className = cls || '';
    };
    const fps = this.fps;
    set('stFps', fps.toFixed(0), 'big ' + (fps > 50 ? 'v-good' : fps > 28 ? 'v-warn' : 'v-bad'));
    set('stRes', `${R.renderW}×${R.renderH} @${(this.settings.renderScale * this.adaptiveScale).toFixed(2)}`);
    set('stFrame', `${this.frameMsAvg.toFixed(1)} ms · s${this.timing.sim.toFixed(1)} r${this.timing.render.toFixed(1)}`);
    set('stSpeed', d.speed().toFixed(1) + ' m/s', 'big v-acc');
    set('stAlt', d.altAGL.toFixed(1) + ' m');
    set('stPos', `${d.p[0].toFixed(0)}, ${d.p[1].toFixed(0)}, ${d.p[2].toFixed(0)}`);
    set('stThr', Math.round(ctl.throttle * 100) + '%  m' + Math.round(d.motorLoad() * 100));
    const m = FLIGHT_MODES.find(x => x.id === this.settings.flightMode) || FLIGHT_MODES[0];
    set('stMode', m.short + (this.settings.altHold ? ' +ALT' : '') + (this.settings.antiCrash > 0.02 ? ' +AC' : ''));
    set('stCam', CAMERA_MODES[this.camera.mode].name.toUpperCase());
    set('stGate', `${r.nextGate + 1} / ${r.gateCount}`);
    set('stLap', r.mode === 'free' ? 'free flight' : (r.armed ? fmtTime(r.lapTime + r.lapPenalty) : 'ready'));
    set('stSector', r.sectors.length ? `S${r.sectors.length} ${r.sectors[r.sectors.length - 1].toFixed(2)}` : '--');
    const dl = r.delta();
    set('stDelta', dl == null ? (r.best ? fmtTime(r.best.time) : '--') : fmtDelta(dl), dl == null ? '' : (dl <= 0 ? 'v-good' : 'v-bad'));
    set('stColl', d.crashed ? 'CRASHED' : (d.contact ? 'contact:' + (d.contactKind || 'yes') : (this.oob > 0 ? 'out of bounds' : 'clear')),
      d.crashed ? 'v-bad' : (d.contact ? 'v-warn' : 'v-good'));
  }

  banner(big, sub, color, dur) {
    const b = document.getElementById('bannerBig'), s = document.getElementById('bannerSub');
    b.textContent = big; b.style.color = color || '#eafcff'; b.style.opacity = '1';
    s.textContent = sub || ''; s.style.opacity = '1';
    clearTimeout(this._bannerT);
    this._bannerT = setTimeout(() => { b.style.opacity = '0'; s.style.opacity = '0'; }, (dur || 1.4) * 1000);
  }
  toast(text, kind) {
    const host = document.getElementById('toasts');
    const t = el('div', { class: 'toast ' + (kind || ''), text });
    host.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .35s'; setTimeout(() => t.remove(), 380); }, 2600);
    while (host.children.length > 6) host.firstChild.remove();
  }
  noteError(msg) {
    this.errors.push({ t: new Date().toISOString(), msg: String(msg) });
    if (this.errors.length > 40) this.errors.shift();
    this.toast('Error: ' + String(msg).slice(0, 90), 'bad');
  }

  /* ------------------------------------------------------------- data IO */
  exportCourse() {
    const r = downloadJSON(buildExport('course', this.settings, this.race), `vfpv-course-${this.settings.seed}.json`);
    this.toast(r.ok ? 'Course JSON exported' : 'Export failed: ' + r.error, r.ok ? 'good' : 'bad');
  }
  exportReplay() {
    if (!this.race.best) { this.toast('No best lap recorded yet — complete a lap first', 'warn'); return; }
    const r = downloadJSON(buildExport('replay', this.settings, this.race), `vfpv-replay-${this.settings.seed}.json`);
    this.toast(r.ok ? 'Replay JSON exported' : 'Export failed: ' + r.error, r.ok ? 'good' : 'bad');
  }
  exportAll() {
    const r = downloadJSON(buildExport('bundle', this.settings, this.race), `vfpv-bundle-${this.settings.seed}.json`);
    this.toast(r.ok ? 'Bundle exported' : 'Export failed: ' + r.error, r.ok ? 'good' : 'bad');
  }
  importFile(file) {
    const fr = new FileReader();
    fr.onload = () => this.importText(String(fr.result));
    fr.onerror = () => this.showImportResult({ ok: false, error: 'Could not read the file.' });
    fr.readAsText(file);
  }
  importPrompt() {
    const txt = window.prompt('Paste exported JSON:');
    if (txt) this.importText(txt);
  }
  importText(text) {
    const res = validateImport(text);
    this.showImportResult(res);
    if (!res.ok) { this.toast('Import rejected: ' + res.error, 'bad'); return res; }
    if (res.settings) {
      Object.assign(this.settings, res.settings);
      this.applyAllSettings();
    }
    if (res.course) {
      Object.assign(this.settings, res.course);
      this.settings.preset = 'custom';
      this.rebuildCourse();
    }
    if (res.ghost || res.best) {
      const payload = { best: res.best || { time: 999, sectors: [] }, ghost: res.ghost || null };
      this.race.loadBest(payload);
      saveBest(courseKey(this.settings), payload);
      this.renderer.setRacingLine(this.race.bestGhost ? this.race.bestGhost.frames : null);
    }
    this.ui.build();
    this.toast('Import OK' + (res.warnings.length ? ` (${res.warnings.length} warning(s))` : ''), 'good');
    return res;
  }
  showImportResult(res) {
    const host = document.getElementById('import-result');
    if (!host) return;
    host.innerHTML = '';
    host.appendChild(el('div', {
      class: res.ok ? 'okbox' : 'errbox',
      html: res.ok
        ? `Imported <b>${res.kind}</b>${res.course ? ` — course "${res.course.seed}" (${res.course.env}, ${res.course.gateCount} gates)` : ''}${res.ghost ? ` — ghost with ${res.ghost.frames.length} frames` : ''}${res.warnings.length ? '<br>Warnings: ' + res.warnings.join('; ') : ''}`
        : `<b>Import failed.</b> ${res.error}`
    }));
  }
  screenshot() {
    this.captureRequest = async () => {
      const c = captureFrame(document.getElementById('gl'), this.hudCanvas);
      const r = await downloadCanvas(c, `vfpv-${this.settings.seed}-${Date.now()}.png`);
      this.toast(r.ok ? `Screenshot saved (${(r.bytes / 1024).toFixed(0)} KB)` : 'Screenshot failed: ' + r.error, r.ok ? 'good' : 'bad');
      this.lastScreenshot = r;
    };
  }
  clearBest() {
    clearBest(courseKey(this.settings));
    this.race.best = null; this.race.bestGhost = null; this.race.ghostPlayer = null;
    this.renderer.setRacingLine(null);
    this.toast('Best time cleared for this course', 'warn');
    this.ui.build();
  }
  wipeStorage() {
    Store.clear();
    this.toast('Local storage wiped', 'warn');
    this.ui.build();
  }

  /* ---------------------------------------------------------- UI strings */
  courseStatsHtml() {
    const c = this.course; if (!c) return '';
    return `<table class="tbl">
      <tr><td>seed</td><td>${c.seed}</td></tr>
      <tr><td>environment</td><td>${c.envDef.label}</td></tr>
      <tr><td>gates / length</td><td>${c.gates.length} · ${c.path.totalLen.toFixed(0)} m</td></tr>
      <tr><td>difficulty</td><td>${c.difficultyDef.name}</td></tr>
      <tr><td>colliders</td><td>${c.colliders.length}</td></tr>
      <tr><td>corridor radius</td><td>${c.corridorRadius.toFixed(1)} m</td></tr>
      <tr><td>generation</td><td>${c.stats.genMs.toFixed(1)} ms</td></tr>
      <tr><td>auto-cleared obstacles</td><td>${c.stats.removedObstacles}</td></tr>
      <tr><td>finishable</td><td>${c.stats.issues.filter(i => i.kind === 'terrain').length === 0 ? 'verified' : 'adjusted (' + c.stats.issues.length + ')'}</td></tr></table>`;
  }
  gpuInfoHtml() {
    const g = this.glc;
    return `<table class="tbl">
      <tr><td>context</td><td>${g.isGL2 ? 'WebGL2' : 'WebGL1 + ANGLE_instanced_arrays'}</td></tr>
      <tr><td>renderer</td><td style="max-width:170px;word-break:break-word">${g.renderer}</td></tr>
      <tr><td>rasteriser</td><td>${g.software ? 'software (SwiftShader class)' : 'hardware'}</td></tr>
      <tr><td>draw calls</td><td>${this.renderer.stats.drawCalls}</td></tr>
      <tr><td>triangles</td><td>${this.renderer.stats.tris.toLocaleString()}</td></tr>
      <tr><td>instances</td><td>${this.renderer.stats.instances}</td></tr>
      <tr><td>particles</td><td>${this.renderer.stats.particles}</td></tr>
      <tr><td>shadow map</td><td>${this.renderer.shadowSize || 'off'}</td></tr></table>`;
  }
  audioInfoHtml() {
    const i = this.audio.info();
    return `<table class="tbl">
      <tr><td>context</td><td>${i.state}</td></tr>
      <tr><td>sample rate</td><td>${i.rate || '--'}</td></tr>
      <tr><td>bus level (RMS)</td><td>${i.level == null ? '--' : i.level.toFixed(4)}</td></tr>
      <tr><td>volume</td><td>${((i.volume || 0) * 100).toFixed(0)}%${i.muted ? ' (muted)' : ''}</td></tr></table>`;
  }
  gamepadAxesHtml() {
    const s = this.input.status();
    if (!s.gamepad) return '<i>Axes appear here once a controller reports input.</i>';
    return `<table class="tbl"><tr><td>id</td><td style="max-width:170px;word-break:break-word">${s.gamepadId}</td></tr>` +
      s.axes.map((v, i) => `<tr><td>axis ${i}</td><td>${v.toFixed(3)}</td></tr>`).join('') +
      `<tr><td>calibrated</td><td>${s.calibrated ? 'yes' : 'no'}</td></tr></table>`;
  }
  diagHtml() {
    const d = this.drone, r = this.race;
    const att = Q.attitude(d.q);
    const f = v => (v >= 0 ? ' ' : '') + v.toFixed(2);
    return `<table class="tbl">
      <tr><td>position</td><td>${f(d.p[0])}, ${f(d.p[1])}, ${f(d.p[2])}</td></tr>
      <tr><td>velocity</td><td>${f(d.v[0])}, ${f(d.v[1])}, ${f(d.v[2])}</td></tr>
      <tr><td>speed</td><td>${d.speed().toFixed(2)} m/s (${(d.speed() * 3.6).toFixed(0)} km/h)</td></tr>
      <tr><td>accel (world)</td><td>${f(d.accel[0])}, ${f(d.accel[1])}, ${f(d.accel[2])}</td></tr>
      <tr><td>accel (body g)</td><td>${(d.accelBody[1] / 9.81).toFixed(2)} g vertical</td></tr>
      <tr><td>quaternion</td><td>${[...d.q].map(v => v.toFixed(3)).join(', ')}</td></tr>
      <tr><td>attitude</td><td>r ${(att.roll * RAD).toFixed(1)}° p ${(att.pitch * RAD).toFixed(1)}° y ${(att.yaw * RAD).toFixed(1)}°</td></tr>
      <tr><td>body rates</td><td>${f(d.w[0])}, ${f(d.w[1])}, ${f(d.w[2])} rad/s</td></tr>
      <tr><td>rate setpoint</td><td>${[...d.targetRate].map(v => v.toFixed(2)).join(', ')}</td></tr>
      <tr><td>torque demand</td><td>${[...d.torqueNorm].map(v => v.toFixed(2)).join(', ')}</td></tr>
      <tr><td>motors</td><td>${[...d.motors].map(v => (v * 100).toFixed(0)).join(' / ')}</td></tr>
      <tr><td>saturation</td><td>${(d.motorSat * 100).toFixed(0)}%</td></tr>
      <tr><td>thrust</td><td>${d.thrustN.toFixed(2)} N (${(d.thrustN / (d.P.mass * d.P.gravity)).toFixed(2)} g)</td></tr>
      <tr><td>battery</td><td>${(d.battery * 100).toFixed(1)}% · ${d.batteryV.toFixed(2)} V</td></tr>
      <tr><td>alt AGL</td><td>${d.altAGL.toFixed(2)} m</td></tr>
      <tr><td>contact</td><td>${d.contact ? d.contactKind || 'yes' : 'none'}${d.crashed ? ' · CRASHED' : ''}</td></tr>
      <tr><td>last impact</td><td>${d.lastImpact.toFixed(2)} m/s</td></tr>
      <tr><td>alt hold / anti-crash</td><td>${d.altHoldActive ? 'on' : 'off'} / ${(d.antiCrashActive * 100).toFixed(0)}%</td></tr>
      <tr><td>substeps</td><td>${d.steps} @ ${(FIXED_DT * 1000).toFixed(2)} ms</td></tr>
      <tr><td>instability guards</td><td>${d.instabilityGuards}</td></tr>
      <tr><td>sim time</td><td>${this.simTime.toFixed(2)} s</td></tr>
      <tr><td>frame</td><td>${this.frameMsAvg.toFixed(2)} ms (${this.fps.toFixed(0)} fps)</td></tr>
      <tr><td>sim / render / hud</td><td>${this.timing.sim.toFixed(2)} / ${this.timing.render.toFixed(2)} / ${this.timing.hud.toFixed(2)} ms</td></tr>
      <tr><td>gate</td><td>${r.nextGate + 1}/${r.gateCount} · lap ${r.lap} · missed ${r.missedCount}</td></tr>
      <tr><td>penalty</td><td>${r.penalty.toFixed(1)} s</td></tr>
      <tr><td>ghost frames</td><td>${r.bestGhost ? r.bestGhost.frames.length : 0}</td></tr>
      <tr><td>errors</td><td>${this.errors.length}</td></tr></table>`;
  }
  persistInfoHtml() {
    return `<table class="tbl">
      <tr><td>storage</td><td>${Store.available ? 'localStorage' : 'memory only'}</td></tr>
      <tr><td>detail</td><td style="max-width:180px;word-break:break-word">${Store.reason}${Store.lastError ? ' · last write: ' + Store.lastError : ''}</td></tr>
      <tr><td>course key</td><td style="word-break:break-all">${courseKey(this.settings)}</td></tr>
      <tr><td>best lap</td><td>${this.race.best ? fmtTime(this.race.best.time) : 'none yet'}</td></tr>
      <tr><td>ghost frames</td><td>${this.race.bestGhost ? this.race.bestGhost.frames.length : 0}</td></tr></table>`;
  }
  bestTableHtml() {
    const b = allBests(), keys = Object.keys(b);
    if (!keys.length) return '<div class="hint">No lap times stored yet.</div>';
    return '<table class="tbl">' + keys.map(k =>
      `<tr><td style="word-break:break-all">${k}</td><td>${fmtTime(b[k].best && b[k].best.time)}</td></tr>`).join('') + '</table>';
  }
  toggleCalibration() {
    if (this.input.calibrating) {
      const r = this.input.finishCalibration(true);
      this.toast(r ? 'Calibration stored' : 'Calibration cancelled', 'good');
    } else {
      const ok = this.input.startCalibration();
      this.toast(ok ? 'Move every stick to its extremes, then press Finish' : 'No gamepad detected', ok ? 'good' : 'warn');
    }
    this.ui.build();
  }
}

/* ---------------------------------------------------------------- boot -- */
const app = new App();
window.addEventListener('DOMContentLoaded', () => { if (!app.boot()) console.warn('boot aborted'); });
if (document.readyState !== 'loading') { setTimeout(() => { if (!app.ready) app.boot(); }, 0); }

/* read-only diagnostics surface for automated inspection */
window.__DRONE__ = {
  version: '1.0.0',
  get ready() { return !!app.ready; },
  get launched() { return !!app.launched; },
  state() {
    if (!app.ready) return { ready: false };
    const d = app.drone, r = app.race, R = app.renderer, att = Q.attitude(d.q);
    return {
      ready: true, launched: app.launched, paused: app.paused, time: app.time, simTime: app.simTime,
      pos: [...d.p], vel: [...d.v], quat: [...d.q], omega: [...d.w],
      speed: d.speed(), forwardSpeed: d.forwardSpeed(), altAGL: d.altAGL,
      attitudeDeg: { roll: att.roll * RAD, pitch: att.pitch * RAD, yaw: att.yaw * RAD },
      motors: [...d.motors], thrustN: d.thrustN, motorLoad: d.motorLoad(), motorSat: d.motorSat,
      battery: d.battery, batteryV: d.batteryV,
      throttleCmd: app.input.ctl.throttle, ctl: Object.assign({}, app.input.ctl),
      inputSource: app.input.source, gamepad: app.input.gamepadConnected,
      flightMode: app.settings.flightMode, camera: CAMERA_MODES[app.camera.mode].id, cameraFov: app.camera.fovNow,
      crashed: d.crashed, contact: d.contact, contactKind: d.contactKind, lastImpact: d.lastImpact,
      outOfBounds: app.oob, altHold: d.altHoldActive, antiCrash: d.antiCrashActive,
      race: {
        armed: r.armed, mode: r.mode, lap: r.lap, nextGate: r.nextGate, gateCount: r.gateCount,
        lapTime: r.lapTime, totalTime: r.time, sectors: r.sectors.slice(), penalty: r.penalty,
        missed: r.missedCount, best: r.best ? { time: r.best.time, sectors: r.best.sectors.slice() } : null,
        delta: r.delta(), behindGate: r.behindGate, ghostFrames: r.bestGhost ? r.bestGhost.frames.length : 0,
        recording: r.recorder.frames.length, laps: r.laps.map(l => l.time)
      },
      render: {
        w: R.renderW, h: R.renderH, canvasW: R.width, canvasH: R.height,
        dpr: app.dpr, renderScale: app.settings.renderScale, adaptiveScale: app.adaptiveScale,
        adaptiveVerdict: app.adaptiveVerdict || null, cssW: app.cssW, cssH: app.cssH,
        drawCalls: R.stats.drawCalls, tris: R.stats.tris, particles: R.stats.particles,
        shadow: R.shadowSize, fps: app.fps, frameMs: app.frameMsAvg, quality: app.settings.quality
      },
      ghost: { visible: app.ghost.visible, pos: [...app.ghost.pos] },
      audio: app.audio.info(),
      errors: app.errors.slice()
    };
  },
  course() {
    if (!app.course) return null;
    const c = app.course;
    return {
      seed: c.seed, seedNum: c.seedNum, env: c.env, difficulty: c.difficulty,
      gateCount: c.gates.length, length: c.path.totalLen, colliders: c.colliders.length,
      corridorRadius: c.corridorRadius, genMs: c.stats.genMs, removed: c.stats.removedObstacles,
      start: { pos: [...c.start.pos], yaw: c.start.yaw },
      bounds: { radius: c.bounds.radius, ceiling: c.bounds.ceiling },
      gates: c.gates.map(g => ({ i: g.i, pos: [...g.pos], n: [...g.n], hw: g.hw, hh: g.hh, passed: g.passed, missed: g.missed }))
    };
  },
  gl() {
    const g = app.glc;
    return g ? { ok: g.ok, webgl2: g.isGL2, renderer: g.renderer, vendor: g.vendor, software: g.software, limits: g.limits } : { ok: false };
  },
  settings() { return Object.assign({}, app.settings); },
  storage() { return { available: Store.available, reason: Store.reason, key: courseKey(app.settings) }; },
  app
};
