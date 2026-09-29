# Fluxworks — validation report

Artifact: `../index.html` (single self-contained file, ~206 KB, no build step, no external assets).
Everything below was exercised in a real browser against the delivered file. All numbers come from
`evidence/logs/results_full_run1.json`, unless noted.

## 1. Tooling & environment

| Item | Value |
|---|---|
| Browser automation | **agent-browser 0.31.1** (skill read: `skills get core --full` and `skills get dogfood`) driving headless Chrome over CDP |
| How the page was opened | **directly via `file://…/index.html`** (no HTTP server was used at any point) |
| Input | Real CDP input: `mouse move/down/up`, `press`, `keydown/keyup`, `click`, `select`, `fill`, `upload`, `download`, `set viewport` |
| Substitution | agent-browser's `mouse wheel` did not dispatch any event in this Chromium session, and its touch commands exist only for the iOS provider. For **wheel** and **multi-touch** I sent *trusted* input events through the same browser's CDP endpoint (`Input.dispatchMouseEvent` type `mouseWheel`, `Input.dispatchTouchEvent`) — `evidence/scripts/cdp_touch.mjs`. The page received genuine `pointerType:"touch"` events. |
| Diagnostics | `window.FW` (read-only live state: tick, structures, power, hashes) + `agent-browser errors / console / network requests` |
| Test driver | `evidence/scripts/ab.py` (thin wrapper around the agent-browser CLI) + one script per area (`t1_…` – `t13_…`) |
| Re-run everything | `PYTHONPATH=evidence/scripts python3 evidence/scripts/run_all.py` (≈6 min; add a name fragment to run a subset, e.g. `run_all.py t2_ t6_`) |

`ev()` calls in the scripts only **read** state or convert grid cells to screen coordinates. Everything the checks rely on was driven through real pointer/keyboard/UI input, with three exceptions, all labelled as diagnostics:
- **T2 replay:** calls `simTick()` on a restored snapshot to compare hashes.
- **T11b:** a scratch-world belt physics probe.
- **T13:** contract layouts placed via the same `commitBuild` planning/cost code the tools use, plus the auto-pole helper.

## 2. Result summary

* **Full regression (run 1): 72 / 72 checks PASS** — `logs/run_all_full_run1.out`, `logs/summary_full_run1.json`.
* After the last code change (main-loop hardening + sandbox cost-mode restore) a **compact regression of the affected flows: 25 / 25 PASS** — `logs/summary_compact_run2.json` (T1, T2, T4, T7, T12) plus an injected-failure check (§5, item 14).
* Page errors: none in any run. Console: clean (verified after `console --clear` + fresh load). Network: `No requests captured`.

## 3. Public validation checks → evidence

