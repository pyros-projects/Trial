/*__CORE_START__*/
/* =========================================================================
   WaveCore — DOM-free 2D scalar wave solver (finite difference, leapfrog).

     u_tt + 2*gamma*u_t = c(x,y)^2 * lap(u) + sources

   Discretisation (5-point Laplacian, dx = dy, leapfrog in time):

     (u2 - 2*u1 + u0)/dt^2 + 2*gamma*(u2 - u0)/(2*dt) = c^2 * lap/dx^2
     =>  u2 = ( 2*u1 - (1-g)*u0 + k^2*lap ) / (1 + g)
         g = gamma*dt ,  k = c*dt/dx  (CFL; stable while k <= 1/sqrt(2))

   WALL cells are dropped from the stencil, so a fluid cell next to a wall
   uses "sum(avail) - n*u1": a zero-normal-derivative (rigid) condition that
   reflects in phase, like a ripple-tank barrier.  Absorbers instead raise
   gamma locally (and drop c) so energy dies inside them.

   Everything here is DOM free and deterministic: the same buffers and the
   same calls reproduce bit-for-bit, which lets the Node test-harness drive
   exactly the code the browser runs.
   ========================================================================= */
var WaveCore = (function () {
  "use strict";

  var WATER = 0, WALL = 1;
  var HIST = 640;
  var MAXPROBE = 8;
  var CFL_LIMIT = 1 / Math.SQRT2;

  /* ---------------------------------------------------------------- create */
  function create(cfg) {
    var W = cfg.W | 0, H = cfg.H | 0, Lx = cfg.Lx, N = W * H;
    var dx = Lx / W;
    var S = {
      W: W, H: H, N: N, Lx: Lx, Ly: H * dx, dx: dx,
      flag: new Uint8Array(N),
      spd: new Float32Array(N),      /* local wave-speed multiplier        */
      los: new Float32Array(N),      /* local damping gamma (1/s)          */
      k2: new Float32Array(N),       /* (c*dt/dx)^2, rebuilt per frame     */
      gd: new Float32Array(N),       /* gamma*dt                           */
      iD: new Float32Array(N),       /* 1/(1+gamma*dt)                     */
      I: new Float32Array(N),        /* time-averaged intensity (EMA of u^2)
                                      */
      env: new Float32Array(N),      /* persistence / long-exposure trace  */
      q: new Float32Array(N),        /* leaky integral of u -> quadrature  */
      fx: new Float32Array(N),
      fy: new Float32Array(N),
      up: new Float32Array(N),
      uc: new Float32Array(N),
      un: new Float32Array(N),
      time: 0, steps: 0, dtRef: 0.006,
      maxAbs: 0, energy: 0, dtUsed: cfg.dt || 0.006,
      cfl: 0, lamCells: 0, dirty: true, unsafe: false, k2dt: 0,
      pStr: 1,
      probes: [], sources: [],
      p: {
        dt: cfg.dt || 0.006, c0: cfg.c0 || 1.0, damping: 0.25,
        boundary: "absorb", substeps: 3, persistence: 0.0, refFreq: 2.5
      },
      stats: { bad: 0 }
    };
    S.spd.fill(1);
    rebuild(S);
    return S;
  }

  /* ------------------------------------------------------- cache rebuild  */
  function rebuild(S) {
    var p = S.p, dt = p.dt, dx = S.dx;
    var kbase = p.c0 * dt / dx;
    var band = p.boundary === "absorb"
      ? Math.max(6, Math.round(0.14 * Math.min(S.W, S.H))) : 0;
    var W = S.W, H = S.H, i = 0, maxK = kbase;
    for (var y = 0; y < H; y++) {
      var edgeY = y < H - 1 - y ? y : H - 1 - y;
      for (var x = 0; x < W; x++, i++) {
        var sm = S.spd[i], g = p.damping + S.los[i];
        if (band) {
          var d = x < W - 1 - x ? x : W - 1 - x;
          if (edgeY < d) d = edgeY;
          if (d < band) {
            var t = 1 - d / band;
            var add = 90 * t * t * t;
            if (add > g) g = add;
            sm *= 1 - 0.32 * t;
          }
        }
        var kk = sm * kbase;
        if (kk > maxK) maxK = kk;
        var gd = g * dt;
        S.gd[i] = gd;
        S.iD[i] = 1 / (1 + gd);
        S.k2[i] = kk * kk;
      }
    }
    S.cfl = maxK;
    S.lamCells = p.c0 / Math.max(0.05, p.refFreq) / dx;
    S.unstable = maxK > CFL_LIMIT + 1e-9;
    S.dirty = false;
  }

  /* ------------------------------------------------------------ clear/ops */
  function clearField(S) {
    S.up.fill(0); S.uc.fill(0); S.un.fill(0);
    S.I.fill(0); S.env.fill(0); S.q.fill(0); S.fx.fill(0); S.fy.fill(0);
    S.maxAbs = 0; S.energy = 0; S.stats.bad = 0;
    for (var i = 0; i < S.probes.length; i++) { S.probes[i].n = 0; S.probes[i].hp = 0; }
  }

  function clearMedium(S) {
    S.flag.fill(WATER); S.los.fill(0); S.spd.fill(1);
    S.dirty = true;
  }

  /* Circular brush. mode: 1 wall | 2 absorber | 3 medium(spd=val)
                            4 lens | 0 erase                                */
  function paintDisc(S, cx, cy, r, mode, val) {
    /* absorbers use a wider, tapered footprint: a 1-2 cell damped layer
       reflects most of what hits it, a graded ~10 cell layer absorbs it */
    var rEff = mode === 2 ? r * 1.7 : r;
    var r2 = rEff * rEff, n = 0;
    var x0 = Math.max(0, Math.floor(cx - rEff - 1)), x1 = Math.min(S.W - 1, Math.ceil(cx + rEff + 1));
    var y0 = Math.max(0, Math.floor(cy - rEff - 1)), y1 = Math.min(S.H - 1, Math.ceil(cy + rEff + 1));
    for (var y = y0; y <= y1; y++) {
      for (var x = x0; x <= x1; x++) {
        var ddx = x - cx, ddy = y - cy, d2 = ddx * ddx + ddy * ddy;
        if (d2 > r2) continue;
        var i = y * S.W + x;
        n++;
        switch (mode) {
          case 1: S.flag[i] = WALL; S.los[i] = 0; S.spd[i] = 1; break;
          case 2: {
            var prof = 1 - d2 / r2;
            var l = 80 * prof * prof;
            S.flag[i] = WATER;
            S.los[i] = S.los[i] > l ? S.los[i] : l;
            var sv = 1 - 0.68 * prof;
            S.spd[i] = S.spd[i] < sv ? S.spd[i] : sv;
            break;
          }
          case 3:
            S.flag[i] = WATER; S.los[i] = 0;
            S.spd[i] = S.spd[i] < val ? S.spd[i] : val;
            break;
          case 4: {
            var prof4 = 1 - d2 / r2;
            S.flag[i] = WATER; S.los[i] = 0;
            var target = 1 - 0.42 * prof4 * prof4;
            if (target < S.spd[i]) S.spd[i] = target;
            break;
          }
          default: S.flag[i] = WATER; S.los[i] = 0; S.spd[i] = 1; break;
        }
      }
    }
    if (n) S.dirty = true;
    return n;
  }

  /* Barrier along a segment with a slot of `gap` cells at its midpoint. */
  function paintSlit(S, x0, y0, x1, y1, r, gap) {
    var mx = (x0 + x1) * 0.5, my = (y0 + y1) * 0.5;
    var len = Math.hypot(x1 - x0, y1 - y0);
    var steps = Math.max(1, Math.ceil(len));
    var half = gap * 0.5, done = 0;
    for (var s = 0; s <= steps; s++) {
      var t = s / steps, px = x0 + (x1 - x0) * t, py = y0 + (y1 - y0) * t;
      if (Math.hypot(px - mx, py - my) < half) continue;
      done += paintDisc(S, px, py, r, 1, 0);
    }
    return done;
  }

  /* ------------------------------------------------------------- sampling */
  function sampleBuf(buf, S, x, y) {
    var W = S.W, H = S.H;
    if (!(x >= 0)) x = 0;
    if (!(y >= 0)) y = 0;
    if (x > W - 1.001) x = W - 1.001;
    if (y > H - 1.001) y = H - 1.001;
    var x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0;
    var i = y0 * W + x0;
    var a = buf[i], b = buf[i + 1], c = buf[i + W], d = buf[i + W + 1];
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
  }
  function sample(S, x, y) { return sampleBuf(S.uc, S, x, y); }

  /* ------------------------------------------------- source footprint math */
  function buildFootprint(S, src) {
    var cells = [], W = S.W, H = S.H;
    var sigma = src.sigma > 0 ? src.sigma : (src.shape === "point" ? 1.15 : 0.7);
    var cspeed = Math.max(0.05, src.speed);

    function addBlob(x, y, delay) {
      var x0 = Math.max(0, Math.floor(x - 3 * sigma)), x1 = Math.min(W - 1, Math.ceil(x + 3 * sigma));
      var y0 = Math.max(0, Math.floor(y - 3 * sigma)), y1 = Math.min(H - 1, Math.ceil(y + 3 * sigma));
      for (var yy = y0; yy <= y1; yy++) {
        for (var xx = x0; xx <= x1; xx++) {
          if (xx < 0 || yy < 0 || xx > W - 1 || yy > H - 1) continue;
          var i = yy * W + xx;
          if (S.flag[i] === WALL) continue;
          var ddx = xx - x, ddy = yy - y;
          var w = Math.exp(-(ddx * ddx + ddy * ddy) / (2 * sigma * sigma));
          if (w < 0.02) continue;
          cells.push(i, delay, w);
        }
      }
    }

    var a = src.angle * Math.PI / 180;
    var ux = Math.cos(a), uy = Math.sin(a);          /* along the elements */
    var vx = -uy, vy = Math.cos(a);                   /* beam axis          */

    if (src.shape === "point") {
      addBlob(src.x, src.y, 0);
    } else if (src.shape === "line") {
      var L = Math.max(1, src.len);
      var n = Math.min(300, Math.max(2, Math.round(L / 1.3)));
      var st = Math.sin(src.steer * Math.PI / 180);
      for (var k = 0; k < n; k++) {
        var u = (k / (n - 1) - 0.5) * L;
        /* delays are in seconds: convert the cell offset to metres first */
        addBlob(src.x + ux * u, src.y + uy * u, -(u * st * S.dx) / cspeed);
      }
    } else {
      var ne = Math.max(1, src.n | 0), sp = src.spacing;
      var R = Math.abs(src.curv) < 1 ? 0 : src.curv;
      var pts = [], i;
      for (i = 0; i < ne; i++) {
        var uu = (i - (ne - 1) / 2) * sp;
        var vv = R === 0 ? 0 : -(uu * uu) / (2 * R);
        pts.push([uu, vv]);
      }
      var dmin = 1e9, ds = [];
      var F = src.focus > 0.5 ? src.focus : 0;
      for (i = 0; i < ne; i++) {
        var fu = pts[i][0], fv = pts[i][1] - F;
        var dd = Math.hypot(fu, fv);
        ds.push(dd); if (dd < dmin) dmin = dd;
      }
      var st2 = Math.sin(src.steer * Math.PI / 180);
      for (i = 0; i < ne; i++) {
        var pu = pts[i][0], pv = pts[i][1];
        var delay = (ds[i] - dmin) * S.dx / cspeed;
        /* sign chosen so that a positive "steer" angle tilts the beam
           towards +y (down on screen); verified in tests/core-test.mjs 8b */
        if (Math.abs(st2) > 1e-9) delay -= (pu * st2 * S.dx) / cspeed;
        addBlob(src.x + ux * pu + vx * pv, src.y + uy * pu + vy * pv, delay);
      }
    }
    src.cells = cells;
    src.nEl = cells.length / 3;
    return src;
  }

  /* ------------------------------------------------- waveform of a source  */
  function srcValue(src, t, delay) {
    var amp = src.amp;
    if (amp === 0) return 0;
    var tw = t - delay;
    if (tw < 0) return 0;
    var f = src.freq;
    if (src.kind === "pulse") {
      var per = Math.max(src.pulseW * 2.5, 0.05);
      var tw2 = src.repeat === false ? tw : tw % per;
      if (tw2 > src.pulseW) return 0;
      var z = (tw2 - src.pulseW * 0.5) / (src.pulseW * 0.35);
      var env = Math.exp(-z * z);
      return amp * env * Math.sin(2 * Math.PI * f * tw + src.phase * Math.PI / 180);
    }
    var ph = 2 * Math.PI * f * tw + src.phase * Math.PI / 180;
    switch (src.wf) {
      case "square": return amp * (Math.sin(ph) >= 0 ? 1 : -1);
      case "tri": return amp * (2 / Math.PI) * Math.asin(Math.sin(ph));
      case "burst": {
        var nc = src.burstN || 3;
        var dur = nc / f;
        var tb = tw % (dur * 3);
        if (tb > dur) return 0;
        var z2 = (tb - dur * 0.5) / (dur * 0.28);
        return amp * Math.exp(-z2 * z2) * Math.sin(ph);
      }
      default: return amp * Math.sin(ph);
    }
  }

  /* ------------------------------------------------------------- stepper  */
  function stepFrame(S, nSub, srcs, opt) {
    opt = opt || {};
    var p = S.p, dt = p.dt, dtReq = dt;
    var unsafe = opt.unsafe !== undefined ? opt.unsafe : S.unsafe;
    /* caches hold k^2 and the damping factor: rebuild whenever the scene or
       the requested step changed, then apply the stability clamp. */
    if (S.dirty || Math.abs(S.k2dt - dt) > 1e-15) { S.k2dt = dt; rebuild(S); }
    var clamped = false;
    if (!unsafe && S.cfl > CFL_LIMIT + 1e-9) {
      var ratio = (CFL_LIMIT * 0.99) / S.cfl;
      if (ratio < 1) {
        dt = dt * ratio;
        p.dt = dt; S.k2dt = dt;      /* rebuild() reads p.dt */
        rebuild(S);
        p.dt = dtReq;
        clamped = true;
      }
    }
    S.dtUsed = dt;

    var W = S.W, H = S.H;
    var flag = S.flag, k2 = S.k2, iD = S.iD;
    var I = S.I, env = S.env, q = S.q;
    var aI = 1 - Math.exp(-dt / 0.16);
    var rhoQ = Math.exp(-dt / 0.30);
    var tau = 0.02 + 3.2 * p.persistence * p.persistence;
    var decE = Math.exp(-dt / tau);
    var stride = S.pStr < 1 ? 1 : S.pStr;
    var wantFlux = !!opt.flux, fa = 0.10;
    var A = S.up, B = S.uc, C = S.un;
    var maxAbs = 0, energy = 0, bad = 0;
    var per = p.boundary === "periodic";
    var probes = S.probes;

    for (var s = 0; s < nSub; s++) {
      var tNew = S.time + dt;

      /* ---------------- interior (Jacobi: read B, write C) ------------- */
      for (var y = 1; y < H - 1; y++) {
        var row = y * W;
        for (var x = 1; x < W - 1; x++) {
          var i = row + x;
          if (flag[i] === WALL) { C[i] = 0; continue; }
          var n = 4, lap = 0;
          var l = i - 1, r = i + 1, u = i - W, d = i + W;
          if (flag[l] === WALL) n--; else lap += B[l];
          if (flag[r] === WALL) n--; else lap += B[r];
          if (flag[u] === WALL) n--; else lap += B[u];
          if (flag[d] === WALL) n--; else lap += B[d];
          var c0 = B[i];
          lap -= n * c0;
          var id = iD[i];
          var v = (2 * c0 - (1 - (1 / id - 1)) * A[i] + k2[i] * lap) * id;
          C[i] = v;
          var av = v < 0 ? -v : v;
          if (av > maxAbs) maxAbs = av;
          if (!(av < 1e20)) bad++;
          energy += v * v;
          I[i] += aI * (v * v - I[i]);
          var ev = env[i] * decE;
          env[i] = av > ev ? av : ev;
          q[i] = rhoQ * (q[i] + dt * v);
        }
      }

      /* ------------- boundary ring: mirror or periodic wrap ------------- */
      var ring = 2 * W + 2 * H - 4, side;
      for (var ri = 0; ri < ring; ri++) {
        var X, Y;
        if (ri < W) { X = ri; Y = 0; }
        else if (ri < W + H - 1) { X = W - 1; Y = 1 + (ri - W); }
        else if (ri < 2 * W + H - 2) { X = W - 2 - (ri - W - H + 2); Y = H - 1; }
        else { X = 0; Y = H - 1 - (ri - 2 * W - H + 3); }
        if (X < 0 || X > W - 1 || Y < 0 || Y > H - 1) continue;
        var ii = Y * W + X;
        if (flag[ii] === WALL) { C[ii] = 0; continue; }
        var nb = 0, lp = 0;
        for (side = 0; side < 4; side++) {
          var ax = X + (side === 0 ? -1 : side === 1 ? 1 : 0);
          var ay = Y + (side === 2 ? -1 : side === 3 ? 1 : 0);
          if (per) {
            if (ax < 0) ax += W; else if (ax >= W) ax -= W;
            if (ay < 0) ay += H; else if (ay >= H) ay -= H;
          } else if (ax < 0 || ax >= W || ay < 0 || ay >= H) continue;
          var jj = ay * W + ax;
          if (flag[jj] === WALL) continue;
          lp += B[jj]; nb++;
        }
        if (nb === 0) { C[ii] = 0; continue; }
        var cc = B[ii], id2 = iD[ii];
        var vv = (2 * cc - (1 - (1 / id2 - 1)) * A[ii] + k2[ii] * (lp - nb * cc)) * id2;
        C[ii] = vv;
        var av2 = vv < 0 ? -vv : vv;
        if (av2 > maxAbs) maxAbs = av2;
        if (!(av2 < 1e20)) bad++;
        I[ii] += aI * (vv * vv - I[ii]);
        var ev2 = env[ii] * decE;
        env[ii] = av2 > ev2 ? av2 : ev2;
        q[ii] = rhoQ * (q[ii] + dt * vv);
      }

      /* ---------------- soft (additive) sources ------------------------- */
      if (srcs && srcs.length) {
        for (var si = 0; si < srcs.length; si++) {
          var src = srcs[si];
          if (!src.active || src.amp === 0) continue;
          var cl = src.cells;
          if (!cl) { buildFootprint(S, src); cl = src.cells; }
          /* injection is scaled with dt so that the emitted amplitude does
             not change when the timestep is retuned (rate, not per-step) */
          var scale = src.scale * (src.shape === "point" ? 1.2 : 0.11)
                    * (dt / 0.006);
          for (var ci = 0; ci < cl.length; ci += 3) {
            var idx = cl[ci];
            C[idx] += srcValue(src, tNew, cl[ci + 1]) * cl[ci + 2] * scale;
          }
        }
      }

      /* ---------------- probe trace ------------------------------------- */
      if (probes.length && (S.steps % stride) === 0) {
        for (var pi = 0; pi < probes.length && pi < MAXPROBE; pi++) {
          var pb = probes[pi];
          if (!pb.hist) continue;
          pb.hist[pb.hp] = sampleBuf(C, S, pb.x, pb.y);
          pb.hp = (pb.hp + 1) % HIST;
          if (pb.n < HIST) pb.n++;
        }
      }

      /* ---------------- rotate buffers ---------------------------------- */
      var tmp = A; A = B; B = C; C = tmp;
      S.time = tNew;
      S.steps++;
    }

    if (wantFlux) {
      var fx = S.fx, fy = S.fy, inv2dx = 0.5 / S.dx;
      for (var yy = 1; yy < H - 1; yy++) {
        var rr = yy * W;
        for (var xx = 1; xx < W - 1; xx++) {
          var ii2 = rr + xx;
          if (flag[ii2] === WALL) { fx[ii2] = 0; fy[ii2] = 0; continue; }
          var ut = (B[ii2] - A[ii2]) / dt;
          var gx = (B[ii2 + 1] - B[ii2 - 1]) * inv2dx;
          var gy = (B[ii2 + W] - B[ii2 - W]) * inv2dx;
          fx[ii2] += fa * (-ut * gx - fx[ii2]);
          fy[ii2] += fa * (-ut * gy - fy[ii2]);
        }
      }
    }

    S.up = A; S.uc = B; S.un = C;
    S.maxAbs = maxAbs;
    S.energy = energy * 0.5 * dt * dt;
    if (bad) S.stats.bad += bad;
    return { dt: dt, clamped: clamped, steps: nSub };
  }

  return {
    HIST: HIST, MAXPROBE: MAXPROBE, CFL_LIMIT: CFL_LIMIT,
    create: create, rebuild: rebuild, clearField: clearField, clearMedium: clearMedium,
    paintDisc: paintDisc, paintSlit: paintSlit, sample: sample, sampleBuf: sampleBuf,
    buildFootprint: buildFootprint, srcValue: srcValue, stepFrame: stepFrame
  };
})();
/*__CORE_END__*/
