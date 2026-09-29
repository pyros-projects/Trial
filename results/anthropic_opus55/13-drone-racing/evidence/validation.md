# APEX FPV — validation record

Artifact: `../index.html` (single self-contained file, ~232 KB, 3,249 lines; no external URLs, imports, fetches, textures, fonts or audio files).
Everything under `evidence/` is agent-authored test material and is **not** used by the app at runtime.

## Environment and tooling

| Item | Value |
|---|---|
| Browser automation | `agent-browser` 0.31.1 (skill loaded; `skills get core` and `skills get dogfood` read before use), session `drone13`, headless Chrome |
| GL implementation | `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)))`, which is **CPU software rendering**. A GPU launch was tried (`--use-angle=gl …`); it still reported SwiftShader, and that session suffered a context loss, so it was abandoned. |
| Local server | `uv run --no-project python -m http.server 8813 --bind 127.0.0.1` (dev-only; not a runtime dependency) |
| External network | `agent-browser network route "https://**" --abort`. After adding an inline `data:` favicon, `agent-browser network requests` lists only `GET /index.html (Document) 200`, and `performance.getEntriesByType('resource')` is empty. |
| Direct file | `agent-browser open file:///…/index.html` also passes (see §20) |
| Node | v25.8.1 for the headless core harness `harness/node-core-test.js` |

Input methods used: real keyboard events (`agent-browser keydown/keyup/press`), real pointer events (`agent-browser mouse move/down/up` on the touch sticks; `click`, `select`, `check`, `focus` + `End`/`Home` on range inputs), real file inputs (`agent-browser upload` with absolute paths; `agent-browser download` for exports).
Long flights used a **harness autopilot** (`harness/autopilot-*.js`, injected with `eval --stdin`). It overrides `navigator.getGamepads()` with a virtual pad, so every command still flows through the app's gamepad path: axis mapping, calibration, dead zone, inversion and quantisation. The app contains no autopilot and no hard-coded test sequences.

`harness/probe.js` is a read-only state probe (position, attitude, velocities, inputs, race state) used for the numbers below. `APEX.state()` is the app's own diagnostics accessor.

## Results summary

| # | Check | Result |
|---|---|---|
| 1 | Core harness: 180 generated courses (5 presets × 3 environments × 4 difficulties × 3 seeds) validate as finishable | **pass** (after fix F1) |
| 2 | Take-off with independent throttle / yaw / pitch / roll (keyboard) | **pass** |
| 3 | Pass ≥ 2 ordered checkpoints; full laps; lap and sector timing | **pass** |
| 4 | Checkpoint order: missed-gate and wrong-gate feedback, respawn penalty | **pass** |
| 5 | Collision with obstacle/terrain, crash handling, recovery and reset | **pass** |
| 6 | Camera switching (FPV/chase/orbit/trackside) leaves physics untouched | **pass** |
| 7 | Assisted (angle + altitude hold + anti-crash) vs manual (acro) | **pass** (after fix F2) |
| 8 | Horizon mode (levels when centred, flips at full stick) | **pass** |
| 9 | Telemetry graph and diagnostics driven by the live sim | **pass** |
| 10 | Deterministic seed and deterministic reset | **pass** |
| 11 | Ghost from best lap; replay export → import → deterministic re-simulation | **pass** (after fix F9) |
| 12 | Gamepad: fallback messaging, calibration, dead zone, inversion | **pass** with a virtual pad; real hardware **blocked** (none available) |
| 13 | Quality controls change actual rendering work | **pass** |
| 14 | Desktop 1280×800 and narrow 390×844, resize back and forth | **pass** (after fixes F5, F6) |
| 15 | Pause / resume / restart | **pass** (after fix F5) |
| 16 | Course and replay JSON export/import; invalid data fails gracefully | **pass** |
| 17 | PNG screenshot export | **pass** |
| 18 | Local best-time persistence | **pass** |
| 19 | Procedural audio driven by motor command and speed | **pass by measurement only**; not listened to (see §19) |
| 20 | Direct `file://` open, no external requests | **pass** |
| 21 | WebGL2-unavailable fallback; context loss and restore | **pass** |
| 22 | Physics sliders (gravity, TWR, integration rate) and reset settings | **pass** (after fix F8) |
| 23 | Touch/pointer sticks at narrow width | **pass** |
| 24 | Performance on real GPU hardware | **blocked** (only SwiftShader available); software numbers below |

