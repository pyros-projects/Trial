# Terra validation record (agent-authored)

Artifact: `../index.html`. Date: 2026-09-07. Browser: installed `agent-browser 0.31.1`, actual Chromium via CDP. Read `/home/pyro/.agents/skills/agent-browser/SKILL.md`, `agent-browser skills get core`, its full reference, and `agent-browser skills get dogfood` before automation. No browser-tool substitution.

## Kernel tests

Command: `node evidence/tests/kernel.cjs` extracts and executes the real embedded kernel. The initial red run failed because no implementation existed (`logs/kernel-red.txt`). The implemented kernel passed all eight tests (`logs/kernel-green.txt`): deterministic generation, downhill water flow and conservation, sediment advection and solid conservation, actual height erosion, erosion-rate comparison, evaporation, dry deposition, and 1,000 stress steps with finite nonnegative state and no repairs.

## Direct-file browser session

Commands:
```
agent-browser --session terra --allow-file-access --args '--disable-background-networking' open file:///home/pyro/projects/naked/astra/bench/02-hydraulic-erosion/index.html
agent-browser --session terra set viewport 1280 800
agent-browser --session terra set offline on
agent-browser --session terra snapshot -i
agent-browser --session terra errors
agent-browser --session terra console
agent-browser --session terra eval 'window.terra.diagnostics()'
agent-browser --session terra screenshot evidence/screenshots/01-first-load.png
```

### Issue 001 — shader-link error (FAIL initially)

Observed on first load: the fallback error panel appeared and simulation was paused at 0 with renderCount 0. Console reported `Precisions of uniform 'uMaterial' differ between VERTEX and FRAGMENT shaders.` Screenshot: `screenshots/01-first-load.png`. Root cause: GLSL integer default precision differs between shader stages. Fix: explicitly declare the same integer precision in both shaders. Retest passed below.

Issue 001 retest: after explicit `precision highp int` in both stages, direct-file reload rendered terrain and advanced to 2.72 s / 136 steps. Console was empty. `absoluteChange=5393.94 m³`, `eroded=4463.54 m³`, sediment 3632.73 m³. PASS.

### Issue 002 — desktop grid has an extra layout child (FAIL initially)

Observed in `screenshots/02-desktop-running.png` and reproduced in `03-desktop-size.png`: sidebar appeared below a half-height viewport, leaving the right column empty. `getBoundingClientRect()` reported canvas 966×348 inside a 1280×696 workspace. Root cause: the mobile backdrop div was a visible third CSS-grid item on desktop. Fix: hide the backdrop by default; show it only for an open mobile drawer. Retest passed below.

Issue 002 retest: `screenshots/04-desktop-layout-fixed.png` shows the sidebar in the right column and a 966×696 canvas at 1280×800. PASS.

## First sustained run and interaction findings

Commands included `wait --fn 'window.terra.diagnostics().time > 60'`, labeled Pause, mode selection, and `python3 evidence/tests/browser-actions.py`. At 61.12 simulated seconds geometry had changed by 376,833 m³, suspended sediment reached 60,116 m³, and water was 20,615 m³; no numerical repairs occurred. Screenshots `05-evolved-shaded.png` and `06-erosion-delta.png` show actual carved geometry. The very high sediment/water ratio and fast deep incision motivated tuning the carrying-capacity curve; this is a default-quality improvement, not a pass claimed from a screenshot.

Pointer strokes through `agent-browser mouse move/down/up` successfully added water, raised and lowered terrain, added sediment, dried water, and orbited without modifying paused terrain. Raw commands and before/after values are in `logs/browser-actions.txt`. The script stopped on its wheel assertion.

### Automation issue — wheel coordinate loss

`agent-browser 0.31.1 mouse wheel -200` acknowledged success but a live capturing wheel listener showed `clientX=0, clientY=0`, target without an id, despite preceding `mouse move 550 440`. Thus the event hit the header. `agent-browser doctor --offline --quick`: seven passes, no failures. This is a tool-coordinate limitation. Supplemental native CDP `Input.dispatchMouseEvent` at explicit canvas coordinates will validate wheel behavior in the same real browser; agent-browser remains the primary automation tool.

