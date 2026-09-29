# Project Planning Studio — validation record

Artifact: `../index.html` (single self-contained file, no runtime dependencies).
Harness: `agent-browser` 0.31.1 (Chrome via CDP), session `pps`/`pps2`.
Local server used only for browser inspection: `python3 -m http.server 8123`.
All checks ran against the live page; state assertions read the app's own
`model`/`derived` via `agent-browser eval`. Interactions used real clicks,
`fill`, `select`, `mouse down/move/up` pointer input, and `press` keys.

## PLAN-01 Seed across connected views — PASS

- `derived.info`: T1 [0,2), T2 [2,5), T3 [5,7), T4 [7,8), T5 [8,8);
  completion 8 = 2026-09-17; T2 last workday 2026-09-11, exclusive finish
  boundary Monday 2026-09-14. Verified via eval and rendered table/Gantt.
- R1 lane occupancy never exceeds capacity 1 (slots: T1,T1,T2,T2,T2,T3,T3).
- Selecting T3 by clicking its table row highlights it in the table row,
  Gantt bar, Gantt label, the two occupied R1 resource slots, and fills the
  Details inspector (screenshot p01c-details.png, p01b-desktop-seed.png).
- CSV export verified with real download (`~/Downloads/schedule*.csv`):
  header + rows carry task/resource IDs, `;`-joined predecessors, duration,
  not_before, start/finish offsets+dates, last_work_date (empty for T5),
  dependency_only_float. Quoting verified with name `Say "Hi", <b>x</b>` →
  `"Say ""Hi"", <b>x</b>"`.

## PLAN-02 Critical path and capacity — PASS

- Summary shows "Dependency-only completion 6" vs "Actual completion 8"
  separately. Floats: T1/T2/T4/T5 = 0, T3 = 1.
- Critical-path toggle marks exactly T1,T2,T4,T5 bars/milestone and the 3
  tight edges (screenshot p02-crit-on.png).
- R1 capacity 1→2 via the resource-lane select: T3 [2,4), T4 [5,6),
  T5 [6,6), actual completion 6, dependency-only CPM still 6.
- One Undo restores capacity 1 and all seed intervals; Redo re-applies.

## PLAN-03 Propagation / undo-redo — PASS

- T1 duration 2→3 via table cell (fill + Tab): intervals become
  [0,3),[3,6),[6,8),[8,9),[9,9); dependency-only completion 7.
- Undo restores duration 2 and all views; Redo restores duration 3 and the
  derived state — all views consistent (verified in `derived.info`).

## PLAN-04 Drag, gap filling, calendar — PASS

- Real pointer drag of the T2 bar (mouse move/down/move/up) to offset 5:
  live tooltip "not-before ≥ 2026-09-14 (offset 5)" plus ghost preview of
  the recalculated schedule; on release commits one undoable edit.
  Result: T1 [0,2), T2 [5,8), T3 [2,4) (gap fill), T4 [8,9), T5 [9,9);
  T2.notBefore stored as "2026-09-14"; amber dashed marker drawn.
- Same constraint via the Not-before date control with Saturday
  2026-09-12 → visibly normalized: notice "not-before of T2 Saturday
  2026-09-12 normalized forward to Monday 2026-09-14", identical intervals.
- A second drag cancelled with Escape: no model change, no history entry,
  notice "Drag cancelled — no change".
- Tool limitation: the headless CDP driver could not type into the native
  `<input type=date>` segments (`keyboard type` emitted no keydown events;
  `press` digits reached the control but the segmented editor didn't
  commit). The control was exercised by setting `.value` + dispatching
  `change`, which is the same code path a completed entry takes.
  Real users can also use the date picker. Recorded honestly.

## PLAN-05 Validation and safe deletion — PASS

- Cycle: checking T5 in T1's predecessor list → "Rejected: dependency cycle
  involving task "T1""; model and undo stack unchanged, checkbox reverts.
