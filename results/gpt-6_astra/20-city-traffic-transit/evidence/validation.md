# Agent-authored validation record

Delivery: `../index.html` — Civic Mobility Lab. This is a single, self-contained HTML application. This record describes tests performed by the development agent; it is not an evaluator score or report.

## Environment and reproduction

Working directory: `/home/pyro/projects/naked/astra/bench/20-city-traffic-transit`.

Browser tooling: installed `agent-browser` 0.31.1, Chromium 143.0.7499.40. The installed `.agents/skills/agent-browser/SKILL.md`, version-matched core workflow, dogfood workflow, and issue taxonomy were read. No browser substitution was necessary. The core and exploratory workflows are preserved in `logs/agent-browser-core.txt` and `logs/agent-browser-dogfood.txt`.

Commands used include:

```bash
agent-browser --version
agent-browser skills get core --full
agent-browser skills get dogfood
agent-browser doctor --offline --quick
node evidence/tests/model.test.cjs
python3 evidence/tests/browser_desktop.py
python3 evidence/tests/browser_mobile_stress.py
python3 evidence/tests/browser_final.py
python3 evidence/tests/browser_import_regression.py
python3 evidence/tests/artifact_audit.py
```

The browser scripts contain the exact ordered interactions and assertions. Their log files preserve each actual CLI command and response. Browser `eval` reads live state and coordinates; it does not inject synthetic demand, force counters, replace rendering, or directly drive the tested controls. Edits, timing, tool changes, drawing, navigation, uploads, downloads and audio activation use actual DOM controls, pointer events or keyboard input. Model tests separately exercise the exact simulation script extracted from the delivered HTML.

Direct-file/offline sequence in the mobile/stress and final audits:

```bash
agent-browser --session civic-final open about:blank
agent-browser --session civic-final network route 'https://**' --abort
agent-browser --session civic-final network route 'http://**' --abort
agent-browser --session civic-final set viewport 1280 800 2
agent-browser --session civic-final open file:///home/pyro/projects/naked/astra/bench/20-city-traffic-transit/index.html
```

**PASS:** The delivered file runs directly under `file://`, without a server. Both HTTP and HTTPS are blocked before navigation in these audits. Requests contain only the HTML document. The artifact has no external resource attributes, CSS imports, external URLs, or fetch/XHR/WebSocket/importScripts calls. Its Content Security Policy denies network connections and external resources. The syntax/dependency audit and artifact hash are in `logs/artifact-audit.json`. Both embedded scripts compile. Browser doctor reported no warnings or failures. Console output and uncaught-error logs were empty at the ends of the successful browser runs.

## Model verification

**PASS: 26/26** tests against the delivered engine, recorded in `logs/model-final.txt`.

Coverage: directed routing, prohibited turns, connected crossing splits, alternative routes around closures, before-barrier stopping and beyond-barrier clearance, red/green response, local fixed-time signal authority, lane following, exclusive junction reservations, occupied lane merges, destination signal compliance, bus boarding and passenger destination completion, short-link clearance, bus turns and signals across stop dwell, finite round-trip fleets, identical-seed determinism, exact active-state save/resume trajectories, valid snapshots after edits, malformed topology/dynamics/counters/diagnostics rejection, local emissions rates, and stop deletion during trips and transfers.

The suite includes red-before-fix logs. `model-initial.txt` records the missing initial artifact; subsequent failure and fix logs preserve the actual development regressions. Tests were added to the agent-owned harness; supplied benchmark requirements and evaluator files were not altered.

## Desktop main workflow — PASS

1280 × 800, with actual labeled buttons, form controls, keyboard events and continuous canvas drags. Full record: `logs/browser-desktop.txt`; structured observations: `logs/browser-desktop-results.json`.

