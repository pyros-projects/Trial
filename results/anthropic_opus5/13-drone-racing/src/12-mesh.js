/* ============================================================================
   PROCEDURAL GEOMETRY — every vertex in the world is generated here. No models,
   no textures. Colour and a baked ambient-occlusion term live in the vertex
   attribute (rgb + ao), which is what gives the untextured surfaces their
   contact darkening.
   ========================================================================== */
class MeshBuilder {
  constructor() { this.p = []; this.n = []; this.c = []; this.i = []; }
  get count() { return this.p.length / 3; }
  vert(x, y, z, nx, ny, nz, r, g, b, ao) {
    this.p.push(x, y, z); this.n.push(nx, ny, nz); this.c.push(r, g, b, ao === undefined ? 1 : ao);
    return this.count - 1;
  }
  tri(a, b, c) { this.i.push(a, b, c); }
  quad(a, b, c, d) { this.i.push(a, b, c, a, c, d); }
  /** append another mesh (builder or built), optionally transformed */
  append(m, pos, quat, scale) {
    const P = m.pos || m.p, NN = m.nrm || m.n, C = m.col || m.c, I = m.idx || m.i;
    const nv = (m.nVert != null ? m.nVert : P.length / 3);
    const base = this.count, hasT = !!(pos || quat || scale);
    const tp = V3.new(), tn = V3.new();
    for (let v = 0; v < nv; v++) {
      let x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2];
      let nx = NN[v * 3], ny = NN[v * 3 + 1], nz = NN[v * 3 + 2];
      if (hasT) {
        if (scale) { x *= scale[0]; y *= scale[1]; z *= scale[2]; }
        if (quat) {
          V3.set(tp, x, y, z); Q.rot(tp, quat, tp); x = tp[0]; y = tp[1]; z = tp[2];
          V3.set(tn, nx, ny, nz); Q.rot(tn, quat, tn); nx = tn[0]; ny = tn[1]; nz = tn[2];
        }
        if (pos) { x += pos[0]; y += pos[1]; z += pos[2]; }
      }
      this.vert(x, y, z, nx, ny, nz, C[v * 4], C[v * 4 + 1], C[v * 4 + 2], C[v * 4 + 3]);
    }
    for (let k = 0; k < I.length; k++) this.i.push(I[k] + base);
    return this;
  }
  build() {
    return {
      pos: new Float32Array(this.p), nrm: new Float32Array(this.n),
      col: new Float32Array(this.c), idx: (this.count > 65535 ? new Uint32Array(this.i) : new Uint16Array(this.i)),
      nIdx: this.i.length, nVert: this.count
    };
  }
}

/* --- unit primitives (all centred on the origin, 1 unit across) ---------- */
function meshBox(col = [1, 1, 1], aoBottom = 0.45, aoTop = 1) {
  const b = new MeshBuilder(), h = 0.5;
  const faces = [
    [[1, 0, 0], [[h, -h, h], [h, -h, -h], [h, h, -h], [h, h, h]]],
    [[-1, 0, 0], [[-h, -h, -h], [-h, -h, h], [-h, h, h], [-h, h, -h]]],
    [[0, 1, 0], [[-h, h, h], [h, h, h], [h, h, -h], [-h, h, -h]]],
    [[0, -1, 0], [[-h, -h, -h], [h, -h, -h], [h, -h, h], [-h, -h, h]]],
    [[0, 0, 1], [[-h, -h, h], [h, -h, h], [h, h, h], [-h, h, h]]],
    [[0, 0, -1], [[h, -h, -h], [-h, -h, -h], [-h, h, -h], [h, h, -h]]]
  ];
  for (const [n, vs] of faces) {
    const idx = vs.map(v => {
      const ao = lerp(aoBottom, aoTop, clamp(v[1] + 0.5, 0, 1));
      return b.vert(v[0], v[1], v[2], n[0], n[1], n[2], col[0], col[1], col[2], ao);
    });
    b.quad(idx[0], idx[1], idx[2], idx[3]);
  }
  return b.build();
}

