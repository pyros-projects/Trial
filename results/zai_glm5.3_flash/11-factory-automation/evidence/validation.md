# FLOWWORKS — Validation Evidence

Artifact: `index.html` (single self-contained file; no build, server, external libraries, fonts, images, or network calls).
Test harness: `agent-browser` (Chromium via CDP) against a temporary local HTTP server (`python3 -m http.server 8760`), plus a direct `file://` open. `errtrap.html` is a development-only harness that re-serves `index.html` with a `window.onerror` trap; it is not part of the delivered artifact.

All state assertions below were made against the live application object (`window.FW.G`) and/or real DOM/canvas output — not from source inspection. Screenshots are in `evidence/screenshots/`.

---

## 1. Boot & default preset

| Check | Result | Evidence |
|---|---|---|
| Page boots with no console errors | PASS | `agent-browser errors` empty; `window.__errs` empty on trapped page |
| Default = Starter Line preset, visibly producing immediately | PASS | 32 buildings, belts pre-filled; 22 deliveries within ~22 s of load; screenshot `02-starter-running.png` |
| Steady state starter line (120 sim-s) | PASS | 65 iron + 65 copper plates delivered; extractors/smelters `working`; generators burning |
| Power measured from real state | PASS | HUD/analytics: 300 W supply / 200 W demand, satisfaction 100% |
| Layout adapts to resize (1280×577 → 1400×900 → 1280×800) | PASS | canvas resizes (device-pixel-ratio aware); production continued during resize (22→28 deliveries in 6 s); `04-resized-1400x900.png` |
| Narrow viewport 390×844 | PASS | toolbar wraps to bottom, analytics becomes drawer, production continues (36→42); `05-narrow-390x844.png` |

## 2. Build a complete chain by hand (real mouse input)

Performed on **Blank Sandbox** using palette clicks, `R` rotations, canvas clicks and drags (CDP pointer input), and keyboard shortcuts:

- Extractor (on deposit) → belts (drag-laid, automatic corner) → Smelter → belts → Delivery Port.
- Second extractor on coal seam → belt line → Generator.
- Power poles chained to link both areas.
- Result after ~60 sim-s: **32 iron plates mined → smelted → delivered** (`delivered: {iron_plate: 32}`); brownout at 83% while the lone bootstrap generator was the only supply (100 W / 120 W) — brownout warning + red power bar shown. `03-player-built-chain.png`.

**Bug found & fixed during this test:** the blank/campaign maps had no bootstrap power (coal extractor needs power, generator needs coal → deadlock). Added a fueled bootstrap generator + pole to Blank Sandbox and all campaign stages.

## 3. Logistics correctness

| Check | Result | Evidence |
|---|---|---|
| Splitter round-robin | PASS | Starter coal splitter fed all 3 generators (fuel seen: [7,7,7] after 120 s) |
| Merger | PASS | Balanced preset merges 2 smelter outputs per lane through mergers (174 iron / 138 copper plates produced); bus preset merges product lanes to ports |
| Inserter | PASS | Balanced storage→inserter→gear assembler: 42 gears produced (inserter is the only feed path) |
| Backpressure / blocking | PASS | Congested preset: 254 items queued, belts back up to extractors (11 blocked); jam overlay + bottleneck list reflect it |
| Item motion & belt rotation | PASS | Item `p` advances per tick and transfers across cells; chevrons animate; directions follow path corners |
| Combined recipes | PASS | Circuit (iron plate + 3 wire) and Module (2 gear + 2 circuit) both produced & delivered (40 modules delivered at 360 s on Balanced) |

## 4. Simulation controls

| Check | Result | Evidence |
|---|---|---|
| Pause | PASS | `paused:true`, sim time frozen across real-time waits |
| Single-step | PASS | Two steps advanced time exactly +0.10 s (2×DT) |
| Speed cycle 0.5–8× | PASS | At 4×: sim time advanced 20.1 s in 5.0 real s; delivery ratio preserved (20 deliveries / 20 sim-s = same 1/s as 1×) |
| Reset | PASS | ⟲ button reloads current scenario via `startCurrent()` |

