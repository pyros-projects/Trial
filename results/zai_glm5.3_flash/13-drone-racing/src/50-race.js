'use strict';
/* ============================= race: gates, timing, ghost, persistence ============================= */
const Race = {
  armed: true,        // waiting for start-gate crossing
  lapActive: false,
  lapStart: 0,
  lapCount: 0,
  nextGate: 0,
  splits: [],         // splits[i] = sector time at gate i (current lap)
  splitDeltas: [],
  missed: false, missedT: -9, wrongWayT: -9,
  crashes: 0, penalty: 0,
  lapTimes: [], lastLap: null,
  best: null, bestDirty: false,
  ghostRec: [], recAcc: 0,
  results: null, finished: false,
  events: null,       // set by main: {crash, bump, touch, gate, lap, best, missed}
};

const GHOST_DT = 1 / 30;
function ghostEncode(arr) {
  const f = new Float32Array(arr);
  let s = '';
  const u8 = new Uint8Array(f.buffer);
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return btoa(s);
}
function ghostDecode(b64) {
  try {
    const s = atob(b64);
    const u8 = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
    if (u8.length % 28 !== 0) return null;
    return new Float32Array(u8.buffer);
  } catch (e) { return null; }
}

Race.bestStorageKey = function (W) { return 'fpvdr.best.v1.' + W.courseKey; };
Race.loadBest = function (W) {
  Race.best = null;
  try {
    const s = localStorage.getItem(Race.bestStorageKey(W));
    if (s) {
      const o = JSON.parse(s);
      if (o && typeof o.time === 'number' && o.time > 0 && Array.isArray(o.splits)) Race.best = o;
    }
  } catch (e) { }
};
Race.saveBest = function (W) {
  if (!Race.best) return;
  try { localStorage.setItem(Race.bestStorageKey(W), JSON.stringify(Race.best)); } catch (e) { }
};
Race.resetBest = function (W) {
  Race.best = null;
  try { localStorage.removeItem(Race.bestStorageKey(W)); } catch (e) { }
};

Race.reset = function (W, D) {
  Race.armed = true; Race.lapActive = false; Race.lapStart = 0;
  Race.lapCount = 0; Race.nextGate = 0; Race.splits = []; Race.splitDeltas = [];
  Race.missed = false; Race.crashes = 0; Race.penalty = 0;
  Race.lapTimes = []; Race.lastLap = null; Race.ghostRec = []; Race.recAcc = 0;
  Race.results = null; Race.finished = false;
  dronePlaceAtSpawn(D, W);
  Race.loadBest(W);
};

Race.onCrash = function (P) {
  if (Race.lapActive && P.collisionPenalty) { Race.penalty += 1; Race.events && Race.events.penalty(1); }
  Race.crashes++;
};

Race.update = function (simTime, dt, D, W, P) {
  if (Race.finished) return;
  const N = W.gates.length;
  if (!N) return;
  const prev = D.prevPos, cur = D.pos;
  const gate = W.gates[Race.nextGate];
  const f0 = (prev[0] - gate.c[0]) * gate.n[0] + (prev[1] - gate.c[1]) * gate.n[1] + (prev[2] - gate.c[2]) * gate.n[2];
  const f1 = (cur[0] - gate.c[0]) * gate.n[0] + (cur[1] - gate.c[1]) * gate.n[1] + (cur[2] - gate.c[2]) * gate.n[2];
  if (f0 < 0 && f1 >= 0 && Math.abs(f1 - f0) > 1e-6) {
    const t = f0 / (f0 - f1);
    const px = prev[0] + (cur[0] - prev[0]) * t, py = prev[1] + (cur[1] - prev[1]) * t, pz = prev[2] + (cur[2] - prev[2]) * t;
    const rx = px - gate.c[0], ry = py - gate.c[1], rz = pz - gate.c[2];
    const a = rx * gate.n[0] + ry * gate.n[1] + rz * gate.n[2];
    const rad = Math.hypot(rx - gate.n[0] * a, ry - gate.n[1] * a, rz - gate.n[2] * a);
    if (rad <= gate.R) {
      Race.passGate(simTime, D, W, P, rad);
    } else if (rad < gate.R * 2.4) {
      Race.missed = true; Race.missedT = simTime;
      Race.events && Race.events.missed(gate.index);
    }
  } else if (f0 > 0 && f1 < 0 && Math.abs(f1 - f0) > 1e-6) {
    const t = f0 / (f0 - f1);
    const px = prev[0] + (cur[0] - prev[0]) * t, py = prev[1] + (cur[1] - prev[1]) * t, pz = prev[2] + (cur[2] - prev[2]) * t;
    const rx = px - gate.c[0], ry = py - gate.c[1], rz = pz - gate.c[2];
    const a = rx * gate.n[0] + ry * gate.n[1] + rz * gate.n[2];
    const rad = Math.hypot(rx - gate.n[0] * a, ry - gate.n[1] * a, rz - gate.n[2] * a);
    if (rad < gate.R) { Race.wrongWayT = simTime; Race.events && Race.events.wrongWay(gate.index); }
  }

  // ghost recording
  if (Race.lapActive) {
    Race.recAcc += dt;
    if (Race.recAcc >= GHOST_DT && Race.ghostRec.length < 7 * 30 * 240) {
      Race.recAcc -= GHOST_DT;
      Race.ghostRec.push(
        +D.pos[0].toFixed(3), +D.pos[1].toFixed(3), +D.pos[2].toFixed(3),
        +D.q[0].toFixed(4), +D.q[1].toFixed(4), +D.q[2].toFixed(4), +D.q[3].toFixed(4));
    }
  }
};

