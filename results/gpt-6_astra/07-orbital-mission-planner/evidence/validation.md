# Orbital sandbox validation

Agent-authored development and validation record. No evaluator scores.

Environment: 2026-09-07; Node v25.8.1, Python 3.12.3; agent-browser 0.31.1. Read installed agent-browser SKILL.md, version-matched core workflow, dogfood workflow and issue taxonomy.

## Planned coverage
Physics invariants and exact-time impulses; desktop and mobile user flows; Canvas pointer selection/edit/zoom/pan; reference frames; controls and overlays; scenarios; node prediction and burn execution; errors; save/load and import/export; direct file/offline runtime. Checks are not-run until evidence is recorded below.

## Initial direct-file browser pass
- `agent-browser --session orbital --allowed-domains 127.0.0.1,localhost open file:///.../index.html` failed because the URL allowlist requires a hostname. This is a browser-policy invocation issue, not application dependency failure. `agent-browser doctor --offline --quick`: 11 pass, 0 warnings, 0 failures.
- Opened a fresh `orbital-file` session, set `offline on`, installed `network route 'http*://*' --abort`, set viewport 1440×960, then opened the real `file:///home/pyro/projects/naked/astra/bench/07-orbital-mission-planner/index.html`. PASS: application and embedded Blob prediction worker run directly offline. Requests show only the file Document and the internal blob Script. `errors` and `console` returned no messages.
- Screenshot: screenshots/desktop-initial-1440.png. Genuine simulation reached T+41.86 TU in screenshot, visible moving spacecraft, moon, trajectory and changing telemetry. Later paused via labeled button at T+209.458400 TU; energy drift −2.6382e−11; 401 prediction samples; live errors array empty. Resized to 1280×800: screenshots/desktop-paused-1280.png.

## ISSUE-001 — ordinary integration values rejected (fixed; retested below)
Review identified a mismatch between HTML number min and step bases. Reproduced with real labeled input: open Simulation settings, fill Maximum integration step (TU) with 0.02, press Tab. Browser stepMismatch is true and actual cfg.dt remains 0.04. The UI shows a validation error. Evidence: videos/issue-001-settings.webm and screenshots/issue-001-settings.png. Root cause: min=0.001 with step=0.01 only permits 0.001+n×0.01. Gravity and softening have analogous constraints. Fix will align input increments with their minima.

## Engine review and regressions
`node --test evidence/physics.test.cjs`: 14/14 pass. Reviewer caught collision sample mixing and below-clock-precision no-op; both reproduced first, fixed and independently re-reviewed. See engine-report.md and engine-review.md. Final HTML embeds the fixed engine.

Settings reproduction correction: `record start` recreated the current page, closing the modal. The first recording and hidden-input attempt did NOT reproduce the issue (input empty, no error) and are retained as unsuccessful tool evidence. Retried with recording started before opening the modal. `find role button click --name 'Simulation settings'`, `fill '#cfgDt' '0.02'`, `press Tab` now reproduced: input 0.02, stepMismatch true, actual cfg.dt 0.04, validation message present. Definitive evidence: videos/issue-001-settings-repro.webm, screenshots/issue-001-settings-repro.png.

Independent application review found five defects, recorded in application-review.md: malformed import event schema, settings input step bases, stale prediction telemetry on paused selection, stale primary after merger, and maneuver-card Space bubbling into global playback. Fixes applied together after bounded root-cause review; browser regressions follow. Checkpoints now also retain their physics configuration so restored energy baselines match their solver settings.

## ISSUE-002 — prediction readiness during debounce (fixed; retested below)
The actual browser regression passed motion, pause, dt stepping, conservation and checkpoint restoration, then immediately read the previous trajectory after Add maneuver. The prediction was scheduled with a 30 ms debounce, but `predictionBusy` and the UI computing label did not cover that queued interval. Subsequent real output did contain the burn and changed trajectory; the false-ready interval was the cause. Added explicit queued status immediately on invalidation, including live diagnostics and the computing label. Regression remains unchanged and will rerun.

