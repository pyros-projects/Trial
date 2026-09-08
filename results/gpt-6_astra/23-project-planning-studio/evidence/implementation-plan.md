# Project Planning Studio implementation plan

Goal: Deliver the specified complete, offline, single-file planner in index.html.
Architecture: A pure validation/calendar/scheduling/CPM engine feeds one in-memory source/history store. DOM views and a generated SVG Gantt share selection and derived state. Transactional edits calculate before replacing source. No persistence or runtime dependencies.
Specification: User's Project Planning Studio requirements and PLAN-01 through PLAN-07 in this session.

## Design decisions
- Warm neutral workspace, forest green controls, amber resource waits, rose dependency-critical highlights. Desktop combined task table and Gantt with lower occupancy and explanation panels; narrow screens use Table, Gantt, Resources, Details tabs.
- Calendar arithmetic uses UTC calendar components and setUTCDate increments, never elapsed milliseconds. Input dates 2000–2099; schedule horizon offsets 0–2600 inclusive.
- Published limits: 200 tasks, 16 resources, 1 MB JSON, 100-character IDs, 200-character names, 5,000 dependency edges. All limits reject atomically.
- Stable-ID ready-task priority queue implemented with bounded array scanning. Resource availability checked across the full candidate interval; failure advances past the blocking day, so earlier free gaps remain available.
- Dependency-only CPM ignores resource and date constraints and uses a virtual common terminal finish.
- Plain text date inputs with YYYY-MM-DD labels allow impossible-date feedback and accessible keyboard entry. Native file input plus JSON textarea requires no clipboard API.
- HTML/SVG text escaped. Downloads use Blob URLs and anchor download, including sandboxed opaque origins.

## Execution checklist
- [x] Write meaningful engine tests before implementation; demonstrate missing behavior.
- [x] Implement model validation, scheduling explanations and CPM. Check seed, capacity/gap variations, invalid inputs, calendar boundaries, arbitrary IDs and 50+ tasks.
- [x] Build connected editing, history, project/resource controls, creation/deletion, responsive views and Gantt pointer drag/preview/Escape.
- [x] Implement JSON picker/text round trips, CSV and complete SVG downloads; document schema and limits in UI.
- [x] Exercise PLAN-01–07 with installed agent-browser on desktop/mobile, direct file, and sandboxed iframe. Inspect screenshots, console and network, reproduce/fix failures.
- [x] Review final artifact and record exact commands, outcomes, limitations and evidence in validation.md.

Validation: node evidence/engine.test.cjs, real browser controls and pointer/keyboard input, downloaded-file inspection, console and failed-request capture. Browser tests may use live read-only diagnostics in addition to real interactions; never replace them.
