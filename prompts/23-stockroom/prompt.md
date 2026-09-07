# Stockroom: Inventory and Order Fulfillment

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
Create Stockroom, a focused inventory and fulfillment application for a small equipment storeroom. The task ID is `23-stockroom`. Deliver useful screens for items, stock movements, orders, reservations, shipments, returns, and a searchable audit trail. Do not build storefront, payment, tax, procurement, or accounting subsystems.

## Domain model and invariant

An item has a stable ID, unique case-sensitive SKU, display name, and physical quantity measured in indivisible integer units. Orders contain one or more positive-quantity lines keyed by SKU. Preserve line identities after partial fulfillment. Track unfulfilled, reserved, shipped, cancelled, and returned quantities explicitly rather than inferring everything from a single status label.

For each SKU, `available = physical - outstanding_reserved`; physical, outstanding reservations, and available may never be negative. Receiving stock increases physical quantity. Reserving changes outstanding reservations but not physical stock. Shipping an allocated quantity decreases physical stock and that allocation by the same amount. Cancelling an unshipped remainder releases its reservation without restoring stock that was never shipped. A return increases physical stock and the line's returned quantity, but does not reopen the original order or create a new reservation. Total returned units must not exceed actually shipped units for that line.

Record immutable typed ledger events with event IDs, SKU, quantity, linked order/line/shipment/return where relevant, operation key, and timestamp. Persist allocation records so the app can explain which order owns each reserved unit. Derived counters may be cached, but must be updated transactionally with the ledger and allocations. Include an inspectable reconciliation view that recomputes stock and reservations from persisted events and detects disagreement rather than silently fixing it.

## Order and reservation workflow

Creating an order does not reserve stock. A separate reserve action allocates all remaining unreserved, uncancelled units of every line in one all-or-nothing transaction. If any line lacks stock, reserve nothing. Already allocated units are not allocated again. The UI must distinguish an unreserved order from an order confirmed as reserved and show precisely why an attempt failed.

Support partial shipment of selected allocated quantities per line, cancellation of the remaining unshipped quantities, and partial returns linked to a real shipment. Every requested amount must be a positive integer and be checked against the committed remaining amount inside the transaction. Reserve, ship, cancel, receive, and return operations must be durable and idempotent using client-supplied operation keys. A request repeated after a lost response must not create a second stock movement. Payload changes under a previously used key are conflicts.

Use optimistic versions for order edits and a transactional check for shared stock. Two sessions reserving the same last units must not both succeed. A server restart after a committed shipment must not erase its effect or make its idempotency record disappear. A failed multi-line transaction must leave no partially allocated or partially shipped order behind.

## Deterministic scenario

Seed SKU `KIT-100` with exactly 10 physical units and no reservations, and SKU `LENS-200` with 0 units. Create orders O1 and O2 for seven KIT-100 units each. Concurrent reserve attempts must result in one fully reserved order and one failure, not two partial allocations. After the winner reserves seven, the counters are physical 10, reserved 7, available 3.

Ship four units from the winning order: physical 6, reserved 3, available 3. Repeat the same shipment request with the same key: nothing changes and the original shipment result is returned. Cancel the remaining three: physical 6, reserved 0, available 6. Return two of the four shipped units: physical 8, reserved 0, available 8. Repeating that return key does not increase stock again; attempting three more returns is invalid because only two additional shipped units remain returnable.

A separate order requiring one KIT-100 and one LENS-200 cannot reserve either line until LENS-200 is received. Demonstrate this rollback case in the seed scenarios or a reproducible test. No operation is allowed to bypass these rules by changing an aggregate counter directly in the frontend.

## Interaction, reporting, and scope

Provide item search and stock badges, an order detail panel with per-line quantities, an allocation inspector, an explicit shipment form, return history, and a ledger table with filters. Errors must preserve form input and show the latest committed quantities. Export a JSON snapshot with items, orders, allocations, shipments, returns, and ledger records plus a CSV ledger. The stock reconciliation view must derive its numbers from real records.

Include meaningful server-level tests for the arithmetic sequence above, duplicate operation keys, conflicting reserve requests, invalid over-ship and over-return operations, and a multi-line rollback. Include at least one browser-oriented test for the primary reserve → partially ship → cancel → return flow. Simulated concurrency must involve independent requests, not two sequential UI clicks asserted to be simultaneous.

The desired result is a small application whose counters, order states, and event history stay consistent after mistakes and retries. Transaction boundaries, idempotency, domain modeling, useful errors, and persistence matter more than a dashboard full of graphs.

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

# Public acceptance scenarios: Stockroom: Inventory and Order Fulfillment

These are model-visible domain checks, not an automated test suite. Start each independent scenario from a documented clean seed or explicitly record which preceding state it uses. UI paths must be exercised in the browser; concurrency, authorization, and durability must also be checked against real server responses and persisted state. Statuses are pass, fail, blocked, or not-run; only observed evidence earns pass. Fixed fixtures illustrate the rules, not permission to hard-code outcomes.

## STOCK-01: Competing reservations

**Exercise:** Create two seven-unit KIT-100 orders against stock 10. Submit reservations concurrently.

**Expected:** One all-or-nothing reservation succeeds: physical=10, reserved=7, available=3; the other has no allocation.

## STOCK-02: Partial shipment and retry

**Exercise:** Ship four from the winner and repeat with the same operation key.

**Expected:** One shipment exists; physical=6, reserved=3, available=3; both responses refer to the same committed operation.

## STOCK-03: Cancellation and return

**Exercise:** Cancel the remaining three, return two shipped units, and replay the return.

**Expected:** After cancel: 6/0/6. After return and replay: 8/0/8. The original order is not reopened.

## STOCK-04: Invalid amounts and key conflict

**Exercise:** Attempt an excessive return, over-shipment, noninteger quantity, and a reused key with different payload.

**Expected:** All fail; no ledger event or aggregate quantity changes.

## STOCK-05: Multi-line atomicity

**Exercise:** Attempt to reserve an order containing available KIT-100 and unavailable LENS-200.

**Expected:** Neither line is allocated. After receiving LENS-200, a new valid reserve attempt can succeed.

## STOCK-06: Restart and reconciliation

**Exercise:** Restart after shipment; inspect order, ledger, allocations, JSON export, and reconciliation view.

**Expected:** All durable representations agree; replaying the committed key after restart is still idempotent.

## Completion

Leave the complete source in `project/` and the evidence directory beside it. Return a concise delivery note with the project path, exact setup/start/test/reset commands, observed test outcomes, and remaining failures or blocked checks. The application must run from the delivered files without depending on this benchmark package. Do not replace the source delivery with a code listing or a proposed implementation.
