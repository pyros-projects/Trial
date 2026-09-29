# Validation record — Orbit Lab

Status: COMPLETE for the delivered artifact. All observed application failures below were fixed and retested. Required browser checks passed; none are blocked. This report is agent authored and contains no evaluator results or score.

## Environment and approach

- Working directory: /home/pyro/projects/naked/sol61/07-orbital-mission-planner
- Runtime artifact: index.html, self-contained browser HTML/CSS/JavaScript.
- Read installed agent-browser SKILL.md, then `agent-browser skills get core` and `agent-browser skills get dogfood` before browser use.
- Physics reference consulted: GROMACS velocity-Verlet algorithm documentation and NASA Basics of Spaceflight orbital mechanics.
- Plan and design: evidence/plan.md and evidence/design.md. User explicitly requested continuous end-to-end execution; no intermediate approval gates used.

Final artifact: `../index.html` (120,820 bytes). SHA256: `1d8ba37a7b65f84f85897442b10e527f3b1a9a43b27a760865dea116b5dc8e65`. Runtime source and unit checks are recorded in `logs/final-checks.txt`.

## First desktop checks (direct file)

Commands: `agent-browser --version` → 0.31.1; `agent-browser skills get core`; `agent-browser skills get dogfood`; `agent-browser --session orbit-validation open file:///home/pyro/projects/naked/sol61/07-orbital-mission-planner/index.html`; `set viewport 1280 800`; `snapshot -i`.

Direct-file: PASS. The file rendered and ran all four bodies. Network capture contained only the file Document (200), with no HTTP or HTTPS asset/service requests. Initial `--allowed-domains localhost,127.0.0.1` rejected the file URL because it has no hostname; `doctor --offline --quick` showed the browser available, and opening the file without that HTTP-specific navigation restriction succeeded. This was a tool configuration issue, not a direct-file limitation.

Initial numerical checks: `node evidence/physics.test.cjs` → 10 passed. The first run failed because index.html did not yet exist. A subsequent harness error accessed a VM lexical const as a context property; corrected to evaluate `Physics` within the VM. Logs retained under logs/physics-*.txt.

`python3 evidence/browser-flows.py` uses real labeled controls plus read-only diagnostics. Maneuver delta-v changed to 0.35 prograde and 0.025 radial, scheduled five time units ahead. The paused projected endpoint moved 101.16 u; the node remained unexecuted. After Play, the node executed, the mission log recorded it, and mission time advanced from 29.7576 to 35.7568. System energy error remained finite (2.44e-10%). Screenshots: 01-direct-file-desktop.png, 02-maneuver-preview.png, 03-burn-executed.png.

### ISSUE-01 — inspector navigation can scroll behind the header

Status: FAIL observed → FIXED → PASS on retest. After editing a maneuver lower in the inspector and executing its burn, clicking Telemetry failed: the tab's rectangle had top -19 and bottom 27, while its scroll container began at 136 with scrollTop 155. The global header covered it. Retried the same click and reproduced the failure. Evidence: screenshots/issue-01-inspector-tabs.png and issue-01-inspector-tabs-reproduced.png; videos/issue-01-inspector-tabs.webm; exact commands and failure in logs/browser-flows.txt. Root cause: inspector navigation was part of scrolling content with no persistent positioning. Fix: make its tab bar sticky within the inspector.

ISSUE-01 fix retest: the sticky tab bar now remains at y=136–182 with inspector scrollTop=155. Actual CSS-selector/pointer clicks open Telemetry successfully, followed by passing pause/step and checkpoint flows. The CLI's semantic `find role … click` still targeted a stale pre-sticky coordinate; test harness now uses direct CSS click for this bar, an allowed core-workflow fallback. Screenshot issue-01-sticky-retest.png captures the persistent bar. Additional CLI correction: `find label … select` returned “Unknown subaction: select”; use the native `select #reference-frame value` command. These tool errors were retained in browser-flows.txt.

### ISSUE-02 — native step validation blocks default solver settings

Status: FAIL observed → FIXED → PASS on actual settings submission. A fresh reviewer found and I independently verified that G=1, dt=.12, encounter safety=.04, and horizon=900 all had native stepMismatch because min values and step increments were offset. Clicking Apply settings left the modal open. Screenshot: issue-02-default-settings-invalid.png. Fix: use step=any for continuous numeric controls and rely on explicit finite/range validation; retain integer validation for prediction sample count.

## Review regressions and corrections

Fresh independent review is preserved in logs/review.txt. All 7 Important findings were reproduced or verified against the real source/behavior before correction:

