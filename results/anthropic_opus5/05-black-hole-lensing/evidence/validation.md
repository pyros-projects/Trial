# Validation record — Singularis (black hole & gravitational lensing explorer)

Artifact under test: `../index.html` (single self-contained file, 102 KB, 2222 lines).
All checks below were run by me against the running application in a real browser.
Status vocabulary: **pass** / **fail** / **blocked** / **not-run**.

---

## 1. Environment and tooling

| Item | Value |
|---|---|
| Browser automation | `agent-browser` 0.31.1 (installed skill; `skills get core` + `skills get dogfood` read before use) |
| Browser | Google Chrome for Testing 152.0.7977.54, headless, driven over CDP |
| GPU | **None.** `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)` — a *software* rasteriser |
| Host | WSL2, Linux 6.6.87.2, 32 cores |
| Local server (inspection only) | `python3 -m http.server 8731 --bind 127.0.0.1` |

The software renderer matters for every frame-rate number in this document. A capability
probe (`scripts/00-webgl2-capability-probe.html`) confirmed WebGL2 + `EXT_color_buffer_float`
+ `EXT_color_buffer_half_float` + `OES_texture_float_linear` are all present, but shading
throughput is roughly two orders of magnitude below a discrete GPU. Frame rates here are a
floor, not a representative desktop figure. The app detects this and self-configures (§5.14).

Reproduce:

```bash
cd /home/pyro/projects/naked/opus5/05-black-hole-lensing
python3 -m http.server 8731 --bind 127.0.0.1 &
agent-browser --session bh open "http://127.0.0.1:8731/index.html"
# or, with no server at all:
agent-browser --session bh open "file://$PWD/index.html"
```

The `evidence/scripts/*.js` files are the exact bodies passed to
`agent-browser --session bh eval --stdin`. They read the app's read-only introspection
surface (`window.__bh`) — metrics, the CPU mirror of the integrator, and `signature(n)`,
which renders a frame and reads the canvas back as an n×n luminance grid. They do not
alter rendering behaviour.

---

## 2. Headline check — does the camera really re-integrate the lensing?

This is the check the brief cares most about, so it was done three independent ways.

### 2.1 Real pointer drag with the simulation frozen — **pass**

Time paused (`sim t` held at 7.7 M across the whole interaction), resolution pinned,
accumulation off. Orbit performed with genuine `mouse down` / `mouse move` × 6 / `mouse up`
over the canvas.

| | before | after |
|---|---|---|
| camera yaw | 0.620 rad | 1.940 rad |
| camera pitch | 0.145 rad | 0.055 rad |
| sim time | 7.7 M | 7.7 M (frozen) |
| 6×6 luminance signature | changed in **all 36 cells** | |

Screenshots `08a-orbit-before.png` → `08b-orbit-after.png`. The geometry does not merely
rotate: the tilted view becomes edge-on, the disc's far side splits into an over-arc and an
under-arc, and a thin photon ring closes into a complete circle around the shadow. A rotated
pre-render cannot produce that.

### 2.2 Camera-independent physical invariant — **pass** (strongest evidence)

`scripts/04-shadow-edge-invariant.js`. With spin 0, the shadow boundary was located by
bisecting *screen x* (via ray picking) at four camera distances/FOVs. The boundary lands on a
different pixel every time, but the physical impact parameter of the boundary ray is the same
constant, and its closest approach is the photon sphere:

| camera distance | FOV | shadow edge (px) | b (r_g) | b / b_crit | closest approach |
|---|---|---|---|---|---|
| 20 | 60° | 454.33 | 5.1771 | 0.9963 | 3.000 |
| 32 | 35° | 431.47 | 5.1903 | 0.9989 | 3.000 |
| 60 | 20° | 442.88 | 5.1941 | 0.9996 | 3.000 |
| 95 | 12° | 431.59 | 5.1946 | 0.9997 | 3.000 |

b_crit = 3√3 M = 5.19615. Reproducing a camera-independent GR invariant to ≤0.4% requires
integrating rays per pixel per frame.

### 2.3 GPU render vs. independent CPU trace agree — **pass**

In "Escape class" mode the GPU classifies every pixel (captured / absorbed in disk /
budget exhausted / escaped). The yellow overlay curve is computed separately on the CPU by
bisecting the capture angle with the JS mirror of the integrator. The two coincide along the
whole boundary (`02b-escape-class-fixed.png`, `20-spin-asymmetry.png`), including the strongly
asymmetric spin-0.9 case. Two independently written code paths landing on the same boundary.

