// serialize -> JSON -> deserialize must resume bit-identically
const L = require(process.env.CORE || './.core-from-index.js');
const S = L.generate({ type: 'mountains' }, 128);
const P = L.sanitizeSim({});
L.captureInitial(S);
for (let k = 0; k < 300; k++) L.step(S, P, 0.05);
const json = JSON.stringify(L.serialize(S, { params: P }));
const T = L.deserialize(JSON.parse(json));
for (let k = 0; k < 200; k++) { L.step(S, P, 0.05); L.step(T, P, 0.05); }
let diff = 0; for (const key of ['h', 'd', 's', 'soil', 'u', 'v', 'fL', 'wet', 'recent']) for (let i = 0; i < S[key].length; i++) if (S[key][i] !== T[key][i]) diff++;
const a = L.computeStats(S, P), b = L.computeStats(T, P);
console.log(JSON.stringify({ jsonMB: (json.length / 1e6).toFixed(2), differingValuesAfter200Steps: diff, timeS: S.time, timeT: T.time, matRelS: a.matRel, matRelT: b.matRel, waterRelT: b.waterRel }));
// corrupted inputs are rejected or repaired
const bad = JSON.parse(json); bad.arrays.h.data = bad.arrays.h.data.slice(0, 100);
try { L.deserialize(bad); console.log('truncated: ACCEPTED (bad)'); } catch (e) { console.log('truncated rejected:', e.message); }
const nan = L.serialize(S); const hb = new Float64Array(S.h); hb[5] = NaN; hb[6] = 1e9;
nan.arrays.h.data = Buffer.from(hb.buffer).toString('base64');
const R = L.deserialize(JSON.parse(JSON.stringify(nan))); console.log('NaN/out-of-range repaired:', R.importFixes, R.h[5], R.h[6]);
