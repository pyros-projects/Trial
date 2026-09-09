# Validation record — Wave Interference & Diffraction Laboratory

Everything below was actually executed on 2026-09-08 on this machine
(Linux, Node v25.8.1, Chrome via `agent-browser 0.31.1`). Numbers are copied
from the runs, not estimated. Anything that was *not* verified is listed in
§6 rather than quietly omitted.

---

## 1. What ships and how it is checked

```
index.html                  the artifact (96 kB, single file, no runtime deps)
src/01-top.html             markup + CSS + the <script>/IIFE opener
src/02-core.js              WaveCore — DOM-free solver (marked __CORE_START/END__)
src/03-ui.js                colour maps, field raster, canvas overlays
src/04-ui.js                probes/scopes, presets, serialisation
src/05-ui.js                panels, tools, pointer/keyboard, HUD, main loop
src/06-tail.html            closes the script/document
build.sh                    concatenates -> index.html, then parse-checks it
tests/core-test.mjs         32 numerical checks on the solver
tests/browser-check.mjs     45 checks driven through a real Chrome
evidence/shots/*.png        27 screenshots from the runs
evidence/browser-desktop.txt, browser-mobile.txt   captured check logs
```

Reproduce:

```bash
./build.sh
node tests/core-test.mjs --built        # 32 physics checks
node tests/browser-check.mjs            # 45 desktop checks, 1280x800
node tests/browser-check.mjs --mobile   # 45 checks at 390x844
```

`index.html` contains no `<script src>`, no `<link href>`, no images and no
`http(s)://` string at all (asserted by check 27), so it runs from
`file://` with the network off.

**Why the physics tests read the shipped file.** `core-test.mjs --built`
extracts the code between `__CORE_START__`/`__CORE_END__` straight out of
`index.html` and evaluates it in a bare VM context, so the 32 results below
describe the same bytes the browser runs, not a parallel reimplementation.
The harness passes no DOM: the solver is exercised headlessly on purpose.

---

## 2. Numerical verification of the solver (32 checks, all passing)

Run: `node tests/core-test.mjs --built` → `32 passed, 0 failed (source: index.html)`;
the full output is in `evidence/core-test-run.txt`. All of these used a
400×250–1000×320 grid, dt 0.0012–0.006, dx = Lx/W.

| # | What is measured | Result |
|---|---|---|
| 1a | Wavelength of a driven plane wave vs analytic λ = c/f | 24.78 cells measured vs 25.00 expected (0.9 % low, discretisation) |
| 1b | Field reaches a finite steady state | max \|u\| = 3.312, 0 non-finite cells |
| 2a | Sub-critical CFL stays bounded | CFL 0.375, max 3.53 |
| 2b | **Supra-critical really explodes when the clamp is off** | CFL 1.250 → `Infinity`, 42 968 835 non-finite cell-updates |
| 2c | Auto-clamp rescues a bad timestep request | asked 0.02 s, used 0.0112 s (CFL 0.700), max 1.78, still finite |
| 3a | Lossless run over 12+ periods neither blows up nor decays away | peak 0.995→1.486 (25 cells/λ), 1.000→0.804 (100 cells/λ), 0 unstable cells |
| 3b | Oscillation period vs the discrete dispersion relation | T = 0.39995 vs 0.40000 continuum (−0.01 %); 0.79948 vs 0.80000 at 100 cells/λ |
| 4a | Two point sources form an interference envelope | max/min ratio 63.8 measured across a downstream line |
| 4b | Cancellation lines exist | 21 of 140 samples below 20 % of peak |
| 4c | Dragging a source rewrites the pattern (live editing works) | mean \|Δenvelope\| 0.158 against a peak of 0.73 |
| 5a | A solid barrier shields its shadow | mean \|u\| behind the wall = 0.0 (exactly, 1-cell wall) |
| 5b | A 10-cell slit diffracts into that shadow | mean \|u\| behind the slitted wall = 7.78e-2 |
| 5c | Narrower slit diffracts wider | lit width 104/110 (10-cell gap) vs 79/110 (46-cell gap) |
| 5d | Painting mid-run changes the live field (no rebuild required) | mean \|Δ\| 4.04e-2 vs mean field 6.18e-2 |
| 6a | Index step: λ shrinks by the speed ratio | λ ratio 0.597 for c = 0.6 (Snell, expect 0.60) |
| 6b | Oblique index boundary bends the beam | centroid moved 150.2 → 177.7 cells (27.5 cells of steering) |
| 7a | Lens converges the beam | half-max width 28/100 just inside the lens → 6/100 downstream |
| 7b | …and the same geometry without the lens does not converge | 48/100 wide without lens vs 6/100 with it |
| 8a | Unsteered 12-element array beams along its normal | main-lobe peak at y = 169 on a line where the axis is y = 170 |
| 8b | Phase gradient steers to the commanded angle | steer −20° → peak y = 70 (geometric prediction 66); +20° → y = 270 (predicted 274) |
| 8c | Array is more directional than a single element | half-power width 43 % of the line (12 el) vs 90 % (1 el) |
| 8d | Concave array focuses | beam width 28/120 (curved) vs 92/120 (flat) on the focal line |
| 9a–d | Probe trace fills, matches the field it sits in, resets, and reads ~0 in a shadow | trace 1.748 vs field 1.748; 0.0 in the barrier shadow |
| 10a | A pulse envelope travels at the configured speed | 200 cells in 3.198 s (expect 3.200 s, 0.06 % error) |
| 10b | An absorbing baffle shadows a probe | probe signal 1.24e-1 → 7.19e-3 with the baffle |
| 10c | **A rigid mirror returns an echo at the specular path length** | echo 6.38e-2 at t = 6.41 s where the 397-cell mirror path predicts 6.36 s; the quiet window just before it is 2.91e-3 (22× contrast) |
| 10d | A thick absorber removes a transmitted pulse | behind-barrier peak: open 3.39e-1, absorber 3.79e-4 (×890 attenuation), rigid wall 0.0 |
| 11 | Speed | 3 substeps at 500×312 in 17 ms in Node (no SIMD, no workers) |

