# Spreadsheet & Chart Studio — agent validation

Artifact: `/home/pyro/projects/naked/grok46/21-spreadsheet-chart-studio/index.html`  
Harness: `agent-browser` 0.31.1 against Chromium, plus `node test-engine.js`.  
Local HTTP: `python3 -m http.server 8766 --bind 127.0.0.1` from the project directory (development only; not a runtime dependency).  
External HTTPS aborted via `agent-browser network route "https://**" --abort`. Session names: `sheetstudio`, `sheet-iframe`, `sheet-file`.

Engine unit tests: `node test-engine.js` → **150 passed, 0 failed** (before UI work and again after later engine-adjacent UI assemble).

Statuses used below: **pass**, **fail**, **blocked**, **not-run**.

---

## SHEET-01: Seed and live chart data — **pass**

**Steps**

1. Open `http://127.0.0.1:8766/index.html` at 1280×800.
2. Read seed cells and the seeded column chart (UI snapshot + `SheetStudio` eval).
3. Click `#cell-A1`, type `5`, Enter.
4. Click **Undo**.
5. Click the Alpha/Current bar (`rect[data-addr="I2"]`).

**Observed**

- Seed: C1=6, C2=20, D1=26, E1=10, F1=11. Chart “Current vs Plan” Current `[6,20,26]`, Plan `[8,18,26]`.
- After A1=5: C1=15, D1=35, F1=23, Current `[15,20,35]`. Screenshot: `evidence/screenshots/sheet01-a1-equals-5.png`.
- Undo restored A1=2, C1=6, D1=26, F1=11 and Current `[6,20,26]`.
- Bar click selected I2 (formula `=C1`, value 6). Inspector: precedents C1. Hint: `Selected source I2 · Alpha · Current · 6`. Screenshot: `evidence/screenshots/sheet01-bar-select-I2.png`.

Seed screenshot: `evidence/screenshots/sheet01-desktop-seed.png`.

---

## SHEET-02: Mixed references and range history — **pass**

Started from **Reset**.

**Steps**

1. Click F1 → **Copy** → click F2 → **Paste**.
2. Select A1:C2 with Shift+Arrow keys (6 cells, sum 40) → **Copy** → A5 → **Paste**.
3. **Undo**, then **Redo**.
4. Copy A1:C2, paste at Z99 (would exceed Z100).
5. Formula bar: B10 `=A10` → Copy B10 → Paste A10 → **Undo**.

**Observed**

- F2 raw `=$A2+B$1+$C$1`, value 13.
- C5 `=A5*B5` = 6, C6 `=A6*B6` = 20; F2 retained.
- One undo cleared A5:C6 and kept F2; redo restored C5/C6.
- Out-of-sheet paste: status `Paste exceeds sheet bounds (A1:Z100)`; Y99/Z99 still blank; C5 unchanged.
- A10 raw `=#REF!`, value `#REF!` (not `#CYCLE!` / `#PARSE!`). Undo restored blank A10; B10 still `=A10`.

Screenshot: `evidence/screenshots/sheet02-copy-paste.png`.

---

## SHEET-03: Lazy branches and cycle recovery — **pass**

Started from **Reset**.

**Steps**

1. Formula bar A1 `=C1`.
2. Restore A1 `2`.
3. G1 `=IF(FALSE,G1,7)` → switch to `TRUE` → switch back to `FALSE`.

**Observed**

- Cycle: A1/C1/D1/E1/I2 all `#CYCLE!`. Chart Current `[omit:#CYCLE!, 20, omit:#CYCLE!]`.
- A1=2 recovered C1=6, D1=26, E1=10, Current `[6,20,26]` without reload.
- G1 lazy: 7 → `#CYCLE!` → 7.

Screenshot: `evidence/screenshots/sheet03-cycle.png`.

---

## SHEET-04: Parser and error semantics — **pass**

Started from **Reset**. Entered formulas in unused Z/Y cells via the formula bar.