## Main workflow and map outcomes
- `python3 evidence/browser-regression.py main`: PASS all 16 checks after queued-prediction fix. Real labeled controls prove pause freezes time, dt=0.04 single-step, motion of all four bodies, low conservation drift, exact checkpoint restoration, immediate future path change, plan edits without live velocity changes, and an impulse executed once at T+0.08. Actual velocity differs from a cloned unpowered numerical continuation by the recorded burn impulse. Flight-log screenshot: screenshots/burn-flight-log.png. Full actual state: logs/burn-state.json.
- `python3 evidence/browser-regression.py map`: PASS all 17 checks. Switched all four reference frames with nonempty live trails; rotating Terra/Luna y coordinates coincide and moon rotating-frame tangential velocity is near zero. Screenshots frame-inertial/selected/rotating/body.png. Real mouse actions pan, select, drag spacecraft position and velocity tip, place a node on the computed prediction, fit all bodies and keyboard-pan the focused canvas. Evidence: screenshots/canvas-position-velocity-edited.png, maneuver-on-map.png.
- Browser CLI adjustments: `find label ... select` is unsupported in 0.31.1; used snapshot-derived `select '#frameSelect' mode`. Fractional mouse coordinates failed CLI parsing; rounded to physical pointer pixels. Ran doctor after each command incompatibility (logs/doctor-select.txt, doctor-mouse.txt).
- `mouse wheel` dispatched a wheel at page origin (0,0), confirmed by a temporary capture listener; it never reached Canvas. Supplemented this single operation with Node's built-in WebSocket and genuine Chrome `Input.dispatchMouseEvent` at explicit Canvas coordinates, using the same agent-browser-controlled session. `evidence/cdp-input.cjs` contains exact supplementary input. Initial CDP attempt targeted an old recording tab; now targets only the current page marked by the harness. No synthetic application events or state setters are used. Real wheel zoom then passed. Browser automation itself remains agent-browser for all navigation, controls, screenshots and diagnostics.

## Settings, persistence and mobile outcomes
- `python3 evidence/browser-extra.py settings`: PASS 8 checks. Ordinary G=1.2, dt=0.02 and softening=0.03 apply; G=0 is rejected; 160-TU/600-sample prediction gives 601 samples; potential, acceleration, SOI and energy overlays activate; checkpoint restores G=1/dt=0.04/softening=0.02; keyboard warp endpoints 100× and 0.1× work; accelerated actual bodies remain finite. Screenshot: all-physics-overlays.png. Scrolled lower controls into view after an initial covered-element diagnostic; no app change needed.
- `python3 evidence/browser-extra.py persistence`: PASS 12 checks. Real keyboard input creates a second spacecraft, Vela, and continues through a temporarily incomplete negative delta-v input. Paused selection refreshes closest approach and projected elements. Local save/load and reload restore exact bodies, nodes and time. Exported bytes equal visible state; importing that file restores it. Invalid null-event JSON is rejected with state unchanged and a visible error. Screenshot: invalid-import-rejected.png. No uncaught app errors.
- Export tool investigation: agent-browser's `download` canceled in the recording-created browser context after receiving all 7,506 bytes. Offline-on/off and alternate directories behaved identically. Chrome download events exposed the context mismatch. Explicit `Browser.setDownloadBehavior` on that context, followed by the real labeled Export button, completed the download; `cdp-download.cjs` records this supplemental setup, and the browser-produced file is preserved as mission-export.json. Application export code was unchanged. Browser file upload also required an absolute path: relative paths produced a FileReader permission error. Absolute-path upload succeeded. These were tool integration issues, not application passes inferred from source.
- `python3 evidence/browser-mobile.py`: PASS 12 checks at 390×844 and DPR 2, no horizontal overflow. Real touch drag and two-finger pinch, panel navigation, body selection, editable maneuver, pause/step, keyboard Space, scrollable settings, help and scenario selection all work. Screenshots: mobile-orbit-390.png, mobile-telemetry-390.png, mobile-flight-plan-390.png, mobile-maneuver-map-390.png, mobile-settings-390.png, mobile-help-390.png, mobile-scenarios-390.png. Existing optional overlays were intentionally still enabled during these captures; a clean-default final capture follows.

## ISSUE-003 — spacecraft display scale and absent primary (fixed; retested below)
A final edge-flow check edited Odyssey to individual scale 2 with no assigned orbital primary. Real rendered radius remained 6 px (expected 12), and Add maneuver assigned Odyssey itself as its own burn primary. Screenshot: edge-display-scale-and-primary.png. Root causes: craft marker branch ignored individual scale; node creation used frame-origin fallback as an orbital-primary fallback. Fixed craft marker scaling and kept absent burn primary null (inertial basis); import validation now accepts null burn primaries. The unchanged real-browser regression also checks Cartesian execution, invalid past times and node deletion.


## Final results

All statuses below describe agent-authored checks of the delivered application; no evaluator-owned report was created.

