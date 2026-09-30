# Validation — Spreadsheet & Chart Studio

Artifact: [index.html](../index.html), 100,505 bytes. Browser: agent-browser 0.31.1 with Chrome 143; installed version-matched core, full command reference, and dogfood workflows read before use. Runtime dependencies: none. These are agent-authored observations, not evaluator results.

## Development record

- Workspace initially contained only .agents/. No previous app, fixtures, tests, or git repository.
- Design and execution decisions are recorded in design-plan.md. Runtime state will remain entirely in memory.
- Final complete browser run passed. Exact commands and observed assertions are in [logs/final-run.log](logs/final-run.log); command exit statuses are in [logs/final-run-status.json](logs/final-run-status.json).

## Check status

| Check | Status | Evidence |
| --- | --- | --- |
| SHEET-01 | pass | Seed/raw formulas, live chart changes, Undo, hover and source-cell selection. [Log](logs/sheet01-browser.log), [source inspection](screenshots/sheet01-source-inspection.png). |
| SHEET-02 | pass | Mixed references, rectangle history, rejected oversized paste, rebased #REF!. [Log](logs/sheet02-browser.log), [range paste](screenshots/sheet02-range-paste.png). |
| SHEET-03 | pass | Active cycles, dependent errors/chart omissions, recovery, lazy self-reference. [Log](logs/sheet03-browser.log), [cycle](screenshots/sheet03-active-cycle.png). |
| SHEET-04 | pass | Requested parser/error cases, range recovery, predicted arithmetic, #REF! JSON round trip. [Log](logs/sheet04-browser.log), [parser](screenshots/sheet04-parser-results.png). |
| SHEET-05 | pass | Two charts, current data, title/color, real SVG/PNG, line gap, Undo, type switches and resizing. [Log](logs/sheet05-browser.log), [line gap](screenshots/sheet05-line-gap.png), [PNG inspection](screenshots/exported-png-browser.png). |
| SHEET-06 | pass | Typed JSON and import Undo, invalid files atomic, quoted/multiline CSV, literal formula text, inert HTML. [Log](logs/sheet06-browser.log), [CSV](screenshots/sheet06-csv-literals.png). |
| SHEET-07 | pass | 1280×800 and 390×844 real editing, resize continuity, reachable controls, direct file, opaque iframe, downloads, reload/Reset, external network blocked. [Desktop/mobile log](logs/sheet07-desktop-mobile.log), [file log](logs/sheet07-direct-file.log), [iframe log](logs/sheet07-opaque-ref.log). |

## Final reproduction commands

Run a temporary server from the working directory, then use a fresh browser session with external internet blocked and localhost reachable:

```sh
python3 -m http.server 8765 --bind 127.0.0.1
agent-browser --session studio-verified --proxy http://127.0.0.1:9 --proxy-bypass '127.0.0.1,localhost' open http://127.0.0.1:8765/index.html
python3 evidence/tests/final_run.py
python3 evidence/tests/extra_workflows.py identical
python3 evidence/tests/extra_workflows.py extras
python3 evidence/tests/artifact_evidence.py
```

The final runner executes the opaque iframe workflow, navigates to the main application, runs all six sheet workflows, tests desktop/mobile and direct-file behavior, runs the 8-test formula/data suite, and checks the standalone artifact. Every numbered public check starts with Reset. Each test harness logs its exact agent-browser actions. Application mutations occur through real clicks, fills, keyboard input, native file selection, and downloads; DOM evaluation reads results and geometry.

No previous browser state or external cached resources were restored. The dead external proxy permits only the explicit localhost bypass. An external fetch probe was rejected; application HAR captures contain only local/file documents and generated Blob images. Final static inspection confirms no external asset references, network clients, storage APIs, clipboard APIs, parent access, eval, or Function interpreter.

## Executed so far

