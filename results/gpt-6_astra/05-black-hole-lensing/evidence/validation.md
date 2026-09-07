# Horizon validation

Agent-authored development and browser validation record. No evaluator scores.

- Artifact: `../index.html` (one standalone file).
- Browser: agent-browser 0.31.1 with Google Chrome, direct `file://` navigation.
- Read `/home/pyro/.codex/skills/agent-browser/SKILL.md`, version-matched `agent-browser skills get core`, `skills get dogfood`, and exploratory issue taxonomy before testing.
- Reference for the spatial ray equation: Belbruno & Pretorius (2011), equation 12: https://arxiv.org/html/1103.0585v1. Emission, observer projection, and spin are documented approximations.

## Delivery status

| Coverage | Final status |
|---|---|
| Standalone `index.html`, no external asset/runtime dependencies | **Pass** |
| Direct `file://` opening with browser offline | **Pass** |
| 1280 × 800 and 390 × 844 layout and input | **Pass** |
| 2× DPR rendering and paused accumulation | **Pass** (slow on software rendering) |
| Continuous orbit, pan, zoom, presets, and native touch | **Pass** |
| Lensing, disk geometry/emission, every parameter, six diagnostics | **Pass** |
| Selected-ray values and CPU/GPU classification agreement | **Pass** |
| Pause, time, reset, quality, resizing, and adaptive resolution | **Pass** |
| Session export/import, invalid import, persistence, PNG capture | **Pass** |
| Missing WebGL, shader compile failure, context loss/recovery | **Pass** |
| Final shader compile, app console, uncaught errors, GL errors | **Pass** |
| Representative hardware GPU performance | **Blocked**: test browsers used software rendering |
| Safari/Firefox and a physical mobile device | **Not run** |

Two confirmed application issues were fixed and retested: initial vector-helper syntax and modified-key reset behavior. No known application failure remains in the exercised flows. Tool interruptions, rejected commands, and initial failed assertions are preserved below with their actual retests; they are not counted as successful checks.

The physical model uses the Schwarzschild spatial central-force formulation with an illustrative spin force, approximate observer projection, finite-volume emission, and screen-space bloom. It is not a precision Kerr/radiative-transfer solver. Final beauty screenshots were paused with adaptive scaling disabled to collect a stable image.

## Commands and observations

Initial setup:
```sh
agent-browser --session horizon --executable-path /usr/bin/google-chrome --allow-file-access --args '--enable-webgl,--ignore-gpu-blocklist,--enable-unsafe-swiftshader' open file:///home/pyro/projects/naked/astra/bench/05-black-hole-lensing/index.html
agent-browser --session horizon set viewport 1280 800
agent-browser --session horizon snapshot -i
agent-browser --session horizon screenshot evidence/screenshots/issue-001-initial-syntax.png
agent-browser --session horizon errors
agent-browser --session horizon console
```

### ISSUE-001: Initial inline JavaScript syntax error
- **Initial fail; fixed and retest passed** — blank viewport and missing generated controls on initial load. Browser and Node syntax checks both reported `Unexpected token ':'`.
- Cause: missing third coordinate and closing bracket in the vector cross-product helper.
- Fix: complete the three-coordinate cross product.
- Evidence: `screenshots/issue-001-initial-syntax.png`; static initial-load failure, no video required.

### Initial render retest and tuning
- **Pass:** corrected vector syntax. Node `new Function(inlineScript)` succeeds. All six WebGL shader compilations report `success: true`, empty shader logs, `runtime.errors: []`.
- First actual GPU image: `screenshots/desktop-first-render.png`; strongly lensed far-disk arch, secondary image below the disk, and a photon-region ring are visible.
- Initial image was too saturated, with weak emission texture. Reduced emission intensity and increased filament contrast.
- Software-rendered Chrome initially reported about 2 FPS at 723 × 470; adaptive scaling began reducing resolution. Replaced per-step shader exponentiation with inverse-radius multiplications. Performance remains under inspection.
- Paused using the accessible `Pause simulation` button, took a fresh snapshot, then enabled browser offline mode with `agent-browser --session horizon set offline on` for direct-file dependency isolation.

## Desktop workflow observations (first run)
Exact commands and return values are in `logs/browser-actions.jsonl`; assertions and measured state are in `logs/workflow-results.json`. Main workflow driver: `python3 evidence/browser_validation.py`.