| Required check | Result | Where / what was observed |
|---|---|---|
| Construct a working chain extraction → transport → processing → delivery | **PASS** | T1/T4 (Contract 1, only real input): 2 extractors clicked, one belt **drag with an automatic corner** (`8,7:S … 8,11:S 8,12:E … 14,12:E`), smelter, 12-tile belt to hub, **pole line by drag**, coal extractor → generator. Smelter `Working`; the contract completed: 40/40 iron plates at tick 4824, score 892, ★★★ (`t1-02-running.png`, `t4-03-contract-complete.png`). |
| Item movement | **PASS** | Belt item counts change tick to tick; deliveries rise (T3: 6 → 33 after flow resumed; T7: 0 → 1 → 6 → 7). |
| Machine recipes | **PASS** | Smelter set to Copper Plate rejects iron ore → `Starved`, and its feed belt goes `Jammed` with Iron Ore at the head (T9). Motor needs Assembler Mk2: `Needs configuration` at Mk1, `Starved` after the upgrade (T9). |
| Power consumption | **PASS** | T1 demand is exactly 420 kW = 2×90 (extractors) + 90 (coal extractor) + 150 (smelter). The Mk2 smelter draws 255 kW (150 × 1.7). A speed module takes an assembler from 120 to 192 kW (×1.6). |
| Blocking / backpressure | **PASS** | T3: hub deleted with the Delete tool → gear belt fills (`3,3,3,3,4`) → assembler, both smelters and splitter go `Output blocked`; power demand falls from 690 to 231 kW. Undo restores flow (`t3-01-backpressure.png`). |
| Belt rotation | **PASS** | T3: hover a belt + `R` → dir 0→1, dead-end marker appears, front blocked; `Shift+R` → back to 0 (`t3-02-rotated-belt.png`). |
| Deletion | **PASS** | Click-delete of the hub, **area delete** of chest + inserter + pole, undo restores all three plus the chest's 17 items (T3). |
| Splitter / merger / inserter behaviour | **PASS** | The starter splitter feeds both smelters (util 1.00 / 1.00, 60 items/min). The merger merges both branches (60/min). An inserter placed by hand (rotated with `R`) moved 16 gears off a belt into a chest (T3). Congested preset: a splitter feeds 3 generators (T10 screenshots). |
| Deliberate bottleneck + metrics change | **PASS** | Contract 1: 2 extractors (1 ore/s) into one smelter (0.5/s). Analytics reports *"Bottleneck: Smelter (Iron Plate) at 100% — input belts are backing up"*. After the **Upgrade tool** click (Mk2), plate output goes 30 → 48/min, delivery rate 30 → 48/min and smelter power 150 → 255 kW (`t4-01…`, `t4-02-analytics-after-upgrade.png`). |
| Pause and single-step | **PASS** | `Space`: tick stays 76 over 1 s and the PAUSED tag shows. The `.` key and the Step button each advance **exactly 1 tick** (T2). |
| Time speed | **PASS** | 1× → 60.0 ticks/s, 8× → 484 ticks/s. A real-time run at 1× and at 8× produces **the identical state hash** as pure tick-stepping from the same snapshot (`e87964e2`), so speed changes cause no timing drift or duplicate items. Stress preset at 16×: actual speed 16.0, 60 FPS (T10). |
| Save and reload the exact state | **PASS** | Saves tab → slot `validation-slot` at tick 266, hash `e09f10f7` → run on → Load → tick 266, hash `e09f10f7` (identical). Exported JSON (real download, 5.5 KB) re-imported through the file input gives the same hash (T6). |
| Curated preset continues producing after a viewport resize | **PASS** | Balanced Factory at 1280×800 → 390×844 → 1280×800: deliveries 0 → 1 → 6 → 7, never stopping. Zoom rescales 28.9 → 12.7 → 28.9. DPR 2 gives a 1772×1508 backing store for an 886×754 CSS canvas (T7). |

## 4. Other requirement areas

