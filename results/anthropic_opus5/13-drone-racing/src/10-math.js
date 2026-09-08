'use strict';
/* ============================================================================
   MATH — vec3 / quat / mat4. Out-parameter style to keep the hot loop
   allocation-free. Everything is right-handed: +X right, +Y up, +Z backward,
   so the craft's nose points along -Z in body space.
   ========================================================================== */
const TAU = Math.PI * 2, DEG = Math.PI / 180, RAD = 180 / Math.PI;
const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const sign = Math.sign;
const isFin = Number.isFinite;
/** exponential-decay smoothing that is correct for a variable timestep */
const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));

/* ---------------------------------------------------------------- vec3 --- */
const V3 = {
  new: (x = 0, y = 0, z = 0) => new Float64Array([x, y, z]),
  set: (o, x, y, z) => { o[0] = x; o[1] = y; o[2] = z; return o; },
  copy: (o, a) => { o[0] = a[0]; o[1] = a[1]; o[2] = a[2]; return o; },
  add: (o, a, b) => { o[0] = a[0] + b[0]; o[1] = a[1] + b[1]; o[2] = a[2] + b[2]; return o; },
  sub: (o, a, b) => { o[0] = a[0] - b[0]; o[1] = a[1] - b[1]; o[2] = a[2] - b[2]; return o; },
  mul: (o, a, s) => { o[0] = a[0] * s; o[1] = a[1] * s; o[2] = a[2] * s; return o; },
  addScaled: (o, a, b, s) => { o[0] = a[0] + b[0] * s; o[1] = a[1] + b[1] * s; o[2] = a[2] + b[2] * s; return o; },
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (o, a, b) => {
    const x = a[1] * b[2] - a[2] * b[1], y = a[2] * b[0] - a[0] * b[2], z = a[0] * b[1] - a[1] * b[0];
    o[0] = x; o[1] = y; o[2] = z; return o;
  },
  len: a => Math.hypot(a[0], a[1], a[2]),
  len2: a => a[0] * a[0] + a[1] * a[1] + a[2] * a[2],
  dist: (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]),
  norm: (o, a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; o[0] = a[0] / l; o[1] = a[1] / l; o[2] = a[2] / l; return o; },
  lerp: (o, a, b, t) => { o[0] = lerp(a[0], b[0], t); o[1] = lerp(a[1], b[1], t); o[2] = lerp(a[2], b[2], t); return o; },
  finite: a => isFin(a[0]) && isFin(a[1]) && isFin(a[2]),
  /** clamp magnitude in place */
  climit: (o, m) => { const l = Math.hypot(o[0], o[1], o[2]); if (l > m && l > 0) { const s = m / l; o[0] *= s; o[1] *= s; o[2] *= s; } return o; }
};