function meshCylinder(seg = 14, col = [1, 1, 1], capped = true, aoBottom = 0.5) {
  const b = new MeshBuilder(), h = 0.5, r = 0.5;
  for (let i = 0; i < seg; i++) {
    const a0 = i / seg * TAU, a1 = (i + 1) / seg * TAU;
    const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
    const v0 = b.vert(c0 * r, -h, s0 * r, c0, 0, s0, col[0], col[1], col[2], aoBottom);
    const v1 = b.vert(c1 * r, -h, s1 * r, c1, 0, s1, col[0], col[1], col[2], aoBottom);
    const v2 = b.vert(c1 * r, h, s1 * r, c1, 0, s1, col[0], col[1], col[2], 1);
    const v3 = b.vert(c0 * r, h, s0 * r, c0, 0, s0, col[0], col[1], col[2], 1);
    b.quad(v0, v1, v2, v3);
  }
  if (capped) {
    for (const [y, ny, ao] of [[h, 1, 1], [-h, -1, aoBottom]]) {
      const cIdx = b.vert(0, y, 0, 0, ny, 0, col[0], col[1], col[2], ao);
      const ring = [];
      for (let i = 0; i < seg; i++) {
        const a = i / seg * TAU;
        ring.push(b.vert(Math.cos(a) * r, y, Math.sin(a) * r, 0, ny, 0, col[0], col[1], col[2], ao));
      }
      for (let i = 0; i < seg; i++) {
        const a = ring[i], c2 = ring[(i + 1) % seg];
        if (ny > 0) b.tri(cIdx, a, c2); else b.tri(cIdx, c2, a);
      }
    }
  }
  return b.build();
}

function meshCone(seg = 12, col = [1, 1, 1], aoBottom = 0.45) {
  const b = new MeshBuilder(), h = 0.5, r = 0.5;
  for (let i = 0; i < seg; i++) {
    const a0 = i / seg * TAU, a1 = (i + 1) / seg * TAU, am = (a0 + a1) / 2;
    const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
    const ny = 0.45, sc = 0.9;
    const t = b.vert(0, h, 0, Math.cos(am) * sc, ny, Math.sin(am) * sc, col[0], col[1], col[2], 1);
    const v0 = b.vert(c0 * r, -h, s0 * r, c0 * sc, ny, s0 * sc, col[0], col[1], col[2], aoBottom);
    const v1 = b.vert(c1 * r, -h, s1 * r, c1 * sc, ny, s1 * sc, col[0], col[1], col[2], aoBottom);
    b.tri(t, v0, v1);
  }
  const cIdx = b.vert(0, -h, 0, 0, -1, 0, col[0], col[1], col[2], aoBottom);
  const ring = [];
  for (let i = 0; i < seg; i++) { const a = i / seg * TAU; ring.push(b.vert(Math.cos(a) * r, -h, Math.sin(a) * r, 0, -1, 0, col[0], col[1], col[2], aoBottom)); }
  for (let i = 0; i < seg; i++) b.tri(cIdx, ring[(i + 1) % seg], ring[i]);
  return b.build();
}

function meshSphere(seg = 12, rings = 8, col = [1, 1, 1]) {
  const b = new MeshBuilder(), r = 0.5;
  const grid = [];
  for (let y = 0; y <= rings; y++) {
    const row = [], phi = y / rings * Math.PI;
    for (let x = 0; x <= seg; x++) {
      const th = x / seg * TAU;
      const nx = Math.sin(phi) * Math.cos(th), ny = Math.cos(phi), nz = Math.sin(phi) * Math.sin(th);
      row.push(b.vert(nx * r, ny * r, nz * r, nx, ny, nz, col[0], col[1], col[2], lerp(0.55, 1, (ny + 1) / 2)));
    }
    grid.push(row);
  }
  for (let y = 0; y < rings; y++) for (let x = 0; x < seg; x++) b.quad(grid[y][x], grid[y + 1][x], grid[y + 1][x + 1], grid[y][x + 1]);
  return b.build();
}

/** camera-facing quad in the XY plane, 1x1, used for glows and particles */
function meshQuad(col = [1, 1, 1]) {
  const b = new MeshBuilder();
  const a = b.vert(-.5, -.5, 0, 0, 0, 1, col[0], col[1], col[2], 0);
  const c = b.vert(.5, -.5, 0, 0, 0, 1, col[0], col[1], col[2], 1);
  const d = b.vert(.5, .5, 0, 0, 0, 1, col[0], col[1], col[2], 2);
  const e = b.vert(-.5, .5, 0, 0, 0, 1, col[0], col[1], col[2], 3);
  b.quad(a, c, d, e);
  return b.build();
}

