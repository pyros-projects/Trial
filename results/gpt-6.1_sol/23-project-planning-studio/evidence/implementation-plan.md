# Project Planning Studio implementation plan

Goal: deliver the full user-specified planner in one self-contained index.html, validated through actual browser workflows.
Architecture: pure bounded calendar/validation/scheduler/CPM functions feed one in-memory source model. Atomic mutations validate and schedule a clone before changing source or history. All views render the same result and stable selected task ID.
Tech stack: embedded HTML, CSS, JavaScript, SVG; no runtime dependencies or storage.
Spec: the complete Project Planning Studio requirements and PLAN-01 through PLAN-07 in the user request.

Global constraints: working-day offsets 0–2600, dates 2000–2099, duration 0–260, priority 0–9999, resource capacity 1–4, safe integers, inert imported text, opaque-origin compatibility. Publish limits of 200 tasks, 32 resources, 64-character IDs, 200-character names, and 2 MiB imports.

- [x] 1. Pure model: write failing Node tests, then implement civil calendar arithmetic, whole-model validation, deterministic serial gap search, dependency-only CPM, and derived-date bounds. All 11 model tests pass.
- [x] 2. Connected workspace: task table, Gantt with working-day/weekend axis and dependency links, selectable occupancy slots, inspector and explanations. Atomic editing/creation/deletion/resource controls, history, drag preview/cancel, project settings are exercised in the browser.
- [x] 3. Files: JSON picker/text import, documented v1 format, current-model JSON/CSV/complete SVG downloads. Empty states, responsive navigation and clear errors are implemented and exercised.
- [x] 4. Browser validation: used agent-browser 0.31.1 core and dogfood workflows. All seven public checks pass, with desktop/mobile, direct-file, external blocking and opaque iframe evidence. Observed failures were repaired and their flows retested.
- [x] 5. Final verification and review: fresh independent final review, red/green checks for findings, rendered SVG bounds checks, source dependency audit, diagnostics and final validation report.

Review focus: normalized dates near 2099, horizon rejection without history mutation, import of HTML-like names, selection/focus continuity through responsive rerenders, pointer drag preview and Escape without commit.

Ruling: the explicit one-run user workflow authorizes implementation without further design approval pauses. This fresh supplied directory is not a Git repository; deliver in place and keep evidence rather than creating a separate checkout or commits.

Progress ledger: pure tests started red before implementation. The connected UI was then built incrementally and tested on the delivered file. Browser failures led to fixes for dialog scrolling, form ID shadowing, calendar padding and sandboxed form handling. Final review found SVG bounds and keyboard-focus issues; both were reproduced and fixed. Rendered export inspection additionally found a repeated long milestone label overflowing its canvas; the export now keeps the complete name in its label column. Details and retest logs are in validation.md. No deferred functional review items remain.

Final rulings: explicit downloads retain user work, with memory-only source/history/view state. Serial scheduling is bounded rather than globally optimized, as requested. Limits are published in the Quick guide and Files format documentation. agent-browser remains the interaction tool; child CDP observation and download events supplement its iframe limitations. No runtime dependency, permission expansion, external service or browser storage was introduced.
