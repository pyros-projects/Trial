# Validation — VELOCIRAPTOR FPV (single-file 3D FPV drone-racing simulator)

**Artifact under test:** `../index.html` — one self-contained file, no build step, no
network, no external assets.
**Date of run:** 2026-09-08
**Author of this document:** the implementing agent. Nothing here is an evaluator score.

---

## 1. Environment and tooling

| Item | Value |
|---|---|
| Browser automation | `agent-browser` **0.31.1** — the installed skill. `agent-browser skills get core` and `skills get dogfood` were read before use. |
| Browser | HeadlessChrome/152.0.0.0, Linux (WSL2) |
| Rasteriser | **ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)** — pure **software** rendering, no GPU |
| WebGL | WebGL2 available. `MAX_TEXTURE_SIZE` 8192, `MAX_VERTEX_ATTRIBS` 16, `MAX_VARYING_VECTORS` 31 |
| URL under test | `file:///home/pyro/projects/naked/opus5/13-drone-racing/index.html` — **direct file access. No local HTTP server was used at any point.** |
| Node | v25.8.1 — test harnesses only, not a runtime dependency of the artifact |

### Tooling notes and one substitution

* `agent-browser` was the primary tool: navigation, viewport control, screenshots,
  `console` / `errors`, and `eval`.
* **Substitution, and why.** `agent-browser press <key>` sends a *complete* key press
  (down **and** up). A flight simulator needs keys **held** for real durations, which
  that command cannot express. For flying I therefore drove the same browser through
  its CDP endpoint (obtained with `agent-browser get cdp-url`) using
  `Input.dispatchKeyEvent` and `Input.dispatchMouseEvent` — the identical trusted-input
  API Playwright and Puppeteer use. These are real browser input events delivered to
  the page, **not** synthetic `element.dispatchEvent()` calls. Every keystroke,
  mouse press and drag reported below went through that path.
  Harnesses: `../tools/fly.js`, `../tools/pilot.js`, `../tools/checks.js`,
  `../tools/checks2.js`.
* `../tools/pilot.js` is a **closed-loop keyboard pilot that lives entirely in the
  test harness**. It reads the same public state a human reads off the HUD
  (position, attitude, next gate) and presses real keys in response. **The
  application contains no autopilot, no scripted flight and no canned demo.**
* `../tools/build.sh` concatenates `../src/*` into `index.html` during development.
  It is a dev tool; the delivered `index.html` has no build step and no dependencies.
  The build script fails hard if any external reference (`http(s)://`, `@import`,
  `fetch(`, `XMLHttpRequest`, `importScripts`) appears in the output.

### Environment limits that shape every number below

1. **`requestAnimationFrame` ceiling.** With rendering *completely disabled*, rAF in
   this headless browser still only fires every **41.3 ms**. Measured directly:
   `fullFrameMs 53.5 · emptyFrameMs 41.3 · glFinishMs 0.1`. The frame-rate ceiling
   here is the environment, not the renderer.
2. **Software rasteriser.** Every FPS figure is a floor measured with no GPU.
3. Consequence: FPS numbers in this document are **not** representative of hardware.
   What they *do* establish is that quality controls, adaptive resolution and the
   fixed-step simulation all behave correctly under a slow renderer.

---

## 2. Results at a glance

| Suite | Command | Result |
|---|---|---|
| Course generation, determinism, finishability | `node tools/test-course.js` | **6/6 presets + 3 invariants pass** |
| Flight model (headless, no browser) | `node tools/test-physics.js` | **41/41 pass** |
| Browser suite 1 — 14 groups | `node tools/checks.js <ws>` | **47/47 pass** |
| Browser suite 2 — 6 groups | `node tools/checks2.js <ws>` | **18/18 pass** |
| Live flight: gates, laps, ghost | `node tools/pilot.js <ws>` | §5, §6 |

**113 automated checks, 0 failures**, all re-run against the delivered `index.html`.

