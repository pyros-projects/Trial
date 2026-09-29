# APEX FPV validation

Agent-authored evidence. No evaluator report or score is claimed.

Artifact: `../index.html`. Runtime: inline CSS, two inline JavaScript blocks, generated WebGL geometry/shaders, Web Audio oscillators/noise. No imported libraries, external fonts, textures, models, audio or services.

Tools: installed `agent-browser`; read `.agents/skills/agent-browser/SKILL.md`, then `agent-browser skills get core`, `agent-browser skills get core --full`, and `agent-browser skills get dogfood`. Testing uses its actual browser, accessibility snapshots, clicks, keydown/keyup, pointer events, screenshots, console/errors and read-only live `window.apex.getState()` diagnostics. No benchmark/evaluator fixtures modified.

## Implementation checks

- `node evidence/tests/core.test.cjs` — initial RED with absent artifact recorded in `logs/core-red.txt`.
- The agent-authored pitch displacement and ground-center expectations initially failed due to incorrect assumptions: expo reduces the one-second translation to 0.672 m; floor is -0.12 m and collision radius is 0.34 m. Corrected the tests to the independent physical behavior/hand-defined floor. These were not benchmark tests.
- Final core run: PASS 18 assertions (thrust/gravity, independent yaw/pitch/roll, leveling vs acro, normalized quaternion after 4000 steps, fast swept crossing, missed/reverse gates, order, two gate advancement, ground collision, reset, seed determinism, import rejection).
- Extract inline scripts into `/tmp/apex-script-*.js`; `node --check /tmp/apex-script-1.js` — PASS syntax.

## Browser checks (ongoing)

Session launched empty, then external HTTP/HTTPS requests blocked before first navigation:

```
agent-browser open
agent-browser network route 'https://**' --abort
agent-browser network route 'http://**' --abort
agent-browser set viewport 1280 800
agent-browser open file:///home/pyro/projects/naked/sol61/13-drone-racing/index.html
agent-browser snapshot -i
agent-browser screenshot evidence/screenshots/desktop-initial.png
agent-browser errors
agent-browser console
```

Direct-file, rendered-state and workflow outcomes will be recorded from actual observations below.

### Observed desktop flight checks — PASS

Opening `file:///home/pyro/projects/naked/sol61/13-drone-racing/index.html` succeeded at 1280×800 with blocked HTTP/HTTPS, no resource entries, no browser errors/console messages, WebGL `getError() === 0`, approximately 60 FPS and 1015×416 internal pixels. Screenshots use absolute paths because the browser daemon did not write relative screenshot paths into the workspace.

Real input sequence:

```
agent-browser click 'button[aria-label="Enable engine audio"]'
agent-browser click '#armBtn'
agent-browser keydown w
agent-browser wait --fn 'apex.getState().time > 0.5'
agent-browser keyup w
agent-browser keydown s
agent-browser wait --fn 'apex.getState().time > 1.2'
agent-browser keyup s
agent-browser press h
agent-browser keydown ArrowUp
agent-browser wait --fn 'apex.getState().gate >= 2'
agent-browser keyup ArrowUp
agent-browser press p
```

W raised throttle to 0.5606; altitude rose from 2.6 to 3.3279 m with vertical velocity 2.2623 m/s at 0.5583 s. After restored hover throttle and real forward-pitch input, gates 01 and 02 cleared in order. Paused state: gate index 2 (next 03), position `[0,4.7851,-71.2890]`, forward speed 14.4313 m/s, quaternion `[-.2331,0,0,.9725]`, flight time 9.6917 s, sectors 6.3417 and 3.2667 s, no collisions/penalties, 179 live telemetry samples. Screenshot: `screenshots/two-gates.png`.

Audio enabled via actual click: AudioContext `running`, audio enabled, motor-linked oscillator observed around 208–216 Hz. Audio quality was **not heard**; this checks gesture activation and live procedural audio state only.

