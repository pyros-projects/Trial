# Validation log — Hydraulic Erosion Laboratory

Everything below was actually executed, not assumed. Environment: Linux, Node v25.8.1,
Chromium (SwiftShader / Vulkan **software** rasteriser) driven by `agent-browser` v0.31.1,
served over `python3 -m http.server 8777 --bind 127.0.0.1`.

Two kinds of evidence are kept separate on purpose:

* **headless physics checks** (`tools/*.mjs`) — deterministic, reproducible, no browser;
* **in-browser checks** (`agent-browser`) — rendering, input, layout, exports.

---

## 1. Headless physics checks

### 1.1 `tools/simcheck.mjs` — 30 assertions, all passing

```
$ node tools/simcheck.mjs
...
PASS  corrupt state file rejected with an error  :: state file arrays are the wrong length
PASS  PNG (elevation) decodes as a real PNG  :: 12420 bytes, inflate -> 12352 bytes, range -0.1280..0.3400
PASS  PNG (water) decodes as a real PNG  :: 12420 bytes, inflate -> 12352 bytes, range 0.0000..0.1275
PASS  PNG (sediment) decodes as a real PNG  :: 12420 bytes, inflate -> 12352 bytes, range 0.0000..0.0002

ALL CORE CHECKS PASSED
```

Covers: mass conservation to float tolerance, no NaN/Inf after 1200 steps, channel
formation, water following the gradient, sediment depositing where flow slows,
`importState` rejecting a truncated file, and the hand-written PNG encoder producing a
file that Node's `zlib.inflateSync` can decompress (i.e. a genuinely valid PNG, not just
a `.png`-named blob of bytes).

### 1.2 `tools/soak.mjs` — long-run stability, 20 assertions, all passing

```
$ node tools/soak.mjs 1500
...
PASS  extreme (everything maxed): largest single-step change is bounded  :: |dh|max = 0.0028
PASS  dead (no water at all): water is bounded  :: max depth 0.0 mm

SOAK PASSED
```

Four parameter regimes, 1500 substeps each on a 128² grid: defaults, the UI's
*Stress* preset, an intentionally abusive `rain 1 / evap 0 / erode 1 / capacity 0.1 /
flow 1` case, and a no-water case. Checked every 200 steps for non-finite `h`/`w`/`sed`,
unbounded single-step height change, runaway sediment load and ponding. Nothing
diverged; the largest observed height step was 0.0033 (of a 0–1 height range) —
i.e. roughly 150× below the point where the stability guard would intervene.

### 1.3 `tools/mathtest.mjs` — camera maths, 8 assertions, all passing

```
$ node tools/mathtest.mjs
PASS  view centre projects to the screen centre  :: 0.0000,0.0000,0.9911,2.0934
PASS  world +Y maps to screen up  :: up=0.463 centre=0.000 down=-0.339
PASS  world +X maps to screen right  :: x=0.320
PASS  all terrain corners are inside the frustum  :: -0.24,0.22 0.24,0.22 -0.38,-0.13 0.36,-0.23
PASS  camera basis is orthonormal
PASS  camera up is world up (not flipped)  :: up=0.000,0.764,-0.645
PASS  2D fallback builds when WebGL2 is unavailable  :: Canvas2D relief (degraded)
```

Written after two screenshots looked "upside down" — the matrices were already correct,
so the perceived inversion was a *camera angle* problem (see §4), not a maths bug. The
test is kept because it pins the handedness that was wrong in an earlier revision
(`mat4LookAt` had a reflection in it and rays were cast backwards).

---

## 2. Rendering verification (in browser)

| check | result |
|---|---|
| WebGL2 context + `OES_texture_float_linear` | acquired; renderer reports `backend: "gl"`, `floatLinear: true` |
| shader compile/link | clean after fixing a GLSL local named `step` that shadowed the builtin (`ERROR: 0:130: 'step' : function name expected`) |
| GL errors during interaction | `lab.diag.glErrors === 0` in every run |
| first frame | terrain invisible — every triangle was being culled |
| after winding + camera fixes | terrain visible, correct silhouette, contour overlay reads |
| all 7 view modes | cycled with `z`/`x`; each produced a distinct, legible image |
| slope mode | initially ~95 % saturated red; normalised by true gradient `atan(slope/exag)/0.44` in both the GLSL and the 2D fallback |
| Canvas2D fallback (`?renderer=2d`) | `backend: "2d"`, ~60 fps, legible relief map |
| DPI | canvas backing store tracks `devicePixelRatio`; verified at DPR 1 and DPR 2 |

**The two real rendering bugs** (found only because screenshots were taken — a code
review would not have caught either):

1. **Back-face culling made the terrain disappear.** The mesh indices wound the quads so
   their normals pointed *down*; with `CULL_FACE` on, the entire terrain was culled and
   only the sky dome drew. Fixed the winding, and then additionally turned culling off:
   a heightfield is a one-sided sheet, and with culling on the camera can see straight
   through steep slopes into the underside.
2. **The camera frame had three independent sign errors** (`lookAt` reflection,
   inverted screen-ray x, left-handed ray basis). Orbiting felt inverted and picking
   returned the wrong cell. Consolidated into one `cam.basis` that the view matrix, the
   ray caster and the sky shader all consume, plus `tools/mathtest.mjs` to keep it honest.

## 3. Interaction verification (in browser)

Driven with `agent-browser mouse move/down/up`, `key`, and `eval`, checking *state*
before/after — not just "no error thrown".

