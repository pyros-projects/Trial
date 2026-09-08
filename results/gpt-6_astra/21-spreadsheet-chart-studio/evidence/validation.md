# Spreadsheet & Chart Studio — validation evidence

This is an agent-authored record, not an evaluator report. The final status table is completed after all checks.

## Environment and method

- Artifact: `../index.html`, native HTML/CSS/JavaScript/SVG with no external runtime assets.
- Browser: installed `agent-browser`, version-matched `skills get core` and `skills get dogfood` read before use.
- Direct file opened with `agent-browser --session studio --allow-file-access --download-path <workspace>/evidence/downloads open file://<workspace>/index.html`; viewport 1280 × 800, browser offline, then reload.
- Engine tests: `node evidence/tests/engine.test.cjs`. Initial missing-feature failure is preserved in `tests/initial-red.log`; all nine behavioral groups subsequently passed in `tests/engine-green.log`.
- Browser commands, complete arguments, stdin, stdout and exits: `browser-commands.jsonl`. Automated user interaction script: `tests/browser_checks.py`; `eval` calls inspect state/DOM and do not mutate workbook state. Assertions use hand-derived expected values.
- Initial local HTTP ports 8765 and 8877 were occupied. A temporary server bound an available loopback port (44869). This is test infrastructure only.
- An early semantic-locator command used incorrect `find role ... fill` ordering. It reported element-not-found and made no edit. Correct `find label 'Cell or range' fill ...` and `find label 'Formula bar' fill ...` commands then succeeded. `sheet01-edited.png` is the pre-edit image from that failed command attempt; use `sheet01-edited-confirmed.png` / `sheet01-live.png` for the actual edit.

## Observed issues and corrections

### ISSUE-001 — Native color input automation did not enter a hex value

Initial SHEET-05 failed after `fill '#color-list input[data-series-index="0"]' '#d48545'`. The native color input became black, and the tool inserted the hex string into the previously focused title (`A clearer plan#d48545`). Evidence: `screenshots/sheet-05-failure.png`, failed entry in `browser-results.jsonl`, full commands in `browser-commands.jsonl`. Console and uncaught error outputs were empty. The form applied exactly the displayed inputs; this was a native control/tool interaction limitation.

Change: retain native color swatches and add a labeled, validated hex text input for each series, synchronized with its swatch. This supplies a direct keyboard path for exact colors. Retest results are recorded below.

### ISSUE-002 — Invalid copied range endpoints broke an inactive IF branch

Reproduction from Reset: enter `=IF(FALSE,SUM(A1:B2),9)` in C5, Copy C5, Paste B5. The raw input became `=IF(FALSE,SUM(#REF!:A2),9)` but initially evaluated as #PARSE!. The tokenizer already preserved #REF!; the parser did not accept it as a range endpoint.

Fix: range AST endpoints now accept references or #REF! operands. Invalid endpoints yield #REF! only when evaluated. The inactive branch now returns 9; activating the branch returns #REF!.

Evidence: `screenshots/review-range-red.png`, `screenshots/review-range-green.png`, `screenshots/review-range-final.png`, `tests/review-range-red.log`, `tests/review-range-green.log`. Repeated through real Copy/Paste and formula editing, plus an engine regression. **Retest: pass.**

### ISSUE-003 — An unchanged editor commit could change an imported text cell's type

Reproduction: import CSV `text\n=1+1`, select A2, F2, Enter. The original text value `=1+1` initially became calculated 2. `putCell` classified the same raw input again instead of retaining its imported type.

Fix: unchanged raw inputs retain the original typed cell; an unchanged in-cell edit makes no transaction. Evidence: `screenshots/review-literal-red.png`, `screenshots/review-literal-green.png`, `screenshots/review-literal-final.png`, and matching red/green logs. **Retest: pass**, including unchanged history.

### ISSUE-004 — Identical valid imports lacked an undo step

