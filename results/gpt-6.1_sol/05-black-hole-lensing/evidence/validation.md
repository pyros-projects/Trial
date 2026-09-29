# Validation record

Agent-authored record, 2026-09-29. Delivered artifact: ../index.html. Evidence paths below are relative to this directory. Installed agent-browser core and dogfood workflows were read with `agent-browser skills get core`, `agent-browser skills get core --full`, and `agent-browser skills get dogfood` before navigation.

## Initial checks

- PASS: embedded JS syntax checked with Node vm.Script.
- Initial numerical test failed on the Doppler approaching-side convention. Reproduced by inspecting factors for +x and −x gas. Corrected the angular-velocity orientation in both CPU and shader calculations and the moving density pattern. Retest: `node evidence/physics.test.cjs`, seven numerical behaviors pass. Raw output: logs/physics-green.txt; initial test-first missing-artifact failure: logs/physics-red.txt.
- PASS: real browser direct-file navigation at 1280×800. Commands: `agent-browser --session orbital open`, `set viewport 1280 800`, `set offline on`, `open file:///home/pyro/projects/naked/sol61/05-black-hole-lensing/index.html`, `wait --fn 'window.Lensing && (window.Lensing.getState().frame > 2 || window.Lensing.getState().error)'`.
- PASS: initially no console messages or uncaught errors, no shader logs, glError = 0. Network requests showed only the delivered file (Document, 200). No external cached resource is needed, and external network was offline.
- Visual inspection: screenshots/01-desktop-initial.png shows lens-distorted accretion-disk geometry, upper and lower secondary images and a dark shadow. This establishes rendering only; camera and effect controls are exercised below.
- PASS: labeled Pause button and actual mouse down/up at (572,437) selected a ray. Returned 42 steps, closest approach 0.959 rₛ, total deflection 94.1°, capture classification, no disk crossing. Screenshot: screenshots/02-selected-ray.png. State is in logs/browser-output.log.
- Performance issue observed: ~1.8 FPS at 708×518 in this headless browser, with adaptation scheduled every 120 frames. This made first adaptation too slow. Change in progress: adapt based on elapsed time, use a lower minimum internal scale on slow devices, and stop redundant rendering once paused temporal samples have converged. This initial performance observation is not a performance pass.

The ordinary orbital browser commands and their outputs are recorded in logs/browser-commands.log and logs/browser-output.log by the agent-authored evidence/browse wrapper. Supplemental input and separate-session checks are recorded in their dedicated logs and command sequences below. Test harnesses and evidence are outside index.html.

## Desktop workflow and diagnostics

