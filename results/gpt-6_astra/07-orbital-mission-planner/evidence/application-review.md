# Re-review result

All five original findings below are fixed. No outstanding issue was found in the revised event validation, normal physics setting values, paused selection telemetry, merger/reference reconciliation, or Space handling.

Command: `node --test evidence/application-review-regression.test.cjs`

Result: **12 focused tests passed, 0 failed** (26 combined engine/review tests passed). Tests extract the current production engine and application functions directly from index.html, with narrow DOM/worker boundary stubs; they do not replace the root agent's browser workflow validation.

Verified outcomes:

- Original malformed Hohmann event payload now throws before changing the live mission. Valid burn records still pass.
- G=1/2, dt=.02/.04 and softening=.02/.03 align with the real input minima/steps.
- Selecting each of two spacecraft recomputes its own encounter and projected eccentricity while paused.
- A surviving spacecraft follows the engine's new primary after a merger. Restoring a pre-merger checkpoint restores the original primary and centered-frame label through updateUI's central reconciliation.
- Handled Space events and focused buttons leave global playback alone; unhandled canvas/body Space still invokes transport.
- Newly saved checkpoints capture and restore cfg with their state and conservation baseline. Changing G after saving then restoring returns energy and baseline to exact agreement.
- Prediction readiness stays pending through the debounce period, worker startup, and forced replacement. An obsolete worker response cannot install an old forecast; current completion clears pending/busy state.

Final delta verified: checkpoints missing cfg are now rejected before any live state mutation. Mixed prograde/radial maneuver display uses the matching forecast burn event, agrees with the executed impulse, and does not reuse that event after the node changes. Non-spacecraft encounter selection finds the closest celestial-body sample and excludes nearby spacecraft. The footer time/achieved-warp addition uses existing live values. The final edge fixes also preserve null orbital primaries when creating/importing maneuvers, continue rejecting unknown primary IDs, and successfully predict an inertial-origin burn. Craft rendering now incorporates individual display scale (scale 2 produces radius 12 before the existing visual clamp) without changing physical radius. No new blocking concerns found in these deltas.

---

# Whole-application independent review

Reviewed index.html against evidence/plan.md. Focus: engine/UI boundaries, mission references, maneuvers, worker predictions, import/save and input handling. Review used source inspection and narrow Node VM reproductions, without the root browser session. Line references refer to the reviewed 377-line document.

## Original findings — all fixed and verified

1. **P1 — malformed event records pass import validation and can partially replace the live mission before an exception.** `validatePayload` (line 324) only checks that `events` is an array. `restorePayload` (325) assigns mission state before `refreshNodes` accesses events; `nodeDelta` (305) reads `e.type` without guards. Reproduction: take a valid Hohmann export, set first node `executed=true`, set `state.time=10`, and replace `state.events` with `[null]`. The exact extracted validator accepts it (`validatePayload(p)===p` → true); `nodeDelta(state.nodes[0])` throws `Cannot read properties of null (reading 'type')`. The import handler then reports the current mission is unchanged, even though state was replaced. Other malformed collision records break the flight log's `e.ids.map`. Validate event shapes before any assignment, including burn fields and collision IDs.

2. **P2 — settings inputs reject ordinary values because step increments are anchored at the minimum.** Settings HTML (line 73) gives G `min=.01 step=.1`, dt `min=.001 step=.01`, softening `min=.001 step=.01`. Native `checkValidity()` in the change handler (362) rejects G=1 or 2, dt=.02/.04, and softening=.02/.03, including the displayed defaults. For example, `.04-.001` is not an integer multiple of `.01`. Use `step=any`, aligned minima, or consistent explicit numeric bounds.

3. **P2 — paused selection changes leave encounter and projected-orbit information for the previous spacecraft.** `selectBody` (296) calls `updateUI`, which does not recompute `encounter` or projected values. Those update only with a worker result or the mobile Plan-tab handler. Reproduction: add a second spacecraft, wait for prediction, pause, then select Odyssey in the desktop object list. Encounter becomes `Computing…` because its cached craft ID differs, while projected eccentricity/apoapsis still belong to the second craft. No worker is scheduled by selection, so it persists until another change or playback. Recompute the derived encounter/projection after selection.

4. **P2 — reference frame is stale when a selected spacecraft survives its primary's merger.** The engine updates surviving bodies' `.primary` on merge, but `afterAdvance` (368) does not update UI `primaryId`, and `updateUI` (314) only does so if the selected body itself died. Reproduction in extracted engine: place Terra at Helios's position, step `.001 TU`; survivors are Helios/Luna/Odyssey, Odyssey.primary becomes `helios`, but `O.frame(state,'body','odyssey','terra')` returns a zero inertial frame. The UI continues using `terra` with its stale centered label. Reconcile primary reference after topology events and refresh frame options.

## Original input finding — fixed and verified

- **P2 — Space on a maneuver card resumes playback immediately after selecting it.** Node-list keydown (352) prevents default and triggers click, whose handler pauses; the event then bubbles to the document handler (367), which does not check `e.defaultPrevented` and clicks Play. Stop propagation or honor handled events before global shortcuts. Other focused buttons should retain their native Space behavior rather than also invoking the global play shortcut.

## Limits versus bugs

- Frame-aware prediction and trails transform full snapshots at their individual timestamps. Rotating-frame velocity drag correctly applies the inverse rotational-velocity correction.
- Mobile panes hide the canvas with `visibility:hidden`, preserving layout dimensions; switching tabs does not inherently produce a zero-size canvas.
- Live/prediction differences from independently partitioned Verlet steps and osculating two-body guide approximations are numerical/model limits, not proof of an integration defect.
- Worker force-refresh terminates a busy worker and increments request IDs, preventing stale responses from replacing newer predictions.
