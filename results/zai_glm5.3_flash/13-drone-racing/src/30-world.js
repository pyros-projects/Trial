'use strict';
/* ============================= world: environments, course, collision ============================= */
const ENVS = {
  canyon: {
    label: 'Redstone Canyon', half: 280, gateBase: 10,
    sky: { top: [0.25, 0.5, 0.85], horizon: [0.95, 0.75, 0.55], ground: [0.5, 0.32, 0.2], sun: [1.06, 0.9, 0.72], sunDir: [-0.52, 0.55, 0.32], night: 0, hemiSky: [0.38, 0.48, 0.66], hemiGnd: [0.32, 0.22, 0.16] },
    fog: { col: [0.93, 0.76, 0.58], den: 0.0021 },
    radius(th, s) { const p1 = (s % 13) * 0.7, p2 = (s % 7) * 1.13; return 120 * (1 + 0.16 * Math.sin(3 * th + p1) + 0.09 * Math.sin(7 * th + p2)); },
    height(x, z, s) {
      const th = Math.atan2(z, x), r = Math.hypot(x, z);
      const d = Math.abs(r - this.radius(th, s));
      let h = -5 + fbm2(x * 0.02, z * 0.02, s + 11) * 4;
      h += smoothstep(7, 38, d) * 36;
      h += fbm2(x * 0.008, z * 0.008, s) * 30 * smoothstep(26, 110, d);
      h += fbm2(x * 0.06, z * 0.06, s + 5) * 2.2;
      for (let k = 0; k < 3; k++) {
        const a = (s % 6) * 0.4 + k * 2.15, rr = this.radius(a, s) + 105;
        const mx = Math.cos(a) * rr, mz = Math.sin(a) * rr;
        const dd = (x - mx) * (x - mx) + (z - mz) * (z - mz);
        h += 46 * Math.exp(-dd / (2 * 24 * 24));
      }
      return h;
    },
    color(h, slope, x, z, s) {
      const band = 0.5 + 0.5 * Math.sin(h * 0.5 + fbm2(x * 0.03, z * 0.03, s + 21) * 3);
      let c = [lerp(0.62, 0.78, band), lerp(0.28, 0.4, band), lerp(0.16, 0.24, band)];
      if (slope > 0.55) { const t = smoothstep(0.55, 0.85, slope); c = [lerp(c[0], 0.42, t), lerp(c[1], 0.32, t), lerp(c[2], 0.28, t)]; }
      const n = fbm2(x * 0.15, z * 0.15, s + 31) * 0.16 - 0.08;
      return [clamp(c[0] + n, 0, 1), clamp(c[1] + n, 0, 1), clamp(c[2] + n, 0, 1)];
    },
  },
  city: {
    label: 'Neon District', half: 280, gateBase: 12,
    sky: { top: [0.015, 0.02, 0.06], horizon: [0.16, 0.12, 0.22], ground: [0.04, 0.04, 0.06], sun: [0.28, 0.32, 0.46], sunDir: [0.42, 0.62, -0.35], night: 1, hemiSky: [0.12, 0.14, 0.24], hemiGnd: [0.06, 0.06, 0.09] },
    fog: { col: [0.07, 0.07, 0.13], den: 0.0032 },
    radius(th, s) { const p1 = (s % 11) * 0.9, p2 = (s % 5) * 1.4; return 105 * (1 + 0.2 * Math.sin(2 * th + p1) + 0.1 * Math.sin(5 * th + p2)); },
    height(x, z, s) { return fbm2(x * 0.005, z * 0.005, s) * 2.4 - 0.6; },
    color(h, slope, x, z, s) {
      const n = fbm2(x * 0.2, z * 0.2, s + 9) * 0.1 - 0.05;
      const v = 0.16 + n;
      return [v, v * 1.02, v * 1.1];
    },
  },
  forest: {
    label: 'Pinewood Valley', half: 280, gateBase: 12,
    sky: { top: [0.3, 0.55, 0.9], horizon: [0.78, 0.87, 0.94], ground: [0.24, 0.3, 0.2], sun: [1.0, 0.96, 0.86], sunDir: [-0.4, 0.52, 0.46], night: 0, hemiSky: [0.42, 0.55, 0.72], hemiGnd: [0.2, 0.26, 0.16] },
    fog: { col: [0.76, 0.85, 0.92], den: 0.0026 },
    radius(th, s) { const p1 = (s % 9) * 0.8, p2 = (s % 7) * 1.05; return 112 * (1 + 0.17 * Math.sin(2 * th + p1) + 0.1 * Math.sin(6 * th + p2)); },
    height(x, z, s) { return fbm2(x * 0.011, z * 0.011, s) * 11 - 2.5 + fbm2(x * 0.045, z * 0.045, s + 3) * 1.6; },
    color(h, slope, x, z, s) {
      const n = fbm2(x * 0.08, z * 0.08, s + 41);
      let c = [0.22 + n * 0.14, 0.4 + n * 0.2, 0.14 + n * 0.08];
      if (slope > 0.45) { const t = smoothstep(0.45, 0.8, slope); c = [lerp(c[0], 0.4, t), lerp(c[1], 0.34, t), lerp(c[2], 0.26, t)]; }
      if (h > 9) { const t = smoothstep(9, 14, h); c = [lerp(c[0], 0.5, t), lerp(c[1], 0.5, t), lerp(c[2], 0.48, t)]; }
      return [clamp(c[0], 0, 1), clamp(c[1], 0, 1), clamp(c[2], 0, 1)];
    },
  },
  industrial: {
    label: 'Harbor Docks', half: 280, gateBase: 11,
    sky: { top: [0.36, 0.42, 0.52], horizon: [0.72, 0.62, 0.56], ground: [0.28, 0.28, 0.3], sun: [0.75, 0.7, 0.66], sunDir: [-0.25, 0.4, 0.62], night: 0.15, hemiSky: [0.36, 0.4, 0.48], hemiGnd: [0.24, 0.24, 0.26] },
    fog: { col: [0.58, 0.56, 0.55], den: 0.0035 },
    radius(th, s) { const p1 = (s % 8) * 0.95, p2 = (s % 6) * 1.2; return 100 * (1 + 0.2 * Math.sin(3 * th + p1) + 0.1 * Math.sin(4 * th + p2)); },
    height(x, z, s) { return fbm2(x * 0.008, z * 0.008, s) * 1.8 - 0.5; },
    color(h, slope, x, z, s) {
      const n = fbm2(x * 0.12, z * 0.12, s + 17) * 0.12 - 0.06;
      const v = 0.34 + n;
      return [v, v, v * 1.02];
    },
  },
};

