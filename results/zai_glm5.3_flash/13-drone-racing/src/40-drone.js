'use strict';
/* ============================= drone physics ============================= */
const DRONE_R = 0.18, DRONE_MASS = 0.62;

function droneCreate() {
  return {
    pos: v3(), prevPos: v3(), vel: v3(), q: qid(), lastGoodQ: qid(), w: v3(),
    throttle: 0, motors: [0, 0, 0, 0], motorAvg: 0,
    crashed: false, crashT: 0, invulnT: 0, onGround: true,
    battery: 100, voltage: 16.8, battFactor: 1,
    collisionCount: 0, lastImpact: 0, lastCollisionT: -9,
    accel: v3(), angAccel: v3(), thrustN: 0,
    instabResets: 0, simTime: 0,
    respawn: { pos: v3(), yaw: 0 },
    _res: { contacts: 0, nx: 0, ny: 1, nz: 0, impact: 0 },
    _f: v3(), _t1: v3(), _t2: v3(), _q1: qid(), _q2: qid(),
  };
}

function dronePlaceAtSpawn(D, W) {
  vcopy(D.pos, W.spawn.pos); vcopy(D.prevPos, W.spawn.pos); vcopy(D.vel, [0, 0, 0]);
  qfromYawPitchRoll(D.q, W.spawn.yaw, 0, 0); qcopy(D.lastGoodQ, D.q);
  vcopy(D.w, [0, 0, 0]);
  D.throttle = 0; D.crashed = false; D.crashT = 0; D.invulnT = 1.0;
  D.battery = 100; D.collisionCount = 0; D.onGround = true;
  vcopy(D.respawn.pos, W.spawn.pos); D.respawn.yaw = W.spawn.yaw;
}

function droneSetCheckpoint(D, gate, nextGate) {
  // respawn point: 3m before the gate, facing the next one
  const p = D.respawn.pos;
  p[0] = gate.c[0] - gate.n[0] * 3.2;
  p[1] = gate.c[1] - gate.n[1] * 3.2;
  p[2] = gate.c[2] - gate.n[2] * 3.2;
  D.respawn.yaw = Math.atan2(-nextGate.n[0], -nextGate.n[2]);
}

function droneRespawn(D) {
  vcopy(D.pos, D.respawn.pos); vcopy(D.prevPos, D.respawn.pos);
  vcopy(D.vel, [0, 0, 0]); vcopy(D.w, [0, 0, 0]);
  qfromYawPitchRoll(D.q, D.respawn.yaw, 0, 0); qcopy(D.lastGoodQ, D.q);
  D.throttle = 0; D.crashed = false; D.crashT = 0; D.invulnT = 1.2;
}

function expoCurve(x, e) { return x * (1 - e) + x * Math.abs(x) * e; }

