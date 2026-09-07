# Wave Lab validation

Agent-authored implementation and validation record, 7 September 2026. No evaluator-owned requirements, fixtures, expected results or reports were modified. No evaluator score is claimed.

Artifact: [index.html](../index.html), **91,347 bytes**, with all HTML, CSS, SVG, numerical code, plotting and controls embedded. Final default: **240 × 96 cells, 24 × 9.6 m**. Earlier development logs include a superseded 240 × 144 layout.

## Tools and exact reproduction

Used **agent-browser 0.31.1**, driving **Chromium 143**. Read the installed discovery skill and its version-matched core and exploratory-testing workflows before browser use:

```bash
cat .agents/skills/agent-browser/SKILL.md
agent-browser --version
agent-browser skills get core
agent-browser skills get core --full
agent-browser skills get dogfood
agent-browser doctor --offline --quick
```

Saved workflow copies: [core](logs/agent-browser-core.txt), [dogfood](logs/agent-browser-dogfood.txt), [issue taxonomy](logs/issue-taxonomy.txt), [doctor](logs/browser-doctor.txt).

Run from `/home/pyro/projects/naked/astra/bench/06-wave-laboratory`. Every browser helper action appends its exact CLI command and JSON response to [browser-validation.txt](logs/browser-validation.txt). The scripts preserve the labels, pointer coordinates, keystrokes, waits, screenshots and assertions. Evaluations read live diagnostics; they do not replace or advance application state.

```bash
node evidence/solver-tests.cjs
node evidence/probe-tests.cjs
python evidence/verify-artifact.py

# Initial browser setup. No HTTP server is needed.
agent-browser --session wave-lab set viewport 1280 800 1
agent-browser --session wave-lab set offline on
agent-browser --session wave-lab network route 'http://**' --abort
agent-browser --session wave-lab network route 'https://**' --abort
agent-browser --session wave-lab open file:///home/pyro/projects/naked/astra/bench/06-wave-laboratory/index.html

python evidence/browser-validation.py
python evidence/desktop-checks.py
python evidence/persistence-checks.py
python evidence/mobile-checks.py
python evidence/review-retest.py
python evidence/phenomena-checks.py
python evidence/harmonic-browser-check.py
WAVE_BROWSER_SESSION=wave-final python evidence/final-checks.py

# Complete final regression with its own fresh offline session and explicit navigation.
WAVE_BROWSER_SESSION=wave-release-final python evidence/final-audit.py
```

Individual feature scripts expect the application to be open. `final-audit.py` performs setup and reruns the reviewed fixes, mobile flow, final desktop controls, screenshots and browser health. Numerical tests extract the actual solver and spectral-analysis script bodies from the delivered HTML.

## Executed checks

