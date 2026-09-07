# Workflow Desk: Durable Visual Automation

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

### Workflow Desk in the gallery

Use the real graph editor and execution rules with in-memory stores for drafts, immutable published versions, runs, checkpoints, attempts, approvals, and receiver effects. Label the gallery transport and effect receiver as simulations. An HTTP action in the imported graph must invoke an in-memory receiver implementing the same bounded route, payload validation, effect-key conflict, and idempotency rules; it must never make a network request. Maintain separately inspectable received attempts and committed effects, derived from actual command execution.

Expose the three supplied fault modes: normal, first-attempt-503-before-commit, and first-response-timeout-after-commit. The response-loss mode must actually apply one receiver effect in memory before delaying its response beyond the caller's timeout. Retries reuse the same run/node effect key, with at most three attempts and the specified 100 ms then 200 ms initial retry delays. Cancellation stops future actions and pending retries without pretending to undo an already accepted effect. Provide a clearly labeled Restart demo engine control that stops the current scheduler and recreates execution from retained in-memory checkpoints, including absolute due times, while leaving the simulated receiver's state intact. This differs from Reset demo, which clears both engine and receiver state and cancels all pending work.

Execute the supplied graph for arbitrary valid inputs and verify the fixtures: amount 12500 waits for explicit approval and ultimately produces one effect; amount 9000 follows the false branch with no effect. Test repeated approval, both retry fault modes, a pending delay across a simulated engine restart, graph validation, and a changed draft while an earlier run remains pinned to its published version. Reload or closing the document discards all of this state. Genuine HTTP delivery, receiver transactions across processes, browser-independent execution, and backend restart/crash recovery in FLOW-02, FLOW-04, and FLOW-06 remain local-only evidence; a simulated restart is not a pass for those checks.

## Application requirements
Create Workflow Desk, a small visual workflow editor with a real durable execution engine. The task ID is `24-workflow-desk`. The application must let a user design a workflow, publish an immutable version, launch it with JSON input, inspect execution, approve a waiting step, and recover an interrupted run after restarting the server.

## Bounded graph language

Support at most 20 nodes per workflow and these node types: input, transform, condition, HTTP action, delay, approval, and end. Exactly one input node is required. Ordinary nodes have one outgoing edge; a condition has labeled true/false edges, and end nodes have none. Multiple incoming edges are allowed only as mutually exclusive branch reconvergence. Execution follows one chosen path, never parallel fan-out. Reject cycles, dangling edges, invalid node configuration, and unreachable nodes before publication. Highlight errors at the relevant nodes.

A transform can assign a JSON field from a literal or from a selected input path. Conditions compare a selected primitive JSON value with a literal using equality or numeric ordering. Define the supported path grammar, distinguish a missing field from null, and reject invalid types. Do not evaluate arbitrary JavaScript, Python, or shell expressions. Support adding, connecting, moving, selecting, editing, duplicating, and deleting nodes with undo/redo of authoring changes.

Published workflow versions are immutable. Editing creates a new draft. A running instance pins the published graph and configuration it started with; changing the editor must not alter that run. Validate JSON workflow import before replacing an editor draft and export workflows plus run history as JSON.

## Durable execution semantics

Persist run identity, graph version, input, step input/output, chosen branch, attempts, timing, error details, approval decision, and final outcome. Show statuses such as queued, running, waiting, retrying, succeeded, failed, rejected, and cancelled. A step must not show success simply because a timer fired in the frontend.

A delay persists an absolute due time. An approval persists its wait state and resumes only after an explicit approve decision; reject terminates the run as rejected. Repeated approval submissions must not advance the workflow twice. The engine must resume due delays, pending retries, and approved runs after a process restart without requiring the browser to stay open.

HTTP nodes issue real POST requests only to the delivered local companion service. Persist a stable effect key derived from run ID plus node ID, reused across retries. Use bounded retries with attempt history: at most three attempts, with initial retry delays of 100 ms then 200 ms, configurable to longer values for inspection. Timeouts and retryable 5xx responses may be retried; validation 4xx responses are terminal. Cancellation stops future steps but must not falsely claim to undo an external effect already accepted.

Do not promise universal exactly-once delivery. Implement at-least-once HTTP delivery with a transactional idempotent receiver, so the benchmark's observable effect is applied once even when a request's response is lost. A crash between receiver commit and local step acknowledgement must be recoverable using the same effect key.

