# Validation — Black Hole & Gravitational Lensing Explorer

Artifact: `../index.html`, a single self-contained file (~119 KB). It has no external URLs, imports, fonts, images or network calls; `grep` for `http(s)://`, `<link>`/`src=`/`url(`/`fetch(`/`import(` returns nothing, apart from the inline `data:,` favicon.
Date: 2026-09-27. Validation was done by the agent that built the app. Status meanings: **pass**, **fail**, **blocked**, **not-run**.

## Tooling and environment

| Item | Detail |
|---|---|
| Browser automation | `agent-browser` 0.31.1 (installed skill). Read `skills get core` + `skills get dogfood` before use. All interaction goes through its CLI: `open`, `mouse move/down/up/wheel`, `press`, `click`, `select`, `focus`, `tap`, `set viewport`, `set device`, `screenshot`, `eval`, `console`, `errors`, `network requests`. |
| Real-GPU session | Headed Chromium in WSL2 with Mesa d3d12 → ANGLE-GL: `ANGLE (Microsoft Corporation, D3D12 (NVIDIA GeForce RTX 4090), OpenGL 4.6)`. Launch helper: `scripts/gpu-session.sh`. Headless Chromium here only gets software GL. |
| Slow-device session | Headless Chromium with **SwiftShader** (CPU rasterizer): `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)))`. Stands in for a weak GPU and exercises the adaptive-resolution path. |
| Local server | `python3 -m http.server 8765 --bind 127.0.0.1` (dev only, not a runtime dependency). |
| Node | v25.8.1, for `scripts/physics-test.mjs`. It extracts the shipped `<physics-core>` block from `index.html` verbatim. |
| Live diagnostics | The app exposes `window.__bh` (state, GPU probe, CPU trace, setters). The GPU probe is the **same ray shader** compiled with `#define PROBE`, rendered to one pixel with 4 RGBA32F MRT outputs and read back. |

## 1. Physics / shader-correctness checks (Node, shipped code) — **pass**

Command: `node evidence/scripts/physics-test.mjs` → **23 passed, 0 failed** (re-run after every physics edit; final run in §10).

Key results:
- Schwarzschild shadow critical impact parameter: measured **5.1962** vs 3√3 = 5.1962. At the default step size (0.05) it is 5.1962, within 0.5%. It scales with mass (M=2 → 10.39).
- Weak-field bending (b=50M, 200M): 0.44% and 0.04% from 4M/b + 15πM²/4b² (finite-observer tail included).
- A near-critical ray (b = 1.0005 b_c) escapes after **412.7°** of bending with periapsis 3.056 M (photon-sphere skim).
- Starving `maxSteps` (60) is classified as STEPLIMIT, i.e. an integration failure rather than a silent escape.
- Spin approximation vs exact Kerr equatorial shadow edges: χ=0.9 prograde **2.839 vs 2.844**; retrograde 6.378 vs 6.832; χ=0.6 3.987/6.028 vs 3.838/6.316. The frame-dragging term `2(1+3M/r)·v×B_g` was calibrated by a grid search (β=3, γ=1 → RMS 0.20 M). The pure weak-field form (β=0) gave RMS 0.66 M.
- Redshift: face-on emitter at r=6M gives g = **0.707107** = √(1−3M/r) exactly. Doppler = redshift = 0 gives g = 1. The approaching side comes out blueshifted (g 1.195) and the receding side redshifted (0.502).
- Static-observer camera mapping: |x×v| = b to 1e-9. The energy integral is normalized to |v∞| = 1. Angular momentum is conserved along a trace to < 1e-4.
- An opaque disk classifies the ray as "absorbed by disk" and records the hit radius.

## 2. GPU ↔ CPU agreement (real shader, RTX 4090) — **pass**

