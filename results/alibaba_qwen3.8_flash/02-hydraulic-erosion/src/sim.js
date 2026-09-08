/* =====================================================================
   Hydraulic erosion simulation core.  Pure typed-array math, no DOM.

   Field layout (all Float32Array, one value per grid cell):
     h     terrain elevation (excludes water)
     w     standing/streaming water depth
     sed   sediment suspended in the water column
     rock  erodibility, 0.08 (hard rock) .. 1 (loose soil)
     fx/fy staggered link fluxes (momentum state of the water)
     delta running erosion(-) / deposition(+) field for display
     spd   smoothed water throughput, used as carrying capacity input

   Every water and sediment transfer moves from one cell to another, so the
   only mass sources are rainfall/springs and the only sinks are
   evaporation, infiltration and open-boundary drainage.
   ===================================================================== */
const LAB = {};

const F32 = Float32Array;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/* ---------------- deterministic randomness ---------------- */

function hashSeed(str) {
  let h = 2166136261 >>> 0;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  h ^= h >>> 13;
  h = Math.imul(h, 2654435761) >>> 0;
  return h >>> 0;
}

function mulberry32(a) {
  let s = a >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(x, y, seed) {
  let h = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
  h = (h ^ (h >>> 13)) | 0;
  h = Math.imul(h, 1274126177) | 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}

const smooth01 = (t) => t * t * (3 - 2 * t);

/* value noise in [-1, 1] */
function vnoise(x, y, seed) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const sx = smooth01(x - x0);
  const sy = smooth01(y - y0);
  const a = hash2(x0, y0, seed);
  const b = hash2(x0 + 1, y0, seed);
  const c = hash2(x0, y0 + 1, seed);
  const d = hash2(x0 + 1, y0 + 1, seed);
  const t = a + (b - a) * sx;
  const u = c + (d - c) * sx;
  return (t + (u - t) * sy) * 2 - 1;
}

/* ---------------- terrain generation ---------------- */