## Real local effect receiver

Start a companion HTTP service through the same foreground application command, using SERVICE_PORT. It must accept `POST /effects` with `Idempotency-Key`, persist one effect per key and payload, and expose `GET /effects` plus an inspector UI or application panel. Repeated matching requests return the stored result; mismatched content under the same key returns a conflict.

Provide per-key fault modes selectable in the app: normal, first-attempt-503-before-commit, and first-response-timeout-after-commit. In the last mode, the receiver commits the effect and delays its first response beyond the caller's configured timeout; subsequent matching attempts return promptly. Track received attempts separately from committed effects. These are explicit behaviors of the actual local service, not browser route mocks. Never send requests to arbitrary external addresses.

## Demonstration workflow

Ship a published example accepting `{"request":{"id":"R-001","amount":12500}}`. It sets `priority` to `high`, branches on request.amount > 10000, sends the true branch to approval, then to a POST action, then a short persisted delay, then end. The false branch goes directly to a separate end with no approval or HTTP effect. The posted data includes request ID, amount, and transformed priority.

With 12500, execution must stop for approval. Restart the server there, reopen the same run, approve, and finish with one committed receiver effect. With 9000, it must finish on the false branch without any effect. Publishing a changed draft while either run exists must not change its recorded graph version or outputs.

## User experience and tests

Use a legible node canvas and an equally useful execution detail panel with chronological step events, retry counters, JSON input/output inspectors, and a receiver effect table. Provide run, cancel, approve/reject, reset demonstration data, graph import/export, and a publish action. A graphical editor with decorative status dots is insufficient.

Tests must cover graph rejection, branch correctness, immutable versions, approval replay, delay restart, precommit failure retry, and response-loss retry with one receiver effect. No scheduling cluster, arbitrary plugins, multi-tenant auth, nested subworkflows, or parallel branch join semantics are required. The benchmark rewards agreement between graph, durable engine state, observed HTTP effects, and UI.

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

# Public acceptance scenarios: Workflow Desk: Durable Visual Automation

These are model-visible domain checks, not an automated test suite. Start each independent scenario from a documented clean seed or explicitly record which preceding state it uses. UI paths must be exercised in the browser; concurrency, authorization, and durability must also be checked against real server responses and persisted state. Statuses are pass, fail, blocked, or not-run; only observed evidence earns pass. Fixed fixtures illustrate the rules, not permission to hard-code outcomes.

## FLOW-01: Executable branching

**Exercise:** Publish the seed workflow and launch inputs with amounts 12500 and 9000.

**Expected:** High amount waits for approval; low amount terminates without an HTTP effect. Transform output is visible and persisted.

## FLOW-02: Restart while waiting

**Exercise:** Stop the app while the high-amount run awaits approval; restart against the same DATA_DIR and approve twice.

**Expected:** The original run resumes once and eventually succeeds with one effect; the second decision cannot run the step again.

## FLOW-03: Retry before commit

**Exercise:** Select first-attempt-503-before-commit and launch an approved path.

**Expected:** Attempt history contains the failure and retry; receiver stores one effect, not a simulated UI success.

## FLOW-04: Response loss after commit

**Exercise:** Select first-response-timeout-after-commit. Restart during recovery where practical, then inspect attempts and effects.

**Expected:** Caller may retry but reuses the effect key; exactly one receiver effect exists. The UI reports the actual final state.

## FLOW-05: Version pinning and graph validation

**Exercise:** Publish a changed workflow while an old run is waiting; try a cycle and an invalid path expression in a draft.

**Expected:** Old run retains its old version. Invalid drafts cannot publish or corrupt the last published version.

## FLOW-06: Persisted delay and cancellation

**Exercise:** Restart during a pending delay, then separately cancel a run before its next action.

**Expected:** Due time survives restart; cancellation prevents future actions without claiming to roll back already committed effects.

## Completion

Leave the complete source in `project/`, its generated self-contained demo in `project/gallery/index.html`, and the evidence directory beside `project/`. Return a concise delivery note with the project and demo paths, exact setup/start/test/reset and demo build commands, separately observed full-app and gallery-demo outcomes, and remaining failures or blocked checks. Both deliverables must run from the delivered files without depending on this benchmark package. Do not replace source or demo delivery with a code listing or a proposed implementation.
