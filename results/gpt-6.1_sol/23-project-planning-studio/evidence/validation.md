# Project Planning Studio validation

Agent-authored evidence for the delivered [index.html](../index.html). No evaluator score is claimed. The application is one self-contained file. This directory contains development tools and genuine validation evidence, with no runtime dependencies.

## Environment and method

Used agent-browser 0.31.1 and Google Chrome 143.0.7499.40 on Linux. Read `.agents/skills/agent-browser/SKILL.md`, the CLI's version-matched core workflow (`agent-browser skills get core` and `core --full`), exploratory workflow (`skills get dogfood`) and issue taxonomy. [Full core guide](logs/agent-browser-core-full.txt). No browser-tool substitution was needed.

Real browser interactions used accessible names/labels or fresh accessibility refs, clicks, pointer down/move/up, scrolling, focus, typing, Enter, Tab, Escape and viewport changes. Evaluation observes live source, schedule, CPM, history, selection and geometry. It does not mutate application source or simulate edits. The iframe CDP adapter additionally installs test-environment restrictions and performs a deliberately blocked network probe. Exports are actual browser-generated downloads.

[browser-commands.log](logs/browser-commands.log) records exact commands, outputs and exit statuses, including failed attempts. [browser-results.json](logs/browser-results.json) records the agent's latest observed statuses, not an evaluator report. Earlier failures remain in individual logs. Screenshots are genuine browser captures.

The supplied workspace was not a Git repository; work was delivered in place. The user's explicit one-run instruction authorized implementation and routine fixes without design-approval pauses. [implementation-plan.md](implementation-plan.md) records architecture, progress and rulings.

## Reproduction commands

From the project directory:

```bash
node evidence/model-tests.cjs
node evidence/artifact-audit.cjs
python3 evidence/test-servers.py
```

Keep the server running in another terminal. It records dynamic localhost app/proxy ports in `logs/test-servers.json`. Then:

```bash
python3 evidence/setup-browsers.py
```

This opens a direct-file session with HTTP(S) requests aborted and a separate fresh opaque-iframe session through the external-denying proxy. It prints the actual CDP URL and records `logs/opaque-current-cdp.txt`. Keep these diagnostic processes running, replacing CDP_URL and DOWNLOAD_DIRECTORY with that URL and the absolute evidence/downloads directory:

```bash
node evidence/iframe-monitor.mjs CDP_URL evidence/logs/opaque-diagnostics.jsonl
node evidence/download-watcher.mjs CDP_URL DOWNLOAD_DIRECTORY evidence/logs/opaque-download-events.jsonl
```

Run the flows sequentially:

```bash
python3 evidence/browser-checks.py first
python3 evidence/browser-checks.py second
python3 evidence/browser-checks.py mobile
python3 evidence/opaque-checks.py
python3 evidence/review-checks.py
python3 evidence/additional-checks.py
python3 evidence/edge-checks.py
python3 evidence/final-observations.py
```

Each numbered check starts from the application's Reset. Additional/review flows generate the SVGs inspected by final-observations.py. Direct-file session is `planner`, application tab t1; iframe session is `planner-opaque`. The command log preserves concrete URLs, refs, coordinates and ports from the actual run. Do not reuse an expired CDP URL.

## Public outcomes