function generateHeightfield(sim, style, o) {
  const n = sim.n;
  const h = sim.h;
  const rock = sim.rock;
  const sed = sim.sed;
  const seed = hashSeed(String(o.seed));
  const rng = mulberry32(seed);
  const relief = o.relief;
  const oct = Math.max(1, Math.min(9, Math.round(o.octaves)));
  const rough = clamp(o.roughness, 0.2, 0.9);
  const ridge = clamp(o.ridge, 0, 1);
  const island = clamp(o.island, 0, 1);
  const warp = o.warp;
  const baseFreq = clamp(o.scale, 1.2, 24);

  let maxH = -1e9;
  let minH = 1e9;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const u = x / (n - 1);
      const v = y / (n - 1);
      let e = 0;
      let amp = 1;
      let freq = baseFreq;
      let norm = 0;
      const wx = (warp * vnoise(u * 3.1 + 11.7, v * 3.1 - 4.3, seed ^ 0x9e37)) * 0.18;
      const wy = (warp * vnoise(u * 3.1 - 8.1, v * 3.1 + 2.9, seed ^ 0x5bf0)) * 0.18;
      for (let k = 0; k < oct; k++) {
        const su = (u + wx) * freq;
        const sv = (v + wy) * freq;
        let a = vnoise(su, sv, seed + k * 101);
        if (ridge > 0) {
          const r = 1 - Math.abs(a);
          a = a * (1 - ridge) + (r * 2 - 1) * ridge;
        }
        e += a * amp;
        norm += amp;
        amp *= rough;
        freq *= 2.03;
      }
      e /= norm;

      if (style === 'island') {
        const dx = u - 0.5;
        const dy = v - 0.5;
        const d = Math.sqrt(dx * dx + dy * dy) * 2;
        shape = clamp(1.25 - d * (1.1 + island * 0.9), -0.35, 1.3);
        e = e * 0.6 + shape * 0.55;
      } else if (style === 'valley') {
        const dx = u - 0.5;
        e = e * 0.5 + (Math.pow(Math.abs(dx) * 2, 1.2) * 0.85 - 0.28);
      } else if (style === 'canyon') {
        const me =
          0.5 + 0.24 * Math.sin(v * 7.3 + seed * 1e-6) + 0.1 * vnoise(u * 5, v * 12, seed);
        const d = Math.abs(u - me);
        const cut = Math.exp(-(d * d) / 0.0045) * 0.55;
        e = e * 0.45 + 0.32 - cut;
      } else if (style === 'plateau') {
        e = Math.tanh(e * 1.7) * 0.75;
      } else if (style === 'plain') {
        e = e * 0.28;
      } else {
        // mountain drainage: broad dome plus ridge detail
        const dx = u - 0.5;
        const dy = v - 0.5;
        const d = Math.sqrt(dx * dx + dy * dy) * 2;
        e = e * 0.85 + (1 - clamp(d, 0, 1)) ** 1.5 * 0.55 - 0.15;
      }

      e *= relief;
      if (e > maxH) maxH = e;
      if (e < minH) minH = e;
      h[y * n + x] = e;
    }
  }

  // normalise to [0, relief]
  const span = Math.max(1e-5, maxH - minH);
  for (let i = 0; i < n * n; i++) h[i] = ((h[i] - minH) / span) * relief;

  // pre-eroded drainage lines so the first frames are already channelised
  if (style !== 'plain') {
    const rivers = style === 'canyon' ? 3 : 4;
    for (let r = 0; r < rivers; r++) {
      let x = 0.5 + (rng() - 0.5) * 0.55;
      let y = 0.04 + rng() * 0.12;
      let dir = Math.PI * 0.5 + (rng() - 0.5) * 0.7;
      const depth = 0.02 + rng() * 0.05;
      const steps = Math.round(n * 2.4);
      for (let k = 0; k < steps; k++) {
        const gx = Math.round(x * (n - 1));
        const gy = Math.round(y * (n - 1));
        if (gx < 1 || gy < 1 || gx >= n - 1 || gy >= n - 1) break;
        const idx = gy * n + gx;
        for (let oy = -1; oy <= 1; oy++) {
          for (let ox = -1; ox <= 1; ox++) {
            const j = (gy + oy) * n + (gx + ox);
            if (j < 0 || j >= n * n) continue;
            h[j] -= (depth * 1) / (1 + ox * ox + oy * oy);
          }
        }
        const hx = (h[Math.min(n - 1, idx + 1)] - h[Math.max(0, idx - 1)]) * 6;
        const hy = (h[Math.min(n * n - n, idx + n)] - h[Math.max(0, idx - n)]) * 6;
        let vx = Math.cos(dir) * 0.35 - hx;
        let vy = Math.sin(dir) * 0.35 - hy;
        const m = Math.hypot(vx, vy) || 1;
        vx /= m;
        vy /= m;
        dir = Math.atan2(vy, vx) + (rng() - 0.5) * 0.35;
        x = clamp(x + vx / n, 0, 1);
        y = clamp(y + vy / n, 0, 1);
        if (y >= 0.995 || x <= 0.005 || x >= 0.995) break;
      }
    }
  }

  // erodibility: loose debris on flats, hard rock on steep spines
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = y * n + x;
      const l = h[i - (x > 0 ? 1 : 0)];
      const r = h[i + (x < n - 1 ? 1 : 0)];
      const u = h[i - (y > 0 ? n : 0)];
      const d = h[i + (y < n - 1 ? n : 0)];
      const slope = Math.abs(h[i] - 0.25 * (l + r + u + d));
      rock[i] = clamp(0.95 - slope * 9 - hash2(x, y, seed ^ 0x1234) * 0.3, 0.08, 1);
    }
  }

  if (o.sediment > 0) for (let i = 0; i < n * n; i++) sed[i] = o.sediment * 0.01;

  updateSeaLevel(sim, o.seaLevel);

  // spring sources near the high ground guarantee rivers on frame one
  sim.springs.length = 0;
  let tries = 0;
  while (sim.springs.length < o.springs && tries++ < 6000) {
    const x = 2 + Math.floor(rng() * (n - 4));
    const y = 2 + Math.floor(rng() * (n - 4));
    const i = y * n + x;
    if (!(h[i] > 0.5 * relief && h[i] > o.seaLevel + 0.02)) continue;
    let close = false;
    for (const sp of sim.springs) {
      if (Math.abs(sp.x - x) + Math.abs(sp.y - y) < n * 0.16) close = true;
    }
    if (!close) sim.springs.push({ x, y, r: 1 + Math.floor(rng() * 2) });
  }
  for (const sp of sim.springs) {
    for (let oy = -sp.r; oy <= sp.r; oy++) {
      for (let ox = -sp.r; ox <= sp.r; ox++) {
        const x = sp.x + ox;
        const y = sp.y + oy;
        if (x < 0 || y < 0 || x >= n || y >= n) continue;
        sim.w[y * n + x] = 0.02;
      }
    }
  }
}