| Area | Result | Evidence |
|---|---|---|
| Direct `file://` open, no external fetches | **PASS** | All runs used `file://`. `network requests` → none. Static audit: no URLs, `fetch`, imports or `<link>`; the only `<img>` src values are runtime-generated data URIs for item icons. |
| Energy: fuel, brownout, overload | **PASS** | T5, Power Crisis preset: satisfaction 0.727 with the battery discharging at its 250 kW limit. Per-tick craft progress equals `sat/120` for 20 single-stepped ticks (max error 7e-17). Deleting a pole → `No power` and progress frozen; undo restores. **Hard** difficulty: breaker trips (≥1 trip), machines show `Breaker tripped`. **Easy**: generator 1120 kW (800×1.4), satisfaction 1.0. Coal burn is tracked (`fuelUsed`). |
| Settings change real values | **PASS** | Isolated belt (T11b): free-flow 3.0 / 6.0 items/s at density 2 / 4 (= capacity); a jam packs exactly 2/3/4 items per tile. Congested-line drain: 3.5 → 5.0/s (density 3 → 4), 8.5/s at belt speed 2×. Machine speed 2× doubles gears 30 → 60/min. |
| Seeds & grid size | **PASS** | Seed 777 twice gives an identical map hash; seed 778 differs; 32×20 and 64×40 are honoured. Rebuilding a preset twice gives an identical state hash (T11). |
| Editing ergonomics | **PASS** | T9 covers: marquee selecting 15 structures, `Ctrl+C` → paste ghost → 15 placed (recipes kept) → undo, drag-move + undo, `G` move, eyedropper (copies Assembler + Gear recipe), `R`/`Shift+R` on a selection, area upgrade (5 belts → Mk2) + undo. Invalid extractor off-deposit is refused with a toast; the occupied cell reports "Occupied by Assembler" (`t9-02…`, `t9-03…`). |
| Belt drawing / routing / preview | **PASS** | A drag follows the pointer with automatic L-corners. Crossing rocks triggers a **BFS detour** (added after the T1 failure, see §5). A ghost preview shows green/red cells with a reason and cost label. |
| Undo / redo | **PASS** | Keyboard (`Ctrl+Z/Y`) in T3/T9, top-bar buttons in T12. |
| Campaign loop | **PASS** (contracts 1–3) / **NOT RUN** (contract 4) | Contract 1 played to completion with real input (score breakdown modal, "Next contract" loads contract 2). Contracts 2 and 3 were solved by a scripted layout within budget: 107 s / 624 of 1500 cr and 119 s / 860 of 2400 cr, both ★★★ (T13, diagnostic). Contract 4 (Motors) was **not played through**; only a cost/power estimate was made (≈2 000 cr and ≈2 MW vs 4 200 cr budget). |
| Sandbox presets | **PASS** | Starter, Balanced (circuits + gears, no issues), Congested, Power Crisis, Multi-product Bus (gear/steel/circuit/wire/brick, 4 hubs), Stress (2 372 structures), Empty seeded map. All build with 0 placement failures and all produce (preset sweep, §5). |
| Analytics | **PASS** | Live cards, power (supplied/demand/capacity) and delivery/items charts, bottleneck list (click → camera focus + inspector, T4), per-item rates, utilization per machine group, logistics (jams, peak belt throughput, fill, storage, coal, trips). The inspector shows 60 s history per structure, the belt segment (length, items, end target) and the pole network (`t9-04-inspector.png`, `15-tab-stats.png`). |
| Overlays | **PASS** | Flow, connection graph, power, utilization heatmap, congestion, blocked outputs and status each toggled via chips with real clicks and screenshotted (`t10-overlay-*.png`). Utilization stays on while the belt tool preview is active (`t10-overlay-while-building.png`). |
| Performance | **PASS** | Stress preset (2 372 structures, ~2 100–2 560 moving items): 60 FPS at 1×, 4× and 16×, actual speed = set speed, no lag. The first attempt ran at 39–41 FPS; fixed by LOD batching (§5). |
| Mouse / touch / keyboard | **PASS** | Wheel zoom anchored at the cursor (same cell under the cursor before and after). Right-drag pans without building. WASD pans, Home fits. Trusted touch (T8): a one-finger belt drag places 11 belts with a corner; a two-finger pinch zooms 7.6 → 25.9 and pans without building; a second finger landing mid-drag cancels the build (0 placed). |
| Narrow viewport 390×844 | **PASS** | Bottom toolbar, compact HUD, panel as a bottom sheet (Analytics opened), tap-to-build works, no horizontal page scroll (`t7-01-phone.png`, `t7-02-phone-panel.png`, `final-phone-390x844.png`). |
| Persistence extras | **PASS** | Named slots, quick save (`Ctrl+S`). Autosave slot written every 30 s and on unload; after reload the "Autosave found → Resume" toast restores it (T12). Share code `FW1.` = 1 623 chars vs 10.7 KB JSON; the round trip reproduces all 265 bus structures. PNG export is a real download: 2240×1388, valid signature (`downloads/factory.png`). |
| Import validation | **PASS** | Garbage text → "Import failed: Not a JSON save or FW share code", state untouched. Wrong format tag → rejected. Out-of-range values (belt dir 9, item id 99, unknown type "nuke", negative coords, recipe 999, module −3) → loaded sanitized, "2 invalid structure(s) skipped", no page errors. |
| Audio | **PASS (state only)** | Before any gesture there is no AudioContext. After a click it is `running` (44.1 kHz, gain 0.55), and a build played sounds (`AU.played` = 3). **Not heard** — headless run, so audio quality was not judged by ear. |
| HUD | **PASS** | FPS, tick, set vs actual speed, items on belts, operating vs stalled machines, power supplied/demand (colour-coded), capacity + day/night, delivery/min, current tool, objective progress, credits (contract). |

## 5. Failures found during development → fix → retest

