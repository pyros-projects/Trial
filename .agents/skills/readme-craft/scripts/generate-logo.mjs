import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PALETTES, ensurePalette } from './logo/palettes.mjs';
import { PRESETS, BASELINE_PACK, EXAMPLE_JOBS, RELIABLE_POOL, resolvePresetChoice } from './logo/presets.mjs';
import { generateSingle, generateDual } from './logo/generate.mjs';
import { renameSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = dirname(__dirname);
const DEFAULT_OUTPUT_DIR = join(ROOT_DIR, 'output', 'logos');
const EXAMPLES_DIR = join(ROOT_DIR, 'examples', 'logos');

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    index += 1;
  }
  return args;
}

function listPresets() {
  const lines = [
    'Available logo presets:',
    '',
  ];
  for (const [key, preset] of Object.entries(PRESETS)) {
    lines.push(`${key}`);
    lines.push(`  ${preset.family} | ${preset.label}`);
    lines.push(`  ${preset.intent}`);
  }
  console.log(lines.join('\n'));
}

function listPalettes() {
  console.log('Available palettes:\n');
  const entries = Object.entries(PALETTES);
  const maxName = Math.max(...entries.map(([k]) => k.length));
  for (const [name, entry] of entries) {
    const colors = Array.isArray(entry) ? entry : entry.colors;
    const harmony = entry.harmony ? ` [${entry.harmony}]` : '';
    console.log(`  ${name.padEnd(maxName)}  ${colors.join(' → ')}${harmony}`);
  }
  console.log(`\nTotal: ${entries.length} palettes`);
  console.log('Custom: --palette "#hex1,#hex2[,#hex3]"');
}

async function generatePack({ name, outDir }) {
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  const manifest = [];
  for (const presetKey of BASELINE_PACK) {
    manifest.push(await generateSingle({ name, presetKey, outDir, rootDir: ROOT_DIR }));
  }
  writeFileSync(join(outDir, 'manifest.json'), JSON.stringify({
    name,
    pack: 'baselines',
    count: manifest.length,
    items: manifest,
  }, null, 2));
  console.log(outDir);
}