function updateSeaLevel(sim, level) {
  if (!(level > 0)) return;
  for (let i = 0; i < sim.n * sim.n; i++) {
    if (sim.h[i] < level) sim.w[i] = (level - sim.h[i]) * 0.85;
  }
}

/* ---------------- sim container ---------------- */

LAB.createSim = function (n, params) {
  const N = n * n;
  return {
    n: n,
    cell: 1 / n,
    h: new F32(N),
    w: new F32(N),
    sed: new F32(N),
    rock: new F32(N),
    fx: new F32(N),
    fy: new F32(N),
    dw: new F32(N),
    ds: new F32(N),
    dh: new F32(N),
    delta: new F32(N),
    spd: new F32(N),
    springs: [],
    params: Object.assign({}, params),
    step: 0,
    time: 0,
    rng: mulberry32(0x2545f491),
    recoveries: 0,
    capped: 0,
    unstable: false,
    stats: null,
  };
};

LAB.resetWater = function (sim) {
  sim.w.fill(0);
  sim.sed.fill(0);
  sim.fx.fill(0);
  sim.fy.fill(0);
  sim.delta.fill(0);
  sim.spd.fill(0);
  sim.step = 0;
  sim.time = 0;
  sim.recoveries = 0;
  sim.capped = 0;
  sim.unstable = false;
  sim.stats = null;
  const o = sim.gen;
  if (o) {
    updateSeaLevel(sim, o.seaLevel);
    for (const sp of sim.springs) {
      for (let oy = -sp.r; oy <= sp.r; oy++) {
        for (let ox = -sp.r; ox <= sp.r; ox++) {
          const x = sp.x + ox;
          const y = sp.y + oy;
          if (x < 0 || y < 0 || x >= sim.n || y >= sim.n) continue;
          sim.w[y * sim.n + x] = 0.02;
        }
      }
    }
  }
};

LAB.generate = function (sim, style, opts) {
  const o = Object.assign(
    {
      style: style || 'mountain',
      relief: 0.34,
      octaves: 5,
      roughness: 0.45,
      ridge: 0.45,
      island: 0,
      scale: 4.5,
      seaLevel: 0.012,
      sediment: 0,
      warp: 0.6,
      springs: 5,
      seed: 'seed',
    },
    opts,
  );
  sim.gen = o;
  generateHeightfield(sim, o.style, o);
  return sim;
};

/* Default UI parameter values.  Ranges are documented in the control panel;
1.0 is the "physical" reference point for every coefficient. */
LAB.DEFAULT_PARAMS = {
  rain: 0.16,
  evap: 0.3,
  erode: 0.6,
  deposit: 0.5,
  capacity: 0.5,
  flow: 0.6,
  thermal: 0.1,
  talus: 55,
};

/* ---------------- one simulation step ---------------- */

const MIN_W = 1e-4;

/* tuning constants for the default parameter scale (1.0 == "normal") */
LAB.K = {
  rain: 0.00035, // depth added per substep at rain = 1
  springGain: 26, // spring multiplier on rainfall
  acc: 0.42, // flux acceleration from head difference
  damp: 0.93, // flux memory loss per substep
  maxFlux: 0.25, // hard flux clamp
  cfl: 0.55, // max fraction of a cell's water leaving per substep
  carry: 0.9, // fraction of suspended load that follows the water
  edgeDrain: 0.5, // water lost off the rim per substep
  capK: 1.2, // carrying capacity coefficient
  capSlope: 26, // slope contribution to capacity
  eroFrac: 0.1, // fraction of the capacity deficit converted to erosion
  eroMax: 9e-5, // absolute erosion cap per substep and cell
  eroWater: 26, // how quickly erosion saturates with depth
  eroThresh: 3e-4, // minimum water speed before hydraulic erosion bites
  depK: 0.55, // deposition coefficient
  depFrac: 0.45, // fraction of the surplus load that settles out
  depMax: 4e-4, // deposition cap per substep
  evapK: 0.01, // evaporation coefficient
  soak: 0.0045, // infiltration into the ground
  talusK: 0.02, // talus collapse coefficient
};

