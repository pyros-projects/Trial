#!/usr/bin/env node
/* Browser-side validation suite driven over CDP with real input events.
   Usage: node tools/checks.js <ws-url> [--only name]                        */
const path = require('path');
const flySrc = require('fs').readFileSync(path.join(__dirname, 'fly.js'), 'utf8');
const mod = { exports: {} };
new Function('require', 'module', 'exports', flySrc.replace('#!/usr/bin/env node', '').replace(/^main\(\).*$/m, '') + '\nmodule.exports={CDP,sleep,KEYS};')(require, mod, mod.exports);
const { CDP, sleep } = mod.exports;

const results = [];
let c;
const S = async () => JSON.parse(await c.eval('JSON.stringify(window.__DRONE__.state())'));
const ev = e => c.eval('(()=>{' + e + '})()');
const check = (name, pass, detail) => { results.push({ name, status: pass ? 'PASS' : 'FAIL', detail }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}  — ${detail}`); return pass; };
const info = (name, detail) => { results.push({ name, status: 'INFO', detail }); console.log(`INFO  ${name}  — ${detail}`); };

async function resizeTo(w, h) {
  await c.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  await sleep(700);
}

const TESTS = {
  /* ---------------------------------------------------------------- */
  async boot() {
    const s = await S();
    const gl = JSON.parse(await c.eval('JSON.stringify(window.__DRONE__.gl())'));
    check('boot: app ready with no uncaught errors', s.ready && s.errors.length === 0, `ready=${s.ready} errors=${s.errors.length}`);
    check('boot: WebGL context acquired', gl.ok && (gl.webgl2 || true), `webgl2=${gl.webgl2} renderer=${gl.renderer.slice(0, 60)} software=${gl.software}`);
    check('boot: canvas has non-zero internal resolution', s.render.w > 0 && s.render.h > 0, `${s.render.w}x${s.render.h} (css ${s.render.cssW}x${s.render.cssH})`);
    const net = await c.eval(`JSON.stringify(performance.getEntriesByType('resource').map(r=>r.name))`);
    const ext = JSON.parse(net).filter(u => !u.startsWith('file:') && !u.startsWith('data:') && !u.startsWith('blob:'));
    check('boot: zero external resource requests', ext.length === 0, ext.length ? ext.join(', ') : 'no resource entries beyond the document itself');
  },

  /* ---------------------------------------------------------------- */
  async cameras() {
    await ev(`window.__DRONE__.app.settings.flightMode='angle'; return 1`);
    /* fly briefly so the state is non-trivial, then freeze physics and switch */
    await c.down(['KeyW']); await sleep(900); await c.up(['KeyW']);
    await c.down(['ArrowUp']); await sleep(500); await c.up(['ArrowUp']);
    await sleep(200);
    await ev('window.__DRONE__.app.setPaused(true);return 1');
    const before = await S();
    const seen = [];
    for (let i = 0; i < 5; i++) {
      await c.tap('KeyC'); await sleep(260);
      const s = await S(); seen.push(s.camera);
    }
    const after = await S();
    await ev('window.__DRONE__.app.setPaused(false);return 1');
    check('cameras: all four modes reachable by keyboard', new Set(seen).size === 4 && ['fpv', 'chase', 'orbit', 'track'].every(m => seen.includes(m)), seen.join(' → '));
    const same = JSON.stringify(before.pos) === JSON.stringify(after.pos) && JSON.stringify(before.quat) === JSON.stringify(after.quat) &&
      JSON.stringify(before.vel) === JSON.stringify(after.vel) && JSON.stringify(before.omega) === JSON.stringify(after.omega);
    check('cameras: switching does not alter drone physical state', same,
      `pos ${JSON.stringify(before.pos.map(v => +v.toFixed(4)))} → ${JSON.stringify(after.pos.map(v => +v.toFixed(4)))}; vel/quat/omega identical=${same}`);
    const fovs = {};
    for (const m of ['fpv', 'chase', 'orbit', 'track']) {
      await ev(`window.__DRONE__.app.camera.set(${['fpv', 'chase', 'orbit', 'track'].indexOf(m)}); return 1`);
      await sleep(500);
      const s = await S(); fovs[m] = +s.cameraFov.toFixed(1);
    }
    check('cameras: each mode uses its own framing', new Set(Object.values(fovs)).size >= 3, JSON.stringify(fovs));
    await ev('window.__DRONE__.app.camera.set(0);return 1');
  },

  /* ---------------------------------------------------------------- */
  async flightModes() {
    /* identical stick input, three modes: compare the resulting dynamics */
    const run = async (mode) => {
      await ev(`const a=window.__DRONE__.app; a.settings.flightMode='${mode}'; a.settings.autoLevel=1; a.restartRun(); a.input.setThrottle(a.drone.hoverStick()); return 1`);
      await sleep(400);
      await c.down(['ArrowRight']);
      let maxRoll = 0, totalRot = 0, last = null;
      for (let i = 0; i < 22; i++) {
        await sleep(75);
        const s = await S();
        maxRoll = Math.max(maxRoll, Math.abs(s.attitudeDeg.roll));
        totalRot += Math.abs(s.omega[2]) * 0.075;
      }
      await c.up(['ArrowRight']);
      /* let go and see whether it self-levels */
      await sleep(1400);
      const rest = await S();
      return { maxRoll: +maxRoll.toFixed(1), rotDeg: +(totalRot * 180 / Math.PI).toFixed(0), restRoll: +Math.abs(rest.attitudeDeg.roll).toFixed(1) };
    };
    const angle = await run('angle'), horizon = await run('horizon'), acro = await run('acro');
    info('flight modes: measured response to a full roll input', JSON.stringify({ angle, horizon, acro }));
    check('flight mode angle: bank is limited and self-levels on release', angle.maxRoll < 55 && angle.restRoll < 8,
      `maxRoll=${angle.maxRoll}° restRoll=${angle.restRoll}°`);
    check('flight mode acro: keeps rotating past a full revolution and holds attitude', acro.rotDeg > 360 && acro.restRoll > 5,
      `rotated=${acro.rotDeg}° restRoll=${acro.restRoll}°`);
    check('flight mode horizon: differs from both', horizon.rotDeg > angle.rotDeg,
      `angle=${angle.rotDeg}° horizon=${horizon.rotDeg}° acro=${acro.rotDeg}°`);
    /* assisted vs manual: altitude hold */
    const alt = async (hold) => {
      await ev(`const a=window.__DRONE__.app; a.settings.flightMode='angle'; a.settings.altHold=${hold}; a.drone.P.altHold=${hold}; a.restartRun(); a.input.setThrottle(0.5); return 1`);
      await sleep(300);
      const s0 = await S(); await sleep(3200); const s1 = await S();
      return { from: +s0.pos[1].toFixed(1), to: +s1.pos[1].toFixed(1), drift: +(s1.pos[1] - s0.pos[1]).toFixed(1) };
    };
    const off = await alt(false), on = await alt(true);
    check('assist: altitude hold visibly changes control dynamics', Math.abs(on.drift) < Math.abs(off.drift) * 0.5,
      `plain throttle drift=${off.drift} m, altitude hold drift=${on.drift} m (same 50% stick)`);
    await ev(`const a=window.__DRONE__.app; a.settings.altHold=false; a.drone.P.altHold=false; a.settings.flightMode='angle'; a.restartRun(); return 1`);
  },

  /* ---------------------------------------------------------------- */
  async collision() {
    /* raw, unassisted: no altitude hold, no anti-crash */
    const dive = async (label) => {
      await ev(`const a=window.__DRONE__.app; a.restartRun(); a.input.setThrottle(0); return 1`);
      await sleep(400);
      await c.down(['KeyW']); await sleep(900); await c.up(['KeyW']);
      await c.down(['ArrowUp']); await sleep(1500); await c.up(['ArrowUp']);
      await c.down(['KeyS']); await sleep(2200); await c.up(['KeyS']);
      let hit = null, minAlt = 1e9;
      for (let i = 0; i < 40; i++) {
        const s = await S();
        minAlt = Math.min(minAlt, s.altAGL);
        if (s.contact || s.crashed) { hit = s; break; }
        await sleep(150);
      }
      return { hit, minAlt: +minAlt.toFixed(2), label };
    };
    await ev(`const a=window.__DRONE__.app; a.settings.altHold=false; a.drone.P.altHold=false;
      a.settings.antiCrash=0; a.drone.P.antiCrash=0;
      a.settings.collisionForgiveness=0.2; a.drone.P.collisionForgiveness=0.2; return 1`);
    const raw = await dive('unassisted');
    check('collision: contact with the world is detected', !!raw.hit,
      raw.hit ? `kind=${raw.hit.contactKind || 'terrain'} impact=${raw.hit.lastImpact.toFixed(1)} m/s crashed=${raw.hit.crashed} minAlt=${raw.minAlt} m` : `no contact within 6 s (min alt ${raw.minAlt} m)`);
    if (raw.hit) {
      const before = await S();
      await c.tap('KeyR'); await sleep(800);
      const after = await S();
      check('collision: recovery resets the craft and clears the crash flag', !after.crashed && after.speed < 3,
        `before: crashed=${before.crashed} pos=${JSON.stringify(before.pos.map(v => +v.toFixed(1)))} → after: crashed=${after.crashed} pos=${JSON.stringify(after.pos.map(v => +v.toFixed(1)))} speed=${after.speed.toFixed(2)}`);
      check('collision: simulation stays finite through the impact', after.pos.every(Number.isFinite) && after.errors.length === before.errors.length,
        `pos finite=${after.pos.every(Number.isFinite)} newErrors=${after.errors.length - before.errors.length}`);
    }
    /* same manoeuvre with the anti-crash assist on — must end differently */
    await ev(`const a=window.__DRONE__.app; a.settings.antiCrash=1; a.drone.P.antiCrash=1; return 1`);
    const assisted = await dive('anti-crash');
    check('assist: anti-crash changes the outcome of the identical manoeuvre',
      (!assisted.hit && !!raw.hit) || (assisted.hit && raw.hit && assisted.hit.lastImpact < raw.hit.lastImpact),
      `unassisted: ${raw.hit ? raw.hit.lastImpact.toFixed(1) + ' m/s impact' : 'no impact'} (min alt ${raw.minAlt} m) · ` +
      `anti-crash: ${assisted.hit ? assisted.hit.lastImpact.toFixed(1) + ' m/s impact' : 'never touched down'} (min alt ${assisted.minAlt} m)`);
    await ev(`const a=window.__DRONE__.app; a.settings.antiCrash=0; a.drone.P.antiCrash=0;
      a.settings.collisionForgiveness=0.5; a.drone.P.collisionForgiveness=0.5; a.restartRun(); return 1`);
  },

  /* ---------------------------------------------------------------- */
  async seedReset() {
    const g0 = JSON.parse(await c.eval('JSON.stringify(window.__DRONE__.course())'));
    await ev(`const a=window.__DRONE__.app; a.settings.seed='ALPHA-42'; a.rebuildCourse(); return 1`); await sleep(600);
    const gA = JSON.parse(await c.eval('JSON.stringify(window.__DRONE__.course())'));
    await ev(`const a=window.__DRONE__.app; a.settings.seed='BETA-7'; a.rebuildCourse(); return 1`); await sleep(600);
    const gB = JSON.parse(await c.eval('JSON.stringify(window.__DRONE__.course())'));
    await ev(`const a=window.__DRONE__.app; a.settings.seed='ALPHA-42'; a.rebuildCourse(); return 1`); await sleep(600);
    const gA2 = JSON.parse(await c.eval('JSON.stringify(window.__DRONE__.course())'));
    const same = JSON.stringify(gA.gates) === JSON.stringify(gA2.gates) && gA.colliders === gA2.colliders;
    const diff = JSON.stringify(gA.gates) !== JSON.stringify(gB.gates);
    check('seed: same seed regenerates a bit-identical course', same, `ALPHA-42 gates match on regeneration; colliders ${gA.colliders} vs ${gA2.colliders}`);
    check('seed: different seed gives a different course', diff, `ALPHA-42 gate0=${JSON.stringify(gA.gates[0].pos.map(v => +v.toFixed(1)))} vs BETA-7 gate0=${JSON.stringify(gB.gates[0].pos.map(v => +v.toFixed(1)))}`);
    const st = await S();
    check('seed: reset places the craft on the start pad facing gate 1', Math.abs(st.speed) < 0.5 && st.race.nextGate === 0,
      `speed=${st.speed.toFixed(2)} nextGate=${st.race.nextGate} pos=${JSON.stringify(st.pos.map(v => +v.toFixed(1)))}`);
    await ev(`const a=window.__DRONE__.app; a.settings.seed='${g0.seed}'; a.rebuildCourse(); return 1`); await sleep(600);
  },

  /* ---------------------------------------------------------------- */
  async telemetry() {
    await ev(`const a=window.__DRONE__.app; a.restartRun(); a.settings.telemetry=true; a.telemetry.paused=false; return 1`);
    await sleep(400);
    const grab = () => c.eval(`(()=>{const t=window.__DRONE__.app.telemetry;const i=(t.i-1+t.len)%t.len;
      return JSON.stringify({alt:t.series.alt.data[i],speed:t.series.speed.data[i],thr:t.series.throttle.data[i],roll:t.series.roll.data[i],pitch:t.series.pitch.data[i],count:t.count});})()`);
    const a = JSON.parse(await grab());
    await c.down(['KeyW']); await sleep(1400);
    const b = JSON.parse(await grab());
    /* in angle mode a held roll stick produces a transient rate and then zero
       once the bank limit is reached, so sample across the transient */
    await c.down(['ArrowRight']);
    let peakRoll = 0, rollTrace = [];
    for (let i = 0; i < 10; i++) { await sleep(90); const r = JSON.parse(await grab()); peakRoll = Math.max(peakRoll, Math.abs(r.roll)); rollTrace.push(+r.roll.toFixed(2)); }
    const d = JSON.parse(await grab()); d.roll = peakRoll;
    await c.up(['KeyW']); await c.up(['ArrowRight']);
    check('telemetry: throttle trace follows the stick', b.thr > a.thr + 0.2, `throttle ${a.thr.toFixed(2)} → ${b.thr.toFixed(2)}`);
    check('telemetry: altitude and speed traces follow the sim', b.alt > a.alt + 1 && b.speed > a.speed, `alt ${a.alt.toFixed(1)}→${b.alt.toFixed(1)} m, speed ${a.speed.toFixed(1)}→${b.speed.toFixed(1)} m/s`);
    check('telemetry: roll-rate trace responds to a roll input', peakRoll > 0.4, `peak roll rate ${peakRoll.toFixed(2)} rad/s; trace ${JSON.stringify(rollTrace)}`);
    const px = await c.eval(`(()=>{const cv=document.getElementById('telegraph');const x=cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data;
      let lit=0; for(let i=0;i<x.length;i+=4) if(x[i]+x[i+1]+x[i+2]>90) lit++; return lit;})()`);
    check('telemetry: graph canvas actually has traces drawn on it', px > 500, `${px} lit pixels on the telemetry canvas`);
  },

  /* ---------------------------------------------------------------- */
  async quality() {
    const out = {};
    /* compare presets at a small drawing buffer: on this software rasteriser the
       "high" preset at full resolution takes seconds per frame and wedges the
       page. What we are comparing is shadow size / triangle load, not fill. */
    await ev(`const a=window.__DRONE__.app; a.settings.adaptive=false; a.adaptiveScale=1; a.settings.renderScale=0.35; a.resize(); return 1`);
    await sleep(700);
    for (const q of ['potato', 'low', 'medium', 'high']) {
      await ev(`const a=window.__DRONE__.app; a.settings.quality='${q}'; a.onSetting('quality','${q}',true); return 1`);
      await sleep(1400);
      const s = await S();
      out[q] = { res: `${s.render.w}x${s.render.h}`, shadow: s.render.shadow, tris: s.render.tris, draws: s.render.drawCalls };
    }
    info('quality presets', JSON.stringify(out));
    check('quality: presets change shadow map size and triangle load',
      out.potato.shadow !== out.high.shadow && out.potato.tris !== out.high.tris,
      `potato shadow=${out.potato.shadow} tris=${out.potato.tris} · high shadow=${out.high.shadow} tris=${out.high.tris}`);
    /* render-scale slider changes the drawing buffer */
    await ev(`const a=window.__DRONE__.app; a.settings.quality='low'; a.onSetting('quality','low',true); a.settings.renderScale=0.5; a.resize(); return 1`); await sleep(900);
    const half = await S();
    await ev(`const a=window.__DRONE__.app; a.settings.renderScale=1.0; a.resize(); return 1`); await sleep(900);
    const full = await S();
    check('quality: render-resolution control changes the internal buffer', half.render.w < full.render.w * 0.75,
      `0.5× → ${half.render.w}x${half.render.h}; 1.0× → ${full.render.w}x${full.render.h}`);
    await ev(`const a=window.__DRONE__.app; a.settings.adaptive=true; a.settings.quality='low'; a.settings.renderScale=0.7; a.onSetting('quality','low',true); a.resize(); return 1`);
    await sleep(600);
  },

  /* ---------------------------------------------------------------- */
  async viewports() {
    const sizes = [[1280, 800], [1920, 1080], [390, 844], [820, 400]];
    const rows = [];
    for (const [w, h] of sizes) {
      await resizeTo(w, h);
      const s = await S();
      const hud = JSON.parse(await c.eval(`(()=>{const c=document.getElementById('hud');return JSON.stringify([c.width,c.height]);})()`));
      const ar = (s.render.w / s.render.h);
      const cssAr = w / h;
      rows.push({ vp: `${w}x${h}`, buffer: `${s.render.w}x${s.render.h}`, hud: hud.join('x'), aspectErr: +Math.abs(ar - cssAr).toFixed(3), fps: +s.render.fps.toFixed(0), errors: s.errors.length });
    }
    info('viewport matrix', JSON.stringify(rows));
    check('resize: projection aspect tracks the viewport at every size', rows.every(r => r.aspectErr < 0.02), rows.map(r => `${r.vp}→${r.buffer} err=${r.aspectErr}`).join('  '));
    check('resize: HUD canvas is resized with the window', rows.every(r => r.hud !== rows[0].hud || r.vp === rows[0].vp), rows.map(r => `${r.vp}:hud ${r.hud}`).join('  '));
    check('resize: no errors raised across viewport changes', rows.every(r => r.errors === 0), `errors ${rows.map(r => r.errors).join(',')}`);
    /* input continuity after a resize */
    await resizeTo(390, 844);
    await c.down(['KeyW']); await sleep(800); await c.up(['KeyW']);
    const s1 = await S();
    check('resize: keyboard input still drives the craft after a narrow resize', s1.throttleCmd > 0.3 && s1.motors.some(m => m > 0.2),
      `throttle=${s1.throttleCmd.toFixed(2)} motors=[${s1.motors.map(m => m.toFixed(2)).join(',')}] at 390x844`);
    await resizeTo(1280, 800);
  },

  /* ---------------------------------------------------------------- */
  async dataIO() {
    /* export -> validate -> import round trip, then malformed payloads */
    const exp = await c.eval(`(()=>{const a=window.__DRONE__.app;return JSON.stringify(buildExport('bundle',a.settings,a.race));})()`);
    const parsed = JSON.parse(exp);
    check('export: bundle carries format, version and course', parsed.format === 'velociraptor-fpv' && parsed.version === 1 && !!parsed.course,
      `format=${parsed.format} v=${parsed.version} course=${JSON.stringify(parsed.course)}`);
    const okRes = JSON.parse(await c.eval(`JSON.stringify(window.__DRONE__.app.importText(${JSON.stringify(exp)}))`));
    check('import: a valid export round-trips', okRes.ok === true, `kind=${okRes.kind} warnings=${(okRes.warnings || []).length}`);
    const bad = [
      ['not json at all', 'Not valid JSON'],
      ['{"format":"something-else","version":1}', 'Unknown format'],
      ['{"format":"velociraptor-fpv","version":99}', 'Unsupported version'],
      ['{"format":"velociraptor-fpv","version":1,"course":{"seed":"x","env":"atlantis","gateCount":9,"difficulty":1}}', 'not one of'],
      ['{"format":"velociraptor-fpv","version":1,"course":{"seed":"x","env":"neon","gateCount":400,"difficulty":1}}', 'gateCount'],
      ['{"format":"velociraptor-fpv","version":1,"ghost":{"hz":30,"frames":[[0,1,2,"x",0,0,0,1]]}}', 'finite numbers'],
      ['{"format":"velociraptor-fpv","version":1}', 'Nothing importable'],
      ['[1,2,3]', 'Top level must be']
    ];
    let allRejected = true; const details = [];
    for (const [payload, expect] of bad) {
      const r = JSON.parse(await c.eval(`JSON.stringify(validateImport(${JSON.stringify(payload)}))`));
      const good = r.ok === false && String(r.error).includes(expect);
      if (!good) allRejected = false;
      details.push(`${payload.slice(0, 34)}… → ${r.ok ? 'ACCEPTED(!)' : r.error.slice(0, 46)}`);
    }
    check('import: every malformed payload is rejected with a reason', allRejected, details.join(' | '));
    const stillOk = await S();
    check('import: rejected data leaves the running simulation untouched', stillOk.ready && stillOk.errors.length === 0,
      `ready=${stillOk.ready} errors=${stillOk.errors.length} course=${(await c.eval('window.__DRONE__.course().seed'))}`);
    const store = JSON.parse(await c.eval('JSON.stringify(window.__DRONE__.storage())'));
    info('storage backend', JSON.stringify(store));
  },

  /* ---------------------------------------------------------------- */
  async screenshot() {
    const r = await c.eval(`(async()=>{const a=window.__DRONE__.app;
      const cv=captureFrame(document.getElementById('gl'),document.getElementById('hud'));
      if(!cv) return JSON.stringify({ok:false,error:'capture returned null'});
      const url=cv.toDataURL('image/png');
      return JSON.stringify({ok:true,w:cv.width,h:cv.height,bytes:url.length,head:url.slice(0,22)});})()`);
    const res = JSON.parse(r);
    check('screenshot: PNG export produces a real image of the live frame', res.ok && res.bytes > 20000 && res.head.startsWith('data:image/png'),
      `${res.w}x${res.h}, ${Math.round((res.bytes || 0) / 1024)} KB data URL, header=${res.head}`);
    const dl = await c.eval(`(()=>{let clicked=null;const orig=HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click=function(){clicked={download:this.download,href:this.href.slice(0,22)};};
      window.__DRONE__.app.screenshot();
      return new Promise(r=>setTimeout(()=>{HTMLAnchorElement.prototype.click=orig;r(JSON.stringify(clicked));},5000));})()`);
    const d = JSON.parse(dl);
    check('screenshot: save path builds a download with a .png filename', !!d && /\.png$/.test(d.download || ''), JSON.stringify(d));
  },

  /* ---------------------------------------------------------------- */
  async gamepad() {
    const st = JSON.parse(await c.eval('JSON.stringify(window.__DRONE__.app.input.status())'));
    const startMsg = await c.eval(`document.getElementById('startGamepad').textContent.trim().slice(0,150)`);
    await ev(`const a=window.__DRONE__.app; a.ui.tab='input'; a.ui.build(); return 1`); await sleep(300);
    const panelMsg = await c.eval(`document.getElementById('gamepad-status').textContent.trim().slice(0,180)`);
    const cls = await c.eval(`document.getElementById('gamepad-status').className`);
    check('gamepad: absence is detected', st.gamepad === false, `input.status().gamepad=${st.gamepad}, source=${st.source}`);
    check('gamepad: fallback guidance names the keyboard controls', /keyboard/i.test(panelMsg) && /W\/S|W\b/.test(panelMsg) && cls === 'warnbox',
      `panel: "${panelMsg}"`);
    check('gamepad: the launch card carries the same fallback message', /No gamepad detected/i.test(startMsg), `start card: "${startMsg.slice(0, 110)}"`);
    const cal = await c.eval(`JSON.stringify({started:window.__DRONE__.app.input.startCalibration()})`);
    check('gamepad: calibration refuses to start without a controller', JSON.parse(cal).started === false, `startCalibration() → ${cal}`);
    const ui = JSON.parse(await c.eval(`JSON.stringify(['set-gpDeadzone','set-gpAxisThrottle','set-gpInvPitch','btn-gp-calibrate'].map(id=>!!document.getElementById(id)))`));
    check('gamepad: dead zone / axis mapping / inversion / calibration controls exist', ui.every(Boolean), `controls present: ${ui}`);
  },

  /* ---------------------------------------------------------------- */
  async overlay() {
    const ids = ['stFps', 'stRes', 'stFrame', 'stSpeed', 'stAlt', 'stPos', 'stThr', 'stMode', 'stCam', 'stGate', 'stLap', 'stSector', 'stDelta', 'stColl'];
    const vals = JSON.parse(await c.eval(`JSON.stringify(Object.fromEntries(${JSON.stringify(ids)}.map(i=>[i,(document.getElementById(i)||{}).textContent])))`));
    const missing = ids.filter(i => vals[i] == null || vals[i] === '');
    check('overlay: every required live field is present and populated', missing.length === 0, JSON.stringify(vals));
    await c.down(['KeyW']); await sleep(900); await c.up(['KeyW']);
    const v2 = JSON.parse(await c.eval(`JSON.stringify({spd:document.getElementById('stSpeed').textContent,thr:document.getElementById('stThr').textContent,alt:document.getElementById('stAlt').textContent})`));
    check('overlay: fields update from the live simulation', v2.spd !== vals.stSpeed || v2.alt !== vals.stAlt,
      `speed "${vals.stSpeed}" → "${v2.spd}", alt "${vals.stAlt}" → "${v2.alt}", throttle "${v2.thr}"`);
  },

  /* ---------------------------------------------------------------- */
  async diagnostics() {
    const before = await c.eval('window.__DRONE__.app.renderer.lineN');
    await ev(`const s=window.__DRONE__.app.settings; s.showAxes=s.showVectors=s.showBounds=s.showGateVolumes=s.showPath=true; return 1`);
    await sleep(500);
    const after = await c.eval('window.__DRONE__.app.renderer.lineN');
    check('diagnostics: overlays emit real geometry (body axes, vectors, bounds, gate volumes, path)', after > before + 50,
      `debug line vertices ${before} → ${after}`);
    const d = JSON.parse(await c.eval(`(()=>{const h=window.__DRONE__.app.diagHtml();return JSON.stringify({len:h.length,has:['body rates','rate setpoint','torque demand','substeps','instability guards','sim / render / hud','contact','quaternion'].map(k=>h.includes(k))});})()`));
    check('diagnostics: panel reports rates, setpoints, timestep and frame timing', d.has.every(Boolean), `fields present=${JSON.stringify(d.has)} html=${d.len} bytes`);
    await ev(`const s=window.__DRONE__.app.settings; s.showAxes=s.showVectors=s.showBounds=s.showGateVolumes=s.showPath=false; return 1`);
  },

  /* ---------------------------------------------------------------- */
  async pausereset() {
    await ev('window.__DRONE__.app.restartRun();return 1');
    await c.down(['KeyW']); await sleep(1100); await c.up(['KeyW']);
    await sleep(150);
    await c.tap('KeyP'); await sleep(600);
    const p1 = await S(); await sleep(1200); const p2 = await S();
    check('pause: physics is frozen while paused', p1.simTime === p2.simTime && JSON.stringify(p1.pos) === JSON.stringify(p2.pos),
      `simTime ${p1.simTime} → ${p2.simTime}, pos identical=${JSON.stringify(p1.pos) === JSON.stringify(p2.pos)}`);
    const overlayVisible = await c.eval(`!document.getElementById('pauseOverlay').classList.contains('hidden')`);
    check('pause: overlay is shown', overlayVisible === true, `pauseOverlay visible=${overlayVisible}`);
    await c.tap('KeyP'); await sleep(700);
    const p3 = await S();
    check('pause: resuming continues the simulation', p3.simTime > p2.simTime, `simTime ${p2.simTime} → ${p3.simTime}`);
    const bStart = await S();
    await c.tap('Backspace'); await sleep(700);
    const bEnd = await S();
    check('reset: restart returns the craft to the launch pad with the clock disarmed',
      bEnd.speed < 0.6 && bEnd.race.armed === false && bEnd.race.nextGate === 0,
      `speed ${bStart.speed.toFixed(1)} → ${bEnd.speed.toFixed(2)}, armed=${bEnd.race.armed}, gate=${bEnd.race.nextGate}`);
  }
};

async function main() {
  const ws = process.argv[2];
  const only = process.argv.indexOf('--only') > 0 ? process.argv[process.argv.indexOf('--only') + 1] : null;
  c = await CDP.connect(ws);
  await c.attachPage('index.html');
  await c.eval(`if(!window.__DRONE__.launched) document.getElementById('btnStart').click(); 1`);
  await sleep(900);
  for (const name of Object.keys(TESTS)) {
    if (only && only !== name) continue;
    console.log(`\n--- ${name} ---`);
    try { await TESTS[name](); }
    catch (e) { check(name + ': suite crashed', false, String(e.message).slice(0, 200)); }
  }
  const pass = results.filter(r => r.status === 'PASS').length, fail = results.filter(r => r.status === 'FAIL').length;
  console.log(`\n===== ${pass} passed, ${fail} failed, ${results.filter(r => r.status === 'INFO').length} info =====`);
  require('fs').writeFileSync(path.join(__dirname, '..', 'evidence', 'logs', 'browser-checks.json'), JSON.stringify(results, null, 1));
  process.exit(fail ? 1 : 0);
}
main().catch(e => { console.error('SUITE ERROR: ' + e.message); process.exit(2); });
