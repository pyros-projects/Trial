# Validation log — real-time 2D fluid simulation

Everything below was measured by driving a real Chrome instance through the
`agent-browser` CLI (real mouse / keyboard / click events and in-page
readbacks), not by reading the source. Numbers are the actual tool output.

## Environment

| item | value |
|---|---|
| OS | WSL2 (Linux), 32 cores |
| Browser | Chrome for Testing 152 (headless, via agent-browser 0.31.1) |
| GL | WebGL 2.0 on **ANGLE / SwiftShader (software Vulkan)** — no GPU accel |
| Extensions | `EXT_color_buffer_float` and `OES_texture_float_linear` present |
| Page under test | `http://127.0.0.1:8911/index.html` (also verified over `file://`) |
| Viewports | 1280×800 and 390×844 (`agent-browser set viewport`) |

Because the renderer is a software rasteriser, all frame-rate figures are a
worst case; on a real GPU the same workload is far cheaper. Every check that
depended on a capability (float render targets, bilinear filtering of float
textures) was checked, and a CPU/Canvas2D solver exists as the fallback path.

## Test hooks used

The page exposes `window.fluid` for automated checking: `state()`, `probe()`
(reads back dye / velocity / pressure / curl / divergence through an RGBA8
encode pass, because direct 16F readback is not portable), `fieldMap(n)`
(returns an n×n ASCII map of dye concentration — used below), `viewStats()`
(re-renders and reads back the canvas: mean colour, share of blown-out
pixels, number of distinct colours), `drag()`, `step(n)`, `reset()`,
`clearDye()`, `pause()/resume()`, `setModeByName()`, `set(key, value)`.
Query overrides: `?force=cpu`, `?force=webgl1`, `?mode=`, `?paused=1`,
`?ui=0`, `?ambient=0`, `?nopersist=1`.

Note on `probe()`: values are decoded against a per-field reference scale
(dye 1.2, speed 60 cells/s, pressure 8, curl 8, divergence 0.5), so a value
sitting at the scale means the field has gone past it, not that it equals it.

## Required behaviour checks

### 1. Boot and renderer selection — PASS
```
{"renderer":"WebGL2 · RG16F/R16F/RGBA16F · hardware bilinear","backend":"gpu",
 "sim":"381x172","dye":"763x344","canvas":"1280x577","dpr":1, ...}
```
Zero page errors, zero console errors. The renderer line is also printed to
the console (`[aether] renderer: …`) and the CPU path shows a banner instead.

### 2. Dye injected by dragging persists, advects and mixes — PASS
Procedure: `?ambient=0`, `fluid.clearDye()` to get an empty field, then a
real mouse drag (button down, 12 `mouse move` steps at y=300, button up),
then read the field immediately and 4 s later. `.`/`#` = dye concentration,
row 0 = top of the screen, column 0 = **right** edge (rows are printed
reversed, so read columns right-to-left).

```
immediately after the drag          four seconds later
                |                                |
                |                                |
                |                                |
                |        ... .   |
                |        ..... . |
                |       ..... .. |
                |       .-+===:. |
                |       .=++++=..|
                |       .=*+++-. |
                |        .::::.. |
                |       ........ |
                |         ....   |
```
Compact high-concentration blob at the pointer path → four seconds later it
has moved up/left, spread over roughly four times the area and dropped two
concentration levels, while mean dye only fell from ~0.35 to 0.043. A static
decal would have kept its shape and faded in place, so transport is real
advection plus spreading, not a texture that fades.

Screenshots: `screenshots/43-drag-trail.png` (during the stir),
`screenshots/44-drag-advected.png` (4 s later).

### 3. Fast dragging stays smooth (no dotted trail) — PASS
Six `mouse move` calls of 160 px each with no delay between them. The result
is one continuous dye band across the full width, because a long stroke is
split into up to six splats along the segment:
```
..:#*==+++++++=.:|..############-.|..-####*++==*#:.-|::..  .::|:::..
```
Velocity is taken from the pointer displacement between frames, and the
injected speed is capped (420 cells/s) so a flick does not destroy the field.

