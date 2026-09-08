/* ============================================================================
   SETTINGS UI — declarative control factory. Every control carries a stable
   id (set-*) and a real <label>, so it is reachable both by a pilot and by an
   accessibility-tree driven test harness.
   ========================================================================== */

const DEFAULT_SETTINGS = {
  /* course */
  preset: 'neon-loop', env: 'neon', seed: 'RAPTOR-1', gateCount: 9, difficulty: 1,
  obstacleDensity: 1.0, raceMode: 'timetrial',
  /* flight */
  flightMode: 'angle', twr: 3.6, gravity: 9.81, dragScale: 1.0, mass: 0.68,
  rateRoll: 720, ratePitch: 700, rateYaw: 380, expo: 0.35, throttleExpo: 0.25,
  angleMax: 38, autoLevel: 1.0, altHold: false, antiCrash: 0.0,
  collisionForgiveness: 0.5, motorTau: 0.032, batteryDrain: true,
  /* camera */
  camera: 0, fov: 100, camTilt: 22,
  /* video */
  quality: 'medium', renderScale: 1.0, adaptive: true, shadows: true, bloom: true,
  bloomAmount: 0.85, vignette: 0.55, lens: 0.10, chroma: 1, grain: 1, exposure: 1.0,
  particles: 1, fogScale: 1, drawDistance: 1, hud: true, attitude: true, showSticks: false,
  hudCompact: true,
  /* audio */
  volume: 0.7, muted: false,
  /* diagnostics */
  showAxes: false, showVectors: false, showBounds: false, showGateVolumes: false,
  showLine: true, ghost: true, showPath: false, telemetry: true, showTiming: false,
  /* input */
  keySmoothing: 1.0, invertPitchKeys: false, gpDeadzone: 0.08,
  gpAxisThrottle: 1, gpAxisYaw: 0, gpAxisRoll: 2, gpAxisPitch: 3,
  gpInvThrottle: true, gpInvYaw: false, gpInvRoll: false, gpInvPitch: true,
  touchSticks: false
};

/* fields that require the world to be regenerated */
const COURSE_KEYS = ['env', 'seed', 'gateCount', 'difficulty', 'obstacleDensity'];

function el(tag, attrs, kids) {
  const e = document.createElement(tag);
  if (attrs) for (const k of Object.keys(attrs)) {
    if (k === 'class') e.className = attrs[k];
    else if (k === 'text') e.textContent = attrs[k];
    else if (k === 'html') e.innerHTML = attrs[k];
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), attrs[k]);
    else e.setAttribute(k, attrs[k]);
  }
  if (kids) for (const c of [].concat(kids)) if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  return e;
}

class SettingsUI {
  constructor(app) {
    this.app = app;
    this.tab = 'flight';
    this.body = document.getElementById('panelbody');
    this.panel = document.getElementById('panel');
    document.querySelectorAll('#tabs button').forEach(b => {
      b.addEventListener('click', () => {
        this.tab = b.dataset.tab;
        document.querySelectorAll('#tabs button').forEach(x => x.classList.toggle('on', x.dataset.tab === this.tab));
        this.build();
      });
    });
  }
  get S() { return this.app.settings; }