Race.passGate = function (simTime, D, W, P, rad) {
  const N = W.gates.length;
  const gi = Race.nextGate;
  const trial = P.mode === 'trial';
  if (gi === 0) {
    if (!Race.lapActive) {
      // start a lap
      Race.lapActive = true; Race.lapStart = simTime;
      Race.nextGate = N > 1 ? 1 : 0;
      Race.splits = []; Race.splitDeltas = [];
      Race.missed = false; Race.crashes = 0; Race.penalty = 0;
      Race.ghostRec = []; Race.recAcc = 0;
      Race.events && Race.events.lapStart(1);
    } else {
      // complete a lap
      const lapTime = simTime - Race.lapStart + Race.penalty;
      Race.lastLap = { time: lapTime, raw: simTime - Race.lapStart, penalty: Race.penalty, splits: Race.splits.slice(), missed: Race.missed };
      Race.lapTimes.push(lapTime);
      let isBest = false;
      if (trial && !Race.missed) {
        if (!Race.best || lapTime < Race.best.time) {
          isBest = true;
          Race.best = {
            time: +lapTime.toFixed(3), raw: +(simTime - Race.lapStart).toFixed(3),
            penalty: Race.penalty, splits: Race.splits.slice(), date: new Date().toISOString(),
            ghost: ghostEncode(Race.ghostRec),
          };
          Race.saveBest(W);
          Race.events && Race.events.newBest(lapTime);
        }
      }
      if (Race.missed) Race.events && Race.events.lapInvalid(lapTime);
      else Race.events && Race.events.lapDone(lapTime, isBest);
      Race.lapActive = false;
      Race.nextGate = 0;
      Race.lapCount++;
      if (trial && Race.lapCount >= P.trialLaps) {
        Race.finished = true;
        Race.results = { laps: Race.lapTimes.slice(), best: Race.best ? Race.best.time : null, penalties: Race.crashes * (P.collisionPenalty ? 1 : 0) };
        Race.events && Race.events.trialDone(Race.results);
      } else if (trial) {
        // restart lap timing immediately: next start-gate crossing begins next lap
        Race.ghostPlayT = 0;
      }
      Race.lapStart = simTime; // for HUD elapsed display continuity
    }
  } else {
    const split = simTime - Race.lapStart;
    Race.splits[gi] = split;
    Race.splitDeltas[gi] = (Race.best && Race.best.splits && Race.best.splits[gi] != null) ? split - Race.best.splits[gi] : null;
    Race.nextGate = (gi + 1) % N;
    Race.missed = false;
    droneSetCheckpoint(D, W.gates[gi], W.gates[Race.nextGate]);
    Race.events && Race.events.gate(gi, split, Race.splitDeltas[gi]);
  }
};

