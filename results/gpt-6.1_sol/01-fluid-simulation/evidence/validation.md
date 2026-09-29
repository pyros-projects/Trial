# Fluid study validation

Date: 2026-09-29. Artifact: `../index.html`. Browser tool: installed `agent-browser`; its version-matched core and exploratory-testing guides were read before use. Design and plan are retained in this directory.

Final status: **PASS for all requested checks exercised below. No unresolved application failures or blocked requested checks.** The delivered file is self-contained. This is agent-authored evidence from real executions, not an evaluator score or report.

## Initial environment

- Empty application directory, no existing implementation or Git repository.
- Standalone HTML delivery, zero runtime network dependencies.
- Browser, numerical checks and inspection remain development tools only.

## Runs and findings

### Numerical engine, first cycle — PASS

Command: `node --test evidence/solver-tests.cjs`. Before implementation it failed with `FluidCPU numerical engine is not implemented`. After implementation all seven checks passed: projection reduced divergence by more than 20%, dye-only clear preserved every velocity value, dye advection moved the centroid approximately two cells, viscosity reduced high-frequency energy, confinement changed velocity, and 100 extreme boundary steps stayed finite. Full passing output: `logs/solver-tests.txt`.

### Direct-file/offline startup — PASS

Installed browser CLI: agent-browser 0.31.1. Commands:

```sh
agent-browser --session fluid-study open file:///home/pyro/projects/naked/sol61/01-fluid-simulation/index.html
agent-browser --session fluid-study set viewport 1280 800
agent-browser --session fluid-study network route 'http://**' --abort
agent-browser --session fluid-study network route 'https://**' --abort
agent-browser --session fluid-study set offline on
agent-browser --session fluid-study reload
agent-browser --session fluid-study wait --fn 'window.fluidLab && window.fluidLab.state.ready'
agent-browser --session fluid-study snapshot -i
agent-browser --session fluid-study screenshot evidence/screenshots/desktop-first.png
agent-browser --session fluid-study errors
agent-browser --session fluid-study console
agent-browser --session fluid-study network requests
```

Observed: WebGL2 backend, 281×192 momentum grid and 562×384 dye grid, finite fields, GL error 0. Console and uncaught-error logs empty. Request log contained only the delivered local HTML. Screenshot inspected: `screenshots/desktop-first.png`. This was a direct `file:` load, not a substituted HTTP check.

### ISSUE-001: dilute startup dye — fixed, retest PASS

Static visual issue: initial colored ribbons were faint against the dark canvas. Reproduced with Reset followed by Pause and readback; actual mean RGB dye mass was 0.01872, below the agent-authored 0.07 demonstration-visibility check. Screenshot: `screenshots/seed-before.png`; readback: `logs/seed-before.txt`.

Cause: seed dose 0.24 and radius 0.021 placed too little dye before advection. Changed only seed dose/radius to 0.95/0.029. Reload, Pause and identical readback check passed: dye mass 0.14400, all fields finite, GL error 0. Screenshot visually inspected: `screenshots/seed-after.png`. This is an agent-authored quality check, not an evaluator threshold.

### Performance investigation

The browser uses ANGLE/SwiftShader software rendering (`logs/initial-gpu-state.txt`). Default animation initially showed 18–33 FPS. The frame loop split normal 30–33 ms elapsed frames into two solver steps unnecessarily. Increased the maximum numerical substep from 25 ms to 40 ms; semi-Lagrangian advection remains bounded. Before/after measurements: `logs/performance-before.txt`, `logs/performance-after.txt`. Actual final performance and stability are recorded below; no hardware GPU performance is inferred.

The default weak-viscosity solve was then reduced from twelve to three Jacobi passes; larger coefficients keep twelve. `logs/performance-optimized.txt` measured 50 FPS with finite fields and GL error 0. Final shared-machine GPU runs varied: 15 FPS during reset/startup, 26 FPS in the final single-instance sample, and roughly 47–56 FPS in earlier interaction runs. The compact CPU fallback measured 57 FPS after warm-up (`logs/fallback-live-performance.txt`). These are software-renderer observations, not hardware GPU claims. Higher resolution, high DPI and other activity on the shared host affect performance.

## Successful real-browser workflows

The reusable harness calls the installed CLI directly. It navigates, obtains accessibility snapshots, focuses fresh labeled slider refs, uses actual key presses and mouse input, and takes screenshots. Its eval calls only inspect actual simulation state/field readback. Complete command arguments, stdout, stderr, timings and exit codes are in `logs/browser-commands.jsonl`.

