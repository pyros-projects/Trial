# Field Notebook: Offline Inspections and Sync

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
Create Field Notebook, an offline-capable maintenance inspection app with a real local server and durable synchronization. The task ID is `27-field-notebook`. A technician must be able to open an assigned inspection, complete checks, enter measurements, attach a photo, reload while disconnected, and later synchronize without silently losing either their work or somebody else's edits.

## Inspection model and workflow

Each inspection has a stable ID, asset name, version, draft/submitted status, a fixed set of required checklist items, numeric temperature and pressure measurements, a free-text note, and photos with stable client-generated IDs. Temperature must be finite and between -20 and 120 inclusive; pressure between 0 and 25 inclusive. Notes may contain up to 10,000 characters. Accept PNG and JPEG photos up to 2 MiB each with a maximum of five per inspection; store actual bytes, not only an object URL that stops working after reload.

Submission requires all required checklist items complete, both valid measurements present, and no unresolved conflict. Once submitted, the inspection is read-only in this bounded app. An offline submission is a pending submission request, not a confirmed server submission. The server must enforce the same transition rules. Provide an inspection list, detail form, photo gallery, local draft indicator, sync queue, and conflict-resolution view.

## Offline persistence

After one successful online visit, a service worker must cache the app shell and required static assets so the installed application can reload offline at its own origin. First-ever installation while offline is not required. Use IndexedDB or an equivalent durable browser database for inspection snapshots, draft changes, outbox operations, photos, and server base versions. Do not use localStorage for photo blobs or rely on in-memory state.

Commit a local edit and its outbox entry atomically. Browser refresh, tab closure/reopen, temporary loss of the local backend, and an interrupted upload must not discard accepted local input. Display distinct local-only, queued, syncing, synced, failed, and conflict states. Network status is a hint, not proof that the backend is reachable. Retry with bounded backoff and provide a manual retry action without duplicating the queued operation.

## Sync and conflict semantics

A sync operation carries a stable operation ID, inspection ID, expected server version, complete proposed document or a documented patch, and stable attachment IDs. The server persists the operation fingerprint and committed result in the same transaction as the document mutation. Replay of an accepted operation returns its existing result even if the inspection now has a newer version. Reusing the key with different content fails. Upload deduplication must not create multiple photos for one attachment ID.

Reject a stale version with a conflict response including the current server document and version. Do not silently use last-write-wins. Retain the local proposal and its original base. The conflict UI shows base, local, and server values for changed fields, including checklist entries and attachment presence. Let the user choose values per conflicting field, inspect a merged preview, and submit a new operation against the current version. Preserve independent changes from either side in the proposed merge. Conflicting submission state must not be bypassed: a server-submitted inspection remains read-only, with local edits exportable rather than silently applied.

A full CRDT, distributed peer-to-peer sync, and multi-master server are not required. Explicit optimistic versions and recoverable conflict resolution are sufficient. Failed operations and superseded conflicts must remain explainable in local history; clearing the sync queue must never silently delete unsynchronized work. Provide export of a local draft bundle containing notes, measurements, checklist, and photo bytes or a documented portable encoding for emergency recovery.

## Deterministic two-session scenario

Seed inspection `INS-001` for `Pump station 7`, version 1, draft, checklist items `power_isolated` and `housing_checked` both false, temperature 20, pressure 2, note `Initial inspection`, and no photos. Seed a second independent inspection so the list is not hard-coded to one document.

In isolated browser context A, load INS-001, disconnect the browser from its local backend, check power_isolated, set note to `Local bearing note`, and attach a PNG. Reload while still offline: all edits and photo bytes must remain. In context B, while online, change temperature to 42 and note to `Server vibration note`, producing version 2. Reconnect A: it must detect the conflicting note rather than overwrite B. The proposed merge keeps A's checklist/photo and B's independent temperature change. Select A's note and commit against version 2 to obtain version 3. Replaying that accepted sync operation leaves version and attachment count unchanged.

In a separate run, complete both checklist items and valid measurements offline, request submission, reconnect, and verify a server-confirmed submitted state. Try to submit with a missing measurement through a direct API call; the server must reject it.

## Presentation and tests

Design a touch-friendly practical field app, not a debug-only form. Show a clear persistent connectivity/sync bar, large checkboxes, measurement units and validation, photo thumbnails, queued changes, and an explicit merge screen. Narrow-screen use is a core requirement, while desktop should remain efficient.

Automated tests must exercise version conflicts, idempotent replay after a later version exists, rejected invalid submission, attachment duplication, and stored outbox recovery. Browser validation must include real offline reload at the top-level application origin using separate browser contexts; two tabs sharing storage do not simulate independent devices. The benchmark emphasizes recoverability, honest synchronization status, and preservation of actual user work.

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

# Public acceptance scenarios: Field Notebook: Offline Inspections and Sync

These are model-visible domain checks, not an automated test suite. Start each independent scenario from a documented clean seed or explicitly record which preceding state it uses. UI paths must be exercised in the browser; concurrency, authorization, and durability must also be checked against real server responses and persisted state. Statuses are pass, fail, blocked, or not-run; only observed evidence earns pass. Fixed fixtures illustrate the rules, not permission to hard-code outcomes.

## FIELD-01: Offline shell and durable input

**Exercise:** Visit online once in context A, go fully offline, edit INS-001, add a real photo, then reload while offline.

**Expected:** The app shell opens; note, checklist, pending operation, and actual photo bytes survive.

## FIELD-02: Independent device conflict

**Exercise:** Context B changes temperature to 42 and the note online while A has unsynced edits. Reconnect A.

**Expected:** A receives a version conflict. Neither side is silently overwritten; base/local/server values are available.

## FIELD-03: Merge and replay

**Exercise:** Keep A note, A checklist/photo, and B temperature; sync against version 2 and replay the accepted operation.

**Expected:** Version becomes 3 once, photo count remains one, and the merged document preserves all selected and independent changes.

## FIELD-04: Pending versus confirmed submission

**Exercise:** Complete a different inspection offline and request submission; reconnect.

**Expected:** Offline status says pending, not confirmed. Server confirms only after validating and committing the complete inspection.

## FIELD-05: Invalid API writes and interrupted uploads

**Exercise:** Submit missing measurements directly; interrupt a photo upload and retry with the same attachment ID.

**Expected:** Invalid submission is rejected server-side; retry cannot create duplicate attachments or lose the local photo.

## FIELD-06: Restart and submitted conflict

**Exercise:** Restart backend and browser; separately let B submit an inspection before A reconnects with edits.

**Expected:** Accepted state and outbox persist. A cannot overwrite submitted state, but can inspect and export its retained local draft.

## Completion

Leave the complete source in `project/` and the evidence directory beside it. Return a concise delivery note with the project path, exact setup/start/test/reset commands, observed test outcomes, and remaining failures or blocked checks. The application must run from the delivered files without depending on this benchmark package. Do not replace the source delivery with a code listing or a proposed implementation.