1. Open Downtown grid and pause. Single-step changes simulated time from 90.2 to 91.2 seconds and stays paused.
2. Draw continuously through world coordinates `(130,300) → (220,340) → (320,375) → (420,420) → (490,470)`. The graph changes from 58 to 62 roads, with 37 junctions and one connected component. Undo restores 58; redo restores 62. Screenshot: [connected road](screenshots/04-desktop-road-connected.png).
3. Use One-way on Market Street r96, n25 → n26. The reverse route avoids that directed segment via r100, r111 and r97. Change its lane count to two using the inspector.
4. Select junction n9 and edit EW/NS phases to 12/42 seconds. The phase plan retains offset 18. Set a phase to ALL; diagnostics report a conflicting phase held all-red and an unreachable EW approach. Restore EW. Screenshot: [phase editor](screenshots/05-signal-editor.png). Engine tests verify the resulting stop/release behavior and conflict exclusion, beyond merely reading controls.
5. Close r76 at `(580,470)`, run at 8× for about 125 simulated seconds, then pause. Vehicles v236/v238 before the 90 m barrier stop at 82.52 m in their respective lanes. Traffic already beyond the barrier clears. Reroutes rise 38 → 213, total queue 18 → 58, completed trips 21 → 94, and network speed falls 26.60 → 18.64 km/h. Screenshot: [closure queues](screenshots/06-closure-queue-heatmap.png).
6. Create an ordered Westgate → Civic Square → East Station transit route by clicking stops; finish the line. Set its interval to 20 seconds and capacity to 160. After roughly 260 more simulated seconds, the network records 67 distinct riders and 11 completed passenger journeys, with 22 buses across the two services and 18 waiting passengers. These are real generated passengers with itineraries, capacity-limited boarding, dwell and alighting. Screenshot: [transit passengers](screenshots/07-transit-passengers.png).
7. Open Analytics, record a baseline, activate car-only mode and re-enable transit. The controls change the actual transit setting; the comparison reports observed elapsed time, completions, riders and average travel-time change. [Analytics screenshot](screenshots/08-analytics.png). This sequential edit/run does **not** establish that transit caused a travel-time improvement: congestion also increased, and no matched-seed equal-duration causal experiment is claimed.
8. Save locally as “Validation City” at 478.0 seconds. Reject malformed pasted JSON without changing current time/city. Reset clears trips/time and retains the 62-road edited network. Load the named save and recover exactly 478.0 seconds. Set replay start, step, replay and recover that same time. Reload the browser and confirm the saved city returns. Screenshot: [invalid import](screenshots/09-invalid-import.png).
9. Click Enable city audio. Web Audio enters `running` state with audio enabled. Mute works. **Audio activation passed; audible quality was not listened to or assessed.**

## Narrow viewport, files and stress — PASS

Full record: `logs/browser-mobile-stress.txt`; observations: `logs/browser-mobile-stress-results.json`.

- At 1280 × 800 and devicePixelRatio 2, the canvas is 1,032 CSS pixels wide and 2,064 backing pixels wide.
- Download JSON, PNG and CSV through their actual controls. Captures in `exports/` include a complete 376,104-byte city JSON, a valid 2,064 × 1,350 PNG, and 19 CSV rows including the header. Switch to another preset, upload the downloaded JSON through the file input, and recover the 58-road city at 90.2 seconds.
- At 390 × 844 and DPR 2, both document and canvas width are 390 CSS pixels: no horizontal overflow. Open the mobile editor; use Demand and keyboard Home plus three ArrowRight events to set demand to 0.3; select rain.
- Start a road chain at 390 × 844, resize to 430 × 900 during the chain, then continuously drag. Roads increase 58 → 63. Resize back to 390 × 844 and draw another connected stroke: 63 → 67 roads. The graph remains one component. Ctrl+Z restores 63 and Ctrl+Shift+Z restores the edit. Screenshot: [drawing after resize](screenshots/16-mobile-drawing-resize.png).
- Place and rename a stop “North Library”; place a land-use generator. Open Analytics with the narrow navigation, verify keyboard focus stays inside the dialog, and use Escape to close it. [Mobile analytics](screenshots/17-mobile-analytics.png).
- Apply seed 2026, map extent 2500, fixed signals and a zero construction budget with sandbox disabled. A new road is rejected with “Insufficient construction budget” and leaves the road count unchanged.
- Load Dense stress test: 96 nodes, 172 roads. Run about 150 simulated seconds at requested 8×. At time 243.8 s: **1,377 vehicles**, 1,678 active journeys, 187 completions, queue 1,218, network speed 3.61 km/h, 56 riders. Measured rendering was 30.14 FPS; effective acceleration was 6.73×. The engine preserves 0.1-second physics steps and reduces achieved wall-clock acceleration under load. This congested sample had no completed transit journeys yet; passenger completion is established by the separate main workflow and model tests.
- Inspect every active stress vehicle: zero missing directed edges, zero non-finite/out-of-range positions, zero overlapping lane gaps. Toggle density, signal and network-validation overlays. Validation reports one component and zero issues. Save the complete stress state. Screenshots: [stress density](screenshots/18-stress-density.png), [signal state](screenshots/19-stress-signals.png), [network validation](screenshots/20-network-validation.png).

