/* ============================================================================
   RACE LOGIC — ordered checkpoint detection, lap/sector timing, penalties and
   a deterministic ghost recorder.

   Gate crossing is a swept plane test, not a proximity sphere: we take the
   segment the drone actually travelled during a physics substep, intersect it
   with the gate plane, and require the intersection to land inside the gate
   rectangle. At 40 m/s a substep is 17 cm, so nothing tunnels through.
   ========================================================================== */

const GHOST_HZ = 30;
const PENALTY_MISSED_GATE = 2.0;

class GhostRecorder {
  constructor(hz = GHOST_HZ) { this.hz = hz; this.frames = []; this.acc = 0; this.t = 0; }
  reset() { this.frames.length = 0; this.acc = 0; this.t = 0; }
  /** call once per rendered physics batch with the elapsed lap time */
  push(t, p, q, thr, force) {
    if (!force && this.frames.length && t - this.frames[this.frames.length - 1][0] < 1 / this.hz) return;
    this.frames.push([t, p[0], p[1], p[2], q[0], q[1], q[2], q[3], thr]);
  }
  serialize() { return { hz: this.hz, n: this.frames.length, frames: this.frames.map(f => f.map(v => Math.round(v * 1e4) / 1e4)) }; }
  static deserialize(o) {
    const g = new GhostRecorder(o && o.hz || GHOST_HZ);
    if (o && Array.isArray(o.frames)) g.frames = o.frames.filter(f => Array.isArray(f) && f.length >= 8 && f.every(isFin));
    return g;
  }
  get duration() { return this.frames.length ? this.frames[this.frames.length - 1][0] : 0; }
}

class GhostPlayer {
  constructor(rec) { this.rec = rec; this.i = 0; }
  /** interpolated transform at lap time t; returns false when there is no data */
  sample(t, outP, outQ) {
    const f = this.rec && this.rec.frames;
    if (!f || f.length < 2) return false;
    if (t <= f[0][0]) { V3.set(outP, f[0][1], f[0][2], f[0][3]); Q.set(outQ, f[0][4], f[0][5], f[0][6], f[0][7]); return true; }
    const last = f[f.length - 1];
    if (t >= last[0]) { V3.set(outP, last[1], last[2], last[3]); Q.set(outQ, last[4], last[5], last[6], last[7]); return true; }
    let lo = 0, hi = f.length - 1;
    while (lo + 1 < hi) { const m = (lo + hi) >> 1; if (f[m][0] <= t) lo = m; else hi = m; }
    const a = f[lo], b = f[lo + 1], span = (b[0] - a[0]) || 1, u = clamp((t - a[0]) / span, 0, 1);
    V3.set(outP, lerp(a[1], b[1], u), lerp(a[2], b[2], u), lerp(a[3], b[3], u));
    Q.slerp(outQ, Q.set(_gq1, a[4], a[5], a[6], a[7]), Q.set(_gq2, b[4], b[5], b[6], b[7]), u);
    return true;
  }
  throttleAt(t) {
    const f = this.rec && this.rec.frames; if (!f || !f.length) return 0;
    let lo = 0, hi = f.length - 1;
    while (lo + 1 < hi) { const m = (lo + hi) >> 1; if (f[m][0] <= t) lo = m; else hi = m; }
    return f[lo][8] || 0;
  }
}
const _gq1 = Q.new(), _gq2 = Q.new();

function fmtTime(s, blank = '--:--.--') {
  if (s == null || !isFin(s) || s < 0) return blank;
  const m = Math.floor(s / 60), r = s - m * 60;
  return `${String(m).padStart(2, '0')}:${r < 10 ? '0' : ''}${r.toFixed(2)}`;
}
function fmtDelta(d) {
  if (d == null || !isFin(d)) return '--';
  return (d >= 0 ? '+' : '-') + Math.abs(d).toFixed(2);
}