`scripts/probe-grid.js` runs the GPU probe and the CPU mirror on a 24×16 pixel grid for 10 parameter sets: defaults, χ=0.99, M=3, horizon ×2.5, horizon ×0.5, r_in=1.0 (inside the horizon), H/r=0.3 + tilt 60°, Doppler 2 / redshift 2 / 30000 K, Doppler 0 / redshift 0 / 1500 K, step 0.3 / maxSteps 16.
Result: **0 non-finite values, 0 fate mismatches out of 3,840 rays, max step-count difference 0.0%.** The last set yields 52 STEPLIMIT rays, as expected.
Sample click-selected ray: GPU 152 / CPU 152 steps, r_min 3.7995 / 3.7995, bending 144.319° / 144.32°, g 0.5662 / 0.5662, transmittance 0.1439 / 0.1439.

## 3. Main workflow with real input (GPU session, 1280×800) — **pass**

| Check | Steps | Observed |
|---|---|---|
| First render | `open http://127.0.0.1:8765/index.html` | Shaders ok, 60 fps (vsync), 1280×800 internal, avg 70 steps/pixel. Classic Gargantua view: far side of the disk lensed over the shadow, secondary image below, thin photon ring, left (approaching) side brighter. `screenshots/04-tuned-gargantua.png` |
| Orbit (drag) | `mouse down` at (380,420) → moves to (580,400) → `up` | yaw −8° → −58°, pitch 6.5° → 1.5°. Background, Einstein ring and disk geometry re-traced (the Milky-Way Einstein ring vanishes as the bulge leaves the line of sight). `08a/08b/08c` |
| Vertical orbit | drag up 110 px | pitch 1.5° → −26°. View from below the disk; the near disk moves to the top, the lensed far side wraps under the shadow. `08c` |
| Zoom | `mouse wheel 240` ×3, then −240 ×6 | dist 30 → 71.18 → 12.64 (clamped ≥ horizon-safe minimum) |
| Pan | right-drag | target (0,0,0) → (−1.18,−0.30,−0.13); double-click re-centres to 0 |
| Keyboard | Space, 3, m, m, Shift+M, ←, ↑, o, r | pause toggles; preset 3 applied; modes cycle forward/back; arrows orbit 6°; auto-orbit advanced yaw ≈6°/s; R resets the camera |
| Accumulation / idle | pause, wait 5 s | `accum 256`, `idle true`: rendering stops once converged while paused; resumes on any change |
| Presets 1–6 | buttons and keys | All compose correctly (`06-preset-*.png`). Face-on and Photon-ring were recomposed after review: the first Photon-ring framing was a blown-out disk close-up. |
| Cinematic tour | key C | cycles presets every 9 s with slow yaw drift; C (or any interaction) stops it. `24a/24b` |
| Time controls | pause button, time slider (keyboard), Step +1 t_g | time 117 → 127 via slider, → 128 via step; button label and `aria-pressed` stay in sync |
| Panel controls | `select #c-mode`, overlay checkboxes, FOV/time-rate sliders via ArrowRight/Left, quality select, Reset all | every control changed state; quality presets apply bundled settings; editing step/max-steps flips quality to "Custom" |

## 4. Ray selection and trajectory diagnostics — **pass**

A click (`mouse down/up` without movement) on the canvas selects the ray through that pixel. The panel shows the pixel, fate, steps (CPU and GPU), impact parameter (and its ratio to b_crit), periapsis, total bending, disk crossings with the first hit (r, φ, image order), dominant emitter (g, δ, T_obs), transmittance, escape direction with the asymptotic tail correction, and a per-step disk-slab table (r, φ, z/H, g, T_obs, Δτ, T after). A header badge shows `✓ GPU≡CPU` when the GPU probe matches.
- The orbital-plane diagram (asinh radial scale) shows the camera, path colored by step, photon sphere, ISCO, horizon, the disk ∩ plane trace, disk-sample dots, periapsis and escape arrow. `10d-ray-disk-upper-arc.png`
- The projected 3-D path overlay starts at the clicked pixel. `09`, `10*`
- Tested fates: near-critical (escaped, 150 steps, bend 141°), shadow (captured, 55°), sky (escaped, 20.8°), receding disk (absorbed, 31 steps), upper lensed arc (escaped through disk, T=0.010). GPU = CPU in all cases.
- **Failures found and fixed:** (a) the diagram canvas was blank because the panel was un-hidden after drawing; fixed by un-hiding first. (b) A ray absorbed above the midplane recorded no "disk hit" even though the pixel is disk; the hit is now the first of {midplane crossing in the annulus, 50% absorption}, in both GLSL and JS. (c) One click landed on the ray panel itself (correct app behavior; harness error, kept as `10x-misclick-landed-on-ray-panel.png`).

