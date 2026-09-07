# Config Workbench: Structural Diff and Merge

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

### Config Workbench in the gallery

Keep the version repository, immutable saved configurations, restore history, and undo/redo state in memory. Provide two explicitly labeled simulated edit copies, A and B, with independent text buffers, last-valid models, and expected head versions. Let the user load a saved version into either copy, switch copies, and save through the same version and schema checks. Saving A must make an older B save conflict without overwriting the new head or discarding B's valid or invalid input. These copies share only the demo's in-memory version repository; separately opened demos remain independent.

Exercise the general text/tree editor, schema validator, structural diff, and three-way merge with the supplied base, left, and right documents and other valid inputs. The fixture must produce exactly `/service/description` and `/service/limits/rate` as conflicts. Choosing left rate and right description must calculate rate 120, burst 250, beta true, description `public`, and endpoints `["/health","/metrics"]`, matching `expected.json`. Preserve absent-versus-null, atomic arrays, escaped JSON Pointer paths, immutable inputs, merge undo, and restore-as-new-version behavior. Invalid imports must leave the current document intact. Gallery saves retain history only until reset or reload; real competing-session requests and restart durability in CFG-05/CFG-06 must still be verified against the full local app.

## Application requirements
Create Config Workbench, a structured JSON configuration editor with durable versions, structural diff, and a real three-way merge. The task ID is `26-config-workbench`. Build a tool a developer could actually use to compare and reconcile configuration changes, not a side-by-side syntax-highlighting demo.

## Editing and validation

Provide synchronized text and tree views of one JSON document. Tree operations include editing a primitive, adding/removing an object property, adding/removing/reordering array items, and replacing a subtree. Preserve numbers, strings, Booleans, arrays, objects, and null as distinct types. Missing properties are distinct from properties whose value is null. Object keys and JSON Pointer paths must handle slash and tilde correctly.

While the user types invalid JSON, retain the last valid document model, preserve the invalid text buffer, show a location-aware syntax error, and disable saving that invalid buffer. Switching views must not silently discard it or publish the last valid model as though it were the current text. Offer an explicit discard-invalid-edit action. A tree edit must be reflected in text without losing unrelated values.

Implement the following bounded JSON Schema subset: `type`, `properties`, `required`, `additionalProperties` as a Boolean, `items` as one schema, `enum`, numeric `minimum`/`maximum`, and string `minLength`. Support nesting. Reject unsupported schema keywords visibly rather than claiming full JSON Schema compliance. Schema-invalid documents can be inspected and corrected, but cannot be published as a saved configuration version. Display errors at the corresponding tree nodes and paths.

## Versioning and diff

A saved version is immutable and contains an ID, parent version, content, comment, and timestamp. Keep a mutable draft separate from published versions. Save requires an expected current version; stale edits from another session must conflict rather than overwrite the new head. Provide history, restore-as-new-version, JSON import/export, and structural diff of any two versions.

Diff reports additions, removals, replacements, and type changes using JSON Pointer paths and before/after values. Reordering object keys alone is not a semantic change. For this bounded task, arrays are atomic values during both structural diff and merge; editing the array is supported, but no identity-aware array merge is required. State this rule in the UI.

## Three-way merge rules

Select base, left, and right versions or imported documents. For each value or object-property presence: if left equals right, use that result; if left equals base, use right; if right equals base, use left. Otherwise, if all three present values are objects, recursively merge their properties. All remaining concurrent differences are conflicts. Two sides adding the same new object with different contents are therefore a conflict at that added property's path, since the base was absent. Arrays are compared atomically.

A missing-property sentinel must not be treated as null. Deletion on one side versus an edit on the other is a conflict. Identical deletions are not a conflict. A type change versus a nested edit conflicts at the affected subtree. Never silently choose one side or concatenate arrays in an unresolved conflict.

For each conflict, show base, left, and right, including an explicit absent/deleted label. Permit choosing base, left, right, deletion where legal, or a custom valid JSON value. Show a live merged preview, remaining-conflict count, and resulting schema errors. Publishing is blocked until all conflicts are resolved and the final document validates. Merge completion is one undoable authoring action. Do not mutate the input versions when resolving conflicts.

## Deterministic merge fixture

