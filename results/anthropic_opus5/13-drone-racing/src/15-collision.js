/* ============================================================================
   COLLISION — a single body sphere against the terrain heightfield and the
   broadphase-culled primitive colliders. Resolution is positional (push out of
   penetration) plus an impulse that also spins the airframe, because hitting a
   gate post with one arm is what actually tips a quad over.
   ========================================================================== */

const DRONE_RADIUS = 0.17;

function closestPointOnCollider(c, p, out) {
  if (c.type === 'sphere') {
    V3.sub(out, p, c.p);
    const d = V3.len(out) || 1e-6;
    V3.mul(out, out, Math.min(1, c.r / d));
    return V3.add(out, c.p, out);
  }
  if (c.type === 'cyl') {
    const dx = p[0] - c.p[0], dz = p[2] - c.p[2];
    const dr = Math.hypot(dx, dz) || 1e-6;
    const k = Math.min(1, c.r / dr);
    out[0] = c.p[0] + dx * k;
    out[1] = clamp(p[1], c.p[1], c.p[1] + c.h);
    out[2] = c.p[2] + dz * k;
    return out;
  }
  /* box / obb: work in the collider's local frame */
  let lx = p[0] - c.p[0], ly = p[1] - c.p[1], lz = p[2] - c.p[2];
  let ca = 1, sa = 0;
  if (c.type === 'obb') {
    Q.conj(_colQ, c.q); V3.set(_colV, lx, ly, lz); Q.rot(_colV, _colQ, _colV);
    lx = _colV[0]; ly = _colV[1]; lz = _colV[2];
  } else if (c.yaw) {
    ca = Math.cos(-c.yaw); sa = Math.sin(-c.yaw);
    const nx = lx * ca - lz * sa, nz = lx * sa + lz * ca; lx = nx; lz = nz;
  }
  const qx = clamp(lx, -c.h[0], c.h[0]), qy = clamp(ly, -c.h[1], c.h[1]), qz = clamp(lz, -c.h[2], c.h[2]);
  if (c.type === 'obb') {
    V3.set(_colV, qx, qy, qz); Q.rot(_colV, c.q, _colV);
    out[0] = c.p[0] + _colV[0]; out[1] = c.p[1] + _colV[1]; out[2] = c.p[2] + _colV[2];
  } else {
    const ux = qx * ca + qz * sa, uz = -qx * sa + qz * ca;   /* inverse of the -yaw rotation */
    out[0] = c.p[0] + ux; out[1] = c.p[1] + qy; out[2] = c.p[2] + uz;
  }
  return out;
}
const _colQ = Q.new(), _colV = V3.new();

/** deepest-point normal for a sphere centre that is inside a box */
function insideBoxNormal(c, p, out) {
  let lx = p[0] - c.p[0], ly = p[1] - c.p[1], lz = p[2] - c.p[2];
  let ca = 1, sa = 0;
  if (c.type === 'obb') { Q.conj(_colQ, c.q); V3.set(_colV, lx, ly, lz); Q.rot(_colV, _colQ, _colV); lx = _colV[0]; ly = _colV[1]; lz = _colV[2]; }
  else if (c.yaw) { ca = Math.cos(-c.yaw); sa = Math.sin(-c.yaw); const nx = lx * ca - lz * sa, nz = lx * sa + lz * ca; lx = nx; lz = nz; }
  const dx = c.h[0] - Math.abs(lx), dy = c.h[1] - Math.abs(ly), dz = c.h[2] - Math.abs(lz);
  let n = [0, 0, 0], depth;
  if (dx <= dy && dx <= dz) { n = [Math.sign(lx) || 1, 0, 0]; depth = dx; }
  else if (dy <= dz) { n = [0, Math.sign(ly) || 1, 0]; depth = dy; }
  else { n = [0, 0, Math.sign(lz) || 1]; depth = dz; }
  if (c.type === 'obb') { V3.set(_colV, n[0], n[1], n[2]); Q.rot(_colV, c.q, _colV); V3.copy(out, _colV); }
  else { out[0] = n[0] * ca - n[2] * (-sa); out[1] = n[1]; out[2] = n[0] * (-sa) + n[2] * ca; V3.norm(out, out); }
  return depth;
}

class CollisionWorld {
  constructor(course) {
    this.course = course;
    this._near = [];
    this._cp = V3.new(); this._n = V3.new(); this._r = V3.new(); this._j = V3.new(); this._t = V3.new();
  }
  groundAt(x, z) { return this.course.terrain.at(x, z); }

