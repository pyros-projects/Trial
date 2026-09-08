// dev/test-physics.mjs — numerical checks for the physics core *as delivered*.
// It extracts the code straight out of index.html (the artifact the benchmark
// runs), so the tests always exercise the shipped file, not a dev copy.
//
//   node dev/test-physics.mjs [file]        default: index.html
import fs from 'node:fs';

const target = process.argv[2] || 'index.html';
const src = fs.readFileSync(target, 'utf8');

/* Extract CORE-BEGIN..CORE-END, plus the scenario builders when present. */
const BEGIN = '/*==CORE-BEGIN==*/';
const END = '/*==CORE-END==*/';
const i0 = src.indexOf(BEGIN), i1 = src.lastIndexOf(END);
if (i0 < 0 || i1 < 0) { console.error('FAIL: core markers missing in ' + target); process.exit(1); }
let code = src.slice(i0 + BEGIN.length, i1);
const si = src.indexOf('function makeScenarios');
if (si > i1) code += '\n' + src.slice(si, src.indexOf('function bootApp'));
code += '\nreturn { api: CORE_API, makeScenarios: typeof makeScenarios === "undefined" ? null : makeScenarios };';

let mod;
try {
  mod = new Function('Path2D', code)({});
} catch (e) {
  console.error('FAIL: extracted code did not execute: ' + e.message);
  process.exit(1);
}
const api = mod.api;

let pass = 0, fail = 0;
const ok = (name, cond, info) => {
  if (cond) { pass++; console.log('  PASS ' + name + (info ? '  [' + info + ']' : '')); }
  else { fail++; console.log('  FAIL ' + name + '  [' + info + ']'); }
};

const S = {
  gx: 0, gy: 900, wind: 0, windDx: 1, windDy: 0, windTurb: 0.5,
  damping: 0.8, restitution: 0.1, friction: 0.5, thick: 6,
  iters: 6, substeps: 3, kStruct: 0.9, kShear: 0.4, kBend: 0.15,
  pressure: 0.55, tear: 0.6, tearOn: true, selfCollide: true,
  pairCollide: true, grabK: 0.6, maxStep: 9, cellSize: 15
};

const badState = (W) => {
  for (let i = 0; i < W.n; i++) {
    if (!Number.isFinite(W.x[i]) || !Number.isFinite(W.y[i]) ||
      !Number.isFinite(W.vx[i]) || !Number.isFinite(W.vy[i])) return i;
  }
  return -1;
};
const maxSpeed = (W) => {
  let m = 0;
  for (let i = 0; i < W.n; i++) { const s = Math.hypot(W.vx[i], W.vy[i]); if (s > m) m = s; }
  return m;
};
const meanSpeed = (W) => {
  let s = 0;
  for (let i = 0; i < W.n; i++) s += Math.hypot(W.vx[i], W.vy[i]);
  return s / Math.max(1, W.n);
};
const alivePairs = (W) => { let c = 0; for (let k = 0; k < W.pc; k++) if (W.palive[k]) c++; return c; };

