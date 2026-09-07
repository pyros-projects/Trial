# Public acceptance scenarios: Sheetcraft: Spreadsheet with a Formula Engine

These are model-visible domain checks, not an automated test suite. Start each independent scenario from a documented clean seed or explicitly record which preceding state it uses. UI paths must be exercised in the browser; concurrency, authorization, and durability must also be checked against real server responses and persisted state. Statuses are pass, fail, blocked, or not-run; only observed evidence earns pass. Fixed fixtures illustrate the rules, not permission to hard-code outcomes.

## SHEET-01: Seed calculation

**Exercise:** Open the seed workbook and inspect raw formulas and values.

**Expected:** C1=6, C2=20, D1=26, E1=10, F1=11; formula bar shows actual source expressions.

## SHEET-02: Mixed-reference copy and undo

**Exercise:** Copy F1 to F2, then paste a multi-cell range and undo/redo once.

**Expected:** F2 formula is =$A2+B$1+$C$1 and value 13. One undo restores the entire previous raw range, not just one cell.

## SHEET-03: Cycle recovery and lazy IF

**Exercise:** Set A1 to =C1, restore 2, then toggle G1 between =IF(FALSE,G1,7) and =IF(TRUE,G1,7).

**Expected:** Cycles appear and recover correctly. The inactive self-reference evaluates to 7, not #CYCLE!.

## SHEET-04: Parsing and errors

**Exercise:** Exercise precedence, an unknown function, invalid reference, division by zero, text arithmetic, and an error inside an aggregate range.

**Expected:** Each produces the specified value or error without host-language execution or stale results.

## SHEET-05: Stable sorting

**Exercise:** Sort a selected region with tied numeric keys, text, blanks, errors, and relative formulas.

**Expected:** Entire row slices move stably, formulas rebase as specified, blanks/errors remain last, and outside formulas are not rewritten.

## SHEET-06: Persistence and import

**Exercise:** Save, restart, reload, export/import JSON, try a stale tab save, and import a CSV with quoted fields.

**Expected:** Raw formulas and typed values persist; stale save conflicts; invalid import cannot destroy the sheet; default CSV import does not execute formulas.