const PRESETS = [
  { id: 'canyon-sprint', name: 'Canyon Sprint', env: 'canyon', seed: 1337, diff: 0.35 },
  { id: 'neon-nights', name: 'Neon Nights', env: 'city', seed: 7331, diff: 0.55 },
  { id: 'forest-weave', name: 'Forest Weave', env: 'forest', seed: 42, diff: 0.5 },
  { id: 'dock-runs', name: 'Harbor Docks', env: 'industrial', seed: 909, diff: 0.55 },
  { id: 'canyon-gauntlet', name: 'Canyon Gauntlet', env: 'canyon', seed: 2024, diff: 0.9 },
];

/* Catmull-Rom on closed loop */
function crPoint(out, pts, i, t) {
  const n = pts.length;
  const p0 = pts[(i - 1 + n) % n], p1 = pts[i % n], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
  const t2 = t * t, t3 = t2 * t;
  for (let k = 0; k < 3; k++) {
    out[k] = 0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3);
  }
  return out;
}

function worldBuild(P) {
  const env = ENVS[P.env];
  const seed = P.seed | 0;
  const diff = P.diff;
  const rng = mulberry32((seed ^ 0x9e3779b9) >>> 0);
  const W = { env, envId: P.env, seed, diff, obstacles: [], gates: [], half: env.half, P };

  W.height = (x, z) => env.height(x, z, seed);
  W.normal = (x, z, out) => {
    const e = 0.6;
    const hl = W.height(x - e, z), hr = W.height(x + e, z), hd = W.height(x, z - e), hu = W.height(x, z + e);
    return vnorm(out || [0, 1, 0], [hl - hr, 2 * e, hd - hu]);
  };

  /* ---- course path ---- */
  const NC = 14, cps = [];
  for (let i = 0; i < NC; i++) {
    const th = i / NC * TAU;
    const r = env.radius(th, seed);
    const x = Math.cos(th) * r, z = Math.sin(th) * r;
    let y;
    if (P.env === 'canyon') y = W.height(x, z) + 3.2;
    else if (P.env === 'city') y = W.height(x, z) + lerp(5, 20, 0.5 + 0.5 * Math.sin(2 * th + seed));
    else if (P.env === 'forest') y = W.height(x, z) + 4.5 + 2.5 * Math.sin(3 * th + seed * 0.1);
    else y = W.height(x, z) + 4 + 5 * (0.5 + 0.5 * Math.sin(2 * th + seed * 0.13));
    cps.push([x, y, z]);
  }
  const NS = 1800, path = [], tmp = v3();
  let total = 0;
  const cum = [0];
  for (let i = 0; i < NS; i++) {
    const segF = (i / NS) * NC;         // continuous control-point index 0..NC
    crPoint(tmp, cps, Math.floor(segF), segF - Math.floor(segF));
    path.push([tmp[0], tmp[1], tmp[2]]);
    if (i > 0) { total += vdist(path[i], path[i - 1]); cum.push(total); }
  }
  total += vdist(path[0], path[NS - 1]);
  W.path = path; W.courseLen = total;
  const pathAt = (s, out, tangent) => {
    s = ((s % total) + total) % total;
    let lo = 0, hi = NS;
    while (lo < hi - 1) { const mid = (lo + hi) >> 1; if (cum[mid] <= s) lo = mid; else hi = mid; }
    const t = (s - cum[lo]) / Math.max(1e-6, (cum[lo + 1] || total) - cum[lo]);
    vlerp(out, path[lo], path[(lo + 1) % NS], clamp(t, 0, 1));
    if (tangent) vnorm(tangent, vsub(tangent, path[(lo + 3) % NS], path[(lo - 3 + NS) % NS]));
    return out;
  };
  W.pathAt = pathAt;
  const distToPathXZ = (x, z) => {
    let best = 1e9;
    for (let i = 0; i < NS; i += 3) { const dx = path[i][0] - x, dz = path[i][2] - z; const d = dx * dx + dz * dz; if (d < best) best = d; }
    return Math.sqrt(best);
  };

  /* ---- gates ---- */
  const gateCount = Math.round(env.gateBase + diff * 4);
  const gateR = lerp(4.9, 3.0, diff);
  const qz = qid(), upv = [0, 1, 0];
  for (let g = 0; g < gateCount; g++) {
    const s = g / gateCount * total;
    const c = v3(); pathAt(s, c);
    const tan = v3(); pathAt(s + 2, v3(), tan);
    const R = (g === 0 ? gateR + 1.0 : gateR);
    const gy0 = W.height(c[0], c[2]);
    c[1] = Math.max(c[1], gy0 + R + 0.6);
    const right = vnorm(v3(), vcross(v3(), upv, tan));
    const n = vnorm(v3(), tan);
    W.gates.push({ c, n, right, R, tube: 0.17, kind: g === 0 ? 'finish' : 'gate', index: g });
    W.obstacles.push({ type: 'ring', c: vcopy(v3(), c), n: vcopy(v3(), n), R, tube: 0.17 });
    // support posts when low
    const gy = W.height(c[0], c[2]);
    if (c[1] - R < gy + 6) {
      for (const side of [-1, 1]) {
        const px = c[0] + right[0] * (R + 0.5) * side, pz = c[2] + right[2] * (R + 0.5) * side;
        const ph = c[1] - gy;
        if (ph > 0.5) {
          W.obstacles.push({ type: 'cyl', x: px, z: pz, r: 0.14, y0: gy - 1, y1: gy + ph });
        }
      }
    }
  }
  W.tracksideCams = [];
  for (const f of [0.18, 0.5, 0.82]) {
    const s = f * total, c = v3(); pathAt(s, c);
    const tan = v3(); pathAt(s + 2, v3(), tan);
    const right = vnorm(v3(), vcross(v3(), upv, tan));
    const p = [c[0] - tan[0] * 22 + right[0] * 9, 0, c[2] - tan[2] * 22 + right[2] * 9];
    p[1] = Math.max(c[1] + 9, W.height(p[0], p[2]) + 9);
    W.tracksideCams.push({ pos: p });
  }

  /* ---- spawn ---- */
  const sp = v3(); pathAt(-24, sp);
  sp[1] = W.height(sp[0], sp[2]) + 0.22;
  const sf = v3(); pathAt(-24 + 4, v3(), sf);
  const yaw = Math.atan2(-sf[0], -sf[2]); // yaw such that forward (-Z rotated) ≈ tangent
  W.spawn = { pos: sp, yaw };

  /* ---- terrain mesh ---- */
  const tb = new MeshBuilder(1 << 18);
  tb.setColor([1, 1, 1]); tb.setData([0, 0, 0, 0]);
  const H = env.half, N = 176;
  const hs = new Float32Array((N + 1) * (N + 1));
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
    const x = -H + i / N * 2 * H, z = -H + j / N * 2 * H;
    hs[j * (N + 1) + i] = W.height(x, z);
  }
  const nrm = v3();
  const vid = (i, j) => j * (N + 1) + i;
  const verts = new Array((N + 1) * (N + 1));
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
    const x = -H + i / N * 2 * H, z = -H + j / N * 2 * H, h = hs[vid(i, j)];
    const e = 2 * H / N * 1.05;
    const hl = i > 0 ? hs[vid(i - 1, j)] : W.height(x - e, z), hr = i < N ? hs[vid(i + 1, j)] : W.height(x + e, z);
    const hd = j > 0 ? hs[vid(i, j - 1)] : W.height(x, z - e), hu = j < N ? hs[vid(i, j + 1)] : W.height(x, z + e);
    vnorm(nrm, [hl - hr, 2 * (2 * H / N), hd - hu]);
    const slope = 1 - nrm[1];
    const col = env.color(h, slope, x, z, seed);
    verts[vid(i, j)] = tb.vert(x, h, z, nrm[0], nrm[1], nrm[2]);
    tb.col.length -= 3; tb.col.push(col[0], col[1], col[2]);
  }
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const a = verts[vid(i, j)], b = verts[vid(i + 1, j)], c = verts[vid(i + 1, j + 1)], d = verts[vid(i, j + 1)];
    tb.idx.push(a, c, b, a, d, c);
  }
  W.meshTerrain = tb.build();

  /* ---- props ---- */
  const pb = new MeshBuilder(1 << 18);
  buildProps(W, pb, rng, distToPathXZ);
  W.meshProps = pb.build();

  /* ---- gate torus geometry (drawn per-gate) ---- */
  const gb = new MeshBuilder(1 << 12);
  gb.setColor([1, 1, 1]); gb.setData([3, 0, 0, 0]);
  gb.addTorus(1, 0.055, 40, 10);
  W.meshGate = gb.build();

  /* ---- spawn pad ---- */
  const pdb = new MeshBuilder(1 << 10);
  pdb.setColor([0.08, 0.08, 0.1]); pdb.setData([0, 0, 0, 0]);
  pdb.addDisc(sp[0], sp[1] - 0.16, sp[2], 4.4, 24, 1);
  // striped hazard ring around pad
  const ringIn = 3.4, ringOut = 4.3, ringSeg = 40, ringStart = pdb.pos.length / 3;
  pdb.setColor([1, 1, 1]); pdb.setData([2, 0, 0, 0]);
  for (let i = 0; i <= ringSeg; i++) {
    const a = i / ringSeg * TAU;
    pdb.vert(sp[0] + Math.cos(a) * ringIn, sp[1] - 0.14, sp[2] + Math.sin(a) * ringIn, 0, 1, 0);
    pdb.vert(sp[0] + Math.cos(a) * ringOut, sp[1] - 0.14, sp[2] + Math.sin(a) * ringOut, 0, 1, 0);
  }
  for (let i = 0; i < ringSeg; i++) { const a = ringStart + i * 2; pdb.quad(a, a + 1, a + 3, a + 2); }
  W.meshPad = pdb.build();

  W.courseKey = `${P.env}|${seed}|${diff.toFixed(2)}`;
  W.gateCount = gateCount;
  return W;
}