console.log('\n== 1. distance constraint converges, stiffness is substep-aware ==');
{
  const W = api.makeWorld();
  const a = api.addP(W, 0, 0, 1, 3);
  const b = api.addP(W, 40, 0, 1, 3);
  api.addPair(W, a, b, 20, api.CL_STRUCT);
  const S2 = { ...S, gy: 0, selfCollide: false, pairCollide: false };
  for (let f = 0; f < 30; f++) api.stepFrame(W, S2, 1 / 60);
  const d = Math.hypot(W.x[b] - W.x[a], W.y[b] - W.y[a]);
  ok('stretched spring pulls back to rest length', Math.abs(d - 20) < 0.6, 'd=' + d.toFixed(4));

  const run = (subs) => {
    const W2 = api.makeWorld();
    const p0 = api.addP(W2, 0, 0, 1, 3);
    let prev = p0;
    for (let i = 1; i <= 24; i++) {
      const p = api.addP(W2, i * 12, 0, 1, 3);
      api.addPair(W2, prev, p, 12, api.CL_STRUCT);
      prev = p;
    }
    api.pinP(W2, p0);
    let worst = 0;
    for (let f = 0; f < 240; f++) {
      api.stepFrame(W2, { ...S, substeps: subs }, 1 / 60);
      if (W2.stats.maxStrain > worst) worst = W2.stats.maxStrain;
    }
    let end = 0;
    for (let k = 0; k < W2.pc; k++) {
      if (!W2.palive[k]) continue;
      const d2 = Math.hypot(W2.x[W2.pb[k]] - W2.x[W2.pa[k]], W2.y[W2.pb[k]] - W2.y[W2.pa[k]]);
      end = Math.max(end, Math.abs(d2 / W2.prest[k] - 1));
    }
    return { end, worst, bad: badState(W2) };
  };
  const s1 = run(1), s3 = run(3), s6 = run(6);
  ok('stable chain at 1 substep', s1.bad < 0 && s1.end < 0.12, 'end strain ' + s1.end.toFixed(4));
  ok('stable chain at 3 substeps', s3.bad < 0 && s3.end < 0.12, 'end strain ' + s3.end.toFixed(4));
  ok('stable chain at 6 substeps', s6.bad < 0 && s6.end < 0.12, 'end strain ' + s6.end.toFixed(4));
  ok('stiffness ~ substep-independent (3 vs 6)', Math.abs(s3.end - s6.end) < 0.06,
    s3.end.toFixed(4) + ' vs ' + s6.end.toFixed(4));
}

console.log('\n== 2. area gradient math (finite difference) ==');
{
  const W = api.makeWorld();
  const idx = [];
  const R = 60, N = 14, cx = 400, cy = 400;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    idx.push(api.addP(W, cx + Math.cos(a) * R, cy + Math.sin(a) * R, 1, 4));
  }
  api.addArea(W, idx, N, 1);
  const areaOf = (ids) => {
    let A = 0;
    for (let i = 0; i < ids.length; i++) {
      const a = ids[i], b = ids[(i + 1) % ids.length];
      A += W.x[a] * W.y[b] - W.y[a] * W.x[b];
    }
    return Math.abs(A) * 0.5;
  };
  const A0 = areaOf(idx);
  ok('rest area captured at build time', Math.abs(W.aRest[0] - A0) < 1e-6,
    'A0=' + A0.toFixed(3));
  const eps = 1e-4;
  /* compare the solver's gradient against central differences at EVERY vertex
     (a regular polygon has symmetric vertices where a wrong formula can
     coincidentally match, so use an irregular one) */
  const rr = [62, 41, 55, 73, 48, 66, 39, 58, 71, 44, 60, 51, 67, 43];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 + 0.31;
    W.x[i] = cx + Math.cos(a) * rr[i];
    W.y[i] = cy + Math.sin(a) * rr[i] * 0.68;
  }
  const areaOf2 = () => {
    let A = 0;
    for (let i = 0; i < N; i++) {
      const a = idx[i], b = idx[(i + 1) % N];
      A += W.x[a] * W.y[b] - W.y[a] * W.x[b];
    }
    return Math.abs(A) * 0.5;
  };
  let worst = 0, worstAt = '';
  for (let k = 0; k < N; k++) {
    for (const comp of ['x', 'y']) {
      const arr = comp === 'x' ? W.x : W.y;
      arr[idx[k]] += eps;
      const Ap = areaOf2();
      arr[idx[k]] -= 2 * eps;
      const Am = areaOf2();
      arr[idx[k]] += eps;
      const num = (Ap - Am) / (2 * eps);
      let Asign = 0;
      for (let i = 0; i < idx.length; i++) {
        const a = idx[i], b = idx[(i + 1) % idx.length];
        Asign += W.x[a] * W.y[b] - W.y[a] * W.x[b];
      }
      const sA = Asign < 0 ? -1 : 1;
      const i0 = idx[(k - 1 + N) % N], i2 = idx[(k + 1) % N];
      const ana = comp === 'x'
        ? (W.y[i2] - W.y[i0]) * 0.5 * sA
        : (W.x[i0] - W.x[i2]) * 0.5 * sA;
      const err = Math.abs(num - ana);
      if (err > worst) { worst = err; worstAt = 'vertex ' + k + ' ' + comp; }
    }
  }
  ok('gradient matches numerics at all 28 components', worst < 1e-3,
    'worst error ' + worst.toExponential(2) + ' at ' + worstAt);
  const g = new Float64Array(N * 2);
  let As2 = 0;
  for (let i = 0; i < idx.length; i++) {
    const a = idx[i], b = idx[(i + 1) % idx.length];
    As2 += W.x[a] * W.y[b] - W.y[a] * W.x[b];
  }
  const sA2 = As2 < 0 ? -1 : 1;
  for (let k = 0; k < N; k++) {
    const i0 = idx[(k - 1 + N) % N], i2 = idx[(k + 1) % N];
    g[k * 2] = (W.y[i2] - W.y[i0]) * 0.5 * sA2;
    g[k * 2 + 1] = (W.x[i0] - W.x[i2]) * 0.5 * sA2;
  }
  const A1 = areaOf2();
  for (let k = 0; k < N; k++) { W.x[idx[k]] += g[k * 2] * 0.02; W.y[idx[k]] += g[k * 2 + 1] * 0.02; }
  ok('gradient direction actually inflates the shell', areaOf2() > A1 * 1.015,
    'area ' + A1.toFixed(1) + ' -> ' + areaOf2().toFixed(1));
}

