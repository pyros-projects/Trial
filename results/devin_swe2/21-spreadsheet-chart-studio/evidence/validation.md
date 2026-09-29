# Validation — Spreadsheet & Chart Studio

Artifact: `index.html` (self-contained, no runtime deps, no storage APIs, no network).
Test rig: `agent-browser 0.31.1`, headless Chromium, isolated session `scs21`/`--namespace scs21`
(another agent process was concurrently hijacking the default browser session on this host —
isolation was required). Local server `python3 -m http.server 8741` for inspection; the artifact
itself was also exercised over `file://`.

Assertions used two channels: real UI interaction (clicks on `[data-addr]` cells, `fill` on the
formula bar / chart controls, `press` for keys, `mouse` for drag/splitter/bar clicks, `download`
for export buttons) and `eval` inspection of live state via the app's own `window.SCS` hook plus
DOM reads. Screenshots in this directory.

## Results

### SHEET-01 Seed and live chart — PASS
- Seed: C1=6, C2=20, D1=26, E1=10, F1=11 (DOM + `SCS.getVal`). Raw formulas verified in formula bar.
- Chart "Current vs Plan" H1:J4 grouped column: Current [6,20,26], Plan [8,18,26].
- Typed `5` into A1 via cell editor → C1=15, D1=35, F1=23, Current [15,20,35].
- Undo button → all restored ([6,20,26], A1=2).
- Clicked the Alpha/Current bar → tooltip "Alpha · Current: 6 (I2)", source cell I2 selected
  (screenshot `sheet01-bar-click.png`), inspector shows `I2 formula raw==C1 value=6 · refs C1`.

