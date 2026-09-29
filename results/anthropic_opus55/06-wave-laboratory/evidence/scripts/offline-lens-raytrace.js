// exact 2-D ray trace through the biconvex lens used in the preset: axis crossing vs ray height
function trace(D, sag, t0, n) {
  const a = D / 2, R = (a * a + sag * sag) / (2 * sag), c = t0 / 2 + sag - R; // right face: circle centred at x=c ; left face: centred at -c
  const out = [];
  for (const h of [0.01, 0.05, 0.1, 0.15, 0.2, 0.25, 0.27]) {
    if (h >= a) continue;
    // left surface: circle centred (-c,0) radius R, rays travel +x at height h; hit point x = -c - sqrt(R²-h²)
    let x = -c - Math.sqrt(R * R - h * h), y = h;
    let nx = (x + c) / R, ny = y / R; // outward normal (pointing left-ish)
    let dx = 1, dy = 0;
    const refr = (dx, dy, nx, ny, n1, n2) => { // normal points against incoming ray
      let cosi = -(dx * nx + dy * ny); if (cosi < 0) { nx = -nx; ny = -ny; cosi = -cosi; }
      const r = n1 / n2, k = 1 - r * r * (1 - cosi * cosi); const ct = Math.sqrt(k);
      return [r * dx + (r * cosi - ct) * nx, r * dy + (r * cosi - ct) * ny]; };
    [dx, dy] = refr(dx, dy, nx, ny, 1, n);
    // intersect right surface: circle centred (c,0) radius R
    const px = x - c, py = y; const b = px * dx + py * dy, cc = px * px + py * py - R * R; const s = -b + Math.sqrt(b * b - cc);
    x += s * dx; y += s * dy; nx = (x - c) / R; ny = y / R;
    [dx, dy] = refr(dx, dy, nx, ny, n, 1);
    const xAxis = x - y * dx / dy; out.push(`h=${h}: crosses axis at ${xAxis.toFixed(3)}`);
  }
  return out.join('\n');
}
console.log('preset lens D=0.70 sag=0.12 t0=0.02 n=1.7\n' + trace(0.7, 0.12, 0.02, 1.7));
console.log('gentle lens D=0.56 sag=0.069 t0=0.02 n=1.7\n' + trace(0.56, 0.069, 0.02, 1.7));
console.log('gentle lens with grid-dispersed n_eff=1.722\n' + trace(0.56, 0.069, 0.02, 1.722));
function bestFocus(D, sag, t0, n) {
  const a = D / 2, R = (a * a + sag * sag) / (2 * sag), c = t0 / 2 + sag - R, rays = [];
  const refr = (dx, dy, nx, ny, n1, n2) => { let cosi = -(dx * nx + dy * ny); if (cosi < 0) { nx = -nx; ny = -ny; cosi = -cosi; }
    const r = n1 / n2, k = 1 - r * r * (1 - cosi * cosi); if (k < 0) return null; const ct = Math.sqrt(k); return [r * dx + (r * cosi - ct) * nx, r * dy + (r * cosi - ct) * ny]; };
  for (let k = 0; k < 200; k++) { const h = -a + (2 * a * (k + 0.5)) / 200; let x = -c - Math.sqrt(R * R - h * h), y = h;
    let d = refr(1, 0, (x + c) / R, y / R, 1, n); if (!d) continue; const px = x - c, b = px * d[0] + y * d[1], cc = px * px + y * y - R * R, s = -b + Math.sqrt(b * b - cc);
    x += s * d[0]; y += s * d[1]; d = refr(d[0], d[1], (x - c) / R, y / R, n, 1); if (!d) continue; rays.push([x, y, d[0], d[1]]); }
  let best = 1e9, bz = 0; for (let z = 0.1; z < 1; z += 0.002) { let ss = 0; for (const [x, y, dx, dy] of rays) { const yy = y + (z - x) * dy / dx; ss += yy * yy; } if (ss < best) { best = ss; bz = z; } }
  return bz; }
console.log('best RMS focus (preset lens):', bestFocus(0.7, 0.12, 0.02, 1.7).toFixed(3), ' gentle:', bestFocus(0.56, 0.069, 0.02, 1.7).toFixed(3));
