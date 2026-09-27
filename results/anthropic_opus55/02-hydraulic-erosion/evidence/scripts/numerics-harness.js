// Dev harness: node harness.js <type> <N> <steps> [json-overrides]
const fs = require('fs'), zlib = require('zlib'), path = require('path');
const coreFile = process.env.CORE || path.join(__dirname, '.core-from-index.js');
const L = require(coreFile);
const [type = 'mountains', Ns = '256', stepsS = '2000', over = '{}'] = process.argv.slice(2);
const N = +Ns, steps = +stepsS;
const o = JSON.parse(over);
const gen = L.sanitizeGen({ type, ...(o.gen || {}) });
const S0 = L.generate(gen, N);
let S = S0;
const P = L.sanitizeSim({ ...(o.sim || {}), boundary: (o.sim && o.sim.boundary) || S.scenario.boundary, seaLevel: (o.sim && o.sim.seaLevel) ?? S.scenario.seaLevel });
if (P.boundary === 'sea') L.fillSea(S, P.seaLevel);
L.captureInitial(S);
console.log('params', JSON.stringify(P));
const t0 = Date.now();
const every = Math.max(1, Math.floor(steps / 8));
for (let k = 1; k <= steps; k++) {
  L.step(S, P, L.BASE_DT * P.speed);
  if (k % every === 0 || k === steps) {
    const st = L.computeStats(S, P);
    console.log(`step ${k} t=${S.time.toFixed(1)}s water=${st.water.toFixed(0)}m3 maxD=${st.maxDepth.toFixed(2)} maxV=${st.maxSpeed.toFixed(2)} meanV=${st.meanSpeed.toFixed(2)} sed=${st.sediment.toFixed(1)} soil=${st.soil.toFixed(0)} maxDelta=${st.maxDelta.toFixed(2)} wet=${(st.wetFrac*100).toFixed(1)}% cfl=${st.cfl.toFixed(3)} matRel=${st.matRel.toExponential(2)} waterRel=${st.waterRel.toExponential(2)} eroded=${S.bal.eroded.toFixed(0)} dep=${S.bal.deposited.toFixed(0)} drainS=${S.bal.drainS.toFixed(1)}`);
  }
}
const ms = (Date.now() - t0) / steps;
console.log(`avg ${ms.toFixed(2)} ms/step at N=${N}`);

// image dump: hillshade + water + delta
function png(w, h, rgb) {
  const raw = Buffer.alloc(h * (1 + w * 3));
  for (let y = 0; y < h; y++) { raw[y * (1 + w * 3)] = 0; rgb.copy(raw, y * (1 + w * 3) + 1, y * w * 3, (y + 1) * w * 3); }
  const chunk = (t, d) => { const b = Buffer.alloc(12 + d.length); b.writeUInt32BE(d.length, 0); b.write(t, 4); d.copy(b, 8); b.writeUInt32BE(L.crc32(b.subarray(4, 8 + d.length)), 8 + d.length); return b; };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const W = N * 2, img = Buffer.alloc(W * N * 3);
const st = L.computeStats(S, P);
const md = Math.max(0.5, st.maxDelta * 0.5);
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
  const i = y * N + x;
  const hx = S.h[Math.min(N - 1, x + 1) + y * N] - S.h[Math.max(0, x - 1) + y * N];
  const hy = S.h[x + Math.min(N - 1, y + 1) * N] - S.h[x + Math.max(0, y - 1) * N];
  const nx = -hx / (2 * S.dx), ny = -hy / (2 * S.dx), nl = Math.hypot(nx, ny, 1);
  let sh = 0.25 + 0.75 * Math.max(0, (nx * -0.5 + ny * -0.5 + 0.707) / nl);
  const e = (S.h[i] - st.minH) / (st.maxH - st.minH);
  let r = (0.35 + 0.5 * e) * sh * 255, g = (0.4 + 0.4 * e) * sh * 255, b = (0.3 + 0.5 * e) * sh * 255;
  const dd = S.d[i];
  if (dd > 0.02) { const t = Math.min(1, dd / 1.5); const c = S.s[i] / dd; r = r * (1 - t * 0.8) + t * 0.8 * (20 + 400 * c); g = g * (1 - t * 0.8) + t * 0.8 * (90 + 200 * c); b = b * (1 - t * 0.8) + t * 0.8 * 200; }
  const o1 = (y * W + x) * 3; img[o1] = Math.min(255, r); img[o1 + 1] = Math.min(255, g); img[o1 + 2] = Math.min(255, b);
  const dl = (S.h[i] - S.h0[i]) / md;
  const o2 = (y * W + x + N) * 3;
  if (dl < 0) { img[o2] = 230; img[o2 + 1] = 230 * (1 + dl) ; img[o2 + 2] = 230 * (1 + dl); }
  else { img[o2] = 230 * (1 - Math.min(1, dl)); img[o2 + 1] = 230 * (1 - Math.min(1, dl) * 0.5); img[o2 + 2] = 230; }
}
const out = path.join(__dirname, `h_${type}_${N}.png`);
fs.writeFileSync(out, png(W, N, img));
console.log('wrote', out);
