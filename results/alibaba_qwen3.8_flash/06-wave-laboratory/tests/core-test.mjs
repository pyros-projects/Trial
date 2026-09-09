// =========================================================================
// tests/core-test.mjs — physics checks for the wave solver.
// Extracts the code between /*__CORE_START__*/ and /*__CORE_END__*/ from
// src/02-core.js (or index.html with --built) and evaluates it in a bare VM,
// so every number below comes from the same solver code the browser runs.
//   node tests/core-test.mjs          node tests/core-test.mjs --built
// =========================================================================
import fs from "node:fs";
import vm from "node:vm";

const built = process.argv.includes("--built");
const file = built ? "index.html" : "src/02-core.js";
const txt = fs.readFileSync(file, "utf8");
const a = txt.indexOf("/*__CORE_START__*/"), b = txt.indexOf("/*__CORE_END__*/");
if (a < 0 || b < 0) { console.error("FAIL: core markers not found in " + file); process.exit(1); }
const ctx = { console, Math, Float32Array, Float64Array, Uint8Array };
vm.createContext(ctx);
vm.runInContext(txt.slice(a, b + "/*__CORE_END__*/".length), ctx);
const Core = ctx.WaveCore;
if (!Core) { console.error("FAIL: WaveCore did not load"); process.exit(1); }

