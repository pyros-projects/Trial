# Project Planner: Dependencies and Capacity

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
Create Project Planner, a small scheduling application with a task table, dependency editor, resource view, interactive Gantt chart, and explainable recalculation. The task ID is `30-project-planner`. The goal is a correct, bounded planner, not an unsupported promise of globally optimal scheduling.

## Model and calendar

A project has a start date, a Monday–Friday working calendar, named resources, and tasks. Each task has a stable ID, name, nonnegative integer priority, integer duration in working days, zero or one assigned resource, zero or more finish-to-start predecessors, and an optional not-before date. Ordinary task duration is positive. Milestones have duration zero and no resource. Each resource has capacity one; tasks are nonpreemptive. Holidays, part-time calendars, task splitting, and other dependency types are out of scope.

Represent the schedule in integer working-day offsets from the project start: start >= 0 and finish = start + duration, with occupied intervals `[start, finish)`. Convert offsets to dates consistently. A finish date is the next available working-day boundary; show both that exclusive boundary and an understandable last-workday label if useful. A zero-duration milestone occupies no capacity. Dates falling on weekends snap to the next working day for project start and not-before constraints, with visible feedback. Do not use elapsed milliseconds as the definition of working-day duration.

## Required deterministic scheduler

Use the following serial schedule-generation rule. Begin with no tasks scheduled. Among unscheduled tasks whose predecessors have already been scheduled, select the task with the lowest numeric priority, breaking ties by stable task ID in lexicographic order. Its earliest candidate start is the maximum of zero, its not-before working-day offset, and all predecessor finish offsets. Place it at the earliest start on or after that candidate where its entire duration fits in consecutive working-day slots on its assigned resource. Unassigned tasks need no resource capacity. Mark it scheduled and repeat. A milestone uses its earliest candidate boundary. This algorithm is deterministic but need not be optimal; explain it in the UI.

Validate before scheduling: missing predecessors, duplicate IDs, self-dependencies, cycles, invalid durations, and references to nonexistent resources must be rejected without corrupting the current plan. Use stable ordering; repeated recalculation of the same input must produce identical business results. Editing a task, resource assignment, dependency, priority, or not-before date triggers recalculation across the affected plan, not just a moved Gantt rectangle.

## Critical path and explanations

Separately compute dependency-only earliest starts/finishes, latest starts/finishes, total float, and critical tasks using the working-day durations and finish-to-start graph, assuming unlimited resources and ignoring not-before constraints. Use project offset zero and a virtual common finish after all terminal tasks. Label these as dependency-only CPM values, not resource-constrained float. Show the actual resource-constrained completion offset separately so users can see capacity-induced delay.

For any scheduled task, explain the predecessor bound, not-before bound, resource blocking intervals, and final chosen start. When a resource conflict delays a task, identify the previously scheduled task occupying it. Never show a plan as conflict-free while two positive-duration tasks overlap on a capacity-one resource.

## Editing and persistence

Provide add/edit/delete task, predecessor selection, resource assignment, priority editing, and milestone creation. Deleting a task with dependents requires an explicit choice to remove those edges or cancel deletion; never leave dangling references. Dragging a Gantt bar changes the task's not-before constraint, with a preview and the same scheduler validation as the form. It must not assign an impossible arbitrary start. A drag or bulk import is one undoable action. Undo/redo restores source task data and then deterministically recalculates all views.

Save named plans and immutable snapshots on the backend. Use a plan version for stale-save detection. Import/export a validated JSON plan containing source task data, and export the computed schedule as CSV with IDs, resource, predecessor IDs, start/finish offsets, dates, duration, and dependency-only float. A malformed import must not replace a valid plan. Reload and process restart must preserve the last committed plan without accidental reseeding.

## Deterministic fixture

Use project start Monday 2026-09-07, resources R1 and R2, and these tasks with no not-before constraints: T1 Design, duration 2, priority 1, R1, no predecessors; T2 Backend, duration 3, priority 2, R1, predecessor T1; T3 UI, duration 2, priority 3, R1, predecessor T1; T4 Test, duration 1, priority 4, R2, predecessors T2 and T3; T5 Ship, duration 0, priority 5, no resource, predecessor T4.

