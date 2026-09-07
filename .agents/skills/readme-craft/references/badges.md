---
name: badges
description: Copy-paste badge patterns for shields.io organized by category (license, version, CI, downloads, coverage, platform, Agent Skills). Provides priority ordering and reference-style link format.
---

# Badge Reference

Copy-paste badge patterns for shields.io. Replace `<org>`, `<repo>`, `<package>` with your values.

All badges use reference-style links. Define URLs at the bottom of your README.

## Execution Procedure

```
select_badges(project) → badge_lines[]

check: ecosystem signals (package.json, Cargo.toml, pyproject.toml, CI config)
select: up to 6 badges by priority (license → version → CI → downloads → coverage → platform)
format: reference-style links at bottom of README
```

---

## TOC

- [License](#license)
- [Version / Release](#version--release)
- [Build / CI](#build--ci)
- [Downloads](#downloads)
- [Coverage](#coverage)
- [Platform / Language](#platform--language)
- [Agent Skills](#agent-skills)
- [Social / Community](#social--community)
- [Tips](#tips)

## License

| License | Badge |
|---------|-------|
| MIT | `[![License: MIT][license-shield]][license-url]` |
| Apache 2.0 | `[![License: Apache 2.0][license-shield]][license-url]` |
| GPL v3 | `[![License: GPL v3][license-shield]][license-url]` |
| BSD 3-Clause | `[![License: BSD][license-shield]][license-url]` |
| ISC | `[![License: ISC][license-shield]][license-url]` |
| CC BY 4.0 | `[![License: CC BY 4.0][license-shield]][license-url]` |
| Unlicense | `[![License: Unlicense][license-shield]][license-url]` |

```markdown
<!-- Auto-detect from GitHub -->
[license-shield]: https://img.shields.io/github/license/<org>/<repo>.svg
[license-url]: https://github.com/<org>/<repo>/blob/main/LICENSE

<!-- Or hardcode -->
[license-shield]: https://img.shields.io/badge/License-MIT-green.svg
[license-url]: LICENSE
```

---

## Version / Release

```markdown
<!-- GitHub release (latest) -->
[version-shield]: https://img.shields.io/github/v/release/<org>/<repo>
[version-url]: https://github.com/<org>/<repo>/releases

<!-- npm -->
[version-shield]: https://img.shields.io/npm/v/<package>
[version-url]: https://www.npmjs.com/package/<package>

<!-- PyPI -->
[version-shield]: https://img.shields.io/pypi/v/<package>
[version-url]: https://pypi.org/project/<package>

<!-- crates.io -->
[version-shield]: https://img.shields.io/crates/v/<crate>
[version-url]: https://crates.io/crates/<crate>

<!-- Static / manual -->
[version-shield]: https://img.shields.io/badge/version-1.0-blue.svg
[version-url]: https://github.com/<org>/<repo>/releases
```

---

## Build / CI

```markdown
<!-- GitHub Actions -->
[build-shield]: https://img.shields.io/github/actions/workflow/status/<org>/<repo>/<workflow>.yml
[build-url]: https://github.com/<org>/<repo>/actions

<!-- GitHub Actions (branch-specific) -->
[build-shield]: https://img.shields.io/github/actions/workflow/status/<org>/<repo>/<workflow>.yml?branch=main
[build-url]: https://github.com/<org>/<repo>/actions

<!-- GitHub Actions native badge (alternative) -->
[build-shield]: https://github.com/<org>/<repo>/actions/workflows/<workflow>.yml/badge.svg
[build-url]: https://github.com/<org>/<repo>/actions/workflows/<workflow>.yml
```

---

## Downloads

```markdown
<!-- npm (monthly) -->
[downloads-shield]: https://img.shields.io/npm/dm/<package>
[downloads-url]: https://www.npmjs.com/package/<package>

<!-- npm (total) -->
[downloads-shield]: https://img.shields.io/npm/dt/<package>
[downloads-url]: https://www.npmjs.com/package/<package>

<!-- PyPI (monthly) -->
[downloads-shield]: https://img.shields.io/pypi/dm/<package>
[downloads-url]: https://pypi.org/project/<package>

<!-- crates.io -->
[downloads-shield]: https://img.shields.io/crates/d/<crate>
[downloads-url]: https://crates.io/crates/<crate>

<!-- GitHub releases -->
[downloads-shield]: https://img.shields.io/github/downloads/<org>/<repo>/total
[downloads-url]: https://github.com/<org>/<repo>/releases
```

---

## Coverage

```markdown
<!-- Codecov -->
[coverage-shield]: https://img.shields.io/codecov/c/github/<org>/<repo>
[coverage-url]: https://codecov.io/gh/<org>/<repo>

<!-- Coveralls -->
[coverage-shield]: https://img.shields.io/coveralls/github/<org>/<repo>
[coverage-url]: https://coveralls.io/github/<org>/<repo>
```

---

## Platform / Language

```markdown
<!-- Node.js version -->
[node-shield]: https://img.shields.io/node/v/<package>
[node-url]: https://nodejs.org

<!-- Python version -->
[python-shield]: https://img.shields.io/pypi/pyversions/<package>
[python-url]: https://python.org

<!-- Rust edition -->
[rust-shield]: https://img.shields.io/badge/rust-2021_edition-orange?logo=rust
[rust-url]: https://www.rust-lang.org

<!-- TypeScript -->
[ts-shield]: https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white
[ts-url]: https://www.typescriptlang.org
```

---

## Agent Skills

For AI agent skills compatible with Claude Code, Codex, Cursor, Windsurf, GitHub Copilot.

```markdown
[skills-shield]: https://img.shields.io/badge/Agent%20Skills-compatible-DA7857?logo=anthropic
[skills-url]: https://agentskills.io
```

---

## Social / Community

```markdown
<!-- GitHub stars -->
[stars-shield]: https://img.shields.io/github/stars/<org>/<repo>?style=social
[stars-url]: https://github.com/<org>/<repo>/stargazers

<!-- GitHub forks -->
[forks-shield]: https://img.shields.io/github/forks/<org>/<repo>?style=social
[forks-url]: https://github.com/<org>/<repo>/network/members

<!-- GitHub issues -->
[issues-shield]: https://img.shields.io/github/issues/<org>/<repo>
[issues-url]: https://github.com/<org>/<repo>/issues

<!-- GitHub contributors -->
[contributors-shield]: https://img.shields.io/github/contributors/<org>/<repo>
[contributors-url]: https://github.com/<org>/<repo>/graphs/contributors
```

### Star History

For repos with 100+ stars. Insert as a standalone section before License, using `<picture>` for dark/light mode support.

```markdown
## Star History

<div align="center">
  <a href="https://star-history.com/#<org>/<repo>&Date">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=<org>/<repo>&type=Date&theme=dark" />
      <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=<org>/<repo>&type=Date" />
      <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=<org>/<repo>&type=Date" width="600" />
    </picture>
  </a>
</div>
```

**Trigger:** `star_count >= 100` (below that it looks sparse and counterproductive).
**Gate:** Always HITL — ask user before adding.

---

## Tips

- **Priority order:** License > Version > Build > Downloads > Coverage > Platform (pick top 4-6)
- **Style parameter:** Append `?style=flat-square` or `?style=for-the-badge` for different looks
- **Logo parameter:** Append `&logo=<name>` to add a logo icon (see [simple-icons.org](https://simpleicons.org) for names)
- **Color parameter:** Append `&color=<hex>` to customize badge color
- **Keep it clean:** Use reference-style links at the bottom of your README, not inline URLs
