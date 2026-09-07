# Flux validation

Agent-authored evidence for `../index.html`. This is not an evaluator report.

## Delivery and environment

**PASS:** the application runs directly from `file:///home/pyro/projects/naked/astra/bench/01/index.html` in an offline browser. No server, build, library, font download, external asset, or service is needed. The delivered file contains the interface, SVG icons, shaders, solver, and controls.

Validation used installed **agent-browser 0.31.1**, **Google Chrome 143.0.7499.40**, and genuine WebGL2 floating-point fields. Read the installed `.agents/skills/agent-browser/SKILL.md`, `agent-browser skills get core`, `agent-browser skills get core --full`, and `agent-browser skills get dogfood` before browser testing. Dense mouse/touch sequences use CDP Input events through the same browser session; ordinary navigation, labeled controls, keyboard input, screenshots, and inspection use agent-browser. No application methods are invoked to fabricate successful interactions.

Tested viewports: **1280 × 800**, **390 × 844**, and **1280 × 800 with device pixel ratio 2**. Touch uses Chrome's two-finger touch emulation. Physical handheld devices, Safari, and Firefox were **not run**.

## Reproduction commands

Run from `/home/pyro/projects/naked/astra/bench/01`:

```bash
agent-browser --session flux open about:blank
agent-browser --session flux set viewport 1280 800 1
agent-browser --session flux set offline on
agent-browser --session flux open file:///home/pyro/projects/naked/astra/bench/01/index.html
agent-browser --session flux wait --fn 'window.fluidLab && window.fluidLab.ready'
agent-browser --session flux snapshot -i
bash evidence/tests/startup.sh
node evidence/tests/lifecycle.mjs
node evidence/tests/physics-controls.mjs
node evidence/tests/speed.mjs
node evidence/tests/brush-mixing.mjs
node evidence/tests/dissipation-pressure.mjs
node evidence/tests/layout-recovery.mjs
node evidence/tests/curl-resize.mjs
node evidence/tests/stability.mjs
python3 evidence/tests/artifact-audit.py
```

Fresh-browser verification (separate empty session, offline before opening the file):

```bash
agent-browser --session flux-final open about:blank
agent-browser --session flux-final set viewport 1280 800 1
agent-browser --session flux-final set offline on
FLUX_SESSION=flux-final node evidence/tests/final-session.mjs
agent-browser --session flux-final errors --json
agent-browser --session flux-final console --json
agent-browser --session flux-final network requests --json
```

`tests/driver.mjs` enables Page, Runtime, and Network diagnostics, disables the browser cache, and explicitly enforces offline networking with HTTP(S) request blocking on each connection. Each test specifies its exact pointer coordinates, durations, control actions, and assertions. `logs/commands.txt` contains the executed agent-browser commands. `logs/*-events.json` preserve CDP observations. All tests/harnesses remain outside the delivered HTML.

The initial startup check was run against `about:blank` before implementation and failed because no fluid solver existed (`logs/startup-red.txt`). It subsequently passed against real GPU state (`logs/startup-green.json`, `logs/startup-final.json`). JavaScript syntax is checked separately in `logs/javascript-syntax.txt`; dependency and duplicate-ID inspection is in `logs/artifact-audit.json`.

## Observed behavior