---

## 3. Physics verification against analytic GR

`scripts/01`, `02`, `03`. Spin 0, mass 1, step size 0.03, disc moved out of the way.

### 3.1 Light deflection vs. the post-Newtonian series — **pass**

α = 4M/b + 15πM²/(4b²) + O(b⁻³)

| b (r_g) | measured | 1st order | 1st+2nd order | error vs 1st+2nd |
|---|---|---|---|---|
| 2000 | 0.11478° | 0.11459° | 0.11476° | 0.013% |
| 500 | 0.46115° | 0.45837° | 0.46107° | 0.019% |
| 200 | 1.16328° | 1.14592° | 1.16279° | 0.042% |
| 100 | 2.36222° | 2.29183° | 2.35933° | 0.12% |
| 50 | 4.87562° | 4.58366° | 4.85366° | 0.45% |
| 20 | 13.53129° | 11.45916° | 13.14666° | 2.9% |
| 12 | 25.93472° | 19.09859° | 23.78609° | 9.0% |

The residual grows exactly as the *next* term of the series (at b = 12 the 3rd-order term
128M³/3b³ = 1.41°, which accounts for most of the remaining 2.15°). The integrator is
tracking the exact geodesic, not the truncated series.

### 3.2 Critical impact parameter — **pass**

Bisection on capture: **5.19577** vs analytic 3√3 = 5.19615 → **0.007% error**.

### 3.3 Photon sphere and strong deflection — **pass**

| b / b_crit | total bend | closest approach | outcome |
|---|---|---|---|
| 1.001 | 369° | 3.083 | escaped |
| 1.010 | 242° | 3.274 | escaped |
| 1.200 | 87° | 4.742 | escaped |
| 2.000 | 32° | 9.193 | escaped |

Marginally-escaping rays approach r → 3.06 M (analytic photon sphere 3 M) and wind past a
full turn — the mechanism that produces the photon ring and higher-order disc images.

### 3.4 Shadow angular radius — **pass**

Camera rays are unit vectors in coordinate directions, so the boundary satisfies
sin θ = √(27/(r² + 54/r)).

| r_obs | measured | analytic | error | (static-observer value, for reference) |
|---|---|---|---|---|
| 10 | 30.4027° | 30.4064° | 0.012% | 27.6946° |
| 20 | 15.0057° | 15.0069° | 0.008% | 14.2690° |
| 32 | 9.3366° | 9.3373° | 0.008% | 9.0458° |
| 50 | 5.9634° | 5.9638° | 0.007% | 5.8442° |
| 200 | 1.4886° | 1.4888° | 0.007% | 1.4813° |

My first comparison used the static-observer formula and showed a 10% deviation at r = 10.
That was my formula being wrong, not the renderer: the camera is a coordinate-frame observer.
The distinction and its size are now documented in the app's "Model & units" panel.

### 3.5 Conserved quantities — **pass**

Along a b = 6 ray (576 recorded steps), |x × dx|/|dx| tracks the theoretical
h/√(1 + 2Mh²/r³) to a **maximum 0.34% error**, and the closest approach matches the analytic
turning point (4.4539 vs 4.4536). Both the angular-momentum and energy integrals hold.

### 3.6 Spin approximation — **pass, with the caveat that it is an approximation**

At a = 0.9, r_obs = 20, equatorial: capture angle 19.06° on the retrograde side vs 10.40° on
the prograde side (15.01° at a = 0) — a 59% asymmetry, with the smaller shadow on the
prograde side. Real Kerr at a = 0.9 has b ≈ −6.4 / +3.6 M, i.e. a ~56% asymmetry in the same
direction, so the sign is right and the magnitude is in the right range. This is a
gravitomagnetic (Lense-Thirring) approximation, not a Kerr integration; the app says so.

### 3.7 Horizon size vs. shadow size — **pass** (`scripts/08`)

Traced shadow radius while scaling the absorbing sphere:

| horizon scale | r_h | shadow radius |
|---|---|---|
| ×0.5 | 0.92 | 9.6182° |
| ×1.0 | 1.84 | 9.6371° |
| ×1.5 | 2.75 | 9.6717° |
| ×1.63 | 2.99 | 9.6768° |
| ×1.8 | 3.30 | 9.7518° |
| ×2.0 | 3.67 | 10.0460° |

