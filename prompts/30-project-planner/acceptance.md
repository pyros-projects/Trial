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
