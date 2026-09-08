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