## 5. Construction ergonomics

| Check | Result | Evidence |
|---|---|---|
| Valid-placement preview | PASS | Green/red ghost with reason text (screenshot `03` shows "Occupied by Conveyor"); deposits/rocks/occupied rejected with messages |
| Drag-lay belts with corners | PASS | L-shaped drags lay lines with auto turn; verified 5-cell straight run + vertical runs |
| Rotate (R) | PASS | Tool ghost rotates; selected building rotates; move-hand rotates |
| Move tool | PASS | Picked up misplaced extractor, dropped at correct cell |
| Upgrade | PASS | U-tool on smelter: tier 1→2, 290 ¢ spent, effects verified (after fix, below) |
| Delete + multi-delete | PASS | X-tool deletes; marquee drag + `Delete` cleared 3 cells in one action |
| Undo / redo | PASS | Undo restored belt then downgraded smelter; redo re-upgraded |
| Eyedropper | PASS | `Q` pipettes hovered structure into brush (tool switches to pipetted type+dir) |
| Inspect/configure | PASS | Inspector shows status/power/utilization/IO, recipe override (auto/iron/copper verified), rotate/enable/upgrade/move/delete; `11-inspector.png` |

**Bug found & fixed:** `pushOp` treated the stroke object as an array → TypeError inside pointerdown for upgrade/delete/most undo tracking (build actions still mutated, but ops were lost). Rewrote stroke op tracking (`G.stroke.ops`); upgrade, delete, undo, redo all verified after fix.

**Bug found & fixed:** switching tools reset rotation (falsy `dir||1`); tools now preserve the current direction.

**Bug found & fixed:** `put()` helper coerced direction 0 (N) to 1 (E), breaking all north-facing preset buildings; fixed to treat 0 as valid.

## 6. Analytics & overlays

| Check | Result | Evidence |
|---|---|---|
| Live per-item production/consumption/delivery table | PASS | Items/min table updates (e.g. Iron Ore 59 prod / 59 cons) |
| Power generation & demand per network | PASS | Network rows + bars (e.g. 400 W/520 W 77% brownout on Congested before fix) |
| Time-series charts | PASS | Supply/demand/prod/delivery/utilization/congestion/queue series drawn on canvas |
| Bottleneck detection | PASS | Detects blocked/starved machines, belt jams, brownout, gen out of fuel (screenshots 03, 08) |
| Inspector history | PASS | Per-machine utilization sparkline |
| Overlays selectable & usable while building | PASS | Cycled flow/links/power/heat/congestion/blocked/status/none via the real dropdown; `06-overlay-power.png`, `07-overlay-congestion.png` |

**Fix made:** congested preset had incidental brownout (400 W vs 520 W); added 2 generators → sat=1, congestion demo intact (254 queued items, 44 deliveries/90 s).

## 7. Persistence

| Check | Result | Evidence |
|---|---|---|
| Save slot → mutate → load = exact state | PASS | After 60 s of production: sim time, tick, deliveries, production counters, all 174 buildings (buffers, progress, fuel) and 71 belt items restored **bit-exact** |
| Autosave | PASS | `fw_slot_autosave` written automatically (45 s sim cadence + beforeunload); 200 buildings captured on Stress |
| Named slots UI | PASS | File modal lists slots with metadata; save/load/delete buttons work |
| Import validation | PASS | Garbage, wrong version, unknown type, out-of-bounds all rejected with messages; world untouched |
| Share code | PASS | `FW1.` base64 code (4092 chars) round-trips to identical buildings/time |

## 8. Campaign