class Race {
  constructor(course, mode = 'timetrial') {
    this.course = course;
    this.mode = mode;
    this.events = [];
    this.recorder = new GhostRecorder();
    this.bestGhost = null;          /* GhostRecorder of the best lap */
    this.best = null;               /* {time, sectors[]} */
    this.ghostPlayer = null;
    this.reset(true);
  }

  reset(full) {
    this.armed = false;             /* clock starts on the first start-gate pass */
    this.finished = false;
    this.time = 0;                  /* total elapsed since the clock started */
    this.lapTime = 0;
    this.lap = 0;                   /* laps completed */
    this.nextGate = 0;
    this.sectorStart = 0;
    this.sectors = [];
    this.penalty = 0;
    this.lapPenalty = 0;
    this.lastLap = null;
    this.laps = [];
    this.missedCount = 0;
    this.gateCount = this.course.gates.length;
    this.wrongWayT = 0;
    this.behindGate = false;
    this.recorder.reset();
    for (const g of this.course.gates) { g.passed = false; g.missed = false; }
    if (full) { this.crashes = 0; this.resets = 0; }
    this.ghostPlayer = this.bestGhost ? new GhostPlayer(this.bestGhost) : null;
  }

  loadBest(rec) {
    if (!rec || !rec.best) return false;
    this.best = { time: rec.best.time, sectors: rec.best.sectors || [] };
    this.bestGhost = rec.ghost ? GhostRecorder.deserialize(rec.ghost) : null;
    this.ghostPlayer = this.bestGhost ? new GhostPlayer(this.bestGhost) : null;
    return true;
  }
  exportBest() {
    if (!this.best) return null;
    return { best: { time: this.best.time, sectors: this.best.sectors.slice() }, ghost: this.bestGhost ? this.bestGhost.serialize() : null };
  }

  /** live delta against the best lap's sector split, or null */
  delta() {
    if (!this.best || !this.best.sectors.length || !this.armed) return null;
    const i = this.sectors.length;                 /* sectors completed this lap */
    if (i === 0) return null;
    let mine = 0, theirs = 0;
    for (let k = 0; k < i; k++) { mine += this.sectors[k]; theirs += (this.best.sectors[k] || 0); }
    if (!theirs) return null;
    return mine - theirs;
  }

  /** advance the clock; called once per rendered frame with the accumulated dt */
  tick(dt) {
    if (!this.armed || this.finished || this.mode === 'free') return;
    this.time += dt; this.lapTime += dt;
  }

  /** swept-plane checkpoint test for one physics substep */
  substep(prev, cur, drone) {
    const gates = this.course.gates;
    for (let i = 0; i < gates.length; i++) {
      const g = gates[i];
      const dxc = cur[0] - g.pos[0], dyc = cur[1] - g.pos[1], dzc = cur[2] - g.pos[2];
      if (dxc * dxc + dyc * dyc + dzc * dzc > 3600) continue;      /* 60 m cull */
      const d0 = (prev[0] - g.pos[0]) * g.n[0] + (prev[1] - g.pos[1]) * g.n[1] + (prev[2] - g.pos[2]) * g.n[2];
      const d1 = dxc * g.n[0] + dyc * g.n[1] + dzc * g.n[2];
      if ((d0 <= 0 && d1 > 0) || (d0 >= 0 && d1 < 0)) {
        const t = d0 / ((d0 - d1) || 1e-9);
        const xx = prev[0] + (cur[0] - prev[0]) * t, xy = prev[1] + (cur[1] - prev[1]) * t, xz = prev[2] + (cur[2] - prev[2]) * t;
        const ox = xx - g.pos[0], oy = xy - g.pos[1], oz = xz - g.pos[2];
        const lu = ox * g.u[0] + oy * g.u[1] + oz * g.u[2];
        const lw = ox * g.w[0] + oy * g.w[1] + oz * g.w[2];
        const inside = Math.abs(lu) <= g.hw && Math.abs(lw) <= g.hh;
        const forward = d0 <= 0 && d1 > 0;
        if (inside && forward) this._crossed(i, drone);
        else if (!inside && forward && Math.abs(lu) <= g.hw * 2.6 && Math.abs(lw) <= g.hh * 2.6 && i === this.nextGate) {
          this.events.push({ type: 'nearmiss', gate: i });
        } else if (inside && !forward && i === ((this.nextGate - 1 + this.gateCount) % this.gateCount)) {
          this.events.push({ type: 'wrongway', gate: i });
        }
      }
    }
  }