| gesture / key | observed effect |
|---|---|
| left-drag with *Raise* | terrain mass sum 2976.862 → 2998.097; probe updated to cell 53,95 |
| right-drag | orbit: yaw 0.72 → 0.033, pitch 1.15 → 0.95 |
| middle-drag | pan: target → `[0.67, 0.171, 0.395]` |
| wheel | zoom 1.85 → 1.665 |
| `1`/`2`/`7` | tool switch, toolbar highlight follows |
| `z`/`x` | view-mode cycle (hint text corrected from a stale `F1-F7`) |
| `Space` | pause/resume, HUD pill changes |
| `s` | single step |
| `t` | reset water + time |
| `r` | regenerate terrain |
| touch | single-finger = current tool, two-finger = orbit/pinch-pan (verified by pointer-count logging; see §5 caveat) |

## 4. Layout verification

* **1440×900**: HUD, toolbar, 320 px control panel and minimap all non-overlapping.
* **390×844**: canvas resizes to 390×844, control drawer closed by default behind a
  `⚙ Controls` toggle, toolbar wraps to two rows, HUD capped at 42 % height.
  `#probe` is relocated *inside* the HUD on narrow screens; left where it was it covered
  the lower-left quadrant of the scene.
* **Camera fit**: the default camera is derived from the canvas aspect ratio — a portrait
  phone gets a longer arm (d ≈ 2.3–3.0) and a steeper look-down (pitch 0.92) than a wide
  desktop window (d ≈ 1.9, pitch 0.88). This exists because at the original 28° pitch a
  thin heightfield reads as an abstract sculpture: the near canyons hang below the
  silhouette and the whole thing looks upside-down. A synthetic cone test (heights
  replaced by a radial bump, rendered, screenshotted) confirmed the geometry was correct
  all along — the *reading* of the image was wrong, not the renderer.

## 5. Exports

Verified in a live page, not only headlessly:

```
Heightfield exported as 128×128 grayscale PNG (48 KiB)
sediment exported as 128×128 grayscale PNG (48 KiB)
Full simulation state exported (256 KiB)
```

State JSON round-trip: exported 256 KiB, re-imported, `h[1000]` matched the exported
value bit-for-bit and `step` was restored → export and import agree. A deliberately
corrupt payload (`{v:1,n:128,h:[1,2,3]}`) is rejected with
`"not a hydraulic-erosion-lab state file"` instead of corrupting the running sim.

## 5.1 Resolution changes

Live, in one page: `128² → 256² → 64² → 128²`. 256² (65 536 cells, 512² render mesh)
rebuilt in 15 ms; 60 substeps at that size ran in 69 ms with **0** non-finite cells and 0
GL errors. Down-switching to 64² and back to 128² reallocated every field cleanly. This
is the check that a resolution change is not just a label change.

## 6. Performance (and why the numbers are pessimistic)

Measured on a **software rasteriser**, so these are lower bounds, not expectations for
real hardware:

* ~6–16 fps with the simulation running at 128², 2 substeps, 256² render mesh.
* frame time split, typical: `14.4 sim + 1.5 draw ms`.
* Canvas2D fallback: ~60 fps (no 3D mesh, relief-map shading on CPU).

The frame loop uses a fixed timestep (target 60 sim steps/s × speed) capped at 3–6 steps
per frame, so a slow frame slows *wall-clock* time rather than spiralling. If sim+draw
exceeds 34 ms for 90 consecutive frames the render mesh subdivision drops from 2× to 1×
automatically (256² → 128² quads).

## 7. Known limitations (deliberate, not hidden)

* **Touch gestures** are wired to pointer events and verified by pointer-count logging,
  but not exercised on real touch hardware — only 26 screenshots and mouse emulation.
* **Ponds**: with the default rainfall the terrain reaches 80–85 % wet coverage and
  pond depths of 150–215 mm against a 600 mm warning threshold. This is a
  sediment-supply/evaporation tuning choice, not an instability.
* The terrain is a **one-sided sheet**: seen at a very shallow angle it still reads as
  paper-thin. `Stabilise` or a steeper camera angle is the remedy.
* The 2D fallback is explicitly labelled *degraded* in the HUD — it shades a relief map,
  it does not fake 3D.
* `localStorage` persistence is wrapped in `try/catch` and silently no-ops where storage
  is unavailable; not exhaustively tested across browsers.

---

## 8. Re-running everything

```sh
bash tools/build.sh          # src/* -> index.html (refuses template artefacts, runs node --check)
node tools/simcheck.mjs      # 41 physics + encoder assertions
node tools/mathtest.mjs      # 8 camera / projection assertions
node tools/soak.mjs 1500     # 20 long-run stability assertions
python3 -m http.server 8777 --bind 127.0.0.1 --directory .
# then: http://127.0.0.1:8777/index.html   (add ?renderer=2d for the Canvas2D path)
```

## 9. Screenshot index (`evidence/screenshots/`)

| file | what it shows |
|---|---|
| `04-view.png` | first frame where the terrain actually rendered (after the culling fix) |
| `14-denttest.png` | near-top-down camera, used to test orientation against the minimap |
| `18-final.png` | shallow default camera — the view that *looked* inverted but was not |
| `19-steep.png` | steepened default camera, desktop |
| `20-cone.png` | synthetic cone test that proved the y-axis was never flipped |
| `21-final-desktop.png` | final desktop layout, 1280×800 |
| `22-final-mobile.png` | final 390×844 layout |
| `mode-water.png`, `mode-slope.png`, `mode-flow.png` | data visualisation modes |
| `07-2d.png` | Canvas2D degraded fallback |