| Check | Status | Actual observed result and evidence |
| --- | --- | --- |
| PLAN-01 | Pass | Table, Gantt, occupancy slots and inspector share T3 selection. Actual intervals T1 [0,2), T2 [2,5), T3 [5,7), T4 [7,8), T5 [8,8); completion boundary 8 = September 17. T2 last working date September 11 and exclusive finish September 14 appear in inspector and CSV. R1 never exceeds 1/1. [Gantt](screenshots/plan01-gantt.png), [resources](screenshots/plan01-resources.png), [table](logs/plan01-tasks.txt), [CSV](downloads/seed.csv). |
| PLAN-02 | Pass | Dependency-only completion 6; floats T1/T2/T4/T5=0, T3=1. Critical toggle highlights zero-float tasks with resource waiting distinct. R1 capacity 2 gives T1 [0,2), T2 [2,5), T3 [2,4), T4 [5,6), T5 [6,6); actual completion 6, CPM unchanged. One Undo restores capacity and all actual intervals. [Critical](screenshots/plan02-critical.png), [capacity](screenshots/plan02-capacity-two.png). |
| PLAN-03 | Pass | Inline T1 duration 3 propagates to [0,3), [3,6), [6,8), [8,9), [9,9); dependency completion 7. Undo and Redo restore source duration and every derived value. [Changed duration](screenshots/plan03-duration.png). |
| PLAN-04 | Pass | Pointer drag requests T2 offset 5, shows recomputed preview, then stores September 14 as one edit. T2 [5,8), T3 fills [2,4), T4 [8,9), T5 [9,9), T1 unchanged. Undo restores seed. Typed Saturday September 12 visibly normalizes to Monday September 14 with the same result. Escape during another drag leaves source, schedule, CPM and both history counts unchanged. [Preview](screenshots/plan04-drag-preview.png), [normalization](screenshots/plan04-weekend-normalized.png), [constraint](logs/plan04-constraint.txt). |
| PLAN-05 | Pass | Cycle T5→T1, missing predecessor, duplicate imported T1, capacity 0, impossible February 30, duration 1000000000, priority 10000 and beyond-horizon 2037-01-01 all reject without source/schedule/CPM/history mutation. Cancel T1 deletion preserves it; explicit edge removal deletes without dangling edges; Undo restores exact source. Assigned R1 deletion rejects. Created unassigned U [0,1) and milestone M [1,1), priority 0, U→M, with original intervals unchanged. [Duplicate](screenshots/plan05-duplicate-rejected.png), [deletion](screenshots/plan05-deleted-edges.png), [creation](screenshots/plan05-created-root-milestone.png). |
| PLAN-06 | Pass | T3 priority 2, actual JSON download, reversed task array and picker import retain T2's stable-ID tie win. Edit, retained-plan import and one Undo restore pre-import source/schedule. HTML-like names stay inert; a fake imported schedule cache is ignored. Real CSV preserves commas/quotes/newlines/IDs/dates/float. Real SVG contains current tasks, dates and legend and renders successfully. Predicted extra case capacity 2 plus T3 duration 4 gives [0,2), [2,5), [2,6), [6,7), [7,7), actual/dependency completion 7. [Order](screenshots/plan06-reversed-order.png), [inert names](screenshots/plan06-inert-import.png), [general case](screenshots/plan06-additional-general-case.png), [JSON](downloads/tie-plan.json), [CSV](downloads/inert-plan.csv), [SVG](downloads/current-gantt.svg). |
| PLAN-07 | Pass | At 1280×800 and 390×844: task edits, continuous keyboard input, date Enter, drag, Undo, pan/zoom, Files/import/downloads, navigation, shared selection and resize preservation work. Direct file and required opaque iframe support main workflows. Reload returns to seed/history zero; Reset clears both stacks; downloaded JSON restores edits. Final diagnostics show no unexpected errors/failed requests. [Mobile Gantt](screenshots/plan07-mobile-gantt.png), [mobile date](screenshots/plan07-mobile-date-edit.png), [Files](screenshots/plan07-mobile-files.png), [iframe desktop](screenshots/plan07-opaque-desktop.png), [iframe mobile](screenshots/plan07-opaque-mobile-details.png). |

The final delivery regression follows the last application change: [01–04](logs/browser-delivery-plan01-04.log), [05–06](logs/browser-delivery-plan05-06.log), [mobile/direct file](logs/browser-delivery-mobile.log), [opaque iframe](logs/browser-delivery-opaque.log), [rendered exports](logs/rendered-delivery.log). All report pass.

## Additional coverage

All 11 tests executing the actual embedded scheduling core pass: [model-delivery.log](logs/model-delivery.log). Coverage includes validation, priority/ID order, gap filling, independent CPM, DST-safe working-day arithmetic, before-start dates, normalized start, calendar range, horizon, empty completion, milestone at offset 2600 and large-input bounds. [model-red.log](logs/model-red.log) preserves the initial failing state.

[Additional browser checks](logs/browser-additional-final.log) pass: atomic Clear constraint/Undo/Redo; resource drafts/application/deletion/Undo; dependency-checkbox editing; project weekend normalization; 50 tasks/eight resources (actual completion 14, dependency-only 2); 200 tasks/32 resources at capacity 4 (actual 10, dependency-only 5); all 200 bars/rows rendered; task 201 rejected with no mutation. [50-task screenshot](screenshots/additional-50-tasks-eight-resources.png).

