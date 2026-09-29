# Strata — agent-authored validation

Date: 2026-09-29. Artifact: `../index.html` (92,422 bytes). This is the development agent's evidence, not an evaluator report or score.

The application is a single HTML file with embedded CSS, JavaScript, WebGL shaders, procedural terrain and SVG icons. It has no runtime packages, imports, models, textures, fonts, remote assets or services. The delivered default starts running immediately with seed 4107 on a 96 × 96 grid. All test scripts and records are outside the application.

## Environment and method

Used installed **agent-browser 0.31.1**, after reading `.agents/skills/agent-browser/SKILL.md`, `agent-browser skills get core`, `agent-browser skills get dogfood`, and its issue taxonomy. The actual browser reported HeadlessChrome/143.0.0.0 on Linux. It used SwiftShader software WebGL. Tests used 1280 × 800 and 390 × 844 CSS viewports, plus desktop device scale factor 2.

Browser navigation, labeled buttons, selects, focus, keyboard input, mouse movement/down/up, screenshots, errors, console, requests and HAR capture used agent-browser. Read-only `window.strata.diagnostics()` measurements report the actual typed-array state, terrain geometry revision, camera, rendering dimensions, numerical recoveries and WebGL error. The harness never calls the solver to advance the browser simulation or mutates the application's fields to satisfy a check.

Chrome native Input events supplement the installed CLI for precisely positioned wheel input and multi-touch. `tests/native-input.cjs` attaches to the **existing active agent-browser tab**, identified by a diagnostic marker, and sends real Chrome input events. The CLI's wheel command sent events at (0,0); this failed check was recorded, then retested with native input at the scene. Native CDP also held download permission on the recording-created browser context. Actual exported files were downloaded through clicks on the application's controls; they were not recreated by the harness.

## Commands and repeatable workflows

Executed from `/home/pyro/projects/naked/sol61/02-hydraulic-erosion`:

```bash
agent-browser skills get core
agent-browser skills get dogfood
agent-browser --session strata --proxy http://127.0.0.1:9 --allow-file-access open file:///home/pyro/projects/naked/sol61/02-hydraulic-erosion/index.html
agent-browser --session strata set viewport 1280 800
agent-browser --session strata snapshot -i
node evidence/tests/solver.test.cjs
python3 evidence/tests/browser-workflow.py
python3 evidence/tests/browser-workflow.py --resume-terrain
python3 evidence/tests/files-mobile.py
python3 evidence/tests/final-regression.py
node evidence/tests/native-input.cjs alt_drag 790 440 855 465
python3 -m http.server 8080 --bind 127.0.0.1
python3 evidence/tests/offline-http.py
node evidence/tests/solver.test.cjs
```

The initial numerical test failed because the application did not exist; later tests reproduced actual numerical bugs before their fixes. Desktop testing restarted after material solver/control changes. The last desktop stage resumed after explicitly scrolling to an offscreen Terrain control; earlier completed checks are preserved in the same results. The file/mobile suite was rerun fully after the portrait projection fix. Full CLI actions, coordinates, observations and failed attempts are in `logs/browser-workflow.log`, `logs/files-mobile-workflow.log`, `logs/final-regression.log` and `logs/offline-http.log`. The scripts preserve the exact steps without encoding sequences inside the application.

## Results

