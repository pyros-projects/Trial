# FORGE validation

Agent-authored development and validation record. No evaluator score is asserted.

## Environment and method

- Artifact: `../index.html`, one HTML file with inline styles, JavaScript, SVG symbols, Canvas assets, and gesture-enabled Web Audio.
- Browser: installed `agent-browser`, Chromium; session `forge`.
- Read the installed `.agents/skills/agent-browser/SKILL.md`, then `agent-browser skills get core`, `agent-browser skills get dogfood`, and both full workflows (preserved in `logs/`).
- Initial navigation: `agent-browser --session forge open about:blank`; `agent-browser --session forge set viewport 1440 1000`; `agent-browser --session forge network route 'http*://*' --abort`; `agent-browser --session forge open file:///home/pyro/projects/naked/astra/bench/11-factory-automation/index.html`.
- All runtime browser tests use the delivered file URL with external HTTP(S) blocked. No local server or external cache is required.
- Browser actions use accessible names, pointer events, keyboard commands, and screenshots. `Forge.diagnostics()` and `Forge.exportState()` are read-only observations of live state, not mock test drivers.

## Initial observations

- **PASS** Direct-file startup: rendered the complete application; the network log contained only the local HTML document. Console and uncaught error commands returned no errors.
- **PASS** Actual extraction/processing: at tick 213, iron, copper and coal each had 8 new units; 6 iron plates, 6 copper plates, 8 wire and 1 gear were produced. Connected power demand was 99.6 kW with 180 kW available. See `logs/initial-diagnostics.json` and `screenshots/01-initial-desktop.png`.
- **PASS** Initial circuit production: using the labeled “Simulation speed 4x” control and waiting for `delivered.circuit >= 4` reached 4 delivered circuits by tick 840.

## Findings and fixes

### F01 — Shared component belt can deadlock the default factory

- **FAIL, observed:** After continued production, the circuit assembler contained 16 wire and 0 gears. A wire at the head of the shared input belt could not enter its full buffer. Gears queued behind it. Deliveries stopped at 5 circuits and 24 outputs were blocked by tick 2760.
- Reproduction: open the original Balanced factory, select 4×, let it run beyond 90 simulated seconds, pause, inspect circuit assembler and merger. This is a physical head-of-line blockage, not a rendering problem.
- Evidence: `logs/mixed-input-deadlock.json`, `screenshots/03-failure-mixed-input-deadlock.png`.
- Fix: route independently produced wire to the assembler's south input, while gears retain the west input. The transport system retains finite queues and backpressure.
- **PASS retest:** full core workflow repeatedly exceeded the original deadlock, and the campaign reached 40 circuit deliveries.

### F02 — Resizing a fitted view crops edge machines

- **FAIL, observed:** Reducing 1440 × 1000 to 1280 × 800 preserved zoom and cropped the resource/coal lines. See `screenshots/02-desktop-1280.png`.
- Fix: refit automatically on resize while the user has not manually panned or zoomed. Preserve manually positioned and imported cameras.
- **PASS retest:** `tests/final-verification.py` resized 1440 → 1280 → 390 → 1440 without intervening Fit clicks. Every structure remained inside the construction viewport. See `logs/automatic-resize.json`.

## Remaining validation

These checks were pending at first inspection and were subsequently completed below. The final coverage table supersedes intermediate statuses.

## Core workflow retest

The exact action sequence is executable in `tests/workflow.py` and recorded in `logs/workflow-commands.log`. Each passing assertion is recorded with actual values in `logs/workflow-results.jsonl`.