let pass = 0, fail = 0;
const notes = [];
function ok(name, cond, detail) {
  (cond ? pass++ : fail++);
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? "  :: " + detail : ""}`);
  notes.push(`${cond ? "pass" : "FAIL"} — ${name}${detail ? " :: " + detail : ""}`);
}
const info = (t) => { console.log("        " + t); notes.push("info — " + t); };

const mk = (W = 500, H = 320, Lx = 8, extra = {}) => Core.create({ W, H, Lx, ...extra });
let SID = 1;
const mkSrc = (S, o) => {
  const s = Object.assign({
    id: SID++, kind: "cw", shape: "point", x: 40, y: 160, angle: 90, amp: 1,
    freq: 2.5, phase: 0, active: true, wf: "sine", steer: 0, curv: 0,
    focus: 0, spacing: 2, n: 8, len: 40, speed: 1, scale: 1, pulseW: 0.2
  }, o);
  Core.buildFootprint(S, s);
  return s;
};
const line = (x0, y0, x1, y1, n) => {
  const p = [];
  for (let i = 0; i < n; i++) { p.push(x0 + (x1 - x0) * i / (n - 1), y0 + (y1 - y0) * i / (n - 1)); }
  return p;
};
/* peak |u| along a polyline, swept over nT time samples (phase-coherent) */
function envelope(S, pts, nT, srcs, opt) {
  const out = new Float64Array(pts.length / 2);
  for (let t = 0; t < nT; t++) {
    Core.stepFrame(S, 1, srcs || [], opt || {});
    for (let k = 0; k < out.length; k++) {
      const v = Math.abs(Core.sample(S, pts[2 * k], pts[2 * k + 1]));
      if (v > out[k]) out[k] = v;
    }
  }
  return out;
}
const mean = (arr) => arr.reduce((s, v) => s + v, 0) / arr.length;
const maxOf = (arr) => arr.reduce((s, v) => Math.max(s, v), 0);
const runN = (S, n, srcs, opt) => { for (let i = 0; i < n; i++) Core.stepFrame(S, 1, srcs || [], opt || {}); };

/* ============================ 1. solver sanity: dispersion + steady state */
{
  const S = mk();
  const s = mkSrc(S, { shape: "line", x: 25, y: 160, len: 290 });
  runN(S, Math.round(14 / S.p.dt), [s]);
  const per = (x0, y0, x1, y1) => {
    let prev = 0, last = -1, tot = 0, cnt = 0;
    const L = Math.hypot(x1 - x0, y1 - y0), n = Math.round(L / 0.25);
    for (let k = 0; k <= n; k++) {
      const x = x0 + (x1 - x0) * k / n, y = y0 + (y1 - y0) * k / n;
      const v = Core.sample(S, x, y);
      if (prev < 0 && v >= 0) { if (last > 0) { tot += (k - last) * L / n; cnt++; } last = k; }
      prev = v;
    }
    return cnt ? tot / cnt : 0;
  };
  const lam = per(60, 160, 480, 160);
  const lamWant = 1 / 2.5 / S.dx;
  info(`plane wave: measured wavelength ${lam.toFixed(2)} cells, analytic c/f/dx = ${lamWant.toFixed(2)}`);
  ok("1a wavelength reproduces c/f (<3% error)", Math.abs(lam - lamWant) / lamWant < 0.03,
    `${lam.toFixed(2)} vs ${lamWant.toFixed(2)} cells`);
  ok("1b field reached a finite steady state", S.maxAbs > 0.05 && S.maxAbs < 8 && S.stats.bad === 0,
    `max|u|=${S.maxAbs.toFixed(3)} bad=${S.stats.bad}`);
}

/* ==================================== 2. stability condition (CFL) demo  */
{
  const run = (dt, W, unsafe) => {
    const S = mk(W, 320, 8, { dt });
    const s = mkSrc(S, { shape: "line", x: 25, y: 160, len: 290 });
    runN(S, 500, [s], { unsafe });
    return S;
  };
  const good = run(0.006, 500, false);
  const bad = run(0.02, 500, true);         // cfl = 0.02/0.016 = 1.25
  const clamped = run(0.02, 500, false);
  ok("2a subcritical CFL stays bounded", good.maxAbs < 8 && good.stats.bad === 0,
    `cfl=${good.cfl.toFixed(3)} max=${good.maxAbs.toFixed(2)}`);
  ok("2b supercritical CFL (clamp off) goes unstable", bad.maxAbs > 1e3 || bad.stats.bad > 1000,
    `cfl=${bad.cfl.toFixed(3)} max=${bad.maxAbs.toExponential(2)} badCells=${bad.stats.bad}`);
  ok("2c auto-clamp keeps a supercritical request finite",
    clamped.maxAbs < 8 && clamped.stats.bad === 0 && clamped.dtUsed < 0.02 - 1e-9,
    `requested 0.02 -> used ${clamped.dtUsed.toFixed(5)} (cfl ${clamped.cfl.toFixed(3)}), max=${clamped.maxAbs.toFixed(2)}`);
}

/* ============================ 3. lossless single-mode oscillation.
   A uniform plane mode in a periodic box is an exact eigenmode of the
   discrete operator, so with damping 0 its amplitude must not drift and its
   frequency must match the leapfrog dispersion relation (and therefore the
   continuum one to within numerical dispersion).                          */
{
  const check = (cpl, dt, W) => {
    const S = mk(W, 8, 8, { dt });
    S.p.damping = 0; S.p.boundary = "periodic";
    const dx = S.dx, kdx = 2 * Math.PI / cpl, cfl = dt / dx;
    Core.rebuild(S);
    for (let y = 0; y < S.H; y++) for (let x = 0; x < S.W; x++) {
      const v = Math.sin(kdx * x), i = y * S.W + x; S.uc[i] = v; S.up[i] = v;
    }
    const T0 = cpl * dx, probe = W / 2 + cpl / 4;
    const tr = [];
    for (let i = 0; i < Math.round(12 * T0 / dt); i++) { Core.stepFrame(S, 1, [], {}); tr.push(Core.sample(S, probe, 4)); }
    let best = 0, bw = 0;
    for (let T = T0 * 0.9; T < T0 * 1.1; T += 0.000002) {
      let c = 0, s = 0;
      for (let i = 0; i < tr.length; i++) { const t = (i + 1) * dt; c += tr[i] * Math.cos(2 * Math.PI * t / T); s += tr[i] * Math.sin(2 * Math.PI * t / T); }
      const a = Math.hypot(c, s); if (a > best) { best = a; bw = T; }
    }
    const pk = (a) => a.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
    return { T: bw, T0, amp0: pk(tr.slice(0, 200)), amp1: pk(tr.slice(-200)), cfl, bad: S.stats.bad };
  };
  const fine = check(100, 0.0012, 1000), mid = check(25, 0.006, 500);
  ok("3a lossless run stays bounded over 12+ periods (no blow-up, no drift to zero)",
    mid.amp1 > 0.4 * mid.amp0 && mid.amp1 < 2.5 * mid.amp0 &&
    fine.amp1 > 0.4 * fine.amp0 && fine.amp1 < 2.5 * fine.amp0 && mid.bad === 0,
    `peak|u| ${mid.amp0.toFixed(3)} -> ${mid.amp1.toFixed(3)} (25 cells/lambda) and ${fine.amp0.toFixed(3)} -> ${fine.amp1.toFixed(3)} (100 cells/lambda), unstable cells=${mid.bad}`);
  ok("3b oscillation frequency matches the dispersion relation (<1%)",
    Math.abs(mid.T / mid.T0 - 1) < 0.01 && Math.abs(fine.T / fine.T0 - 1) < 0.005,
    `25 cells/lambda: T=${mid.T.toFixed(5)} vs continuum ${mid.T0.toFixed(5)} (${(100 * (mid.T / mid.T0 - 1)).toFixed(2)}%); 100 cells/lambda: ${fine.T.toFixed(5)} vs ${fine.T0.toFixed(5)}`);
}

/* ========================= 4. two-source interference + edit response    */
{
  const S = mk();
  const A = mkSrc(S, { x: 60, y: 120 }), B = mkSrc(S, { x: 60, y: 200 });
  runN(S, Math.round(12 / S.p.dt), [A, B]);
  const pts = line(420, 20, 420, 300, 140);
  const before = envelope(S, pts, 140, [A, B]);
  let mx = 0, mn = 1e9;
  for (const v of before) { if (v > mx) mx = v; if (v < mn) mn = v; }
  ok("4a two sources form fringes", mx / mn > 3,
    `envelope max/min = ${(mx / mn).toFixed(1)} at x=420`);
  let quiet = 0; for (const v of before) if (v < 0.2 * mx) quiet++;
  ok("4b destructive cancellation lines exist", quiet >= 6,
    `${quiet} of 140 samples below 20% of peak`);
  B.y = 170; Core.buildFootprint(S, B);
  runN(S, Math.round(6 / S.p.dt), [A, B]);
  const after = envelope(S, pts, 140, [A, B]);
  let d = 0; for (let k = 0; k < before.length; k++) d += Math.abs(after[k] - before[k]);
  ok("4c moving a source rewrites the pattern", d / before.length > 0.06 * mx,
    `mean |Δenvelope| ${(d / before.length).toFixed(3)} vs peak ${mx.toFixed(2)}`);
}

/* ============================ 5. barriers, single-slit diffraction      */
{
  const scene = (gap) => {
    const S = mk();
    for (let y = 0; y < S.H; y++) {
      if (gap && Math.abs(y - S.H / 2) < gap / 2) continue;
      Core.paintDisc(S, 190, y, 1.4, 1, 0);
    }
    const s = mkSrc(S, { shape: "line", x: 30, y: S.H / 2, len: S.H - 30 });
    runN(S, Math.round(14 / S.p.dt), [s]);
    return { S, s };
  };
  const solid = scene(0), narrow = scene(10), wide = scene(46);
  const pts = line(400, 20, 400, 300, 110);
  const eSolid = envelope(solid.S, pts, 130, [solid.s]);
  const eNarrow = envelope(narrow.S, pts, 130, [narrow.s]);
  const eWide = envelope(wide.S, pts, 130, [wide.s]);
  ok("5a solid barrier shields the shadow", mean(eSolid) < 0.01,
    `mean|u| behind solid wall ${mean(eSolid).toExponential(2)}, max ${maxOf(eSolid).toExponential(2)}`);
  ok("5b a 10-cell slit diffracts into the shadow", mean(eNarrow) > 10 * mean(eSolid) && mean(eNarrow) > 0.05,
    `mean|u| behind slitted wall ${mean(eNarrow).toExponential(2)}`);
  // spreading: the narrow aperture feeds a wider fan than the wide aperture
  const spread = (e) => { let n = 0; for (const v of e) if (v > 0.25 * maxOf(e)) n++; return n; };
  const s1 = spread(eNarrow), s2 = spread(eWide);
  ok("5c narrower slit spreads wider than wide slit", s1 > s2,
    `lit width at x=400: gap 10 -> ${s1}/110 samples, gap 46 -> ${s2}/110`);
  // adding a second barrier downstream changes what is already there
  const mod = scene(10);
  for (let y = 180; y < 300; y++) Core.paintDisc(mod.S, 300, y, 1.4, 1, 0);
  runN(mod.S, Math.round(8 / mod.S.p.dt), [mod.s]);
  const pts2 = line(430, 190, 430, 300, 60);
  const eMod = envelope(mod.S, pts2, 120, [mod.s]);
  const eRef = envelope(narrow.S, pts2, 120, [narrow.s]);
  let d = 0; for (let k = 0; k < eRef.length; k++) d += Math.abs(eMod[k] - eRef[k]);
  ok("5d drawing a second barrier changes the live field", d / eRef.length > 0.1 * maxOf(eRef),
    `mean |Δ| ${(d / eRef.length).toExponential(2)} vs mean field ${mean(eRef).toExponential(2)}`);
}

/* ==================================== 6. refraction: index changes c, λ  */
{
  const S = mk();
  for (let y = 0; y < S.H; y++) for (let x = 250; x < 400; x++) Core.paintDisc(S, x, y, 0.2, 3, 0.6);
  const s = mkSrc(S, { shape: "line", x: 30, y: S.H / 2, len: S.H - 30 });
  runN(S, Math.round(14 / S.p.dt), [s]);
  const per = (x0, x1) => {
    let prev = 0, last = -1, tot = 0, cnt = 0;
    for (let x = x0; x <= x1; x += 0.25) {
      const v = Core.sample(S, x, S.H / 2);
      if (prev < 0 && v >= 0) { if (last > 0) { tot += x - last; cnt++; } last = x; }
      prev = v;
    }
    return cnt ? tot / cnt : 0;
  };
  const l0 = per(60, 230), l1 = per(270, 390);
  ok("6a wavelength shrinks by the index ratio in the slow region",
    l1 / l0 > 0.53 && l1 / l0 < 0.68, `lambda ratio ${(l1 / l0).toFixed(3)} (c=0.6 -> expect 0.60)`);
  // prism: only the upper half of a narrow beam is slowed -> beam turns
  const build = (withSlab) => {
    const S2 = mk();
    if (withSlab) for (let x = 210; x < 430; x++) for (let y = 95; y < 130; y++) Core.paintDisc(S2, x, y, 0.2, 3, 0.5);
    const s2 = mkSrc(S2, { shape: "line", x: 40, y: 150, len: 90 });
    runN(S2, Math.round(14 / S2.p.dt), [s2]);
    const pts = line(430, 60, 430, 260, 130);
    return envelope(S2, pts, 140, [s2]);
  };
  const flat = build(false), prism = build(true);
  const centroid = (e) => {
    let s = 0, sw = 0;
    for (let k = 0; k < e.length; k++) { const w = Math.max(0, e[k] - 0.15 * maxOf(e)); s += w; sw += w * k; }
    return s > 0 ? 60 + 200 * (sw / s) / (e.length - 1) : NaN;
  };
  const c0 = centroid(flat), c1 = centroid(prism);
  ok("6b oblique index boundary bends the beam", Math.abs(c1 - c0) > 8,
    `beam centroid at x=430: ${c0.toFixed(1)} -> ${c1.toFixed(1)} (Δ ${Math.abs(c1 - c0).toFixed(1)} cells)`);
}

/* ======================================= 7. lens focuses a plane wave    */
{
  const build = (withLens) => {
    const S = mk();
    if (withLens) Core.paintDisc(S, 300, S.H / 2, 70, 4, 0);
    const s = mkSrc(S, { shape: "line", x: 40, y: S.H / 2, len: 76 });
    runN(S, Math.round(14 / S.p.dt), [s]);
    return { S, s };
  };
  const no = build(false), yes = build(true);
  const widthAt = (o, x) => {
    const e = envelope(o.S, line(x, 40, x, 280, 100), 130, [o.s]);
    const mx = maxOf(e);
    let n = 0; for (const v of e) if (v > 0.5 * mx) n++;
    return n;
  };
  const wIn = widthAt(yes, 302);
  const ws = [], xs = [];
  for (let x = 310; x <= 470; x += 6) { ws.push(widthAt(yes, x)); xs.push(x); }
  const mn = Math.min(...ws), atX = xs[ws.indexOf(mn)];
  ok("7a beam converges after the lens", mn < 0.4 * wIn,
    `half-max beam width: ${wIn}/100 just inside the lens -> ${mn}/100 at x=${atX}`);
  const wNo = widthAt(no, atX);
  ok("7b the same place without the lens stays wide (lens did it)", wNo > 2.2 * mn,
    `at x=${atX}: no lens ${wNo}/100 vs lens ${mn}/100`);
}

/* ================================ 8. phased-array steering + focusing  */
/* 12 elements at 3-cell pitch = a 33-cell aperture (2.6 lambda at f=5).
   Small enough that the far field forms inside a 500-cell tank.          */
{
  const build = (o) => {
    const S = mk(500, 340, 8);
    const s = mkSrc(S, Object.assign({
      shape: "array", x: 55, y: 170, n: 12, spacing: 3, freq: 5, steer: 0
    }, o));
    runN(S, Math.round(6 / S.p.dt), [s]);
    return { S, s };
  };
  const profAt = (o, x, y0, y1, n) => envelope(o.S, line(x, y0, x, y1, n), 200, [o.s]);
  const peakY = (e, y0, y1) => {
    let mi = 0; for (let k = 0; k < e.length; k++) if (e[k] > e[mi]) mi = k;
    return y0 + (y1 - y0) * mi / (e.length - 1);
  };
  const X = 340, run = X - 55;
  const flat = build({ steer: 0 });
  const yFlat = peakY(profAt(flat, X, 20, 320, 150), 20, 320);
  ok("8a unsteered array beams along its normal", Math.abs(yFlat - 170) < 12,
    `main-lobe peak at y=${yFlat.toFixed(0)} on a line at x=${X} (array axis y=170)`);
  const neg = build({ steer: -20 }), pos = build({ steer: 20 });
  const yNeg = peakY(profAt(neg, X, 20, 320, 150), 20, 320);
  const yPos = peakY(profAt(pos, X, 20, 320, 150), 20, 320);
  const wantNeg = 170 - Math.tan(20 * Math.PI / 180) * run;
  const wantPos = 170 + Math.tan(20 * Math.PI / 180) * run;
  ok("8b phase gradient steers the beam to the commanded angle",
    Math.abs(yNeg - wantNeg) < 22 && Math.abs(yPos - wantPos) < 22,
    `steer -20 -> peak y=${yNeg.toFixed(0)} (geometric ${wantNeg.toFixed(0)}), steer +20 -> peak y=${yPos.toFixed(0)} (geometric ${wantPos.toFixed(0)})`);
  const one = build({ n: 1 });
  const eArr = profAt(flat, X, 20, 320, 150), eOne = profAt(one, X, 20, 320, 150);
  const conc = (e) => { const mx = maxOf(e); let n = 0; for (const v of e) if (v > 0.5 * mx) n++; return n / e.length; };
  ok("8c 12-element array is more directional than one element",
    conc(eArr) < 0.72 * conc(eOne),
    `half-power beam width at x=${X}: 12 el ${(100 * conc(eArr)).toFixed(0)}% of the line, 1 el ${(100 * conc(eOne)).toFixed(0)}%`);
  const foc = build({ n: 12, spacing: 3, freq: 5, curv: 30, focus: 45 });
  const flatRef = build({ n: 12, spacing: 3, freq: 5, curv: 0, focus: 0 });
  const wF = (() => { const e = profAt(foc, 100, 40, 300, 120); const mx = maxOf(e); let n = 0; for (const v of e) if (v > 0.5 * mx) n++; return n; })();
  const wR = (() => { const e = profAt(flatRef, 100, 40, 300, 120); const mx = maxOf(e); let n = 0; for (const v of e) if (v > 0.5 * mx) n++; return n; })();
  ok("8d concave array concentrates energy on its focal line", wF < 0.62 * wR,
    `beam width at x=100 (focal line): curved ${wF}/120 vs flat ${wR}/120`);
}

/* ==================================== 9. probe readout reflects the field */
{
  const S = mk();
  const p1 = { x: 250, y: 160, hist: new Float32Array(Core.HIST), n: 0, hp: 0 };
  const p2 = { x: 430, y: 160, hist: new Float32Array(Core.HIST), n: 0, hp: 0 };
  S.probes.push(p1, p2);
  S.pStr = 2;
  const s = mkSrc(S, { shape: "line", x: 30, y: 160, len: 290 });
  runN(S, 1600, [s]);                        /* let it settle first         */
  for (const p of S.probes) { p.n = 0; p.hp = 0; }
  const peakLive = [0, 0];
  for (let i = 0; i < 1400; i++) {
    Core.stepFrame(S, 1, [s], {});
    for (let k = 0; k < 2; k++) {
      const v = Math.abs(Core.sample(S, k ? 430 : 250, 160));
      if (v > peakLive[k]) peakLive[k] = v;
    }
  }
  for (const p of S.probes) ok("9a probe trace fills its ring buffer", p.n === Core.HIST, `n=${p.n}/${Core.HIST}`);
  const pk = (p) => { let m = 0, nan = 0; for (let i = 0; i < p.n; i++) { if (!isFinite(p.hist[i])) nan++; m = Math.max(m, Math.abs(p.hist[i])); } return { m, nan }; };
  const t1 = pk(p1), t2 = pk(p2);
  ok("9b probe trace matches the local field envelope",
    t1.nan === 0 && Math.abs(t1.m - peakLive[0]) < 0.05 * peakLive[0] && Math.abs(t2.m - peakLive[1]) < 0.12 * peakLive[1],
    `p1 trace ${t1.m.toExponential(3)} vs field ${peakLive[0].toExponential(3)}; p2 ${t2.m.toExponential(3)} vs ${peakLive[1].toExponential(3)}`);
  Core.clearField(S);
  ok("9c clear field resets probe traces", p1.n === 0 && p1.hp === 0 && S.probes.length === 2, `n=${p1.n}`);
  const S2 = mk();
  for (let y = 0; y < S2.H; y++) Core.paintDisc(S2, 190, y, 1.4, 1, 0);
  const ps = { x: 400, y: 60, hist: new Float32Array(Core.HIST), n: 0, hp: 0 };
  S2.probes.push(ps);
  const s2 = mkSrc(S2, { shape: "line", x: 30, y: 160, len: 290 });
  runN(S2, Math.round(12 / S2.p.dt), [s2]);
  let m2 = 0; for (let i = 0; i < ps.n; i++) m2 = Math.max(m2, Math.abs(ps.hist[i]));
  ok("9d probe in a barrier shadow reads ~0", m2 < 0.01, "peak trace in shadow " + m2.toExponential(2));
}

/* ============================= 10. pulse speed, reflection, absorption  */
{
  const mkPulse = (o) => {
    const S = mk();
    const s = mkSrc(S, Object.assign({
      kind: "pulse", shape: "line", x: 30, y: 160, len: 250, freq: 5,
      pulseW: 0.09, amp: 1, repeat: false
    }, o));
    return { S, s };
  };
  const DT = 0.006;
  const two = mkPulse();
  const pa = [], pb = [];
  for (let i = 0; i < 1500; i++) {
    Core.stepFrame(two.S, 1, [two.s], {});
    pa.push(Math.abs(Core.sample(two.S, 180, 160)));
    pb.push(Math.abs(Core.sample(two.S, 380, 160)));
  }
  const arrive = (arr, thr) => { for (let i = 0; i < arr.length; i++) if (arr[i] > thr) return i; return -1; };
  const i1 = arrive(pa, 0.3 * maxOf(pa)), i2 = arrive(pb, 0.3 * maxOf(pb));
  const dtMeas = (i2 - i1) * DT, dtWant = 200 * two.S.dx / 1.0;
  ok("10a pulse group travels at the configured wave speed",
    Math.abs(dtMeas - dtWant) / dtWant < 0.08 && i1 > 0 && i2 > i1,
    `200 cells took ${dtMeas.toFixed(3)} s, expectation at c=1 is ${dtWant.toFixed(3)} s`);

  /* Echo geometry.  Point pulse source at (40,40); a rigid horizontal
     mirror at y=200 spanning x=80..420; probe at (300,60); a thick
     absorbing baffle at x=120 (y=20..120) absorbs the direct pulse, so the
     only way to reach the probe is by bouncing off the mirror.  Specular
     point (179,200), total path 397 cells -> 6.36 s at c=1 (the blocked
     direct path would have been 4.17 s).                                   */
  const spec = (mirrorMode, baffle) => {
    const S = mk();
    const s = mkSrc(S, { kind: "pulse", shape: "point", x: 40, y: 40, freq: 5, pulseW: 0.08, repeat: false });
    if (baffle) for (let y = 20; y < 120; y += 1.5)
      for (let k = 0; k < 6; k++) Core.paintDisc(S, 112 + k * 2.5, y, 1.4, 2, 0);
    if (mirrorMode) for (let x = 80; x <= 420; x += 1.2) Core.paintDisc(S, x, 200, 1.4, mirrorMode, 0);
    const h = [];
    for (let i = 0; i < 1500; i++) { Core.stepFrame(S, 1, [s], {}); h.push(Math.abs(Core.sample(S, 300, 60))); }
    const win = (t0, t1) => {
      let m = 0, at = -1;
      for (let i = 0; i < h.length; i++) if (i * DT >= t0 && i * DT <= t1 && h[i] > m) { m = h[i]; at = i; }
      return { m, t: at * DT };
    };
    return { direct: win(3.5, 4.6), pre: win(5.4, 6.0), echo: win(6.1, 6.7), all: maxOf(h) };
  };
  const open1 = spec(0, false), withBaffle = spec(0, true), wall = spec(1, true), abs = spec(2, true);
  ok("10b baffle puts the probe in the direct-path shadow",
    withBaffle.all < 0.35 * open1.all && open1.all > 0.1,
    `probe signal without a baffle ${open1.all.toExponential(2)} -> with baffle ${withBaffle.all.toExponential(2)}`);
  ok("10c rigid mirror returns a pulse at the specular path length",
    wall.echo.m > 2.2 * wall.pre.m && wall.echo.m > 3 * withBaffle.all &&
    Math.abs(wall.echo.t - 6.36) < 0.25,
    `echo ${wall.echo.m.toExponential(2)} at t=${wall.echo.t.toFixed(2)} s (397-cell specular path -> expect 6.36 s); quiet window before it ${wall.pre.m.toExponential(2)}`);
  /* separate check: how much of a plane pulse gets through each barrier
     type, measured behind it (the mirror geometry above also lets energy
     diffract round its ends, so transmission is measured on its own) */
  const transm = (mode, thick) => {
    const S = mk(600, 320, 8);
    const s = mkSrc(S, { kind: "pulse", shape: "line", x: 30, y: 160, len: 300, freq: 5, pulseW: 0.06, repeat: false });
    for (let y = 0; y < 320; y += 1.2)
      for (let k = 0; k < thick; k++) Core.paintDisc(S, 250 + k * 2.5, y, 1.4, mode, 0);
    const before = [], after = [];
    for (let i = 0; i < 1200; i++) {
      Core.stepFrame(S, 1, [s], {});
      before.push(Math.abs(Core.sample(S, 150, 160)));
      after.push(Math.abs(Core.sample(S, 450, 160)));
    }
    return { b: maxOf(before), a: maxOf(after) };
  };
  const tOpen = transm(0, 0), tWall = transm(1, 1), tAbs = transm(2, 4);
  ok("10d thick absorbing barrier removes 300x of a transmitted pulse",
    tOpen.a > 0.15 * tOpen.b && tAbs.a < tOpen.a / 300,
    `behind-barrier peak: open ${tOpen.a.toExponential(2)}, absorber ${tAbs.a.toExponential(2)}, rigid wall ${tWall.a.toExponential(2)} (incident ${tOpen.b.toExponential(2)})`);
}

/* ============================================== 11. per-frame cost (node) */
{
  const S = mk();
  const s = mkSrc(S, { shape: "line", x: 30, y: 160, len: 290 });
  for (let i = 0; i < 40; i++) Core.stepFrame(S, 3, [s], { flux: true });
  const t0 = Date.now();
  for (let i = 0; i < 60; i++) Core.stepFrame(S, 3, [s], { flux: true });
  const ms = (Date.now() - t0) / 60;
  ok("11 3 substeps at 500x320 under 30 ms/frame", ms < 30, ms.toFixed(2) + " ms/frame in node (incl. flux pass)");
}

console.log(`\n${pass} passed, ${fail} failed  (source: ${file})`);
fs.writeFileSync("evidence/core-test-run.txt", notes.join("\n") + `\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