## Detailed steps and observations

### 1. Headless core harness
`node evidence/harness/node-core-test.js` loads the app's own `<script>` (world generation, physics, records) into a Node VM. Output is in `node-core-test.log`:
- `[courses] 180 generated, 0 failed validation · min terrain clearance 2.45 m · min obstacle clearance 2.15 m · min gate-frame clearance 1.15 m`.
- The first run failed: all 60 city courses had obstacle clearance ≈ −6 m (path samples inside buildings). That's fix F1.
- `[seed] same seed → AD3DD774 / AD3DD774 (identical); other seed → BF9F7C14`.
- `[replay] live hash … vs re-simulated-from-JSON hash … → bit-identical (2880 steps, 2 mid-run param events)`.
- Invalid imports are rejected with messages (wrong format, too few gates, non-numeric coordinate, invalid pset).

### 2. Independent axes by keyboard (`keyboard-axes-1.log`, `keyboard-axes-2.log`)
Angle mode, from the pad:
- **W** held ~1 s: altitude 2.74 → 7.60 m, vy 6.8 m/s, input `[1,0,0,0]`. On release, vy −0.09 m/s (altitude hold).
- **D** held ~0.5 s: heading 26.3° → 146.5°, altitude change +0.3 m, pitch/bank 0.
- **↑** held: pitch −49.9° (nose down), forward speed 4.0 → 6.3 m/s, altitude 10.48 → 10.45 m.
- **→** held: bank +50°, sideways speed 4.0 m/s.
- Each axis moved only its own state variable.
Screenshots `03-go-fpv.png`, `04-flying-fpv.png`. On a first attempt the keys did nothing: agent-browser sends `key:"w"` with an empty `code`. That's fix F3.

### 3. Checkpoints, laps, sectors
- Keyboard only (`keyboard-start-gate.log`): **R** (back to the pad), **W** 0.45 s, **↑** 1.3 s. The drone flew through the START gate: `next 0→1, lap 1, lapRunning true` (`05-after-start-gate.png`, lap timer running, S1 active).
- The autopilot then flew gates 2→7 and back through S/F in order (monitor output: `next` 2,3,4,5,6,0). Laps were 75.099 / 71.951 / 71.951 s; the raw records show 71.95078 vs 71.95102 s, so they are distinct laps.
- The results modal (`09-results.png`) shows the lap table, S1/S2/S3, the best-lap star, total 3:39.001 and "new record!".
- Other environments, 1 timed lap each: Neon Spire 1:31.662 (`neon-autopilot-lap.log`, `30-neon-lap-fpv.png`) and Pine Slalom 2:19.080 (`pines-autopilot-lap.log`, `31-pines-lap-chase.png`). No crashes or penalties.

### 4. Order enforcement and penalties (`missed-wrong-penalty*.log`)
With the waypoint autopilot, time trial on Rookie Loop:
- **R** during a running lap → event `respawn:pen3`; the race box shows `PEN +3s`.
- Crossing gate 2's plane 3 m outside the post → `missed:g1`, message "MISSED GATE 2 / Turn back and fly through it" (`32-missed-gate.png`). `next` stays 1.
- Flying through gate 3 first → `wrong:g2:exp1`, message "WRONG GATE / Next checkpoint is 2" (`33-wrong-gate.png`). No credit; `next` stays 1.
- Then through gate 2 → `gate:g1`, and `next` becomes 2.

### 5. Collisions and recovery
- Tree crash in Pine Valley (`crash-forest.log`, `15-crash-forest.png`): an 18.5 m/s impact produced a `crash` event (kind `tree`), the CRASHED banner, a red flash, sparks/leaves/smoke and a tumble. Auto-respawn followed after 1.8 s, back to the pad because no gate had been passed.
- Low-speed wall contact (hoodoo) did **not** crash: `COLL contact`, drone held against the rock (`04-flying-fpv.png`).
- Wall bumps at 3–4 m/s raised `bump` events with dust and impact sound.
- Out of bounds (`boundary.log`, `28-out-of-bounds.png`): the harness climbed and flew radially outward. At 267 m (> 221 m boundary) the warning `OUT OF BOUNDS · RETURN 1.2s` counted down, then events `oob` and `respawn` fired and the drone returned to the pad.
- Restart (**Backspace**) returns to the identical initial state hash (§10).