### 4. Mode switching while the simulation runs — PASS
All seven modes switched with real keyboard presses (1–7) while running; each
produces a different image and no GL errors (`error: null` on every read).
Numbers are from the shipped build, sampled ~1 s after each switch on a field
that had been running for 13 s or more (`viewStats`, 8 541 sampled pixels).

| mode | mean RGB | bright px | what it looks like |
|---|---|---|---|
| DYE | 0.083 / 0.101 / 0.100 | 20 % | distinct plumes and dark gaps, no wash |
| VELOCITY | 0.187 / 0.096 / 0.260 | 40 % | heat ramp follows the moving fluid |
| DIRECTION | 0.288 / 0.197 / 0.194 | 60 % | hue field reads as smooth bands (a direction field is smooth by nature) |
| VORTICITY | 0.109 / 0.109 / 0.134 | 20 % | paired blue/orange swirls visible |
| PRESSURE | 0.356 / 0.360 / 0.326 | 76 % | broad field, no empty space — pressure is non-zero almost everywhere by definition |
| DIVERGENCE | 0.162 / 0.200 / 0.214 | 38 % | **see the caveat below: this is real residual divergence, not noise** |
| ARROWS | 0.109 / 0.109 / 0.124 | 19 % | arrow field tracks the flow |

`blown` (share of pixels above the clipping threshold) was 0 % for every mode.
The brightness of the diagnostic modes is the field, not a rendering fault:
VELOCITY/DIRECTION/PRESSURE paint a scalar over the whole viewport, so a
large bright area is expected; the dye mode is the one where "flat and bright"
would have meant a blown-up field, and it sits at 20 %.

Also verified with a real click on the mode tab strip:
`click "#modes button:nth-child(4)"` → badge becomes VORTICITY and the
panel's mode `<select>` stays in sync. Screenshots:
`screenshots/11..17-mode-*.png`, `41-vorticity.png`, `42-arrows.png`.

### 5. Viscosity is observable — PASS
Same deterministic seed pattern, `?ambient=0`, 60 steps, mean speed and max
vorticity compared. Identical starting state (mean speed 22.44) each time.

| run (60 steps) | mean speed before → after | max \|ω\| |
|---|---|---|
| ν = 0, ε = 0 | 22.44 → **9.02** | 5.80 |
| ν = 1, ε = 0 | 22.44 → **7.00** | **1.04** |

High viscosity removes 69 % of the kinetic energy in one second versus 60 %
for none, and cuts peak vorticity by a factor of 5.6 — the small-scale
curl is diffused away, which is what viscosity should do.

### 6. Vorticity confinement is observable — PASS
Same protocol, viscosity held at 0.

| run (60 steps) | mean speed | max \|ω\| |
|---|---|---|
| ε = 0 | 9.02 | 5.80 |
| ε = 16 | **9.69** | **8.00** (at the probe ceiling) |

Confinement returns energy to the rotational modes instead of letting them
smear out: +7 % kinetic energy and +38 % peak vorticity, with swirls visible
in VORTICITY/ARROWS modes.

### 7. "Clear dye" does not silently reset velocity — PASS
```
{"dyeMeanBefore":0.634,"dyeMeanAfter":0,
 "speedBefore":23.43,"speedAfter":23.43,
 "toast":"dye cleared · velocity kept (mean |v| 23.43 → 23.43 cells/s)"}
```
The dye field goes to exactly zero, the velocity field is bit-for-bit
unchanged, and the on-screen toast reports the before/after speed so the
user can see the distinction. (A first version of this check was misleading
because the toast multiplied a scale-dependent number; fixed.)

### 8. Pause / resume — PASS
180 frames were rendered while paused (`steps` 2622 → 2802) with `simTime`
frozen at 27.582; after resuming, 3 s of wall time produced 3 s of
simulation time (27.582 → 30.598) and the badge went PAUSED → RUNNING.
Rendering continues while paused, so modes and the camera-independent
display can still be inspected. Verified three ways: the API, the Space
shortcut, and clicking the newly added pause button (see bug 7).