The required schedule offsets are T1=[0,2), T2=[2,5), T3=[5,7), T4=[7,8), T5=[8,8). The resource-constrained project completion is offset 8, corresponding to 2026-09-17. Dependency-only completion is offset 6; T1, T2, T4, and T5 have zero float, while T3 has one day of float. Do not confuse the six-day unconstrained critical path with the eight-day resource-constrained schedule.

Increase T1 duration to 3. The recalculated offsets are T1=[0,3), T2=[3,6), T3=[6,8), T4=[8,9), T5=[9,9). One undo restores the original plan and offsets. Attempt to add T5 as a predecessor of T1: reject the cycle and leave the valid plan unchanged.

## Presentation and tests

Use a practical, polished planning interface with an editable task table, readable Gantt, resource occupancy lanes, dependency lines, critical-path toggle, working-day headers, and a task explanation panel. Select a task in any view and highlight the same identity everywhere. Keep essential actions usable on narrow screens by switching between table, timeline, and details.

Tests must verify the exact fixture schedule and CPM values, resource nonoverlap, deterministic tie-breaking, weekend conversion, milestone boundaries, cycles, drag-derived not-before changes, undo, stale saves, and JSON round trips. No cost accounting, staffing optimization, arbitrary calendars, or distributed collaboration is required. The benchmark measures consistency between source model, schedule, chart, explanation, and persisted state.

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

# Public acceptance scenarios: Project Planner: Dependencies and Capacity

These are model-visible domain checks, not an automated test suite. Start each independent scenario from a documented clean seed or explicitly record which preceding state it uses. UI paths must be exercised in the browser; concurrency, authorization, and durability must also be checked against real server responses and persisted state. Statuses are pass, fail, blocked, or not-run; only observed evidence earns pass. Fixed fixtures illustrate the rules, not permission to hard-code outcomes.

## PLAN-01: Exact deterministic schedule

**Exercise:** Load the seed plan and inspect table, Gantt, resource lanes, and export.

**Expected:** Offsets are T1 0–2, T2 2–5, T3 5–7, T4 7–8, T5 8–8. Completion is 2026-09-17; no R1 overlap exists.

## PLAN-02: Critical path versus capacity

**Exercise:** Inspect dependency-only CPM and actual scheduled finish.

**Expected:** Dependency-only duration=6, constrained duration=8; T3 float=1 and T1/T2/T4/T5 float=0.

## PLAN-03: Propagation and undo

**Exercise:** Increase T1 duration to 3 and undo once.

**Expected:** Changed offsets become 0–3, 3–6, 6–8, 8–9, 9–9. Undo restores all source values and original offsets consistently.

## PLAN-04: Cycle rejection and delete safety

**Exercise:** Add T5 as predecessor of T1 and try deleting a task with dependents.

**Expected:** Cycle is rejected with no plan mutation. Delete either explicitly removes affected edges or is cancelled; no dangling reference remains.

## PLAN-05: Drag and calendar semantics

**Exercise:** Drag a task to a later not-before date, including a weekend target; inspect its explanation and resource occupancy.

**Expected:** Drag changes a visible constraint, weekend snaps forward, scheduler remains deterministic, and no capacity/dependency rule is violated.

## PLAN-06: Restart, import, and stale save

**Exercise:** Save, restart, reload, import malformed JSON, and save competing edits from two tabs.

**Expected:** Committed plan persists, invalid import leaves it intact, stale save conflicts, and JSON round trip yields the same schedule.

## Completion

Leave the complete source in `project/` and the evidence directory beside it. Return a concise delivery note with the project path, exact setup/start/test/reset commands, observed test outcomes, and remaining failures or blocked checks. The application must run from the delivered files without depending on this benchmark package. Do not replace the source delivery with a code listing or a proposed implementation.