Independent yaw: after Restart → Arm → held D until `abs(q[1]) > .15`, then release/pause: quaternion `[0,-.1825,0,.9832]`, yaw rate -1.3691 rad/s, X/Z position unchanged. Independent roll: Restart → Arm → ArrowRight until X > .5, release/pause: position `[.6322,3.2544,14]`, quaternion `[0,0,-.2406,.9706]`; forward Z unchanged. Pitch and throttle are established above.

### Collision, recovery, cameras and flight modes — PASS

Using actual range inputs in Settings (`focus '#hold'; press Home`, same for `#antiCrash`) disabled ground/altitude assists. Resume → hold S until throttle < .02 → wait for collisions > 0 → pause. Observed ground contact at `[5.2853,.2574,14]`, rebound vertical velocity .8839 m/s, one collision, +2 s penalty, finite unit quaternion. Screenshot `screenshots/terrain-collision.png`.

Press F: recovered before Gate 01 at `[0,5,-13]`, velocity zero, identity quaternion; penalty became +7 s (contact +2, recovery +5). With physics paused, clicked labeled Chase, Orbit and Trackside camera buttons; p/v/q/time were identical in all modes (`time=2.3167`). In Orbit, actual mouse down/move/up rotated the view without altering craft state. Screenshot `screenshots/orbit-view.png`.

Compared actual Flight mode select values with the same 0.2 s roll pulse and release until 1.1 s:
- Acro at 1.2083 s retained `qz=-.285883`, `qw=.958264`, roll rate approximately zero.
- Angle at 1.2083 s returned to `qz=-.0000143`, `qw≈1`.
- Horizon with a 0.6 s pitch pulse produced a substantial rate-mode tilt and forward movement (`qx=-.6974`, Z=13.0963). All modes alter simulated attitude; cameras remain independent.

Restored assists with slider End; recovered → flew using ArrowUp through Gate 01 in 2.55 s, confirming the recovery flow remained playable.

### Failures found and repaired

1. **FAIL, fixed:** Initial finish gate at Z=8 obscured first gate from the starting position (see `desktop-initial.png`). Moved finish to Z=30, behind the initial heading. Retested the first two checkpoint flight after the move; PASS. Corrected standby screenshot `desktop-final-initial.png`.
2. **FAIL, fixed:** Browser accessibility snapshot showed unnamed range controls. Root cause: nested output was the first labelable element in the wrapping label. Assigned explicit accessible names to generated inputs. Reloaded snapshot now includes named Gravity, Thrust-to-weight, assists, camera, render, audio and dead-zone sliders; PASS.
3. **FAIL, fixed:** Code-level test established later-gate crossing had no order-warning event. Added out-of-order feedback without advancing the race. Failing and passing logs in `logs/core-repair-red.txt` / `core-repair-green.txt`.
4. **FAIL, fixed:** Course JSON omitted difficulty, and optional replay sector metadata was not validated. Added difficulty round-trip and sector/mode/penalty validation; whole core suite PASS. Actual import/export browser retest follows.
5. **Harness-only:** A browser eval redeclared a top-level `const s`; browser reported a SyntaxError in that eval. Changed all diagnostic reads to IIFEs. This was not an application exception.

The compact flight OSD now also includes lap, live sector, best delta, collision state and penalties. Remaining browser checks are below.

## Final review and repairs

A fresh, read-only reviewer inspected the artifact and ran real-core probes. It identified five important defects. All were addressed and retested:

