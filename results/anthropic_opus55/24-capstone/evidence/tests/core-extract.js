/*<CORE>*/
/* ===== Astro & navigation core (pure functions, no DOM) ===== */
const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const norm360 = a => ((a % 360) + 360) % 360;
const norm180 = a => { a = norm360(a); return a > 180 ? a - 360 : a; };
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const sind = a => Math.sin(a * D2R), cosd = a => Math.cos(a * D2R), tand = a => Math.tan(a * D2R);
const asind = x => Math.asin(clamp(x, -1, 1)) * R2D, acosd = x => Math.acos(clamp(x, -1, 1)) * R2D;
const atan2d = (y, x) => Math.atan2(y, x) * R2D;

const Astro = (() => {
  // Delta T (TT - UT1) seconds, coarse table 1950-2050 (observed to 2020, extrapolated after)
  const DT = [[1950, 29.1], [1960, 33.2], [1970, 40.2], [1980, 50.5], [1990, 56.9], [2000, 63.8], [2010, 66.1], [2020, 69.4], [2030, 70.5], [2040, 72], [2050, 74]];
  function deltaT(year) {
    if (year <= DT[0][0]) return DT[0][1];
    for (let i = 1; i < DT.length; i++) if (year <= DT[i][0]) {
      const [y0, v0] = DT[i - 1], [y1, v1] = DT[i]; return v0 + (v1 - v0) * (year - y0) / (y1 - y0);
    }
    return DT[DT.length - 1][1];
  }
  const jdUT = ms => ms / 86400000 + 2440587.5;
  function frame(ms) { // quantities that depend only on time; cache by the caller
    const JD = jdUT(ms);
    const year = 2000 + (JD - 2451545) / 365.25;
    const JDE = JD + deltaT(year) / 86400;
    const T = (JDE - 2451545) / 36525;
    // nutation (Meeus ch.22, low precision)
    const Om = 125.04452 - 1934.136261 * T, L = 280.4665 + 36000.7698 * T, Lp = 218.3165 + 481267.8813 * T;
    const dpsi = (-17.20 * sind(Om) - 1.32 * sind(2 * L) - 0.23 * sind(2 * Lp) + 0.21 * sind(2 * Om)) / 3600;
    const deps = (9.20 * cosd(Om) + 0.57 * cosd(2 * L) + 0.10 * cosd(2 * Lp) - 0.09 * cosd(2 * Om)) / 3600;
    const eps0 = 23.4392911111 - (46.8150 * T + 0.00059 * T * T - 0.001813 * T * T * T) / 3600;
    const eps = eps0 + deps;
    // sidereal time (GMST, then apparent)
    const Tu = (JD - 2451545) / 36525;
    const gmst = norm360(280.46061837 + 360.98564736629 * (JD - 2451545) + 0.000387933 * Tu * Tu - Tu * Tu * Tu / 38710000);
    const gast = norm360(gmst + dpsi * cosd(eps));
    // precession angles IAU 1976 (arcsec -> deg)
    const zeta = (2306.2181 * T + 0.30188 * T * T + 0.017998 * T * T * T) / 3600;
    const z = (2306.2181 * T + 1.09468 * T * T + 0.018203 * T * T * T) / 3600;
    const th = (2004.3109 * T - 0.42665 * T * T - 0.041833 * T * T * T) / 3600;
    // Sun (Meeus ch.25 low accuracy)
    const L0 = norm360(280.46646 + 36000.76983 * T + 0.0003032 * T * T);
    const M = norm360(357.52911 + 35999.05029 * T - 0.0001537 * T * T);
    const e = 0.016708634 - 0.000042037 * T - 0.0000001267 * T * T;
    const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * sind(M) + (0.019993 - 0.000101 * T) * sind(2 * M) + 0.000289 * sind(3 * M);
    const sunTrue = L0 + C, nu = M + C;
    const Rau = 1.000001018 * (1 - e * e) / (1 + e * cosd(nu));
    const lam = sunTrue - 0.00569 - 0.00478 * sind(Om);
    const epsApp = eps0 + 0.00256 * cosd(Om);
    const sunRA = norm360(atan2d(cosd(epsApp) * sind(lam), cosd(lam)));
    const sunDec = asind(sind(epsApp) * sind(lam));
    // rotation matrices for stars: precession P, nutation N
    const P = mmul(mmul(rot3(-z), rot2(th)), rot3(-zeta));
    const N = mmul(mmul(rot1(-eps), rot3(-dpsi)), rot1(eps0));
    const PN = mmul(N, P);
    // annual aberration: Earth velocity direction = ecliptic longitude (sunTrue - 90)
    const k = 20.49552 / 3600 * D2R;
    const vl = sunTrue - 90;
    const vEcl = [cosd(vl), sind(vl), 0];
    const vEq = mvec(rot1(-eps), vEcl);
    return {
      ms, JD, T, years: (JDE - 2451545) / 365.25, gmst, gast, dpsi, eps, PN, ab: [vEq[0] * k, vEq[1] * k, vEq[2] * k],
      sun: { ra: sunRA, dec: sunDec, gha: norm360(gast - sunRA), sd: 0.266563 / Rau, hp: 8.794 / 3600 / Rau, R: Rau }
    };
  }
  function rot1(a) { const c = cosd(a), s = sind(a); return [[1, 0, 0], [0, c, s], [0, -s, c]]; }
  function rot2(a) { const c = cosd(a), s = sind(a); return [[c, 0, -s], [0, 1, 0], [s, 0, c]]; }
  function rot3(a) { const c = cosd(a), s = sind(a); return [[c, s, 0], [-s, c, 0], [0, 0, 1]]; }
  function mmul(A, B) { const R = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) R[i][j] = A[i][0] * B[0][j] + A[i][1] * B[1][j] + A[i][2] * B[2][j]; return R; }
  function mvec(A, v) { return [A[0][0] * v[0] + A[0][1] * v[1] + A[0][2] * v[2], A[1][0] * v[0] + A[1][1] * v[1] + A[1][2] * v[2], A[2][0] * v[0] + A[2][1] * v[1] + A[2][2] * v[2]]; }
  // apparent place of a star (J2000 ICRS + proper motion in mas/yr, pmra includes cos dec)
  function starApparent(F, ra0, dec0, pmra, pmdec) {
    const yrs = F.years;
    const dec = dec0 + (pmdec || 0) * yrs / 3.6e6;
    const ra = ra0 + (pmra || 0) * yrs / 3.6e6 / Math.max(1e-6, cosd(dec0));
    let v = [cosd(dec) * cosd(ra), cosd(dec) * sind(ra), sind(dec)];
    v = mvec(F.PN, v);
    v = [v[0] + F.ab[0], v[1] + F.ab[1], v[2] + F.ab[2]];
    const r = Math.hypot(v[0], v[1], v[2]);
    const raA = norm360(atan2d(v[1], v[0])), decA = atan2d(v[2] / r, Math.hypot(v[0], v[1]) / r);
    return { ra: raA, dec: decA, sha: norm360(360 - raA), gha: norm360(F.gast - raA) };
  }
  // J2000 -> date without aberration, used for faint background stars (cheap)
  function precessOnly(F, ra, dec) {
    const v = mvec(F.PN, [cosd(dec) * cosd(ra), cosd(dec) * sind(ra), sind(dec)]);
    return { ra: norm360(atan2d(v[1], v[0])), dec: atan2d(v[2], Math.hypot(v[0], v[1])) };
  }
  // horizontal coordinates for GHA/Dec at lat/lon (east positive)
  function altAz(gha, dec, lat, lon) {
    const lha = norm360(gha + lon);
    const sh = sind(lat) * sind(dec) + cosd(lat) * cosd(dec) * cosd(lha);
    const h = asind(sh);
    const az = norm360(atan2d(-cosd(dec) * sind(lha), sind(dec) * cosd(lat) - cosd(dec) * sind(lat) * cosd(lha)));
    return { h, az, lha };
  }
  // refraction in degrees
  const refrBennett = ha => ha < -1 ? 0 : 1 / tand(ha + 7.31 / (ha + 4.4)) / 60;          // from apparent altitude
  const refrSaemundsson = h => h < -1.5 ? 0 : 1.02 / tand(h + 10.3 / (h + 5.11)) / 60;   // from true altitude
  const dip = hEye => 1.76 * Math.sqrt(Math.max(0, hEye)) / 60;                            // degrees
  return { deltaT, jdUT, frame, starApparent, precessOnly, altAz, refrBennett, refrSaemundsson, dip };
})();