function distToPathFast(W, x, z) {
  let best = 1e9;
  const p = W.path;
  for (let i = 0; i < p.length; i += 3) { const dx = p[i][0] - x, dz = p[i][2] - z; const d = dx * dx + dz * dz; if (d < best) best = d; }
  return Math.sqrt(best);
}

function buildProps(W, pb, rng, distPath) {
  const seed = W.seed, env = W.env, diff = W.diff;
  const corridor = lerp(30, 20, diff);

  if (W.envId === 'city') {
    // central mega tower (landmark)
    const h0 = W.height(0, 0);
    pb.setColor([0.1, 0.11, 0.14]); pb.setData([1, 0.03, 0, 0]);
    pb.addBox(0, h0 + 48, 0, 24, 96, 24, 0.4);
    pb.setColor([1, 0.2, 0.25]); pb.setData([4, 0.1, 0, 0]);
    pb.addBox(0, h0 + 97, 0, 1.4, 1.4, 1.4, 0);
    pb.setColor([1, 0.5, 0.1]); pb.setData([3, 0.2, 0, 0]);
    pb.addBox(0, h0 + 92, 0, 8, 1.2, 8, 0.4);
    W.obstacles.push({ type: 'box', min: [-12, h0 - 2, -12], max: [12, h0 + 96, 12] });
    // city grid
    const step = 46;
    for (let gx = -5; gx <= 5; gx++) for (let gz = -5; gz <= 5; gz++) {
      if (gx === 0 && gz === 0) continue;
      const cx = gx * step + (rng() - 0.5) * 10, cz = gz * step + (rng() - 0.5) * 10;
      if (Math.hypot(cx, cz) > 250) continue;
      if (distPath(cx, cz) < corridor + 8) continue;
      if (rng() < 0.22) continue;
      const bw = 12 + rng() * 14, bd = 12 + rng() * 14, bh = 9 + rng() * rng() * 52;
      const by = W.height(cx, cz);
      const rot = Math.round(rng() * 4) * Math.PI / 2;
      pb.setColor([0.09 + rng() * 0.05, 0.1 + rng() * 0.05, 0.12 + rng() * 0.06]);
      pb.setData([1, rng(), 0, 0]);
      pb.addBox(cx, by + bh / 2, cz, bw, bh, bd, rot);
      W.obstacles.push({ type: 'box', min: [cx - bw / 2 - 0.3, by - 2, cz - bd / 2 - 0.3], max: [cx + bw / 2 + 0.3, by + bh, cz + bd / 2 + 0.3] });
      if (rng() < 0.4) { // neon sign
        const neon = [[1, 0.15, 0.55], [0.15, 1, 0.9], [1, 0.75, 0.15], [0.4, 0.3, 1]][Math.floor(rng() * 4)];
        pb.setColor(neon); pb.setData([3, rng(), 0, 0]);
        const side = Math.floor(rng() * 4);
        const off = (side < 2 ? bw : bd) / 2 + 0.15;
        const sx = cx + (side === 0 ? off : side === 1 ? -off : (rng() - 0.5) * bw * 0.6);
        const sz = cz + (side === 2 ? off : side === 3 ? -off : (rng() - 0.5) * bd * 0.6);
        const sh = 3 + rng() * 5, sw = 1.4 + rng() * 2.2;
        const vert = rng() < 0.5;
        pb.addBox(sx, by + bh * (0.35 + rng() * 0.4), sz, vert ? sw : 0.3, vert ? 0.3 : sh, vert ? sh : sw, rot);
      }
      if (rng() < 0.25) { // rooftop antenna + beacon
        const ax = cx + (rng() - 0.5) * bw * 0.5, az = cz + (rng() - 0.5) * bd * 0.5, ah = 5 + rng() * 8;
        pb.setColor([0.2, 0.2, 0.24]); pb.setData([0, 0, 0, 0]);
        pb.addCylinder(ax, by + bh, az, 0.16, 0.1, ah, 6, true);
        pb.setColor([1, 0.25, 0.2]); pb.setData([4, rng(), 0, 0]);
        pb.addBox(ax, by + bh + ah + 0.4, az, 0.5, 0.5, 0.5, 0);
      }
    }
  } else if (W.envId === 'canyon') {
    // rock spires + dry shrubs
    const count = 60 + Math.floor(diff * 50);
    for (let i = 0; i < count; i++) {
      const a = rng() * TAU, r = 30 + rng() * 240;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (distPath(x, z) < corridor) continue;
      const gy = W.height(x, z);
      const sh = 6 + rng() * 20, sr = 1.2 + rng() * 3.5;
      pb.setColor([0.55 + rng() * 0.1, 0.34 + rng() * 0.08, 0.22]); pb.setData([0, 0, 0, 0]);
      pb.addCylinder(x, gy - 1, z, sr * 1.3, sr * (0.4 + rng() * 0.5), sh, 7, true);
      W.obstacles.push({ type: 'cyl', x, z, r: sr * 0.9, y0: gy - 1, y1: gy + sh });
    }
    for (let i = 0; i < 130; i++) {
      const a = rng() * TAU, r = 20 + rng() * 250;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (distPath(x, z) < corridor * 0.6) continue;
      const gy = W.height(x, z);
      pb.setColor([0.3 + rng() * 0.12, 0.32 + rng() * 0.1, 0.14]); pb.setData([0, 0, 0, 0]);
      pb.addCylinder(x, gy, z, 0.02, 0.9 + rng() * 0.7, 0.8 + rng() * 0.9, 5, false);
    }
  } else if (W.envId === 'forest') {
    const step = 15;
    for (let gx = -16; gx <= 16; gx++) for (let gz = -16; gz <= 16; gz++) {
      const x = gx * step + (rng() - 0.5) * 9, z = gz * step + (rng() - 0.5) * 9;
      if (Math.hypot(x, z) > 262) continue;
      if (distPath(x, z) < corridor) continue;
      if (rng() < 0.32) continue;
      const gy = W.height(x, z);
      const th = 2.4 + rng() * 2.4, cr = 2.1 + rng() * 1.5;
      const g = 0.16 + rng() * 0.14;
      pb.setColor([0.3 + rng() * 0.08, 0.2 + rng() * 0.06, 0.12]); pb.setData([0, 0, 0, 0]);
      pb.addCylinder(x, gy - 0.4, z, 0.32, 0.22, th, 6, true);
      pb.setColor([g, 0.34 + rng() * 0.18, g * 0.7]); pb.setData([0, 0, 0, 0]);
      pb.addCylinder(x, gy + th - 0.5, z, cr, 0.02, cr * 1.7, 8, true);
      pb.setColor([g * 1.1, 0.4 + rng() * 0.16, g * 0.75]); pb.setData([0, 0, 0, 0]);
      pb.addCylinder(x, gy + th + cr * 0.55, z, cr * 0.62, 0.02, cr * 1.1, 8, true);
      W.obstacles.push({ type: 'cyl', x, z, r: cr * 0.55, y0: gy - 1, y1: gy + th + cr * 1.2 });
    }
    // landmark: radio tower
    const gy = W.height(0, 0);
    pb.setColor([0.55, 0.2, 0.16]); pb.setData([0, 0, 0, 0]);
    pb.addCylinder(0, gy, 0, 1.6, 0.5, 42, 6, true);
    W.obstacles.push({ type: 'cyl', x: 0, z: 0, r: 1.4, y0: gy - 1, y1: gy + 42 });
    pb.setColor([1, 0.3, 0.2]); pb.setData([4, 0.4, 0, 0]);
    pb.addBox(0, gy + 43, 0, 1, 1, 1, 0);
  } else if (W.envId === 'industrial') {
    // container stacks
    const cols = [[0.75, 0.3, 0.12], [0.15, 0.35, 0.6], [0.7, 0.6, 0.15], [0.2, 0.5, 0.3], [0.6, 0.2, 0.2]];
    const count = 46 + Math.floor(diff * 40);
    for (let i = 0; i < count; i++) {
      const a = rng() * TAU, r = 26 + rng() * 210;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (distPath(x, z) < corridor) continue;
      const gy = W.height(x, z), rot = Math.floor(rng() * 4) * Math.PI / 2;
      const stack = 1 + Math.floor(rng() * 3);
      for (let s = 0; s < stack; s++) {
        pb.setColor(cols[Math.floor(rng() * cols.length)]); pb.setData([0, 0, 0, 0]);
        pb.addBox(x, gy + 1.3 + s * 2.65, z, 7.2, 2.6, 2.6, rot);
      }
      const horiz = (Math.round(rot / (Math.PI / 2)) % 2) === 0;
      W.obstacles.push({ type: 'box', min: [x - (horiz ? 3.7 : 1.4), gy - 0.5, z - (horiz ? 1.4 : 3.7)], max: [x + (horiz ? 3.7 : 1.4), gy + 1.3 + stack * 2.65, z + (horiz ? 1.4 : 3.7)] });
    }
    // silos
    for (let i = 0; i < 9; i++) {
      const a = rng() * TAU, r = 40 + rng() * 190;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (distPath(x, z) < corridor + 4) continue;
      const gy = W.height(x, z), sh = 11 + rng() * 9, sr = 3.4 + rng() * 2.4;
      pb.setColor([0.62, 0.62, 0.66]); pb.setData([0, 0, 0, 0]);
      pb.addCylinder(x, gy, z, sr, sr, sh, 14, true);
      pb.setColor([0.5, 0.52, 0.58]); pb.setData([0, 0, 0, 0]);
      pb.addCylinder(x, gy + sh, z, sr, 0.1, sr * 0.5, 14, true);
      W.obstacles.push({ type: 'cyl', x, z, r: sr, y0: gy - 1, y1: gy + sh + sr * 0.5 });
    }
    // gantry crane (landmark near center)
    const gy = W.height(30, -20);
    pb.setColor([0.85, 0.45, 0.1]); pb.setData([0, 0, 0, 0]);
    for (const dx of [-14, 14]) {
      pb.addBox(30 + dx, gy + 14, -20, 1.6, 28, 1.6, 0);
      W.obstacles.push({ type: 'box', min: [30 + dx - 0.8, gy - 1, -20.8], max: [30 + dx + 0.8, gy + 28, -19.2] });
    }
    pb.addBox(30, gy + 28.5, -20, 40, 2, 2.4, 0);
    W.obstacles.push({ type: 'box', min: [10, gy + 27, -21.4], max: [50, gy + 30, -18.6] });
    pb.setColor([1, 0.8, 0.2]); pb.setData([4, 0.3, 0, 0]);
    pb.addBox(30, gy + 30, -20, 0.8, 0.8, 0.8, 0);
    // hazard barrels near path
    for (let i = 0; i < 26; i++) {
      const a = rng() * TAU, r = env.radius(a, seed) + (rng() < 0.5 ? -1 : 1) * (corridor * 0.5 + rng() * 6);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (distPath(x, z) < 7) continue;
      const gy = W.height(x, z);
      pb.setColor([0.8, 0.55, 0.1]); pb.setData([2, 0, 0, 0]);
      pb.addCylinder(x, gy, z, 0.55, 0.55, 1.5, 10, true);
      W.obstacles.push({ type: 'cyl', x, z, r: 0.55, y0: gy - 0.5, y1: gy + 1.5 });
    }
  }
}

