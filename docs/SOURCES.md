# Tool reference

The browser instructions defer to the installed skill and its matching workflow instead of hard-coding a CLI release. The official agent-browser discovery file was checked on 2026-09-06:

[agent-browser skill](https://github.com/vercel-labs/agent-browser/blob/main/skills/agent-browser/SKILL.md)

The upstream file points to `agent-browser skills get core` and optional `agent-browser skills get dogfood`. The package does not bundle or install this tool. Operators should provision and pin their chosen version and browser in the tested model's harness. A documented fallback is permitted when that capability is absent; compare like-for-like tool access.

The 30 application specifications and supplied domain fixtures are retained from the prior user-requested package; only execution and delivery protocol wording was changed. No benchmark outcome is claimed for any model by this package.
