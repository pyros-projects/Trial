import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { ensurePalette } from './palettes.mjs';
import { darkenHex } from './colors.mjs';
import { CFONTS_GUARDRAILS, gradientStops, rect } from './svg.mjs';

export const CFONTS_FONT_PROFILES = {
  console: {
    renderMode: 'text',
    fontSize: 18,
    cellW: 11,
    cellH: 18,
    shadowOffset: 2,
  },
  block: {
    renderMode: 'geometry',
    cellW: 10,
    cellH: 16,
    shadowOffset: 2,
  },
  simpleBlock: {
    renderMode: 'geometry',
    cellW: 9,
    cellH: 18,
    shadowOffset: 2,
  },
  shade: {
    renderMode: 'geometry',
    cellW: 10,
    cellH: 16,
    shadowOffset: 2,
  },
  tiny: {
    renderMode: 'geometry',
    cellW: 9,
    cellH: 20,
    shadowOffset: 2,
  },
};

function cfontsBin(rootDir) {
  const bin = join(rootDir, 'node_modules', '.bin', 'cfonts');
  if (!existsSync(bin)) {
    throw new Error('Missing dependency: cfonts. Run `npm install` inside readme-craft before generating logos.');
  }
  return bin;
}

export function renderCfontsLines(text, font, rootDir) {
  const stdout = execFileSync(cfontsBin(rootDir), [
    text,
    '-f', font,
    '-a', 'left',
    '-b', 'transparent',
    '-c', 'white',
    '--spaceless',
    '--env', 'browser',
  ], { encoding: 'utf8' });

  const cleaned = stdout
    .replace(/\u001B\[[0-9;]*m/g, '')
    .replace(/\r/g, '')
    .replace(/^<div[^>]*>/, '')
    .replace(/<\/div>\s*$/, '')
    .replace(/<br>\n?/g, '\n')
    .replace(/<span[^>]*>/g, '')
    .replace(/<\/span>/g, '');

  const lines = cleaned.split('\n');
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines.at(-1).trim()) lines.pop();

  // Trim trailing whitespace from each line and strip empty right columns
  const trimmed = lines.map(line => line.trimEnd());
  const maxLen = Math.max(...trimmed.map(l => l.length));
  let rightTrim = 0;
  for (let col = maxLen - 1; col >= 0; col--) {
    if (trimmed.every(l => col >= l.length || l[col] === ' ')) {
      rightTrim++;
    } else break;
  }
  if (rightTrim > 0) {
    return trimmed.map(l => l.slice(0, Math.max(0, l.length - rightTrim)));
  }
  return trimmed;
}