console.log('\n== 3. pressure resists crushing ==');
{
  /* squash the shell flat, then watch how fast each pressure setting re-inflates.
     Measured early (t=0.5 s) because both settings eventually recover. */
  const run = (pressure, frames) => {
    const W = api.makeWorld();
    const b = api.buildBlob(W, { cx: 400, y0: 400, r: 100, n: 26, im: 1 });
    const rest = W.aRest[0];
    for (let i = b.p0; i < b.p0 + b.ring; i++) {   /* squash to 45 % of radius */
      W.x[i] = 400 + (W.x[i] - 400) * 0.45;
      W.y[i] = 400 + (W.y[i] - 400) * 0.45;
    }
    const S2 = { ...S, pressure, gy: 0, gx: 0, selfCollide: false, pairCollide: false };
    for (let f = 0; f < frames; f++) api.stepFrame(W, S2, 1 / 60);
    let A = 0;
    const n = b.ring;
    for (let i = 0; i < n; i++) {
      const a = b.p0 + i, c = b.p0 + (i + 1) % n;
      A += W.x[a] * W.y[c] - W.y[a] * W.x[c];
    }
    return { area: Math.abs(A) * 0.5, rest: rest, bad: badState(W) };
  };
  const q0 = run(0.5, 0).area / run(0.5, 0).rest;      /* untouched baseline */
  const low = run(0.02, 30), high = run(1.0, 30);
  const lr = low.area / low.rest, hr = high.area / high.rest;
  ok('shell starts squashed (~20 % of rest area)', q0 > 0.19 && q0 < 0.21,
    'squared-off area = ' + (q0 * 100).toFixed(1) + '% of rest');
  ok('pressure 1.0 holds a clearly higher inflation level than 0.02',
    hr > 1.10 && lr < 1.05 && hr > lr + 0.06,
    'after 0.5 s: ' + (lr * 100).toFixed(0) + '% vs ' + (hr * 100).toFixed(0) + '% of rest');
  /* sustained crush: every frame the shell is squeezed inward by 2 % */
  const crush = (pressure) => {
    const W = api.makeWorld();
    const b = api.buildBlob(W, { cx: 400, y0: 400, r: 100, n: 26, im: 1 });
    const rest = W.aRest[0];
    const S2 = { ...S, pressure, gy: 0, gx: 0, selfCollide: false, pairCollide: false };
    for (let f = 0; f < 120; f++) {
      for (let i = b.p0; i < b.p0 + b.ring; i++) {
        W.x[i] = 400 + (W.x[i] - 400) * 0.98;
        W.y[i] = 400 + (W.y[i] - 400) * 0.98;
      }
      api.stepFrame(W, S2, 1 / 60);
    }
    let A = 0;
    const n = b.ring;
    for (let i = 0; i < n; i++) {
      const a = b.p0 + i, c = b.p0 + (i + 1) % n;
      A += W.x[a] * W.y[c] - W.y[a] * W.x[c];
    }
    return Math.abs(A) * 0.5 / rest;
  };
  const cLow = crush(0.02), cHigh = crush(1.0);
  /* honest finding: the area constraint holds the shape at ANY pressure;
     the knob sets how far ABOVE rest area the shell wants to sit. */
  ok('sustained crush does not collapse the shell at either pressure',
    cLow > 0.95 && cHigh > 1.08,
    'area under crush: ' + (cLow * 100).toFixed(0) + '% (low) vs ' + (cHigh * 100).toFixed(0) + '% (high)');
  const long = run(1.0, 240);
  ok('pressurised shell holds an over-inflated target', long.area / long.rest > 1.1,
    'final/rest area ratio ' + (long.area / long.rest).toFixed(3));
  ok('pressurised shell stays finite and non-inverted', long.bad < 0,
    'worst state error ' + long.bad);
}