## Final targeted audit — PASS

`tests/browser_final.py` and `logs/browser-final*.txt` cover the final overlay/import-diagnostic changes and all ten presets. The all-preset smoke check loads crossroads, synchronized avenue, suburban bottleneck, stadium, bridge, BRT, strike, induced demand, stress and downtown; pauses each and advances exactly one second. The observed configurations include a real bridge closure, six BRT bus-lane segments/two routes, stadium event demand, and no buses with transit disabled in the strike preset. This is a preset smoke check, not a long-duration performance claim for every preset.

The final audit also uses the junction inspector to prohibit a movement, displays actual planned-turn arrows and prohibited movements, checks sampled local emissions, displays 240 m transit walking catchments, pans with the Hand shortcut and pointer, selects a real vehicle and its remaining route, and captures the delivered desktop/narrow layouts. All nine targeted checks passed, including the final direct-file audit with empty console/error output and only file document requests. Screenshots: [local emissions](screenshots/22-local-emissions.png), [turn restrictions](screenshots/23-live-turn-movements.png), [transit catchments](screenshots/24-transit-catchments.png), [selected vehicle](screenshots/25-vehicle-inspector.png), [desktop](screenshots/26-delivered-desktop.png), [390 × 844](screenshots/27-delivered-mobile.png). The final independent read-only review also found no obvious regression in the scoped changes.

The final import regression also **passed** through the real file input: a JSON file with `runtime.byRoad = null` was rejected with “Invalid road diagnostics.” and left time 90.2 s, 58 roads and 80 vehicles unchanged. The original valid JSON then loaded and advanced to 91.2 s. A new complete export is preserved as `exports/final-city.json`. Console and errors remained empty. Commands and observations: `logs/browser-import-regression.txt` and `logs/browser-import-regression-results.json`. Screenshots: [rejected corrupt diagnostics](screenshots/28-invalid-diagnostics-rejected.png), [clean final desktop](screenshots/29-final-desktop-clean.png), [clean final mobile](screenshots/30-final-mobile-clean.png).

## Observed failures, repairs and retests

