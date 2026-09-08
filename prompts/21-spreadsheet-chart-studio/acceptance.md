# Public validation checks: Spreadsheet & Chart Studio

Perform these checks through the actual browser application. Start each numbered check from Reset unless it explicitly continues its own preceding action. Record observed outcomes and relevant screenshots; examples are checks of general behavior, not permission to hard-code results. Use pass, fail, blocked, or not-run honestly.

## SHEET-01: Seed and live chart data

Inspect raw formulas and calculated cells: C1=6, C2=20, D1=26, E1=10, F1=11. Inspect the H1:J4 chart: Current [6,20,26], Plan [8,18,26]. Change A1 to 5: C1=15, D1=35, F1=23 and Current [15,20,35]. Undo restores both grid and chart. Inspect a bar and select its actual source cell.

## SHEET-02: Mixed references and range history

Copy F1 to F2 using the app controls: raw formula `=$A2+B$1+$C$1`, value 13. Copy A1:C2 to A5:C6: C5 is `=A5*B5`, C6 is `=A6*B6`, results 6 and 20. One undo removes the entire pasted rectangle while retaining F2; redo restores it. Attempt a paste extending beyond Z100 and verify no partial mutation. Enter B10=`=A10`, then copy B10 to A10: the adjusted reference is `#REF!`, not a parse error or cycle; undo restores blank A10.

## SHEET-03: Lazy branches and cycle recovery

Set A1 to `=C1`: A1/C1 and dependent results show `#CYCLE!`; the affected chart points report errors. Restore A1=2 and verify recovery. Enter G1=`=IF(FALSE,G1,7)`: result 7. Switch FALSE to TRUE: `#CYCLE!`; switch back: 7 without reload.

## SHEET-04: Parser and error semantics

In unused cells evaluate `=2+3*4` as 14, `=(2+3)*4` as 20, `=SUM(A1:B2)` as 14, `=MIN(A1:B2)` as 2, `=MAX(A1:B2)` as 5, `=TRUE+2` as 3, and `=IF(FALSE,1/0,9)` as 9. Check `=#REF!` yields `#REF!` and `=IF(FALSE,#REF!,9)` yields 9; preserve these formulas through JSON export/import. Check `=1/0`, `=AA1`, `=NOPE(1)`, `=SUM("text")`, and `=1+` produce `#DIV/0!`, `#REF!`, `#NAME?`, `#VALUE!`, and `#PARSE!`. Put an error in a referenced range and verify propagation/recovery. Predict and test another arithmetic edit outside the provided values.

## SHEET-05: Chart editing and exports

Create a line chart from H1:J4. Edit B2 to 7: Current becomes [6,28,34]. Change a chart title/color and export SVG and PNG; inspect both files for current labels and data. Clear I3: the second Current point is omitted with a reason and a line gap. Undo restores it. Switch between chart types and resize without losing edits.

## SHEET-06: Safe file round trips

Export JSON, change cells and chart settings, then import the export: typed raw formulas and charts return; undo restores the state before import. Reject an out-of-bounds cell or invalid chart range without mutation. Import this CSV through the UI:

```csv
label,value
"alpha, beta",2
"line
break",=1+1
```

Verify A2 is `alpha, beta`, B2 is numeric 2, A3 contains a newline, and B3 is literal `=1+1`, not 2. CSV export preserves evaluated content and quoting. An unterminated quoted field is rejected without changing the workbook. Text resembling HTML remains inert.

## SHEET-07: Session and browser boundaries

Exercise keyboard editing and main controls at 1280 x 800 and 390 x 844. Test direct-file operation and an opaque-origin iframe with scripts/downloads allowed, external requests blocked, and no stored state or clipboard permission. Edit a cell, then reload: the seed returns. Reset restores the seed charts/cells and clears history; JSON downloads remain the explicit way to retain edits. Check the console and failed requests, and record any blocked browser coverage honestly.