Notes on interpretation, so the table is not over-read:

* 1a/3b: 20 cells per wavelength is where a 5-point stencil starts to
  disperse. The 0.9 % wavelength shortfall is real and expected; it is why the
  UI prints cells-per-wavelength in the HUD, and why "coarse" grids look
  slightly "stringy".
* 3a is deliberately a *boundedness* check, not an energy check. My first
  version asserted energy conservation and correctly failed: for the
  u_tt = c²∇²u scheme Σu² is not the conserved quantity (it sloshes between
  the u and u_t forms). I confirmed this by running the identical initial
  condition against a textbook reference scheme — the two produced the same
  trace to 4 decimals, which is what told me the observable was wrong, not the
  solver.
* 10c is the check I trust most for "reflection is real": a probe that is in
  the *direct* shadow of the source (the baffle absorbs the straight path,
  10b) still sees a pulse, and it sees it at the time predicted by reflecting
  the probe in the mirror and measuring that path.
* 2b/16 are negative controls: the stability machinery is only meaningful
  because the app can actually blow up when you turn the clamp off.

---

## 3. Browser verification (real Chrome, real input)

`tests/browser-check.mjs` launches Chrome through `agent-browser`, loads
`file://…/index.html`, and asserts on live state via a debug hook the page
exposes (`window.__lab`: the live sim, params, `step()`, `stats()`). Painting
and dragging use `mouse move/down/up` at page coordinates, i.e. genuine
pointer events over the canvas, not function calls. Each check prints its
measured value.

**Desktop 1280×800: 45 passed, 0 failed** (`evidence/browser-desktop.txt`).
Selected results:

* default scene after 6 s: 109 distinct colours in the drawn image, field max
  18.6, 0 non-finite cells; only 4 % of a mid-line cut sits below the noise
  floor → the load state is a real two-source pattern, not a wash.
* all 7 view modes produce distinguishable pictures (colour counts
  amp 108 / intensity 45 / energy 135 / phase 823 / gradient 35 / medium 2 /
  flow 487). The medium count of 2 is correct there: the default preset has no
  barriers, so a medium map of flat water *should* be flat (that is check 3b).
* all 12 presets run 2.6 s each with a finite field and > 12 colours.
* wall drag → 2000+ cells become WALL, and the far side goes to mean \|u\| = 0
  (the wall really shields, in the browser, with pointer input).
* absorber drag → 3212 damped cells, minimum speed 0.32; lens drag → a disc of
  slower medium down to 0.32; the index brush stamps its value; the eraser
  returns those cells to 1.0.
* probe tool adds a probe **and** its scope; emitter tool adds an emitter that
  drives the field; probe traces carry real signal.
* dt 0.03 s (CFL 1.5 at the default grid) → the solver used 0.014 s, and the
  HUD printed "CFL 0.700 / 0.707 · dt clamped 14.0 of 30.0 ms". Same setting
  with unsafe mode on: 33 334 non-finite samples and the badge flipping to
  UNSTABLE — then finite again when safe mode is restored.
* grid 192×120 and 560×350 both render without blowing up (560×350 runs at
  CFL 0.700, just under the limit, which is why it is the "finest" setting and
  not the default).
* scene export → import round-trips; localStorage save → load restores.
* 60 fps typical at the default settings (measured from the rAF interval,
  3.1–6.4 ms of work per frame on this machine); 45 fps while the phase and
  flow modes are active, which do a per-pixel `atan2`.
* no horizontal overflow; `file://` load with zero external requests.

**Narrow 390×844: 45 passed, 0 failed** on the final artifact
(`evidence/browser-mobile.txt`). An earlier pass of the same suite came back
42/3, and all three failures turned out to be the harness, not the page — each
was then re-checked by hand:

1. "3b medium mode" used a colour-diversity threshold tuned on a 942-px-wide
   canvas; at 390 px there are far fewer sampled pixels, so an absolute colour
   count is meaningless. The check now compares medium mode against amplitude
   mode on the same frame. The medium map itself rendered correctly throughout.