- **PASS** F01 retest: the repaired factory produced 10 circuits, consuming exactly 20 wire and 10 gears for those circuits; the splitter also sent plates into storage. At the sampled point the network had 180 kW supply and 128.4–150 kW measured demand. Circuit production continued past the original 5-circuit deadlock.
- **PASS** F02 retest: all structures remained within the 1280 × 800 construction viewport after fit; `screenshots/04-fixed-desktop-1280.png`.
- **PASS** Pause held the complete state unchanged. Single-step advanced tick 1205 → 1206 and time by exactly 1/30 s (within floating-point precision).
- **PASS** Deleted the actual delivery belt at (22,9), observed the circuit assembler fill its 8-item output and the delivery rate fall to zero. Rebuilt the belt, rotated it through all four directions with `R`, and restored shipments. See screenshots 05 and 06, `logs/deliberate-bottleneck.json` and `logs/core-repaired-chain.json`.
- **PASS** Dragged an L-shaped belt route through (12,17) → (16,17) → (16,19), verified the corner's output direction, undid and redid it as one edit. Eyedropped a southbound belt, placed a copy, moved it, and demolished the new region in one area selection. See screenshot 07.
- **PASS** Upgraded the gear assembler to MK 2 and verified the live level changed, then observed six more shipments through the repaired chain.
- **PASS** Saved “Validation shift,” changed the tick, reloaded the slot, and compared the full paused factory (all item positions, inventories, machine progress, terrain, analytics, settings, camera and time) for equality.
- **PASS** Invalid JSON with missing grid data displayed “Invalid grid width” and left the complete factory untouched. Screenshot 08.
- **PASS** Actual JSON and PNG downloads were created via labeled export buttons. JSON matched the paused factory; PNG signature and rendered contents were inspected. Artifacts: `factory-export.json`, `factory-export.png`.
- **PASS** Gesture-enabled Web Audio reached `running` with sound enabled. Audio quality was **not heard or assessed** in this automated session.

### Test-instrumentation corrections

Two runs stopped on harness issues; neither is counted as a completed run. First, native CLI object formatting rounded some floating-point values by approximately 1 ULP, causing an overly strict comparison with browser-generated JSON. The harness now reads `JSON.stringify(Forge.exportState())` so exact JSON data is compared without a second native-number serialization. Second, a sound click arrived before asynchronous share-code decompression closed its dialog. The harness now waits for the actual dialog-close condition before asserting the import result or proceeding. The corrected full core workflow subsequently completed with exit code 0, including another full run after the touch-input fix.

### F03 — Multi-product bus power pole occupied the steel belt route

- **FAIL, observed:** the bus delivered circuits but no engines. The steel smelter had an 8-item blocked output; the engine assembler had gears but no steel. A pole at (25,18) occupied the missing steel belt cell.
- Reproduction: load Multi-product bus, select 4×, wait for at least two engines; after 25 real seconds the condition timed out. Inspect steel output (24,18), the pole (25,18), and the engine machine.
- Evidence: `logs/bus-failure.json`, `screenshots/24-bus-failure.png`.
- Fix: move that pole to (25,16), leaving a continuous steel route while retaining power coverage. Also cap blocked storage transfer progress at one ready transfer.
- **PASS retest:** the bus delivered 3 engines and 3 circuits; `logs/bus-fixed.json` and `screenshots/22-multi-product-bus-fixed.png`.

## Extended observations

- **PASS** Full corrected core run completed with exit code 0, all assertions, JSON/share import completion waits, real downloads, audio context activation and empty browser error logs.
- **PASS** Campaign reached 40 delivered circuits and completed with 8,246 points in the observed run. Next contract increased the stage; production reset cleared items and counters while retaining 54 structures. Restart restored the initial contract.
- **PASS** Power crisis had demand 436.32 kW, capacity 180 kW and 0.4125 power ratio. Adding and upgrading real generators raised capacity to 540 kW for 540 kW demand and ratio 1. Removing its bridge pole made consumers unpowered; undo restored the network. See screenshots 19–20 and `logs/power-recovery.json`.
- **PASS** Replaced two actual starter belts with a powered inserter at (7,9), leaving a gap at (6,9). It reached two cells behind and passed eight items to the still-producing smelter line. Screenshot 21 and `logs/inserter-state.json`.
- **PASS** Configuring the iron-fed smelter to copper starved it. Restoring iron resumed actual production.
- **PASS** Thirty user-triggered single steps from an identical save at 1× and 4× yielded identical complete simulation state, excluding the speed setting. Real elapsed checks observed 23 ticks at 1× and 96 ticks at 4× in approximately 0.8 seconds each.
- **PASS** Congested preset: enabled storage output, rotated it south, built a delivery hub and connecting belt, and delivered ten plates. The depot remained full because its upstream backlog continued refilling it, while its output and deliveries advanced.
- **PASS** Initial real touch checks created seven belt cells with a corner; pinch increased zoom from 0.478 to 1.051, and pan shifted the camera 36 px right and 24 px up without adding structures. CDP touch input was sent into the browser launched and managed by `agent-browser`; the script is `tests/touch-input.js`. All navigation, selection, screenshots and diagnostics still use `agent-browser`. No substitute browser was needed.
- The mobile test needed a correct animation completion predicate: CSS resolves `transform: none` to `none`, not the identity matrix string. This was a test wait error; the corrected mobile sequence is being rerun. The ordinary close action was manually retried and closed the drawer with `inert=true`.