Raw logs in `logs/`: `axis-response.txt`, `browser-checks.txt`, `browser-checks-2.txt`,
`browser-checks.json`, `browser-checks-2.json`, `physics-tests.txt`,
`course-tests.txt`, `audio-check.txt`, `lap-run.json`.
Screenshots in `screenshots/`.

---

## 3. Public validation checks — verdicts

| # | Check | Verdict | Where |
|---|---|---|---|
| 1 | Take off | **pass** | §4 |
| 2 | Independent throttle / yaw / pitch / roll (not a camera on a path) | **pass** | §4 |
| 3 | Pass at least two ordered checkpoints | **pass** — 8 in order, plus a full lap | §5 |
| 4 | Collide with terrain or an obstacle | **pass** — 12.5 m/s terrain impact, crash state entered | §7 |
| 5 | Recover or reset | **pass** — `R` recovery and `Backspace` restart | §7 |
| 6 | Switch camera mode | **pass** — 4 modes, physics untouched | §8 |
| 7 | Compare an assisted setting with a more manual flight mode | **pass** — angle/horizon/acro plus altitude-hold and anti-crash A/B | §9 |
| 8 | Lap timing | **pass** — 88.81 s lap with 7 sector splits | §6 |
| 9 | Checkpoint order | **pass** — skipping a gate is detected and penalised | §5 |
| 10 | Telemetry changes | **pass** | §10 |
| 11 | Seed reset | **pass** — bit-identical regeneration | §11 |
| 12 | Ghost / replay behaviour | **pass** — 1553-frame ghost, exact playback, live delta | §6 |
| 13 | Gamepad fallback messaging | **pass** — plus a simulated pad end-to-end | §12 |
| 14 | Quality controls | **pass** | §13 |
| 15 | Stable rendering after desktop and narrow viewport changes | **pass** — 4 viewports, 3 device pixel ratios, 0 errors | §14 |

---

## 4. Take-off and independent axis response

Method: launch, then hold one key at a time over CDP and sample
`window.__DRONE__.state()` throughout. Angle mode, neon course, assists off.
Raw log: `logs/axis-response.txt`.

| Input | Observed |
|---|---|
| `W` held 2.0 s | throttle 0 → 1.00, motors 0.05 → 1.00 each, **altitude 20.0 m → 47.8 m**, attitude unchanged (roll 0.0°, pitch 0.0°) |
| `D` held 1.2 s | heading **173.1° → 150.9°** and turning, yaw rate reached **−7.23 rad/s**; roll 0.0°, pitch 0.0°; horizontal position unchanged (Δ 0.00 m). Motors show the diagonal yaw pattern `[0.85, 1.00, 0.85, 1.00]` |
| `A` held 1.2 s | heading reverses, yaw rate **+7.20 rad/s** |
| `→` held 1.2 s | **bank −37.7°**, drone accelerates along −X, yaw rate returns to ~0 once the bank limit is reached |
| `←` held 1.2 s | **bank +37.9°**, acceleration reverses |
| `↑` held 1.5 s | **pitch −37.9°** (nose down), speed 25.9 m/s, roll 0.0° |
| `↓` held 1.2 s | **pitch +37.9°** (nose up), forward speed decays |

Each axis moves only its own degree of freedom, and every input reaches the craft
through the mixer (individual motor values differ per axis, visible above). Releasing
the stick in angle mode returns the craft to level. This is a rigid body driven by
four thrust vectors, not a camera being translated.

Headless confirmation of the same behaviour, independent of the browser, in
`logs/physics-tests.txt` (41 assertions), including:

* hover holds altitude within **1.77 m over 12 s** and attitude within **0.00°**
* rate-loop step response: **90 % of a 720 °/s command in 104 ms, 6 % overshoot, 2.5 % steady-state error**
* peak roll authority is preserved across the whole throttle range: `{0.15: 778, 0.35: 770, 0.6: 764, 0.85: 770, 1.0: 770} °/s`
* 60 s of randomised stick input produces **no non-finite state**, `|q|` stays 1.000000000
* identical inputs twice → **bit-identical** final state