  /**
   * Resolve one substep of contacts.
   * @returns {number} peak normal impact speed encountered this call.
   */
  resolve(drone, P, events) {
    const c = this.course, r = DRONE_RADIUS;
    const forgive = clamp(P.collisionForgiveness, 0, 1);
    const restitution = lerp(0.42, 0.12, forgive);
    const friction = lerp(0.30, 0.55, forgive);
    const spinTransfer = lerp(9.0, 3.0, forgive);
    let peak = 0;
    drone.contact = false; drone.grounded = false; drone.contactKind = '';

    /* ---- terrain ---- */
    const th = c.terrain.at(drone.p[0], drone.p[2]);
    if (drone.p[1] - r < th) {
      const n = this._n;
      c.terrain.normal(drone.p[0], drone.p[2], n);
      const depth = th + r - drone.p[1];
      peak = Math.max(peak, this._applyContact(drone, n, depth, restitution, friction, spinTransfer, 'terrain', events));
      drone.grounded = true; drone.contactKind = 'terrain';
    }

    /* ---- primitives ---- */
    const near = c.grid.query(drone.p[0], drone.p[2], r + 2, this._near);
    for (let k = 0; k < near.length; k++) {
      const col = c.colliders[near[k]];
      const cp = this._cp, n = this._n;
      closestPointOnCollider(col, drone.p, cp);
      V3.sub(n, drone.p, cp);
      let d = V3.len(n), depth;
      if (d < 1e-5) {
        /* centre is inside the primitive — pick the shallowest exit face */
        if (col.type === 'sphere') { V3.set(n, 0, 1, 0); depth = col.r + r; }
        else if (col.type === 'cyl') {
          const dx = drone.p[0] - col.p[0], dz = drone.p[2] - col.p[2], dr = Math.hypot(dx, dz) || 1e-6;
          V3.set(n, dx / dr, 0, dz / dr); depth = col.r - dr + r;
        } else depth = insideBoxNormal(col, drone.p, n) + r;
      } else {
        if (d >= r) continue;
        V3.mul(n, n, 1 / d);
        depth = r - d;
      }
      peak = Math.max(peak, this._applyContact(drone, n, depth, restitution, friction, spinTransfer, col.kind, events));
      drone.contactKind = col.kind;
    }
    return peak;
  }

  _applyContact(drone, n, depth, restitution, friction, spinTransfer, kind, events) {
    if (!(depth > 0) || !V3.finite(n)) return 0;
    drone.contact = true;
    /* positional correction with a little slop so resting contact is quiet */
    const push = Math.max(0, depth - 0.002);
    drone.p[0] += n[0] * push; drone.p[1] += n[1] * push; drone.p[2] += n[2] * push;

    const vn = V3.dot(drone.v, n);
    if (vn >= 0) return 0;                       /* already separating */
    const impact = -vn;
    /* soft landings should not bounce */
    const e = impact < 1.0 ? 0 : restitution;
    const jn = -(1 + e) * vn;
    drone.v[0] += n[0] * jn; drone.v[1] += n[1] * jn; drone.v[2] += n[2] * jn;

    /* tangential friction */
    const t = this._t;
    V3.addScaled(t, drone.v, n, -V3.dot(drone.v, n));
    const tl = V3.len(t);
    if (tl > 1e-4) {
      const maxF = friction * jn;
      const f = Math.min(tl, maxF);
      V3.mul(t, t, f / tl);
      drone.v[0] -= t[0]; drone.v[1] -= t[1]; drone.v[2] -= t[2];
    }

    /* the impulse acts at the rim, so it also spins the airframe */
    if (impact > 0.6) {
      const rc = this._r;
      V3.mul(rc, n, -DRONE_RADIUS);
      const j = this._j;
      V3.set(j, n[0] * jn - t[0], n[1] * jn - t[1], n[2] * jn - t[2]);
      const tau = V3.cross(V3.new(), rc, j);
      const tb = V3.new(); Q.rotInv(tb, drone.q, tau);
      drone.w[0] += tb[0] * spinTransfer; drone.w[1] += tb[1] * spinTransfer * 0.4; drone.w[2] += tb[2] * spinTransfer;
      V3.climit(drone.w, 60);
    }
    if (impact > 0.35 && events) events.push({ type: 'impact', speed: impact, kind, n: [n[0], n[1], n[2]], p: [drone.p[0], drone.p[1], drone.p[2]] });
    return impact;
  }

  /** cylinder + ceiling play area; returns 0 inside, >0 = metres outside */
  outOfBounds(p) {
    const b = this.course.bounds;
    const rad = Math.hypot(p[0], p[2]);
    const over = Math.max(rad - b.radius, p[1] - b.ceiling, (this.groundAt(p[0], p[2]) + b.floorMargin) - p[1]);
    return Math.max(0, over);
  }
}