function substep(sim) {
  const K = LAB.K;
  const n = sim.n;
  const N = n * n;
  const p = sim.params;
  const h = sim.h;
  const w = sim.w;
  const sed = sim.sed;
  const rock = sim.rock;
  const fx = sim.fx;
  const fy = sim.fy;
  const dw = sim.dw;
  const ds = sim.ds;
  const dh = sim.dh;
  const delta = sim.delta;
  const spd = sim.spd;

  /* ---- 1. rainfall and springs ---- */
  const rain = p.rain * K.rain;
  if (rain > 0) {
    const rnd = sim.rng;
    const gust = 0.55 + 0.45 * Math.sin(sim.step * 0.021);
    for (let i = 0; i < N; i++) w[i] += rain * gust * (0.35 + 0.65 * rnd());
    for (const sp of sim.springs) {
      const amount = rain * K.springGain * gust;
      for (let oy = -sp.r; oy <= sp.r; oy++) {
        for (let ox = -sp.r; ox <= sp.r; ox++) {
          const x = sp.x + ox;
          const y = sp.y + oy;
          if (x < 0 || y < 0 || x >= n || y >= n) continue;
          w[y * n + x] += amount;
        }
      }
    }
  }

  /* ---- 2. flux update (staggered link momentum) ---- */
  const acc = K.acc * clamp(p.flow, 0, 3);
  const damp = K.damp;
  for (let y = 0; y < n; y++) {
    const row = y * n;
    for (let x = 1; x < n; x++) {
      const i = row + x;
      const dl = h[i - 1] + w[i - 1] - (h[i] + w[i]);
      let f = (fx[i] + dl * acc) * damp;
      if (f > K.maxFlux) f = K.maxFlux;
      else if (f < -K.maxFlux) f = -K.maxFlux;
      fx[i] = f;
    }
    if (y === 0) {
      for (let x = 0; x < n; x++) fy[x] = 0;
      continue;
    }
    for (let x = 0; x < n; x++) {
      const i = row + x;
      const du = h[i - n] + w[i - n] - (h[i] + w[i]);
      let f = (fy[i] + du * acc) * damp;
      if (f > K.maxFlux) f = K.maxFlux;
      else if (f < -K.maxFlux) f = -K.maxFlux;
      fy[i] = f;
    }
  }

  /* ---- 3. transport water and suspended sediment (conservative) ---- */
  const cfl = K.cfl;
  const carry = K.carry;
  let capped = 0;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = y * n + x;
      const wi = w[i];
      if (wi <= 0) {
        spd[i] = 0;
        continue;
      }
      let tL = 0;
      let tR = 0;
      let tU = 0;
      let tD = 0;
      if (x > 0) {
        const f = -fx[i];
        if (f > 0) tL = f;
      }
      if (x < n - 1) {
        const f = fx[i + 1];
        if (f > 0) tR = f;
      }
      if (y > 0) {
        const f = -fy[i];
        if (f > 0) tU = f;
      }
      if (y < n - 1) {
        const f = fy[i + n];
        if (f > 0) tD = f;
      }
      const rim = x === 0 || x === n - 1 || y === 0 || y === n - 1;
      const edge = rim ? wi * K.edgeDrain : 0;
      const out = tL + tR + tU + tD + edge;
      if (out <= 1e-9) {
        spd[i] = spd[i] * 0.7;
        continue;
      }
      const allow = wi * cfl;
      let sc = 1;
      if (out > allow) {
        sc = allow / out;
        capped++;
      }
      const gL = tL * sc;
      const gR = tR * sc;
      const gU = tU * sc;
      const gD = tD * sc;
      const gE = edge * sc;
      const removed = gL + gR + gU + gD + gE;
      w[i] = wi - removed;
      const si = sed[i];
      if (si > 0) {
        const frac = (removed / wi) * carry;
        if (frac > 0) {
          const move = si * frac;
          sed[i] = si - move;
          const inv = move / removed;
          if (gL > 0) {
            dw[i - 1] += gL;
            ds[i - 1] += gL * inv;
          }
          if (gR > 0) {
            dw[i + 1] += gR;
            ds[i + 1] += gR * inv;
          }
          if (gU > 0) {
            dw[i - n] += gU;
            ds[i - n] += gU * inv;
          }
          if (gD > 0) {
            dw[i + n] += gD;
            ds[i + n] += gD * inv;
          }
        }
      } else {
        if (gL > 0) dw[i - 1] += gL;
        if (gR > 0) dw[i + 1] += gR;
        if (gU > 0) dw[i - n] += gU;
        if (gD > 0) dw[i + n] += gD;
      }
      spd[i] = spd[i] * 0.5 + out * 0.5;
    }
  }
  sim.capped += capped;
  // apply the transport deltas and leave the buffers clean for the next pass
  for (let i = 0; i < N; i++) {
    w[i] += dw[i];
    sed[i] += ds[i];
    dw[i] = 0;
    ds[i] = 0;
  }

  /* ---- 4. carrying capacity: erode or deposit ---- */
  const capK = K.capK * clamp(p.capacity, 0, 3);
  const eroF = K.eroFrac * clamp(p.erode, 0, 3);
  const depF = K.depFrac * clamp(p.deposit, 0, 3);
  if (capK > 0 && (eroF > 0 || depF > 0)) {
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const i = y * n + x;
        const wi = w[i];
        if (wi <= MIN_W) continue;
        const si = sed[i];
        const sp = spd[i];
        const xl = x > 0 ? i - 1 : i;
        const xr = x < n - 1 ? i + 1 : i;
        const yu = y > 0 ? i - n : i;
        const yd = y < n - 1 ? i + n : i;
        let slope = h[i] + wi - 0.25 * (h[xl] + w[xl] + h[xr] + w[xr] + h[yu] + w[yu] + h[yd] + w[yd]);
        if (slope < 0) slope = 0;
        // carrying capacity grows with flow speed and with surface slope
        const capacity = capK * sp * (0.02 + slope * 20);
        if (si > capacity) {
          let dep = (si - capacity) * depF;
          if (dep > si) dep = si;
          if (dep > K.depMax) dep = K.depMax;
          if (dep > 0) {
            sed[i] = si - dep;
            h[i] += dep;
            delta[i] += dep;
          }
        } else if (eroF > 0 && sp > K.eroThresh) {
          let er = (capacity - si) * eroF * rock[i];
          const lim = K.eroMax * Math.min(1, wi * K.eroWater) * (0.2 + slope * 12);
          if (er > lim) er = lim;
          if (er > 0) {
            sed[i] = si + er;
            h[i] -= er;
            delta[i] -= er;
          }
        }
      }
    }
  }

  /* ---- 5. thermal / talus erosion ---- */
  if (p.thermal > 0) {
    const tanTalus = Math.tan((clamp(p.talus, 5, 80) * Math.PI) / 180);    const crit = Math.max(1e-4, tanTalus * sim.cell * 2);
    const k = K.talusK * clamp(p.thermal, 0, 3);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const i = y * n + x;
        const hi = h[i];
        let lowest = hi;
        let li = -1;
        if (x > 0 && h[i - 1] < lowest) {
          lowest = h[i - 1];
          li = i - 1;
        }
        if (x < n - 1 && h[i + 1] < lowest) {
          lowest = h[i + 1];
          li = i + 1;
        }
        if (y > 0 && h[i - n] < lowest) {
          lowest = h[i - n];
          li = i - n;
        }
        if (y < n - 1 && h[i + n] < lowest) {
          lowest = h[i + n];
          li = i + n;
        }
        if (li < 0) continue;
        const diff = hi - lowest;
        if (diff > crit) {
          let move = (diff - crit) * k;
          const half = Math.min(move, diff * 0.08);
          // pure scatter: the donor is only touched through dh/ds, so terrain
          // and sediment mass move exactly once
          dh[i] -= half;
          dh[li] += half;
          const sus = Math.min(half * 0.3 * Math.min(1, w[i] * 25), sed[i] * 0.5);
          if (sus > 0) {
            sed[i] -= sus;
            ds[li] += sus;
          }
          delta[i] -= half * 0.4;
          delta[li] += half * 0.4;
        }
      }
    }
    for (let i = 0; i < N; i++) {
      h[i] += dh[i];
      sed[i] += ds[i];
      dh[i] = 0;
      ds[i] = 0;
    }
  }

  /* ---- 6. evaporation, infiltration and hard clamps ---- */
  const loss = Math.min(0.85, K.evapK * clamp(p.evap, 0, 4) + K.soak);
  for (let i = 0; i < N; i++) {
    const wi = w[i];
    if (wi > 0) {
      const nw = wi * (1 - loss);
      w[i] = nw < 1e-6 ? 0 : nw;
    }
    if (sed[i] > 0.35) sed[i] = 0.35;
    else if (sed[i] < 0) sed[i] = 0;
    delta[i] *= 0.96;
  }
}

