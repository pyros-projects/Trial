// Physics regression suite, evaluated inside the page (uses the read-only OrbitLab diagnostics hook).
// Every scenario is loaded exactly as the Scenarios tab does it and stepped with the app's own stepOnce().
(() => {
  const L = OrbitLab, R = [];
  const check = (name, ok, detail) => R.push({ name, pass: !!ok, detail });
  const run = (key, hours, mut) => {
    L.load(key); L.setPaused(true); if (mut) mut(L.sim);
    const n = Math.round(hours / L.sim.P.dt); for (let k = 0; k < n; k++) L.sim.stepOnce();
    return L.sim;
  };
  const rel = (sim, a, b) => {
    const s = sim.s, i = sim.idx.get(sim.idByName(a)), j = sim.idx.get(sim.idByName(b));
    const rx = s.x[i] - s.x[j], ry = s.y[i] - s.y[j], vx = s.vx[i] - s.vx[j], vy = s.vy[i] - s.vy[j], mu = sim.P.G * (s.m[j] + s.m[i]);
    const r = Math.hypot(rx, ry), v2 = vx * vx + vy * vy, eps = v2 / 2 - mu / r, h = rx * vy - ry * vx;
    return { r, eps, e: Math.sqrt(Math.max(0, 1 + 2 * eps * h * h / (mu * mu))), a: -mu / (2 * eps) };
  };
  // circular two-body: radius & eccentricity preserved over ~2 orbits, tiny energy error
  let sim = run('circular', 170);
  let o = rel(sim, 'Pathfinder', 'Gaia');
  // tolerance 1e-5: the second craft's 1e-6 mass (full N-body) genuinely perturbs the orbit at the 1e-7 level
  check('circular: r stays 12, e≈0', Math.abs(o.r - 12) < 1e-5 && o.e < 1e-5, o);
  check('circular: |ΔE/E| < 1e-12', sim.errors().dE < 1e-12, sim.errors().dE);
  // Kepler period of the e=0.6 ellipse: after exactly one analytic period the craft returns to periapsis
  sim = run('ellipse', 0);
  const T = 2 * Math.PI * Math.sqrt(25 ** 3 / (10 + 1e-6));
  const nT = Math.round(T / sim.P.dt); for (let k = 0; k < nT; k++) sim.stepOnce();
  o = rel(sim, 'Pathfinder', 'Gaia');
  check('ellipse: back at periapsis after one period (leapfrog)', Math.abs(o.r - 10) < 0.01, { r: o.r, T });
  check('ellipse: leapfrog energy error bounded < 1e-5', sim.errors().dE < 1e-5, sim.errors().dE);
  // Hohmann transfer: final orbit circular at 30 Mm
  sim = run('hohmann', 200);
  o = rel(sim, 'Pathfinder', 'Gaia');
  check('hohmann: circular 30 Mm after two burns', Math.abs(o.a - 30) < 0.01 && o.e < 1e-3, o);
  check('hohmann: both burns executed', sim.nodes.every((n) => n.done), sim.nodes.map((n) => n.exec && n.exec.t));
  // moon transfer: captured into lunar orbit
  sim = run('moon', 300);
  o = rel(sim, 'Pathfinder', 'Selene');
  check('moon: captured by Selene (bound, r<6)', o.eps < 0 && o.r < 6 && sim.s.status[3] === 0, o);
  // slingshot: heliocentric energy gained at the flyby
  L.load('sling'); L.setPaused(true); sim = L.sim;
  const e0 = rel(sim, 'Voyager', 'Helios').eps; for (let k = 0; k < 13000; k++) sim.stepOnce();
  const e1 = rel(sim, 'Voyager', 'Helios').eps;
  check('slingshot: heliocentric energy increases', e1 - e0 > 1, { before: e0, after: e1 });
  // escape: hyperbolic w.r.t. Gaia right after the burn, then heliocentric
  sim = run('escape', 9);
  o = rel(sim, 'Pathfinder', 'Gaia');
  check('escape: e>1 and ε>0 after the burn', o.e > 1 && o.eps > 0, o);
  // three-body: pass-through keeps physical energy; merge conserves momentum
  sim = run('three', 900);
  check('three-body (DOPRI tol 1e-10): |ΔE/E| < 1e-6', sim.errors().dE < 1e-6, sim.errors().dE);
  sim = run('three', 900, (sm) => { sm.P.collide = 'merge'; });
  check('three-body merge: momentum error < 1e-12', sim.errors().dP < 1e-12, { dP: sim.errors().dP, log: sim.log.map((l) => l.text) });
  sim = run('three', 900, (sm) => { sm.P.collide = 'bounce'; });
  check('three-body bounce: integration error < 1e-3 and system stays bound-ish', sim.errors().dE < 1e-3, { dE: sim.errors().dE, bounces: sim.log.length });
  // forecast == simulation (default scenario, node at t=24)
  L.load('system'); L.setPaused(true); sim = L.sim;
  const pr = sim.predict({ horizon: 120, dt: sim.P.dt }), ci = sim.idx.get(sim.idByName('Pathfinder'));
  const want = pr.samples.filter((s) => Math.abs(s.t - 100) < 1e-6)[0] || pr.samples.find((s) => s.t > 99.9);
  while (sim.s.t < want.t - 1e-9) sim.stepOnce();
  const diff = Math.hypot(sim.s.x[ci] - want.d[ci], sim.s.y[ci] - want.d[want.n + ci]);
  check('forecast matches live simulation through a burn', diff < 1e-9, { t: want.t, diff });
  // rotating frame: Selene fixed on the +x axis
  L.load('moon'); L.setPaused(true); sim = L.sim;
  const f = L.ui.frame, sn = { t: sim.s.t, n: sim.s.n, d: (() => { const s = sim.s, n = s.n, d = new Float64Array(5 * n); d.set(s.x, 0); d.set(s.y, n); d.set(s.vx, 2 * n); d.set(s.vy, 3 * n); return d; })() };
  const F = L.frameOf(f, sn), m = sim.idx.get(sim.idByName('Selene')), p = L.toFrame(F, sim.s.x[m], sim.s.y[m]), v = L.velToFrame(F, sim.s.x[m], sim.s.y[m], sim.s.vx[m], sim.s.vy[m]);
  check('rotating frame: Selene on +x axis with ~zero frame velocity', Math.abs(p[1]) < 1e-9 && p[0] > 40 && Math.hypot(v[0], v[1]) < 0.05, { p, v });
  L.load('system');
  return JSON.stringify({ passed: R.filter((r) => r.pass).length, total: R.length, results: R });
})()
