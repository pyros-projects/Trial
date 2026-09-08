# Validation Report — Black Hole & Gravitational Lensing Explorer

Artifact: `index.html` (single self-contained file, raw WebGL2, no libraries, no network use)
Test environment: headless Chromium (Google Chrome stable) driven by `agent-browser` via CDP.
GPU in this environment: **SwiftShader software rasterizer** (ANGLE/Vulkan) — there is no hardware
GPU on this machine. The app detects this and clamps first-run quality (render scale 0.32,
max steps 128); a hardware GPU keeps the cinematic defaults (scale 0.78, 480 steps).
Screenshots referenced below are in this directory. Local server used for testing:
`python3 -m http.server 8123` (a development aid only — the artifact itself needs no server).

## Legitimacy of the lensing model

- Photons are integrated backwards from the camera with the Schwarzschild null-geodesic
  ODE in Cartesian form, `d²x/dλ² = −(3/2)·rs·h²·x/r⁵` (h = |x×v| conserved), adaptive
  step size, per-pixel, every frame. No pre-rendered imagery, no screen-space fake.
- Evidence that lensing is real and view-dependent: `07-after-orbit-drag.png` (after a
  320 px pointer drag: yaw 365°→244°) shows the photon ring, the lensed far-side dome,
  a secondary under-arc below the shadow, and bent star trails — all move continuously
  and correctly with the camera; `12-photon-skim.png` (preset animation 17 rs → 4.6 rs)
  shows the shadow growing to fill the view as the camera approaches the photon sphere.
- CPU-side mirror integrator (velocity-Verlet, half shader step) reproduces the same
  trajectories for the selected-ray panel/diagram (see ray selection below).

## Checks performed (all against the running artifact)

| # | Check | Result | Evidence |
|---|-------|--------|----------|
| 1 | Boot, WebGL2 context, HDR (RGBA16F) buffers, no console errors | PASS (fps 10–23 on SwiftShader; `ready` log; console clean) | 03/06/19 |
| 2 | Orbit via real pointer drag → lensing updates continuously, not a static rotation | PASS (yaw 365→244; accN reset each frame = live re-render) | 07 |
| 3 | Wheel zoom (17 → 8.79 rs) | PASS | eval-verified |
| 4 | Right-drag pan (target → (−0.52, 0.51, 1.54)) | PASS | eval-verified |
| 5 | Click to select ray → panel with b, min-r, deflection, steps, crossings (δ, g, T_K, ρ + color chip), path overlay, geodesic-plane diagram | PASS (escaped ray: b=4.977 rs, defl 33.9°, crossing r=4.44 rs, δ=1.282, g=0.88) | 08 |
| 6 | Captured ray classification | PASS (tap at 390×844 gave b=2.351 < b_crit 2.598 rs → state "captured", deflection 180°, spiral visible in diagram) | 16 |
| 7 | All 7 visualization modes switch via keys 1–7 and select; HUD name + legend + select stay in sync | PASS (all 7 verified) | 09-*, 10, 11, 17, 18 |
| 8 | Step-count mode exposes integration data (photon-ring winding = dark red band) | PASS | 09-mode-2.png |
| 9 | Deflection mode (red = π capture, smooth gradient outward) | PASS | 09-mode-3.png |
| 10 | Redshift·Doppler map: blue-white approaching side vs red receding side | PASS | 11-mode4-redshift-doppler.png |
| 11 | Classification mode (escaped/captured/step-limit/absorbed) + legend | PASS | 10-mode-7-classify.png |
| 12 | Pause/resume (Space + button): time freezes, HUD shows ⏸ PAUSED, button label toggles | PASS (simT 67.4 → 67.4 after 2 s; resumed advances) | eval-verified |
| 13 | Simulation time slider + time-speed slider | PASS (HUD t= mirrors slider; disk turbulence advects differentially with Keplerian Ω(r)) | HUD in all shots |
| 14 | Doppler strength control quantified: approaching/receding strip luminance ratio = **1.00 (off) → 1.83 (0.75) → 2.24 (1.0)**; approaching side correctly on screen-left for spin +0.6 at yaw 190° | PASS | eval-verified |
| 15 | Mass/lensing slider: rs 0.4→2.2 scales shadow & lensing; camera distance in rs updates (42.5 → 7.7 rs) | PASS | 13 |
| 16 | Spin slider updates Kerr markers: ISCO(−0.9)=4.359 rs, ISCO(0)=3.000 rs (6 r_g ✓), ISCO(+0.9)=1.16 rs; photon-orbit marker 0.779 rs at |a|=0.9 | PASS (after fix, see "Issues found") | eval-verified |
| 17 | Event-horizon size slider: horR/rs = 1.181 at 1.8× with spin 0.6 | PASS | 13 |
| 18 | Disk inner/outer radius, thickness, inclination (55° tilt of plane + overlay ellipse), temperature (3000 K ↔ 12300 K), turbulence — all live | PASS | 13, 14 |
| 19 | Temporal accumulation: paused, accumMax=48 → accN climbs 7→14→…→62 and alpha caps at 1/48; image refines (accum 24/24 in hero shot) | PASS (after fix, see "Issues found") | 19 |
| 20 | Quality presets (Low/Medium/High/Ultra/Auto/Custom) rewrite scale/steps/accum/bloom and refresh all sliders | PASS | eval-verified |
| 21 | Render-resolution slider changes internal dims (998×624 @0.78 → 410×256 @0.32 → 125×270 at 390 px viewport) | PASS | HUD in shots |
| 22 | Viewport resize 1280×800 ↔ 390×844: canvas backing, internal render size, and overlay all follow | PASS | 16 |
| 23 | Narrow layout: panel auto-collapses on <700 px at load; ray panel usable; tap-to-select works | PASS | 16 |
| 24 | Persistence: temp→12300, thickness→0.45 survive reload; Reset all restores defaults + clears storage | PASS | eval-verified |
| 25 | Graceful shader-failure path (`?crashshader`): modal "Shader compilation failed" + exact GLSL log (`undeclared identifier`), app halts safely | PASS | 15 |
| 26 | Direct `file://` open (no server): boots, renders, `ready`, zero console errors | PASS | eval-verified |
| 27 | No external network use: CDP request log shows only local document loads; source contains no external URLs/fetches; favicon suppressed via `data:` | PASS | network log |
| 28 | H (hide UI), O (auto-orbit), R (reset camera), 1–7 (modes), Space (pause), arrows (orbit) — real CDP key events | PASS | eval-verified |
| 29 | Screenshot PNG button works without error | PASS | eval-verified |
| 30 | Performance overlay contents: fps, frame ms, internal render dims + scale + canvas + dpr, quality, accum n/cap, enc, mode, camera distance/yaw/pitch, sim time, auto-orbit, selected-ray steps + state, GPU name, pause state | PASS | visible in every screenshot |