  _crossed(i, drone) {
    const N = this.gateCount;
    if (!this.armed) {
      if (i !== 0) { this.events.push({ type: 'wronggate', gate: i, want: 0 }); return; }
      this.armed = true; this.time = 0; this.lapTime = 0; this.sectorStart = 0;
      this.sectors = []; this.lapPenalty = 0; this.nextGate = 1 % N;
      this.course.gates[0].passed = true;
      this.recorder.reset(); this.recorder.push(0, drone.p, drone.q, drone.motorLoad(), true);
      this.events.push({ type: 'start', gate: 0 });
      return;
    }
    const ahead = ((i - this.nextGate) % N + N) % N;      /* 0 = the one we want */
    if (ahead === 0) {
      this._register(i, drone);
    } else if (ahead <= Math.floor(N / 2)) {
      /* skipped `ahead` gates — penalise each and keep the race going */
      for (let k = 0; k < ahead; k++) {
        const idx = (this.nextGate + k) % N;
        this.course.gates[idx].missed = true;
        this.missedCount++;
        this.penalty += PENALTY_MISSED_GATE; this.lapPenalty += PENALTY_MISSED_GATE;
        this.events.push({ type: 'missed', gate: idx, penalty: PENALTY_MISSED_GATE });
      }
      this.nextGate = i;
      this._register(i, drone);
    } else {
      this.events.push({ type: 'wronggate', gate: i, want: this.nextGate });
    }
  }

  _register(i, drone) {
    const N = this.gateCount;
    const g = this.course.gates[i];
    g.passed = true;
    const sector = this.lapTime - this.sectorStart;
    this.sectorStart = this.lapTime;
    this.sectors.push(sector);
    this.events.push({ type: 'gate', gate: i, sector, index: this.sectors.length });
    if (i === 0) {
      /* crossing the start/finish closes the lap and opens the next one */
      const lapTotal = this.lapTime + this.lapPenalty;
      this.lap++;
      this.lastLap = { time: lapTotal, raw: this.lapTime, penalty: this.lapPenalty, sectors: this.sectors.slice() };
      this.laps.push(this.lastLap);
      let isBest = false;
      if (!this.best || lapTotal < this.best.time - 1e-6) {
        this.best = { time: lapTotal, sectors: this.sectors.slice() };
        this.bestGhost = GhostRecorder.deserialize(this.recorder.serialize());
        this.ghostPlayer = new GhostPlayer(this.bestGhost);
        isBest = true;
      }
      this.events.push({ type: 'lap', lap: this.lap, time: lapTotal, best: isBest, penalty: this.lapPenalty });
      this.lapTime = 0; this.sectorStart = 0; this.sectors = []; this.lapPenalty = 0;
      for (const gg of this.course.gates) { gg.passed = false; gg.missed = false; }
      this.course.gates[0].passed = true;
      this.recorder.reset(); this.recorder.push(0, drone.p, drone.q, drone.motorLoad(), true);
    }
    this.nextGate = (i + 1) % N;
  }

  /** direction + distance to the gate the pilot must fly through next */
  target() {
    const g = this.course.gates[this.nextGate] || this.course.gates[0];
    return g;
  }

  /** true when the drone has flown past the next gate's plane without scoring */
  updateBehind(p) {
    const g = this.target();
    const d = (p[0] - g.pos[0]) * g.n[0] + (p[1] - g.pos[1]) * g.n[1] + (p[2] - g.pos[2]) * g.n[2];
    const dist = V3.dist(p, g.pos);
    this.behindGate = this.armed && d > 10 && dist > 14 && dist < 260;
    return this.behindGate;
  }
}
