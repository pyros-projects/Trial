# Public acceptance scenarios: Field Notebook: Offline Inspections and Sync

These are model-visible domain checks, not an automated test suite. Start each independent scenario from a documented clean seed or explicitly record which preceding state it uses. UI paths must be exercised in the browser; concurrency, authorization, and durability must also be checked against real server responses and persisted state. Statuses are pass, fail, blocked, or not-run; only observed evidence earns pass. Fixed fixtures illustrate the rules, not permission to hard-code outcomes.

## FIELD-01: Offline shell and durable input

**Exercise:** Visit online once in context A, go fully offline, edit INS-001, add a real photo, then reload while offline.

**Expected:** The app shell opens; note, checklist, pending operation, and actual photo bytes survive.

## FIELD-02: Independent device conflict

**Exercise:** Context B changes temperature to 42 and the note online while A has unsynced edits. Reconnect A.

**Expected:** A receives a version conflict. Neither side is silently overwritten; base/local/server values are available.

## FIELD-03: Merge and replay

**Exercise:** Keep A note, A checklist/photo, and B temperature; sync against version 2 and replay the accepted operation.

**Expected:** Version becomes 3 once, photo count remains one, and the merged document preserves all selected and independent changes.

## FIELD-04: Pending versus confirmed submission

**Exercise:** Complete a different inspection offline and request submission; reconnect.

**Expected:** Offline status says pending, not confirmed. Server confirms only after validating and committing the complete inspection.

## FIELD-05: Invalid API writes and interrupted uploads

**Exercise:** Submit missing measurements directly; interrupt a photo upload and retry with the same attachment ID.

**Expected:** Invalid submission is rejected server-side; retry cannot create duplicate attachments or lose the local photo.

## FIELD-06: Restart and submitted conflict

**Exercise:** Restart backend and browser; separately let B submit an inspection before A reconnects with edits.

**Expected:** Accepted state and outbox persist. A cannot overwrite submitted state, but can inspect and export its retained local draft.
