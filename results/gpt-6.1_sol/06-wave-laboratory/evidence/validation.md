# Wave Lab validation

Agent-authored record, 2026-09-29. This records implementation checks and observed application behavior; it is not an evaluator report.

## Delivered artifact and environment

The application is [../index.html](../index.html), a single 95,544-byte file. Its HTML, CSS, JavaScript, scalar finite-difference solver, plots and SVG assets are embedded. It requires no installation, build, server, external library or network service. Final SHA-256: `5279f41f441d2f6a425e34f364c3652e7e5dc8b408db6be285ab08eb7c73337e`.

Browser automation used the installed `agent-browser` **0.31.1**. Before use, I read `.agents/skills/agent-browser/SKILL.md`, then its version-matched `skills get core`, `skills get core --full`, and exploratory `skills get dogfood` workflows, including the issue taxonomy. Primary browser: Chrome **143.0.7499.40**. A second agent-browser session used installed Chrome **152.0.7977.54** to complete downloads after reproducing an environment-specific cancellation in Chrome 143.

All application navigation was to `file:///home/pyro/projects/naked/sol61/06-wave-laboratory/index.html`. Offline mode was enabled during validation. The initial session also aborted external HTTP/HTTPS routes; the second session used a fresh browser profile and offline mode. No local server was necessary. The final fresh request log contains only the successful local HTML document, with no external asset request, failed request, console message or uncaught error. See [offline-file-final.json](logs/offline-file-final.json) and [artifact-audit.txt](logs/artifact-audit.txt).

## Commands and reproduction

Commands below ran from `/home/pyro/projects/naked/sol61/06-wave-laboratory`. Browser script helpers append exact CLI commands and their results to [browser-transcript.txt](logs/browser-transcript.txt). Scripts are development evidence, not runtime dependencies. Diagnostic evaluation reads actual field buffers or live application state; it does not inject a field, fake interactions, or change expected results.

```bash
agent-browser --version
agent-browser skills get core
agent-browser skills get core --full
agent-browser skills get dogfood
agent-browser --session wave-lab set offline on
agent-browser --session wave-lab set viewport 1280 800 1
agent-browser --session wave-lab open file:///home/pyro/projects/naked/sol61/06-wave-laboratory/index.html

node evidence/tests/solver.test.cjs
python evidence/tests/browser_checks.py
python evidence/tests/phase_repro.py
python evidence/tests/phase_video.py
python evidence/tests/preset_checks.py
python evidence/tests/array_focus.py array-focus-green
python evidence/tests/review_regressions.py review-green
python evidence/tests/mobile_checks.py
python evidence/tests/keyboard_controls.py keyboard-green

agent-browser --session wave-export \
  --executable-path /home/pyro/.agent-browser/browsers/chrome-152.0.7977.54/chrome \
  --download-path /home/pyro/projects/naked/sol61/06-wave-laboratory/evidence/downloads \
  open file:///home/pyro/projects/naked/sol61/06-wave-laboratory/evidence/tests/download_fixture.html
agent-browser --session wave-export set offline on
python evidence/tests/source_scene_checks.py wave-export

python evidence/tests/physical_diagnostics.py
python evidence/tests/final_regression.py
node evidence/tests/artifact_audit.cjs
```

Native labeled buttons and selects, pointer movement/down/up, focus and keyboard keys performed the application workflows. Mobile testing used 390 × 844 CSS pixels at DPR 2. `mobile_checks.py` gets the same agent-browser session's CDP URL and invokes [touch_input.cjs](tests/touch_input.cjs), which sends trusted `Input.dispatchTouchEvent` events. This supplements the CLI's mouse commands with genuine browser touch input. It does not dispatch synthetic DOM events or modify application state.

## Observed checks