/* pose of best-ghost at elapsed lap time */
Race.ghostPose = function (elapsed, out) {
  const g = Race.best && Race.best.ghost;
  if (!g) return false;
  const data = (Race._gdata && Race._gdataKey === g) ? Race._gdata : (Race._gdata = ghostDecode(g), Race._gdataKey = g, Race._gdata);
  if (!data || data.length < 7) return false;
  const n = data.length / 7;
  const fi = clamp(elapsed / GHOST_DT, 0, n - 1.001);
  const i = Math.floor(fi), t = fi - i;
  const i2 = Math.min(i + 1, n - 1);
  out.pos = out.pos || v3(); out.q = out.q || qid();
  out.pos[0] = lerp(data[i * 7], data[i2 * 7], t);
  out.pos[1] = lerp(data[i * 7 + 1], data[i2 * 7 + 1], t);
  out.pos[2] = lerp(data[i * 7 + 2], data[i2 * 7 + 2], t);
  for (let k = 0; k < 4; k++) out.q[k] = lerp(data[i * 7 + 3 + k], data[i2 * 7 + 3 + k], t);
  qnorm(out.q, out.q);
  return true;
};
Race.ghostPoints = function () {
  const g = Race.best && Race.best.ghost;
  if (!g) return null;
  if (Race._gpts && Race._gptsKey === g) return Race._gpts;
  const d = ghostDecode(g);
  if (!d) return null;
  const pts = [];
  for (let i = 0; i < d.length / 7; i++) pts.push([d[i * 7], d[i * 7 + 1], d[i * 7 + 2]]);
  Race._gpts = pts; Race._gptsKey = g;
  return pts;
};

/* ---- export / import ---- */
Race.exportJSON = function (W, P) {
  return JSON.stringify({
    app: 'fpv-drone-racing', version: 1, exported: new Date().toISOString(),
    course: { env: P.env, seed: P.seed, diff: P.diff, preset: P.preset },
    best: Race.best,
    settings: settingsForExport(P),
  }, null, 1);
};
function settingsForExport(P) {
  const keys = ['mode', 'flightMode', 'autoLevel', 'altHold', 'antiCrash', 'throttleExpo', 'ratePitch', 'rateRoll', 'rateYaw', 'expo', 'angleMax', 'angleGain', 'twr', 'gravity', 'drag', 'camTilt', 'fov', 'volume', 'trialLaps'];
  const o = {};
  for (const k of keys) if (k in P) o[k] = P[k];
  return o;
}
Race.importJSON = function (text, W, P) {
  let o;
  try { o = JSON.parse(text); } catch (e) { return { ok: false, error: 'not valid JSON: ' + e.message }; }
  if (!o || typeof o !== 'object') return { ok: false, error: 'data is not an object' };
  if (o.app !== 'fpv-drone-racing') return { ok: false, error: 'unknown app signature "' + (o.app || '') + '"' };
  if (!o.course || typeof o.course !== 'object') return { ok: false, error: 'missing course data' };
  const c = o.course;
  if (!ENVS[c.env]) return { ok: false, error: 'unknown environment "' + c.env + '"' };
  if (typeof c.seed !== 'number' || !isFinite(c.seed)) return { ok: false, error: 'invalid seed' };
  if (typeof c.diff !== 'number' || c.diff < 0 || c.diff > 1) return { ok: false, error: 'difficulty out of range' };
  if (o.best != null) {
    const b = o.best;
    if (typeof b !== 'object' || typeof b.time !== 'number' || !(b.time > 0) || !Array.isArray(b.splits)) return { ok: false, error: 'invalid best-lap record' };
    if (b.ghost != null && typeof b.ghost !== 'string') return { ok: false, error: 'invalid ghost data' };
    if (b.ghost != null && !ghostDecode(b.ghost)) return { ok: false, error: 'ghost data undecodable' };
  }
  // apply
  P.env = c.env; P.seed = Math.round(c.seed); P.diff = c.diff; P.preset = c.preset && PRESETS.some(p => p.id === c.preset) ? c.preset : 'custom';
  if (o.best) { Race.best = o.best; Race.saveBest(W); } else Race.resetBest(W);
  if (o.settings) {
    const allowed = settingsForExport(P);
    for (const k of Object.keys(allowed)) {
      if (k in o.settings && typeof o.settings[k] === typeof allowed[k]) P[k] = o.settings[k];
    }
  }
  return { ok: true };
};