Valid empty and milestone plans starting 2099-12-31 render, download and Undo to seed: [calendar edge log](logs/calendar-edge-final.log), [empty](screenshots/calendar-end-empty.png), [milestone](screenshots/calendar-end-milestone.png). Invalid derived dates reject in the model.

Published limits appear in Quick guide and Files format documentation: 200 tasks, 32 resources, 2 MiB JSON, 1–64-character ASCII IDs, 1–200-character names, duration 0–260, priority 0–9999, capacity 1–4, safe integers, calendar dates 2000-01-01 through 2099-12-31 and working boundaries 0–2600 inclusive.

Actual downloaded SVGs are opened in the browser. Every text element's rendered bounding box fits its root canvas after fixes: [last-date bounds](logs/rendered-review-last-date.svg.json), [long-label bounds](logs/rendered-long-labels.svg.json), [complete bounds](logs/rendered-current-gantt.svg.json). [Short SVG](screenshots/export-svg-last.png), [long names](screenshots/export-svg-long.png), [complete SVG](screenshots/export-svg-complete.png).

## Observed failures and retests

### ISSUE-001: Dialog footer overflow — fixed

Files → Download CSV → Done failed at 1280×800: Done's center lay below the dialog's visible bottom, so the dialog stayed open and blocked Reset. Reopening and clicking reproduced it. [Before](screenshots/dialog-footer-before-fix.png), [failed click](screenshots/dialog-footer-click-failure.png), [video](videos/dialog-footer-before-fix.webm), [initial log](logs/browser-first-run.log).

Cause: scrolling dialog lacked persistent header/actions. Fix: sticky header/footer. Exact download→Done flow, public 01–04 and mobile Files/downloads now pass.

### ISSUE-002: Task form ID shadowing — fixed

New task → ID U/name/priority 0 → Create task did nothing and left five source tasks; repeated click reproduced it. Diagnostics showed form.id was the input named id. [Initial log](logs/browser-second-run.log).

Cause: HTMLFormElement named-property shadowing broke routing. Fix: use getAttribute('id'). Creating U and dependent milestone M, complete PLAN-05 and PLAN-06 now pass.

### ISSUE-003: Calendar padding exceeded 2099 — fixed

A valid empty import starting 2099-12-31 was accepted, then view padding derived unsupported dates and threw. [Red log](logs/calendar-edge-red.log), [capture](screenshots/CALENDAR-EDGE-failure.png).

Cause: view padding honored horizon but not final calendar date. Fix: bound visual dates by both limits, mark unavailable resource days and allow space for offset-zero diamonds. Exact empty/milestone/export/Undo flow and regression pass in [calendar-edge-final.log](logs/calendar-edge-final.log).

### ISSUE-004: Native form submission blocked by sandbox — fixed

The seed and pointer drag worked in the required iframe, but Enter/Apply left a date unapplied. The browser security log reported native form submission blocked because allow-forms was absent. [Initial flow](logs/browser-opaque-run.log), [security events](logs/opaque-diagnostics.jsonl).

Fix: prevent native submission at button-click/input-Enter and directly invoke the shared JavaScript handler. No sandbox permission was added. Retest covers pointer drag, keyboard weekend date, task duration/priority, resource capacity, picker/text import, Undo, JSON/CSV/SVG downloads, desktop/mobile navigation, Reset and reload; all pass.

### ISSUE-005: Keyboard selection lost focus — fixed

Fresh independent final review found selection rerenders removed the focused bar/table ID/resource slot. Enter selected correctly but moved focus to body. [Red](logs/review-red.log).

Fix: preserve/restore focused ID, accessible label or task identity; mobile Details focuses name editing. Each actual Enter selection retains focus and history remains zero. [Green](logs/review-final.log), [capture](screenshots/review-keyboard-focus.png).

### ISSUE-006: Short SVG clipped legend/footer — fixed

Final review found a last-date milestone export's 426px canvas clipped fixed legend/footer positions. The regression failed before repair. [Red](logs/review-red.log).

Fix: minimum export width and complete project/task/resource label space. Fresh real download plus every rendered text bounding box pass. [Green](logs/review-final.log), [SVG](downloads/review-last-date.svg).

### ISSUE-007: Repeated long milestone label overflowed — fixed

A 200-character name and 64-character ID fit the full label column, but redundant text beside the diamond ended at x=5141 beyond canvas width 4440. Actual rendered SVG inspection caught it. [Red](logs/final-observations.log), [capture](screenshots/FINAL-RENDERED-ARTIFACTS-failure.png).

