/* ============================================================================
   FLIGHT DYNAMICS

   A 5" racing quad, simulated the way one actually behaves:

     sticks -> flight-mode controller -> body-rate setpoint
            -> rate PID              -> normalised torque demand
            -> X-mixer + saturation  -> four motor commands
            -> first-order motor lag -> four actual thrusts
            -> forces & torques      -> semi-implicit integration

   Nothing here moves a camera. Everything the pilot feels is a consequence of
   four thrust vectors acting on a rigid body: motor saturation steals attitude
   authority at full throttle, tilt costs you lift, and the craft keeps its
   momentum when you let go of the sticks.
   ========================================================================== */

const FLIGHT_MODES = [
  {
    id: 'angle', short: 'ANGLE', name: 'Angle (self-levelling)',
    blurb: 'Stick position commands a bank angle. Release and the quad returns to level. Cannot flip.'
  },
  {
    id: 'horizon', short: 'HORIZ', name: 'Horizon (levelling + flips)',
    blurb: 'Self-levels near centre, becomes a rate command at full deflection — so flips are possible.'
  },
  {
    id: 'acro', short: 'ACRO', name: 'Acro (rate / manual)',
    blurb: 'Sticks command angular velocity only. No levelling anywhere. This is how real FPV is flown.'
  }
];

const DEFAULT_FLIGHT = {
  mass: 0.68,               /* kg, quad + battery */
  twr: 3.6,                 /* thrust-to-weight at full throttle, fresh pack */
  gravity: 9.81,
  dragScale: 1.0,
  rateRoll: 720, ratePitch: 700, rateYaw: 380,   /* deg/s at full stick */
  expo: 0.35, throttleExpo: 0.25,
  angleMax: 38,             /* deg of bank in angle mode */
  autoLevel: 1.0,           /* levelling authority multiplier */
  altHold: false, altHoldClimb: 4.0,
  antiCrash: 0.0,
  collisionForgiveness: 0.5,
  motorTau: 0.032, idleThrottle: 0.05,
  batteryDrain: true,
  yawTorqueCoef: 0.016,     /* metres of equivalent moment arm for prop reaction */
  armLen: 0.115,
  inertia: [0.0072, 0.0130, 0.0072],   /* pitch(x), yaw(y), roll(z) */
  kp: [0.235, 0.190, 0.235], ki: [0.32, 0.26, 0.32], kd: [0.0062, 0.0016, 0.0062],
  dragLin: [0.052, 0.062, 0.041], dragQuad: [0.020, 0.030, 0.0132],
  angDamp: [0.0018, 0.0022, 0.0018]
};

const FIXED_DT = 1 / 240;   /* physics substep — the sim never sees a variable dt */

class Drone {
  constructor(params) {
    this.P = Object.assign({}, DEFAULT_FLIGHT, params || {});
    this.p = V3.new(); this.v = V3.new(); this.q = Q.new(); this.w = V3.new();
    this.accel = V3.new(); this.accelBody = V3.new(); this.prevV = V3.new();
    this.motors = new Float64Array(4); this.motorCmd = new Float64Array(4);
    this.pidI = V3.new(); this.pidD = V3.new(); this.prevRate = V3.new();
    this.targetRate = V3.new(); this.torqueNorm = V3.new();
    this.thrustN = 0; this.battery = 1; this.batteryV = 16.8;
    this.crashed = false; this.crashTimer = 0; this.impact = 0; this.lastImpact = 0;
    this.contact = false; this.contactKind = ''; this.grounded = false;
    this.altAGL = 0; this.steps = 0; this.resets = 0; this.instabilityGuards = 0;
    this.hoverThrottle = 0; this.altHoldTarget = 0; this.altHoldActive = false;
    this.antiCrashActive = 0; this.motorSat = 0; this.distance = 0;
    this._tmp = [V3.new(), V3.new(), V3.new(), V3.new(), V3.new(), V3.new()];
    this._q1 = Q.new(); this._q2 = Q.new();
  }

