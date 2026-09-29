// Lens: position of the on-axis intensity maximum behind the lens vs thin/thick-lens geometric focal length
(() => { const L = waveLab, S = L.sim, W = S.W, o = L.scene.objects[0], xl = o.u * W, j = Math.round(o.v / S.dx - 0.5);
  let best = -1, bx = 0; for (let i = Math.round((xl + 0.15) / S.dx); i < S.nx - 2; i++) { const v = S.I2[j * S.nx + i]; if (v > best) { best = v; bx = (i + 0.5) * S.dx; } }
  const a = o.D / 2, s = o.sag, R = (a * a + s * s) / (2 * s), n = o.n, Tc = o.t0 + 2 * s;
  const fThin = R / (2 * (n - 1)), fThick = 1 / ((n - 1) * (2 / R - (n - 1) * Tc / (n * R * R)));
  const lam = L.settings.c0 / L.scene.sources[0].freq, fresnelN = a * a / (lam * fThick);
  // incident plane-wave intensity for comparison (well in front of the source line, left half)
  const I0 = S.I2[j * S.nx + Math.round((0.5 * (L.scene.sources[0].u * W) + 0.5 * (xl - 0.2)) / S.dx)];
  return JSON.stringify({ t: +S.t.toFixed(2), lens_center_x: +xl.toFixed(3), focus_sim_from_center: +(bx - xl).toFixed(3), f_thin: +fThin.toFixed(3), f_thick: +fThick.toFixed(3), fresnel_number: +fresnelN.toFixed(1), peak_intensity_gain: +(best / Math.max(I0, 1e-9)).toFixed(1) }); })()
