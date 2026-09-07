# Public acceptance scenarios: API Workbench: Stateful Request Laboratory

These are model-visible domain checks, not an automated test suite. Start each independent scenario from a documented clean seed or explicitly record which preceding state it uses. UI paths must be exercised in the browser; concurrency, authorization, and durability must also be checked against real server responses and persisted state. Statuses are pass, fail, blocked, or not-run; only observed evidence earns pass. Fixed fixtures illustrate the rules, not permission to hard-code outcomes.

## API-01: Real echo and durable history

**Exercise:** Send a JSON POST with a custom header; inspect client response and companion request log; restart and reopen history.

**Expected:** Method, header, body, status, and request ID agree across both services and the saved execution.

## API-02: Out-of-order completion

**Exercise:** Send delay A=3000 ms, then B=100 ms. Keep B selected; switch the active environment before A completes.

**Expected:** B remains selected. A and B retain their own responses, timing, and original environment snapshots.

## API-03: Cancellation and timeout

**Exercise:** Cancel a delayed request and separately a running stream; test an actual timeout.

**Expected:** Cancelled and timed-out executions are distinct from success, late data does not overwrite selection, and stream output stops.

## API-04: Collection variables and assertions

**Exercise:** Run the seeded pagination collection, then its deliberate assertion failure under both runner policies.

**Expected:** Extraction drives the second request to cursor=2 and item-3; failures are real and stop/continue behavior matches policy.

## API-05: Incremental streaming

**Exercise:** Request five events with visible spacing and observe while still in flight.

**Expected:** Events appear incrementally in order, not all at completion; saved history retains the observed data.

## API-06: Validation and target boundary

**Exercise:** Send an unresolved variable, invalid expanded JSON, an invalid cursor, and a URL outside the allowed companion origin.

**Expected:** Client-side malformed requests and disallowed targets are blocked honestly; server validation responses are shown with their actual status.