| Check | Result | Actual interaction and evidence |
|---|---|---|
| Direct-file launch with no internet/cache dependencies | PASS | A fresh offline session opens the file and exercises the application. Resource timing reports no subresources; network records contain only local file documents. `logs/fresh-session-final.txt`, `logs/delivery-network.json`, `logs/artifact-audit.json`. |
| Moving initial fluid | PASS | GPU readbacks contain positive kinetic energy and RGB dye, finite pressure/curl/divergence, and GL error 0. Screenshots show the initial ribbons evolve into curling plumes. `screenshots/desktop-delivery.png`, `screenshots/final-scene.png`. |
| Slow and rapid pointer dragging | PASS | Agent-browser mouse down/move/up plus 31-point slow and 45-point rapid drags. Final run: 76 movement events, 79 splats; measured drag speed 0.362 → 2.421, with the horizontal force reversing direction and increasing in magnitude. `logs/lifecycle-final.txt`, `screenshots/pointer-dye.png`. |
| Flow persists and dye advects after release | PASS | Wait 0.7 simulation seconds after release. Dye centroid moved from approximately (0.355, 0.445) to (0.323, 0.408), with positive velocity energy. `logs/lifecycle.json`. |
| Transport and mixing | PASS | Enter pure red in the hex editor and draw; GPU readback has red dye and zero green/blue. Select pure blue and draw across the first stroke; both channels remain present and overlap in cells. `logs/brush-mixing-final.txt`, `screenshots/red-blue-mixing.png`. |
| Pause/resume | PASS | Click Pause; compare GPU state across eight rendered frames. Solver step count, dye mass, and kinetic energy remain exactly equal. Resume advances them. Space also works with canvas focus. `logs/lifecycle-final.txt`. |
| Clear dye preserves velocity | PASS | Pause, read fields, click Clear dye, read again. Dye becomes exactly zero; kinetic energy remains exactly 367.23643339234854 in the final lifecycle run. Pressure/velocity are separate from dye. `logs/lifecycle.json`. |
| Reset | PASS | After high-force/high-resolution stress, Reset restores a finite populated initial field, Dye mode, resolution 160, speed 1, vorticity 18, force 0.8, and the other defaults. `logs/stability-output.txt`. |
| Visualization switching | PASS | Click Dye, Velocity, Pressure, Vorticity, Divergence while paused and verify unchanged simulation steps; also switch while running. Inspected rendered dye, arrows, signed pressure, curl, and divergence. `screenshots/mode-*.png`, `logs/lifecycle-final.txt`. |
| Viscosity | PASS | Identical reset-based trials at viscosity 0 versus 5, vorticity 0, each run for 1.4 simulation seconds. Final kinetic energies: 156.22 versus 40.12; curl RMS: 0.731 versus 0.272. Velocity screenshots show smoother, weaker flow. `logs/physics-controls-final.txt`, `screenshots/physics-inviscid.png`, `screenshots/physics-viscous.png`. |
| Vorticity | PASS | Set Vorticity to 0 versus 30 using the labeled slider and keyboard. Curl RMS rises from 0.731 to 20.046, with visibly finer swirls and finite state. `logs/physics-controls-final.txt`, `screenshots/physics-swirling.png`. |
| Pressure correction and iterations | PASS | Projection reduces post-stroke divergence RMS from 1.334 to 0.195. Trials at 8 versus 60 iterations produce residual/pre-projection ratios about 0.469 versus 0.173. `logs/lifecycle-final.txt`, `logs/dissipation-pressure-midpoint.txt`. |
| Speed | PASS | Labeled slider and keyboard compare 1× and 2× over 24 rendered frames. Final run advances about 0.03133 versus 0.06134 simulation seconds per step. `logs/speed-final.txt`. |
| Velocity and dye dissipation | PASS | Compare 0 with the maximum settings after reset. High dye dissipation leaves about 0.058 of starting dye over the test interval, and high velocity dissipation strongly reduces kinetic energy. `logs/dissipation-pressure-midpoint.txt`. |
| Interaction force | PASS | Let flow settle using high dissipation. With force 0, a drag adds color but no extra momentum. With force 3, the same path produces a large increase in actual GPU kinetic energy. `logs/brush-mixing-final.txt`. |
| Interaction radius | PASS | Clear dye between same-position clicks at 0.5% and 9% radius. Large radius produces over ten times the dye mass and a visibly larger footprint. `logs/brush-mixing-final.txt`. |
| Color controls and invalid values | PASS | Preset colors disable cycling. Hex editor accepts red, blue, and seafoam; invalid `zzzzzz` stays in the editor with an inline error and `aria-invalid`. `screenshots/color-validation.png`, `logs/brush-mixing-final.txt`. |
| Keyboard input / queued paused strokes | PASS | Focus canvas; Space pauses/resumes, 1 switches to Dye, arrow keys queue strokes during pause and apply them on resume. C and R also pass direct keyboard tests that clear without changing paused momentum and restore a populated running scene (`logs/keyboard-shortcuts-final.txt`). `logs/lifecycle-final.txt`. |
| Resolution | PASS | While paused, change Balanced → Light → Detailed → Balanced. Dimensions change; positive velocity and dye are preserved. `logs/layout-recovery-all-pass.txt`. |
| Paused diagnostic resizing | PASS | While viewing Vorticity and paused, change resolution, then change aspect ratio. Curl stays nonzero and rendered without requiring resume. `logs/curl-resize-green.txt`, `screenshots/paused-curl-resize.png`. |
| High DPI | PASS | Change DPR from 1 to 2 at the same CSS viewport size. Canvas becomes 1836 × 1132 instead of 918 × 566. `logs/layout-recovery.json`, `screenshots/desktop-retina.png`. |
| Narrow layout and two-finger touch | PASS | At 390 × 844, expand/collapse controls, scroll settings, pick Coral, drag two touch points through the canvas, and switch diagnostics. 36 touch movement events produce 38 splats; canvas gestures do not scroll the page. No horizontal overflow or footer overlap remains. `screenshots/mobile-touch.png`, `screenshots/mobile-panel-delivery.png`, `logs/layout-recovery-all-pass.txt`. |
| Pointer capture / continuity | PASS | A 141-point fast circular drag produces 140 movement events and 141 splats, with no queued backlog. A stroke ending outside the canvas releases capture; subsequent hover adds no movement events or dye. `logs/stability-output.txt`. |
| Guide and fullscreen navigation | PASS | Open guide, inspect content, dismiss using Escape. Enter fullscreen, inspect resized rendering, click the visible exit control, and restore normal layout. `screenshots/guide.png`, `screenshots/fullscreen.png`, `logs/layout-recovery-all-pass.txt`. |
| Unsupported graphics | PASS | Browser-level fault injection returns null from canvas getContext before load. The app presents a readable explanation and disables unavailable actions. Remove injection and click Try again; valid GPU state returns. `screenshots/unsupported-webgl.png`, `logs/layout-recovery-all-pass.txt`. |
| Context loss and recovery | PASS | Trigger actual `WEBGL_lose_context` loss. App shows recovery UI. Try again reloads successfully. Separately call the browser extension's restoreContext; automatic reconstruction also returns finite moving fields. `screenshots/context-loss.png`, `logs/automatic-context-recovery.txt`. |
| Extreme configuration stability | PASS | Detailed resolution, speed 2, viscosity 0, vorticity 30, 60 pressure iterations, force 3, radius 9, continuous rapid input, then four samples over two simulation seconds. All fields remain finite with GL error 0. `logs/stability.json`. |
| Browser console/errors/failed requests | PASS in final sessions | No uncaught errors or failed requests in final lifecycle, layout, stress, or fresh-session CDP event logs. Fresh browser console/error records are empty. See `logs/final-event-audit.txt`, `logs/delivery-browser-errors.json`, `logs/delivery-browser-console.json`. |