- **Course obstruction:** The first recovered lap encountered one contact and spent 24.9167 s in sector 07. The former fixed landmark overlapped Gate 07; the reviewer confirmed seed 3 / Pro could have its entire aperture blocked. Moved landmarks into `generateCourse` and subjected every obstacle and landmark to route-clearance checks. Shared generated profiles now drive both rendering and collision. A second actual browser lap cleared every gate, including 07, with **zero collisions**. It used F once per approach, so its result was **20.800 s flight + 40 s recovery penalties = 1:00.800**. Its eight sectors were 2.575, 2.6583, 2.5833, 2.5833, 2.5833, 2.6000, 2.6167, 2.6000 s. 501 transforms were saved. Evidence: `screenshots/lap-complete-retested.png`.
- **Replay interruption:** Reproduced by Watch replay → select Acro with no saved Acro best. The prior RAF threw `TypeError: Cannot read properties of null (reading 'frames')`. Selecting a flight mode now exits replay before loading a different recording. Repeated the same real controls; replay became inactive, best null, Acro selected, frame timing continued, and errors were empty in the isolated session. Repeated again after later repairs.
- **Obstacle mismatch:** Square colliders were inconsistent with tapered sandstone and pine branches. The delivered core now calculates shared, height-dependent polygon hulls; canyon ring vertices are also the renderer's vertices. Pines use trunk/canopy cross-sections; industrial roof and antenna dimensions are included. Real-core tests first failed for the wide mesa base, then passed for the solid base, clear upper space, solid pine canopy, and empty space below its branches. Logs: `review-red.txt`, `review-green.txt`. Course collision volumes in Diagnostics use these profiles.
- **Imported difficulty:** Shared `setDifficulty()` now applies gate dimensions and assists to both UI changes and JSON imports. Uploaded `tests/pro-seed3.json` through the file input: seed 3, difficulty Pro, Gate 07 width 6 / height 5, altitude hold 0, ground assist 0. Uploading the authentic Rookie export restored seed 4821, hold .85 and the saved replay. PASS.
- **Controller discovery while a drawer is open:** Device discovery and normalized axis sampling now continue independently of flight actions. Browser integration test supplied a clearly labeled synthetic Gamepad API object while the Controller drawer remained open. The visible device status updated; calibration recorded offsets `[.080,-.100,.160,-.200]`; after axis changes, the visible normalized yaw/pitch/roll were .4545 / .4318 / .5909; clicking Invert roll produced negative roll. Restoring native `getGamepads()` returned the no-controller message. This validates the application integration, **not physical hardware**.

The reviewer’s preset-validation finding was treated as a correctness defect: inherited names `constructor`, `toString` and `__proto__`, and supplied invalid difficulty values, are now rejected by real-core tests. No review defect remains knowingly unfixed.

Additional repairs made during validation:

- Leveling initially measured tilt in world axes. A real-core 90° yaw probe showed erroneous orthogonal movement, and `yaw-level-red.txt` failed. Feedback now measures gravity in body coordinates. `yaw-level-green.txt` and the complete lap with changing headings passed.
- The starting pad is now a solid .19 m landing surface; the old center height clipped through it. The test failed in `pad-red.txt`, passed in `pad-green.txt`, and the rest of the suite stayed green.
- Contact shadows now occupy a separate draw buffer so the lighting quality control can enable/disable them live. Corrected mesh winding for directional surface normals.
- **DPR-only resize failure:** At 1280×800, switching devicePixelRatio from 1 to 2 initially left performance buffers at 609×250. The animation loop now detects a changed display density. Retest at Balanced quality: DPR 2 gave **2030×832** world and HUD buffers. At 390×844 / DPR 2: **716×820**, horizontal scroll width exactly 390. PASS.
- A ghost at the exact FPV camera position obscured standby on the narrow view (`mobile-before-ghost-fix.png`). Nearby ghost geometry is now hidden within 1.25 m; the recorded line remains available. Moved narrow-view readiness text to the sky and joystick labels above the seed label. Visually reinspected `mobile-final.png`; PASS.
- Actual flight outside Gate 01 showed a missed warning but the checkpoint card still said “Start line.” Fixed the card's condition order. Repeated the real roll-then-pitch miss: gate stayed 0 and the card became “MISSED · Return to Gate 01.” F cleared the miss; physical forward flight then passed two ordered gates. Evidence: `missed-gate.png`, `missed-gate-retested.png`.
- Setting Auto-level strength to zero initially removed pitch/roll authority in Angle. Real-core RED in `assist-zero-red.txt`. The assist now blends between angle feedback and manual rates; zero strength preserves pilot input. GREEN in `assist-zero-green.txt`; browser slider Home → Arm → ArrowUp produced `qx=-.2582`, nonzero pitch rate and forward movement at .2583 s. Default-strength regression remained green.

## Isolated browser validation

