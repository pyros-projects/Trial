# How readme-craft Works

## Three Operation Modes

**Mode A: Create from Scratch** — User describes a project without code. The skill collects project info (name, description, features, license), selects a template, and produces a 3-tier README.

**Mode B: Create from Codebase** — Scans the project for package configs, entry points, CI config, and existing docs. Synthesizes findings into a complete README using the detected ecosystem.

**Mode C: Improve Existing** — Evaluates an existing README against the 3-tier strategy and 45-point quality checklist. Produces a numbered improvement plan, then applies changes while preserving the author's voice.

## The 3-Tier Layout Strategy

The core differentiator. Every README organizes content by how visitors consume information:

- **Tier 1 (~250px):** The storefront window — logo, name, value proposition, trust badges, quick links. Visitors who aren't interested leave here.
- **Tier 2 (2-3 screens):** The product demo — problem statement, features, quick start, install, usage. Proves the project is worth adopting.
- **Tier 3 (supporting content):** Deep reference — teasers linking to `docs/` for post-decision content like architecture, config reference, and dev guides. Position at the bottom provides natural progressive disclosure through scrolling.

### The Checkout Test

Every section is placed using the Checkout Test: if this section disappeared, would a potential user be less likely to `git clone` or `npm install`?

- **Yes** → inline in README (feasibility gates, value proposition, trust signals)
- **No** → teaser + `docs/` link (post-decision content)

## GitHub-Native Formatting

readme-craft treats GitHub formatting as part of the README architecture, not as decoration:

- Use teaser + `docs/` links for post-decision content that exceeds ~15 lines.
- Use relative links when the README needs to reference `docs/` or sibling markdown files.
- Use Mermaid, math, or footnotes only when they explain faster than plain prose.
- Keep social proof optional. Stars, contributors, and popularity signals should be deliberate, not default.
- No `<details>`. If content is worth including, show it. If it's too long, move it to `docs/`.
