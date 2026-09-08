# Spreadsheet & Chart Studio

## Agentic development workflow

Build the complete application in one end-to-end agentic run. You may use the filesystem, shell, dependency tools, compilers, linters, tests, documentation, browser automation, and debugging tools from the beginning, within the permissions and budget assigned by the harness. Plan, implement incrementally, execute, inspect, diagnose, and improve your work throughout development. No previous implementation is assumed. Do not stop at a proposal, scaffold, screenshot, or partially connected demo.

Use the installed browser automation skill `agent-browser` to validate your work. Read the installed skill and its version-matched core workflow before use; consult its exploratory-testing workflow when available. If this capability is genuinely unavailable, use another available real-browser automation tool, record the substitution, and state any coverage that remains blocked. Do not fabricate successful tool use or let a missing optional tool prevent useful work with the tools you do have. The evaluator records tool availability separately from implementation quality.

## Validation

Exercise the actual main workflow using browser navigation, labeled controls, pointer and keyboard input, and screenshots. Merely loading the page, inspecting source code, or observing a DOM element does not establish that a feature works. For Canvas, WebGL, audio, games, and other non-DOM state, perform real interactions and inspect both rendered output and relevant live diagnostics. Check the browser console, uncaught errors, failed requests, and meaningful application state.

Check normal desktop and narrow viewports (at least 1280 x 800 and 390 x 844), input continuity, primary controls, error states, navigation, and any required pause/reset, import/export, or persistence behavior. Reproduce observed failures, fix their cause, and repeat the failed flow plus a compact regression test after material changes. Run the task-specific checks below against genuine application behavior. Do not modify benchmark requirements, supplied fixtures, expected results, or evaluator code to make a test pass.

Keep evidence in a sibling `evidence/` directory: an agent-authored `validation.md` with the exact steps and commands, observed results, failures, relevant screenshots/logs, fixes, and retest outcomes. Use pass, fail, blocked, or not-run honestly; a blocked check is not a pass. Do not write or invent an evaluator-owned score or report. End within the assigned budget with the best working implementation and an explicit account of remaining limitations.

### Standalone HTML delivery and runtime checks

Write the final application to `index.html` in the working directory. The delivered application must remain one self-contained file with the original runtime/dependency restrictions; development tools, test scripts, and a temporary local HTTP server for browser inspection are allowed and are not runtime dependencies of the delivered artifact. Keep evidence and test harnesses outside `index.html`.

Verify that opening the delivered file directly works as required, and that it does not fetch external assets or services. If your browser tool only supports local HTTP, also inspect the artifact's dependency assumptions, record the direct-file check as blocked rather than passed, and preserve direct-file compatibility. When checking via local HTTP, block external internet but leave that local server reachable; test without external cached resources. For audio, explicitly enable playback with a user gesture. Do not claim audio quality was heard when only meters or audio state were inspected.

## Application requirements

Create **Spreadsheet & Chart Studio**, a polished spreadsheet for exploring a small dataset, understanding its formulas, and building charts from its actual cells. Deliver one self-contained `index.html` with embedded HTML, CSS, JavaScript, and assets. No runtime library, framework, build step, external font, network request, backend, account, or external fixture may be required.

All editable workbook, chart, and undo state lives in this document's memory. Do not require cookies, localStorage, IndexedDB, service workers, or a shared origin. A fresh load opens the seed below. Provide a clearly labeled Reset that restores that seed and clears undo/redo; explicit downloads are how users keep work. Main editing and import/export controls must also work in an opaque-origin iframe with scripts and downloads allowed, without clipboard permission or parent-page access.

### Grid and formula engine

Use one fixed sheet, A1:Z100. Provide cell and rectangular selection, in-cell editing, a formula bar, arrow/Tab/Enter navigation, clear, internal Copy/Paste, undo/redo, and a selected-range numeric count/sum. Keep raw input separate from calculated value. Distinguish number, text, Boolean, blank, and formula cells in the model and JSON. An initial apostrophe forces literal text; otherwise a leading `=` starts a formula, finite signed decimal input becomes a number, case-insensitive TRUE/FALSE becomes a Boolean, empty input is blank, and other input is text. Render text resembling HTML as inert text.

Implement a real tokenizer/parser and dependency recalculation; never use JavaScript eval or Function to interpret formulas. The bounded grammar supports finite decimal numbers, double-quoted strings with doubled-quote escaping, TRUE/FALSE, A1 references with optional `$` on either component, parentheses, unary `+ -`, binary `+ - * /`, comparisons `= <> < <= > >=`, and case-insensitive SUM, MIN, MAX, IF. Precedence, highest first: parentheses/function calls, unary signs, multiplication/division, addition/subtraction, comparisons. Binary operators at each level associate left to right. References and function names are case-insensitive. The grammar also accepts `#REF!` as an error operand, including operands generated by copy rebasing. Preserve it in raw formulas and JSON round trips; evaluating it yields `#REF!`, while an inactive IF branch containing it remains unevaluated. Quoted or apostrophe-forced `#REF!` remains ordinary text. Rectangular ranges are allowed as SUM/MIN/MAX arguments; ranges elsewhere are a visible `#VALUE!`.

