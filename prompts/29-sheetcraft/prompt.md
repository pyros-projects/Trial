# Sheetcraft: Spreadsheet with a Formula Engine

## Agentic development workflow

Build the complete application in one end-to-end agentic run. You may use the filesystem, shell, dependency tools, compilers, linters, tests, documentation, browser automation, and debugging tools from the beginning, within the permissions and budget assigned by the harness. Plan, implement incrementally, execute, inspect, diagnose, and improve your work throughout development. No previous implementation is assumed. Do not stop at a proposal, scaffold, screenshot, or partially connected demo.

Use the installed browser automation skill `agent-browser` to validate your work. Read the installed skill and its version-matched core workflow before use; consult its exploratory-testing workflow when available. If this capability is genuinely unavailable, use another available real-browser automation tool, record the substitution, and state any coverage that remains blocked. Do not fabricate successful tool use or let a missing optional tool prevent useful work with the tools you do have. The evaluator records tool availability separately from implementation quality.

## Validation

Exercise the actual main workflow using browser navigation, labeled controls, pointer and keyboard input, and screenshots. Merely loading the page, inspecting source code, or observing a DOM element does not establish that a feature works. For Canvas, WebGL, audio, games, and other non-DOM state, perform real interactions and inspect both rendered output and relevant live diagnostics. Check the browser console, uncaught errors, failed requests, and meaningful application state.

Check normal desktop and narrow viewports (at least 1280 x 800 and 390 x 844), input continuity, primary controls, error states, navigation, and any required pause/reset, import/export, or persistence behavior. Reproduce observed failures, fix their cause, and repeat the failed flow plus a compact regression test after material changes. Run the task-specific checks below against genuine application behavior. Do not modify benchmark requirements, supplied fixtures, expected results, or evaluator code to make a test pass.

Keep evidence in a sibling `evidence/` directory: an agent-authored `validation.md` with the exact steps and commands, observed results, failures, relevant screenshots/logs, fixes, and retest outcomes. Use pass, fail, blocked, or not-run honestly; a blocked check is not a pass. Do not write or invent an evaluator-owned score or report. End within the assigned budget with the best working implementation and an explicit account of remaining limitations.

### Full local application delivery and runtime checks

Deliver the complete runnable project in `project/`, with `benchmark.json` and README at its root. Keep `evidence/` beside `project/`. Install the declared dependencies when permitted, generate genuine lockfiles with the actual package manager where applicable, build, start the application, and run meaningful automated tests. Do not substitute test doubles or precomputed UI outcomes for business logic.

Use a fresh run-specific `DATA_DIR` outside the source tree. Exercise browser flows against the real local backend. Supplement browser checks with actual HTTP requests, backend logs, and data inspection for concurrency, idempotency, permissions, and persistence. Use genuinely overlapping requests where specified. For independently authenticated users or devices, use separate top-level browser contexts with isolated storage. Reload after committed changes, then stop and restart the backend against the same `DATA_DIR` and verify durable state.

After dependency setup, verify operation with external internet blocked while local loopback access to the app and its declared companion service remains available. This does not mean turning off the app's own backend. Only a task explicitly requiring offline editing must also be tested disconnected from its local backend. Do not erase state to hide a persistence failure. Keep all supplied public scenario and fixture files read-only; changes to the generated application must preserve the specified behavior for other valid inputs too.

## Public gallery delivery

Deliver the complete local application **and** a generated, self-contained demo at `project/gallery/index.html`. The application requirements, runtime contract, and original acceptance scenarios below still apply to the full local application. The following exceptions apply only to the gallery build; a demo-only submission is incomplete.

Generate the demo from the delivered source using a concrete command documented in the project README. Inline all JavaScript, CSS, fonts, images, and synthetic seed fixtures into this one HTML file. Do not require sibling assets, a build on the hosting service, environment variables, credentials, a backend, a companion process, or any runtime network request. Use in-memory or hash navigation so every screen works from the same file, including under a nested URL. The gallery publishes this file only, never your server, database, functions, or deployment configuration.