- Continuous settings input constraints corrected (native browser regression now passes; settings actually submitted to dt=.06, horizon=600, samples=650, display scale=1.25).
- Maneuver IDs generated against existing nodes after load/import.
- A missing primary is valid for free-flight burns and storage.
- Merges repair the primary graph, update maneuver primaries, and cancel maneuvers belonging to absorbed bodies.
- Encounter crossing step cap uses geometric separation even with large softening; the head-on collision regression that previously returned no collision now halts near t=.099.
- Displayed scheduled delta-v uses the actual resolved vector at burn time, accounting for nonorthogonal prograde/radial components.
- Dragging a velocity handle changes velocity from its captured initial value, preventing a jump when displayed length is capped.

Also corrected duplicate halt events, restored checkpoint trails, followed primary edits through to pending nodes, and replaced the eight-spacecraft prediction restriction with one shared system prediction and per-spacecraft encounter estimates. Red/green logs retained. `node evidence/physics.test.cjs`: 14 passed; `node evidence/mission.test.cjs`: 6 passed.

## Browser tool limitations and supplementation

Agent-browser remains the main automation tool. Its 0.31.1 `mouse wheel` command delivered a real wheel event at client (0,0), even after `mouse move 604 389`; a one-use capture listener logged `WHEEL_DIAGNOSTIC 0 0`. It consequently missed the Canvas. The Canvas zoom itself passed when a native CDP wheel event was delivered at (604,389), changing scale from 1.57371 to 2.25564. Supplementary `cdp-input.cjs` and `cdp_input.py` use the same agent-browser-managed Chrome via its `get cdp-url`, Node's built-in WebSocket, and Input.dispatchMouseEvent. No application state is patched. This supplement is also used for actual multi-touch/DPR testing. The diagnostic listener was on the prior page and cleared by navigation; no instrumentation is delivered in index.html.

HTTP testing uses the fresh orbit-offline session with `--proxy http://127.0.0.1:9 --proxy-bypass 127.0.0.1,localhost --allowed-domains 127.0.0.1,localhost` on every command. A deliberate external fetch probe was blocked, demonstrating external internet unavailable while localhost remained reachable. Probe errors/requests were then cleared before application-flow health checks. Omitting launch configuration on subsequent CLI calls reset its browser to about:blank; repeating consistent flags corrected that tool setup issue.

### ISSUE-03 — a DPR-only transition retained the old Canvas resolution

Observed at the final display transition: CSS viewport stayed 390×844, devicePixelRatio changed from 1 to 3, but Canvas width stayed 390 instead of 1170. Confirmed while the native CDP emulation session remained connected (DPR-only diagnostic in browser-extended.txt and screenshot issue-03-dpi-only-active.png). Root cause: CSS dimensions did not change, so neither the ResizeObserver nor window resize listener rebuilt the backing store. Fix: the render loop detects a changed pixel ratio; the profile plot also checks its backing resolution when it becomes visible. This does not change simulation state.

The earlier combined viewport+DPR transition passed; this additional check caught the separate same-size monitor/DPR case. A screenshot using an old agent-browser outer-viewport setting (27-final-mobile-390x844-dpr3.png) included blank space outside the emulated CSS viewport. Final mobile screenshots use an explicit 390×844 tool viewport before DPR emulation.


### ISSUE-04 — Canvas intrinsic size stretched the desktop grid after mobile resize

Status: FAIL reproduced → FIXED → PASS on resize regression. Switching from a scrolled 390×844 DPR-3 view back to 1440×900 left the header above the visible page. Screenshots 31-final-desktop-1440x900.png and 32-final-desktop-at-top-1440x900.png preserve the failure. Read-only diagnostics showed document scrollY=353, workspace height=764, center height=1117, viewport height=960, and canvas backing height=960. Native Control+Home did not recover the clipped desktop header. Root cause: the Canvas's intrinsic backing size contributed to an automatic grid/flex minimum height. Fix: give the center min-height:0 and position the Canvas inside its sized viewport, so backing resolution cannot drive layout. Exact diagnostics and commands are retained in logs/browser-extended.txt.


ISSUE-03 final retest: PASS. A native DPR-only change at CSS 390×844 now updates the main Canvas to 1170×1215, and the visible telemetry plot also matches its CSS size × 3. Native touch pan/pinch still work. Exact commands and results: `python3 evidence/resize-regression.py`, logs/browser-extended.txt.

