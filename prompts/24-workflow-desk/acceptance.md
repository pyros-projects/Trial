# Public acceptance scenarios: Workflow Desk: Durable Visual Automation

These are model-visible domain checks, not an automated test suite. Start each independent scenario from a documented clean seed or explicitly record which preceding state it uses. UI paths must be exercised in the browser; concurrency, authorization, and durability must also be checked against real server responses and persisted state. Statuses are pass, fail, blocked, or not-run; only observed evidence earns pass. Fixed fixtures illustrate the rules, not permission to hard-code outcomes.

## FLOW-01: Executable branching

**Exercise:** Publish the seed workflow and launch inputs with amounts 12500 and 9000.

**Expected:** High amount waits for approval; low amount terminates without an HTTP effect. Transform output is visible and persisted.

## FLOW-02: Restart while waiting

**Exercise:** Stop the app while the high-amount run awaits approval; restart against the same DATA_DIR and approve twice.

**Expected:** The original run resumes once and eventually succeeds with one effect; the second decision cannot run the step again.

## FLOW-03: Retry before commit

**Exercise:** Select first-attempt-503-before-commit and launch an approved path.

**Expected:** Attempt history contains the failure and retry; receiver stores one effect, not a simulated UI success.

## FLOW-04: Response loss after commit

**Exercise:** Select first-response-timeout-after-commit. Restart during recovery where practical, then inspect attempts and effects.

**Expected:** Caller may retry but reuses the effect key; exactly one receiver effect exists. The UI reports the actual final state.

## FLOW-05: Version pinning and graph validation

**Exercise:** Publish a changed workflow while an old run is waiting; try a cycle and an invalid path expression in a draft.

**Expected:** Old run retains its old version. Invalid drafts cannot publish or corrupt the last published version.

## FLOW-06: Persisted delay and cancellation

**Exercise:** Restart during a pending delay, then separately cancel a run before its next action.

**Expected:** Due time survives restart; cancellation prevents future actions without claiming to roll back already committed effects.
