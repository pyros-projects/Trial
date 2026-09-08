# ECHO — agent-authored validation

Artifact: `../index.html`. Browser: agent-browser 0.31.1 / Chrome 143.0.7499.40. Date: 2026-09-08.

The installed agent-browser SKILL.md and version-matched `agent-browser skills get core` and `skills get dogfood` were read before browser use. No substitute browser driver was needed. Supplementary CDP input was used for held / simultaneous keys and native touch events. Navigation and screenshots use agent-browser, with one explicit CDP high-DPI screenshot as described below.

## Commands and initial results

- `node evidence/tests/engine.test.cjs` initially failed because the engine did not exist (`logs/engine-red.txt`). After implementation, five real-engine checks passed (`logs/engine-green.txt`): six valid built-ins; ground/jump; plate input replay and independent new player; deterministic restart; rejection of malformed levels.
- Extracted the actual inline script and compiled it using `new Function(...)`: pass, no syntax errors.
- `agent-browser --session echo --allow-file-access open file:///home/pyro/projects/naked/astra/bench/17-echo-loop-puzzler/index.html`
- `agent-browser --session echo set viewport 1280 800`
- `agent-browser --session echo network route 'https://**' --abort` and `network route 'http://**' --abort`.
- Snapshot, `errors`, `console`, screenshot `screenshots/01-intro-desktop.png`: direct-file load pass; no browser errors or console output. Actual game at frame 0, READY, no network dependencies. Desktop initial layout visually inspected; timeline was below fold, to be compacted before final retest.

## Completed behavioral checks

The scripts under `tests/` use real CDP `Input.dispatchKeyEvent`, mouse or touch events. They do not set player coordinates, modify the simulation, or call game internals to solve puzzles. `window.echoDiagnostics` is a read-only snapshot used for assertions. All navigation, dialogs, field edits and downloads use agent-browser. Screenshots use agent-browser except the explicit CDP high-DPI capture. The wrapper `tests/ab` expands to `agent-browser --namespace echo17 --session echo` after the browser recovery described below.