---

## 5. Ordered checkpoints, missed gates, penalties

**Ordered passes (Pine Sprint, 7 gates).** Real keyboard flight by the harness pilot:

```
gate order: 0>1  1>2  2>3  3>4  4>5  5>6  6>0  0>1
gatesPassed 8 | penalty 0 | missed 0 | errors 0
```

**Order is enforced.** Deliberately aiming one gate ahead (`tools/pilot.js --skip 1`)
produced, with no code changes to the application:

```
t=11.48  gate 0 → 1
t=31.59  gate 1 → 3      (gate 2 skipped)
t=53.65  gate 3 → 5      (gate 4 skipped)
penalty: 4.0 s   missed: 2
```

Each skip raised a `GATE MISSED` banner, a toast, a warning tone, and **+2.0 s** added
to the lap. The race continues rather than dead-ending, so a generated course always
remains finishable even after a mistake.

Crossing detection is a **swept plane test**, not a proximity sphere: the segment the
craft travelled during one 1/240 s physics substep is intersected with the gate plane
and the intersection must land inside the gate rectangle. At 40 m/s a substep is 17 cm,
so nothing tunnels through.

---

## 6. Lap timing, ghost, best-time persistence

One complete timed lap flown with real keys (`logs/lap-run.json`):

| Field | Value |
|---|---|
| Lap time | **88.81 s** |
| Sector splits | `12.10, 13.52, 14.25, 13.99, 11.11, 11.00, 12.85` s (one per gate) |
| Penalties / missed | 0 / 0 |
| Ghost frames recorded | **1553** at 30 Hz |
| Uncaught errors | 0 |

Persistence, read back from the page after the lap:

```
best 88.81 s · ghost 1553 frames · racing line 1553 vertices
localStorage["velociraptor-fpv-v1"] = 111 385 bytes  (storage backend: localStorage on file://)
stored best time 88.81 · stored ghost 1553 frames
```

Ghost replay on the next attempt, sampled live mid-lap:

```
ghostVisible true · ghost [63.4, 33.5, 101.5] · drone [54.1, 31.9, 109.2] · gap 12.1 m
live delta vs best: −0.37 s   (HUD shows "vs best −0.37" in green)
```

**Replay fidelity** (`checks2.js → replayFidelity`), over a 285-frame / 14.7 s recording:

* stored ghost reproduces **every recorded sample with max position error 0 m**
  (the export quantises to 1e-4 m)
* interpolation between frames lands between its neighbours

Screenshot `screenshots/40-ghost-racingline.png` shows the best-lap racing line drawn
through the world, `BEST 01:28.81` in the timing block, and the green `−0.37` delta.

---

## 7. Collision, crash, recovery

Identical manoeuvre flown twice with real keys — climb, pitch over, cut throttle —
first unassisted, then with anti-crash at full strength:

| Configuration | Outcome |
|---|---|
| anti-crash **off** | **terrain contact at 12.5 m/s**, crash state entered, min altitude 0.42 m |
| anti-crash **on (1.0)** | **never touched down**; the assist arrested the descent and held 0.23 m AGL |

Recovery: `R` cleared the crash state and returned the craft to the last gate —
`crashed true → false`, position `[115.2, 8.5, 53.8] → [120.1, 31.8, −13.0]`,
speed `0.00 m/s`. No new errors, all state finite.

Restart: `Backspace` returns to the launch pad with the clock disarmed
(`speed 21.8 → 0.00 m/s, armed=false, gate=0`).

Collision behaviour verified headlessly as well: a free-fall onto terrain settles at
**0.168 m** above ground (drone radius 0.170 m) with `vy = −0.000`, and a glancing hit
on a gate post produces a **2.25 rad/s peak spin** and sheds energy **16.7 → 4.3 m/s**.
A head-on impact through the centre of mass produces no spin, which is correct.

---

## 8. Cameras

```
all four modes reachable by keyboard:  chase → orbit → track → fpv → chase
per-mode framing (effective FOV):      {fpv 101.3, chase 83.9, orbit 72.6, track 47.3}
```

