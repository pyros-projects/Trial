# Validation — 3D Hydraulic Erosion Laboratory

Artifact: `../index.html` (single self-contained file, 146 856 bytes; inline CSS, JS, GLSL, SVG icons and a data-URI favicon; no imports, no network access).
Date: 2026-09-27. Author: Claude (agent-run validation; nothing here is an evaluator score).

## Tools and environment

| Tool | Version / notes | Used for |
|---|---|---|
| `agent-browser` (installed skill, `.agents/skills/agent-browser`) | 0.31.1. Read `SKILL.md` stub, `agent-browser skills get core --full`, and `skills get dogfood` (exploratory workflow) before use | All browser checks except multi-touch |
| Headless Chrome (driven by agent-browser) | HeadlessChrome/152, WebGL2 via ANGLE → SwiftShader (software GPU), DPR 1 (2 in HiDPI test) | Rendering, input, screenshots, downloads, uploads, video |
| Playwright MCP (substitution) | Chromium, CDP `Input.dispatchTouchEvent` + `Emulation.setTouchEmulationEnabled` | Multi-touch only. agent-browser only offers touch via its iOS provider. Playwright refuses `file:`, so this one test used the local dev server |
| Node.js | v25.8.1 | Numerical tests on the simulation core extracted from the shipped `index.html` |
| `evidence/scripts/serve.js` | dev-only static server that logs every request | HTTP runs (touch test; network isolation test) |

Every agent-browser check below ran on the delivered file opened directly as `file:///…/02-hydraulic-erosion/index.html` at 1280×800 unless stated otherwise. So the direct-file check is **pass**; it was the normal mode of testing, not a separate spot check.

Important caveat on performance: headless Chrome here renders with **SwiftShader (CPU)**, so FPS values in screenshots (≈10–13 fps, auto render scale 0.5–0.85) reflect software rendering on a busy CPU, not a GPU. Real-GPU frame rates were **not measured** (see limitations).