Use the same interface and genuine domain rules as the full app. Share domain code where practical; otherwise test the browser implementation against the same fixtures and additional valid inputs. Replace only persistence and transport with explicit in-memory adapters. Implement actual parsing, validation, transactions, versions, history, scheduling, and other required algorithms; do not replace them with canned responses, precomputed fixture answers, or disabled primary workflows. Task-specific demo controls may simulate actors, devices, transport, and faults, but must say that they are simulations. They do not count as evidence of real backend or security guarantees.

Keep every mutable value in the current document's memory, including uploads, draft copies, history, operation keys, queues, and simulated service state. Do not use cookies, localStorage, sessionStorage, IndexedDB, Cache Storage, service workers, shared workers, or an external store. Do not call fetch, XMLHttpRequest, WebSocket, EventSource, sendBeacon, analytics, external APIs, Netlify Forms, Functions, Blobs, or a database. Do not add `netlify` or `data-netlify` form attributes. Handle forms in JavaScript without navigation. File inputs and explicit Blob downloads are allowed; imports must be bounded, validated, and atomic. Never request real credentials or personal data.

Show a small notice: **Demo changes disappear on reset or reload.** Provide a visible **Reset demo** control that restores deterministic seed state, clears uploads and pending work, and cancels timers or late responses. Reloading, reopening, or switching away from the implementation must start a fresh demo. An explicit user download is the only way to retain demo work. Do not send data to the parent gallery or depend on it for state.

Validate the generated file over static HTTP at a nested path, inside an iframe with `sandbox="allow-scripts allow-downloads"` and no `allow-same-origin`. The hosting policy blocks network connections, external resources, form submissions, and nested frames; inline scripts/styles and embedded data/Blob assets are supported. It does not allow JavaScript eval/Function or persistent storage. Exercise the main workflow, invalid input, reset during pending work, reload, and a second independently opened demo. Verify that one demo cannot change another's data and that no application network requests or storage errors occur. Include desktop and narrow viewport checks. Record full-app and gallery-demo outcomes separately in `evidence/validation.md`; never report a simulated check as a pass for its original backend acceptance scenario.

### Sheetcraft in the gallery

Keep named workbooks, typed raw inputs, versions, and undo/redo history in an in-memory repository. Provide two labeled simulated edit copies that load the same workbook version independently; saving one copy advances the repository version, and saving the other with its old expected version must conflict while retaining its edits. Preserve the actual parser, evaluated dependency tracking, lazy IF, cycle recovery, mixed-reference copying, range undo, stable sorting with formula rebasing, and bounded CSV/JSON import/export. Never use eval or precomputed cell values as the formula engine. Imports must validate before replacing the workbook and remain one undoable action.

Use the supplied workbook and additional inputs to verify calculated C1=6, C2=20, D1=26, E1=10, and F1=11. Copying F1 to F2 must produce raw formula `=$A2+B$1+$C$1` and value 13. The inactive self-reference `=IF(FALSE,G1,7)` must calculate 7, while its active counterpart reveals a recoverable cycle. The supplied ascending sort case must calculate row order r2, r3, r1, r4, r5 with the specified rebasing and blank/error ordering. Import the quoted CSV without losing its embedded newline or executing its literal `=1+1` field. In-session workbook save/reopen, stale-copy rejection, and import safety are gallery checks; actual restart persistence and competing browser-tab saves in SHEET-06 remain full-app checks. Reloading the demo restores the seed rather than a previously saved workbook.

## Application requirements
Create Sheetcraft, a compact spreadsheet editor with an actual formula engine and durable workbooks. The task ID is `29-sheetcraft`. A 100-row by 26-column sheet is sufficient. Build correct semantics for the specified subset rather than claiming compatibility with every Excel function.

## Grid and value model