**Camera switching does not touch the simulation.** With physics frozen, five camera
changes left position, velocity, orientation quaternion and angular velocity
byte-identical:

```
pos [-39.5753, 61.1780, 169.1058] → [-39.5753, 61.1780, 169.1058]
vel / quat / omega identical = true
```

External cameras march outward from the craft and stop before the first solid object,
so orbit and chase never end up inside a building; the trackside cameras prefer a pole
with a clear line of sight. Screenshots: `10-fpv-inflight.png`, `11-chase.png`,
`12-orbit.png`, `13-trackside.png`.

---

## 9. Flight modes and assists — assisted vs. manual

Identical full roll input held for 1.65 s in each mode, then released:

| Mode | Max bank | Total rotation | Bank 1.4 s after release |
|---|---|---|---|
| **Angle** | 38.0° | 32° | **0.1°** — self-levelled |
| **Horizon** | 175.2° | 1121° | **0.9°** — flipped, then self-levelled |
| **Acro** | 178.0° | 1131° | **92.7°** — holds whatever attitude it was left in |

Three genuinely different control laws: angle mode limits bank and returns to level,
horizon self-levels near stick centre but allows flips at full deflection, acro is a
pure rate command with no levelling anywhere.

**Altitude hold** — same 50 % throttle stick, 3.2 s:

```
plain throttle: 17.9 m of drift      altitude hold: 0.0 m of drift
```

**Anti-crash** — see §7: it changes the outcome of an identical dive from a 12.5 m/s
crash to no ground contact at all.

Every assist alters the actual control law: auto-level scales the outer attitude loop,
altitude hold rewrites the throttle command into a climb-rate command, anti-crash
injects thrust and levelling when the ground is closing.

---

## 10. Telemetry

Live traces read straight out of the scrolling graph's ring buffer while flying:

| Trace | Response |
|---|---|
| throttle | 0.00 → 1.00 while `W` held |
| altitude | 23.0 → 34.0 m |
| speed | 0.0 → 18.4 m/s |
| roll rate | peak **> 0.4 rad/s** during the roll transient (in angle mode a *held* stick settles back to zero rate once the bank limit is reached — the transient is what the trace shows) |
| canvas | 4502 lit pixels — the traces are really drawn, not an empty canvas |

The diagnostics panel reports body rates, the rate setpoint, the normalised torque
demand, per-motor outputs, saturation, thrust in newtons and g, integration substep
count and length, instability-guard count, contact state, and a sim/render/HUD frame
timing breakdown. Debug overlays emit real geometry: enabling body axes, velocity and
acceleration vectors, the collision sphere, checkpoint volumes and the generated path
took the debug line buffer from **0 to 536 vertices**.
Screenshot: `14-diagnostics.png`.

---

## 11. Determinism and seed reset

```
same seed regenerates a bit-identical course   (ALPHA-42: gates match, 340 → 340 colliders)
different seed gives a different course        (ALPHA-42 gate0 [128.3,30.3,0] vs BETA-7 [126.5,29.6,0])
reset places the craft on the launch pad, stationary, facing gate 1
```

Headless (`logs/course-tests.txt`), across all six curated presets:

```
PASS Neon Loop         9 gates  847 m  382 colliders  minGateClear 9.8 m  minPathTerrClear 12.0 m  blocked 0
PASS Canyon Run        9 gates  828 m  243 colliders  minGateClear 8.4 m  minPathTerrClear 10.7 m  blocked 0
PASS Industrial Slalom 13 gates 873 m  497 colliders  minGateClear 11.1 m minPathTerrClear 12.9 m  blocked 0
PASS Pine Sprint       7 gates  760 m  342 colliders  minGateClear 15.6 m minPathTerrClear 18.4 m  blocked 0
PASS Vertical Gauntlet 14 gates 973 m  465 colliders  minGateClear 9.5 m  minPathTerrClear 10.6 m  blocked 0
PASS Night Freeway     11 gates 786 m  510 colliders  minGateClear 9.5 m  minPathTerrClear 10.5 m  blocked 0
PASS launch pad clears the gate-0 approach line (min 3.61 m)
determinism identical: true · different seed differs: true
```