2. "12 emitter tap" tapped at (6.4 m, 3.9 m), which in the narrow layout sits
   inside the pick radius of an existing object, so the app correctly
   *selected* it instead of creating a new emitter. Re-tapping an empty spot
   created it (sources 2 → 3), verified by hand at 390×844.
3. "13 probe trace" measured a probe sitting on a cancellation line, where the
   honest reading is near zero (in that run its peak was 0.097 against 0.58 for
   a neighbour in the lit region). The desktop variant uses a lit probe.

Two genuine layout/robustness defects surfaced at narrow width and were fixed:

* `#app` collapsing to `height:auto` let the flex column shrink the tank to
  240×150 CSS px on a 390-px viewport (two thirds of the screen unused). After
  giving `#cvwrap` an explicit `min(56vh,430px)` the tank is 380×237 and fills
  the width — see `evidence/shots/final-narrow.png`.
* `setPointerCapture()` throws on synthetic (non-real) pointer ids, which
  aborted the whole `pointerdown` handler. It is now wrapped, which is also
  what makes touch-style event injection testable at all (check 22: 532 wall
  cells painted by an injected touch drag).

---

## 4. Defects found *because* of verification (and what was done)

The honest reason to run things rather than eyeball them. All of these were
silently broken at some point in this build:

1. `boot()` was never called → nothing ran. Caught by `typeof __lab`.
2. `allocBuffers()` was dropped while deleting dead code → `img.data` threw
   every frame → black canvas, empty HUD, and *no console error* in
   `agent-browser errors`. Caught by pixel statistics.
3. A temporal-dead-zone reference in `updateHUD` (`rClamped`/`used` used above
   their `const`) threw every frame → HUD frozen on its placeholder. Caught
   only after adding a check that asserts the HUD text actually changes.
4. `im` is not defined in the scope drawer → the probe **spectrum never
   rendered**, and the page threw an uncaught error every 3rd frame. My first
   "did it draw?" probe counted teal trace pixels as blue bars and passed it.
   Fixed, and the pixel test now samples only the spectrum half.
5. Source/probe coordinates: the solver works in cell units, the UI was
   written in metres. Emitters landed in the top-left corner and the echo
   geometry was nonsense. The whole app now stores cells (verified: the two
   mid-line probes read 0.58 and 0.097 — the second one genuinely sits on a
   nodal line).
6. Slit tool painted continuously during a drag, so the barrier grew a wedge
   following the cursor. Now it previews the line and paints on release.
7. `fps` was computed from work time, not frame interval, so the HUD claimed
   "321 fps". Now it measures the rAF interval.
8. The stability badge only mentioned the clamp when CFL was *above* the
   limit, but a clamped run sits just below it — so a silently halved timestep
   looked like all-clear. Now it says "dt clamped 14.0 of 30.0 ms".
9. Energy-flow mode read a stale flux field while paused (arrows frozen/black).
   It now recomputes the flux pass over the frozen field.
10. Auto-exposure scaled on max-ish magnitudes; with a driven cavity the
    near-source cells sit ~50× above the far field, so the picture printed
    black. Scaling on mean \|u\| plus a sqrt compression is what makes the
    default view readable.

---

## 5. Things that are deliberately *not* claims

* **Not a claim:** quantitative accuracy of the "energy flow" hue map or the
  phase-isochron map. They are computed from real fields (S ∝ −u̇∇u; phase from
  the quadrature channel) and they visibly track wavefronts and the Poynting
  direction, but I did not write a numeric test that pins their colour to a
  known vector field.
* **Not a claim:** performance on low-end hardware. 45–60 fps was measured on
  one desktop machine with a software-rasterised Chrome; a phone will be
  slower, and 560×350 with 8 substeps will drop frames. Substeps and grid
  exist for that reason, and the HUD prints ms/frame so it is visible.
* **Not a claim:** that the absorber is a perfect PML. It is a graded
  damping/slowdown band; measured attenuation is ×890 for a 4-wide slab at
  normal incidence (§2, 10d) and it degrades for grazing incidence.
* **Not verified on device:** real multi-touch. Pointer events with
  `pointerType: "touch"` were injected and work, and `touch-action: none` is
  set on the canvas, but no physical touchscreen was involved.
* **Not tested:** persistence across a *resolution* change. Scenes are stored
  with their grid size and importing a scene into a different grid is refused
  with a message rather than silently resampled.

## 6. Known rough edges left in

* Probe labels (P1/P2) can clip at the right edge of the canvas on narrow
  screens.
* The scope strip has a fixed 150 px height; with 8 probes you scroll
  horizontally, which is intended but not pretty.
* The probe's dominant-frequency readout is a 256-point FFT over a ~1.8 s
  window, so its resolution is ~0.4 Hz: on the default scene it reports
  "f₀ 2.93 Hz" for a 2.6 Hz drive, because the window also contains wall
  reflections. It is a diagnostic of what is actually at that point, not a
  frequency counter, and the label should be read that way.
* Auto-exposure lags a fraction of a second after a sudden impulse (it is an
  EMA); switching to a fixed exposure is the workaround.
* `phase` and `flow` modes cost a per-pixel `atan2` and are the two slowest
  views by about 2×.