### 6. Camera switching (`camera-switch.log`)
Paused at sim step 376, state hash `e8cbb7b9`. Pressing **C** four times went FPV → chase → orbit → trackside → FPV; hash and step were unchanged at every stop. Screenshots `16-cam-1..4.png`, plus `42-beauty-trackside.png` and `43-beauty-orbit.png`.

### 7. Assisted vs manual (`assist-vs-manual.log`)
- **Beginner assists** button (angle, altitude hold 1, anti-crash 0.6): → held gives 43° bank; on release the bank returns to 0° within 1.2 s, altitude drift ≤ 0.2 m.
- **Full manual (acro)** button (acro rates, linear throttle held by W/S, no assists): a 0.25 s → tap gave 46° bank that stayed and grew to 54° (no self-level). The unbalanced tilt lost altitude, the drone drifted into the canyon wall and crashed.
- Node harness (`[assist]`): 2 s full-forward at centre stick. Altitude hold Δy −0.06 m vs manual −1.50 m.

### 8. Horizon mode (`horizon-flip.log`)
Held full → at 18 m: roll rate 551°/s, up-vector y −0.87 (inverted), then a completed flip (roll +14.5°). On release the roll returned to 0.0° (auto-level).

### 9. Telemetry and diagnostics
- The scrolling graph (altitude, speed, throttle, roll and pitch rates) visibly changes with flight in `04`, `07`, `10-replay-complete`, `30`, `31`. Values match the probe.
- The diagnostics toggles (body axes, velocity/acceleration vectors, collision bounds, checkpoint volumes, rates/inputs/timestep/frame panel) all render (`17-diagnostics-chase.png`, `21-resized-back-desktop.png`, `25-custom-course-forest.png` with tree capsules). Panel text example: `STEP dt 4.167 ms (240 Hz) · 16 steps/frame · phys 0.20 ms`, `FRAME avg 53.1 ms · p95 66.8`, `SIM step 1747 · hash f7e21523 · NaN guards 0`.

### 10. Seed determinism and reset (`seed-reset.log`)
Via the UI (fill `#seed`, **Generate course**, **Preset seed**): `rookie` → D3454689; `abc123` → 2EAA20BD; preset seed → D3454689 again; `abc123` → 2EAA20BD again, with identical gate coordinates. Every reset (and **Backspace**) starts from the same state hash `b7e0ff03`.

### 11. Ghost and replay
- Best lap plus a 30 Hz transform ghost are stored per course. On the next lap the translucent ghost and the live delta appear (`08-ghost-racing-line-chase.png`: Δ −3.145, racing line on; `40-beauty-canyon-fpv-ghost.png`: ghost ahead, Δ +1.322).
- **Export replay** (results modal, `agent-browser download`): `exports/replay-rookie-3laps.json`, 687 KB, 80,600 steps as 5,087 RLE input runs, 1 respawn event, 3 laps.
- **Import** of that file at 8× (`replay-regression-final.log`, final code): `80600/80600, lapsGot 3/3, maxLapDelta 0, maxDrift 0.000085 m over 10075 samples` and badge "REPLAY COMPLETE · deterministic match ✓". The 0.085 mm drift is the 4-decimal rounding of the exported comparison samples; lap times match exactly.

### 12. Gamepad (`gamepad-calibration.log`, `gamepad-fallback.log`)
Tested with a virtual drifting pad (rest axes `[0.18, 0.12, −0.15, 0.1]`) injected via `navigator.getGamepads`:
- Uncalibrated at rest the command leaks (`y 0.128, r −0.096`).
- The calibration wizard (**Calibrate gamepad** → **Capture centre** → move to extremes → **Finish calibration**) then reads exactly `t 0.5, y 0, p 0, r 0` at rest and `±1` at full asymmetric deflection.
- The **Invert yaw** checkbox flips yaw to −1. A 5% nudge falls inside the 0.06 dead zone and outputs 0.
- With no pad connected, the controls panel shows "No gamepad detected … press any button … Keyboard fallback is active: W/S throttle · A/D yaw · ↑/↓ pitch · ←/→ roll". The start screen shows a matching note, and **Calibrate** answers "No gamepad detected — calibration needs a connected controller".
- **Blocked:** no physical controller exists in this environment.