- Camera orbit PASS: real drag (618,423) → (576,433) → (511,440). Camera yaw changed 0.320 → 0.962 and pitch 0.160 → 0.262; the disk's projected thickness and secondary images changed, rather than a rigid image rotation. screenshots/04-camera-orbit.png compared with 03-desktop-refined.png.
- Tool locator limitation: `find role slider focus --name 'Lensing strength'` returned Element not found. The following Home/End keys did not change strength. Screenshots 06 and 07 do NOT establish those controls. Retested using the native labeled input selector after snapshot/scroll: `focus '#control-strength'`, `press Home` / `press End`.
- Lensing PASS after retest: strength 0 gave the sampled ray at (0.7,0.4) zero bending, closest approach 4.022 rₛ, 57 steps, escaped. Strength 2.5 gave 2.629 radians accumulated bending, closest approach 0.756 rₛ, 31 steps, captured. screenshots/08-zero-lensing-verified.png and 09-strong-lensing-verified.png.
- PASS: native range keyboard interaction, native visualization selection, clicked image ray selection. All seven modes rendered and were screenshot-inspected: steps (10), deflection (11), frequency (12), disk coordinates (16), closest distance (17), classification (18), and cinematic (05). The selected escaping disk ray had 74 steps, 47.7° bending, closest approach 3.438 rₛ, disk radius 4.42 rₛ, gravity factor 0.880, Doppler 1.322, combined factor 1.163.
- Frequency numerical state PASS: native keyboard Home on Doppler gave D = 1 and g = 0.880; Home on redshift then gave gravity = 1 and g = 1. End on Doppler gave D = g = 1.747. Immediate pixel read on this last change was stale (the next animation frame had not completed). Added a pending-render diagnostic for waiting on the actual rendered state; repeat rendered-factor check is required below.
- Integration-budget PASS: step size 0.015, maximum 80, classification mode: both selected ray and outer ray (0.8,0.2) exhausted 80 steps. At maximum 640, selected ray escaped in 200 steps with nearly unchanged converged deflection; outer ray escaped in 137 steps. screenshots/19-exhausted-budget.png and 20-restored-budget.png.
- Persistence FAIL reproduced: clicked Performance, selected steps visualization, enabled Remember settings, waited for actual localStorage JSON, then navigated to file again. Settings partially loaded, but Remember was unchecked and live diagnostics recorded `Cannot access 'legends' before initialization`. screenshot 21-persistence-failure.png. Root cause: restoration ran before visualization legend constants were initialized. Fix: restore only after all UI/renderer functions and constants exist; retest pending.
- Performance context: browser reports ANGLE / Vulkan SwiftShader (software graphics). The initial throughput does not represent hardware WebGL performance. Adaptive minimum adjusted to preserve more detail; cinematic shader now stops integrating when disk transmission is negligible, while all diagnostic modes retain full paths. Paused rendering stops after temporal convergence. Hardware GPU performance remains unmeasured.

## Fix retests and numerical renderer comparison

- Persistence retest PASS: re-opened delivered file after the initialization-order fix. Quality low, steps mode, Doppler strength 2, render settings and overlay states restored; Remember checkbox checked; no recorded application errors; shader logs empty and glError = 0. Screenshot 22-persistence-fixed.png. Then disabled persistence to clear stored test preferences.
- Rendered frequency retest PASS: waited on `!window.Lensing.getState().pendingRender` after actual range keyboard changes. With D strength 1, selected ray g = 1.163 and rendered pixel RGB [142,189,210]. At D strength 2, g = 1.536 and pixel RGB [47,192,255]. Screenshot 23-frequency-render-verified.png. This verifies live shader response, rather than only CPU state.
- Diagnostic numerical comparison PASS: agent-authored `diagnostic-pixels.js` sampled actual WebGL pixels with antialiasing disabled and the app paused. Three rays at exact internal pixel centers per mode were independently integrated in JavaScript; the expected diagnostic RGB mapping was compared with GPU output. All 12 comparisons (steps, deflection, frequency factor and closest approach) passed; maximum observed channel difference was 1 out of 255. Commands and full values in browser logs. No arbitrary debug colors were substituted for renderer data.
- Camera pan and keyboard PASS: actual right-button drag changed target to [-0.918,0.826,0.164]; arrow input changed yaw to 0.38; + changed camera distance to 16.92. Event horizon, photon sphere and disk plane toggles displayed projected geometry (24-pan-zoom-overlays.png). Mouse-wheel command did not demonstrate a distance change; wheel is retested separately below.
- Time controls PASS: actual fill/click set time to 500 while paused. Entering −1 displayed a range error and left time at 500, with no application exception.
- Presets PASS: Polar reached pitch 1.28, Equatorial 0.035, Distant distance 32, then Cinematic returned to 18. Actual intermediate motion and final rendered images observed; screenshots 25–27.
- Auto-orbit PASS: labeled Enable auto orbit button changed yaw from −0.35 to −0.168 with increasing frames, while paused simulation time remained 500. Disable auto orbit stopped it. Camera motion is independent of the simulation clock.

## Independent review and regression repairs

A read-only fresh code review (requesting-code-review skill) found four functional issues and two smaller correctness issues. The implementation is an empty-directory build, with no git history to review. All fixes were applied to the delivered file.

