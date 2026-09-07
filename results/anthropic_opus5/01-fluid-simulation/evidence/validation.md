# Fluxion — validation record

Agent-authored record of how `../index.html` was exercised, what was observed, what
broke, and what was done about it.

| | |
|---|---|
| Artifact | `/home/pyro/projects/naked/opus5/01-fluid-simulation/index.html` |
| Size / lines | 85,645 bytes · 2,043 lines · one `<style>`, one `<script>` |
| sha256 | `0fd2bbc01b1b58eab65c67ed7519e44816a920fa96b96d8d0d881c2028c7c96c` |
| Browser tool | `agent-browser` 0.31.1 (the installed `agent-browser` skill), Chrome headless 152.0.0.0 |
| GPU backend | **ANGLE / Vulkan / SwiftShader — a CPU software rasteriser.** No hardware GPU is present in this WSL2 environment. |
| Dates | 2026-09-07 |

> **Performance caveat, stated up front.** Every FPS number below was measured on
> SwiftShader, a software rasteriser. The simulation is fill-rate bound there, so
> these figures characterise the *relative* cost of each stage, not the speed on
> real hardware. No hardware-GPU measurement was possible in this environment;
> that check is recorded as **blocked**, not passed.

---

## 1. How to reproduce

```bash
cd /home/pyro/projects/naked/opus5/01-fluid-simulation
python3 -m http.server 8731 --bind 127.0.0.1 &     # inspection only; not a runtime dependency
agent-browser --session fluxion set viewport 1280 800
agent-browser --session fluxion open http://127.0.0.1:8731/index.html
```

Helper scripts used throughout live in `evidence/tools/`:

| Script | Purpose |
|---|---|
| `drag.sh <session> <x0> <y0> <x1> <y1> <steps>` | Real pointer drag via `agent-browser mouse move/down/up`. Step count sets drag speed: same path in fewer events = faster drag. |
| `probe.js` | Reads dye/velocity fields and computes centroid + totals. |
| `quiesce.js` | Prepares a still fluid by driving velocity dissipation to max for 2.5 s, then restoring it. |
| `trial.js` | A/B harness: identical deterministic initial condition, fixed number of sim steps, then structure metrics. |
| `ranges.js` | Percentile distribution of every simulation field. |
| `stress.js` | Worst-case solver settings + violent splats, checks for NaN. |
| `pngdiff.js` | Dependency-free PNG reader/differ (Node `zlib` only) — objective "did the rendered output change" evidence. |
| `touchdrag.js` | Dispatches genuine multi-touch through CDP. |
| `no-webgl2.js`, `no-webgl.js` | Init scripts that stub `getContext` to force the fallback paths. |

The app exposes a live diagnostics hook, `window.fluxion`, used both by its own status
overlay and by these checks: `.stats`, `.measure()`, `.sampleField(name)` (a 32×32
magnitude grid of `dye | velocity | pressure | divergence | curl`), plus `setMode`,
`setPaused`, `resetSim`, `clearDye`, `splat`, `seedSplats`.

---

## 2. Required public checks

### 2.1 Pointer drags inject momentum and dye; flow persists, advects, mixes — **PASS**

`drag.sh` issues real CDP mouse events; `pointerdown/move/up` were confirmed to reach
the canvas (`pointerType:mouse`, `pointerId:1`, target `glcanvas`).

Slow drag, 20 events left→right across the middle, from a cleared-dye baseline:

```
T0 baseline   dye.total=0        vel.total=389   splats=7
after drag    dye.total=110.6    centroid x=0.684 (drag ended at x=850/1280=0.66)   splats=28
```

Persistence and advection with no further input — dye stays present and the centroid
keeps drifting, i.e. it is being carried by the flow rather than sitting still:

```
+1.5 s   dye.total=29.1   centroid (0.656, 0.573)
+3.5 s   dye.total=20.5   centroid (0.645, 0.570)
```

Rendered-output change over that interval (canvas region only, UI excluded):
`meanAbsDiff 13.5, 30.6 % of pixels changed`.

Visual: `screenshots/03-drag-slow-right.png` shows a plume with roll-up vortices and
filament stretching — `27-hero-desktop-1280x800.png` shows spiral vortices and dye
mixing after three drags.