- **Pass:** continuous pointer orbit produced four different render hashes and corresponding yaw/pitch changes during the drag. The disk projection changed from a shallow ellipse to a higher observer view (`desktop-orbited.png`).
- **Pass:** pan changed the observer target and image; keyboard arrow and plus input changed yaw and distance.
- **Pass:** a selected ray escaped after 80 steps, passed within 3.205 reference radii, accumulated 51.908° deflection, hit the disk at radius 3.992, and had a frequency factor of 0.582. See `desktop-selected-ray.png` and `videos/camera-ray-workflow.webm`.
- **Pass:** all six diagnostics produced distinct images and `glError: 0`; screenshots `diagnostic-*.png`.
- **Harness interruption:** native CLI mouse positions require integer coordinates; a floating-point range-slider coordinate was rejected. Rounded coordinates in the agent-authored test driver. This was not an application failure.
- **Tool issue:** agent-browser 0.31.1 `mouse wheel` emits wheel input at `(0,0)` even after `mouse move`. A document capture listener observed the event target as `HEADER`, x=0, y=0. Thus the initial wheel assertion failed without exercising the canvas. `agent-browser doctor --offline --quick` reported no installation failures.
- **Wheel retest pass using supplemental real CDP input:** `node evidence/cdp_input.mjs wheel` dispatched `Input.dispatchMouseEvent` to `(440,370)` in the same Chrome tab. Camera distance changed from 22 to 19.22175, and pixel hash changed with `glError: 0`. The application wheel handler works. Exact supplemental commands are logged in `logs/cdp-actions.jsonl`; no synthetic DOM wheel event was used.
- The browser daemon unexpectedly restarted once during CLI troubleshooting (about:blank); the same artifact was reopened, and subsequent checks continue against the reopened tab. No app exception was observed for this tooling restart.

## Playback, camera, and failure coverage
Commands for the completed desktop continuation are in `evidence/finish_desktop.py` (run as `python3 evidence/finish_desktop.py`) and `logs/browser-actions.jsonl`.

- **Pass:** all four camera presets reached their intended positions. Coordinate overlays were enabled via actual checkboxes after scrolling the camera panel.
- **Pass:** auto-orbit moved yaw from 0.304 to 0.488 while running. Pause held time at 187.713 seconds. Scrubbing moved time to 180.4 seconds; restart set zero; playback speed selected 2×.
- **Pass:** explicit paused antialiasing retest accumulated 32 samples; keyboard camera motion reset history to 2 samples while time stayed exactly 185.0131 seconds.
- **Test-precondition correction:** agent-browser recording starts a fresh recording context, which reset the earlier saved playback/settings state. The first accumulation assertion did not assert that playback was paused. `finish_desktop.py` explicitly paused and verified both the pause flag and frozen time. Only this retest establishes paused accumulation coverage.
- **Pass:** Field notes and help open and close; H expands the stage to 1280 × 800, and Escape returns it to 964px wide. A suspected cinema toggle failure was not reproduced; the `issue-002-*-cinema` screenshots/video show successful operation and do not represent a confirmed application issue.
- **Pass:** final desktop browser errors, console messages, and app runtime error arrays were empty.
- **Pass:** missing WebGL was injected only in a separate test session with `--init-script evidence/no_webgl_init.js`. The application displayed “The observatory needs WebGL 2.” with hardware/browser guidance and no uncaught error. See `screenshots/no-webgl-fallback.png`.
- **Pass:** a separate `--init-script evidence/shader_failure_init.js` appended invalid GLSL to the actual compiler input. The application displayed the compiler error and “The light-path shader could not start.” with no uncaught exception. See `screenshots/shader-compilation-fallback.png`.

## Browser stability and downloads
- Downloads in the CLI-owned browser were canceled after their full Blob byte length arrived. That browser also unexpectedly relaunched several times. No application console error was observed; `logs/download-cdp.jsonl` preserves the canceled browser download events.
- To isolate the automation lifecycle, launched a dedicated Chrome process and attached the same installed agent-browser tool:
```sh
/usr/bin/google-chrome --headless=new --no-sandbox --disable-dev-shm-usage --remote-debugging-port=9224 --user-data-dir=/tmp/horizon-validation-stable --no-first-run --no-default-browser-check --enable-unsafe-swiftshader about:blank
agent-browser --session horizon-stable --cdp 9224 open file:///home/pyro/projects/naked/astra/bench/05-black-hole-lensing/index.html
agent-browser --session horizon-stable set viewport 1280 800
agent-browser --session horizon-stable network route 'https://**' --abort
agent-browser --session horizon-stable network route 'http://**' --abort
agent-browser --session horizon-stable download '#exportBtn' /tmp/horizon-session-stable.json
```
- **Pass retest:** session download succeeded in this stable browser; the file is 822 bytes. The delivered application was unchanged during this download retest. All HTTP(S) requests remain blocked while the `file://` artifact is used.