## 5. Visualization modes — **pass**

All 7 diagnostic modes render data taken from the integration, not decorative colors (`07-mode-1..7.png`), each with a legend.
- Step count: sqrt scale. The first version used a linear 0…max scale that washed out; fixed.
- Deflection: log of accumulated turning angle; the photon ring shows as >180°.
- Redshift g: blue left / red right, including on the lensed far-side image.
- Doppler δ: kinematic only.
- Disk-hit coordinates: hue = φ, 1 r_g radius bands, dim = higher-order image.
- Periapsis r_min: photon-sphere and ISCO contours.
- Fate: escaped / captured / absorbed / step-limit / NaN, shaded by crossing count.

Stress: with max steps 45 the fate map turns magenta (step limit) everywhere except the early-absorbed disk (`15a`). Step size 0.3 shows integration banding; 0.01 is smooth at 349 avg steps and still 60 fps (`15b/15c`).

## 6. Overlays — **pass (after fixes)**

Lensed event-horizon grid, lensed photon-sphere grid plus photon ring (bending > 180°), lensed disk-plane grid (2 r_g rings, 30° spokes; r_in/ISCO/r_out highlighted), lensed celestial grid, and 2-D unlensed geometric outlines of r₊ and r_ph for comparison (`05`, `11`, `12`, `13a`, `13b`).
**Failures found and fixed:** world-width grid lines became thick bands where lensing magnifies them, and the horizon grid produced moiré near the shadow edge. Line widths now come from `fwidth()` evaluated after the loop in uniform control flow, with LOD fade-out when lines crowd below ~4 px.

## 7. Viewports, resize, high-DPI, mobile — **pass**

- Resize 1600×900 → 1024×768 → 800×600 → 700×1000 → 1280×800. Canvas and internal resolution follow exactly, no horizontal overflow, the optical centre shifts to stay clear of the side panel (cx −0.21…−0.43) and returns to 0 in bottom-sheet layout. No GL errors. `20-resize-1024x768.png`
- iPhone 14 emulation (390×844, DPR 3): renders 780×1688 internal with the DPR capped at 2, at 60 fps. "Controls" opens a bottom sheet (`aria-expanded` toggles); `scrollWidth` 390; `tap #gl` (touch) selected the center ray (captured, 56/56 steps, b = 0.019). `14a/14b/14c`
- **Failure found and fixed:** in portrait the vertical FOV cropped the disk. FOV now applies to the shorter screen axis.
- Two-finger pinch/pan: **pass, but only via synthetic PointerEvents** dispatched in-page (`scripts/pinch-synthetic.js`): dist 30 → 15 for a 100 → 200 px spread, target panned, no accidental selection. A real OS-level multi-touch gesture was **not-run** (agent-browser has no multi-touch primitive).

## 8. Performance and adaptive quality — **pass**

