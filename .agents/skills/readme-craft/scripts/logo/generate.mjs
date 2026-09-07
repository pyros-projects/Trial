import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PRESETS } from './presets.mjs';
import { ensurePalette } from './palettes.mjs';
import { lightenForDark, hexToHsl, hslToHex } from './colors.mjs';
import { slugify, resolveWords } from './text.mjs';
import { buildFigletWordBlocks, generateFigletSvg } from './engine-figlet.mjs';
import { CFONTS_FONT_PROFILES, renderCfontsLines, generateCfontsSvg, buildCfontsText } from './engine-cfonts.mjs';

export function resolveOutputPath(outDir, name, presetKey, suffix) {
  mkdirSync(outDir, { recursive: true });
  const fileName = suffix ? `${slugify(name)}-${suffix}.svg` : `${slugify(name)}-${presetKey}.svg`;
  return join(outDir, fileName);
}

// B4: Randomization layer
export function randomizeParams(palette) {
  const colors = palette.map(hex => {
    const hsl = hexToHsl(hex);
    // Hue jitter: +/- 8 degrees
    hsl.h += (Math.random() - 0.5) * 16;
    hsl.h = ((hsl.h % 360) + 360) % 360;
    // Saturation jitter: +/- 0.05
    hsl.s = Math.max(0, Math.min(1, hsl.s + (Math.random() - 0.5) * 0.10));
    return hslToHex(hsl);
  });

  // Stop position jitter: +/- 3%
  const stopJitter = (Math.random() - 0.5) * 6;

  // Direction offset: +/- 5 degrees
  const directionOffset = (Math.random() - 0.5) * 10;

  return { colors, directionOffset, stopJitter };
}

export async function generateSingle({ name, presetKey, paletteOverride, outDir, suffix, rootDir, randomize }) {
  const preset = PRESETS[presetKey];
  if (!preset) {
    throw new Error(`Unknown preset: ${presetKey}. Run \`npm run logo:list\` to inspect available presets.`);
  }

  let paletteKey = paletteOverride ?? preset.defaultPalette;

  // Apply randomization if enabled
  if (randomize) {
    const palette = ensurePalette(paletteKey);
    const { colors } = randomizeParams(palette);
    paletteKey = colors.join(',');
  }

  ensurePalette(paletteKey);
  const outputPath = resolveOutputPath(outDir, name, presetKey, suffix);
  let svg;

  if (preset.engine === 'figlet') {
    const words = resolveWords(name);
    const blocks = await buildFigletWordBlocks(preset, words);
    svg = generateFigletSvg(preset, paletteKey, blocks);
  } else {
    const text = buildCfontsText(name);
    const lines = renderCfontsLines(text, preset.font, rootDir);
    svg = generateCfontsSvg(lines, {
      ...preset,
      shadowOffset: preset.shadowOffset ?? CFONTS_FONT_PROFILES[preset.font].shadowOffset,
    }, paletteKey);
  }

  writeFileSync(outputPath, svg);
  return {
    outputPath,
    presetKey,
    paletteKey,
    label: preset.label,
    intent: preset.intent,
    engine: preset.engine,
    family: preset.family,
    name,
  };
}

export async function generateDual({ name, presetKey, paletteOverride, outDir, rootDir, randomize }) {
  const preset = PRESETS[presetKey];
  if (!preset) throw new Error(`Unknown preset: ${presetKey}`);
  const paletteKey = paletteOverride ?? preset.defaultPalette;

  // Light variant (for light backgrounds) - use colors as-is
  const lightResult = await generateSingle({ name, presetKey, paletteOverride: paletteKey, outDir, suffix: 'light', rootDir, randomize });

  // Dark variant (for dark backgrounds) - use HSL-based lightenForDark
  const palette = ensurePalette(paletteKey);
  const lightened = palette.map(c => lightenForDark(c));
  const darkPaletteKey = lightened.join(',');
  const darkResult = await generateSingle({ name, presetKey, paletteOverride: darkPaletteKey, outDir, suffix: 'dark', rootDir, randomize });

  return { light: lightResult, dark: darkResult };
}