Textbook behaviour: the shadow is fixed by the photon capture radius and is nearly blind to
the horizon until the absorbing sphere grows past the photon sphere at 3 r_g.

---

## 4. Step-size / integrator convergence — **pass**

Same b = 6 ray, varying the ray step-size control (`scripts/06`):

| step size | steps used | total bend | closest approach |
|---|---|---|---|
| 0.30 | 59 | 97.373° | 4.4731 |
| 0.14 (default-ish) | 75 | 97.691° | 4.4710 |
| 0.06 | 161 | 98.391° | 4.4557 |
| 0.02 | 484 | 98.500° | 4.4536 |

Monotone convergence; the default trades ~0.8% deflection accuracy for ~6× fewer steps.
Switching Verlet → RK4 changes the image slightly (mean |Δlum| 0.42 on a 0–255 scale), as
expected for a higher-order scheme on the same trajectories.

---

## 5. Functional checks

| # | Check | Method | Result |
|---|---|---|---|
| 5.1 | Fresh load, clean console | `errors`, `console` after load | **pass** — both empty |
| 5.2 | No external assets/services | `network requests` | **pass** — exactly 1 request: the document itself. No `<script src>`, `<link>`, `<img>`, no `fetch`/XHR/WebSocket in source |
| 5.3 | Direct `file://` load | opened `file:///…/index.html` | **pass** — renders (frame 333, 40.6 fps), 1 request, no errors, drag-orbit works (yaw 0.620 → 1.280). Screenshot `19-file-protocol.png` |
| 5.4 | Orbit by pointer drag | real pointer events | **pass** — §2.1 |
| 5.5 | Zoom | `mouse wheel` ±, and wheel over a panel | **pass after fix** — 32 → 44.07 → 30.99 r_g; wheel over the controls panel scrolls it and does **not** zoom |
| 5.6 | Pan | shift-drag pointer sequence | **pass** — target [0,0,0] → [2.263, 1.450, −1.876] |
| 5.7 | Camera presets (6) | real clicks on each button | **pass after fix** — Edge-on 30 r_g/2.6°/30°, Polar 36/77.9°/42°, Photon ring 30/12.6°/26°, Close pass 11/24°/80°, Wide 66/28.6°/24°; eased transitions. `16-preset*.png` |
| 5.8 | Auto-orbit | button click, 3 s | **pass** — yaw +0.181 rad in 3.0 s at the configured 0.06 rad/s; button shows active state |
| 5.9 | Pause / resume | button, then Space | **pass** — sim time frozen at 24.78 M across 2 s paused; label toggles Pause/Resume; Space resumes |
| 5.10 | Reset | R key after changing mass 2.4 / temp 22000 K / dist 8 | **pass** — all restored (1.0 / 6600 K / 32), mode and quality reset, toast confirms |
| 5.11 | Ray selection by click | real click at (600, 186) | **pass** — panel opens with 14 values: b = 5.412 r_g, b/b_crit = 1.042, 73/400 steps, closest approach 3.375 r_g, total deflection 230.6°, net bend 126.3°, winding Δφ 392.9°, escaped to sky, 1 disc crossing at r = 6.78 r_g / φ = 70°, Doppler δ = 0.9310, gravitational shift 0.8671, T 6583 → 5314 K. Ray path drawn over the image, disc-hit marker, trajectory diagram rendered (2498 non-transparent px). `10-ray-panel.png` |
| 5.12 | 8 visualization modes | render + per-mode statistics | **pass** — all 8 produce distinct non-degenerate images (per-mode SD 12.8–83.4); the closest pair still differs by mean 14.3 luminance; legend title/scale/categories update per mode. `11-mode*.png` |
| 5.13 | Overlays | checkbox clicks | **pass** — horizon, photon sphere + traced shadow edge, disc plane (rings + spokes), selected ray path; 30 942 overlay pixels drawn; legend names each curve and flags geometric vs lensed |
| 5.14 | Quality presets | select each, measure | **pass** — Low 435×272 / 110 steps / 2 octaves / Verlet; Medium 666×416 / 170 / 3; High 896×560 / 220 / 3; Ultra 1280×800 / 400 / 4 / RK4. Editing any of those controls flips the label to "custom" |
| 5.15 | Adaptive resolution | force Ultra with adaptive on | **pass** — multiplier walks down from 1.00 automatically under a 10 fps load; HUD shows "quality high (adapt NN%)" |
| 5.16 | Software-renderer detection | fresh load on SwiftShader | **pass** — auto-selects Low and shows a toast naming the renderer |
| 5.17 | Every control affects the render | 26 parameters + 3 camera controls, A/B signature | **pass** — see §6 for the two that needed investigation |
| 5.18 | Temporal accumulation | progressive vs off | **pass** — progressive converges (successive frame deltas 0.558 → 0.328); with accumulation off, two successive frames are bit-identical (delta 0.000) |
| 5.19 | Live resize, no reload | viewport 1280×800 → 700×500 → 1600×900 | **pass** — internal buffer 666×416 → 364×260 → 832×468, overlay canvas tracks, no errors |
| 5.20 | Narrow viewport 390×844 | load + drawer + tap | **pass after fix** — 114×247 internal at 32.8 fps; hamburger opens a scrollable drawer; tap selects a ray (b = 2.907, captured) and opens the ray panel. `12`–`14-mobile*.png` |
| 5.21 | High-DPI | viewport 1280×800 @2× | **pass** — dpr 2 detected, internal 1331×832 = round(1280·2·0.52), overlay backing 2560×1600 at 1280×800 CSS so vector overlays and text stay crisp; HUD reports "@2.00x". `23-highdpi.png` |
| 5.22 | Missing WebGL2 | `?nowebgl2=1` test hook | **pass** — full-screen explanation, causes and fixes listed, canvas hidden, diagnostics block with UA, "Try again" / "Copy diagnostics". `17-error-nowebgl2.png` |
| 5.23 | Shader compilation failure | `?badshader=1` test hook | **pass** — names the failing shader (`geodesic:fs`), prints the driver's exact message (`ERROR: 0:343: …`), and echoes ±4 source lines around the fault with the failing line marked, plus the renderer string. `18-error-badshader.png` |
| 5.24 | Keyboard | Space / R / H / C / 1–8 / arrows | **pass** — pause, reset, hide UI, cycle preset, mode switching (key 3 → Deflection angle, key 6 → Disk hit), arrows orbit by exactly 0.06 rad each |
| 5.25 | Performance overlay contents | read HUD | **pass** — fps + ms, internal render dims + %, display size + dpr, avg *and* selected-ray step count vs budget, quality (+adaptive %), active mode, camera distance, accumulation state, sim time, pause state |
| 5.26 | Errors after full interaction sweep | `errors`, `console` | **pass** — empty |