## Results summary

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Loads from `file://`, WebGL2 initialises, sim starts immediately, no console/page errors | **pass** | `screenshots/01-first-load.png`, `logs/T99-regression.log` (R1, R11) |
| 2 | Pause/resume (button + Space), single step (button + N) advances exactly one dt | **pass** | `logs/T1-T2.log`, `logs/T1b-T2.log`, `logs/T99-regression.log` (R6) |
| 3 | Orbit (RMB drag), pan (MMB drag), zoom (wheel); Orbit tool: LMB orbits without editing | **pass** | `logs/T1b-T2.log`, `screenshots/13-after-orbit-pan-zoom.png` |
| 4 | Camera never conflicts with editing: RMB drag with Raise active changes 0 terrain cells | **pass** | `logs/T3-brush.log` |
| 5 | Pointer tools: raise, lower, smooth, flatten, add water, add sediment, dry, inspect | **pass** | `logs/T3-brush.log`, `screenshots/14…16` |
| 6 | Brush radius/strength change during one continuous drag (keys `[` `]` `-` `=`) | **pass** | `logs/T4-live-adjust.log`, `screenshots/17-mid-stroke-bigger-brush.png` |
| 6b | Shift+wheel (radius) / Alt+wheel (strength) | **blocked** | agent-browser does not apply held modifiers to wheel events (`shiftKey:false` observed); code path exists but was not exercised |
| 7 | Water moves downhill and pools; terrain geometry (not only shading) evolves | **pass** | `logs/T5-downhill.log`, `logs/T17-long-run.log`, `logs/T17b-channel-cell.log`, `screenshots/40…44` |
| 8 | Water depth, sediment and erosion/deposition diagnostics evolve consistently | **pass** | `logs/T17b-channel-cell.log`, `logs/T6-params.log` |
| 9 | Erosion and evaporation parameters cause meaningful, measurable differences | **pass** | `logs/T6-params.log`, `screenshots/20-param-*.png` |
| 10 | 7 visualization modes; switching never resets the simulation | **pass** | `logs/T7-modes.log`, `screenshots/21-mode-*.png` |
| 11 | Reset restores the t=0 terrain exactly | **pass** | `logs/T8-reset-regen.log`, R7 in `logs/T99-regression.log` |
| 12 | Regenerate; deterministic seed (same seed → bit-identical terrain; new seed → different) | **pass** | `logs/T8-reset-regen.log`, `logs/T8b-seed.log`, `screenshots/22,23` |
| 13 | Resolution change while running (256→192→384→128→256) | **pass** | `logs/T9-stability.log`, `screenshots/26-after-resolution-changes.png` |
| 14 | Extreme parameters while running; stress-test preset; CFL guard | **pass** | `logs/T9-stability.log`, `screenshots/27,28` |
| 15 | Injected NaN/Inf → detection, rollback, dt reduction, warning, recovery | **pass** | `logs/T9-stability.log`, `screenshots/29-nan-recovery.png` |
| 16 | Heightmap export as 16-bit grayscale PNG (browser download, verified outside the browser) | **pass** | `logs/T10-png-verify.log`, `exports/heightmap.png`, `exports/regression-heightmap.png` |
| 17 | Full-state JSON export → import through the real file input → bit-exact resume | **pass** | `logs/T10-export-import.log`, `logs/T99-regression.log` (R8), `logs/numerics-node.log` |
| 18 | Malformed / non-JSON import rejected with an error, state untouched | **pass** | `logs/T10-export-import.log`, `screenshots/25-import-error.png` |
| 19 | All presets (mountain drainage, canyon, island, river valley, stress test) | **pass** | `screenshots/10-*`, `12-*`, `28-stress-test.png` |
| 20 | Narrow viewport 390×844: no horizontal scroll, bottom-sheet controls | **pass** (after fixes) | `screenshots/30-mobile-390x844.png`, `31-mobile-sheet-open.png` |
| 21 | Touch: one-finger tool, Orbit tool one-finger orbit, two-finger pinch / twist / pan (camera only) | **pass** (emulated touch via Playwright/CDP) | Playwright result quoted below, `screenshots/32-touch-playwright-390.png` |
| 22 | HiDPI (DPR 2) canvas backing store scales with devicePixelRatio | **pass** | `logs/T15-hidpi.log`, `screenshots/34-hidpi-dpr2.png` |
| 23 | No external requests; works with external internet blocked (HTTP run) | **pass** | `logs/T16-network.log`, `logs/http-server.log` |
| 24 | View controls: contours, grid, sun azimuth/elevation, vertical exaggeration, water visibility | **pass** | `logs/T18-view-controls.log`, `screenshots/70…73` |
| 25 | Mass and water budget closure (numerical coherence) | **pass** | every stats line: relative residual 1e-15…1e-13 |
| 26 | Real-GPU performance (FPS on hardware graphics) | **not-run** | only SwiftShader available |
| 27 | Firefox / Safari | **not-run** | Chromium only |
| 28 | Audio | n/a | the app has no audio |

## Detailed observations (exact values)

### Pause / step / camera (`scripts/` inline in logs T1-T2, T1b-T2)
- Clicking **Pause**: `paused:true`, button text "Resume", HUD chip "PAUSED"; after 2 s `t` unchanged (5.65 s).
- **Step** button: t 5.65 → 5.70 (dt 0.05, exactly one step). **N** key: +0.05 more.
- Space with focus on a button (after clicking Step) now toggles pause (bug found and fixed, see F5).
- RMB drag: yaw −0.75 → −1.59, pitch 0.62 → 0.52. MMB drag: target (0, 46.2, 0) → (20.1, 46.2, 64.2). Wheel −400: dist 760 → 470.3.
- Orbit tool + LMB drag: yaw −1.59 → −1.29, `terrainCellsChanged: 0`.

### Brush tools, sim paused (`scripts/t3-brush.sh`, `logs/T3-brush.log`)
| Tool | Before | After |
|---|---|---|
| Raise (1.2 s hold) | h = 41.935 m | h = 48.499 m; brush material +6157 m³ |
| RMB drag with Raise active | — | terrain cells changed = **0** (camera yaw changed) |
| Lower (1.5 s) | h = 48.499 | h = 40.416 |
| Add water (1.2 s) | Σd(7×7) = 0.093 | 67.72 m; water budget `brushW` +1231.5 m³ |
| Add sediment (0.8 s) | Σs(7×7) = 0.050 | 31.61 (into suspension, water present) |
| Dry (1.2 s) | Σd = 67.72, Σs = 31.61 | Σd = 8.88, Σs = 4.14; suspended load deposited as loose soil (27.47) |
| Smooth (2 s) | roughness 31.35 | 6.90 |
| Flatten (stroke) | start h 41.07, target area 33.75 | target area 39.23 (pulled toward start height) |
| Inspect (click) | — | probe pinned at cell (65.5, 157.1); panel "Probe · pinned" with 13 live values |

