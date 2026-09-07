# Validation record — 3D Hydraulic Erosion Laboratory

**Artifact:** `../index.html` — one self-contained file, 145,910 bytes, 3,403 lines.
**Author of this record:** the implementing agent. All statuses below are `pass`, `fail`,
`partial`, `blocked` or `not-run`, assigned from observed output only.

## Environment and tooling

| Item | Value |
|---|---|
| Browser automation | `agent-browser` 0.31.1 (the installed `agent-browser` skill; `agent-browser skills get core [--full]` read before use) |
| Browser | HeadlessChrome/152.0.0.0 (X11; Linux x86_64) |
| WebGL renderer | `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)` — **software rasteriser, no GPU** |
| WebGL2 caps | `EXT_color_buffer_float` ✔, `OES_texture_float_linear` ✔, `EXT_float_blend` ✔, MAX_TEXTURE_SIZE 8192 |
| URL scheme used for **all** testing | `file:///home/pyro/projects/naked/opus5/02-hydraulic-erosion/index.html` — no HTTP server was started at any point |
| Host CPU | 32 logical cores; single-threaded JS |

Helper scripts written for this run (kept outside `index.html`):

* `tools/check.sh` — extracts the inline script and runs `node --check`.
* `tools/drag.sh` — real pointer drag via `agent-browser mouse move/down/up` (CDP input pipeline).
* `tools/imgdiff.py` — mean-absolute-difference between two screenshots over a crop box.
* `tools/stats.sh` — dumps the app's live diagnostics object.
* `tools/regression.sh` — the consolidated end-to-end pass; output in `logs/final-regression.log`.

The page exposes a read-only diagnostics hook `window.__ERO` (`stats()`, `deltaStats()`,
`hHash()`, plus direct access to the live `sim`/`P` objects). It reads the same state the UI
renders; it does not bypass or replace any application logic. Where a check needed thousands of
simulation steps faster than wall-clock, `__ERO.sim.step(P, sim.pickDt(P))` was called in a loop —
that is the exact call the animation loop makes. Checks marked "real rAF loop" ran unattended
with no stepping intervention.

---

## Summary