- Import rejections (each via the Import textarea path, specific messages,
  plan + history untouched): missing predecessor "ZZZ", duplicate task id,
  capacity 9, impossible date 2026-02-30, self-predecessor, milestone with
  resource, duration 1000000000, not_before 2037-06-07 (offset 2805 > 2600),
  version≠1, non-JSON text.
- UI rejections: duration 1000000000 and priority 10000 via table inputs.
- Horizon: not-before beyond offset 2600 rejected with the limit shown.
- Derived-date bound: project start 2099-12-21 + 10-day task → "finish date
  2100-01-04 exceeds 2099-12-31", plan preserved.
- Unfittable: eleven 260-day tasks on capacity-1 R1 → "Q10 cannot fit …",
  plan preserved.
- Delete T1 (2 dependents): dialog offers Cancel / "Delete and remove 2
  edge(s)". Cancel leaves everything. Confirm deletes T1 and strips edges
  from T2/T3 (verified predecessor lists). Undo restores T1 + edges.
- Delete R1 while assigned → "Cannot delete resource "R1": in use by
  T1, T2, T3".
- Created U (unassigned, dur 1, pri 0) via +Task dialog → [0,1); then
  milestone M (dur 0, pri 0, pred U) via +Milestone → [1,1); the original
  five intervals unchanged.

## PLAN-06 Determinism and round trips — PASS

- T3 priority set to 2 (tie with T2); exported JSON (real download), tasks
  array reversed to [T5..T1], re-imported → identical seed intervals;
  T2 wins the stable-ID tie (row order does not break ties).
- Edit → import saved plan → one Undo restores the pre-import edit.
- Import paths verified: textarea paste AND native file picker
  (`agent-browser upload` into `#imp-file`).
- CSV quoting and contents verified above. Gantt SVG export: real download,
  parses as valid XML (xml.dom.minidom), contains per-task labels, dates,
  dependency paths, weekend shading and legend text — generated from the
  live model (changing tasks changes the file).
- Inertness: imported name `<img src=x onerror=…><script>…` renders as
  literal text in labels/details; `window.__xss` never set; zero `<img>`
  nodes injected.
- Extra prediction beyond the examples: T4 duration→2 predicted
  T4 [7,9), T5 [9,9), dep-only completion 7, T3 float 1 — observed exactly.
- Scale: generated 60-task / 9-resource project imported and scheduled in
  ~41 ms; all views render (screenshot p06-big60.png). Published limits in
  the UI: ≤500 tasks, ≤16 resources, horizon 2600 wd, dates 2000–2099.

## PLAN-07 Session and browser boundaries — PASS (one note)

- 1280×800 and 390×844 both exercised. Mobile shows a Table/Gantt/
  Resources/Details tab bar; header wraps and keeps edit/file/Reset
  controls reachable (screenshots p07-mobile*.png). Selection survives
  resize (state is not DOM-bound).
- Direct `file://` open works: seed loads and schedules correctly.
- Opaque-origin iframe test (`evidence/iframe-test.html`, sandbox
  `allow-scripts allow-downloads`, no allow-same-origin): parent DOM access
  blocked (TypeError), yet inside the frame the app edits, reschedules,
  and downloads CSV successfully.
- Reload returns to seed; Reset restores seed and clears undo/redo.
  No storage APIs are used anywhere (state lives in JS memory).
- Console: zero errors and zero failed app requests in a fresh session.
  The app makes no network requests at all (favicon is `data:,`; the only
  `data:` fetch observed is Chrome's built-in date-picker icon).
- Note: `agent-browser errors` aggregates errors per daemon session; the
  only entries observed were from an earlier development revision of this
  same file (`sc is not defined`, since fixed) — none on the current build.

## Known limitations

- Date-input typed entry could not be driven by the automation tool
  (see PLAN-04); the control itself works via its change event.
- Table columns beyond ~665 px scroll horizontally at 1280 width; the
  delete button is in the first column and stays visible, and all derived
  columns are also shown in the Details inspector.
- `deriveClient`/HAR not needed; no external calls exist to record.