## Failures found, causes, fixes, and retests

1. **Clipped dye swatches at desktop height — fixed.** Initial control content was 479 px high in a 441 px area, and the footer covered the color buttons. A semantic Seafoam button click failed. Reduced desktop spacing while retaining mobile touch spacing. Same lifecycle now passes. Evidence: `screenshots/issue-01-clipped-colors.png`, `logs/lifecycle-output.txt`, `logs/lifecycle-retest-output.txt`.
2. **Graphics retry threw a TypeError — fixed.** The pointer-coordinate helper named `location` shadowed the browser global. Real context loss followed by Try again reproduced `location.reload is not a function`. Changed the handler to `window.location.reload()`. Both reload recovery and automatic context restoration pass. Evidence: `screenshots/issue-02-retry-context.png`, `logs/errors-before-final.json`, `logs/layout-recovery-all-pass.txt`.
3. **Weak initial pressure correction — improved.** Central divergence/gradient did not form the Jacobi solver's nearest-neighbor Laplacian. Replaced them with paired backward divergence and forward gradient, with closed boundary fluxes. The pressure-quality regression changed from residual ratio 0.662 to 0.306. Evidence: `logs/pressure-quality-red.txt`, `logs/pressure-quality-green.txt`. A later damped-Jacobi experiment did not improve this and was reverted; midpoint backtracing is retained for advection.
4. **2× speed was capped near 1× — fixed.** The old maximum dt of 0.0333 seconds prevented speed scaling around 30 fps. Allowed the bounded scaled timestep and capped vorticity force per step for stability. The same speed test now measures approximately twice the advancement. Evidence: `logs/speed-red.txt`, `logs/speed-green.txt`, `logs/speed-final.txt`.
5. **DPR-only changes retained a low-resolution buffer — fixed.** ResizeObserver did not fire when only pixel density changed. The frame loop now detects DPR changes, updates the drawing buffer, and avoids unnecessary fluid resampling. Evidence: `logs/dpr-red.json`, `screenshots/issue-03-dpr.png`, `logs/layout-recovery-all-pass.txt`.
6. **Expanded mobile controls overlapped the footer — fixed.** The desktop maximum workspace height still constrained the taller mobile layout. Removed that maximum at the mobile breakpoint and corrected the inline toggle symbol layout. Evidence: `logs/mobile-footer-red.json`, `logs/mobile-footer-green.json`, `screenshots/mobile-controls-bottom.png`.
7. **Vorticity view went blank after resizing while paused — fixed.** Independent code review found that resized curl storage was cleared but not recomputed. Browser reproduction measured curl RMS 1.953 → 0 despite retained velocity. The preserving resize path now recomputes curl after projection. Retest measured 2.079 → 1.540, and aspect-ratio changes also pass. Evidence: `logs/curl-resize-red.txt`, `logs/curl-resize-green.txt`.