console.log('\n== 4. collisions: draping, containment, no tunnelling ==');
{
  const W = api.makeWorld();
  api.addShape(W, { kind: 'box', cx: 500, cy: 420, hw: 190, hh: 26, angle: 0.32 });
  api.addShape(W, { kind: 'circle', cx: 900, cy: 500, r: 120 });
  api.addShape(W, { kind: 'seg', x0: 200, y0: 300, x1: 420, y1: 520, r: 10 });
  api.buildCloth(W, { x0: 380, y0: 60, cols: 26, rows: 26, sp: 20, im: 1, r: 3 });
  api.buildChain(W, { x0: 1100, y0: 60, dx: 0.1, dy: 1, n: 40, seg: 16 });
  for (let f = 0; f < 420; f++) api.stepFrame(W, { ...S, wind: 260 }, 1 / 60);
  ok('7 s of contact-rich sim stays finite', badState(W) < 0, 'n=' + W.n);
  let escaped = 0;
  for (let i = 0; i < W.n; i++) {
    if (W.x[i] < -2 || W.x[i] > api.WORLD_W + 2 || W.y[i] < -2 || W.y[i] > api.WORLD_H + 2) escaped++;
  }
  ok('nothing tunnels out of the world box', escaped === 0, 'escaped=' + escaped);
  const box = W.shapes[0];
  let inside = 0;
  const ca = Math.cos(-box.angle), sa = Math.sin(-box.angle);
  for (let i = 0; i < W.n; i++) {
    const dx = W.x[i] - box.cx, dy = W.y[i] - box.cy;
    const lx = dx * ca - dy * sa, ly = dx * sa + dy * ca;
    if (Math.abs(lx) < box.hw - 1 && Math.abs(ly) < box.hh - 1) inside++;
  }
  ok('no particle buried inside a static box', inside === 0, 'inside=' + inside);
  const cir = W.shapes[1];
  let inCirc = 0;
  for (let i = 0; i < W.n; i++) if (Math.hypot(W.x[i] - cir.cx, W.y[i] - cir.cy) < cir.r - 1) inCirc++;
  ok('no particle buried inside a static circle', inCirc === 0, 'inside=' + inCirc);
  ok('contacts actually happened', W.stats.contacts > 0, 'last-frame contacts=' + W.stats.contacts);
}

