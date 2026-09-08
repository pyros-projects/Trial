# ISOBAR — validation record

Final artifact: [`../index.html`](../index.html), **125,662 bytes**, one self-contained file. Open it directly in a WebGL2 browser. No installation, HTTP server, build step, or network service is required to use it.

This is an **agent-authored validation record**, not an evaluator report or score. The delivered artifact SHA-256 is recorded in [`logs/artifact-audit.json`](logs/artifact-audit.json). All implementation and browser-review findings described below were addressed; no known unresolved functional failure remains in the exercised flows. Performance and untested coverage are stated at the end.

## Environment and exact workflow

- Node v25.8.1; Python 3.12.3; installed **agent-browser 0.31.1**.
- Read `.agents/skills/agent-browser/SKILL.md`, then the installed version's `agent-browser skills get core`, `agent-browser skills get core --full`, and `agent-browser skills get dogfood` before browser use.
- Chromium reported **ANGLE / Vulkan / SwiftShader Device (Subzero)**: software graphics, not a hardware GPU. See [`logs/final-hardware.json`](logs/final-hardware.json).
- Main viewports: **1280 × 800**, **390 × 844**, and a **1280 × 800 / DPR 2** resize check.

Initial browser setup was:

```bash
agent-browser --session weather open
agent-browser --session weather network route 'http*' --abort
agent-browser --session weather set offline on
agent-browser --session weather set viewport 1280 800
agent-browser --session weather open file:///home/pyro/projects/naked/astra/bench/18-weather-storm-lab/index.html
agent-browser --session weather snapshot -i
agent-browser --session weather screenshot evidence/screenshots/desktop-initial.png
agent-browser --session weather errors
agent-browser --session weather console
agent-browser --session weather network requests
```

**PASS — direct-file, offline load.** This was a fresh named browser session, with the browser offline and HTTP/HTTPS blocked. WebGL2 compiled and the atmosphere ran. Network records show only the local HTML and an embedded `data:image/svg+xml` dropdown arrow; no external assets or services. A local HTTP substitute was unnecessary. [`logs/delivery-network.txt`](logs/delivery-network.txt) preserves the final network record.

The exact interaction commands and observations are in [`logs/browser-flows.log`](logs/browser-flows.log). Executed scripts:

```bash
python3 evidence/browser-flows.py
python3 evidence/browser-continue.py
python3 evidence/browser-final.py
python3 evidence/browser-mobile.py
python3 evidence/final-regression.py
node evidence/intervention-check.cjs
node evidence/ui-tests.cjs
python3 evidence/artifact-audit.py
```

These scripts invoke **agent-browser itself**, using snapshots, labeled buttons/selects, pointer down/move/up, keyboard input, file inputs, and screenshots. JavaScript evaluation reads live model/renderer diagnostics and element bounds; it does not substitute field mutations for the tested interactions. The scripts record their exact commands, assertion results, failures, and subsequent retests. Some scripts are continuations from the documented browser state, not independent fresh-session runners.

For positioned wheel, held keyboard keys, and multi-touch gestures, [`cdp-input.cjs`](cdp-input.cjs) supplements the installed CLI through the **same live Chromium page**. For example:

```bash
node evidence/cdp-input.cjs wheel 800 430 -180
node evidence/cdp-input.cjs key KeyW w 700
node evidence/cdp-input.cjs touch 155 400 235 425
node evidence/cdp-input.cjs pinch 195 400 80 145
```

Coordinates used in the actual runs are in the command log. These send genuine Chromium input events. The installed CLI's wheel command was observed dispatching at `(0,0)` even after a mouse move; the supplement supplies the intended scene coordinates. The CLI does not expose the needed multi-touch/held-key operations.

## Atmospheric behavior — observed, not inferred from animation

**PASS — 19 numerical checks.** The final command `node evidence/model-tests.cjs` passed 19 checks, including reproducible seeds and steps; transport/coupling; terrain/wind response; water-phase transfers; rain flux across a freezing boundary; soil replenishment; full state continuation; every brush; resampling; all ten presets; and finite behavior in prolonged/extreme cases. Final log: [`logs/model-tests-threshold-final.log`](logs/model-tests-threshold-final.log). Full implementation/testing details: [`model-report.md`](model-report.md). Independent scoped review and closure: [`model-review.md`](model-review.md).