  reset(pos, quat, opts) {
    V3.copy(this.p, pos); Q.copy(this.q, quat);
    V3.set(this.v, 0, 0, 0); V3.set(this.w, 0, 0, 0);
    V3.set(this.accel, 0, 0, 0); V3.set(this.prevV, 0, 0, 0);
    this.motors.fill(0); this.motorCmd.fill(0);
    V3.set(this.pidI, 0, 0, 0); V3.set(this.prevRate, 0, 0, 0);
    this.crashed = false; this.crashTimer = 0; this.impact = 0; this.contact = false;
    this.thrustN = 0; this.motorSat = 0; this.antiCrashActive = 0; this.distance = 0;
    if (!opts || !opts.keepBattery) { this.battery = 1; this.batteryV = 16.8; }
    this.resets++;
    this.altHoldTarget = pos[1];
  }

  /** throttle *command* (post-expo, what the mixer sees) that just holds hover */
  hoverCmd() {
    const P = this.P;
    const sag = 0.86 + 0.14 * this.battery;
    return clamp(1 / (P.twr * sag), 0, 1);
  }
  /** the stick position a pilot must hold for hover, i.e. expo inverted */
  hoverStick() {
    const h = this.hoverCmd(), e = this.P.throttleExpo;
    if (e < 1e-4) return h;
    let x = h;                                    /* Newton on (1-e)x + e x^3 = h */
    for (let i = 0; i < 6; i++) {
      const f = (1 - e) * x + e * x * x * x - h, d = (1 - e) + 3 * e * x * x;
      x = clamp(x - f / Math.max(1e-6, d), 0, 1);
    }
    return x;
  }
  /** kept for callers that want the old name */
  hoverFraction() { return this.hoverCmd(); }