In arithmetic, blank is zero and Boolean is 1 or 0; nonnumeric text gives `#VALUE!`. A direct reference to blank gives zero. Comparisons are numeric for number/Boolean/blank operands, case-sensitive lexicographic for two strings, and `#VALUE!` for mixed text/numeric operands. Division by zero gives `#DIV/0!`, an out-of-sheet reference gives `#REF!`, an unknown function gives `#NAME?`, malformed syntax gives `#PARSE!`, wrong argument count gives `#VALUE!`, and a nonfinite numeric result gives `#NUM!`. Propagate the first evaluated error from left to right.

SUM/MIN/MAX accept one or more scalar expressions or rectangular ranges. Ranges ignore text and blank cells, include numbers and Booleans, and propagate errors; scalar nonnumeric text is `#VALUE!`. With no numeric range values, all three return zero. Parse the entire IF formula, but evaluate only its condition and selected branch. IF takes exactly three arguments; numeric zero/blank is false, other numbers are true, Booleans retain their value, and text conditions are `#VALUE!`. An error or self-reference in an inactive branch must not poison the result.

Recalculate affected formulas when a precedent or active IF branch changes. Detect cycles through actually evaluated references, show `#CYCLE!` on the cycle and dependent results, and recover when corrected. Expose a compact dependency/error inspector for the selected cell. Cached values must never survive a relevant edit incorrectly.

### Editing and charts

Internal Copy captures a rectangular snapshot of raw inputs. Paste rebases only relative reference components by the source-to-target offset; `$` components stay fixed. An adjusted reference outside the sheet becomes a `#REF!` operand. Reject a paste whose destination rectangle exceeds the sheet before changing anything. A range paste, clear, import, or chart edit is one undoable action restoring all source inputs/settings, followed by recalculation. Internal recalculation/rendering must not add undo entries. Keep coordinates fixed: row/column insertion, deletion, sorting, and cut/move semantics are outside this task.

Provide live grouped-column and line charts, with at least two editable chart definitions supported. A chart uses a contiguous rectangle with a header row, category labels in its first column, and one or more numeric series in the remaining columns. Users can create/delete a chart and change its title, type, range, series colors, and legend visibility. Column charts include zero in the value axis and support negatives. Line charts preserve category order. Numeric zero is a real point; blank, text, Boolean, or error-valued data is omitted with a visible count/reason, and an omitted line point creates a gap. Do not silently turn missing/error cells into zero.

Charts must read calculated cells after every edit, undo, and import. Show category, series, value, and source address on point/bar inspection; selecting a point selects its source cell. Export the selected chart as SVG and PNG using current data, labels, axes, and legend. No canned chart values or screenshot substitutes.

### Embedded starting workbook

Seed numeric A1=2, B1=3, A2=4, B2=5; C1=`=A1*B1`, C2=`=A2*B2`, D1=`=SUM(C1:C2)`, E1=`=IF(A1>0,10,1/0)`, and F1=`=$A1+B$1+$C$1`. All other cells start blank except the chart table below. Initial results are C1=6, C2=20, D1=26, E1=10, F1=11. Copying F1 to F2 yields raw `=$A2+B$1+$C$1` and value 13.

| Cell row | H: Item | I: Current | J: Plan |
|---|---|---|---|
| 1 | Item | Current | Plan |
| 2 | Alpha | `=C1` | 8 |
| 3 | Beta | `=C2` | 18 |
| 4 | Total | `=D1` | 26 |

The H-column entries and headers are text. Open a grouped-column chart named Current vs Plan from H1:J4: Current is [6,20,26], Plan is [8,18,26]. Changing A1 to 5 gives C1=15, D1=35, F1=23, and Current [15,20,35]. These examples check general algorithms; do not special-case their addresses or values.

### Files and presentation

Export/import a documented, versioned JSON workbook containing typed raw cells, name, and chart definitions. Preserve formulas and literal formula-looking text; calculate values after import instead of trusting imported caches. Validate types, unique chart IDs, addresses, ranges, and supported version before atomically replacing the workbook. Invalid input leaves the workbook and undo stack unchanged. A valid import is one undoable operation.

Support CSV import and export with quoted commas, doubled quotes, and multiline fields. CSV import replaces the cells and clears charts as one action. Syntactically valid finite numeric fields become numbers; other nonempty fields are literal text, including fields beginning with `=`; empty fields are blank. Reject malformed CSV or excess rows/columns atomically. CSV export contains evaluated values with correct quoting, not formula sources. Provide file-picker and text-entry import paths so system clipboard access is optional.

Make dense data comfortable: readable headers and formats, distinct focus/selection, resizable chart/grid areas, useful empty/error states, and a concise formula reference. At 390 x 844 the grid may scroll, but the formula bar, Reset, file actions, and chart controls must remain reachable. Keep at least this 100 x 26 sheet responsive without dropping an edit during resize. The benchmark values calculation correctness, usable data exploration, coherent charts, and recovery over an enterprise feature list.

---

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

## Completion

Leave the finished `index.html` and the evidence directory on disk. Return a concise delivery note with the artifact path, what you actually tested, and any unresolved failures or blocked checks. Do not paste the whole implementation into the final message when filesystem delivery is available.