"blocked 0" means: walking the entire racing line in 2 m steps, no obstacle comes
within 1.5 m and the terrain never rises within 1 m of the line. **Every generated
course is finishable, and that is asserted rather than assumed.**

---

## 12. Gamepad — fallback and full path

**No controller present** (the real state of this machine):

```
input.status().gamepad = false, source = "keyboard"
launch card:  "No gamepad detected — keyboard control is active and fully sufficient. …"
settings panel (warnbox): "No gamepad detected. Keyboard control is active and complete:
                           W/S throttle, A/D yaw, arrow keys pitch & roll. …"
startCalibration() with no pad → false (refused, with a toast)
dead zone / per-axis mapping / per-axis inversion / calibration controls all present
```

**With a synthetic `Gamepad`** injected over `navigator.getGamepads` (no physical
controller was available — this is recorded as a simulated device, see §16):

```
detection            pad detected and named "Synthetic Test Pad (…)"
throttle axis        axis 1 at −1 (inverted by default) → throttle 1.000, source "gamepad", motors [0.38 ×4]
dead zone            axes at 0.05 with an 8 % dead zone → roll 0, yaw 0
roll axis            axis 2 at 0.8 → roll cmd 0.78 → bank −25.6°
inversion control    same stick with "Invert roll" ticked → roll cmd −0.78
calibration          min [−1,−1,−1,−1], max [1,1,1,1] captured and stored, all four axes marked calibrated
buttons              face button cycles the camera
disconnect           keyboard fallback notice returns (status box class "warnbox")
```

---

## 13. Quality controls and performance

| Preset | Shadow map | Triangles/frame | Draw calls |
|---|---|---|---|
| potato | off | 19 690 | 15 |
| low | 512 | 42 438 | 20 |
| medium | 512 | 67 012 | 23 |
| high | 512 | 67 008 | 22 |

Two caveats, stated plainly. Shadow maps are deliberately **capped at 512 when a
software rasteriser is detected**, so medium and high report 512 here rather than
1024/2048 — same code path, different texture size. And `high` differs from `medium`
only in draw distance (1400 m vs 900 m), which changes nothing here because the whole
course already fits inside 900 m. On a GPU those two presets do differ; in this
environment they are legitimately indistinguishable.

Render-resolution control: `0.5× → 640×400`, `1.0× → 1280×800` drawing buffer, with
the HUD canvas staying at full device resolution so text remains crisp.

**Adaptive resolution verifies itself.** Rather than grinding the image down whenever
frames are slow, it measures whether a downscale actually helped and reverts if not:

```
adaptiveVerdict: "no gain from 1.00→0.90 (56→66 ms) — not fill-rate bound"
```

That is the correct verdict in this environment, where the bottleneck is the rAF
ceiling rather than fill rate, and the resolution is restored to 1.00 instead of being
degraded for nothing.

**Fixed-step simulation keeps real time under a slow renderer.** Measured at 12.4 fps:

```
simSeconds 8.13 · wallSeconds 8.19 · ratio 0.993
```

**Watchdog.** Independent of the adaptive-resolution toggle, a sustained frame time
above 400 ms steps the quality preset down and clamps the render scale to 55 %, with a
toast explaining why. This was added after the `high` preset at full resolution made
the software-rendered page unresponsive during a test run (§17, item 16).

---

## 14. Resize, viewports, high-DPI

| Viewport | Drawing buffer | HUD canvas | Projection aspect error | Errors |
|---|---|---|---|---|
| 1280 × 800 | 960 × 600 | 1280 × 800 | 0.000 | 0 |
| 1920 × 1080 | 1440 × 810 | 1920 × 1080 | 0.000 | 0 |
| **390 × 844** | 293 × 633 | 390 × 844 | 0.001 | 0 |
| 820 × 400 | 615 × 300 | 820 × 400 | 0.002 | 0 |

