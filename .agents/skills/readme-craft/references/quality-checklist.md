---
name: quality-checklist
description: "45-point quality checklist across 6 dimensions: Structure (7), Content (13), Formatting (10), User Perspective (5), Completeness (6), Reader Lens (4). Dimensions 1-5 are structural; dimension 6 requires first-time reader perspective."
---

# Quality Checklist

Run this checklist before delivering any README. Report failures to the user.

**Total: 45 checks** across 6 dimensions. Dimensions 1-5 are structural. Dimension 6 (Reader Lens) requires a mindset shift — re-read the README as a stranger, not as the person who just wrote it.

## Execution Procedure

```
run_quality_check(readme, project_state) → findings[]

pass_1 (structural): run dimensions 1-5, report failures, fix, re-run to confirm
pass_2 (reader lens): re-read as stranger, run dimension 6, flag comprehension issues
```

## Structure (7)

- [ ] Tier 1 elements are present and above the first `---` or `## ` heading
- [ ] Tier 1 is compact (~250px height; additional brief elements are fine as long as they don't break compactness)
- [ ] Tier 2 sections exist: at minimum "Why" (or "The Problem") + "Quick Start" (or "Usage") + "Install"
- [ ] No `<details>` used as section containers. Zero. (Section-internal variants like "Other install methods" are also not collapsed — show inline or move to `docs/`)
- [ ] All sections that pass the Checkout Test (Why, Features, Quick Start, Install primary, When to Use, Prerequisites, License) are inline — not moved to `docs/`
- [ ] Sections that fail the Checkout Test and exceed ~15 lines are in `docs/` with a substantive teaser (1-3 sentences + link), not left as walls of text in README
- [ ] No Tier 3 content is placed in the Tier 1 or Tier 2 area

## Content (13)

- [ ] One-liner is a value proposition, not a technical description
- [ ] "Why" section describes a specific pain point, not generic motivation
- [ ] **General projects**: Quick Start shows a working example in under 5 lines — typically install command + minimal code snippet or one CLI invocation
- [ ] **Skill projects** (has `SKILL.md`): Quick Start lists the distinct operations the skill provides, one line each (`"trigger phrase" — what you get`). Each line = a different outcome, not a phrasing variation of the same action. Phrasing variations belong in Usage. 1-2 lines is correct if the skill only has 1-2 real operations
- [ ] Install commands cover the primary package manager for the ecosystem
- [ ] Features list is written as user-facing capabilities ("detects leaked API keys"), not internal mechanisms ("runs regex scan on staged files"). 3-6 items for focused projects, 7-10 for feature-rich projects. Most innovative capabilities listed first. **Dedup**: if this check and the Reader Lens checks (RL3 innovation ordering, RL4 no mechanism) flag the same bullet for the same root cause, report as one issue
- [ ] **Skill projects** (has `SKILL.md`): Features comprehensively cover the skill's **pipeline capabilities** — what the tool does for users (validation checks, security scans, publishing). Use SKILL.md EP as ground truth: each distinct action the pipeline performs should appear in Features. **Do not confuse trigger phrases with capabilities** — Quick Start lists how users invoke the tool (entry modes); Features lists what the pipeline does. A unified pipeline with state-driven branching (e.g., "create" and "review" sharing the same validation/fix/publish steps) is one capability, not two. Report missing pipeline capabilities as gaps. This is a lightweight single-file comparison, not a full codebase audit
- [ ] **General projects**: Features list covers the project's major capabilities. readme-craft checks for obvious omissions based on what it already read during the scan (entry points, exports, CLI commands) — but comprehensive capability auditing is the repo maintainer's responsibility, not readme-craft's
- [ ] How It Works / internal mechanism details are in Tier 3 (below Tier 2), not mixed into Tier 2 Features. **Dedup**: if this check and the Features-language check (#5 above) both flag the same section for the same root cause, report them as one issue, not two
- [ ] Example sections are labeled as sample flows unless they come from a verified run
- [ ] No section exceeds one screen of content without splitting to `docs/` or linking
- [ ] Non-decision content that exceeds ~15 lines is in `docs/` with a teaser link, not bloating the README
- [ ] Teaser links are substantive (1-3 sentences summarizing what the reader will find), not placeholder text ("learn more", "see docs")

## Formatting (10)

- [ ] Logo: exists (generated or pre-existing) and uses `<picture>` element with dark/light mode
- [ ] Generated wordmarks read as one dominant header line; avoid stacking the project name twice unless the user asks for it
- [ ] Showcase image: present for visual-output projects, absent for non-visual projects. Placed between Tier 1 and the first Tier 2 heading
- [ ] Badges are on 1-2 lines, max 6 badges
- [ ] Badge URLs use reference-style links at bottom of file
- [ ] Code blocks specify the language for syntax highlighting
- [ ] Any callouts are genuinely necessary, not decorative formatting
- [ ] No broken internal links (anchor links match actual heading slugs)
- [ ] Tables are used for structured data (config options, prerequisites)
- [ ] Mermaid / math / footnotes are used only when they communicate faster than prose

## User Perspective (5)

- [ ] **Self-selection** — A reader can tell within 10 seconds whether they are the target user. Look for a qualifying statement: "If [your situation], this is for you." The Problem section or one-liner should let visitors self-select in or out, not just describe an abstract pain point
- [ ] **When to reach for it** — README explains what situation, workflow stage, or trigger should make a reader think of this project. If there's a timing constraint ("use after X, not during Y"), it's stated explicitly
- [ ] **Audience segmentation** — If multiple user segments exist (e.g., new users vs power users, different use cases), key sections address them distinctly rather than blending into one generic narrative
- [ ] **Not-for boundary** — README clarifies what the project is NOT for, who should look elsewhere, or what problems it deliberately does not solve. Implicit signals count: a "When to Use" table with explicit "No" rows, a Positioning section with "does not" statements, or a one-liner that inherently excludes non-target users. Only flag when none of these exist
- [ ] **30-second test** — A first-time visitor can determine within 30 seconds: (1) am I the target user, (2) does this solve my current problem, (3) what do I do next

## Completeness (6)

- [ ] LICENSE file exists and is referenced
- [ ] Contributing info exists (inline or linked CONTRIBUTING.md)
- [ ] Install, docs, and release links resolve or are clearly marked as pending
- [ ] At least one usage example beyond Quick Start
- [ ] Skill footer is present: `Crafted with [Readme Craft](...)` (prepend `Forged with [Skill Forge](...) ·` if generated through skill-forge's pipeline)
- [ ] GitHub metadata: `.github/repo-meta.yml` exists with description (≤350 chars, aligned with README one-liner) and 8-20 topics following 3-tier system (`references/github-metadata.md`)

## Reader Lens (4)

The checks above verify structure and format. These checks verify *comprehension*. Run them AFTER dimensions 1-5 pass, with a different mindset: you are a stranger who found this README from a search result. You have never heard of this project. You have 60 seconds.

- [ ] **Jargon-free Tier 2** — Read every Tier 2 sentence as a first-time visitor. Flag any term that requires reading another document, knowing the project's internals, or expanding a project-specific acronym. Common developer vocabulary is fine ("API keys", "CI/CD", "npm"). Project-internal names (capitalized patterns, custom frameworks, internal tool names) must be explained inline or replaced with plain language. The test: would a developer in the target audience understand this sentence without clicking any links?
- [ ] **Feature bullets pass the strangers test** — Cover the project name, read each feature bullet in isolation. A stranger should immediately understand what they get. If a bullet's benefit is buried after technical jargon ("generates X with Y and Z, so you get W"), the jargon barrier prevents the benefit from landing — rewrite to lead with the benefit
- [ ] **Innovation ordering** — Identify the project's 3 most unique capabilities (things no obvious competitor does). These must appear in the top half of the Features list. Table-stakes capabilities (things every similar tool has) should not lead
- [ ] **No mechanism in features** — Each Tier 2 feature bullet must describe WHAT the user gets, not HOW the tool works internally. Architecture descriptions ("two modes, one action"), pipeline stages ("discover → classify → validate"), and implementation details ("uses regex scanning") belong in Tier 3. If a bullet explains the tool's internal design rather than a user outcome, it's mechanism — move to Tier 3 or reframe as a benefit