Cause: width allowed label column and timeline but the repeated milestone name was unbounded. Fix: exports keep the complete name in the column and omit the duplicate; interactive milestone/bar labels respect available space, with full source labels/tooltips retained. Fresh download, rendered bounds and final public regression pass. [Retest](logs/final-observations-retest.log), [final](logs/rendered-delivery.log).

## Browser boundaries and tool adaptations

Direct-file operation is **pass**, not blocked. The file session exercises actual edits, import/export, drag, Undo and reload. [Final requests](logs/final-direct-file-requests.txt) contain only the local document and embedded data URI; [final console](logs/final-direct-file-console.txt) is empty. HTTP(S) is aborted; no external cached asset is needed. Fresh load restores seed/history zero.

[iframe.html](iframe.html) embeds the exact file with `sandbox="allow-scripts allow-downloads"`, without allow-same-origin or allow-forms, and explicitly denies clipboard permissions. Child origin observed as null; parent.document access throws SecurityError. Native opaque restrictions plus [deny-storage.js](deny-storage.js) deny cookies, local/session storage, IndexedDB, caches, shared storage, service workers and clipboard. The launch init script reached the parent; child denial instrumentation was explicitly installed before editing. No forbidden API attempt occurred in the workflow. This does not claim child instrumentation preceded its initial script; native restrictions and source audit cover that boundary separately.

The fresh HTTP browser uses the external-denying proxy and localhost bypass. [Before-probe requests](logs/opaque-requests-before-probe.txt) contain only the local parent/application documents. A deliberately injected fetch to example.invalid fails with ERR_TUNNEL_CONNECTION_FAILED, with CONNECT→403 in [proxy log](logs/blocked-external.log). Expected probe failures are separated from app errors.

[Diagnostics](logs/opaque-diagnostics.jsonl) preserve original pre-fix form security errors and deliberate probe failures. No uncaught app exception or unexpected failure occurs in final runs. [opaque-errors.txt](logs/opaque-errors.txt) is empty. [Download events](logs/opaque-download-events.jsonl) show genuine blob:null exports reaching completed state with receivedBytes equal totalBytes. Actual [JSON](downloads/opaque-plan.json), [CSV](downloads/opaque-plan.csv), [SVG](downloads/opaque-gantt.svg) are saved.

[Final diagnostics summary](logs/final-diagnostics.json): zero uncaught application exceptions, zero unexpected error entries, one expected blocked probe error and its one failed request. All 15 agent-authored check statuses are pass. Final report links were checked to exist.

Harness/tool corrections, not hidden app changes:

- Mouse coordinates require integers, so observed geometry is rounded.
- Recording created a duplicate tab whose downloads canceled. Actual original-tab downloads worked without an app change.
- Narrow controls are revealed by normal vertical scrolling before pointer clicks.
- Iframe refs work, but agent-browser semantic find/eval may target the parent. Child edits use fresh refs or real pointer/keyboard. CDP supplements state/geometry/console observation, not source mutation.
- The iframe download command timed out although a real download began. A persistent Browser.downloadProgress watcher observes actual clicks and completed bytes; closing an ephemeral control connection reset download behavior.
- Reused request logs included an older deliberate probe and failed a pre-probe assertion. Final iframe runs clear logs and reload first; fresh loads also avoid redefinition of the test restriction flag.
- Browser sessions and long-running diagnostic processes unexpectedly restarted between batches. A subsequent run encountered about:blank, preserved in browser-final-*.log. setup-browsers.py reopened the artifact with all restrictions, restarted diagnostics and reran the full delivery checks; browser-delivery-*.log records pass results.

## Delivery state and limitations

[artifact-audit.log](logs/artifact-audit.log) confirms both embedded scripts parse and no external script/CSS assets, network calls, storage APIs, parent-page or clipboard access. Size: 95,236 bytes. SHA-256: `0482e49c7ea33afd641defffb136ea1914b750c8652bc2ada5e64fcb038b4f0e`.

All required public checks and recorded regressions pass. No unresolved functional failure or blocked required check remains. Larger inputs intentionally reject at published limits. Firefox, WebKit and physical touch hardware were **not-run**; Chrome pointer/keyboard validation includes 390×844. Scheduling is the specified bounded deterministic serial policy, with no global-optimization guarantee.
