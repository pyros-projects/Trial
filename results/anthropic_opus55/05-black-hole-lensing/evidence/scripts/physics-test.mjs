// Physics regression tests for the CPU mirror of the GLSL integrator.
// Extracts the <physics-core> block verbatim from ../../index.html, so the tested code is the shipped code.
// Run: node evidence/scripts/physics-test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, '..', '..', 'index.html'), 'utf8');
const m = html.match(/\/\/ <physics-core>([\s\S]*?)\/\/ <\/physics-core>/);
if (!m) throw new Error('physics-core block not found');
const Phys = new Function(m[1] + '\nreturn Phys;')();

let pass = 0, fail = 0;
function check(name, ok, detail) {
  (ok ? pass++ : fail++);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}

function params(over = {}) {
  const M = over.M ?? 1, spin = over.spin ?? 0;
  return Object.assign({
    M, spin, rh: Phys.horizonRadius(M, spin), photonR: 3 * M, isco: Phys.iscoRadius(M, spin),
    diskIn: 6, diskOut: 16, diskH: 0.02, diskN: [0, 1, 0], diskX: [1, 0, 0], diskY: [0, 0, -1],
    temp: 6000, turb: 0, density: 0, bright: 2.4, doppler: 1, redshift: 1, camG: 1, time: 0,
    step: 0.02, maxSteps: 3000, escapeR: 1200, diskSamples: 6, octaves: 3,
  }, over);
}
// Camera at distance D on +z, ray aimed so the impact parameter is b (in the equatorial plane when inPlane).
function rayForB(D, b, P, sideSign = 1, inPlane = true) {
  const f = Math.sqrt(1 - 2 * P.M / D);
  const s = b * f / D; // sin(psi_local)
  const c = Math.sqrt(1 - s * s);
  const tang = inPlane ? [sideSign, 0, 0] : [0, sideSign, 0];
  return [s * tang[0], s * tang[1], -c];
}
function captured(D, b, P, sideSign, inPlane) {
  const r = Phys.traceRay([0, 0, D], rayForB(D, b, P, sideSign, inPlane), P, false);
  return r;
}
function critB(P, sideSign = 1, inPlane = true, D = 400) {
  let lo = 0.5 * P.M, hi = 9 * P.M;
  for (let i = 0; i < 36; i++) { const mid = (lo + hi) / 2; if (captured(D, mid, P, sideSign, inPlane).fate === Phys.FATE.CAPTURED) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}

// 1. Horizon, ISCO, photon orbits
check('Schwarzschild horizon r=2M', Math.abs(Phys.horizonRadius(1, 0) - 2) < 1e-12);
check('Schwarzschild ISCO r=6M', Math.abs(Phys.iscoRadius(1, 0) - 6) < 1e-9, Phys.iscoRadius(1, 0).toFixed(6));
check('Near-extremal ISCO → ~1.24M at χ=0.998', Math.abs(Phys.iscoRadius(1, 0.998) - 1.237) < 0.01, Phys.iscoRadius(1, 0.998).toFixed(4));
const po = Phys.photonOrbits(1, 0);
check('χ=0 photon orbit 3M (pro = retro)', Math.abs(po.pro - 3) < 1e-9 && Math.abs(po.retro - 3) < 1e-9);

// 2. Critical impact parameter (shadow) for Schwarzschild: 3√3 M
{
  const P = params();
  const bc = critB(P);
  check('Shadow critical impact b_c = 3√3 M = 5.196', Math.abs(bc - 3 * Math.sqrt(3)) < 0.02, `measured ${bc.toFixed(4)}`);
  const P2 = params({ M: 2, rh: Phys.horizonRadius(2, 0), photonR: 6, escapeR: 2400 });
  const bc2 = critB(P2, 1, true, 800);
  check('b_c scales linearly with mass (M=2 → 10.392)', Math.abs(bc2 - 6 * Math.sqrt(3)) < 0.05, `measured ${bc2.toFixed(4)}`);
  // default in-app step size
  const P3 = params({ step: 0.05 });
  const bc3 = critB(P3);
  check('b_c at default step size 0.05 within 0.5%', Math.abs(bc3 / (3 * Math.sqrt(3)) - 1) < 0.005, `measured ${bc3.toFixed(4)}`);
}

// 3. Weak-field deflection 4M/b (+ 15πM²/4b² second order)
{
  const P = params({ step: 0.02, escapeR: 20000 });
  for (const b of [50, 200]) {
    const D = 10000;
    const r = Phys.traceRay([0, 0, D], rayForB(D, b, P, 1, true), P, false);
    // Finite source/observer distance: expected deflection for observer at D and source at infinity
    const expectInf = 4 / b + 15 * Math.PI / (4 * b * b);
    // Observer at finite D misses the (2M/b)(1 - sqrt(1-b²/D²)) tail on the observer side
    const obsTail = (2 / b) * (1 - Math.sqrt(1 - (b / D) ** 2));
    const expect = expectInf - obsTail;
    const rel = Math.abs(r.defl - expect) / expect;
    check(`Weak-field deflection b=${b}M`, rel < 0.02, `measured ${r.defl.toExponential(4)} vs ${expect.toExponential(4)} (rel ${(rel * 100).toFixed(2)}%)`);
  }
}

// 4. Photon-sphere behaviour: just outside b_c the ray winds and skims r≈3M
{
  const P = params();
  const bc = 3 * Math.sqrt(3);
  const r = captured(400, bc * 1.0005, P, 1, true);
  check('Near-critical ray escapes after > 1 full turn', r.fate === Phys.FATE.ESCAPED && r.defl > 2 * Math.PI, `fate ${Phys.FATE_NAMES[r.fate]}, bend ${(r.defl * 180 / Math.PI).toFixed(1)}°`);
  check('Near-critical periapsis ≈ 3M', Math.abs(r.rmin - 3) < 0.15, `r_min ${r.rmin.toFixed(4)}`);
  const P2 = params({ maxSteps: 60 });
  const r2 = captured(400, bc * 1.00001, P2, 1, true);
  check('Step limit classified as STEPLIMIT (integration failure)', r2.fate === Phys.FATE.STEPLIMIT, Phys.FATE_NAMES[r2.fate]);
}

// 5. Spin approximation vs exact Kerr equatorial shadow edges
{
  for (const chi of [0.6, 0.9]) {
    const P = params({ spin: chi, rh: Phys.horizonRadius(1, chi) });
    // Photon moving with h along +y (disk normal) is prograde. For camera on +z looking -z with offset along +x:
    // h = x × v ~ (+x) × (-z) = +y → prograde for sideSign = +1.
    const pro = critB(P, 1, true), retro = critB(P, -1, true);
    const ex = Phys.criticalImpact(1, chi);
    check(`Kerr χ=${chi} prograde shadow edge`, Math.abs(pro - ex.pro) < 0.25, `approx ${pro.toFixed(3)} vs Kerr ${ex.pro.toFixed(3)}`);
    check(`Kerr χ=${chi} retrograde shadow edge`, Math.abs(retro - ex.retro) < 0.5, `approx ${retro.toFixed(3)} vs Kerr ${ex.retro.toFixed(3)}`);
  }
}

// 6. Redshift: face-on photon from circular orbit at r=6M has λ=0 → g = sqrt(1-3M/r)
{
  const P = params({ density: 1 });
  const o = {};
  Phys.diskSample([6, 0, 0], [0, -1, 0], P, o);
  check('Face-on redshift g(r=6M) = √(1-3M/r) = 0.7071', Math.abs(o.g - Math.sqrt(0.5)) < 1e-6, `g=${o.g.toFixed(6)}`);
  const P0 = params({ density: 1, doppler: 0, redshift: 0 });
  Phys.diskSample([6, 0, 0], [0, -1, 0], P0, o);
  check('Doppler=0 & redshift=0 → g = 1', Math.abs(o.g - 1) < 1e-9, `g=${o.g}`);
  // Approaching vs receding edge-on emitters: gas at +x moves along n×x = (0,1,0)×(1,0,0) = (0,0,-1)
  const Pa = params({ density: 1 });
  const a = {}, rcd = {};
  // photon travelling toward camera at +z (trace dir -z) from gas at -x (moving +z → approaching)
  Phys.diskSample([-6, 0, 0], [0, 0, -1], Pa, a);
  Phys.diskSample([6, 0, 0], [0, 0, -1], Pa, rcd);
  check('Approaching side blueshifted vs receding side', a.g > 1 && rcd.g < 0.7 && a.gk > 1 && rcd.gk < 1, `g_app=${a.g.toFixed(3)} g_rec=${rcd.g.toFixed(3)}`);
}

// 7. Energy normalisation: initial velocity gives |x × v| = b for a static observer
{
  const P = params();
  const D = 20, b = 7;
  const d = rayForB(D, b, P, 1, true);
  const v = Phys.initialVelocity([0, 0, D], d, P);
  const h = Phys.len(Phys.cross([0, 0, D], v));
  check('Static-observer mapping: |x×v| = b', Math.abs(h - b) < 1e-9, `h=${h.toFixed(9)}`);
  // conserved |v|²/2 - M h²/r³ = 1/2
  const E = Phys.dot(v, v) / 2 - P.M * h * h / D ** 3;
  check('Energy integral normalised to 1/2 (|v∞| = 1)', Math.abs(E - 0.5) < 1e-12, `E=${E}`);
}

// 8. Conservation along an integrated orbit (Schwarzschild): h stays constant
{
  const P = params({ step: 0.05 });
  const r = Phys.traceRay([0, 0, 30], rayForB(30, 6.5, P, 1, true), P, false);
  const hEnd = Phys.len(Phys.cross(r.xEnd, r.vEnd));
  check('Angular momentum h conserved over the trace (<1e-4 rel)', Math.abs(hEnd - r.b) / r.b < 1e-4, `h0=${r.b.toFixed(6)} h1=${hEnd.toFixed(6)}`);
}

// 9. Disk absorption: optically thick disk absorbs a ray aimed at it
{
  const P = params({ density: 8, turb: 0 });
  // aim from (0,20,20) at the disk point (10,0,0)
  const r = Phys.traceRay([0, 20, 20], Phys.norm([10, -20, -20]), P, false);
  check('Opaque disk classifies ray as absorbed', r.fate === Phys.FATE.ABSORBED && r.hitGeo, `fate ${Phys.FATE_NAMES[r.fate]}, hit r=${r.hitGeo && r.hitGeo.r.toFixed(2)}`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