- RTX 4090: High and Ultra (1280×800, up to 116 avg steps) hold 60 fps (vsync-limited, so true headroom was not measured). Low/Medium/High/Ultra apply scale / DPR cap / step / max-steps / disk samples / noise octaves.
- SwiftShader (CPU): at High the adaptive controller drops to its floor (2.9 fps, 384×240); the Low preset gives 13.6 fps at a 256×160 floor. The image stays recognizable and ray selection still matches GPU≡CPU. `23-swiftshader-low-adaptive.png`
- **Failures found and fixed:** (a) The adaptive controller downscaled after transient stalls (screenshots, tab switches); added 2-window hysteresis, visibility reset and a startup warm-up. (b) Hitch detection used the *clamped* frame time, so it could never fire, and a naive fix would have stopped slow devices adapting. It now treats a frame as a hitch only if it is > 200 ms **and** > 4× the window average.

## 9. Error handling, runtime hygiene, file:// — **pass**

| Check | Command | Observed |
|---|---|---|
| Shader compile failure | `?simulate=shadererror` (injects a real syntax error) | Card "Shader compilation failed" with the driver log `ERROR: 0:362: 'vec3' : syntax error` plus numbered source context. Panel hidden; `shaderStatus: compile-error`. `16-error-shadererror.png` |
| No WebGL2 | `?simulate=nowebgl2` | Card "WebGL2 is not available" with remediation steps. `16-error-nowebgl2.png` |
| Recovery | click "Retry in safe mode" | navigates to `?safe=1`, runs at Low quality 640×400 |
| No float render targets | `?simulate=nofloat` | 8-bit fallback, CPU-only ray inspection, HUD warns. **Failure found and fixed:** the linear ÷16 encoding posterized the sky; replaced with the invertible perceptual encoding √(c/(1+c)), and bloom is disabled in this mode. `16-fallback-nofloat-8bit.png` |
| Context loss / restore | `?simulate=contextloss` (WEBGL_lose_context) | Toast and HUD "GPU context lost — rendering suspended"; restored automatically about 2.5 s later, 60 fps. `17a/17b` |
| Direct file | `open file://…/index.html` | protocol `file:`, shaders ok, 60 fps, HDR, GPU probe works, click-select matches (31/31). Only request: the document. `18-file-protocol.png` |
| External network blocked | fresh incognito session with `--proxy-server=http://127.0.0.1:9` (loopback bypasses the proxy); `https://example.com` → `ERR_PROXY_CONNECTION_FAILED` | App loads and renders at 60 fps. Requests: `index.html` 200, plus Chrome's automatic `/favicon.ico` 404. Fixed afterwards with an inline `data:,` favicon (re-verified in §10). Console empty, no page errors. `19-offline-external-blocked.png` |

## 10. Independent code review → fixes → regression

A separate read-only reviewer agent audited `index.html`. It found **no divergence between the GLSL integrator and the JS mirror**, and no GLSL UB, derivative or feedback-loop issues. It reported these JS state defects, each confirmed by reading the code and then fixed:

| # | Defect | Fix | Verified by |
|---|---|---|---|
| A | Recreated render targets were blended at 50% against black history while time runs (dimming after every adaptive, quality or resize step) | `forceReset` flag set by `resize()` / `setParam` / context restore | `scripts/review-regression.js`: accum 47 → 1 after a `renderScale` change while running — **pass** |
| B | Mode switch while running blended 72% of the previous HDR frame (ghost) | same flag | accum 89 → 1 after switching mode — **pass** |
| C | Adaptive upscale needed fps > 1.12×target, unreachable at 60 on 60 Hz | upscale when fps ≥ 0.97×target, with a 5 s cool-down after downscales | real load: ultra + step 0.01 dropped scale to 0.73; after lightening it (target 60) it was back at 1.00 — **pass** |
| D | No idle at time rate 0 (not paused) | idle uses `!timeRunning` | `idle true, accum 256` at rate 0 — **pass** |
| E | Space on a `<summary>` paused the sim and blocked the section toggle | SUMMARY treated like BUTTON | real `focus` + `press Space`: section opened, still running — **pass** |
| F | `pointercancel` could select a ray | excluded | synthetic cancel → no selection — **pass** |
| G | Legend re-appeared while the UI was hidden (H) | `uiHidden` flag. My first attempt still failed because a later `remove('hidden')` undid it; fixed and re-run. | **pass** (after one failed run) |
| H | Step-count legend stale after a quality preset | `updateLegend()` in the preset branch | legend shows 1200 after Ultra — **pass** |
| I | Top-row pixel mapped to row `ih` (off-image) | clamped row mapping | `selectAt(0.5, 0)` → py 799.5 of 800 — **pass** |
| J | Possible context-loss loop after a GPU watchdog reset | a second restore forces Low quality | code path only (a real TDR was **not-run**) |
| K | Safe-mode Reset-all re-enabled bloom; per-frame disk jitter flickered with accumulation off | keep `bloom=0` in safe mode; frame seed 0 when not accumulating | code review + visual |
| — | NaN hardening: history is never blended when `uHistW = 0` | `uHistW > 0 ? mix : cur` | shader compiles; probe grid 0 non-finite |

