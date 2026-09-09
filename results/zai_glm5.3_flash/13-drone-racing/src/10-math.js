'use strict';
/* ============================= math ============================= */
const clamp = (x, a, b) => x < a ? a : (x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const dampf = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const DEG = Math.PI / 180;
const TAU = Math.PI * 2;

function mulberry32(seed) { let a = seed >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hash2i(x, y, s) { let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0; h = (h ^ (h >>> 13)) | 0; h = Math.imul(h, 1274126177); h = (h ^ (h >>> 16)) >>> 0; return h / 4294967296; }
function vnoise2(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2i(xi, yi, s), b = hash2i(xi + 1, yi, s), c = hash2i(xi, yi + 1, s), d = hash2i(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm2(x, y, s, oct) { oct = oct || 4; let a = 0, amp = 0.5, f = 1, sum = 0; for (let i = 0; i < oct; i++) { a += vnoise2(x * f, y * f, (s + i * 77) | 0) * amp; sum += amp; amp *= 0.5; f *= 2.03; } return a / sum; }

/* ---------- vec3 (arrays) ---------- */
function v3(x, y, z) { return [x || 0, y || 0, z || 0]; }
function vadd(o, a, b) { o[0] = a[0] + b[0]; o[1] = a[1] + b[1]; o[2] = a[2] + b[2]; return o; }
function vsub(o, a, b) { o[0] = a[0] - b[0]; o[1] = a[1] - b[1]; o[2] = a[2] - b[2]; return o; }
function vscale(o, a, s) { o[0] = a[0] * s; o[1] = a[1] * s; o[2] = a[2] * s; return o; }
function vmul(o, a, b) { o[0] = a[0] * b[0]; o[1] = a[1] * b[1]; o[2] = a[2] * b[2]; return o; }
function vdot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function vcross(o, a, b) { const x = a[1] * b[2] - a[2] * b[1], y = a[2] * b[0] - a[0] * b[2], z = a[0] * b[1] - a[1] * b[0]; o[0] = x; o[1] = y; o[2] = z; return o; }
function vlen(a) { return Math.hypot(a[0], a[1], a[2]); }
function vlen2(a) { return a[0] * a[0] + a[1] * a[1] + a[2] * a[2]; }
function vnorm(o, a) { const l = vlen(a) || 1; o[0] = a[0] / l; o[1] = a[1] / l; o[2] = a[2] / l; return o; }
function vlerp(o, a, b, t) { o[0] = a[0] + (b[0] - a[0]) * t; o[1] = a[1] + (b[1] - a[1]) * t; o[2] = a[2] + (b[2] - a[2]) * t; return o; }
function vdist(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); }
function vcopy(o, a) { o[0] = a[0]; o[1] = a[1]; o[2] = a[2]; return o; }

/* ---------- mat4 (column-major, gl-matrix style) ---------- */
function m4ident(o) { o = o || new Float32Array(16); o[0] = 1; o[1] = 0; o[2] = 0; o[3] = 0; o[4] = 0; o[5] = 1; o[6] = 0; o[7] = 0; o[8] = 0; o[9] = 0; o[10] = 1; o[11] = 0; o[12] = 0; o[13] = 0; o[14] = 0; o[15] = 1; return o; }
function m4perspective(o, fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
  o[0] = f / aspect; o[1] = 0; o[2] = 0; o[3] = 0;
  o[4] = 0; o[5] = f; o[6] = 0; o[7] = 0;
  o[8] = 0; o[9] = 0; o[10] = (far + near) * nf; o[11] = -1;
  o[12] = 0; o[13] = 0; o[14] = 2 * far * near * nf; o[15] = 0;
  return o;
}
function m4mul(o, a, b) {
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
}
function m4invert(o, m) {
  const a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3], a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7],
    a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11], a30 = m[12], a31 = m[13], a32 = m[14], a33 = m[15];
  const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10,
    b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12,
    b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30,
    b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
  let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (!det) { m4ident(o); return o; }
  det = 1.0 / det;
  o[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det; o[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
  o[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det; o[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
  o[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det; o[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
  o[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det; o[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
  o[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det; o[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
  o[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det; o[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
  o[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det; o[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
  o[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det; o[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
  return o;
}
function m4fromQuatPos(o, q, p, s) {
  const x = q[0], y = q[1], z = q[2], w = q[3];
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2, wx = w * x2, wy = w * y2, wz = w * z2;
  const sc = s === undefined ? 1 : s;
  o[0] = (1 - (yy + zz)) * sc; o[1] = (xy + wz) * sc; o[2] = (xz - wy) * sc; o[3] = 0;
  o[4] = (xy - wz) * sc; o[5] = (1 - (xx + zz)) * sc; o[6] = (yz + wx) * sc; o[7] = 0;
  o[8] = (xz + wy) * sc; o[9] = (yz - wx) * sc; o[10] = (1 - (xx + yy)) * sc; o[11] = 0;
  o[12] = p[0]; o[13] = p[1]; o[14] = p[2]; o[15] = 1;
  return o;
}
function m4transformPoint(o, m, v) {
  const x = v[0], y = v[1], z = v[2];
  const w = m[3] * x + m[7] * y + m[11] * z + m[15] || 1;
  o[0] = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w;
  o[1] = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
  o[2] = (m[2] * x + m[6] * y + m[10] * z + m[14]) / w;
  return o;
}
function m4transformDir(o, m, v) {
  const x = v[0], y = v[1], z = v[2];
  o[0] = m[0] * x + m[4] * y + m[8] * z;
  o[1] = m[1] * x + m[5] * y + m[9] * z;
  o[2] = m[2] * x + m[6] * y + m[10] * z;
  return o;
}
/* normal matrix (inverse-transpose of upper 3x3) as mat4 padded */
function m4normalFromMat4(o, m) {
  const a00 = m[0], a01 = m[1], a02 = m[2], a10 = m[4], a11 = m[5], a12 = m[6], a20 = m[8], a21 = m[9], a22 = m[10];
  const b01 = a22 * a11 - a12 * a21, b11 = -a22 * a10 + a12 * a20, b21 = a21 * a10 - a11 * a20;
  let det = a00 * b01 + a01 * b11 + a02 * b21;
  if (!det) { m4ident(o); return o; }
  det = 1 / det;
  o[0] = b01 * det; o[1] = (-a22 * a01 + a02 * a21) * det; o[2] = (a12 * a01 - a02 * a11) * det; o[3] = 0;
  o[4] = b11 * det; o[5] = (a22 * a00 - a02 * a20) * det; o[6] = (-a12 * a00 + a02 * a10) * det; o[7] = 0;
  o[8] = b21 * det; o[9] = (-a21 * a00 + a01 * a20) * det; o[10] = (a11 * a00 - a01 * a10) * det; o[11] = 0;
  o[12] = 0; o[13] = 0; o[14] = 0; o[15] = 1;
  return o;
}

/* ---------- quaternion [x,y,z,w], body: +Y up/thrust, -Z forward, +X right ---------- */
function qid() { return [0, 0, 0, 1]; }
function qmul(o, a, b) {
  const ax = a[0], ay = a[1], az = a[2], aw = a[3], bx = b[0], by = b[1], bz = b[2], bw = b[3];
  o[0] = ax * bw + aw * bx + ay * bz - az * by;
  o[1] = ay * bw + aw * by + az * bx - ax * bz;
  o[2] = az * bw + aw * bz + ax * by - ay * bx;
  o[3] = aw * bw - ax * bx - ay * by - az * bz;
  return o;
}
function qaxisAngle(o, axis, ang) {
  const h = ang * 0.5, s = Math.sin(h);
  const l = vlen(axis) || 1;
  o[0] = axis[0] / l * s; o[1] = axis[1] / l * s; o[2] = axis[2] / l * s; o[3] = Math.cos(h);
  return o;
}
function qnorm(o, a) {
  let x = a[0], y = a[1], z = a[2], w = a[3];
  let l = Math.hypot(x, y, z, w);
  if (l < 1e-9) { o[0] = 0; o[1] = 0; o[2] = 0; o[3] = 1; return o; }
  l = 1 / l;
  o[0] = x * l; o[1] = y * l; o[2] = z * l; o[3] = w * l;
  return o;
}
function qcopy(o, a) { o[0] = a[0]; o[1] = a[1]; o[2] = a[2]; o[3] = a[3]; return o; }
function qconj(o, a) { o[0] = -a[0]; o[1] = -a[1]; o[2] = -a[2]; o[3] = a[3]; return o; }
/* rotate vector by quaternion */
function qrot(o, q, v) {
  const x = v[0], y = v[1], z = v[2], qx = q[0], qy = q[1], qz = q[2], qw = q[3];
  const ix = qw * x + qy * z - qz * y, iy = qw * y + qz * x - qx * z, iz = qw * z + qx * y - qy * x, iw = -qx * x - qy * y - qz * z;
  o[0] = ix * qw + iw * -qx + iy * -qz - iz * -qy;
  o[1] = iy * qw + iw * -qy + iz * -qx - ix * -qz;
  o[2] = iz * qw + iw * -qz + ix * -qy - iy * -qx;
  return o;
}
function qnlerp(o, a, b, t) {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  const bt = d < 0 ? -t : t;
  o[0] = a[0] + (b[0] * bt - a[0]) * t; o[1] = a[1] + (b[1] * bt - a[1]) * t;
  o[2] = a[2] + (b[2] * bt - a[2]) * t; o[3] = a[3] + (b[3] * bt - a[3]) * t;
  return qnorm(o, o);
}
/* camera quaternion looking along dir with up hint (camera -Z = dir) */
function quatLookDir(o, dir, up) {
  const f = vnorm([0, 0, 0], dir);
  let rc = vcross([0, 0, 0], f, up);
  if (vlen2(rc) < 1e-6) rc = vcross([0, 0, 0], f, Math.abs(f[1]) > 0.9 ? [0, 0, 1] : [0, 1, 0]);
  const r = vnorm([0, 0, 0], rc);
  const u = vcross([0, 0, 0], r, f);
  const m00 = r[0], m01 = u[0], m02 = -f[0],
    m10 = r[1], m11 = u[1], m12 = -f[1],
    m20 = r[2], m21 = u[2], m22 = -f[2];
  const tr = m00 + m11 + m22;
  let x, y, z, w;
  if (tr > 0) { const s = 0.5 / Math.sqrt(tr + 1); w = 0.25 / s; x = (m21 - m12) * s; y = (m02 - m20) * s; z = (m10 - m01) * s; }
  else if (m00 > m11 && m00 > m22) { const s = 2 * Math.sqrt(1 + m00 - m11 - m22); w = (m21 - m12) / s; x = 0.25 * s; y = (m01 + m10) / s; z = (m02 + m20) / s; }
  else if (m11 > m22) { const s = 2 * Math.sqrt(1 + m11 - m00 - m22); w = (m02 - m20) / s; x = (m01 + m10) / s; y = 0.25 * s; z = (m12 + m21) / s; }
  else { const s = 2 * Math.sqrt(1 + m22 - m00 - m11); w = (m10 - m01) / s; x = (m02 + m20) / s; y = (m12 + m21) / s; z = 0.25 * s; }
  o[0] = x; o[1] = y; o[2] = z; o[3] = w;
  return qnorm(o, o);
}
/* axis-angle (world frame) representation of q; returns angle in o.angle, axis in o.axis */
function qtoAxisAngle(q) {
  const w = clamp(q[3], -1, 1), s = Math.sqrt(Math.max(0, 1 - w * w));
  if (s < 1e-6) return { axis: [0, 1, 0], angle: 0 };
  const inv = 1 / s;
  return { axis: [q[0] * inv, q[1] * inv, q[2] * inv], angle: 2 * Math.acos(w) };
}
function qfromYawPitchRoll(o, yaw, pitch, roll) {
  // q = qYaw(Y) ⊗ qPitch(X) ⊗ qRoll(Z): yaw (world), then pitch (body), then roll (body). Hamilton algebra.
  const cy = Math.cos(yaw / 2), sy = Math.sin(yaw / 2), cp = Math.cos(pitch / 2), sp = Math.sin(pitch / 2), cr = Math.cos(roll / 2), sr = Math.sin(roll / 2);
  o[0] = cy * sp * cr + sy * cp * sr;
  o[1] = sy * cp * cr - cy * sp * sr;
  o[2] = cy * cp * sr - sy * sp * cr;
  o[3] = cy * cp * cr;
  return qnorm(o, o);
}