### Continuous-drag brush adjustment (`scripts/t4-brush-live-adjust.sh`)
One uninterrupted LMB drag; keys pressed while the button stays down:
`seg1 r=20 s=0.30 → 323 cells changed`; after `]`×6: `r=39.5, 1263 cells`; after `=`×8: `s=0.70, max Δh 19.9 m`; after `[`×10: `r=12.7`. Slider UI followed (`#b-radius` = 39, then 13).

### Water runs downhill (`scripts/t5-downhill.sh`, rain = evaporation = 0 set by focusing the sliders and pressing Home)
Water painted on the steepest visible point (slope 1.77): region water 477 → 1733 m³, 2.99 m deep at the painted cell. After running:
water-weighted bed elevation 39.29 → 38.94 → 31.85 → **28.02 m**; deepest cell moved from the painted cell (bed 44.8 m) to a cell with bed **22.9 m**, depth 5.58 m (pooling); painted cell drains to 0.007 m. The first run of this script (tool accidentally still Raise because the key went to a focused slider — a test mistake) still showed the pre-existing water's weighted elevation falling 39.4 → 26.5 m.

### Terrain geometry evolves under flowing water (`scripts/t17-long-run.sh`, `t17b-channel-cell.sh`)
Default preset from Reset (t = 0): max |Δh| 0.14 m at t = 1.5 s → 3.74 m (t = 62) → 5.86 m (t = 120) → 7.43 m (t = 180); eroded 20 → 23 507 m³, deposited 19 575 m³; mass residual ≤ 7e-15.
Probe pinned (real Inspect click) on the most incised **wet** cell (72,108):

| t (s) | bed Δh since t=0 | water depth | speed | suspended |
|---|---|---|---|---|
| 181.1 | −4.234 m | 0.082 m | 4.03 m/s | 32.6 mm |
| 211.6 | −4.552 m | 0.132 m | 4.14 m/s | 52.4 mm |
| 241.6 | −4.780 m | 0.139 m | 3.92 m/s | 55.4 mm |

Channel bed keeps incising while sediment-laden water flows through it. `screenshots/40-longrun-t0-shaded.png` vs `41-longrun-t180-shaded.png` (same camera) show new ponds, sand deposits and channels; `42` (Δh) and `43` (water) show the corresponding diagnostic fields.

### Parameter sensitivity (`scripts/t6-params.sh`; identical terrain, each run to t ≈ 61 s, one slider changed with focus + Home/End)
| Run | water m³ | wet % | suspended m³ | eroded m³ | deposited m³ | evaporated m³ |
|---|---|---|---|---|---|---|
| erosion rate 0 | 5616 | 18.6 | 0 | 0 | 0 | 357 |
| erosion rate 3 | 5588 | 18.4 | 3963 | 14 631 | 10 395 | 355 |
| evaporation 0 | 5916 | 18.9 | 3630 | 12 133 | 8272 | 0 |
| evaporation 10 | 3473 | 15.9 | 2063 | 7593 | 5372 | 2569 |

(These runs predate the sediment-concentration cap, F9; the regression and long runs were made after it.)

### Visualization modes (`scripts/t7-modes.sh`)
Clicked all 7 mode buttons while running: steps 1898 → 1962 → 2026 → 2096 → 2168 → 2248 → 2318 (monotonic, never reset); legend and HUD "View" follow each mode (e.g. "Water depth [0 .. 0.88]", "Erosion / deposition [−3.72 .. +3.72]", "Flow velocity [0 .. 10.10]").

### Reset / regenerate / seed (`scripts/t8-reset-regen.sh`, `t8b-seed.sh`)
Reset after 20 s: `t 0, steps 0, max|h − h0| = 0, water 0`. Regen with the same seed (button and G key): identical terrain hash. Seed 98765 → different hash; back to 1337 → initial-terrain hash identical to first page load (`-1122691052`). Landform "Island" + Relief End → boundary switched to sea level (21 m), heights −26…246 m.