The transaction deduplication originally skipped a valid JSON import when its contents exactly matched the current workbook. A valid import is required to be one undoable operation.

Fix: import explicitly records a transaction, including identical contents. Invalid imports still never reach the transaction. Reproduction and retest: `tests/additional_checks.py unchanged_import`, `tests/unchanged-import-red.log`, `tests/unchanged-import-green.log`. **Retest: pass.**

### ISSUE-005 — Multiline input and CSV line endings could be normalized unintentionally

A single-line in-cell input removed a multiline cell's newline on an unchanged F2/Enter edit. Separately, loading CSV into the text-area preview normalized CRLF inside quoted fields to LF before import; exporting the preview also normalized line endings.

Fix: the in-cell editor and formula bar now support multiline text. Unchanged edits retain the original raw cell, including original line endings. File-picker imports keep the original file text as their source until the user edits the preview. CSV downloads come from the serializer, preserving evaluated content and quoted line endings. Alt + Enter inserts a line break during editing.

Reproduction and retest: `tests/additional_checks.py multiline_edit crlf_file`, corresponding red/green logs, and `downloads/multiline-crlf.csv`. The downloaded file matches the input bytes, including the CRLF inside the quoted field. **Retest: pass.**

### ISSUE-006 — Native form submission was blocked by the required iframe sandbox

Reproduction: load the app in `sandbox="allow-scripts allow-downloads"`, create a chart, enter a valid title/type/H1:J4 range, and click Create chart or press Enter. The form was valid, but the dialog stayed open and chart count stayed 1. Chromium blocks native form submission without `allow-forms`, so the submit callback never ran. This was an application bug, not an authorization requirement.

Fix: chart creation and chart settings activate their validation and editing handlers directly from buttons and input Enter keys. They do not submit a native form. The sandbox was not relaxed. Evidence: `screenshots/iframe-failure.png` shows the former valid, unsubmitted form; `screenshots/sheet07-opaque-mobile.png` shows the successful chart-settings flow. `tests/iframe_checks.py` now verifies Create chart, Apply changes, and keyboard application. **Retest: pass.**

## Browser-tool and infrastructure limitations encountered

These were handled during validation; none leave a required application check blocked.

- Native `input[type=color]` fill was unreliable; a labeled hex entry was added (ISSUE-001). The failed title assertion remains in `browser-results.jsonl`. Exact-color retest passed through the hex control.
- `mouse move` rejected decimal coordinates. The test harness now rounds measured coordinates to integer pixels. The same divider drag passed.
- `keyboard type` refocused a previously filled address input in this tool version. Individual `press` calls exercised real keydown editing and continuity instead. They passed.
- A generic help selector matched the mobile-hidden rail button. The visible `.topbar [data-help]` control passed.
- In the opaque iframe, CSS frame selection and semantic-label search were inconsistent. An accessibility snapshot plus `frame @e1`, followed by CSS selectors for the same labeled controls, worked. Native focus was used before offscreen iframe clicks so controls scrolled into view.
- `agent-browser eval` remained in the outer document even after iframe selection. `tests/iframe_read.cjs` attaches to the same browser's opaque-frame CDP execution context for **read-only diagnostics**. User interactions still use agent-browser.
- The CLI download waiter timed out for an opaque-frame download, although the file was created. `tests/iframe_download.cjs` observes browser-level CDP download events and performs the actual click with agent-browser. It verifies a completed download, the browser's suggested filename, and the actual disk file. JSON, SVG and PNG all completed. No image or download was fabricated from test state.
- An early iframe wrapper request for `/favicon.ico` returned 404. This was the test wrapper's missing favicon; a data favicon was added to that wrapper. The application itself already had an embedded favicon. Final HTTP application/wrapper requests were successful.
- Two early browser sessions unexpectedly restarted into about:blank. `agent-browser doctor --offline --quick` reported 9 passes and no failures. Their cause was not established. Final runs used unique workspace-derived session names, `sheet21-9a42d3169eda` and `sheet21-9a42d3169eda-opaque`, and passed. The failed attempts remain in the command/result logs.
- One extra iframe assertion initially expected F2=25 after A1=5. This agent-authored expectation was an arithmetic error: the rebased formula is 4+3+15=22. It was corrected to 22. The supplied public fixtures and expectations were not modified.