1. **Belt drag silently left gaps** (T1, first run: cells 8,10 and 12,12 missing). The rock-avoid predicate on contract maps was inverted, putting rocks *into* the corridor. **Fix:** corrected placement, no decor rocks on contract maps, and **BFS auto-routing** of dragged belts around obstacles. **Retest:** T1 gives all 12 cells; the chain works.
2. **Stress preset:** 10 belts failed to place because decorative rocks were generated before the layout. **Fix:** decor is generated after the build, only on free cells. **Retest:** 0 failures, clean console.
3. **Bus preset:** circuits starved (iron over-subscribed). **Fix:** 8 iron lines and a second stone extractor. **Retest:** every machine works; the remaining issues are genuine bottlenecks.
4. **Bottleneck heuristics:** healthy coal backpressure was flagged; jams on the preset were missed; the contract-1 smelter bottleneck was not named until the extractors blocked. **Fix:** benign-generator detection, per-belt jam flag, "input belts backing up" and "suppliers blocked" rules. **Retest:** congested / contract-1 / power presets report the right top issue.
5. **Layout:** the HUD covered the factory, the toolbar overflowed at 800 px, and the contract card collided with the chips. **Fix:** compact 4-column HUD, a fit-camera safe area, smaller tool buttons, and the contract card moved bottom-left. **Retest:** screenshots `03…`, `06…`.
6. **Contract camera** fitted three pre-placed structures instead of the map. **Fix:** fit the whole map when there are fewer than 8 structures.
7. Belts/poles/chests showed a generic "Idle" status. **Fix:** per-type status text (Moving / Front blocked / Jammed / Powered / Brownout …).
8. **Resize** kept the desktop zoom on the phone, and a DPR change never resized the backing store. **Fix:** dominant-axis zoom rescale plus a per-frame DPR check. **Retest:** T7 PASS.
9. **Undo button** stayed disabled up to 250 ms after an edit, so a fast click was a no-op. **Fix:** immediate state sync. **Retest:** T12 PASS.
10. **Audio** was only unlocked by canvas/toolbar clicks. **Fix:** unlock on any pointer or keyboard gesture. **Retest:** T10 PASS.
11. **Stress FPS** was 39–41. **Fix:** level-of-detail rendering (batched belt/item paths below 12 px per tile). **Retest:** 60 FPS at 1×/4×/16×.
12. Curved-belt chevrons were distorted, and a splitter showed a false "no output" marker. **Fix:** tangent-based chevrons and splitter-aware output check (`14-closeup-fixed.png`).
13. **Rotate/configure/upgrade** re-created the structure, wiping its history and deselecting it; the inspector module dropdown overflowed. **Fix:** stats and selection carried over for in-place edits, and the dropdown is constrained. **Retest:** T9 PASS.
14. **Main loop:** an exception inside a simulation tick would have stopped the requestAnimationFrame loop. **Fix:** the loop is scheduled first; an error pauses the sim with a toast. **Retest:** a one-shot error was injected into `updateStruct` → sim paused with the toast, rendering stayed at 60 FPS, and it resumed normally.
15. **Contract → sandbox:** returning to sandbox kept the forced "standard" cost mode. **Fix:** restore "free". **Retest:** checked (`sandboxCostAfter: "free"`).

Test-script mistakes (not app defects) were also found and corrected: clicks on cells hidden under the side panel, a step order that let the contract finish before an issue click, and a wrong belt route in the T13 layout.

## 6. Limitations, blocked and not-run items

* **Audio quality — not verified by ear** (headless). Only the Web Audio state and the count of sounds played were inspected.
* **Contract 4 (Motors) — NOT RUN** end to end; only a cost/power feasibility estimate.
* **Real touch hardware — not tested.** Touch was verified with trusted CDP touch events in Chromium (see substitution above).
* **Only Chromium (headless) was tested**; no Firefox/Safari. Performance numbers come from headless software rendering.
* **Side-loading:** a belt fed only by side-loading reaches ~80–85 % of its capacity (3.83/4.5 items/s at density 3), because a side-load needs a gap of two item spacings. Back-fed belts reach full capacity (T11b). This is a model characteristic, not a timing error.
* **Share codes** intentionally contain the map and all structures but not items in transit. Full JSON saves contain everything.
* **External internet** was not forcibly blocked. Instead, the page was shown to make zero network requests from `file://`, and the file contains no external references.

## 7. Evidence index

* `screenshots/` — 45 PNGs (first load, layouts, T1–T12 flows, overlays, phone, HiDPI, close-ups, final desktop/phone).
* `logs/` — per-test logs (`t1.log` … `t13.log`, with every agent-browser command and its output), `run_all_full_run1.out`, `results_full_run1.json`, `summary_full_run1.json`, `summary_compact_run2.json`, `results_compact_run2.json`.
* `downloads/` — real downloads (`export.json`, `factory.png`) and the malformed fixtures used for import tests.
* `scripts/` — `ab.py`, `cdp_touch.mjs`, `c1build.py`, `t1_…` – `t13_…`, `run_all.py`.
