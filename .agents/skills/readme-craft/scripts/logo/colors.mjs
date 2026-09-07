// --- Existing backward-compat functions ---

export function darkenHex(hex, factor) {
  const r = Math.max(0, Math.min(255, Math.round(parseInt(hex.slice(1, 3), 16) * factor)));
  const g = Math.max(0, Math.min(255, Math.round(parseInt(hex.slice(3, 5), 16) * factor)));
  const b = Math.max(0, Math.min(255, Math.round(parseInt(hex.slice(5, 7), 16) * factor)));
  return '#' + [r, g, b].map(value => value.toString(16).padStart(2, '0')).join('');
}

export function lightenHex(hex, factor) {
  const r = Math.min(255, Math.round(parseInt(hex.slice(1, 3), 16) + (255 - parseInt(hex.slice(1, 3), 16)) * factor));
  const g = Math.min(255, Math.round(parseInt(hex.slice(3, 5), 16) + (255 - parseInt(hex.slice(3, 5), 16)) * factor));
  const b = Math.min(255, Math.round(parseInt(hex.slice(5, 7), 16) + (255 - parseInt(hex.slice(5, 7), 16)) * factor));
  return '#' + [r, g, b].map(value => value.toString(16).padStart(2, '0')).join('');
}

// --- B1: HSL-based dark mode ---

export function hexToRgb(hex) {
  const h = hex.startsWith('#') ? hex.slice(1) : hex;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

export function rgbToHex({ r, g, b }) {
  return '#' + [r, g, b]
    .map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'))
    .join('');
}

export function hexToHsl(hex) {
  const { r: r255, g: g255, b: b255 } = hexToRgb(hex);
  const r = r255 / 255;
  const g = g255 / 255;
  const b = b255 / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h: h * 360, s, l };
}

export function hslToHex({ h, s, l }) {
  const hNorm = ((h % 360) + 360) % 360;
  if (s === 0) {
    const v = Math.round(l * 255);
    return rgbToHex({ r: v, g: v, b: v });
  }
  const hue2rgb = (p, q, t) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hFrac = hNorm / 360;
  return rgbToHex({
    r: Math.round(hue2rgb(p, q, hFrac + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, hFrac) * 255),
    b: Math.round(hue2rgb(p, q, hFrac - 1 / 3) * 255),
  });
}

export function lightenForDark(hex, opts = {}) {
  const { lightnessBoost = 0.30, satShift = -0.12 } = opts;
  const hsl = hexToHsl(hex);
  hsl.l = Math.min(0.90, hsl.l + lightnessBoost);
  hsl.s = Math.max(0, Math.min(1, hsl.s + satShift));
  return hslToHex(hsl);
}

// --- B2: OKLCH gradient interpolation ---

// sRGB <-> Linear RGB (gamma correction)
export function srgbToLinear(v) {
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

export function linearToSrgb(v) {
  return v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
}

// Linear RGB -> Oklab (Bjorn Ottosson 2020)
export function linearRgbToOklab(r, g, b) {
  // First matrix: linear RGB -> LMS (cone responses)
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

  // Cube root
  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  // Second matrix: LMS^(1/3) -> Lab
  return {
    L: 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_,
  };
}

// Oklab -> Linear RGB (inverse)
export function oklabToLinearRgb(L, a, b) {
  // Inverse of second matrix: Lab -> LMS^(1/3)
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;

  // Cube to get LMS
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  // Inverse of first matrix: LMS -> linear RGB
  return {
    r:  4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    b: -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  };
}

export function oklabToOklch({ L, a, b }) {
  const C = Math.sqrt(a * a + b * b);
  let h = Math.atan2(b, a) * (180 / Math.PI);
  if (h < 0) h += 360;
  return { L, C, h };
}

export function oklchToOklab({ L, C, h }) {
  const hRad = h * (Math.PI / 180);
  return {
    L,
    a: C * Math.cos(hRad),
    b: C * Math.sin(hRad),
  };
}

// Convert hex -> OKLCH
function hexToOklch(hex) {
  const { r, g, b } = hexToRgb(hex);
  const lr = srgbToLinear(r / 255);
  const lg = srgbToLinear(g / 255);
  const lb = srgbToLinear(b / 255);
  const lab = linearRgbToOklab(lr, lg, lb);
  return oklabToOklch(lab);
}

// Convert OKLCH -> hex (with gamut clamping)
function oklchToHex({ L, C, h }) {
  const lab = oklchToOklab({ L, C, h });
  const { r, g, b } = oklabToLinearRgb(lab.L, lab.a, lab.b);
  // Clamp to sRGB gamut
  const sr = linearToSrgb(Math.max(0, Math.min(1, r)));
  const sg = linearToSrgb(Math.max(0, Math.min(1, g)));
  const sb = linearToSrgb(Math.max(0, Math.min(1, b)));
  return rgbToHex({
    r: Math.round(sr * 255),
    g: Math.round(sg * 255),
    b: Math.round(sb * 255),
  });
}

// Interpolate between two hex colors in OKLCH space
export function interpolateOklch(hex1, hex2, t) {
  const c1 = hexToOklch(hex1);
  const c2 = hexToOklch(hex2);

  // Interpolate L and C linearly
  const L = c1.L + t * (c2.L - c1.L);
  const C = c1.C + t * (c2.C - c1.C);

  // Hue: shortest arc interpolation
  let delta = c2.h - c1.h;
  if (Math.abs(delta) > 180) {
    delta -= Math.sign(delta) * 360;
  }
  let h = c1.h + t * delta;
  // Normalize to 0-360
  h = ((h % 360) + 360) % 360;

  return oklchToHex({ L, C, h });
}

// Generate intermediate gradient stops via OKLCH interpolation
export function generateGradientStops(colors, numStops = 8) {
  if (colors.length < 2) return [...colors];
  if (numStops < 2) return [colors[0]];

  const stops = [];

  if (colors.length === 2) {
    for (let i = 0; i < numStops; i++) {
      const t = i / (numStops - 1);
      stops.push(interpolateOklch(colors[0], colors[1], t));
    }
  } else {
    // For 3+ anchor colors, distribute stops across segments
    const segments = colors.length - 1;
    for (let i = 0; i < numStops; i++) {
      const t = i / (numStops - 1); // 0 to 1 across entire range
      const segPos = t * segments;  // position within segments
      const segIndex = Math.min(Math.floor(segPos), segments - 1);
      const segT = segPos - segIndex; // local t within segment
      stops.push(interpolateOklch(colors[segIndex], colors[segIndex + 1], segT));
    }
  }

  return stops;
}
