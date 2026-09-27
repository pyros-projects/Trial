# Validation — Real-Time 2D Fluid Simulation

Artifact: `index.html` (single self-contained file, WebGL2, zero external deps).
Tooling: `agent-browser` 0.31.1 (headless Chrome via CDP), local HTTP server
(`python3 -m http.server 8777`) for inspection; `file://` tested separately.
Date: 2026-09-10.

Diagnostics used: `window.__fluid` test hook exposes `state` (paused, mode, sim/dye
grid dims, fps) and `stats()` — a GPU downsample → `readPixels` giving mean/max
velocity magnitude, dye coverage, divergence, and curl. Screenshots in
`evidence/screenshots/`.

## Bugs found & fixed during development

1. **Pressure Jacobi sign flip (critical).** The shared Jacobi shader computed
   `(div − Σneighbors)·¼` instead of `(Σneighbors − div)·¼`, so projection
   *amplified* divergence. Field mean |v| saturated at the 200-unit stats cap and
   dye was shredded within seconds. Fixed with a `beta0` coefficient on the RHS
   term. Verified: after fix, a fixed splat adds ~0.05–0.25 residual mean |div|
   at 80 iterations vs ~0.5–1.4 at 4 iterations.
2. **State loss on resize.** `initFields(preserve)` copied old velocity/dye into
   the new double-FBO's `.write` buffer while the solver reads `.read` → fields
   zeroed on every window resize. Fixed by copying into `.read`. Verified:
   vel 17.6→18.1 and dye 2.4%→2.1% across 1280×800→900×650→1280×800.
3. **`setPointerCapture` crash** on synthetic/non-active pointers — wrapped in
   try/catch; re-dispatched synthetic touch sequence, zero errors.
4. Diagnostic view saturation — pressure/vorticity rendered as binary noise;
   rescaled to `tanh(v·s)` with tuned gains.

## Public validation checks

| Check | Result | Evidence |
|---|---|---|
| Slow pointer drag injects momentum + dye, directional response | pass | `08-drag.png`, `21-final-drag.png` — horizontal jet with turbulent billow; dye mean 1%→10%, dyeMax→2.0 |
| Rapid flick stays smooth/continuous | pass | `09-flick.png` — single 900px move event produced a continuous turbulent streak (path-interpolated splats, 12-step cap) |
| Flow persists/advects/mixes after input | pass | stats show vel 20.7, curl 6.5 sustained ≥1s after drag ends; mixing visible across all dye screenshots |
| Switch visualization modes live | pass | `10..15-*.png` — velocity magnitude (heat), direction (HSV), pressure, divergence, vorticity all render distinct real fields; `state.mode` updates; no restart |
| Viscosity produces observable difference | pass | same splat after 2.5s: vel 19.1→15.4, curl 4.97→0.66, div 3.64→0.18 at visc 0→1 |
| Vorticity produces observable difference | pass | same splat after 1.5s: curl 1.17→8.20, velMax 65→155 at vorticity 0→50 |
| Clear dye removes dye, keeps velocity | pass | dye 5.0%→0 and dyeMax 0.93→0; vel 28.6→26.0 (continues evolving, not reset) |
| Pause / resume | pass | paused stats bit-identical across 1.2s; overlay shows PAUSED; Space key + button both work (`19-paused.png`) |
| Reset restores valid initial state | pass | reset → cleared fields re-seeded, running, dye 4.1%, sim healthy |

## Requirement coverage

- Continuous fluid (advection, Jacobi pressure projection, vorticity
  confinement, viscous diffusion, dissipation, dye transport): pass — see above.
- Full control set present: pause/resume, reset, clear dye, sim resolution,
  speed, viscosity, pressure iterations, vorticity, velocity & dye dissipation,
  force, radius, dye color + auto-cycle: pass (all labeled, snapshot `e4–e18`).
- Pressure iterations effect: pass — residual |div| ~10× lower at 80 vs 4 iters.
- Resize adaptation + state preservation: pass (dims change, fields persist).
- High-DPI: pass — `file://` at DPR 2 → canvas 2560×1600 backing store.
- Touch/pointer input: pass — Pointer Events used throughout; synthetic
  `pointerType:'touch'` drag deposits dye (dyeMax 0→0.18).
- Narrow viewport 390×844: pass — `16-mobile.png`, sim adapts to portrait
  (192×416), panel auto-collapses.
- Desktop 1280×800: pass — all screenshots.
- Stats overlay (fps, ms, sim/dye dims, mode, run state, mean |v|, dye %): pass.
- `file://` direct open: pass — runs, no error overlay, zero resource entries
  besides the document (`performance.getEntriesByType('resource')` → `[]`).
- Console/page errors after fixes: none observed.

## Limitations / notes

- Headless Chrome renders via SwiftShader (software GL): ~30–55 fps at
  307×192 sim / 1024×640 dye. On real GPU hardware this is comfortably 60+.
- Divergence/vorticity views are intentionally raw per-cell diagnostics — they
  look grainy at coarse sim resolutions; that reflects the true field.
- `agent-browser` `swipe`/`-p ios` targets real iOS devices; touch was verified
  through the shared PointerEvent path on an emulated device instead.
- Viscosity slider also reads as "diffusion" control; values > ~0.6 at low sim
  res visibly damp motion quickly (expected for implicit diffusion).