| Status | Steps and observed result | Evidence |
|---|---|---|
| PASS | **Offline direct file.** Opened the delivered `file:` URL in fresh browser sessions with offline mode and HTTP/HTTPS abort routes. Interacted with the running simulation. No external resource requests occurred. Static inspection found no external assets, imports or network dependencies. All three inline scripts parse and DOM IDs are unique. | [Artifact audit](logs/artifact-check.txt), [final browser health](final-browser-health.json) |
| PASS | **Seven numerical behavior tests.** Remote propagation; linear superposition and opposite-phase cancellation; barrier transmission/shadow; slower-medium pulse delay; CFL clamp and finite state; clearing displacement/velocity/energy/time; a pulse shorter than the timestep still emits. | [Solver tests](solver-tests.cjs), [final output](logs/final-solver-tests.txt) |
| PASS | **Five probe-analysis tests.** Uneven timestamps: 1.4 Hz → 1.4000001. Dominant 1.25 Hz with another tone and DC offset → 1.2531. Slow 0.2 Hz → 0.1999998. Higher harmonic 12 Hz → 12.0000046. Silence returns no invented frequency. | [Probe tests](probe-tests.cjs), [final output](logs/final-probe-tests.txt) |
| PASS | **Interference and cancellation.** Default sources produce positive/negative lobes and nodal bands. Dragged Source 2 onto Source 1, cleared and ran; used the phase slider's End key for 180°, cleared and ran again. Actual RMS fell from 0.0560 to approximately 0.0005. The remaining field is consistent with the small pointer-placement offset. | [In phase](screenshots/cancellation-in-phase.png), [opposite phase](screenshots/cancellation-opposite-phase.png), [extended regression](logs/final-additional-green.txt) |
| PASS | **Barrier editing and diffraction.** Drew a continuous wall, ran seven simulated seconds, inspected the shadow and bent wavefronts, selected and dragged the wall to a new position, then erased part of it. Material occupancy and the actual propagated field changed. | [Exact main flow](browser-validation.py), [result](logs/final-main-workflow.txt), [wall response](screenshots/barrier-wave-change.png), [moved wall](screenshots/barrier-moved.png), [erased wall](screenshots/barrier-erased.png) |
| PASS | **Painted media and lens focusing.** Painted a refractive region and dragged out a lens; both immediately changed the solver's material grid. Ran and switched to Medium to inspect the raster. In the lens preset, moved a probe to x≈14.2 m on the axis, ran, removed the lens through the UI, cleared and ran again. Peak amplitude was 0.858 with the lens and 0.766 without it. Curved wavefronts were visible near the focus. | [Painted medium/lens](screenshots/painted-medium-and-lens.png), [focus](screenshots/lens-focus-measurement.png), [removed reference](screenshots/lens-removed-reference.png), [measurements](logs/phenomena-checks.txt) |
| PASS | **Refraction.** Inspected bent, more closely spaced transmitted wavefronts. Zero crossings sampled from the real centerline field gave median wavelengths along x of 2.284 m before the interface and 1.523 m in the slower region. Both probes measured about 1.253 Hz for the 1.25 Hz source. | [Field](screenshots/refraction-spatial-measurement.png), [measurements](logs/phenomena-checks.txt), [raw trace](refraction-trace.json) |
| PASS | **Live probes.** Placed and moved probes with pointer input. Plots, amplitudes and instantaneous values reflected their local field. An added probe behind edited structures accumulated 296 samples and measured about 1.36 Hz during transient settling. At Δt=.001, the final regression retained over 7,000 samples and measured approximately 1.40 Hz. Clear zeroed the field and probe history. | [Edited-field probes](screenshots/edited-field-probes.png), [tiny-step regression](screenshots/probe-history-fixed.png), [final audit](logs/final-audit.txt) |
| PASS | **Slow and harmonic probes.** Set both emitters to 0.2 Hz, cleared and ran 25 simulated seconds: probes read 0.1894 and 0.1916 Hz during finite-window/transient settling. Imported a legitimate 4 Hz soft-square/opposite-fundamental scene: a local field probe measured the dominant 12 Hz harmonic as 11.99965 Hz at peak amplitude 0.0009916. | [Slow probes](screenshots/slow-wave-probes.png), [harmonic probe](screenshots/harmonic-probe-12hz.png), [harmonic result](logs/harmonic-browser-retest.txt) |
| PASS | **Stability and invalid inputs.** Requested Δt=.12 and c=8 at 240 × 96: requested CFL≈13.58, effective Δt≈.008132, actual CFL≤.92 and finite field. Changing to 400 × 160 cleared the field and reapplied the cap. Invalid Δt=0 was marked `aria-invalid` while preserving the last valid value. Low speed/high frequency displays a cells-per-wavelength warning. | [CFL cap](screenshots/stability-limited.png), [invalid value](screenshots/invalid-timestep.png), [spatial warning](screenshots/wavelength-warning.png), [steps](desktop-checks.py) |
| PASS | **Primary and source controls.** Pointer movement and arrow-key nudging worked. Keyboard frequency edits persisted. Exercised point/line/pulse/array types, amplitude, phase, sine/soft-square/triangle, activation, pulse duration/trigger, line angle/length. Pause froze time; step advanced exactly one effective timestep; clear retained geometry and zeroed the field; reset restored the selected preset. | [Main result](logs/final-main-workflow.txt), [line source](screenshots/line-soft-square.png), [short pulse](screenshots/short-pulse-fixed.png), [final regression](logs/final-audit.txt) |
| PASS | **Additional tools and absorption.** Painted 349 absorbing cells, enlarged a slit (solid cells 275→235), dragged an obstacle, placed an eight-element array. Disabled both sources, set damping=1.5 and ran eight simulated seconds: RMS fell from 0.0416 to 0.0000159. Added eight probes; a ninth was rejected with a clear message, and removal worked. | [Tools](screenshots/extra-drawing-tools.png), [absorber](screenshots/absorber-painted.png), [probe limit](screenshots/probe-limit.png), [extended regression](logs/final-additional-green.txt) |
| PASS | **Eight presets, six diagnostics.** Selected and ran interference, double slit, single slit, cavity, lens, refraction, array and pulse/obstacles; all produced finite nonzero fields. Inspected rendered wavefronts. Switched amplitude, intensity, phase, gradient, medium and flow while running; simulated time continued. Tested absorbing/reflecting/periodic boundaries, resolution, substeps, exposure, persistence, brush radius and palettes. | [Desktop workflow](desktop-checks.py), `screenshots/preset-*.png`, `screenshots/diagnostic-*.png` |
| PASS | **Array steering.** Set steering to −60° and +60° with the range control, cleared and ran after each. Relative phases changed and 19 downstream samples from the actual field redistributed; inspected the rendered directions. Individual phase changes survive restore. | [−60°](screenshots/array-minus60.png), [+60°](screenshots/array-plus60.png), [saved phase](screenshots/array-phase-fixed.png), [state log](logs/browser-validation.txt) |
| PASS | **Persistence and import errors.** Actual JSON download/upload round-tripped an eight-source scene with a custom −175° phase. Restore restarts wave/history paused. Local save survived reload. Invalid JSON, unsupported resolution and missing lens geometry were rejected without scene mutation. Geometry editing worked with no sources. | [Exact persistence flow](persistence-checks.py), [export](exported-scene.json), [restored](screenshots/import-restored.png), [invalid geometry](screenshots/invalid-geometry.png) |
| PASS | **Desktop, narrow, touch and navigation.** Tested 1280 × 800 at DPR 1/2 and 390 × 844 at DPR 3, with no horizontal overflow. Narrow source placement/drag, probe placement, keyboard tuning, stability controls, gallery and clear/step/reset worked. Trusted touch painted 305 barrier cells without scrolling; erasing reduced 305→94. Resizing preserved time, field and geometry. Field notes, gallery, Escape dismissal, expanded view and Laboratory return worked. | [Desktop](screenshots/final-desktop-1280x800.png), [full desktop](screenshots/final-desktop-full.png), [narrow](screenshots/mobile-initial.png), [touch](screenshots/mobile-touch-barrier.png), [mobile probes](screenshots/mobile-probes.png), [final audit](logs/final-audit.txt) |
| PASS | **Browser health.** Checked console, uncaught errors, requests and meaningful live state after actual interactions. No application console messages or uncaught errors observed. No external application resource requests. Balanced desktop rendering was typically 56–60 FPS; narrow DPR-3 emulation approximately 50–60 FPS here. | [Final health](final-browser-health.json), [exact earlier checks](logs/browser-validation.txt) |