ISSUE-04 final retest: PASS. After actual mobile navigation and scrolling, returning to desktop produces scrollY=0, document height=900, center height=764, viewport height=607 and Canvas backing height=607 at DPR 1. The header starts at y=0. Paused time and all physical vectors are unchanged. Keyboard zoom, play/pause and native touch pan/pinch passed after the layout correction. Screenshot 35-final-desktop-1440x900.png shows the corrected full desktop layout. The first resize test used a mistaken selector `#mobile-system`; corrected to the actual `#mobile-systems`, then reran the complete flow successfully. The failed CLI lookup is retained in the log and was a harness error.

## Final observed results

| Check | Result | Genuine behavior and evidence |
| --- | --- | --- |
| Standalone file | PASS | Opened the actual delivered file using `file:///`; active N-body integration, controls, burn, frames and persistence worked. Network observations contained only file Documents. |
| Restricted localhost / no external dependencies | PASS | Fresh browser session used a dead external proxy and local bypass. A separate external probe failed. Actual application traffic had no external requests. Source audit found only the embedded data favicon and inline SVG references. |
| Advance and telemetry | PASS | Latest direct-file flow advanced t=1.2 → 7.0664; actual bodies moved and post-burn eccentricity reached 0.5693969. State remained finite. |
| Maneuver prediction and execution | PASS | Real labeled inputs set prograde .35, radial .025, burn time now+5. Paused endpoint changed 105.4164 u before execution. Play executed one scheduled burn and logged it. Energy error after the intentional impulse was 5.43535e-11%. Screenshots 02 and 03. |
| Maneuver placement and coordinates | PASS | Actual pointer placement on predicted Canvas flight, pointer/Enter timeline creation, Cartesian editing, removal and input focus continuity passed. Nonorthogonal .1/.1 orbital components displayed the actual .2000 vector magnitude. Beyond-horizon values are marked ≈. Screenshots 19 and 21. |
| Frames, trails and vectors | PASS | Switched primary-centered → inertial → selected-body → Terra–Luna rotating through native controls. Inertial origin=0; selected origin matched spacecraft and telemetry position=0; rotating omega was nonzero. Screenshots 04–06 show transformed rendering. Numerical checks independently verify translation, rotation and velocity subtraction. |
| Time controls and checkpoint | PASS | Pause froze physical time; single-step advanced dt and stayed paused; warp changed 8× → 16× → 8×; restart cleared nodes and returned near epoch. Checkpoint restored exact vectors, time and trail history. Keyboard Space and S passed. |
| Solver/configuration | PASS | Submitted G, maximum step, horizon, sample count, trail duration and display scale through real settings. Invalid G=0 left state intact and dialog open. Native defaults are valid. |
| Presets | PASS | All seven presets selected through the scenario control, advanced at least 3 t with actual integration, moved the craft and retained finite states. Hohmann preset contains two scheduled burns; escape reports infinite apoapsis. Full end-to-end arrival for each transfer was not asserted. |
| Canvas interaction and scales | PASS | Mouse pan, real wheel zoom, focus/fit, spacecraft position and velocity drags; capped-handle tiny drag changed velocity continuously by .0242502 u/t. Native one-finger pan and two-finger pinch passed. Screenshots 09, 10 and 25. |
| Bodies and multiple craft | PASS | Actual body form changed mass/radius/display/primary, added a second craft and deleted a selected body safely. Ten craft share valid prediction data, including the tenth selected craft. Single-body free flight exported/imported successfully. Screenshot 20. |
| Collision behavior | PASS | Actual imported head-on encounter halted at t=.0992483053 despite softening=20, exactly one Contact event. Real settings changed to pass-through and bodies crossed without a contact halt. Merge repaired primaries/nodes and its export imported successfully. Screenshots 22, 23. |
| Overlays | PASS | Real toggles enabled potential, SOI, acceleration and integration error overlays; rendered output and potential legend inspected. Other five layers toggled off/on without errors. Screenshot 11. |
| Persistence/import/export | PASS | Local save/load restored exact time/vectors. Actual downloaded JSON round-tripped with pending/free-flight burns and merged/single-body systems. Imported node IDs remained unique. Malformed import was rejected atomically. Screenshot 12. |
| Desktop/narrow/DPI/resize | PASS | 1280×800 and 1440×900 desktops, 390×844 narrow view; mobile telemetry, maneuver/settings/scenario/transport/navigation used. No horizontal overflow. DPR 3 backing stores and same-size DPR transitions tested. Scrolled mobile → desktop regression passed. Final screenshots 38 and 37. |
| Live diagnostics | PASS | FPS measured actual slow rendering at 4.70588 under short CPU emulation, recovered after removal. Overlay shows time, warp, steps, bodies, energy/momentum, frame and pause. Latest normal-flow console and uncaught-error lists are empty. |
| Embedded numerical/storage suite | PASS | 14 physics + 6 mission behavior checks pass against extracted delivered code. Includes analytic circular period/elements, energy/momentum, mutual gravity, event timing, prediction/live agreement, frames, collision and reference integrity. |
| Cross-engine / physical device coverage | NOT-RUN | Real Chrome/Chromium automation with native touch emulation was used. Other browser engines and physical touch hardware were not tested. |