All seven issues above were retested. Final review found no remaining important issues. The review was read-only and did not operate the shared browser.

## Tool-specific observations

- `find label ... focus` and `find label ... select` are not valid subactions in this CLI version. Ran `agent-browser doctor --offline --quick`; it passed. Used labeled clicks plus Home/End for ranges and the documented `select` command for the resolution control. These were harness failures, not application failures.
- The semantic fullscreen exit lookup initially selected a hidden header counterpart. The fresh accessibility snapshot's visible exit button worked; the harness subsequently targets that visible control.
- Native browser color-picker descendants could be inspected but not reliably edited through this CDP route. The final application instead supplies a DOM hex editor; its success, invalid-input handling, and resulting dye channels are tested.
- This CLI retained an old error despite `errors --clear`. Consequently `logs/final-browser-errors.json` contains the historical, fixed retry error. It is preserved honestly. The separate fresh session has an empty error list in `logs/delivery-browser-errors.json`; final CDP event streams also contain zero exceptions and failed requests.

- Reconnecting a CDP client could reset an earlier offline setting. The fresh-session offline assertion caught this (`logs/fresh-session-offline-harness-failure.txt`). The harness now enforces offline mode and blocks HTTP(S) on every connection before navigation. The full fresh-session retest passed (`logs/fresh-session-final.txt`).

## Limits and untested scope

- WebGL2 and floating-point color rendering are required. Unsupported capability handling passes; there is no CPU fallback solver.
- Default rendering measured around **33 fps** on this machine. The heaviest tested configuration measured **12–17 fps**. The Light resolution option reduces work. No claim of universal 60 fps is made.
- This is a finite-grid visual fluid approximation. Pressure correction leaves measurable residual divergence. Semi-Lagrangian dye transport is not strictly mass-conserving: a zero-dissipation trial measured approximately **1.36×** starting total dye after about 1.3 simulation seconds. Dissipation, transport, and mixing behave as tested; exact conservation and engineering-grade numerical accuracy are not claimed.
- Browser/device coverage is Chromium automation with viewport, DPR, and touch emulation. Physical touch hardware, Firefox, and Safari are **not-run**.
- Persistence, import/export, and audio were not requested or implemented; their checks are **not-run / not applicable**.
- No required workflow remains blocked or has a known unresolved test failure.