## Persistence and physical coherence
Run: `HORIZON_BROWSER_SESSION=horizon-stable python3 evidence/persistence_validation.py`.
- **Pass:** exported session JSON matched the actual camera/settings; captured PNG was a valid 152,539-byte image at 482 × 313 internal pixels (`captured-observation.png`).
- **Pass:** changed lensing strength to 1.7, imported the exported session, and verified it returned to 1.0 with the exact saved observer and time.
- **Pass:** malformed session showed “Import failed: Invalid parameter: Lensing strength” while preserving the scene. Screenshot: `invalid-session-error.png`.
- **Pass:** reloading the direct file restored settings, camera, and pause state.
- **Pass:** repeated pointer orbit with antialiasing off and time explicitly paused. Three intermediate camera positions produced three distinct GPU image hashes while time stayed at 1.3005 seconds. This isolates camera lensing from disk animation.
- **Pass:** scanned the live CPU reference around the photon region and then clicked the corresponding actual screen pixel. The clicked ray accumulated **472.170°** turning over **224 steps**, ended captured, and reported **0.092% energy drift**. This is a measured path, not a prescribed animation. See `photon-sphere-ray.png`.

## Narrow viewport and touch
Run: `HORIZON_BROWSER_SESSION=horizon-stable python3 evidence/mobile_validation.py`.
- **Pass:** 390 × 844 viewport, 390px document width with no horizontal overflow; visible render at 195 × 339 with Performance quality.
- **Pass:** mobile settings drawer and all three tabs; pointer slider changed mass to 1.4, keyboard increment to 1.45; camera button reduced distance.
- **Pass:** real Chrome `Input.dispatchTouchEvent` gestures (same tab) changed pitch from 0.18 to 0.33, distance from 20.24 to 11.63, and the pan target. Real touch-end/tap selected a ray and displayed its steps, turning, closest radius, and energy drift. Exact commands: `cdp_input.mjs`; observations: `logs/mobile-touch.json`, `logs/mobile-tap.json`.
- **Pass:** mobile deflection, frequency, and step-count diagnostics render with no GL errors; help opens/closes; lower Render controls and export/import remain reachable by scrolling.
- **Pass:** mobile browser console and uncaught error arrays were empty. Screenshots: `mobile-*.png`.
- Further browser-process interruption occurred after the completed mobile run. The process exited normally, without an app exception or resource exhaustion. Remaining checks moved to the isolated `horizon05` agent-browser namespace and dedicated Chrome port 29347. Prior test evidence is retained.

## Full parameter and integrator checks
Run: `AGENT_BROWSER_NAMESPACE=horizon05 HORIZON_BROWSER_SESSION=horizon-stable python3 evidence/physics_controls_validation.py`.
- **Pass:** real pointer input changed spin, horizon boundary, both disk radii, thickness, inclination, temperature, and turbulence; each changed the rendered pixels with GL error 0.
- **Pass:** radius ordering is enforced: an inner radius of 8 raised the outer radius to 8.5.
- **Pass:** exposure, contrast, and bloom changed pixel values; manual 0.65 resolution produced 627 × 407 pixels.
- **Pass:** seven actual GPU classification pixels agreed with the CPU reference for captured, escaped sky, and escaped disk rays. RGB bytes and corresponding trajectory values are in `logs/workflow-results.json`.
- **Pass:** step refinement from 0.6 to 0.3 changed an off-axis ray from 74 to 148 steps; deflection converged from 29.82465° to 29.80127°, and relative energy drift fell from 9.59e-6 to 2.42e-6.
- **Pass:** scrubbing a paused scene changed its rendered procedural disk image.
- **Pass:** adaptive resolution responded to measured slow frames, reducing Balanced resolution from 723 × 470 to 615 × 399 (scale 0.85). Test-browser GPU rendering is software based; representative native desktop GPU performance has not been measured.

