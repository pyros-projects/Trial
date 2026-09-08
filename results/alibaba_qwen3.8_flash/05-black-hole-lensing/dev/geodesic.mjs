// Reference (CPU) implementation of the null-geodesic integrator used by the
// WebGL shader in ../index.html.  The two are deliberately kept in sync so that
// numeric divergence between the CPU probe and the GPU path is detectable.
//
// Physics
// -------
// Schwarzschild null geodesics.  A photon trajectory lies in the plane spanned by
// its start point and direction (spherical symmetry => the angular-momentum vector
// is conserved, so there is no out-of-plane drift).  In that plane, with u = 1/r
// and phi the in-plane polar angle:
//
//   (du/dphi)^2 = 1/b^2 - u^2 + Rs*u^3              (first integral)
//   d2u/dphi2   = -u + (3/2)*Rs*u^2                 (Binet form)
//
// Rs is the Schwarzschild / event-horizon radius in scene units.  This is the exact
// general-relativistic light-bending law rather than a Newtonian 1/r^2 proxy: the
// weak-field deflection comes out at 4M/b = 2*Rs/b, the unstable circular photon
// orbit sits at r = 1.5*Rs, and the critical impact parameter is
// b_c = 3*sqrt(3)*M = (3*sqrt(3)/2)*Rs.
//
// Steps are taken in phi with the spatial length held roughly constant:
//   dphi = dsLocal / (r*sqrt(1 + w^2 r^2)),  dsLocal = step*(0.34 + 0.16*r)
// which keeps a near-radial ray from teleporting across the frame and refines the
// step again while the ray is inside the (thin) disk layer.
//
// Spin is a phenomenological term: the bending coefficient is scaled by whether the
// ray orbits prograde or retrograde about the spin axis, which is what makes the
// shadow go asymmetric the way a Kerr shadow does.  Hand-calibrated, not a real
// Kerr metric.