The model uses explicit upwind transport, diffusion, pressure-gradient/divergence approximations, rotation, surface heat/vapor sources, uplift cooling, condensation/latent heat, rain formation and donor-flux sedimentation, rain evaporation, and wet-ground replenishment. The GPU reads these same fields. Small procedural noise shapes simulated cloud density; it never creates independent decorative cloud masses.

**PASS — actual storm evolution in the browser.** At seed 4821, reset produced reproducible initial fields. After running the supercell to **168 simulated seconds**, all eight field checksums changed: temperature, vapor, cloud, rain, horizontal u/v wind, vertical wind, and pressure. Cloud cover was **13.77%**, maximum updraft **5.85 m/s**, accumulated mean ground precipitation **0.00199 mm**, and CFL **0.188**, with all fields finite. See [`logs/storm-evolved.json`](logs/storm-evolved.json) and [`screenshots/desktop-storm-evolved.png`](screenshots/desktop-storm-evolved.png).

**PASS — real continuous interventions and delayed response.** In Map view, continuous heat, moisture, and wind strokes modified their intended fields while paused; simulation time remained fixed and pointer capture cleared after release. Immediately afterward, cloud and rain arrays were unchanged, demonstrating that those tools did not directly paint condensate. Two full states were downloaded through the application: [`control-state.json`](control-state.json) and [`intervened-state.json`](intervened-state.json).

Advancing those actual browser-generated states identically from T=168 to T=348 seconds produced:

| Quantity | Untreated | Painted with heat, moisture, wind |
|---|---:|---:|
| Mean cloud water, g/kg | 0.066629 | 0.067064 |
| Mean rain water, g/kg | 0.024930 | 0.024977 |

Cloud/rain L1 differences were **5.351 / 0.621** after evolution, versus exactly zero immediately after painting. This demonstrates a delayed condensate response. Ground accumulation had not increased in the treated twin at that time; the evidence is extra atmospheric cloud/rain water, not a claim of increased ground rainfall. Exact results: [`logs/intervention-response.json`](logs/intervention-response.json).

**PASS — sustained default storm.** Numerical tests retain a localized supercell without reinserting cloud. Cloud cover at 210 / 420 / 630 / 1080 seconds was **13.87 / 14.45 / 18.07 / 37.89%**. The condensation-threshold correction leaves the default threshold-1 evolution identical.

**PASS — actual condensation threshold.** At otherwise identical 110% RH, threshold 0.8 formed **0.0725445 g/kg** mean cloud, while threshold 1.2 formed zero. Existing supersaturated cloud did not evaporate simply because it was below a higher nucleation threshold. The browser's labeled slider reached **65% RH / 130% RH** and changed the actual parameter to **0.65 / 1.3**. See `logs/threshold-control-low.json` and `logs/threshold-control-high.json`.

## Browser interaction coverage

The agent-authored assertion ledger [`logs/browser-results.json`](logs/browser-results.json) contains **74 passing workflow assertions** after retests. Additional final threshold, flux, navigation, fullscreen, and fault-injection checks are preserved in their named logs.

