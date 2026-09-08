# Validation record — Black Hole & Gravitational Lensing Explorer

Date: 2026-09-08. Host: Linux, RTX 4090 (but see “Environment” — nothing here rendered on the GPU).
Target: single-file `index.html`, opened over `http://127.0.0.1:8931/` (localhost server, no CDN, no
`node_modules`, no external requests).

## Environment — read this before trusting any number below

* Chrome ran **headless with SwiftShader** (`ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)),
  SwiftShader driver)`). That is a CPU rasteriser, not the 4090. WebGL2 + `EXT_color_buffer_float`
  were available, so the HDR code path is the one that ran.
* **Headless rAF is throttled to roughly 3.3 Hz with an empty page.** Measured by running a bare
  `requestAnimationFrame` counter that draws nothing: 10 ticks in 3 s. The app’s HUD reported ~2 fps in
  the same window. **None of the fps figures in this file are hardware-GPU performance numbers**, and
  no claim about real-GPU framerate is made anywhere. Adaptive resolution keys on measured GPU time,
  not on this throttled cadence.
* Consequence for the defaults: the software preset (40 % internal resolution, 90–120 steps, one bloom
  level) exists because the *only* renderer available here is a software one. On a real GPU the default
  is the Balanced preset; that path was exercised but never measured on real hardware.

## Method

Two independent implementations of the same physics, checked against each other and against analytics:

1. `dev/geodesic.mjs` — a Node module holding the same null-geodesic integrator as the shader.
2. The GLSL `tracePath()` inside `index.html`, run for real on the GPU.

`node dev/geodesic.test.mjs` runs 24 checks. Final run in this session: **ALL 24 CHECKS PASSED**.
Highlights: agreement with an independent fixed-step reference to 0.00 %; the weak-field deflection
matches the 2nd-order post-Newtonian expansion to 1.75 % at a 80 Rs impact parameter; capture threshold
lands on `b_c ≈ 2.598 Rs` (`3√3/2`); photon-sphere behaviour at `r = 1.5 Rs`; multi-plane imaging is
real (7.2 % of pixels double-imaged at a 64² probe, 3+ images appearing at 192²); spin produces an
asymmetric deflection pattern; mean ~38 steps per ray.

Browser work was done with the `agent-browser` CLI (session `bh`), driving the real page: pointer
drags, wheel, clicks on the canvas, key presses, and direct reads of renderer state through a small
`window.__bh` test surface. Console and page-error logs were checked; network requests were listed to
prove the file is self-contained.

## What was verified working in the browser

| Item | Result | Evidence |
|---|---|---|
| Page loads, no console errors, no page errors | pass | `errors`/`console` both empty on the first load |
| Zero external requests | pass | `network requests` listed only `GET /index.html` (5 document loads, all same-origin) |
| Lensing is geometric, not a decal | pass | `final-desktop.png`: shadow, primary Einstein ring, secondary photon ring, far side of the disc imaged *below* the shadow |
| Multi-plane imaging visible | pass | same frame — the underside of the disc appears as a second arc around the shadow |
| Drag-to-orbit | pass | drag moved azimuth 0.78 → −0.02 and elevation 22.9° → 6.9° |
| Wheel zoom | pass | distance 21.0 → 19.29 Rs from one wheel gesture |
| Click-to-probe a ray | pass | clicking the view filled the inspector with a real trace: `pixel 256,160 · 16/120 steps · b = 0.022 (capture below 2.60) · closest approach 0.940 Rs · endpoint inside r = 1.00` |
| Numeric keys 1–7 switch visualisation modes | pass | key `3` → mode index 2 (redshift/Doppler factor), HUD label updated |
| Space pauses / resumes | pass | `paused` flipped true and back |
| Camera presets | pass | clicking *Einstein ring* moved the camera and raised a toast naming the preset |
| Hide-UI key | **fixed during the session, then pass** | see defect 4 |
| Internal render size tracks the window | pass | 1280×800 window → 512×320 internal; 390×844 window → 156×338 internal |
| Mobile portrait renders | pass | 390×844, 9 fps reported, 42.9 mean steps/ray, 159 of 1024 probe rays captured |

## Defects found and fixed during the session

1. **The whole scene rendered black.** `FS_SCENE` multiplied its output by `uExposure`, but that
   uniform was only ever set on the composite program, so it defaulted to 0 and every pixel was
   multiplied to nothing. Diagnosed by reading back the render target (all zeros, then a debug clear
   colour proved every fragment *was* being shaded — so it was an arithmetic bug, not a coverage bug),
   then removed the duplicate exposure stage. This is the single change that made anything appear.