- Disk-edge mismatch FAIL reproduced first: `node evidence/review-regressions.cjs` reported no CPU hit for a ray leaving the thick disk slab, while the shader intersection predicate included that case. Aligning the CPU predicate makes the test pass: r = 8.963344, g = 0.810274. logs/review-edge-red.txt and review-edge-green.txt. Original numerical suite still passes.
- Fast persistence opt-out FAIL reproduced in the actual mounted app by dispatching an input event and toggling Remember off within the 400 ms save window. Immediately storage was empty, but after 700 ms it had reappeared with Remember unchecked. The pending save is now canceled and checks Remember again before writing. This timing edge used direct DOM events; normal persistence and controls were tested with native browser interaction.
- Clock-rate FAIL reproduced with actual Space key and wall-clock measurement: over 5.812 s, simulation advanced only 1.017 s, at ~6 FPS. The per-frame 0.1 s cap was the cause. Simulation and auto-orbit now use full foreground elapsed time, resetting their timestamp when visibility, pause, or graphics availability changes. Retest required below.
- Landscape layout FAIL reproduced at 1024×500: dock bottom 576, footer bottom 649, viewport 500, body overflow hidden. screenshot 30-short-landscape-failure.png. Added a short-height desktop layout without the 540 px minimum, compact intro and overlays. Retest required below.
- Recovery status fix: successful graphics initialization now restores RUNNING / PAUSED footer status. To be checked with actual WebGL context loss/restoration.
- Camera import fix: exact zero pitch is accepted and an active camera transition is canceled on valid import, so it cannot overwrite imported settings.
- Import tool limitation diagnosed: relative upload paths gave File.text permission errors. Absolute paths succeeded in the same direct-file browser: exported settings restored Doppler 2 and all three geometry overlays. An invalid absolute-path settings fixture produced the expected version error. This is a tooling path issue; it is not a required server or runtime dependency.

A subsequent touch-start baseline refinement introduced a JavaScript syntax error (a missing callback brace), observed as missing Lensing state and a nonresponsive controls sheet. `vm.Script` pinpointed the pointerdown callback. Corrected the brace, reran parsing and both numerical suites successfully, then repeated browser flows below. The screenshots/38-mobile-error-investigation.png records the failed state. No checks during that failed load are treated as passes.

## Final regression outcomes

- Persistence opt-out retest PASS: storage was absent immediately and still absent after 700 ms with Remember unchecked. Clock retest PASS: 5.9002 s of wall time advanced the simulation 5.3998 s at about 5 FPS. State is sampled between rendered frames, so the remaining roughly 0.5 s is observation lag. The prior frame-rate-dependent slowdown was removed.
- Short landscape retest PASS at 1024×500: dock bottom 439, footer bottom 500, controls reachable. screenshot 31-short-landscape-fixed.png.
- Disk and emission controls PASS with native focus/Home/End keyboard input: spin 0.95, horizon 2, inner radius 7, outer radius 16, thickness 0.8, inclination 45°, temperature 18,000 K and turbulence 1. The rendered disk changed thickness, projection and color; screenshot 32-disk-controls-extremes.png. Exposure 3, contrast 1.8 and bloom 1.5 also changed the output without shader/runtime errors. Camera FOV 75°, orbit speed 0.5 and time speed 3 were exercised on the mobile controls sheet.
- Quality and resolution PASS: Performance used 472×346, 180 steps and step size 0.085; Ultra used 944×691, 480 steps and 0.03; Balanced used 708×518, 280 steps and 0.055. Render resolution Home = 0.3 changed the buffer to 283×207 and marked quality Custom. screenshot 28-ultra-quality.png. Paused temporal accumulation converged to 32 samples and then stopped rendering (FPS 0). Disabling accumulation rendered a single stable sample. Adaptive resolution reduced the internal scale on SwiftShader; 354×259 reached about 7.8 FPS in one observed sample. Hardware throughput is not established by these numbers.
- Export/import PASS: native Save image downloaded observation.png, a genuine 708×518 canvas PNG. Export settings downloaded exported-settings.json. Native absolute-path upload restored saved controls. invalid-settings.json (version 99) displayed an import error and left settings unchanged. Importing zero-pitch-settings.json during a Polar transition retained pitch 0, yaw −0.2, distance 24 and target [0,0,0]; the transition was canceled.
- Field guide/navigation PASS: native navigation opened the explanation dialog, and its close button/Escape returned to the scene. Scene, Camera and Render tabs exposed their associated controls. screenshot 29-field-guide.png. Reset restored the default scene and cleared selected-ray state. The mobile sheet opened and closed with its labeled buttons.
- Narrow layout PASS at 390×844: no horizontal overflow, camera dock and the two-row performance footer visible. The controls sheet is scrollable; offscreen switches were scrolled into view before native clicks. Covered-click errors in the raw logs are failed attempts, followed by successful explicit scrolling or closing the sheet. Final screenshots 55-desktop-fresh-session.png and 56-mobile-fresh-session.png were visually inspected.
- High-DPI FAIL initially: `set viewport 390 844 2` changed devicePixelRatio to 2 without changing CSS dimensions, but the render buffer remained 293×552. Screenshot 43 does not prove DPR adaptation. Added a resolution media-query listener to resize buffers when DPR changes. Retest PASS: same 390×844 CSS viewport changed from 293×552 at DPR 1 to 439×828 at DPR 2; no application errors or GL error. screenshot 47-mobile-retina-final.png.