Provide cell selection, rectangular range selection, a formula bar, keyboard navigation, edit-in-cell, row/column headers, copy/paste, clear, undo/redo, and efficient rendering. Cells hold raw input separately from calculated value. Support finite numbers, plain text, Booleans, blank, and formulas beginning with `=`. Preserve raw formulas during saves and JSON export. Text resembling markup must remain inert.

Implement a parser, not host-language eval. The formula grammar includes decimal number literals, double-quoted strings with doubled-quote escaping, TRUE/FALSE, A1-style references with optional `$` on column and/or row, rectangular ranges, parentheses, unary plus/minus, arithmetic `+ - * /`, comparisons `= <> < <= > >=`, and functions `SUM`, `MIN`, `MAX`, and `IF`. State operator precedence explicitly and make function names case-insensitive. References outside A1:Z100 yield `#REF!`.

For arithmetic, blank is zero and Boolean converts to 1 or 0; nonnumeric text yields `#VALUE!`. A direct formula reference to a blank yields zero. Comparison is numeric for numeric/Boolean operands, lexicographic for two strings, and otherwise yields `#VALUE!`, with blank treated as numeric zero. Division by zero yields `#DIV/0!`. Unknown functions yield `#NAME?`. Syntax errors must be visibly distinguished or use a documented parse-error value, never crash the sheet.

SUM/MIN/MAX accept scalar expressions and rectangular ranges. In ranges, ignore blank and text cells, include numbers/Booleans, and propagate errors. Scalar nonnumeric text yields `#VALUE!`. No numeric values yields zero for all three aggregates in this bounded engine. IF requires three arguments; evaluate the condition and only the selected branch. An inactive branch with an error or self-reference must not poison the result. Document this lazy rule.

## Dependencies and editing semantics

Track dependencies and recalculate affected cells when inputs change. Detect cycles in actually evaluated references and show `#CYCLE!` for the participating evaluation path and dependent results. Correcting the cycle must restore valid calculations without requiring a page reload. If a condition switches an IF branch, dependency tracking must reflect the newly active references. Do not cache stale values after editing a precedent.

Copying or filling formulas adjusts only relative row/column components by the source-to-destination offset; absolute components stay fixed. Out-of-bounds adjusted references become `#REF!`. Pasting a rectangle is one undoable action, including all raw values and formulas; undo must restore the exact previous inputs, then recalculate consistently. Redo restores the complete operation. Protect the undo stack from internal rendering/recalculation updates.

Support sorting a selected rectangular region by one chosen column, ascending or descending, using evaluated values captured before the sort and a stable original-row tiebreaker. Numeric/Boolean values sort together, followed by strings, then blanks, then errors; reversing direction reverses numeric/string order but keeps blanks/errors last. Move complete row slices within the selected region. Rebase moved formulas as if copied from their old position to the new one; absolute references stay fixed. Formulas outside the sorted region are not rewritten. State these bounded sort semantics visibly rather than silently approximating Excel behavior.

## Persistence and import/export

Persist named workbooks with a single sheet on the backend, raw cell inputs, and a version. A save/reload/restart round trip must preserve formulas, types, and results. Stale saves from another tab must produce a conflict rather than overwrite a newer workbook. The undo history need not survive closing the workbook, but its current behavior must be correct.

Support CSV import with quoted commas, doubled quotes, and multiline fields, and CSV export of evaluated values. Import treats incoming fields as literal values, not executable formulas, unless the user explicitly chooses a documented formula-import mode. JSON workbook import/export retains raw formulas and typed cell content. Validate bounds and schema before replacement, and treat import as one undoable operation. No binary XLSX support is required.

## Deterministic workbook

Seed A1=2, B1=3, C1=`=A1*B1`; A2=4, B2=5, C2=`=A2*B2`; D1=`=SUM(C1:C2)`; E1=`=IF(A1>0,10,1/0)`; and F1=`=$A1+B$1+$C$1`. Expected C1=6, C2=20, D1=26, E1=10, F1=11. Copy F1 into F2: the raw formula becomes `=$A2+B$1+$C$1`, giving 13.

