/* ============================================================================
   DETERMINISM — string seed -> 32-bit state -> mulberry32. Every generated
   course, obstacle, cloud and start transform comes from here, so the same
   seed always yields the same world on any machine.
   ========================================================================== */
function hashSeed(str) {
  let h = 0x811c9dc5;
  const s = String(str == null ? '' : str).toUpperCase();
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  h ^= s.length * 0x9e3779b9;
  return (h >>> 0) || 0x2545f491;
}
function makeRng(seed) {
  let a = (typeof seed === 'number' ? seed : hashSeed(seed)) >>> 0;
  const rng = () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rng.range = (lo, hi) => lo + (hi - lo) * rng();
  rng.int = (lo, hi) => Math.floor(lo + (hi - lo + 1) * rng());
  rng.pick = arr => arr[Math.min(arr.length - 1, Math.floor(rng() * arr.length))];
  rng.sign = () => rng() < 0.5 ? -1 : 1;
  /* Box-Muller, cached */
  let spare = null;
  rng.gauss = () => {
    if (spare !== null) { const s = spare; spare = null; return s; }
    let u = 0, v = 0, s = 0;
    do { u = rng() * 2 - 1; v = rng() * 2 - 1; s = u * u + v * v; } while (s >= 1 || s === 0);
    const m = Math.sqrt(-2 * Math.log(s) / s); spare = v * m; return u * m;
  };
  return rng;
}

/* ---------------------------------------------------- value / fbm noise --- */
/* Deterministic hash noise; no tables to serialise, identical everywhere. */
function hash2i(x, y, s) {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(s | 0, 0x9e3779b9);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function valueNoise2(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2i(xi, yi, s), b = hash2i(xi + 1, yi, s), c = hash2i(xi, yi + 1, s), d = hash2i(xi + 1, yi + 1, s);
  return lerp(lerp(a, b, u), lerp(c, d, u), v) * 2 - 1;
}
function fbm2(x, y, s, oct = 4, lac = 2.03, gain = 0.5) {
  let f = 1, a = 1, sum = 0, norm = 0;
  for (let i = 0; i < oct; i++) { sum += a * valueNoise2(x * f, y * f, s + i * 131); norm += a; f *= lac; a *= gain; }
  return sum / (norm || 1);
}
/** ridged noise for canyon walls */
function ridge2(x, y, s, oct = 4) {
  let f = 1, a = 1, sum = 0, norm = 0;
  for (let i = 0; i < oct; i++) {
    const n = 1 - Math.abs(valueNoise2(x * f, y * f, s + i * 77));
    sum += a * n * n; norm += a; f *= 2.07; a *= 0.5;
  }
  return sum / (norm || 1);
}