- `node --test evidence/tests/core.test.cjs`: initial 7/7 failed for missing functionality (logs/core-red.log); implemented core, then 7/7 passed (logs/core-green.log, core-ui.log).
- Launched local server: `python3 -m http.server 8765 --bind 127.0.0.1`.
- Browser initialized: `agent-browser --session studio-offline --proxy http://127.0.0.1:9 --proxy-bypass '127.0.0.1,localhost' open http://127.0.0.1:8765/`. Fresh session with no restored state/cached external resources. Local origin reachable; explicit external fetch probe rejected as expected. Probe console was cleared before app checks.
- `python3 evidence/tests/browser_workflows.py 1 2 3`: PASS for all three. This script logs every exact CLI command and observation to logs/sheetNN-browser.log. Actions use labeled controls, pointer clicks/hover, and Enter; DOM evaluation only reads rendered/live state.
- SHEET-01: seed results/raw formulas, chart points, A1=5 live changes, Undo, bar hover/click selecting I3, range count4/sum14. Screenshots: sheet01-live-edit.png, sheet01-source-inspection.png.
- SHEET-02: mixed F1→F2 formula/value13; A1:C2→A5:C6 formula/value6/20; single Undo and Redo for range; Z100 paste rejected with cell values and history unchanged; B10→A10 becomes =#REF!, Undo restores blank. Screenshots: sheet02-range-paste.png, sheet02-rejected-paste.png, sheet02-rebased-ref-error.png.
- SHEET-03: active A1/C1 cycle and dependent errors, chart omissions #CYCLE!; seed recovery; lazy G1 self-reference false→true→false gives7→#CYCLE!→7 without reload. Screenshots: sheet03-active-cycle.png, sheet03-lazy-recovery.png.
- Console/uncaught-error checks empty after each of SHEET-01–03.

## Failure and diagnosis — large test payload

- SHEET-04 first attempt: all requested parser values and range propagation/recovery passed, then the test harness could not launch a CLI fill with a 194 KB exported JSON argument (`OSError: [Errno 7] Argument list too long`). The application was not reached by this failed command; full log preserved in logs/sheet04-browser-attempt1.log and status-4-attempt1.json.
- Root cause: Linux per-argument limit in Python subprocess, not JSON parsing in the app. Test harness now streams large commands to `agent-browser batch --bail` via stdin; exact input is saved as logs/streamed-command-*.json. Assertions and requirements remain unchanged.

## Reviewed calculation and chart regressions