## Actual wheel and touch input

The installed native agent-browser launched and managed the browser throughout. Its wheel attempt did not demonstrate zoom, and its available CLI does not expose a two-finger gesture. Supplemental input used the real Chrome DevTools Protocol Input domain through the browser's `get cdp-url`, with Node's native WebSocket. This is real browser pointer/touch dispatch, not calls to application camera functions. No Playwright or runtime dependency was added. Exact harness: cdp-input.cjs; before/after values: logs/cdp-input.jsonl.

Commands, with the scene visible and controls closed:

```sh
node evidence/cdp-input.cjs wheel
agent-browser --session orbital set viewport 390 844
node evidence/cdp-input.cjs tap
node evidence/cdp-input.cjs orbit
node evidence/cdp-input.cjs pinch
node evidence/cdp-input.cjs cancel
```

- Wheel PASS: distance 18 → 21.98525 after a real wheel event over the canvas.
- Touch selection PASS: tap at (290,430) selected normalized pixel (0.74359,0.48996), escaping in 61 steps with closest approach 2.693 rₛ and bending 1.2285 rad.
- Touch orbit PASS: gesture (160,390) → (180,400) → (220,415) changed yaw 0.32 → −0.04 and pitch 0.16 → 0.31; rendered geometry updated.
- Two-finger continuity PASS after baseline refinement: initial finger separation 160 px increased to 240 px, changing distance 18 → 12 and panning with the moving midpoint. The earlier baseline started after the first move and only reached distance 13.52; that initial incomplete response was corrected. Repeated actual gesture after the syntax fix reached 12, with no errors.
- Cancel/restart PASS: touchCancel followed by a fresh drag changed camera orientation normally. No stuck pointer prevented subsequent gestures. screenshots 36-mobile-ray.png, 37-mobile-touch-gestures.png and 42-mobile-final-verified.png document these flows.

## Critical rays, diagnostic agreement and performance state

After material fixes, repeated `diagnostic-pixels.js` through `agent-browser --session orbital eval --stdin` with modes 1, 2, 3 and 5, the app paused, adaptive off, and temporal AA off. All 12 CPU/GPU channel comparisons still passed, with maximum difference 1/255. The evidence harness independently traces the exact internal pixel centers and compares actual WebGL readPixels values.

Near the photon region, a real click at (601,422) selected a captured ray with impact 2.6192 rₛ, 95 of 640 steps, closest approach 0.966 rₛ and accumulated bending 8.152735 rad (467.1°). The trajectory diagram visibly wraps more than one turn around the hole. screenshot 50-photon-region-trajectory.png. This provides direct evidence of complex integrated behavior near critical impact parameters.