## Final status

All numbered checks began from Reset. `browser-results.jsonl` is chronological and intentionally retains unsuccessful attempts before successful retests.

| Public check | Final status | Observed results and evidence |
|---|---|---|
| SHEET-01 | **pass** | C1/C2/D1/E1/F1 = 6/20/26/10/11. Both actual series matched. A1=5 changed C1/D1/F1 to 15/35/23 and Current to [15,20,35]; Undo restored them. Hovered Beta/Current/20/I3 and clicked it to select I3 with raw =C2. `screenshots/sheet01-live.png`, `sheet01-source-selected.png`. |
| SHEET-02 | **pass** | F1→F2 raw `=$A2+B$1+$C$1`, value 13. A1:C2→A5:C6 rebased and calculated correctly. One Undo removed all six pasted cells while keeping F2; Redo restored them. Z100 overflow left the entire workbook and history unchanged. B10→A10 produced =#REF!, then Undo restored blank. `sheet02-rejected-paste.png`, `sheet02-ref-operand.png`. |
| SHEET-03 | **pass** | Active cycles propagated through A1/C1/D1/E1/F1 and chart sources, with visible error omissions. A1=2 recovered. IF(FALSE,G1,7)→IF(TRUE,G1,7)→FALSE gave 7→#CYCLE!→7 without reload. Inactive self-reference had no active dependencies. `sheet03-active-cycle.png`. |
| SHEET-04 | **pass** | Every supplied precedence, aggregate, Boolean, lazy IF and error formula matched. An error in A1:B2 propagated through SUM/MIN/MAX, then recovered. Additional prediction: `=-K7*2+7/2` gave -21.5 for K7=12.5, then 11.5 for K7=-4. A malformed inactive branch still gave #PARSE!. #REF! and lazy #REF! formulas survived actual JSON download/import. `sheet04-errors-and-json-roundtrip.png`, `downloads/parser-roundtrip.json`. |
| SHEET-05 | **pass** | Created a second, line chart. B2=7 gave Current [6,28,34]. Edited title to A clearer plan and Current color to #d48545. Downloaded SVG/PNG and inspected their actual contents/rendering. Clearing I3 omitted a blank and produced two disconnected Current path segments. Undo restored the point. Chart type switches, pointer divider resize, and chart delete/undo preserved data. `sheet05-line-current.png`, `sheet05-line-gap.png`, `downloads/current-line.svg`, `downloads/current-line.png`. |
| SHEET-06 | **pass** | JSON download → cell/chart changes → file-picker import restored typed sources/charts; Undo restored the state before import. Invalid address, chart range, version, and duplicate IDs left workbook/history identical. Supplied CSV preserved comma/newline/numeric/literal-formula fields. Malformed CSV was atomic. HTML-looking text stayed inert. JSON retained apostrophe-forced literal text. `sheet06-invalid-address.png`, `sheet06-invalid-range.png`, `sheet06-malformed-csv.png`, `sheet06-safe-text.png`, and downloaded JSON/CSV files. |
| SHEET-07 | **pass** | Actual keyboard/pointer controls at 1280×800 and 390×844. In-cell and formula drafts survived resize. Direct file worked offline. Opaque origin null, parent/storage access raised SecurityError, clipboard permissions were denied; editing, import/export and chart controls still worked. Reset/reload returned the seed and cleared history. Final console/error outputs were empty. `desktop-final.png`, `mobile-final.png`, `sheet07-desktop-pointer-selection.png`, `sheet07-mobile-chart-controls.png`, `sheet07-opaque-edit.png`, `sheet07-opaque-mobile.png`, `direct-file-diagnostics.json`, `opaque-diagnostics.json`. |

