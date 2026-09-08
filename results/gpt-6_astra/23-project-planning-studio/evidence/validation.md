# Project Planning Studio — validation evidence

Agent-authored record. No evaluator scores or evaluator-owned reports are included.

## Environment and workflow
- Delivered artifact: `../index.html`, self-contained HTML/CSS/JavaScript with inline SVG icons.
- Installed automation: agent-browser 0.31.1, Google Chrome 143.0.7499.40. Read `.agents/skills/agent-browser/SKILL.md` plus version-matched `agent-browser skills get core`, `core --full`, and `dogfood` before use.
- Engine checks: `node evidence/engine.test.cjs`. Initial missing-engine assertion failed as expected (`engine-red.log`); eight engine groups subsequently passed (`engine-green.log`). Tests use the actual embedded engine, not an alternate implementation.
- Syntax: extracted both embedded scripts to `/tmp/planner-script-{0,1}.js`; `node --check` passed for both.
- Server: `python3 -m http.server 18765 --bind 127.0.0.1 > evidence/http-server-18765.log 2>&1`. First attempt at 8765 failed because that port was already in use; switched to 18765 without altering another server.
- Browser: `agent-browser --session planner open http://127.0.0.1:18765/index.html`; `set viewport 1280 800`; `snapshot -i`; `screenshot evidence/screenshots/desktop-loaded.png`; `errors`; `console`; `network requests`.
- Initial automation launch with `--allowed-domains` followed by commands without that flag caused agent-browser to relaunch to about:blank. Diagnosed with `get url` and `doctor --offline --quick` (20 pass, 0 warn/fail). Reopened the application using consistent session flags. `desktop-initial.png` preserves that blank tooling state; `desktop-loaded.png` is the successfully loaded application.
- Initial actual application load: no console or uncaught errors; only the local HTML document request, status 200. Network isolation and final browser-boundary tests are recorded below when run.

## Public checks
All seven public checks passed in the tested Chrome environment. These are agent-authored outcomes, not evaluator scores.

| Check | Status | Observed coverage |
|---|---|---|
| PLAN-01 | pass | Seed intervals, exclusive finish/last workday, occupancy, shared selection, CSV |
| PLAN-02 | pass | Dependency-only CPM and critical edges; capacity 2; one-step undo |
| PLAN-03 | pass | Duration propagation; source and derived undo/redo |
| PLAN-04 | pass | Real pointer drag/preview, earlier-gap filling, weekend normalization, Escape |
| PLAN-05 | pass | Invalid edits/imports remain atomic; deletion/cancel/undo; U and M creation |
| PLAN-06 | pass | Stable-ID ties, reversed file-array import, JSON round trip, actual CSV/SVG exports, inert text, independent prediction |
| PLAN-07 | pass | Desktop/mobile controls; direct-file operation; opaque iframe; denied storage/parent access/clipboard; reset/reload; external network blocked |

The final regression commands and logs are summarized at the end of this document.

## Observed failures and fixes
Tooling-only server-port conflict and launch configuration reset are described above. Application failures will be recorded here as discovered.

### ISSUE-001 — keyboard focus after inline edits (fixed, retested)
Reproduced independently and in the main browser: Reset → fill `Duration for T1` with 3 → press Tab. The schedule updated, but `document.activeElement` was BODY instead of `Priority for T1`. See `issue-input-focus.png`, `focus-red.log`, and exact commands in `browser-actions.log`.
Cause: replacing the entire table and resource-control HTML during recalculation detached native inputs while Tab was moving focus. Fix: reconcile task rows and resource controls by stable ID, retaining existing input elements. `python3 evidence/focus-regression.py` now passes duration→priority typing and resource-capacity→next-resource focus (`focus-green.log`). The test was made explicit about Control+A before typing; native Tab selects the prior field value.

### PLAN-01–04 initial outcomes
- PLAN-01 pass: seed table/Gantt/CSV intervals; completion/date boundaries; T2 last workday; T3 shared selection via table, actual Gantt click, and resource-slot click; capacity occupancy and blocking T2 explanation.
- PLAN-02 pass: dependency-only completion 6; individual floats and exactly three highlighted tight critical edges; capacity 2 produces expected intervals/completion; one undo restores capacity and seed intervals.
- PLAN-03 pass: T1 duration 3 propagates every interval and CPM completion 7; undo and redo restore both input and all intervals.
- PLAN-04 pass after a tooling correction: real mouse drag requests day 5 with a visible recalculated preview, then commits gap-filling intervals and stored date. Date input Saturday normalizes visibly to Monday. Escape during another real drag preserves JSON, intervals and Undo description. The first mouse command used fractional coordinates, which agent-browser rejected; using rounded pixel coordinates enabled the test. This was a harness correction, not an application change.