The footer now reports a genuine average over nine inspector integrations, labeled avg/9 when no ray is selected, or the selected ray's steps. Independent recomputation over screen coordinates {0.3,0.5,0.7}×{0.3,0.5,0.7} gave 72, matching the displayed average 72. FPS, actual internal dimensions, quality, mode, camera distance and pause status were read from live state and checked in the final desktop/mobile screenshots.

## Graphics error and recovery tests

- Missing WebGL2 PASS using actual browser capability disable, not a mock. The first `--disable-webgl` attempt still allowed WebGL2 and timed out; it is not a pass. A separate session launched with `AGENT_BROWSER_ARGS='--disable-3d-apis'` showed the clear WebGL2 explanation, ready=false, frame=0 and no uncaught JS errors. Exact launch pattern:

```sh
export AGENT_BROWSER_ARGS='--disable-3d-apis'
agent-browser --session orbital-nogl open file:///home/pyro/projects/naked/sol61/05-black-hole-lensing/index.html
agent-browser --session orbital-nogl wait --text 'WebGL2 is needed to explore.'
agent-browser --session orbital-nogl eval 'window.Lensing.getState()'
agent-browser --session orbital-nogl screenshot evidence/screenshots/46-webgl-unavailable.png
agent-browser --session orbital-nogl close
```

  Observed state is retained in logs/webgl-unavailable-state.json.
- Context loss/recovery PASS after repair: deliberately invoked the real WEBGL_lose_context extension, waited for the interrupted-graphics message, then clicked Try again. Initial recovery reloaded the page and lost pause state (screenshots 44–45). Caching the recovery extension during healthy initialization now restores the existing context. Retest preserved strength 1.05, time 3.1832 and paused=true; context events were [lost, restored], ready=true, active error=null and glError=0. The interruption remains in diagnostic history as expected. screenshots 48-context-loss-session.png and 49-context-restored-preserved.png. Browsers without this recovery extension use the fallback reload, which was not separately tested.
- Actual shader compilation failure PASS: the agent-authored negative fixture fixtures/shader-failure.html is a copy with `INVALID_SHADER_VALIDATION_TOKEN;` inserted in the ray shader. It produced a genuine GLSL undeclared-identifier compilation error, displayed the explanation and compiler log, and disabled image export. screenshot 51-shader-failure-explanation.png. This fixture is not the delivered artifact and is not evaluator-owned. Reopening the delivered index.html compiled all shaders successfully.

## Clean final file check

The long-lived orbital session retained the historical fixed SyntaxError even after `errors --clear`. Its historical error list is not described as empty. A fresh isolated orbital-clean session was opened offline with the final file, exercised at both required viewports, and its current console/uncaught errors were clean. Exact command sequence:

```sh
agent-browser --session orbital-clean open about:blank
agent-browser --session orbital-clean set viewport 1280 800
agent-browser --session orbital-clean set offline on
agent-browser --session orbital-clean open file:///home/pyro/projects/naked/sol61/05-black-hole-lensing/index.html
agent-browser --session orbital-clean find role button click --name 'Pause simulation'
agent-browser --session orbital-clean find role tab click --name Render
agent-browser --session orbital-clean scrollintoview '#adaptive'
agent-browser --session orbital-clean uncheck '#adaptive'
agent-browser --session orbital-clean scrollintoview '#accumulation'
agent-browser --session orbital-clean uncheck '#accumulation'
agent-browser --session orbital-clean wait --fn '!window.Lensing.getState().pendingRender'
agent-browser --session orbital-clean find role tab click --name Scene
agent-browser --session orbital-clean errors --json
agent-browser --session orbital-clean console --json
agent-browser --session orbital-clean network requests
agent-browser --session orbital-clean eval 'window.Lensing.getState()'
agent-browser --session orbital-clean screenshot evidence/screenshots/55-desktop-fresh-session.png
agent-browser --session orbital-clean set viewport 390 844
agent-browser --session orbital-clean wait --fn '!window.Lensing.getState().pendingRender'
agent-browser --session orbital-clean screenshot evidence/screenshots/56-mobile-fresh-session.png
agent-browser --session orbital-clean errors --json
agent-browser --session orbital-clean console --json
```

