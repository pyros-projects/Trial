# Project Planning Studio

## Agentic development workflow

Build the complete application in one end-to-end agentic run. You may use the filesystem, shell, dependency tools, compilers, linters, tests, documentation, browser automation, and debugging tools from the beginning, within the permissions and budget assigned by the harness. Plan, implement incrementally, execute, inspect, diagnose, and improve your work throughout development. No previous implementation is assumed. Do not stop at a proposal, scaffold, screenshot, or partially connected demo.

Use the installed browser automation skill `agent-browser` to validate your work. Read the installed skill and its version-matched core workflow before use; consult its exploratory-testing workflow when available. If this capability is genuinely unavailable, use another available real-browser automation tool, record the substitution, and state any coverage that remains blocked. Do not fabricate successful tool use or let a missing optional tool prevent useful work with the tools you do have. The evaluator records tool availability separately from implementation quality.

## Validation

Exercise the actual main workflow using browser navigation, labeled controls, pointer and keyboard input, and screenshots. Merely loading the page, inspecting source code, or observing a DOM element does not establish that a feature works. For Canvas, WebGL, audio, games, and other non-DOM state, perform real interactions and inspect both rendered output and relevant live diagnostics. Check the browser console, uncaught errors, failed requests, and meaningful application state.

Check normal desktop and narrow viewports (at least 1280 x 800 and 390 x 844), input continuity, primary controls, error states, navigation, and any required pause/reset, import/export, or persistence behavior. Reproduce observed failures, fix their cause, and repeat the failed flow plus a compact regression test after material changes. Run the task-specific checks below against genuine application behavior. Do not modify benchmark requirements, supplied fixtures, expected results, or evaluator code to make a test pass.

Keep evidence in a sibling `evidence/` directory: an agent-authored `validation.md` with the exact steps and commands, observed results, failures, relevant screenshots/logs, fixes, and retest outcomes. Use pass, fail, blocked, or not-run honestly; a blocked check is not a pass. Do not write or invent an evaluator-owned score or report. End within the assigned budget with the best working implementation and an explicit account of remaining limitations.

### Standalone HTML delivery and runtime checks

Write the final application to `index.html` in the working directory. The delivered application must remain one self-contained file with the original runtime/dependency restrictions; development tools, test scripts, and a temporary local HTTP server for browser inspection are allowed and are not runtime dependencies of the delivered artifact. Keep evidence and test harnesses outside `index.html`.

Verify that opening the delivered file directly works as required, and that it does not fetch external assets or services. If your browser tool only supports local HTTP, also inspect the artifact's dependency assumptions, record the direct-file check as blocked rather than passed, and preserve direct-file compatibility. When checking via local HTTP, block external internet but leave that local server reachable; test without external cached resources. For audio, explicitly enable playback with a user gesture. Do not claim audio quality was heard when only meters or audio state were inspected.

## Application requirements

Create **Project Planning Studio**, a practical browser workspace for editing a plan and understanding why its tasks start when they do. Connect an editable task table, interactive Gantt, resource occupancy view, and task explanation panel to one real scheduling model. Deliver a single self-contained `index.html` with embedded HTML, CSS, JavaScript, and assets; no runtime libraries, external fonts, build step, network, backend, accounts, or external fixtures.

All project, task, resource, view, and undo state lives in this document's memory. Do not require cookies, localStorage, IndexedDB, service workers, shared storage, or access to the parent page. A fresh load opens the seed below. Reset restores it and clears history; users retain work through explicit downloads. Main editing and import/export must work in an opaque-origin iframe with scripts and downloads allowed, without clipboard permission.

### Source model and working calendar

A project has a name, start date, named resources, and tasks. Resources have stable IDs and integer capacity 1 through 4. A task has a stable unique ID, name, integer priority from 0 through 9999, integer duration from 0 through 260 working days, zero or one assigned resource, finish-to-start predecessor IDs, and an optional not-before date. IDs are nonempty and use ASCII letters, digits, underscores, or hyphens and compare in case-sensitive code-point order. Positive-duration tasks each occupy one unit of their resource for their entire interval; capacity does not change their duration. A duration-zero milestone has no resource and occupies no capacity. Unassigned tasks have no capacity limit. Support at least 50 tasks and eight resources; publish any larger-input limits rather than hanging or partially importing.

Use YYYY-MM-DD dates, a Monday-Friday calendar, no holidays, and integer working-day offsets from the project start. Normalize project start and not-before weekend dates forward to Monday with visible feedback. Reject impossible calendar dates and non-safe integers. Accept calendar dates only from 2000-01-01 through 2099-12-31, including normalized and derived dates. Limit the schedule to working-day offsets 0 through 2600 inclusive (a positive task may finish at 2600). Show these limits in the UI. Reject a proposed edit/import if a task cannot fit within the horizon or a derived date would exceed the supported range; preserve the existing plan instead of clipping work or searching indefinitely. Dates before project start impose offset zero. Offset zero is the normalized start date; task finish = start + duration with occupied interval `[start, finish)`. Display the exclusive finish boundary and label a positive task's last working date so a Friday ending is not mistaken for work on Monday. Convert by calendar working days, not elapsed milliseconds or the machine's daylight-saving interval.

