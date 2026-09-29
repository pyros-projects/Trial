// standing-wave ratio in front of the block along y = 0.5: SWR = max/min of lock-in amplitude over 0.55..0.9 m; |r| = (SWR-1)/(SWR+1)
(() => { const S = waveLab.sim, j = Math.round(0.5 / S.dx - 0.5); let mx = 0, mn = 1e9;
  for (let x = 0.55; x <= 0.9; x += S.dx) { const m = j * S.nx + Math.round(x / S.dx - 0.5); const a = Math.hypot(S.LI[m], S.LQ[m]); mx = Math.max(mx, a); mn = Math.min(mn, a); }
  const swr = mx / mn; return JSON.stringify({ t: +S.t.toFixed(2), mat: (waveLab.scene.objects[0] || { mat: "none" }).mat, SWR: +swr.toFixed(3), reflection_coeff: +((swr - 1) / (swr + 1)).toFixed(3) }); })()