function audit(sim) {
  const N = sim.n * sim.n;
  const h = sim.h;
  const w = sim.w;
  const s = sim.sed;
  const fx = sim.fx;
  const fy = sim.fy;
  let bad = 0;
  for (let i = 0; i < N; i++) {
    if (!Number.isFinite(h[i])) {
      h[i] = 0;
      bad++;
    }
    if (!Number.isFinite(w[i])) {
      w[i] = 0;
      bad++;
    }
    if (!Number.isFinite(s[i])) {
      s[i] = 0;
      bad++;
    }
    if (h[i] > 3) h[i] = 3;
    else if (h[i] < -3) h[i] = -3;
  }
  for (let i = 0; i < N; i++) {
    if (!Number.isFinite(fx[i])) fx[i] = 0;
    if (!Number.isFinite(fy[i])) fy[i] = 0;
  }
  if (bad > 0) {
    sim.recoveries++;
    sim.unstable = true;
  }
  return bad;
}

LAB.step = function (sim, substeps) {
  const k = Math.max(1, Math.min(12, Math.round(substeps)));
  for (let k2 = 0; k2 < k; k2++) {
    substep(sim);
    sim.step++;
    sim.time += 1 / 60;
  }
  if (sim.step % 16 === 0) audit(sim);
  const N = sim.n * sim.n;
  let maxW = 0;
  let maxS = 0;
  let sumW = 0;
  let sumS = 0;
  let wet = 0;
  for (let i = 0; i < N; i++) {
    const w = sim.w[i];
    const s = sim.sed[i];
    if (w > maxW) maxW = w;
    if (s > maxS) maxS = s;
    sumW += w;
    sumS += s;
    if (w > 1e-4) wet++;
  }
  const st = sim.stats || (sim.stats = {});
  st.maxW = maxW;
  st.maxS = maxS;
  st.sumW = sumW;
  st.sumS = sumS;
  st.wet = wet;
  st.wetFrac = wet / N;
  st.cappedRatio = sim.capped / (N * k);
  if (st.cappedRatio > 0.97 || maxW > 0.6) sim.unstable = true;
  sim.capped = 0;
  return st;
};