```sh
python3 evidence/browser-validation.py core
python3 evidence/browser-validation.py modes
python3 evidence/browser-validation.py controls
python3 evidence/browser-validation.py materials
python3 evidence/browser-validation.py mobile
```

| Workflow | Status | Observed result / evidence |
|---|---|---|
| Slow and rapid pointer drags | PASS | Rightward slow drag produced positive x force; faster reverse stroke produced negative x and higher magnitude. Final measured forces: `[8.1082, 0]` vs `[-14.3659, -3.8351]`. `logs/browser-core.json`. |
| Continuous motion, transport and mixing | PASS | Colored strokes produced 200+ interpolated splats; no pointer/queue remained after release. Positive velocity energy persisted and dye centroid moved after 1.1 simulation seconds without dragging. Visually inspected colored mixing and small rolling curls in `screenshots/desktop-drag-mixing.png` and `screenshots/desktop-flow.png`. |
| Pause / resume | PASS | Paused actual field readback and step count were exactly stable across a wait and pointer drag. Resume advanced steps and transported the existing flow. Space and arrow-key interaction tested on the focused canvas. |
| Clear dye | PASS | Mean dye became exactly zero; paused velocity energy and maximum speed stayed exactly unchanged. The resumed flow persisted. Also verified on the CPU backend. `screenshots/clear-dye-paused.png`. |
| Reset | PASS | Restored default speed, pressure iterations, force, radius, resolution, color, modes and disabled optional jets/color cycling. New seeded fields were finite and visible. |
| Live visualization switching | PASS | All five views switched while step counts continued to rise: dye, velocity direction/speed, pressure, signed curl and residual divergence. Actual field readback remained finite. Keyboard 1–5 switched paused views without altering fields. `screenshots/mode-*.png`; `logs/browser-modes.json`. |
| Viscosity behavior | PASS | At comparable ~1.8 s simulation intervals with no explicit velocity decay, high viscosity lowered energy from 203.12 to 97.55 and mean curl from 0.773 to 0.225. Rendered broad, smoother currents were inspected in `screenshots/viscosity-home.png` and `screenshots/viscosity-end.png`. |
| Vorticity behavior | PASS | High vorticity changed energy from 164.74 to 218.11 and mean absolute curl from 0.597 to 0.791. More persistent small curls were visible. `screenshots/vorticity-home.png`, `screenshots/vorticity-end.png`; `logs/browser-materials.json`. |
| Required sliders | PASS | Focused each labeled slider through its current accessibility ref and pressed Home/End. All actual parameters changed; combined minimum and maximum settings were stepped and stayed finite. Covers speed, viscosity, vorticity, both dissipation controls, pressure iterations, force and radius. |
| Resolution | PASS | Actual momentum dimensions changed through 128, 256, 384 and 192. Existing dye stayed positive; normalized dye centroid moved by less than 0.005 during resampling. `logs/browser-controls.json`. |
| Color controls and optional jets | PASS | Cyan, Apricot and Lilac swatches changed subsequent strokes; colored mixing inspected. Cycling and continuous jets toggled through real controls. Clearing dye turned off enabled jets and dye stayed zero after resume. Native custom-color picker is embedded; selecting a custom value through OS picker UI was not-run. |
| Help and navigation | PASS | Opened the modal, inspected live diagnostics and keyboard guide, closed with Escape. Five view buttons and keyboard shortcuts tested; there are no external navigation routes. `screenshots/help-dialog.png`. |
| 390 × 844 | PASS | No horizontal overflow; touch surface height 675 px. Controls move below the canvas and are reachable by scrolling. Pointer drag, mode change and labeled keyboard slider tested. `screenshots/mobile-top.png`, `screenshots/mobile-controls.png`, `screenshots/mobile-velocity.png`. |
| Resize continuity | PASS | Resized the paused grid to portrait; dye remained nonzero and normalized centroid changed less than 0.01. Returned to desktop with finite fields. |
| High DPI | PASS | At device scale factor 2, a 904 × 617 CSS canvas used an 1808 × 1234 pixel backing surface. `screenshots/desktop-high-dpi.png`; `logs/browser-mobile.json`. |

Totals from the reusable harness: **48 passing assertions** (12 core, 10 modes, 19 controls, 2 material comparisons, 5 mobile). These are agent-authored assertions against actual application behavior; they are not evaluator-owned checks.

## Genuine touch and rapid input — PASS

The CLI has no Chrome touch-dispatch command. The installed agent-browser still created and managed the browser; a small development-only adapter connected to its reported CDP socket to send genuine `Input.dispatchTouchEvent`/`Input.dispatchMouseEvent` commands. This did not synthesize DOM events or manufacture solver state.

```sh
node evidence/cdp-input-check.cjs
```

