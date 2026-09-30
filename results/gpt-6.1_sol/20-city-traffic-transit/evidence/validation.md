# Flowstate — application validation

Agent-authored evidence, 30 September 2026. This document records implementation checks, observed failures, repairs and retests. It is not an evaluator report or score.

Delivered artifact: [`../index.html`](../index.html), a single self-contained HTML file. All CSS, JavaScript, SVG icons, Canvas drawing, graph/simulation code, charts and Web Audio synthesis are embedded. Open the file directly; no installation, build or server is required. Development-only harnesses and downloaded test artifacts live in this evidence directory.

## Environment and exact commands

Working directory: `/home/pyro/projects/naked/sol61/20-city-traffic-transit`. Browser: installed `agent-browser` 0.31.1 using Chrome. Before use, read `.agents/skills/agent-browser/SKILL.md`, then the installed version-matched workflows with `agent-browser skills get core` and `agent-browser skills get dogfood`, including the exploratory-testing issue taxonomy. No browser substitution was needed.

The final browser session was created from `about:blank`, with no external resources loaded. External HTTP and HTTPS were blocked before opening the artifact, and an offline reload was also exercised:

```bash
agent-browser --session flowstate-final --allow-file-access open about:blank
agent-browser --session flowstate-final network route 'https://**' --abort
agent-browser --session flowstate-final network route 'http://**' --abort
agent-browser --session flowstate-final set offline on
agent-browser --session flowstate-final set viewport 1280 800
agent-browser --session flowstate-final open file:///home/pyro/projects/naked/sol61/20-city-traffic-transit/index.html
```

Actual navigation used `file://`, not an HTTP server. Both network-abort routes remained installed during the final workflows. Persistence tests temporarily restore browser online mode after the offline test; all external HTTP(S) requests remain blocked. `--allowed-domains localhost,127.0.0.1` initially rejected file navigation because file URLs have no hostname; removing this navigation allowlist enabled the direct-file test without removing the network blocks.

Final executable checks:

```bash
node evidence/tests/core.cjs
node evidence/tests/simulation.cjs
node evidence/tests/signal.cjs
node evidence/tests/import.cjs
node evidence/tests/edit-state.cjs
node --check /tmp/flowstate-script.js
python3 evidence/tests/dependencies.py
FLOWSTATE_BROWSER_SESSION=flowstate-final python3 evidence/tests/browser-flows.py
FLOWSTATE_BROWSER_SESSION=flowstate-final python3 evidence/tests/persistence-flows.py
FLOWSTATE_BROWSER_SESSION=flowstate-final python3 evidence/tests/mobile-flows.py
FLOWSTATE_BROWSER_SESSION=flowstate-final python3 evidence/tests/final-edits.py
```

The temporary syntax-check file is the inline script extracted verbatim from `index.html`, not a delivered runtime file. The additional full workflow was also executed with:

```bash
FLOWSTATE_BROWSER_SESSION=flowstate-final python3 evidence/tests/additional-flows.py
```

All individual browser commands, labeled selectors, mouse coordinates, keyboard actions, snapshots and live read-only diagnostics are recorded in [`logs/browser-flows.txt`](logs/browser-flows.txt). The Python files invoke the real CLI; they do not substitute DOM events for pointer actions or fabricate simulation state. JavaScript evaluation reads state, validates snapshots, computes map coordinates or identifies actual hit targets. Node harnesses run the actual inline product code with minimal browser boundary stubs; routing expectations use independent fixtures.

## Public workflow results