The initial unnamed browser session was shared with unrelated work and was later navigated away externally. The failed `apex is not defined` reads and missing import controls in that attempt were a **harness/session failure**, not application failures. That interrupted attempt is not counted as a pass; its screenshot is retained as `harness-session-mismatch.png`. Continued in isolated sessions `apex-drone-sol61`, `apex-regression-sol61`, and `apex-fallback-sol61`. The isolated browser started with a new profile and blocked all HTTP/HTTPS before file navigation. Subsequent import, replay, controller, resize, error and network checks below were repeated there. `final-network.json` and `clean-regression-network.json` contain only this application's `file://` document loads.

### Exact full-lap command sequence

Executed against the real browser after the course repair; no simulation position/checkpoint mutation API was used:

```bash
export AGENT_BROWSER_SESSION=apex-drone-sol61
agent-browser reload
agent-browser click '#armBtn'
for target in 1 2 3 4 5 6 7 8; do
  agent-browser press f
  agent-browser keydown ArrowUp
  agent-browser wait --fn "apex.getState().gate >= $target"
  agent-browser keyup ArrowUp
done
agent-browser screenshot /home/pyro/projects/naked/sol61/13-drone-racing/evidence/screenshots/lap-complete-retested.png
agent-browser click '#resultReplay'
agent-browser wait --fn 'apex.getState().replay.time > 0.5'
agent-browser select '#flightMode' acro
agent-browser wait --fn 'apex.getState().replay.active === false'
```

This is a recovered lap used to exercise timing, ordering, penalties, finish, saving and replay. It is not represented as an uninterrupted skilled lap.

### Import, export, persistence and replay — PASS

Real file controls and downloads:

```bash
agent-browser click 'button[data-page="replays"]'
agent-browser download '#exportBtn' /home/pyro/projects/naked/sol61/13-drone-racing/evidence/course-export.json
agent-browser upload '#importFile' /home/pyro/projects/naked/sol61/13-drone-racing/evidence/tests/invalid-course.json
agent-browser upload '#importFile' /home/pyro/projects/naked/sol61/13-drone-racing/evidence/tests/malformed.json
agent-browser upload '#importFile' /home/pyro/projects/naked/sol61/13-drone-racing/evidence/tests/invalid-preset.json
agent-browser upload '#importFile' /home/pyro/projects/naked/sol61/13-drone-racing/evidence/tests/pro-seed3.json
agent-browser upload '#importFile' /home/pyro/projects/naked/sol61/13-drone-racing/evidence/course-export.json
agent-browser focus '#replayScrub'
agent-browser press End
agent-browser mouse move 1085 427
agent-browser mouse down left
agent-browser mouse up left
agent-browser click '#stopReplay'
agent-browser click '#closeDrawer'
agent-browser reload
```

Malformed JSON, seed -1 and inherited preset `constructor` produced descriptive errors and preserved the current seed/preset/best. Valid Pro and authentic exported Rookie files imported successfully. Replay range End showed the final pose, and an actual pointer click on the range showed a paused pose at **10.368 s**. Read-only diagnostics saved to `logs/replay-midpoint.json`; comparison to the exported frames matched the exact linear position / normalized quaternion interpolation to 1e-9. Reload restored 501 recorded transforms and best 60.800 s from localStorage.

Ghost visibility was tested using the real checkbox and rendered HUD data: turning it off changed **2243 HUD pixels**, with physics paused. Captured `ghost-on.png` and `ghost-off.png`. No simulation state was injected. PNG button downloaded actual combined world/HUD output; its PNG signature and dimensions **1015×416** were checked in Node. File: `screenshots/final-exported-flight.png`.

### Seeds, presets, free flight, tuning and diagnostics — PASS