Observed: 20 touch movements at 16 ms spacing produced 53 splats and `lastPointerType: touch`; two simultaneous touches registered two independent pointers; a real `touchCancel` released both. A separate 38-point mouse stroke at 10 ms spacing, followed by release outside the canvas, produced 145 cumulative splats, no active pointers or queued segments, finite fields and GL error 0. Actual rendered screenshots inspected: `screenshots/mobile-real-touch.png`, `screenshots/rapid-capture-flow.png`. Protocol commands and readback: `logs/cdp-input-commands.json`, `logs/cdp-input-results.json`.

The first touch test was aimed at the control panel because finding Reset on mobile had scrolled the page down. It changed the native viscosity slider instead of reaching the canvas. This was a harness targeting failure; corrected by scrolling to the canvas before input. The complete genuine-touch retest passed. No application change was needed for that failure.

## Local PNG export — PASS

```sh
agent-browser --session fluid-study download '#capture' evidence/fluid-study-capture.png
```

Observed a real browser download from the Save image button. PNG signature and dimensions validated: 904 × 617, 579,370 bytes. Opened and visually inspected the downloaded image: it contains the fluid canvas, with no panel/toolbar. Artifact: `fluid-study-capture.png`. No upload, external service or runtime dependency is involved.

## Capability and recovery checks

### GPU unavailable — PASS, one issue fixed

```sh
agent-browser --session fluid-fallback --args '--disable-webgl,--disable-webgl2' open file:///home/pyro/projects/naked/sol61/01-fluid-simulation/index.html
agent-browser --session fluid-fallback set viewport 1280 800
agent-browser --session fluid-fallback set offline on
agent-browser --session fluid-fallback reload
```

The actual browser returned no WebGL context and the Canvas CPU solver started with a fallback notice and a truthful renderer label. Real pointer drags, pressure view, pause, clear dye and reset worked. Fields stayed finite, no console/errors or external requests were observed. `screenshots/fallback-final.png`, `screenshots/fallback-pressure.png`.

**ISSUE-004, fixed:** originally every fallback resolution option was capped at 96, so changing the selector had no effect. Recorded a failing before/after dimensions assertion (`logs/fallback-initial.txt`, `logs/fallback-resolution-before-fix.txt`). Changed fallback resolution to one-third of the selected GPU resolution, capped at 96. Real selection retest confirmed short-side dimensions 43, 64 and 96 for Fast/Balanced/Ultra, with preserved dye, velocity and finite state (`logs/fallback-default.txt`, `logs/fallback-low.txt`, `logs/fallback-high.txt`). Fine maps to 85. CPU clear-dye readback preserved velocity energy exactly (`logs/fallback-drag.txt`, `logs/fallback-clear.txt`).

### Graphics-context loss — PASS

Used the browser's real `WEBGL_lose_context` extension, not a fabricated DOM error:

```sh
agent-browser --session fluid-study eval 'document.getElementById("fluid").getContext("webgl2").getExtension("WEBGL_lose_context").loseContext()'
agent-browser --session fluid-study wait --fn 'fluidLab.state.contextLost'
agent-browser --session fluid-study screenshot evidence/screenshots/context-lost.png
agent-browser --session fluid-study find role button click --name 'Restart simulation' --exact
agent-browser --session fluid-study wait --fn 'fluidLab.state.ready && !fluidLab.state.contextLost'
```

Observed an actionable recovery overlay, paused state, unavailable diagnostics and disabled invalid actions. Restart reloaded the local file, restored a live seeded GPU simulation and finite fields with GL error 0. `logs/context-lost.txt`, `logs/context-restored.txt`, `screenshots/context-restored.png`.

## Read-only code review and repairs

A separate reviewer read the complete artifact, requirements and evidence, and ran the numerical suite. It found no critical/important code defect. Two display findings were verified and fixed:

- **ISSUE-002, paused pressure resize:** CPU reviewer reproduction showed pressure peak 38.34 → 0 on resize. Both backends now resample the cached pressure field. Actual GPU paused resolution switch retained pressure peak 55.54 → 54.32 and RMS 9.205 → 9.165, with no simulation step needed. `logs/pressure-before-resize.txt`, `logs/pressure-after-resize.txt`.
- **ISSUE-003, empty dye message on diagnostics:** reproduced Clear dye → Velocity and captured the incorrect overlay (`screenshots/clear-message-before.png`, `logs/clear-message-before.txt`). Mode changes now use a cleared-dye flag to restrict this message to Dye; identical retest hid it while leaving flow visible (`screenshots/clear-message-after.png`, `logs/clear-message-after.txt`).

