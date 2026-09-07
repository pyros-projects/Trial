# Skill Forge

Skill Forge is an AI agent skill that automates the process of publishing AI skills to GitHub. It takes a skill idea or an existing project-local skill and handles the entire pipeline from creating SKILL.md to pushing a ready-to-install repo.

It is compatible with the [Agent Skills](https://agentskills.io) standard and works with Claude Code, Codex, Cursor, Windsurf, GitHub Copilot, and other adopters.

## Installation

```bash
npx skills add motiful/skill-forge
```

Or clone manually:

```bash
git clone https://github.com/motiful/skill-forge ~/skills/skill-forge

# Claude Code
ln -sfn ~/skills/skill-forge ~/.claude/skills/skill-forge

# Codex
ln -sfn ~/skills/skill-forge ~/.agents/skills/skill-forge

# VS Code / GitHub Copilot
ln -sfn ~/skills/skill-forge ~/.copilot/skills/skill-forge

# Cursor
ln -sfn ~/skills/skill-forge ~/.cursor/skills/skill-forge

# Windsurf
ln -sfn ~/skills/skill-forge ~/.codeium/windsurf/skills/skill-forge
```

## Features

Skill Forge provides a complete publishing pipeline with five stages. The Config stage sets up your skill root directory and detects your GitHub organization and preferences. The Gather stage auto-detects existing skill content from your project and conversation context. The Create stage writes SKILL.md following the Agent Skills standard. The Validate stage checks structure, frontmatter, and content quality. Finally, the Publish stage pushes everything to GitHub and connects it to the tools on your machine.

The result is a standalone repository that anyone can install with one command.

## Usage

You can trigger Skill Forge by saying any of the following to your AI coding assistant:

- "Create a skill for X and publish it"
- "Publish this skill to GitHub"
- "Forge a skill from my notes"
- "Turn this project-local skill into a repo"

## Example

Here is an example of what a typical publishing flow looks like:

```
$ "Publish self-review to GitHub"

Step 0: Config
  ✓ skill_root: ~/skills/, github_org: motiful

Step 1: Gather
  ✓ Existing skill detected at ~/skills/self-review/SKILL.md

Step 2: Create
  ✓ SKILL.md already exists — using as-is

Step 3: Validate
  ✓ name: self-review
  ✓ description: single-line, 133 chars
  ✓ body: 226 lines

Step 4: Publish
  ✓ git init + initial commit
  ✓ gh repo create motiful/self-review --public --source=. --push
  ✓ Published — install with: npx skills add motiful/self-review
```

## Prerequisites

You will need the following tools installed on your system:

- Git (required for version control)
- Node.js (required for `npx skills add`)
- GitHub CLI (`gh`) — recommended for one-command publishing, but you can also set up the remote manually if you prefer

## Skill Composition

Most users won't need this, but Skill Forge supports advanced composition patterns. You can publish a single skill, mention companion skills that strengthen specific steps, or bundle multiple skills into a Kit when they need to be delivered as one workflow. Collections are available when several skills are locked into one repo.

## Related Skills

- [motiful/rules-as-skills](https://github.com/motiful/rules-as-skills) — Helps when the skill you're forging needs portable MUST/NEVER constraints.
- [motiful/readme-craft](https://github.com/motiful/readme-craft) — Strengthens README writing and review during the publish step.

Skill Forge works fully on its own without these.

## Project Structure

```
SKILL.md
references/
├── skill-format.md
├── publishing-strategy.md
├── skill-composition.md
├── platform-registry.md
├── readme-quality.md
├── onboarding-pattern.md
├── state-management.md
├── rule-skill-pattern.md
└── templates.md
```

## License

MIT — see [LICENSE](LICENSE) for details.