| Check | Result and observed behavior | Evidence |
| --- | --- | --- |
| Immediate working city | PASS. Direct-file default has a connected grid, phased signals, cars, freight, buses, waiting passengers and completed trips. | `screenshots/delivery-city.png`, `logs/desktop-baseline.json` |
| Construct a city from empty | PASS. Real held-pointer strokes drew a rectangle plus crossing: 6 nodes, 7 roads, one connected component. Added residential, commercial, industrial and parking demand through controls. Seed 42 run at 30× produced 29 completed OD trips, 198 cars and 144 freight vehicles at 223.4 s; no overlaps or illegal moving edges. | `tests/additional-flows.py`, `logs/custom-built-city.json`, `screenshots/custom-built-city.png` |
| Continuous road editing | PASS. Drew a multi-point diagonal across the default network; crossings split into coherent graph nodes. Route query remains reachable. Undo/redo buttons and Ctrl+Z restored road counts. Fully covered collinear strokes create no duplicate roads; partial extension adds only its uncovered tail. | `tests/browser-flows.py`, `tests/simulation.cjs`, `screenshots/road-preview.png`, `screenshots/road-drawn.png` |
| Real OD routing | PASS. Hand-derived shortest path, reverse one-way detour, closure detour, disconnected graph, banned right turn and invalid endpoints. Default agents have real origins/destinations; all three vehicle classes and completed transit journeys asserted. | `logs/core-green.txt`, `logs/simulation-green.txt` |
| Queueing and closure | PASS. Closed actual Market Avenue road 34 with the closure tool. Direct route excluded it; affected current vehicles stopped, rather than moving through it. After 80 simulated seconds at 30×: 12 reroutes, 4 failed trips, queue 26, no illegal moving edges or overlaps. | `logs/closure-stopped.json`, `logs/closure-after-running.json`, `screenshots/closure-congestion.png` |
| One-way and lanes | PASS. Changed the selected road to one lane and A→B. Reverse route detoured, forward route remained available. Stepped simulation with zero illegal moving edges. Busy-lane removal under stress fails trips occupying the removed lane rather than merging them. | `logs/one-way-checked.json`, `logs/lane-removal-browser-retest.json`, `screenshots/one-way-road.png` |
| Signal timing and restrictions | PASS. Selected junction 8; edited fixed cycle to 60 s and offset to 8 s. An ALL phase displays a conflict diagnostic and holds all red. Running 35 s produced stopped approaches and total queue 43; restored EW and toggled banned-left control. Bus endpoint regression confirms intermediate stop arrival cannot bypass red. | `tests/signal.cjs`, `logs/signal-all-red-queues.json`, `screenshots/signal-conflict.png`, `screenshots/signal-queue-response.png` |
| Transit editing and passengers | PASS. Added a road-attached stop and a three-stop ordered loop with actual clicks. Set frequency 15 s, capacity 55, dwell 3 s. After 180 simulated seconds: 2 routes, 8 stops, 24 buses, 148 boardings, 14 destination completions, 110 currently onboard, 84 waiting. Mean completed travel 129.87 s, p95 317.1 s. | `logs/transit-running.json`, `screenshots/route-draft.png`, `screenshots/new-transit-line.png` |
| Mode/travel-time comparison | PASS. Actual matched-seed six-minute car-only and transit trials both generated 359 trips. Transit has real boarding and destination completion; results and remaining trips are displayed. No assumed transit benefit is hard-coded. | `logs/final-comparison.json`, `screenshots/final-mode-comparison.png` |
| Pause, step and speed | PASS. Pause held exact time across a wait; Space resumed and paused; labeled single-step advanced exactly 1 s. 30× execution used fixed 0.1 s physics steps throughout closures, transit and stress. Seed-reset run starts at time 0 with the selected RNG seed; same-seed full Node simulations match exactly. | `logs/final-main-workflow.txt`, `logs/simulation-green.txt`, `tests/additional-flows.py` |
| Stress | PASS. Real dense network: 56 nodes, 97 roads. At 345.7 s, measured 1,348 active trips, 230 completions, 14 buses, 787 queued vehicles, 110 boardings, approximately 50.3 FPS. Zero physical lane-overlap and illegal-moving-edge diagnostics. Congestion is visible and speed drops to 2.77 km/h. | `logs/final-browser-stress.json`, `screenshots/final-stress.png` |
| Analytics and all overlays | PASS. Navigated analytics and selected speed, density, queue, travel time, route choice, signal phases, turns, transit coverage, waiting, emissions, OD demand and network validation. Charts and corridor metrics use measured simulation state. Directed validation exposes five strongly connected components for a one-way chain fixture. | `tests/browser-flows.py`, `tests/simulation.cjs`, `screenshots/analytics.png`, `screenshots/overlay-queue.png`, `screenshots/overlay-coverage.png`, `screenshots/overlay-validation.png` |
| Named save / complete JSON / autosave | PASS. Actual named snapshot load, downloaded JSON reimport and real page reload restored exact city, RNG, vehicles, passenger manifests, counters, time and pause state. Camera is deliberately fitted on page startup, so equality checks cover network/live simulation rather than startup camera. | `logs/final-persistence.txt`, `exports/live-city.json`, `screenshots/named-save.png` |
| Invalid import | PASS. Malformed JSON and a missing road endpoint visibly reject import and preserve the entire city/live state. Nine additional corrupt serial, manifest, table, history, toggle, offset, camera, vehicle position and path-length inputs rejected by the validator. | `tests/import.cjs`, `logs/import-green.txt`, `screenshots/invalid-import-invalid-city.png`, `screenshots/invalid-import-malformed-city.png` |
| CSV and PNG | PASS. Actual downloads; CSV rows match recorded time-series samples and contain travel-time fields. PNG is a rendered map, verified as a nonempty image. | `exports/metrics.csv`, `exports/map.png`, `logs/final-persistence.txt` |
| Endpoint deletion and resizing | PASS after review fixes. Real junction-12 deletion removes affected journeys. Undo/redo, edited-city JSON import and autosave reload preserve exact live state. Shrinking the populated map to 600 m packs physical lane queues safely, validates and reloads; a further 30 s at 30× retains zero overlaps. | `tests/final-edits.py`, `logs/final-edits.txt`, `logs/edit-state-green.txt`, `exports/deleted-endpoint-city.json`, `screenshots/map-shrink-retest.png` |
| Weather, event and operating settings | PASS. Labeled controls edited rain, starting hour 22, demand, headway, incident rate, event, lane changes, frequency/capacity/dwell, fixed policy, map size and seed. After a step, actual active speeds respect the rain multiplier. Budget-exhausted drawing shows an error and preserves node/road counts. | `tests/mobile-flows.py`, `tests/additional-flows.py`, `logs/mobile-settings-applied.json`, `screenshots/mobile-night-rain.png` |
| Roundabout | PASS. Actual roundabout tool changed a signal junction into reserved/yielded control and removed its signal. Following step retained zero overlaps. | `tests/additional-flows.py` |
| Ten curated presets | PASS in executable simulation/schema checks: crossroads, avenue, bottleneck, downtown, stadium, bridge, BRT, strike, induced demand, stress. Browser flows exercise downtown, crossroads during debugging, empty construction and dense stress; this does not claim every preset received a long browser soak. | `tests/simulation.cjs`, `logs/simulation-green.txt` |
| Audio gesture | PASS for activation/state only. Real sound-button click resumed Web Audio to running; mute changed the live enabled state. Audio quality was not heard. | `logs/audio-enabled.json`, `logs/final-persistence.txt` |
| Direct file, offline and dependencies | PASS. Real file navigation and offline reload succeed with HTTP/HTTPS blocked. Recorded requests are only the file document; no external assets/services. Source audit finds one inline script, no external src/stylesheet links or network/import calls. SVG namespace identifiers do not create requests. | `logs/final-network.txt`, `logs/final-load-errors.json`, `logs/dependency-audit.txt`, `screenshots/file-offline.png` |
| Console and uncaught errors | PASS for the fresh final session. Empty console/errors logs after final workflows. Earlier development failures are retained separately and are not described as a clean run. | `logs/final-console.json`, `logs/final-browser-errors.json`, `logs/browser-errors-history.json` |

