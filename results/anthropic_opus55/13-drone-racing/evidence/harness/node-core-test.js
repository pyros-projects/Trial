// Headless check of APEX FPV's simulation core (world generation, validation, flight dynamics, determinism).
// Loads the <script> of ../../index.html up to the APP section (no DOM needed) into a VM context.
const fs = require('fs'), vm = require('vm'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '../../index.html'), 'utf8');
let js = html.match(/<script>([\s\S]*)<\/script>/)[1];
js = js.slice(0, js.indexOf('/* =====================================================================\n   APP'));
const ctx = { console, performance, btoa, atob, Math, Float32Array, Float64Array, Uint32Array, Uint8Array, Uint16Array, Map, Set, JSON, Date, Number, String, Object, Array, Error };
vm.createContext(ctx);
vm.runInContext(js + '\n;globalThis.__x = { PRESETS, ENVS, DIFF, generateCourseDef, buildWorld, Sim, settings, V, Q, AIR, exportReplayObj, validateReplayObj, validateCourseObj, exportCourseObj, copyDrone };', ctx);
const X = ctx.__x;
const out = [];
const log = s => { console.log(s); out.push(s); };

// 1) finishability of every generated course
let n = 0, bad = 0, worst = { t: 1e9, o: 1e9, g: 1e9 }, ms = 0;
for (const p in X.PRESETS) for (const e in X.ENVS) for (const d in X.DIFF) for (const seed of [X.PRESETS[p].seed, 'alpha', 'z9']) {
  const w = X.buildWorld(X.generateCourseDef(p, e, seed, d)); n++; ms += w.buildMs;
  const v = w.validation;
  worst.t = Math.min(worst.t, v.minTerrain); worst.o = Math.min(worst.o, v.minObst); worst.g = Math.min(worst.g, v.minGate);
  if (!v.ok) { bad++; log(`NOT FINISHABLE ${p}/${e}/${d}/${seed}: ${JSON.stringify(v)}`); }
}
log(`[courses] ${n} generated, ${bad} failed validation · min terrain clearance ${worst.t.toFixed(2)} m · min obstacle clearance ${worst.o.toFixed(2)} m · min gate-frame clearance ${worst.g.toFixed(2)} m · avg build ${(ms / n).toFixed(0)} ms`);

// 2) deterministic seed
const s1 = X.buildWorld(X.generateCourseDef('serpent', 'canyon', 'serpent', 'normal')).signature;
const s2 = X.buildWorld(X.generateCourseDef('serpent', 'canyon', 'serpent', 'normal')).signature;
const s3 = X.buildWorld(X.generateCourseDef('serpent', 'canyon', 'other', 'normal')).signature;
log(`[seed] same seed → ${s1} / ${s2} (${s1 === s2 ? 'identical' : 'DIFFERENT'}); other seed → ${s3} (${s3 !== s1 ? 'differs' : 'SAME?!'})`);