function glyphRects(ch, ox, oy, cellW, cellH) {
  const stroke = Math.max(1, Math.round(Math.min(cellW, cellH) * 0.12));
  const gap = Math.max(1, Math.round(stroke * 0.75));
  const heavy = Math.max(stroke + 1, Math.round(stroke * 1.8));
  const halfH = Math.round(cellH / 2);
  const halfW = Math.round(cellW / 2);
  const centerVX = ox + Math.round((cellW - (stroke * 2 + gap)) / 2);
  const centerHY = oy + Math.round((cellH - (stroke * 2 + gap)) / 2);
  const nodes = [];
  const push = value => {
    if (value) nodes.push(value);
  };

  const diagDown = () => {
    const parts = [];
    for (let step = 0; step < Math.min(cellW, cellH); step += 1) {
      parts.push(rect(ox + step, oy + step, Math.max(1, Math.round(stroke * 0.9)), Math.max(1, Math.round(stroke * 0.9))));
    }
    return parts.join('');
  };

  const diagUp = () => {
    const parts = [];
    for (let step = 0; step < Math.min(cellW, cellH); step += 1) {
      parts.push(rect(ox + step, oy + (cellH - step - 1), Math.max(1, Math.round(stroke * 0.9)), Math.max(1, Math.round(stroke * 0.9))));
    }
    return parts.join('');
  };

  switch (ch) {
    case '\u2588':
      push(rect(ox, oy, cellW, cellH));
      break;
    case '\u2580':
      push(rect(ox, oy, cellW, halfH));
      break;
    case '\u2584':
      push(rect(ox, oy + halfH, cellW, cellH - halfH));
      break;
    case '\u2591':
      push(rect(ox + 1, oy + 1, Math.max(1, Math.round(cellW / 3)), Math.max(1, Math.round(cellH / 3))));
      push(rect(ox + halfW, oy + halfH, Math.max(1, Math.round(cellW / 3)), Math.max(1, Math.round(cellH / 3))));
      break;
    case '_':
      push(rect(ox, oy + cellH - stroke - 1, cellW, stroke));
      break;
    case '|':
      push(rect(ox + Math.round(cellW / 2) - Math.ceil(heavy / 2), oy, heavy, cellH));
      break;
    case '\u2550':
      push(rect(ox, centerHY, cellW, stroke));
      push(rect(ox, centerHY + stroke + gap, cellW, stroke));
      break;
    case '\u2551':
      push(rect(centerVX, oy, stroke, cellH));
      push(rect(centerVX + stroke + gap, oy, stroke, cellH));
      break;
    case '\u2554':
      push(rect(ox + 1, oy, stroke, cellH));
      push(rect(ox + 1 + stroke + gap, oy, stroke, cellH));
      push(rect(ox, oy + 1, cellW, stroke));
      push(rect(ox, oy + 1 + stroke + gap, cellW, stroke));
      break;
    case '\u2557':
      push(rect(ox + cellW - stroke - gap - stroke - 1, oy, stroke, cellH));
      push(rect(ox + cellW - stroke - 1, oy, stroke, cellH));
      push(rect(ox, oy + 1, cellW, stroke));
      push(rect(ox, oy + 1 + stroke + gap, cellW, stroke));
      break;
    case '\u255A':
      push(rect(ox + 1, oy, stroke, cellH));
      push(rect(ox + 1 + stroke + gap, oy, stroke, cellH));
      push(rect(ox, oy + cellH - stroke - gap - stroke - 1, cellW, stroke));
      push(rect(ox, oy + cellH - stroke - 1, cellW, stroke));
      break;
    case '\u255D':
      push(rect(ox + cellW - stroke - gap - stroke - 1, oy, stroke, cellH));
      push(rect(ox + cellW - stroke - 1, oy, stroke, cellH));
      push(rect(ox, oy + cellH - stroke - gap - stroke - 1, cellW, stroke));
      push(rect(ox, oy + cellH - stroke - 1, cellW, stroke));
      break;
    case '\u2566':
      push(rect(ox, oy + 1, cellW, stroke));
      push(rect(ox, oy + 1 + stroke + gap, cellW, stroke));
      push(rect(centerVX, oy, stroke, cellH));
      push(rect(centerVX + stroke + gap, oy, stroke, cellH));
      break;
    case '\u2569':
      push(rect(ox, oy + cellH - stroke - gap - stroke - 1, cellW, stroke));
      push(rect(ox, oy + cellH - stroke - 1, cellW, stroke));
      push(rect(centerVX, oy, stroke, cellH));
      push(rect(centerVX + stroke + gap, oy, stroke, cellH));
      break;
    case '\u2560':
      push(rect(ox + 1, oy, stroke, cellH));
      push(rect(ox + 1 + stroke + gap, oy, stroke, cellH));
      push(rect(ox, centerHY, cellW, stroke));
      push(rect(ox, centerHY + stroke + gap, cellW, stroke));
      break;
    case '\u2563':
      push(rect(ox + cellW - stroke - gap - stroke - 1, oy, stroke, cellH));
      push(rect(ox + cellW - stroke - 1, oy, stroke, cellH));
      push(rect(ox, centerHY, cellW, stroke));
      push(rect(ox, centerHY + stroke + gap, cellW, stroke));
      break;
    case '/':
    case '\u2571':
      push(diagUp());
      break;
    case '\\':
    case '\u2572':
      push(diagDown());
      break;
    default:
      break;
  }

  return nodes.join('');
}

function renderGrid(lines, cellW, cellH, pad, paintId, shadowOffset = 0) {
  const maxCols = Math.max(...lines.map(line => line.length));
  const rows = [];

  for (let rowIndex = 0; rowIndex < lines.length; rowIndex += 1) {
    const line = lines[rowIndex];
    const y = pad + rowIndex * cellH;
    for (let colIndex = 0; colIndex < line.length; colIndex += 1) {
      const ch = line[colIndex];
      if (ch === ' ') continue;
      const glyph = glyphRects(ch, pad + colIndex * cellW + shadowOffset, y + shadowOffset, cellW, cellH);
      if (glyph) rows.push(glyph);
    }
  }

  return `<g fill="url(#${paintId})">\n    ${rows.join('\n    ')}\n  </g>`;
}