## Issues found and fixed during validation

1. **Blend pass sampled textures with raw pixel coords** (`gl_FragCoord.xy` un-normalized)
   → whole scene rendered black. Fixed by normalizing with the target resolution (`03`).
2. **Leftover `gl2` reference in Target constructor** → boot threw ReferenceError and the
   RAF loop never started (page silently dead). Fixed; boot now also wrapped in
   try/catch → fatal box instead of silent death.
3. **Volumetric slab made grazing rays crawl** (dt capped at 0.07 rs across a huge
   screen region): 61 % of rays ended "disk-absorbed", 15 % hit the step limit.
   Fixed with tighter slab bounds (inner edge at 0.98·r_in), a 48-step slab budget,
   coarser in-slab step, and absorption coefficient 3.0. Escape rate went from 20 % → 36 %
   at the same settings; face-on views remain optically thin, edge-on views properly thick.
4. **localStorage persisted a high-quality state** that re-wedged software GL after the
   first ever visit. Fixed: storage key versioned (`bh-explorer-v2`), software-GL/mobile
   clamps apply even over persisted state, plus a runtime watchdog (frame >1.2 s EMA ⇒
   render scale ×0.6 down to 0.2).
5. **ISCO/photon-orbit markers ignored spin sign** (ISCO(−0.9) showed 1.16 rs instead of
   4.36 rs). Fixed with the signed Bardeen branch; verified against textbook values.
6. **Auto-orbit kept marking the scene dirty while paused**, so temporal accumulation
   could never converge. Fixed (pause freezes auto-drift); accumulation verified climbing.
7. **BH note did not refresh on spin/mass/horizon changes.** Fixed (slider set-hooks).

## Known limitations (honest account)

- **No hardware GPU available in this environment** — everything ran on SwiftShader at
  clamped settings (410×256, ~10–23 fps). On a typical desktop GPU the defaults
  (998×624 internal @ dpr, 480 steps, HDR accumulation) should run at 30–60+ fps;
  this could not be measured here and is extrapolated from the per-frame cost model
  and the pass-level timings measured in `devtests/pipeline.html` (ray pass 68 ms at
  320×200×96 steps even on SwiftShader).
- Missing-WebGL2 message path is code-reviewed but could not be exercised end-to-end
  (no browser build without WebGL2 available); the shader-failure path, which shares
  the same fatal-error UI, was exercised (check 25) — I mark the WebGL2-absent dialog
  itself as **not-run on-device**.
- High-DPI (dpr 2) rendering is implemented (canvas backing = css × dpr, internal render
  resolution independent) but this box runs dpr 1, so it is code-verified, not
  device-verified.
- At SwiftShader's clamped resolution the disk looks soft; fine turbulence detail needs
  the higher internal resolution a real GPU provides (structure is clearly visible in
  the 36°-inclination shot `08`).
- Diagnostic modes render in display space (no exposure/tonemap) by design; bloom and
  exposure apply to the beauty mode only.
- The spin model shifts horizon/ISCO/photon-orbit markers, disk speed direction and
  Doppler asymmetry, but geodesic bending uses the Schwarzschild term (documented in
  the in-app note); full Kerr ray tracing was out of scope for a real-time single file.

## Final build regression

After the last edits (hint copy, all fixes above), `index.html` was rebuilt and cold-loaded:
mode switch 3→0, pause→resume, camera change, and 15 s of continuous rendering ran with
**zero page errors and zero console errors** (`evidence/20-final-artifact.png`).
`node --check` passes on the concatenated script; the file is 77,840 bytes, starts with
`<!DOCTYPE html>`, ends with `</html>`, and contains no external URLs.

## Environment incidents (for transparency)

The shared agent-browser daemon restarted several times during testing (other
agent sessions on this machine navigate the same daemon; SwiftShader runs hot).
Later checks were run in an isolated session (`AGENT_BROWSER_SESSION=bhval`).
Every check listed above was re-verified after the final build of `index.html`.
