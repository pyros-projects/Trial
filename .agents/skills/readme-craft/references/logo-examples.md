---
name: logo-examples
description: Example mappings from project feel (infra/terminal, polished/dark, compact/quirky, etc.) to recommended logo presets. Includes anti-patterns to avoid.
---

# Logo Selection Examples

These are short examples for the "aesthetic choice" part of README generation.

They are not exhaustive. They exist to help the agent make a quick, defensible preset choice.

## Execution Procedure

```
match_preset(project_feel) → preset_name

for each example: project_feel → preset + palette + rationale
anti-patterns: random alternatives, decorative frames, treating wordmarks as brand systems
```

## TOC

- [Example 1](#example-1) — Infra / terminal
- [Example 2](#example-2) — Developer tool
- [Example 3](#example-3) — Experimental / small utility
- [Example 4](#example-4) — Polished / darker palette
- [Example 5](#example-5) — Safe default
- [Example 6](#example-6) — Multiple options
- [Anti-Patterns](#anti-patterns)

## Example 1

Project feel:

- infra
- terminal-heavy
- practical
- no existing brand

Recommendation:

- main: `figlet-dos-rebel-main`
- alternate: `cfonts-block-compact`

Why:

- dense structure
- strong silhouette
- transparent SVG works cleanly in README Tier 1

## Example 2

Project feel:

- developer tool
- slightly more polished
- should feel less brutal than retro DOS lettering

Recommendation:

- main: `cfonts-block-compact`
- alternate: `figlet-dos-rebel-inline`

Why:

- still technical
- less harsh than the main DOS Rebel stack

## Example 3

Project feel:

- experimental
- small utility
- wants character, not corporate polish

Recommendation:

- main: `cfonts-tiny-tall`
- alternate: `cfonts-simpleblock-slim`

Why:

- stronger personality
- compact enough to stay readable in a README

## Example 4

Project feel:

- polished tool
- darker palette
- wants a slightly metallic or embossed mood

Recommendation:

- main: `cfonts-shade-crisp`
- alternate: `cfonts-shade-default`

Why:

- the structure is still readable
- the texture carries more of the mood than the layout does

## Example 5

Project feel:

- user says "just give me something safe"

Recommendation:

- main: `figlet-dos-rebel-main`

Why:

- this is the safest current default
- it has already proven stable across many iterations

## Example 6

Project feel:

- user wants to choose from multiple options
- no strong aesthetic preference

Recommendation:

- run `--candidates 5 --out-dir <project>/assets/candidates/` and present file paths
- let the user preview and pick

Why:

- avoids the "every README looks the same" problem
- respects user's aesthetic judgment
- the candidate pool prioritizes reliable figlet presets first

## Anti-Patterns

Avoid these moves unless the user explicitly wants them:

- generating many random alternatives without user request
- widening the mark just to create variation
- adding opaque background panels by default
- adding decorative frames
- treating README wordmarks like full brand systems