| Input | Result |
|---|---|
| `=2+3*4` | 14 |
| `=(2+3)*4` | 20 |
| `=SUM(A1:B2)` | 14 |
| `=MIN(A1:B2)` | 2 |
| `=MAX(A1:B2)` | 5 |
| `=TRUE+2` | 3 |
| `=IF(FALSE,1/0,9)` | 9 |
| `=#REF!` | `#REF!` (raw preserved) |
| `=IF(FALSE,#REF!,9)` | 9 (raw preserved) |
| `=1/0` | `#DIV/0!` |
| `=AA1` | `#REF!` |
| `=NOPE(1)` | `#NAME?` |
| `=SUM("text")` | `#VALUE!` |
| `=1+` | `#PARSE!` |
| `=A2*3+1` (independent arithmetic) | 13 |

JSON export/import in the page (same `importJSON` the UI uses) restored A1=2 and kept Z8 `=#REF!` / Z9 `=IF(FALSE,#REF!,9)` evaluating to `#REF!` and 9.

Range error: A1 `=1/0` made Z3 (`=SUM(A1:B2)`) and D1 `#DIV/0!`. Restoring A1=2 recovered Z3=14 and C1=6.

Screenshot: `evidence/screenshots/sheet04-parser.png`.

---

## SHEET-05: Chart editing and exports — **pass**

Started from **Reset**.

**Steps**

1. New chart type Line, range `H1:J4`, **Create chart**.
2. B2 → `7` via formula bar (C2=28, D1=34).
3. Select the line chart, title `Live Line`, Current color `#8c2f39`.
4. **Export SVG** / **Export PNG** via `agent-browser download`.
5. Select I3 → **Clear**.
6. **Undo**. Switch type Column then Line. Resize `--chart-w` to 360px while formula bar held uncommitted `5`.

**Observed**

- Two charts; both Current series `[6,28,34]` after B2=7.
- SVG `evidence/downloads/live-line.svg`: title Live Line; categories Alpha/Beta/Total; series Current/Plan; points I2/I3/I4; color `#8c2f39`.
- PNG `evidence/downloads/live-line.png` matches those labels and the `[6,28,34]` / `[8,18,26]` shapes.
- Clear I3: Current `[6, omit blank, 34]`; omitted text `1 point omitted (1 blank)`; line path `M … M …` (gap, no connecting `L` through Beta).
- Undo restored I3=28 / Current `[6,28,34]`.
- Type switch kept B2=7. Resize left formula `5` with A1 still 2; Enter then committed A1=5, C1=15.

Screenshots: `evidence/screenshots/sheet05-line-chart.png`, `sheet05-omitted-and-resize.png`.

---

## SHEET-06: Safe file round trips — **pass**

Started from **Reset**.

**Steps**

1. **Export JSON** → `evidence/downloads/seed-export.json`.
2. Change A1 to 9 and chart title to `Mutated Title`.
3. **Import JSON file** (file picker) with that export.
4. **Undo**.
5. **Import JSON text** with `AA1` cell, then with chart range `H1:ZZ4`.
6. **Import CSV file** `evidence/downloads/sheet06.csv` (quoted comma + multiline + `=1+1`).
7. **Export CSV**.
8. **Import CSV text** `"unterminated`.
9. Enter HTML-like text in Z1.

**Observed**

- Seed JSON is version 1 with typed `kind`+`raw` (formulas not cached values). Import restored A1=2, C1 `=A1*B1`→6, E1/F1 raw, chart title Current vs Plan.
- Undo restored A1=9 / Mutated Title.
- Invalid JSON left A1=9: `Out-of-bounds or invalid cell address: AA1` and `Invalid chart range: H1:ZZ4`.
- CSV: A2 `alpha, beta` (text), B2 numeric 2, A3 newline, B3 literal `=1+1` (text, not 2). Charts cleared.
- CSV export `evidence/downloads/sheet06-export.csv` quotes comma and multiline fields; B3 remains `=1+1`.
- Unterminated CSV: `CSV rejected: Unterminated quoted field`; A2 unchanged.
- Z1 `textContent` is the raw HTML-looking string; no `img`/`b` nodes (`innerHTML` escaped).

Screenshot: `evidence/screenshots/sheet06-csv-html.png`.

---

## SHEET-07: Session and browser boundaries — **pass** (with noted automation limits)

### Desktop 1280×800 — **pass**

Keyboard + labeled buttons used throughout SHEET-01–06. After visiting Z99, **Reset** now zeros grid scroll so A1 is clickable (regression after a sticky-header miss).