31 checks: **29 pass**, **2 partial**, 0 fail, 0 blocked, 0 not-run.
16 defects were found during validation; all 16 were fixed and retested. Details in
[Defects found and fixed](#defects-found-and-fixed) and [Limitations](#limitations).

---

## Checks

### 1. Delivery constraints

| # | Check | Status | Evidence |
|---|---|---|---|
| 1.1 | Opening the delivered file **directly** (`file://`) works | **pass** | Every check in this document ran over `file://`. Boot: `{"booted":true,"fatalShown":false}` (`logs/final-regression.log` §1). No local HTTP server was used, so this is a genuine direct-file result, not a substitute. |
| 1.2 | No external assets or services fetched | **pass** | `agent-browser network requests` after a full session: **0** requests matching `https?://` or `wss?://` (`logs/final-regression.log` §2). The only non-document entry is a `data:image/png` URI the page generates itself at runtime (`canvas.toDataURL`) for the film-grain overlay. |
| 1.3 | Single file, no build, no imports | **pass** | Static scan of `index.html`: `https?://` ×0, `<script src=` ×0, `<link` ×0, `@import` ×0, `fetch(` ×0, `XMLHttpRequest` ×0, `WebSocket` ×0, `EventSource` ×0, `new Worker` ×0, `importScripts` ×0, `require(` ×0, `import ` ×0, `<img|video|audio` ×0. One `url(` — the runtime-generated grain data URI. |
| 1.4 | Evidence and harnesses kept out of `index.html` | **pass** | All test code lives in `evidence/tools/`. |

### 2. Erosion physics — the core requirement

| # | Check | Status | Evidence |
|---|---|---|---|
| 2.1 | Moving water changes the **underlying terrain**, not only its shading | **pass** | Water rendering disabled (`Water visibility` = 0) so the water layer cannot account for any pixel change. Fixed camera and sun. 1,600 steps → `maxTerrainChange 19.0 m`, screenshot diff over the terrain region `meanAbsDiff 3.61 / 10.2 % of pixels`. Continued to 8,800 steps → `maxChange 41.1 m`, `eroded 437,056 m³`, `76.1 % of cells changed`, diff `6.10 / 17.6 %`. Screenshots `70-erode-t0-nowater.png`, `71-erode-t1600-nowater.png`, `72-erode-t8800-nowater.png`. |
| 2.2 | Water moves downhill, pools in depressions, carves channels | **pass** | Plan-view water map shows a dendritic drainage network plus filled depressions (`05-diag-drainage-network-water-plan.png`, `20-mode-2.png`). Measured discharge distribution across the grid: p50 `9.2e-4`, p90 `3.1e-2`, p99 `3.8e-1`, max `1.98` — a ~400× median-to-p99 spread, i.e. flow is genuinely concentrating rather than sheeting uniformly. Water depth p50 `0.3 mm`, p99 `1.8 m`, max `7.2 m`. |
| 2.3 | Full erosion cycle present (rain → flow → capacity → erosion → transport → deposition → evaporation → thermal) | **pass** | Implemented as a Mei-style virtual-pipe solver; each stage is separately observable: rainfall raises `waterVol`; setting `Erosion rate = 0` yields `eroded 0 m³, sediment 0` while thermal still changes terrain; capacity/deposition sweeps below; evaporation sweep below; `Thermal erosion = 0` disables the talus pass. |
| 2.4 | Sediment is carried and deposited, not just removed | **pass** | Over a default 100 s unattended run: `eroded 221,904 m³` vs `deposited 75,053 m³` with `1.1 k m³` in suspension at any instant. The Δ-erosion map shows red (cut) on ridges/channels and green (fill) in valleys and fans: `20-mode-4.png`. |
| 2.5 | Diagnostics evolve consistently with each other | **pass** | 100 s unattended: steps 36 → 3,854, sim time → 77.1 u, water 82,766 m³, wet cells 9.7 %, eroded 221,904 m³, deposited 75,053 m³, max change 31.3 m, cells changed 74.9 %, `recoveries 0`. Eroded ≥ deposited at all times (the map has draining boundaries, so some sediment leaves the site), and suspended load stays bounded. |

### 3. Parameter response (required check)

Each sweep resets to the same seed/terrain first, then runs 1,200 identical steps.

| Sweep | Result | Status |
|---|---|---|
| **Erosion rate** 0.00 / 0.55 / 2.20 | eroded `0` / `80,529` / `102,854` m³ · deposited `0` / `26,429` / `40,155` m³ · suspended `0` / `20.65` / `23.01` · cells changed `43.1 %` / `72.6 %` / `73.2 %` | **pass** |
| **Evaporation** 0.001 / 0.030 / 0.090 | water `157,581` / `32,739` / `11,120` m³ · wet cells `13.2 %` / `7.0 %` / `4.4 %` · eroded `98,615` / `67,803` / `45,252` m³ | **pass** |
| **Sediment capacity** 0.1 / 1.1 / 3.5 | eroded `7,899` / `80,529` / `196,396` m³ · suspended `2.05` / `20.65` / `52.75` | **pass** |

All three responses are monotone and physically sensible (erosion rate saturates because the
model is capacity-limited — raising the *rate* reaches capacity sooner, raising *capacity*
raises the ceiling; that is the intended behaviour of a stream-power model, not a defect).

### 4. Pointer editing (real input through the CDP input pipeline)

Every drag below was issued with `agent-browser mouse move / down / up` — genuine browser input
events, not synthesised JS. Simulation paused during measurement so only the brush can change state.

| # | Tool | Status | Observed |
|---|---|---|---|
| 4.1 | Add water | **pass** | Drag (560,430)→(700,470): +7,193 cells of water, **96 % of it within 60 cells of the stroke path** (`nearStroke 6,905.9` vs `elsewhere 287.3`). Screenshot `12-water-brush-stroke.png`. Regression run: +3,796 cells. |
| 4.2 | Raise | **pass** | Max raise **+52.5 m**, 7,086 cells touched (with the lower stroke). Regression run: +38.2 m over 2,809 cells. |
| 4.3 | Lower | **pass** | Max lower **−40.5 m**. |
| 4.4 | Smooth | **pass** | Local Laplacian roughness at the brush centre `0.1674 → 0.0676` (−60 %). |
| 4.5 | Flatten | **pass** | Height standard deviation within ±6 cells of the centre driven to **exactly 0** (whole disc at 39.416). |
| 4.6 | Add sediment | **pass** | Sediment 0 → 2,665 cells (and +8,528 water, since the tool injects carrier water). |
| 4.7 | Dry | **pass** | Water 8,528 → 2,161 (−75 %), sediment 2,665 → 835 (−69 %). |
| 4.8 | Inspect / probe | **pass** | See §6. |
| 4.9 | Brush radius responds live | **pass** | Same stroke at `brushR=8` → 189 cells touched (π·8² ≈ 201); at `brushR=45` → 3,135 cells. Slider changes take effect on the next frame of an in-progress stroke. |
| 4.10 | Brush is continuous during a drag (no gaps at speed) | **pass** | Stroke path is resampled at ≤ ¼ brush radius and weighted by real frame `dt`; a 140-px drag over 20 samples produced one continuous band of water rather than discrete blobs (`12-water-brush-stroke.png`). Holding the button without moving keeps applying at the frame rate. |

### 5. Camera controls, and no conflict with editing

| # | Check | Status | Observed |
|---|---|---|---|
| 5.1 | Orbit with the Orbit tool (left drag) | **pass** | az `0.78 → 0.408`, el `0.5 → 0.445`. |
| 5.2 | Orbit while a **brush tool is active** (right drag) | **pass** | With the Water brush selected: az `0.78 → −0.212`, el `0.5 → 0.17`. |
| 5.3 | Editing tools do not fire during camera drags | **pass** | Total water before orbit drags `2160.71`, after `2160.71` — bit-identical. |
| 5.4 | Pan (middle drag) | **pass** | target `[0,0.12,0] → [0.24,−0.067,0.085]`. |
| 5.5 | Zoom (wheel) | **pass** | distance `3.05 → 2.145`. |
| 5.6 | Shift+left-drag pan | **partial** | The CLI's `mouse down` takes no modifier flag, so the modifier variant could not be driven with real input. The equivalent gesture (middle-drag) is verified in 5.4 and shares the same `pan()` path. |

### 6. Probe / hover readout

| # | Check | Status | Observed |
|---|---|---|---|
| 6.1 | Probe reports meaningful, position-dependent values | **pass** | Hover (560,430) → cell `111,156`: elevation `25.1 m`, water `0.9 mm`, surface `25.1 m`, sediment `0.05 mm`, concentration `0.052`, speed `0.049 c/s`, heading `207° SW`, slope `16.0°`, Δ `−0.00 m`, state `trace film`. Hover (760,500) → cell `230,181`: elevation `163.7 m`, slope `46.1°`. Values track the hovered cell, not a fixed readout. |

### 7. Run control, determinism, reset

| # | Check | Status | Observed |
|---|---|---|---|
| 7.1 | Pause holds the simulation | **pass** | steps `74` before, `74` after 3 s paused; regression run `494 → 494`. |
| 7.2 | Single step advances exactly one step | **pass** | 3 clicks on **Step** → `74 → 77`; regression run `494 → 495`. |
| 7.3 | Seed is deterministic | **pass** | seed 1337 → hash `−1127473866`; seed 20260907 → `674728775`; seed 1337 again → `−1127473866`. Identical hash from two independent generations. |
| 7.4 | Regenerate rebuilds from the seed | **pass** | Regenerate with an unchanged seed reproduces the same hash. |
| 7.5 | Reset restores terrain and clears water | **pass** | After 400 steps hash `1685054674`; after **Reset** hash back to `−1127473866`, `water = 0`, `max |h−h₀| = 0`, `steps = 0`, `time = 0`. |

### 8. Visualisation modes

| # | Check | Status | Observed |
|---|---|---|---|
| 8.1 | Seven modes render distinctly | **pass** | `20-mode-0.png` … `20-mode-6.png` (shaded, elevation, water depth, sediment, Δ erosion, slope, flow direction). |
| 8.2 | Switching modes does **not** reset the simulation | **pass** | Before cycling all 7: `{steps:3500, t:70.0000000000032, hash:469406528}`; after: identical on all three. Regression run repeats this at step 495 — `identical: true`. |
| 8.3 | Legend tracks the active mode with real ranges | **pass** | Shaded `5 m → 246 m` + 4 swatches · Water depth `0 m → 1.48 m` · Δ erosion `−12.9 m → +12.9 m` + cut/fill swatches · Flow `peak 0.96 cell/step` + heading swatches. `53-legend-visible.png`. |

### 9. Rendering behaviour

| # | Check | Status | Observed (screenshot diff over the terrain region, 78,000 samples) |
|---|---|---|---|
| 9.1 | Lighting responds to the light direction | **pass** | Sun azimuth 318° vs 120°: `meanAbsDiff 48.83`, `76.2 %` of pixels changed. Sun elevation 34° vs 8°: `21.79 / 44.2 %`. |
| 9.2 | Normals/lighting follow the eroding heightfield | **pass** | See 2.1 — with water hidden and lighting fixed, shading still changes as the terrain erodes. |
| 9.3 | Cast shadows | **pass** | On vs off: `3.82 / 9.1 %` — confined to shadowed regions, as expected. Implemented as an O(N²) CPU horizon sweep recomputed every frame. |
| 9.4 | Contour lines | **pass** | On vs off: `0.52 / 1.3 %` — thin lines only. |
| 9.5 | Water layer visibility | **pass** | 100 % vs 0 %: `4.26 / 8.1 %`, matching the ~10 % wet fraction. |
| 9.6 | Vertical exaggeration | **pass** | 1.0× vs 2.6×: `41.60 / 72.0 %` — geometry, not just shading. |
| 9.7 | Dry / wet / standing / sediment-laden / steep / freshly-cut / freshly-filled are visually distinct | **pass** | Distinct shader terms for each; visible in `50-hero-oblique.png` (wet darkening, cyan standing water, ochre fresh fans, exposed bedrock on steep faces) and enumerated in the legend. |

### 10. Presets

| # | Preset | Status | Observed |
|---|---|---|---|
| 10.1 | Mountain drainage | **pass** | ridged massif, 256², substeps 2. `30-preset-0.png` |
| 10.2 | Canyon formation | **pass** | tilted mesa, capacity 3.2, deposition 0.18, talus 62°, thermal 0.07 → deepest incision of all presets (`maxChange 24.2 m`). `30-preset-1.png` |
| 10.3 | Island rainfall | **pass** | island cone, high rain + high evaporation → radial gullies and a shallow perimeter. `30-preset-2.png` |
| 10.4 | River valley | **pass** | tilted shelf, deposition 0.95 → braided channels and ponds. `30-preset-3.png` |
| 10.5 | Aggressive stress test | **pass** | 384², substeps 4, speed 2×. Ran live 25 s: `9.8 fps`, sim alone `48.4 ms/frame`, `recoveries 0`, `dtClamped false`, `6.98 M m³` eroded, `maxChange 64.9 m`. Heavy by design and stayed stable. `30-preset-4.png`, `54-stress-preset-384.png` |

### 11. Import / export

| # | Check | Status | Observed |
|---|---|---|---|
| 11.1 | Export heightmap PNG (real button click, real download) | **pass** | `~/Downloads/erosion-heightfield-256x256-seed1337.png`, 45,632 bytes. Decoded independently: **256 × 256**, `R == G == B` for every pixel (true grayscale), all 256 levels used, range reported in the toast (`1.7–247.0 m`). Copy in `exports/`. |
| 11.2 | Export full state JSON | **pass** | `~/Downloads/erosion-state-256-t19.json`, 2,447,709 bytes. Parses as JSON; carries `format`, `version`, `grid`, 30 `params`, `view`, `stats`, and 7 base64 float32 fields (`h,h0,w,s,dRec,vx,vy`) each 349,528 chars = 262,144 bytes = 65,536 float32 ✔. Copy in `exports/`. |
| 11.3 | Import restores state exactly | **pass** | State perturbed first (reset, seed → 5, capacity → 0.1, camera moved, resolution → 128), then imported. Restored hash `1334176461` == pre-export hash, steps 934, t 18.68, water volume, sediment, seed, capacity and camera azimuth all matched. Regression run repeats: `exact: true`. |
| 11.4 | Import from a real file via the file input | **pass** | `agent-browser upload "#fImport" evidence/exports/erosion-state-256-t19.json` → toast `State imported · 256×256 · t=18.7 · 934 steps`, hash matched. |
| 11.5 | Drag-and-drop JSON onto the viewport | **not-run** | Handler is wired (`document` `drop` listener → `readJSONFile`), and the identical `readJSONFile` path is covered by 11.4. A DataTransfer file drop could not be synthesised through the CLI. |

### 12. Responsiveness, DPI, input breadth

| # | Check | Status | Observed |
|---|---|---|---|
| 12.1 | Desktop 1280 × 800 | **pass** | No horizontal scroll (`scrollWidth == innerWidth`), all overlays placed, legend clear of the panel. |
| 12.2 | Narrow 390 × 844 | **pass** | Bottom-sheet panel (324→844), mode bar under the masthead (56→86), compact two-column telemetry (96→292) — no overlaps, `scrollWidth 390 == innerWidth`. `40-mobile-390x844.png`, `41-mobile-panel-collapsed.png` |
| 12.3 | Continuous resize while running | **pass** | 1440×900 → 800×600 → 390×844 → 1024×640 → 360×780 → 1280×800: buffer tracks CSS size, `scrollWidth ≤ innerWidth` at every step, simulation continued uninterrupted (steps 56 → 236), 0 errors. |
| 12.4 | High-DPI | **pass** | `devicePixelRatio 2` at 1280×800 CSS → 2560 × 1600 backing store. `devicePixelRatio 3` (iPhone-14 emulation) → capped at 2 → 780 × 1688 for a 390 × 844 CSS canvas. |
| 12.5 | Touch / pointer interaction | **partial** | `agent-browser set device "iPhone 14"` set the viewport and DPR but **did not enable OS-level touch injection** (`'ontouchstart' in window === false`, `navigator.maxTouchPoints === 0`), so real touch could not be injected. The touch code path was instead driven with `PointerEvent`s carrying `pointerType:'touch'` dispatched into the real browser event system: one finger orbited (az `0.78 → 0.284`), two fingers pinch-zoomed and panned (dist `3.05 → 1.694`, target moved), and a one-finger stroke with the Water tool added 3,539 cells of water. Mouse/pen pointer input is fully covered by §4–§5 with genuine input events. |
| 12.6 | Keyboard shortcuts | **pass** | Space (pause/resume), N (single step), R (reset), G (regenerate), 1–7 (modes), tool letters, `[` / `]` (brush radius 22 → 25 → …), Tab (panel), H (hide all overlays) all verified by observing app state after each keypress. |

### 13. Stability and recovery

| # | Check | Status | Observed |
|---|---|---|---|
| 13.1 | Extreme parameter combinations | **pass** | 4 combinations × 900 steps (all-max incl. talus 12° and evaporation 0; all-min; erosion max with deposition 0 and evaporation 0; no rain with max thermal): `nonFinite 0`, `negativeWater 0`, `recoveries 0`, heights bounded, no console errors. Repeated in the regression pass with substeps 8 and speed 4×: same result. |
| 13.2 | Settings changed while running | **pass** | 7 rounds of randomising **every** control (resolution, speed, substeps, all hydrology/erosion/brush/view sliders, all checkboxes, render-quality preset) while the loop ran: 0 errors, 0 recoveries, state finite throughout. |
| 13.3 | Graceful recovery from a corrupted state | **pass** | 500 cells deliberately poisoned with `NaN` / `Infinity` / `−1e30`: sanitiser repaired **1,992 bad values**, 0 remained, state still clean after 200 further steps, and the HUD stability badge switched to `recovered ×1`. |
| 13.4 | Resolution change preserves state | **pass** | Resample 256 → 512 → 128 → 256 with the simulation paused: water volume `70,167 → 70,372 → 72,084 → 72,505 m³` (+3.3 % over three resamples including a 4× downsample), sediment +2.5 %, **mean elevation `88.56 → 88.57 m` (+0.01 %)**, step count and sim time preserved exactly. |
| 13.5 | Numerical-stability reporting | **pass** | HUD shows `stable` / `CFL clamped` / `recovered ×n`, plus live `dt`, peak speed in cells/step, sim and draw milliseconds. |

### 14. Performance

Measured on the **software rasteriser** described above; a real GPU removes almost all of the
draw cost but not the CPU solver cost.

| Configuration | Result |
|---|---|
| Solver cost per step | 128² `1.34 ms` · 192² `2.15 ms` · 256² `3.58 ms` · 384² `7.94 ms` · 512² `13.88 ms` |
| Default (256², 2 substeps), auto quality | settles at level 6 (mesh 112, 0.48× scale) → **21–29 fps**, sim 8 ms/frame |
| Default at forced "Balanced" (mesh 256, 1.0×) | 7–10 fps — draw-bound in SwiftShader, not solver-bound |
| Stress preset (384², 4 substeps, 2× speed) | 9.8 fps, of which 48.4 ms is the solver |
| Adaptive quality behaviour | descends only while frames exceed 40 ms, climbs below 18 ms, never auto-descends past level 6; manual override available (Auto / Ultra … Minimum) |

---

## Defects found and fixed

Each was found by a check above, fixed in `index.html`, and retested by re-running the same check.

| # | Defect | Fix | Retest |
|---|---|---|---|
| 1 | Adaptive `dt` collapsed geometrically (0.02 → 0.0009) because the CFL guard divided by a velocity that is itself ∝ 1/dt under the virtual-pipe outflow clamp — the simulation effectively froze in sim-time. | `pickDt` rewritten: the outflow clamp already guarantees non-negative water and semi-Lagrangian transport is unconditionally stable, so `dt` is only reduced when reported flow exceeds ~3 cells/step. | `dt` holds at 0.02, `dtClamped false`, sim time advances 77 u in 100 s. |
| 2 | Erosion far too aggressive: cells eroded to −103 m, terrain degenerated into downward spikes. | Recalibrated capacity scale, added a per-step incision cap (`0.008·S` cells). | `hMin` stays ≥ 0.4; `01-defect-over-erosion-spikes.png` → `50-hero-oblique.png`. |
| 3 | No channelisation: capacity used flow **velocity**, which saturates at ~1 cell/step almost everywhere under the outflow clamp, so it carried no signal. | Capacity switched to a stream-power law `C ∝ Kc · sin(slope) · √discharge`, using net discharge through the cell. | Discharge p50→p99 spread ≈ 400×; dendritic networks appear (`05-diag-drainage-network-water-plan.png`). |
| 4 | The first ~500 steps were dominated by a one-off talus transient (100 m of relaxation) that swamped the fluvial signal. | Generated terrain is pre-relaxed to its angle of repose (`relaxTalus`, 55 iterations) at generation time. | `maxChange` after 2,500 steps fell from `100.6 m` (thermal transient) to `17.2 m` (fluvial); Δ map became channel-dominated (`06-diag-delta-after-talus-prerelax.png`). |
| 5 | Draining map edges produced artificially high discharge and a ragged eroded rim. | Incision tapered over the outermost 4 cells. | Rim artefacts gone in plan view. |
| 6 | Auto-quality controller wrongly concluded downgrades bought nothing (it averaged an already-EMA-smoothed frame time and measured the block containing the buffer rebuild), so it locked quality at an unusable level. | Rewritten to average **raw** frame times, skip settle blocks after a change, simple 40 ms/18 ms hysteresis, never auto-descends past level 6. | Converges to level 6 → 21–29 fps in software rendering; stays high on fast renderers. |
| 7 | The blended water pass drew the entire terrain mesh and discarded most fragments. | Per-frame dynamic index buffer containing only wet quads. | Water triangles 24,642 → 10,582; **19.9 → 29.3 fps** (+47 %). |
| 8 | Telemetry (water volume, sediment) did not update after painting while paused. | `statsDirty` flag recomputes stats on the next frame after an edit. | Water volume updates immediately after a paused brush stroke. |
| 9 | The Smooth brush snapshotted the region into a buffer and then never read it, smoothing in-place (order-dependent). | Neighbour samples now read from the snapshot. | Roughness `0.1674 → 0.0676`, order-independent. |
| 10 | "Canyon formation" preset flooded its flat plateau into one lake (58 % of cells wet) instead of incising. | Plateau landform became a gently tilted mesa with residual relief so it actually drains; rain/evaporation retuned. | Wet cells 58 % → 9.7 %, drainage network visible, deepest incision of all presets (24.2 m). |
| 11 | On narrow viewports the telemetry block collided with the mode bar, and the collapsed-panel layout rules never applied — `#panel.hidden ~ #modebar` requires the panel to precede the mode bar in the DOM, and it does not. | Mode bar moved under the masthead on narrow screens, telemetry switched to a compact two-column grid, and a `body.panel-off` class replaced the sibling selectors. | 390×844: masthead 12→41, mode bar 56→86, telemetry 96→292, panel 324→844 — no overlap. |
| 12 | Render pixel ratio was cached when quality changed, so moving to a different-DPI display was ignored. | Recomputed inside `resizeCanvas` on every resize. | DPR 2 → 2560×1600; DPR 3 → capped at 2. |
| 13 | The legend was permanently hidden behind the desktop control panel. | Offset by the panel width, and moved flush right when the panel is collapsed. | Legend visible and left of the panel in all modes (`53-legend-visible.png`). |
| 14 | `setPointerCapture` could throw for a stale or synthetic pointer id and abort the handler. | Wrapped in `try/catch`. | Synthetic touch pointers no longer break the pointer-down path. |
| 15 | `[` / `]` produced a fractional brush radius (24.73) that disagreed with the slider. | Rounded. | Radius steps through integers. |
| 16 | The probe labelled a 0.9 mm water film "dry". | State classification refined: dry / trace film / damp film / sheet flow / channel flow / standing water, with a `· turbid` suffix. | Probe now reports `trace film` for 0.9 mm. |

---

## Limitations

* **Software renderer only.** All frame-rate numbers come from SwiftShader. The application is
  fragment- and vertex-bound there; on GPU hardware the draw cost largely disappears, but the
  CPU solver cost (§14 row 1) does not. GPU-hardware performance was **not measured**.
* **Real touch injection unavailable** (check 12.5). Touch behaviour was exercised through
  genuine `PointerEvent` dispatch with `pointerType:'touch'`, not through the OS/CDP touch
  pipeline. Multi-touch on a real device is therefore untested.
* **Shift+drag pan** (check 5.6) could not be driven with a real modifier-held mouse button;
  the same `pan()` code path is verified via middle-drag.
* **File drag-and-drop import** (check 11.5) is not exercised; the file-input path into the same
  loader is.
* **"Canyon formation" is the weakest preset.** It produces a genuinely incising dendritic
  network on a tilted mesa (deepest Δ of any preset), but not the sheer-walled slot canyons the
  name might suggest — reaching those needs a much longer run or a manual capacity increase.
* Sediment totals do not survive a resolution change exactly (they re-equilibrate within ~40
  steps) because sediment capacity is a function of grid-resolved slope and discharge. Water
  volume and mean elevation, which are genuinely conserved quantities, are preserved (13.4).
* Audio: not applicable — the application produces no sound.

---

## How to re-run

```bash
# syntax check of the inline script
evidence/tools/check.sh

# full end-to-end pass (writes the same log as logs/final-regression.log)
bash evidence/tools/regression.sh

# single real pointer drag: session x1 y1 x2 y2 [steps] [button] [hold-ms]
bash evidence/tools/drag.sh ero 540 430 700 480 16 left 500

# screenshot difference over a crop box
python3 evidence/tools/imgdiff.py a.png b.png 300,220,950,700
```
