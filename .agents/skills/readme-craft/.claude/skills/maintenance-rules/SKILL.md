---
name: maintenance-rules
description: 'Maintenance rules for readme-craft. MUST keep quality checklist item count consistent across SKILL.md, README, and case study. MUST regenerate docs/ images when referenced content changes. MUST keep templates aligned with current methodology. MUST keep SKILL.md under 500 lines. Triggers on "update readme-craft", "maintain readme-craft", "check readme-craft consistency".'
metadata:
  author: motiful
---

# readme-craft Maintenance Rules

Constraints and procedures for maintaining the readme-craft repository.

## Execution Procedure

```
maintain(trigger) → updated | no_change

if change proposed:
    run Decision Test (constraints below) → accept | reject
    verify all Constraints (MUST/NEVER)
    run Consistency Checks
    update Changelog (max 5, trim oldest)
```

## Constraints

- MUST NOT push SKILL.md body over 500 lines (currently 487)
- MUST keep quality checklist item count consistent across: SKILL.md body, `references/quality-checklist.md`, README features, `docs/case-study-skill-forge.md` scoring tables. When checklist changes, update all four
- MUST regenerate `docs/` images when the content they illustrate changes. Specifically: `docs/skill-forge-comparison.png` must match `docs/case-study-skill-forge.md` — regenerate via `node scripts/generate-comparison.mjs` when the case study's Before or After source changes
- MUST use the After markdown from its original repo location when generating comparison screenshots — `resolveLocalPaths` resolves `src`/`srcset` relative to the markdown file's directory. Copying to `/tmp/` breaks image resolution (e.g., `.github/logo-dark.svg` becomes `/tmp/.github/logo-dark.svg`). Correct: `--after /path/to/original/repo/README.md`
- MUST keep templates (`assets/universal-readme.md`, `assets/skill-readme.md`) aligned with current methodology. When SKILL.md rules change (e.g., section ordering, `<details>` policy, Checkout Test criteria), update templates to match
- MUST keep SKILL.md ↔ README ↔ references terminology consistent
- MUST add References table entry when adding new reference files
- MUST verify reference files with >100 lines have a TOC
- NEVER let `docs/` case studies praise or recommend patterns that SKILL.md forbids

## Consistency Checks

- Quality checklist dimensions and item counts match across all references
- SKILL.md EP step numbers are sequential and complete
- All SKILL.md reference file pointers resolve to existing files
- `docs/logo-gallery.md` references SVGs that exist in `examples/logos/`
- `examples/logos/manifest.json` uses relative paths, not absolute
- `.github/repo-meta.yml` description aligns with README one-liner

## Update Triggers

| Event | What to check |
|-------|--------------|
| Quality checklist changes (add/remove/reorder items) | SKILL.md body, README features, case study scoring tables, references/quality-checklist.md |
| Methodology change (layout rules, formatting policy) | Templates in `assets/`, case study, docs/how-it-works.md |
| Logo engine changes (presets, palettes, CLI flags) | references/logo-generation.md, references/logo-examples.md, docs/logo-gallery.md, package.json scripts |
| Case study Before or After source changes | Regenerate docs/skill-forge-comparison.png |
| New reference file added | SKILL.md References table, TOC if >100 lines |
| Badge ecosystem changes | references/badges.md |

## Changelog (max 5 entries)

- 2026-03-26: **Initial creation.** Triggered by self-review finding: case study praised `<details>` (forbidden by SKILL.md), comparison image showed stale methodology, quality checklist count inconsistency across files. All three caused by missing maintenance-rules enforcement.
