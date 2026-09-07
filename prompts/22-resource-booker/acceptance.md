# Public acceptance scenarios: Resource Booker: Conflict-Free Reservations

These are model-visible domain checks, not an automated test suite. Start each independent scenario from a documented clean seed or explicitly record which preceding state it uses. UI paths must be exercised in the browser; concurrency, authorization, and durability must also be checked against real server responses and persisted state. Statuses are pass, fail, blocked, or not-run; only observed evidence earns pass. Fixed fixtures illustrate the rules, not permission to hard-code outcomes.

## BOOK-01: Interval boundaries

**Exercise:** On seeded Aurora, book 11:00–12:00 Europe/Berlin on 2026-09-14; attempt 10:30–11:30 and 12:30–13:30.

**Expected:** The adjacent booking succeeds. The overlaps with the booking and maintenance block fail without side effects.

## BOOK-02: Concurrent contenders

**Exercise:** Use two independently authenticated-or-isolated browser sessions and simultaneous API submissions for the same free Boreal interval.

**Expected:** Exactly one succeeds; one receives a conflict. Only one durable booking exists. Repeat on different resources and both succeed.

## BOOK-03: Local-time recurrence

**Exercise:** Create the two Sunday 09:00 Berlin occurrences in the task. Try the nonexistent and ambiguous local times.

**Expected:** Occurrences start at 08:00Z and 07:00Z; local 09:00 is retained. Invalid wall-clock inputs are rejected, not shifted.

## BOOK-04: Exception and atomic series edit

**Exercise:** Move one occurrence. Then try a whole-series change with one occurrence overlapping maintenance.

**Expected:** The single exception affects only that ID. Failed series replacement leaves every original occurrence unchanged.

## BOOK-05: Stale editor and idempotency

**Exercise:** Edit the same booking from two sessions, then repeat a successful creation request with its original key.

**Expected:** Stale edit is rejected; successful creation is not duplicated; different payload with the same key fails.

## BOOK-06: Restart and alternate views

**Exercise:** Restart, open calendar and list views, cancel a booking, then query availability and export.

**Expected:** All views agree; cancelled intervals are free, history is retained, and stored times do not drift.