## Defects reproduced, fixed and retested

1. **Duplicate overlap:** copied properties overwrote the intended offset. Applied coordinates last. Browser retest places the duplicate at (.405,.415), distinct from (.35,.355). The original failure is in the command log. A historical screenshot overwritten during regression was renamed `duplicate-offset-earlier-regression.png` to describe its actual content.
2. **Restored array phase changed:** UI synchronization invoked steering, changing −175° to −106.956°. Separated display sync from phase mutation. Local restore and real export/import now preserve all eight phases. [Before](screenshots/array-phase-before-fix.png), [after](screenshots/array-phase-fixed.png).
3. **Too little history at Δt=.001:** a fixed sample count could not hold five simulated seconds. Retain by timestamps, approximately 16 seconds. Final live retest retains >7,000 samples with readings near 1.40 Hz. [Before](screenshots/probe-history-before-fix.png), [after](screenshots/probe-history-fixed.png).
4. **Short pulse vanished:** endpoint-only forcing sampled its zero envelope. Integrate forcing over each step with eight midpoint samples and partial-step overlap. The identical duration=.1, Δt=.12 case now produces fieldMax=0.360617 in one UI step. [Failing test](logs/short-pulse-red.txt), [passing test](logs/short-pulse-green.txt), [browser retest](screenshots/short-pulse-fixed.png).
5. **Slow/mixed probe estimates and harmonic aliasing:** replaced zero crossings with timestamp-aware windowed spectral analysis and longer slow-wave history. An intermediate 256-sample estimator aliased 12 Hz to 5.06666 Hz over 15 seconds. Final radix-2 FFT resampling preserves the original sample rate. [Alias failure](logs/harmonic-alias-red.txt), [corrected tests](logs/harmonic-alias-green.txt), [actual field retest](logs/harmonic-browser-retest.txt).
6. **Quiet valid signal suppressed:** a separate UI threshold hid a clear 0.0009916-amplitude harmonic. The spectral estimator now decides signal sufficiency; small amplitudes use scientific notation and the plot accommodates weaker signals. The unchanged scene reads 11.99965 Hz. [Suppressed](screenshots/harmonic-threshold-investigation.png), [corrected](screenshots/harmonic-probe-12hz.png), [initial failure](logs/harmonic-browser-check.txt).
7. **Inspector header covered a control:** sticky positioning obscured a scrolled activation checkbox. Removed sticky behavior and added control scroll margins. Repeated deactivation/decay and the extended regression successfully. [Interrupted flow](logs/final-additional-checks.txt), [passing flow](logs/final-additional-green.txt).