### F04 — Pinch with a construction tool placed an accidental belt

- **FAIL, reproduced:** with Belt selected, a two-finger pinch placed one cell on the first touch before the second touch switched to camera zoom. The verified gesture increased structure count 54 → 55.
- Evidence: `logs/pinch-building-verified.json`, `screenshots/30-pinch-confirmed-before.png`, `screenshots/31-pinch-confirmed-after.png`, `videos/pinch-building-verified.webm`.
- Fix: a touch begins as a pending gesture. A tap commits on release; a drag commits once it moves 5 CSS pixels. A second touch cancels the pending construction and begins pinch zoom. Select-mode touch dragging pans the camera.
- **PASS retest:** a verified active-tab pinch with Belt selected changed zoom from 0.478 to 1.051, kept the tool as Belt and structure count at 54, and preserved the complete paused factory state except camera. See `logs/pinch-active-tab-fixed.json`, `screenshots/34-pinch-active-fixed-before.png`, `screenshots/35-pinch-active-fixed-after.png`, and `videos/pinch-active-tab-fixed.webm`.

### Browser instrumentation note

Recording start recreated/reloaded the browser page in this installed CLI, resetting the transient selected tool. The first pinch setup recordings therefore do not demonstrate the suspected bug. The setup was repeated **after** recording start and the active tool was explicitly checked before the gesture. An additional CLI issue sent selector mouse clicks to half their expected CSS coordinates after high-DPI recording setup (recorded in `logs/hidpi-selector-coordinates.json`). Recording tests use 1× device scale to avoid this tool-coordinate issue. Real touch gestures were also exercised at 2× scale via direct CDP input, and the application was rendered/inspected at 2× scale. These are testing-tool limitations; no application code was changed to accommodate them.


## Final coverage and evidence