/* ---- Spherical earth helpers (nautical miles, degrees) ---- */
const Geo = {
  // rhumb-line step on a sphere: move `dist` nm on true course `crs`
  rhumb(lat, lon, crs, dist) {
    const dlat = dist * cosd(crs) / 60;
    let lat2 = clamp(lat + dlat, -89.9, 89.9);
    const midLat = (lat + lat2) / 2;
    const lon2 = norm180(lon + dist * sind(crs) / (60 * Math.max(0.01, cosd(midLat))));
    return [lat2, lon2];
  },
  // great-circle distance nm and initial bearing
  gc(lat1, lon1, lat2, lon2) {
    const dlon = lon2 - lon1;
    const c = sind(lat1) * sind(lat2) + cosd(lat1) * cosd(lat2) * cosd(dlon);
    const d = acosd(c) * 60;
    const brg = norm360(atan2d(sind(dlon) * cosd(lat2), cosd(lat1) * sind(lat2) - sind(lat1) * cosd(lat2) * cosd(dlon)));
    return { d, brg };
  },
  // rhumb-line course/distance (for "steer to")
  rhumbTo(lat1, lon1, lat2, lon2) {
    const dlat = (lat2 - lat1) * 60;
    const dlon = norm180(lon2 - lon1) * 60 * cosd((lat1 + lat2) / 2);
    return { d: Math.hypot(dlat, dlon), crs: norm360(atan2d(dlon, dlat)) };
  },
  // local plane (plotting sheet) around ref
  toXY(ref, lat, lon) { return [norm180(lon - ref[1]) * 60 * cosd(ref[0]), (lat - ref[0]) * 60]; },
  fromXY(ref, x, y) { return [ref[0] + y / 60, norm180(ref[1] + x / (60 * cosd(ref[0])))]; }
};