| Area | Status | Evidence |
|---|---|---|
| Numerical integration and conservation | pass | physics.test.cjs; complete 26-test numerical/review run in logs/final-all-tests.txt |
| Real default motion, pause, step, restart, checkpoints | pass | browser-regression.py main; screenshots/desktop-active-workflow-1280.png |
| Maneuver prediction before burn and actual scheduled impulse | pass | At T+0.08 actual Δv=0.254950880177 DU/TU; numerical energy drift 1.1769e−14 and momentum drift 5.3241e−14. logs/burn-state.json |
| Two-burn transfer in actual simulation | pass | Hohmann impulses at T+8 and T+99.6914598696; energy drift −1.3458e−11 at T+112.89595. logs/hohmann-live.json |
| All seven presets and real collision/rewind | pass | browser-scenarios.py; logs/scenario-observations.json; screenshots/threebody-real-collision.png |
| Reference frames, coherent live trails and vectors | pass | browser-regression.py map; frame screenshots; aligned rotating moon/primary and near-zero rotating tangential velocity |
| Pointer selection/pan/zoom, paused position/velocity edits, map nodes | pass | real agent-browser mouse controls; explicit-coordinate CDP wheel supplement; browser-regression.py map |
| Settings, time warp, overlay controls and diagnostics | pass | browser-extra.py settings; all-physics-overlays.png; footer includes FPS, elapsed time, achieved warp, steps, body count, energy/momentum, frame and pause |
| Body editing, multiple spacecraft, orbital/Cartesian burns, scale | pass | browser-extra.py persistence and browser-edge.py; scale2 renders 12px craft marker; Cartesian actual Δvx=0.2, Δvy=−0.1 |
| Keyboard and input continuity, invalid values | pass | signed intermediate input retains focus; past node times and invalid G rejected; keyboard stepping, navigation and warp tested |
| JSON export/import and local persistence | pass | browser-produced mission-export.json; round-trip and reload exact-state comparison; invalid-mission.json rejected atomically |
| Desktop 1280×800 and larger | pass | screenshots/final-desktop-1280.png and final-mission-plan-1440.png |
| Narrow 390×844, DPR2, actual touch | pass | browser-mobile.py; final-mobile-clean-390.png; no horizontal overflow; actual single-touch drag and two-touch pinch |
| Direct file, offline, no external cached assets | pass | fresh orbital-final browser, offline on, all http/https requests aborted before file open; logs/fresh-final-network.txt contains only index.html and embedded blob worker |
| Browser console/uncaught errors in final flows | pass | logs/fresh-final-errors.txt and fresh-final-console.txt empty (0 bytes); diagnostic errors arrays empty |
| HTTP-server runtime | not-run | not needed: direct-file operation verified; no server was started |
| Other browser engines and physical mobile hardware | not-run | Chrome desktop with mobile viewport and genuine emulated touch tested |
| Audio | not applicable | application has no audio |

Issue retests: ISSUE-001 valid numeric settings now apply; ISSUE-002 main workflow readiness test passes without changing expectations; ISSUE-003 unchanged edge regression passes all 7 checks. Independent review fixes are verified by extracted real application functions and live browser flows. No unresolved application failures or blocked required checks remain. Tool-specific failed attempts and the exact supplements are retained above and in logs.

## Practical model limits

- Planar Newtonian N-body gravity with normalized DU/TU/MU, softened force and potential. Out-of-plane burns are unavailable by design; signed prograde/radial and inertial X/Y are supported.
- Periapsis, apoapsis, eccentricity, period and SOI are instantaneous two-body approximations inside a perturbed system. Closest encounters are numerically sampled estimates over the selected horizon.
- Encounter-limited Verlet uses a configurable maximum step. Extremely close or very stiff configurations can be slower; solver failures pause explicitly. Requested high warp may be capped by a per-frame work budget, and achieved warp is reported. No arbitrary-error-tolerance control is claimed for the fixed-step method.
- Checkpoints require their physics settings for a coherent energy baseline; malformed or incomplete checkpoints are rejected. Browser storage availability is environment-dependent, with JSON export available independently.

## Reproduction commands

From the delivery directory, no build or install step is required. Open index.html directly. Development checks use:

```bash
node --test evidence/physics.test.cjs evidence/application-review-regression.test.cjs
python3 evidence/browser-regression.py main
python3 evidence/browser-regression.py map
python3 evidence/browser-extra.py settings
python3 evidence/browser-extra.py persistence
python3 evidence/browser-mobile.py
python3 evidence/browser-scenarios.py
python3 evidence/browser-edge.py
```

The browser harnesses target the named orbital-file agent-browser session and expect the local index.html open there. They record each exact CLI command and output in logs/browser-regression.txt. Read the setup earlier in this record for offline routing. Supplementary CDP helpers use the browser URL discovered by agent-browser; their full source and event output are retained. They are not application runtime dependencies.

Final independent review: all final edge fixes approved; 26 combined numerical/application review tests passed, 0 failed. Review added null-primary maneuver creation, prediction, import acceptance and unknown-primary rejection. Main actual browser burn workflow reran successfully after these final fixes.
