# Resource Booker: Conflict-Free Reservations

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
Create Resource Booker, a small reservation system for three rooms and two individually bookable equipment items. The task ID is `22-resource-booker`. Focus on correct scheduling and concurrent writes, not on a full enterprise calendar.

## Product and interval model

Provide a calendar view, an accessible list view, a resource selector, a booking form, a series editor, and a details/history panel. Resources have stable IDs, type, name, a display capacity for rooms, and availability blocks. Each resource is exclusively bookable by one booking at a time; room seating capacity is informative and does not allow overlapping reservations. Equipment is modeled as individual assets rather than a pooled stock counter.

Each booking has an ID, resource ID, title, owner label, start and end instants, display timezone, status, and version. Use half-open intervals `[start, end)`: 10:00–11:00 and 11:00–12:00 may coexist; any positive overlap on the same resource conflicts. End must be strictly after start. Cancelled bookings do not block availability; maintenance blocks do. Past fixture dates remain editable so tests do not depend on today's date.

Display and accept times in an explicitly selected IANA timezone, including Europe/Berlin and UTC. Store actual instants independently of display formatting. Changing display timezone must not shift the booking itself. Reject nonexistent local times and ambiguous local times with a useful validation message; this bounded task does not require choosing one side of an ambiguous local time. Do not silently normalize invalid wall-clock input.

## Recurrence and edits

Support weekly recurrence with the same local weekday and wall-clock start/end in the selected timezone, between two inclusive local dates, limited to at most 26 occurrences. Derive each occurrence in local calendar time rather than by repeatedly adding 168 UTC hours. Reject a series containing an invalid local time. Materialize occurrences with stable IDs and a series ID, and retain local recurrence information. Check all generated intervals against one another, existing active bookings, and maintenance before committing the entire series atomically.

Permit moving or cancelling one occurrence without moving or deleting the others. Allow editing a complete series only through an explicit preview of all affected occurrences; reject the entire proposed change if any occurrence would conflict. Clearly distinguish a single-occurrence action from a series action. Preserve previously accepted exceptions when merely viewing or reloading the series; for whole-series replacement, explicitly show which exceptions are replaced before confirmation.

Protect edits and cancellations with an expected version. A stale browser must receive a conflict and a chance to reload the current booking, not overwrite a newer edit. Create operations use persistent idempotency keys. A repeated creation request returns the existing booking or series. A reused key with different content is rejected.

## Concurrency and invariants

Availability in the UI is advisory. The server must perform the definitive overlap check and insertion/update as one concurrency-safe transaction. If two sessions concurrently try to create overlapping reservations on one empty resource, at most one may be confirmed. A process-local client flag or disabling one user's button is not sufficient. An identical test on different resources may succeed for both.

Create a maintenance interval with the same conflict semantics: reject it if it would overlap a confirmed booking, rather than invalidating that booking silently. Calendar, list, availability search, series details, and JSON export must reflect the same committed state. Preserve an append-only application history for creation, edit, cancellation, and series operations; an application audit trail need not claim resistance against an administrator editing the database.

## Deterministic demonstration data

Seed rooms `room-aurora`, `room-boreal`, `room-cascade` and equipment `kit-camera`, `kit-projector`. Seed Aurora with a confirmed booking on 2026-09-14 from 10:00 to 11:00 Europe/Berlin and a maintenance block from 13:00 to 14:00 on that date. A reservation from 11:00 to 12:00 is valid; 10:30 to 11:30 and 12:30 to 13:30 are invalid.

On a different free resource, a weekly Sunday series at 09:00–10:00 Europe/Berlin for 2026-03-22 and 2026-03-29 must remain at 09:00 local on both dates. Its starts correspond to 08:00Z and 07:00Z respectively. The input 2026-03-29 02:30 Europe/Berlin must be rejected as nonexistent; 2026-10-25 02:30 must be rejected as ambiguous. These are fixed benchmark fixtures, not a dependence on the runtime's current date.

## Presentation and bounded scope

Make conflicts explainable: show the blocking booking or maintenance interval, retain the user's draft, and offer a way to choose another resource or time. Render booking status clearly, preserve a selected date across reload, and support keyboard entry rather than relying on drag-and-drop. A drag operation, if provided, must use the same validated transaction as form editing. Include availability search over a requested interval and JSON export of bookings, series, and blocks.

Authentication, invitations, email, external calendar synchronization, payment, arbitrary RRULE syntax, and optimization across multiple resources are out of scope. Correct interval semantics, DST-aware local recurrence, stable occurrence identity, atomic writes, and honest conflict recovery are the core benchmark criteria.

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

# Public acceptance scenarios: Resource Booker: Conflict-Free Reservations

These are model-visible domain checks, not an automated test suite. Start each independent scenario from a documented clean seed or explicitly record which preceding state it uses. UI paths must be exercised in the browser; concurrency, authorization, and durability must also be checked against real server responses and persisted state. Statuses are pass, fail, blocked, or not-run; only observed evidence earns pass. Fixed fixtures illustrate the rules, not permission to hard-code outcomes.

## BOOK-01: Interval boundaries

**Exercise:** On seeded Aurora, book 11:00–12:00 Europe/Berlin on 2026-09-14; attempt 10:30–11:30 and 12:30–13:30.

**Expected:** The adjacent booking succeeds. The overlaps with the booking and maintenance block fail without side effects.

## BOOK-02: Concurrent contenders

**Exercise:** Use two independently authenticated-or-isolated browser sessions and simultaneous API submissions for the same free Boreal interval.

**Expected:** Exactly one succeeds; one receives a conflict. Only one durable booking exists. Repeat on different resources and both succeed.

## BOOK-03: Local-time recurrence

**Exercise:** Create the two Sunday 09:00 Berlin occurrences in the task. Try the nonexistent and ambiguous local times.

**Expected:** Occurrences start at 08:00Z and 07:00Z; local 09:00 is retained. Invalid wall-clock inputs are rejected, not shifted.

## BOOK-04: Exception and atomic series edit

**Exercise:** Move one occurrence. Then try a whole-series change with one occurrence overlapping maintenance.

**Expected:** The single exception affects only that ID. Failed series replacement leaves every original occurrence unchanged.

## BOOK-05: Stale editor and idempotency

**Exercise:** Edit the same booking from two sessions, then repeat a successful creation request with its original key.

**Expected:** Stale edit is rejected; successful creation is not duplicated; different payload with the same key fails.

## BOOK-06: Restart and alternate views

**Exercise:** Restart, open calendar and list views, cancel a booking, then query availability and export.

**Expected:** All views agree; cancelled intervals are free, history is retained, and stored times do not drift.

## Completion

Leave the complete source in `project/` and the evidence directory beside it. Return a concise delivery note with the project path, exact setup/start/test/reset commands, observed test outcomes, and remaining failures or blocked checks. The application must run from the delivered files without depending on this benchmark package. Do not replace the source delivery with a code listing or a proposed implementation.
