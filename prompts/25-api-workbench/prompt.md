# API Workbench: Stateful Request Laboratory

## Agentic development workflow

Build the complete application in one end-to-end agentic run. You may use the filesystem, shell, dependency tools, compilers, linters, tests, documentation, browser automation, and debugging tools from the beginning, within the permissions and budget assigned by the harness. Plan, implement incrementally, execute, inspect, diagnose, and improve your work throughout development. No previous implementation is assumed. Do not stop at a proposal, scaffold, screenshot, or partially connected demo.

Use the installed browser automation skill `agent-browser` to validate your work. Read the installed skill and its version-matched core workflow before use; consult its exploratory-testing workflow when available. If this capability is genuinely unavailable, use another available real-browser automation tool, record the substitution, and state any coverage that remains blocked. Do not fabricate successful tool use or let a missing optional tool prevent useful work with the tools you do have. The evaluator records tool availability separately from implementation quality.

## Validation

Exercise the actual main workflow using browser navigation, labeled controls, pointer and keyboard input, and screenshots. Merely loading the page, inspecting source code, or observing a DOM element does not establish that a feature works. For Canvas, WebGL, audio, games, and other non-DOM state, perform real interactions and inspect both rendered output and relevant live diagnostics. Check the browser console, uncaught errors, failed requests, and meaningful application state.

Check normal desktop and narrow viewports (at least 1280 x 800 and 390 x 844), input continuity, primary controls, error states, navigation, and any required pause/reset, import/export, or persistence behavior. Reproduce observed failures, fix their cause, and repeat the failed flow plus a compact regression test after material changes. Run the task-specific checks below against genuine application behavior. Do not modify benchmark requirements, supplied fixtures, expected results, or evaluator code to make a test pass.

Keep evidence in a sibling `evidence/` directory: an agent-authored `validation.md` with the exact steps and commands, observed results, failures, relevant screenshots/logs, fixes, and retest outcomes. Use pass, fail, blocked, or not-run honestly; a blocked check is not a pass. Do not write or invent an evaluator-owned score or report. End within the assigned budget with the best working implementation and an explicit account of remaining limitations.

### Real application delivery and runtime checks

Deliver the complete runnable project in `project/`, with `benchmark.json` and README at its root. Keep `evidence/` beside `project/`. Install the declared dependencies when permitted, generate genuine lockfiles with the actual package manager where applicable, build, start the application, and run meaningful automated tests. Do not substitute test doubles or precomputed UI outcomes for business logic.

Use a fresh run-specific `DATA_DIR` outside the source tree. Exercise browser flows against the real local backend. Supplement browser checks with actual HTTP requests, backend logs, and data inspection for concurrency, idempotency, permissions, and persistence. Use genuinely overlapping requests where specified. For independently authenticated users or devices, use separate top-level browser contexts with isolated storage. Reload after committed changes, then stop and restart the backend against the same `DATA_DIR` and verify durable state.

After dependency setup, verify operation with external internet blocked while local loopback access to the app and its declared companion service remains available. This does not mean turning off the app's own backend. Only a task explicitly requiring offline editing must also be tested disconnected from its local backend. Do not erase state to hide a persistence failure. Keep all supplied public scenario and fixture files read-only; changes to the generated application must preserve the specified behavior for other valid inputs too.

## Application requirements
Create API Workbench, a useful local API client and collection runner. The task ID is `25-api-workbench`. Build a real request editor, saved collections, named environments, request history, response inspector, assertions, streaming display, and a reproducible local HTTP laboratory. Every displayed response must originate from an actual HTTP exchange or be clearly marked as a saved historical result.

## Request editing and execution

Support GET, POST, PUT, PATCH, and DELETE; a URL field; query parameters; enabled/disabled headers; no body, raw text body, and JSON body modes; timeout; Send; and Cancel. Show response status, headers, content type, body, start/end timestamps, duration, response size, and failure classification. Pretty-print valid JSON without losing access to original bytes/text; invalid JSON must remain inspectable.

Use a backend request proxy confined to the application's own configured local companion service origin. Only allow the exact scheme, host, and SERVICE_PORT chosen for that service. Refuse other targets and cross-origin redirects; do not turn the app into an unrestricted proxy to the operator's machine or external network. The restriction is an intentional task boundary, not an API-client limitation to hide.

Each send creates an immutable execution ID and a snapshot of method, expanded URL, headers, body, environment, and timeout. Store execution history durably. Overlapping sends may finish in a different order. A late response must update its own execution record and must never replace a newer selected response simply because it arrived later. Selecting a historical execution shows its own request snapshot and response, not the current editor values.

Cancellation is a real abort propagated through the proxy where feasible. Record a distinct cancelled state and stop presenting later data as a successful completion. Explain that cancellation cannot undo an effect already accepted by a remote service. Timeouts, HTTP 4xx/5xx, connection failures, malformed bodies, and cancellations must not be collapsed into a generic green success indicator.

## Environments and collections