/* --- the aircraft -------------------------------------------------------- */
/* A 5" class quad in body space: +X right, +Y up, -Z nose. Arm length 0.13 m. */
function meshDrone(opts = {}) {
  const b = new MeshBuilder();
  const carbon = opts.carbon || [0.17, 0.18, 0.21];
  const accent = opts.accent || [0.05, 0.85, 1.0];
  const L = 0.115, armW = 0.020, armT = 0.010;
  const box = meshBox(carbon, 0.6, 1.0);
  const boxA = meshBox(accent, 0.7, 1.0);
  const cyl = meshCylinder(10, [0.16, 0.17, 0.2], true, 0.6);
  const q = Q.new(), p = V3.new(), s = V3.new();
  /* bottom plate + top plate */
  b.append(box, V3.set(p, 0, -0.012, 0), null, V3.set(s, 0.085, 0.007, 0.135));
  b.append(box, V3.set(p, 0, 0.030, 0), null, V3.set(s, 0.070, 0.006, 0.100));
  /* stack / battery */
  b.append(box, V3.set(p, 0, 0.012, 0.012), null, V3.set(s, 0.062, 0.036, 0.086));
  b.append(boxA, V3.set(p, 0, 0.048, 0.020), null, V3.set(s, 0.056, 0.028, 0.078));
  /* camera pod, tilted back = looking up-forward */
  Q.fromAxisAngle(q, 1, 0, 0, -0.32);
  b.append(box, V3.set(p, 0, 0.040, -0.060), q, V3.set(s, 0.040, 0.040, 0.038));
  b.append(boxA, V3.set(p, 0, 0.049, -0.079), q, V3.set(s, 0.020, 0.020, 0.008));
  /* four arms + motors */
  const arms = [[1, -1], [1, 1], [-1, 1], [-1, -1]];
  for (const [sx, sz] of arms) {
    const ax = sx * L * 0.5, az = sz * L * 0.5;
    Q.fromAxisAngle(q, 0, 1, 0, -Math.atan2(sx, sz));
    b.append(box, V3.set(p, ax, 0, az), q, V3.set(s, armW, armT, L * 1.42));
    b.append(cyl, V3.set(p, sx * L, 0.014, sz * L), null, V3.set(s, 0.052, 0.036, 0.052));
    b.append(boxA, V3.set(p, sx * L, 0.034, sz * L), null, V3.set(s, 0.030, 0.006, 0.030));
  }
  return b.build();
}

/** navigation LEDs — drawn as a separate emissive pass so the airframe stays
    readable against a night skyline without the whole body glowing */
function meshDroneLeds() {
  const b = new MeshBuilder(), L = 0.115, p = V3.new(), s = V3.new();
  const green = meshBox([0.15, 1.0, 0.35], 1, 1), red = meshBox([1.0, 0.13, 0.22], 1, 1);
  const white = meshBox([0.9, 0.97, 1.0], 1, 1);
  b.append(green, V3.set(p, L, 0.006, -L), null, V3.set(s, 0.030, 0.012, 0.030));
  b.append(green, V3.set(p, -L, 0.006, -L), null, V3.set(s, 0.030, 0.012, 0.030));
  b.append(red, V3.set(p, L, 0.006, L), null, V3.set(s, 0.030, 0.012, 0.030));
  b.append(red, V3.set(p, -L, 0.006, L), null, V3.set(s, 0.030, 0.012, 0.030));
  b.append(white, V3.set(p, 0, 0.064, 0.018), null, V3.set(s, 0.050, 0.006, 0.014));
  b.append(white, V3.set(p, 0, 0.049, -0.079), null, V3.set(s, 0.016, 0.016, 0.006));
  return b.build();
}

/** blurred propeller disc: a ring of thin triangles, drawn additively */
function meshProp(col = [0.7, 0.9, 1.0]) {
  const b = new MeshBuilder(), seg = 20, rIn = 0.10, rOut = 0.5;
  for (let i = 0; i < seg; i++) {
    const a0 = i / seg * TAU, a1 = (i + 1) / seg * TAU;
    const v0 = b.vert(Math.cos(a0) * rIn, 0, Math.sin(a0) * rIn, 0, 1, 0, col[0], col[1], col[2], 0.15);
    const v1 = b.vert(Math.cos(a1) * rIn, 0, Math.sin(a1) * rIn, 0, 1, 0, col[0], col[1], col[2], 0.15);
    const v2 = b.vert(Math.cos(a1) * rOut, 0, Math.sin(a1) * rOut, 0, 1, 0, col[0], col[1], col[2], 0.0);
    const v3 = b.vert(Math.cos(a0) * rOut, 0, Math.sin(a0) * rOut, 0, 1, 0, col[0], col[1], col[2], 0.0);
    b.quad(v0, v1, v2, v3);
  }
  return b.build();
}

/** race gate frame: square tube frame, 1x1 in XY, thickness t, drawn instanced */
function meshGateFrame(t = 0.09, col = [0.85, 0.92, 1.0]) {
  const b = new MeshBuilder(), h = 0.5, box = meshBox(col, 0.7, 1.0), p = V3.new(), s = V3.new();
  b.append(box, V3.set(p, 0, h, 0), null, V3.set(s, 1 + t, t, t));      /* top */
  b.append(box, V3.set(p, 0, -h, 0), null, V3.set(s, 1 + t, t, t));     /* bottom */
  b.append(box, V3.set(p, -h, 0, 0), null, V3.set(s, t, 1 - t, t));     /* left */
  b.append(box, V3.set(p, h, 0, 0), null, V3.set(s, t, 1 - t, t));      /* right */
  /* corner gussets so the frame reads as built, not floating */
  for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    b.append(box, V3.set(p, sx * (h - 0.07), sy * (h - 0.07), 0), null, V3.set(s, 0.13, 0.13, t * 0.7));
  }
  return b.build();
}

