// edge-spike diagnostic under stress-test parameters: compare edge-ring height change vs interior
const L = require(process.argv[2] || './.core-from-index.js');
const S = L.generate({ type: 'mountains', seed: 9001, relief: 220, scale: 4, octaves: 9, roughness: 0.62, ridge: 1, warp: 1.2, falloff: 0.2 }, 192);
const P = L.sanitizeSim({ speed: 4, substeps: 16, rain: 10, springs: 5, evaporation: 0.2, erosion: 3, deposition: 3, capacity: 5, flow: 4, thermal: 3, talus: 25, hardness: 0 });
L.captureInitial(S);
for (let k = 0; k < 1500; k++) { const st = L.computeStats(S, P); const dtMax = L.stableDt(S, P, st); const dt = Math.max(0.2 / 8, Math.min(0.2, dtMax)); L.step(S, P, dt); }
const N = S.N; let edgeMax = 0, edgeRise = 0, cnt = 0, intMax = 0;
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
  const i = y * N + x, dh = S.h[i] - S.h0[i];
  if (x === 0 || y === 0 || x === N - 1 || y === N - 1) { edgeMax = Math.max(edgeMax, dh); edgeRise += dh; cnt++; }
  else intMax = Math.max(intMax, dh);
}
const st = L.computeStats(S, P);
console.log(JSON.stringify({ t: S.time.toFixed(1), edgeMaxRise_m: edgeMax.toFixed(2), edgeMeanRise_m: (edgeRise / cnt).toFixed(3), interiorMaxRise_m: intMax.toFixed(2), finite: st.finite, matRel: st.matRel.toExponential(1) }));
// spikes: edge cells > 8 m above both along-edge neighbours and above the inner neighbour
let spikes = 0, spikesInt = 0;
for (let x = 1; x < N - 1; x++) for (const y of [0, N - 1]) { const i = y * N + x, inner = (y === 0 ? i + N : i - N); if (S.h[i] - S.h[i - 1] > 8 && S.h[i] - S.h[i + 1] > 8 && S.h[i] - S.h[inner] > 8) spikes++; }
for (let y = 1; y < N - 1; y++) for (const x of [0, N - 1]) { const i = y * N + x, inner = (x === 0 ? i + 1 : i - 1); if (S.h[i] - S.h[i - N] > 8 && S.h[i] - S.h[i + N] > 8 && S.h[i] - S.h[inner] > 8) spikes++; }
for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) { const i = y * N + x; if (S.h[i] - Math.max(S.h[i - 1], S.h[i + 1], S.h[i - N], S.h[i + N]) > 8) spikesInt++; }
console.log('edge spikes (>8 m above 3 neighbours):', spikes, ' interior spikes (>8 m above all 4):', spikesInt);