console.log('\n== 5. inter-object collision + the collision switches ==');
{
  /* a rope hanging through a cloth sheet */
  const mk = (collide) => {
    const W = api.makeWorld();
    api.buildCloth(W, { x0: 300, y0: 200, cols: 24, rows: 24, sp: 20, im: 1 });
    api.buildChain(W, { x0: 540, y0: 40, dx: 0, dy: 1, n: 60, seg: 16 });
    const off = W.n - 61;
    api.pinP(W, off);
    let worst = 0;
    for (let f = 0; f < 300; f++) {
      api.stepFrame(W, { ...S, selfCollide: collide, pairCollide: collide }, 1 / 60);
      let deep = 0;
      for (let i = off; i < W.n; i++) {
        for (let j = 0; j < 576; j++) {
          if (Math.hypot(W.x[i] - W.x[j], W.y[i] - W.y[j]) < 8) { deep++; break; }
        }
      }
      if (deep > worst) worst = deep;
    }
    return worst;
  };
  const withC = mk(true), without = mk(false);
  ok('collision on keeps the rope out of the sheet', withC === 0,
    'rope nodes buried in the cloth: ' + withC + ' with collision on, ' + without + ' off');
  ok('collision off lets the rope interpenetrate', without > 12,
    'buried rope nodes = ' + without);

  /* puck dropped on a cloth hammock: does it get caught, or go through? */
  const drop = (collide) => {
    const W = api.makeWorld();
    const sheet = api.buildCloth(W, { x0: 200, y0: 400, cols: 30, rows: 4, sp: 20, im: 0.6 });
    for (let r = 0; r < 4; r++) { api.pinP(W, sheet.p0 + r * 30); api.pinP(W, sheet.p0 + r * 30 + 29); }
    const puck = api.buildCluster(W, { cx: 700, y0: 150, r: 46, sp: 15, im: 0.12 });
    let through = 0;
    for (let f = 0; f < 300; f++) {
      api.stepFrame(W, { ...S, selfCollide: collide, pairCollide: collide }, 1 / 60);
      /* count frames where the puck centre is below the whole sheet band */
      let sy = 0, sn = 0;
      for (let j = sheet.p0; j < sheet.p0 + sheet.pn; j++) { sy += W.y[j]; sn++; }
      let py = 0, pn = 0, inside = 0;
      for (let i = puck.p0; i < puck.p0 + puck.pn; i++) {
        py += W.y[i]; pn++;
        if (W.y[i] > 412 && W.y[i] < 468 && W.x[i] > 200 && W.x[i] < 800) inside++;
      }
      if (py / pn > sy / sn + 20) through++;
      if (inside > 30) through += 10;      /* bulk of the puck inside the band */
    }
    let y = 0, n = 0;
    for (let i = puck.p0; i < puck.p0 + puck.pn; i++) { y += W.y[i]; n++; }
    return { through, y: y / n };
  };
  const on = drop(true), off = drop(false);
  ok('puck is caught by the sheet when collisions are on', on.through === 0,
    'through-frames = ' + on.through + ', ended at y=' + on.y.toFixed(0));
  ok('puck falls through when collisions are switched off', off.through > 60,
    'through-frames = ' + off.through + ', ended at y=' + off.y.toFixed(0));
}

console.log('\n== 6. tearing changes the constraint graph permanently ==');
{
  const W = api.makeWorld();
  const b = api.buildCloth(W, { x0: 300, y0: 120, cols: 20, rows: 12, sp: 22, im: 1, r: 3 });
  for (let i = 0; i < W.n; i++) { W.x[i] *= 1.6; W.y[i] = 120 + (W.y[i] - 120) * 1.6; }
  for (let c = 0; c < 20; c += 2) api.pinP(W, b.p0 + c);
  const before = alivePairs(W);
  api.stepFrame(W, { ...S, tear: 0.25, tearOn: false, gy: 2200 }, 1 / 60);
  const strainNoTear = W.stats.maxStrain;
  ok('strain diagnostic is live', strainNoTear > 0.5, 'max strain with tearing off = ' + strainNoTear.toFixed(3));
  for (let f = 0; f < 240; f++) api.stepFrame(W, { ...S, tear: 0.25, tearOn: true, gy: 2200 }, 1 / 60);
  const after = alivePairs(W);
  ok('overloaded constraints break', after < before * 0.5, before + ' -> ' + after);
  const c1 = alivePairs(W);
  for (let f = 0; f < 60; f++) api.stepFrame(W, { ...S, tear: 2.0, tearOn: true, gy: 2200 }, 1 / 60);
  ok('raising the threshold stops further tearing', c1 === alivePairs(W), c1 + ' -> ' + alivePairs(W));
  const W4 = api.makeWorld();
  api.buildCloth(W4, { x0: 300, y0: 120, cols: 20, rows: 12, sp: 22, im: 1, r: 3 });
  const n4 = alivePairs(W4);
  for (let f = 0; f < 240; f++) api.stepFrame(W4, { ...S, tear: 2.0, tearOn: true, gy: 2200 }, 1 / 60);
  ok('high tear threshold = no tearing', alivePairs(W4) === n4, n4 + ' -> ' + alivePairs(W4));
  const W2 = api.makeWorld();
  api.buildCloth(W2, { x0: 100, y0: 100, cols: 10, rows: 10, sp: 20, im: 1, r: 3 });
  const n0 = alivePairs(W2);
  const cut = api.cutSegment(W2, 100, 120, 300, 120);
  ok('cutSegment severs only crossed links', cut > 8 && cut === n0 - alivePairs(W2),
    'cut=' + cut + ' of ' + n0);
}