  /* ---------- control factory ---------- */
  _fld(labelText, id, control, valueText) {
    const lbl = el('label', { for: id }, [labelText]);
    if (valueText != null) { const b = el('b', { id: id + '-val', text: valueText }); lbl.appendChild(b); }
    return el('div', { class: 'fld' }, [lbl, control]);
  }
  slider(key, label, min, max, step, fmt, opts) {
    const o = opts || {}, id = 'set-' + key;
    const val = () => (fmt ? fmt(this.S[key]) : String(this.S[key]));
    const input = el('input', {
      type: 'range', id, min, max, step, value: this.S[key],
      'aria-label': label,
      oninput: e => {
        const v = parseFloat(e.target.value);
        this.S[key] = v;
        const b = document.getElementById(id + '-val'); if (b) b.textContent = fmt ? fmt(v) : String(v);
        this.app.onSetting(key, v, o.live !== false);
      }
    });
    return this._fld(label, id, input, val());
  }
  toggle(key, label, opts) {
    const o = opts || {}, id = 'set-' + key;
    const input = el('input', {
      type: 'checkbox', id, 'aria-label': label,
      onchange: e => { this.S[key] = e.target.checked; this.app.onSetting(key, e.target.checked, true); if (o.rebuild) this.build(); }
    });
    input.checked = !!this.S[key];
    return el('label', { class: 'chk', for: id }, [input, el('span', { text: label })]);
  }
  select(key, label, options, opts) {
    const o = opts || {}, id = 'set-' + key;
    const sel = el('select', {
      id, 'aria-label': label,
      onchange: e => {
        let v = e.target.value;
        if (o.number) v = parseFloat(v);
        this.S[key] = v; this.app.onSetting(key, v, true);
        if (o.rebuild) this.build();
      }
    });
    for (const op of options) sel.appendChild(el('option', { value: op.value, text: op.label }));
    sel.value = String(this.S[key]);
    return this._fld(label, id, sel);
  }
  text(key, label, opts) {
    const o = opts || {}, id = 'set-' + key;
    const input = el('input', {
      type: 'text', id, value: this.S[key], 'aria-label': label,
      onchange: e => { this.S[key] = e.target.value; this.app.onSetting(key, e.target.value, true); }
    });
    return this._fld(label, id, input);
  }
  button(id, label, fn, cls) {
    return el('button', { id, class: cls || 'sm', onclick: fn, text: label });
  }
  sec(title, kids) { return el('div', { class: 'sec' }, [el('h4', { text: title })].concat(kids)); }

