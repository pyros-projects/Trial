// Snell check: wave-vector k = -grad(lock-in phase), averaged over 15x15 cells on the beam axes
(() => { const L = waveLab, S = L.sim, W = S.W, H = 7;
  const kAt = (x, y) => { const i0 = Math.round(x / S.dx - 0.5), j0 = Math.round(y / S.dx - 0.5); let kx = 0, ky = 0, n = 0;
    for (let j = j0 - H; j <= j0 + H; j++) for (let i = i0 - H; i <= i0 + H; i++) {
      const m = j * S.nx + i, zr = S.LI[m], zi = -S.LQ[m];
      const dzr_x = (S.LI[m + 1] - S.LI[m - 1]) / (2 * S.dx), dzi_x = (-S.LQ[m + 1] + S.LQ[m - 1]) / (2 * S.dx);
      const dzr_y = (S.LI[m + S.nx] - S.LI[m - S.nx]) / (2 * S.dx), dzi_y = (-S.LQ[m + S.nx] + S.LQ[m - S.nx]) / (2 * S.dx);
      const a2 = zr * zr + zi * zi; if (a2 < 1e-12) continue;
      kx += -(zr * dzi_x - zi * dzr_x) / a2; ky += -(zr * dzi_y - zi * dzr_y) / a2; n++; }
    kx /= n; ky /= n; return { k: +Math.hypot(kx, ky).toFixed(1), angleFromNormal: +(Math.atan2(kx, ky) * 180 / Math.PI).toFixed(2) }; };
  const src = L.scene.sources[0], slab = L.scene.objects[0], n = slab.n, yI = slab.v - slab.hh;
  const inc = 40 * Math.PI / 180, xs = src.u * W, ys = src.v, xHit = xs + (yI - ys) * Math.tan(inc), tr = Math.asin(Math.sin(inc) / n);
  const a = kAt(xs + (0.3 - ys) * Math.tan(inc) + 0.0, 0.30), b = kAt(xHit + 0.25 * Math.tan(tr), yI + 0.25);
  const k0 = 2 * Math.PI * src.freq / L.settings.c0;
  return JSON.stringify({ t: +S.t.toFixed(2), n, incident: a, refracted: b, k0: +k0.toFixed(1), nk0: +(n * k0).toFixed(1),
    snell_from_measured_incident: +(Math.asin(Math.sin(a.angleFromNormal * Math.PI / 180) / n) * 180 / Math.PI).toFixed(2),
    n_from_sines: +(Math.sin(a.angleFromNormal * Math.PI / 180) / Math.sin(b.angleFromNormal * Math.PI / 180)).toFixed(3),
    n_from_k_ratio: +(b.k / a.k).toFixed(3) }); })()