### 13. Quality controls (`quality-presets.log`)
Selecting the `#quality` preset:
- low: 768×480, shadows off, no bloom, 37 draws, 73k tris, 35.9 fps
- medium: 1024×640, shadow 1024, 58 draws, 138k tris, 19.3 fps
- high: 1280×800, shadow 2048, 12.8 fps
- ultra: shadow 4096 + MSAA, 63 draws, 148k tris, 7.0 fps

All fps figures are SwiftShader. Adaptive resolution scales down to ×0.40 on this software renderer and is shown in the overlay (`RES 512×320 ×0.40`).

### 14. Viewports
- 390×844: no horizontal overflow (`scrollWidth 390`). The start card fits (`18-narrow-start.png`), the HUD is re-laid out (`19-narrow-fpv.png`) and settings open as a bottom sheet (`20-narrow-settings.png`).
- Back to 1280×800: internal 960×600 at scale 0.75, render aspect 1.600 = CSS aspect, HUD canvas 1280×800, no context loss (`21-resized-back-desktop.png`).
- The first narrow pass found overlapping panels (fix F6).

### 15. Pause
**P** freezes the sim; the step counter and hash stay constant while paused (§6). **Resume** works. Initially the pause overlay blocked the toolbar (fix F5).

### 16. Import / export (`import-invalid.log`)
- Pasted into `#importText`, each rejected with the current course left unchanged (signature stays D3454689):
  - malformed JSON → "Import failed: invalid JSON (Expected property name …)"
  - gate at x=9999 → "gate 2 lies outside the 840 m playable area"
  - unknown format → "unknown format — expected …"
  - bad replay pset → "pset.gravity is invalid"
- **Export course JSON** → `exports/course-rookie.json`; re-imported via file upload → same signature D3454689.
- Hand-written custom 5-gate forest course (`exports/custom-course-5gates.json`) → imported, validated finishable, built (signature 014E0FA5, `25-custom-course-forest.png`).

### 17. PNG screenshot
The toolbar 📷 button via `agent-browser download` gave `exports/app-screenshot.png`: a valid PNG signature, 925×578, containing the WebGL frame plus the HUD layer (not blank).

### 18. Persistence
After a page reload, the course stat read "Best lap 1:11.951 · 3 lap(s) logged · Ghost stored ✓". Note: a later automatic browser relaunch created a fresh profile, which wiped that origin's storage (harness artefact, not an app bug). Bests set afterwards (neon, pines) persisted.

### 19. Audio (`audio-levels.log`), measured, not heard
The context was created on the first click or key press. Via the app's `AnalyserNode` tap and the oscillator parameters, in a fresh session:
- idle/hover (thrust 0.22): motors 280 Hz, RMS −32 dBFS
- climbing (0.33): 327 Hz
- throttle off (0.17): 249 Hz
- fast forward (0.63, 18.6 m/s): 430 Hz, wind gain 0.115
- impact: peak −11.5 dBFS vs about −22 dBFS for the motor bed
- mute: master gain drops to 0

In the first, long-running session the headless AudioContext clock froze at 62.96 s and `suspend/resume` hung (environment audio device). A fresh session ran normally. Audio quality was not listened to.

### 20. Direct file open
`file:///…/index.html` loaded with WebGL2, world signature D3454689, **0** resource entries. A time trial started and the drone flew (alt 5.79 m), audio running (`29-file-protocol.png`). Best times are per origin, so file:// starts empty (expected).

### 21. Fallbacks
- `?nowebgl` → the fallback card "WebGL2 unavailable" with the message and guidance; the start screen is hidden (`37-webgl-fallback.png`, `webgl-fallback.log`).
- `WEBGL_lose_context.loseContext()` → the overlay explains the loss (`35-context-lost.png`); `restoreContext()` → renderer and world re-created, "GPU context restored", rendering resumes (`36-context-restored.png`, `context-loss.log`).