## Extended validation completed before final review

- PASS: all eight tools using real pointer strokes; smooth reduced patch variance 55.108→12.191, flatten reduced range 12.006→4.226 m. Right-drag orbit and Shift-drag pan preserved edited terrain. `logs/interaction-results.json`, `logs/extended-results.json`.
- PASS: Space pauses/resumes, period single-steps; pause freezes time; step advances exactly 0.08 s. Reset restores original height and water and clears sediment/time. Seed 4242 regenerated 16,384 identical cells; invalid seed −1 was rejected. Seven mode selections preserved time and terrain. `tests/extended.py`.
- PASS: all five presets ran under genuine rainfall for >4 s with changing heights and zero repairs; live 64→192→256 resolution changes and speed/substep changes remained stable. `tests/parameters.py`, `logs/parameter-results.json`.
- PASS: exact JSON roundtrip, including all nine arrays, nonzero flow/erosion state, parameters, counters, camera, brush, mode and pause state. Invalid dimensions and negative water imports were atomic failures. `tests/export-retest.py`, `downloads/terra-4242-state.json`.
- PASS: actual downloaded 64×64 PNG decoded in Chromium, 245 distinct grays, opaque grayscale at every pixel, every pixel matched normalized saved terrain. `tests/png-check.py`, `logs/png-check.json`. Pillow was unavailable, so Chromium's actual Image decoder was used; no application dependency added.
- PASS: mobile drawer and all tabs at 390×844; narrow framing improved after visual inspection. Initial clicks immediately after viewport resize hit the transitioning drawer; waiting on its bounding rectangle resolved this automation timing problem. Final mobile screenshot: `21-mobile-retina.png`, actual 780×1688 output at DPR2.
- PASS: actual touch orbit, pinch zoom, and two-finger pan; touch water painting 5449.54→5781.29 m³, with no further change after release. Native CDP sent touch input to the same agent-browser session. `tests/touch.mjs`, `tests/touch-paint.mjs`.
- PASS: a continuous stroke changed all three sampled cells, radius responded to ] keys during the held stroke (8→12m), camera stayed fixed, and release outside the canvas stopped painting. `tests/continuity.py`, `logs/continuity.json`.
- PASS: deliberate WebGL context loss paused safely; restoration preserved the exact state and rendered again. `24-context-lost.png`, `25-context-restored.png`, `logs/context-recovery.json`.

Export automation notes: the browser's default headless download configuration did not put files in the requested directory; the installed `agent-browser download <selector> <path>` command correctly captured genuine button-triggered downloads. Comparing tool-parsed floating point objects introduced ~1e−15 conversion differences; comparing the application's own JSON strings established exact equality. Import tests were corrected to wait for the restoration message, not a condition already true before asynchronous file reading.

## Independent final review and additional regression work

A read-only reviewer, dispatched by the installed code-review skill, found no critical issues and identified the following fixes. These are agent-owned review findings, not an evaluator score.

### Issue 003 — quick clicks missed (FAIL reproduced)

`node evidence/tests/short-click.mjs` sent eight actual CDP mouse down/up pairs at the canvas before animation frames could process every pair. Six clicks made no water change (`logs/short-click-fail.json`). Cause: brush work existed only in animation frames, and release cleared the pending stroke. Fix applied (retests below): stamp on pointerdown and flush unpainted movement on release.

### Issue 004 — remaining finger stops after pinch (FAIL in handler reproduction)

Root cause: release unconditionally cleared the gesture even when one touch remained. Fix applied (retests below): maintain camera movement with the remaining touch and recompute two-finger baselines when appropriate.

### Issue 005 — accumulated orbit angle rejected by import (FAIL in independent reproduction)

Orbit yaw can exceed 100 radians, while the import validator rejected it. Fix applied (retests below): normalize rotations and accept finite periodic yaw in older files.

### Issue 006 — numerical recovery poisons secondary state (FAIL reproduced)