### 2.2 Drag direction and speed influence the resulting force — **PASS**

**Direction.** Same vertical extent, opposite directions, each from a quiesced field:

| Drag | Dye centroid y |
|---|---|
| Upward, screen y 720→130 | **0.626** (upper half) |
| Downward, screen y 130→720 | **0.331** (lower half) |

**Speed.** The controlled version — *identical event count*, from a quiesced field
(`velE ≈ 0`), so the only variable is distance travelled per pointer event:

| Drag | Per-event delta | Flow energy after | Dye energy after |
|---|---|---|---|
| Slow: 8 events over 100 px | 12.5 px | 13.2 | 3.41 |
| Fast: 8 events over 600 px | 75 px (6×) | **21.3** | **7.11** |

6× faster → 1.6× flow energy, 2.1× dye. The relationship is sub-linear because the
flow-energy metric saturates and a fast drag spreads its momentum over 6× the area;
the direction of the effect is unambiguous.

**Continuity during rapid movement.** A drag whose per-event jump exceeds the splat
radius is subdivided into up to 16 sub-splats along the path (`strokeSplat`), with the
per-sub-splat velocity scaled by `steps^-0.55` so a fast flick does not over-inject.
A 4-event 500 px drag produced 17 splats rather than 4, so the trail is continuous
rather than dotted. `getCoalescedEvents()` is consumed when available so no motion is
dropped between frames.

### 2.3 Switching visualization modes while running — **PASS**

Both the six labelled buttons and keys `1`–`6` were exercised. The step counter keeps
advancing across every switch and `paused` never becomes true, so nothing restarts:

```
key 1 -> Dye        steps=85    paused=false
key 2 -> Velocity   steps=92    paused=false
key 3 -> Speed      steps=100   paused=false
key 4 -> Pressure   steps=108   paused=false
key 5 -> Divergence steps=116   paused=false
key 6 -> Vorticity  steps=124   paused=false
```

Each mode renders a visibly distinct image. Canvas-region mean luminance of the
shipped `screenshots/05-mode-*.png` set (all six captured from one fluid state on the
delivered build): Dye 21.4 · Velocity 95.0 · Speed 42.4 · Pressure 24.4 ·
Divergence 19.7 · Vorticity 20.7. Absolute dye luminance tracks the hue the rainbow
cycle happened to pick for those strokes, so it is only meaningful across modes here,
not across runs. The vorticity view resolves counter-rotating vortex
pairs as opposing colours; the pressure view shows smooth high/low lobes.

### 2.4 Viscosity and vorticity produce observable behavioural differences — **PASS**

A/B via `trial.js`: identical deterministic six-jet initial condition, dissipation off,
fixed step budget, then measure. `velRelRoughness` is mean |neighbour difference|
normalised by mean magnitude — a scale-free measure of small-scale structure.

**Viscosity** (vorticity fixed at 0, 90 steps):

| Viscosity | Mean \|u\| | Relative roughness | Mean \|curl\| |
|---|---|---|---|
| 0.0 | 16.29 | 0.2094 | 1.4313 |
| 1.0 | **2.76** (−83 %) | **0.1129** (−46 %) | **0.129** (−91 %) |

Momentum is dissipated and gradients are smoothed — the signature of viscous diffusion.

**Vorticity confinement** (viscosity fixed at 0, 120 steps):

| Vorticity | Mean \|u\| | Relative roughness | Mean \|curl\| |
|---|---|---|---|
| 0 | 11.97 | 0.1998 | 0.9266 |
| 60 | 7.51 | **0.4395** (2.2×) | **4.9182** (5.3×) |

Confinement puts small-scale rotational energy back into the field, exactly its purpose.

Visual confirmation, canvas region only:
`06-vorticity-0.png` vs `06-vorticity-60.png` → **93.5 % of pixels changed**;
`07-viscosity-0.png` vs `07-viscosity-1.png` → **88.6 % of pixels changed**.

### 2.5 Clear dye removes dye without resetting velocity — **PASS**