### 9. Reset returns a valid state — PASS
`fluid.reset()` clears velocity, dye, pressure, divergence and curl, then
re-seeds a deterministic pattern (fixed PRNG seed). Post-reset probe:
mean speed 22.44 cells/s, dye mean 0.63 — non-empty, finite, and no error
from the realloc/resample path. Verified repeatedly as the A/B harness reset
between runs, including after a grid rebuild.

### 10. Resize and high-DPI — PASS
The grid is derived from the window aspect, so portrait and landscape both
get a correctly shaped solver: 1280×800 → 121×76 cells (auto-degraded, see
below), 390×844 → 87×188. The canvas backing store tracks the device pixel
ratio with a budget; a mid-run resize resamples the existing fields instead
of wiping them, and a pointer drag at 390×844 produced a correct dye trail.

### 11. Narrow viewport (390×844) — PASS
No horizontal overflow, no page scroll, HUD visible, canvas 390×844,
60 fps, drag works. The control panel occupies the lower ~52 % of the
screen at that size — it fits, but it covers the fluid until collapsed with
`–` or hidden with `H`/`Esc`. Screenshot: `screenshots/30-narrow-390x844.png`.

### 12. CPU fallback — PASS (after fixing it)
`?force=cpu` runs the same algorithm on Float32Array grids painted through
Canvas2D: 167×75 grid, 60 fps, all 7 modes render, no errors.
It initially produced a black canvas and `NaN` probe values — see bug 5.
Screenshot: `screenshots/20-cpu-fallback.png`.

### 13. `file://` usage — PASS
Opened directly from disk: WebGL2 backend chosen, 264 frames in 7.6 s,
view readback normal. `window.localStorage` works there too, so the
persistence path is exercised.

### 14. Settings persistence — PASS
Set ν = 0.9, ω = 3 and VORTICITY mode, reloaded: all three came back
(`{"v":0.9,"w":3,"mode":"vorticity"}`), the slider widget was built with the
restored value, and the toast said "settings restored from last session".
`?nopersist=1` skips it, which is what the other tests used.

## Visual review pass (screenshots were actually looked at)

The screenshots were inspected as images, not only measured, which found three
things the numbers could not:

1. **A regular crosshatch/grid pattern over the whole canvas**, including over
   the black areas, at roughly 6–8 px spacing. Isolating it: the same scene
   with `sharpen` off (`60-nosharpen.png`) was completely smooth, so the
   flux-limited sharpening term was amplifying the texel-boundary creases of
   the bilinear-upscaled dye texture into a visible lattice. Sharpening is now
   off by default and remains an opt-in toggle; the pattern is gone
   (`62`–`66` in `screenshots/`).
2. **The default view was either a flat magenta wash or nearly empty.** With
   sharpening off, the sparse random ambient drips could not sustain a field:
   after 13 s the screen was 90 % black with two fading blobs. Replaced with
   two wandering emitters that inject a continuous thin stream, and made all
   injection radii fractions of the grid rather than fixed cell counts (a
   fixed 12–34 cell radius on a 121-cell grid is fog; on a 381-cell grid it is
   structure). The 15 s and 70 s frames now show recognisable vortices, shear
   layers and dark gaps.
3. **Emitters could park and print a blown white blob.** After ~60 s one
   emitter kept reflecting between boundaries and deposited dye in one place.
   Added a streak timer that picks a fresh heading every 2.2–4.6 s and raised
   dye dissipation to 0.26/s; the 70 s frame no longer has a hot spot.

**Residual divergence, seen in DIVERGENCE mode.** The mode shows broad green
(source) and magenta (sink) regions, i.e. the projection is not finished with
the field. Measured on the same build: mean |∇·v| 0.019 (max 0.088) while the
auto governor held 121×76 cells, rising to mean 0.066 with peaks at the probe
ceiling after it stepped down to 81×51 with 14 pressure iterations. So the
residual tracks grid resolution and iteration count, which is the expected
Jacobi behaviour, but the intended clean A/B (16 vs 48 iterations, resolution
locked) did not happen: setting 48 iterations made frames slow enough that the
adaptive governor dropped both the grid and the iteration count, which is also
why the second number is worse. Treat "more iterations reduce the residual" as
unverified, and the residual itself as real and visible in DIVERGENCE mode.

