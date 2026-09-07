import { generateGradientStops as generateOklchStops } from './colors.mjs';

export const CFONTS_GUARDRAILS = {
  maxSvgWidth: 900,
  maxSvgHeight: 300,
  maxAspectRatio: 10,
  minDisplayHeight: 40,
};

export function gradientEndpoints(direction, pad, contentW, contentH) {
  if (direction === 'vertical') return { x1: 0, y1: pad, x2: 0, y2: pad + contentH };
  if (direction === 'diagonal') return { x1: pad, y1: pad, x2: pad + contentW, y2: pad + contentH };
  return { x1: pad, y1: 0, x2: pad + contentW, y2: 0 };
}

// B3: Eased offset using smoothstep
export function easedOffset(index, total) {
  if (total <= 1) return 0;
  const t = index / (total - 1);
  const smoothstep = t * t * (3 - 2 * t);
  return Math.round(smoothstep * 100);
}

// Enhanced gradientStops - backward compat signature, with opts for eased mode
export function gradientStops(colors, opts = {}) {
  if (colors.length === 1) {
    return `<stop offset="0%" stop-color="${colors[0]}"/><stop offset="100%" stop-color="${colors[0]}"/>`;
  }

  if (opts.eased && colors.length >= 2) {
    // OKLCH-interpolate intermediate colors
    const intermediateCount = opts.intermediateCount ?? 8;
    const interpolated = generateOklchStops(colors, intermediateCount);
    return interpolated.map((c, i) => {
      const offset = easedOffset(i, interpolated.length);
      return `<stop offset="${offset}%" stop-color="${c}"/>`;
    }).join('\n      ');
  }

  // Original behavior: evenly spaced stops
  return colors.map((c, i) => {
    const offset = colors.length === 1 ? 0 : Math.round((i / (colors.length - 1)) * 100);
    return `<stop offset="${offset}%" stop-color="${c}"/>`;
  }).join('\n      ');
}

// B3: Consolidated gradient <defs> builder
export function buildGradientDefs(id, colors, opts = {}) {
  const { direction, eased, intermediateCount, pad = 0, contentW = 0, contentH = 0 } = opts;
  const endpoints = gradientEndpoints(direction ?? 'horizontal', pad, contentW, contentH);
  const colorInterp = eased ? ' color-interpolation="linearRGB"' : '';
  const stops = gradientStops(colors, { eased, intermediateCount });

  return `<defs>
    <linearGradient id="${id}" x1="${endpoints.x1}" y1="${endpoints.y1}" x2="${endpoints.x2}" y2="${endpoints.y2}" gradientUnits="userSpaceOnUse"${colorInterp}>
      ${stops}
    </linearGradient>
  </defs>`;
}

// B6: Grain overlay filter (optional, P2)
export function grainFilter(id, opacity = 0.05) {
  return `<filter id="${id}"><feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" /><feColorMatrix type="saturate" values="0" /><feBlend in="SourceGraphic" mode="multiply" result="grain" /><feComponentTransfer><feFuncA type="linear" slope="${opacity}" /></feComponentTransfer></filter>`;
}

export function rect(x, y, width, height) {
  const w = Math.max(0, Math.round(width));
  const h = Math.max(0, Math.round(height));
  if (w === 0 || h === 0) return '';
  return `<rect x="${Math.round(x)}" y="${Math.round(y)}" width="${w}" height="${h}"/>`;
}