- Courses → seed field 1337 → Generate twice: identical gate data, p `[0,2.6,14]`, zero time/checkpoints each time. Third gate changed from the default to `[20.8441,6.5350,-115.5162]`.
- Clicked Freight yard and Alpine drift course buttons, closed panels and inspected rendered industrial towers/containers and pine terrain. Screenshots `industrial.png`, `forest.png`. No network assets.
- Free flight select → Arm → ArrowUp until Z < -30 → pause: p `[0,4.9507,-30.7889]`, time 5.3917 s, zero collisions, checkpoint 0 and empty sector array. Time trial select reset the race and re-enabled ordered gates.
- Quality select Performance: **609×250**, resolution .6, 20% particles, simple lighting; Ultra: **1320×541**, resolution 1.3, 100% particles, full lighting; then Balanced restored **1015×416**. Changed FOV and camera tilt to 125° / 45° using real sliders: physical p/q unchanged.
- Settings opened while ArrowUp was held: physics paused at .375 s. Released key and closed: simulation resumed with pitch input zero; no stuck key. Next two gates passed.
- Diagnostics navigation displayed live p/v/a, normalized quaternion, angular rates, controls, 8.333 ms integration, frame timing, mass/inertia, collision/penalties, checkpoint, buffers, audio and replay data. After closing Diagnostics and choosing Chase, world axes, velocity/acceleration vectors and shared collision volumes were visible (`diagnostic-vectors.png`). At .6 s: velocity `[0,1.89,-2.35]`, acceleration `[0,1.01,-5.38]`, nonzero angular/body attitude; telemetry is derived from live state.

### Desktop, narrow viewport and input continuity — PASS

Normal 1280×800: final two-gate regression had 60.01 FPS, 1015×416 buffers, p `[0,4.9506,-70.5935]`, no collisions, no penalties, sector times 5.2000 / 3.2833 s, 156 telemetry samples (`logs/final-two-gates.json`, `desktop-final-flight.png`).

Exact narrow input steps:

```bash
agent-browser set viewport 390 844 2
agent-browser click '#armBtn'
agent-browser mouse move 318 490
agent-browser mouse down left
agent-browser mouse move 318 461
agent-browser wait --fn 'apex.getState().p[2] < 12'
agent-browser mouse up left
agent-browser click '#armBtn'
```

The joystick pitched the body and moved it from Z=14 to **11.8397**, velocity Z=-4.3767, `qx=-.2245`. Release zeroed inputs. This used real browser PointerEvents, not injected flight state; physical multi-touch hardware was not tested. The initial same-size DPR transition failure was repaired and retested as above. Final narrow capture is 390×844 CSS pixels / DPR 2 with 716×820 internal dimensions, no horizontal scrolling, readable controls and responsive settings. `mobile-final.png` is a full-page screenshot.

Held ArrowUp across `set viewport 390 844` → `set viewport 1280 800`: continued forward movement to Z=6.3720, speed 7.1530 m/s, then keyup zeroed the input. Stable coherent projection and render buffers; no console errors.

### WebGL fallback — PASS

The first fallback attempt lost its launch flag between CLI commands and timed out; it was not counted as a pass. Repeated with the launch setting preserved on every command via environment:

```bash
export AGENT_BROWSER_SESSION=apex-fallback-sol61
export AGENT_BROWSER_ARGS=--disable-webgl
agent-browser open
agent-browser network route 'https://**' --abort
agent-browser network route 'http://**' --abort
agent-browser set viewport 1280 800
agent-browser open file:///home/pyro/projects/naked/sol61/13-drone-racing/index.html
agent-browser wait --text 'WebGL is unavailable'
agent-browser screenshot /home/pyro/projects/naked/sol61/13-drone-racing/evidence/screenshots/webgl-fallback.png
```

Actual `getContext('webgl')` returned null. The fallback was visible with hardware-acceleration/browser guidance; motors stayed unarmed, no resource entries and no uncaught errors.

## Final automated regression and coverage limits

`tests/browser-regression.sh` records the exact clean-browser workflow using semantic button names, real throttle/pitch keys, two ordered gates, pause, independent camera switch, retina/narrow resize, screenshot, audio state and error/network logs. Run with:

```bash
bash evidence/tests/browser-regression.sh
node evidence/tests/core.test.cjs
node evidence/tests/course-coverage.cjs
node --check /tmp/apex-verified-0.js
node --check /tmp/apex-verified-1.js
```