The two `?…` query flags are deliberate test hooks for the failure paths; they are inert on a
normal load and documented as such in the source.

---

## 6. Defects found during development, and what was done

Every one of these was found by running the app, not by reading it.

1. **Near-edge-on disc rays exhausted the step budget.** "Escape class" showed the entire
   disc region as *budget exhausted* (`02-escape-class-check.png`). Cause: the step limiter
   sized steps by the disc scale height regardless of ray direction, so a ray travelling
   *along* the disc took ~0.2 r_g steps for 40 r_g. Fix: the in-slab step is now set by how
   fast density changes *along the ray* — `H·k / |v̂·N|`, capped by the horizontal turbulence
   scale. Retest: budget-exhausted pixels gone entirely, average steps 70 → 42
   (`02b-escape-class-fixed.png`).
2. **Stars rendered as ellipses.** Distances were measured in gnomonic cube-face UV units, so
   star profiles stretched away from face centres (`05-sky-check.png`). Fix: measure with the
   projection's angular metric. Retest: stars round at 9° FOV (`05c-star-zoom.png`); the
   remaining elongated shapes were confirmed to be genuine tangential lensing arcs by
   dropping the mass to 0.25, where they shrink and the far field stays round
   (`05d-lowmass-sky.png`).
3. **Disc massively overexposed**, washing the frame to white (`00-first-look.png`). Fixed by
   normalising emission by the vertical column depth (so thickness changes shape, not
   exposure), adding a Σ ∝ 1/r surface-density profile and spiral density waves, and
   retuning the default temperature/exposure. Retest: `07-hero2.png`, `22-final-high-quality.png`.
4. **"Photon ring" preset put the camera inside the disc**, filling the frame with an opaque
   wall and no black hole (`15-preset-photonring.png`). Edge-on and Close-pass had the same
   risk. Fix: all three presets moved outside the disc's outer radius / above its slab.
   Retest: `16-preset1/3/4.png`.