High-DPI, via CDP device metrics:

```
1×  devicePixelRatio 1  app.dpr 1  hud 1024×640   gl buffer 1024×640
2×  devicePixelRatio 2  app.dpr 2  hud 2048×1280  gl buffer 2048×1280
3×  devicePixelRatio 3  app.dpr 3  hud 3072×1920  gl buffer 3072×1920
```

**Input continuity across a resize:** after shrinking to 390 × 844, holding `W` still
drove the craft — `throttle 0.34, motors [0.22 ×4]`.

The narrow layout reflows: the settings panel becomes a bottom sheet, the telemetry
graph is hidden below 460 px, the FPV instruments collapse to a compact readout, and
the clock moves clear of the live-stats card.
Screenshots: `20-narrow-390x844.png`, `21-narrow-panel.png`.

---

## 15. Self-containment, data I/O, screenshots, fallback

**Self-containment.** Loaded from `file://` with no server. After load:

```
external resource requests: none  (performance.getEntriesByType('resource') is empty
                                   apart from the document itself)
```
The build script additionally refuses to emit an `index.html` containing any
`http(s)://` reference, `@import`, `fetch(`, `XMLHttpRequest` or `importScripts`.
No fonts, images, models, audio files or libraries are fetched — all geometry,
materials, sky, audio and UI are generated in-file.

**Export / import.** A `bundle` export carries `format`, `version`, the course
descriptor, the best lap with sector splits, and the ghost recording; it round-trips
cleanly. Eight malformed payloads were each rejected with a specific reason, and none
disturbed the running simulation:

| Payload | Rejection |
|---|---|
| `not json at all` | `Not valid JSON: Unexpected token 'o'…` |
| `{"format":"something-else",…}` | `Unknown format "something-else" — expected "velociraptor-fpv"` |
| `{"version":99,…}` | `Unsupported version 99.` |
| `course.env:"atlantis"` | `course.env "atlantis" is not one of: neon, canyon, industrial, forest` |
| `course.gateCount:400` | `course.gateCount must be a number from 4 to 24` |
| `ghost.frames:[[0,1,2,"x",…]]` | `ghost.frames[0] is not 8+ finite numbers.` |
| `{"format":…,"version":1}` | `Nothing importable found (expected course, ghost, best or settings)` |
| `[1,2,3]` | `Top level must be a JSON object.` |

After all eight: `ready=true, errors=0, course unchanged (PINE-9)`.

**PNG screenshot export.** Compositing the WebGL frame with the HUD canvas produced a
real **1280 × 800** PNG (68 KB data URL, `data:image/png;base64,` header), and the
save path built a download named `vfpv-PINE-9-<timestamp>.png`.

**WebGL fallback.** Loading the same file in a tab where `getContext` returns `null`:

```
heading: "WebGL is unavailable"
message: "This browser did not provide a WebGL2 or WebGL1 rendering context, so the
          simulator cannot start."
detail : "Diagnostics: getContext returned null for webgl2, webgl and experimental-webgl."
start overlay hidden: true
```

The same fallback surfaced genuinely during development when a shader failed to
compile — it reported the compile log with numbered source, which is how that bug was
found.

---

## 16. Procedural audio — what was and was not verified

Verified with a **real mouse click** on the Launch button (a scripted `.click()` is not
a user gesture and would leave the context suspended):

| Moment | Observation |
|---|---|
| before the click | `AudioContext` state: **"not created"** |
| after the real click | state **"running"**, 44 100 Hz |
| motors at 0.05 (idle) | master-bus RMS **0.00098** |
| motors at 0.33 | master-bus RMS **0.02105** — 21× louder |
| oscillator frequency at motors 0.33 | **219 Hz** (the design is `78 + 430 × motor` → 220 Hz) |
| sub-oscillator | **59.6 Hz** (design: `38 + 66 × motor` → 59.8 Hz) |
| airspeed noise gain | 0.0022 at low speed |
| collision one-shot | fires and raises bus RMS to 0.02187 |