// 3) flight dynamics sanity
const world = X.buildWorld(X.generateCourseDef('rookie', 'canyon', 'rookie', 'normal'));
function mkSim(mode, over = {}) {
  Object.assign(X.settings, { raceMode: 'free', physicsHz: '240', flightMode: mode, altHold: 0, antiCrash: 0, hoverCenter: true, twr: 4.5, gravity: 9.81, drag: 1 }, over);
  const s = new X.Sim(); s.world = world; s.reset({}); return s;
}
function run(s, cmd, sec) { const n = Math.round(sec * s.hz); for (let i = 0; i < n; i++) s.stepOnce(cmd); }
const deg = r => r * 180 / Math.PI;
{
  const s = mkSim('angle'); const y0 = s.drone.p[1];
  run(s, { t: 0.5, y: 0, p: 0, r: 0 }, 1.5); const yHold = s.drone.p[1];
  run(s, { t: 0.85, y: 0, p: 0, r: 0 }, 1.5); const yUp = s.drone.p[1], vUp = s.drone.v[1];
  run(s, { t: 0.5, y: 0, p: 0, r: 0 }, 3.0);
  log(`[throttle] angle mode: stick 0.5 for 1.5 s → Δy ${(yHold - y0).toFixed(3)} m (rests/hover); stick 0.85 for 1.5 s → climbed ${(yUp - yHold).toFixed(2)} m, vy ${vUp.toFixed(2)} m/s; back to 0.5 for 3 s → vy ${s.drone.v[1].toFixed(2)} m/s`);
  const q0 = s.drone.q.slice(), p0 = s.drone.p.slice();
  run(s, { t: 0.5, y: 0.8, p: 0, r: 0 }, 0.5);
  const f = X.Q.rot(s.drone.q, [0, 0, -1]), f0 = X.Q.rot(q0, [0, 0, -1]);
  const yawDeg = deg(Math.atan2(f0[0] * f[2] - f0[2] * f[0], f0[0] * f[0] + f0[2] * f[2]));
  log(`[yaw] yaw stick +0.8 for 0.5 s → heading change ${yawDeg.toFixed(1)}° (positive = clockwise from above), altitude change ${(s.drone.p[1] - p0[1]).toFixed(2)} m`);
  const pp = s.drone.p.slice(), fwd = X.Q.rot(s.drone.q, [0, 0, -1]);
  run(s, { t: 0.62, y: 0, p: 0.8, r: 0 }, 1.2);
  const up = X.Q.rot(s.drone.q, [0, 1, 0]), dp = X.V.sub(s.drone.p, pp);
  log(`[pitch] pitch stick +0.8 for 1.2 s → tilt ${deg(Math.acos(up[1])).toFixed(1)}° nose-down, forward travel ${(dp[0] * fwd[0] + dp[2] * fwd[2]).toFixed(2)} m, speed ${X.V.len(s.drone.v).toFixed(2)} m/s`);
  run(s, { t: 0.5, y: 0, p: 0, r: 0 }, 2.0);
  const pr = s.drone.p.slice(), right = X.Q.rot(s.drone.q, [1, 0, 0]);
  run(s, { t: 0.62, y: 0, p: 0, r: 0.8 }, 1.0);
  const up2 = X.Q.rot(s.drone.q, [0, 1, 0]), dr = X.V.sub(s.drone.p, pr);
  log(`[roll] roll stick +0.8 for 1 s → bank ${deg(Math.asin(Math.max(-1, Math.min(1, -X.V.dot(X.Q.rot(s.drone.q, [1, 0, 0]), [0, 1, 0]))))).toFixed(1)}° right, sideways travel ${(dr[0] * right[0] + dr[2] * right[2]).toFixed(2)} m`);
  run(s, { t: 0.5, y: 0, p: 0, r: 0 }, 2.0);
  const upL = X.Q.rot(s.drone.q, [0, 1, 0]);
  log(`[angle] sticks released 2 s → tilt ${deg(Math.acos(Math.min(1, upL[1]))).toFixed(2)}° (auto-level)`);
}
{
  const s = mkSim('acro', { hoverCenter: true });
  run(s, { t: 0.8, y: 0, p: 0, r: 0 }, 1.2); run(s, { t: 0.5, y: 0, p: 0, r: 0 }, 0.3);
  run(s, { t: 0.5, y: 0, p: 0, r: 0.6 }, 0.25);
  const wr = -s.drone.w[2] * 180 / Math.PI, target = -s.drone.wDes[2] * 180 / Math.PI;
  run(s, { t: 0.5, y: 0, p: 0, r: 0 }, 0.5);
  const up = X.Q.rot(s.drone.q, [0, 1, 0]);
  log(`[acro] roll stick 0.6 → body roll rate ${wr.toFixed(0)}°/s (target ${target.toFixed(0)}°/s); after release tilt stays ${deg(Math.acos(Math.max(-1, Math.min(1, up[1])))).toFixed(1)}° (no self-level), residual rate ${(X.V.len(s.drone.w) * 57.3).toFixed(1)}°/s`);
}
{ // altitude hold vs manual throttle under forward tilt
  const a = mkSim('angle', { altHold: 1 }), m = mkSim('angle', { altHold: 0 });
  for (const s of [a, m]) { run(s, { t: 0.8, y: 0, p: 0, r: 0 }, 1.5); run(s, { t: 0.5, y: 0, p: 0, r: 0 }, 4); s._y = s.drone.p[1]; run(s, { t: 0.5, y: 0, p: 0.9, r: 0 }, 2.0); }
  log(`[assist] 2 s full-forward at centre throttle: altitude-hold Δy ${(a.drone.p[1] - a._y).toFixed(2)} m vs manual Δy ${(m.drone.p[1] - m._y).toFixed(2)} m`);
}
{ // crash + respawn
  const s = mkSim('acro', { hoverCenter: true, forgiveness: 0.5 });
  run(s, { t: 1, y: 0, p: 0, r: 0 }, 1.5); run(s, { t: 0, y: 0, p: 0, r: 0 }, 0.4);
  let crashed = false, respawned = false; for (let i = 0; i < 240 * 8; i++) { s.stepOnce({ t: 0, y: 0, p: 0, r: 0 }); for (const e of s.events) { if (e.type === 'crash') crashed = e.speed; if (e.type === 'respawn') respawned = true; } s.events.length = 0; if (respawned) break; }
  log(`[crash] power-off drop: crash event ${crashed ? 'at ' + crashed.toFixed(1) + ' m/s' : 'none'}, auto-respawn ${respawned ? 'yes' : 'no'}, state finite ${s.drone.p.every(Number.isFinite)}`);
}
{ // deterministic replay of a recorded input stream
  const s = mkSim('horizon', { altHold: 0.5, antiCrash: 0.5 }), rnd = (i) => Math.sin(i * 0.013) * 0.6;
  for (let i = 0; i < 240 * 12; i++) { const c = { t: Math.round((0.55 + 0.3 * Math.sin(i * 0.004)) * 1000) / 1000, y: Math.round(rnd(i) * 1000) / 1000, p: Math.round(0.5 * Math.sin(i * 0.007) * 1000) / 1000, r: Math.round(0.4 * Math.cos(i * 0.009) * 1000) / 1000 }; s.stepOnce(c); if (i === 1200) s.setParam('flightMode', 'acro'); if (i === 1800) s.setParam('flightMode', 'angle'); }
  const hashLive = s.stateHash(), rec = s.rec;
  const json = JSON.parse(JSON.stringify(X.exportReplayObj(rec)));
  const r2 = X.validateReplayObj(json);
  const s2 = new X.Sim(); s2.world = world; s2.reset({ hz: r2.hz, pset: r2.pset, mode: r2.mode, laps: r2.laps, replay: true }); s2.drone = X.copyDrone(r2.init); s2.replay = { rec: r2, ei: 0 };
  for (let i = 0; i < r2.inputs.length / 4; i++) { const k = i * 4, a = r2.inputs; s2.stepOnce({ t: a[k] / 1000, y: a[k + 1] / 1000, p: a[k + 2] / 1000, r: a[k + 3] / 1000 }); }
  log(`[replay] live hash ${hashLive} vs re-simulated-from-JSON hash ${s2.stateHash()} → ${hashLive === s2.stateHash() ? 'bit-identical' : 'DIVERGED'} (${r2.inputs.length / 4} steps, ${rec.events.length} mid-run param events, JSON ${(JSON.stringify(json).length / 1024).toFixed(0)} KB)`);
}
{ // invalid imports fail with messages
  const cases = [['{"format":"nope"}', 'wrong format'], [JSON.stringify({ format: 'apex-fpv-course', version: 1, env: 'canyon', custom: true, gates: [{ x: 0, y: 5, z: 0, w: 4, h: 3 }] }), 'too few gates'], [JSON.stringify({ format: 'apex-fpv-course', version: 1, env: 'canyon', custom: true, gates: [{ x: 0, y: 5, z: 0, w: 4, h: 3 }, { x: 'a', y: 5, z: 50, w: 4, h: 3 }, { x: 50, y: 5, z: 0, w: 4, h: 3 }] }), 'non-numeric'], [JSON.stringify({ format: 'apex-fpv-replay', version: 1, course: { format: 'apex-fpv-course', version: 1, env: 'canyon', preset: 'rookie', seed: 'rookie', difficulty: 'normal' }, hz: 240, pset: {} }), 'missing pset']];
  for (const [txt, what] of cases) { let msg; try { const o = JSON.parse(txt); o.format === 'apex-fpv-replay' ? X.validateReplayObj(o) : X.validateCourseObj(o); msg = 'ACCEPTED?!'; } catch (e) { msg = e.message; } log(`[import] ${what}: rejected → "${msg}"`); }
}
fs.writeFileSync(path.join(__dirname, '../node-core-test.log'), out.join('\n') + '\n');
