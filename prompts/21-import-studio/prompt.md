# Import Studio: Reliable Data Onboarding

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
Create Import Studio, a polished data-onboarding application for importing asset records into a durable catalog. Its primary workflow is upload → map → transform → validate → correct or exclude → preview changes → commit → inspect history. The task ID is `21-import-studio`.

## Product and data model

Use a target record with a stable internal ID plus a case-sensitive, trimmed, unique `external_id`; nonempty trimmed `name`; nullable trimmed `category`; integer `unit_price_cents >= 0`; integer `quantity >= 0`; Boolean `active`; and a `note` that preserves embedded newlines. Preserve leading zeros in external IDs. An empty category becomes null, but an empty identifier, name, price, quantity, or Boolean is an error. No implicit locale-dependent coercion is allowed.

Support UTF-8 CSV with optional BOM, comma or semicolon delimiters, CRLF or LF records, quoted delimiters, doubled quotes, and quoted multiline fields. Support a JSON array of row objects. Limit accepted upload size and row count explicitly, with a minimum capacity of 5,000 rows. Large or invalid files must fail visibly without changing the catalog. Surface parsing errors separately from per-row validation errors.

Provide a saved mapping profile from source columns to target fields and an ordered transformation pipeline with at least trim, explicit empty-to-null, explicit Boolean parsing (`true`, `false`, `1`, `0`, case-insensitive for the words), integer parsing, and decimal-price-to-cents. The price transform accepts one explicitly selected decimal separator (`.` or `,`), no thousands separator, and at most two fractional digits; use exact decimal or integer arithmetic, not floating-point rounding guesses. Allow a row correction to override a transformed value without losing the original uploaded value. A mapping profile must survive reload and produce the same transformation on reuse.

## Preview and commit semantics

Within one import, every row sharing a duplicate external ID must be flagged as conflicting, even if its content happens to match. Do not silently choose the first or last row. A user may correct an ID or explicitly exclude a row. Commit is allowed only when every nonexcluded row is valid. The UI must distinguish excluded rows, errors, creates, updates, and unchanged rows and allow filtering each group.

The import strategy is upsert by external ID. Existing records retain their internal identities; fields are replaced by the complete validated incoming record. No absent catalog record is deleted. An identical incoming record is unchanged and must not produce a fake update. Show original values, proposed values, and per-field differences before confirmation.

Associate the preview with a catalog revision. Atomically reject a stale commit with HTTP 409 or a clearly documented equivalent conflict status if any catalog mutation occurred after its preview. No row is committed in that case. A refreshed preview must show the new truth. Commit the accepted rows, catalog revision, immutable import summary, and persistent idempotency result together. A new import of identical content produces zero creates and zero updates; a retry of an already committed operation key returns its previous report rather than creating another import.

Maintain an import history with file name, mapping profile, actor label, timestamps, counts, row-level outcomes, and the catalog revision affected. Export the current catalog as JSON and CSV, and export a report containing original row numbers, validation messages, exclusions, and changes. Display the actual durable catalog in a searchable, sortable table. A small catalog-record editor must permit manual changes, incrementing the same revision used for stale-preview detection.

## Deterministic demonstration data

Seed `A001` as name `Cable`, category `parts`, price 1250 cents, quantity 10, active true, note empty; seed `A002` as `Bracket`, `parts`, 250 cents, quantity 5, active true, note empty. Include an adversarial CSV with these six logical data rows: updated `A001` quantity 12 at price `12.50`; new `A003` named `Lens, wide` at `7.99`, quantity 2, with a quoted two-line note; `A004` at `3.00` with quantity `oops`; two different rows both named `A005`; and `A006` at `1.25`, quantity 4, active false. Use fixture files when supplied, but ship equivalent data so the finished app does not depend on the benchmark package.

With the period-decimal profile, the quantity error corrected to 3 and both duplicate A005 rows excluded, the preview must show one update and three creates. Commit must leave exactly five catalog records, including untouched A002. Reimporting the four cleaned accepted rows must report four unchanged records. A separate semicolon CSV exercises a comma-decimal price of `1,25`, which must become exactly 125 cents under its explicitly selected profile.

## Presentation and bounded scope

Make this feel like a usable data tool: a step indicator, virtualized or efficiently paged data grid, column mapping, error navigation, before/after inspector, explicit commit confirmation, and a history detail view. Retain work-in-progress mapping and corrections while navigating within the import. No machine-learning entity resolution, Excel binary format support, background distributed workers, or user-account system is required.

The benchmark prioritizes exact parsing, preserved identities, honest previews, atomicity, idempotency, correction UX, and durable history. A grid populated with precomputed outcomes or a commit button that only mutates browser state does not satisfy the task.

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

# Public acceptance scenarios: Import Studio: Reliable Data Onboarding

These are model-visible domain checks, not an automated test suite. Start each independent scenario from a documented clean seed or explicitly record which preceding state it uses. UI paths must be exercised in the browser; concurrency, authorization, and durability must also be checked against real server responses and persisted state. Statuses are pass, fail, blocked, or not-run; only observed evidence earns pass. Fixed fixtures illustrate the rules, not permission to hard-code outcomes.

## IMP-01: Parsing and correction

**Exercise:** Import the adversarial CSV. Verify the embedded newline remains within one row, Lens, wide remains one field, A004 is invalid, and both A005 rows are flagged. Correct A004 quantity to 3 and exclude both A005 rows.

**Expected:** The four included rows are valid; preview shows creates=3, updates=1, unchanged=0, excluded=2; no catalog writes yet.

## IMP-02: Commit and replay

**Exercise:** Commit with one operation key, repeat that exact commit, then import the cleaned four-row CSV under a new operation key.

**Expected:** First and retried response describe the same import. Catalog has five records. New import reports unchanged=4 with zero creates/updates.

## IMP-03: Stale preview

**Exercise:** Prepare a preview, mutate A002 in a second session, then attempt the prepared commit.

**Expected:** A conflict is returned and zero staged changes apply. Refreshing preview re-evaluates against the new revision.

## IMP-04: Decimal and identifier fidelity

**Exercise:** Use the semicolon/comma-decimal fixture, including ID 0007 and price 1,25. Try an ambiguous thousands-style value.

**Expected:** ID stays 0007, price is exactly 125 cents, ambiguous or malformed prices are rejected.

## IMP-05: Persistence and exports

**Exercise:** Restart the backend after a successful import, reopen history, and export JSON plus CSV.

**Expected:** Catalog, identities, mapping profile, counts, and multiline notes are preserved. Reimporting exported data with a corresponding mapping does not create duplicates.

## IMP-06: Failure rollback

**Exercise:** Submit malformed JSON, an oversized file, an unresolved duplicate, and a reused operation key with different content.

**Expected:** Each fails explicitly without a partial catalog write or a misleading success notification.

## Completion

Leave the complete source in `project/` and the evidence directory beside it. Return a concise delivery note with the project path, exact setup/start/test/reset commands, observed test outcomes, and remaining failures or blocked checks. The application must run from the delivered files without depending on this benchmark package. Do not replace the source delivery with a code listing or a proposed implementation.
