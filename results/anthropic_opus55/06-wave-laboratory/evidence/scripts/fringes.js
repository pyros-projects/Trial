// Double-slit: bright-fringe positions from the simulated <u^2> along a screen line vs two-slit path-difference theory
(() => { const L = waveLab, S = L.sim, W = S.W, bar = L.scene.objects[0], xb = bar.u * W, sep = bar.sep;
  const lam = L.settings.c0 / L.scene.sources[0].freq, xsScreen = xb + 0.55, i = Math.round(xsScreen / S.dx - 0.5);
  const col = []; for (let j = 0; j < S.ny; j++) col.push(S.I2[j * S.nx + i]);
  const maxima = []; for (let j = 2; j < S.ny - 2; j++) { const y = (j + 0.5) * S.dx; if (y < 0.15 || y > 0.85) continue;
    if (col[j] > col[j - 1] && col[j] >= col[j + 1] && col[j] > 0.15 * Math.max(...col)) {
      const d = col[j - 1] - 2 * col[j] + col[j + 1], off = d !== 0 ? 0.5 * (col[j - 1] - col[j + 1]) / d : 0; maxima.push(+((j + 0.5 + off) * S.dx).toFixed(4)); } }
  const dr = (y) => Math.hypot(xsScreen - xb, y - (0.5 - sep / 2)) - Math.hypot(xsScreen - xb, y - (0.5 + sep / 2));
  const theory = []; for (let m = -3; m <= 3; m++) { let a = 0.05, b = 0.95; if (Math.sign(dr(a) - m * lam) === Math.sign(dr(b) - m * lam)) continue;
    for (let k = 0; k < 60; k++) { const c = (a + b) / 2; if (Math.sign(dr(c) - m * lam) === Math.sign(dr(a) - m * lam)) a = c; else b = c; }
    const y = (a + b) / 2; if (y >= 0.15 && y <= 0.85) theory.push(+y.toFixed(4)); }
  const pairs = theory.map((y) => { const near = maxima.reduce((p, q) => Math.abs(q - y) < Math.abs(p - y) ? q : p, maxima[0]); return { theory: y, sim: near, err_mm: +((near - y) * 1000).toFixed(1) }; });
  return JSON.stringify({ t: +S.t.toFixed(2), sep, lambda: +lam.toFixed(4), screen_x: +xsScreen.toFixed(3), sim_maxima: maxima, compare: pairs }); })()
