// Headless physics checks for the erosion core (dev tool, not shipped).
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(dir, '../src/sim.js'), 'utf8');
const LAB = new Function(`${src}\nreturn LAB;`)();

let fails = 0;
function check(name, ok, info) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  :: ' + info : ''}`);
  if (!ok) fails++;
}

const baseParams = Object.assign({}, LAB.DEFAULT_PARAMS);

function make(n, params, style, seed, extra) {
  const s = LAB.createSim(n, Object.assign({}, baseParams, params || {}));
  LAB.generate(s, style || 'mountain', Object.assign({ seed: seed || 'alpha' }, extra || {}));
  LAB.resetWater(s);
  return s;
}

function stats(s) {
  let sumW = 0;
  let sumS = 0;
  let nan = 0;
  let maxAbsH = 0;
  let maxW = 0;
  let maxS = 0;
  for (let i = 0; i < s.n * s.n; i++) {
    if (!Number.isFinite(s.h[i]) || !Number.isFinite(s.w[i]) || !Number.isFinite(s.sed[i])) nan++;
    sumW += s.w[i];
    sumS += s.sed[i];
    if (s.w[i] > maxW) maxW = s.w[i];
    if (s.sed[i] > maxS) maxS = s.sed[i];
    if (Math.abs(s.h[i]) > maxAbsH) maxAbsH = Math.abs(s.h[i]);
  }
  return { sumW, sumS, nan, maxAbsH, maxW, maxS };
}

/* ---- 1. a water blob flows downhill, spreads and drains off the rim ---- */
{
  const s = make(64, { rain: 0, evap: 0.05 });
  s.w.fill(0);
  let hi = 0;
  for (let i = 1; i < s.n * s.n; i++) if (s.h[i] > s.h[hi]) hi = i;
  s.w[hi] = 0.2;
  let peak = 0;
  let spreadMax = 0;
  let elevStart = 0;
  let elevEnd = 0;
  let count = 0;
  for (let k = 0; k < 400; k++) {
    LAB.step(s, 1);
    const st = stats(s);
    if (st.sumW > peak) peak = st.sumW;
    if (k === 20) {
      let n = 0;
      for (let i = 0; i < s.n * s.n; i++) if (s.w[i] > 1e-4) n++;
      spreadMax = n;
    }
    // weighted mean terrain elevation under the water: must fall as water descends
    let sw = 0;
    let se = 0;
    for (let i = 0; i < s.n * s.n; i++) {
      sw += s.w[i];
      se += s.w[i] * s.h[i];
    }
    if (sw > 0) {
      const mean = se / sw;
      if (k === 5) elevStart = mean;
      if (k === 300) elevEnd = mean;
    }
  }
  const st = stats(s);
  check('blob spreads instead of sticking', spreadMax > 40, `wet cells at step 20 = ${spreadMax} of ${s.n * s.n}`);
  check('water descends to lower ground', elevEnd < elevStart - 0.01, `mean elevation under water ${elevStart.toFixed(3)} -> ${elevEnd.toFixed(3)}`);
  check('water mass is conserved while flowing', peak < 0.24, `peak sumW=${peak.toFixed(4)} (started 0.2)`);
  check('rim drainage empties the domain', st.sumW < 0.05, `sumW=${st.sumW.toFixed(5)} after 400 steps`);
  check('no NaN while flowing', st.nan === 0, `nan=${st.nan}`);
}