function droneStep(D, W, P, inp, h, events) {
  D.simTime += h;
  if (D.invulnT > 0) D.invulnT -= h;

  if (D.crashed) {
    // tumble: gravity, spin decay, bounce
    D.vel[1] -= P.gravity * h;
    D.pos[0] += D.vel[0] * h; D.pos[1] += D.vel[1] * h; D.pos[2] += D.vel[2] * h;
    const dq = qaxisAngle(D._q1, [D.w[0], D.w[1], D.w[2]], vlen(D.w) * h);
    qmul(D.q, D.q, dq); qnorm(D.q, D.q);
    vscale(D.w, D.w, 1 - 0.6 * h);
    const res = worldCollide(W, D.pos, DRONE_R, D.vel, D._res);
    if (res.impact > 1.5 && events) events.crashBounce(D.pos, res.impact);
    D.crashT -= h;
    D.motorAvg = 0; D.motors[0] = D.motors[1] = D.motors[2] = D.motors[3] = 0;
    return;
  }

  /* ---- throttle smoothing (motor spool response) ---- */
  const tr = 5.5;
  D.throttle += clamp(inp.throttle - D.throttle, -tr * h, tr * h);

  /* ---- stick shaping ---- */
  const sp = expoCurve(clamp(inp.pitch, -1, 1), P.expo);
  const sr = expoCurve(clamp(inp.roll, -1, 1), P.expo);
  const sy = expoCurve(clamp(inp.yaw, -1, 1), P.expo);

  const maxP = P.ratePitch * DEG, maxR = P.rateRoll * DEG, maxY = P.rateYaw * DEG;
  const A = P.angleMax * DEG;
  const mode = P.flightMode;
  let wdx = 0, wdy = -sy * maxY, wdz = 0;

  if (mode === 'acro') {
    wdx = -sp * maxP; wdz = -sr * maxR;
    // auto-level assist when sticks near center
    if (P.autoLevel > 0.01) {
      const upw = qrot(D._t1, D.q, [0, 1, 0]);
      const cx = vcross(D._t2, upw, [0, 1, 0]);
      const s = clamp(vlen(cx), 0, 1);
      if (s > 1e-4) {
        const ang = Math.atan2(s, clamp(upw[1], -1, 1));
        const blend = P.autoLevel * clamp(1 - (Math.abs(sp) + Math.abs(sr)) * 1.6, 0, 1);
        if (blend > 0.01) {
          vnorm(cx, cx);
          const corrW = vscale(D._t2, cx, ang * 3.2 * blend);
          const corrB = qrot(D._t2, qconj(D._q1, D.q), corrW);
          wdx += corrB[0]; wdz += corrB[2];
        }
      }
    }
  } else {
    // angle & horizon: target pitch/roll angles from sticks
    let tp, tr, ffP = 0, ffR = 0;
    if (mode === 'angle') { tp = -sp * A; tr = -sr * A; }
    else {
      const satP = Math.sign(sp) * Math.min(Math.abs(sp) / 0.6, 1);
      const satR = Math.sign(sr) * Math.min(Math.abs(sr) / 0.6, 1);
      tp = -satP * A * 0.72; tr = -satR * A * 0.72;
      ffP = -sp * maxP * 0.5 * smoothstep(0.5, 1, Math.abs(sp));
      ffR = -sr * maxR * 0.5 * smoothstep(0.5, 1, Math.abs(sr));
    }
    const f = qrot(D._t1, D.q, [0, 0, -1]);
    const yaw = Math.atan2(-f[0], -f[2]);
    qfromYawPitchRoll(D._q1, yaw, tp, tr);
    const qi = qconj(D._q2, D.q);
    const qe = qmul(D._q1, D._q1, qi);
    if (qe[3] < 0) { qe[0] = -qe[0]; qe[1] = -qe[1]; qe[2] = -qe[2]; qe[3] = -qe[3]; }
    const aa = qtoAxisAngle(qe);
    const corrW = vscale(D._t1, aa.axis, aa.angle * P.angleGain);
    const corrB = qrot(D._t1, qi, corrW);
    wdx = clamp(corrB[0], -maxP * 1.7, maxP * 1.7) + ffP;
    wdz = clamp(corrB[2], -maxR * 1.7, maxR * 1.7) + ffR;
  }

  /* ---- rate P-control (motor torque response) ---- */
  const kp = 10;
  const e0 = clamp(wdx, -18, 18) - D.w[0];
  const e1 = clamp(wdy, -18, 18) - D.w[1];
  const e2 = clamp(wdz, -18, 18) - D.w[2];
  D.angAccel[0] = e0 * kp; D.angAccel[1] = e1 * kp; D.angAccel[2] = e2 * kp;
  D.w[0] += e0 * Math.min(1, kp * h);
  D.w[1] += e1 * Math.min(1, kp * h);
  D.w[2] += e2 * Math.min(1, kp * h);
  D.w[0] = clamp(D.w[0], -18, 18); D.w[1] = clamp(D.w[1], -18, 18); D.w[2] = clamp(D.w[2], -18, 18);

  /* ---- integrate orientation ---- */
  const wl = vlen(D.w);
  if (wl > 1e-6) {
    const dq = qaxisAngle(D._q1, [D.w[0] / wl, D.w[1] / wl, D.w[2] / wl], wl * h);
    qmul(D.q, D.q, dq);
    qnorm(D.q, D.q);
  }
  if (isFinite(D.q[0] + D.q[1] + D.q[2] + D.q[3])) qcopy(D.lastGoodQ, D.q);
  else { qcopy(D.q, D.lastGoodQ); D.instabResets++; }

  /* ---- thrust & altitude hold ---- */
  const upw = qrot(D._t1, D.q, [0, 1, 0]);
  let cmd;
  const ceiling = clamp(1 - (D.pos[1] - 130) / 45, 0.25, 1); // thin-air thrust fade above 130 m
  D.ceilingFade = ceiling;
  const maxThrust = P.twr * DRONE_MASS * P.gravity * D.battFactor * ceiling;
  if (P.altHold && mode !== 'acro' && upw[1] > 0.5) {
    const vyDes = clamp((D.throttle - 1 / P.twr) * 9, -4.5, 5) * Math.min(1, ceiling * 1.4);
    const F = DRONE_MASS * (P.gravity + 3.4 * (vyDes - D.vel[1])) / Math.max(0.45, upw[1]);
    cmd = clamp(F / maxThrust, 0, 1);
  } else {
    const tc = clamp(D.throttle, 0, 1);
    cmd = clamp(tc * (1 - P.throttleExpo + P.throttleExpo * tc), 0, 1); // throttle expo softens the response
  }
  D.thrustN = cmd * maxThrust;

  /* ---- forces ---- */
  const F = D._f;
  F[0] = 0; F[1] = -P.gravity * DRONE_MASS; F[2] = 0;
  F[0] += upw[0] * D.thrustN; F[1] += upw[1] * D.thrustN; F[2] += upw[2] * D.thrustN;
  const spd = vlen(D.vel);
  const kl = 0.055 * P.drag, kq = 0.0105 * P.drag;
  const dScale = kl + kq * spd;
  F[0] -= D.vel[0] * dScale; F[1] -= D.vel[1] * dScale; F[2] -= D.vel[2] * dScale;

  /* ---- anti-crash assist: predictive braking (rising terrain / walls only) ---- */
  D.antiCrashOn = false;
  if (P.antiCrash && spd > 6) {
    const dir = vnorm(D._t2, D.vel);
    const gh0 = W.height(D.pos[0], D.pos[2]);
    for (const d of [1.1, 2.0, 3.1]) {
      const px = D.pos[0] + dir[0] * d, py = D.pos[1] + dir[1] * d, pz = D.pos[2] + dir[2] * d;
      const gh = W.height(px, pz);
      const rising = gh > gh0 + 0.8 || py > 150;
      if (py < gh + 0.7 && rising) {
        const brake = 13;
        F[0] -= dir[0] * brake * DRONE_MASS; F[1] -= dir[1] * brake * DRONE_MASS * 0.4; F[2] -= dir[2] * brake * DRONE_MASS;
        D.antiCrashOn = true;
        break;
      }
    }
  }

  D.accel[0] = F[0] / DRONE_MASS; D.accel[1] = F[1] / DRONE_MASS; D.accel[2] = F[2] / DRONE_MASS;
  D.vel[0] += D.accel[0] * h; D.vel[1] += D.accel[1] * h; D.vel[2] += D.accel[2] * h;
  D.pos[0] += D.vel[0] * h; D.pos[1] += D.vel[1] * h; D.pos[2] += D.vel[2] * h;

  /* ---- collisions ---- */
  const res = worldCollide(W, D.pos, DRONE_R, D.vel, D._res);
  D.onGround = res.contacts > 0 && spd < 1.5;
  if (res.contacts > 0 && D.invulnT <= 0) {
    const thresh = lerp(4.5, 13, P.forgive);
    if (res.impact > thresh) {
      D.crashed = true; D.crashT = 1.35; D.collisionCount++;
      D.lastImpact = res.impact; D.lastCollisionT = D.simTime;
      if (events) events.crash(D.pos, res);
    } else if (res.impact > 1.2) {
      D.collisionCount++; D.lastImpact = res.impact; D.lastCollisionT = D.simTime;
      if (events) events.bump(D.pos, res);
    } else if (res.impact > 0.25 && events) {
      events.touch(D.pos, res);
    }
  }

  /* ---- battery model ---- */
  const drain = (100 / 300) * (0.32 + 0.85 * cmd);
  D.battery = Math.max(0, D.battery - drain * h);
  D.battFactor = D.battery < 15 ? lerp(0.6, 1, D.battery / 15) : 1;
  D.voltage = 10.6 + 5.7 * (D.battery / 100) - 1.6 * cmd - 0.12 * Math.sin(D.simTime * 41);
  D.motorAvg = clamp(cmd + (Math.abs(e0) + Math.abs(e1) + Math.abs(e2)) * 0.05, 0, 1.15);
  const md = D.motorAvg * 0.22;
  D.motors[0] = clamp(cmd + (-e2 + e0) * 0.05 + md * 0, 0, 1.25);
  D.motors[1] = clamp(cmd + (e2 + e0) * 0.05, 0, 1.25);
  D.motors[2] = clamp(cmd + (e2 - e0) * 0.05, 0, 1.25);
  D.motors[3] = clamp(cmd + (-e2 - e0) * 0.05, 0, 1.25);

  /* ---- hard numerical guard ---- */
  if (!isFinite(D.pos[0] + D.pos[1] + D.pos[2] + D.vel[0] + D.vel[1] + D.vel[2])) {
    D.instabResets++;
    vcopy(D.pos, D.respawn.pos); vcopy(D.vel, [0, 0, 0]); vcopy(D.w, [0, 0, 0]);
    qcopy(D.q, D.lastGoodQ);
  }
}

/* helper state for HUD */
function droneAttitude(D) {
  const f = qrot([0, 0, 0], D.q, [0, 0, -1]);
  const r = qrot([0, 0, 0], D.q, [1, 0, 0]);
  const u = qrot([0, 0, 0], D.q, [0, 1, 0]);
  return {
    fwd: f, right: r, up: u,
    pitch: Math.asin(clamp(f[1], -1, 1)),
    roll: Math.atan2(-r[1], Math.max(0.05, u[1])) * clamp(u[1], 0, 1),
    yaw: Math.atan2(-f[0], -f[2]),
    inverted: u[1] < 0,
  };
}