/* ---------------- state serialisation ---------------- */

function packF32(arr) {
  const bytes = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
  let bin = '';
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  }
  return btoa(bin);
}

function unpackF32(b64, size) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i) & 0xff;
  return new F32(bytes.buffer, 0, size);
}

LAB.exportState = function (sim) {
  return {
    app: 'hydraulic-erosion-lab',
    version: 1,
    n: sim.n,
    step: sim.step,
    time: sim.time,
    params: Object.assign({}, sim.params),
    gen: Object.assign({}, sim.gen),
    h: packF32(sim.h),
    w: packF32(sim.w),
    sed: packF32(sim.sed),
  };
};

LAB.generateRock = function (sim) {
  const n = sim.n;
  const h = sim.h;
  const rock = sim.rock;
  const seed = hashSeed(String((sim.gen && sim.gen.seed) || 'seed'));
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = y * n + x;
      const l = h[i - (x > 0 ? 1 : 0)];
      const r = h[i + (x < n - 1 ? 1 : 0)];
      const u = h[i - (y > 0 ? n : 0)];
      const d = h[i + (y < n - 1 ? n : 0)];
      const slope = Math.abs(h[i] - 0.25 * (l + r + u + d));
      rock[i] = clamp(0.95 - slope * 9 - hash2(x, y, seed ^ 0x1234) * 0.3, 0.08, 1);
    }
  }
};

