// energy inside the visible domain only (excludes the sponge pad)
(() => { const S = waveLab.sim, u = S.u, up = S.up, NX = S.NX, P = S.P, k = (waveLab.settings.c0 / S.dx) ** 2; let E = 0;
  for (let j = P; j < P + S.ny; j++) for (let i = P; i < P + S.nx; i++) { const q = j * NX + i, v = (u[q] - up[q]) / S.dt;
    E += 0.5 * v * v + 0.5 * k * ((u[q + 1] - u[q]) * (up[q + 1] - up[q]) + (u[q + NX] - u[q]) * (up[q + NX] - up[q])); }
  return E; })()