Provide a readable Gantt axis of working days with weekend-break markers, dependency lines, milestone symbols, pan/zoom, and selection shared across all views. Resource lanes show per-day occupancy versus capacity, including the task IDs using each slot. Empty plans and unassigned tasks have clear states. Task names and imported text remain inert.

### Deterministic scheduling policy

Validate the whole proposed model and compute a valid schedule within the declared bounds before changing the current plan. Reject duplicate IDs, missing/self predecessors, cycles, invalid numbers/dates, unknown resources, and resource-assigned milestones. A rejected edit/import leaves source data, schedule, and undo history unchanged, with an explanation identifying the problem.

Rebuild the schedule from source data using this serial rule:

1. Begin with no tasks placed. Among unscheduled tasks whose predecessors have all been placed, choose the lowest numeric priority, then lexicographically smallest stable ID. Display row order and creation order do not break ties.
2. Its candidate boundary is the maximum of zero, its not-before offset, and every predecessor's placed finish.
3. Search from that boundary for the earliest consecutive working-day interval long enough for its duration where its resource occupancy plus one never exceeds capacity. Unassigned tasks need no slot search; milestones use their candidate boundary. Previously placed tasks stay fixed during this schedule build. Search earlier free gaps as well as space after the last booking.
4. Place the task and repeat until all are scheduled. Every valid source edit triggers the same deterministic recalculation across all views.

This policy is intentionally bounded and need not find a globally optimal schedule. Explain it briefly in the UI. A task inspector shows its predecessor bound, not-before bound, resource blocking intervals/task IDs, and chosen start. Never disguise a capacity conflict by drawing overlapping work as conflict-free.

### Dependency critical path versus actual delays

Separately compute dependency-only CPM: earliest starts/finishes, latest starts/finishes, total float, and zero-float tasks. Use durations and finish-to-start edges, offset zero for roots, and a virtual common finish after every terminal task; assume unlimited resources and ignore not-before constraints. Label these values **dependency-only**, not resource-constrained float. Empty-plan completion is zero.

Show dependency-only completion and actual scheduled completion separately. A critical-path toggle highlights zero-float tasks and edges whose endpoints both have zero float and whose predecessor earliest finish equals the successor earliest start. Resource waiting and not-before constraints receive separate labels. Resource capacity or a date constraint may lengthen the actual schedule without changing dependency-only CPM. Do not label that extra time as a newly computed dependency critical path.

### Editing and files

Provide task/milestone creation, inline or inspector edits, dependency selection, priority changes, resource assignment, and resource capacity editing. IDs stay stable when names or table order change. Deleting a task with dependents requires an explicit choice to remove those edges or cancel; undo restores the task and edges. Reject deletion of an in-use resource with a clear explanation.

Dragging a Gantt bar changes its not-before working-day boundary while preserving duration and dependencies. Show the requested constraint and a preview of the recalculated result; the scheduler may place the task later because of other constraints. Releasing a valid drag commits one undoable source edit. Escape cancels it. Also expose the same constraint through a labeled date control for keyboard/touch use. Clear-constraint, task edits, resource edits, drag, deletion, and valid import each support atomic undo/redo that restores source data then recalculates every view. Panning and selection do not add history entries.

Export/import documented JSON with `version: 1`, a `project` object containing `name` and `startDate`, a `resources` array of `id`, `name`, `capacity`, and a `tasks` array of `id`, `name`, `duration`, `priority`, `resourceId`, `predecessors`, `notBefore`. Use null for an unassigned resource or absent date constraint. Do not trust imported schedule caches; recompute them. Validate the whole file before replacing the project as one undoable action. Provide a file picker and text-entry path. Export all scheduled tasks as CSV with task/resource IDs, predecessors, duration, not-before date, actual start/finish offsets and dates, last working date, and dependency-only float; the last working date is empty for milestones. Use correct quoting. Export the current complete Gantt as SVG with task labels, dates, and a legend. Exports must reflect the current model, not canned pictures or hidden fixture tables.

### Embedded starting plan

Use project name Studio Launch, start **Monday 2026-09-07**, resource R1 Studio with capacity 1, and R2 Review with capacity 1. No task has a not-before constraint.

| ID | Name | Duration | Priority | Resource | Predecessors |
|---|---|---:|---:|---|---|
| T1 | Design | 2 | 1 | R1 | none |
| T2 | Build | 3 | 2 | R1 | T1 |
| T3 | Documentation | 2 | 3 | R1 | T1 |
| T4 | Review | 1 | 4 | R2 | T2, T3 |
| T5 | Launch | 0 | 5 | none | T4 |

Actual intervals are T1=[0,2), T2=[2,5), T3=[5,7), T4=[7,8), T5=[8,8). Completion boundary 8 is 2026-09-17. T2 works September 9, 10, and 11; its exclusive finish boundary is Monday September 14. Dependency-only completion is 6, with zero float on T1/T2/T4/T5 and float 1 on T3. Dependency-only T3 starts at 2 while actual T3 starts at 5 because R1 is occupied.