2. **Doppler beaming was unbounded.** The shift factor was clamped to 9 and then raised to the 2.6
   power, so a near-edge-on camera saturated the entire frame to white. Clamped the shift factor to
   0.22–2.6, clamped colour temperature to 1500–16500 K, and lowered the emissivity scale.
3. **The default camera sat inside the disc** (13.2 Rs with the disc reaching 11 Rs at 8.6° elevation),
   which read as fog rather than a disc. Default moved out to 21 Rs at 22.9°, disc range and thickness
   retuned so the rings, shadow and both disc images read as separate features.
4. **Hide-UI selected a class that does not exist** (`.panel`) while the panel is an id. Fixed to hide
   panel, HUD, inspector, diagram and title together; re-tested, opacity goes to 0 for all of them.
5. **Click-probe geometry did not match the rendered pixel.** The CPU picker used `fov/100` as the
   half-angle and ignored both the aspect split and the y-flip between GL and CSS coordinates, and it
   also forgot that the internal render target may be smaller than the canvas. Rewritten to mirror the
   shader exactly (tangent half-angle, aspect split, CSS→render mapping). Only spot-checked afterwards.
6. **Mobile overlay collision.** Below 820 px the HUD, the ray inspector and the trajectory diagram were
   all anchored to the same top-left corner and stacked on top of each other. Narrow-screen layout
   reworked: diagram hidden, inspector docked right at 47 % width, HUD compact on the left, title bar
   moved to the bottom.
7. **Probe readback was fragile.** Half-float `readPixels` is not guaranteed everywhere; the probe
   target is now RGBA32F read as `FLOAT`, falls back to RGBA16F/`HALF_FLOAT`, and the HUD says
   “readback unavailable” instead of silently lying about step counts.

## Visual result, honestly described

`final-desktop.png` is the shipped default frame. The lensing is genuinely there — shadow, photon ring,
the near side of the disc, and the far side imaged as a separate arc under the shadow — but the picture
is **soft and disc-dominated**. Two reasons, and neither is a claim that it looks good: the internal
buffer is running at 40 % because this host has only a software rasteriser, and the default disc spans
most of the frame, so the procedural star field (which does render, and is resolution-independent) is
mostly lost behind disc emission. A reviewer comparing against reference images of M87*/Sgr A* ray
traces should expect *correct structure at low sharpness*, not a film-grade still. Raising
Resolution Scale to ~1.0 on a real GPU is the intended way to see the same frame at full detail — that
combination was not observable here.

## Not verified / open

* **No-WebGL2 fallback: not confirmed.** I forced `getContext('webgl2')` to return null by injecting a
  prototype patch before the app script. The app correctly refused to start (no UI built, canvas never
  used), but the explanatory fallback panel did **not** become visible — the page showed a blank dark
  view. Two candidates, neither confirmed: the injected-patch harness is not the same as a genuinely
  WebGL2-less browser, or `fatal()` writes to an element whose default `display:none` is not overridden
  the way the code assumes. Needs re-testing in a real no-WebGL2 profile. Treat as an open gap.
* **One mobile capture is unusable.** The first `final-mobile.png` came out fully white: the tab had
  dropped to `about:blank` (probably a SwiftShader GPU-process reset during the resize) and the
  screenshot recorded the blank page. Re-shot after a clean reload; the second capture is the one to
  trust, and the accompanying numbers (156×338 internal, 42.9 mean steps) were read from that session.
* **Touch input on a real phone was not tested.** Only a resized desktop viewport at 390×844, driven by
  mouse events. Pointer events *should* cover touch, but that is an inference, not an observation.
* **Framerate on real hardware: unknown.** See Environment. Nothing in this file should be quoted as
  “runs at N fps on a GPU”.
* **Temporal accumulation and the 8-sample jitter pattern were not visually validated.** The mechanism
  runs and the HUD reports the accumulation count, but I did not confirm that accumulated frames
  actually converge rather than smear, and I did not check that accumulation resets on *every* parameter
  change as intended.
* The long-exposure/diagnostic modes were switched and observed to change the image; they were not
  reviewed one by one for legibility or colour-range correctness.
* The 20+ parameter panel was exercised through the test surface and a handful of controls, not by
  dragging every slider. Individual slider ranges were therefore not each verified by interaction.