Reload after A1=5: seed A1=2, C1=6, chart Current vs Plan, undo empty. `localStorage` keys `[]`, `document.cookie` empty. No `navigator.clipboard`.

Console/errors after reload: empty. Network: only `GET http://127.0.0.1:8766/index.html` 200 (inline data-URI favicon; no app `/favicon.ico`).

### Narrow 390×844 — **pass**

`agent-browser set viewport 390 844`. Formula bar, **Reset**, file buttons, and chart controls remain in the sticky header / skip-to-charts path. Formula bar set A1=8 → C1=24 at `vw=390, vh=844`. Screenshots: `sheet07-mobile-top.png`, `sheet07-mobile-charts.png`.

Fix applied during this check: chart type `<option>` labels shortened from “Grouped column” to “Column” so the control does not clip to “Grouped colur” on a 390px width.

### Direct `file://` — **pass**

Opened `file:///home/pyro/projects/naked/grok46/21-spreadsheet-chart-studio/index.html`. Origin `file://`. Seed C1=6 … F1=11, Current `[6,20,26]`. Edit A1=5 → C1=15, D1=35, F1=23, Current `[15,20,35]`. Console empty, errors `[]`, network only the local file document. Screenshot: `sheet07-file-url.png`.

### Opaque-origin iframe — **pass** (download save-as intercept flaky)

Host: `evidence/iframe-host.html` with `sandbox="allow-scripts allow-downloads"` (no `allow-same-origin`). Parent eval cannot see `SheetStudio` (`origin` stays the host page) — expected opacity.

Via inlined iframe refs: A1→5 yielded C1=15, D1=35, F1=23, I2=15. Copy F1 → Paste F2: accessible name `F2, 22, raw =$A2+B$1+$C$1`. **Export JSON** produced `evidence/downloads/iframe-export.json` (also UUID-named copies in `evidence/downloads/`) containing A1 raw `5` and F2 formula; `agent-browser download` wait still timed out when trying to rename the blob, so that intercept is **blocked** even though the file was written.

Screenshot: `sheet07-iframe.png`. Host page requested `/favicon.ico` 404 once (test harness, not `index.html`). App iframe document is only local `index.html`.

### Persistence / Reset

Reload restores seed. **Reset** restores seed charts/cells and clears undo (Undo disabled). JSON download is the explicit keep path.

---

## Fixes during validation

1. Sticky row header covered A1 after horizontal scroll to Z99. **Reset** now zeros `gridWrap` scroll; `selectCell` extra-scrolls out from under sticky headers. **Retest:** Z99 → Reset → click A1 → type 5 → C1=15. **pass**
2. Browser requested `/favicon.ico` on HTTP. Added data-URI `<link rel="icon">`. **Retest:** reload network is only `index.html`. **pass**
3. Line-chart zero axis was drawn outside the viewBox. Skip the zero line when it is off-plot. Column charts still force 0 into the domain.
4. Mobile type select clipped “Grouped column”. Labels are now Column / Line.

---

## Commands

```bash
node test-engine.js
node assemble.js
python3 -m http.server 8766 --bind 127.0.0.1
agent-browser --session sheetstudio set viewport 1280 800
agent-browser --session sheetstudio open http://127.0.0.1:8766/index.html
# … labeled clicks, formula bar fills, downloads, screenshots as above …
agent-browser --session sheet-file open file:///…/index.html
agent-browser --session sheet-iframe open http://127.0.0.1:8766/evidence/iframe-host.html
```

No `eval` / `Function` formula interpreter. Internal clipboard only. No cookies, `localStorage`, IndexedDB, or external runtime URLs in `index.html` (SVG namespace `http://www.w3.org/2000/svg` is not a network fetch).

---

## Remaining limitations

- `agent-browser download <sel> <path>` against the opaque iframe often times out on rename even when a JSON blob is saved under a UUID in `evidence/downloads/`. Same-origin and `file://` downloads of JSON/CSV/SVG/PNG worked with the requested filenames.
- Parent-page `eval` cannot inspect opaque-iframe JS state; iframe checks used accessibility names and the downloaded JSON.
- The 2600-cell grid is a full table (responsive, but snapshots are large).
- Chart type control uses short labels “Column” / “Line”; grouped-column behavior is unchanged.
