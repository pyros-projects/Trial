# Real Apps operator guide

## Scope and delivery

Every Real Apps submission includes a second target: `project/gallery/index.html`, a generated static demo with all mutable state in memory. It uses the full app's interface and domain rules with explicitly simulated storage, transport, actors, or devices where needed. See the [gallery delivery contract](GALLERY_DEMOS.md) for the exact requirements and validation boundary. Retain this generated file when preparing a submission; it is the only project artifact published on Netlify.

Tasks 21–30 are multi-file applications with explicit domain invariants. Every task has one complete `prompt.md`, six public scenarios and portable fixtures. The model builds and tests throughout the same run, delivering `project/` and a sibling `evidence/` directory. The required `benchmark.json` describes concrete setup/start/test/reset commands; the gallery displays it but never executes it.

## Runtime and data

Use the declared Python 3.11+ and/or Node.js 22+ runtime. Install declared dependencies explicitly, then run without external internet dependencies. Let loopback HTTP reach the local backend and permitted companion service. The offline notebook separately requires actual disconnection from its backend during its offline tests.

PORT defaults to 8811, HOST to 127.0.0.1, and DATA_DIR owns all mutable business data. If running several independent apps, use separated port ranges such as 8811 and 8821, leaving room for any companion service at PORT+1 or explicit SERVICE_PORT. Use one disjoint DATA_DIR per independent run, outside source snapshots and served results. A normal restart must preserve that directory; reset is explicit and only performed with the app stopped.

For independent users/devices, use genuinely separate browser contexts rather than merely two same-origin tabs. A preview iframe may not reproduce top-level authentication or offline conditions. Open and test the app in a dedicated context for those scenarios. Embedding failure is not automatically an application failure.

## Source hashing and download

project/ is a source snapshot, not a static website. The gallery enumerates at most 6,000 files and 64 MiB of authored source. It excludes symlinks, common dependency directories, generated data, databases, logs and common .env secret names. See gallery/projects.py for the exact rules. Project ZIP inputs are copied unchanged and never automatically extracted; those exclusions do not sanitize arbitrary ZIP contents.

The displayed project hash uses frontier-source-v1: SHA-256 of that version followed by NUL, then each sorted POSIX relative path with an unsigned big-endian 64-bit path-byte length, path bytes, unsigned big-endian 64-bit file-byte length and file content. Timestamps are ignored. HTML and submitted ZIP hashes are ordinary SHA-256 of file bytes. Use the displayed digest when binding evaluator reports.

Do not treat this filter as a comprehensive secret scanner or as a runnable deployment snapshot. Dependencies are installed using the delivered manifest/README after review. Downloads omit generated build outputs; genuine source, migrations, tests and lockfiles should remain. A model that never starts still has an inspectable failing submission; do not manually repair it before its independent evaluation.

## Reporting

metadata.json optionally contains a singular score, preview_url, parameters, environment and metrics. report.json holds evaluator observations. A declared report hash that differs from the current source marks the score stale; a missing hash is shown as unbound. Agent-written evidence stays separate. There is no automatic domain grader or claim that checks passed because a score was supplied.

Evaluator-only variations live outside the agent workspace. Compare models on matched task coverage, budgets, actual tool access and the same rubric. See EVALUATION.md and schema/report.schema.json.