## Recovery and final offline check
Run: `AGENT_BROWSER_NAMESPACE=horizon05 HORIZON_BROWSER_SESSION=horizon-stable python3 evidence/resilience_validation.py`.
- **Pass:** `WEBGL_lose_context.loseContext()` displayed recovery guidance. `restoreContext()` recompiled/recreated resources, resumed a nonblank image, and preserved the exact settings and camera, with GL error 0. Screenshots: `webgl-context-lost.png`, `webgl-context-restored.png`.
- **Pass:** fresh offline reload of the delivered file compiled every shader and loaded no external resource. Final runtime and uncaught-error arrays were empty after clearing the intentionally lost context with a reload.
- **High-DPI test correction:** a supplemental CDP metrics override returned 585 × 1016 pixels while attached, but closing that CDP connection released its DPR override. The later 2× assertion therefore saw DPR 1 and failed. Retested using agent-browser's persistent, version-matched `set viewport 390 844 2` setting rather than a short-lived override (commands below).
```sh
AGENT_BROWSER_NAMESPACE=horizon05 agent-browser --session horizon-stable set viewport 390 844 2
AGENT_BROWSER_NAMESPACE=horizon05 agent-browser --session horizon-stable wait --fn 'Horizon.diagnostics.accumSamples===32 && devicePixelRatio===2'
AGENT_BROWSER_NAMESPACE=horizon05 agent-browser --session horizon-stable screenshot evidence/screenshots/final-mobile-hidpi-390x844.png
```

## Final keyboard issue and fix
### ISSUE-002: Browser refresh combination also reset the observation
- **Initial fail; fixed and retest passed.** On the canvas, Ctrl+R was handled as the application's plain R reset shortcut. This reset lensing from the chosen 2.5 to 1.0 and resumed playback before browser refresh.
- Reproduction: start the recording, Reset all settings, Pause simulation, open Environment, focus Lensing strength, press End, focus the viewport, press Control+r. The before/after screenshots and `videos/keyboard-refresh-repro.webm` capture the behavior.
- Fix: application keyboard shortcuts now ignore Ctrl, Meta, and Alt combinations, leaving browser commands intact.
- This is the second confirmed application issue. The earlier cinema suspicion was not an issue; its exploratory filenames are retained without treating them as a failure.

High-DPI retest: **pass**. With persistent `set viewport 390 844 2`, the browser reports DPR 2, a 390 × 844 CSS viewport, and 585 × 1016 internal rendering, with GL error 0. Accumulating all 32 paused samples on software rendering exceeded the first 25-second tool wait; a subsequent actual observation confirmed 32 samples (81 total frames), a nonblank image, and no errors. Final high-DPI screenshot: `final-mobile-hidpi-390x844.png`.

## Final shortcut retest and compact regression
Run: `AGENT_BROWSER_NAMESPACE=horizon05 HORIZON_BROWSER_SESSION=horizon-stable python3 evidence/final_regression.py`.
- **Pass:** Control+r left mass at 2.5 and playback paused. The headless key dispatch itself did not perform native browser navigation; an explicit browser reload then confirmed the same persisted mass. The app no longer treats a modified browser shortcut as its reset command.
- **Pass:** plain R still reset mass to 1 and resumed time; Space paused; ArrowRight orbited; ray selection and deflection diagnostics remained functional.
- **Pass:** the mobile drawer and controls still worked after resize; no horizontal overflow or GL error.
- **Pass:** final shader compilation, browser console, and runtime checks were clean. `logs/final-diagnostics.json`, `logs/final-console.json`, and `logs/final-network.json` preserve the final state.
- **Pass:** final inline-JavaScript syntax and HTML dependency audit: five embedded scripts, no external `src`/`href` attributes. See `logs/artifact-audit.txt`.

Use `screenshots/final-desktop-1280x800.png` and `screenshots/final-mobile-hidpi-390x844.png` for the final appearance; diagnostic, ray-selection, error, control, and gesture evidence is stored alongside them.

Final post-fix cold-file recheck: browser offline, direct file URL, all shaders compiled, zero resource entries, empty runtime error list, nonblank framebuffer, and GL error 0. Artifact SHA-256 is recorded in `logs/index.sha256`.
