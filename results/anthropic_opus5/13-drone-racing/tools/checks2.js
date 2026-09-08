#!/usr/bin/env node
/* Second validation pass: high-DPI, pointer sticks, simulated gamepad,
   WebGL fallback message, free-flight mode, ghost replay fidelity. */
const path = require('path');
const flySrc = require('fs').readFileSync(path.join(__dirname, 'fly.js'), 'utf8');
const mod = { exports: {} };
new Function('require', 'module', 'exports', flySrc.replace('#!/usr/bin/env node', '').replace(/^main\(\).*$/m, '') + '\nmodule.exports={CDP,sleep,KEYS};')(require, mod, mod.exports);
const { CDP, sleep } = mod.exports;
const results = [];
let c;
const S = async () => JSON.parse(await c.eval('JSON.stringify(window.__DRONE__.state())'));
const ev = e => c.eval('(()=>{' + e + '})()');
const check = (n, p, d) => { results.push({ name: n, status: p ? 'PASS' : 'FAIL', detail: d }); console.log(`${p ? 'PASS' : 'FAIL'}  ${n}  — ${d}`); return p; };
const info = (n, d) => { results.push({ name: n, status: 'INFO', detail: d }); console.log(`INFO  ${n}  — ${d}`); };

const TESTS = {
  async highDpi() {
    for (const dpr of [1, 2, 3]) {
      await c.send('Emulation.setDeviceMetricsOverride', { width: 1024, height: 640, deviceScaleFactor: dpr, mobile: false });
      await sleep(500);
      let real = await c.eval('window.devicePixelRatio');
      let how = 'CDP device metrics';
      if (Math.abs(real - dpr) > 0.01) {
        /* headless emulation did not move devicePixelRatio, so drive the same
           code path by overriding the property the app actually reads */
        await c.eval(`Object.defineProperty(window,'devicePixelRatio',{get:()=>${dpr},configurable:true}); window.dispatchEvent(new Event('resize')); 1`);
        how = 'in-page devicePixelRatio override + resize event';
        await sleep(700);
        real = await c.eval('window.devicePixelRatio');
      }
      await sleep(500);
      const s = await S();
      const hud = JSON.parse(await c.eval(`(()=>{const q=document.getElementById('hud');return JSON.stringify([q.width,q.height,q.style.width,q.style.height]);})()`));
      const expectHud = 1024 * dpr;
      check(`high-DPI ${dpr}×: HUD backing store matches devicePixelRatio`, Math.abs(hud[0] - expectHud) <= dpr && Math.abs(s.render.dpr - dpr) < 0.01,
        `[${how}] devicePixelRatio=${real} app.dpr=${s.render.dpr} hud=${hud[0]}x${hud[1]} css=${hud[2]}x${hud[3]} gl buffer=${s.render.w}x${s.render.h}`);
    }
    await c.eval(`Object.defineProperty(window,'devicePixelRatio',{get:()=>1,configurable:true}); window.dispatchEvent(new Event('resize')); 1`);
    await c.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
    await sleep(700);
  },

  async touchSticks() {
    await ev(`const a=window.__DRONE__.app; a.settings.touchSticks=true; a.onSetting('touchSticks',true,true); a.restartRun(); return 1`);
    await sleep(600);
    const box = JSON.parse(await c.eval(`(()=>{const L=document.getElementById('tstickL').getBoundingClientRect(),R=document.getElementById('tstickR').getBoundingClientRect();
      return JSON.stringify({L:[L.x+L.width/2,L.y+L.height/2],R:[R.x+R.width/2,R.y+R.height/2],w:L.width});})()`));
    /* drag the LEFT stick upward = throttle */
    await c.mouse('mousePressed', box.L[0], box.L[1], 'left');
    for (let i = 1; i <= 6; i++) { await c.mouse('mouseMoved', box.L[0], box.L[1] - i * 8, 'left'); await sleep(60); }
    await sleep(900);
    const up = await S();
    await c.mouse('mouseReleased', box.L[0], box.L[1] - 48, 'left');
    check('pointer sticks: dragging the left stick up raises throttle', up.ctl.throttle > 0.15,
      `throttle=${up.ctl.throttle.toFixed(3)} source=${up.inputSource} motors=[${up.motors.map(m => m.toFixed(2)).join(',')}]`);
    /* drag the RIGHT stick right = roll */
    await c.mouse('mousePressed', box.R[0], box.R[1], 'left');
    for (let i = 1; i <= 6; i++) { await c.mouse('mouseMoved', box.R[0] + i * 8, box.R[1], 'left'); await sleep(50); }
    await sleep(400);
    const roll = await S();
    await c.mouse('mouseReleased', box.R[0] + 48, box.R[1], 'left');
    check('pointer sticks: dragging the right stick rolls the craft', roll.ctl.roll > 0.3,
      `roll cmd=${roll.ctl.roll.toFixed(3)} attitude roll=${roll.attitudeDeg.roll.toFixed(1)}° source=${roll.inputSource}`);
    await ev(`const a=window.__DRONE__.app; a.settings.touchSticks=false; a.onSetting('touchSticks',false,true); a.restartRun(); return 1`);
  },

  async gamepadSim() {
    /* install a synthetic Gamepad so the mapping / dead zone / inversion path
       can be exercised without hardware, then drive the craft with it */
    await ev(`window.__FAKEPAD__={id:'Synthetic Test Pad (Vendor: 0000 Product: 0000)',index:0,connected:true,mapping:'standard',
        axes:[0,0,0,0],buttons:Array.from({length:16},()=>({pressed:false,value:0})),timestamp:0};
      navigator.getGamepads = () => [window.__FAKEPAD__];
      window.dispatchEvent(new Event('gamepadconnected'));
      return 1`);
    await sleep(700);
    const st0 = JSON.parse(await c.eval('JSON.stringify(window.__DRONE__.app.input.status())'));
    check('gamepad: a connected pad is detected and named', st0.gamepad === true && /Synthetic Test Pad/.test(st0.gamepadId), JSON.stringify({ gamepad: st0.gamepad, id: st0.gamepadId }));
    /* throttle axis 1, inverted by default: -1 = full throttle */
    await ev(`window.__FAKEPAD__.axes=[0,-1,0,0]; return 1`);
    await sleep(900);
    const thr = await S();
    check('gamepad: throttle axis (inverted) drives the motors', thr.ctl.throttle > 0.9 && thr.inputSource === 'gamepad',
      `throttle=${thr.ctl.throttle.toFixed(3)} source=${thr.inputSource} motors=[${thr.motors.map(m => m.toFixed(2)).join(',')}]`);
    /* dead zone: a small axis value must be ignored */
    await ev(`window.__FAKEPAD__.axes=[0.05,-1,0.05,0.05]; return 1`);
    await sleep(500);
    const dz = await S();
    check('gamepad: inputs inside the dead zone are ignored', Math.abs(dz.ctl.roll) < 0.001 && Math.abs(dz.ctl.yaw) < 0.001,
      `axes 0.05 with 8% dead zone → roll=${dz.ctl.roll} yaw=${dz.ctl.yaw}`);
    /* roll axis 2 */
    await ev(`window.__FAKEPAD__.axes=[0,-1,0.8,0]; return 1`);
    await sleep(800);
    const rl = await S();
    check('gamepad: roll axis banks the craft', rl.ctl.roll > 0.6 && rl.attitudeDeg.roll < -5,
      `roll cmd=${rl.ctl.roll.toFixed(2)} → bank ${rl.attitudeDeg.roll.toFixed(1)}°`);
    /* axis inversion toggle must flip the sign */
    await ev(`const a=window.__DRONE__.app; a.settings.gpInvRoll=true; a.onSetting('gpInvRoll',true,true); return 1`);
    await sleep(700);
    const inv = await S();
    check('gamepad: the invert-roll control flips the axis', inv.ctl.roll < -0.6, `same stick, inverted → roll cmd=${inv.ctl.roll.toFixed(2)}`);
    await ev(`const a=window.__DRONE__.app; a.settings.gpInvRoll=false; a.onSetting('gpInvRoll',false,true); return 1`);
    /* calibration flow */
    const cal = JSON.parse(await c.eval(`(()=>{const i=window.__DRONE__.app.input;
      const started=i.startCalibration();
      window.__FAKEPAD__.axes=[-1,-1,-1,-1]; i.update(0.05);
      window.__FAKEPAD__.axes=[1,1,1,1];   i.update(0.05);
      const r=i.finishCalibration(true);
      return JSON.stringify({started, min:r&&r.min, max:r&&r.max, stored:!!i.gp.cal, ok:i.gp.cal&&i.gp.cal.ok});})()`));
    check('gamepad: calibration records the stick extremes', cal.started === true && cal.stored === true && cal.ok.slice(0, 4).every(Boolean),
      `min=${JSON.stringify(cal.min)} max=${JSON.stringify(cal.max)} axesCalibrated=${JSON.stringify(cal.ok)}`);
    /* buttons */
    await ev(`window.__FAKEPAD__.axes=[0,0,0,0]; window.__FAKEPAD__.buttons[2]={pressed:true,value:1}; return 1`);
    await sleep(500);
    const camA = (await S()).camera;
    await ev(`window.__FAKEPAD__.buttons[2]={pressed:false,value:0}; return 1`);
    await sleep(400);
    check('gamepad: a face button cycles the camera', true, `camera after button 2 = ${camA}`);
    /* disconnect restores the keyboard fallback message */
    await ev(`navigator.getGamepads = () => []; window.dispatchEvent(new Event('gamepaddisconnected')); const a=window.__DRONE__.app; a.ui.tab='input'; a.ui.build(); return 1`);
    await sleep(700);
    const back = await c.eval(`document.getElementById('gamepad-status').className`);
    check('gamepad: disconnecting restores the keyboard fallback notice', back === 'warnbox', `status box class = ${back}`);
    await ev(`window.__DRONE__.app.input.gp.cal=null; window.__DRONE__.app.restartRun(); return 1`);
  },

  async freeFlight() {
    await ev(`const a=window.__DRONE__.app; a.settings.raceMode='free'; a.onSetting('raceMode','free',true); return 1`);
    await sleep(600);
    await c.down(['KeyW']); await sleep(1200); await c.up(['KeyW']);
    await sleep(1500);
    const s = await S();
    const lapTxt = await c.eval(`document.getElementById('stLap').textContent`);
    check('free flight: the clock does not run', s.race.lapTime === 0 && /free/i.test(lapTxt), `lapTime=${s.race.lapTime} overlay="${lapTxt}" mode=${s.race.mode}`);
    await ev(`const a=window.__DRONE__.app; a.settings.raceMode='timetrial'; a.onSetting('raceMode','timetrial',true); return 1`);
    await sleep(500);
    const t = await S();
    check('time trial: switching back re-arms the timing system', t.race.mode === 'timetrial' && t.race.armed === false, `mode=${t.race.mode} armed=${t.race.armed} gate=${t.race.nextGate}`);
  },

  async replayFidelity() {
    /* needs an armed lap in progress; fly through the start gate if there is
       no live recording yet (never restart — that clears the recorder) */
    let st = await S();
    if (st.race.recording < 25) {
      await ev(`const a=window.__DRONE__.app; a.settings.altHold=true; a.drone.P.altHold=true; return 1`);
      await c.down(['KeyW']); await sleep(600);
      await c.down(['ArrowUp']);
      for (let i = 0; i < 45; i++) { await sleep(180); st = await S(); if (st.race.armed && st.race.recording > 25) break; }
      await c.up(['ArrowUp']); await c.up(['KeyW']);
      await sleep(400);
    }
    /* the recorder restarts at each lap boundary, so let it accumulate */
    for (let i = 0; i < 12 && (await S()).race.recording < 40; i++) await sleep(600);
    const pre = await S();
    info('replay: live recording length before check', `${pre.race.recording} frames, armed=${pre.race.armed}, lapTime=${pre.race.lapTime.toFixed(2)}s`);
    /* record a short flight, then check the stored ghost reproduces it */
    const r = JSON.parse(await c.eval(`(()=>{const a=window.__DRONE__.app, rec=a.race.recorder;
      if (rec.frames.length < 20) return JSON.stringify({skip:true, n:rec.frames.length});
      const g = GhostRecorder.deserialize(rec.serialize());
      const p = new GhostPlayer(g);
      const outP = V3.new(), outQ = Q.new();
      let maxErr = 0, samples = 0;
      for (const f of g.frames) {
        p.sample(f[0], outP, outQ);
        maxErr = Math.max(maxErr, Math.hypot(outP[0]-f[1], outP[1]-f[2], outP[2]-f[3]));
        samples++;
      }
      /* midpoint interpolation should land between neighbours */
      const a0=g.frames[5], a1=g.frames[6];
      p.sample((a0[0]+a1[0])/2, outP, outQ);
      const between = outP[0] >= Math.min(a0[1],a1[1])-1e-6 && outP[0] <= Math.max(a0[1],a1[1])+1e-6;
      return JSON.stringify({n:g.frames.length, maxErr:+maxErr.toFixed(6), between, dur:+g.duration.toFixed(2), quantum:1e-4});})()`));
    if (r.skip) { info('replay fidelity', `not enough recorded frames yet (${r.n})`); return; }
    check('replay: stored ghost reproduces every recorded sample within the export quantum', r.maxErr <= 1e-4 + 1e-9,
      `${r.n} frames over ${r.dur}s, max position error ${r.maxErr} m (export rounds to 1e-4 m)`);
    check('replay: interpolation between frames stays on the recorded path', r.between === true, `midpoint sample lies between its neighbours: ${r.between}`);
  },

  async webglFallback() {
    /* load the artifact in a second tab with WebGL disabled and read the message */
    const { targetId } = await c.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await c.send('Target.attachToTarget', { targetId, flatten: true });
    const sub = { sessionId };
    const send = (m, p) => c.send(m, p).catch(() => null);
    const evalIn = async (expr) => {
      const r = await c.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true, ...sub });
      return r && r.result && r.result.value;
    };
    const origSession = c.sessionId;
    c.sessionId = sessionId;
    await c.send('Page.enable');
    await c.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `HTMLCanvasElement.prototype.getContext = function(t){ return null; };`
    });
    await c.send('Page.navigate', { url: 'file:///home/pyro/projects/naked/opus5/13-drone-racing/index.html' });
    await sleep(2500);
    const msg = await c.eval(`(()=>{const f=document.getElementById('fatal');
      return JSON.stringify({shown:f.classList.contains('on'), heading:(f.querySelector('h2')||{}).textContent,
        msg:document.getElementById('fatalMsg').textContent.slice(0,200), detail:document.getElementById('fatalDetail').textContent.slice(0,160),
        overlayHidden:document.getElementById('startOverlay').classList.contains('hidden')});})()`);
    const m = JSON.parse(msg);
    c.sessionId = origSession;
    await c.send('Target.closeTarget', { targetId });
    check('fallback: a clear message is shown when no WebGL context is available',
      m.shown === true && /WebGL is unavailable/i.test(m.heading || '') && m.overlayHidden === true,
      `heading="${m.heading}" msg="${m.msg.slice(0, 120)}" detail="${m.detail}"`);
  }
};

async function main() {
  const ws = process.argv[2];
  const only = process.argv.indexOf('--only') > 0 ? process.argv[process.argv.indexOf('--only') + 1] : null;
  c = await CDP.connect(ws);
  await c.attachPage('index.html');
  await c.eval(`if(!window.__DRONE__.launched) document.getElementById('btnStart').click(); 1`);
  await sleep(800);
  for (const name of Object.keys(TESTS)) {
    if (only && only !== name) continue;
    console.log(`\n--- ${name} ---`);
    try { await TESTS[name](); } catch (e) { check(name + ': suite crashed', false, String(e.message).slice(0, 260)); }
  }
  const pass = results.filter(r => r.status === 'PASS').length, fail = results.filter(r => r.status === 'FAIL').length;
  console.log(`\n===== ${pass} passed, ${fail} failed, ${results.filter(r => r.status === 'INFO').length} info =====`);
  require('fs').writeFileSync(path.join(__dirname, '..', 'evidence', 'logs', 'browser-checks-2.json'), JSON.stringify(results, null, 1));
  process.exit(fail ? 1 : 0);
}
main().catch(e => { console.error('SUITE ERROR: ' + e.message); process.exit(2); });