### 22. Physics sliders (`physics-sliders.log`)
Range inputs driven with `focus` + `End`/`Home`, reading the flight controller's hover thrust fraction:
- defaults: 0.223 (theory m·g/Tmax 0.222)
- gravity max (20): 0.454 (theory 0.454)
- TWR max (12): 0.170 (theory 0.170)
- 480 Hz integration → sim restarted at 480 Hz

At gravity 1 m/s² the motors' idle thrust out-lifted the craft (fix F8). **Reset settings** restores g 9.81, TWR 4.5, 240 Hz in the UI and the sim.

### 23. Touch sticks (`touch-sticks.log`, `34-touch-sticks-narrow.png`)
At 390×844 with on-screen sticks enabled:
- Pointer drag on the left stick → throttle 0.89, climb 5.2 m/s; on release it springs back to 0.5 (hover).
- Right stick up → pitch 0.7, 35° nose-down, forward speed.
- Input source switches to `touch`.

### 24. Performance
Only SwiftShader was available: 35–60 fps at ×0.40 adaptive scale; about 12 fps at full 1280×800 "high"; 7 fps "ultra". Physics costs ≈ 0.2 ms per frame for 16 steps at 240 Hz. **GPU-hardware frame rates were not measured (blocked).**

## Failures found and fixed during validation (each retested)

| ID | Failure (observed) | Fix | Retest |
|---|---|---|---|
| F1 | 60/180 city courses not finishable (path inside buildings) | Box colliders were tube-tested before their yaw terms existed (`colliderDist` → NaN) → `prepCollider()` runs before the test | 180/180 pass |
| F2 | Altitude hold sagged 0.6 m in forward flight | Altitude setpoint when the stick is centred, bounded integral, drag feed-forward from the shared `dragForce()` | −0.06 m vs manual −1.50 m |
| F3 | Keyboard ignored for synthetic key events (`code` empty) | `code`, falling back to `key` | Axis tests pass |
| F4 | REPLAY badge overlapped the sector chips; chromatic aberration too strong; prop-wash dust puffed while parked; anti-crash warning during a crash | Layout/value fixes; wash only when airborne and above hover thrust | Screenshots 10, 12 → 30 |
| F5 | Pause overlay blocked the toolbar; toolbar then covered the settings close button | Pointer-events passthrough, z-order | Toolbar and panel usable |
| F6 | Narrow layout: telemetry under the toolbar, minimap over the throttle gauge | Narrow-specific positions | `19-narrow-fpv.png` |
| F7 | Browser auto-requested `/favicon.ico` | Inline `data:` icon | Only the document is requested |
| F8 | g = 1 m/s²: motor idle thrust > weight (drone can't descend) | Idle thrust capped at 20% of weight per motor | Physics log |
| F9 | Ghost shell engulfed the FPV camera when ghost and drone overlapped (screen washed blue) | Ghost fades out within ~3.4 m of the camera; glow sprite billboarded | `40-beauty-canyon-fpv-ghost.png` |
| F10 | GL context lost once (experimental GPU flags) with no recovery | `webglcontextrestored` handler rebuilds renderer and world | §21 |

Not an app defect: file upload initially failed because `agent-browser upload` was given relative paths. With absolute paths it works. The FileReader path was also switched to `file.text()`.

## Remaining limitations (honest list)
- Visual quality and performance were only verified on the SwiftShader software rasteriser; nothing ran on a hardware GPU.
- Physical gamepads were not available; gamepad support was exercised with virtual pads through the standard Gamepad API surface.
- Audio was verified by parameters and analyser levels only; nobody listened to it.
- Precise manual lap flying through the CLI's 100–300 ms command latency is impractical. The keyboard verified take-off, axes and the START gate; full laps were flown by the harness autopilot via the gamepad path.
- Replays are bit-exact within one browser engine. Cross-engine replays may drift, because `Math.sin/pow` can differ in the last bits (not tested).
- The chase camera avoids terrain but not gate frames or buildings, so it can clip through a gate banner right after a pass (`17-diagnostics-chase.png`).
- The canyon walls show terracing from the 4 m heightfield grid.
- A tooling side effect outside this project: early in the session I ran `agent-browser close --all`, which closed every agent-browser session on the machine, not just mine (it listed sessions such as `capstone24`, `stormlab4`, `pps`).