PASS: errors=[], console messages=[], application errors=[], shaderLogs=[], ready=true and glError=0. Network log contains only the direct index.html document, status 200. No external assets, cached internet resources or service are needed. Raw evidence: logs/fresh-errors.json, fresh-console.json, fresh-network.txt and fresh-state.json. The browser opened the actual file:// artifact, so direct-file coverage is passed rather than blocked. No HTTP server was used or required.

Final standalone and numerical commands:

```sh
node evidence/artifact-audit.cjs
node evidence/physics.test.cjs > evidence/logs/physics-final.txt
node evidence/review-regressions.cjs > evidence/logs/review-edge-final.txt
```

All pass. The static audit parses both embedded JavaScript scripts and checks resource references, CSS dependencies and runtime network/import calls. It found four embedded shaders, no external references, and a 78,029-byte artifact. SHA-256 and output are in logs/artifact-audit.json. A first draft of this agent-authored audit accidentally interpreted JavaScript toDataURL as a CSS URL; restricting the CSS scan to style content corrected that audit false positive. No application change was needed. Numerical tests verify straight zero-strength rays, central capture, bending, step convergence, approaching/receding Doppler, redshift and constraints; the disk-edge regression passes too.

## Final coverage status and limits

| Required behavior | Final status | Evidence |
| --- | --- | --- |
| Offline, self-contained direct-file execution | PASS | Fresh file navigation, network log and static audit |
| Curved rays, sky lensing, intersected disk and near-critical complexity | PASS | Camera/effect flows, numerical tests, photon-region selected trajectory |
| Orbit, pan, zoom, presets, auto orbit and input continuity | PASS | Native mouse/keyboard, real CDP wheel/touch, cancel/restart |
| Pause, resume, time, reset | PASS | Native playback and time validation; corrected wall-time regression |
| Physical and emission controls | PASS | Native range keyboard interactions and rendered/state inspection |
| All seven diagnostic modes and selected-ray data | PASS | Actual screenshots, GPU values, CPU/GPU comparisons |
| Horizon/photon/disk/path overlays and trajectory diagram | PASS | Native switches, projected guides and selected-ray screenshots |
| Quality, integration budget, resolution, adaptive scale, temporal AA | PASS | Live dimensions/counts, budget exhaustion/recovery, convergence |
| Desktop 1280×800, narrow 390×844, landscape and DPR changes | PASS | Final screenshots, bounds and DPR-buffer retest |
| Export, import, invalid input, opt-in persistence | PASS | Genuine downloads/uploads, invalid-version UI, restoration/opt-out retests |
| WebGL2 absent, shader failure and context interruption | PASS | Actual capability disable, negative shader fixture and context extension |
| Final console, uncaught errors and GL state | PASS | Fresh isolated offline session |
| Hardware GPU throughput | BLOCKED | Only ANGLE/Vulkan SwiftShader software backend available |
| Other browser engines and physical mobile hardware | NOT-RUN | Chromium viewport/DPR and real emulated touch tested |

No known required functional failures remain after the recorded fixes. Rendering is interactive on the available software backend with lower quality/adaptive resolution, but hardware-GPU frame rates are not claimed. The scientific model is explicitly approximate: Schwarzschild spatial ray integration with an optional frame-dragging-inspired spin term, finite-thickness disk emission and approximate frequency/beaming effects; it is not a full Kerr metric or radiative-transfer simulation. The browser tests establish geometric/lensing response, integration diagnostics and functional behavior within that stated model. No evaluator score or evaluator-owned report was authored.