| Check | Result | Evidence |
|---|---|---|
| Stage start: budget + cost mode + contract | PASS | Stage 1: 2600 cr, costMode on, targets Fe 30/Cu 20 |
| Construction spends budget | PASS | 2600 → 2315 cr after building the line |
| Delivery progress | PASS | Iron delivered 51/30 (HUD objective chip tracks) |
| Completion → score → unlock | PASS | Completing copper target opened "Contract complete!" modal (score 1993, time 2:28); progress saved (`unlocked:2, best:[1993]`); "Next stage" loads Stage 2 (gear 40 + circuit 25, 5200 cr) — `08-campaign-complete.png` |

## 9. Rendering / performance / audio

| Check | Result | Evidence |
|---|---|---|
| High-DPI + resize | PASS | Canvas backing store scales with devicePixelRatio; re-render on resize |
| Stress preset (200 buildings, 16 smelters, thousands of items) | PASS | 60 FPS sustained in headless Chromium; 418 deliveries/min; `09-stress-test.png` |
| Procedural audio after gesture | PASS (state-verified only) | After real click: `AudioContext` created & `running`, 44.1 kHz, master gain 0.5 matching volume slider, hum oscillator wired and gain ramps with machine activity (0→0.0044), SFX envelopes scheduled without errors. **Verified by Web Audio graph/state inspection only — audio was not listened to.** |
| Sound toggle & volume slider | PASS | Wire into master gain verified |

## 10. Runtime restrictions

| Check | Result | Evidence |
|---|---|---|
| Works opened directly as a file | PASS | `file://…/index.html` boots, produces (32 buildings, deliveries ticking); `10-file-protocol.png` |
| No external assets/services | PASS | Zero `fetch`/`XMLHttpRequest`/`WebSocket`/`Image`/ES-import usage (only prose word "import" in help text); server log shows no asset requests |
| Invalid input cannot crash the app | PASS | Four malformed save/share payloads rejected with messages; world intact |

## Issues found during development and fixed (with retest)

1. Belt crash when a cell's item array emptied during transfer (`arr[0]` on empty array) — guarded; retest: 2400-tick clean run.
2. Smelter/assembler admission chicken-and-egg (starved machine rejected the exact item it needed) — now accepts any input any of its recipes uses; retest: starter delivers 190 plates/180 s.
3. Splitter/merger ejection passed the wrong side convention — every eject into a forward belt was rejected; fixed; retest: 3 generators fueled via splitter.
4. Backpressure deadlock: machines flagged `blocked` skipped their push attempt forever; restructured to push-then-evaluate; retest: all presets deliver.
5. Preset layouts: multiple coordinate collisions (structures on deposits/rocks, lane crossings, a port on a generator cell receiving raw coal). Rewrote Balanced/Bus/Stress layouts; each preset now verified producing & delivering by simulation.
6. `pushOp` stroke-format bug (broke upgrade/delete/undo) — fixed; retest: upgrade, delete, undo, redo all pass.
7. Body scroll on viewport change could shift the canvas under UI layers — body is now `position:fixed`; retest: hit-testing clean at 1280×800, 1400×900, 390×844.
8. Bootstrap-power deadlock on blank/campaign maps — fixed with fueled bootstrap generator + pole; retest: hand-built chain delivers.

## Known limitations

- Simultaneous multi-tool touch gestures: two-finger pinch/pan implemented via Pointer Events; verified logic by code path and synthetic events, but no real multi-touch hardware was available in the headless environment (single-pointer input fully verified with real CDP mouse).
- Wheel-zoom handler is the standard `wheel` pattern and verified working via dispatched WheelEvent; the agent-browser CDP `mouse wheel` command did not deliver wheel events to the page in this environment (recorded as a tooling limitation, not an app failure).
- Audio quality was verified by Web Audio graph/state inspection only (context running, gains, envelopes) — no listening claim is made.
- Autosave uses `localStorage`, which some `file://` configurations restrict; the File→Export JSON path is the fallback and is validated.
