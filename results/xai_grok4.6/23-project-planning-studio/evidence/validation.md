# Project Planning Studio — validation

Artifact: `/home/pyro/projects/naked/grok46/23-project-planning-studio/index.html`  
Harness: `agent-browser` 0.31.1 (session `pps-studio` / `pps-file` / `pps-iframe`)  
Local HTTP: `python3 -m http.server 18765 --bind 127.0.0.1` in the project directory  
Unit tests: `node tests/scheduler.test.mjs` → **85 passed, 0 failed**

Scheduler outcomes were observed from the live UI (table cells, metrics, inspector, resource slots, Gantt bars) and from `window.PPS.plan` after those interactions. Expected intervals were **not** hard-coded in the app; they come from the serial placement policy.

Statuses: **pass** / **fail** / **blocked** / **not-run**.

---

## Environment

- Desktop viewport: `agent-browser set viewport 1280 800`
- Narrow viewport: `agent-browser set viewport 390 844`
- Direct file: `file:///home/pyro/projects/naked/grok46/23-project-planning-studio/index.html`
- Opaque iframe: `http://127.0.0.1:18765/evidence/iframe-host.html` with `sandbox="allow-scripts allow-downloads allow-modals"` (no `allow-same-origin`)
- External network: page is self-contained. Observed requests after load: the document itself, `favicon.ico` 404 (browser chrome), and Chromium’s `data:image/svg+xml` calendar icon. No CDN/font/API calls from the app.

---

## PLAN-01: Seed across connected views — **pass**

**Start:** fresh load / Reset.

**Steps**
1. Open `http://127.0.0.1:18765/index.html` at 1280×800.
2. Read summary metrics, task table, Gantt, resource lanes.
3. Click T3 in the table ID cell; inspect explanation; click resource slot `T3`; pointer-click the T3 Gantt bar.
4. Click **Export CSV** (blob intercepted).

**Observed**
- Metrics: actual completion **8** / **2026-09-17**; dependency-only **6**.
- Table intervals: T1 `[0,2)`, T2 `[2,5)`, T3 `[5,7)`, T4 `[7,8)`, T5 `[8,8)`.
- T2 last working date **2026-09-11**, exclusive finish **2026-09-14**.
- R1 occupancy 1/1 on days 0–6 (T1, T1, T2, T2, T2, T3, T3), never above capacity 1; R2 holds T4 on day 7.
- T3 inspector: candidate 2, blocked `[2,5) T2`, chosen start 5, resource waiting, dependency-only float 1, ES 2.
- Same `selectedId === "T3"` after table, resource slot, and Gantt pointer click; table row `.selected`, Gantt bar gold stroke.
- CSV (CRLF, quoted as needed):

```
taskId,name,resourceId,predecessors,duration,notBefore,startOffset,finishOffset,startDate,finishDate,lastWorkDate,dependencyOnlyFloat
T1,Design,R1,,2,,0,2,2026-09-07,2026-09-09,2026-09-08,0
T2,Build,R1,T1,3,,2,5,2026-09-09,2026-09-14,2026-09-11,0
T3,Documentation,R1,T1,2,,5,7,2026-09-14,2026-09-16,2026-09-15,1
T4,Review,R2,T2;T3,1,,7,8,2026-09-16,2026-09-17,2026-09-16,0
T5,Launch,,T4,0,,8,8,2026-09-17,2026-09-17,,0
```

Screenshot: `evidence/screenshots/plan01-desktop.png`, `plan01-t3-selected.png`.

---

## PLAN-02: Critical path and capacity — **pass**

**Start:** Reset.

**Steps**
1. Confirm CPM 6, T3 float 1, T1/T2/T4/T5 float 0, actual 8.
2. Fill **Capacity for R1** with `2`, Tab to commit.
3. Click **Undo**.

**Observed**
- After capacity 2: T1 `[0,2)`, T2 `[2,5)`, T3 `[2,4)`, T4 `[5,6)`, T5 `[6,6)`; actual 6; CPM still 6. Undo count 1.
- One Undo: capacity 1 and original intervals restored; actual 8; CPM 6.

Screenshot: `evidence/screenshots/plan02-capacity2.png`.

---

## PLAN-03: Propagation and range of effects — **pass**

**Start:** Reset.

**Steps**
1. Fill **Duration for T1** with `3`, Tab.
2. **Undo**, then **Redo**.

