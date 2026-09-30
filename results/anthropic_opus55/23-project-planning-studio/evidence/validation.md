# Project Planning Studio — validation record

Artifact: `../index.html` (single self-contained file, 123,713 bytes, 1,769 lines; inline CSS + two inline scripts: `pps-engine` = pure scheduling engine, `pps-app` = UI).
Date: 2026-09-30. Browser tooling: **agent-browser 0.31.1** (installed skill `.agents/skills/agent-browser/SKILL.md` read; version-matched `skills get core --full` and `skills get dogfood` workflows read before use). Headless Chromium via CDP. No substitution was needed.

Status legend: **pass** = observed in the real browser (or Node for engine unit tests) with the stated values; **fail**; **blocked** = could not be exercised with available tools; **not-run**.

## How to reproduce

```bash
# Engine unit tests (extracts <script id="pps-engine"> from index.html; dev-only)
node evidence/tests/engine.test.js                 # → 40 passed, 0 failed

# End-to-end regression through agent-browser (file:// index.html, real clicks/typing/mouse drags)
evidence/tests/regression.sh                       # → 58 passed, 0 failed  (log: evidence/regression-final.log)

# Opaque-origin iframe run (external network blocked by a dead proxy, loopback allowed)
python3 -m http.server 8765 --bind 127.0.0.1 &      # temporary, dev-only
AGENT_BROWSER_SESSION=pps-iframe agent-browser --proxy http://127.0.0.1:9 \
  --download-path "$PWD/evidence/downloads" open http://127.0.0.1:8765/evidence/tests/iframe-harness.html
```

