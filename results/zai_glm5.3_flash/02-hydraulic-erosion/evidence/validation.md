# Validation Record — 3D Hydraulic Erosion Laboratory

Artifact: `index.html` (single self-contained file, ~86 KB, no build/runtime dependencies).
Dev tooling (not part of the artifact): `src/` parts + `build.sh` (concatenation), `node --check` for syntax.
Test harness: agent-browser (headless Chromium via CDP), local HTTP server `python3 -m http.server 8321`
and a direct `file://` open. All numbers below were read from the live app
(`window.__lab` debug handle) or measured from exported files — not hardcoded.

## Environment notes (honest framing)

- The headless browser in this harness throttles `requestAnimationFrame` to ~250 ms/frame
  (measured: rAF median 250 ms with the app paused). Rendering itself is fast (draw submit
  ~0.1–3 ms). Consequence: live wall-clock sim rate in *this harness* is lower than a real
  60 Hz browser would achieve, and the FPS overlay reads low around screenshot captures.
  The app uses a 14 ms/frame step budget so the UI stays responsive at any frame rate.
- Raw mouse input, JS eval, screenshots, downloads, and viewport control were fully available.
  Multi-touch pinch gestures could not be exercised in this harness (single-pointer paths were);
  pinch/pan code paths are implemented via the same Pointer Events API verified below.
- No audio required by this application.

## 1. Boot & rendering

| Check | Result |
|---|---|
| Loads via HTTP, WebGL2 context, no console errors | PASS (screenshots/01, 60) |
| Loads directly via `file://` (no server), simulates + renders | PASS (screenshots/50) |
| Network log over `file://` and `http://`: only the document itself (favicon inlined) | PASS (0 external requests, 0 404 after inline favicon) |
| Status overlay shows fps, sim/draw ms, grid, sim time, steps/s, water volume, sediment, eroded/deposited, mode, pause state, instability warning chip | PASS (visible in all screenshots) |
| Canvas resizes with viewport (1280×800 and 390×844), DPR capped at 2 | PASS (canvasW 390 at narrow viewport) |

## 2. Simulation correctness (moving water changes terrain, not just shading)

Method: fresh generate → run N substeps of dt=0.025 → compare `computeStats()` (net Δ vs. h0)
and terrain checksum (FNV over quantized heights).

