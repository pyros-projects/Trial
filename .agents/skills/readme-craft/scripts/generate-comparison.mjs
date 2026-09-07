import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { renderMarkdown, resolveLocalPaths, buildComparisonPage } from './comparison/render.mjs';
import { screenshotPage } from './comparison/screenshot.mjs';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    i++;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.before || !args.after) {
    throw new Error(
      'Usage: node scripts/generate-comparison.mjs \\\n' +
      '  --before <path.md> --after <path.md> --output <path.png> \\\n' +
      '  [--mode side-by-side|stacked] [--crop 800] [--width 1012] \\\n' +
      '  [--scale 2] [--labels "BEFORE,AFTER"]'
    );
  }

  const beforePath = resolve(process.cwd(), args.before);
  const afterPath = resolve(process.cwd(), args.after);
  const outputPath = resolve(process.cwd(), args.output ?? 'comparison.png');

  const mode = args.mode ?? 'side-by-side';
  const cropHeight = args.crop ? parseInt(args.crop, 10) : undefined;
  const contentWidth = args.width ? parseInt(args.width, 10) : 1012;
  const scale = args.scale ? parseInt(args.scale, 10) : 2;
  const labels = args.labels ? args.labels.split(',') : ['BEFORE', 'AFTER'];

  const beforeMd = readFileSync(beforePath, 'utf-8');
  const afterMd = readFileSync(afterPath, 'utf-8');

  const beforeHtml = resolveLocalPaths(renderMarkdown(beforeMd), dirname(beforePath));
  const afterHtml = resolveLocalPaths(renderMarkdown(afterMd), dirname(afterPath));

  const pageHtml = buildComparisonPage(beforeHtml, afterHtml, {
    mode,
    cropHeight,
    contentWidth,
    labels,
  });

  const viewportWidth = mode === 'side-by-side'
    ? contentWidth + 80
    : contentWidth + 80;

  const buffer = await screenshotPage(pageHtml, {
    width: viewportWidth,
    deviceScaleFactor: scale,
    cropHeight,
  });

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, buffer);
  console.log(`Comparison screenshot saved: ${outputPath}`);
}

main().catch(err => {
  console.error(err.message);
  process.exitCode = 1;
});