**Observed**
- Duration 3: intervals `[0,3) [3,6) [6,8) [8,9) [9,9)` for T1–T5; actual 9; dependency-only **7** (metric and model).
- Undo restored duration 2 and seed intervals / CPM 6 / actual 8.
- Redo restored duration 3 and every derived interval / CPM 7 / actual 9.

Screenshot: `evidence/screenshots/plan03-t1-dur3.png`.

---

## PLAN-04: Drag, gap filling, and calendar — **pass**

**Start:** Reset.

**Steps**
1. Scroll T2 bar into view. Pointer down at bar, move +78px (3 × dayWidth 26), inspect preview banner, mouse up.
2. **Undo**.
3. Select T2; set `#not-before` to `2026-09-12` and fire `change`.
4. Reset. Pointer down + move on T2, then **Escape** (no mouse-up commit).

**Observed**
- During drag: banner `Requested not-before offset 5 (2026-09-14). Preview start 5 [5,8) · 2026-09-14.` Source still seed until release.
- After release: T1 `[0,2)`, T2 `[5,8)`, T3 `[2,4)`, T4 `[8,9)`, T5 `[9,9)`; stored `notBefore` **2026-09-14**; undo 1.
- Undo restored seed, `notBefore` null, undo 0.
- Saturday input: notice *Task T2 not-before 2026-09-12 falls on a weekend and was moved forward to Monday 2026-09-14.*; stored date **2026-09-14**; same gap-fill intervals. Displayed date control value **2026-09-14**.
- Escape: intervals unchanged, `notBefore` null, undo 0, redo 0, notice *Drag cancelled. Plan and history unchanged.*

Screenshots: `plan04-drag-preview.png`, `plan04-saturday-normalize.png`.

---

## PLAN-05: Validation and safe deletion — **pass**

**Start:** Reset, then this sequence (no extra Reset between items).

| Action | Result |
|---|---|
| Check predecessor T5 on T1 | Error `Cycle in finish-to-start predecessors: T1 → T5 → T4 → T2 → T1.` Preds still `[]`. Intervals unchanged. Undo 0. |
| Import JSON with pred `TX` | `Task T1: missing predecessor "TX".` Undo 0. |
| Import duplicate T1 | `Duplicate task ID "T1".` 5 tasks remain. |
| Import start `2026-02-29` | `Project start date "2026-02-29" is not a supported calendar date (2000-01-01–2099-12-31).` |
| Capacity 0 and 5 | `Resource R1: capacity must be a safe integer from 1 through 4.` Capacity stays 1. |
| Duration `1000000000` | `Task T1: duration must be a safe integer from 0 through 260 working days.` Duration stays 2. |
| Priority `10000` | `Task T1: priority must be a safe integer from 0 through 9999.` Priority stays 1. |
| Not-before `2099-12-31` on T2 | `Task T2: Not-before date 2099-12-31 is working-day offset 2602, beyond the horizon of 2600 working days from 2026-09-07.` Plan unchanged. |
| **Cancel deletion** on T1 | 5 tasks remain, undo 0, modal closed. |
| **Delete and remove edges** | Tasks T2–T5; T2/T3 preds empty; no dangling `T1`. |
| **Undo** | T1 restored; T2/T3 preds `["T1"]`; seed intervals. |
| **Delete R1** | `Cannot delete resource R1 while it is assigned to T1, T2, T3.` Resources still R1,R2. |
| Add task **U** dur 1 pri 0 unassigned | U `[0,1)`. |
| Add milestone **M**, then predecessor U | M `[1,1)`; original T1–T5 intervals unchanged. |

Screenshot: `plan05-u-m.png`.

---

## PLAN-06: Determinism and file round trips — **pass**

**Start:** Reset.

**Steps**
1. Set T3 priority to **2** (tie with T2). Seed intervals remain (T2 wins ID).
2. **Export JSON**. Reverse `tasks` array in the file. **Import JSON text**.
3. Set T1 duration to 3. Import the *saved* (unreversed) export. **Undo**.
4. Import name `<img src=x onerror="alert(1)">`. Count `img` nodes in the table.
5. Rename T1 to `Design, "v2"`; **Export CSV**.
6. **Export Gantt SVG**.
7. Reset. Set T2 duration to **4** (predicted `[0,2)[2,6)[6,8)[8,9)[9,9)`, CPM 7).