**Explicitly not claimed:** I did not listen to the audio. What is established is that
the graph is built only on a genuine user gesture, that it is running, and that its
oscillator frequencies, gains and measured bus level are driven by the live motor
command. Perceptual quality is **not-run**.

---

## 17. Failures found during validation, their fixes, and retests

Every item below was found by running the application, not by reading it. Each was
fixed and the failing flow plus a regression test were re-run.

| # | Failure observed | Fix | Retest |
|---|---|---|---|
| 1 | Boot aborted: `Cannot read properties of undefined (reading 'length')` in `MeshBuilder.append` — it could not consume already-built meshes | `append` now accepts either shape | app boots, 0 errors |
| 2 | At the computed "hover" throttle the craft sank 61 m in 12 s — hover ignored throttle expo | added an expo inverse (`hoverStick()`) | hover holds within **1.77 m / 12 s** |
| 3 | Roll stick right banked **left** in angle mode — the levelling axis sign was wrong | flipped the tilt sign | right stick → bank −37.6° and +X acceleration |
| 4 | Cutting the throttle and yawing made the craft **climb** — air mode was lifting the collective from a yaw demand at idle | air-mode authority now ramps in with throttle | test: yaw at zero throttle → `vy −10.2 m/s` (falling) |
| 5 | Regression from #4: at **full throttle the craft had no attitude authority at all** (roll input produced identical motor values) | symmetric air mode — lowers the collective at the top instead of killing the differential | new test sweeps the throttle range: 770 °/s roll authority at every setting |
| 6 | Adaptive resolution barely helped: post-processing still ran at full canvas size | the drawing buffer itself now carries the scale; CSS stretches it back | `0.5× → 640×400`, all passes scale |
| 7 | Adaptive resolution ground the image to its floor when the bottleneck was not fill rate | it now probes: if a downscale does not improve frame time it reverts and backs off | verdict string reports `no gain … not fill-rate bound`, resolution restored to 1.00 |
| 8 | Distant façades boiled into static — high-frequency procedural patterns with no mipmaps | every material cross-fades to its own average with distance | see `11-chase.png` |
| 9 | Window grids ran the wrong way on rotated buildings — face selection compared a **world**-space normal against **object**-space coordinates | the object-space face axis is carried through as a varying | windows now follow each façade |
| 10 | Orbit and chase cameras ended up inside buildings | cameras march out from the craft and stop before the first solid thing; trackside prefers a pole with line of sight | `12-orbit.png`, `14-diagnostics.png` |
| 11 | `devicePixelRatio` changes were ignored unless a resize event also fired (dragging a window between a 1× and a 2× display) | `matchMedia("(resolution: Ndppx)")` watcher plus a 1 s fallback poll | 1×/2×/3× all correct |
| 12 | **The launch pad sat inside the start gate's opening**, so every lap ended by flying into it | the deck now sits below the gate's lower bar; a course test asserts the clearance | `launch pad clears the gate-0 approach line (min 3.61 m)`; full lap completed |
| 13 | Below ~30 fps the simulation silently ran in **slow motion** (substep cap of 8) | cap raised to 40 — a substep costs ~6 µs, so the cap only needs to stop a stalled tab | at 12.4 fps: sim/wall ratio **0.993** |
| 14 | On a 390-wide viewport the clock was hidden behind the live-stats card | the HUD lays out around the measured card | `20-narrow-390x844.png` |
| 15 | The craft was invisible against a night skyline | navigation LEDs (green front, red rear, white strobe) drawn as a separate emissive pass | visible in chase and orbit shots |
| 16 | Selecting the `high` preset at full resolution made the software-rendered page unresponsive mid-suite (`timeout Runtime.evaluate`) | added a frame-time watchdog that sheds a quality step and clamps the render scale after 2.5 s above 400 ms/frame | suite 1 completes 47/47 with the watchdog active |
| 17 | The launch pad's emissive deck filled the lower half of the FPV view with a flat slab | only the painted deck rings glow now | `screenshots/05-fpv-on-the-pad.png` |