| Check | Result and evidence |
|---|---|
| Intro, plate and cooperative exit | **PASS.** `node evidence/tests/intro-flow.cjs`, then held ArrowRight to goal: recorded plate (frame 76 in the final repeat), echo independently held A at x308.8611, player stayed x96, door opened, victory at frame 333 with one echo and zero divergence. `logs/intro-plate.json`, `intro-echo.json`, `intro-victory.json`; screenshots 03–05. |
| Timeline inspection and frame-step | **PASS.** Clicked `#scrub`: current frame 87 remained unchanged while preview inspected frame 44. Resume returned to original world. `#stepButton` advanced paused frame 128 to 129. Final regression also asserts exactly one frame. Screenshots 04, 08. |
| Carry/drop replay | **PASS.** In chamber 3, moved with held arrows, E picked up a cell, carried it, E dropped, R recorded; 122 live samples matched original actor x/y/carry at identical frame indices, max error 0. `logs/carry-replay.json`. This first trace predates the drop/clearance fixes below; the full handoff chamber was re-completed after those fixes. |
| Undo echo, clear, deterministic restart | **PASS.** Undo returned echo count to 0, frame to 0 and closed door. `input-regression.cjs` compared entire before/after initial world snapshots after actual movement and Restart. `throw-resets.cjs` created five echoes, verified cap/paused state, undid to four, and cleared to zero/frame 0. |
| Chamber 2: cooperation, pushing, jumping | **PASS.** `node evidence/tests/chambers-flow.cjs`: echo held A; player pushed cell to B, jumped over it and completed the chamber. `logs/chamber-2-victory.json`, screenshot 28. |
| Chamber 3: actual object handoff | **PASS after fix.** Same script: echo carried/dropped cell, independent player took it, jumped up both steps while carrying, placed cell on raised A and reached exit. One echo, zero divergence. `logs/chamber-3-victory.json`, screenshot 29. |
| Chamber 4: moving-platform timing | **PASS.** `node evidence/tests/lift-flow.cjs`: recorded echo on A, waited for returning lift, jumped on, measured actor feet aligned to moving platform, rode upward, jumped to upper walkway, won. `logs/lift-ride.json`, `chamber-4-victory.json`, screenshot 31. |
| Chamber 5: laser, death, retry, timed door | **PASS.** `node evidence/tests/hazard-flow.cjs`: actual laser overlap caused death at frame 113; Retry restored frame 0/x96. Echo disabled laser, E opened timed door, 305 frames later it was closed, E retriggered it and player completed level. `logs/hazard-death.json`, `hazard-victory.json`, screenshots 23–24. |
| Chamber 6: multi-echo and toggle | **PASS.** `node evidence/tests/final-flow.cjs`: echoes held A and B independently, player placed cell on C, jumped over it, toggled D and reached final exit. Two echoes, zero divergence. Final victory modal and solution download exercised. `logs/final-victory.json`, `final-solution.json`, screenshots 25–26. |
| Throw and exact-time replay | **PASS.** `node evidence/tests/throw-resets.cjs`: E pickup, Q launched cell upward/forward, R echo reproduced it. Paused and frame-stepped replay to original frame before comparing cell position (within .001 px). `logs/throw-replay.json`, screenshot 33. |
| Significant interaction divergence | **PASS.** `node evidence/tests/divergence-flow.cjs`: new player took the shared cell before the echo's delayed pickup. Echo had 0 positional drift but failed recorded carry intent. Actual diagnostic warning `Recorded carry state changed` surfaced after sustained mismatch. `logs/divergence-detected.json`, screenshot 34. |
| Editor create/configure/play-test | **PASS**, repeated after fixes. `node evidence/tests/editor-flow.cjs`: New, named level; pointer placed plate, door, cell; labeled fields configured IDs, B channel, widths. Undo/redo width, duplicate/delete cell, Shift multi-select. Save, New, Load restored six objects; play-test echo on B opened B door; return preserved design. `logs/editor-built.json`, `editor-playtest.json`, screenshot 13. |
| Local persistence, export and import | **PASS.** Saved named `Validation chamber`, reloaded actual file page, selected and loaded slot. Downloaded `editor-level.json`. Imported that actual file using absolute path and waited for file text, then Validate & import restored six objects. |
| Invalid JSON and inert imported text | **PASS.** Submitted `{"name":"broken","objects":[]}`: visible validation errors and no editor replacement. `editor-edge.cjs` imported a name containing `<img ... onerror=...>`: rendered as text, no image node and no execution. Undo restored design. Screenshots 14, 36. |
| Editor pan/zoom/rotation/invalid geometry | **PASS after overlay fix.** `pan-retest.cjs` imported then panned via pointer +80,+35 at 125% zoom. `editor-edge.cjs` rotated door, undid, deleted spawn, verified clear validation error and refused play-test; undo restored validity. `logs/editor-pan.json`, screenshots 18, 35. |
| Narrow viewport, touch, input continuity | **PASS.** `mobile-flow.cjs` at 390×844 used native two-finger touch move+jump, then touchCancel; both actions cleared and vx settled to 0. It also completed intro using pointer/touch controls and one echo, zero divergence. `input-regression.cjs` held remapped L across desktop→narrow resize and movement continued. `logs/mobile-touch.json`, `mobile-victory.json`, screenshots 20–22. |
| Focus loss | **PASS.** `input-regression.cjs` opened/activated a real blank browser tab while ArrowRight was held. Original app paused, cleared input, and frame remained stable; reactivated original tab. `logs/input-focus.json`. |
| Remapping, slow motion, accessibility | **PASS.** Settings remapped Right to L via real key, enabled reduced motion/flash/contrast, and restored defaults. ¼-speed simulation advanced within 12–18 frames over measured 1000 ms; paused frame-step advanced exactly 1. `logs/slow-motion.json`, screenshot 32. |
| Procedural audio | **PASS for activation/state only.** Clicked Enable sound / Play test tone with user gesture. AudioContext was `running`, generated oscillator count increased. No claim of having heard or assessed sound quality. |
| Physical gamepad | **BLOCKED for hardware testing.** No controller available. Gamepad polling, deadzone, alternate buttons, pause and disconnect handling are implemented; physical operation was not verified. |

## Failures, diagnosis, fixes and retests