A deliberately injected NaN sediment cell propagated into delta and erosion counters before the old repair pass. `logs/kernel-recovery-red.txt` records the failing real-kernel test. Fix applied (retests below): sanitize non-finite input layers before transport, maintain coherent derived state, and preserve recovery diagnostics.

### Issue 007 — unsupported imported resolution (FAIL in independent reproduction)

The state validator accepted 32/48 despite the UI supporting 64/96/128/192/256; subsequent regeneration could read an empty select. Fix applied (retests below): restrict imports to the five supported resolutions.

Quantitative corrections applied: align slope colors to angles in degrees and integrate volumes over a consistent 200×200 m cell domain. Preserve water and sediment volumes when resampling.


## Final outcomes

All seven recorded application issues are fixed and retested. The reviewer rechecked the reported issues and found no remaining material issue. No evaluator score/report was generated.

| Check | Final outcome | Evidence |
| --- | --- | --- |
| Direct file, offline, embedded resources only | PASS | `logs/final-runtime.json`: file URL, empty resource list; `logs/final-requests.txt`; artifact audit |
| Desktop 1280×800 | PASS | `30-final-desktop-initial.png`, `31-final-desktop-evolved.png` |
| Mobile 390×844 and DPR2 | PASS | `34-final-mobile-evolved.png`, `35-final-mobile-terrain-controls.png`; drawing buffer 780×1506 for the 390×753 canvas |
| Genuine long-running geometry change | PASS | Final run statistics below; shaded, delta, and flow screenshots |
| Rain / flow / carrying capacity / erosion / advection / deposition / evaporation / thermal | PASS | Real-kernel tests, actual browser parameter comparisons and mass budgets |
| Continuous editing and camera separation | PASS | Pointer tests, bracket radius change during stroke, out-of-canvas release, right orbit, Shift pan |
| Short mouse clicks | PASS after fix | `short-click-pass.json`: 8/8 change the water state |
| Touch paint / orbit / pinch / remaining-finger continuation | PASS after fix | `touch-results.json`, `touch-paint.json`, `touch-continuation.json`; no accidental painting during a two-finger camera gesture with water tool selected |
| Pause, resume, step, reset, regenerate, deterministic seed | PASS | Browser scripts and `extended-results.json` |
| All seven modes, probe, lighting/exaggeration/overlays | PASS | Mode screenshots and display-preserves-state assertion |
| Five presets and hot resolution/speed/substep changes | PASS | Final `parameter-results.json`; 256² stress settings remain finite |
| JSON export/import, invalid input, periodic camera | PASS | Actual downloads, exact string-based roundtrip, `review-regressions.json` |
| Grayscale PNG | PASS | Chromium decoder, 4,096 matching pixels, `png-check.json` |
| Volume integration and resampling | PASS after fix | Uniform 1m water = 40,000m³ and 0.25m sediment = 10,000m³ at 64, 96, 128, 256 grids |
| Numerical recovery including diagnostics | PASS after fix | Ten kernel checks; browser injected one bad cell, recovered once, exported/imported exact recovered state |
| Graphics context loss/restoration | PASS | Exact simulation state preserved; context regained and geometry visible |
| Console / uncaught exceptions / failed external requests on final artifact | PASS | Final console and error logs empty; only the file document request |

The first continuation test used the wrong CDP touch-end convention: CDP lists the released contact, so the test subsequently moved a new contact rather than the remaining finger. `touch-debug.txt` records the actual pointer IDs. Correcting the input sequence made the real gesture pass; application expectations were unchanged.

### Final numerical evidence

The final default run advanced **131.92 simulated seconds**, **6,596 solver substeps**, with **0 numerical repairs**. Absolute terrain-volume change was **87,206.75m³**; water **22,611.18m³**; suspended sediment **3,783.40m³**. Cumulative erosion was **84,000.35m³** and deposition **17,259.19m³**. Maximum elevation changed from **89.607 to 87.882m**. This was rainfall-driven geometry evolution, with no brush edits during that run.