| Check | Result and observed evidence |
|---|---|
| Pause / step / deterministic reset | **PASS.** Paused arrays and time held across a timed interval. One step advanced 0 → 3 seconds exactly once and stayed paused. Resetting seed 4821 reproduced every field checksum. Space and `.` also worked via real keyboard input. |
| Orbit / pan / zoom / camera presets / fly | **PASS.** Drag changed yaw/pitch; positioned wheel changed distance; right-drag changed target; camera preset button changed pose. Held W moved the fly camera and drag changed its look direction. Fullscreen entered with `document.fullscreenElement.id === 'stage'` and exited via its control. |
| Field views | **PASS.** Cinematic plus temperature, humidity, cloud water, precipitation, pressure, horizontal wind, vertical motion, vorticity, terrain, and surface moisture rendered. Ten diagnostic screenshots and live JSON snapshots are under `screenshots/field-*` and `logs/field-*`. Final precipitation mode shows **sedimentation flux in mm/h**, derived from the model's rain mixing ratio, 1.08 kg/m³ air density, and 7 / 2.3 m/s rain/snow fall speed. Final capture: `screenshots/precipitation-flux-final.png`. |
| Map / section / probe | **PASS.** A pointer placed a new probe; the vertical profile and all local values updated. Probe position and altitude report the actual sampled grid node (e.g. 2.727 km at 12 layers). Map, picking, and projection share center/zoom; portrait map fits both dimensions. Section vectors sample its x/y plane at probe z. Scale is computed at the probe. |
| Brush radius / strength / all tools | **PASS.** Keyboard-adjusted radius 5 km and strength 3. Continuous cool, dry, pressure, cloud, raise, lower, lake, forest, city, and ocean strokes changed the appropriate field or surface checksum; heat/moisture/wind tested separately. Input continuity and pointer release were checked. |
| Ten presets | **PASS.** Each preset was selected through the actual control and single-stepped. All remained finite and yielded distinct moisture/wind states. Snow and numerical stress were included. Stress activated four internal substeps at CFL 0.8. |
| Quality / grid / layers while running | **PASS.** Changed to Performance, 24 × 24 × 8, and 32 cloud samples without stopping the solver. Later restored 32 × 32 × 12. Cinematic 88-sample quality and DPR 2 resizing were checked. |
| Lightning | **PASS.** Manual bolt generated a visible strike and flash. Actual automatic storm activity recorded **8 automatic strikes**, alongside 2 manual strikes, in `logs/thunder-dispatched.json`. |
| Thunder | **PASS for activation/synthesis/state.** Clicked the audio checkbox as a user gesture; AudioContext became `running`. Distance-delayed thunder was scheduled and a synthesis event executed. **Listening/audio quality was not evaluated.** |
| Full state save/load | **PASS.** Application-generated JSON restored exactly matching fields, time, and fly camera pose. Loading while Heat was selected correctly restored orbit interaction for the saved fly camera. |
| Invalid imports / seed | **PASS.** Malformed JSON, wrong array length, array-valued preset, and injected unexpected lightning objects were rejected with visible messages. Fields, time, camera, and rendering were preserved. Invalid numeric seed was rejected. Screenshots and JSON comparisons are in `logs/invalid-*` and `screenshots/invalid-import-rejected.png`. |
| PNG / CSV | **PASS.** Actual downloads produced valid PNG signatures and images (one verified output 774 × 330, 265,634 bytes), and a CSV containing 17 numerical/metadata columns. Files: `exported-view.png`, `exported-final-view.png`, `exported-probe.csv`. |
| Settings persistence | **PASS.** Changing exposure/quality and reloading the file restored those settings, dimensions, and selected preset. Full simulation state is explicitly saved to JSON rather than silently persisted. |
| Navigation | **PASS.** Settings, probe inspector, scenario library, Field guide, dialog close/Escape, and fullscreen were exercised. Selecting fair-weather cumulus from the scenario library applied it and closed the dialog. |
| 390 × 844 touch layout | **PASS.** No horizontal document overflow (390 px scroll width). Drawer controls and presets worked. Real touch painting changed vapor and released capture; two-finger pinch changed map zoom. Probe dialog and live weather remained usable. See `screenshots/final-mobile.png`, `final-mobile-map.png`, and `final-mobile-probe.png`. |

## Failures found, fixes, and retests

