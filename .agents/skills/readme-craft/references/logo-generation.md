---
name: logo-generation
description: Fallback logo generation system with figlet and cfonts engines, preset selection logic, Node.js 18+ runtime requirements, candidate selection workflow, and HITL presentation rules.
---

# README Logo Generation

This reference describes the fallback logo system used by `readme-craft` when a project has no existing logo but would benefit from a small SVG wordmark in the README.

## Execution Procedure

```
generate_logo(project_name, options) → svg_files

check: Node.js 18+, npm dependencies installed
select_preset: project category → engine + font + layout (see logo-examples.md)
select_palette: project aesthetic → gradient palette (references/gradient-palettes.md)
generate: run scripts/generate-logo.mjs with --candidates N
present: absolute file paths to user for HITL selection
output: copy selected to .github/logo-light.svg, generate dark variant as .github/logo-dark.svg
```

## TOC

- [Positioning](#positioning)
- [One Script, Two Engines](#one-script-two-engines)
- [Requirements](#requirements)
- [Front Matter](#front-matter)
- [Core Aesthetic Conclusions](#core-aesthetic-conclusions)
- [Recommended Presets](#recommended-presets)
- [Selection Logic](#selection-logic)
- [Candidate Cleanup](#candidate-cleanup)
- [Header Presentation Rule](#header-presentation-rule)
- [Execution Policy](#execution-policy)
- [Output Rules](#output-rules)
- [What Does Not Need More Work](#what-does-not-need-more-work)

## Positioning

This is not a general brand-design system.

It is a practical README wordmark system:

- transparent SVG
- compact enough for Tier 1
- readable on GitHub
- slightly "dev" or tool-like by default

For `readme-craft`, this is part of the main workflow, not a recommend-style side branch. If a project has no logo, generate one.

## One Script, Two Engines

Use one user-facing script.

The user does not need to care whether the result comes from a `figlet` preset or a `cfonts` preset. The distinction matters internally, but the interaction surface should be preset-first.

Script:

```sh
node scripts/generate-logo.mjs
```

Default behavior:

- If you pass only `--name`, the script now defaults to a single-line header treatment (`figlet-dos-rebel-inline`).
- `--header-style` provides semantic control without forcing you to memorize preset names:
  - `single-line` → default README header choice
  - `stacked` → denser poster-like treatment
  - `block` → compact blockier display treatment
- `--preset` still overrides everything when you want exact control.

Useful npm commands:

```sh
npm run logo:list
npm run logo:generate -- --name "readme-craft"
npm run logo:generate -- --name "readme-craft" --header-style stacked
npm run logo:generate -- --name "readme-craft" --preset cfonts-block-compact
npm run logo:examples
npm run logo:random -- --name "my-project"
npm run logo:candidates -- --name "my-project" --candidates 5
npm run logo:candidates -- --name "my-project" --candidates 5 --dual
```

## Requirements

The local logo helper needs a Node.js runtime.

- Minimum: Node.js 18+
- Recommended: Node.js 20+
- Package manager: npm is sufficient
- Before generating logos in the `readme-craft` repo, run:

```sh
npm install
```

If dependencies are missing, the script should fail with a plain-language message that tells the agent to run `npm install`.

This runtime is required for the logo-generation path.

Local verification note:

- This setup was verified on Node.js 18.15.0 in the current workspace.
- `npm install` may still print upstream engine warnings from transitive packages in the `cfonts` chain. The generator itself ran successfully here.

## Front Matter

- `SKILL.md` uses YAML front matter.
- Reference files in `references/` do not need front matter.
- Example markdown files also do not need front matter unless they are promoted into actual skill entrypoints.

## Core Aesthetic Conclusions

These conclusions already held up across the exploration rounds.

- Transparent background is the default.
- Structure matters more than color.
- Dense and compact usually beat wide and airy for README wordmarks.
- For Tier 1, visually single-line wordmarks usually beat stacked treatments.
- `DOS Rebel` is the main old-school line.
- `cfonts` provides a useful secondary family, but only as selected baselines.
- Big exploratory galleries are no longer necessary. The system should prefer a small named preset list.

## Recommended Presets

For a visual gallery with rendered previews, see `docs/logo-gallery.md`.

### Main figlet line

- `figlet-dos-rebel-main`
  - Default recommendation for tool-ish, infra-ish, or utility repositories.
- `figlet-dos-rebel-inline`
  - Softer secondary choice when the README wants a slightly more product-like wordmark.
- `figlet-ansi-shadow-sharp`
  - Poster-like alternative. Use selectively, not as the global default.

### cfonts side line

- `cfonts-block-compact`
  - Strongest general-purpose `cfonts` preset.
- `cfonts-simpleblock-slim`
  - When `block` feels too heavy.
- `cfonts-shade-default`
  - Softer, metallic, calmer feel.
- `cfonts-shade-crisp`
  - Same family, brighter and cleaner.
- `cfonts-tiny-tall`
  - Compact micro-display style with more personality.
- `cfonts-console-neutral`
  - Minimal fallback or neutral control.

### cfonts Size Guardrails

cfonts presets have automatic size constraints applied:
- Max SVG width: 900px
- Min display height: 40px (prevents microscopic rendering for wide outputs)
- Compound names (hyphenated/spaced) auto-split into multi-line for better aspect ratios

Only the `width` attribute is set on the SVG — height is derived from the viewBox, so browsers render at the correct proportional size.

## Selection Logic

When the user does not provide an existing logo:

1. Generate candidates using `--candidates N` instead of silently picking one.
2. Present absolute file paths to the user for preview.
3. Let the user pick. If they say "just pick one", use `--random`.
4. Fall back to `figlet-dos-rebel-inline` only when running fully automated with no user interaction.

## Candidate Cleanup

After the user selects a logo candidate:

1. Copy the selected light/dark SVGs to the project root as `logo-light.svg` and `logo-dark.svg`.
2. Delete the entire candidates directory (use a temp dir like `/tmp/` for candidates — never generate into the project tree).

Do not leave candidate files in the published artifact. The selection process is transient — only the result matters.

## Header Presentation Rule

- Optimize for the visual result, not just the SVG geometry. A wordmark can be technically one SVG while still reading like a stacked header.
- Default to a single dominant line in Tier 1. If the wordmark feels like two stacked titles, switch to an inline preset or a quieter one-line treatment.
- If the generated wordmark already spells the project name clearly, do not automatically add a second `<h1>` beneath it. Keep the header visually single-line unless the user explicitly wants both.

## Execution Policy

Run logo generation as a normal workflow step:

1. If the project already has a logo, preserve it and stop here.
2. If the project has no logo, use the local helper.
3. If the helper runtime is already available, generate the SVG and continue.
4. If the helper runtime is missing but repo-local installation is allowed, run `npm install` in the `readme-craft` root and continue.
5. Only stop to ask when the user explicitly rejects generated logos, the environment blocks installation, or the repo already signals strict branding constraints.

Basic mapping:

- infra / CLI / tooling / system utility
  - start with `figlet-dos-rebel-main`
  - if the result feels too stacked for Tier 1, switch to `figlet-dos-rebel-inline`
- slightly friendlier but still technical
  - try `cfonts-block-compact` or `figlet-dos-rebel-inline`
- metallic / polished / textured
  - try `cfonts-shade-default` or `cfonts-shade-crisp`
- compact / quirky / tiny-screen personality
  - try `cfonts-tiny-tall`

## Output Rules

- SVG only
- transparent background
- no decorative frame by default
- no large banner treatment for Tier 1
- prefer one-line or clearly single-band compositions for README headers
- keep the logo compact enough for a normal README header

## What Does Not Need More Work

At this point the preset system is good enough for integration.

There is no strong need for another broad exploration round unless:

- a new project category exposes a missing visual direction
- GitHub rendering constraints change materially
- the script needs a new preset family for a clearly different class of repository