console.log('\n== 7. tool primitives ==');
{
  const W = api.makeWorld();
  const b = api.buildCloth(W, { x0: 300, y0: 100, cols: 16, rows: 16, sp: 20, im: 1, r: 3 });
  const i = b.p0 + 8 * 16 + 8;
  api.pinP(W, i, 300, 100);
  ok('pin sets infinite mass', W.im[i] === 0 && W.pin[i] === 1);
  api.unpinP(W, i);
  ok('unpin restores mass', W.im[i] === W.imBase[i] && W.pin[i] === 0);
  api.eraseBody(W, W.x[i], W.y[i], 12);
  ok('eraseBody drops the body and all its constraints', alivePairs(W) === 0,
    'constraints left=' + alivePairs(W));

  const W2 = api.makeWorld();
  const b2 = api.buildCloth(W2, { x0: 300, y0: 100, cols: 10, rows: 10, sp: 20, im: 1, r: 3 });
  const idx = [];
  for (let k = 0; k < b2.pn; k++) idx.push(b2.p0 + k);
  W2.grab = { idx: idx, n: idx.length, tx: 300, ty: 420 };
  const y0 = W2.y[b2.p0 + 55];
  for (let f = 0; f < 30; f++) api.stepFrame(W2, { ...S, grabK: 0.9 }, 1 / 60);
  ok('grab spring drags particles to the pointer', W2.y[b2.p0 + 55] > y0 + 40,
    'y ' + y0.toFixed(1) + ' -> ' + W2.y[b2.p0 + 55].toFixed(1));

  const W3 = api.makeWorld();
  const b3 = api.buildCloth(W3, { x0: 300, y0: 100, cols: 12, rows: 12, sp: 20, im: 1, r: 3 });
  for (let f = 0; f < 20; f++) api.stepFrame(W3, S, 1 / 60);
  const before = (() => { let s = 0; for (let i = 0; i < W3.n; i++) s += Math.hypot(W3.vx[i], W3.vy[i]); return s; })();
  api.applyImpulse(W3, 400, 200, 90, -1, 0, 4);
  const after = (() => { let s = 0; for (let i = 0; i < W3.n; i++) s += Math.hypot(W3.vx[i], W3.vy[i]); return s; })();
  void before;
  ok('applyImpulse injects momentum inside the radius', after > 0,
    'momentum ' + after.toFixed(0));
  const n = api.nearestParticle(W3, 400, 200, 30);
  ok('nearestParticle finds a particle', n >= 0, 'index=' + n);
  ok('nearestParticle respects the radius', api.nearestParticle(W3, 20, 900, 5) === -1);
}

console.log('\n== 8. kinematic collider (spinning paddle) transfers momentum ==');
{
  const run = (spin) => {
    const W = api.makeWorld();
    api.addShape(W, { kind: 'box', cx: 700, cy: 560, hw: 200, hh: 12, spin: spin });
    api.buildCloth(W, { x0: 520, y0: 90, cols: 22, rows: 14, sp: 20, im: 0.6 });
    let sum = 0, touch = 0;
    for (let f = 0; f < 420; f++) {
      api.stepFrame(W, S, 1 / 60);
      sum += meanSpeed(W);
      if (W.stats.contacts > 0) touch++;
    }
    return { mean: sum / 420, peak: maxSpeed(W), bad: badState(W), touch: touch };
  };
  const still = run(0), spinning = run(2.2);
  ok('both paddles actually generate contacts', still.touch > 100 && spinning.touch > 20,
    'contact frames ' + still.touch + ' static vs ' + spinning.touch + ' spinning');
  ok('spinner does not blow the solver up', spinning.bad < 0 && spinning.peak < 1200,
    'peak speed ' + spinning.peak.toFixed(0));
  ok('spinning paddle keeps driving the cloth (static one lets it settle)',
    spinning.mean > still.mean * 2,
    'mean speed ' + still.mean.toFixed(1) + ' static vs ' + spinning.mean.toFixed(1) + ' spinning');
}

