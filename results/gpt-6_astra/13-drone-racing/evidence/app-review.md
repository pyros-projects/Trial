# Application review — final scoped re-review

Verdict: **approve the reviewed fixes**. All seven original findings are addressed. An additional same-timestamp finish-recording defect found during re-review was fixed and regression-checked. No blocking residual was identified within this bounded application review.

Scope: application code outside FLIGHT_CORE in the current index.html; original requirements in evidence/plan.md; genuine browser lap in evidence/recorded-course-replay.json. Review used source inspection and isolated Node execution of extracted application functions. It did not operate the browser session or count synthetic state fixtures as flight evidence. Only this review document was edited.

## Findings and disposition

1. **Pre-start recovery bypass — resolved.** `recover` returns without moving a ready time-trial drone; `updatePhase` disables the Recover button in that state. Active recovery uses the physics core's public `recoverAt` method and charges the expected three seconds.
2. **Collision penalty finalized too late — resolved.** `simulationStep` now applies collision penalties before `checkRace`, so sector and final totals include the current collision. An immediate return after a finished race prevents further boundary/recovery work from changing the completed state.
3. **Recording cap silently drops the finish — resolved for supported replay durations.** `recordSample` compacts existing samples and doubles its interval while retaining the first/last and gate-transition frames. Validation supports durations up to 86,400 seconds. A synthetic 1,241.910-second fixture using the genuine lap route survived cap compaction, finish recording and validation.
4. **Incomplete replay accepted as a completed best — resolved.** Validation now requires an early gate-zero sample, final gate eight, monotonically ordered gate changes, and swept traversal of all generated course checkpoints. The real saved lap passes. Empty-progress, reversed-progress, missing-start and stationary-route variants fail.
5. **Malformed local log crashes rendering — resolved.** Storage filtering guards null entries and validates required displayed fields, including numeric nonnegative penalties. A mixed valid/malformed fixture retains only its valid row without disabling storage.
6. **Launch-pad ring is vertical — resolved.** Launch markings are explicit horizontal circle segments with constant ground-plane height.
7. **Vertical chase view has a zero camera basis — resolved.** `lookAt` chooses an alternative up vector when its current up is parallel to the view direction. The exact vertical-view regression produces finite matrix entries and unit-length basis vectors.

**Additional re-review defect, now resolved:** periodic recording happens before gate evaluation. A final crossing on a periodic-sample tick previously left a gate-seven sample because the forced finish skipped the duplicate timestamp. The same-time force branch now updates the existing sample's gate, position and orientation while preserving its timestamp. Regression confirmed gate eight and the final transform with no duplicate frame.

## Extracted-function test output

```text
PASS genuine browser lap: 441 frames, 22.041666666666057 seconds, +18 penalty
REJECTED gate0-only replay: Replay must include the entire ordered course
REJECTED descending gate: Invalid replay checkpoint order
REJECTED missing start: Replay must include the entire ordered course
REJECTED stationary route: Replay route does not pass all checkpoints
PASS synthetic long-lap stress fixture derived from genuine route:
  1241.910 seconds; compacted 23900 to 11955 frames; all 8 gates valid
PASS malformed stored log: only valid row retained; storageOK true
PASS vertical lookAt: all matrix entries finite; basis lengths [1, 1, 1]
PASS same-time forced finish: gate 8, final transform updated, timestamp unique
PASS post-finish simulation guard present
```

Evidence boundaries: the supplied real replay is a completed browser lap with the first two gates flown from launch and six public Recover-assisted segments, totaling eighteen seconds of penalties. The long-lap fixture is synthetic stress validation of recording/validation logic. This review does not establish continuous unassisted whole-course piloting, hardware gamepad operation, arbitrary malformed-data exhaustiveness, or indefinite replay durations beyond the declared limit.

## Rerunnable regression suite

Run `node evidence/app-regressions.cjs` from the project root. The suite extracts the current embedded core and application declarations directly from `index.html`; it loads the genuine recorded-course-replay.json as its valid base and labels synthetic fixtures explicitly. The persisted run in evidence/app-regression-results.txt reports **11 tests passed, 0 failed**. In addition to the checks above, it executes synthetic ready-state recovery and final-step collision/finish-order fixtures.