### Review fixes and retests
- ISSUE-002 (fixed): Undo while a pointer drag preview was active reverted a source change, but releasing committed the stale preview and silently reinstated it. Reproduced with T1 2→3, dragging T3, Ctrl+Z, release (`review-red.log`, `issue-drag-undo-before-release.png`). Undo/redo and a new source commit now cancel active previews. Exact regression passes in `review-green.log`.
- ISSUE-003 (fixed): dependency selection committed immediately and discarded a typed task-name draft. It now updates the dependency field in the existing editor, and Save task commits the complete draft once. Tested a changed name plus added T2 predecessor together.
- ISSUE-004 (fixed): accepted control character U+0001 made exported SVG invalid XML (`xml-red.log`, `control-name-before-fix.svg`). SVG serialization now renders XML-forbidden characters as explicit Unicode escapes; JSON preserves source text. Downloaded `control-name.svg` parses successfully.
- ISSUE-005 (fixed, stress retested): long plans had separately scrolling table/Gantt rows. Added synchronization of vertical scroll in Overview.
- ISSUE-006 (fixed, bounding-box retested): exported long task/project/milestone names could extend beyond the viewBox. Export now includes full task labels and sizes to accommodate the complete labels, project title and legend.

### PLAN-05 — pass
Reset → invalid predecessor cycle, missing predecessor, duplicate JSON task ID, capacity 0, February 30, duration 1,000,000,000, priority 10,000 and not-before 2040-01-02. Each preserved exported source and seed intervals/history; errors named the problem. Cancelled T1 deletion; confirmed deletion with edge removal; one undo restored exact source and edges. R1 deletion rejected with assigned IDs. Created U (unassigned, duration1, priority0) and M (milestone, predecessor U); U=[0,1), M=[1,1), original five intervals unchanged. Evidence: `plan05-horizon-rejected.png`, `plan05-created-root-milestone.png`, commands in `browser_checks.py`/`browser-actions.log`.

### PLAN-06 — pass
Set T3 priority2 → actual JSON download → reverse task array externally → upload via file picker → import. T2 still wins the stable-ID tie. Edited T1 duration, imported saved JSON, then one undo restored exact pre-import source. Independently predicted/tested T3 duration4: T3=[5,9), T4=[9,10), T5=[10,10), dependency completion7, T2 float1. Imported HTML-looking task name remained text: no image element or injected global. Downloaded quoted CSV round-trips commas, quotes, newline, IDs, predecessor and float. Current SVG parses and includes five actual bars, labels and current dates; JSON round-trips exact current source. File picker read is asynchronous; the first harness read ran before `file.text()` completed. Added `wait --fn` for nonempty editor, then passed without an application change. Downloads and `plan06-inert-name.png` retained.


### PLAN-07 — pass, including opaque-origin regression
- `python3 evidence/boundary_checks.py`: exercised the actual controls at **390 × 844**, including duration editing and Tab continuity, date entry with Enter, two zoom clicks and a real bar drag, undo, pan/zoom, resource selection after horizontal scrolling, all three downloads, navigation and selection/data continuity through 1280 × 800 ↔ 390 × 844 resizing. Fixed mobile toolbar buttons remained wholly within the viewport.
- Opened `file:///home/pyro/projects/naked/astra/bench/23-project-planning-studio/index.html` with agent-browser. Edited, undid, exported JSON/CSV/SVG, imported a changed plan, and reloaded. Direct-file operation passed; reload returned to seed with empty history.
- Test host: `evidence/opaque-host.html`, iframe has exactly `sandbox="allow-scripts allow-downloads"` and denies clipboard permissions; it has no `allow-same-origin`, `allow-forms`, or parent access. `opaque-boundaries.json` records actual `window.origin = "null"` and SecurityError for localStorage, sessionStorage, IndexedDB and parent.document.
- **ISSUE-007 (fixed):** native form submission was blocked by that required sandbox. The initial not-before Enter test left the seed schedule unchanged; Chrome logged “Blocked form submission … allow-forms … not set.” See `issue-opaque-form.png` and historical `network-guard.jsonl`. Click/Enter now explicitly dispatch the app's existing validated form handler and prevent native submission. Repeated date edits, project settings, task creation and imports passed in the actual opaque frame. Removed an autofocus attribute after observing a cross-origin autofocus warning; final retest is clean.
- `python3 evidence/opaque_ref_checks.py` uses agent-browser's accessibility refs for actual frame controls, fills, keyboard input and real pointer drags. Chrome CDP is used only for iframe diagnostics and download observation. In agent-browser 0.31.1, `frame #planner-frame` reported Frame not found, `frame @e1` scoped snapshots correctly, but `eval` still evaluated in the parent. `iframe-eval.cjs` reads the real child context without reading or mutating parent/app state. The CLI download command clicked successfully but timed out waiting for the child download; its GUID-named JSON file was retained. `capture-download.cjs` observes browser-level completion after the real agent-browser click and saves the genuine downloaded bytes. These tooling limitations were worked around; no required application coverage remains blocked.
- Opaque coverage includes seed, inline editing, keyboard weekend date, real drag, undo, JSON/CSV/SVG downloads, picker and text imports, project start normalization, task creation, Reset/reload, and mobile navigation/date/task edits. `final-opaque_ref_checks.log` records the completed retest.
- A narrow resource slot was initially outside the clipped horizontal viewport, so an automatic CLI click did not select it. The test now scrolls the occupancy container with `scroll right 220 --selector #occupancy-scroll` before clicking its visible slot. The real scroll-plus-click workflow passes.