Set A1 to `=C1`: the cycle must become visible in A1/C1 and dependent calculations rather than freezing the browser or retaining old values. Restore A1 to 2 and all valid results recover. Separately enter G1=`=IF(FALSE,G1,7)`, which must evaluate to 7 without a cycle because its self-reference is inactive. Replacing FALSE with TRUE must reveal a cycle.

## Presentation and tests

Make the result feel like a small real spreadsheet: clear active-cell and range borders, raw versus evaluated values, formula errors with an explanation, keyboard controls, a status bar with selected numeric count/sum, a dependency inspector, and a workbook menu. Dense grid content may horizontally scroll on mobile, but file and editing controls must remain reachable.

Tests must cover precedence, references, absolute/relative copying, lazy IF, cycle introduction/removal, error propagation, range aggregates, stable sorting and rebasing, multi-cell undo, and persistence. No charts, macros, financial function library, or collaboration engine is required. Mathematical correctness, state transitions, and trustworthy editing dominate the benchmark.

## Runtime, delivery, and engineering contract

This is the Real Apps track. Build a small, genuinely usable multi-file application, not a single-file visual demo. A frontend, a real local backend, and durable embedded storage such as SQLite are allowed and expected. Use a stack runnable with Python 3.11+ and/or Node.js 22+; declare the actual supported versions and dependencies. Frameworks are permitted, but no paid services, API keys, cloud accounts, CDNs, externally hosted fonts, or runtime internet dependencies may be required. Dependency installation is an explicit setup step, separate from ordinary startup. Pin direct dependency versions; do not invent a lockfile or claim a build was verified when it was not.

Deliver all authored source, styles, migrations or schema initialization, seed data, meaningful automated tests, and a README. Do not substitute mocked UI state, test-framework network responses, TODO handlers, or hard-coded scenario outcomes for the application. Where this task requires a local companion HTTP service, implement an actual service that receives real requests, maintains the specified state, and deliberately exposes documented fault modes. It is a functional part of the delivered application, not a substitute for its business logic. Use only synthetic demonstration data.

Provide `benchmark.json` at the project root with `schema_version: 1`, the exact task ID, `track: "real-apps"`, a human-readable `name`, `stack` as a string array, `commands` with `setup` as an array of argument arrays and `start`, `test`, and `reset` each as one argument array, and `health_path: "/health"`. Every command must be concrete, runnable, and relative to the project root. An empty setup array is valid for a dependency-free project. Do not put shell syntax or background operators inside argument arrays. A start command must remain in the foreground and manage any required companion process. The gallery will display this manifest but will never execute it automatically.

Honor `PORT` for the application HTTP port, `HOST` defaulting to `127.0.0.1`, and `DATA_DIR` for all mutable business data, uploads, job state, and application logs. Default to port 8811 and a clearly documented local data directory for manual use. Allow two copies to run simultaneously with different ports and disjoint data directories. If a companion service is needed, honor `SERVICE_PORT`, defaulting to `PORT + 1`, and keep its state under the same run-specific `DATA_DIR`. Serve a JSON `GET /health` endpoint that reports ready only after storage and essential services are initialized. Document all operational routes and domain APIs used by the UI.

An explicit reset command, run only with the app stopped, must recreate the deterministic seed dataset inside the selected `DATA_DIR`. Refuse dangerous reset destinations such as a filesystem root, the user's home, or the source-project root. A normal restart must never silently reseed, erase, or repair away existing business state. Tests must create their own temporary data directories and must not alter the operator's saved application state. Do not commit generated databases, virtual environments, node_modules, real credentials, or runtime caches into the delivered source tree.

Implement server-side validation and transactional state changes wherever required by the domain. Reloads, refreshes, concurrent sessions, repeated requests, stale versions, validation failures, and backend outages must have explicit outcomes. Use stable identifiers and versions rather than display labels or array offsets as identities. Do not report a write as confirmed until it has actually been committed. A failed operation must not leave partial changes that the task says are atomic. Where request idempotency is required, persist the operation key and its payload fingerprint with the result; retries with the same key and payload return the existing result, while reuse with a different payload fails without side effects.