async function generateExamples() {
  rmSync(EXAMPLES_DIR, { recursive: true, force: true });
  mkdirSync(EXAMPLES_DIR, { recursive: true });
  const manifest = [];
  for (const job of EXAMPLE_JOBS) {
    manifest.push(await generateSingle({
      name: job.name,
      presetKey: job.preset,
      paletteOverride: job.palette,
      outDir: EXAMPLES_DIR,
      rootDir: ROOT_DIR,
    }));
  }
  writeFileSync(join(EXAMPLES_DIR, 'manifest.json'), JSON.stringify({
    generatedAt: new Date().toISOString(),
    count: manifest.length,
    items: manifest,
  }, null, 2));
  console.log(EXAMPLES_DIR);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.list) {
    listPresets();
    return;
  }

  if (args['list-palettes']) {
    listPalettes();
    return;
  }

  if (args.examples) {
    await generateExamples();
    return;
  }

  const name = args.name ?? args.project;
  const presetKey = resolvePresetChoice(args.preset, args['header-style']);
  const outDir = args['out-dir'] ? resolve(process.cwd(), args['out-dir']) : DEFAULT_OUTPUT_DIR;

  if (args.pack === 'baselines') {
    if (!name) throw new Error('Missing required --name for baseline pack generation.');
    await generatePack({ name, outDir });
    return;
  }

  // --random mode: pick random preset from RELIABLE_POOL + random palette
  if (args.random) {
    if (!name) throw new Error('Missing required --name for --random mode.');
    const randomPreset = RELIABLE_POOL[Math.floor(Math.random() * RELIABLE_POOL.length)];
    const paletteKeys = Object.keys(PALETTES);
    const randomPalette = paletteKeys[Math.floor(Math.random() * paletteKeys.length)];
    const result = await generateSingle({
      name,
      presetKey: randomPreset,
      paletteOverride: randomPalette,
      outDir,
      rootDir: ROOT_DIR,
      randomize: true,
    });
    console.log(result.outputPath);
    return;
  }

  // --candidates N mode: generate N different preset+palette combos for HITL selection
  if (args.candidates) {
    if (!name) throw new Error('Missing required --name for --candidates mode.');
    const count = parseInt(args.candidates, 10);
    if (!count || count < 1) throw new Error('--candidates requires a positive integer.');

    // Diverse selection: one candidate per preset first, then fill remaining slots
    const allPresets = Object.keys(PRESETS);
    const paletteKeys = Object.keys(PALETTES);
    const pick = arr => arr[Math.floor(Math.random() * arr.length)];

    // Phase 1: one candidate per reliable preset (random palette each)
    const shuffledReliable = [...RELIABLE_POOL].sort(() => Math.random() - 0.5);
    const selected = shuffledReliable.slice(0, count).map(preset => ({
      preset, palette: pick(paletteKeys),
    }));

    // Phase 2: fill remaining with random non-reliable presets, then extra reliable
    if (selected.length < count) {
      const nonReliable = allPresets.filter(p => !RELIABLE_POOL.includes(p)).sort(() => Math.random() - 0.5);
      for (const preset of nonReliable) {
        if (selected.length >= count) break;
        selected.push({ preset, palette: pick(paletteKeys) });
      }
    }
    // Phase 3: if still need more, add extra reliable with different palettes
    while (selected.length < count) {
      selected.push({ preset: pick(RELIABLE_POOL), palette: pick(paletteKeys) });
    }
    const candidateDir = outDir;
    rmSync(candidateDir, { recursive: true, force: true });
    mkdirSync(candidateDir, { recursive: true });

    const dual = !!args.dual;
    const manifest = [];
    for (let i = 0; i < selected.length; i++) {
      const { preset, palette } = selected[i];
      if (dual) {
        const result = await generateDual({
          name,
          presetKey: preset,
          paletteOverride: palette,
          outDir: candidateDir,
          rootDir: ROOT_DIR,
          randomize: true,
        });
        // Rename with index prefix for easy browsing
        const lightName = `${i + 1}-${preset}-light.svg`;
        const darkName = `${i + 1}-${preset}-dark.svg`;
        const lightPath = join(candidateDir, lightName);
        const darkPath = join(candidateDir, darkName);
        if (result.light.outputPath !== lightPath) {
          renameSync(result.light.outputPath, lightPath);
          result.light.outputPath = lightPath;
        }
        if (result.dark.outputPath !== darkPath) {
          renameSync(result.dark.outputPath, darkPath);
          result.dark.outputPath = darkPath;
        }
        manifest.push({ index: i + 1, preset, palette, light: result.light.outputPath, dark: result.dark.outputPath });
      } else {
        const result = await generateSingle({
          name,
          presetKey: preset,
          paletteOverride: palette,
          outDir: candidateDir,
          rootDir: ROOT_DIR,
          randomize: true,
        });
        // Rename with index prefix for easy browsing
        const indexedName = `${i + 1}-${preset}.svg`;
        const indexedPath = join(candidateDir, indexedName);
        if (result.outputPath !== indexedPath) {
          renameSync(result.outputPath, indexedPath);
          result.outputPath = indexedPath;
        }
        manifest.push({ index: i + 1, ...result });
      }
    }

    writeFileSync(join(candidateDir, 'manifest.json'), JSON.stringify({
      name,
      mode: 'candidates',
      count: manifest.length,
      items: manifest,
    }, null, 2));

    console.log(`Generated ${manifest.length} candidates in: ${candidateDir}`);
    manifest.forEach(m => {
      if (m.light && m.dark) {
        console.log(`  ${m.index}. ${m.preset} (${m.palette})`);
        console.log(`     light: ${m.light}`);
        console.log(`     dark:  ${m.dark}`);
      } else {
        console.log(`  ${m.index}. ${m.presetKey} (${m.paletteKey}) → ${m.outputPath}`);
      }
    });
    return;
  }

  if (args.dual) {
    if (!name) throw new Error('Missing required --name for --dual mode.');
    const result = await generateDual({ name, presetKey, paletteOverride: args.palette, outDir, rootDir: ROOT_DIR });
    console.log(`Light variant: ${result.light.outputPath}`);
    console.log(`Dark variant: ${result.dark.outputPath}`);
    return;
  }

  if (!name) {
    throw new Error('Usage: node scripts/generate-logo.mjs --name "project" [--preset figlet-dos-rebel-inline] [--palette ocean|"#hex1,#hex2"] [--dual] [--out-dir output/logos] [--list] [--list-palettes] [--candidates N] [--random]');
  }

  const result = await generateSingle({
    name,
    presetKey,
    paletteOverride: args.palette,
    outDir,
    rootDir: ROOT_DIR,
  });

  console.log(result.outputPath);
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
