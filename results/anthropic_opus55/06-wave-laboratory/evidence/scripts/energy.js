// discrete leapfrog energy E^{n+1/2} = ½Σ((u^{n+1}-u^n)/Δt)² + ½(c/Δx)² Σ_edges Δu^{n+1}·Δu^n  (conserved exactly by the scheme when σ = 0)
(() => { const S = waveLab.sim, NX = S.NX, NY = S.NY, u = S.u, up = S.up, c = waveLab.settings.c0, k = (c / S.dx) ** 2; let kin = 0, pot = 0;
  for (let y = 1; y < NY - 1; y++) for (let x = 1; x < NX - 1; x++) { const i = y * NX + x; const v = (u[i] - up[i]) / S.dt; kin += v * v;
    pot += (u[i + 1] - u[i]) * (up[i + 1] - up[i]) + (u[i + NX] - u[i]) * (up[i + NX] - up[i]); }
  return JSON.stringify({ t: +S.t.toFixed(3), step: S.step, E: +(0.5 * kin + 0.5 * k * pot).toFixed(4), kinetic: +(0.5 * kin).toFixed(4), potential: +(0.5 * k * pot).toFixed(4) }); })()