### Scale, empty states and export fidelity
`python3 evidence/stress_checks.py` passed:
- 50 tasks and eight resources: actual completion 14, dependency-only completion 2, occupancy within capacity.
- Bidirectional Overview scroll synchronization after real scroll input to each pane.
- 200 tasks, 16 resources at capacity 4, duration 260: actual completion 1040, dependency-only completion 260; import workflow took 0.63 seconds in the recorded run. Resource date pagination worked and SVG contained all 200 bars. A 201st task was rejected without changing the source.
- Empty task/resource arrays: both completions zero, clear empty states, valid header-only CSV and SVG. Creating task ID `__proto__` produced [0,1), demonstrating safe arbitrary-ID handling.
- Full 200-character project/task/milestone names in exported SVG: opened the real download in Chrome and checked every rendered text bounding box against the viewBox; none were outside (`svg-bounds.json`).
- The initial stress harness used “Earlier” instead of the actual “← Earlier” accessible label. Corrected that locator and reran; `stress-first-run.log` preserves the tooling failure.
- Long dependency/resource text initially created an internal table scroll width of 1193px for a 364px pane. Full labels now remain available through tooltips/inspector while table labels ellipsize. `row-label-overflow-red.log` and `row-label-green.log` document the regression and fix.
- A follow-up review found entry to Overview did not synchronize a previously scrolled Table or Gantt. `view-scroll-red.log` reproduced table=300, Gantt=0. `setView` now carries the active pane's scroll offset into both panes. `view-scroll-green.log` passes both navigation directions.

### Offline isolation and diagnostics
`node evidence/network-guard.cjs` attaches to page and opaque iframe targets. It disables cache, allows only local server/file/data/blob URLs and blocks external internet requests. The initial setup cleared the browser cache and cookies. Browser clipboard-read and clipboard-write permissions were explicitly denied for the opaque tests. No application external request was observed. The wrapper's first revision generated one local favicon 404; its favicon is now inline. That test-host request and pre-fix form/autofocus diagnostics are retained in the historical log rather than erased.

### Final verification and limitations
Commands:
```sh
node evidence/engine.test.cjs
node --check /tmp/planner-final-0.js
node --check /tmp/planner-final-1.js
python3 evidence/view-scroll-regression.py
python3 evidence/final_regression.py
python3 evidence/stress_checks.py
```
The `/tmp/planner-final-*.js` files are exact extracted copies of the two delivered inline scripts, used for syntax checking only. `final_regression.py` runs PLAN-01 through PLAN-06, keyboard continuity and review regressions, mobile/direct-file checks, and opaque iframe checks; it captures final screenshots, errors, console output and requests. Exact executed commands and browser results are preserved in `browser-actions.log` and the scripts themselves. See `final-regression.log`, `browser-results.json`, `final-engine.log`, `final-console.log`, `final-errors.log`, `final-requests.log`, and the final segment of `network-guard.jsonl`.

No unresolved application failures were observed. Required direct-file and opaque-origin coverage is **pass**, not blocked. Physical mobile hardware, touch-specific gesture delivery, Firefox and Safari are **not-run**; mobile coverage uses Chrome at the required viewport with actual keyboard and pointer input. The application intentionally retains work only through explicit JSON download/import, and enforces the published limits. Development harnesses/evidence are separate from the single delivered HTML and are not runtime dependencies.


Final network audit: the most recent guarded regression observed seven local/file document requests and attached to opaque child targets. It recorded **zero warnings, exceptions, failed requests, or external requests** (`final-network-summary.json`). A long-running earlier network monitor had ended with signal 143; the full regression was rerun under a freshly attached monitor with cache clearing and verified coverage for direct-file, local-app, opaque-host and opaque-child targets. An initial audit assumed eight requests; the actual expected navigations after the marker were seven, so the audit now verifies those concrete coverage categories rather than an arbitrary count. The final artifact audit found no external scripts/stylesheets or runtime network/storage/clipboard calls (`artifact-audit.json`).