## Reproduction commands and main steps

Run from the application directory. Tests, drivers, fixtures and evidence are outside the delivered file.

```bash
node --test evidence/physics.test.cjs evidence/mission.test.cjs
python3 evidence/browser-flows.py
python3 -m http.server 8843 --bind 127.0.0.1
# Run the following in another shell while the temporary inspection server is running:
python3 evidence/browser-extended.py
python3 evidence/browser-edge-cases.py
python3 evidence/final-verification.py
python3 evidence/resize-regression.py
python3 evidence/delivery-checks.py
```

The primary direct-file flow performs: open file → set 1280×800 → pause → plan node → fill prograde/radial/time → apply and compare projected states → play to burn → pause → inspect real eccentricity/log/error → single-step → checkpoint/restore → switch three reference modes → accelerate/decelerate warp → local save/load → restart → field guide → keyboard step/play/pause → console and error checks. The scripts contain exact labeled/pointer/keyboard commands and read-only diagnostics; every CLI command and observed output is preserved in logs/browser-flows.txt or logs/browser-extended.txt.

The HTTP helper passes these flags on every call:

```bash
agent-browser --session orbit-offline \
  --proxy http://127.0.0.1:9 \
  --proxy-bypass 127.0.0.1,localhost \
  --allowed-domains 127.0.0.1,localhost open http://127.0.0.1:8843/index.html
```

Browser drivers inspect live state through the read-only `window.orbitLab` diagnostics. They never inject bodies/nodes or patch simulation state. JSON fixtures are agent-authored using the application's own export and uploaded through the actual file input; no supplied benchmark fixture, requirement or evaluator file was altered. Native wheel and multi-touch supplementation is documented above. Normal app health checks exclude the intentionally blocked network probe; the historical HAR preserves that probe honestly.

### Evidence navigation

- Final active default desktop: [38-delivered-fresh-desktop-1440x900.png](screenshots/38-delivered-fresh-desktop-1440x900.png).
- Final active default mobile / DPR 3: [37-delivered-default-mobile-390x844-dpr3.png](screenshots/37-delivered-default-mobile-390x844-dpr3.png).
- Burn preview/execution: [02](screenshots/02-maneuver-preview.png), [03](screenshots/03-burn-executed.png).
- Rendering/features: [rotating frame](screenshots/06-rotating-frame.png), [overlays](screenshots/11-gravity-and-vector-overlays.png), [mobile maneuver](screenshots/15-mobile-maneuver.png).
- Exact flow logs: [direct-file](logs/browser-flows.txt), [offline/extended/edge/resize/delivery](logs/browser-extended.txt).
- Final dependency/parse/test checks: [final-checks.txt](logs/final-checks.txt).
- Independent review and correction verification: [review.txt](logs/review.txt).
- First navigation issue recording: [issue-01 video](videos/issue-01-inspector-tabs.webm).

Physics references used while implementing: [GROMACS velocity Verlet](https://manual.gromacs.org/2019/reference-manual/algorithms/molecular-dynamics.html), [NASA orbital mechanics](https://science.nasa.gov/learn/basics-of-space-flight/chapter3-1/), [NASA mission trajectories](https://science.nasa.gov/learn/basics-of-space-flight/chapter5-1/).

## Remaining limits

No unresolved failures remain in the exercised flows. No required runtime or browser check was blocked. This is a planar educational Newtonian model with instantaneous impulses, configurable softening and no atmosphere/fuel model. Predictions have finite configured horizons and an 80,000-step work cap; shortened horizons are reported. Closest encounters are estimates interpolated between sampled states. Out-of-horizon orbital burn magnitudes use current geometry and are explicitly marked approximate. The UI supports up to 32 bodies and 256 nodes; long high-body-count/stress missions and other browser engines were not run. Save storage remains browser/device specific. The temporary server and browser harnesses are development tools, not artifact dependencies.
