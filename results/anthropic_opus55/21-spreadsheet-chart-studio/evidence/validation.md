# Spreadsheet & Chart Studio — validation record

Artifact: `../index.html` (one self-contained file, ~104 KB, no external resources).
Date: 2026-09-30. Author: Claude (agent run). Statuses: **pass**, **fail**, **blocked**, **not-run**.

## Tooling

| Tool | Use |
|---|---|
| `agent-browser` 0.31.1 (headless Chrome over CDP) | All browser validation. I read the installed skill stub (`.agents/skills/agent-browser/SKILL.md`), then its version-matched workflow `agent-browser skills get core --full` and the exploratory-testing workflow `agent-browser skills get dogfood`. |
| Node.js | Engine unit and fuzz tests (`tests/engine.test.js`). This is dev tooling that extracts `<script id="engine">` from `index.html` and runs it in a `vm` context. |
| `python3 -m http.server 8765 --bind 127.0.0.1` | Temporary local server, used only for the opaque-origin iframe check and the direct-HTTP check. Stopped afterwards. |

No substitute browser tool was needed.

## Commands

```bash
# engine: 222 assertions, incl. 60×120-step fuzz comparing incremental recalc with a fresh full recalc
node evidence/tests/engine.test.js
# browser regression: 89 assertions, SHEET-01…07, real clicks/keys against file://index.html
bash evidence/tests/regression.sh | tee evidence/regression-run.txt
```

Helpers are in `tests/ab-helpers.sh`. Cells are targeted as `#c-A1`. "Type into a cell" works like this: click the cell, send the first character as a real keydown (this opens the in-cell editor), insert the rest into the focused editor, then press Enter. The two-step typing exists because `agent-browser keyboard type` uses CDP insertText. insertText only reaches editable elements, so on its own it never fires a keydown on the grid.

Final results:
- `engine tests: 222 passed, 0 failed` (perf: full recalc of 2 574 range formulas ≈40–52 ms; incremental A1 edit ≈20 ms).
- `== RESULT: 89 passed, 0 failed` (full log: `regression-run.txt`).

## Public checks

### SHEET-01 Seed and live chart data — **pass**
- Steps: open `file://…/index.html` at 1280×800, click C1…F1 and read the formula bar, read the rendered bar labels, type `5` into A1 and press Enter, click **Undo**, press Ctrl+Y and then Ctrl+Z on the grid, hover a bar, click it, and focus another bar and press Enter.
- Observed: raw `=A1*B1`, `=A2*B2`, `=SUM(C1:C2)`, `=IF(A1>0,10,1/0)`, `=$A1+B$1+$C$1`. Values C1=6, C2=20, D1=26, E1=10, F1=11.
  - Bars: Current 6/20/26 and Plan 8/18/26, sourced from I2:J4.
  - After A1=5: C1=15, D1=35, F1=23, and Current 15/20/35.
  - Undo restored both the grid and the chart. Redo and undo by keyboard also worked.
  - The tooltip read `Category: Beta / Series: Current / Value: 20 / Source: I3`.
  - Clicking the bar selected I3 (name box I3, formula bar `=C2`). Keyboard Enter on the Total/Plan bar selected J4.
- Screenshots: `01b-seed-desktop.png`, `02-a1-is-5.png`, `03-bar-tooltip.png`, `04-bar-selected-source.png`.