1. **Initial presentation and rapid storm collapse — fixed.** The first camera was distant, the ocean tile had a square seam, clouds lacked contrast, and cloud cover fell to 3.9% by T=219 s. Moved the camera, matched open-ocean rendering, added field-driven optical-depth lighting and projected precipitation. Model corrections use localized deep moist inflow and saturation-limited evaporation, not cloud reinsertion. Final default evolution and browser screenshots were retested. Progressive evidence: `desktop-initial.png`, `desktop-refined.png`, `desktop-cloud-lighting.png`, `desktop-immersive.png`, and `final-desktop.png`.
2. **Elevated-ground rain / import type coercion — fixed.** Independent model review caught soil water reading an underground rain cell and an array-valued preset being coerced to a string. Rain now uses the actual terrain-intersecting donor flux; constructor/import require a string. Regressions and scoped review pass.
3. **Diagnostic alignment and optional state validation — fixed.** Corrected section vectors, grid-centered GPU texture coordinates, snapped probe location/altitude labels, changing-altitude histories, timestamp-based charts, computed scales, map fit/pan/zoom, full fly-pose restoration, and allowlisted UI import validation. Invalid optional objects no longer enter operational state. Actual file roundtrip, rejection, map, probe, touch, and camera tests pass; `app-review.md` records review closure.
4. **FPS reporting — fixed.** Frame-rate smoothing initially clamped elapsed intervals, potentially hiding values below 10 FPS. FPS now uses actual elapsed intervals; bounded camera movement uses a separate duration. Later precomputed coarse cloud optical depth reduces repeated shader sampling. Both performance limits and sampled dimensions remain visible and truthful.
5. **Condensation label/behavior mismatch — fixed.** Threshold initially multiplied conversion speed. It now sets the RH onset threshold; the conversion speed is fixed, while evaporation tests actual saturation. Two new behavior regressions pass; the default model's serialized-state SHA remains identical before/after this correction.
6. **Browser automation wheel mismatch — tool workaround, retest passed.** `agent-browser mouse wheel` delivered to `(0,0)`, so the first zoom assertion failed even though orbit/pan worked. Captured the real wheel event target/coordinates, then used positioned Chromium input through the same browser. Zoom/pan/orbit and touch tests pass.
7. **Recorder-created browser tab — tool issue, exports retested.** `record start` created an additional isolated tab and restarted its page; the expected pause state therefore changed. Download commands from that recording tab were canceled (including PNG and CSV), while the original tab remained valid. Returned to original `t1`, closed extra `t2`, and repeated actual PNG/CSV downloads successfully. No application export bypass was used. `lightning-repro.webm` captures the isolated manual lightning demonstration; it is not presented as a continuous recording of earlier state.
8. **Ambiguous drawer locator — test corrected.** A broad “Experiment controls” locator matched the open control instead of closing the drawer, causing a covered-Map error. Clicking the actual close control resolved it; its accessible name is now “Close experiment controls.” Narrow-view and touch flows then passed.

Final source/syntax/dependency audit passes. `logs/delivery-browser-errors.txt` and `logs/delivery-browser-console.txt` are empty for the normal delivered app.

## Graphics failure handling

**PASS — controlled capability fault.** Loaded the actual artifact with `evidence/no-webgl.js` as a browser init script, making only `getContext('webgl2')` return null. The application paused, reported `ready:false`, and showed a clear WebGL2/hardware-acceleration explanation and Try again button. See `screenshots/missing-webgl.png` and `logs/no-webgl.json`.

**PASS — genuine shader compilation fault.** Loaded the actual artifact with `evidence/shader-fault.js`, which appends invalid GLSL before the real driver compiles it. The application displayed the compiler error and recovery guidance without an uncaught exception. See `screenshots/shader-error.png`, `logs/shader-error.json`, and `logs/shader-uncaught.txt`.

These were explicit test-environment fault injections; the delivered HTML is unmodified by those scripts and contains neither fault.

## Remaining limitations and untested coverage

- **Software graphics performance remains limited.** SwiftShader commonly measured roughly 8–21 FPS during these tests, with lower moments at high quality or while multiple recording tabs existed. Adaptive resolution and Performance quality kept input usable. The final optical-depth optimization measured about 11.7 FPS at a 387 × 165 buffer in one desktop sample. Hardware-GPU performance was **not run**; no 60-FPS claim is made.
- This is a coarse, educational model: first-order numerical diffusion, periodic horizontal boundaries, simplified pressure/buoyancy and microphysics, constant-density precipitation conversion, snow-like sedimentation without a separate ice phase, environmental source/relaxation terms, and protective clamps. It is not a validated forecasting model or an exact global water/energy-conservation solver.
- Thunder activation, scheduling, buffer creation, and playback state were tested; perceived sound quality, loudness, and device audio output were **not listened to**.
- No Safari/Firefox, physical touch device, or long-duration browser soak was run. Maximum grid stress was exercised numerically; exhaustive combinations of every maximum graphics/solver setting were not tested in the browser.
- Direct-file offline behavior is **passed**, not blocked. No required workflow remains blocked by a missing browser tool; the specific input limitations were covered through the same browser's real input protocol.

Final exact-artifact retest: `node evidence/ui-tests.cjs` and `python3 evidence/artifact-audit.py` passed; final 390 × 844 renderer was ready with 390 px document width and a precipitation-flux caption. Normal browser console/errors remained empty. Final desktop/mobile screenshots were saved and the test browser closed. No temporary server is running.