/* ---------------------------------------------------------------- quat --- */
/* layout [x,y,z,w]; rotates body vectors into world space */
const Q = {
  new: () => new Float64Array([0, 0, 0, 1]),
  set: (o, x, y, z, w) => { o[0] = x; o[1] = y; o[2] = z; o[3] = w; return o; },
  copy: (o, a) => { o[0] = a[0]; o[1] = a[1]; o[2] = a[2]; o[3] = a[3]; return o; },
  ident: o => Q.set(o, 0, 0, 0, 1),
  mul: (o, a, b) => {
    const ax = a[0], ay = a[1], az = a[2], aw = a[3], bx = b[0], by = b[1], bz = b[2], bw = b[3];
    o[0] = aw * bx + ax * bw + ay * bz - az * by;
    o[1] = aw * by - ax * bz + ay * bw + az * bx;
    o[2] = aw * bz + ax * by - ay * bx + az * bw;
    o[3] = aw * bw - ax * bx - ay * by - az * bz;
    return o;
  },
  norm: o => {
    let l = Math.hypot(o[0], o[1], o[2], o[3]);
    if (!isFin(l) || l < 1e-9) return Q.ident(o);
    l = 1 / l; o[0] *= l; o[1] *= l; o[2] *= l; o[3] *= l; return o;
  },
  conj: (o, a) => Q.set(o, -a[0], -a[1], -a[2], a[3]),
  fromAxisAngle: (o, ax, ay, az, ang) => {
    const l = Math.hypot(ax, ay, az); if (l < 1e-12) return Q.ident(o);
    const h = ang * 0.5, s = Math.sin(h) / l;
    return Q.set(o, ax * s, ay * s, az * s, Math.cos(h));
  },
  /** rotate vector v (body) into world by q */
  rot: (o, q, v) => {
    const x = q[0], y = q[1], z = q[2], w = q[3], vx = v[0], vy = v[1], vz = v[2];
    const tx = 2 * (y * vz - z * vy), ty = 2 * (z * vx - x * vz), tz = 2 * (x * vy - y * vx);
    o[0] = vx + w * tx + y * tz - z * ty;
    o[1] = vy + w * ty + z * tx - x * tz;
    o[2] = vz + w * tz + x * ty - y * tx;
    return o;
  },
  /** inverse rotate: world vector into body frame */
  rotInv: (o, q, v) => {
    const x = -q[0], y = -q[1], z = -q[2], w = q[3], vx = v[0], vy = v[1], vz = v[2];
    const tx = 2 * (y * vz - z * vy), ty = 2 * (z * vx - x * vz), tz = 2 * (x * vy - y * vx);
    o[0] = vx + w * tx + y * tz - z * ty;
    o[1] = vy + w * ty + z * tx - x * tz;
    o[2] = vz + w * tz + x * ty - y * tx;
    return o;
  },
  /** integrate q by body-frame angular velocity w for dt (exact exponential map) */
  integrate: (o, q, w, dt) => {
    const wx = w[0] * dt, wy = w[1] * dt, wz = w[2] * dt;
    const th = Math.hypot(wx, wy, wz);
    let dq0, dq1, dq2, dq3;
    if (th < 1e-7) { dq0 = wx * 0.5; dq1 = wy * 0.5; dq2 = wz * 0.5; dq3 = 1; }
    else { const s = Math.sin(th * 0.5) / th; dq0 = wx * s; dq1 = wy * s; dq2 = wz * s; dq3 = Math.cos(th * 0.5); }
    const t = _qtmp; Q.set(t, dq0, dq1, dq2, dq3);
    Q.mul(o, q, t);           /* body-frame rate => right multiply */
    return Q.norm(o);
  },
  slerp: (o, a, b, t) => {
    let bx = b[0], by = b[1], bz = b[2], bw = b[3];
    let cos = a[0] * bx + a[1] * by + a[2] * bz + a[3] * bw;
    if (cos < 0) { cos = -cos; bx = -bx; by = -by; bz = -bz; bw = -bw; }
    let s0, s1;
    if (cos > 0.9995) { s0 = 1 - t; s1 = t; }
    else { const th = Math.acos(clamp(cos, -1, 1)), sn = Math.sin(th); s0 = Math.sin((1 - t) * th) / sn; s1 = Math.sin(t * th) / sn; }
    o[0] = a[0] * s0 + bx * s1; o[1] = a[1] * s0 + by * s1;
    o[2] = a[2] * s0 + bz * s1; o[3] = a[3] * s0 + bw * s1;
    return Q.norm(o);
  },
  finite: a => isFin(a[0]) && isFin(a[1]) && isFin(a[2]) && isFin(a[3]),
  /** yaw about +Y from the craft's forward (-Z) axis, radians, +left */
  yawOf: q => { const f = _qv; Q.rot(f, q, VEC_FWD); return Math.atan2(-f[0], -f[2]); },
  /** Tait-Bryan-ish attitude readout for the HUD: {roll,pitch,yaw} radians */
  attitude: q => {
    const f = _qv, u = _qv2;
    Q.rot(f, q, VEC_FWD); Q.rot(u, q, VEC_UP);
    const yaw = Math.atan2(-f[0], -f[2]);
    const pitch = Math.asin(clamp(f[1], -1, 1));
    /* roll = angle of body-up around the forward axis relative to world up */
    const rightRef = _qv3;
    V3.cross(rightRef, VEC_UP, f); V3.norm(rightRef, rightRef);
    if (!V3.finite(rightRef) || V3.len2(rightRef) < 1e-9) V3.set(rightRef, 1, 0, 0);
    const upRef = _qv4; V3.cross(upRef, f, rightRef); V3.norm(upRef, upRef);
    const roll = Math.atan2(V3.dot(u, rightRef), V3.dot(u, upRef));
    return { roll, pitch, yaw };
  }
};
const _qtmp = Q.new(), _qv = V3.new(), _qv2 = V3.new(), _qv3 = V3.new(), _qv4 = V3.new();
const VEC_UP = V3.new(0, 1, 0), VEC_FWD = V3.new(0, 0, -1), VEC_RIGHT = V3.new(1, 0, 0), VEC_ZERO = V3.new();

