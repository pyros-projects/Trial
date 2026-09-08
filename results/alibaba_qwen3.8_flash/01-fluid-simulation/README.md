# Aether — real-time 2D fluid

A single-file, dependency-free, real-time 2D incompressible fluid you can stir
with the mouse. Open `index.html` and drag.

```
python3 -m http.server 8911      # optional; it also opens fine from file://
```

* **What it solves.** Semi-Lagrangian advection of velocity and dye, viscous
  diffusion, Coriolis deflection, Jacobi pressure projection with a decayed
  warm start (this is what enforces ∇·u ≈ 0), vorticity confinement to put
  back the curl that numerical diffusion eats, dissipation, and bloom.
  It is a 2D slice of a 3D incompressible solver, in the tradition of
  Stam's *Stable Fluids* and Mike Seddon's `fluid.zip`; it is not a
  compressible / shallow-water / SPH effect.
* **Where it runs.** A WebGL2 compute path (half-float render targets:
  `RG16F` velocity, `R16F` pressure/curl/divergence, `RGBA16F` dye, ping-pong
  FBOs, two-pass quarter-res bloom) with a Canvas2D + Float32Array solver as
  the fallback when WebGL2 or float rendering is unavailable. If neither
  WebGL2 nor 2D canvas works, the page says so instead of showing a black box.
* **Scale independence.** Simulation grids are derived from the window aspect
  (a portrait window gets a portrait grid) and the canvas backing store tracks
  the device pixel ratio within a pixel budget. Resizing mid-run resamples the
  fields rather than wiping them.
* **On slow machines.** While "sim resolution = auto", average frame time is
  watched and the grid plus the pressure iteration count are stepped down
  (max four steps, never back up) with a toast explaining what changed.
  Locking the resolution to a fixed value turns the governor off.

## Controls

Drag to inject momentum and dye; speed and direction set the force, and long
strokes are split into several splats so a fast drag does not turn into dots.
Touches are tracked per finger, coalesced pointer samples are used, and the
first touch that lands on the panel is treated as UI, not as a stir.

`Space` pause · `R` reset · `C` clear dye · `H` or `Esc` hide/show the UI ·
`P` save a PNG · `[` `]` zoom · `1`–`7` display modes · `W` wireframe ·
`M` mute. Click during a stroke to fire a burst. Settings persist to
`localStorage`.

## Display modes

DYE (what is in the fluid) · VELOCITY (green→red heat, like fluid.zip) ·
DIRECTION (hue = heading) · VORTICITY (blue = clockwise, orange = counter) ·
PRESSURE (blue negative / amber positive) · DIVERGENCE (residual compressibility
— mostly dark when the projection keeps up; what it does show is real) ·
ARROWS (glyph field for reading the flow at a glance).

There is no steady "ambient fog": two wandering emitters feed the view a thin
stream of dyed momentum, and the solver grid is derived from the window. Both
are why the picture keeps producing filaments instead of relaxing into a flat
wash. `A` turns the emitters off, `H` hides the UI, and the "dye sharpening"
toggle is off by default because enabling it amplifies texel-boundary creases
into a visible lattice at low dye resolution.

## Reading the code

One file, four regions: shader sources, the GL backend (programs, targets,
passes), the CPU backend (same algorithm on typed arrays), and the app
(running state, panel, pointer handling, diagnostics). The two backends
implement the same interface — `resize`, `step`, `splat`, `seed`, `render`,
`read` — so the app layer never asks which one is active.

`window.fluid` is a hook for automated checks, not for users:
`state()`, `probe()`, `fieldMap(n)`, `viewStats()`, `drag()`, `step(n)`,
`reset()`, `clearDye()`, `pause()`, `resume()`, `setModeByName(name)`,
`set(key, value)`, `rebuildGrid()`.

Query overrides for testing: `?force=cpu`, `?force=webgl1`, `?mode=`,
`?paused=1`, `?ui=0`, `?ambient=0`, `?nopersist=1`.

## Validation

`evidence/validation.md` records what was actually tested in a real browser,
with the numbers, plus what was broken and fixed and what remains unverified.
Screenshots are in `evidence/screenshots/`.

## Caveats worth knowing

The pressure solve is approximate (residual divergence is measurable, not
zero, and DIVERGENCE mode shows it). Frame rates in the evidence log come from
a software rasteriser, so they are a floor, not a target: no hardware GPU, no
4K / dpr 2, no multi-hour memory run. The screenshots were inspected as images
by the model that built this — that is how the sharpening lattice, the flat
wash and the parked-emitter blob were caught — but no human eye has reviewed
them. Multi-touch, fullscreen, and the PNG download landing on disk were not
exercised, and the Canvas2D fallback is a correctness fallback: blockier, no
bloom.