Additional browser checks passed for zero-valued points, negative columns, separate Boolean/text/error/blank omission reasons, empty chart state, literal no-op editing, lazy invalid copied ranges, identical import history, and byte-preserving multiline CSV. `screenshots/additional-negative-zero.png`, `additional-empty-chart.png`, and the regression logs record these checks.

## Exact final commands and reproducibility

All test scripts are development tools and are not runtime dependencies. Run from the application directory. `browser-commands.jsonl` preserves the exact expanded command and stdin for every scripted interaction/inspection.

```bash
agent-browser skills get core
agent-browser skills get dogfood
agent-browser session id --scope worktree --prefix sheet21

agent-browser --session sheet21-9a42d3169eda --allow-file-access \
  --download-path "$PWD/evidence/downloads" open "file://$PWD/index.html"
agent-browser --session sheet21-9a42d3169eda set offline on
agent-browser --session sheet21-9a42d3169eda set viewport 1280 800

node evidence/tests/engine.test.cjs
python3 evidence/tests/browser_checks.py SHEET-01 SHEET-02 SHEET-03 SHEET-04 SHEET-05 SHEET-06
python3 evidence/tests/review_regressions.py range final
python3 evidence/tests/review_regressions.py literal final
python3 evidence/tests/additional_checks.py unchanged_import multiline_edit crlf_file charts_mixed
python3 evidence/tests/boundary_checks.py
```

The temporary HTTP server was started with:

```bash
python3 -u - <<'PY'
import http.server
server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), http.server.SimpleHTTPRequestHandler)
print(server.server_address[1], flush=True)
server.serve_forever()
PY
```

It selected port 44869. If rerunning, use the port printed by your server:

```bash
agent-browser --session sheet21-9a42d3169eda-opaque \
  --proxy http://127.0.0.1:9 --proxy-bypass '127.0.0.1,localhost' \
  --download-path "$PWD/evidence/downloads" \
  open http://127.0.0.1:44869/evidence/iframe.html
python3 evidence/tests/iframe_checks.py
```

The proxy intentionally cannot reach external hosts; loopback remains reachable. A separate diagnostic `fetch('https://example.com/studio-validation-probe')` was explicitly blocked and returned TypeError. That failed request is a **test probe**, not an application request. The final application issued only local document reads and an internal blob image read for PNG generation; no external application assets or services were requested. New sessions had no saved state or restored resource cache.

## Artifact and export verification

- `artifact-checks.json` records the final byte size and SHA-256. The artifact has two embedded scripts, no external script/asset URLs, no formula eval/Function, and no network or persistence APIs in its scripts.
- `tests/engine-final.log`: **11 behavioral test groups passed**, including a chain through all 2,600 cells and nonfinite arithmetic.
- `current-line.svg` was parsed as XML: title, H1:J4 source, Alpha/Beta/Total labels, Current/Plan legend, #d48545 color, and Current [6,28,34] / Plan [8,18,26] were verified. The actual 1520×880 PNG was visually inspected for those plotted positions, title, axes, category order, and legend.
- Opaque-frame SVG and PNG also downloaded successfully with the browser's correct suggested filenames. The SVG contained Current [15,20,35]. The actual PNG was visually inspected and showed those bars, category labels, axes, and legend.
- The delivered `index.html` remains the seed application. Test edits are not written back to it.

## Remaining coverage limits

No public check remains failed or blocked. Browser coverage was Chrome 143 through agent-browser 0.31.1 on Linux, including narrow viewport emulation; other browser engines, physical touchscreen hardware, and assistive-technology readers were **not run**. Native OS color-picker automation remains unreliable, but the supported labeled hex-color control was tested. Evidence records tool substitutions for opaque-frame diagnostics/download observation; actual UI interactions used agent-browser throughout.