/* ---- 2. water pools level in a closed basin ---- */
{
  const n = 33;
  const s = LAB.createSim(n, Object.assign({}, baseParams, { rain: 0, evap: 0, erode: 0, deposit: 0, thermal: 0 }));
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const d = Math.hypot(x - 16, y - 16);
      s.h[y * n + x] = d < 13 ? 0 : (d - 13) * 0.06;
    }
  LAB.resetWater(s);
  s.w.fill(0);
  s.w[16 * n + 16] = 0.06;
  const total0 = [...s.w].reduce((a, b) => a + b, 0);
  const savedK = Object.assign({}, LAB.K);
  Object.assign(LAB.K, { soak: 0, evapK: 0 }); // isolate pooling from drying
  for (let k = 0; k < 150; k++) LAB.step(s, 1);
  const st = stats(s);
  let levelErr = 0;
  let wet = 0;
  const surface = [];
  for (let i = 0; i < n * n; i++) if (s.w[i] > 1e-5) surface.push(s.h[i] + s.w[i]);
  const meanS = surface.reduce((a, b) => a + b, 0) / Math.max(1, surface.length);
  for (const v of surface) levelErr = Math.max(levelErr, Math.abs(v - meanS));
  for (const v of s.w) if (v > 1e-5) wet++;
  Object.assign(LAB.K, savedK);
  check('basin keeps a level pool', wet > 250 && levelErr < 0.004, `wet=${wet} levelErr=${levelErr.toExponential(2)}`);
  check('closed basin keeps most of its water (only infiltration loses it)', st.sumW > total0 * 0.3, `${total0.toFixed(4)} -> ${st.sumW.toFixed(4)}`);
  check('pool stays finite', st.nan === 0);
}

/* ---- 3. erosion carves channels, deposition builds deltas ---- */
{
  const s = make(128, {}, 'mountain', 'gamma');
  const h0 = Float32Array.from(s.h);
  const t0 = Date.now();
  for (let k = 0; k < 600; k++) LAB.step(s, 2);
  const dt = Date.now() - t0;
  let maxD = 0;
  let carved = 0;
  let filled = 0;
  for (let i = 0; i < s.n * s.n; i++) {
    const d = s.h[i] - h0[i];
    if (Math.abs(d) > maxD) maxD = Math.abs(d);
    if (d < -0.0015) carved++;
    if (d > 0.0015) filled++;
  }
  const st = stats(s);
  check('terrain is actively modified', maxD > 0.015 && maxD < 0.25, `maxDeltaH=${maxD.toFixed(4)} (${((maxD / 0.34) * 100).toFixed(1)}% of relief)`);
  check('channels are carved', carved > 500, `eroded cells=${carved} (${((carved / (s.n * s.n)) * 100).toFixed(1)}%)`);
  check('deposition happens too', filled > 150, `deposited cells=${filled}`);
  check('no NaN after 1200 substeps', st.nan === 0, `nan=${st.nan}`);
  check('heights stay bounded', st.maxAbsH < 3, `maxAbsH=${st.maxAbsH.toFixed(3)}`);
  check('surface water stays bounded', st.maxW < 0.15, `max depth=${st.maxW.toFixed(4)} (would flood the map above 0.12)`);
  const wetFrac = s.stats ? s.stats.wetFrac : 0;
  check('partial coverage of water (pools + rivers)', wetFrac > 0.15 && wetFrac < 0.95, `wet=${(wetFrac * 100).toFixed(1)}%`);
  const tps = (1200 / (dt / 1000)).toFixed(0);
  console.log(`      (1200 substeps at n=128 in ${dt} ms -> ${tps} substeps/s)`);
  check('speed: 1200 substeps under 8 s', dt < 8000, `${dt} ms`);
}

/* ---- 4. determinism ---- */
{
  const a = make(96, {}, 'mountain', 'delta');
  const b = make(96, {}, 'mountain', 'delta');
  for (let k = 0; k < 200; k++) LAB.step(a, 2);
  for (let k = 0; k < 200; k++) LAB.step(b, 2);
  let diff = 0;
  for (let i = 0; i < a.n * a.n; i++) diff = Math.max(diff, Math.abs(a.h[i] - b.h[i]), Math.abs(a.w[i] - b.w[i]));
  check('same seed + params => identical state', diff === 0, `maxDiff=${diff}`);
  const c = make(96, {}, 'mountain', 'omelet');
  for (let k = 0; k < 200; k++) LAB.step(c, 2);
  let diff2 = 0;
  for (let i = 0; i < a.n * a.n; i++) diff2 = Math.max(diff2, Math.abs(a.h[i] - c.h[i]));
  check('different seed => different terrain', diff2 > 0.01, `maxDiff=${diff2.toFixed(4)}`);
}

