(() => {
  // sparse sheet + small fast ball: only edge (segment) collisions can catch this
  clearWorld();
  P.tear = 3.0; P.wind = 0; P.substeps = 5; P.iters = 3; P.thickness = 1;
  P.edgeCollide = window.__EDGE; syncControls();
  const nx = 9, ny = 4, sp = 44;
  const c = makeCloth(world.w * 0.5 - (nx - 1) * sp / 2, 340, nx, ny, sp, { pin: 'none', rad: 7 });
  for (let y = 0; y < ny; y++) for (const x of [0, nx - 1]) { const i = c.idx[y * nx + x]; S.pflag[i] |= 1; S.w[i] = 0; }
  const b = makeBall(world.w * 0.5 + sp * 0.5, 60, 13, { dens: 8 });
  S.vy[b.idx[0]] = 1900;
  applyDensity(); updateSkips();
  window.__ball = b.idx[0]; window.__cloth = c; window.__t0 = performance.now();
  const tick = () => {
    let cy = 0; for (const p of c.idx) cy += S.py[p]; cy /= c.idx.length;
    window.__leak = { edgeCollide: P.edgeCollide, ballY: +S.py[window.__ball].toFixed(0),
                      clothY: +cy.toFixed(0), caught: S.py[window.__ball] < cy + 30, gapPx: sp - 2 * 7 };
    if (performance.now() - window.__t0 < 2200) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return 'dropping';
})()