Persist at least two named environments. Expand `{{variable}}` placeholders in URL, header values, and body from an explicit snapshot of the selected environment plus collection-run variables. An unresolved variable blocks sending with a useful error. Do not interpolate into JavaScript or shell execution. JSON mode validates the expanded body as JSON before sending. Editing or switching environments while a request is in flight must not retroactively change its saved request snapshot.

Collections contain ordered named requests with assertions and variable extraction. Support assertions for status equality, a bounded JSON path value equality, and a header value. Define JSON paths as `$`, dotted object fields, and numeric array indices, such as `$.items[0].id`; missing paths fail explicitly. Extract values into run-scoped variables for later requests without mutating saved environments. Run requests sequentially with either stop-on-failure or continue-on-failure, show per-step outcomes, and permit cancelling the run before the next request. Store a completed run summary and export/import collections as validated JSON.

## Delivered HTTP laboratory

Launch an actual local companion service with the same foreground start command. Implement these routes: `GET /health`; `GET` and `POST /echo`, returning method, path/query, headers, and received body; `GET /delay?ms=N&label=L`, waiting a bounded requested delay before returning the label; `GET /status/N`, returning the requested 2xx–5xx status with a JSON body; `GET /items?cursor=N`, returning deterministic pages; and `GET /stream?count=N&interval_ms=M`, emitting bounded server-sent JSON events followed by a completion event.

Use five seeded items with IDs item-1 through item-5, page size two, and zero-based offset cursors. The first page is item-1/item-2 with next_cursor=2, the second item-3/item-4 with next_cursor=4, and the last item-5 with next_cursor=null. Reject invalid cursors rather than inventing pages. Expose a request log showing received request IDs, route, timestamp, and completion/cancellation observations so execution can be checked independently of the client panel. Persist it under DATA_DIR.

Stream chunks through the proxy without waiting for the complete response. The client must visibly append actual events as they arrive and preserve their order. Reconnection and arbitrary stream replay are out of scope. Cancelling a stream must stop updates to its active display and save a partial, cancelled history result rather than a completed response.

## Demonstration and presentation

Ship a collection that reads the first items page, asserts status 200 and item-1, extracts next_cursor, requests the next page using that variable, and asserts item-3. Include an intentionally failing assertion, visibly labeled as such, for testing runner behavior. Seed environments named Local and Alternate with different `label` values while both target the same allowed service origin.

Use an efficient developer-tool layout: collection sidebar, request tabs or execution list, editable header grid, environment selector, JSON/raw response tabs, status and latency badges, streaming output, and a collection-run timeline. Save collection edits, history, and environments across reload and backend restart. Provide clear feedback for unsaved changes and invalid collection imports.

Tests must exercise a 3000 ms request A and 100 ms request B sent close together, environment switching during execution, cancellation before completion, an unresolved variable, a failing assertion, pagination extraction, and incremental SSE reception. No cloud sync, OAuth provider integration, arbitrary internet targets, GraphQL schema editor, or plugin marketplace is required. Correct asynchronous state, actual networking, trustworthy history, and useful debugging interaction are the benchmark priorities.

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

# Public acceptance scenarios: API Workbench: Stateful Request Laboratory

These are model-visible domain checks, not an automated test suite. Start each independent scenario from a documented clean seed or explicitly record which preceding state it uses. UI paths must be exercised in the browser; concurrency, authorization, and durability must also be checked against real server responses and persisted state. Statuses are pass, fail, blocked, or not-run; only observed evidence earns pass. Fixed fixtures illustrate the rules, not permission to hard-code outcomes.

## API-01: Real echo and durable history

**Exercise:** Send a JSON POST with a custom header; inspect client response and companion request log; restart and reopen history.

**Expected:** Method, header, body, status, and request ID agree across both services and the saved execution.

## API-02: Out-of-order completion

**Exercise:** Send delay A=3000 ms, then B=100 ms. Keep B selected; switch the active environment before A completes.

**Expected:** B remains selected. A and B retain their own responses, timing, and original environment snapshots.

## API-03: Cancellation and timeout

**Exercise:** Cancel a delayed request and separately a running stream; test an actual timeout.

**Expected:** Cancelled and timed-out executions are distinct from success, late data does not overwrite selection, and stream output stops.

## API-04: Collection variables and assertions

**Exercise:** Run the seeded pagination collection, then its deliberate assertion failure under both runner policies.

**Expected:** Extraction drives the second request to cursor=2 and item-3; failures are real and stop/continue behavior matches policy.

## API-05: Incremental streaming

**Exercise:** Request five events with visible spacing and observe while still in flight.

**Expected:** Events appear incrementally in order, not all at completion; saved history retains the observed data.

## API-06: Validation and target boundary

**Exercise:** Send an unresolved variable, invalid expanded JSON, an invalid cursor, and a URL outside the allowed companion origin.

**Expected:** Client-side malformed requests and disallowed targets are blocked honestly; server validation responses are shown with their actual status.

## Completion

Leave the complete source in `project/` and the evidence directory beside it. Return a concise delivery note with the project path, exact setup/start/test/reset commands, observed test outcomes, and remaining failures or blocked checks. The application must run from the delivered files without depending on this benchmark package. Do not replace the source delivery with a code listing or a proposed implementation.