/* ---- 5. extreme parameter combinations stay numerically stable ---- */
{
  const extremes = [
    { rain: 2, evap: 0, erode: 3, deposit: 3, capacity: 3, flow: 3, thermal: 3, talus: 5 },
    { rain: 2, evap: 4, erode: 3, deposit: 0.1, capacity: 3, flow: 3, thermal: 0, talus: 80 },
    { rain: 0, evap: 0, erode: 3, deposit: 3, capacity: 0, flow: 3, thermal: 3, talus: 10 },
    { rain: 2, evap: 0.2, erode: 3, deposit: 3, capacity: 3, flow: 0.05, thermal: 3, talus: 5 },
  ];
  for (let e = 0; e < extremes.length; e++) {
    const s = make(96, extremes[e], 'canyon', 'ext' + e);
    for (let k = 0; k < 400; k++) LAB.step(s, 3);
    const st = stats(s);
    check(`extreme set ${e} stays finite/bounded`, st.nan === 0 && st.maxAbsH < 3 && st.maxW <= 1.2001 && st.maxS <= 0.3501,
      `nan=${st.nan} maxH=${st.maxAbsH.toFixed(2)} maxDepth=${st.maxW.toFixed(3)} maxSed=${st.maxS.toFixed(3)}`);
  }
}

/* ---- 6. parameter changes produce measurably different outcomes ---- */
{
  const gentle = make(96, { erode: 0.05, capacity: 0.1, deposit: 1 }, 'mountain', 'same');
  const violent = make(96, { erode: 3, capacity: 2.5, deposit: 0.4 }, 'mountain', 'same');
  for (let k = 0; k < 400; k++) {
    LAB.step(gentle, 2);
    LAB.step(violent, 2);
  }
  let d = 0;
  for (let i = 0; i < gentle.n * gentle.n; i++) d = Math.max(d, Math.abs(gentle.h[i] - violent.h[i]));
  check('erosion/capacity settings change the result', d > 0.002, `maxDiff=${d.toFixed(4)}`);

  const dry = make(96, { rain: 0.02, evap: 3 }, 'mountain', 'hydro');
  const wet = make(96, { rain: 1.6, evap: 0.05 }, 'mountain', 'hydro');
  for (let k = 0; k < 400; k++) {
    LAB.step(dry, 2);
    LAB.step(wet, 2);
  }
  const a = stats(dry);
  const b = stats(wet);
  check('rainfall/evaporation change water budget', b.sumW > a.sumW * 3, `dry sumW=${a.sumW.toFixed(2)} wet sumW=${b.sumW.toFixed(2)}`);
  let dh = 0;
  for (let i = 0; i < dry.n * dry.n; i++) dh = Math.max(dh, Math.abs(dry.h[i] - wet.h[i]));
  check('wetter climate erodes differently', dh > 0.002, `maxDiff=${dh.toFixed(4)}`);
}

/* ---- 7. brush tools ---- */
{
  const s = make(64, {}, 'mountain', 'brush');
  const before = s.h[32 * 64 + 32];
  LAB.applyBrush(s, 'raise', 32, 32, 5, 1);
  check('raise tool lifts terrain', s.h[32 * 64 + 32] > before + 0.005, `${before.toFixed(4)} -> ${s.h[32 * 64 + 32].toFixed(4)}`);
  LAB.applyBrush(s, 'lower', 32, 32, 5, 1);
  check('lower tool sinks terrain', Math.abs(s.h[32 * 64 + 32] - before) < 0.004, 'returns near original');
  s.w.fill(0.01);
  LAB.applyBrush(s, 'water', 10, 10, 4, 1);
  check('water tool adds water', s.w[10 * 64 + 10] > 0.011);
  LAB.applyBrush(s, 'dry', 10, 10, 4, 1);
  check('dry tool removes water', s.w[10 * 64 + 10] < 0.002, `${s.w[10 * 64 + 10].toExponential(2)}`);
  s.sed.fill(0);
  LAB.applyBrush(s, 'sediment', 20, 20, 3, 1);
  check('sediment tool adds load', s.sed[20 * 64 + 20] > 0);
  const flat = LAB.createSim(32, Object.assign({}, baseParams));
  flat.h.fill(0.2);
  LAB.applyBrush(flat, 'smooth', 16, 16, 6, 1);
  check('smooth tool is a no-op on flat ground', Math.abs(flat.h[16 * 32 + 16] - 0.2) < 1e-6);
  flat.h[16 * 32 + 16] = 0.5;
  LAB.applyBrush(flat, 'smooth', 16, 16, 6, 1);
  check('smooth tool flattens a spike', flat.h[16 * 32 + 16] < 0.45, `${flat.h[16 * 32 + 16].toFixed(3)}`);
  const p = LAB.probe(s, 32, 32);
  check('probe returns live values', !!p && Number.isFinite(p.elevation) && Number.isFinite(p.slopeDeg), JSON.stringify(p));
}

