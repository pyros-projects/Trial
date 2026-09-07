// A/B trial: identical deterministic initial condition, evolve a fixed number of
// simulation steps, then measure the structure of the velocity / curl fields.
(async () => {
  const P = new URLSearchParams(location.hash.slice(1));
  const VISC = parseFloat(P.get('visc')), VORT = parseFloat(P.get('vort')), STEPS = parseInt(P.get('steps'), 10);
  const f = window.fluxion;
  const set = (id, v) => { const el = document.getElementById(id); el.value = String(v); el.dispatchEvent(new Event('input', { bubbles: true })); };
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const waitSteps = async (n) => { const t = f.stats.steps + n; while (f.stats.steps < t) await sleep(50); };

  // --- identical starting condition -----------------------------------------
  set('rngVisc', 0); set('rngVort', 0);
  f.clearDye();
  set('rngVelDiss', 4); await sleep(2600); set('rngVelDiss', 0);   // drain, then no damping
  const C = { r: 0.25, g: 0.55, b: 0.9 };
  for (let i = 0; i < 6; i++) {                                     // deterministic jet pattern
    const a = i * Math.PI / 3;
    f.splat(0.5 + 0.16 * Math.cos(a), 0.5 + 0.16 * Math.sin(a),
            -Math.sin(a) * 2400, Math.cos(a) * 2400, C);
  }
  // --- apply the parameters under test and evolve ---------------------------
  set('rngVisc', VISC); set('rngVort', VORT);
  await waitSteps(STEPS);

  const grid = (name) => f.sampleField(name);
  const mean = (g) => g.data.reduce((a, b) => a + b, 0) / g.data.length;
  const roughness = (g) => {                                        // mean |neighbour difference|
    let s = 0, n = 0, N = g.size;
    for (let y = 0; y < N; y++) for (let x = 0; x < N - 1; x++) { s += Math.abs(g.data[y * N + x + 1] - g.data[y * N + x]); n++; }
    for (let y = 0; y < N - 1; y++) for (let x = 0; x < N; x++) { s += Math.abs(g.data[(y + 1) * N + x] - g.data[y * N + x]); n++; }
    return s / n;
  };
  const v = grid('velocity'), c = grid('curl');
  return JSON.stringify({
    visc: VISC, vort: VORT, steps: STEPS,
    velMean: +mean(v).toFixed(3),
    velRoughness: +roughness(v).toFixed(3),
    velRelRoughness: +(roughness(v) / mean(v)).toFixed(4),
    curlMean: +mean(c).toFixed(4)
  });
})()
