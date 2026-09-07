---
name: github-formatting
description: GitHub-native formatting decision rules covering default tools (relative links, tables, picture element), optional tools (Mermaid, footnotes, math, task lists), and the no-details principle. Guides when to use each pattern.
---

# GitHub-Native Formatting

Use GitHub formatting features deliberately. The goal is clarity, not decoration.

## Execution Procedure

```
select_formatting(content_type, length) → formatting_decisions

default: relative links, teaser + docs/, tables, <picture>
optional: Mermaid (architecture), footnotes (citations), math (formulas), task lists (roadmap)
reject: <details> — always. Inline or move to docs/
```

## TOC

- [Default Tools](#default-tools)
- [Optional Tools](#optional-tools)
- [Decision Rules](#decision-rules)
- [Overflow Strategy](#overflow-strategy)
- [Official GitHub Coverage](#official-github-coverage)

## Default Tools

- Relative links for docs split across `README.md`, `docs/`, and sibling markdown files
- Teaser + `docs/` link for long non-decision content moved out of README
- Tables for structured data such as config, prerequisites, and compatibility
- `<picture>` for dark/light mode logos

## Optional Tools

Use these only when they communicate faster than prose:

- Mermaid diagrams for architecture, flow, sequence, timeline, or dependency relationships
- Task lists for roadmap and progress, not marketing copy
- Footnotes for citations or side notes that should not interrupt the main reading flow
- Math expressions for technical or scientific projects that genuinely need formulas
- Minimal HTML when Markdown is not enough (`<picture>`, `<kbd>`, `<sub>`, `<sup>`, `<br>`)

## Decision Rules

### `<details>` — Do Not Use

**readme-craft does not use `<details>` in READMEs.** Collapsed content is invisible to scanning readers and adds HTML noise for AI agents reading raw Markdown.

- If content is worth including → show it inline
- If content is too long for README → move it to `docs/` as a complete document, link with a teaser
- Scrolling provides natural progressive disclosure — Tier 3 sections at the bottom of README are already "disclosed progressively" by position

**The old approach** of wrapping Tier 3 sections in `<details><summary>` created an invisible layer: grey arrows, collapsed by default, easily skipped. No major README guide recommends `<details>` as a structural documentation strategy.

### Inline vs Sub-Documents

Use the **Checkout Test** to decide: if this section disappeared, would a potential user be less likely to `git clone` or `npm install`? Yes → inline. No → `docs/` with teaser.

| | Inline in README | Sub-document (`docs/xxx.md`) |
|---|---|---|
| Checkout Test | Passes — removal reduces clone likelihood | Fails — removal doesn't change clone likelihood |
| Content types | Feasibility gates, value proposition, trust signals | Post-decision content (internals, full references, contributor info) |
| Length threshold | Any length | > ~15 lines (very short post-decision content can stay inline) |
| Reader discovers it | By scrolling — zero cost | By clicking a teaser link — requires intent |
| Best for | Why, Features, Quick Start, Install, Prerequisites | How It Works, Config reference, Dev guide |

**Teaser link pattern:**

```markdown
## How It Works

skill-forge validates structure, security, and claims in a single pass.

→ [Architecture deep dive](docs/how-it-works.md)
```

The teaser must be substantive (1-3 sentences summarizing the content), not placeholder text ("learn more", "see docs").

### Relative Links

Use when the README links to `docs/`, `CONTRIBUTING.md`, `CHANGELOG.md`, or other repo-local files. Prefer relative links over hard-coded GitHub blob URLs for in-repo navigation.

### Mermaid

Use only when a diagram is faster to parse than bullets or prose. Good cases:

- architecture overview
- request or data flow
- release or implementation timeline
- multi-step workflow with branching

Avoid Mermaid for decorative charts or information already obvious from a short list.

### Task Lists

Use for roadmap or status checkpoints. Do not use task lists for feature marketing.

### Footnotes

Use when a citation, caveat, or attribution is useful but should not interrupt scanning. Keep onboarding content in the main body, not in notes.

### Math

Use only for projects where formulas are part of the core explanation. If the project can be explained without formulas, prefer prose.

### Social Proof

Contributor widgets, star counts, and popularity badges are optional enhancements. Add them only when:

- the repository is public
- the numbers are real and easy to verify
- the user wants social proof in the README

Do not add them by default for early-stage, private, or unpublished repositories.

## Overflow Strategy

When the README becomes too long:

1. Keep Tier 1 and Tier 2 decision-making content inline in `README.md`
2. Move non-decision sections (How It Works, Configuration, Development, etc.) to `docs/` with substantive teaser links
3. Use relative links for all `docs/` references
4. Every teaser must summarize the content (1-3 sentences), not just say "see docs"

## Official GitHub Coverage

This reference assumes current GitHub support for:

- basic Markdown and relative links
- collapsed sections (`<details>` — supported by GitHub but not recommended by readme-craft)
- Mermaid and other diagram syntaxes
- math expressions
- footnotes

Verify current behavior against the official GitHub docs when adding a new formatting pattern.