- **Initial desktop layout:** timeline below fold at 1280×800 (01). Reduced short-desktop spacing/scene height and pinned live diagnostics; retested screenshots 06 and later.
- **Pause overlay intercepted diagnostic controls:** real click rejected as covered by `#pauseOverlay`. Raised stage controls / allowed only pause card to intercept input. Later paused diagnostics and frame-step clicks passed.
- **Editor import exposed a play pause panel:** screenshot 15b/16 and failed pointer-pan assertion reproduced it. `closeModal()` called `updatePause()` while editor mode was paused. Added mode guard to hide play overlay in editor. Reimport and exact +80,+35 pan passed; screenshot 18/19.
- **Missed pickup did not report divergence without position drift:** `physics-red.txt` was not used to claim success. New engine regression failed; comparison now includes recorded carry/death state. Engine and actual browser deliberate-interference test pass.
- **Malformed channel object threw inside validator:** `physics-validation-red.txt` captured the exception. Validate channel type before iterating it; validate optional enums/booleans. Malformed metadata tests now return errors safely.
- **Dropped cell lifted actor onto it:** actual first carry trace showed player rising after drop; `drop-red.txt` reproduced at y386 instead of 422. Drop now places cell beside actor with geometry clearance. Regression and browser chamber 3/final cell placement retests pass.
- **Carried cell automatically dropped at ledge:** actual chamber 3 attempt failed, cell remained at step base; `carry-clearance-red.txt` reproduced. Carried shape now blocks movement into geometry and permits jumping over it while held. Engine regression and full chamber 3 repeat pass.
- **Toast intercepted timeline click:** final puzzle test rejected `#scrub` as covered by toast. Made informational toast noninteractive. Repeated timeline click/inspection passed.
- **Editor Load click was partly below viewport:** first harness click center was y800.45 in an 800 px viewport and did not activate. Explicit scrolling made it work; harness now brings target center into view. No save/load implementation change; repeat passed.
- **Final-puzzle unsuccessful attempt:** walking forward after dropping cell pushed it off C; D was active but gate correctly stayed closed. Corrected play sequence by jumping over the cell. Full final victory then passed. This was expected physics, not an app defect.
- **Throw test initially compared different frames:** first comparison used a pre-pause sample against a later replay. Harness now pauses early and uses the actual frame-step button to reach identical frame before comparing. Exact-time check passes.
- **Browser/tooling interruption:** CDP calls timed out during relative-path upload. Another concurrent global browser close was also observed during investigation; isolated subsequent work in `echo17` namespace. Repeated relative upload left the tooling unresponsive. Ran `agent-browser doctor --offline --quick` (all checks passed), recovered only this session, switched to absolute input file path and an explicit file-ready wait. Absolute-path import succeeded repeatedly. Earlier affected checks were not counted as passes. No alternate automation framework was substituted.

## Final review, fixes and retests

- **PASS: editor drag and resize.** `node evidence/tests/editor-drag.cjs`: Shift-selected plate and cell, dragged both +40 px, dragged cell resize handle from 40×36 to 80×20, then Undo restored dimensions. `logs/editor-drag-resize.json`, screenshot 37.
- **PASS: final victory navigation.** Repeated the final puzzle after carrying fixes, exported the solution trace and clicked the final victory action to enter a valid editor.
- **Gamepad ready-state bug:** actual extracted polling function failed to start the first loop (`logs/gamepad-red.txt`). Input now starts play with pause/modal/editor guards. `gamepad.test.cjs` passes seven simulated-device cases; this is **not physical hardware coverage**.
- **Minimum-size geometry crash:** actual editor-created 4×4 goal produced a negative-radius Canvas RangeError and stopped rendering (screenshot 38; full exception in `logs/historical-tiny-geometry-error.json`). Guard nonpositive inner rectangles and clamp radius. `review-regression.cjs` recreated a 4×4 goal AND cell, then reached that goal in a running play-test (40). **PASS.**
- **Campaign victory after play-test:** review reproduced stale victory bookkeeping after winning a custom test. Saved campaign state now includes victory/event bookkeeping. Browser regression recorded a campaign echo, paused before its exit, entered editor, won a custom play-test, returned, finished original campaign and asserted that the campaign victory dialog appeared. **PASS**, screenshot 41, `logs/campaign-after-test-victory.json`.
- **Keyboard activation of buttons:** Enter on focused Editor previously began gameplay instead (`logs/keyboard-button-red.txt`). Native Space/Enter activation is preserved and gameplay returns focus to its canvas. Actual Editor/Enter and Settings/Space passed (39). Full intro recording and touch-only cooperative victory were repeated after this change.
- **Zero-travel lift:** travel 0 previously fell through to default −160 (`logs/lift-zero-red.txt`). Nullish defaults now preserve zero in engine, drawing and validation. Stationary-lift test passed. A null object is also safely rejected by validation.
- **High-DPI screenshot harness:** the first CDP viewport override changed page metrics but agent-browser retained its larger screenshot clip. Corrected by setting the browser-tool viewport as well and capturing the exact CSS viewport through `Page.captureScreenshot`. This was a capture mismatch, not horizontal document overflow. The corrected 780×1688 screenshot was visually inspected.
- **Preview/diagnostics overlap:** during visual inspection the paused preview caption covered two diagnostic lines. Moved it below the diagnostic panel when diagnostics are enabled. Final desktop and narrow screenshots show both panels legibly (42–43).
- **Historical error buffer:** `agent-browser errors --clear` continued returning the pre-fix Canvas exception. `--json` exposed its full stack. Preserved it, closed only this task's browser session, opened a fresh browser, blocked both HTTP and HTTPS before direct-file navigation and repeated the previously failing tiny-geometry/campaign flow. Final audit below distinguishes fresh results from that historical exception.