Failed flows were repeated after fixes, followed by regression. A read-only review also examined the solver, pulse integration, persistence and final frequency estimator.

## Tool/setup failures, distinguished from application defects

- Initial `network route '**' --abort` also intercepted the local document. Narrowed routes to HTTP/HTTPS and reopened successfully while offline. [Failed attempt](screenshots/desktop-initial.png).
- Installed 0.31.1 does not support `find label … select`; switched to supported `select` with inspected stable selectors. An initial syntax check included HTML script tags accidentally; final checks parse extracted JavaScript only.
- Clipped controls required explicit `scrollintoview` before CLI clicks/downloads. Export timed out until scrolled into the inspector. Restore data was correct but an offscreen click missed. Laboratory was partly clipped at scrollY=40; bringing it into view before clicking reached scrollY=0. [Export attempt](screenshots/export-timeout.png), [restore attempt](screenshots/local-restore-failure.png), [navigation retest](screenshots/navigation-at-top.png).
- The CLI has no general browser touch-drag command. For that gesture only, [touch-drag.cjs](touch-drag.cjs) attached to the **same browser** using the agent-browser CDP endpoint and sent real `Input.dispatchTouchEvent` start/move/end events. The app observed `pointerType:"touch"`, `isTrusted:true`. Other controls, navigation, screenshots and pointer input used agent-browser. This is supplemental browser input, not a fabricated DOM event.
- A later regression reloaded a session that had idled back to `about:blank`; explicit file navigation fixed setup. The first combined audit shared Python globals with its touch script, overwriting the artifact URL with the CDP URL and attempting a blocked navigation. Isolated the scripts with `runpy` and used `artifact_url`. [Idle-session failure](logs/final-review-regression.txt), [runner failure](logs/final-audit-setup-failure.txt). The failed CDP-address request was test navigation, not an application request.
- Device emulation reset the offline flag: an intermediate audit ended with `navigator.onLine=true`, although no external assets were requested. Its result is preserved in [offline-reset log](logs/final-audit-offline-reset.txt). Final scripts reapply offline mode after device/viewport changes and explicitly assert `navigator.onLine=false`. [Complete retest](logs/final-audit.txt).

## Remaining limits

**No unresolved application failures in the executed checks. Direct-file check: PASS; no coverage is blocked by missing browser tooling.** HTTP-server fallback was unnecessary. Firefox, Safari, physical mobile hardware and exhaustive long-duration/extreme-scene testing are **NOT RUN**. Narrow testing used Chromium emulation, including trusted browser touch input.

The finite grid has numerical dispersion; the CFL cap prevents unstable requests but cannot make under-resolved wavelengths accurate. Absorbing edges use a graded sponge with possible residual reflection. Field notes explain these limits.

Intensity is averaged displacement squared in arbitrary units. Phase is a local harmonic estimate, unreliable at nodes and for mixed frequencies. Probes show peak amplitude over five simulated seconds and a dominant frequency requiring several cycles, limited by sampling rate and a 40 Hz analysis ceiling. Waveform plots auto-scale vertically. Scene saves preserve configuration, not field/probe histories. No audio feature or listening claim is included.