/* ---- Sight reduction (intercept method) ---- */
function reduceSight(s, F, ap, opts) {
  // s: {body, kind:'star'|'sun', Hs(deg), IC(arcmin), hEye(m)}; F: frame at UTC estimate; ap:[lat,lon]
  const IC = s.IC / 60;
  const dipC = Astro.dip(s.hEye);
  const Ha = s.Hs + IC - dipC;
  const refr = Astro.refrBennett(Ha);
  let sd = 0, par = 0, gha, dec, sha = null;
  if (s.kind === 'sun') { sd = F.sun.sd; par = F.sun.hp * cosd(Ha); gha = F.sun.gha; dec = F.sun.dec; }
  else { const st = opts.star; const a = Astro.starApparent(F, st[2], st[3], st[4], st[5]); gha = a.gha; dec = a.dec; sha = a.sha; }
  const Ho = Ha - refr + sd + par;
  const aa = Astro.altAz(gha, dec, ap[0], ap[1]);
  const Hc = aa.h, Zn = aa.az;
  const intercept = (Ho - Hc) * 60; // nm, + toward
  return { IC, dip: dipC, Ha, refr, sd, par, Ho, ghaAries: F.gast, sha, gha, dec, lha: aa.lha, Hc, Zn, intercept, ap: ap.slice() };
}

/* ---- Least-squares fix from LOPs (plane approximation) ---- */
function solveFix(lops, ref) {
  // lops: [{ap:[lat,lon] (already advanced), Zn, intercept, sig (nm, optional)}]
  // weighted least squares; each LOP's sigma grows when it has been advanced by dead reckoning
  if (lops.length < 2) return null;
  let a = 0, b = 0, c = 0, bx = 0, by = 0;
  const L = lops.map(l => {
    const [x0, y0] = Geo.toXY(ref, l.ap[0], l.ap[1]);
    const ux = sind(l.Zn), uy = cosd(l.Zn);
    const d = ux * x0 + uy * y0 + l.intercept; // line: u·p = d
    const sg = l.sig || 1;
    return { ux, uy, d, w: 1 / (sg * sg) };
  });
  for (const l of L) { a += l.w * l.ux * l.ux; b += l.w * l.ux * l.uy; c += l.w * l.uy * l.uy; bx += l.w * l.ux * l.d; by += l.w * l.uy * l.d; }
  const det = a * c - b * b;
  // best crossing angle among pairs (lines cross at the angle between their normals, folded to 0..90)
  let cut = 0;
  for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
    const ang = acosd(Math.abs(L[i].ux * L[j].ux + L[i].uy * L[j].uy));
    cut = Math.max(cut, ang);
  }
  if (det < 1e-6 || cut < 3) return { degenerate: true, cut };
  const x = (c * bx - b * by) / det, y = (a * by - b * bx) / det;
  const resid = L.map(l => l.ux * x + l.uy * y - l.d);
  const n = L.length;
  const wrss = L.reduce((s, l, i) => s + l.w * resid[i] * resid[i], 0);
  // variance factor: a-priori 1 (sigmas in nm); inflate when redundant LOPs disagree more than expected
  const vf = n > 2 ? Math.max(1, wrss / (n - 2)) : 1;
  const sigma = Math.sqrt(vf);
  const inv = [[c / det, -b / det], [-b / det, a / det]];
  const cxx = vf * inv[0][0], cxy = vf * inv[0][1], cyy = vf * inv[1][1];
  const tr = cxx + cyy, dd = Math.sqrt(Math.max(0, (cxx - cyy) * (cxx - cyy) / 4 + cxy * cxy));
  const l1 = tr / 2 + dd, l2 = Math.max(0, tr / 2 - dd);
  const theta = 0.5 * Math.atan2(2 * cxy, cxx - cyy); // radians from x axis (east)
  const k95 = 2.4477; // sqrt(chi2(2, .95))
  return { pos: Geo.fromXY(ref, x, y), xy: [x, y], resid, sigma, cut, ellipse: { a: k95 * Math.sqrt(l1), b: k95 * Math.sqrt(l2), theta }, n };
}

/* ---- Sextant geometry: apparent angle when the instrument is tilted by phi ---- */
function swingAngle(h, phi) {
  // right spherical triangle: tan(psi) = sin(h) tan(phi); cos(alpha) = cos(h) cos(psi)
  const psi = Math.atan(sind(Math.abs(h)) * tand(phi)) * R2D;
  const alpha = acosd(cosd(h) * cosd(psi));
  return { alpha: h >= 0 ? alpha : -alpha, psi };
}