The first semantic lookup used the snapshot's appended “SPACE” and did not match the tool's partial-name locator. Changed the agent-authored harness to match “Arm & fly”; no app behavior or benchmark requirement was modified. The completed clean regression is captured in `logs/clean-regression-run.txt`, `clean-regression-state.json`, `clean-regression-errors.json`, `clean-regression-console.json`, `clean-regression-network.json` and `screenshots/clean-regression-*.png`. It exercised audio gesture state, genuine physical gate crossings, telemetry and camera/resize continuity in a newly launched browser.

Core coverage: independent inputs, gravity/thrust, motor response, body-axis leveling after yaw, zero-assist pilot authority, Angle vs Acro, long-run finite normalized orientation, ground/pad/obstacle collision geometry, swept fast gate crossing, reverse/missed/out-of-order gates, reset/determinism, strict import metadata and replay interpolation. Course coverage: **168 actual-core flown approaches across 21 seed/preset combinations with Pro-sized gates**, zero collisions; **849200 obstacle/route checks across 3000 seeded courses**. Generation also enforces the same clearance rule for every seed by construction; sampling is not claimed to be an exhaustive enumeration of all 2³² seeds.

Final artifact has no external asset references and no runtime imports/fetches. All image assets and media are procedural or embedded. Opening the file directly was genuinely tested; no HTTP-server substitution was needed. Fresh browser logs show no uncaught application errors, console messages or external/failed requests after the fixes.

| Coverage | Status | Limit |
|---|---|---|
| Direct file / offline dependencies | PASS | Tested in headless Chromium; no server needed |
| Main desktop flight and first two ordered gates | PASS | Actual controls and live physics |
| Complete race / penalties / best / replay | PASS | Full browser lap used eight explicit recoveries |
| Collision, miss, recovery, restart and cameras | PASS | Actual terrain/missed-gate flows plus core shape tests |
| All flight modes and assists | PASS | Actual mode comparison, zero-strength retest and pure-core tests |
| Presets / seeds / quality / telemetry / diagnostics | PASS | Actual controls, rendered views and live state |
| JSON export/import / rejection / persistence / PNG | PASS | Actual file input/downloads; authentic recorded replay |
| Narrow / retina / pointer / resize continuity | PASS | 390×844 and 1280×800; physical touchscreen not available |
| WebGL-unavailable fallback | PASS | Browser actually launched with WebGL disabled |
| No-controller fallback / calibration UI integration | PASS | Native no-device state and explicitly synthetic API integration |
| Physical gamepad flight | BLOCKED | No controller hardware attached |
| Procedural audio activation / state / frequency | PASS | Real user gesture, running Web Audio and changing motor frequency |
| Audible audio quality | NOT-RUN | No listening claim; browser audio state only |
| WebGL context-loss recovery event | NOT-RUN | Handler provided; actual context-loss injection not exercised |

No unresolved application failure was observed in the final tested workflows. Sustained performance on other GPUs/browsers and physical gamepad/touchscreen behavior remain outside this harness's coverage.

Final preset review added distinct layouts to Freight yard and Alpine drift (beyond their different environments). Initial same-route assertion failed in `presets-red.txt`; `presets-green.txt` passed after defining technical industrial bends and an elevated alpine circuit. Re-ran all 168 Pro-sized approaches and 3000-course clearance checks: 849200 clearances, zero approach collisions. Clicked both updated presets and inspected `industrial-final.png` / `forest-final.png`; actual Alpine flight passed its first two gates without a collision. The canyon route and authentic exported ghost were unchanged.

Final closure: current artifact SHA-256 is saved in `logs/artifact-sha256.txt`. Both inline scripts passed Node syntax checks, both core/coverage suites passed after the distinct preset layouts, and `final-runtime.json` shows zero WebGL errors, a unit quaternion, fixed 1/120 s integration, no resource fetches and stable rendering. Parsed final console/error logs are empty; all isolated tracked requests are successful local file document loads. Closed only the agent-owned named sessions. Finished artifact and all evidence remain on disk.
