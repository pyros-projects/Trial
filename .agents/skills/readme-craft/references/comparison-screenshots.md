---
name: comparison-screenshots
description: Before/after comparison PNG generation via Playwright for README case studies. Covers CLI usage, layout modes (side-by-side, stacked), crop sizing, and file placement rules.
---

# Comparison Screenshots

Generate before/after comparison PNGs for README case studies. Renders markdown as GitHub-styled HTML and captures via Playwright Chromium.

## Execution Procedure

```
generate_comparison(before_md, after_md, options) → png_path

prerequisites: npm install, npx playwright install chromium
render: markdown → GitHub-styled HTML (side-by-side or stacked)
capture: Playwright Chromium screenshot with crop and scale options
output: PNG to docs/ (not examples/)
```

## Prerequisites

```bash
npm install
npx playwright install chromium
```

## CLI Usage

```bash
node scripts/generate-comparison.mjs \
  --before examples/skill-forge-original.md \
  --after examples/skill-forge-after.md \
  --output examples/skill-forge-comparison.png
```

### Options

| Flag | Default | Description |
|------|---------|-------------|
| `--before` | (required) | Path to the "before" markdown file |
| `--after` | (required) | Path to the "after" markdown file |
| `--output` | `comparison.png` | Output PNG path |
| `--mode` | `side-by-side` | Layout: `side-by-side` or `stacked` |
| `--crop` | (none) | Crop to N pixels height — useful for above-fold comparisons |
| `--width` | `1012` | Content width in pixels (1012 = GitHub's native width) |
| `--scale` | `2` | Device pixel ratio (2 = Retina clarity) |
| `--labels` | `BEFORE,AFTER` | Comma-separated label text |

### npm script

```bash
npm run comparison:generate -- --before <path> --after <path> --output <path>
```

## Recommended Usage

**Above-fold crop (default for README embeds):**

```bash
node scripts/generate-comparison.mjs \
  --before original.md --after improved.md \
  --output docs/<project>-comparison.png --crop 1800
```

**Full-page stacked** — for case study documents, not README embeds:

```bash
node scripts/generate-comparison.mjs \
  --before original.md --after improved.md \
  --output docs/<project>-comparison-full.png --mode stacked
```

## Image Path Resolution

The comparison renderer resolves relative `src` and `srcset` paths using the markdown file's parent directory as `baseDir`. This means:

- **Always use the After markdown from its original repo** — if the After README references `.github/logo.svg`, the file must exist relative to the markdown's location
- **Never copy the After to `/tmp/` or another directory** — relative image paths will break (e.g., `.github/logo-dark.svg` resolves to `/tmp/.github/logo-dark.svg`)
- **The Before file can be anywhere** — raw READMEs typically have no image references

Correct: `--after /path/to/original/repo/README.md`
Wrong: `--after /tmp/copied-readme.md`

## File Naming & Placement

- **Output to `docs/`**, not `examples/` (comparison images support documentation, not showcase).
- **Use descriptive names**: `skill-forge-comparison.png`, not `comparison-crop-1800.png`.
- **Crop 1800px** is the default for README-embedded comparisons — large enough to show meaningful content without dominating the page.
- **Never commit intermediate crops** (e.g., crop-1200, crop-1600). Generate the final size directly.
- **One comparison image per case study**. If the README references it, it lives in `docs/` alongside its case study markdown.

## Architecture

```
scripts/
├── generate-comparison.mjs       # CLI entry point
└── comparison/
    ├── render.mjs                # markdown → GitHub-styled HTML
    └── screenshot.mjs            # HTML → PNG via Playwright
```

- `render.mjs` uses `marked` for markdown parsing and `github-markdown-css` for styling
- `screenshot.mjs` launches headless Chromium at 2x DPR for sharp output
- The HTML layout uses GitHub's white card + border aesthetic with colored BEFORE/AFTER labels