5. **Wheel zoom only worked with the cursor directly over the canvas.** Surfaced when the
   automation dispatched a wheel event at (0,0) and nothing happened. Fix: window-level
   handler with an explicit exemption so the controls and ray panels still scroll.
   Retest in 5.5.
6. **Legend and ray panel overlapped** in the bottom-right corner (`09-ray-selected.png`).
   Fix: both moved into a flex column. Retest: `10-ray-panel.png`.
7. **Mobile drawer collided with the HUD and legend** (clipped text, floating legend over the
   controls). Fix: HUD and right-hand stack fade out while the drawer is open. Retest: 5.20.
8. **Derived geometry could go stale on the CPU side.** `G` (horizon radius, disc basis,
   escape radius) was refreshed only inside `renderFrame`, so a CPU trace issued between a
   control change and the next frame used old values — which is exactly what made
   `horizonScale` look inert in §3.7's first run. Fix: every `setParam` refreshes the derived
   geometry immediately. Retest: §3.7 now shows the correct shadow response.
9. **Ray-trajectory diagram was unreadable** — a linear radial scale made the horizon a few
   pixels across. Fix: √r radial warp with labelled 10/20/40 r_g rings.
10. **Adaptive resolution converged slowly** on a very slow renderer (1.4 s per adjustment).
    Fix: shorter window and a faster reduction factor when far from target.

Two controls initially looked like no-ops and turned out to be correct physics, now explained
in their slider hints: **disc tilt azimuth** does nothing while inclination is 0° (verified:
mean |Δlum| 62.7 once inclination is 0.7 rad), and **event-horizon size** barely moves the
image until r_h passes the photon sphere (§3.7).

### Shader cost profile (`scripts/09`), before → after optimisation

Measured at 154×96 on SwiftShader: baseline 40.4 ms, of which the disc shading was 22.5 ms
(56%) and the sky 10 ms (25%); turbulence octave count was ~free, so the cost was
transcendentals, not noise. Replacing the Planck fit with a 256×1 procedurally-generated LUT
texture, replacing `pow` with sqrt/multiply forms, removing an `atan` from the fluid-frame
rotation, gating the sky's nebula FBM, adding a star-cell distance cull, and carrying the
acceleration across Verlet steps (1 force evaluation instead of 2) brought the same frame to
29.1 ms; the step-limiter fix (defect 1) then cut the work far more than that on disc-heavy
views.

---

## 7. Performance (software renderer — floor, not typical)

| Configuration | Internal | fps |
|---|---|---|
| Default first load, 1280×800, adaptive on | 183×114 | ~39 |
| Default first load, 390×844, adaptive on | 114×247 | ~33 |
| Quality High forced, 1280×800 | 896×560 | ~10 |
| Quality Ultra forced, 1280×800 | 1280×800 | ~10 |

Adaptive resolution holds the frame rate near its 30 fps target by trading internal
resolution; disabling it and picking a preset gives the fixed-cost figures above. On any GPU
with hardware shading this workload is one to two orders of magnitude cheaper, which is why
`applyAutoQuality` selects High on non-software renderers and Low here.

---

## 8. Coverage gaps and limitations

* **Not run: real GPU hardware.** Everything was validated on SwiftShader. Shader
  *correctness* is exercised (it is the same GLSL), but I could not measure real-world frame
  rates, and driver-specific compile behaviour on other vendors is untested.
* **Not run: real touch/pinch hardware.** Multi-touch pinch-zoom and two-finger pan are
  implemented via pointer events and were exercised only with synthetic single-pointer input
  at a 390×844 viewport; tap-to-select was verified. Pinch itself is **not-run**.
* **Not run: browsers other than Chrome 152.** No Firefox/Safari check was possible here.
* **Approximations, by design and disclosed in-app:** spin is a gravitomagnetic
  (Lense-Thirring) correction plus the Kerr horizon radius, not a Kerr geodesic integration;
  the Doppler factor is special-relativistic in the local static frame; the camera is a
  coordinate-frame observer (§3.4); disc emission brightness is normalised at the temperature
  peak so the temperature control changes colour rather than exposure.
* **Progressive accumulation** only converges fully while paused; with the disc animating it
  is clamped to avoid ghosting. That is deliberate and stated in the control label.
* The `evidence/` directory and the local HTTP server are development artefacts. The delivered
  application is `index.html` alone, with no build step and no runtime dependencies.
