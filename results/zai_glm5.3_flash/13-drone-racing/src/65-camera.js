'use strict';
/* ============================= cameras ============================= */
const Cam = {
  mode: 'fpv',
  modes: ['fpv', 'chase', 'orbit', 'trackside'],
  orbitYaw: 2.4, orbitPitch: 0.3, orbitDist: 9,
  chasePos: v3(), chaseInit: false,
  trackIdx: -1,
  shake: 0,
  eye: v3(), quat: qid(), fov: 100,
  label: 'FPV',
};

Cam.setMode = function (m) {
  if (!Cam.modes.includes(m)) return;
  Cam.mode = m;
  Cam.label = { fpv: 'FPV', chase: 'CHASE', orbit: 'ORBIT', trackside: 'TRACKSIDE' }[m];
  Cam.chaseInit = false;
};

Cam.cycle = function (dir) {
  const i = Cam.modes.indexOf(Cam.mode);
  Cam.setMode(Cam.modes[(i + dir + Cam.modes.length) % Cam.modes.length]);
};

Cam.addShake = function (amt) { Cam.shake = Math.min(1.2, Cam.shake + amt); };

Cam.update = function (dt, D, W, P, orb) {
  Cam.orbitYaw -= orb.dx * 0.006;
  Cam.orbitPitch = clamp(Cam.orbitPitch + orb.dy * 0.004, -0.15, 1.35);
  Cam.orbitDist = clamp(Cam.orbitDist * Math.exp(orb.wheel * 0.0009), 2.5, 45);
  Cam.shake = Math.max(0, Cam.shake - dt * 2.2);
  const att = droneAttitude(D);
  const spd = vlen(D.vel);
  let eye = Cam.eye, q = Cam.quat, fov = P.fov;

  if (Cam.mode === 'fpv') {
    const off = qrot([0, 0, 0], D.q, [0, 0.1, -0.1]);
    eye[0] = D.pos[0] + off[0]; eye[1] = D.pos[1] + off[1]; eye[2] = D.pos[2] + off[2];
    const tilt = qaxisAngle([0, 0, 0, 0], [1, 0, 0], P.camTilt * DEG);
    qmul(q, D.q, tilt); qnorm(q, q);
    fov = P.fov + clamp(spd * 0.28, 0, 14);
  } else if (Cam.mode === 'chase') {
    const back = vnorm([0, 0, 0], [-att.fwd[0], -Math.abs(att.fwd[1]) * 0.25 - 0.18, -att.fwd[2]]);
    const dist = 4.6 + clamp(spd * 0.06, 0, 1.6);
    const desired = [D.pos[0] + back[0] * dist, D.pos[1] + back[1] * dist + 0.9, D.pos[2] + back[2] * dist];
    if (!Cam.chaseInit) { vcopy(Cam.chasePos, desired); Cam.chaseInit = true; }
    const k = 1 - Math.exp(-7 * dt);
    Cam.chasePos[0] += (desired[0] - Cam.chasePos[0]) * k;
    Cam.chasePos[1] += (desired[1] - Cam.chasePos[1]) * k;
    Cam.chasePos[2] += (desired[2] - Cam.chasePos[2]) * k;
    // keep above terrain
    const gh = W.height(Cam.chasePos[0], Cam.chasePos[2]) + 0.5;
    if (Cam.chasePos[1] < gh) Cam.chasePos[1] = gh;
    eye[0] = Cam.chasePos[0]; eye[1] = Cam.chasePos[1]; eye[2] = Cam.chasePos[2];
    const look = [D.pos[0] + D.vel[0] * 0.05, D.pos[1] + D.vel[1] * 0.05, D.pos[2] + D.vel[2] * 0.05];
    quatLookDir(q, vsub([0, 0, 0], look, eye), [0, 1, 0]);
    fov = 78;
  } else if (Cam.mode === 'orbit') {
    const cy = Math.cos(Cam.orbitPitch), sy = Math.sin(Cam.orbitPitch);
    eye[0] = D.pos[0] + Math.cos(Cam.orbitYaw) * cy * Cam.orbitDist;
    eye[1] = D.pos[1] + sy * Cam.orbitDist;
    eye[2] = D.pos[2] + Math.sin(Cam.orbitYaw) * cy * Cam.orbitDist;
    const gh = W.height(eye[0], eye[2]) + 0.4;
    if (eye[1] < gh) eye[1] = gh;
    quatLookDir(q, vsub([0, 0, 0], D.pos, eye), [0, 1, 0]);
    fov = 62;
  } else { // trackside
    const cams = W.tracksideCams;
    if (Cam.trackIdx < 0 || Cam.trackIdx >= cams.length) Cam.trackIdx = 0;
    // switch to nearest cam with hysteresis
    let best = Cam.trackIdx, bd = vdist(cams[Cam.trackIdx].pos, D.pos);
    for (let i = 0; i < cams.length; i++) {
      const d = vdist(cams[i].pos, D.pos);
      if (d < bd * 0.72) { best = i; bd = d; }
    }
    Cam.trackIdx = best;
    vcopy(eye, cams[best].pos);
    quatLookDir(q, vsub([0, 0, 0], D.pos, eye), [0, 1, 0]);
    const dist = Math.max(6, bd);
    fov = clamp(2 * Math.atan(3.4 / dist) / DEG, 14, 55);
  }

  // camera shake (crash / collision feedback)
  if (Cam.shake > 0.001) {
    const s = Cam.shake * Cam.shake * 0.12;
    eye[0] += (Math.random() - 0.5) * s; eye[1] += (Math.random() - 0.5) * s; eye[2] += (Math.random() - 0.5) * s;
  }
  Cam.fov = fov;
};