Accounting for rainfall, evaporation, and open-edge outflow, the final water-budget residual was **0.653m³**. Terrain plus suspended/exported sediment had a **1.444m³** residual, consistent with Float32 accumulation. The actual before/after values are in `final-default-before.json`, `final-default-after.json`, and `final-budget-check.json`.

Final browser parameter retest, same seed and eight simulated seconds: erosion 0 produced **0m³** erosion; erosion 2 produced **4466.44m³**. In an isolated evaporation comparison, initial water **1065.63m³** stayed unchanged at evaporation 0 and fell to **19.52m³** at evaporation 0.5/s.

### Commands and reproducibility

The precise browser commands, coordinates, selectors, key presses, and observations are retained in `logs/browser-actions.txt`; the helper logs every agent-browser invocation. The test scripts are development-only companions, not runtime dependencies. Scripts that depend on the current browser state document their setup sequence or were run from the states described above.

Main commands used:
```
node evidence/tests/kernel.cjs
python3 evidence/tests/browser-actions.py
python3 evidence/tests/extended.py
python3 evidence/tests/export-retest.py
python3 evidence/tests/png-check.py
python3 evidence/tests/parameters.py
python3 evidence/tests/continuity.py
node evidence/tests/short-click.mjs
node evidence/tests/touch.mjs
node evidence/tests/touch-paint.mjs
node evidence/tests/touch-continuation.mjs
python3 evidence/tests/review-regressions.py
```

Final sustained workflow:
```
agent-browser --session terra set offline on
agent-browser --session terra reload
agent-browser --session terra find role button click --name 'Pause simulation'
agent-browser --session terra find role button click --name 'Reset simulation'
agent-browser --session terra find role button click --name 'Resume simulation'
agent-browser --session terra wait --fn 'sim.t > 30'
agent-browser --session terra wait --fn 'sim.t > 60'
agent-browser --session terra find role button click --name 'Pause simulation'
agent-browser --session terra eval 'window.terra.diagnostics()'
agent-browser --session terra screenshot evidence/screenshots/31-final-desktop-evolved.png
agent-browser --session terra select '#view-mode' 4
agent-browser --session terra find role button click --name 'Top view'
agent-browser --session terra select '#view-mode' 6
```

The simulator continued running between observations, so the final recorded time was 131.92s rather than exactly 60s. Every screenshot and diagnostic comes from genuine application execution.

### Scope and limitations

- No unresolved functional failure or blocked required check remains in the tested Chromium environment.
- The renderer requires WebGL. Browser-reported renderer was ANGLE Vulkan SwiftShader (software), not a hardware GPU. Sustained default simulation ran roughly 18–35 FPS here; the 256²/high-speed setting sampled about 16 FPS. Work is bounded per frame, and simulated time can advance slower than the requested speed when compute-limited. A discrete-GPU performance claim was not tested.
- Firefox, Safari, and physical mobile hardware are NOT RUN. Touch was genuine browser touch input under Chromium device emulation, not a claim of testing a physical phone.
- Local HTTP is NOT RUN / unnecessary: opening the actual delivered file directly was tested successfully, offline. The application has no runtime server or network dependency.
- This is a simplified finite-volume erosion laboratory, not a calibrated geophysical prediction model. Boundaries are open, the grayscale PNG is normalized 8-bit elevation, and JSON carries full-precision typed-array state. Persistence is explicit JSON save/restore; there is no silent automatic session save.
- Audio is not part of this application and was not tested.

Final artifact audit: **86,341 bytes**, two embedded script blocks, zero external resource references, zero network API dependencies, no build step. SHA-256: `0aac2328d700462c4547d2c0fb28d121f2ee3b8d1007d7981eec51205c62c39e`.

Final closing verification: cache cleared, offline mode explicitly enabled, direct-file reload, labeled Pause and Single step, simulation advancement confirmed with zero repairs and no resource requests. Console/errors empty. Final kernel run: 10/10 pass. Artifact SHA-256 unchanged; all HTML IDs unique. See `logs/final-offline-smoke.json` and `logs/kernel-final.txt`.