### SHEET-02 Mixed references and range history — **pass**
- Copy F1 → F2 with the **Copy**/**Paste** buttons gave raw `=$A2+B$1+$C$1` and value 13.
- Drag-selecting A1:C2, Ctrl+C, then Ctrl+V at A5 gave C5 `=A5*B5` (6) and C6 `=A6*B6` (20).
- One **Undo** blanked all of A5:C6 and kept F2=13. **Redo** restored the block.
- Pasting the 2×3 block at Y99 was rejected with "would extend past Z100. Nothing changed." Y99:Z100 stayed blank and the undo depth was unchanged.
- B10 `=A10` copied to A10 gave raw `=#REF!` and value `#REF!` (not `#PARSE!`/`#CYCLE!`). Undo restored A10 to blank.
- Screenshots: `05-paste-range.png`, `06-paste-rejected.png`.

### SHEET-03 Lazy branches and cycle recovery — **pass**
- A1 `=C1` made A1, C1, D1, E1, F1, I2 and I4 show `#CYCLE!`, while C2 stayed 20.
  - Chart notes listed "Current · Alpha (I2): error #CYCLE!" and "Current · Total (I4): error #CYCLE!", and those bars were omitted, not drawn as zero.
  - The inspector showed "Circular reference: C1 → A1 → C1".
- A1 `2` recovered every value (6, 26, 10, 11, 6, 26).
- G1 `=IF(FALSE,G1,7)` gave 7. Editing it with F2 to `TRUE` gave `#CYCLE!`, and editing it back from the formula bar gave 7. No reload was needed.
- Screenshot: `07-cycle.png`.

### SHEET-04 Parser and error semantics — **pass**
- In L1:L15 the formulas evaluated as follows:
  - `=2+3*4` 14, `=(2+3)*4` 20
  - `=SUM(A1:B2)` 14, `=MIN(A1:B2)` 2, `=MAX(A1:B2)` 5
  - `=TRUE+2` 3, `=IF(FALSE,1/0,9)` 9
  - `=#REF!` `#REF!`, `=IF(FALSE,#REF!,9)` 9
  - `=1/0` `#DIV/0!`, `=AA1` `#REF!`, `=NOPE(1)` `#NAME?`, `=SUM("text")` `#VALUE!`, `=1+` `#PARSE!`
- Predicted edits outside the provided values: `=A1*B2-C2/4` should be 2·5−20/4 = **5**, and it gave 5 (interactive run). `=(A2-B1)*C1/4` should be (4−3)·6/4 = **1.5**, and it gave 1.5 (regression).
- Range error: B2 `=1/0` turned C2, D1, L3, L4, L5, L15, I3 and I4 into `#DIV/0!`. The inspector for L3 said "arises in B2". B2 `5` recovered them all.
- JSON: the exported file holds `{"type":"formula","formula":"=#REF!"}` and `=IF(FALSE,#REF!,9)`. After import through the file picker, both raw formulas and values (`#REF!`, 9) came back.
- Screenshots: `08-parser-errors.png`, `09-range-error.png`.

### SHEET-05 Chart editing and exports — **pass**
- Drag H1:J4, click **New chart from selection**, and set Type to Line. A second chart tab appeared, so two definitions coexist.
- B2 `7` changed Current to 6/28/34 in the live chart.
- Changing the title (to text containing `<draft>`) and the Current colour (hex field `#7c3aed`) was reflected in the chart. **Export SVG** and **Export PNG** downloaded:
  - `downloads/line-chart.svg`: well-formed XML. The title is escaped as `&lt;draft&gt;`, and it has the legend, the 0–40 axis, Alpha/Beta/Total, and point y-positions matching 6/28/34.
  - `downloads/line-chart.png`: 736×636 PNG, checked visually.
- Clearing I3 removed the Beta point. The note read "Omitted 1 point — not plotted as zero (line breaks at the gap): Current · Beta (I3): blank cell". The Current path is `M… M…` with no segment across Beta, and the SVG export carries an "Omitted 1 point" footnote. Undo restored I3=28.
- Switching column → line and back, dragging the chart frame's resize corner (320 → 438 px tall), and dragging the splitter (side pane 420 → 620 px) all re-rendered the SVG at the new size. B2=7, the title and the colour survived.
- Also checked:
  - Legend toggle, with undo.
  - Invalid range `H1:H4` / `Y1:AA3` rejected inline, with no state change and no undo entry.
  - Lower-case `h1:i3` accepted as `H1:I3`.
  - Negative Plan (−12): the bar goes below the zero baseline and the axis runs −20…30. A zero value draws a 2 px inspectable stub.
  - New chart from a 1-cell selection is refused with a reason.
  - Deleting both charts shows the empty state and disables export. Undo restored both.
- Screenshots: `14-line-chart-edited.png`, `15-line-gap.png`, `16-resized.png`, `23-range-invalid.png`, `24-negative-and-zero.png`, `25-no-charts.png`.

### SHEET-06 Safe file round trips — **pass**
- Export JSON, then change A1=100, clear L8, set the chart title to "Changed title" and the type to line. Importing the export through **Import JSON…** restored the typed raw formulas and the chart as one undo step (depth 6 → 7). Undo returned exactly to the pre-import state (A1=100, title and line type). Redo re-applied the import.
- Rejected without mutation (undo depth and cells unchanged, error in the status bar):
  - out-of-bounds cell `AA1`
  - chart range `H1:H4`
  - duplicate chart id
  - version 2
- CSV fixture imported through **Import text…** → **Import as CSV**:
  - A2 `alpha, beta` (Text)
  - B2 `2` (Number)
  - A3 raw `"line\nbreak"` (Text)
  - B3 literal `=1+1` (raw `'=1+1`, displayed `=1+1`, not 2)
  - Charts were cleared and the empty state shown.
- The same fixture also imports through **Import CSV…**.
- CSV export is exactly `label,value\r\n"alpha, beta",2\r\n"line\nbreak",=1+1\r\n`. A value-level export test is in the engine tests: errors, TRUE and doubled quotes.
- An unterminated quoted field was rejected on both the text and file paths ("the quoted field that starts on line 2 is never closed"), with no change. 27 columns was rejected. Undo after the CSV import restored the chart.
- `<img src=x onerror=…>` typed into a cell renders as literal text: 0 child elements, handler never ran. Chart titles and labels are XML-escaped in the SVG.
- Screenshots: `10-json-rejected.png`, `11-import-text-panel.png`, `12-csv-imported.png`, `13-csv-rejected.png`.

### SHEET-07 Session and browser boundaries
| Item | Status | Evidence |
|---|---|---|
| Keyboard editing and main controls at 1280×800 | pass | Arrow, Tab, Enter, Shift-extend, F2, Esc, Delete, Ctrl+C/V/Z/Y, type-to-replace, formula bar Enter/Esc |
| 390×844 | pass | `scrollWidth` = 390, so no horizontal page scroll. Formula bar, Reset, all file actions and all chart controls sit inside 0–390 px. Mobile edits, Tab navigation, formula-bar edit, Esc cancel, chart title edit, bar click (selects I2) and Reset all worked. Screenshots `17-mobile-top.png`, `18-mobile-full.png`, `19-mobile-chart-point.png`. |
| Edit survives resize | pass | Started typing in B2 at 1280, resized to 390, typed, resized back, typed and pressed Enter. B2=1234 as one undo step. The editor stayed focused and aligned (offset 0,0). See `20-edit-during-resize.png`. |
| Direct file operation | pass | All SHEET checks ran against `file://…/index.html`. The only network entry is the document itself. |
| Opaque-origin iframe | pass | `tests/iframe-harness.html` loads `index.html` in `<iframe sandbox="allow-scripts allow-downloads">` over local HTTP, with external HTTPS aborted via `network route "https://**" --abort`. The parent sees `contentDocument === null` and a SecurityError on `contentWindow.origin`, which proves the origin is opaque. Inside the frame: edit and undo, internal Ctrl+C/V with no clipboard permission, text CSV import and undo, bad JSON rejected, good JSON imported via file picker, bar click selects its source, Reset. Export JSON/CSV/SVG/PNG all downloaded (`downloads/iframe/`); the PNG rasterized without canvas tainting and shows the edited data. See `21-iframe-seed.png`, `22-iframe-after-import.png`. |
| Reload returns seed; no stored state | pass | Reload gives the seed and an empty undo stack. localStorage and sessionStorage are empty and there are no cookies. The app never touches storage. |
| Reset | pass | Restores seed cells and charts. Undo and Redo become disabled. |
| Console / failed requests | pass | `agent-browser errors` and `console` were empty in the file://, iframe and direct-HTTP sessions. Requests were only the local documents plus the in-memory `data:` SVG used for PNG rasterization. A `/favicon.ico` 404 found on direct HTTP open was fixed (see below); the harness page got the same fix. |

## Failures found, fixes, retests

1. **Seed chart table cut off at 1280×800** (only A–H visible). Cells went from 92 → 80 px and the default side pane from 460 → 420 px. Retest: A–J visible (`03-bar-tooltip.png`).
2. **Inspector "Error" label orphaned** in the 4-column grid. Wide rows now start their label in column 1. Retest: `09-range-error.png`.
3. **Stale status message** (for example "Reset…" still showing after later edits). A cell edit now clears it.
4. **File-import failure mislabeled.** The `try` wrapped both `File.text()` and the import. Reading and importing are now separate, so an import error can't be reported as "Could not read". The run that exposed this was my harness passing a relative upload path (Chrome saw a 0-byte unreadable file). With an absolute path the import passes.
5. **`/favicon.ico` 404** when served over HTTP. Added `<link rel="icon" href="data:,">`. Retest: direct HTTP open requests only `index.html`.

Harness-only issues (not app defects), fixed in the scripts:
- insertText typing: see Commands.
- Cells scrolled under the sticky row header after agent-browser's centering `scrollintoview`. The click is correctly refused as "covered"; the harness now scrolls the drag origin into view first.
- A bash variable clash in `regression.sh`.
- `agent-browser download` does not work inside a frame (it lost the frame and left about:blank). Iframe exports were therefore collected from the download directory after plain clicks.
- `agent-browser eval` runs in the top document even after `frame` (only element commands follow the frame). Iframe state was therefore checked through rendered text plus parent-side origin checks.

After the last app change, the full regression (89/89) and the engine suite (222/222) were rerun.

## Blocked / not-run (honest gaps)

- **not-run:** native colour-picker dialog. It is an OS widget, so colour changes were driven through the labelled hex field. The `<input type=color>` shares the same change handler, but that handler was not exercised through the dialog itself.
- **not-run:** touch-specific gestures (tap, double-tap-to-edit, touch drag-select) under touch emulation. The 390×844 checks used mouse and keyboard events.
- **not-run:** screen-reader output. ARIA roles and labels exist (`grid`/`gridcell`, `aria-selected`, `aria-activedescendant`, labelled controls, focusable chart marks with `aria-label`), but no assistive technology was run.
- **partial:** the iframe was served over local HTTP (a harness page is needed to host the sandbox). Direct `file://` was checked separately and passes. A `file://` parent with a sandboxed child was not tried.
- **not applicable:** audio.

## Implementation notes and known limitations

- **Engine.**
  - Hand-written tokenizer and recursive-descent parser.
  - Precedence: comparison < `+ -` < `* /` < unary < primary.
  - A lazy evaluator records the references actually evaluated per formula, which forms a dynamic dependency graph.
  - An edit dirties the changed cells plus their transitive readers. Those cells are re-evaluated precedents-first (static reference order), which keeps recursion shallow; a 2 600-cell chain works.
  - A cycle is detected when a reference hits a cell still on the evaluation stack.
  - No `eval` or `Function` anywhere.
- **Interpretations I chose where the spec leaves room.**
  - Numeric text such as `"5"` is coerced in arithmetic and in scalar SUM/MIN/MAX arguments. The spec says nonnumeric text gives `#VALUE!`, which implies numeric text does not. IF with any text condition is still `#VALUE!`.
  - A single-cell reference passed to SUM/MIN/MAX counts as a scalar: blank → 0, text → `#VALUE!`. Use `A1:A1` for range semantics.
  - A bare identifier (`=foo`) is `#PARSE!`, and `=A0`/`=A101` are `#REF!`.
  - Binary operators evaluate left then right, stopping at the first error, then coerce.
  - Errors inside a range propagate in row-major order.
  - Exponent notation (`2e3`) is accepted for input and literals. `1e999` input stays text (not finite), and `=1e999` gives `#NUM!`.
- **Editing.**
  - Enter and Tab in the grid move the selection, Excel-style. Editing starts by typing, F2 or double-click. Alt+Enter inserts a newline.
  - Paste places the copied block once at the top-left of the selection (no tiling).
  - Copy and paste are internal only; the system clipboard is never read or written.
- **Display.** Numbers show up to 10 significant digits. Long values are ellipsized in 80 px cells; the formula bar and inspector show the full value.
- **Charts.** The column axis always includes 0. The line axis uses the data extent. Series colours after the 8th cycle through the palette.
- `window.__studio` exposes the live state object for diagnostics. It is not frozen. The tests used it only to read undo depth and stored chart settings, plus one in-page `recalcAll()` timing in the load test. All workflow actions were driven through the UI.

## Workbook JSON format (version 1)

```json
{
  "format": "spreadsheet-chart-studio",
  "version": 1,
  "name": "Starter workbook",
  "cells": {
    "A1": { "type": "number", "value": 2 },
    "C1": { "type": "formula", "formula": "=A1*B1" },
    "H1": { "type": "text", "value": "Item" },
    "K1": { "type": "boolean", "value": true }
  },
  "charts": [ { "id": "chart-1", "title": "Current vs Plan", "type": "column",
                "range": "H1:J4", "colors": ["#2a78d6", "#eb6834"], "legend": true } ]
}
```

- `version` must be 1.
- `format`, if present, must match.
- Cell keys must be A1–Z100 and must not repeat, including case-insensitive duplicates.
- Types: `number` (finite), `text`, `boolean`, `formula` (string starting with `=`) and `blank` (accepted and ignored). Blank cells are omitted on export.
- Any cached `value` on a formula cell is ignored, and values are recalculated after import.
- Charts need a unique non-empty `id`, `type` of `column` or `line`, and a `range` that is a rectangle inside the sheet with at least a header row plus one data row and a category column plus one series column. `colors` must be `#rrggbb` strings. `legend` must be a Boolean.
- The whole document is validated before the workbook is replaced atomically.