**Observed**
- Reversed import: intervals still T1 `[0,2)` … T5 `[8,8)`; T3 priority 2; display order T5…T1.
- Import of saved plan restored duration 2 and seed intervals with T3 pri 2.
- One undo restored the pre-import duration-3 schedule (actual 9, CPM 7).
- HTML name stored as text; `querySelectorAll('#task-body img').length === 0`; input shows the raw string.
- CSV row: `T1,"Design, ""v2""",R1,,2,,0,2,2026-09-07,2026-09-09,2026-09-08,0`
- SVG: XML header, project name, start 2026-09-07, actual 8 / 2026-09-17, dependency-only 6, T1–T5 labels and dates, weekend-break marks, legend (task bar / milestone / weekend / dependency). Length 4039.
- Extra duration-4 change matched the prediction; actual completion 9; CPM 7.

Seed CSV/JSON copies: `evidence/seed.csv`, `evidence/seed.json`.

---

## PLAN-07: Session and browser boundaries — **pass** (with notes)

**Desktop 1280×800**
- Task edits, date control, Gantt drag, undo, exports, Reset all exercised (see PLAN-01–06).
- Critical-path checkbox: zero-float T1/T2/T4/T5; edges T1→T2, T2→T4, T4→T5; T3 not critical.
- Screenshot: `plan07-desktop-1280.png`, `plan07-critical.png`.

**Narrow 390×844**
- View tabs Table / Gantt / Resources / Details switch `body[data-view]` and pane `display`.
- Reset, Undo/Redo, Add, Import/Export remain in the sticky header (`btn-reset` top ≈ 208px).
- Gantt view shows T1–T5 bars, T5 diamond, dependency curves, zoom control.
- Selection T4 survived switching to Table.
- Screenshots: `plan07-mobile-*.png`.
- Note: `find role button --name "Gantt"` first matched **Export Gantt SVG**. Tabs were renamed to “Gantt view” etc. Subsequent switches used `nav.view-tabs button[data-view=…]`.

**Reload / Reset / persistence**
- After renaming T1 to `Changed`, reload returned **Design**, undo 0.
- Reset restores seed and clears history (banner *Seed plan restored. Undo history cleared.*).
- `localStorage.length === 0`. No cookies/IndexedDB/service worker in the artifact.

**Direct file** — **pass**
- `agent-browser --session pps-file open file:///…/index.html`
- `location.protocol === "file:"`; seed schedule identical (actual 8, CPM 6, seed intervals).
- Screenshot: `plan07-file-url.png`.
- A later `fill` on duration appended rather than replacing (`2`+`3`→`32`); that is a harness fill quirk, not a file:// scheduler bug. Seed load itself succeeded.

**Opaque iframe** — **pass**
- Host `evidence/iframe-host.html`. Parent eval: `SecurityError` reading `iframe.contentWindow.location.origin`.
- `typeof window.PPS` in parent is `undefined`.
- Accessibility tree includes the framed app. Duration T1 changed to 3 → table `[0,3)` `[3,6)`. Undo via iframe **Undo** button restored duration 2.
- **Export CSV**, **Export JSON**, **Import JSON file** clicks succeeded inside the frame. Download bytes could not be read from the parent (opaque). Clipboard was not used.

**Console / network**
- `agent-browser console` after load: no application errors.
- Network: GET `index.html` 200; GET `favicon.ico` 404 (browser); `data:` calendar glyph. No app-initiated external HTTP(S).

---

## Fixes during validation

1. Import JSON text button was covered by the sticky table header when buried in a closed `<details>`. Moved the button into the always-visible file toolbar.
2. Focusing a table field did not select the task; added `focusin` → select so inspector follows keyboard edits.
3. Mobile header crowding: tighter padding; policy text clamped; named view tabs to avoid colliding with “Export Gantt SVG”.
4. `window.PPS.preview` is now synced during drag (`syncPps` from `onBarMove`).

---

## Remaining limitations

- Chromium’s native `type="date"` UI can show `0/0/0` spinbuttons when the not-before field is empty; the stored value is still empty/`null`.
- Favicon 404 is the browser requesting `/favicon.ico`; the app does not reference it.
- Opaque-iframe download *contents* were not captured from the parent; button clicks were.
- Published input limits (also shown in the UI): 200 tasks, 16 resources, duration 0–260, offsets 0–2600, dates 2000-01-01–2099-12-31.