### SHEET-02 Mixed references and range history — PASS
- Copy F1 → Paste at F2 via Copy/Paste buttons: raw `=$A2+B$1+$C$1`, value 13.
- Copy A1:C2 → A5:C6: C5 `=A5*B5`=6, C6 `=A6*B6`=20.
- One Undo removed the whole pasted rectangle, F2 retained; Redo restored it.
- Paste at Z100 rejected: "destination Z100:AB101 exceeds sheet A1:Z100. Nothing changed." — no mutation, no undo entry.
- B10=`=A10`, copy → A10: raw `=#REF!`, value `#REF!` (not #PARSE!, not #CYCLE!). Undo → A10 blank, B10 back to 0.
- Bonus: `=SUM(C1:C2)` from D1 pasted at D100 → `=SUM(#REF!)` → `#REF!` (whole-range rebase, found+fixed during dev).
- Ctrl+C/Ctrl+V verified as internal clipboard (F1→F3 `=$A3+B$1+$C$1`=9).

### SHEET-03 Lazy branches and cycle recovery — PASS
- A1=`=C1` → A1, C1, D1, I2 all `#CYCLE!`; chart Current [null,20,null], 2 points omitted "error #CYCLE!".
- A1 restored to 2 → full recovery without reload, Current [6,20,26].
- G1=`=IF(FALSE,G1,7)` → 7; →`=IF(TRUE,G1,7)` → `#CYCLE!`; back to FALSE → 7, no reload.

### SHEET-04 Parser and error semantics — PASS
All entered through the formula bar against the live app:
`=2+3*4`=14, `=(2+3)*4`=20, `=SUM(A1:B2)`=14, `=MIN`=2, `=MAX`=5, `=TRUE+2`=3,
`=IF(FALSE,1/0,9)`=9, `=#REF!`=#REF!, `=IF(FALSE,#REF!,9)`=9, `=1/0`=#DIV/0!, `=AA1`=#REF!,
`=NOPE(1)`=#NAME?, `=SUM("text")`=#VALUE!, `=1+`=#PARSE!.
Additional: `=A1:B2`=#VALUE!, `=SUM()`=#VALUE!, `=IF(1,2)`=#VALUE!, `=-"x"`=#VALUE!,
`=TRUE>0`=TRUE, `="b">"a"`=TRUE, blank ref→0, `=SUM(A1:B2,10)`=24, `=SUM("1")`=#VALUE!,
`=IF("x",1,2)`=#VALUE!, `=1E999`=#NUM!, `=-2*3`=-6, `=2- -3`=5, `=1+2=3`=TRUE, `=IF(0,1,2)`=2,
`=A1<>2`=FALSE, `=#REF!+1`=#REF!, `=SUM(Z1:Z5)` on blanks=0, `=IF(TRUE,1/0,9)`=#DIV/0!,
lowercase `=a1*b1`=6, `=MIN(8,3,5)`=3. (Also verified headless in node with ~60 cases.)
- `=#REF!` and `=IF(FALSE,#REF!,9)` preserved through JSON export → file-pick import → raw intact.
- Error in a summed range: `=SUM(L1:L3)` + L2=`=1/0` → `#DIV/0!`; Clear L2 → 0. PASS.
- Arithmetic prediction beyond seed: B1=10 → C1=20, D1=40, F1=32, Current [20,20,40]. PASS.
- Apostrophe: `'=1+1` → text "=1+1" (`=P1+1` → #VALUE!). `true`→Boolean (`+1`→2). `+4.5`→4.5.

### SHEET-05 Chart editing and exports — PASS
- New Chart on selected H1:J4 → second editable definition; type switched to Line (2 polylines).
- B2=7 → Current [6,28,34] on the line chart.
- Title → "Live Line Test", series color → #00aa44. Export SVG (via `download`) contains current
  title/labels/colors/values; Export PNG produced a real 1440×800 PNG (visually inspected — correct lines).
- Clear I3 → Current [6,null,34], "1 point(s) omitted: 1 blank — I3 (blank)", visible line gap
  (screenshot `sheet05-gap.png`: Current markers at Alpha/Total, no segment through Beta). Undo → restored.
- Type switched back to column; splitter drag resized grid pane to 550px; title/color/B2 edits persisted.

### SHEET-06 Safe file round trips — PASS
- Export JSON (button → real download), mutate (A1=99, rename chart), file-pick import →
  seed state back incl. raw `=$A1+B$1+$C$1`; Undo → mutated state back. Import = one undoable op.
- Rejected atomically (no mutation, error shown in panel): out-of-sheet cell AA1,
  invalid chart range H1:J1, version 2, duplicate chart id.
- CSV import (file picker) of the specified 4-line CSV: A2 `alpha, beta`, B2 numeric 2,
  A3 `line\nbreak`, B3 literal `=1+1` (text, not 2), charts cleared, all cells replaced.
- CSV export: `"alpha, beta",2` and quoted multiline `"line\nbreak"` correct; evaluated values only.
- Unterminated quote rejected, workbook unchanged.
- Text resembling HTML (`<b>..<script>alert(1)</script>`) renders as escaped text. PASS.
- Text-entry (textarea) import path verified: pasted `x,y` CSV imported correctly.

### SHEET-07 Session and browser boundaries — PASS / one BLOCKED sub-check
- 1280×800: keyboard edit (A1 `9` → C1=27), all controls reachable. Screenshot `sheet07-1280.png`.
- 390×844: toolbar scrolls horizontally (all buttons incl. file actions reachable), formula bar,
  Reset, chart controls visible, grid scrolls, chart renders. Screenshot `sheet07-390.png`.
- Edit continuity: opened cell editor, resized viewport mid-edit, Enter committed — no dropped edit.
- `file://` direct open: full app works; edit propagates; JSON export downloads fine. No external
  requests (network log shows only the file document itself).
- Opaque-origin iframe (`sandbox="allow-scripts allow-downloads"`, harness
  `evidence/iframe-harness.html`): grid renders, formula-bar edit works (A1=8 → C1=24),
  Reset works, export handlers execute (status message fires). **BLOCKED (platform):** actual file
  download is not delivered — Chrome headless does not deliver any download (tested `blob:` and
  `data:` anchors) from an opaque-origin subframe. Same code downloads fine top-level, in an
  unsandboxed iframe, and in a `allow-same-origin` sandboxed iframe. App uses the canonical
  `<a download>` + blob mechanism; nothing app-side remains to fix.
- localStorage/sessionStorage/cookies all empty; no service workers; memory-only state.
- Edit A1 → reload → seed returns. Reset restores seed cells+chart and clears undo (depth 0).
- `agent-browser errors`/`console`: clean; no failed requests after adding inline favicon.

## Fixes made during development
1. `buildChartSVG` destructuring bug (`{yTicks:ticks}`) — chart didn't render; fixed, verified.
2. Bar-click source selection parsed address from tooltip text incl. parens — now uses `dataset.src`.
3. `rebaseFormula` initialized output to `=` instead of full raw — mangled pastes; fixed.
4. `rebaseFormula` rebased range endpoints independently → `=SUM(A100:#REF!)` (#PARSE!); now a
   range whose endpoint leaves the sheet collapses to one `#REF!` operand → `=SUM(#REF!)`.
5. Formula bar committed to current selection on blur — clicking another cell mid-edit would have
   written to the wrong cell; now tracks the focused target cell.
6. Import errors surfaced inside the import panel (`#importErr`) as well as status bar.

## Known limitations
- Opaque-origin iframe download delivery: platform-blocked (see SHEET-07); handler + content verified.
- `keyboard type` from agent-browser doesn't reach an unfocused grid (use `press` or click first) —
  tooling quirk, not app behavior; real users click a cell before typing.
- Empty function args (`=IF(TRUE,,1)`) → `#PARSE!` (grammar has no empty-arg production; deliberate
  strict reading of the bounded grammar).
