# Public acceptance scenarios: Stockroom: Inventory and Order Fulfillment

These are model-visible domain checks, not an automated test suite. Start each independent scenario from a documented clean seed or explicitly record which preceding state it uses. UI paths must be exercised in the browser; concurrency, authorization, and durability must also be checked against real server responses and persisted state. Statuses are pass, fail, blocked, or not-run; only observed evidence earns pass. Fixed fixtures illustrate the rules, not permission to hard-code outcomes.

## STOCK-01: Competing reservations

**Exercise:** Create two seven-unit KIT-100 orders against stock 10. Submit reservations concurrently.

**Expected:** One all-or-nothing reservation succeeds: physical=10, reserved=7, available=3; the other has no allocation.

## STOCK-02: Partial shipment and retry

**Exercise:** Ship four from the winner and repeat with the same operation key.

**Expected:** One shipment exists; physical=6, reserved=3, available=3; both responses refer to the same committed operation.

## STOCK-03: Cancellation and return

**Exercise:** Cancel the remaining three, return two shipped units, and replay the return.

**Expected:** After cancel: 6/0/6. After return and replay: 8/0/8. The original order is not reopened.

## STOCK-04: Invalid amounts and key conflict

**Exercise:** Attempt an excessive return, over-shipment, noninteger quantity, and a reused key with different payload.

**Expected:** All fail; no ledger event or aggregate quantity changes.

## STOCK-05: Multi-line atomicity

**Exercise:** Attempt to reserve an order containing available KIT-100 and unavailable LENS-200.

**Expected:** Neither line is allocated. After receiving LENS-200, a new valid reserve attempt can succeed.

## STOCK-06: Restart and reconciliation

**Exercise:** Restart after shipment; inspect order, ledger, allocations, JSON export, and reconciliation view.

**Expected:** All durable representations agree; replaying the committed key after restart is still idempotent.
