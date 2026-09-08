#!/usr/bin/env node
/* Closed-loop KEYBOARD pilot driven over CDP. It reads the same public
   diagnostics a human reads off the HUD (position, attitude, next-gate) and
   presses real keys. The application itself has no autopilot — this lives
   entirely in the test harness.
   Usage: node tools/pilot.js <ws-url> [seconds] [--mode angle|horizon|acro] [--json out.json] */
const path = require('path');
const { execSync } = require('child_process');
const flySrc = require('fs').readFileSync(path.join(__dirname, 'fly.js'), 'utf8');
const CDPmod = new Function('require', 'module', 'exports', flySrc.replace('#!/usr/bin/env node', '').replace(/^main\(\).*$/m, '') + '\nmodule.exports={CDP,sleep,KEYS};');
const m = { exports: {} };
CDPmod(require, m, m.exports);
const { CDP, sleep } = m.exports;

const wrap = a => { while (a > 180) a -= 360; while (a < -180) a += 360; return a; };

async function main() {
  const ws = process.argv[2];
  const secs = parseFloat(process.argv[3] || '40');
  const modeArg = (process.argv.indexOf('--mode') > 0) ? process.argv[process.argv.indexOf('--mode') + 1] : null;
  const jsonOut = (process.argv.indexOf('--json') > 0) ? process.argv[process.argv.indexOf('--json') + 1] : null;
  const c = await CDP.connect(ws);
  await c.attachPage('index.html');
  const ALT_HOLD = process.argv.includes('--althold');
  const SKIP = process.argv.indexOf('--skip') > 0 ? parseInt(process.argv[process.argv.indexOf('--skip') + 1], 10) : 0;
  if (ALT_HOLD) await c.eval(`(()=>{const ap=window.__DRONE__.app; ap.settings.altHold=true; ap.drone.P.altHold=true; ap.settings.antiCrash=0.6; ap.drone.P.antiCrash=0.6; return 'ok';})()`);
  if (modeArg) await c.eval(`window.__DRONE__.app.settings.flightMode='${modeArg}'; window.__DRONE__.app.syncQuickBar(); 'ok'`);

  const held = new Set();
  const setKeys = async want => {
    for (const k of [...held]) if (!want.has(k)) { await c.key('keyUp', k); held.delete(k); }
    for (const k of want) if (!held.has(k)) { await c.key('keyDown', k); held.add(k); }
  };

  const t0 = Date.now();
  const events = [];
  let lastGate = null, lastLap = 0, ticks = 0;
  let maxSpeed = 0, minAlt = 1e9;
  const trace = [];
  while ((Date.now() - t0) / 1000 < secs) {
    const both = JSON.parse(await c.eval(`(()=>{const st=window.__DRONE__.state();const co=window.__DRONE__.course();
      const skip=${SKIP}; const idx=(st.race.nextGate+skip)%co.gates.length;
      return JSON.stringify({s:st,g:co.gates[idx],aimIdx:idx});})()`));
    const s = both.s, g = both.g;
    if (!s.ready) break;
    ticks++;
    if (lastGate === null) lastGate = s.race.nextGate;
    if (s.race.nextGate !== lastGate) { events.push({ t: +s.simTime.toFixed(2), type: 'gate', from: lastGate, to: s.race.nextGate, lapTime: +s.race.lapTime.toFixed(2), sectors: s.race.sectors.length }); lastGate = s.race.nextGate; }
    if (s.race.lap !== lastLap) { events.push({ t: +s.simTime.toFixed(2), type: 'lap', lap: s.race.lap, laps: s.race.laps }); lastLap = s.race.lap; }
    maxSpeed = Math.max(maxSpeed, s.speed); minAlt = Math.min(minAlt, s.altAGL);
    trace.push({ t: +s.simTime.toFixed(2), pos: s.pos.map(v => +v.toFixed(1)), spd: +s.speed.toFixed(1), gate: s.race.nextGate, lap: s.race.lap, crashed: s.crashed });

    /* ---- guidance: line up on the gate axis, match its height, then go ----
       Aim at a point on the gate's own axis when far out so the approach is
       already square; switch to the gate centre on short final. */
    const approach = Math.min(30, Math.max(8, Math.hypot(g.pos[0] - s.pos[0], g.pos[2] - s.pos[2]) * 0.42));
    const rawD = Math.hypot(g.pos[0] - s.pos[0], g.pos[1] - s.pos[1], g.pos[2] - s.pos[2]);
    /* far: line up on the gate axis · near: aim through and out the far side */
    const through = 16;
    const aim = rawD > 24
      ? [g.pos[0] - g.n[0] * approach, g.pos[1] - g.n[1] * approach, g.pos[2] - g.n[2] * approach]
      : [g.pos[0] + g.n[0] * through, g.pos[1] + g.n[1] * through, g.pos[2] + g.n[2] * through];
    const dx = aim[0] - s.pos[0], dy = aim[1] - s.pos[1], dz = aim[2] - s.pos[2];
    const dh = Math.hypot(dx, dz), d3 = Math.hypot(dx, dy, dz);
    const yawRad = s.attitudeDeg.yaw * Math.PI / 180;
    const fx = -Math.sin(yawRad), fz = -Math.cos(yawRad);
    const rx = Math.cos(yawRad), rz = -Math.sin(yawRad);
    const yawWant = Math.atan2(-dx, -dz) * 180 / Math.PI;
    const yawErr = wrap(yawWant - s.attitudeDeg.yaw);
    const want = new Set();
    if (s.crashed) { await setKeys(new Set()); await c.tap('KeyR'); await sleep(600); continue; }

    const yawRateDeg = s.omega[1] * 180 / Math.PI;
    const yawCmd = yawErr - yawRateDeg * 0.32;
    if (yawCmd > 7) want.add('KeyA'); else if (yawCmd < -7) want.add('KeyD');

    /* altitude first — a big height error is flown out before accelerating */
    const altErr = dy;
    const vyWant = Math.max(-6, Math.min(6, altErr * 0.85));
    let terr;
    if (ALT_HOLD) {
      /* with altitude hold the stick *is* a climb-rate command */
      const tgt = 0.5 + Math.max(-0.48, Math.min(0.48, vyWant / 4.0)) * 0.5;
      terr = (tgt - s.throttleCmd) * 12;
      if (terr > 0.4) want.add('KeyW'); else if (terr < -0.4) want.add('KeyS');
    } else {
      terr = vyWant - s.vel[1];
      if (terr > 0.5) want.add('KeyW'); else if (terr < -0.5) want.add('KeyS');
    }

    const latErr = dx * rx + dz * rz;
    const latVel = s.vel[0] * rx + s.vel[2] * rz;
    const rollCmd = latErr * 0.28 - latVel * 1.2;
    if (rollCmd > 1.5) want.add('ArrowRight'); else if (rollCmd < -1.5) want.add('ArrowLeft');

    const fwdVel = s.vel[0] * fx + s.vel[2] * fz;
    const aligned = Math.abs(yawErr) < 20 && Math.abs(altErr) < 9;
    const vmax = Math.max(3.5, Math.min(13, 2.5 + dh * 0.30));
    if (aligned && dh > 2 && fwdVel < vmax) want.add('ArrowUp');
    else if (fwdVel > vmax * 1.2 || (!aligned && fwdVel > 5)) want.add('ArrowDown');
    await setKeys(want);
    if (process.env.PILOT_VERBOSE && ticks % 4 === 0)
      console.error(`t=${s.simTime.toFixed(1)} y=${s.pos[1].toFixed(1)} alt=${altErr.toFixed(1)} d3=${rawD.toFixed(0)} vy=${s.vel[1].toFixed(1)} terr=${terr.toFixed(1)} lat=${latErr.toFixed(1)} yawErr=${yawErr.toFixed(0)} dh=${dh.toFixed(0)} spd=${s.speed.toFixed(1)} vmax=${vmax.toFixed(1)} keys=[${[...want].join(',')}] thr=${s.throttleCmd.toFixed(2)} gate=${s.race.nextGate}`);
    await sleep(8);
  }
  await setKeys(new Set());
  const final = JSON.parse(await c.eval('JSON.stringify(window.__DRONE__.state())'));
  const out = {
    seconds: secs, ticks, events,
    gatesPassed: events.filter(e => e.type === 'gate').length,
    laps: final.race.laps, best: final.race.best, penalty: final.race.penalty, missed: final.race.missed,
    maxSpeed: +maxSpeed.toFixed(2), finalGate: final.race.nextGate, errors: final.errors,
    ghostFrames: final.race.ghostFrames, recording: final.race.recording, mode: final.flightMode
  };
  if (jsonOut) require('fs').writeFileSync(jsonOut, JSON.stringify({ summary: out, trace }, null, 1));
  console.log(JSON.stringify(out, null, 1));
  process.exit(0);
}
main().catch(e => { console.error('PILOT ERROR: ' + e.message); process.exit(1); });