Helpers: `evidence/tests/ab-helpers.sh` (`mclick` = real mouse move/down/up at an element's center; `state`, `try_edit`), `evidence/tests/consistency.js` (reads every rendered view — table cell data, Gantt bar geometry, lane bars, summary stats, over-capacity cells — and compares with the live model via the read-only `window.PPS.snapshot()` diagnostic). Fixtures in `evidence/tests/fixtures/`; downloaded exports in `evidence/downloads/`; screenshots in `evidence/screenshots/`.

## Results by public check

### PLAN-01 Seed across connected views — pass
- Table/Gantt/lanes/inspector/CSV show T1 [0,2), T2 [2,5), T3 [5,7), T4 [7,8), T5 [8,8); summary "Actual completion offset 8 · 2026-09-17". (`01-seed-desktop.png`, `03-gantt-resources.png`)
- T2 table cell: `2026-09-09 → 2026-09-11 | [2, 5) · boundary 2026-09-14`; inspector: "boundary offset 5 · Mon 2026-09-14 (exclusive) — last working day Fri 2026-09-11".
- CSV row (downloaded via Export → Download CSV): `T2,Build,R1,T1,3,2,,2,5,2026-09-09,2026-09-14,2026-09-11,2,2,0,yes`; T5 last working date empty. CRLF rows.
- R1 lane peak 1/1 (max occupancy parsed from lane cells = 1; probe finds no over-capacity cell).
- Selecting T3 by real click in the table row, on the Gantt bar, and on the R1 lane bar each highlighted T3 in table + Gantt label + lane bar (stroke 2.5) + inspector; selection added no history. (`02-select-T3-table.png`, `04-select-T3-gantt.png`)
- Resource slot click (R1 offset 3): inspector "Thu 2026-09-10 · 1 of 1 unit used (full) · T2 [2,5) · T3 waited (starts 5)". (`05-slot-R1-day3.png`)

### PLAN-02 Critical path and capacity — pass
- Dependency-only completion 6; floats T1/T2/T4/T5 = 0, T3 = 1; red critical edges exactly T1>T2, T2>T4, T4>T5. Shown separately from actual completion 8 and labelled "+2 working days … (not a new critical path)".
- R1 capacity typed to 2 (Enter): T1 [0,2), T2 [2,5), T3 [2,4), T4 [5,6), T5 [6,6); actual 6, dependency-only 6. Lane shows two units with T3 on unit 2. (`07-R1-capacity-2.png`)
- One Undo click: capacity 1 and all seed intervals restored.

### PLAN-03 Propagation — pass
- T1 duration 3 (typed + Tab): [0,3), [3,6), [6,8), [8,9), [9,9); dependency-only 7; focus continued to the next field (`prio:T1`).
- Undo and Redo: source duration and every view (probe: table, Gantt geometry, lanes, stats) consistent after each.

### PLAN-04 Drag, gap filling, calendar — pass
- Real mouse drag of T2 by 3 day-widths: live preview tooltip "T2: not before offset 5 · Mon 2026-09-14 / Preview: scheduled [5, 8) …", dashed ghost bars for every task that would move, no commit during drag. (`08-drag-T2-preview.png`)
- Release: T1 [0,2), T2 [5,8), T3 [2,4) (fills the earlier R1 gap), T4 [8,9), T5 [9,9); stored `notBefore: "2026-09-14"`; exactly one history entry. Inspector: "Not-before bound | offset 5 — 2026-09-14 ◀ sets boundary". (`09-after-drag-T2-explained.png`)
- Ctrl+Z restored the seed.
- Keyboard entry of Saturday `2026-09-12` in T2's not-before control: stored 2026-09-14, message "not-before Sat 2026-09-12 is a weekend day; normalized forward to Mon 2026-09-14", same intervals as the drag. (`10-date-control-saturday.png`)
- Escape during a live drag of T4 (mouse still down), then release: source, intervals, undo and redo byte-identical; "Drag of T4 cancelled". (`11-drag-T4-before-escape.png`)
- "Clear constraint" restored the seed intervals as its own undoable step.

### PLAN-05 Validation and safe deletion — pass
Each rejected with the plan, schedule and history byte-identical and the input reverted:
- T5 as predecessor of T1 (table text and inspector checkbox): "Dependency cycle: T1 → T2 → T4 → T5 → T1". (`12-cycle-rejected.png`)
- Missing predecessor T99; capacity 0, 5, "two"; not-before 2026-02-30 ("not a real calendar date"); duration 1000000000 ("outside 0–260"); priority 10000 ("outside 0–9999"); duration 9007199254740993 ("not a safe integer").
- Not-before 2037-01-05: "its not-before 2037-01-05 is offset 2695, beyond the 2600-working-day horizon (offsets 0–2600)".
- Duplicate imported ID, impossible imported date, fractional capacity, bad version, malformed JSON, 501 tasks ("limit 500"): rejected inside the import dialog, plan unchanged.
- Delete T1 → dialog naming T2, T3 → Cancel: unchanged. (`13-delete-T1-choice.png`) Delete → "Remove 2 edges and delete T1": remaining `T2: T3: T4:T2+T3 T5:T4` (no dangling edge). One Undo: source equals the seed JSON exactly (T1 back in its row with both edges).
- Delete R1: "Cannot delete resource R1 — it is assigned to T1, T2, T3."
- Added U (duration 1, priority 0, no resource) and milestone M (priority 0, predecessor U) via the dialogs: U [0,1), M [1,1), original five unchanged. (`14-add-task-U.png`, `15-U-and-M-added.png`)
- Also: milestone assigned to R1 rejected; project start 2099-12-28 rejected because T2 would end 2100-01-04; start 2100-01-04 rejected; pre-start not-before (2026-08-03) imposes offset 0; duplicate/invalid IDs rejected in the Add dialog.

### PLAN-06 Determinism and file round trips — pass
- T3 priority set to 2, JSON exported (download), task array reversed, imported through the file picker: seed intervals kept (T2 wins the stable-ID tie); rows now display in file order.
- T4 duration edited, then the saved seed JSON imported through the text box: source equals the file, values recomputed; one Undo restored the pre-import edit (source + intervals identical to before import).
- Hostile file (`hostile-names-and-cache.json`): names like `<img src=x onerror=…>` and `<script>` shown literally in table, Gantt, inspector and project name; 0 `<img>` elements; `window.__pwned` unset; bogus `schedule` cache and per-task `start` ignored (seed intervals). (`16-hostile-names-inert.png`)
- CSV of that plan: quotes doubled, comma/newline names quoted; Python `csv` parses 5 rows back to the exact names. SVG export parses as well-formed XML with escaped text and no script/img elements. Seed SVG has labels, start → last-day dates, finish boundaries, legend. (`06-export-svg.png`)
- My own predictions, written before running: T3 duration 4 → T3 [5,9), T4 [9,10), T5 [10,10), dependency-only 7, T3 critical and T2 float 1 — observed exactly. T3 reassigned to R2 → T3 [2,4), T4 [5,6), T5 [6,6), completion 6 — observed exactly.

### PLAN-07 Session and browser boundaries — pass, with one not-run item
- 1280×800: all of the above. 390×844: tabs Table/Gantt/Resources/Details; no horizontal page scroll (scrollWidth 390); sticky header keeps +Task/+Milestone/Undo/Redo/Import/Export/Reset visible with the page and timeline scrolled; mouse drag of T2 on the Gantt tab committed [5,8) (status line shows the preview above the timeline); Undo worked; Details-tab keyboard date entry of Saturday 2026-09-19 normalized to 2026-09-21; Clear constraint worked. Resizing 1280→390 kept data, history and selection (T3). (`17`–`22-mobile-*.png`)
- Direct file (`file://…/index.html`): the only request is the document itself; zero console messages and page errors across all sessions.
- Opaque-origin iframe (`sandbox="allow-scripts allow-downloads"`, served from 127.0.0.1 with every external request forced through a dead proxy): the parent gets `SecurityError` reading the frame (opaque origin confirmed); the harness's own probe fetch to example.com failed (external network blocked). Inside the frame: duration edit + Undo, a real mouse drag (T2 → [5,8), T3 → [2,4)), JSON and CSV **downloads** (files saved; contents match the dragged state), text-path import rejecting a duplicate ID and accepting a valid plan, Undo of the import, and Reset (Undo/Redo disabled afterwards) all worked; reload returned to the seed. (`23-iframe-drag-preview.png`, `24-iframe-after-reset.png`)
- Reload returns to the seed with empty history; Reset restores the seed and clears undo/redo. No storage is used — the static audit finds no `localStorage`, `sessionStorage`, `indexedDB`, `document.cookie`, service worker, clipboard, `fetch`/XHR/WebSocket, external URLs, `innerHTML`, or native `alert/confirm/prompt`. An inline `data:` favicon avoids even the automatic favicon request.
- **not-run:** real touch-screen drag. agent-browser 0.31 has no touch emulation; touch users have the labelled date control (verified by keyboard) and bars declare `touch-action: none`.
- **Blocked (tool limitation, worked around):** agent-browser `eval` and `frame` cannot enter the out-of-process opaque frame ("Frame not found"). I verified the frame's state through its inlined accessibility snapshot (bar labels carry offsets), frame-relative `get box` + page mouse input, and the downloaded files. agent-browser's `download` waiter timed out for frame-initiated downloads, but Chrome saved the files (GUID names, renamed to `iframe-export.*`).

## Additional checks
- Empty plan (import `empty.json`): table and Gantt empty-state messages; both completions offset 0. (`27-empty-plan.png`)
- 50 tasks × 8 resources (`fifty-tasks.json`): import + render ≈114 ms round-trip; consistency probe ok. (`28-fifty-tasks.png`) 500-task engine run 6–8 ms (Node).
- Horizon edge: a task placed [2590,2600) is accepted; offset 2630 rejected. Per-interaction re-render at that extent ≈135 ms after optimization.
- Zoom in/out/Fit, ◀ ▶ pan buttons and background-drag panning change only the view (history unchanged). Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y verified with focus outside text fields; inside text fields the browser's own text undo applies by design. (`25`, `26`, `29`)
- Unassigned lane shows "U — no resource, no capacity limit"; milestones listed as occupying no capacity. (`30-unassigned-lane.png`)

## Failures found during development and their fixes (each retested)
1. Table overflowed at 1280 (Last workday/Float/Status off-screen) → merged schedule column, badges under the name; table scrollWidth = clientWidth (898).
2. Focus was lost after Tab when the next control was a re-rendered button → every re-rendered control has a stable `data-key`; focus lands on `rdel:R1` / `prio:T1` as expected.
3. A weekend project start that normalized to the current Monday left the Saturday in the focused field → the field always shows the normalized model value.
4. Sticky Gantt labels/corner scrolled away after ~730 px of horizontal scroll (grid box narrower than its tracks) → `width: max-content`; labels pinned at scrollLeft 1500.
5. Plans reaching the 2600-day horizon produced 124k DOM nodes and 1–2 s re-renders → run-length lane cells and trimmed long-plan lane axes: 23.7k nodes, ≈135 ms.
6. SVG export subtitle clipped; mobile toolbar wrapped (236 px header, now 144 px); mobile drag tooltip covered the preview (narrow screens now use a status line); overlapping axis labels at mid zoom; bar labels clipped at the right edge; the "binding" marker now distinguishes "sets boundary" from "delays start".
7. Harness-only issues (not app defects), recorded for honesty: an eval raced the deferred commit once; a Reset click opened its confirm dialog, which swallowed the next click; the first regression run had selector-splitting and CRLF comparison bugs (41/56 pass → fixed harness → 58/58).

## Remaining limitations
- Touch drag is not exercised (see above). Only Chromium was tested (no Firefox/Safari).
- Very long plans (>~2000 working days) re-render in ~0.1–0.2 s per interaction; lanes show only week labels on plans longer than 260 days (per-day values remain in tooltips, cell labels and the slot inspector).
- Task names containing newlines are preserved in the model and exports but shown on one line in the single-line inputs; editing such a name drops the newline.
- There is no in-app row reordering; row order follows creation/import order and never affects scheduling.
- CSV cells are quoted per RFC 4180 but not formula-neutralized (for data fidelity); spreadsheet users opening untrusted plans should be aware.
