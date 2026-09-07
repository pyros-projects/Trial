import { applyCase } from './text.mjs';
import { ensurePalette } from './palettes.mjs';
import { darkenHex } from './colors.mjs';
import { gradientEndpoints, gradientStops } from './svg.mjs';

export const FIGLET_FONTS = {
  'dos-rebel': {
    figletFont: 'DOS Rebel',
    classify: ch => (ch === '\u2588' ? 'main' : 'shadow'),
  },
  'ansi-shadow': {
    figletFont: 'ANSI Shadow',
    classify: ch => (ch === '\u2588' ? 'main' : 'shadow'),
  },
};

let figletLibPromise;
async function loadFiglet() {
  if (!figletLibPromise) {
    figletLibPromise = import('figlet')
      .then(mod => mod.default ?? mod)
      .catch(() => {
        throw new Error('Missing dependency: figlet. Run `npm install` inside readme-craft before generating logos.');
      });
  }
  return figletLibPromise;
}

async function renderFigletText(text, font) {
  const figlet = await loadFiglet();
  return new Promise((resolve, reject) => {
    figlet.text(text, { font }, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
  });
}

function normalizeGrid(lines) {
  const grid = lines.map(line => [...line]);
  const cols = Math.max(...grid.map(row => row.length), 0);
  for (const row of grid) {
    while (row.length < cols) row.push(' ');
  }
  return grid;
}

function trimGridColumns(grid) {
  const rows = grid.length;
  const cols = Math.max(...grid.map(row => row.length), 0);
  let min = cols;
  let max = -1;

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (grid[row][col] !== ' ') {
        min = Math.min(min, col);
        max = Math.max(max, col);
      }
    }
  }

  if (max < min) return grid;
  return grid.map(row => row.slice(min, max + 1));
}

function combineBlocksHorizontally(blocks, gapCols) {
  const grids = blocks.map(lines => normalizeGrid(lines));
  const rows = Math.max(...grids.map(grid => grid.length), 0);
  const padded = grids.map(grid => {
    const cols = grid.length > 0 ? grid[0].length : 0;
    const next = grid.map(row => [...row]);
    while (next.length < rows) next.push(Array(cols).fill(' '));
    return next;
  });

  const combined = Array.from({ length: rows }, () => []);
  padded.forEach((grid, index) => {
    if (index > 0) {
      combined.forEach(row => {
        for (let gap = 0; gap < gapCols; gap += 1) row.push(' ');
      });
    }
    for (let row = 0; row < rows; row += 1) combined[row].push(...grid[row]);
  });

  return combined.map(row => row.join(''));
}

async function renderWordSpaced(word, figletFont, letterGap) {
  const letters = [...word];
  const grids = [];

  for (const ch of letters) {
    const ascii = await renderFigletText(ch, figletFont);
    const lines = ascii.split('\n');
    while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
    grids.push(trimGridColumns(normalizeGrid(lines)));
  }

  const rows = Math.max(...grids.map(grid => grid.length), 0);
  for (const grid of grids) {
    const cols = grid.length > 0 ? grid[0].length : 0;
    while (grid.length < rows) grid.push(Array(cols).fill(' '));
  }

  const combined = Array.from({ length: rows }, () => []);
  grids.forEach((letter, index) => {
    if (index > 0) {
      combined.forEach(row => {
        for (let gap = 0; gap < letterGap; gap += 1) row.push(' ');
      });
    }
    for (let row = 0; row < rows; row += 1) combined[row].push(...letter[row]);
  });

  return combined.map(row => row.join(''));
}

export async function buildFigletWordBlocks(preset, words) {
  const fontProfile = FIGLET_FONTS[preset.fontKey];
  const displayWords = applyCase(words, preset.caseKey);
  const renderedWords = [];

  for (const word of displayWords) {
    renderedWords.push(await renderWordSpaced(word, fontProfile.figletFont, preset.letterGap));
  }

  if (preset.layout === 'inline') return [combineBlocksHorizontally(renderedWords, preset.wordGap)];
  return renderedWords;
}

function measureBlocks(wordBlocks) {
  const blocks = wordBlocks.map(lines => {
    const grid = normalizeGrid(lines);
    const rows = grid.length;
    const cols = Math.max(...grid.map(row => row.length), 0);
    let minCol = cols;
    let maxCol = -1;

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        if (grid[row][col] !== ' ') {
          minCol = Math.min(minCol, col);
          maxCol = Math.max(maxCol, col);
        }
      }
    }

    if (maxCol < minCol) {
      minCol = 0;
      maxCol = 0;
    }

    return {
      grid,
      rows,
      minCol,
      maxCol,
      contentCols: maxCol - minCol + 1,
    };
  });

  const maxContentCols = Math.max(...blocks.map(block => block.contentCols), 0);
  return { blocks, maxContentCols };
}

export function generateFigletSvg(preset, paletteKey, wordBlocks) {
  const fontProfile = FIGLET_FONTS[preset.fontKey];
  const { blocks, maxContentCols } = measureBlocks(wordBlocks);
  const totalRows = blocks.reduce((sum, block) => sum + block.rows, 0);
  const totalGaps = blocks.length > 1 ? (blocks.length - 1) * preset.lineGap : 0;
  const contentW = maxContentCols * preset.cellW;
  const contentH = totalRows * preset.cellH + totalGaps;
  const svgW = contentW + preset.pad * 2;
  const svgH = contentH + preset.pad * 2;
  const gradient = gradientEndpoints(preset.gradientDirection, preset.pad, contentW, contentH);
  const palette = ensurePalette(paletteKey);
  const shadowPalette = palette.map(c => darkenHex(c, preset.darken));

  const mainRects = [];
  const shadowRects = [];
  let yOffset = preset.pad;

  for (const block of blocks) {
    const extraX = (maxContentCols - block.contentCols) * preset.cellW;
    const xOffset = preset.align === 'left'
      ? preset.pad
      : preset.align === 'right'
        ? preset.pad + extraX
        : preset.pad + Math.floor(extraX / 2);

    for (let row = 0; row < block.rows; row += 1) {
      for (let col = block.minCol; col <= block.maxCol; col += 1) {
        const ch = block.grid[row][col];
        if (ch === ' ') continue;
        const x = (col - block.minCol) * preset.cellW + xOffset;
        const y = row * preset.cellH + yOffset;
        const kind = fontProfile.classify(ch);
        mainRects.push(`<rect x="${x}" y="${y}" width="${preset.cellW}" height="${preset.cellH}"/>`);
        if (kind === 'shadow') {
          shadowRects.push(`<rect x="${x}" y="${y}" width="${preset.cellW}" height="${preset.cellH}"/>`);
        }
      }
    }

    yOffset += block.rows * preset.cellH + preset.lineGap;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}">
  <defs>
    <linearGradient id="g" x1="${gradient.x1}" y1="${gradient.y1}" x2="${gradient.x2}" y2="${gradient.y2}" gradientUnits="userSpaceOnUse" color-interpolation="linearRGB">
      ${gradientStops(palette, { eased: true })}
    </linearGradient>
    <linearGradient id="gs" x1="${gradient.x1}" y1="${gradient.y1}" x2="${gradient.x2}" y2="${gradient.y2}" gradientUnits="userSpaceOnUse" color-interpolation="linearRGB">
      ${gradientStops(shadowPalette, { eased: true })}
    </linearGradient>
  </defs>
  <g fill="url(#g)">
    ${mainRects.join('\n    ')}
  </g>
  <g fill="url(#gs)">
    ${shadowRects.join('\n    ')}
  </g>
</svg>
`;
}