### Stability (`scripts/t9-stability.sh`)
- Resolution while running: 256 → 192 → 384 → 128 → 256, each resampled from the running state, finite, mass residual ≤ 1.7e-14 (resample adjustment is booked in the budget).
- Sim speed, substeps, flow, rain, erosion, capacity, thermal all at maximum (End key): CFL guard subdivides steps ×8 (dt 0.025 s, CFL 0.34–0.40), finite, mass residual 2e-14.
- Stress-test preset (384², 16 substeps, speed 4): finite for the whole run, "CFL-limited" (CFL ≈ 0.69 with the ×8 split cap), CPU-budget limited, mass residual ≤ 2.3e-14.
- Injected `NaN`/`Infinity` into the state: next frame shows "⚠ Numerical instability detected — NaN/Inf in state: rolled back to t=2.8 s, dt ×0.5"; HUD "recovering (dt ×0.5) · 1 rollback"; 8 s later running normally again.

### Export / import (`scripts/t10-export-import.sh`, `scripts/verify-png.js`, `t99b-regression-io.sh`)
- Real clicks on "Heightmap PNG" and "Export state" produce browser downloads (`exports/heightmap.png` 128 KB, `exports/state.json` 10.1 MB).
- PNG verified in Node: signature and all chunk CRCs valid, IHDR 256×256, **bit depth 16, colour type 0 (grayscale)**, tEXt metadata with min/max metres; decoded samples match page heights within 0.49 mm (quantisation step 1.29 mm).
- Import of `state.json` via the real `<input type=file>` after switching to the island preset: hash and time identical to export (`matchesExport:true`); 20 further single steps are bit-identical to the original continuation (`identicalToOriginalContinuation:true`).
- Truncated-array file → "Import failed: array length mismatch" (error toast), state unchanged; non-JSON file → JSON parse error toast, state unchanged.
- Node: serialize → JSON → deserialize, then 200 more steps on both copies: 0 differing values; NaN/out-of-range values in an imported file are repaired and counted.

### Touch (Playwright + CDP touch events, 390×844, pointerType `touch` observed 8×)
```
oneFingerRaise:    tool raise, terrain changed, camera yaw/dist unchanged
oneFingerNavigate: (Orbit tool selected by a touch tap) yaw −0.75 → −1.41, pitch 0.62 → 0.52, terrain unchanged
pinchOut:          (Raise tool active) dist 760 → 244, terrain unchanged
twist:             yaw −1.506 → −2.006, terrain unchanged
twoFingerPan:      target (0.3,46.2,−1.2) → (19.4,46.2,−10), terrain unchanged
```

### Network isolation (`logs/T16-network.log`)
Separate agent-browser session with `--proxy http://127.0.0.1:9 --proxy-bypass 127.0.0.1` (external internet unreachable, local server reachable): the page made exactly one request (`GET /index.html`, 200), `performance.getEntriesByType('resource')` is empty, an explicit `fetch('https://example.com')` from the page fails, no page errors. Static scan of `index.html`: 0 external `src`/`href`, 0 `fetch`/XHR/`import()`/Worker uses.

### Numerics on the shipped core (`scripts/extract-core.js` + `numerics-*.js`, `logs/numerics-node.log`)
The `<script id="sim-core">` block is extracted from the delivered `index.html` and run in Node:
- default preset 256², 3000 steps (150 s): mass residual −4.0e-15, water residual 9.5e-14, max speed 8.2 m/s, CFL 0.30, 5.4 ms/step;
- stress parameters 192²: finite, 0 edge spikes, 0 interior spikes, mass residual −7.5e-16.

## Failures found during development, their causes, fixes, and retests