/* ---------------------------------------------------------------- mat4 --- */
/* column-major, WebGL layout */
const M4 = {
  new: () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),
  ident: o => { o.set(M4_I); return o; },
  copy: (o, a) => { o.set(a); return o; },
  mul: (o, a, b) => {
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3], a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7],
      a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11], a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
    for (let i = 0; i < 4; i++) {
      const b0 = b[i * 4], b1 = b[i * 4 + 1], b2 = b[i * 4 + 2], b3 = b[i * 4 + 3];
      o[i * 4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
      o[i * 4 + 1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
      o[i * 4 + 2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
      o[i * 4 + 3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
    }
    return o;
  },
  perspective: (o, fovy, aspect, near, far) => {
    const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    o[0] = f / aspect; o[1] = 0; o[2] = 0; o[3] = 0;
    o[4] = 0; o[5] = f; o[6] = 0; o[7] = 0;
    o[8] = 0; o[9] = 0; o[10] = (far + near) * nf; o[11] = -1;
    o[12] = 0; o[13] = 0; o[14] = 2 * far * near * nf; o[15] = 0;
    return o;
  },
  ortho: (o, l, r, b, t, n, f) => {
    const lr = 1 / (l - r), bt = 1 / (b - t), nf = 1 / (n - f);
    o[0] = -2 * lr; o[1] = 0; o[2] = 0; o[3] = 0;
    o[4] = 0; o[5] = -2 * bt; o[6] = 0; o[7] = 0;
    o[8] = 0; o[9] = 0; o[10] = 2 * nf; o[11] = 0;
    o[12] = (l + r) * lr; o[13] = (t + b) * bt; o[14] = (f + n) * nf; o[15] = 1;
    return o;
  },
  lookAt: (o, eye, target, up) => {
    let zx = eye[0] - target[0], zy = eye[1] - target[1], zz = eye[2] - target[2];
    let l = Math.hypot(zx, zy, zz); if (l < 1e-9) { zx = 0; zy = 0; zz = 1; l = 1; }
    zx /= l; zy /= l; zz /= l;
    let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx;
    l = Math.hypot(xx, xy, xz);
    if (l < 1e-6) { xx = 1; xy = 0; xz = 0; } else { xx /= l; xy /= l; xz /= l; }
    const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    o[0] = xx; o[1] = yx; o[2] = zx; o[3] = 0;
    o[4] = xy; o[5] = yy; o[6] = zy; o[7] = 0;
    o[8] = xz; o[9] = yz; o[10] = zz; o[11] = 0;
    o[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
    o[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
    o[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
    o[15] = 1;
    return o;
  },
  /** world matrix from position + quaternion + uniform-ish scale vec */
  compose: (o, p, q, s) => {
    const x = q[0], y = q[1], z = q[2], w = q[3];
    const x2 = x + x, y2 = y + y, z2 = z + z;
    const xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2;
    const wx = w * x2, wy = w * y2, wz = w * z2;
    const sx = s[0], sy = s[1], sz = s[2];
    o[0] = (1 - (yy + zz)) * sx; o[1] = (xy + wz) * sx; o[2] = (xz - wy) * sx; o[3] = 0;
    o[4] = (xy - wz) * sy; o[5] = (1 - (xx + zz)) * sy; o[6] = (yz + wx) * sy; o[7] = 0;
    o[8] = (xz + wy) * sz; o[9] = (yz - wx) * sz; o[10] = (1 - (xx + yy)) * sz; o[11] = 0;
    o[12] = p[0]; o[13] = p[1]; o[14] = p[2]; o[15] = 1;
    return o;
  },
  invert: (o, m) => {
    const a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3], a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7],
      a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11], a30 = m[12], a31 = m[13], a32 = m[14], a33 = m[15];
    const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10,
      b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12,
      b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30,
      b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
    let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (!det) return M4.ident(o);
    det = 1 / det;
    o[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det; o[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
    o[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det; o[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
    o[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det; o[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
    o[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det; o[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
    o[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det; o[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
    o[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det; o[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
    o[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det; o[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
    o[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det; o[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
    return o;
  },
  /** transform point (w=1), returns [x,y,z,w] into out4 */
  xformPoint: (o4, m, p) => {
    const x = p[0], y = p[1], z = p[2];
    o4[0] = m[0] * x + m[4] * y + m[8] * z + m[12];
    o4[1] = m[1] * x + m[5] * y + m[9] * z + m[13];
    o4[2] = m[2] * x + m[6] * y + m[10] * z + m[14];
    o4[3] = m[3] * x + m[7] * y + m[11] * z + m[15];
    return o4;
  },
  normalMat3: (o9, m) => {   /* upper-left 3x3 inverse-transpose, good enough for uniform scales */
    o9[0] = m[0]; o9[1] = m[1]; o9[2] = m[2];
    o9[3] = m[4]; o9[4] = m[5]; o9[5] = m[6];
    o9[6] = m[8]; o9[7] = m[9]; o9[8] = m[10];
    return o9;
  }
};
const M4_I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
