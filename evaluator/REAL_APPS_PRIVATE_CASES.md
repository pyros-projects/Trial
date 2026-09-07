# Evaluator-owned variations: Real Apps

These are evaluation designs, not an executable hidden-test suite. The package does not implement the ten applications or claim that any model passed these checks. Implement adapters against each submitted application's documented APIs where necessary. All expected behavior below follows requirements already present in the public task. Do not introduce surprise product features or undocumented performance thresholds.

Keep this file, evaluator traces, and private data outside the model's workspace. Giving an agent the whole benchmark repository also exposes these suggestions; in that case they are no longer hidden. Provide only its selected prompt.md and public fixtures. Randomize identities, values, request order, and seeds while retaining the same defined rules. Preserve exact private inputs for reproducibility.

For each check record input state, actions, observed committed state, relevant HTTP/browser evidence, and `pass`, `fail`, `blocked`, or `not-run`. A missing assertion or unavailable environment is not a pass. A console without errors is not evidence of correct data. Use temporary, separate `DATA_DIR` values and truly separate browser contexts, not just two tabs with shared cookies. Retain state when testing restart; reset only between independent scenarios.

## 21. Import Studio

Change external IDs to include leading zeros and non-ASCII text; use quoted commas, quotes, and logical records containing newlines. Apply the declared mapping and decimal separator. Confirm that identifiers remain strings, cents are exact, and record counts refer to logical records rather than physical lines.

Reissue a committed import's idempotency key after a restart. The same payload returns the previous result without new mutations. Reusing that key with a changed import fails. Also mutate the catalog from another session between preview and commit: the stale preview must not silently apply to the new revision. These are separate scenarios, not one blended failure.

## 22. Resource Booker

Repeat the competing-booking scenario with reversed request ordering and different interval lengths. Exactly one overlapping reservation can be confirmed; adjacent half-open intervals remain valid. Inspect stored records as well as the two UIs.

Move a single occurrence of a recurring series into a maintenance window. The operation must fail atomically without altering other occurrences or leaving a detached ghost booking. Generate dates immediately before and after the publicly specified DST cases; compare stored instants to the chosen wall-clock-time semantics. Do not require a different recurrence feature than the bounded weekly series.

## 23. Stockroom

Use a multi-line order where one line has stock and another does not, reversing line order between trials. Failed all-or-nothing reservation must leave every SKU and reservation unchanged.

Deliver a valid partial shipment, lose/repeat its response, and replay after restart. The same operation key has exactly one inventory effect. Change the payload under that key and expect rejection. A return exceeding the net shipped quantity must not increase physical stock. Reconcile movement history, reservation rows, and reported available stock independently.

## 24. Workflow Desk

Publish a modified workflow while an older run is paused at approval. The older run continues using its pinned version after restart. Approving twice must not schedule the same next action twice.

Exercise the receiver's declared timeout-after-commit mode, not only its fail-before-commit mode. Confirm multiple transport attempts can correspond to one recorded receiver effect. Stop the application during a delay, restart after the persisted deadline, and ensure it resumes rather than waiting for the whole duration again. Do not demand impossible general exactly-once behavior against arbitrary external services.

## 25. API Workbench

Vary delays so responses complete in a different order from requests. Change the selected request and environment while requests are in flight. Inspect request IDs, environment snapshots, the companion log, response history, and the current editor; a late response must not overwrite a newer request's view.

Cancel an actual delayed request and test a timeout separately. Neither outcome is a successful response. Make the documented collection assertion fail deliberately; the run summary must remain failed. Stream multiple events through the real proxy and confirm intermediate events become visible before the stream closes, rather than appearing all at once at completion.

## 26. Config Workbench

Use properties named `a/b` and `x~y`, and distinguish absent values from explicit nulls. Reorder object keys without changing values: that alone must not create a semantic diff. Concurrent identical edits must not create a conflict.

Test delete-versus-edit, array edits on both sides, and a type change versus a nested edit according to the published merge rules. After resolving the merge, undo the entire authoring action and verify all three input documents are unchanged. Enter malformed JSON and attempt save and view switching: the current invalid buffer must not be silently replaced or published.

## 27. Field Notebook

Warm the application normally, then disconnect it from its backend, edit a checklist and note, attach the provided image, and reload while still disconnected. Confirm the actual local draft and image bytes survive, not only a thumbnail URL or in-memory object.

Create an overlapping server edit in an independent context, reconnect the offline client, and inspect both retained versions. Resolve explicitly, resend the same queued operation after restart, and confirm exactly one committed change and attachment. Distinguish pending offline submission from confirmed server submission. Browser service-worker or storage restrictions are environment blocks, not proof that sync works or fails.

## 28. Approval Desk

Use direct authenticated API requests to attempt an auditor mutation, cross-user access to a private draft, and self-approval by a reviewer who authored a request. UI button visibility does not decide these tests; the server must refuse them.

Submit concurrent approvals from the two permitted distinct reviewers, replay one request, and verify the approval threshold without duplicate votes. Create a new revision after approval: old content and decisions remain readable, while the new content has no inherited approval. Exercise stale revisions explicitly rather than accepting whichever revision the UI currently displays.

## 29. Sheetcraft

Copy formulas across both rows and columns with mixed `$` anchors. Compare formulas as well as resulting values. Insert an active cycle, verify honest cell errors, remove it, and confirm recalculation recovers. An inactive `IF` branch must remain lazy under the specified rules.

Use a bulk paste that changes multiple dependent cells and undo it once. Sort a chosen row range containing literals and formulas under the task's explicitly defined rebasing rules; unrelated cells outside the range must not be moved. Test zero, blank, false, text, and error values only against coercion and ordering semantics actually specified by the task.

## 30. Project Planner

Randomize task input order while keeping IDs, priority, dependencies, and resources identical. The deterministic priority-then-ID scheduler must produce the same result. Check both dependency order and resource non-overlap rather than accepting visually plausible bars.

Create two ready tasks with equal priority and test the ID tie-break. Attempt a dependency cycle and verify no partial plan mutation. Extend a predecessor, recompute, then undo: data, Gantt bars, completion date, and dependency-only critical-path metrics must return to the prior state. Do not score a legal heuristic schedule as wrong because a different optimization algorithm finds a shorter plan; the specified algorithm is the oracle.

## Reporting discipline

Keep final task quality separate from diagnostic quality and engineering cost. Do not count each retry as a distinct discovered defect. Record failed hypotheses, useful repairs, new regressions, actual tool usage, budget and any blocked checks. Compare models using matched tasks and sample counts within the same track and rubric. Bind observed results to the final artifact hash. An agent's own success summary is not independent evidence.
