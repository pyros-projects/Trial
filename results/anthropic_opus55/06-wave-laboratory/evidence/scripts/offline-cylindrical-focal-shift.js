// on-axis intensity behind a 1-D (cylindrical) converging aperture: U(z) ~ (1/sqrt(λz)) ∫ exp(iπx²/λ (1/z - 1/f)) dx
function peak(a, f, lam) { let best = 0, bz = 0; for (let z = 0.15; z < 1.0; z += 0.001) { let re = 0, im = 0; const N = 2000;
  for (let k = 0; k < N; k++) { const x = -a + (2 * a * (k + 0.5)) / N, ph = Math.PI * x * x / lam * (1 / z - 1 / f); re += Math.cos(ph); im += Math.sin(ph); }
  const I = (re * re + im * im) / z; if (I > best) { best = I; bz = z; } } return bz; }
console.log('D=0.70 f=0.450 ->', peak(0.35, 0.450, 1/18).toFixed(3));
console.log('D=0.56 f=0.455 ->', peak(0.28, 0.455, 1/18).toFixed(3));
