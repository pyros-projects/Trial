# Universal README Template

> This template works for any open source project — library, CLI, app, framework.
> Replace all `<placeholders>` and remove this instruction block before publishing.
> Delete sections that don't apply. Use the Checkout Test to decide placement:
> passes (removal reduces clone likelihood) → inline; fails → teaser + `docs/` link.

---

<!-- ============================================================ -->
<!-- TIER 1: ABOVE THE FOLD — Your 3-second pitch                 -->
<!-- ============================================================ -->

<!-- Logo: dark/light mode support via <picture> element -->
<div align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="<assets/logo-dark.svg>">
    <source media="(prefers-color-scheme: light)" srcset="<assets/logo-light.svg>">
    <img alt="<project-name>" src="<assets/logo-light.svg>" width="120">
  </picture>

  <!-- If a generated wordmark already spells the project name clearly, prefer a visually single-line Tier 1 and omit the separate <h1> instead of stacking the name twice. -->
  <h1><project-name></h1>
  <p><one-line description — what it does and why it matters></p>
</div>

<!-- Badges: pick the most relevant 4-6. Less is more. -->
<div align="center">

[![License: <license>][license-shield]][license-url]
[![Version][version-shield]][version-url]
[![Build][build-shield]][build-url]
[![Downloads][downloads-shield]][downloads-url]

</div>

<!-- Optional social proof for public repositories with real numbers only.
Add only if the project benefits from it and the user wants it.

[![GitHub stars][stars-shield]][stars-url]
[![Contributors][contributors-shield]][contributors-url]
-->

<!-- Quick action links -->
<div align="center">
  <a href="#quick-start">Quick Start</a> &middot;
  <a href="<docs-url>">Documentation</a> &middot;
  <a href="<demo-url>">Demo</a> &middot;
  <a href="https://github.com/<org>/<repo>/issues/new?labels=bug">Report Bug</a>
</div>

<br>

<!-- Optional: screenshot or GIF demo -->
<!-- <div align="center">
  <img src="<assets/demo.gif>" alt="Demo" width="600">
</div> -->

---

<!-- ============================================================ -->
<!-- TIER 2: SCAN QUICKLY — Prove value to interested visitors     -->
<!-- ============================================================ -->

## Why <project-name>?

<2-4 sentences describing the problem. Be specific about the pain point. What's broken or missing without this project?>

## Features

- <capability 1 — what the user gets, not how it works internally>
- <capability 2>
- <capability 3>
- <capability 4>

<!-- Write each feature as a user-facing capability.
✓ "Detects leaked API keys before you push"
✗ "Runs regex patterns against staged file diffs"
If you find yourself describing internal steps or pipeline stages, move that to How It Works in Tier 3. -->

## Architecture At A Glance

<!-- Delete this section if a diagram would not explain faster than prose. -->

```mermaid
flowchart TD
  <entry-point> --> <core-module>
  <core-module> --> <integration-or-api>
  <integration-or-api> --> <storage-or-output>
```

## Quick Start

```bash
<the fastest way to install and run — ideally 1-3 commands>
```

```<language>
<minimal working code example — 5-15 lines that show the core value>
```

## Install

<!-- Choose the relevant package managers for your project -->

```bash
# npm
npm install <package-name>

# yarn
yarn add <package-name>

# pnpm
pnpm add <package-name>
```

Requires <runtime> <version>+. See [Prerequisites](#prerequisites) for details.

<!-- If alternative install methods are short, show inline.
     If long, move to docs/install-alternatives.md with teaser link. -->

### From source

```bash
git clone https://github.com/<org>/<repo>.git
cd <repo>
<build-commands>
```

## Usage

### Basic

```<language>
<basic usage example>
```

### <Common Use Case>

```<language>
<example for a common use case>
```

<!-- If advanced examples are short, show inline.
     If long, move to docs/examples.md with teaser link. -->

### <Advanced Use Case>

```<language>
<advanced example>
```

## Further Reading

<!-- Delete this section if everything important fits in README.md. -->

- [Architecture](docs/architecture.md)
- [Configuration](docs/configuration.md)
- [FAQ](docs/faq.md)

<!-- Optional GitHub-native enhancement:
Add a Mermaid diagram only when architecture, flow, or sequence is clearer visually than in prose.
If the README grows too long, move deep explanations into docs/ and link them relatively. -->

---

<!-- ============================================================ -->
<!-- TIER 3: SUPPORTING CONTENT — Serve committed users            -->
<!-- Non-decision sections: teaser + docs/ link.                   -->
<!-- Short sections (< ~15 lines): keep inline.                    -->
<!-- No <details>. If it's worth including, show it.               -->
<!-- HITL: propose moves to user before executing.                 -->
<!-- ============================================================ -->

<!-- Prerequisites: helps decide ("can I run this?") → always inline -->
## Prerequisites

| Requirement | Version |
|-------------|---------|
| <runtime> | <version>+ |
| <dependency> | <version>+ |

<!-- How It Works: non-decision → teaser + docs/ if long, inline if short -->
## How It Works

<1-3 sentence summary of internal architecture or data flow.>

→ [Detailed architecture](docs/how-it-works.md)

<!-- Configuration: non-decision → teaser + docs/ if long -->
## Configuration

<1-sentence summary of what's configurable.>

→ [Configuration reference](docs/configuration.md)

<!-- Development: non-decision → teaser + docs/ if long -->
## Development

<1-sentence summary.>

→ [Development guide](docs/development.md)

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

<!-- If you don't have a separate CONTRIBUTING.md, expand this section:
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/<name>`)
3. Commit your changes
4. Push to the branch
5. Open a Pull Request
-->

## License

<license-type> — See [LICENSE](LICENSE) for details.

## Acknowledgments

- <acknowledgment 1>
- <acknowledgment 2>

<!-- Optional social proof:
Add contributor widgets, stars, or popularity badges only when the repository is public,
the numbers are real, and the project benefits from showing them. -->

<!-- Optional: back-to-top link for long READMEs -->
<!-- <p align="right"><a href="#top">back to top</a></p> -->

---

Crafted with [Readme Craft](https://github.com/motiful/readme-craft)

<!-- Reference-style link definitions (keeps source markdown clean) -->
[license-shield]: https://img.shields.io/github/license/<org>/<repo>.svg
[license-url]: https://github.com/<org>/<repo>/blob/main/LICENSE
[version-shield]: https://img.shields.io/github/v/release/<org>/<repo>
[version-url]: https://github.com/<org>/<repo>/releases
[build-shield]: https://img.shields.io/github/actions/workflow/status/<org>/<repo>/<workflow>.yml
[build-url]: https://github.com/<org>/<repo>/actions
[downloads-shield]: https://img.shields.io/npm/dm/<package-name>
[downloads-url]: https://www.npmjs.com/package/<package-name>
<!-- [stars-shield]: https://img.shields.io/github/stars/<org>/<repo>?style=social -->
<!-- [stars-url]: https://github.com/<org>/<repo>/stargazers -->
<!-- [contributors-shield]: https://img.shields.io/github/contributors/<org>/<repo>.svg -->
<!-- [contributors-url]: https://github.com/<org>/<repo>/graphs/contributors -->