| Check | Status | Steps and observations |
|---|---|---|
| Standalone direct-file startup | **pass** | Opened the delivered HTML directly with offline mode enabled. Default interference initialized through numerical solver steps. Paused and advanced a real timestep. Final request log contains one `file://` document, status 200; errors and console are empty. |
| Numerical propagation and stability | **pass** | Nine tests execute the embedded solver: zero solution, finite wavefront, opposite-phase cancellation, full reflecting-wall transmission blocking, CFL clamp, delayed propagation in n = 2, shared continuous-source phase clock, clearing all field buffers, and line-source resolution consistency. [solver-final.txt](logs/solver-final.txt): 9 passed, 0 failed. |
| Two-source interference | **pass** | Default two 1.25 Hz point sources produced alternating positive/negative fronts, constructive bands and dark nodes. Two field probes measured 1.25 Hz, with different amplitudes and phases. [Default image](screenshots/desktop-default-paused.png), [live state](logs/default-interference.json). |
| Barrier editing and diffraction | **pass** | Drew two reflecting strokes at x = 5.3, leaving an opening around y = 4; 1,240 grid cells became fixed reflectors. Ran 7 simulated seconds: reflected fronts and spreading fronts through the opening changed the field. P1 amplitude changed from 0.1103 to 0.07635, while P2 phase changed from −73.9° to 9.0°. Moved the upper barrier to x ≈ 6.1 and propagated again. [Diffraction](screenshots/barrier-diffraction.png), [moved barrier](screenshots/barrier-moved.png). |
| Refractive region and drawn lens | **pass** | Painted an n = 1.6 region, then dragged a lens. Medium cells increased from 6,624 to 8,647. After 8 simulated seconds, wavelength and fronts changed within and beyond the medium. [Rendered field](screenshots/painted-medium-and-lens.png). The dedicated lens preset concentrated mean u²: near (8,4), 0.16353 versus 0.004033 off-axis, about 40.6×. This is a spatial concentration measurement, not a claimed transmission efficiency. [Measured profile](logs/lens-intensity-profile.json). |
| Probes from actual field | **pass** | Placed P3 after drawing materials; over 100 samples, nonzero waveform and measured amplitude 0.06246 at 1.25 Hz. In a separately drawn multi-source scene, stepped to a sampled timestamp: last probe value and bilinear live field sample were both **0.020852057422625372** at t = **8.68474262166911**. [Waveforms](screenshots/probe-live-waveform.png), [exact consistency state](logs/probe-field-consistency.json). |
| Requested timestep, speed and fast medium | **pass** | Set requested Δt to 0.060 and speed to 4.0 through keyboard-driven range controls. Effective Δt became **0.007228202652129152**, CFL **0.92**, with a visible limited-timestep warning. A painted n = 0.65 region also triggered the guard. Ran the field afterward; values remained finite. [Indicator](screenshots/stability-clamped.png), [fast-medium state](logs/faster-medium-cfl.json). |
| Pause, single step, clear, reset | **pass** | Paused time/steps stayed fixed. One step advanced exactly one solver timestep and remained paused. Clear zeroed current field, histories and simulation time. Reset restored the current preset's geometry, defaults and emitting sources. Retested native Space on focused buttons and global Space/`.` on the canvas. |
| Diagnostics while running | **pass** | Switched amplitude, intensity, phase, gradient magnitude, propagation medium and energy flow while the solver advanced. Checked live mode, rendered field, legend and flow arrows. [Amplitude](screenshots/diagnostic-amplitude.png), [intensity](screenshots/diagnostic-intensity.png), [phase](screenshots/diagnostic-phase.png), [gradient](screenshots/diagnostic-gradient.png), [medium](screenshots/diagnostic-medium.png), [flow](screenshots/diagnostic-flow.png). |
| Sources, arrays and all drawing tools | **pass** | Native controls changed frequency, amplitude, phase, continuous/pulsed mode, duration, waveform and activation. Ran sine, triangle, square and chirp drives. Drew point, line, pulse, array, reflector, absorber, single/double slit, medium and lens; selected/moved objects; changed slit count. Steered array −60°/60° and focused it. Horizontal arrays now produce relative delays. [Custom scene](screenshots/custom-scene-all-tools.png), [steered beam](screenshots/array-steered-plus-60.png), [focused array](screenshots/array-focus-green-propagated.png). |
| All eight presets and navigation | **pass** | Opened Experiments; selected double slit, single slit, cavity, lens, refraction, array and pulse presets, plus the default two-source experiment. Inspected actual computed fields. Cavity intensity showed stationary nodes; pulse scattered through obstacles and could be fired again. Field Notes opened and closed with Escape. Preset screenshots are in `screenshots/preset-*.png`. |
| Absorption and periodic edges | **pass** | A full-height absorber reduced mean u² around (9,4) from **0.0019835** to **2.3057e−8**. After scrolling to and deleting the barrier, absorber cells became zero; clear/run restored mean u² to **0.0026082**. Periodic boundary transmitted energy to x = 11.5 within roughly 2 simulated seconds, before the direct wave could travel 10.5 m. [Physics log](logs/physical-diagnostics-final.txt), [absorber shadow](screenshots/absorber-shadow.png), [restored field](screenshots/absorber-removed.png), [periodic field](screenshots/periodic-wrap.png). |
| Resolution and pointer continuity | **pass** | Switched to 480 × 320: retained world geometry and materials, cleared field/history and kept CFL safe. Final regression ran a drawn line on 180 × 120 and 360 × 240, with maximum displacements 1.0619 and 1.0782. Held a reflecting stroke while leaving the canvas, released outside, then drew a separate stroke: two distinct structures, no stuck drag. Tested selected structure deletion and source/probe keyboard deletion. [Final regression](logs/final-regression.txt), [outside release](screenshots/final-pointer-outside-release.png). |
| Mobile and high DPI | **pass** | At 390 × 844 and DPR 2, trusted touch drew a continuous wall (1,031 cells), erased an opening (956 cells remained), dragged a source, placed a source/probe and dragged a lens. Probe waveform responded after running. Tested pause, step, clear/reset, mobile tool chooser, experiment library and notes. No horizontal page overflow. Resizing preserved paused field/time exactly. [Touch wall](screenshots/mobile-touch-wall.png), [touch erasure](screenshots/mobile-touch-erase.png), [live probe](screenshots/mobile-probe-live.png), [final mobile](screenshots/mobile-final-verified.png). |
| Save, imports, exports, error states | **pass in Chrome 152** | Saved a fully drawn scene; downloaded actual [JSON](exported-scene.json) and [PNG](exported-field.png), the latter 728 × 379. Invalid JSON and frequency-zero scenes showed errors and preserved the existing paused scene. Valid import restored geometry/material counts; reload plus Restore saved scene restored local storage. [Results](logs/source-scene-final.txt), [error](screenshots/error-invalid-scene.png), [restored scene](screenshots/saved-scene-restored.png). Chrome 143 download coverage remains **blocked**, as described below. |