  /* ---------- panel content ---------- */
  build() {
    const S = this.S, app = this.app;
    const b = this.body;
    b.innerHTML = '';
    const P1 = v => (v * 100).toFixed(0) + '%';
    if (this.tab === 'flight') {
      b.appendChild(this.sec('Flight mode', [
        this.select('flightMode', 'Mode', FLIGHT_MODES.map(m => ({ value: m.id, label: m.name })), { rebuild: true }),
        el('div', { class: 'hint', text: (FLIGHT_MODES.find(m => m.id === S.flightMode) || FLIGHT_MODES[0]).blurb }),
        this.slider('autoLevel', 'Auto-level authority', 0, 1.6, 0.05, P1),
        this.toggle('altHold', 'Altitude hold (throttle becomes climb rate)'),
        this.slider('antiCrash', 'Anti-crash / terrain avoid', 0, 1, 0.05, P1),
        el('div', { class: 'hint', html: 'These are not cosmetic: auto-level scales the outer attitude loop, altitude hold rewrites the throttle command, anti-crash injects thrust and levelling when the ground is closing.' })
      ]));
      b.appendChild(this.sec('Rates & feel', [
        this.slider('rateRoll', 'Roll rate', 120, 1400, 10, v => v.toFixed(0) + '°/s'),
        this.slider('ratePitch', 'Pitch rate', 120, 1400, 10, v => v.toFixed(0) + '°/s'),
        this.slider('rateYaw', 'Yaw rate', 60, 900, 10, v => v.toFixed(0) + '°/s'),
        this.slider('expo', 'Stick expo', 0, 0.9, 0.01, v => v.toFixed(2)),
        this.slider('throttleExpo', 'Throttle expo', 0, 0.9, 0.01, v => v.toFixed(2)),
        this.slider('angleMax', 'Max bank (angle mode)', 10, 75, 1, v => v.toFixed(0) + '°')
      ]));
      b.appendChild(this.sec('Airframe & physics', [
        this.slider('twr', 'Thrust-to-weight', 1.2, 9, 0.1, v => v.toFixed(1) + ' : 1'),
        this.slider('mass', 'Mass', 0.25, 2.0, 0.01, v => v.toFixed(2) + ' kg'),
        this.slider('gravity', 'Gravity', 0, 25, 0.1, v => v.toFixed(2) + ' m/s²'),
        this.slider('dragScale', 'Aerodynamic drag', 0.1, 3, 0.05, v => v.toFixed(2) + '×'),
        this.slider('motorTau', 'Motor response time', 0.005, 0.15, 0.001, v => (v * 1000).toFixed(0) + ' ms'),
        this.slider('collisionForgiveness', 'Collision forgiveness', 0, 1, 0.05, P1),
        this.toggle('batteryDrain', 'Battery drain & voltage sag'),
        el('div', { class: 'grid2' }, [
          this.button('btn-physics-default', 'Reset physics', () => app.resetPhysicsDefaults()),
          this.button('btn-hover-check', 'Hover trim', () => app.trimHover())
        ])
      ]));
    } else if (this.tab === 'course') {
      b.appendChild(this.sec('Preset', [
        this.select('preset', 'Course preset', COURSE_PRESETS.map(p => ({ value: p.id, label: p.name + ' — ' + p.desc })).concat([{ value: 'custom', label: 'Custom (use the fields below)' }]), { rebuild: true }),
        el('div', { class: 'grid2' }, [
          this.button('btn-regen', 'Regenerate course', () => app.rebuildCourse(), 'sm'),
          this.button('btn-random-seed', 'Random seed', () => app.randomSeed())
        ])
      ]));
      b.appendChild(this.sec('Generator', [
        this.text('seed', 'Seed'),
        this.select('env', 'Environment', Object.keys(ENVIRONMENTS).map(k => ({ value: k, label: ENVIRONMENTS[k].label }))),
        this.slider('gateCount', 'Gate count', 4, 20, 1, v => v.toFixed(0)),
        this.select('difficulty', 'Difficulty', DIFFICULTY.map((d, i) => ({ value: i, label: d.name })), { number: true }),
        this.slider('obstacleDensity', 'Obstacle density', 0.2, 2, 0.05, v => v.toFixed(2) + '×'),
        el('div', { class: 'hint', html: 'Course, terrain, obstacles and the start pose are all derived from the seed. Same seed &rarr; same track, every time, on every machine.' })
      ]));
      b.appendChild(this.sec('Race', [
        this.select('raceMode', 'Race mode', [{ value: 'timetrial', label: 'Time trial (timed laps)' }, { value: 'free', label: 'Free flight (no clock)' }]),
        el('div', { class: 'grid2' }, [
          this.button('btn-restart-run', 'Restart run', () => app.restartRun()),
          this.button('btn-clear-best', 'Clear best time', () => app.clearBest())
        ]),
        el('div', { class: 'hint', id: 'course-stats', html: app.courseStatsHtml() })
      ]));
    } else if (this.tab === 'camera') {
      b.appendChild(this.sec('View', [
        this.select('camera', 'Camera', CAMERA_MODES.map((m, i) => ({ value: i, label: m.name })), { number: true, rebuild: true }),
        el('div', { class: 'hint', text: CAMERA_MODES[clamp(S.camera | 0, 0, 3)].blurb }),
        this.slider('fov', 'Field of view', 45, 150, 1, v => v.toFixed(0) + '°'),
        this.slider('camTilt', 'Camera tilt (FPV)', -10, 55, 1, v => v.toFixed(0) + '°'),
        el('div', { class: 'hint', text: 'Camera changes never touch the airframe state — position, velocity, attitude and motors keep running exactly as they were.' })
      ]));
      b.appendChild(this.sec('Lens & feel', [
        this.slider('lens', 'Barrel distortion', 0, 0.45, 0.01, v => v.toFixed(2)),
        this.slider('vignette', 'Vignette', 0, 1, 0.05, P1),
        this.slider('chroma', 'Chromatic aberration', 0, 3, 0.05, v => v.toFixed(2) + '×'),
        this.slider('grain', 'Sensor grain', 0, 3, 0.05, v => v.toFixed(2) + '×'),
        this.slider('exposure', 'Exposure', 0.4, 2.2, 0.02, v => v.toFixed(2))
      ]));
      b.appendChild(this.sec('Overlay', [
        this.toggle('hud', 'Show FPV overlay'),
        this.toggle('attitude', 'Attitude indicator + pitch ladder'),
        this.toggle('showSticks', 'Stick position readout'),
        this.toggle('hudCompact', 'Compact overlay on narrow screens')
      ]));
    } else if (this.tab === 'video') {
      b.appendChild(this.sec('Quality', [
        this.select('quality', 'Preset', [
          { value: 'potato', label: 'Potato — no shadows, 55% scale' },
          { value: 'low', label: 'Low — 512 shadows, 75% scale' },
          { value: 'medium', label: 'Medium — 1024 shadows, bloom' },
          { value: 'high', label: 'High — 2048 shadows, long draw' }
        ], { rebuild: true }),
        this.slider('renderScale', 'Render resolution', 0.35, 2.0, 0.05, v => P1(v)),
        this.toggle('adaptive', 'Adaptive resolution (hold 55 fps)'),
        this.toggle('shadows', 'Shadow map'),
        this.toggle('bloom', 'Bloom'),
        this.slider('bloomAmount', 'Bloom amount', 0, 2, 0.05, v => v.toFixed(2)),
        this.slider('particles', 'Particle density', 0, 2.5, 0.05, v => v.toFixed(2) + '×'),
        this.slider('fogScale', 'Haze density', 0, 3, 0.05, v => v.toFixed(2) + '×'),
        this.slider('drawDistance', 'Draw distance', 0.4, 2.5, 0.05, v => v.toFixed(2) + '×'),
        el('div', { class: 'hint', id: 'gpu-info', html: app.gpuInfoHtml() })
      ]));
      b.appendChild(this.sec('Audio', [
        this.slider('volume', 'Master volume', 0, 1, 0.01, P1),
        this.toggle('muted', 'Mute'),
        el('div', { class: 'hint', id: 'audio-info', html: app.audioInfoHtml() }),
        this.button('btn-audio-test', 'Test tone + impact', () => { app.audio.blip(660, 0.12); setTimeout(() => app.audio.impact(0.8), 220); })
      ]));
    } else if (this.tab === 'input') {
      const gp = app.input.gamepadConnected;
      b.appendChild(this.sec('Controller', [
        el('div', {
          class: gp ? 'okbox' : 'warnbox', id: 'gamepad-status',
          html: gp
            ? `Gamepad connected: <b>${app.input.gamepadId || 'unknown'}</b> — axes are live below.`
            : 'No gamepad detected. <b>Keyboard control is active and complete</b>: <b>W/S</b> throttle, <b>A/D</b> yaw, <b>arrow keys</b> pitch &amp; roll. Connect a controller and press any button on it — the browser only reports pads after an input event.'
        }),
        el('div', { class: 'grid2' }, [
          this.button('btn-gp-calibrate', app.input.calibrating ? 'Finish calibration' : 'Calibrate sticks', () => app.toggleCalibration()),
          this.button('btn-gp-clear', 'Clear calibration', () => { app.input.gp.cal = null; app.toast('Calibration cleared', 'warn'); this.build(); })
        ]),
        el('div', { class: 'hint', id: 'gp-axes', html: app.gamepadAxesHtml() })
      ]));
      b.appendChild(this.sec('Axis mapping', [
        this.slider('gpDeadzone', 'Dead zone', 0, 0.4, 0.01, v => (v * 100).toFixed(0) + '%'),
        el('div', { class: 'grid2' }, [
          this.select('gpAxisThrottle', 'Throttle axis', [0, 1, 2, 3, 4, 5].map(i => ({ value: i, label: 'Axis ' + i })), { number: true }),
          this.select('gpAxisYaw', 'Yaw axis', [0, 1, 2, 3, 4, 5].map(i => ({ value: i, label: 'Axis ' + i })), { number: true }),
          this.select('gpAxisRoll', 'Roll axis', [0, 1, 2, 3, 4, 5].map(i => ({ value: i, label: 'Axis ' + i })), { number: true }),
          this.select('gpAxisPitch', 'Pitch axis', [0, 1, 2, 3, 4, 5].map(i => ({ value: i, label: 'Axis ' + i })), { number: true })
        ]),
        this.toggle('gpInvThrottle', 'Invert throttle'),
        this.toggle('gpInvYaw', 'Invert yaw'),
        this.toggle('gpInvRoll', 'Invert roll'),
        this.toggle('gpInvPitch', 'Invert pitch')
      ]));
      b.appendChild(this.sec('Keyboard & touch', [
        this.slider('keySmoothing', 'Keyboard stick speed', 0.3, 3, 0.05, v => v.toFixed(2) + '×'),
        this.toggle('invertPitchKeys', 'Invert pitch keys'),
        this.toggle('touchSticks', 'On-screen sticks (touch / pointer)'),
        el('div', {
          class: 'hint', html:
            '<b>W</b>/<b>S</b> throttle · <b>A</b>/<b>D</b> yaw · <b>↑</b>/<b>↓</b> pitch · <b>←</b>/<b>→</b> roll · <b>Shift</b> full throttle · <b>Ctrl</b> cut<br>' +
            '<b>C</b> camera · <b>M</b> mode · <b>R</b> recover · <b>Backspace</b> restart · <b>P</b>/<b>Esc</b> pause · <b>Tab</b> panel · <b>G</b> ghost · <b>N</b> racing line · <b>O</b> diagnostics · <b>F9</b> screenshot'
        })
      ]));
    } else if (this.tab === 'diag') {
      b.appendChild(this.sec('Overlays', [
        this.toggle('showAxes', 'Body axes (X red / Y green / Z blue)'),
        this.toggle('showVectors', 'Velocity & acceleration vectors'),
        this.toggle('showBounds', 'Collision sphere'),
        this.toggle('showGateVolumes', 'Checkpoint volumes'),
        this.toggle('showPath', 'Generated racing path'),
        this.toggle('showLine', 'Best-run racing line'),
        this.toggle('ghost', 'Ghost of best lap'),
        this.toggle('telemetry', 'Telemetry graph'),
        this.toggle('showTiming', 'Frame timing breakdown')
      ]));
      b.appendChild(this.sec('Live numbers', [el('div', { id: 'diag-dump', class: 'hint' })]));
    } else if (this.tab === 'data') {
      b.appendChild(this.sec('Persistence', [
        el('div', { class: 'hint', id: 'persist-info', html: app.persistInfoHtml() }),
        el('div', { class: 'grid2' }, [
          this.button('btn-export-course', 'Export course JSON', () => app.exportCourse()),
          this.button('btn-export-replay', 'Export replay JSON', () => app.exportReplay()),
          this.button('btn-export-all', 'Export everything', () => app.exportAll()),
          this.button('btn-screenshot', 'Save PNG screenshot', () => app.screenshot())
        ])
      ]));
      const fileInput = el('input', {
        type: 'file', id: 'import-file', accept: '.json,application/json',
        onchange: e => { const f = e.target.files && e.target.files[0]; if (f) app.importFile(f); }
      });
      b.appendChild(this.sec('Import', [
        fileInput,
        el('div', { class: 'hint', text: 'Accepts course, replay or combined exports. Anything malformed is rejected with a reason and never touches the running simulation.' }),
        el('div', { id: 'import-result' }),
        el('div', { class: 'grid2' }, [
          this.button('btn-import-paste', 'Import from clipboard text…', () => app.importPrompt()),
          this.button('btn-wipe', 'Wipe local storage', () => app.wipeStorage())
        ])
      ]));
      b.appendChild(this.sec('Best times', [el('div', { id: 'best-table', html: app.bestTableHtml() })]));
    }
  }

  refreshLive() {
    if (this.panel.classList.contains('hidden')) return;
    const app = this.app;
    if (this.tab === 'diag') {
      const d = document.getElementById('diag-dump');
      if (d) d.innerHTML = app.diagHtml();
    } else if (this.tab === 'input') {
      const a = document.getElementById('gp-axes');
      if (a) a.innerHTML = app.gamepadAxesHtml();
      const st = document.getElementById('gamepad-status');
      if (st && app.input.gamepadConnected && !st.classList.contains('okbox')) this.build();
    } else if (this.tab === 'video') {
      const a = document.getElementById('audio-info');
      if (a) a.innerHTML = app.audioInfoHtml();
    } else if (this.tab === 'course') {
      const s = document.getElementById('course-stats');
      if (s) s.innerHTML = app.courseStatsHtml();
    }
  }
}