The reviewer also examined paused explicit actions, CPU grid limits, reload-based context recovery, velocity component scaling during resampling, bounded stroke queues, and pointer cancellation. These matched the intended behavior. No findings remain deferred.

## Local HTTP with outside internet blocked — PASS

Temporary development server:

```sh
python3 -m http.server 8765 --bind 127.0.0.1
agent-browser --session fluid-http --args '--proxy-server=http://127.0.0.1:9,--proxy-bypass-list=<-loopback>;127.0.0.1;localhost' open http://127.0.0.1:8765/index.html
agent-browser --session fluid-http set viewport 1280 800
agent-browser --session fluid-http network route 'https://**' --abort
agent-browser --session fluid-http reload
```

A fresh browser session routed outside traffic to an unavailable proxy while loopback remained reachable; HTTPS interception provided an additional block. The temporary broad HTTP interception was removed before the successful local reload. No cached external runtime resources existed in this session. Actual state and resources: `logs/http-local-state.txt`; application request log contained only local HTML loads (`logs/http-local-requests.txt`).

An explicitly injected validation-only `fetch` to `https://example.com/fluid-validation-egress-probe` rejected as expected, returning `{blocked:true}` (`logs/http-egress-probe.txt`, `logs/http-probe-requests.txt`). That failed request is from the test probe, not the application. After clearing that expected probe log, real mouse drags, live Velocity, Pause and Clear dye were exercised through the CLI with exact velocity preservation. `logs/http-workflow.json`, `screenshots/http-local-velocity.png`. Final HTTP console and uncaught errors were empty.

## Harness/tool corrections

- agent-browser 0.31.1 rejects decimal mouse coordinates with a misleading missing-arguments error, including in batch. Rounded physical input coordinates to integral pixels, then repeated the full core flow successfully. No solver or test expectations changed.
- Semantic `find … focus` was unsupported despite appearing in CLI help. `agent-browser doctor --offline --quick` reported no installation failures. Changed slider focus to fresh accessibility snapshot refs followed by native key presses.
- An optional jets checkbox was initially below the panel's scroll viewport. Scrolled it into view before clicking, as a user would. Real toggle and clear-dye behavior passed.
- The first HTTP reload correctly restored running defaults; a subsequent harness lookup for Resume therefore failed. Corrected the lookup to current state before exercising the complete HTTP interaction. No app change was required.

All intermediate failures are retained in the original logs. Passing final result files reflect successful retests, not changes to expected behavior.

## Final regression and artifact audit — PASS

After the repairs:

```sh
python3 evidence/browser-validation.py core
python3 evidence/browser-validation.py modes
python3 evidence/browser-validation.py mobile
node --test evidence/solver-tests.cjs
agent-browser --session fluid-study console
agent-browser --session fluid-study errors
agent-browser --session fluid-study network requests
```

Fresh core/modes/mobile runs passed; numerical suite 7/7 passed. Complete logs: `logs/final-core-regression.txt`, `logs/final-modes-regression.txt`, `logs/final-mobile-regression.txt`, `logs/solver-tests-final.txt`. Final file, fallback and HTTP console/error logs are empty. Local file requests: `logs/final-file-requests.txt`; direct-file compatibility remained exercised with offline mode enabled.

Parsed all embedded scripts and ran `node --check` successfully for both. HTML asset-attribute audit found only fragment or data URLs; no external asset references, CSS imports, script imports, fetch, XMLHttpRequest or WebSocket APIs occur in the artifact. Final size: 65,874 bytes. Current fields remained finite with GL error 0 (`logs/final-single-instance-performance.txt`). Final inspected desktop evidence: `screenshots/final-desktop.png`, `screenshots/final-pressure.png`.

## Limits and checks not run

- Browser engine: Chrome 143.0.7499.40 on Linux / ANGLE SwiftShader. Firefox, Safari and physical mobile hardware: **not-run**. Touch was genuine Chrome protocol input with emulation.
- Native OS custom-color picker selection: **not-run**; embedded picker is present, while preset color controls and multi-color strokes were exercised.
- This is an approximate stable-fluids demonstration. Finite pressure iterations and semi-Lagrangian advection introduce residual divergence/numerical diffusion. Higher quality settings require more resources. CPU fallback intentionally uses smaller grids.
- Long-duration soak testing beyond the recorded interactions and 100 numerical extreme steps: **not-run**.
- Import/persistent settings/audio are not application features or requested requirements. No runtime state is saved between reloads; resetting/reloading starts a fresh flow.
- No requested check is blocked. No unresolved application failures were observed in tested workflows. Development browser sessions and the temporary server were closed after evidence collection.