/** flat ring used as the pulsing gate halo (XY plane, outer radius .5) */
function meshRing(seg = 40, inner = 0.40) {
  const b = new MeshBuilder();
  for (let i = 0; i < seg; i++) {
    const a0 = i / seg * TAU, a1 = (i + 1) / seg * TAU;
    const v0 = b.vert(Math.cos(a0) * inner, Math.sin(a0) * inner, 0, 0, 0, 1, 1, 1, 1, 0);
    const v1 = b.vert(Math.cos(a1) * inner, Math.sin(a1) * inner, 0, 0, 0, 1, 1, 1, 1, 0);
    const v2 = b.vert(Math.cos(a1) * .5, Math.sin(a1) * .5, 0, 0, 0, 1, 1, 1, 1, 1);
    const v3 = b.vert(Math.cos(a0) * .5, Math.sin(a0) * .5, 0, 0, 0, 1, 1, 1, 1, 1);
    b.quad(v0, v1, v2, v3);
  }
  return b.build();
}

/** conifer: trunk + three stacked cones, merged so it is one instanced mesh */
function meshTree(rng) {
  const b = new MeshBuilder(), p = V3.new(), s = V3.new();
  const trunk = meshCylinder(7, [0.22, 0.16, 0.11], true, 0.35);
  b.append(trunk, V3.set(p, 0, 0.14, 0), null, V3.set(s, 0.09, 0.30, 0.09));
  const shades = [[0.10, 0.30, 0.14], [0.12, 0.36, 0.16], [0.15, 0.42, 0.18]];
  let y = 0.26, w = 0.62;
  for (let i = 0; i < 3; i++) {
    const cone = meshCone(9, shades[i], 0.4 + i * 0.15);
    b.append(cone, V3.set(p, 0, y, 0), null, V3.set(s, w, 0.44, w));
    y += 0.20; w *= 0.72;
  }
  return b.build();
}

/** angular boulder: a sphere pushed around by deterministic noise */
function meshRock(seed = 1) {
  const b = new MeshBuilder(), seg = 10, rings = 7;
  const grid = [];
  for (let y = 0; y <= rings; y++) {
    const row = [], phi = y / rings * Math.PI;
    for (let x = 0; x <= seg; x++) {
      const th = x / seg * TAU;
      let nx = Math.sin(phi) * Math.cos(th), ny = Math.cos(phi), nz = Math.sin(phi) * Math.sin(th);
      const d = 0.5 * (1 + 0.34 * fbm2(nx * 2.4 + 9, nz * 2.4 + ny * 1.7, seed, 2));
      const shade = 0.42 + 0.18 * fbm2(nx * 3 + 3, nz * 3, seed + 5, 2);
      row.push(b.vert(nx * d, ny * d * 0.78, nz * d, nx, ny, nz, shade, shade * 0.95, shade * 0.9,
        lerp(0.4, 1, (ny + 1) / 2)));
    }
    grid.push(row);
  }
  for (let y = 0; y < rings; y++) for (let x = 0; x < seg; x++) b.quad(grid[y][x], grid[y + 1][x], grid[y + 1][x + 1], grid[y][x + 1]);
  return b.build();
}

/** wireframe unit cube as line pairs — diagnostics only */
function wireBoxLines() {
  const h = 0.5, v = [[-h, -h, -h], [h, -h, -h], [h, -h, h], [-h, -h, h], [-h, h, -h], [h, h, -h], [h, h, h], [-h, h, h]];
  const e = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
  const out = [];
  for (const [a, c] of e) out.push(...v[a], ...v[c]);
  return new Float32Array(out);
}
/** wireframe unit sphere (3 great circles) as line pairs */
function wireSphereLines(seg = 24) {
  const out = [];
  for (let axis = 0; axis < 3; axis++) {
    for (let i = 0; i < seg; i++) {
      const a0 = i / seg * TAU, a1 = (i + 1) / seg * TAU;
      const p0 = [Math.cos(a0) * .5, Math.sin(a0) * .5, 0], p1 = [Math.cos(a1) * .5, Math.sin(a1) * .5, 0];
      const rot = p => axis === 0 ? p : (axis === 1 ? [p[0], p[2], p[1]] : [p[2], p[1], p[0]]);
      out.push(...rot(p0), ...rot(p1));
    }
  }
  return new Float32Array(out);
}
