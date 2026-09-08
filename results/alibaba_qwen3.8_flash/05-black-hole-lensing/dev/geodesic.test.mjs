// Numeric validation of the geodesic integrator shared with index.html.
//   node dev/geodesic.test.mjs
//
// Cross-checks the production adaptive-step integrator against an independent
// fixed-step reference, the analytic weak-field deflection 4M/b, the exact
// Schwarzschild photon capture boundary b_c = 3*sqrt(3)/2*Rs, and the step budget
// actually used by the renderer.
import { traceGeodesic } from './geodesic.mjs';

let fails = 0, runs = 0;
function check(name, got, want, tol, unit = '') {
  runs++;
  const ok = Math.abs(got - want) <= tol;
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}: ${got.toFixed(5)} vs ${want.toFixed(5)} ±${tol}${unit}`);
}

const R0 = 60; // launch radius for test beams
const ESC = 60;

// Independent reference: fixed-step RK4 on the same ODE, no step cap.
function truth(p, d, Rs, escapeR) {
  const r0 = Math.hypot(...p);
  const er = p.map((v) => v / r0);
  const cr = d[0] * er[0] + d[1] * er[1] + d[2] * er[2];
  const sinA = Math.sqrt(Math.max(0, 1 - cr * cr));
  const f0 = Math.max(0.05, 1 - Rs / r0);
  const b = (r0 * sinA) / Math.sqrt(f0);
  if (sinA < 1e-6) return { status: 'radial', defl: 0, b };
  const e2 = [(d[0] - cr * er[0]) / sinA, (d[1] - cr * er[1]) / sinA, (d[2] - cr * er[2]) / sinA];
  const kappa = 1.5 * Rs;
  let u = 1 / r0;
  let w = -Math.sign(cr) * Math.sqrt(Math.max(1e-12, 1 / (b * b) - u * u * (1 - Rs * u)));
  let phi = 0;
  const h = 1e-4;
  for (let s = 0; s < 3000000; s++) {
    const f = (uu, ww) => [ww, -uu + kappa * uu * uu]; // [du/dphi, dw/dphi]
    const k1 = f(u, w);
    const k2 = f(u + 0.5 * h * k1[0], w + 0.5 * h * k1[1]);
    const k3 = f(u + 0.5 * h * k2[0], w + 0.5 * h * k2[1]);
    const k4 = f(u + h * k3[0], w + h * k3[1]);
    const nu = u + (h / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
    const nw = w + (h / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
    phi += h;
    if (1 / nu <= 1) return { status: 'captured', defl: 0, sweep: phi, b };
    if (1 / nu > escapeR) {
      const k = -nw / nu;
      const c = Math.cos(phi), sn = Math.sin(phi);
      const v = [
        k * (c * er[0] + sn * e2[0]) + (-sn * er[0] + c * e2[0]),
        k * (c * er[1] + sn * e2[1]) + (-sn * er[1] + c * e2[1]),
        k * (c * er[2] + sn * e2[2]) + (-sn * er[2] + c * e2[2]),
      ];
      const L = Math.hypot(...v);
      const dot = (v[0] * d[0] + v[1] * d[1] + v[2] * d[2]) / L;
      return { status: 'escaped', defl: Math.acos(Math.max(-1, Math.min(1, dot))), sweep: phi, b };
    }
    u = nu; w = nw;
  }
  return { status: 'unresolved', defl: 0, sweep: 0 };
}

// Build an inward-beaming test ray at radius R0 with a chosen conserved impact
// parameter b.  prograde=true bends counter-clockwise about +z.
function beam(b, prograde = true) {
  const f0 = Math.max(0.05, 1 - 1 / R0);
  const sinA = Math.min(0.999, (b * Math.sqrt(f0)) / R0);
  const cosA = Math.sqrt(Math.max(0, 1 - sinA * sinA));
  const ex = prograde ? 1 : -1;
  // starts at y=-R0 and travels +y (inward) with impact parameter b
  return { p: [0, -R0, 0], d: [ex * sinA, cosA, 0] };
}
function polarSweep(r) {
  // total |polar angle| travelled by the polyline: the honest winding measure
  let prev = Math.atan2(r.pts[1], r.pts[0]), tot = 0;
  for (let i = 1; i < r.n; i++) {
    let a = Math.atan2(r.pts[i * 3 + 1], r.pts[i * 3]);
    let da = a - prev;
    while (da > Math.PI) da -= 2 * Math.PI;
    while (da < -Math.PI) da += 2 * Math.PI;
    tot += da;
    prev = a;
  }
  return tot;
}
const shoot = (b, over = {}, prograde = true) => {
  const { p, d } = beam(b, prograde);
  const r = traceGeodesic(p, d, { Rs: 1, rHorizon: 1, escapeR: ESC, pathLimit: 5000, step: 1.0, maxSteps: 4000, diskIn: 3, diskOut: 12, thick: 0.12, ...over }, false);
  r.sweepT = polarSweep(r);
  return r;
};
const ref = (b, prograde = true) => {
  const { p, d } = beam(b, prograde);
  return truth(p, d, 1, ESC);
};

console.log('=== 1. production adaptive steps vs an independent fixed-step reference ===');
console.log('    (step=1.0 -> ds ~ 0.34+0.16r, maxSteps=220, launch r=60)');
for (const b of [30, 15, 8, 5, 3.5, 3.0]) {
  const p = shoot(b);
  const t = ref(b);
  console.log(
    `b=${b}  prod ${p.status} steps=${p.steps} defl=${p.defl.toFixed(5)}  |  ref ${t.status} defl=${t.defl.toFixed(5)}` +
      `  |  2Rs/b=${(2 / b).toFixed(5)}  rel.err=${(Math.abs(p.defl - t.defl) / Math.max(t.defl, 1e-6) * 100).toFixed(2)}%`,
  );
  if (b >= 5) check(`production deflection matches reference at b=${b}`, p.defl, t.defl, Math.max(t.defl * 0.03, 1e-4), ' rad');
}

console.log('\n=== 2. analytic weak-field limit 4M/b = 2Rs/b ===');
// only beams whose impact parameter is well below the 60-unit launch radius see
// both asymptotic ends, which is the regime where 4M/b is the right comparison
for (const b of [15, 30]) {
  const p = shoot(b);
  console.log(`(b=${b}: measured ${p.defl.toFixed(5)} vs leading-order 2Rs/b ${(2 / b).toFixed(5)} - finite 60-unit launch radius, see 2b for the asymptotic comparison)`);
}

console.log('\n=== 3. flat-spacetime limit (Rs = 0) must be a straight line ===');
{
  const p = shoot(6, { Rs: 0 });
  const chord = 2 * Math.sqrt(ESC * ESC - 36);
  console.log(`pathLen=${p.pathLen.toFixed(2)} chord=${chord.toFixed(2)} status=${p.status} steps=${p.steps} defl=${p.defl.toExponential(2)}`);
  check('straight-line path length', p.pathLen, chord, 8);
  check('no spurious bending when Rs=0', p.defl, 0, 5e-3, ' rad');
}

console.log('\n=== 4. capture / escape boundary at b_c = 3*sqrt(3)/2 = 2.59808 ===');
for (const b of [2.4, 2.55, 2.59, 2.60, 2.605, 2.62, 2.7, 3.0, 4.0]) {
  const p = shoot(b, { maxSteps: 3000, ds: undefined, step: 0.25 });
  const t = ref(b);
  console.log(
    `b=${b}  prod=${p.status.padEnd(9)} steps=${String(p.steps).padStart(4)} windings=${(p.defl / 6.283).toFixed(2)}` +
      ` minR=${p.minR.toFixed(3)}  | ref=${t.status} windings=${(t.defl / 6.283).toFixed(2)}`,
  );
}
check('b=2.4 (< b_c) captured', shoot(2.4).status === 'captured' ? 1 : 0, 1, 0.001);
check('b=2.59 (< b_c) captured', shoot(2.59).status === 'captured' ? 1 : 0, 1, 0.001);
{
  // Winding is measured as the total polar angle swept (the acos of the endpoint
  // direction would fold anything past 360 deg).  It must grow without bound as
  // b approaches b_c from above.
  const sweep = (b) => {
    const p = shoot(b);
    return { s: polarSweep(p), st: p.status };
  };
  const pts = [2.6, 2.62, 2.68, 2.9, 3.5, 5, 8, 15];
  const res = pts.map((b) => `${b}:${sweep(b).s.toFixed(2)}`).join('  ');
  console.log('polar sweep (rad) by impact parameter: ' + res);
  const seq = pts.map((b) => sweep(b).s);
  let mono = true;
  for (let i = 1; i < seq.length; i++) if (seq[i] > seq[i - 1] + 1e-9) mono = false;
  check('polar sweep falls monotonically as b grows past b_c', mono ? 1 : 0, 1, 0.001);
  check('near-critical ray (b=2.6) winds over 1.5 turns', seq[0] > 9.42 ? 1 : 0, 1, 0.001);
  check('far ray (b=15) winds under 0.6 turns', seq[7] < 3.8 ? 1 : 0, 1, 0.001);
}

console.log('\n=== 5. photon-sphere pile-up: closest approach just above the boundary ~ 1.5 Rs ===');
for (const b of [2.5981, 2.599, 2.6005]) {
  const p = shoot(b, { step: 0.15, maxSteps: 4000 });
  const t = ref(b);
  console.log(`b=${b} minR=${p.minR.toFixed(4)} steps=${p.steps} (reference agrees to ${(Math.abs(p.sweepT - t.sweep) / t.sweep * 100).toFixed(2)}%)`);
  check(`closest approach within 4% of the r=1.5 photon sphere at b=${b}`, p.minR, 1.5, 0.06);
}

console.log('\n=== 6. step economy on a real camera fan ===');
{
  const cam = [16, 0, 5.5];
  let tot = 0, n = 0, over = 0, cap = 0, esc = 0;
  const mk = (i, j) => {
    const z = cam.map((v) => -v);
    const L0 = Math.hypot(...z);
    const zz = z.map((v) => v / L0);
    const up = [0, 0, 1];
    let x = [zz[1] * up[2] - zz[2] * up[1], zz[2] * up[0] - zz[0] * up[2], zz[0] * up[1] - zz[1] * up[0]];
    const ll = Math.hypot(...x); x = x.map((v) => v / ll);
    const y = [x[1] * zz[2] - x[2] * zz[1], x[2] * zz[0] - x[0] * zz[2], x[0] * zz[1] - x[1] * zz[0]];
    const tan = 0.52;
    const d = [
      zz[0] + tan * ((i / 15) * x[0] + (-j / 11) * y[0]),
      zz[1] + tan * ((i / 15) * x[1] + (-j / 11) * y[1]),
      zz[2] + tan * ((i / 15) * x[2] + (-j / 11) * y[2]),
    ];
    const ln = Math.hypot(...d);
    return d.map((v) => v / ln);
  };
  for (let i = -15; i <= 15; i++)
    for (let j = -11; j <= 11; j++) {
      const r = traceGeodesic(cam, mk(i, j), { Rs: 1, rHorizon: 1, escapeR: 45, pathLimit: 120, step: 1.0, maxSteps: 220, diskIn: 3, diskOut: 12, thick: 0.12 }, false);
      n++; tot += r.steps;
      if (r.steps >= 220) over++;
      if (r.status === 'captured' || r.status === 'radial') cap++;
      if (r.status === 'escaped') esc++;
    }
  console.log(`rays=${n} mean steps=${(tot / n).toFixed(1)} capped=${over} captured=${cap} escaped=${esc}`);
  check('mean step count below 45% of the 220 budget', tot / n, 0, 100);
  check('capped rays stay a small minority', over / n, 0, 0.05);
  check('a real share of rays are captured by the horizon', cap / n > 0.02 ? 1 : 0, 1, 0.001);
}

console.log('\n=== 7. multi-plane imaging in a real near-edge-on camera view ===');
{
  // 64x64 pinhole 6.5 deg above the disk plane at r=13, looking at the hole.
  // Pixels that cross the thin disk twice are genuine second images.
  const rCam = 13, el = (6.5 * Math.PI) / 180;
  const cam = [rCam * Math.cos(el), 0, rCam * Math.sin(el)];
  const z = cam.map((v) => -v);
  const L0 = Math.hypot(...z);
  const zz = z.map((v) => v / L0);
  let x = [zz[1], -zz[0], 0];
  const ll = Math.hypot(...x); x = x.map((v) => v / ll);
  const y = [x[1] * zz[2] - x[2] * zz[1], x[2] * zz[0] - x[0] * zz[2], x[0] * zz[1] - x[1] * zz[0]];
  const N = 64, tanHalf = 0.48;
  let one = 0, dbl = 0, pix = 0, maxHits = 0;
  for (let i = 0; i < N; i++)
    for (let j = 0; j < N; j++) {
      const u2 = ((i + 0.5) / N - 0.5) * 2 * tanHalf;
      const v2 = ((j + 0.5) / N - 0.5) * 2 * tanHalf;
      const d = [zz[0] + u2 * x[0] + v2 * y[0], zz[1] + u2 * x[1] + v2 * y[1], zz[2] + u2 * x[2] + v2 * y[2]];
      const ln = Math.hypot(...d);
      const r = traceGeodesic(cam, [d[0] / ln, d[1] / ln, d[2] / ln], { Rs: 1, rHorizon: 1, escapeR: 45, pathLimit: 120, step: 1.0, maxSteps: 400, diskIn: 3, diskOut: 12, thick: 0.12 }, true);
      pix++;
      if (r.hits.length === 1) one++;
      if (r.hits.length >= 2) { dbl++; maxHits = Math.max(maxHits, r.hits.length); }
    }
  console.log(`pixels=${pix}, one disk image: ${one} (${((one / pix) * 100).toFixed(1)}%), two or more: ${dbl} (${((dbl / pix) * 100).toFixed(1)}%), max images on a pixel: ${maxHits}`);
  check('more than 3% of pixels show a multiply-imaged disk', dbl / pix > 0.03 ? 1 : 0, 1, 0.001);
  // Same view at 192x192 (36864 rays): the higher-order image cascade is thinner
  // than a 64x64 pixel, so it only resolves at higher sampling.
  const N2 = 192;
  let dbl2 = 0, max2 = 0, pix2 = 0, wound = 0;
  for (let i = 0; i < N2; i++)
    for (let j = 0; j < N2; j++) {
      const u2 = ((i + 0.5) / N2 - 0.5) * 2 * tanHalf;
      const v2 = ((j + 0.5) / N2 - 0.5) * 2 * tanHalf;
      const d = [zz[0] + u2 * x[0] + v2 * y[0], zz[1] + u2 * x[1] + v2 * y[1], zz[2] + u2 * x[2] + v2 * y[2]];
      const ln = Math.hypot(...d);
      const r = traceGeodesic(cam, [d[0] / ln, d[1] / ln, d[2] / ln], { Rs: 1, rHorizon: 1, escapeR: 45, pathLimit: 120, step: 0.5, maxSteps: 900, diskIn: 1.6, diskOut: 12, thick: 0.12 }, true);
      pix2++;
      if (r.hits.length >= 2) dbl2++;
      max2 = Math.max(max2, r.hits.length);
      if (polarSweep(r) > 2 * Math.PI) wound++;
    }
  console.log(`192x192 resample (annulus from r=1.6): >=2 crossings on ${dbl2} px (${((dbl2 / pix2) * 100).toFixed(1)}%), max ${max2}, pixels that wind a full turn around the hole: ${wound}`);
  check('higher-order (3+) plane crossings resolve at finer sampling', max2 >= 3 ? 1 : 0, 1, 0.001);
  check('some rays complete a full loop around the hole', wound > 0 ? 1 : 0, 1, 0.001);
}

console.log('\n=== 8. spin term is asymmetric (prograde vs retrograde) ===');
{
  const cfg = { spin: 0.9, maxSteps: 4000, step: 0.25 };
  let diffOk = true, lessOk = true, someEsc = false;
  for (const b of [3.0, 4.0, 6.0, 10.0]) {
    const pro = shoot(b, cfg, true);
    const retro = shoot(b, cfg, false);
    const s0 = shoot(b, { maxSteps: 4000, step: 0.25 }, true);
    console.log(`b=${b}: spin0 sweep=${s0.sweepT.toFixed(2)} | pro ${pro.status} ${Math.abs(pro.sweepT).toFixed(2)} | retro ${retro.status} ${Math.abs(retro.sweepT).toFixed(2)}`);
    if (pro.status !== 'captured' && retro.status !== 'captured') {
      someEsc = true;
      if (!(Math.abs(Math.abs(pro.sweepT) - Math.abs(retro.sweepT)) > 0.05)) diffOk = false;
      if (!(Math.abs(pro.sweepT) < Math.abs(retro.sweepT))) lessOk = false;
    }
  }
  check('some tested beams escape under spin 0.9', someEsc ? 1 : 0, 1, 0.001);
  check('prograde and retrograde wind differently under spin', someEsc && diffOk ? 1 : 0, 1, 0.001);
  check('retrograde winds more than prograde', someEsc && lessOk ? 1 : 0, 1, 0.001);
}

console.log('\n=== 2b. deflection at launch radius 300 vs the 2nd-order PN formula ===');
{
  // 4M/b + (15*pi/16)*(Rs/b)^2 with Rs=1; a 300-unit launch radius is far enough
  // that the finite-aperture correction no longer dominates the comparison.
  const RB = 300;
  const mk = (b) => {
    const f0 = Math.max(0.05, 1 - 1 / RB);
    const sinA = (b * Math.sqrt(f0)) / RB;
    const cosA = Math.sqrt(Math.max(0, 1 - sinA * sinA));
    return { p: [0, -RB, 0], d: [sinA, cosA, 0] };
  };
  let ok = true;
  for (const b of [20, 40, 80]) {
    const { p, d } = mk(b);
    const prod = traceGeodesic(p, d, { Rs: 1, rHorizon: 1, escapeR: RB, pathLimit: 900, step: 1.0, maxSteps: 4000, diskIn: 3, diskOut: 12, thick: 0.12 }, false);
    const t = truth(p, d, 1, RB);
    const pn = 2 / b + (15 * Math.PI) / 16 / (b * b);
    console.log(`b=${b}: prod ${prod.defl.toFixed(5)}  ref ${t.defl.toFixed(5)}  2nd-order ${pn.toFixed(5)}  rel.err ${(Math.abs(prod.defl - pn) / pn * 100).toFixed(2)}%`);
    if (Math.abs(prod.defl - pn) / pn > 0.03) ok = false;
  }
  check('deflection matches the 2nd-order PN expansion within 3%', ok ? 1 : 0, 1, 0.001);
}
console.log(fails === 0 ? `\nALL ${runs} CHECKS PASSED` : `\n${fails}/${runs} CHECKS FAILED`);
if (fails) process.exitCode = 1;
