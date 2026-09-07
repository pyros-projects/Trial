# Public acceptance scenarios: Import Studio: Reliable Data Onboarding

These are model-visible domain checks, not an automated test suite. Start each independent scenario from a documented clean seed or explicitly record which preceding state it uses. UI paths must be exercised in the browser; concurrency, authorization, and durability must also be checked against real server responses and persisted state. Statuses are pass, fail, blocked, or not-run; only observed evidence earns pass. Fixed fixtures illustrate the rules, not permission to hard-code outcomes.

## IMP-01: Parsing and correction

**Exercise:** Import the adversarial CSV. Verify the embedded newline remains within one row, Lens, wide remains one field, A004 is invalid, and both A005 rows are flagged. Correct A004 quantity to 3 and exclude both A005 rows.

**Expected:** The four included rows are valid; preview shows creates=3, updates=1, unchanged=0, excluded=2; no catalog writes yet.

## IMP-02: Commit and replay

**Exercise:** Commit with one operation key, repeat that exact commit, then import the cleaned four-row CSV under a new operation key.

**Expected:** First and retried response describe the same import. Catalog has five records. New import reports unchanged=4 with zero creates/updates.

## IMP-03: Stale preview

**Exercise:** Prepare a preview, mutate A002 in a second session, then attempt the prepared commit.

**Expected:** A conflict is returned and zero staged changes apply. Refreshing preview re-evaluates against the new revision.

## IMP-04: Decimal and identifier fidelity

**Exercise:** Use the semicolon/comma-decimal fixture, including ID 0007 and price 1,25. Try an ambiguous thousands-style value.

**Expected:** ID stays 0007, price is exactly 125 cents, ambiguous or malformed prices are rejected.

## IMP-05: Persistence and exports

**Exercise:** Restart the backend after a successful import, reopen history, and export JSON plus CSV.

**Expected:** Catalog, identities, mapping profile, counts, and multiline notes are preserved. Reimporting exported data with a corresponding mapping does not create duplicates.

## IMP-06: Failure rollback

**Exercise:** Submit malformed JSON, an oversized file, an unresolved duplicate, and a reused operation key with different content.

**Expected:** Each fails explicitly without a partial catalog write or a misleading success notification.
