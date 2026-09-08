/* ============================================================================
   COURSE GENERATION — deterministic from a string seed.

   Order matters and is what makes every course finishable:
     1. lay a closed loop through the world (periodic harmonics => always closes)
     2. carve a corridor into the terrain beneath that loop
     3. lift every gate to clear the carved terrain
     4. reject any obstacle whose bounds intrude into the corridor
     5. validate by walking the whole loop and fixing what is left
   ========================================================================== */

const ENVIRONMENTS = {
  neon: {
    label: 'Neon City', night: true,
    sky: { zenith: [0.016, 0.020, 0.048], horizon: [0.10, 0.05, 0.16], ground: [0.02, 0.02, 0.035] },
    sun: { dir: [-0.35, 0.42, 0.62], color: [0.55, 0.62, 1.0], intensity: 0.55 },
    ambient: [0.13, 0.15, 0.26], fog: { color: [0.07, 0.05, 0.13], density: 0.0034 },
    stars: 1.0, clouds: 0.15, gate: [0.1, 1.0, 1.0],
    terrain: { amp: 1.6, freq: 0.0035, ridged: 0, base: 0, palette: [[0.055, 0.06, 0.085], [0.09, 0.10, 0.14], [0.14, 0.15, 0.2]], grid: 1 },
    corridor: { radius: 26, depth: 1.2 }
  },
  canyon: {
    label: 'Desert Canyon', night: false,
    sky: { zenith: [0.16, 0.34, 0.66], horizon: [0.72, 0.62, 0.48], ground: [0.30, 0.22, 0.15] },
    sun: { dir: [0.42, 0.50, -0.28], color: [1.0, 0.90, 0.72], intensity: 1.45 },
    ambient: [0.30, 0.29, 0.31], fog: { color: [0.62, 0.54, 0.45], density: 0.0021 },
    stars: 0, clouds: 0.55, gate: [1.0, 0.42, 0.10],
    terrain: { amp: 54, freq: 0.0046, ridged: 1, base: -8, palette: [[0.42, 0.28, 0.18], [0.62, 0.44, 0.29], [0.78, 0.66, 0.48]], grid: 0 },
    corridor: { radius: 27, depth: 11 }
  },
  industrial: {
    label: 'Industrial Yard', night: false,
    sky: { zenith: [0.34, 0.40, 0.48], horizon: [0.60, 0.64, 0.68], ground: [0.20, 0.21, 0.22] },
    sun: { dir: [-0.30, 0.62, -0.45], color: [0.86, 0.88, 0.94], intensity: 0.95 },
    ambient: [0.32, 0.34, 0.38], fog: { color: [0.50, 0.53, 0.57], density: 0.0025 },
    stars: 0, clouds: 0.85, gate: [1.0, 0.78, 0.10],
    terrain: { amp: 3.4, freq: 0.004, ridged: 0, base: 0, palette: [[0.19, 0.20, 0.21], [0.28, 0.28, 0.29], [0.36, 0.36, 0.35]], grid: 0 },
    corridor: { radius: 24, depth: 1.0 }
  },
  forest: {
    label: 'Pine Basin', night: false,
    sky: { zenith: [0.19, 0.38, 0.62], horizon: [0.62, 0.72, 0.74], ground: [0.10, 0.16, 0.10] },
    sun: { dir: [0.55, 0.35, 0.42], color: [1.0, 0.94, 0.80], intensity: 1.20 },
    ambient: [0.25, 0.30, 0.30], fog: { color: [0.50, 0.61, 0.61], density: 0.0031 },
    stars: 0, clouds: 0.45, gate: [0.25, 1.0, 0.55],
    terrain: { amp: 15, freq: 0.0034, ridged: 0.35, base: -2, palette: [[0.13, 0.22, 0.12], [0.20, 0.30, 0.15], [0.32, 0.38, 0.22]], grid: 0 },
    corridor: { radius: 26, depth: 3.5 }
  }
};

const COURSE_PRESETS = [
  { id: 'neon-loop', name: 'Neon Loop', env: 'neon', seed: 'RAPTOR-1', gates: 9, difficulty: 1, desc: 'City circuit through the towers' },
  { id: 'canyon-run', name: 'Canyon Run', env: 'canyon', seed: 'MESA-88', gates: 9, difficulty: 1, desc: 'Carved gorge, big vertical' },
  { id: 'yard-slalom', name: 'Industrial Slalom', env: 'industrial', seed: 'YARD-77', gates: 13, difficulty: 2, desc: 'Tight gates between containers' },
  { id: 'pine-sprint', name: 'Pine Sprint', env: 'forest', seed: 'PINE-9', gates: 7, difficulty: 0, desc: 'Wide open, forgiving — start here' },
  { id: 'gauntlet', name: 'Vertical Gauntlet', env: 'canyon', seed: 'GAUNTLET-3', gates: 14, difficulty: 3, desc: 'Small gates, steep climbs' },
  { id: 'night-freeway', name: 'Night Freeway', env: 'neon', seed: 'SODIUM-12', gates: 11, difficulty: 2, desc: 'Fast, low, long straights' }
];