| Check | Result |
|---|---|
| 60 sim-s default preset: carved 6,967 / deposited 6,378 volume units, 20% of cells wet | PASS — net terrain change >> 0; delta mode (screenshots/12) shows dendritic erosion networks (red) + valley deposition (blue) |
| Live run (unpaused): sim time advances, checksum changes | PASS |
| Mass conservation Σ(h+s) over 400 steps @192² and 800 steps @256² | PASS — loss exactly 0.0 at both resolutions (after per-step advection mass normalization; see fixes) |
| Deterministic seed: same seed → identical terrain checksum (`4ab8d545` twice); different seed → different (`c3864b7c`) | PASS |
| Reset: checksum returns to freshly-generated checksum, water=0, time=0 | PASS |
| Regenerate (same seed): checksum identical | PASS |
| Resolution switch 192→256→192: terrain regenerated, **0 NaN** (see fix #3 below) | PASS |

## 3. Diagnostics consistency

Water depth, sediment concentration, erosion/deposition delta, slope, and flow modes were each
rendered from the same paused state (screenshots/20–26). Status-mode label updates in sync.
Mode switching never resets the simulation (checksum + sim time unchanged across a full 0→6 cycle).

Probe readout (real hover at screen (760,300) and (800,320)): position `i67, j111 (-28, 16)`,
terrain h, water depth, sediment, flow speed (cells/s), slope, Δh — all live values matching
`S.h/S.w/S.s/S.u/S.v` at that cell. Inspect-tool click pins the card ("PINNED" tag, screenshots/15).

## 4. Pointer tools (real mouse input via CDP)

Drag paths on canvas, assertions from live state:

| Tool | Measured effect |
|---|---|
| WATER drag | water volume 1755.8 → 1783.6 (+27.8) |
| LOWER drag | carved total +32 (net terrain loss along stroke) |
| RAISE drag | checksum changed; deposited +13.5, carved −7.8 (net height gain) |
| DRY drag over watered path | water 1783.6 → 1731.3 (−52; dries stroke area incl. storm remnants) |
| SMOOTH / FLATTEN | same brush pipeline (blend to 3×3 mean / stroke-start height); verified rendering + no errors |
| SEDIMENT | sediment sum increases; visible in sediment mode (screenshots/23 — gold dump blob) |
| INSPECT | click pins probe card at picked cell |
| Brush ring follows cursor, conforming to terrain; radius/strength sliders update labels | PASS (screenshots/14, 18) |

Input continuity: strokes are interpolated along the pointer path (substeps every ≤0.4·radius)
and re-applied every frame while held, so holding still keeps carving smoothly.
Camera conflict: left-drag with a tool edits terrain (checksum changes); right-drag orbits with
checksum unchanged (`chkUnchanged: true`); middle/shift-drag pans; wheel zooms (screenshots 16→18).

## 5. Camera

- Right-drag orbit: view angle visibly rotates (screenshots/16→17), no terrain mutation.
- Wheel zoom: `zoomBy(exp(dy·0.0011))`, clamped to [0.12·N, 4·N] — screenshot 18 shows close-up.
- Pan via middle/shift-drag — target clamped to ±1.4·half extent.
- Damped follow (critically-damped-ish lerp) on all channels.

## 6. Parameter effects (meaningful differences)

| Experiment | Result |
|---|---|
| Evaporation 0.05 vs 1.0 (identical pond start, 400 steps) | water 14,139 vs 447 — 32× difference |
| Erosion rate 0 vs 0.5 (identical start, 1200 steps) | carved 86 vs 9,617 |
| Rainfall slider to 0 | no rain applied; mass stable |
| Speed 0 (paused-equivalent) | step accumulator produces 0 steps |

## 7. Stability & recovery (stress preset: rain 0.5, evap 0.15, erode 0.30, cap 8, flow 1.6, thermal 0.85, 3 substeps, 256²)

| Check | Result |
|---|---|
| 15,000 substeps at stress params | **0 NaN cells, 0 recovery events** (screenshots/34: heavily but stably eroded terrain) |
| Sanitize scrub | repairs h←h0, zeros w/s/fluxes; counter surfaces in status chip |
| Per-write guards | fluxes `!(x>0)→0`, water `!(wn>1e-6)→0`, advection `!(v≥0)→0`, finite-checked mass normalization; auto-sanitize if Σw non-finite |
| Extreme sliders during run | no lock-up; budget caps steps and flags "step budget capped" in status |

## 8. Export / import (all in-browser)

| Check | Result |
|---|---|
| Heightmap PNG export | PASS — hand-rolled grayscale PNG: 192×192, bit depth 8, **color type 0 (true grayscale)**, decoded pixels min=0/max=255, downloaded to disk |
| State JSON export | PASS — 1.9 MB with base64 Float32 arrays (h,w,s,h0,u,v,fL,fR,fT,fB), params, seed, sim time, totals |
| JSON import round-trip | PASS — after scrambling state, import restored exact checksum `c965500f`, sim time 15.0 s, water volume 4,261 — identical to pre-export state |

## 9. Presets

All five apply style/params/resolution and regenerate:

- Mountain drainage (192², storms) — screenshots/11, 61: gullies + deposit fans within 20 sim-s.
- Canyon formation (mesa + spring) — screenshots/32: entrenched winding river channel after 45 sim-s.
- Island rainfall — screenshots/31: sea-level water ring, beaches, shallows.
- River valley (spring-fed sinuous river) — screenshots/33.
- Aggressive stress test (256², extreme params) — screenshots/34.

## 10. View modes (7)

Shaded / elevation / water depth / sediment / erosion-deposition / slope / flow —
screenshots/20–26 and keyboard 1–7 + select. Switching does not reset the sim (verified).

## 11. Fixes made during validation (reproduced → root-caused → retested)

1. **Water invisible**: water surface was displaced by terrain height only (coplanar → depth-fighting).
   Added a dedicated water vertex shader displacing by `h + w`; skirt fragments discarded. Retest: pond renders in shaded + depth modes (screenshots/06, 07, 22).
2. **Terrain collapse to erosion floor**: capacity saturated for any rain film (uniform shredding,
   "deposited 0"). Fixed with depth-gated capacity, discharge weighting via D8 flow accumulation,
   erosion floor at `genMin − 0.3·amp`, and storm-based rainfall. Retest: carved/deposited balanced,
   dendritic channel networks form (screenshots/11, 12).
3. **Sediment mass loss**: semi-Lagrangian resampling leaked ~0.04%/step (under a ±2% correction
   deadband → 550k units lost over minutes; terrain collapsed). Fixed with exact per-step mass
   normalization. Retest: Σ(h+s) conserved to 0.0 over 400–800 steps.
4. **NaN blowup at resolution change**: `flowAcc/order/blur` scratch buffers kept stale sizes after
   resolution change → `undefined` reads → `flowNorm` NaN → all capacities NaN. Fixed by resetting
   scratch buffers in `allocState` + size validation. Retest: 15,000 stress steps, 0 NaN.
5. **Page scroll** (hidden file input focus scrolled the fixed layout): scroll locked.
6. **Preset label typo** and stale favicon 404: fixed.

## 12. Blocked / not run

- **Multi-touch pinch zoom/pan**: implemented (Pointer Events, 2-pointer tracking) but not
  exercisable in this headless harness; single-pointer orbit/tool/zoom verified with real input.
- **High-DPI >1 rendering**: DPR-aware code path (capped at 2) but the harness reports DPR 1.
- **Real 60 fps wall-clock rate**: harness throttles rAF (see Environment notes); on an unlocked
  frame rate the sim ran 60 steps/s with ~3.2 ms/step at 192² (~7 ms at 256²), which fits a 60 Hz
  budget at default settings (speed 1.5, 1 substep, 14 ms cap).
- Audio: not applicable (no audio features required or implemented).

## Screenshot index

- 01 initial boot · 02 water-mode (pre-fix) · 03–05 evolution iterations · 06/07 pond tests
- 09–12 evolution + delta map · 13 water tool · 14 probe hover · 15 inspect pinned
- 16–18 orbit/zoom · 20–26 seven view modes · 30/31 island · 32 canyon · 33 valley
- 34 stress · 40/41 narrow viewport · 42 contours+grid · 50 direct file:// · 60/61 final boot/20 s
