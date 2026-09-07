# Case Study: Skill Forge README

A before/after analysis of applying [readme-craft](https://github.com/motiful/readme-craft)'s 3-tier layout strategy and 45-point quality checklist to the Skill Forge README. The raw version represents a typical first-draft README with no visual hierarchy. The after version demonstrates a fully structured, GitHub-native layout that follows the current methodology.

- **Before**: [`skill-forge-raw.md`](skill-forge-raw.md) — beginner-style flat README
- **After**: [`skill-forge/README.md`](https://github.com/motiful/skill-forge/blob/main/README.md) — full 3-tier layout (v8.1)

---

## Before: Structure Overview

```
# Skill Forge                          <- H1 (plain text, left-aligned)
  paragraph (description)              <- no one-liner, no logo, no badges
  paragraph (compatibility note)

## Installation                        <- H2
  code block (npx)
  code block (clone + symlinks)

## Features                            <- H2
  paragraph (wall of text)
  paragraph

## Usage                               <- H2
  paragraph
  bullet list (trigger phrases)

## Example                             <- H2
  paragraph
  code block

## Prerequisites                       <- H2
  paragraph
  bullet list

## Skill Composition                   <- H2
  paragraph

## Related Skills                      <- H2
  bullet list

## Project Structure                   <- H2
  code block (tree)

## License                             <- H2
  inline text
```

### Tier 1 Evaluation (Above the Fold)

| Element | Present? | Notes |
|---------|----------|-------|
| Logo (centered, `<picture>`) | No | No logo at all |
| Project name (centered `<h1>`) | Partial | Plain `# Skill Forge`, left-aligned |
| One-liner as value proposition | No | Two full paragraphs instead; describes what it is, not why you should care |
| Badges | No | None |
| Quick action links | No | None |

**Verdict**: No Tier 1 exists. The first screen is a left-aligned heading followed by two paragraphs of prose.

### Tier 2 Evaluation (Scan Quickly)

| Section | Present? | Notes |
|---------|----------|-------|
| Why / The Problem | No | No motivation section |
| Features (bullet list, 3-6 items) | No | Features is a single prose paragraph describing all five stages in running text |
| Quick Start | No | No Quick Start section; Install appears first |
| Install | Yes | Appears as the second section, before Features |
| Usage | Yes | Trigger phrases listed, but no Quick Start precedes it |

**Verdict**: Two of five required Tier 2 sections are present. Section ordering puts Install before Features and Usage. Features is a paragraph, not a scannable list.

### Tier 3 Evaluation (Supporting Content)

| Section | Placement | Notes |
|---------|-----------|-------|
| Prerequisites | Open H2 at same level as Tier 2 | Should be a sub-section under Install or moved to docs/ |
| Skill Composition | Open H2 | Post-decision meta-content occupying same visual weight as core sections |
| Related Skills | Open H2 | Dependency info without structured format |
| Project Structure | Open H2 | Contributor-facing content, should be in docs/ or inline tree |
| License | Open H2 | Acceptable — short, always inline |

**Verdict**: All reference material sits as top-level H2 sections with the same visual weight as Tier 2 content. No separation between decision-making and post-decision information.

---

## After: Structure Overview

```
<div align="center">                   <- Tier 1 block
  <picture> logo (dark/light from .github/)
  <p> one-liner value proposition
</div>
> tagline: "Skills are code. Engineer them like it."
  badges (3, reference-style)
  quick links (Quick Start, Usage, Install, Agent Skills)
---

## The Problem                         <- Tier 2 starts
  paragraph (ecosystem stats: 88K+ skills, 26% with vulnerabilities)
  bold-lead paragraph (pre-publish audience)
  bold-lead paragraph (post-publish audience)
  closing paragraph (the gap)

## What Skill Forge Does
  positioning sentence
  bullet list (10 user-facing capabilities, most innovative first)
  token cost note

## Quick Start                         <- Tier 2
  code block (npx)
  code block (4 trigger phrases with result descriptions)

## Usage                               <- Tier 2
  bullet list (6 trigger phrases)

## When to Load                        <- Tier 2
  table (4 rows: situation → answer)
  closing sentence
  Example: sample flow with provenance label

## Install                             <- Tier 2
  code block (npx)
  compatibility note
  Manual registration (inline code block)
  ### Prerequisites (3 required tools)
  ### Dependencies (table: 3 auto-installed deps with purpose)
  Positioning sentence

## Skill Philosophy                    <- Tier 3 (teaser + docs/)
  1-sentence summary
  → link to docs/skill-philosophy.md

## Contributing                        <- Open (acceptable)
## License                             <- Open (acceptable)
---
  skill footer
  badge reference-style links
```

### Tier 1 Evaluation (Above the Fold)

| Element | Present? | Notes |
|---------|----------|-------|
| Logo (centered, `<picture>`) | Yes | Dark/light SVG variants from `.github/`, 480px width (wordmark) |
| Project name (centered `<h1>`) | Yes | Rendered by the wordmark logo; no duplicate `<h1>` |
| One-liner as value proposition | Yes | "From local experiment to installable, trustworthy skill — in one command." |
| Badges | Yes | 3 badges (License, Version 8.1, Agent Skills), reference-style links |
| Quick action links | Yes | Quick Start, Usage, Install, Agent Skills |

**Verdict**: Complete Tier 1 with all five required elements. Compact layout fits within the ~250px fold target.

### Tier 2 Evaluation (Scan Quickly)

| Section | Present? | Notes |
|---------|----------|-------|
| Why / The Problem | Yes | Ecosystem stats + two bold-lead audience segments + closing gap statement |
| What Skill Forge Does | Yes | 10 benefit-oriented capability bullets (most innovative first); token cost transparency |
| When to Load | Yes | Table format for quick self-selection |
| Quick Start | Yes | `npx skills add` + 4 trigger phrases with result descriptions |
| Usage | Yes | 6 trigger phrases as bullets |
| Install | Yes | Primary `npx` command; manual method inline; Prerequisites and Dependencies as `###` sub-sections |

**Verdict**: All required Tier 2 sections present with correct ordering. Code blocks, bullet lists, and tables used throughout. No section exceeds one screen.

### Tier 3 Evaluation (Supporting Content)

| Section | Placement | Notes |
|---------|-----------|-------|
| Skill Philosophy | Teaser + `docs/` link | 1-sentence summary + "→ Vision, quality dimensions, and technical route" |
| Prerequisites | `###` under Install | 3 bullets, short — stays inline as part of install workflow |
| Dependencies | `###` under Install | 3-row table, contextually part of install workflow |
| Contributing | Open H2 | Short invitation with GitHub link (acceptable) |
| License | Open H2 | One-line reference (acceptable) |

**Verdict**: Post-decision content uses the Checkout Test correctly. Skill Philosophy (the only deep non-decision section) moves to `docs/` with a substantive teaser. Short sections (Prerequisites, Dependencies) stay inline where contextually relevant. No `<details>` used.

---

## Changes Made

| # | Change | What | Why |
|---|--------|------|-----|
| 1 | Added Tier 1 hero block | Centered `<picture>` logo with dark/light SVG variants, one-liner, tagline blockquote, badges, quick links | Establishes visual hierarchy and delivers the 3-second pitch |
| 2 | Rewrote one-liner | From two technical paragraphs to "From local experiment to installable, trustworthy skill — in one command." | Value proposition answers "why should I care?" instead of describing implementation |
| 3 | Added "The Problem" | Ecosystem stats (88K+ skills, 26% with vulnerabilities) + two bold-lead audience segments (pre-publish, post-publish) + gap statement | Lets both audiences self-select into the relevant pain point |
| 4 | Converted Features paragraph to benefit-oriented list | Single prose paragraph → 10 user-facing capability bullets; most innovative capabilities first | Features comprehensively cover capability surface; mechanism moved out |
| 5 | Added Quick Start | New section: `npx skills add` + 4 trigger phrases with result descriptions | Fastest path to working example; was entirely missing |
| 6 | Added "When to Load" table | 4 scenarios mapping to yes/no + closing positioning sentence | Explicit activation guidance: post-authoring, not while writing |
| 7 | Reordered sections | Install moved after Quick Start and Usage; was previously the second section | "Understand before commit" — reader should know what it does first |
| 8 | Added example with provenance label | Sample flow under When to Load with "sample flow, not a transcript" label | Example provenance rule: unverified examples must be labeled |
| 9 | Restructured Install | Prerequisites and Dependencies as `###` sub-sections under Install | Groups related info where users encounter it during installation |
| 10 | Replaced Related Skills with Dependencies table | Informal bullet list → structured table with purpose column + "Installed automatically by setup.sh" | Concrete, declared dependencies matching SKILL.md |
| 11 | Moved deep content to docs/ | Skill Composition → Skill Philosophy with teaser + `docs/skill-philosophy.md` | Non-decision content passes the Checkout Test correctly; scrolling provides progressive disclosure |
| 12 | Removed Project Structure | Open H2 with tree deleted | Fails Checkout Test — post-decision contributor info. Available via repo browsing |
| 13 | Added badges, footer, Contributing | License, Version, Agent Skills badges; dual footer; Contributing section | Trust signals and completeness requirements |
| 14 | Added token cost transparency | "Review ~10-25K | Create ~15-30K | Push ~1-2K" | Sets expectations for AI agent resource consumption |
| 15 | Added GitHub metadata | `.github/repo-meta.yml` with description + topics | Repository discoverability on GitHub |

---

## Quality Checklist Results

### Before Score: skill-forge-raw.md

**Structure (3 / 7)**

| # | Criterion | Pass? | Reason |
|---|-----------|-------|--------|
| 1 | Tier 1 elements present above first heading | No | No logo, no badges, no quick links, no centered layout |
| 2 | Tier 1 is compact | No | No Tier 1 exists; two paragraphs sit where the pitch should be |
| 3 | Tier 2 sections: Why + Quick Start + Install | No | No Why section, no Quick Start |
| 4 | No `<details>` used | Yes | None used |
| 5 | Checkout Test sections inline | Yes | Install, License inline (the sections that exist are correctly placed) |
| 6 | Non-decision sections in docs/ with teaser | Yes | No section exceeds threshold — vacuously passes |
| 7 | No Tier 3 content in Tier 1/2 area | No | Prerequisites, Composition, Structure all sit as top-level H2 |

**Content (6 / 13)**

| # | Criterion | Pass? | Reason |
|---|-----------|-------|--------|
| 1 | One-liner is value proposition | No | Two paragraphs of technical description |
| 2 | Why describes specific pain point | No | No Why/Problem section exists |
| 3 | Quick Start (general) | N/A | Skill project — see #4 |
| 4 | Quick Start (skill): distinct operations | No | No Quick Start section |
| 5 | Install covers primary package manager | Yes | `npx skills add` is shown |
| 6 | Features list benefit-oriented | No | Single paragraph describing five pipeline stages |
| 7 | Features comprehensive (skill) | No | Many capabilities (security, onboarding, registration, project audit) not mentioned |
| 8 | Features comprehensive (general) | N/A | Skill project — see #7 |
| 9 | How It Works in Tier 3 | No | No tier separation; mechanism and capabilities mixed in one paragraph |
| 10 | Example labeled as sample flow | No | Presented without provenance label |
| 11 | No section exceeds one screen | Yes | Sections are short enough individually |
| 12 | Non-decision content in docs/ with teaser | Yes | No section long enough to require moving |
| 13 | Teaser links substantive | N/A | No teaser links (none needed) |

**Formatting (6 / 10)**

| # | Criterion | Pass? | Reason |
|---|-----------|-------|--------|
| 1 | Logo uses `<picture>` element | No | No logo |
| 2 | Wordmark reads as single header line | N/A | No wordmark |
| 3 | Showcase image placed correctly | N/A | Non-visual project |
| 4 | Badges on 1-2 lines, max 6 | No | No badges |
| 5 | Badge URLs reference-style | N/A | No badges |
| 6 | Code blocks specify language | No | Example block uses bare ``` with no language identifier |
| 7 | Callouts genuinely necessary | N/A | No callouts |
| 8 | No broken internal links | Yes | No internal links to break |
| 9 | Tables for structured data | No | Prerequisites listed as bullets; no tables anywhere |
| 10 | Mermaid/math/footnotes only when needed | N/A | None used |

**User Perspective (0 / 5)**

| # | Criterion | Pass? | Reason |
|---|-----------|-------|--------|
| 1 | Self-selection in 10 seconds | No | No qualifying statement; reader must infer from description |
| 2 | When to reach for it | No | No timing or activation guidance |
| 3 | Audience segmentation | No | Single generic description for all readers |
| 4 | Not-for boundary | No | No exclusions stated |
| 5 | 30-second test | No | Cannot determine target user, problem fit, or next action within 30 seconds |

**Completeness (1 / 6)**

| # | Criterion | Pass? | Reason |
|---|-----------|-------|--------|
| 1 | LICENSE referenced | Yes | "MIT — see LICENSE for details" |
| 2 | Contributing info | No | No Contributing section |
| 3 | Links resolve | No | Cannot verify; manual symlink paths are instructional, not linked |
| 4 | Usage example beyond Quick Start | No | No Quick Start; Example section is the only example |
| 5 | Skill footer present | No | No footer |
| 6 | GitHub metadata | No | No `.github/repo-meta.yml` |

**Reader Lens (0 / 4)**

| # | Criterion | Pass? | Reason |
|---|-----------|-------|--------|
| 1 | Jargon-free Tier 2 | No | No clear Tier 2; "Agent Skills standard" assumed known |
| 2 | Feature bullets pass strangers test | No | Paragraph, not bullets; benefits buried in mechanism description |
| 3 | Innovation ordering | No | No structured features list to evaluate |
| 4 | No mechanism in features | No | Features paragraph describes pipeline stages, not user outcomes |

**Total: 16 / 45** (N/A items counted as Pass; 9 items are N/A)

---

### After Score: skill-forge/README.md (v8.1)

**Structure (7 / 7)**

| # | Criterion | Pass? | Reason |
|---|-----------|-------|--------|
| 1 | Tier 1 elements present above first heading | Yes | Logo, one-liner, tagline, badges, quick links all above `---` |
| 2 | Tier 1 is compact | Yes | Logo + one-liner + tagline + badges + links within ~250px |
| 3 | Tier 2 sections: Why + Quick Start + Install | Yes | The Problem, What Skill Forge Does, When to Load, Quick Start, Usage, Install all present |
| 4 | No `<details>` used | Yes | Zero `<details>` in the entire README |
| 5 | Checkout Test sections inline | Yes | All decision-making sections inline |
| 6 | Non-decision sections in docs/ with teaser | Yes | Skill Philosophy → `docs/skill-philosophy.md` with substantive teaser |
| 7 | No Tier 3 content in Tier 1/2 area | Yes | Prerequisites and Dependencies are short `###` sub-sections under Install; Skill Philosophy at bottom with teaser |

**Content (13 / 13)**

| # | Criterion | Pass? | Reason |
|---|-----------|-------|--------|
| 1 | One-liner is value proposition | Yes | "From local experiment to installable, trustworthy skill — in one command." |
| 2 | Why describes specific pain point | Yes | Ecosystem stats + two audience segments addressing pre-publish and post-publish pain |
| 3 | Quick Start (general) | N/A | Skill project |
| 4 | Quick Start (skill): distinct operations | Yes | 4 distinct operations: review, create, audit, publish — each with result description |
| 5 | Install covers primary package manager | Yes | `npx skills add` as primary |
| 6 | Features list benefit-oriented | Yes | 10 user-facing capabilities; most innovative first |
| 7 | Features comprehensive (skill) | Yes | All major capability areas represented: project audit, EP structuring, security scanning, file review, structure validation, README honesty, registration conflicts, dependency automation, cross-platform publishing, onboarding |
| 8 | Features comprehensive (general) | N/A | Skill project |
| 9 | How It Works in Tier 3 | Yes | Skill Philosophy with teaser at bottom — not mixed into Features |
| 10 | Example labeled as sample flow | Yes | "This is a sample flow, not a transcript from one specific machine." |
| 11 | No section exceeds one screen | Yes | All sections fit within one screen |
| 12 | Non-decision content in docs/ with teaser | Yes | Skill Philosophy in `docs/` with teaser |
| 13 | Teaser links substantive | Yes | "Vision, quality dimensions, and technical route" |

**Formatting (10 / 10)**

| # | Criterion | Pass? | Reason |
|---|-----------|-------|--------|
| 1 | Logo uses `<picture>` element | Yes | Dark/light SVG with `<picture>` wrapper from `.github/` |
| 2 | Wordmark reads as single header line | Yes | 480px wordmark, no duplicate `<h1>` |
| 3 | Showcase image placed correctly | N/A | Non-visual project |
| 4 | Badges on 1-2 lines, max 6 | Yes | 3 badges on 1 line |
| 5 | Badge URLs reference-style | Yes | All badge links defined at bottom of file |
| 6 | Code blocks specify language | Yes | `bash` and `text` used appropriately |
| 7 | Callouts genuinely necessary | Yes | Blockquote tagline serves as concise positioning statement |
| 8 | No broken internal links | Yes | All anchor links match actual headings |
| 9 | Tables for structured data | Yes | When to Load and Dependencies both use tables |
| 10 | Mermaid/math/footnotes only when needed | N/A | None used (correct — not needed) |

**User Perspective (5 / 5)**

| # | Criterion | Pass? | Reason |
|---|-----------|-------|--------|
| 1 | Self-selection in 10 seconds | Yes | Two bold-lead segments in The Problem let both audiences self-identify |
| 2 | When to reach for it | Yes | When to Load table + "post-authoring tool" positioning |
| 3 | Audience segmentation | Yes | The Problem addresses pre-publish and post-publish segments; When to Load maps 4 scenarios |
| 4 | Not-for boundary | Yes | When to Load: "Writing a skill's content → No" |
| 5 | 30-second test | Yes | Target user from Problem, problem fit from capabilities, next action from Quick Start |

**Completeness (6 / 6)**

| # | Criterion | Pass? | Reason |
|---|-----------|-------|--------|
| 1 | LICENSE referenced | Yes | `[MIT](LICENSE)` |
| 2 | Contributing info | Yes | Dedicated Contributing section with GitHub link |
| 3 | Links resolve | Yes | `npx skills add` primary path; manual method documented |
| 4 | Usage example beyond Quick Start | Yes | 6 trigger phrases in Usage + detailed sample flow |
| 5 | Skill footer present | Yes | "Forged with Skill Forge · Crafted with Readme Craft" |
| 6 | GitHub metadata | Yes | `.github/repo-meta.yml` with description + topics |

**Reader Lens (4 / 4)**

| # | Criterion | Pass? | Reason |
|---|-----------|-------|--------|
| 1 | Jargon-free Tier 2 | Yes | All terms are common developer vocabulary ("API keys", "CI/CD", "symlinks") |
| 2 | Feature bullets pass strangers test | Yes | Benefits lead each bullet; a stranger immediately understands what they get |
| 3 | Innovation ordering | Yes | "Audits entire projects" and "Makes workflow skills get followed" lead — unique capabilities first |
| 4 | No mechanism in features | Yes | All bullets describe user outcomes, not internal architecture |

**Total: 45 / 45**

---

## Score Comparison

| Dimension | Before | After | Delta |
|-----------|--------|-------|-------|
| Structure (7) | 3 | 7 | +4 |
| Content (13) | 6 | 13 | +7 |
| Formatting (10) | 6 | 10 | +4 |
| User Perspective (5) | 0 | 5 | +5 |
| Completeness (6) | 1 | 6 | +5 |
| Reader Lens (4) | 0 | 4 | +4 |
| **Total (45)** | **16** | **45** | **+29** |

Note: The Before score (16/45) includes 9 N/A items that pass vacuously — checks that don't apply because the raw README doesn't use the features being checked (no badges → badge format check is N/A). The genuine pass count is 7/36 applicable items (19%).

---

## Key Observations

1. **The biggest structural gap was the absence of Tier 1.** The raw README had no visual entry point — no logo, no badges, no centered layout, no quick links. Adding a proper above-the-fold block accounts for the majority of the perceived quality improvement, even though it represents a small portion of the total line count.

2. **Features as internal mechanism is a common anti-pattern.** The raw version described five pipeline stages in a single paragraph — mechanism, not capabilities. The v8.1 version lists 10 user-facing capabilities as benefits, with the most innovative (project-wide auditing, EP structuring for workflow skills) leading the list. Pipeline stages and philosophy moved to Tier 3 with a teaser linking to `docs/`.

3. **Section ordering matters more than section presence.** The raw README had Install as the second section, before the reader understood what the project does or why they would want it. Moving Install after Quick Start and Usage follows the principle of "understand before commit."

4. **Audience segmentation in The Problem section is a force multiplier.** The v8.1 version addresses two distinct reader segments with bold-lead paragraphs: "If you haven't published yet" and "If you already published." This lets readers self-select into the relevant pain point instead of reading a generic description and wondering if it applies to them.

5. **"When to Load" as a table solves the activation problem.** Many skills and tools struggle to communicate when the reader should reach for them. A simple table mapping scenarios to yes/no answers is faster to parse than prose and doubles as a not-for boundary (writing content → No).

6. **Non-decision content belongs below the scan zone.** Pipeline stages, manual registration, project structure, and positioning are all post-decision content that committed users need but evaluating visitors don't. The v8.1 README moves deep content to `docs/` with substantive teaser links, keeps short sub-sections (Prerequisites, Dependencies) inline where contextually relevant, and removes content that fails the Checkout Test entirely (Project Structure). Scrolling provides natural progressive disclosure.

7. **Small details compound.** Example provenance labels, version badges, contributing sections, and the dual footer — none dramatic alone, but together they shift the README from "project notes" to "published artifact."

8. **Token cost transparency builds trust.** Stating resource consumption upfront ("Review ~10-25K tokens") is unusual for tool READMEs but directly addresses a pain point for AI agent users — unexpected token costs.

9. **Reader Lens catches what structural checks miss.** The raw README's Features paragraph would pass a basic "does Features exist?" check. Reader Lens dimension catches the deeper problem: a stranger reading the paragraph gets pipeline stages, not user benefits. This dimension only works when evaluated as a first-time visitor, not as the person who just wrote the content.