const DIFFICULTY = [
  { name: 'Rookie', gateW: 7.0, gateH: 5.4, amp: 0.10, obst: 0.55, corr: 1.35, vamp: 0.55 },
  { name: 'Sport', gateW: 5.4, gateH: 4.2, amp: 0.16, obst: 0.85, corr: 1.10, vamp: 0.85 },
  { name: 'Pro', gateW: 4.2, gateH: 3.4, amp: 0.22, obst: 1.15, corr: 0.92, vamp: 1.15 },
  { name: 'Insane', gateW: 3.2, gateH: 2.7, amp: 0.28, obst: 1.5, corr: 0.80, vamp: 1.45 }
];

const TERRAIN_N = 129;          /* vertices per side (128 cells) */
const TERRAIN_SIZE = 760;       /* metres across */

function generateCourse(opts) {
  const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const envKey = ENVIRONMENTS[opts.env] ? opts.env : 'neon';
  const env = ENVIRONMENTS[envKey];
  const diff = DIFFICULTY[clamp(opts.difficulty | 0, 0, 3)];
  const seedStr = String(opts.seed == null ? 'RAPTOR-1' : opts.seed);
  const seedNum = hashSeed(seedStr + '|' + envKey + '|' + opts.gateCount + '|' + opts.difficulty);
  const rng = makeRng(seedNum);
  const nGates = clamp(opts.gateCount | 0 || 9, 4, 24);

  /* ---------- 1. the loop ------------------------------------------------ */
  const R = 96 + rng.range(-8, 22) + nGates * 2.4;
  const harm = [];
  for (let k = 1; k <= 3; k++) harm.push({ a: diff.amp * rng.range(0.45, 1.0) / k, p: rng.range(0, TAU) });
  const vharm = [];
  for (let k = 1; k <= 3; k++) vharm.push({ a: (16 * diff.vamp) * rng.range(0.35, 1.0) / k, p: rng.range(0, TAU) });
  const baseY = 26 + rng.range(-4, 10);
  const dir = rng() < 0.5 ? 1 : -1;

  const rawPath = (t) => {
    const th = t * TAU * dir;
    let rr = 1;
    for (let k = 0; k < 3; k++) rr += harm[k].a * Math.sin((k + 1) * th + harm[k].p);
    let y = baseY;
    for (let k = 0; k < 3; k++) y += vharm[k].a * Math.sin((k + 1) * th + vharm[k].p);
    return [Math.cos(th) * R * rr, y, Math.sin(th) * R * rr];
  };

  const NS = 720, samples = new Float32Array(NS * 3), arc = new Float32Array(NS + 1);
  for (let i = 0; i < NS; i++) { const p = rawPath(i / NS); samples[i * 3] = p[0]; samples[i * 3 + 1] = p[1]; samples[i * 3 + 2] = p[2]; }
  for (let i = 0; i < NS; i++) {
    const j = (i + 1) % NS;
    arc[i + 1] = arc[i] + Math.hypot(samples[j * 3] - samples[i * 3], samples[j * 3 + 1] - samples[i * 3 + 1], samples[j * 3 + 2] - samples[i * 3 + 2]);
  }
  const totalLen = arc[NS];
  /** sample the loop by arc length s (metres, wraps) -> position */
  const atArc = (s, out) => {
    s = ((s % totalLen) + totalLen) % totalLen;
    let lo = 0, hi = NS;
    while (lo + 1 < hi) { const m = (lo + hi) >> 1; if (arc[m] <= s) lo = m; else hi = m; }
    const seg = arc[lo + 1] - arc[lo] || 1, f = (s - arc[lo]) / seg, j = (lo + 1) % NS;
    out[0] = lerp(samples[lo * 3], samples[j * 3], f);
    out[1] = lerp(samples[lo * 3 + 1], samples[j * 3 + 1], f);
    out[2] = lerp(samples[lo * 3 + 2], samples[j * 3 + 2], f);
    return out;
  };

  /* ---------- 2. terrain, carved under the loop -------------------------- */
  const N = TERRAIN_N, size = TERRAIN_SIZE, cell = size / (N - 1), half = size / 2;
  const heights = new Float32Array(N * N);
  const tp = env.terrain;
  for (let j = 0; j < N; j++) {
    const z = -half + j * cell;
    for (let i = 0; i < N; i++) {
      const x = -half + i * cell;
      let h;
      if (tp.ridged > 0) {
        const r = ridge2(x * tp.freq, z * tp.freq, seedNum & 0xffff, 5);
        const f = fbm2(x * tp.freq * 2.1, z * tp.freq * 2.1, (seedNum >> 3) & 0xffff, 4);
        h = tp.base + tp.amp * (r * tp.ridged + (1 - tp.ridged) * (f * 0.5 + 0.5));
      } else {
        h = tp.base + tp.amp * fbm2(x * tp.freq, z * tp.freq, seedNum & 0xffff, 4);
      }
      /* the world falls away past the play area so the horizon reads as land */
      const rad = Math.hypot(x, z);
      h += smoothstep(half * 0.62, half * 0.99, rad) * -26;
      heights[j * N + i] = h;
    }
  }

  /* corridor carve: splat the loop into a min-distance + target-height field */
  const corrR = env.corridor.radius * diff.corr;
  const carveR = corrR + 16;
  const distF = new Float32Array(N * N).fill(1e9);
  const targF = new Float32Array(N * N);
  const step = Math.max(1.5, corrR * 0.25);
  const sp = V3.new();
  for (let s = 0; s < totalLen; s += step) {
    atArc(s, sp);
    const floorY = sp[1] - env.corridor.depth;
    const i0 = Math.max(0, Math.floor((sp[0] + half - carveR) / cell)), i1 = Math.min(N - 1, Math.ceil((sp[0] + half + carveR) / cell));
    const j0 = Math.max(0, Math.floor((sp[2] + half - carveR) / cell)), j1 = Math.min(N - 1, Math.ceil((sp[2] + half + carveR) / cell));
    for (let j = j0; j <= j1; j++) {
      const z = -half + j * cell;
      for (let i = i0; i <= i1; i++) {
        const x = -half + i * cell, d = Math.hypot(x - sp[0], z - sp[2]);
        const k = j * N + i;
        if (d < distF[k]) { distF[k] = d; targF[k] = floorY; }
      }
    }
  }
  for (let k = 0; k < N * N; k++) {
    if (distF[k] > carveR) continue;
    const w = 1 - smoothstep(corrR * 0.55, carveR, distF[k]);
    if (w <= 0) continue;
    heights[k] = lerp(heights[k], Math.min(heights[k], targF[k]), w);
  }

  const terrainAt = (x, z) => {
    const fx = (x + half) / cell, fz = (z + half) / cell;
    const i = clamp(Math.floor(fx), 0, N - 2), j = clamp(Math.floor(fz), 0, N - 2);
    const tx = clamp(fx - i, 0, 1), tz = clamp(fz - j, 0, 1);
    const h00 = heights[j * N + i], h10 = heights[j * N + i + 1], h01 = heights[(j + 1) * N + i], h11 = heights[(j + 1) * N + i + 1];
    return lerp(lerp(h00, h10, tx), lerp(h01, h11, tx), tz);
  };
  const terrainNormal = (x, z, out) => {
    const e = cell * 0.75;
    const hx = terrainAt(x + e, z) - terrainAt(x - e, z);
    const hz = terrainAt(x, z + e) - terrainAt(x, z - e);
    return V3.norm(out, V3.set(out, -hx, 2 * e, -hz));
  };

  /* ---------- 3. gates --------------------------------------------------- */
  const gates = [];
  const startArc = 0;
  const hwBase = diff.gateW * 0.5, hhBase = diff.gateH * 0.5;
  const a = V3.new(), b = V3.new();
  for (let g = 0; g < nGates; g++) {
    const s = startArc + totalLen * (g / nGates);
    atArc(s, a); atArc(s + 3, b);
    const fwd = V3.norm(V3.new(), V3.sub(V3.new(), b, a));
    const right = V3.norm(V3.new(), V3.cross(V3.new(), fwd, VEC_UP));
    if (V3.len2(right) < 1e-6) V3.set(right, 1, 0, 0);
    const up = V3.norm(V3.new(), V3.cross(V3.new(), right, fwd));
    const jitter = g === 0 ? 0 : rng.range(-1, 1) * diff.amp * 12;
    const hw = hwBase * (g === 0 ? 1.25 : rng.range(0.92, 1.12));
    const hh = hhBase * (g === 0 ? 1.25 : rng.range(0.92, 1.12));
    const pos = V3.new(a[0] + right[0] * jitter, a[1], a[2] + right[2] * jitter);
    const minY = terrainAt(pos[0], pos[2]) + hh + 2.0;
    pos[1] = Math.max(pos[1], minY);
    const yaw = Math.atan2(-fwd[0], -fwd[2]);
    const q = Q.fromAxisAngle(Q.new(), 0, 1, 0, yaw);
    /* gates may bank into corners for flavour; the plane test uses the real basis */
    const bank = g === 0 ? 0 : clamp(rng.gauss() * 0.20 * diff.amp * 5, -0.55, 0.55);
    const qb = Q.mul(Q.new(), q, Q.fromAxisAngle(Q.new(), 0, 0, 1, bank));
    const n = Q.rot(V3.new(), qb, VEC_FWD);      /* gate normal = flight direction */
    const u = Q.rot(V3.new(), qb, VEC_RIGHT);
    const w = Q.rot(V3.new(), qb, VEC_UP);
    gates.push({ i: g, pos, q: qb, yaw, bank, n, u, w, hw, hh, arc: s, passed: false, missed: false });
  }

  /* ---------- 4. obstacles & landmarks ----------------------------------- */
  const inst = { box: [], cyl: [], cone: [], sphere: [], tree: [], rock: [] };
  const colliders = [];
  const addCollider = c => { colliders.push(c); return c; };

  /* distance from a point to the loop (2D) — used to keep the corridor clear */
  const distToPath = (x, z) => {
    let best = 1e9;
    for (let i = 0; i < NS; i += 2) {
      const dx = x - samples[i * 3], dz = z - samples[i * 3 + 2];
      const d = dx * dx + dz * dz;
      if (d < best) best = d;
    }
    return Math.sqrt(best);
  };
  const clearOfPath = (x, z, rad) => distToPath(x, z) > corrR * 0.82 + rad;

  const density = diff.obst * (opts.obstacleDensity == null ? 1 : opts.obstacleDensity);
  const placeAttempts = Math.round(420 * density);

  if (envKey === 'neon') {
    for (let k = 0; k < placeAttempts; k++) {
      const ang = rng() * TAU, rad = 40 + rng() * (R * 1.9);
      const x = Math.cos(ang) * rad, z = Math.sin(ang) * rad;
      const w = rng.range(9, 26), d = rng.range(9, 26), h = rng.range(18, 96) * (rad > R ? 0.75 : 1);
      if (!clearOfPath(x, z, Math.hypot(w, d) * 0.5)) continue;
      const y = terrainAt(x, z);
      const tint = rng();
      const col = tint < 0.55 ? [0.10, 0.11, 0.15] : (tint < 0.85 ? [0.13, 0.11, 0.17] : [0.09, 0.13, 0.17]);
      inst.box.push({ p: [x, y + h / 2, z], yaw: rng.range(0, TAU), s: [w, h, d], col, em: 0, mat: 1 });
      addCollider({ type: 'box', p: [x, y + h / 2, z], h: [w / 2, h / 2, d / 2], yaw: 0, kind: 'building' });
      if (rng() < 0.30) {   /* rooftop beacon */
        inst.box.push({ p: [x, y + h + 1.6, z], yaw: 0, s: [1.1, 3.2, 1.1], col: [1, 0.2, 0.35], em: 2.4, mat: 2 });
      }
    }
    for (let k = 0; k < 90 * density; k++) {  /* neon pylons lining the track */
      const s = rng() * totalLen; atArc(s, sp);
      const side = rng.sign(), off = corrR * rng.range(0.95, 1.25);
      const ang = Math.atan2(sp[2], sp[0]);
      const x = sp[0] + Math.cos(ang) * off * side, z = sp[2] + Math.sin(ang) * off * side;
      const y = terrainAt(x, z), h = rng.range(6, 15);
      inst.cyl.push({ p: [x, y + h / 2, z], yaw: 0, s: [0.5, h, 0.5], col: [0.06, 0.08, 0.10], em: 0, mat: 0 });
      inst.cyl.push({ p: [x, y + h + 0.6, z], yaw: 0, s: [0.9, 1.2, 0.9], col: rng() < 0.5 ? [0.1, 1, 1] : [1, 0.15, 0.6], em: 3.0, mat: 2 });
      addCollider({ type: 'cyl', p: [x, y, z], r: 0.6, h: h + 1.4, kind: 'pylon' });
    }
  } else if (envKey === 'canyon') {
    for (let k = 0; k < placeAttempts * 0.7; k++) {
      const ang = rng() * TAU, rad = 30 + rng() * (R * 1.8);
      const x = Math.cos(ang) * rad, z = Math.sin(ang) * rad;
      const r = rng.range(2.4, 9);
      if (!clearOfPath(x, z, r)) continue;
      const y = terrainAt(x, z);
      inst.rock.push({ p: [x, y + r * 0.32, z], yaw: rng.range(0, TAU), s: [r * 2, r * 1.7, r * 2], col: [1, 0.95, 0.9], em: 0, mat: 0 });
      addCollider({ type: 'sphere', p: [x, y + r * 0.32, z], r: r * 0.82, kind: 'rock' });
    }
    for (let k = 0; k < 24 * density; k++) {   /* spires */
      const ang = rng() * TAU, rad = 70 + rng() * (R * 1.5);
      const x = Math.cos(ang) * rad, z = Math.sin(ang) * rad, h = rng.range(24, 70), r = rng.range(4, 10);
      if (!clearOfPath(x, z, r)) continue;
      const y = terrainAt(x, z);
      inst.cone.push({ p: [x, y + h / 2, z], yaw: 0, s: [r * 2, h, r * 2], col: [0.68, 0.48, 0.32], em: 0, mat: 3 });
      addCollider({ type: 'cyl', p: [x, y, z], r: r * 0.72, h: h, kind: 'spire' });
    }
  } else if (envKey === 'industrial') {
    const contCols = [[0.72, 0.33, 0.20], [0.20, 0.42, 0.62], [0.28, 0.52, 0.32], [0.75, 0.68, 0.22], [0.55, 0.56, 0.58]];
    for (let k = 0; k < placeAttempts; k++) {
      const ang = rng() * TAU, rad = 34 + rng() * (R * 1.7);
      const x = Math.cos(ang) * rad, z = Math.sin(ang) * rad;
      const stack = rng.int(1, 3), yaw = Math.round(rng() * 4) * Math.PI / 4;
      if (!clearOfPath(x, z, 8)) continue;
      const y = terrainAt(x, z);
      for (let s2 = 0; s2 < stack; s2++) {
        const col = rng.pick(contCols);
        inst.box.push({ p: [x, y + 1.3 + s2 * 2.6, z], yaw, s: [12.2, 2.6, 2.9], col, em: 0, mat: 4 });
      }
      addCollider({ type: 'box', p: [x, y + stack * 1.3, z], h: [6.1, stack * 1.3, 1.45], yaw, kind: 'container' });
    }
    for (let k = 0; k < 40 * density; k++) {   /* silos & stacks */
      const ang = rng() * TAU, rad = 50 + rng() * (R * 1.6);
      const x = Math.cos(ang) * rad, z = Math.sin(ang) * rad, r = rng.range(3, 8), h = rng.range(12, 42);
      if (!clearOfPath(x, z, r)) continue;
      const y = terrainAt(x, z);
      inst.cyl.push({ p: [x, y + h / 2, z], yaw: 0, s: [r * 2, h, r * 2], col: [0.55, 0.56, 0.57], em: 0, mat: 3 });
      inst.cyl.push({ p: [x, y + h + 0.5, z], yaw: 0, s: [r * 2.3, 1.0, r * 2.3], col: [0.35, 0.36, 0.38], em: 0, mat: 0 });
      addCollider({ type: 'cyl', p: [x, y, z], r: r, h: h + 1, kind: 'silo' });
    }
  } else {  /* forest */
    for (let k = 0; k < placeAttempts * 1.6; k++) {
      const ang = rng() * TAU, rad = 26 + rng() * (R * 1.9);
      const x = Math.cos(ang) * rad, z = Math.sin(ang) * rad;
      const h = rng.range(10, 26);
      if (!clearOfPath(x, z, 3)) continue;
      const y = terrainAt(x, z);
      inst.tree.push({ p: [x, y, z], yaw: rng.range(0, TAU), s: [h * 0.55, h, h * 0.55], col: [1, 1, 1], em: 0, mat: 0 });
      addCollider({ type: 'cyl', p: [x, y, z], r: Math.max(0.7, h * 0.055), h: h * 0.95, kind: 'tree' });
    }
    for (let k = 0; k < 60 * density; k++) {
      const ang = rng() * TAU, rad = 30 + rng() * (R * 1.7);
      const x = Math.cos(ang) * rad, z = Math.sin(ang) * rad, r = rng.range(1.5, 5);
      if (!clearOfPath(x, z, r)) continue;
      const y = terrainAt(x, z);
      inst.rock.push({ p: [x, y + r * 0.3, z], yaw: rng.range(0, TAU), s: [r * 2, r * 1.6, r * 2], col: [0.6, 0.62, 0.6], em: 0, mat: 0 });
      addCollider({ type: 'sphere', p: [x, y + r * 0.3, z], r: r * 0.8, kind: 'rock' });
    }
  }

  /* landmarks — three unmistakable, seed-placed silhouettes for orientation */
  const landmarks = [];
  for (let k = 0; k < 3; k++) {
    const ang = (k / 3) * TAU + rng.range(0, 1.4), rad = R * rng.range(1.55, 1.95);
    const x = Math.cos(ang) * rad, z = Math.sin(ang) * rad, y = terrainAt(x, z);
    const h = 78 + rng.range(0, 60);
    landmarks.push({ p: [x, y, z], h, kind: k });
    if (envKey === 'neon') {
      inst.box.push({ p: [x, y + h / 2, z], yaw: rng.range(0, TAU), s: [17, h, 17], col: [0.08, 0.09, 0.13], em: 0, mat: 1 });
      inst.cyl.push({ p: [x, y + h + 12, z], yaw: 0, s: [1.4, 24, 1.4], col: [0.2, 0.22, 0.25], em: 0, mat: 0 });
      inst.sphere.push({ p: [x, y + h + 25, z], yaw: 0, s: [4, 4, 4], col: [1, 0.25, 0.4], em: 3.5, mat: 2 });
      addCollider({ type: 'box', p: [x, y + h / 2, z], h: [8.5, h / 2, 8.5], yaw: 0, kind: 'landmark' });
    } else if (envKey === 'canyon') {
      inst.cone.push({ p: [x, y + h / 2, z], yaw: 0, s: [34, h, 34], col: [0.72, 0.52, 0.34], em: 0, mat: 3 });
      addCollider({ type: 'cyl', p: [x, y, z], r: 13, h: h, kind: 'landmark' });
    } else if (envKey === 'industrial') {
      inst.cyl.push({ p: [x, y + h / 2, z], yaw: 0, s: [26, h, 26], col: [0.62, 0.63, 0.64], em: 0, mat: 3 });
      inst.cyl.push({ p: [x, y + h + 2, z], yaw: 0, s: [30, 4, 30], col: [0.4, 0.41, 0.42], em: 0, mat: 0 });
      addCollider({ type: 'cyl', p: [x, y, z], r: 13, h: h + 4, kind: 'landmark' });
    } else {
      inst.tree.push({ p: [x, y, z], yaw: 0, s: [h * 0.5, h, h * 0.5], col: [0.9, 1, 0.9], em: 0, mat: 0 });
      addCollider({ type: 'cyl', p: [x, y, z], r: 2.4, h: h * 0.9, kind: 'landmark' });
    }
  }

  /* gate hardware becomes real geometry AND real colliders */
  for (const g of gates) {
    const t = 0.34;
    const bars = [
      { o: [0, g.hh + t / 2, 0], h: [g.hw + t, t / 2, t / 2] },
      { o: [0, -g.hh - t / 2, 0], h: [g.hw + t, t / 2, t / 2] },
      { o: [-g.hw - t / 2, 0, 0], h: [t / 2, g.hh, t / 2] },
      { o: [g.hw + t / 2, 0, 0], h: [t / 2, g.hh, t / 2] }
    ];
    g.bars = [];
    for (const bar of bars) {
      const wp = V3.new(
        g.pos[0] + g.u[0] * bar.o[0] + g.w[0] * bar.o[1],
        g.pos[1] + g.u[1] * bar.o[0] + g.w[1] * bar.o[1],
        g.pos[2] + g.u[2] * bar.o[0] + g.w[2] * bar.o[1]);
      const c = addCollider({ type: 'obb', p: [wp[0], wp[1], wp[2]], h: bar.h.slice(), q: [g.q[0], g.q[1], g.q[2], g.q[3]], kind: 'gate', gate: g.i });
      g.bars.push(c);
    }
    /* support legs down to the ground so gates never look like they float */
    const groundY = terrainAt(g.pos[0], g.pos[2]);
    for (const sx of [-1, 1]) {
      const bx = g.pos[0] + g.u[0] * sx * g.hw, bz = g.pos[2] + g.u[2] * sx * g.hw;
      const top = g.pos[1] - g.hh, hgt = Math.max(0.4, top - groundY);
      inst.cyl.push({ p: [bx, groundY + hgt / 2, bz], yaw: 0, s: [0.30, hgt, 0.30], col: [0.20, 0.22, 0.26], em: 0, mat: 0 });
      addCollider({ type: 'cyl', p: [bx, groundY, bz], r: 0.34, h: hgt, kind: 'gateleg', gate: g.i });
    }
  }

  /* ---------- 5. launch pad & validation --------------------------------- */
  /* The pad sits on the racing line, one gate-width behind gate 0 and level
     with it, so the very first thing a new pilot sees is the start gate
     filling the middle of the FPV view. */
  const g0 = gates[0];
  const padBack = 13;
  const startPos = V3.new(
    g0.pos[0] - g0.n[0] * padBack, g0.pos[1] - g0.n[1] * padBack, g0.pos[2] - g0.n[2] * padBack);
  /* The deck sits just BELOW the start gate's opening. Lift off and the gate is
     straight ahead; on every following lap the racing line passes clear above
     the pad instead of into it. */
  startPos[1] = g0.pos[1] - g0.hh - 1.7;
  const groundBelow = terrainAt(startPos[0], startPos[2]);
  if (startPos[1] < groundBelow + 0.6) startPos[1] = groundBelow + 0.6;
  const toGate = V3.norm(V3.new(), V3.sub(V3.new(), g0.pos, startPos));
  const startYaw = Math.atan2(-toGate[0], -toGate[2]);
  const startQuat = Q.fromAxisAngle(Q.new(), 0, 1, 0, startYaw);
  const padY = startPos[1] - 0.16;
  /* deck, rim light, and a pylon down to the ground so it reads as built */
  inst.cyl.push({ p: [startPos[0], padY - 0.12, startPos[2]], yaw: 0, s: [6.6, 0.30, 6.6], col: [0.15, 0.17, 0.21], em: 0.85, mat: 5 });
  const pylonH = Math.max(0.2, padY - 0.3 - groundBelow);
  if (pylonH > 1) {
    inst.cyl.push({ p: [startPos[0], groundBelow + pylonH / 2, startPos[2]], yaw: 0, s: [1.9, pylonH, 1.9], col: [0.16, 0.17, 0.21], em: 0, mat: 3 });
    addCollider({ type: 'cyl', p: [startPos[0], groundBelow, startPos[2]], r: 1.1, h: pylonH, kind: 'padpylon' });
  }
  for (let k = 0; k < 6; k++) {
    const ang = k / 6 * TAU;
    inst.sphere.push({
      p: [startPos[0] + Math.cos(ang) * 2.9, padY + 0.35, startPos[2] + Math.sin(ang) * 2.9],
      yaw: 0, s: [0.42, 0.42, 0.42], col: [1, 0.85, 0.25], em: 2.6, mat: 2
    });
  }
  /* the deck itself is solid: a wide, very flat collision box */
  const padCollider = addCollider({
    type: 'box', p: [startPos[0], padY - 0.30, startPos[2]], h: [3.3, 0.24, 3.3], yaw: 0, kind: 'pad'
  });

  const issues = [];
  /* walk the racing line and prove nothing blocks it */
  const probe = V3.new();
  let fixed = 0;
  for (let s = 0; s < totalLen; s += 4) {
    atArc(s, probe);
    const th = terrainAt(probe[0], probe[2]);
    if (probe[1] - th < 3.0) issues.push({ at: s, kind: 'terrain', clearance: probe[1] - th });
    for (let ci = colliders.length - 1; ci >= 0; ci--) {
      const c = colliders[ci];
      if (c.kind === 'gate' || c.kind === 'gateleg' || c.kind === 'pad' || c.kind === 'padpylon') continue;
      if (colliderDistance(c, probe) < 3.2) { colliders.splice(ci, 1); markInstanceRemoved(inst, c); fixed++; }
    }
  }
  /* gates must be reachable: raise any gate whose lower bar is under the terrain */
  for (const g of gates) {
    const need = terrainAt(g.pos[0], g.pos[2]) + g.hh + 1.4;
    if (g.pos[1] < need) { g.pos[1] = need; issues.push({ gate: g.i, kind: 'gate-raised' }); rebuildGateBasis(g); }
  }

  /* ---------- broadphase ------------------------------------------------- */
  const grid = buildBroadphase(colliders, 16);

  const maxR = R * (1 + diff.amp * 3) + 60;
  const course = {
    seed: seedStr, seedNum, env: envKey, envDef: env, difficulty: clamp(opts.difficulty | 0, 0, 3),
    difficultyDef: diff, gateCount: nGates, gates, path: { samples, NS, arc, totalLen, atArc, R, dir },
    terrain: { N, size, cell, half, heights, at: terrainAt, normal: terrainNormal },
    colliders, grid, inst, landmarks, corridorRadius: corrR,
    start: { pos: startPos, quat: startQuat, yaw: startYaw },
    bounds: { radius: maxR, ceiling: baseY + 150, floorMargin: -40 },
    stats: { issues, removedObstacles: fixed, genMs: (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0, colliders: colliders.length, length: totalLen }
  };
  return course;
}

function rebuildGateBasis(g) {
  Q.rot(g.n, g.q, VEC_FWD); Q.rot(g.u, g.q, VEC_RIGHT); Q.rot(g.w, g.q, VEC_UP);
  const t = 0.34;
  const offs = [[0, g.hh + t / 2], [0, -g.hh - t / 2], [-g.hw - t / 2, 0], [g.hw + t / 2, 0]];
  if (!g.bars) return;
  for (let i = 0; i < g.bars.length; i++) {
    const o = offs[i], c = g.bars[i];
    c.p[0] = g.pos[0] + g.u[0] * o[0] + g.w[0] * o[1];
    c.p[1] = g.pos[1] + g.u[1] * o[0] + g.w[1] * o[1];
    c.p[2] = g.pos[2] + g.u[2] * o[0] + g.w[2] * o[1];
  }
}

/** crude distance from a point to a collider's surface (negative inside) */
function colliderDistance(c, p) {
  if (c.type === 'sphere') return V3.dist(c.p, p) - c.r;
  if (c.type === 'cyl') {
    const dx = p[0] - c.p[0], dz = p[2] - c.p[2];
    const dr = Math.hypot(dx, dz) - c.r;
    const dy = Math.max(c.p[1] - p[1], p[1] - (c.p[1] + c.h));
    if (dr <= 0 && dy <= 0) return Math.max(dr, dy);
    return Math.hypot(Math.max(dr, 0), Math.max(dy, 0));
  }
  /* box / obb */
  let lx = p[0] - c.p[0], ly = p[1] - c.p[1], lz = p[2] - c.p[2];
  if (c.type === 'obb') {
    const inv = Q.conj(_cdq, c.q); V3.set(_cdv, lx, ly, lz); Q.rot(_cdv, inv, _cdv);
    lx = _cdv[0]; ly = _cdv[1]; lz = _cdv[2];
  } else if (c.yaw) {
    const ca = Math.cos(-c.yaw), sa = Math.sin(-c.yaw), nx = lx * ca - lz * sa, nz = lx * sa + lz * ca;
    lx = nx; lz = nz;
  }
  const dx = Math.abs(lx) - c.h[0], dy2 = Math.abs(ly) - c.h[1], dz2 = Math.abs(lz) - c.h[2];
  const ox = Math.max(dx, 0), oy = Math.max(dy2, 0), oz = Math.max(dz2, 0);
  const outside = Math.hypot(ox, oy, oz);
  return outside > 0 ? outside : Math.max(dx, Math.max(dy2, dz2));
}
const _cdq = Q.new(), _cdv = V3.new();

/** remove instances that visually correspond to a collider we deleted */
function markInstanceRemoved(inst, c) {
  for (const key of Object.keys(inst)) {
    const arr = inst[key];
    for (let i = arr.length - 1; i >= 0; i--) {
      const it = arr[i];
      if (Math.hypot(it.p[0] - c.p[0], it.p[2] - c.p[2]) < 0.75) arr.splice(i, 1);
    }
  }
}

function buildBroadphase(colliders, cellSize) {
  const map = new Map();
  const key = (i, j) => i * 73856093 ^ j * 19349663;
  for (let n = 0; n < colliders.length; n++) {
    const c = colliders[n];
    let rx, rz;
    if (c.type === 'sphere') { rx = rz = c.r; }
    else if (c.type === 'cyl') { rx = rz = c.r; }
    else { rx = Math.hypot(c.h[0], c.h[2]); rz = rx; }
    const i0 = Math.floor((c.p[0] - rx) / cellSize), i1 = Math.floor((c.p[0] + rx) / cellSize);
    const j0 = Math.floor((c.p[2] - rz) / cellSize), j1 = Math.floor((c.p[2] + rz) / cellSize);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const k = key(i, j);
      let a = map.get(k); if (!a) { a = []; map.set(k, a); }
      a.push(n);
    }
  }
  return {
    cellSize, map, key,
    query(x, z, r, out) {
      out.length = 0;
      const i0 = Math.floor((x - r) / cellSize), i1 = Math.floor((x + r) / cellSize);
      const j0 = Math.floor((z - r) / cellSize), j1 = Math.floor((z + r) / cellSize);
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const a = map.get(key(i, j));
        if (a) for (let n = 0; n < a.length; n++) if (out.indexOf(a[n]) < 0) out.push(a[n]);
      }
      return out;
    }
  };
}
