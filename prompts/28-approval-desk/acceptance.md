# Public acceptance scenarios: Approval Desk: Versioned Change Requests

These are model-visible domain checks, not an automated test suite. Start each independent scenario from a documented clean seed or explicitly record which preceding state it uses. UI paths must be exercised in the browser; concurrency, authorization, and durability must also be checked against real server responses and persisted state. Statuses are pass, fail, blocked, or not-run; only observed evidence earns pass. Fixed fixtures illustrate the rules, not permission to hard-code outcomes.

## APPROVE-01: Revision-specific two-person approval

**Exercise:** Alice submits CR-001 revision 1; Bob and Cara approve it. Alice creates revision 2 with worker count 12.

**Expected:** Revision 1 remains approved with count 8 and two decisions; revision 2 is a separate unapproved draft with no inherited decisions.

## APPROVE-02: Backend permission matrix

**Exercise:** As Dana, attempt direct mutation routes. As Alice, fetch Erins private CR-002 draft; forge role input.

**Expected:** Requests are denied server-side without business-state changes, regardless of visible controls or forged role fields.

## APPROVE-03: Own-review and duplicate decisions

**Exercise:** Bob creates/submits a request and attempts self-approval; repeat a valid decision on another revision with new and repeated operation keys.

**Expected:** Self-approval fails. One reviewer contributes at most one decision per revision; matching replay does not increase the count.

## APPROVE-04: Concurrent reviews and terminal state

**Exercise:** Send Bob and Cara approvals concurrently on a fresh submitted revision, then attempt another decision.

**Expected:** Both approvals persist and state becomes approved; terminal revision refuses additional decisions.

## APPROVE-05: Stale drafts and safe rendering

**Exercise:** Edit one draft from two sessions, then add text resembling executable HTML in a permitted comment.

**Expected:** Stale save is rejected; untrusted content displays literally and never executes.

## APPROVE-06: Restart, export, and logout

**Exercise:** Restart and inspect/export full history, then logout and repeat an authenticated API request.

**Expected:** Content, decisions, and actor-linked audit survive; logged-out session is no longer authorized.
