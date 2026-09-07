---
name: github-metadata
description: GitHub repository metadata management including About/description rules (≤350 chars, derived from README one-liner), topic selection via 3-tier system (big traffic, domain-precise, ecosystem), and .github/repo-meta.yml format specification. Works for all project types, not just skills.
---

# GitHub Metadata

Source of truth: `.github/repo-meta.yml` in the repo root.

## Execution Procedure

```
apply_metadata(repo_path) → applied | findings[]

check: .github/repo-meta.yml exists and matches template format
check: description exists, len <= 350, aligns with README one-liner
check: 8 <= topics <= 20, follow 3-tier system
assert no critical findings
report findings to user (HITL)
apply via gh repo edit
```

## `.github/repo-meta.yml` Format

```yaml
description: >
  One or two sentences. Max 350 chars.
topics:
  # Tier 1: big traffic (domain-detected)
  - javascript
  - web
  # Tier 2: domain-specific (from Deep Research)
  - form-validation
  # Tier 3: ecosystem
  - react
homepage: ""  # fill when site exists
```

## About / Description

- Max 350 characters. GitHub silently truncates beyond this.
- Format: `[What it does] for [who]. [Key differentiator].` — one or two sentences.
- **Source of truth: README one-liner.** The GitHub description must be derived from the README one-liner (Tier 1 value proposition). If they diverge, reconcile before applying.
  - For skill projects (has `SKILL.md`): also check alignment with SKILL.md `description` field.
- Value proposition, not feature list. No bullet points, no version numbers.
- Do not repeat the repo name — GitHub already displays it above the description.

## Topic Selection

3-tier system. Target 12-18 topics total. Hard max 20 (GitHub enforced).

### Tier 1: Big Traffic (3-5 tags)

High-traffic tags matching the project's primary domain. Unlike Tier 2, these are broad categories that drive discovery.

**Detection logic** — scan the project to determine domain, then apply appropriate tags:

| Domain Signal | Suggested Tags |
|--------------|----------------|
| AI/ML project (imports `anthropic`, `openai`, model files, SKILL.md) | `ai`, `llm`, `ai-agents`, `machine-learning` |
| Web frontend (React, Vue, Svelte, Next.js, etc.) | `javascript`, `typescript`, `web`, `frontend` |
| CLI tool (bin field, commander/yargs/clap) | `cli`, `command-line`, `developer-tools` |
| Backend/API (express, fastapi, gin, etc.) | `api`, `backend`, `web` |
| DevOps/infra (Terraform, Docker, k8s) | `devops`, `infrastructure`, `automation` |
| Data/analytics (pandas, spark, dbt) | `data`, `analytics`, `data-engineering` |
| Mobile (React Native, Flutter, Swift, Kotlin) | `mobile`, `ios`, `android` |

Add or remove only if the project genuinely does not fit a tag. When multiple domains apply, pick the primary 3-5.

### Tier 2: Precise Track (4-6 tags)

Domain-specific tags that match the project's actual function.

1. Search `"<domain> github topics {current_year}"` to find trending tags.
2. Check each candidate: does the topic have >500 repos on GitHub? If not, skip.
3. Present 5-8 candidates to the user for confirmation. Do not auto-select.
4. Examples for a form validation library: `form-validation`, `schema-validation`, `zod`, `type-safe`.

### Tier 3: Ecosystem / Platform (3-5 tags)

- Platform tags — only when the project actually supports that platform. Check package.json, SKILL.md compatibility, or platform-specific config.
  - For skill projects: `claude-code`, `codex`, `cursor`, `windsurf`, `github-copilot` as applicable.
  - For libraries: framework tags (`react`, `vue`, `express`) as applicable.
- Brand/tool tags (`ai-tools`, `automation`) — only when the brand IS a real discovery channel (>1000 repos on that topic on GitHub).

## Apply Workflow

```
meta = read(".github/repo-meta.yml")
assert meta.description exists and len(meta.description) <= 350
assert 8 <= len(meta.topics) <= 20
for topic in meta.topics:
    assert topic matches /^[a-z0-9][a-z0-9-]*$/   # GitHub topic format
gh repo edit <org>/<name> \
    --description "<meta.description>" \
    --homepage "<meta.homepage>" \
    $(for t in meta.topics: --add-topic "$t")
```

If `.github/repo-meta.yml` does not exist, create it interactively:
1. Draft description from README one-liner, trimmed to 350 chars. For skill projects, also cross-check SKILL.md `description`.
2. Apply Tier 1 tags based on domain detection. Research and propose Tier 2 candidates. Detect Tier 3 from ecosystem signals.
3. Write the file, commit, then proceed with apply.