| Check | Status | Actual observations |
|---|---|---|
| Numerical coherence | **Pass** | 15/15 checks in `logs/solver-delivery.log`: deterministic seeds, downhill water/sediment transport, closed-basin conservation, depression pooling, dry terrain invariance, bed erosion, evaporation/deposition, conservative thermal exchange, brushes, deterministic JSON continuation, rejected invalid state, bounded stress, shallow-film deposition, height-limit deposition and isolated-pool downsampling. |
| Real evolving 3D terrain | **Pass** | Running through real Resume/Wait/Pause controls reached 16.429 s and 710 solver steps. Weighted height checksum changed 40147.480916 → 39354.248209; mean absolute terrain change was 0.139509 m. Eroded volume was 84.371786 m³; deposited 50.274137 m³; suspended sediment 34.097650 m³. Geometry revision advanced 187 → 281. No recovery or GL error occurred. See `screenshots/desktop-evolved.png` and `logs/browser-results.json`. |
| Moving and pooling water | **Pass** | Water volume evolved from 6.424988 to 99.332783 m³ with rainfall, maximum depth from 0.048 to 1.326853 m, and live maximum flow speed was 6.7393 m/s. Visible pools/channels and the water/flow diagnostic modes were inspected. Independent hand-built solver fixtures confirm downhill transfer and pooling behind a higher surrounding bed. |
| All terrain tools | **Pass** | Real mouse strokes increased/decreased actual bed heights with Raise/Lower, changed the heightfield with Smooth/Flatten, increased water with Water, increased suspended material with Sediment, and removed water with Dry. Inspect pinned a real sample containing elevation, water depth, concentration, bed change, speed and slope. `screenshots/desktop-raised-brush.png`, `desktop-water-injection.png`, `desktop-probe.png`. |
| Continuous brush settings | **Pass** | With mouse held on the terrain, keyboard changes to the actual Radius/Strength sliders changed injection while the stroke continued: small brush added 0.005811 m³; large/strong brush added 42.630517 m³. Camera state stayed unchanged. Pointer moves between samples were also tested. `logs/final-regression-results.json`. |
| Erosion parameter effect | **Pass** | Reset identical terrain, set erosion=0 and thermal=0 using slider keyboard Home, run and pause: height checksum remained exactly 40147.480916, sediment and bed exchange stayed zero while water moved. Then set erosion=3 with End, reset and run: erosion reached 84.688504 m³ and mean absolute bed change 0.120191 m. Actual sampled durations were 6.445 s and 6.398 s; not claimed to be exactly time matched. |
| Evaporation parameter effect | **Pass** | With rain/erosion/thermal off, zero evaporation preserved initial water at 6.424988 m³. Reset and set evaporation=0.4 s⁻¹: water fell to 0.406834 m³. Recorded durations and settings are in the desktop log. |
| Orbit / pan / zoom | **Pass** | Real primary drag changed orbit without bed edits; right drag changed camera target; native positioned wheel changed distance 43 → 33.825. Native Alt+drag and right drag in an editing tool changed the camera while preserving the water/height fields. Home restored framing. |
| Pause / step / reset | **Pass** | Paused time/height/water stayed unchanged across a timed wait. Single-step advanced exactly one solver step and remained paused. Reset restored zero clock/erosion and the starting terrain. Space and N shortcuts worked. Reset was also checked after edits, camera movements and JSON import. |
| Seeds and generation | **Pass** | Repeated regeneration with seed 7331 gave identical geometry; 7332 gave different geometry. Negative seed was visibly rejected without changing the terrain. Keyboard entry and regeneration were also tested on mobile with seed 90210. |
| Presets | **Pass** | Mountain, Canyon, Island and Valley had distinct genuine geometries. All five presets initialized renderable state. Aggressive Stress evolved to 11.653 s / 917 steps with 752.651 m³ eroded and 633.220 m³ deposited; every height remained finite, recoveries=0 and glError=0. `screenshots/preset-*.png`, `stress-evolved.png`. |
| Seven visualization modes | **Pass** | Selected Shaded, Elevation, Water, Sediment, Erosion/Deposition, Slope and Flow in the actual dropdown. Rendered outputs were captured in `screenshots/mode-0.png` through `mode-6.png`; height, water, sediment and simulation time stayed unchanged while paused. |
| Simulation/display settings | **Pass** | Speed/substeps and physical sliders drove genuine state. Resolution changed while running through 128 and 64; later 192 with 12 requested substeps ran with finite diagnostics and adaptive budget. 192 → 96 preserved water (15.108791656 → 15.108791680 m³) and sediment (10.818114442 → 10.818114428 m³). Exaggeration, light, visibility, contours and grid changed appearance without changing solver fields. |
| JSON files | **Pass** | Real Export-menu download; current and reset-baseline fields and flux arrays were present. After replacing the landscape and camera, actual file-input upload restored identical terrain/water/sediment checksums, clock, pause state, camera, view and selected tool. A real single-step continued it. Reset after importing restored the saved initial terrain/water/clock, independently checked against the downloaded baseline. `simulation-roundtrip.json`, `logs/imported-baseline-reset.json`. |
| PNG file | **Pass** | Real Export-menu download at current simulation dimensions. Standard-library PNG chunk/decompression/filter decoding checked the actual pixels: grayscale RGB equality and varying height levels. `heightfield.png`, `logs/files-mobile-results.json`. |
| Invalid imports | **Pass** | Malformed JSON, negative water, and invalid brush metadata produced visible errors and preserved solver/camera state. Files are in `fixtures/`; screenshot `invalid-json.png`. |
| Desktop, portrait, high DPI | **Pass** | No horizontal document overflow at 390 × 844. Mobile drawer opened/closed and all primary controls stayed usable; generation, guide and pause/resume worked. Actual DPR=2 produced a larger canvas buffer with the bounded pixel budget. Returning to desktop preserved state and glError=0. `screenshots/final-mobile.png`, `final-mobile-controls.png`, `desktop-dpr2.png`. |
| Native touch | **Pass** | One finger orbited; two fingers pinched/panned; releasing the second finger and moving the surviving first continued orbit. Native touch Water brush increased actual volume. A simultaneous two-finger gesture in the Water tool did not inject water. Correct-driver pre-fix replay failed; delivered code passed. `logs/touch-continuity-correct-red.json`, `touch-continuity-correct-green.json`, and the file/mobile workflow. |
| Direct file delivery | **Pass** | The delivered `file://` URL opened, rendered and completed the desktop and file/mobile workflows without a server. Initial request record contains only the local HTML and embedded data SVG. `logs/file-requests.log`. |
| Offline local HTTP | **Pass** | A closed proxy at 127.0.0.1:9 blocked external traffic; the Chrome process arguments confirmed it. Local 127.0.0.1:8080 remained reachable. Cache was cleared and disabled on the active target while opening the application. Fresh HTTP simulation visibly eroded the bed. HAR contains only local HTML and embedded data SVG; resource entries contain no external URLs. `logs/offline-http.har`, `offline-http-results.json`, `screenshots/final-desktop-evolved.png`. |
| Console / errors / requests | **Pass** | Fresh final HTTP workflow had no console messages or uncaught errors, glError=0 and no failed application requests. An agent-injected reserved-domain fetch was separately rejected as an external-block negative control and cleared before application request capture. |