```
before   dyeEnergy 29.795   velocityEnergy 45.362
after    dyeEnergy 0        velocityEnergy 44.501
```

Dye-view canvas luminance goes 14.16 → **0.0** (fully black), while the Velocity view
immediately afterwards still shows a rich field (luminance 49.8,
`13-after-clear-velocity-view.png`). The 0.9 % dip in flow energy is one frame of
normal velocity dissipation, not a reset. Verified through the labelled button, the
`C` key, and `fluxion.clearDye()`.

### 2.6 Pause and resume — **PASS**

```
paused  steps 128 -> 128 over 2.0 s   badge "PAUSED"
resumed steps 128 -> 153 over 2.0 s   badge "RUNNING"
```

Frozen canvas is exact: over 2.5 s paused, `pctPixelsChanged = 0.00 %`
(`meanAbsDiff 0.029`). After resuming, 87.6 % of pixels changed.

Pointer input is deliberately rejected while paused — a full 6-event drag changed
nothing:

```
before drag: paused=true  splats=32  steps=368
after  drag: paused=true  splats=32  steps=368
```

### 2.7 Reset restores a valid initial state — **PASS**

```
before reset   steps=943  splats=57  dyeEnergy=0      velocityEnergy=9.66
after  reset   steps=10   splats=7   dyeEnergy=12.84  velocityEnergy=32.62
```

Counters reset, all four fields cleared, seven seed splats re-injected, canvas
non-empty (luminance 40.8, `14-after-reset.png`), pause state preserved.

---

## 3. Delivery and runtime checks

### 3.1 Direct `file://` open with the network offline — **PASS**

```
agent-browser --session filetest set offline on
agent-browser --session filetest open "file:///…/index.html"
```

```
location.protocol "file:"   booted true   fallbackShown false
stats: 1280x800, sim 205x128, dye 1229x768, dyeEnergy 16.4, velocityEnergy 36.3
requests: 1 — GET file:///…/index.html (Document) 200
console: (empty)   errors: (empty)
after a drag: dyeEnergy 25.7, velocityEnergy 43.3
```

The delivered file boots, simulates, and responds to input with no server and no
network. Screenshot `22-file-protocol-offline.png`.

### 3.2 No external assets or services — **PASS**

- Recorded network traffic across the whole session: only `GET …/index.html`. Nothing else.
- Static scan: the sole `href`/`src` in the file is an inline `data:image/svg+xml` favicon.
  The only absolute URLs present are the SVG XML namespace (`http://www.w3.org/2000/svg`,
  an identifier, never fetched) and the literal text `chrome://gpu` in the help panel.