LAB.importState = function (sim, obj) {
  if (!obj || obj.app !== 'hydraulic-erosion-lab') throw new Error('not a hydraulic-erosion-lab state file');
  if (typeof obj.n !== 'number' || obj.n < 16 || obj.n > 512) throw new Error('state file has an invalid grid size');
  if (!obj.h || !obj.w || !obj.sed) throw new Error('state file is missing field arrays');
  if (obj.n !== sim.n) LAB.resizeSim(sim, obj.n);
  const size = sim.n * sim.n;
  try {
    sim.h.set(unpackF32(obj.h, size));
    sim.w.set(unpackF32(obj.w, size));
    sim.sed.set(unpackF32(obj.sed, size));
  } catch (e) {
    throw new Error('state file arrays are the wrong length');
  }
  sim.fx.fill(0);
  sim.fy.fill(0);
  sim.delta.fill(0);
  sim.spd.fill(0);
  if (obj.params) sim.params = Object.assign({}, sim.params, obj.params);
  if (obj.gen) {
    sim.gen = Object.assign({}, obj.gen);
    LAB.generateRock(sim);
  }
  sim.step = obj.step | 0;
  sim.time = obj.time || 0;
  sim.recoveries = 0;
  sim.unstable = false;
  audit(sim);
  return sim;
};

LAB.resizeSim = function (sim, n) {
  const N = n * n;
  sim.n = n;
  sim.cell = 1 / n;
  sim.h = new F32(N);
  sim.w = new F32(N);
  sim.sed = new F32(N);
  sim.rock = new F32(N);
  sim.fx = new F32(N);
  sim.fy = new F32(N);
  sim.dw = new F32(N);
  sim.ds = new F32(N);
  sim.dh = new F32(N);
  sim.delta = new F32(N);
  sim.spd = new F32(N);
  sim.stats = null;
  return sim;
};

/* ---------------- brush tools ---------------- */

LAB.applyBrush = function (sim, tool, cx, cy, radius, strength) {
  const n = sim.n;
  const h = sim.h;
  const w = sim.w;
  const sed = sim.sed;
  const r = Math.max(0.6, radius);
  const r2 = r * r;
  const x0 = Math.max(0, Math.floor(cx - r));
  const x1 = Math.min(n - 1, Math.ceil(cx + r));
  const y0 = Math.max(0, Math.floor(cy - r));
  const y1 = Math.min(n - 1, Math.ceil(cy + r));
  let touched = 0;
  let mean = 0;
  if (tool === 'smooth' || tool === 'flatten') {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        mean += h[y * n + x];
        touched++;
      }
    }
    mean /= Math.max(1, touched);
  }
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 > r2) continue;
      const i = y * n + x;
      const fall = 1 - Math.sqrt(d2) / r;
      const k = fall * fall * strength;
      switch (tool) {
        case 'raise':
          h[i] += k * 0.022;
          break;
        case 'lower':
          h[i] -= k * 0.022;
          break;
        case 'smooth': {
          const c =
            (h[i - (x > 0 ? 1 : 0)] + h[i + (x < n - 1 ? 1 : 0)] + h[i - (y > 0 ? n : 0)] + h[i + (y < n - 1 ? n : 0)]) * 0.25;
          h[i] += (c - h[i]) * clamp(k * 2, 0, 0.9);
          break;
        }
        case 'flatten':
          h[i] += (mean - h[i]) * clamp(k * 2, 0, 0.9);
          break;
        case 'water':
          w[i] += k * 0.02;
          break;
        case 'sediment': {
          const add = Math.min(k * 0.012, 0.2);
          sed[i] += add;
          h[i] += add * 0.5;
          break;
        }
        case 'dry': {
          const kk = clamp(k * 2, 0, 1);
          w[i] *= 1 - kk;
          if (w[i] < 1e-5) w[i] = 0;
          sed[i] *= 1 - kk * 0.8;
          break;
        }
        default:
          break;
      }
    }
  }
};

LAB.probe = function (sim, gx, gy) {
  const n = sim.n;
  const cx = Math.round(gx);
  const cy = Math.round(gy);
  if (cx < 0 || cy < 0 || cx >= n || cy >= n) return null;
  const i = cy * n + cx;
  const h = sim.h;
  const xl = cx > 0 ? i - 1 : i;
  const xr = cx < n - 1 ? i + 1 : i;
  const yu = cy > 0 ? i - n : i;
  const yd = cy < n - 1 ? i + n : i;
  const gx2 = (h[xr] - h[xl]) * 0.5 * n;
  const gy2 = (h[yd] - h[yu]) * 0.5 * n;
  const fxs = sim.fx[i] + (cx < n - 1 ? sim.fx[i + 1] : 0);
  const fys = sim.fy[i] + (cy < n - 1 ? sim.fy[i + n] : 0);
  return {
    x: cx,
    y: cy,
    elevation: h[i],
    water: sim.w[i],
    sediment: sim.sed[i],
    slopeDeg: (Math.atan(Math.hypot(gx2, gy2)) * 180) / Math.PI,
    speed: Math.hypot(fxs, fys),
    flowDir: (Math.atan2(fys, fxs) * 180) / Math.PI,
    delta: sim.delta[i],
    rock: sim.rock[i],
  };
};