Changing R1 capacity to 2 produces T1=[0,2), T2=[2,5), T3=[2,4), T4=[5,6), T5=[6,6). From the original seed, instead set T2's not-before to offset 5 (2026-09-14): T2=[5,8), T3 fills the earlier gap [2,4), T4=[8,9), T5=[9,9), while T1 remains [0,2). Dependency-only CPM remains 6 in both variations. These outcomes illustrate the general policy; do not recognize task IDs to manufacture them.

### Usability and validation depth

Make the planner feel useful immediately: a compact project summary, legible task hierarchy/dependency labels, deliberate spacing, distinguishable critical/waiting states, and explanations reachable from a selected bar or resource slot. At 390 x 844 allow switching between table, Gantt, resources, and details; essential edit/file/Reset controls must stay reachable even when the timeline scrolls. Preserve selection and data through resizing. Correct scheduling, transparent delays, consistent edits, recoverable errors, and export fidelity take precedence over enterprise extras such as costs, staffing optimization, multiple calendars, or concurrent-user workflows.

---

# Public validation checks: Project Planning Studio

Exercise the actual browser application and record observed outcomes, not invented scores. Start each numbered check from Reset unless it explicitly continues its own preceding action. The seed demonstrates general scheduling rules; do not hard-code the tasks or expected intervals. Use pass, fail, blocked, or not-run honestly.

## PLAN-01: Seed across connected views

Inspect table, Gantt, resource lanes, task explanations, and CSV. Actual offsets are T1 [0,2), T2 [2,5), T3 [5,7), T4 [7,8), T5 [8,8); completion boundary is 2026-09-17. T2's last workday is 2026-09-11 and exclusive finish is 2026-09-14. R1 never exceeds capacity 1. Select T3 in each view and confirm the same task is highlighted everywhere.

## PLAN-02: Critical path and capacity

Verify dependency-only completion 6, T3 float 1, and T1/T2/T4/T5 float 0, separately from actual completion 8. Increase R1 capacity to 2: T3 becomes [2,4), T4 [5,6), T5 [6,6); T1/T2 are unchanged. Actual completion becomes 6, while dependency-only CPM does not change. One undo restores the original resource capacity and all actual intervals.

## PLAN-03: Propagation and range of effects

Increase T1 duration to 3: actual intervals become [0,3), [3,6), [6,8), [8,9), [9,9) for T1 through T5. Dependency-only completion becomes 7. Undo and redo must restore both source duration and every derived view consistently, not only the edited bar.

## PLAN-04: Drag, gap filling, and calendar

Drag T2's not-before boundary to offset 5, Monday 2026-09-14. Confirm T1 [0,2), T2 [5,8), T3 [2,4), T4 [8,9), T5 [9,9), with T3 filling the earlier free resource gap. Inspect the stored constraint and explanation; undo restores the seed. Through the date control enter Saturday 2026-09-12 for T2: visibly normalize to Monday and produce the same intervals. Cancel another drag with Escape and verify no state/history change.

## PLAN-05: Validation and safe deletion

Try adding T5 as a predecessor of T1: reject the cycle without changing the valid plan. Reject a missing predecessor, duplicate imported ID, invalid capacity, impossible date, duration 1000000000, and priority 10000 without partial mutation. Try a valid-looking not-before date beyond the 2600-day horizon; reject it with the relevant limit and retain the current plan. Cancel deletion of T1 with dependents, then explicitly delete it with edge removal; no dangling edge remains. Undo restores the exact task and dependencies. Reject deletion of an assigned resource. Create unassigned root U with duration 1 and priority 0, then milestone M with duration 0, priority 0, no resource, and predecessor U: U=[0,1), M=[1,1), and the original five intervals remain unchanged.

## PLAN-06: Determinism and file round trips

Set T3 priority equal to T2's priority 2, export JSON, reverse the task-array order in that file, and import it. The original seed intervals remain: T2 wins the stable-ID tie. Edit a task, then import the saved plan and verify source data and recomputed values; one undo restores the pre-import edit. Inspect CSV quoting/IDs/dates/float and the exported Gantt SVG. Imported names resembling HTML remain inert. Predict and test one additional valid duration or resource change beyond the supplied examples.

## PLAN-07: Session and browser boundaries

Exercise task editing, keyboard date controls, drag, undo, exports, and navigation at 1280 x 800 and 390 x 844. Test direct-file operation and an opaque-origin iframe with scripts/downloads allowed, external requests blocked, and no stored state or clipboard permission. Reload returns to the seed; Reset restores the seed and clears undo/redo. Retention requires explicit JSON export/import. Inspect console errors and failed requests; record blocked coverage honestly.

## Completion

Leave the finished `index.html` and the evidence directory on disk. Return a concise delivery note with the artifact path, what you actually tested, and any unresolved failures or blocked checks. Do not paste the whole implementation into the final message when filesystem delivery is available.