Make the main workflow usable at 1280 × 800 and at a narrow 390 × 844 viewport. Dense editors may scroll within their content area, but navigation and essential actions must remain accessible. Provide labeled controls, keyboard access, visible focus, inline validation, useful loading/empty/error states, deliberate typography and spacing, and honest success feedback. Do not let late asynchronous responses overwrite a newer selection or edit. Render untrusted text as text, not executable markup. Meaningful frontend and backend tests are required. Run them during development and rerun them after material changes.

After setup, verify operation with external internet blocked while local loopback HTTP remains available. This is not the same as disabling the application's own backend connection. True disconnected editing is required only when the specific task says so; other tasks should handle local backend failure honestly rather than pretending writes succeeded. Browser previews are for inspection, not security isolation: authentication, offline storage, and concurrent-user checks must also be tested in separate top-level browser contexts when relevant.

Include a short architecture explanation, an endpoint map, exact setup/start/test/reset instructions, seed identities or local demonstration credentials where needed, and known limitations in the README. No unsupported claim of production security, optimal scheduling, or universal exactly-once delivery is acceptable. Stay within the defined product scope and implement its invariants completely instead of adding unrelated dashboards or ornamental features.

---

# Public acceptance scenarios: Sheetcraft: Spreadsheet with a Formula Engine

These are model-visible domain checks, not an automated test suite. Start each independent scenario from a documented clean seed or explicitly record which preceding state it uses. UI paths must be exercised in the browser; concurrency, authorization, and durability must also be checked against real server responses and persisted state. Statuses are pass, fail, blocked, or not-run; only observed evidence earns pass. Fixed fixtures illustrate the rules, not permission to hard-code outcomes.

## SHEET-01: Seed calculation

**Exercise:** Open the seed workbook and inspect raw formulas and values.

**Expected:** C1=6, C2=20, D1=26, E1=10, F1=11; formula bar shows actual source expressions.

## SHEET-02: Mixed-reference copy and undo

**Exercise:** Copy F1 to F2, then paste a multi-cell range and undo/redo once.

**Expected:** F2 formula is =$A2+B$1+$C$1 and value 13. One undo restores the entire previous raw range, not just one cell.

## SHEET-03: Cycle recovery and lazy IF

**Exercise:** Set A1 to =C1, restore 2, then toggle G1 between =IF(FALSE,G1,7) and =IF(TRUE,G1,7).

**Expected:** Cycles appear and recover correctly. The inactive self-reference evaluates to 7, not #CYCLE!.

## SHEET-04: Parsing and errors

**Exercise:** Exercise precedence, an unknown function, invalid reference, division by zero, text arithmetic, and an error inside an aggregate range.

**Expected:** Each produces the specified value or error without host-language execution or stale results.

## SHEET-05: Stable sorting

**Exercise:** Sort a selected region with tied numeric keys, text, blanks, errors, and relative formulas.

**Expected:** Entire row slices move stably, formulas rebase as specified, blanks/errors remain last, and outside formulas are not rewritten.

## SHEET-06: Persistence and import

**Exercise:** Save, restart, reload, export/import JSON, try a stale tab save, and import a CSV with quoted fields.

**Expected:** Raw formulas and typed values persist; stale save conflicts; invalid import cannot destroy the sheet; default CSV import does not execute formulas.

## Completion

Leave the complete source in `project/`, its generated self-contained demo in `project/gallery/index.html`, and the evidence directory beside `project/`. Return a concise delivery note with the project and demo paths, exact setup/start/test/reset and demo build commands, separately observed full-app and gallery-demo outcomes, and remaining failures or blocked checks. Both deliverables must run from the delivered files without depending on this benchmark package. Do not replace source or demo delivery with a code listing or a proposed implementation.