**CPU fallback appearance.** At 390×844 the Canvas2D fallback renders
recognisable fluid but blocky (`68-cpu-390.png`): it advances dye at the
solver resolution (76×165 here) instead of the 2–4× dye grid the GPU path
uses, and there is no bloom. It is a correctness fallback, not a visual
equivalent.

## Performance (software rasteriser)

* Fresh load at 1280×577: ~16 fps (62 ms/frame) — the fields were also
  wrong, see bugs 2–4.
* After the physics fixes and with adaptive quality: **43.9–49.1 fps** at
  1280×800, ~20–23 ms/frame, at which point the auto tier had stepped the
  grid down from 381×172 → 192 → 128 → 88 (final 121×76 sim cells,
  243×152 dye texels).
* CPU fallback: steady 60 fps at 167×75.
* Adaptive quality is a deliberate feature: while "sim resolution = auto",
  the average frame time is watched and the grid/pressure-iteration count is
  stepped down (at most four times, never back up) with a toast explaining
  it. On a hardware GPU the measurements stay under the 26 ms threshold and
  nothing is degraded; the numbers above are the software-rasteriser case.

## Final end-to-end run (after all fixes, 1280×800, persisted settings)

Single pass, no restarts, to confirm the fixes did not break each other:

* fresh load, 10 s in: 436 steps, 43.5 fps, no page errors, no console errors.
  Probe — dye 0.173 / max 0.74, speed mean 0.96, pressure mean 0.048,
  curl mean 0.098, **divergence mean 0.0022** (field scale 0.5), so the flow
  is close to divergence-free in steady state.
* `clearDye()`: dye 0.173 → 0.037 within a second while velocity stayed in
  the same range.
* `reset()`: fields re-seeded and finite (speed mean 6.6, dye mean 0.35).
  Note the transient immediately after a reset — pressure and divergence both
  sit at the probe ceiling for a few hundred milliseconds because the seed
  injects a lot of momentum at once and the projection needs a few frames to
  catch up. Steady state returns to the numbers above.
* keyboard sweep through all seven modes while running: no errors, 43.5 fps
  at the end, badge back to DYE.
* final screenshot: `screenshots/50-final-1280x800.png`.

## Bugs found by running it, and what was done

Source reading did not catch any of these; each one showed up as a wrong
number or a wrong picture.

1. **Vertex attribute pointer never configured** — every pass drew with an
   enabled but unconfigured attribute, so nothing was ever drawn. Fixed by
   binding the quad and setting `vertexAttribPointer` inside `pass()`.
2. **`hsv2rgb(...) * 0.25`** (array × number) evaluated to `NaN` and poisoned
   the dye field: NaN spread through advection and turned the whole view
   white. Fixed with a component-wise `map()`, plus a `Number.isFinite`
   guard on the splat colour in both backends.
3. **Unbounded "sharpening"** in the dye advection — `0.22*(4c − Σneighbours)`
   amplifies the highest-frequency mode by ~2.76× per step, which filled and
   saturated the screen in seconds. Replaced with a flux-limited correction
   (clamped ±0.02, coefficient 0.1) plus a hard ceiling on dye.
4. **Vorticity confinement was 60× too strong** (an extra `* 60`), which
   pushed the entire velocity field into the ±500 clamp within seconds.
   Removed; the slider range is now 0–20 with a default of 8.
5. **CPU fallback stride/size mix-up** — the row stride was defined as the
   total array length, so every neighbour lookup read past the end of the
   typed arrays (`undefined` → NaN) and the fallback canvas stayed black.
6. **CPU splat radius double-converted** (pixels → cells a second time),
   making injection spots ~7.7× too small. Now the same "radius in cells"
   contract as the GPU path.