/* ---------------- grayscale PNG export ---------------- */

LAB.fieldPNG = function (sim, mode) {
  const n = sim.n;
  const src = mode === 'water' ? sim.w : mode === 'sediment' ? sim.sed : sim.h;
  const data = new Float32Array(n * n);
  let lo = Infinity;
  let hi = -Infinity;
  const minIsZero = mode === 'water' || mode === 'sediment';
  for (let i = 0; i < n * n; i++) {
    data[i] = src[i];
    if (src[i] < lo) lo = src[i];
    if (src[i] > hi) hi = src[i];
  }
  if (minIsZero) lo = 0;
  if (!(hi > lo)) hi = lo + 1;
  const span = hi - lo;
  const bpl = n * 3;
  const raw = new Uint8Array((bpl + 1) * n);
  for (let y = 0; y < n; y++) {
    const base = y * (bpl + 1);
    for (let x = 0; x < n; x++) {
      const v = clamp((data[y * n + x] - lo) / span, 0, 1);
      const g = Math.round(v * 255);
      const o = base + 1 + x * 3;
      raw[o] = g;
      raw[o + 1] = g;
      raw[o + 2] = g;
    }
  }
  return { width: n, height: n, bytes: encodePNG(n, n, raw), min: lo, max: hi };
};

/* --- minimal PNG encoder (zlib stored blocks, no external library) --- */

function adler32(buf) {
  let a = 1;
  let b = 0;
  for (let i = 0; i < buf.length; i++) {
    a = (a + buf[i]) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

const CRC_TABLE = (function () {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data, out) {
  const len = data.length;
  // 4-byte big-endian length, then type + data, then big-endian CRC of both
  out.push((len >>> 24) & 255, (len >>> 16) & 255, (len >>> 8) & 255, len & 255);
  const start = out.length;
  for (let i = 0; i < type.length; i++) out.push(type.charCodeAt(i));
  for (let i = 0; i < data.length; i++) out.push(data[i]);
  const crc = crc32(out.slice(start, out.length));
  out.push((crc >>> 24) & 255, (crc >>> 16) & 255, (crc >>> 8) & 255, crc & 255);
}

function encodePNG(w, h, raw) {
  const MAX = 60000;
  const nBlocks = Math.ceil(raw.length / MAX);
  const zlib = new Uint8Array(2 + raw.length + nBlocks * 5 + 4);
  let p = 0;
  zlib[p++] = 0x78;
  zlib[p++] = 0x01;
  for (let i = 0; i < raw.length; i += MAX) {
    const block = raw.subarray(i, Math.min(raw.length, i + MAX));
    const last = i + MAX >= raw.length;
    zlib[p++] = last ? 1 : 0;
    zlib[p++] = block.length & 255;
    zlib[p++] = (block.length >> 8) & 255;
    zlib[p++] = ~block.length & 255;
    zlib[p++] = (~block.length >> 8) & 255;
    zlib.set(block, p);
    p += block.length;
  }
  const ad = adler32(raw);
  zlib[p++] = (ad >>> 24) & 255;
  zlib[p++] = (ad >>> 16) & 255;
  zlib[p++] = (ad >>> 8) & 255;
  zlib[p++] = ad & 255;

  const out = [];
  for (const b of [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) out.push(b);
  const ihdr = new Uint8Array([
    (w >>> 24) & 255,
    (w >>> 16) & 255,
    (w >>> 8) & 255,
    w & 255,
    (h >>> 24) & 255,
    (h >>> 16) & 255,
    (h >>> 8) & 255,
    h & 255,
    8,
    2,
    0,
    0,
    0,
  ]);
  pngChunk('IHDR', ihdr, out);
  pngChunk('IDAT', zlib.subarray(0, p), out);
  pngChunk('IEND', new Uint8Array(0), out);
  return new Uint8Array(out);
}

LAB._test = { substep, audit };