## Failures, diagnosis, fixes and retests

Earlier failure evidence is intentionally preserved. Files bearing `red`, `failure`, or `before-fix` names can show obsolete implementations. Some generic screenshot/state names were reused on retests; use the specific red/green logs below to distinguish outcomes.

1. **Continuous source phase depended on placement time — fixed.** Coincident 0°/180° sources placed at different simulated times kept driving a field, max amplitude 0.7365. Using global simulation time for continuous oscillators restored relative phase control. Browser retest fell to 0.01966 after the preexisting packet decayed; core tests starting from zero demonstrate cancellation below the energy threshold. The original video is [phase-clock-repro.webm](phase-clock-repro.webm); exact red/green measurements are in the transcript. Chirp cycle phase continuity was corrected at the same time.
2. **Array focus delay sign — fixed.** At a 9 m target, propagation-adjusted phasor coherence was 0.30625; reversing the delay sign gave **1.0**. Retested actual propagation. [Red log](logs/array-focus-red.txt), [green image](screenshots/array-focus-green-propagated.png).
3. **Three review findings — fixed.** Changing an array to pulsed mode restarted only the selected element; horizontal arrays ignored steering; replaying a wall then erasure cleared live displacement in the opening during unrelated edits. Synchronized group start clocks, computed phases relative to the drawn array's tangent/normal, and cleared only final reflecting cells. Reproduced all three through native controls/pointers, then passed all three regressions. The erased-opening sample had changed from 0.0201054 to zero; it now remains unchanged. [Red](logs/review-native-red.txt), [green](logs/review-green.txt).
4. **Space over a focused button — fixed.** The global pause handler intercepted native button activation. Restricted that shortcut when a button is focused and ignored key repeats. Focused Single step now advances one step and stays paused; canvas Space still toggles pause. [Red](logs/keyboard-red.txt), [green](logs/keyboard-green.txt).
5. **Line-source forcing doubled with resolution — fixed.** The new behavioral test observed a 1.99346 amplitude ratio between 360 and 180 grids. Normalized line forcing per physical length rather than grid-node count. All nine solver checks and an actual browser run on both grids pass. [Red](logs/line-resolution-red.txt), [final solver results](logs/solver-final.txt), [browser retest](logs/final-regression.txt).
6. **Absorber-removal test clicked a clipped control — test procedure corrected.** The first run failed because the CLI reported a click on a button below the scrollable sidebar viewport; the absorber remained present. Inspector bounds and hit testing reproduced the missed interaction. Scrolling the real sidebar before clicking Delete removes the structure and restores transmission. No application or benchmark expectation was changed. [Initial failure](logs/physical-diagnostics.txt), [successful retest](logs/physical-diagnostics-final.txt).
7. **Chrome 143 downloads canceled — environment coverage blocked; Chrome 152 passed.** Download diagnostics show the JSON Blob's full 6,021 bytes arriving, followed by browser cancellation. A standalone 11-byte data-link fixture also failed in that browser, including with offline disabled. The same fixture and the actual app JSON/PNG downloads passed in installed Chrome 152 via agent-browser. No app download workaround was added. [Download events](logs/download-events.txt), [fixture](tests/download_fixture.html), [successful application results](logs/source-scene-final.txt).

Native select/checkbox listeners were also corrected to use their change events, and the mode footer now updates immediately. These controls passed source/global-control and final regression flows.

## Final state and remaining limits

Final inline syntax and dependency audit pass. Nine solver checks pass. Main desktop workflow, touch workflow, source/scene workflow, review regressions, keyboard checks, additional physical diagnostics and compact final regression pass. [Final desktop screenshot](screenshots/desktop-final-verified.png). No unresolved application failure was observed in these checks.

Remaining coverage: Chrome 143 downloads are **blocked** by the observed browser environment; equivalent application checks pass in Chrome 152. Physical phone/Safari testing, long-duration soak testing, and sustained performance benchmarking on the 480 × 320 grid are **not run**. Reported desktop FPS around 58–60 is an observation from this environment, not a performance guarantee.

Numerical limits: this is a scalar, grid-based wave model. The absorbing sponge can leave residual reflection; finite differences have dispersion when wavelengths approach the grid spacing. Phase visualization uses displacement/velocity quadrature at a reference source frequency. Probe frequency/phase are estimates over recent history and a 0.2–5 Hz scan; mixed-frequency or weak transient signals need time to settle. These limits and the CFL/under-resolution warnings are explained in Field Notes. Saved scenes retain geometry/settings and restart the field, rather than storing the complete numerical state. No audio feature is present or required, so audio playback testing is not applicable.