---

## 18. Limitations, blocked checks and known gaps

Honest status of everything not fully established:

* **Audio perceptual quality — not-run.** Structure, gating on a user gesture, and
  motor-driven pitch/level were measured (§16). Nobody listened.
* **GPU performance — not measured.** Every frame-rate number comes from a software
  rasteriser inside a headless browser whose rAF ceiling is 41 ms. The application's
  own GL work measured 0.1 ms/frame client-side. Behaviour on real hardware is
  extrapolation, not evidence.
* **Shadow map sizes above 512 — not exercised here.** The renderer caps shadow maps
  at 512 when it detects a software rasteriser, so the 1024 and 2048 paths were not
  run in this environment.
* **Physical gamepad — not tested.** No controller is attached to this machine. The
  mapping, dead zone, inversion, calibration and button paths were driven end-to-end
  with a synthetic `Gamepad` object (§12); real HID hardware remains untested.
* **Touch hardware — not tested.** The on-screen sticks were exercised with real
  pointer events (press, move, release) driven over CDP, which is the same event
  stream a touchscreen produces, but no touch device was involved.
* **Browsers other than Chromium — not tested.** The artifact targets WebGL2 with a
  WebGL1 + `ANGLE_instanced_arrays` fallback and GLSL ES 1.00 shaders, but only
  Chromium 152 was available here.
* **Harness pilot quality.** `tools/pilot.js` is a deliberately simple bang-bang
  controller; its 88.81 s lap reflects the harness, not the craft's capability. The
  simulated quad reaches 30+ m/s and 770 °/s under direct input.
* **Long-session soak — not run.** The longest continuous session in these runs was
  a few minutes.

---

## 19. How to reproduce

```bash
# 1. headless checks (no browser needed)
node tools/test-physics.js        # 41 flight-model assertions
node tools/test-course.js         # 6 presets + finishability + determinism

# 2. open the artifact directly — no server
agent-browser --session vfpv open "file://$PWD/index.html"
agent-browser --session vfpv set viewport 1280 800

# 3. browser suites (real CDP input events)
WS=$(agent-browser --session vfpv get cdp-url)
node tools/checks.js  "$WS"       # 14 groups
node tools/checks2.js "$WS"       # 6 groups

# 4. fly it with real keys
node tools/pilot.js "$WS" 150 --althold --json evidence/logs/lap-run.json
node tools/pilot.js "$WS" 70  --althold --skip 1      # provoke missed-gate penalties
```

`tools/build.sh` rebuilds `index.html` from `src/` and fails if any external reference
appears in the output. It is a development convenience only — the delivered file needs
no build step.

## 20. Screenshot index

| File | What it shows |
|---|---|
| `01-start-overlay.png` | Launch card: controls, preset/seed/mode pickers, gamepad fallback notice |
| `05-fpv-on-the-pad.png` | The default first view — checkered START/FINISH gate 13 m ahead |
| `06-fpv-gate-approach.png` | FPV on approach to a gate |
| `10-fpv-inflight.png` | FPV mid-course with full instrument overlay |
| `11-chase.png` | Chase camera, next gate lit, shadows on the ground |
| `12-orbit.png` | Orbit camera around the craft |
| `13-trackside.png` | Trackside camera |
| `14-diagnostics.png` | Body axes, velocity/acceleration vectors, collision sphere, checkpoint volumes, generated path |
| `15-panel-diag.png` … `18-panel-data.png` | Settings panel: Diagnostics, Flight, Course, Data tabs |
| `20-narrow-390x844.png` | 390 × 844 layout, clock clear of the stats card |
| `21-narrow-panel.png` | Settings as a bottom sheet on a narrow screen |
| `30-canyon.png`, `31-industrial.png`, `32-forest.png` | The other three procedural environments |
| `40-ghost-racingline.png` | Best-lap racing line, `BEST 01:28.81`, live `−0.37` delta |