  /** ---- one fixed substep -------------------------------------------- */
  step(dt, ctl, world) {
    const P = this.P, T = this._tmp;
    const up = T[0], fwd = T[1], right = T[2], f = T[3], vb = T[4], tq = T[5];
    Q.rot(up, this.q, VEC_UP);
    Q.rot(fwd, this.q, VEC_FWD);
    Q.rot(right, this.q, VEC_RIGHT);

    this.altAGL = this.p[1] - (world ? world.groundAt(this.p[0], this.p[2]) : 0);

    /* ---------- 1. stick shaping ---------------------------------------- */
    const ex = P.expo;
    const shape = x => (1 - ex) * x + ex * x * x * x;
    let sRoll = shape(clamp(ctl.roll, -1, 1));
    let sPitch = shape(clamp(ctl.pitch, -1, 1));
    let sYaw = shape(clamp(ctl.yaw, -1, 1));
    const te = P.throttleExpo, tRaw = clamp(ctl.throttle, 0, 1);
    let sThr = (1 - te) * tRaw + te * tRaw * tRaw * tRaw;

    /* ---------- 2. flight mode -> body-rate setpoint --------------------- */
    const mode = ctl.mode || 'angle';
    const rr = P.rateRoll * DEG, rp = P.ratePitch * DEG, ry = P.rateYaw * DEG;
    /* sign conventions: +wx = nose up, +wy = yaw left, +wz = roll left */
    let tgtX = sPitch * rp, tgtY = -sYaw * ry, tgtZ = -sRoll * rr;

    if (mode !== 'acro' || P.autoLevel > 0.001) {
      /* desired body-up: world up tilted by the stick command about the
         current heading. Expressed as an axis-angle error so it stays sane
         when inverted. */
      const maxA = P.angleMax * DEG;
      const yaw = Q.yawOf(this.q);
      const cy = Math.cos(yaw), sy = Math.sin(yaw);
      /* heading basis on the ground plane */
      const hf = [-sy, 0, -cy], hr = [cy, 0, -sy];
      const tiltR = sRoll * maxA, tiltP = sPitch * maxA;
      /* desired up = rotate world up by -tiltP about hr, and tiltR about hf */
      const dq = this._q1, dq2 = this._q2;
      Q.fromAxisAngle(dq, hr[0], hr[1], hr[2], tiltP);
      Q.fromAxisAngle(dq2, hf[0], hf[1], hf[2], tiltR);
      Q.mul(dq, dq2, dq);
      const desUp = T[5]; Q.rot(desUp, dq, VEC_UP);
      /* rotation that takes current up onto desired up */
      const axis = V3.cross(V3.new(), up, desUp);
      const cosA = clamp(V3.dot(up, desUp), -1, 1);
      const ang = Math.atan2(V3.len(axis), cosA);
      V3.norm(axis, axis);
      const gainLevel = 9.5 * P.autoLevel;
      /* level command expressed in body frame */
      const bodyAxis = V3.new();
      Q.rotInv(bodyAxis, this.q, axis);
      let lvlX = bodyAxis[0] * ang * gainLevel, lvlZ = bodyAxis[2] * ang * gainLevel;
      lvlX = clamp(lvlX, -rp, rp); lvlZ = clamp(lvlZ, -rr, rr);
      if (mode === 'angle') { tgtX = lvlX; tgtZ = lvlZ; }
      else if (mode === 'horizon') {
        const dev = Math.max(Math.abs(sRoll), Math.abs(sPitch));
        const b = smoothstep(0.12, 0.92, dev);
        tgtX = lerp(lvlX, tgtX, b); tgtZ = lerp(lvlZ, tgtZ, b);
      } else if (P.autoLevel > 0.001 && ctl.acroTrainer) {
        const b = 0.25 * P.autoLevel;
        tgtX = lerp(tgtX, tgtX + lvlX * 0.4, b); tgtZ = lerp(tgtZ, tgtZ + lvlZ * 0.4, b);
      }
    }
    V3.set(this.targetRate, tgtX, tgtY, tgtZ);

    /* ---------- 3. rate PID --------------------------------------------- */
    for (let i = 0; i < 3; i++) {
      const err = this.targetRate[i] - this.w[i];
      const kp = P.kp[i], ki = P.ki[i], kd = P.kd[i];
      this.pidI[i] = clamp(this.pidI[i] + err * ki * dt, -0.32, 0.32);
      /* derivative on measurement, low-passed, to avoid setpoint kick */
      const dRate = (this.w[i] - this.prevRate[i]) / dt;
      this.pidD[i] = damp(this.pidD[i], dRate, 55, dt);
      this.prevRate[i] = this.w[i];
      this.torqueNorm[i] = clamp(kp * err + this.pidI[i] - kd * this.pidD[i], -1.2, 1.2);
    }

    /* ---------- 4. assists that actually change the commands ------------- */
    this.altHoldActive = false;
    if (P.altHold && !this.crashed) {
      const tiltCos = Math.max(0.35, up[1]);
      const hover = this.hoverFraction() / tiltCos;
      const climbCmd = (tRaw - 0.5) * 2 * P.altHoldClimb;
      if (Math.abs(tRaw - 0.5) < 0.06) {
        this.altHoldTarget = damp(this.altHoldTarget, this.p[1], 0.6, dt);
        const errAlt = clamp(this.altHoldTarget - this.p[1], -6, 6);
        sThr = hover + 0.085 * (errAlt * 1.6 - this.v[1]);
      } else {
        this.altHoldTarget = this.p[1];
        sThr = hover + 0.085 * (climbCmd - this.v[1]);
      }
      sThr = clamp(sThr, 0, 1);
      this.altHoldActive = true;
    }
    this.antiCrashActive = 0;
    if (P.antiCrash > 0.001 && !this.crashed) {
      const vDown = -this.v[1];
      const t2i = vDown > 0.2 ? this.altAGL / vDown : 99;
      const horizon = 1.1 * P.antiCrash;
      if (t2i < horizon || this.altAGL < 1.6 * P.antiCrash) {
        const urgency = clamp(1 - t2i / Math.max(0.05, horizon), 0, 1) * P.antiCrash;
        this.antiCrashActive = urgency;
        sThr = Math.max(sThr, lerp(sThr, Math.min(1, this.hoverFraction() * 1.85), urgency));
        /* fold in levelling so the recovery thrust points somewhere useful */
        this.torqueNorm[0] = lerp(this.torqueNorm[0], clamp(-this.w[0] * 0.22 + (0 - Math.asin(clamp(fwd[1], -1, 1))) * 1.6, -1, 1), urgency * 0.8);
        this.torqueNorm[2] = lerp(this.torqueNorm[2], clamp(-this.w[2] * 0.22 + Math.asin(clamp(right[1], -1, 1)) * 1.6, -1, 1), urgency * 0.8);
      }
    }
    /* armed props never stop turning: a real quad idles, which is what keeps a
       little attitude authority alive at the bottom of the throttle stick */
    if (!this.crashed) sThr = Math.max(sThr, P.idleThrottle);
    else { sThr = 0; V3.set(this.torqueNorm, 0, 0, 0); }

    /* ---------- 5. X mixer + saturation --------------------------------- */
    /* Commanded collective is preserved; the differential is scaled to fit the
       0..1 motor range. "Air mode" may lift the collective to keep attitude
       authority when the bottom motor clips — but only once there is real
       throttle behind it, so a yaw input at idle produces no free lift. */
    const tqP = this.torqueNorm[0] * 0.5, tqY = this.torqueNorm[1] * 0.5, tqR = this.torqueNorm[2] * 0.5;
    const m = this.motorCmd;
    const d0 = tqP + tqR + tqY;   /* front-right */
    const d1 = -tqP + tqR - tqY;  /* rear-right  */
    const d2 = -tqP - tqR + tqY;  /* rear-left   */
    const d3 = tqP - tqR - tqY;   /* front-left  */
    const dmax = Math.max(d0, d1, d2, d3), dmin = Math.min(d0, d1, d2, d3);
    const airmode = smoothstep(0.03, 0.22, sThr);
    let scale = 1, shift = 0;
    /* top clip: air mode lowers the collective so a roll at full throttle still
       rolls — losing altitude authority instead of attitude authority. */
    if (sThr + dmax > 1) {
      const over = sThr + dmax - 1, room = Math.max(0, sThr + dmin);
      shift = -Math.min(over, room) * airmode;
      if (sThr + shift + dmax > 1) scale = Math.min(scale, (1 - sThr - shift) / Math.max(1e-6, dmax));
    }
    /* bottom clip: air mode raises the collective, within the remaining headroom */
    const low = sThr + shift + dmin * scale;
    if (low < 0) {
      const headroom = Math.max(0, 1 - (sThr + shift + dmax * scale));
      shift += Math.min(-low, headroom) * airmode;
      if (sThr + shift + dmin * scale < 0) scale = Math.min(scale, (sThr + shift) / Math.max(1e-6, -dmin));
    }
    this.motorSat = clamp(1 - scale, 0, 1);
    m[0] = clamp(sThr + shift + d0 * scale, 0, 1);
    m[1] = clamp(sThr + shift + d1 * scale, 0, 1);
    m[2] = clamp(sThr + shift + d2 * scale, 0, 1);
    m[3] = clamp(sThr + shift + d3 * scale, 0, 1);

    /* first-order motor + prop inertia */
    const a = 1 - Math.exp(-dt / Math.max(0.004, P.motorTau));
    for (let i = 0; i < 4; i++) this.motors[i] += (m[i] - this.motors[i]) * a;

    /* ---------- 6. forces & torques ------------------------------------- */
    const sag = 0.86 + 0.14 * this.battery;
    const maxTotal = P.twr * P.mass * P.gravity * sag;
    let ge = 1;
    if (this.altAGL < 0.55 && this.altAGL > -1) ge = 1 + 0.22 * (1 - clamp(this.altAGL / 0.55, 0, 1));
    let total = 0;
    for (let i = 0; i < 4; i++) total += this.motors[i];
    const thrust = (total / 4) * maxTotal * ge;
    this.thrustN = thrust;

    V3.set(f, up[0] * thrust, up[1] * thrust, up[2] * thrust);
    f[1] -= P.mass * P.gravity;

    /* drag in body axes, then back to world */
    Q.rotInv(vb, this.q, this.v);
    const dl = P.dragLin, dq3 = P.dragQuad, ds = P.dragScale;
    const dragB = T[0];
    for (let i = 0; i < 3; i++) dragB[i] = -(dl[i] * vb[i] + dq3[i] * Math.abs(vb[i]) * vb[i]) * ds;
    const dragW = T[1]; Q.rot(dragW, this.q, dragB);
    f[0] += dragW[0]; f[1] += dragW[1]; f[2] += dragW[2];

    /* torques from the four actual thrusts */
    const L = P.armLen, kY = P.yawTorqueCoef, per = maxTotal / 4 * ge;
    const f0 = this.motors[0] * per, f1 = this.motors[1] * per, f2 = this.motors[2] * per, f3 = this.motors[3] * per;
    tq[0] = L * (f0 - f1 - f2 + f3);         /* pitch: front pair minus rear pair */
    tq[2] = L * (f0 + f1 - f2 - f3);         /* roll : right pair minus left pair */
    tq[1] = kY * (f0 - f1 + f2 - f3);        /* yaw  : prop reaction */
    const ad = P.angDamp;
    for (let i = 0; i < 3; i++) tq[i] -= ad[i] * this.w[i] * (1 + Math.abs(this.w[i]) * 0.12);

    /* ---------- 7. integrate -------------------------------------------- */
    const I = P.inertia;
    /* body-frame Euler equations incl. gyroscopic coupling */
    const wx = this.w[0], wy = this.w[1], wz = this.w[2];
    const gx = (I[1] - I[2]) * wy * wz, gy = (I[2] - I[0]) * wz * wx, gz = (I[0] - I[1]) * wx * wy;
    this.w[0] += (tq[0] - gx) / I[0] * dt;
    this.w[1] += (tq[1] - gy) / I[1] * dt;
    this.w[2] += (tq[2] - gz) / I[2] * dt;
    V3.climit(this.w, 60);
    Q.integrate(this.q, this.q, this.w, dt);

    const invM = 1 / P.mass;
    V3.copy(this.prevV, this.v);
    this.v[0] += f[0] * invM * dt; this.v[1] += f[1] * invM * dt; this.v[2] += f[2] * invM * dt;
    V3.climit(this.v, 160);
    this.p[0] += this.v[0] * dt; this.p[1] += this.v[1] * dt; this.p[2] += this.v[2] * dt;
    this.distance += Math.hypot(this.v[0], this.v[1], this.v[2]) * dt;

    this.accel[0] = (this.v[0] - this.prevV[0]) / dt;
    this.accel[1] = (this.v[1] - this.prevV[1]) / dt;
    this.accel[2] = (this.v[2] - this.prevV[2]) / dt;
    Q.rotInv(this.accelBody, this.q, this.accel);

    /* battery: drain on motor load, sag under current */
    if (P.batteryDrain && !this.crashed) {
      let load = 0;
      for (let i = 0; i < 4; i++) load += Math.pow(this.motors[i], 1.6);
      this.battery = clamp(this.battery - load * dt * 0.00135, 0, 1);
      this.batteryV = 12.6 + 4.2 * this.battery - load * 0.42;
    }

    if (this.crashed) {
      this.crashTimer += dt;
      /* tumble decays; the airframe is a brick until recovery */
      V3.mul(this.w, this.w, Math.exp(-1.2 * dt));
    }

    this.steps++;
    this.guard();
  }

  /** numerical-instability net: any non-finite state is caught and reset */
  guard() {
    if (V3.finite(this.p) && V3.finite(this.v) && Q.finite(this.q) && V3.finite(this.w)) {
      /* keep the quaternion honest even in the good path */
      const n = Math.hypot(this.q[0], this.q[1], this.q[2], this.q[3]);
      if (Math.abs(n - 1) > 1e-4) Q.norm(this.q);
      return true;
    }
    this.instabilityGuards++;
    if (!V3.finite(this.p)) V3.set(this.p, 0, 50, 0);
    if (!V3.finite(this.v)) V3.set(this.v, 0, 0, 0);
    if (!V3.finite(this.w)) V3.set(this.w, 0, 0, 0);
    if (!Q.finite(this.q)) Q.ident(this.q);
    V3.set(this.pidI, 0, 0, 0);
    this.motors.fill(0);
    return false;
  }

  speed() { return V3.len(this.v); }
  /** signed forward airspeed, for the HUD tape */
  forwardSpeed() { const b = V3.new(); Q.rotInv(b, this.q, this.v); return -b[2]; }
  motorLoad() { return (this.motors[0] + this.motors[1] + this.motors[2] + this.motors[3]) / 4; }
}