## Final verification commands and results

All commands run in the application working directory. `tests/ab` expands to `agent-browser --namespace echo17 --session echo`.

```sh
node evidence/tests/engine.test.cjs
node evidence/tests/physics.test.cjs
node evidence/tests/gamepad.test.cjs
node evidence/tests/artifact.test.cjs
node evidence/tests/intro-flow.cjs
node evidence/tests/final-display.cjs
node evidence/tests/mobile-flow.cjs
node evidence/tests/review-regression.cjs
```

- **PASS:** 5 engine checks and 14 additional physics/validation checks on the actual delivered simulation. The separate gamepad polling test passes simulated start/jump, idle, pause, modal/editor guards and disconnected-device cases. Logs: `final-engine-tests.txt`, `final-physics-tests.txt`, `final-gamepad-tests.txt`.
- **PASS:** one inline script compiles; no remote asset attributes, imports, fetch or XMLHttpRequest in artifact (`final-artifact-tests.txt`). The only HTTP-looking source string is the SVG XML namespace inside the embedded data favicon, which is not a network fetch.
- **PASS:** final real-key intro record/reset comparison: echo holds A at x308.8611 while the independent new player stays x96, with zero divergence. Native mobile multi-touch/cancellation and a complete touch-only cooperative victory were repeated after the keyboard focus change.
- **PASS:** 1280×800 desktop and 390×844 narrow display. At DPR 2, game canvas is 720×636 for CSS 360×318 and timeline 672×154 for CSS 336×77. Body width stays 390; fixed live overlay remains within the viewport. Real pointer timeline inspection after resizing preserves paused frame, echo count and actor states. `logs/final-high-dpi.json`, screenshots 42 and 43.
- **PASS:** final review browser regression on a fresh direct-file browser: 4×4 goal/cell render and function; winning a play-test does not suppress the restored campaign victory. `logs/final-review-regression.txt`.

### Fresh direct-file and request audit

```sh
evidence/tests/ab close
evidence/tests/ab open about:blank
evidence/tests/ab network route 'https://**' --abort
evidence/tests/ab network route 'http://**' --abort
evidence/tests/ab set viewport 1280 800
evidence/tests/ab open file:///home/pyro/projects/naked/astra/bench/17-echo-loop-puzzler/index.html
node evidence/tests/review-regression.cjs
evidence/tests/ab errors --json
evidence/tests/ab console --json
evidence/tests/ab network requests --json
```

The direct-file check is **PASS**, not blocked and not a localhost substitute. External HTTP/HTTPS were blocked in the fresh browser before opening the file. No external assets or cached external resources are needed. **Fresh results: zero uncaught errors, zero console messages, and one successful file-document request (200); no failed or external requests.** Exact tool JSON is preserved in `logs/browser-errors-final.json`, `logs/browser-console-final.json` and `logs/network-final.json`. The pre-fix buffer is preserved separately in `logs/browser-errors-historical.txt` and `logs/historical-tiny-geometry-error.json`.

## Coverage limits

- **BLOCKED:** physical gamepad testing; no controller was available. The implementation's actual polling function was tested with simulated device input, separately labeled.
- **NOT-RUN:** subjective listening/audio-quality evaluation. Procedural audio was explicitly enabled by a user gesture; only running AudioContext and generated oscillator state were verified.
- No known unresolved application failure from the exercised flows. The evidence demonstrates these particular interactions and regressions; it does not prove arbitrary custom levels are solvable or cover every browser/device.

