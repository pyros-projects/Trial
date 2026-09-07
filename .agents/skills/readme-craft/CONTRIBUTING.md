# Contributing

## Scope

This repository packages `readme-craft` as a standalone Agent Skill. Keep the public artifact focused on the skill itself:

- `SKILL.md`
- `README.md`
- `assets/`
- `references/`
- logo-generation support files such as `scripts/`, `package.json`, and curated `examples/`
- support files such as `LICENSE` and `.gitignore`

Research notes can exist during development, but they should stay out of the published artifact. In this repo, keep that material under `.claude/analysis/` or `.claude/community-skills/`.
Track private planning and release checkpoints in `.claude/progress.md`.

## Workflow

1. Update `SKILL.md` first when behavior, rules, or validation criteria change.
2. Keep `README.md` aligned with what `SKILL.md` actually instructs an agent to do.
3. Update templates when a README standard is meant to be reusable.
4. If helper scripts or runtime requirements change, update the relevant reference files and README notes in the same change.
5. Preserve honest install instructions and links. Do not point to repos, releases, or docs that are not live yet.

## Validation

Run these checks before publishing or handing the skill to someone else:

```bash
skills-ref validate /path/to/readme-craft
```

Then manually confirm:

- README examples are labeled as sample flows unless they come from a verified run
- install links, release links, and docs links resolve or are clearly marked as pending
- templates and `SKILL.md` still describe the same workflow
- core README generation and logo generation are both described honestly
- repo-local runtime requirements for logo generation are documented wherever that step appears

## Pull Requests

1. Create a feature branch.
2. Make the smallest coherent change you can.
3. Re-run validation.
4. Summarize behavior changes and any remaining manual checks in the PR.