The recorded desktop workflow has 47 passing assertions, file/mobile 23, and compact final regression 6. These are agent-authored functional checks, not benchmark scores.

## Failures, fixes, and retests

1. **Shader link failure on first direct-file run.** Vertex/fragment integer precision differed for `u_pass`. Reproduced in the console and `screenshots/initial-render-failure.png`; explicitly matched integer precision in both shaders. Real terrain then rendered with GL error zero.
2. **Primary simulation buttons disappeared while scrolling parameters.** Reproduced click coverage, `logs/reset-covered-repro.log` and `screenshots/controls-scrolled-before-fix.png`. Moved Pause/Step/Reset outside the parameter scroller. Parameter comparisons and all control tabs then used them successfully.
3. **Thin-film deposition became negative.** Real zero-erosion comparison removed a small amount of terrain and produced negative deposition. Independent review confirmed the capacity branch. Added a nonnegative exchange guard. The regression failed before the change and passes afterward; the browser now shows exactly unchanged terrain with erosion and thermal off.
4. **Drying / deposition could exceed the height ceiling.** Review and numerical regressions reproduced h=13 from a valid h=11 / sediment=2 cell, and recovery during full deposition. Limited deposition to remaining bed headroom while preserving excess suspended material. Round trips and material conservation pass.
5. **Tiny pools disappeared when lowering resolution.** Point sampling could miss a pool. Replaced downsampling of water/sediment with conservative distribution, retained normalized interpolation for upsampling, and preserved the reset baseline. Isolated 192² pool → 64² regression and real 192 → 96 volume measurements pass.
6. **Touch continuity after pinch.** Initialized a camera drag for the remaining pointer and deferred first-touch painting briefly to keep simultaneous two-finger camera gestures from editing. Reversed-fix replay with correct native input fails; final touch test passes. Early touch logs used an incorrect CDP release sequence and are explicitly not counted as valid regression evidence.
7. **Portrait projection cropped the terrain.** `mobile-initial.png` initially showed horizontal cropping. Widened projection at narrow aspect ratios; preserved the camera state. Final narrow rendered screenshots and brush/camera/resize retests pass.

Driver findings are detailed in `logs/issues.md`: CLI wheel coordinates at the page corner; a recording-created additional context; download permission resetting when a temporary CDP session closed; explicit scrolling for offscreen controls; drawer animation needing a condition wait; missing optional Pillow replaced by standard-library PNG inspection. No runtime dependency or application workaround was added for these test-tool issues.

The independent review's four important findings were all fixed and covered by regressions. No known application failures remain in the tested workflows.

## Limits and not-run coverage

- **Not-run:** Firefox, Safari and physical touch hardware. Mobile gestures were genuine Chrome native touch events in device-sized viewports.
- **Performance limitation:** On this software renderer, default 96² desktop samples were roughly 21–39 FPS, mobile samples about 40–47 FPS, and the 192² / 12-substep stress regression was about 9 FPS. Adaptive rendering and simulation budgeting stayed responsive and surfaced the limit in live diagnostics. Hardware GPU performance was not measured.
- WebGL is required for the 3D view. Forced graphics-context loss and recovery were not exercised; invalid seed and import error states were exercised.
- The simulation is a bounded exploratory heightfield model with closed boundaries, not a calibrated physical prediction. Long-duration closed basins can fill. Numerical bounds and recovery are visible in status.

Final artifact identity and request list are in `logs/delivery-manifest.json`. The temporary HTTP server and browser were development tools and are not needed to open the delivered file.