| Observed failure | Cause and fix | Retest evidence |
| --- | --- | --- |
| Crossing geometry failed routing | Splitting copied old endpoint properties over new endpoints. Excluded those properties. | Crossing model test; 58 → 62-road desktop draw and resized mobile draws pass. |
| Paused edited snapshots could contain removed future edges | Reconciled current/future paths immediately after topology changes. | Save/edit model test; real undo/redo, reset and reload pass. |
| Lane merge overlap; destinations bypassed signals; short-link junction locks lingered | Packed reduced lanes with safe gaps, applied destination right-of-way checks and tracked all clearance reservations. | Model regression tests pass; independent review; stress scan finds zero overlapping gaps. |
| Bus stop edits and dwell bypassed routing rules; fleets accumulated | Restart affected services, repair/fail invalid passenger legs, preserve incoming road across dwell, gate departure by signals, and retire completed round trips. | Transit/deletion regression tests pass; actual new-line flow completes 11 passenger journeys. |
| Closure trapped a vehicle holding a junction and gridlocked subsequent transit | Replaced freezing the whole segment with a midpoint barrier; traffic already past it can clear the junction. | `browser-desktop-gridlock-before.txt`, `12-closure-gridlock-observed.png`; repeated desktop flow passes with rerouting and completed passenger trips. |
| Fixed local timing changed under city automatic defaults | Made the junction's mode authoritative; global settings update non-user-edited junctions. | Fixed-mode model test and actual inspector/settings retests pass. |
| Mobile drawer transition intercepted immediate next input | Removed the drawer animation and disabled pointer events when closed. | `mobile-drawer-transition-before.png`; complete narrow editor/draw/navigation retest passes. |
| Zoom controls overlapped pulse panel; diagonal edits degraded procedural lots | Repositioned zoom controls; generate lot grids from repeated street axes. | Desktop, mobile and edited-city screenshots inspected. |
| Emissions heatmap assigned accumulated whole-trip emissions to current roads | Aggregate instantaneous per-vehicle emission rates; label one-second road samples and kg/s proxy. | New idling-car rate test passes at 0.00035 kg/s. |
| Final browser assertion compared sampled and instantaneous rates for exact equality | Road aggregates update once per simulated second, while vehicles update every 0.1 s. Recorded 0.069723 vs 0.069829 kg/s. Corrected this agent-owned check to respect sample timing; exact units are tested in the model. | Original failure preserved in `browser-final-emission-before*`; final targeted audit repeats the overlay flow. |
| Corrupt imported road diagnostics could pass initial validation | Validate the diagnostics object and every numeric rate field before accepting a city, including the newly added emission rate. | Red-before-fix log `model-diagnostics-import-before.txt`; 26/26 final model tests. |

Tooling interruptions are distinguished from application failures. CLI mouse coordinates must be integers; unsupported label-select syntax was replaced with a selector plus `select`. Overflow inspector controls require `scrollintoview` before clicking. The browser wait timeout was handled by shorter simulated-time increments. Starting video capture recreated the page, so the continuous-drawing video was repeated with tool selection after capture started. These actual tool logs are retained. `02-continuous-road.png` and `desktop-edit.webm` are **not** evidence of successful drawing; use `03-continuous-road-retest.png`, `desktop-edit-retest.webm` and the scripted flow. `12-closure-gridlock-before.png` is blank following a lost browser session and is **not** valid application evidence; the observed failure is preserved separately in `12-closure-gridlock-observed.png` and the before-fix logs.

## Practical limits and untested coverage

- The model is an exploratory simulator, not a calibrated traffic-engineering model. Junctions use conservative exclusive reservations, axis phases and clearance; transit supports direct service or one transfer, fixed capacity/dwell, and a simplified 240 m walking catchment. Emissions are a relative proxy. Curated scenarios use procedural synthetic demand.
- Aggregate road heatmaps update each simulated second; charts sample every five seconds. Average/P90 statistics use the last 500 completed trips, so incomplete long trips are represented in active demand/queues rather than those completed-trip statistics.
- Requested 8× acceleration is not guaranteed under load; the stress observation achieved 6.73× while preserving coherent movement. Active agents and waiting demand have bounded caps. Sustained multi-hour saturation, large arbitrary imported networks and every parameter combination were **not run**.
- Physical touchscreen multitouch/pinch and other browser engines were **not run**. Narrow layout and pointer/keyboard continuity were tested in real Chromium at the required size. Audio context activation/muting passed; perceptual listening was **not run**.
- A controlled matched-seed transit/car-only outcome study was **not run**. The comparison controls work and report measured data; no causal transit-benefit claim is made.
- No direct-file, offline, console, persistence or required browser-tool check remains blocked.