| Check | Final result | Evidence / observed behavior |
|---|---|---|
| Standalone direct-file runtime | PASS | Fresh file-URL launch in `forge-final`, with HTTP(S) blocked. Network logs contain only local HTML document loads. |
| External dependencies | PASS | One inline script; no external src/href, fetch, imports, fonts or asset requests. `logs/artifact-audit.json` records the final SHA-256. |
| Extraction → processing → two-component assembly → dispatch | PASS | Live ingredients consumed at recipe ratios, moving logical items, and 40-circuit contract completion. |
| Splitter / merger / inserter | PASS | Splitter fed storage and gear assembly; merger passed items; powered inserter moved ore across a deliberately removed cell into a producing chain. |
| Backpressure | PASS | Removed delivery belt filled assembler output to 8, stopped delivery, and raised blockage notices; rebuilding restored shipments. |
| Construction ergonomics | PASS | Pointer belt drag with corners, rotation, copy, move, upgrade, single and area deletion, undo/redo. Power-line drag placed two poles four cells apart and joined the real grid. |
| Power | PASS | Fuel consumption, measured demand/supply, brownout at 0.4125 ratio, generator recovery to 540/540 kW, and disconnected consumers. |
| Pause, single-step, timing | PASS | Full-state pause equality, 1/30-second single steps, deterministic state equality at 1×/4×, and measured real-time tick scaling. |
| Campaign | PASS | Completion, positive score, reward, next contract, production reset and preset restart. |
| Presets, seed, grid, sandbox | PASS | Starter, Balanced, Congested, Crisis, Bus and Stress exercised. Seed 4242 reproduced identical terrain geometry on a 48×36 grid; Stress used free construction. Optional Blank canvas preset: NOT RUN as a separate browser scenario. |
| Analytics and overlays | PASS | Production/consumption rates, buffers, utilization, history, power and bottlenecks from live diagnostics; selected every overlay and captured power/connection/utilization/congestion views. |
| JSON, share, named saves | PASS | Full paused-state equality after named-slot and share-code import; actual JSON and PNG downloads; complete busy-factory state restored after reload. |
| Import errors | PASS | Missing grid, invalid direction, duplicate structure rejected with visible messages; original state unchanged. |
| Desktop / mobile resize | PASS | 1440×1000, 1280×800 and 390×844. Automatic fit and ongoing production after resize verified. |
| Touch input | PASS | Real CDP touch events: continuous L route, single tap committing one building, pan and pinch. Pinch with a build tool preserved all factory state except camera. |
| High DPI | PASS | 390 CSS pixels used a 780-pixel canvas at DPR 2. Changing DPR without changing CSS size rebuilt the backing canvas; real touch placed exactly one new cell. `logs/hidpi-final.json`. |
| Load / performance | PASS | 668 structures, 1,072 moving items, approximately 55 FPS and 1,380 deliveries/min in the observed run. Continued shipping after narrow resize. `logs/stress-live.json`. |
| Density changes / conservation | PASS | Reduced density on busy belts. Item positions stayed in [0,1], and iron/plate/coal inventory deltas equaled production minus consumption. Exact save/load still worked. |
| Procedural audio | PASS for activation | User clicked Enable sound; AudioContext became running. Listening/subjective sound quality: NOT RUN. |
| Console / uncaught errors / requests | PASS | Empty application error and console logs in completed desktop and mobile runs; no external requests. |

### Exact test commands

The action-level commands and outputs are in `logs/workflow-commands.log`. These agent-authored scripts use the actual installed CLI and real controls:

```bash
node -e "const s=require('fs').readFileSync('index.html','utf8');new Function(s.match(/<script>([\s\S]*)<\/script>/)[1]);console.log('syntax OK')"
python3 evidence/tests/workflow.py core
python3 evidence/tests/advanced.py
python3 evidence/tests/presets.py
python3 evidence/tests/mobile.py
python3 evidence/tests/pinch-fixed.py
python3 evidence/tests/final-verification.py
python3 evidence/tests/hidpi.py
```

`advanced.py` initially stopped on F03 after its earlier checks passed; the corrected preset, conservation and persistence sequence completed in `presets.py`. The final full core run, final mobile run, active-tab pinch regression, final verification and high-DPI run all completed with exit code 0. Intermediate failed harness runs are retained, not silently counted as complete runs.

The touch helper supplements CLI mouse commands with Chromium `Input.dispatchTouchEvent`. Recording can leave multiple page targets, so the final helper marks the CLI's active page with a test-only marker and attaches to that exact target. This marker does not change the simulation. An earlier purported pinch pass that reached an older tab is marked `invalid-run` in the agent-authored JSONL results and is superseded by the explicit active-tab retest.

### Final limitations

No unresolved gameplay failures remain in the exercised flows. Manual audio listening, physical mobile hardware, and non-Chromium browsers were not tested. Performance figures are observations from this environment, not universal guarantees. Local storage remains subject to the browser's quota; JSON export is available when local saving is unavailable. PNG export captures the current camera view. No evaluator-owned files, requirements, scores or reports were created or altered.

The final delivered artifact is `../index.html` (138,355 bytes). Its SHA-256 is `d0b74d0f5e6ed2a61b1b0263aae15a45fa6dd52046d00e373e93fe3315a1576a`.