/* ---- 8. state serialisation round-trip ---- */
{
  const s = make(64, {}, 'mountain', 'rt');
  for (let k = 0; k < 120; k++) LAB.step(s, 2);
  const json = JSON.parse(JSON.stringify(LAB.exportState(s)));
  const clone = LAB.createSim(64, Object.assign({}, baseParams));
  LAB.importState(clone, json);
  let diff = 0;
  for (let i = 0; i < 64 * 64; i++)
    diff = Math.max(diff, Math.abs(s.h[i] - clone.h[i]), Math.abs(s.w[i] - clone.w[i]), Math.abs(s.sed[i] - clone.sed[i]));
  check('state export/import round-trips exactly', diff === 0, `maxDiff=${diff}`);
  for (let k = 0; k < 60; k++) LAB.step(clone, 2);
  check('resumed simulation keeps running after import', stats(clone).nan === 0 && stats(clone).sumW > 0);
  let msg = '';
  try {
    LAB.importState(clone, { nope: 1 });
  } catch (e) {
    msg = e.message;
  }
  check('junk state file rejected with an error', msg.length > 0, msg);
  msg = '';
  try {
    LAB.importState(clone, { app: 'hydraulic-erosion-lab', n: 64, h: 'notbase64!!', w: 'x', sed: 'y' });
  } catch (e) {
    msg = e.message;
  }
  check('corrupt state file rejected with an error', msg.length > 0, msg);
}

/* ---- 9. PNG encoder produces a decodable file ---- */
{
  const s = make(64, {}, 'mountain', 'png');
  for (let k = 0; k < 100; k++) LAB.step(s, 2);
  for (const mode of ['elevation', 'water', 'sediment']) {
    const png = LAB.fieldPNG(s, mode);
    const b = png.bytes;
    const okSig = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a;
    const okIhdr = b[12] === 0x49 && b[13] === 0x48 && b[14] === 0x44 && b[15] === 0x52;
    // IDAT data starts right after its 4-byte length + 4-byte type
    const idatStart = 8 + 4 + 4 + 13 + 4 + 4 + 4;
    let decoded = null;
    try {
      decoded = zlib.inflateSync(Buffer.from(b.subarray(idatStart, b.length - 12)));
    } catch (e) {
      decoded = null;
    }
    const ok = okSig && okIhdr && decoded && decoded.length === (png.width * 3 + 1) * png.height && b[b.length - 8] === 0x49 && b[b.length - 8] === 0x49 && b[b.length - 7] === 0x45 && b[b.length - 6] === 0x4e && b[b.length - 5] === 0x44;
    check(`PNG (${mode}) decodes as a real PNG`, ok, `${b.length} bytes, inflate -> ${decoded ? decoded.length : 'FAIL'} bytes, range ${png.min.toFixed(4)}..${png.max.toFixed(4)}`);
    fs.writeFileSync(`/tmp/lab-${mode}.png`, png.bytes);
  }
}

console.log(fails === 0 ? '\nALL CORE CHECKS PASSED' : `\n${fails} CORE CHECK(S) FAILED`);
process.exit(fails === 0 ? 0 : 1);
