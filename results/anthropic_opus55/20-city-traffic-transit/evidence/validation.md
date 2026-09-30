# Metroflow: validation log

**Artifact:** `index.html`, one self-contained file (≈341 KB).
- `grep -c "https\?://" index.html` → 0.
- Opening it directly as `file://…/index.html`: no page errors, 0 non-file resources loaded.

**Browser tool:** agent-browser 0.31.1.
- Read the installed skill, then `skills get core`, `core --full` and `dogfood`.
- Sessions ran in a private namespace (`AGENT_BROWSER_NAMESPACE=metroflow20ns`) after another agent's session reset the default browser.
- Served over `uv run python -m http.server 8791 --bind 127.0.0.1` for most checks, with no internet dependency. The direct `file://` open was also checked.

**Headless harnesses:** `evidence/scripts/*.js` (Node).
- They extract the simulation core from the delivered `index.html` and never touch the DOM.
- Re-run all of them with `node evidence/scripts/<name>.js`. Output of the last run: `logs/headless-regression.txt`.

**Browser helpers:** `scripts/ab.sh` (world→screen clicks via the app's camera) and `scripts/inv.js`.
- `inv.js` is the injected invariant checker. It checks that no two vehicles overlap in a lane, no vehicle is in two places or lost, and no two vehicles are inside a junction's conflict zone at once.

**Files:** screenshots in `screenshots/`; exported CSV/PNG/JSON in `logs/`; invalid-import fixtures in `fixtures/`.

## Results

Screenshot numbers in parentheses refer to files in `screenshots/`.

| # | Check | Steps / command | Observed | Status |
|---|---|---|---|---|
| 1 | Direct file open | `agent-browser open file://$PWD/index.html` | Sim running, 0 errors, 0 external requests | **pass** (25) |
| 2 | Immediate functioning city | Default Downtown grid with a 5 sim-min pre-roll | ≈250 veh + pax visible; signals and 2 bus lines; 60 FPS | **pass** (03) |
| 3 | Continuous road drawing, snapping, crossings | Road tool (`R`), real clicks via `ab.sh wclick` | 2-segment chain snapped onto junction (780,220): roads 69→71. A crossing split North St into new 4-way node #171. | **pass** (04) |
| 4 | Invalid geometry | Planner + UI | Red preview + reason for: too short, sharp angle, overlap, crossing near a junction, out of bounds. A zone over a road was rejected. Parking on a road was rejected. | **pass** |
| 5 | Undo / redo | Ctrl+Z ×2 after signal edits | Plan back to auto (greens 9/24/24) | **pass** |
| 6 | Vehicle inspection | Paused, clicked a van | Origin/destination, lane, next turn, reroutes; planned path drawn dashed | **pass** (05) |
| 7 | Phase editor + diagnostics | Signals tab → junction #17: green 24→35 (fill + Tab), then clicked an arrow in phase 1 | Mode became custom, cycle 71→81.5 s. "Protected movements conflict: E-bound through × W-bound left" flagged. Running with that plan: 0 overlaps, 0 in-box conflicts. | **pass** (06, 07) |
| 8 | Auto signal plans | `sigcheck.js` | **Bug:** generated protected-left phases also protected the opposing right turn (they merge into the same exit). Fixed. Now 0 errors across all 10 scenarios. | **fixed → pass** |
| 9 | Closure → reroute | Closure tool (`K`) on busy Central Blvd | 68 vehicles planning to use it; 70 reroutes at once; only the 2 committed inside the junction entered; the link drained. **Bug:** false "no route" failures (parking lot accessed only via the closed road). Fixed: `closetest.js` shows 0 failures over 10 min. | **fixed → pass** (08) |
| 10 | One-way | One-way tool on Main St | 2+2 → 4 one-way lanes; 0 vehicles still routed on the removed link; invariants clean | **pass** (11) |
| 11 | Incidents | Incident tool + `inctest.js` (incident rate 12/h, 3 scenarios) | **Bug:** forced lane changes could enter the crash site; incidents could also spawn under a car. Both fixed. 0 violations in 58k incident samples; max queue 72 m. | **fixed → pass** (12, 12b) |
| 12 | Tools | Lanes ± (Shift-click), construction, zone drag, parking, roundabout, map turn bans, bulldoze | All produced the expected state changes. **Bug:** Shift-click via the key state didn't register. Fixed. **Bug:** tool-option dropdowns kept focus and swallowed hotkeys. Fixed (blur after change). | **fixed → pass** (13, 14) |
| 13 | New transit route | Stop tool ×3 → route tool → Finish | Route valid with 4 visits and a fleet; its bus ran and carried riders. **Bug:** duplicate stop names. Fixed. | **pass** (09, 10) |
| 14 | Car-only vs transit A/B | Transit tab, 20 sim-min | With transit: car trip 2m52 vs 3m22, speed 24.1 vs 19.1 km/h, mean queue 104 vs 180, CO₂ −16%. Transit door-to-door trips (12m38) raise the all-mode average; the summary now reports both. | **pass** (17) |
| 15 | Pause / step / speed | Buttons, `Space`, `.`, speed select | Paused: step stays at 1541. Step button → 1542; `.` → 1543. 1×/8×/32× advanced 4 / 32 / 128 sim-s per 4 s. Invariants clean at 16× and 32×. Fixed 0.2 s sub-steps (no tunnelling). | **pass** |
| 16 | Stress preset | Load "Dense stress test", 16× | 1,868 vehicles + 489 passengers at 60 FPS, achieving 16×; invariants clean | **pass** (15) |
| 17 | Save / load JSON | File menu download (968 KB stress state), then `upload #fileInput` | **Bug:** round-trip wasn't exact (link measurements, caches, zone rates, backlog, lamp states, cooldowns missing; RNG consumed during restore). Fixed. `roundtrip.js`: identical hashes at load and after 3,000 more steps, 4 scenarios. **Bug:** file input cleared before the read finished. Fixed. | **fixed → pass** |
| 18 | Invalid imports | Truncated JSON, wrong format, dangling refs / bad lanes / bad size | Error modal lists every problem ("current city is unchanged"); city kept | **pass** (18) |
| 19 | Named saves, autosave, CSV, PNG | Save-named modal → switch scenario → Load; Restore autosave; CSV and PNG downloads | All work. CSV has 27 metric columns every 30 sim-s; PNG is 880×752. | **pass** (19) |
| 20 | Deterministic replay | File → replay, Skip to end; `replaytest.js` | UI: 12/12 checkpoints and the same end hash. Headless: 7 actions (closure, reopen, one-way, demand change, manual + random incident, strike) → 14/14. | **pass** (16) |
| 21 | Overlays | Layers tab, each radio | Speed, queue, signal, coverage (100% of zones within 400 m), OD, validation (1 component, 0 errors) — all shown with legends. **Bug:** coverage % wasn't refreshed live. Fixed. | **pass** (20-*) |
| 22 | Time of day / night / weather | Demand tab: Jump to 20:30, weather Rain | **Bug:** the clock jump made in-flight trips look 13 h long and failed 30 trips. Fixed (all timestamps shift); `timejump.js` shows 0 failures. **Bug:** night layer was never cleared, so it went nearly black. Fixed: soft lamp pools, 60 FPS. Rain: speed ×0.91, headway 1.88 s, banner shown. | **fixed → pass** (26) |
| 23 | Stats | Stats tab at 16× | Charts, top-8 corridor TTI table, outcomes by vehicle type and failure reason | **pass** (27) |
| 24 | Settings | Seed 777 restart; Budget mode; map size | Seed applied. A 300 m 1+1 road cost exactly $540,000 in budget mode. | **pass** |
| 25 | Special event | `stadium.js` | Arrival wave peaks at ≈1,400 veh/h; lots fill A→C; drivers searching fail with "no parking"; shuttle ridership reaches 513. **Bug:** fans left mid-game. Fixed (parking held until the event ends). | **fixed → pass** |
| 26 | Induced demand / zone access | `induced.js` | **Model fix:** zones now have driveways on up to 4 bordering roads; a blocked departure tries another driveway. Downtown average trip 243→174 s; the bridge closure no longer fails trips. Widening Old Post Rd 1+1→3+3 generates 20% more trips (1050→1259 per 30 min). | **fixed → pass** |
| 27 | Toasts blocking map clicks | Fresh page, quick drawing | **Bug:** the "Autosave found" toast swallowed map clicks. Fixed: toasts are click-through except their buttons; drawing works with toasts visible. | **fixed → pass** |
| 28 | Narrow 390×844 + drawing after resize | `set viewport 390 844` | No horizontal scroll (scrollWidth 390); bottom tool strip; compact 4-line HUD; roads drawn at exactly (440,90)/(600,60)/(760,90) after the resize | **pass** (21-23) |
| 29 | Touch | CDP `Input.dispatchTouchEvent` | Native pinch (zoom 0.9→3.06) and one-finger pan worked once. Later runs: this agent-browser build left `maxTouchPoints=0`, even with iPhone emulation. Pinch during road drawing and tap drawing were checked with synthetic `PointerEvent(pointerType:'touch')` instead: 2.5× zoom, no stray road, chain cancelled. | **partial** |
| 30 | Audio | Clicked the speaker button | AudioContext `running`; traffic-noise gain 0.13 and filter 518 Hz follow live traffic. Not heard — only the audio state was inspected. | **partial** (state only) |

## Final regression (after all fixes)
- `scripts/simtest.js "" 900`, all 10 scenarios: 0 invariant errors. The only failures are 5 "could not depart" in the induced-demand scenario.
- Stress: ≈1,700–2,400 vehicles at ≈2–3 ms per sim step.
- Round-trip identical in 4/4 scenarios; replay 14/14; 0 signal-plan errors; 0 incident violations; 0 failures after closure or clock jump.

## Remaining limitations
- Permissive left turns wait at the stop line instead of creeping into the box. Only the lead vehicle in a lane asks to enter a junction.
- Out-and-back bus routes turn around by routing around a block.
- Mode choice is a simple logit model plus a share of riders without a car, so transit share is modest (4–10%).
- The stress scenario congests steadily by design; the HUD shows the achieved speed honestly.
- Native multi-touch was only partly verified and audio was not heard (see rows 29–30).