## 11. Final regression on the delivered file — **pass**

Run after all fixes, in a fresh incognito headed GPU session with external network blocked (`--proxy-server=http://127.0.0.1:9`; `https://example.com` → `ERR_PROXY_CONNECTION_FAILED`):
- `node evidence/scripts/physics-test.mjs` → **23 passed, 0 failed**.
- Load → 60 fps at 1280×800 (`30-final-default-view.png`). Real orbit drag (yaw → −43°), then a real click-select: escaped, CPU 139 / GPU 139 steps, bending 113.32° / 113.32° (`31-final-orbit-and-ray.png`).
- `scripts/probe-grid.js`: 10 parameter sets × 384 rays gives **0 GPU≠CPU fates, 0 non-finite, 0.0% step difference**.
- `gl.getError()` = 0. Console empty. No page errors. **Network: exactly one request, `GET /index.html 200`** (the favicon 404 is gone).
- One transient reading of 16 fps turned out to be two headed GPU browsers competing. With the other session closed: 60.0 fps, 16.7 ms, 1280×800, adaptive 1.00.
- `file://…/index.html` → protocol `file:`, HDR, GPU probe OK, 60 fps, click-select 161/161, `gl.getError()` 0.
- iPhone 14 emulation → 780×1688 internal at 60 fps, `scrollWidth` 390, touch tap selects (captured, 56/56). `32-final-mobile.png`

## Known limitations (honest account)

- **Spin is an approximation**, not a Kerr geodesic integrator: Schwarzschild null geodesics plus a calibrated gravitomagnetic force. Equatorial shadow edges match Kerr to ~0.2 M (prograde) and ~0.45 M (retrograde at χ=0.9). At near-extremal spin (χ≳0.95) the retrograde shadow edge shows a small cusp exactly in the equatorial plane (`21-spin-0.99-shadow.png`). It is hidden behind the disk in normal renders and only visible with a transparent disk plus overlays. A uniform-axis variant was tried and did not remove it.
- The photon-sphere overlay uses the Schwarzschild radius 3M; the readout lists the Kerr prograde/retrograde photon-orbit radii.
- Disk emission is a Novikov–Thorne *temperature* profile with blackbody chroma and I ∝ (T_obs/T_peak)⁴, i.e. bolometric beaming g⁴. There is no spectral integration or radiative-transfer scattering. Inside the ISCO the circular-orbit redshift model is extrapolated (g clamped ≤ 4), and the UI warns when the inner edge is set inside the ISCO.
- "Event-horizon size" ≠ 1 is deliberately non-physical (labelled as such).
- Temporal accumulation resets on camera motion (no reprojection), so moving shots are un-accumulated and slightly aliased; static shots converge to 256 frames.
- True 60 fps headroom on the 4090 was not measured (vsync cap). No mid-range discrete or integrated GPU was available; the slow end was tested only with SwiftShader.
- Audio: none in this app (not required).
