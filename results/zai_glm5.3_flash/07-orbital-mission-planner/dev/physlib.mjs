// Physics prototype: velocity-Verlet N-body + scenario tuning for the orbital sandbox.
const G = 1;

export function makeState(bodies) {
  const n = bodies.length;
  const s = {
    n,
    names: bodies.map(b => b.name),
    m: new Float64Array(bodies.map(b => b.m)),
    r: new Float64Array(bodies.map(b => b.r)),
    x: new Float64Array(bodies.map(b => b.x)),
    y: new Float64Array(bodies.map(b => b.y)),
    vx: new Float64Array(bodies.map(b => b.vx)),
    vy: new Float64Array(bodies.map(b => b.vy)),
    ax: new Float64Array(n),
    ay: new Float64Array(n),
    craft: bodies.map(b => !!b.craft),
  };
  accel(s);
  return s;
}

export function accel(s) {
  const { n, m, x, y, ax, ay } = s;
  ax.fill(0); ay.fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dx = x[j] - x[i], dy = y[j] - y[i];
      const r2 = dx * dx + dy * dy + 1e-9;
      const inv = 1 / (r2 * Math.sqrt(r2));
      const fi = G * m[j] * inv, fj = G * m[i] * inv;
      ax[i] += fi * dx; ay[i] += fi * dy;
      ax[j] -= fj * dx; ay[j] -= fj * dy;
    }
  }
}

export function stepVV(s, dt) {
  const { n, x, y, vx, vy, ax, ay } = s;
  const h = dt / 2;
  for (let i = 0; i < n; i++) { x[i] += vx[i] * dt + 0.5 * ax[i] * dt * dt; y[i] += vy[i] * dt + 0.5 * ay[i] * dt * dt; vx[i] += ax[i] * h; vy[i] += ay[i] * h; }
  accel(s);
  for (let i = 0; i < n; i++) { vx[i] += ax[i] * h; vy[i] += ay[i] * h; }
}

export function run(s, t0, t1, dt, cb) {
  let t = t0;
  while (t < t1 - 1e-12) { stepVV(s, dt); t += dt; if (cb) cb(t); }
  return t;
}

// --- orbital element helpers (2D, relative to body k) ---
export function elements(s, i, k) {
  const mu = G * (s.m[k] + s.m[i]);
  const rx = s.x[i] - s.x[k], ry = s.y[i] - s.y[k];
  const vrx = s.vx[i] - s.vx[k], vry = s.vy[i] - s.vy[k];
  const r = Math.hypot(rx, ry), v2 = vrx * vrx + vry * vry;
  const eps = v2 / 2 - mu / r;
  const h = rx * vry - ry * vrx;
  const rv = rx * vrx + ry * vry;
  const ex = ((v2 - mu / r) * rx - rv * vrx) / mu;
  const ey = ((v2 - mu / r) * ry - rv * vry) / mu;
  const e = Math.hypot(ex, ey);
  const a = -mu / (2 * eps);
  return { mu, r, eps, h, e, a, ex, ey, rp: a * (1 - e), ra: e < 1 ? a * (1 + e) : NaN, T: e < 1 ? 2 * Math.PI * Math.sqrt(a * a * a / mu) : NaN };
}

export function progradeDV(s, i, k, dvMag, sign = 1) {
  const vrx = s.vx[i] - s.vx[k], vry = s.vy[i] - s.vy[k];
  const v = Math.hypot(vrx, vry);
  s.vx[i] += sign * dvMag * vrx / v; s.vy[i] += sign * dvMag * vry / v;
}

const fmt = (x, d = 4) => x.toFixed(d);