The base document is:
`{"service":{"name":"api","port":8080,"limits":{"rate":100,"burst":200},"description":null},"features":{"beta":false},"endpoints":["/health"]}`.

Left changes rate to 120, sets beta to true, and deletes service.description. Right changes rate to 150, burst to 250, sets service.description to `public`, and adds `/metrics` to endpoints. The two conflicts are `/service/limits/rate` and `/service/description`. The independent beta, burst, and endpoints changes must survive. Resolve rate from left and description from right; the result has rate 120, burst 250, beta true, description `public`, and endpoints `["/health","/metrics"]`.

Ship a schema requiring the main service object, name, port, and limits, allowing description to be a string or null, requiring a Boolean beta, requiring string endpoints, and forbidding unspecified properties. Port is an integer from 1 to 65535, and rate/burst are nonnegative integers. Include equivalent input JSON files and the expected resolved document. A fixture must not be hard-coded as a special case in the merge engine.

## Interaction and tests

Provide undo/redo for text commits, tree operations, imported document replacement, and completed merge application; group one user action rather than recording each rendered cell or every cursor movement as a separate command. Persist the saved history server-side. Ordinary reload and restart must preserve saved versions; draft persistence may be local but must be clearly indicated.

Use a legible multi-pane layout with a version sidebar, text/tree toggle, schema panel, changes list, and conflict inspector. Essential operations must remain accessible on narrow screens through tabs or stacked panes. Use safe text rendering for configuration values. Meaningful tests must cover structural equality independent of key order, absent-versus-null, array atomicity, delete-versus-edit, schema failures, stale saves, invalid editor buffers, and undo after merge.

No YAML, comments-in-JSON, arbitrary code execution, git command integration, real-time collaboration, or full JSON Schema implementation is required. Semantic preservation and honest conflict handling are more important than the amount of highlighted text.

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

# Public acceptance scenarios: Config Workbench: Structural Diff and Merge

These are model-visible domain checks, not an automated test suite. Start each independent scenario from a documented clean seed or explicitly record which preceding state it uses. UI paths must be exercised in the browser; concurrency, authorization, and durability must also be checked against real server responses and persisted state. Statuses are pass, fail, blocked, or not-run; only observed evidence earns pass. Fixed fixtures illustrate the rules, not permission to hard-code outcomes.

## CFG-01: Synchronized editing and invalid buffer

**Exercise:** Edit a nested primitive in the tree, then type invalid JSON in the text pane and switch views.

**Expected:** Valid edits synchronize. Invalid text remains recoverable; publish is blocked and the last valid model is not silently presented as the current saved edit.

## CFG-02: Known three-way merge

**Exercise:** Merge the supplied base/left/right fixture.

**Expected:** Exactly rate and description conflict. Independent beta=true, burst=250, and endpoints changes survive.

## CFG-03: Conflict resolution and undo

**Exercise:** Choose left rate and right description, publish the merged result, undo the draft merge application, then restore the saved version as a new version.

**Expected:** Resolved content equals expected.json. Input versions remain unchanged, undo restores the prior draft, and history records a new restore version.

## CFG-04: Presence, types, arrays, and paths

**Exercise:** Exercise missing versus null, deletion versus edit, reordered object keys, concurrent array edits, and keys containing / and ~.

**Expected:** Defined merge/diff rules are followed, JSON Pointer paths are correctly escaped, and conflicts do not discard data.

## CFG-05: Schema and stale saves

**Exercise:** Attempt an out-of-range port, a wrong Boolean type, an unsupported schema keyword, and two competing saves.

**Expected:** Validation is explicit, unsupported semantics are not silently ignored, and the stale save cannot replace the newer head.

## CFG-06: Persistence and import safety

**Exercise:** Restart and inspect histories/diffs. Import malformed or schema-invalid input.

**Expected:** Published versions persist unchanged; a failed import cannot destroy the current valid document.

## Completion

Leave the complete source in `project/`, its generated self-contained demo in `project/gallery/index.html`, and the evidence directory beside `project/`. Return a concise delivery note with the project and demo paths, exact setup/start/test/reset and demo build commands, separately observed full-app and gallery-demo outcomes, and remaining failures or blocked checks. Both deliverables must run from the delivered files without depending on this benchmark package. Do not replace source or demo delivery with a code listing or a proposed implementation.