export function traceGeodesic(p, d, opts, collectHits) {
  const maxSteps = opts.maxSteps;
  const step = opts.step;
  const escapeR = opts.escapeR;
  const pathLimit = opts.pathLimit;
  const Rs = opts.Rs;
  const spin = opts.spin || 0;
  const rH = opts.rHorizon;
  const diskIn = opts.diskIn;
  const diskOut = opts.diskOut;
  const thick = opts.thick === undefined ? 0.12 : opts.thick;

  const nSeg = maxSteps + 2;
  const out = {
    pts: new Float32Array(nSeg * 3),
    n: 1,
    steps: 0,
    b: 0,
    status: 'unknown',
    minR: r0len(p),
    defl: 0,
    endDir: null,
    pathLen: 0,
    hits: collectHits ? [] : null,
  };
  out.pts[0] = p[0]; out.pts[1] = p[1]; out.pts[2] = p[2];

  const r0 = out.minR;
  const er = [p[0] / r0, p[1] / r0, p[2] / r0];
  const cr = d[0] * er[0] + d[1] * er[1] + d[2] * er[2];
  const sinA2 = Math.max(0, 1 - cr * cr);
  const sinA = Math.sqrt(sinA2);
  // Convert the locally-measured emission angle into the conserved impact
  // parameter.  For a static observer at r the exact Schwarzschild relation is
  //   sin(alpha_local) = b / (r*sqrt(1 - Rs/r)),
  // so the Euclidean b = r*sin(alpha) has to be divided by sqrt(f).  Without
  // this the shadow edge is a few percent too wide at typical camera distances.
  const f0 = Math.max(0.05, 1 - Rs / r0);
  const b = (r0 * sinA) / Math.sqrt(f0);
  out.b = b;
  if (sinA < 1e-4) { out.status = 'radial'; out.steps = 1; return out; }

  const e2 = [
    (d[0] - cr * er[0]) / sinA,
    (d[1] - cr * er[1]) / sinA,
    (d[2] - cr * er[2]) / sinA,
  ];
  // (p x d).z = px*dy - py*dx : sign tells prograde vs retrograde about +z
  const Lz = p[0] * d[1] - p[1] * d[0];
  const sgn = Lz >= 0 ? 1 : -1;
  // Spin scales the curvature term.  Prograde light (L aligned with the spin)
  // bends LESS, which is the Kerr ordering (prograde photon orbit 1.0M vs 1.5M
  // for a*=1 vs a=0); retrograde light bends more.
  const kappa = 1.5 * Rs * (1 - sgn * spin * 0.45);

  let u = 1 / r0;
  // du/dphi from the first integral (not from the Euclidean angle), so the start
  // point sits exactly on the constant-b orbit.
  const w2 = 1 / (b * b) - u * u + kappa * u * u * u;
  let w = -Math.sign(cr || 1) * Math.sqrt(Math.max(1e-9, w2));
  let phi = 0;
  let px = p[0], py = p[1], pz = p[2];

  for (let s = 0; s < maxSteps; s++) {
    const r = 1 / u;
    const denom = r * Math.sqrt(1 + w * w * r * r);
    // near-plane refinement so the thin disk stays resolved
    const H = thick * Math.pow(Math.max(r, 1), 0.6);
    const near = 1 - smoothstep(0, 1.6 * H + 0.25, Math.abs(pz));
    let h = (step * (0.34 + 0.16 * r) * mix(1, 0.32, near)) / Math.max(denom, 1e-8);
    if (h > 0.09 * step) h = 0.09 * step;

    const a1 = -u + kappa * u * u;
    const u2 = u + 0.5 * h * w, w2 = w + 0.5 * h * a1;
    const a2 = -u2 + kappa * u2 * u2;
    const u3 = u + 0.5 * h * w2, w3 = w + 0.5 * h * a2;
    const a3 = -u3 + kappa * u3 * u3;
    const u4 = u + h * w3, w4 = w + h * a3;
    const a4 = -u4 + kappa * u4 * u4;
    const nu = u + (h / 6) * (w + 2 * w2 + 2 * w3 + w4);
    const nw = w + (h / 6) * (a1 + 2 * a2 + 2 * a3 + a4);
    if (!(nu > 1e-6)) { out.status = 'bad'; out.steps = s + 1; finish(out, d); return out; }

    const nphi = phi + h;
    const rr = 1 / nu;
    const c = Math.cos(nphi), sn = Math.sin(nphi);
    const nx = rr * (c * er[0] + sn * e2[0]);
    const ny = rr * (c * er[1] + sn * e2[1]);
    const nz = rr * (c * er[2] + sn * e2[2]);
    out.pts[out.n * 3] = nx; out.pts[out.n * 3 + 1] = ny; out.pts[out.n * 3 + 2] = nz;
    out.n++;
    out.pathLen += Math.hypot(nx - px, ny - py, nz - pz);
    if (rr < out.minR) out.minR = rr;

    if (collectHits && pz > 0 !== nz > 0) {
      const t = pz / (pz - nz);
      const cxp = px + t * (nx - px), cyp = py + t * (ny - py);
      const rc = Math.hypot(cxp, cyp);
      if (rc > diskIn && rc < diskOut) {
        out.hits.push({ r: rc, x: cxp, y: cyp, seg: s, t });
      }
    }
    px = nx; py = ny; pz = nz;
    u = nu; w = nw; phi = nphi;

    if (out.n >= nSeg) { out.status = 'trapped'; out.steps = s + 1; finish(out, d); return out; }
    if (rr <= rH) { out.status = 'captured'; out.steps = s + 1; finish(out, d); return out; }
    if (rr > escapeR) {
      out.status = 'escaped'; out.steps = s + 1;
      // dp/dphi = r * [ (-w*r) e_r' + e_t' ]; the common factor r is dropped.
      const k = -w * rr;
      const cc = Math.cos(phi), ss = Math.sin(phi);
      const vx = k * (cc * er[0] + ss * e2[0]) + (-ss * er[0] + cc * e2[0]);
      const vy = k * (cc * er[1] + ss * e2[1]) + (-ss * er[1] + cc * e2[1]);
      const vz = k * (cc * er[2] + ss * e2[2]) + (-ss * er[2] + cc * e2[2]);
      const L = Math.hypot(vx, vy, vz) || 1;
      out.endDir = [vx / L, vy / L, vz / L];
      finish(out, d);
      return out;
    }
    if (out.pathLen > pathLimit) { out.status = 'long'; out.steps = s + 1; finish(out, d); return out; }
  }
  out.status = 'exhausted';
  out.steps = maxSteps;
  finish(out, d);
  return out;
}

function r0len(p) { return Math.hypot(p[0], p[1], p[2]); }
function smoothstep(a, b, x) { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
function mix(a, b, t) { return a + (b - a) * t; }
function finish(out, d) {
  if (!out.endDir) return;
  let dot = out.endDir[0] * d[0] + out.endDir[1] * d[1] + out.endDir[2] * d[2];
  dot = Math.max(-1, Math.min(1, dot));
  out.defl = Math.acos(dot);
}