/* ---- collision: resolve sphere against world; returns contact info ---- */
function worldCollide(W, pos, r, vel, res) {
  res.contacts = 0; res.nx = 0; res.ny = 1; res.nz = 0; res.impact = 0;
  const resolve = (nx, ny, nz, depth) => {
    pos[0] += nx * depth; pos[1] += ny * depth; pos[2] += nz * depth;
    const vn = vel[0] * nx + vel[1] * ny + vel[2] * nz;
    if (vn < 0) {
      if (-vn > res.impact) { res.impact = -vn; res.nx = nx; res.ny = ny; res.nz = nz; }
      const rest = -vn < 0.7 ? 0 : 0.32;
      vel[0] -= nx * vn * (1 + rest); vel[1] -= ny * vn * (1 + rest); vel[2] -= nz * vn * (1 + rest);
      // tangential friction
      vel[0] *= 0.86; vel[1] *= 0.86; vel[2] *= 0.86;
    }
    res.contacts++;
  };
  // terrain
  const h = W.height(pos[0], pos[2]);
  if (pos[1] - r < h) {
    const n = W.normal(pos[0], pos[2], [0, 0, 0]);
    resolve(n[0], n[1], n[2], h - (pos[1] - r) + 0.001);
  }
  // obstacles
  const obs = W.obstacles;
  for (let i = 0; i < obs.length; i++) {
    const o = obs[i];
    if (o.type === 'ring') {
      const px = pos[0] - o.c[0], py = pos[1] - o.c[1], pz = pos[2] - o.c[2];
      const a = px * o.n[0] + py * o.n[1] + pz * o.n[2];
      const rx = px - o.n[0] * a, ry = py - o.n[1] * a, rz = pz - o.n[2] * a;
      const rad = Math.hypot(rx, ry, rz);
      const dr = rad - o.R;
      const tubeD = Math.sqrt(dr * dr + a * a) - (o.tube + r);
      if (tubeD < 0) {
        // collision normal: from tube centerline toward sphere center
        let nx, ny, nz;
        const radN = rad > 1e-5 ? 1 / rad : 0;
        const c1x = rx * radN * (rad - o.R), c1y = ry * radN * (rad - o.R), c1z = rz * radN * (rad - o.R);
        const c2x = o.n[0] * a, c2y = o.n[1] * a, c2z = o.n[2] * a;
        nx = c1x + c2x; ny = c1y + c2y; nz = c1z + c2z;
        const nl = Math.hypot(nx, ny, nz);
        if (nl < 1e-6) { nx = 0; ny = 1; nz = 0; } else { nx /= nl; ny /= nl; nz /= nl; }
        resolve(nx, ny, nz, -tubeD + 0.001);
      }
    } else if (o.type === 'cyl') {
      if (pos[1] < o.y0 - r || pos[1] > o.y1 + r) continue;
      const dx = pos[0] - o.x, dz = pos[2] - o.z;
      const rad = Math.hypot(dx, dz);
      const rr = o.r + r;
      if (rad < rr && rad > 1e-5) {
        resolve(dx / rad, 0, dz / rad, rr - rad + 0.001);
      }
    } else if (o.type === 'box') {
      if (pos[0] < o.min[0] - r || pos[0] > o.max[0] + r || pos[1] < o.min[1] - r || pos[1] > o.max[1] + r || pos[2] < o.min[2] - r || pos[2] > o.max[2] + r) continue;
      const cx = clamp(pos[0], o.min[0], o.max[0]), cy = clamp(pos[1], o.min[1], o.max[1]), cz = clamp(pos[2], o.min[2], o.max[2]);
      let dx = pos[0] - cx, dy = pos[1] - cy, dz = pos[2] - cz;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        if (d < r) resolve(dx / d, dy / d, dz / d, r - d + 0.001);
      } else {
        // center inside box: push along min-penetration axis
        const pens = [
          pos[0] - (o.min[0] - r), (o.max[0] + r) - pos[0],
          pos[1] - (o.min[1] - r), (o.max[1] + r) - pos[1],
          pos[2] - (o.min[2] - r), (o.max[2] + r) - pos[2]];
        let mi = 0; for (let k = 1; k < 6; k++) if (pens[k] < pens[mi]) mi = k;
        const nn = [[-1, 0, 0], [1, 0, 0], [0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1]][mi];
        resolve(nn[0], nn[1], nn[2], pens[mi] + 0.001);
      }
    }
  }
  return res;
}