| ID | Observed failure | Cause | Fix | Retest |
|---|---|---|---|---|
| F1 | Pale, washed-out terrain colours | sRGB albedos used as linear values before gamma | albedos converted with `pow(c, 2.2)`, exposure and fog rebalanced | `screenshots/09-tint-fix.png` onward |
| F2 | Rivers visible in depth mode but not in shaded mode | dry vertices next to water were pushed under the ground, burying narrow streams | dry neighbours take the adjacent water level and fade out through alpha | `screenshots/06`, `09`, `12-*` show streams |
| F3 | Slopes flooded with peach/yellow tint | change-highlight colours mixed in linear space; thermal creep fed the "recent change" field | linear-space tint colours; only hydraulic erosion/deposition feeds "recent" | `09-tint-fix.png` |
| F4 | HUD overlapped the toolbar; hint bar overlapped the legend | layout | toolbar at top-left, HUD beside it, modes top-right, short hint | `08`+ desktop screenshots |
| F5 | Space after clicking Step stepped instead of pausing | focused button consumed Space | Space is global play/pause except in text fields | `logs/T1b-T2.log` |
| F6 | HUD showed "budget / CPU-bound" while paused | stale flag | flags cleared when no steps run | `17-mid-stroke…` onward |
| F7 | **State import failed** ("array length mismatch") | flux/velocity arrays became Float64 but were serialized as f32 | serializer lists fixed | T10 + T99b + Node round-trip: bit-exact |
| F8 | **Spikes along the domain edge** under stress parameters (78 spikes) | border cells received talus material but never shed it | border cells take part in talus transfer (bounds-checked); fixed-bed outlet ring for open/sea boundaries | `numerics-edge-stress.js`: 0 spikes; `screenshots/28-stress-test.png` |
| F9 | Sediment concentration legend saturated at 100 % | thin sheet flow could carry more sediment volume than water | capacity capped at 40 % of water volume | modes re-screenshotted afterwards |
| F10 | Speckled/checkerboard water depth below springs | velocity clamp hid true speed from friction → flux hit the K-limiter | clamp 10 → 25 m/s, Chezy friction 0.02 → 0.04 | Node crop comparison (development) |
| F11 | Step-pool "ringing" in channels; thin films at the 20 m/s clamp | constant pipe cross-section; pits dug below neighbours | depth-dependent pipe cross-section + Chezy friction; erosion never digs below the lowest neighbour; submerged bed diffusion | Node harness images (development) |
| F12 | Canyon preset: spring drained off the world edge, no canyon | open boundary ∝ depth next to the spring | free-outfall boundary using the inward slope; spring moved inland; shallow guiding groove | `12-preset-canyon-formation.png` |
| F13 | Canyon plateau rendered as a snowfield | snow rule applied to every landform | snow only for mountains/hills; desert palette for the plateau | later canyon screenshots |
| F14 | Phone layout: HUD values wrapped, toolbar over legend, Close button hidden under the sheet | layout | wider compact HUD, toolbar above legend, fixed sheet toggle that moves above the open sheet, portrait camera framing | `30`, `31` |
| F15 | Console error over HTTP: `/favicon.ico` 404 | browser auto-requests a favicon | inline SVG data-URI favicon | HTTP log after fix shows only `/index.html` |

## Test-harness issues (not app defects), recorded honestly
- My own script mistakes, corrected and re-run: `const` redeclaration across `eval`s; text locator matched the toast instead of the preset button; a key press went to a focused slider; a collapsed `<details>` hid the seed field; export test first clicked the section header and collapsed it; relative upload paths.
- agent-browser: held Shift/Alt are not applied to `mouse wheel` → Shift/Alt+wheel brush adjustment **blocked** (keyboard adjustment verified instead).
- agent-browser: after `record start/stop` in a session, later `download` commands in that session report "Download was canceled" (reproduced; clean session downloads fine). Export/import regression therefore ran in a separate session.
- One unexplained headless-browser relaunch during an early export/import run (page became `about:blank`); it did not recur in two full re-runs or the regression.
- Playwright MCP refuses `file:`; used the local dev server only for the touch test.

## Remaining limitations
- **Performance on real GPUs not measured.** The simulation runs in JavaScript on the main thread: ~4–5.5 ms per step at 256² (Node and Chrome), so the default 3 substeps cost ~12–16 ms per frame. A per-frame budget (14 ms) drops substeps when needed and the HUD shows "CPU-bound". 384² and 512² will be CPU-bound on most machines. No Web Worker is used.
- Stress preset runs above the target CFL (≈0.69 with the ×8 split cap). It was stable in every run, but the HUD reports it as "CFL-limited".
- The physical model is a simplified shallow-water pipe model (Chezy friction, capacity law, volumetric concentration cap, talus creep, bed diffusion). On very steep terrain, thermal slope retreat dominates the Δh map.
- Only Chromium was tested (headless, SwiftShader). Real finger touch and pen pressure were not tested; touch used CDP emulation.
- Shift+wheel / Alt+wheel not exercised (tool limitation above).

## How to re-run
```bash
# from 02-hydraulic-erosion/
bash evidence/scripts/t3-brush.sh            # (and t4…t18, t99-regression.sh, t99b-regression-io.sh)
node evidence/scripts/extract-core.js && cd evidence/scripts && \
  node numerics-roundtrip.js && node numerics-edge-stress.js && node numerics-harness.js mountains 256 3000
node evidence/scripts/verify-png.js evidence/exports/heightmap.png evidence/exports/page-at-export.json
```
Scripts expect an agent-browser session opened on `file://…/index.html` at 1280×800 (the t99 scripts open their own sessions).