- Zero occurrences of `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `Worker`,
  `importScripts`, or dynamic `import(` .
- One `<style>`, one `<script>`, no build step.

### 3.3 Console and uncaught errors — **PASS**

`agent-browser console` and `errors` were empty at every checkpoint: boot, after drags,
after mode switches, after pause/resume, after resize, after the stress run, on
`file://`, and on both fallback paths.

---

## 4. Adaptivity checks

### 4.1 Window resize — **PASS**

The grid re-derives from the aspect ratio and the fluid survives the reallocation
(old textures are resampled into the new ones rather than discarded):

| Viewport | Sim grid | Dye grid | Dye energy |
|---|---|---|---|
| 1280×800 (landscape) | 205×128 | 1280×800 | 17.78 |
| 900×1100 (portrait) | **128×156** | 900×1100 | 18.88 |
| back to 1280×800 | 205×128 | 1280×800 | 19.07 |

### 4.2 High-DPI — **PASS**

At `deviceScaleFactor 2`: `devicePixelRatio 2`, CSS size 1280×800, backing store
**2560×1600**, screenshot 2560×1600. At the emulated iPhone 12 profile
(`devicePixelRatio 3`) the backing store is 780×1688 — capped at 2× by `MAX_DPR`, a
deliberate ceiling so a 3× phone does not pay 9× the fill rate.

### 4.3 Narrow viewport, 390×844 — **PASS**

Fresh load: panel auto-collapses to a bottom bar (`panelOpen:false`,
`aria-expanded:"false"`), simulation adapts to portrait (sim 128×277, dye 390×844), no
horizontal overflow (`documentElement.scrollWidth 390 === innerWidth 390`). Expanding
gives a bottom sheet at x=10 y=314 w=370 h=520. See `17-…-collapsed.png`,
`18-…-expanded.png`, `29-hero-mobile-390x844.png`.

### 4.4 Control panel reachability at 1280×800 — **PASS**

Panel body content is 1072 px in a 721 px viewport; it scrolls, and the last control
(`Restore defaults`) becomes fully visible after scrolling (`28-panel-scrolled-bottom.png`).

### 4.5 Touch and multi-touch — **PASS** (via CDP; see §6)

`agent-browser set device "iPhone 12"` sets the viewport but leaves
`navigator.maxTouchPoints = 0`, so touch was driven directly through CDP
(`evidence/tools/touchdrag.js`). Two fingers dragging in opposite directions:

```
observed: { types: { touch: 30 }, distinctPointerIds: 2,
            maxSimultaneousPointers: 2, maxTouchPoints: 5 }
dyeEnergy 38.5 -> 48.5
```

30 events arrived as `pointerType:"touch"`, both fingers were tracked simultaneously,
and both injected dye. Pointer Events unify mouse/touch/pen, so one code path serves all.

---

## 5. Robustness and capability handling

### 5.1 Numerical stability under worst-case settings — **PASS**

`stress.js`: timestep 3×, vorticity 60, **1** pressure iteration, pressure strength 1.0,
zero velocity and dye dissipation, force 3×, plus 10 splats of magnitude 12,000 per
round for 6 rounds.

```
round 0 steps=36  velE=93.292 dyeE=17.461 nonFinite=0
round 1 steps=49  velE=94.111 dyeE=18.052 nonFinite=0
round 2 steps=62  velE=93.560 dyeE=26.644 nonFinite=0
round 3 steps=75  velE=93.689 dyeE=26.656 nonFinite=0
round 4 steps=88  velE=93.913 dyeE=27.742 nonFinite=0
round 5 steps=100 velE=93.636 dyeE=29.129 nonFinite=0
```

Zero non-finite values, energy bounded, no console errors, canvas still rendering.
`Restore defaults` afterwards returned every parameter and every slider readout to its
documented default.

### 5.2 WebGL2 unavailable → WebGL1 path — **PASS**

Forced with an init script stubbing `getContext('webgl2')`. The app fell back to WebGL1
with `OES_texture_half_float`, booted with no error panel, reported backend
`WebGL1 · sw`, ran at sim 205×128 / dye 1229×768, and responded to drags
(dyeEnergy 18.0 → 22.9). Screenshot `24-webgl1-fallback.png`, canvas luminance 75.7.

### 5.3 No WebGL at all → graceful failure — **PASS**

With both context types stubbed out, the app shows an explanatory panel
("WebGL is unavailable"), remediation steps, and a diagnostic block
(`webgl2 context: false / webgl1 context: false / userAgent…`). No uncaught errors.
Screenshot `25-no-webgl-fallback.png`.

### 5.4 Software-rasteriser detection — **PASS**

`WEBGL_debug_renderer_info` is matched against `swiftshader|llvmpipe|softpipe|software|
basic render`. On a match the default dye resolution starts at 768 instead of 1024 and
the overlay reports `WebGL2 · sw`, so the user can see why and raise it from the panel.

### 5.5 Context loss — **NOT RUN**

`webglcontextlost` / `webglcontextrestored` handlers exist (they stop the loop, show the
panel, then rebuild programs and framebuffers). Triggering a genuine context loss under
SwiftShader was not attempted, so this path is **untested**.

---

## 6. Performance

Measured with a single browser session running (other sessions closed — concurrent
sessions on this 32-core CPU rasteriser distorted early readings from 15 fps down to 8).
1280×800, dpr 1, sim 205×128, dye 1229×768:

| Configuration | Frame time | FPS |
|---|---|---|
| Delivered defaults | 67 ms | 15 |
| Bloom + shading off | 44 ms | 24 |

Stage costs isolated by toggling one thing at a time (same session, EMA allowed to settle):

| Stage removed | Saving |
|---|---|
| Bloom (13 passes from a 512-short-side chain) | 8.6 ms |
| Display-shader shading (4 extra full-res dye taps) | 15.0 ms |
| Viscosity (14 Jacobi sweeps at sim res) | 2.3 ms |
| Pressure iterations 24 → 8 | 5.5 ms |
| Dye grid 1638×1024 → 819×512 | 8.4 ms |
| Sim grid 128 → 64 | 0.2 ms |

The cost is dominated by *full-screen* passes, not by the solver: the sim grid is
almost free, while every full-resolution fragment pass is expensive on a CPU rasteriser
and would be near-free on a real GPU. This drove one real optimisation — see §7.5.

Resolution controls behave as expected (`sim 64 → 102×64`, `128 → 205×128`,
`256 → 410×256`; `dye 256 → 410×256`, `1024 → 1280×800`).

**Blocked:** no hardware-GPU performance measurement was possible in this environment.

---

## 7. Failures found during development, and their fixes

Each was found by inspection of real output, fixed, and retested.

### 7.1 Dye far too dim and far too short-lived
First run rendered near-black wisps (canvas luminance **0.37**). Two causes: standalone
splats used the same faint colour as an incremental pointer sub-splat, and the default
dye dissipation of 1.0 gave a 0.7 s half-life.
**Fix:** added `SEED_GAIN` (7×) for standalone/ambient/click splats, raised `DYE_GAIN`
to 0.22, and set defaults to dye dissipation 0.18 / velocity dissipation 0.12.
**Retest:** luminance 0.37 → **25.0**, and later 99.0 on the hero capture.
(`01-initial-boot.png` vs `02-after-tuning.png`.)

### 7.2 Diagnostic views saturated to flat colour
Velocity, Speed, Pressure, Divergence and Vorticity all rendered as fully saturated
blocks because their display scales were guesses. The Velocity legend claimed
"value = speed" while brightness was pegged at maximum everywhere — the UI was
describing something the render did not do.
**Fix:** measured the real distributions with `ranges.js`
(|u| p50≈30 p90≈80 · pressure p50≈14 p90≈50 · divergence p50≈0.6 p90≈4.5 ·
curl p50≈0.85 p90≈11) and re-derived every scale from those numbers
(0.55→0.02, 0.42→0.012, 2.2→0.015, 5.0→0.25, 0.9→0.06).
**Retest:** all six modes now show graded structure; see §2.3.

### 7.3 Pressure/divergence/curl views were blocky
Those render targets used `NEAREST`, so the diagnostics showed raw texels.
**Fix:** switched them to linear filtering. The solver samples exactly at neighbouring
texel centres (`vL/vR/vT/vB`), so linear returns identical values — numerically a
no-op, visually a large improvement.

### 7.4 Legend overlapped the status overlay on narrow screens
The legend was positioned with a hard-coded `top: … + 210px`, which collided with the
taller HUD at 390×844 and hid four status rows.
**Fix:** wrapped both cards in a `#hudStack` flex column so they can never overlap at
any size. **Retest:** hud `y=10..282`, legend `y=288..349`.

### 7.5 Dye grid allocated finer than the canvas
At 1280×800 the dye field was 1638×1024 — 65 % more texels than the display could show.
**Fix:** the dye resolution setting is now a ceiling clamped to the canvas short side.
**Retest:** 1638×1024 → 1229×768, frame time 66 ms → 58 ms, no visible quality change.

### 7.6 Action buttons had polluted accessible names
`<kbd>` shortcut hints inside the buttons made the accessible name "Clear dye C", so
`find role button --name "Clear dye"` failed — and, more importantly, a screen reader
would have announced the same noise.
**Fix:** `aria-hidden="true"` on the decorative `<kbd>` elements.
**Retest:** the accessibility tree now reads cleanly (`button "Pause"`, `button "Reset"`,
`button "Clear dye"`, `button "Splash"`) and name-based clicks work.

### 7.7 Overlapping drags clipped the dye into a flat blob
Found on the final delivery capture: two overlapping strokes drove the dye field to
peak 3.4 (p90 = 1.97), far past the displayable range, so the whole worked area clipped
to one saturated colour and every filament and vortex inside it disappeared. Dye was
being injected purely additively, with nothing to stop it.
**Fix:** the splat shader gained a `soften` uniform. Momentum still accumulates without
limit (`soften = 0`); dye injection is attenuated by the room left in the field
(`soften = 1`, `room = 1 - max(base.rgb)`), so ink that is already saturated stops
accepting more. Advection and dissipation are untouched, so dye remains a passive
scalar — only injection saturates.
**Retest:** dye distribution went from `p90 1.97 / max 3.38` to `p90 0.72 / max 0.89`,
and the identical drag sequence now renders spiral vortices, filaments and a red→yellow
gradient instead of a flat blob (`30-final-delivered-file.png`). Confirmed the change is
dye-only in the same run: `dye max 0.94` while `velocity max 119.9`.

---

## 8. Tooling notes (not application defects)

- **`agent-browser batch` mangles repeated `mouse` subcommands.** A batch of
  `["mouse","move",…]` entries failed from the third command on with
  `Unknown command: [mouse,move,560,400]`, and the first two silently dispatched
  nothing. This invalidated the very first drag attempt (0 splats). Individual
  `agent-browser mouse …` calls work correctly and were used for every drag.
- **`set device "iPhone 12"` does not enable touch emulation** (`maxTouchPoints` stays
  0), so touch was exercised through CDP `Emulation.setTouchEmulationEnabled` +
  `Input.dispatchTouchEvent` instead (§4.5).
- No image-diff tooling (PIL, ImageMagick) exists in this environment, so
  `evidence/tools/pngdiff.js` was written against Node's built-in `zlib`.
- Running `agent-browser --session X close` immediately followed by `open` on the same
  session name once produced a screenshot of a blank page while the browser was still
  tearing down. Re-checked in a fresh session and the page loaded correctly; the
  affected capture was retaken. Not an application defect.
- Concurrent `agent-browser` sessions distort performance readings on a CPU rasteriser
  (15 fps dropped to 8 with three other sessions live). All figures in §6 were taken
  with a single session running.

---

## 9. Measurement caveats

- The 32×32 field probe reduces each field on the GPU and reads it back through an
  8-bit target, so values are quantised and clamp at `254/scale`. Dye (max ≈ 101) and
  velocity (max ≈ 6350) stay far below their clamps in all reported runs, but very
  extreme states could saturate the metric — this is why §5.1 reports flow energy
  flattening near 93 rather than growing without bound.
- `dyeEnergy` / `velocityEnergy` are tone-mapped means, deliberately monotonic rather
  than linear. They are used for direction-of-change claims, not absolute physics.
- Field centroids in §2.1–2.2 use the **dye** grid, which is nowhere near probe
  saturation, so those conclusions are unaffected by the clamp.

---

## 10. Status summary

| Check | Status |
|---|---|
| Drag injects momentum + dye; flow persists, advects, mixes | PASS |
| Drag direction and speed change the result | PASS |
| Continuity during rapid drags | PASS |
| Mode switching while running (6 modes, buttons + keys) | PASS |
| Viscosity produces observable difference | PASS |
| Vorticity produces observable difference | PASS |
| Clear dye removes dye, keeps velocity | PASS |
| Pause freezes; resume continues; input rejected while paused | PASS |
| Reset restores a valid initial state | PASS |
| All 13 required controls present and effective | PASS |
| Status overlay (fps, dims, mode, pause state, extra metrics) | PASS |
| 1280×800 desktop viewport | PASS |
| 390×844 narrow viewport | PASS |
| Window resize adaptation | PASS |
| High-DPI | PASS |
| Touch / multi-touch | PASS (via CDP) |
| Direct `file://` open, network offline | PASS |
| No external assets or services | PASS |
| Console clean / no uncaught errors | PASS |
| Numerical stability at extreme settings | PASS |
| Dye bounded, momentum unbounded (saturating injection) | PASS |
| WebGL1 fallback | PASS |
| No-WebGL graceful failure | PASS |
| Hardware-GPU performance | **BLOCKED** — software rasteriser only |
| WebGL context-loss recovery | **NOT RUN** |
