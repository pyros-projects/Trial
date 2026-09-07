# Approval Desk: Versioned Change Requests

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
Create Approval Desk, a compact technical change-request application with real authenticated sessions, server-enforced permissions, immutable revisions, two-person approval, and an audit history. The task ID is `28-approval-desk`. A hidden button is not authorization, and a green badge is not evidence that the approved content is still the content being shown.

## Accounts and authorization

Seed five local demonstration accounts: Alice and Erin as requesters, Bob and Cara as reviewers, and Dana as auditor. Use documented synthetic passwords intended only for this local benchmark, password hashing, and backend session validation. Do not use a frontend role selector or a client-supplied role header as authority. Reviewer accounts may also create their own requests; an author may never approve their own request even when they have the reviewer role.

Requesters may create requests and read/edit their own drafts, read their own submitted history, and submit or withdraw their own eligible revisions. They must not read another requester's private draft. Reviewers may read all submitted revisions and their own drafts, but not edit another author's content. Auditors may read all requests and audit history but may not mutate business state. Logout invalidates the session. Guard direct API access, object ownership, and state transitions, not just menu visibility.

Serve session cookies with appropriate local-development settings and protect mutation routes against cross-site requests with a documented same-origin/CSRF strategy. Do not add OAuth, password reset, email, tenant management, or production identity-provider claims. Seed credentials are benchmark data, never real secrets.

## Request and revision model

A request has a stable identity, author, title, description, risk category, and a sequence of revision IDs. Title, description, and risk are revision content, not mutable fields shared across all historical revisions. A revision has a parent revision, content, version, status, submission timestamp, and linked decisions. Published/submitted content is immutable. Editing a submitted, rejected, withdrawn, or approved revision creates a new draft revision; it cannot mutate the old one.

Allow one active draft per request. Draft saves require an expected draft version to prevent stale overwrites. Submitting freezes that draft and makes it eligible for review. Statuses are draft, submitted, approved, rejected, and withdrawn. Two distinct eligible reviewer approvals on the same submitted revision produce approved. One rejection makes that revision rejected. Author withdrawal is permitted while submitted but not after approval/rejection. A terminal revision can only be superseded by a new draft; its history remains unchanged.

A reviewer may make one decision per revision. Repeated matching decision submissions are idempotent, and a second different decision by that reviewer is rejected. A reviewer cannot count twice by changing request IDs or clicking concurrently. Decisions must target the explicit revision ID, not whichever revision is currently latest. A direct attempt to approve an older terminal revision, one's own revision, or an unsubmitted draft must fail without creating a decision.

## Concurrency and history

Apply decision insertion and revision-state recomputation in one transaction. Two distinct reviewers concurrently approving a submitted revision must result in two preserved approvals and one approved revision, not a lost decision. Concurrent approval and rejection must serialize against the actual committed state: once a terminal state is reached, a later decision fails; no contradictory terminal state or third decision appears.

Record an append-only application audit event for each successful draft mutation, submission, decision, withdrawal, and revision creation, with actor, target request/revision, timestamp, operation, and a meaningful change summary. Failed authorization attempts must not mutate business state; they may be logged separately. Do not claim that the audit log is tamper-proof against the database administrator.

Comments are tied to a request and optionally a revision; they cannot change approval state. Request authors and reviewers with access may comment, auditors remain read-only. Render comments and descriptions safely as text; strings resembling HTML must not execute. Export a complete authorized request history as JSON including immutable content and decisions.

## Seed scenario and required behavior

Seed Alice's draft `CR-001`, titled `Increase worker concurrency`, risk `medium`, description `Raise worker count from 4 to 8`, and Erin's private draft `CR-002`. Bob and Cara approve CR-001 only after Alice submits revision 1. After both approvals, Alice creates revision 2 changing the worker count to 12. Revision 1 must remain approved with the original count of 8 and its two decisions; revision 2 must start as an unapproved draft with no inherited approvals.

Dana can inspect both revisions and audit history but direct PATCH/POST/DELETE attempts must be denied. Alice cannot fetch CR-002's private draft by guessing its ID. Bob can author another request, but an attempt to approve his own submitted revision must fail even though he is a reviewer. A forged role parameter or header must never elevate Alice's or Dana's permissions.

## Interface and tests

Provide role-appropriate request lists, draft editing, submit/withdraw actions, a reviewer inbox, an exact-revision review screen, revision comparison, decision history, and an audit timeline. Show the revision number prominently near every approve/reject action. Never display a latest draft as though it has the previous version's approval badge. Retain form drafts after a denied or stale request and explain how to refresh safely.

Tests must cover the full permission matrix through backend requests, object-level access, own-request review, duplicate/concurrent decisions, version-specific content after amendment, stale draft editing, and logout/session invalidation. The benchmark prioritizes authorization, state-machine correctness, content/decision identity, durable auditability, and a coherent workflow over decorative analytics.

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

# Public acceptance scenarios: Approval Desk: Versioned Change Requests

These are model-visible domain checks, not an automated test suite. Start each independent scenario from a documented clean seed or explicitly record which preceding state it uses. UI paths must be exercised in the browser; concurrency, authorization, and durability must also be checked against real server responses and persisted state. Statuses are pass, fail, blocked, or not-run; only observed evidence earns pass. Fixed fixtures illustrate the rules, not permission to hard-code outcomes.

## APPROVE-01: Revision-specific two-person approval

**Exercise:** Alice submits CR-001 revision 1; Bob and Cara approve it. Alice creates revision 2 with worker count 12.

**Expected:** Revision 1 remains approved with count 8 and two decisions; revision 2 is a separate unapproved draft with no inherited decisions.

## APPROVE-02: Backend permission matrix

**Exercise:** As Dana, attempt direct mutation routes. As Alice, fetch Erins private CR-002 draft; forge role input.

**Expected:** Requests are denied server-side without business-state changes, regardless of visible controls or forged role fields.

## APPROVE-03: Own-review and duplicate decisions

**Exercise:** Bob creates/submits a request and attempts self-approval; repeat a valid decision on another revision with new and repeated operation keys.

**Expected:** Self-approval fails. One reviewer contributes at most one decision per revision; matching replay does not increase the count.

## APPROVE-04: Concurrent reviews and terminal state

**Exercise:** Send Bob and Cara approvals concurrently on a fresh submitted revision, then attempt another decision.

**Expected:** Both approvals persist and state becomes approved; terminal revision refuses additional decisions.

## APPROVE-05: Stale drafts and safe rendering

**Exercise:** Edit one draft from two sessions, then add text resembling executable HTML in a permitted comment.

**Expected:** Stale save is rejected; untrusted content displays literally and never executes.

## APPROVE-06: Restart, export, and logout

**Exercise:** Restart and inspect/export full history, then logout and repeat an authenticated API request.

**Expected:** Content, decisions, and actor-linked audit survive; logged-out session is no longer authorized.

## Completion

Leave the complete source in `project/` and the evidence directory beside it. Return a concise delivery note with the project path, exact setup/start/test/reset commands, observed test outcomes, and remaining failures or blocked checks. The application must run from the delivered files without depending on this benchmark package. Do not replace the source delivery with a code listing or a proposed implementation.
