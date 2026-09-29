# Project Planning Studio — Validation Report

**Artifact Tested:** [`index.html`](file:///home/pyro/projects/naked/gemini38/23-project-planning-studio/index.html)  
**Execution Environment:** Linux x86_64, Node.js v25.8.1, Python 3.12.3, Chromium / agent-browser 0.31.1  
**Test Date:** 2026-09-12  

---

## Executive Summary of Validation Results

| Test ID | Test Category | Scope | Result |
|---|---|---|:---:|
| **PLAN-01** | Seed Across Connected Views | Table, Gantt, Resource Lanes, Task Explanation, CSV, Shared Selection | **PASS** |
| **PLAN-02** | Critical Path & Capacity | CPM Completion 6, Float calculation, Capacity change to 2, Atomic Undo | **PASS** |
| **PLAN-03** | Propagation & Effects | T1 Duration 3 propagation, CPM 7, Actual Finish 9, Undo & Redo consistency | **PASS** |
| **PLAN-04** | Drag, Gap Filling, Calendar | Not-before drag to offset 5, Gap filling [2,4), Weekend normalization, Escape cancel | **PASS** |
| **PLAN-05** | Validation & Safe Deletion | Cycle detection, bounds limits, safe deletion with edge removal, assigned resource rejection, unassigned root & milestone | **PASS** |
| **PLAN-06** | Determinism & File Round Trips | Stable ID tie-breaking on reversed JSON import, edit-import-undo round trip, CSV quoting, SVG export, HTML inertness, additional scenario | **PASS** |
| **PLAN-07** | Session & Browser Boundaries | Desktop (1280x800), Mobile (390x844), Direct `file://` execution, Opaque-Origin sandboxed iframe without clipboard permission | **PASS** |

---

## Detailed Test Logs & Observed Evidence

### PLAN-01: Seed across connected views
* **Goal:** Verify that the initial seed plan displays correctly across all views, satisfies scheduling rules, and maintains shared selection.
* **Commands & Steps:**
  1. Open `http://localhost:8085/index.html` in agent-browser with 1280x800 viewport.
  2. Inspect task intervals:
     - T1: Start offset 0 (2026-09-07), finish offset 2 (2026-09-09), last working date 2026-09-08.
     - T2: Start offset 2 (2026-09-09), finish offset 5 (2026-09-14), last working date 2026-09-11.
     - T3: Start offset 5 (2026-09-14), finish offset 7 (2026-09-16), last working date 2026-09-15.
     - T4: Start offset 7 (2026-09-16), finish offset 8 (2026-09-17), last working date 2026-09-16.
     - T5: Start offset 8 (2026-09-17), finish offset 8 (2026-09-17), milestone (last working date empty).
     - Schedule completion: Day 8 (2026-09-17).
  3. Inspect Resource Lanes:
     - Resource R1 Studio: Day 0 (1/1 [T1]), Day 1 (1/1 [T1]), Day 2 (1/1 [T2]), Day 3 (1/1 [T2]), Day 4 (1/1 [T2]), Day 5 (1/1 [T3]), Day 6 (1/1 [T3]). Capacity 1 is never exceeded.
     - Resource R2 Review: Day 7 (1/1 [T4]).
  4. Select task T3 in Table, Gantt, and Resource Lanes: confirm T3 is highlighted everywhere and Inspector displays T3 details.
* **Observed Output:**
  - All intervals, dates, and exclusive finish dates matched expectations exactly.
  - T2 exclusive finish boundary is Monday 2026-09-14; last working day is Friday 2026-09-11.
  - T3 was selected and synchronized across all panels.
* **Evidence:**
  - Screenshot: `evidence/screenshots/plan-01-desktop-seed.png`
  - Screenshot: `evidence/screenshots/plan-01-resource-lanes.png`
* **Status:** **PASS**

---

### PLAN-02: Critical path and capacity
* **Goal:** Verify dependency-only CPM calculation separate from actual schedule completion, test capacity increase, and test undo restoration.
* **Commands & Steps:**
  1. Toggle Critical Path to ON:
     - Dependency-only completion is 6 days.
     - T1, T2, T4, T5 have float 0 and are highlighted with critical badges and red bars.
     - T3 has float 1 working day and is not critical.
     - Critical edges T1->T2, T2->T4, T4->T5 are highlighted with red stroke and critical arrowheads; T1->T3 and T3->T4 remain standard gray.
  2. Increase R1 capacity from 1 to 2 using the `+` capacity button:
     - Actual intervals become: T1=[0,2), T2=[2,5), T3=[2,4), T4=[5,6), T5=[6,6).
     - Actual completion becomes 6 days (2026-09-15).
     - Dependency-only CPM completion remains 6 days.
  3. Click Undo:
     - R1 capacity is restored to 1.
     - Actual intervals restore to T1=[0,2), T2=[2,5), T3=[5,7), T4=[7,8), T5=[8,8).
     - Actual completion returns to Day 8 (2026-09-17).
* **Observed Output:**
  - Critical path correctly computed and highlighted.
  - Capacity change updated the schedule immediately without mutating dependency-only CPM.
  - A single atomic undo restored the previous source data and derived schedule.
* **Evidence:**
  - Screenshot: `evidence/screenshots/plan-02-critical-path-on.png`
  - Screenshot: `evidence/screenshots/plan-02-r1-capacity-2.png`
  - Screenshot: `evidence/screenshots/plan-02-after-undo.png`
* **Status:** **PASS**

---

### PLAN-03: Propagation and range of effects
* **Goal:** Verify that modifying a root task duration propagates through the entire dependency chain and that both undo and redo restore all derived views.
* **Commands & Steps:**
  1. Edit T1 duration from 2 to 3 days:
     - Actual intervals become: T1=[0,3), T2=[3,6), T3=[6,8), T4=[8,9), T5=[9,9).
     - Actual completion becomes Day 9 (2026-09-18).
     - Dependency-only completion becomes 7 days.
  2. Click Undo:
     - T1 duration returns to 2.
     - Actual intervals and derived CPM return to seed values (completion Day 8, CPM 6).
  3. Click Redo:
     - T1 duration returns to 3.
     - All intervals and derived CPM return to completion Day 9, CPM 7.
* **Observed Output:**
  - Propagation shifted every dependent task and resource occupancy lane consistently.
  - Undo and redo accurately restored every derived view, not just the edited task bar.
* **Evidence:**
  - Screenshot: `evidence/screenshots/plan-03-t1-duration-3.png`
  - Screenshot: `evidence/screenshots/plan-03-after-undo.png`
  - Screenshot: `evidence/screenshots/plan-03-after-redo.png`
* **Status:** **PASS**

---

### PLAN-04: Drag, gap filling, and calendar
* **Goal:** Verify interactive dragging of Gantt bars to adjust not-before dates, free gap filling, date control keyboard entry, weekend normalization, and drag cancellation with Escape.
* **Commands & Steps:**
  1. Test Drag Cancel with Escape:
     - Mouse down on T2 bar at (740, 286).
     - Mouse move to (820, 286), showing ghost preview.
     - Press Escape key.
     - Mouse up.
     - Verify drag is cancelled, toast reports "Drag cancelled (Escape pressed)", and Undo remains disabled.
  2. Test Drag to Offset 5:
     - Mouse down on T2 bar and drag +108px to x=848 (offset 5, 2026-09-14).
     - Release mouse.
     - Observed intervals: T1=[0,2), T2=[5,8), T3=[2,4), T4=[8,9), T5=[9,9).
     - T3 fills the earlier free resource gap [2,4) on R1.
     - Inspector explains: T2 candidate boundary is Day 5 (2026-09-14) due to not-before constraint; T3 was placed at candidate boundary Day 2 with 0 delay.
  3. Test Undo:
     - Click Undo: restores seed schedule.
  4. Test Date Control Weekend Normalization:
     - Select T2. Enter Saturday `2026-09-12` in `#insp-input-not-before` and click "Set".
     - Toast shows visible feedback: `Task T2 not-before date 2026-09-12 is a weekend; normalized forward to Monday 2026-09-14.`
     - Control value normalizes to `2026-09-14`.
     - Schedule produces same intervals: T1=[0,2), T2=[5,8), T3=[2,4), T4=[8,9), T5=[9,9).
* **Observed Output:**
  - Drag cancellation via Escape left state completely unmodified.
  - Gap filling functioned as specified by the serial deterministic scheduling policy.
  - Saturday date input was visibly normalized forward to Monday with explicit feedback.
* **Evidence:**
  - Screenshot: `evidence/screenshots/plan-04-drag-escape-cancelled.png`
  - Screenshot: `evidence/screenshots/plan-04-drag-t2-to-offset-5.png`
  - Screenshot: `evidence/screenshots/plan-04-t3-gap-filling.png`
  - Screenshot: `evidence/screenshots/plan-04-undo-restores-seed.png`
  - Screenshot: `evidence/screenshots/plan-04-weekend-normalization.png`
* **Status:** **PASS**

---

### PLAN-05: Validation and safe deletion
* **Goal:** Verify rejection of invalid inputs, cycle detection, safe deletion of tasks with dependents, rejection of assigned resource deletion, and placement of unassigned tasks and milestones.
* **Commands & Steps:**
  1. Dependency Cycle Test:
     - Try adding T5 as predecessor to T1.
     - Rejected: Toast shows `Dependency cycle detected: T1 -> T5 -> T4 -> T2 -> T1`. Plan remains valid.
  2. Input Bounds Testing:
     - Duration `1000000000`: Rejected (`Task T1 duration must be an integer between 0 and 260 working days`).
     - Priority `10000`: Rejected (`Task T1 priority must be an integer between 0 and 9999`).
     - Horizon Overflow (`2040-01-01`): Rejected (`Task T1 not-before date 2040-01-02 corresponds to working-day offset 3476, exceeding the maximum schedule horizon of 2600 working days`).
     - Impossible Date (`2026-02-30`): Rejected (`Task T1 has invalid not-before date: "2026-02-30"`).
     - Invalid Capacity (`5`): Rejected (`Resource R1 capacity must be an integer between 1 and 4`).
     - Missing Predecessor (`T99`): Rejected (`Task T1 references missing predecessor: "T99"`).
  3. Safe Task Deletion:
     - Click Delete on T1: modal prompts that T1 has dependents (T2, T3) and offers choice to remove edges or cancel.
     - Click Cancel: modal closes, no deletion.
     - Click Delete again and confirm "Delete Task & Remove Dependency Edges": T1 is removed, T2 and T3 predecessors are cleared, no dangling edges.
     - Click Undo: T1 is restored along with its predecessor relationships in T2 and T3.
  4. Assigned Resource Deletion:
     - Try deleting resource R1 (assigned to T1, T2, T3):
     - Rejected: `Cannot delete resource "R1" because it is assigned to tasks: T1, T2, T3. Unassign them first.`
  5. Unassigned Root U and Milestone M:
     - Add unassigned root U (dur 1, prio 0, resource null, preds []).
     - Add milestone M (dur 0, prio 0, resource null, preds [U]).
     - Observed placement: U=[0,1), M=[1,1).
     - Original 5 tasks remain at [0,2), [2,5), [5,7), [7,8), [8,8).
* **Observed Output:**
  - All invalid states rejected with clear error messages without partial mutation.
  - Safe deletion modal required explicit edge removal confirmation.
  - Undo restored tasks and edges symmetrically.
* **Evidence:**
  - Screenshot: `evidence/screenshots/plan-05-cycle-rejected.png`
  - Screenshot: `evidence/screenshots/plan-05-delete-confirm-modal.png`
  - Screenshot: `evidence/screenshots/plan-05-after-delete-t1.png`
  - Screenshot: `evidence/screenshots/plan-05-after-undo-t1-delete.png`
  - Screenshot: `evidence/screenshots/plan-05-resource-delete-rejected.png`
  - Screenshot: `evidence/screenshots/plan-05-unassigned-and-milestone.png`
* **Status:** **PASS**

---

### PLAN-06: Determinism and file round trips
* **Goal:** Verify tie-breaking policy, JSON export/import round trips, atomic import undo, CSV quoting and float formatting, SVG Gantt generation, and HTML inertness.
* **Commands & Steps:**
  1. Tie-Breaking & Array Reversal:
     - Set T3 priority = 2 (equal to T2 priority 2).
     - Export JSON, reverse the `tasks` array, and import the reversed JSON.
     - Schedule recomputed: T2 starts at [2,5) and T3 starts at [5,7). T2 wins tie based on stable ID code-point comparison (`"T2" < "T3"`).
  2. Edit-Import-Undo Round Trip:
     - Edit T4 duration to 3 (actual completion becomes 10).
     - Import saved JSON plan (actual completion returns to 8).
     - Click Undo: pre-import edit restored (T4 duration 3, actual completion 10).
  3. CSV Export Inspection:
     - Headers: `Task ID,Task Name,Resource ID,Predecessors,Duration,Not-Before Date,Actual Start Offset,Actual Finish Offset,Actual Start Date,Actual Finish Date,Last Working Date,Dependency-Only Float`.
     - Milestone T5 last working date is empty `""`.
     - Predecessors `"T2, T3"` enclosed in RFC 4180 quotes.
     - Actual finish date displays exclusive finish boundary.
  4. SVG Export Inspection:
     - Standalone valid SVG markup containing project title, timeline axis, weekend dividers, task bars, milestone polygons, dependency arrows with markers, and legend.
  5. HTML Inertness:
     - Set task name to `<img src=x onerror=alert(1)><b>Bold Test</b> & "Quotes"`.
     - Rendered in DOM with 0 child elements, text escaped cleanly: `&lt;img ...`. Zero script execution.
  6. Additional Test Scenario:
     - Increase R2 capacity to 2. Add task T6 (ID: T6, Name: 'Security Audit', Duration: 2, Priority: 4, Resource: R2, Predecessor: T1).
     - Predicted: T1=[0,2), T2=[2,5), T3=[5,7), T6=[2,4) on R2, T4=[7,8) on R2, T5=[8,8).
     - Observed: T1=[0,2), T2=[2,5), T3=[5,7), T6=[2,4), T4=[7,8), T5=[8,8). Actual completion: Day 8; Dependency CPM: 6 days. Matches prediction exactly.
* **Observed Output:**
  - Round-trips preserved integrity and deterministic recalculation.
  - Exports conformed to standard formats without runtime fixtures.
  - Malicious / HTML-like strings remained completely inert.
* **Evidence:**
  - Screenshot: `evidence/screenshots/plan-06-tie-break-reversed-import.png`
  - Screenshot: `evidence/screenshots/plan-06-additional-test.png`
* **Status:** **PASS**

---

### PLAN-07: Session and browser boundaries
* **Goal:** Verify execution across viewports (1280x800 and 390x844), direct-file loading, and execution in an opaque-origin sandboxed iframe without clipboard permission or stored state.
* **Commands & Steps:**
  1. Mobile Viewport (390 x 844):
     - Set browser viewport to 390 x 844.
     - Switch between tabs: Task Table, Gantt Chart, Resource Lanes, Task Explanation.
     - Verified navigation tabs are reachable, controls stay visible, and Gantt timeline scrolls horizontally without breaking mobile viewport layout.
  2. Direct `file://` execution:
     - Navigated directly to `file:///home/pyro/projects/naked/gemini38/23-project-planning-studio/index.html`.
     - Loaded with exit code 0, 0 console errors, 0 failed requests.
  3. Opaque-Origin Sandboxed Iframe:
     - Served `iframe-test.html` with `<iframe sandbox="allow-scripts allow-downloads" src="index.html">`.
     - Tested application within `null` origin.
     - Verified: no calls to `localStorage`, `sessionStorage`, `document.cookie`, or `indexedDB`.
     - Tested copy fallbacks in absence of clipboard permission.
  4. Network Isolation:
     - Checked `agent-browser network requests`: zero external requests; zero third-party assets, fonts, or CDNs.
* **Observed Output:**
  - Flawless execution across desktop and mobile viewports.
  - Direct file and sandboxed iframe operations verified with zero errors.
* **Evidence:**
  - Screenshot: `evidence/screenshots/plan-07-mobile-table.png`
  - Screenshot: `evidence/screenshots/plan-07-mobile-gantt.png`
  - Screenshot: `evidence/screenshots/plan-07-mobile-resources.png`
  - Screenshot: `evidence/screenshots/plan-07-mobile-inspector.png`
  - Screenshot: `evidence/screenshots/plan-07-direct-file.png`
  - Screenshot: `evidence/screenshots/plan-07-opaque-iframe-seed.png`
* **Status:** **PASS**

---

## Identified Issues, Fixes & Retest Summary

1. **Inspector Not-Before Date Input via CDP Automation:**
   - *Issue:* Initially `<input type="date">` was used for the not-before control. In Chromium on Linux under headless CDP automation, sending raw text `"2026-09-12"` to `<input type="date">` failed to populate the control because Chromium expected localized field inputs (`mm/dd/yyyy`).
   - *Fix:* Changed date controls to `<input type="text" placeholder="YYYY-MM-DD">` backed by strict `isValidCalendarDate` and `normalizeDateToMonday` validators.
   - *Retest:* Successfully typed `"2026-09-12"`; visibly normalized to Monday `2026-09-14` with warning toast; test PLAN-04 passed.

2. **Mobile Layout Gantt Overlap:**
   - *Issue:* In narrow viewport (390x844), the desktop bottom drawer `.inspector-panel` remained visible in the DOM during Gantt view.
   - *Fix:* Added CSS rules in the mobile media query ensuring `.inspector-panel` is hidden when the Gantt, Table, or Resources tab is active, and dedicated full-screen presentation is given to each mobile view tab. Also relocated mobile toast notifications to bottom-screen to prevent header button occlusion.
   - *Retest:* Re-captured all four mobile views; layout is responsive, legible, and controls stay fully reachable; test PLAN-07 passed.

---

## Architectural & Behavioral Limitations

1. **Bounded Horizon & Data Limits:**
   - Supported schedule horizon is 0 to 2600 working days (~10 calendar years).
   - Maximum 500 tasks and 50 resources.
   - Supported calendar range: 2000-01-01 through 2099-12-31.
2. **Deterministic Serial Heuristic:**
   - Scheduling implements the specified serial priority/tie-breaker policy with free-gap search. It does not perform NP-hard global resource leveling or backtracking optimization.
3. **Calendar Model:**
   - Monday-Friday working calendar; no statutory or company holiday definitions.
4. **Memory-Only State:**
   - No browser storage (localStorage, IndexedDB) is used. Project state is cleared on page reload or Reset. Users retain plans via JSON export/import.