function renderTextSvg(lines, preset, paletteKey) {
  const palette = ensurePalette(paletteKey);
  const shadowPalette = palette.map(color => darkenHex(color, preset.darken));
  const fontSize = CFONTS_FONT_PROFILES[preset.font].fontSize;
  const charWidth = fontSize * 0.62;
  const lineAdvance = fontSize * 1.15;
  const maxCols = Math.max(...lines.map(line => line.length));
  const contentWidth = Math.ceil(maxCols * charWidth);
  const contentHeight = Math.ceil(lines.length * lineAdvance);
  const svgW = contentWidth + preset.pad * 2 + preset.shadowOffset;
  const svgH = contentHeight + preset.pad * 2 + preset.shadowOffset;
  const x = preset.pad;
  const yStart = preset.pad + fontSize;

  const textNodes = lines.map((line, lineIndex) => {
    const y = yStart + lineIndex * lineAdvance;
    return `<text x="${x}" y="${y}" xml:space="preserve">${line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</text>`;
  }).join('\n    ');

  // Apply size guardrails — only constrain width, let viewBox determine height
  const { maxSvgWidth, minDisplayHeight } = CFONTS_GUARDRAILS;
  let displayWidth = Math.min(svgW, maxSvgWidth);
  const proportionalHeight = displayWidth * svgH / svgW;
  if (proportionalHeight < minDisplayHeight) {
    displayWidth = Math.ceil(minDisplayHeight * svgW / svgH);
  }
  const sizeAttrs = displayWidth < svgW
    ? ` width="${displayWidth}"`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}"${sizeAttrs}>
  <defs>
    <linearGradient id="g" x1="${preset.pad}" y1="0" x2="${svgW - preset.pad}" y2="0" gradientUnits="userSpaceOnUse" color-interpolation="linearRGB">
      ${gradientStops(palette, { eased: true })}
    </linearGradient>
    <linearGradient id="gs" x1="${preset.pad}" y1="0" x2="${svgW - preset.pad}" y2="0" gradientUnits="userSpaceOnUse" color-interpolation="linearRGB">
      ${gradientStops(shadowPalette, { eased: true })}
    </linearGradient>
  </defs>
  <g fill="url(#gs)" font-family="SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace" font-size="${fontSize}px" transform="translate(${preset.shadowOffset} ${preset.shadowOffset})" opacity="0.92">
    ${textNodes}
  </g>
  <g fill="url(#g)" font-family="SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace" font-size="${fontSize}px">
    ${textNodes}
  </g>
</svg>
`;
}

export function generateCfontsSvg(lines, preset, paletteKey) {
  const profile = CFONTS_FONT_PROFILES[preset.font];
  if (profile.renderMode === 'text') {
    return renderTextSvg(lines, preset, paletteKey);
  }

  const palette = ensurePalette(paletteKey);
  const shadowPalette = palette.map(color => darkenHex(color, preset.darken));
  const maxCols = Math.max(...lines.map(line => line.length));
  const contentWidth = maxCols * preset.cellW;
  const contentHeight = lines.length * preset.cellH;
  const svgW = contentWidth + preset.pad * 2 + preset.shadowOffset;
  const svgH = contentHeight + preset.pad * 2 + preset.shadowOffset;
  const shadow = renderGrid(lines, preset.cellW, preset.cellH, preset.pad, 'gs', preset.shadowOffset);
  const main = renderGrid(lines, preset.cellW, preset.cellH, preset.pad, 'g', 0);

  // Apply size guardrails — only constrain width, let viewBox determine height
  const { maxSvgWidth, minDisplayHeight } = CFONTS_GUARDRAILS;
  let displayWidth = Math.min(svgW, maxSvgWidth);
  const proportionalHeight = displayWidth * svgH / svgW;
  if (proportionalHeight < minDisplayHeight) {
    displayWidth = Math.ceil(minDisplayHeight * svgW / svgH);
  }
  const sizeAttrs = displayWidth < svgW
    ? ` width="${displayWidth}"`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}"${sizeAttrs} shape-rendering="crispEdges">
  <defs>
    <linearGradient id="g" x1="${preset.pad}" y1="0" x2="${svgW - preset.pad}" y2="0" gradientUnits="userSpaceOnUse" color-interpolation="linearRGB">
      ${gradientStops(palette, { eased: true })}
    </linearGradient>
    <linearGradient id="gs" x1="${preset.pad}" y1="0" x2="${svgW - preset.pad}" y2="0" gradientUnits="userSpaceOnUse" color-interpolation="linearRGB">
      ${gradientStops(shadowPalette, { eased: true })}
    </linearGradient>
  </defs>
  ${shadow}
  ${main}
</svg>
`;
}

export function buildCfontsText(name) {
  const upper = name.toUpperCase();
  // Keep as single line — let SVG guardrails handle width.
  // Use space between words (cfonts renders spaces as gaps).
  return upper.replace(/[-_]+/g, ' ');
}