- Independent reviewer identified invalid rebased range endpoints and subnormal chart-axis underflow (review.md).
- Added failing `copied invalid range endpoints remain REF operands and inactive branches stay lazy` core regression. Initial result: 7 prior tests passed, new test failed (#PARSE! vs #REF!). The review-range logs now contain the subsequent browser reproduction; the retained final Node run is in logs/core-final.log and logs/final-run.log.

- Real browser reproduced the range bug before the fix: copied active and inactive formulas both returned #PARSE!. Screenshots review-range-invalid-red.png and review-range-lazy-red.png; recording screenshots/review-range-repro.webm; browser log review-range-red.log.
- Fix: parser accepts #REF! as either range endpoint; aggregate evaluation returns #REF!, and IF leaves inactive ranges unevaluated. Core regression plus prior suite: 8/8 pass (core-final.log and final-run.log). Browser repeats the same copy controls: active result #REF!, inactive result7 (review-range-green.log screenshots with -green).

- Subnormal chart reproduction through CSV text import and chart creation: 5e-324/1e-323 produced NaN y/height attributes, confirmed in logs/review-tiny-red.log and screenshot review-tiny-red.png. Browser console diagnostics preserved in review-tiny-red-console.log.
- Fix: normalize very small and very large finite magnitudes before computing axis steps. Same browser flow now yields finite bar geometry (y179,height99 and y80,height198); no console/uncaught errors after fresh load. Evidence review-tiny-green.log and review-tiny-green.png. All public workflows subsequently passed.

## Failure and diagnosis — recording tab download context

- SHEET-04 second attempt again passed parser edits but agent-browser `download` reported “Download was canceled”. Browser console and uncaught errors remained empty. A retry to a fresh filename failed identically. `agent-browser doctor --offline --quick`: 12 checks passed.
- `agent-browser tab list` revealed t2, created by the issue recording, was active. Switched to original t1, navigated the same application, and repeated the exact JSON export button via `download`: succeeded (evidence/download-context-probe.json). This isolates cancellation to the tool's recording-created tab/context, rather than the app's Blob export. Continued validation in original t1 without a browser substitution.
- Second failed attempt preserved in logs/sheet04-browser-attempt2.log and status-4-attempt2.json; screenshot sheet04-download-context-failure.png. No download pass was claimed for the failed context.

## Tool limit — oversized streamed commands

- SHEET-04 third attempt: streamed 194 KB `find label ... fill` command timed out after40 seconds and the session stopped responding even to reads/screenshots. Failed attempt kept in logs/sheet04-browser-attempt3.log; `doctor-after-batch.txt` records local tool diagnostics. No successful large text fill was fabricated.
- Continued with a fresh agent-browser session (`studio-verified`) using the same dead proxy/local bypass. Full exported JSON files are now imported via the application's file-picker path; CSV and compact JSON exercise text entry. All file contents and expected results stay unchanged; the test harness saves exact file-picker inputs. This is a tool transport limit, not an application workaround.
- Remaining optional coverage limitation: automation of a 194 KB paste through the CLI fill transport. Full-size JSON import is covered by file selection. No alternate browser tool was used.

## Validation corrections

- SHEET-06 initial run stopped on an overly specific test assertion about invalid-address wording. UI correctly rejected AA1 with “Every cell needs a valid address, type, and raw string.” The harness now accepts the visible address-validation error and still checks all cell/chart values and history remain exactly unchanged. Original log preserved in sheet06-browser-attempt1.log; application validation was not weakened.
- SHEET-05 initial automated assertions were too weak for the color control: visual inspection of current-chart.png revealed title “A clearer quarter#9C6B45” and a black Current line. `agent-browser fill` on a native color input had not performed the intended choice. Earlier structural success does not establish the requested color/title behavior. Adding a typable hex control, and strengthening checks to require the exact title and Current path stroke. Original SVG/PNG retained as before-fix evidence.

- Typed hex colors added alongside native pickers. Absent-control regression failed before implementation (logs/chart-color-red.log). SHEET-05 was rerun with the labeled hex input and strengthened exact-title/actual-path-stroke assertions: PASS. The first strengthened attempt read all chart option labels instead of the selected label; harness corrected to selectedOptions[0]. No expected color/data result changed.
- Export inspection: current-chart.svg title and visible heading exactly “A clearer quarter”; Current path stroke #9c6b45; live values include Current6/28/34 and Plan8/18/26. PNG is1200×744,77,058 bytes; opened as an image in a separate agent-browser session and visually inspected. Screenshot screenshots/exported-png-browser.png shows the current title, brown line, category order, values, axes, and legend. Prior bad-color files preserved as current-chart-before-hex-control.svg/.png.
- SHEET-06 completed: typed JSON restoration and Undo, invalid address/range atomic rejection, exact public CSV text import, evaluated quoted CSV download, malformed quoted-field rejection with unchanged history, inert HTML text, and file-picker JSON restoration. Browser console/uncaught errors empty. Logs/sheet06-browser.log; screenshots sheet06-invalid-json.png, sheet06-csv-literals.png, sheet06-inert-html.png.

## Browser boundaries and input continuity

- Desktop, 1280×800: clicked A1, pressed `1`, typed `2`, then Tab. A1 became12, C1=36, D1=56 and F1=51, with selection at B1. F2, Ctrl+A, typed -2.5, Enter produced C1=-30, D1=-10, F1=-20.5 and a genuine negative column chart. Shift+arrows selected A1:C2 with numeric count6/sum8.5. After Reset, an actual mouse drag A1→C2 selected the rectangle and sum40. J2=0 retained a real visible zero bar.
- Resize continuity: began in-cell L15 editing with123, resized to390×844, typed .45 and committed123.45. Started M15 formula =L15*2, resized to desktop and back to mobile while pending, appended +1 and committed247.9. No edit was dropped. Mobile grid scrolls internally; Import, Export, Reset, formula bar, chart title/type/legend, help and errors were exercised using the same real controls. Screenshots sheet07-mobile-workbook.png, sheet07-mobile-continuity.png, sheet07-mobile-chart-controls.png and sheet07-mobile-import-error.png.
- Reload restored the original seed and disabled Undo. Reset also cleared Redo and the internal copy snapshot. There is no automatic persistence. Valid JSON downloads were used to retain work explicitly.
- Direct-file: `agent-browser --session studio-verified open file:///home/pyro/projects/naked/sol61/21-spreadsheet-chart-studio/index.html`. Actual seed inspection, A1 edit/live chart, JSON/SVG/PNG downloads, CSV text import, Undo and reload passed. [direct-file.har](logs/direct-file.har) has exactly three successful requests: the file document twice and a generated blob:null image. No external assets were fetched. This check is passed, not blocked.
- Opaque iframe: [opaque-frame.html](opaque-frame.html) uses exactly `sandbox="allow-scripts allow-downloads"`, plus denied clipboard permission policy. Live diagnostics report origin=null, storage=SecurityError, parent access=SecurityError, clipboard read/write=denied. Keyboard edits, internal Copy/Paste, quoted CSV text import, native file-picker JSON import, Undo/Redo, JSON/SVG/PNG downloads, chart create/save/delete/Undo, Reset and reload passed. [Screenshot](screenshots/sheet07-opaque-chart-forms.png), [exact actions](logs/sheet07-opaque-ref.log), [runtime and download events](logs/iframe-runtime-events.jsonl).

## Failure and fix — native forms in a sandbox

- First iframe attempts hit CLI frame-context and download-helper limitations. `frame #studio-frame` could not select the OOPIF; frame @ref did not redirect semantic lookup/eval. The accessibility snapshot did expose the real iframe controls, and direct @ref clicks/fills/get-values worked. The iframe workflow uses these visible control references. Browser actions remain agent-browser; a small same-Chrome CDP helper provides passive diagnostics, native file-input selection and download-event watching. Plain button clicks completed actual downloads where the agent-browser download helper had timed out. Those helper failures are not counted as passes; logs and partial HARs are retained.
- A real application failure then remained: clicking Import workbook inside the scripts/downloads-only iframe left the CSV dialog open and A2 unchanged at4. Passive `Log.entryAdded` inspection showed “Blocked form submission” because allow-forms was absent. The exact diagnosis is in [opaque-form-red-diagnostic.log](logs/opaque-form-red-diagnostic.log) and screenshots/opaque-csv-modal-stalled.png. Runtime-only console monitoring had missed this browser security log.
- Fix: Import, Create chart and Save settings now use explicit button click handlers, retain local validation, and handle Enter on text inputs without native submission. The iframe permissions were kept unchanged.
- Retest: the complete iframe workflow passed, including all three forms and keyboard chart saving. Runtime exceptions, error/warning console events, security logs and failed requests were all absent. Three real Browser.downloadProgress events completed for JSON, SVG and PNG. Final opaque-frame HAR has five successful local/Blob requests. The failed flow and the complete desktop/mobile/file regressions were repeated after the fix.

## Additional import/history and focus regressions

- Importing an identical valid workbook originally skipped its undo entry. The real browser regression failed in logs/identical-import-red.log and extra-identical-red.log. Imports now force exactly one history action even for identical data. `python3 evidence/tests/extra_workflows.py identical` passed with Undo returning to an empty undo stack and Redo restoring the imported seed (identical-import-green.log).
- Compact valid JSON was imported through File contents text entry, separately from the full-size picker tests. A1 numeric5, B1 raw =A1*2+1 calculated11 despite a supplied cache of99999; C1 stayed literal =1+1, D1 BooleanFALSE, E1 blank, and charts empty. One Undo restored the seed. Screenshot extra-compact-json-text.png and logs/extra-extras.log.
- Extra chart controls: rejected a one-cell creation range and an out-of-sheet settings range without saving; created a second line chart; changed title, color and legend via keyboard saving; deleted it and undid deletion; omitted Boolean/text/#DIV/0! values with three visible reasons; undoing edits restored all points. Screenshot extra-chart-omission-reasons.png.
- A genuine focus issue appeared when a range blur rebuilt all color inputs: the next color fill was discarded and #738A42 was appended to H1:J4. [Red state](logs/chart-range-color-focus-red-state.json) and [exact steps](logs/chart-range-color-focus-red.log) preserve it. Fix: reuse color controls by series position while updating labels and palette. The same range→color→Enter interaction now saves Extra saved, exact stroke #738a42, and hidden legend. Screenshot extra-chart-controls.png. This regression and all public checks passed afterward.

## Final artifact verification and limitations

- `python3 evidence/tests/final_run.py`: every command passed after the last application change. The Node suite passed8/8; all six sheet workflows and all three browser-boundary phases passed. No evaluator code, supplied fixture, requirement or expected application value was modified.
- `python3 evidence/tests/standalone_check.py`: both embedded scripts compile; static IDs are unique; dependencies and origin-dependent APIs are absent; no eval/Function interpreter is present. [Result](logs/standalone-final.log). Delivered index.html SHA256: `0086ac8137ba2b1f1676b6c4ef55dc83499957f26e9bcb04814e967b18fa6728`.
- `python3 evidence/tests/artifact_evidence.py`: [results](logs/artifact-evidence-final.log). Final SVG has exact title A clearer quarter, brown Current stroke #9c6b45, Current[6,28,34], Plan[8,18,26], categories, axes and legend. Final PNG is1200×744 and77,058 bytes. Its SHA256 matches the actual image previously opened and visually inspected in the browser (`c64b42188cbbccb06b4412c132df29f4093f4a6d548fdbdcb1d3d41c258db51c`).
- Final uncached external probe `fetch("https://example.com/studio-network-check", {cache:"no-store"})` was blocked with TypeError/Failed to fetch; output in external-network-probe.json and expected proxy error in external-network-probe-console.log. After clearing that intentional probe and opening the app afresh, final-browser-console.log and final-browser-errors.log are empty. [Final desktop screenshot](screenshots/final-desktop.png).
- **Unresolved application failures:** none observed in the required checks.
- **Blocked optional coverage:** a194KB JSON text paste could not be transported by agent-browser's CLI argument/batch mechanism. Full-size JSON import passed through the real file-picker path, and valid compact JSON plus multiline CSV passed through text entry. No successful oversized text-paste automation is claimed.
- **Not-run:** other browser engines; this report covers the installed Chrome browser. No audio is part of the application.