7. **The pause button was never added to the DOM** — the factory returns the
   element and the caller is responsible for appending it; only the other two
   buttons in that row were. Caught when a `find text "❙❙ pause" click`
   initially matched nothing.
8. **Blank readbacks misread as evidence** — reading the canvas outside a
   frame returns the cleared buffer; `viewStats()` now re-renders before
   reading, and the first version of the texture-allocation check treated a
   stale, already-pending GL error as a failure of a valid allocation.
9. **Grid rebuild called `dispose()` on a plain object** — the second resize
   (which is what a window resize triggers) threw instead of resampling.

## Known limitations (not verified, or verified as imperfect)

* **The pressure solve is approximate, and the residual is visible.** A single
   22-iteration Jacobi sweep from a decayed warm start leaves real divergence
   in the field — see the DIVERGENCE measurement under "visual review pass"
   (mean |∇·v| 0.019 at 121×76 cells, 0.066 with peaks at the probe ceiling
   after the governor dropped to 81×51 / 14 iterations). Motion still looks
   correct, so the flow is *visually* incompressible, but anyone who wants the
   number lower can raise pressure iterations (default 22, `+`/`-`, slider up
   to 48) or lock the resolution so the governor cannot lower it.
* **Visual review was done by a model looking at screenshots, not by a human,
  and not on a real GPU.** Screenshots were inspected as images, which is how
  the grid-lattice artefact, the flat wash and the parked-emitter blob were
  found; the display scales for the diagnostic modes were then tuned against
  those readings. None of it was seen on hardware GL, at high refresh rate, or
  on a display with different colour processing.
* **Frame rates are for a software rasteriser** on this machine, at one
  window size, with one build of Chrome. Not benchmarked on real GPUs,
  not benchmarked at 4K / dpr 2, and no long-run (hours) memory test.
* **Multi-touch was not exercised.** The code tracks an arbitrary number of
  pointer maps and coalesced events, but only single-pointer mouse input and
  the scripted `drag()` helper were actually driven.
* **PNG capture** (the `⤓` button and `P`) triggers a download; that the file
  lands and is not black was not checked. `canvas.toDataURL` should work for
  the GL path since capture happens in the same frame, but it is untested.
* **Fullscreen, `Esc`, and the `H` panel-hidden state** were only checked as
  DOM attribute flips, not as usable layouts (the panel-hidden state does set
  `pointer-events: none`, so the covered area is still draggable).
* **Slider manipulation** used the CLI's `fill`, which normalises range
  inputs (it landed on 0.5 and 10 rather than the requested 0.95 and 20);
  the controls did respond, but no real thumb-drag gesture was performed.
* **`?force=webgl1`** (the WebGL1 + half-float branch) is present and
  compiles, but was not run: this Chrome build offers WebGL2, so the
  fallback was only exercised through the CPU backend.
* The scripted `drag()`/`step()` helpers exist only to make the checks above
  possible; they are not part of the interaction model.

## Screenshot index

| file | what it is |
|---|---|
| `90-pre-fix-dye.png`, `91-pre-fix-blown.png` | **before** the fixes: the whole canvas covered in a sharpening lattice and, in the second, a blown-out field. Kept so the "after" shots can be compared |
| `50-final-1280x800.png` | shipped build, ARROWS mode (this browser had ARROWS persisted in localStorage; the default for a new visitor is DYE) |
| `11`–`17-mode-*` | the seven display modes on one running field |
| `20-cpu-fallback.png`, `68-cpu-390.png` | the Canvas2D fallback, at 1280 wide and at 390×844 |
| `30-narrow-390x844.png`, `31-wide-1280x800.png` | the two required viewports (31 is from before the final display tuning) |
| `43-drag-trail.png`, `44-drag-advected.png` | a real drag and the same dye four seconds later |
| `60-nosharpen.png` | the isolation test that proved the lattice came from sharpening |
| `62`–`66` | the ambient-source experiments (fog → filaments) |
| `67-div-48iters.png` | the interrupted pressure-accuracy A/B |