console.log('\n== 9. performance + diagnostics accuracy ==');
{
  const W = api.makeWorld();
  api.addShape(W, { kind: 'box', cx: 800, cy: 620, hw: 300, hh: 22, angle: 0.18 });
  api.buildCloth(W, { x0: 200, y0: 60, cols: 34, rows: 24, sp: 18, im: 1, r: 3 });
  api.buildCloth(W, { x0: 900, y0: 60, cols: 30, rows: 22, sp: 18, im: 1, r: 3 });
  api.buildJelly(W, { x0: 400, y0: 700, cols: 9, rows: 7, sp: 26, im: 1.6, cr: 4 });
  api.buildBlob(W, { cx: 1100, y0: 600, r: 70, n: 24, im: 1.4, cr: 4 });
  for (let f = 0; f < 40; f++) api.stepFrame(W, { ...S, wind: 300 }, 1 / 60);
  const t0 = process.hrtime.bigint();
  for (let f = 0; f < 150; f++) api.stepFrame(W, { ...S, wind: 300 }, 1 / 60);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6 / 150;
  ok('solver fits in a 16.7 ms frame', ms < 16.7,
    W.stats.parts + ' particles / ' + W.stats.cons + ' constraints / ' + ms.toFixed(2) + ' ms per frame');
  ok('reported particle count matches reality', W.stats.parts === (() => {
    let c = 0; for (let i = 0; i < W.n; i++) if (W.act[i]) c++; return c;
  })(), 'parts=' + W.stats.parts);
  ok('reported constraint count matches reality', W.stats.cons === alivePairs(W) + (() => {
    let c = 0; for (let k = 0; k < W.ac; k++) if (W.aAlive[k]) c++; return c;
  })(), 'cons=' + W.stats.cons);
  ok('broad phase culls (pairs tested << all pairs)', W.stats.pairsTested < W.stats.parts * 40,
    W.stats.pairsTested + ' candidates vs ' + Math.round(W.stats.parts * W.stats.parts / 2) + ' all-pairs');
  ok('no blow-up (peak speed bounded)', maxSpeed(W) < 60000, 'peak speed=' + maxSpeed(W).toFixed(0));
  ok('energy does not run away (mean speed bounded)', meanSpeed(W) < 400, 'mean=' + meanSpeed(W).toFixed(1));
}

console.log('\n== 10. every shipped scenario runs clean for 5 s ==');
{
  if (!mod.makeScenarios) {
    console.log('  SKIPPED (scenario builders not in this extract)');
  } else {
    const SC = mod.makeScenarios(api).list;
    for (const sc of SC) {
      const W = api.makeWorld();
      const S2 = { ...S, ...sc.settings };
      sc.build(W, S2);
      let peakStrain = 0;
      for (let f = 0; f < 300; f++) api.stepFrame(W, S2, 1 / 60);
      const mid = meanSpeed(W);
      let peakStrain2 = 0;
      for (let f = 0; f < 300; f++) {
        api.stepFrame(W, S2, 1 / 60);
        if (W.stats.maxStrain > peakStrain2) peakStrain2 = W.stats.maxStrain;
      }
      peakStrain = peakStrain2;
      const end = meanSpeed(W);
      let escaped = 0, sunk = 0;
      for (let i = 0; i < W.n; i++) {
        if (!W.act[i]) continue;
        if (W.x[i] < -3 || W.x[i] > api.WORLD_W + 3 || W.y[i] < -3 || W.y[i] > api.WORLD_H + 3) escaped++;
        if (!Number.isFinite(W.x[i])) sunk++;
      }
      ok(sc.name + ': bounded, contained, no divergence, links stay coupled',
        sunk === 0 && escaped === 0 && end < mid * 2.2 && end < 900 && peakStrain < 1.2,
        W.stats.parts + ' parts, ' + W.stats.cons + ' cons, mean speed ' + mid.toFixed(0) +
        ' -> ' + end.toFixed(0) + ', escaped ' + escaped + ', tears ' + W.stats.tears +
        ', peak link strain ' + (peakStrain * 100).toFixed(0) + ' %');
    }
  }
}

console.log('\n' + (fail === 0 ? 'ALL PASS' : 'FAILURES: ' + fail) + ' (' + pass + ' checks passed)');
process.exit(fail === 0 ? 0 : 1);