Metric screenshots and telemetry JSON sample at intervals: physics advances in 0.1 s steps and history/metric samples are taken every 5 simulated seconds. A diagnostic read can therefore show agent counts/time slightly ahead of the last metric sample. FPS is an observed browser value, not a guaranteed performance target.

## Desktop, mobile and input continuity

PASS at 1280×800 and 390×844. The 390-wide document has no horizontal overflow. Native iPhone 15 emulation also tests 393×852 at DPR 3: the CSS-width 367-pixel map has a 918-pixel backing Canvas (renderer caps DPR to 2.5). `set viewport 390 844` resets the browser's DPR to 1; native device emulation was therefore checked separately rather than claiming that the 390 viewport itself retained DPR 3.

Actual held-pointer drawing continued through 390→420→390 width changes, previewed the current stroke, committed a connected crossing graph, and undid with Ctrl+Z. Real pan, zoom/fit, vehicle selection with origin/destination/path inspection, settings, help/Escape, save dialog and analytics were exercised. Returning to 1280×800 recovered the desktop layout. Evidence: `logs/final-mobile-workflow.txt`, `logs/final-mobile-viewport.json`, `logs/high-dpi.json`, `screenshots/final-mobile.png`, `screenshots/mobile-resized-road-preview.png`, `screenshots/mobile-resized-road.png`, `screenshots/mobile-vehicle-path.png`, `screenshots/mobile-inspector.png`, `screenshots/mobile-analytics.png`.

## Failures found, causes, fixes and retests

1. **FAIL: startup black Canvas.** Initial resize invoked camera fitting before city initialization. Removed premature fitting; initialization now creates the city before fitting. Fresh direct-file startup and final console/errors PASS. `screenshots/desktop-initial.png` records the broken state; `screenshots/delivery-city.png` records delivery.
2. **FAIL: closure routing used cached availability.** A graph fixture retained an open-edge assumption in cached adjacency. Cache now stores both geometric directions; route expansion checks current closures, incidents and one-way rules. Shortest path, reverse detour, closure/disconnection and restricted-turn retest PASS. `logs/core-red.txt` → `logs/core-green.txt`.
3. **FAIL: 11 following-gap overlaps.** Descending lane queues selected the frontmost rather than nearest leader, and origin entry checked fronts rather than long vehicle tails. Fixed nearest-leader lookup and tail clearance. Deterministic default/stress and final browser workflows report zero overlaps. `logs/simulation-red.txt`, `logs/vehicle-positions-before-fix.txt` → `logs/simulation-green.txt`.
4. **FAIL: crossroads preset crashed after map layout changed.** A hard-coded center y coordinate no longer existed. Use the generated center row coordinate. All ten presets execute and validate. `logs/scenarios-red.txt` → `logs/simulation-green.txt`.
5. **FAIL: removing lanes merged occupied lanes.** Node regression reproduced 66 overlaps; real browser stress reproduced 9. Agents occupying removed lanes now fail visibly, while pending entry lanes clamp safely. Browser deletion/step and compact regression PASS with zero overlaps. `logs/lane-removal-red.txt`, `logs/lane-removal-browser-failure.json`, `screenshots/lane-removal-failure.png` → `logs/lane-removal-browser-retest.json`, `screenshots/lane-removal-retest.png`.
6. **FAIL: collinear road strokes duplicated geometry.** Added existing-coverage intervals and all on-segment nodes; covered strokes become no-ops, partial extensions add only new tails. Independent 250 m total-length fixture PASS. `logs/collinear-overlap-red.txt` → `tests/simulation.cjs`.
7. **FAIL: transit terminal/no-route handling and red-signal arrival.** Degree-one stop nodes now explicitly permit terminal turnarounds; retries preserve incoming direction context. Bus arrivals at signaled stops now obey signal and junction reservation gates. Actual connected crossroads loop and all-red bus fixture PASS. `logs/transit-terminal-red.txt`, `logs/bus-signal-red.txt` → `logs/bus-signal-green.txt`, `logs/simulation-green.txt`.
8. **FAIL: unsafe live-state imports accepted.** Expanded validation of serials, manifests, clocks, metrics history, toggles, signal offsets, camera bounds, edge lengths/positions and lane spacing. Genuine downloaded city accepted; corrupt fixtures rejected without applying them. `logs/import-red.txt` → `logs/import-green.txt`; actual invalid import screenshots retained.
9. **FAIL: unsuccessful budget stroke lost its specific error.** Preserve budget failure through rollback; leave the existing graph unchanged and display the exhausted-budget message. Actual empty-city workflow PASS. `tests/additional-flows.py`.
10. **FAIL found in read-only final review: deleting an OD endpoint retained passengers.** Removing node 12 after 180 s caused “Invalid passenger journey” on exported snapshot validation. Cleanup now checks vehicle and passenger origin/destination nodes and prunes onboard manifests. Actual pointer deletion, undo/redo, download/import and reload PASS. `logs/edit-state-red.txt` → `logs/edit-state-green.txt`, `logs/final-edits.txt`.
11. **FAIL found in read-only final review: shrinking a populated map created 16 overlaps.** Geometry scaled but vehicle lengths did not. Resize now packs queues from the front with fixed physical gaps and visibly fails journeys that no longer fit; camera zoom stays within supported bounds. A minimum-zoom enlargement regression also caught invalid camera zoom before the fix. All three edit-state regressions and actual settings/reload/30× flow PASS. `logs/edit-state-red.txt` → `logs/edit-state-green.txt`, `screenshots/map-shrink-retest.png`.

The final review found no Critical issue and two Important issues, both reproduced and repaired above. No unresolved observed application failure remains in the checks performed. Browser-tool configuration errors (domain allowlist with file URLs, decimal mouse coordinates, unsupported iPhone model name, and a DPR assertion after `set viewport`) were corrected in the harness, not hidden by altering application state or requirements. An initially overbroad dependency grep also matched the inline SVG namespace URL; the final audit parses resource attributes and confirms the namespace is not a dependency.

## Interpretation and limits

The matched comparison is a six-minute observation, not an overall transit-benefit claim. Car-only completed 182 trips, mean 108.16 s, queue 84, 177 still active. Transit completed 108, mean 105.64 s, queue 30, 251 still active, 77 boardings and 5 transit destination completions. Both generated 359. Completed-only means exclude still-active journeys; the interface exposes this censoring. Transit reduced observed car queues/emissions proxy in this trial but completed fewer journeys within the window.

The simulation uses direct transit lines plus access/egress walking, without multi-line transfers. Signals use axis-based phases, amber clearance and junction reservations; roundabouts use simplified reserved/yielded junction behavior. Emissions are an explicitly labeled fuel/CO₂ proxy, not a calibrated environmental model. These are modeling choices, not hidden failed checks.

NOT-RUN: listening to audio quality, real multi-finger pinch on physical hardware, screen-reader audit, browsers other than Chrome, and endurance beyond the recorded stress run. Mobile pointer workflows and high-DPI rendering were actually tested. There are no blocked public workflow or direct-file checks.
