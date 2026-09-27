# Validation report: Real-Time 2D Fluid Simulation (`index.html`)

Author: Claude (agent run, 2026-09-27). Everything below was observed in a real Chromium browser
driven by the `agent-browser` CLI. Numbers are copied from the logs in `evidence/logs/`, and every
screenshot mentioned lives in `evidence/screenshots/`.

## 1. Environment and tool availability

| Item | Value |
|---|---|
| Browser automation | **agent-browser 0.31.1** (installed skill). Before use I read `agent-browser skills get core --full` (version-matched core workflow + command reference) and `agent-browser skills get dogfood` (exploratory-testing workflow). |
| Browser | HeadlessChrome/152.0.0.0 (Linux x86_64), launched by agent-browser |
| WebGL implementation | `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)`. This is a **CPU software rasteriser**. The WSL2 host exposes no GPU to headless Chrome. |
| Host | Linux 6.6.87.2-microsoft-standard-WSL2, 32 cores, Node v25.8.1, uv 0.9.15 |
| Touch input | agent-browser has no generic touch command for local Chromium (its `tap`/`swipe` are iOS-provider only). I dispatched real touch events through CDP `Input.dispatchTouchEvent` on agent-browser's own browser (`evidence/scripts/touch-drag.mjs`). |
| Pixel analysis | `evidence/scripts/pixels.py` (Pillow, run through `uv run --with pillow`) measures region colour, hue, frame differences and lit fraction on the screenshots. |

No substitute browser tool was needed. All checks used agent-browser, plus CDP touch dispatch through its CDP endpoint.

## 2. How to reproduce

```bash
cd <working dir>                          # contains index.html and evidence/
evidence/scripts/run-validation.sh         # all checks v01..v23 (≈25 min under SwiftShader)
evidence/scripts/run-validation.sh v04 v09 # any subset
```

The suite (`evidence/scripts/run-validation.sh`) uses real input only:

- Clicks go through `agent-browser find role button|radio click --name "<accessible name>"`.
- Sliders are driven with the Home/End/Arrow keys on the focused `<input type=range>`.
- `agent-browser select` handles the resolution `<select>`s.
- Pointer drags are CDP mouse `move/down/up` batches built by `drag.py`.
- Keyboard shortcuts go through `agent-browser press`.

`window.fluidDebug.snapshot()` is a read-only observer. It returns the live state plus GPU stats that are read back from the simulation textures every 250 ms (dye amount, mean/max speed, pre/post-projection divergence, max |p|, max |ω|). The tests only read it and never drive the app through it.

Checks:

- **V01:** direct `file://` load, which is the delivery mode.
- **V02:** a local HTTP server (`uv run python -m http.server 8765 --bind 127.0.0.1`) with the browser routed through a dead proxy (`--proxy http://127.0.0.1:9`). All external traffic fails; loopback is reachable.

The accessibility tree of the controls is in `logs/a11y-snapshot.txt`. Every control has a role and a label.

## 3. Results

Legend: **pass** = observed working in the browser; **blocked** = could not be exercised here; **not run** = not attempted.

| ID | Check | Result | Key observations (log) |
|---|---|---|---|
| V01 | Direct `file://` load, console, network | **pass** | Title "Fluid · Real-time 2D Navier–Stokes". WebGL2, fp16 fields plus fp32 pressure. Page errors `[]`, console `[]`. The only requests are the file itself and an inline `data:` SVG (`final-regression.log`, `final-smoke-v01.log`). The final smoke session relaunched at a default 1280×577 viewport, which doesn't affect this check. |
| V02 | Local HTTP, external network blocked | **pass** | The app runs over `http://127.0.0.1:8765` (simTime 1.68, dye 0.24). Requests: the document plus the inline `data:` SVG only. In the same session, navigating to `https://example.com` fails with `net::ERR_PROXY_CONNECTION_FAILED`, which proves external access was blocked (`v02.log`). The page also ships a CSP of `default-src 'none'`. |
| V03 | Interesting motion with no configuration | **pass** | The intro jets run immediately. At t=1.4 s: dye 0.19, mean speed 0.18. At t=4.4 s: dye 0.23, speed 0.13, divergence residual 2.2% (`v03-intro-t1/t4.png`). |
| V04 | Slow and rapid drags: direction, speed, persistence, advection | **pass** | Slow **eastward** drag (≈0.25 u/s): the Velocity view under the stroke has **hue 177–178°** (cyan = east) and peak fluid speed is 0.42–0.51. Rapid **westward** drag: **hue 356°** (red = west) and **peak speed 1.80–1.90**. Two seconds after release the flow persists (mean 0.010, max 0.21), and dye downstream of the stroke end grows (lit fraction 0.22 → 0.68, advected by the vortex dipole). |
| V05 | Continuous rapid circular stroke (input continuity) | **pass** | Drawn while **paused**, so advection cannot move the dye. All **12/12** samples around the ring are lit (brightness 0.68–0.92), so there are no gaps. After Resume it rolls into a swirl (max ω 49/s) (`v05-*.png`). |
| V06 | Switch all 6 views while running | **pass** | Velocity, Speed, Pressure, Divergence, Vorticity and Dye were each selected by radio click. simTime rose 2.55 → 10.08 and steps 77 → 303 throughout, so there was no restart. The legend title and HUD view label update. Keys 1–6 map to the correct modes. |
| V07 | Viscosity low vs high (same intro, same sim time) | **pass** | At t=3.67 s, ν=0 gives max ω **37.3**, mean speed 0.150 and max speed 0.545. ν=5e-3 gives max ω **8.8**, mean speed 0.086 and max speed 0.244. The dye goes from turbulent to smooth laminar spirals (`v07-v08-ab-montage.png`). |
| V08 | Vorticity confinement off vs max | **pass** | At t=3.67 s, ε=0 gives max ω **10.0** and mean speed 0.140. ε=40 gives max ω **176.2** and mean speed 0.204. Visually: smooth large spirals versus finely shredded turbulence. |
| V09 | Clear dye keeps the velocity field | **pass** | Before: dye 0.232, speed 0.140. After "Clear dye": **dye 0** (0.0% lit pixels) while **speed is 0.115**, then 0.077 at +1.5 s (normal dissipation, no reset). Dye injected afterwards is carried by the retained flow. |
| V10 | Pause / step / resume | **pass** | Paused: steps stay 59 and simTime 1.95 over 1.5 s, and the frame pixel difference is **0.000**. The HUD shows "PAUSED", the badge is visible and the button label becomes "Resume". Mode switching still renders while paused. Step → 60, "." → 61, Resume → steps continue, Space toggles. |
| V11 | Reset restores a valid initial state | **pass** | simTime 3.88 → 0.067 right after Reset. The five intro jets are re-armed. At t=2.4 s: dye 0.275, speed 0.19, residual 1.4%, all stats finite. |
| V12 | Sim grid / dye grid selects | **pass** | Sim grid 64/128/512/256 → 102×64, 205×128, 819×512, 410×256. Dye grid 512/2048/1024 → 819×512, 3277×2048, 1638×1024. The state is resampled rather than reset (dye mass declines smoothly), with no errors. |
| V13 | Time scale | **pass** | 0.1× advanced 0.14 s of sim time in ~2 s wall; 3× advanced 3.2 s. At about 9 fps under SwiftShader, dt is capped at 1/15 s per frame, so the ratio is not exact wall-clock. |
| V14 | Pressure solver and iterations → incompressibility | **pass** | HUD residual \|∇·u\| after projection: Jacobi ×1 **100.6%**, Jacobi ×150 **56.2%**, Multigrid 1 V-cycle **4.7%**, Multigrid 8 V-cycles **1.9%** (1.7e-3 /s absolute) (`final-regression.log`). |
| V15 | Velocity and dye dissipation | **pass** | Velocity dissipation at max: speed 0.196 → **0.005** in 2.5 s while dye stays at 0.24. Dye dissipation at max: dye 0.238 → **0.005** while flow continues (0.051 → 0.038). |
| V16 | Force and radius | **pass** | Force 0: dye is injected (0.039) but max speed stays at 0.07. Force 5: max speed **1.18**. Radius max vs min: the cursor ring is 192 px vs 8 px, and the stroke's lit fraction is 0.555 vs 0.007. |
| V17 | Dye colour controls | **pass** | Swatch `#ffe04a` gives stroke hue **51°** (target 51°). `#2fd6ff` gives **194°** (target 191°). Random and Rainbow modes select and paint (`v17-*.png`). |
| V18 | Keyboard shortcuts | **pass** | S splashes (dye 0.28). C clears (dye **0**, speed still 0.18). H toggles the panel. R resets. Space, "." and 1–6 are covered in V06/V10. |
| V19 | Viewports 1280×800, 390×844, live resize, DPR | **pass** | 1280×800 gives a 1280×800 canvas, sim 410×256 and dye 1638×1024. Live resize: 1600×900 → sim 455×256; 900×700 → 329×256; DPR 2 → 2560×1600 canvas. Dye mass carries across each resize. 390×844@3: DPR capped to 2 (780×1688 canvas), sim 160×346, panel starts collapsed as a bottom bar, the "Controls" sheet opens, **no horizontal overflow**, and Pause works. |
| V20 | Touch input (CDP touch events, 390×844) | **pass** | One-finger upward swipe: HUD reads "1× 0.12 u/s 90°" (90° = up) with the ring active, and peak speed **0.008 → 0.314**, dye 0 → 0.099. Two fingers: HUD reads "2× …", `pointers: 2`, dye 0.093 → 0.214. All pointers are released on touchend (`v20-v22-rerun.log`). |
| V21 | WebGL context loss and restore | **pass** | During the loss, frames stop and the toast shows "GPU context lost…". After `restoreContext()` the sim is rebuilt and running (dye 0.163, max speed 1.26), with no fatal card and no errors. |
| V22 | Capability fallbacks | **pass** | WebGL2 hidden: runs on **WebGL1 fp16**, residual 3.9%. WebGL2 and `*_linear` extensions hidden: runs with **manual bilinear filtering** ("WebGL1 fp16 (manual filter)"), residual 4.3%. All WebGL hidden: a clear fatal card, "WebGL floating-point rendering is unavailable", with per-API reasons. |
| V23 | Frame-rate probe (60 rAF deltas) | **pass (software-only)** | SwiftShader CPU rasteriser at 1280×800: sim 256 / dye 1024 median **7.5 fps** (133 ms; p95 150 ms). 128/512: 15 fps. 64/256: 20 fps. These are **not** GPU numbers (see §5). |

All checks, including the reruns after fixes, finished with page errors `[]` and console `[]`.

## 4. Failures found during development, their fixes, and retests

These were found by exercising the real app and reading its own diagnostics. Each fix was followed by a rerun of the failing flow plus a compact regression.

1. **Pressure projection far from incompressible (solver design).**
   - **Symptom:** the first build's HUD residual (post- ÷ pre-projection mean |∇·u|) read **62–64%** (`dev-history/01-first-load-file.png`).
   - **Experiment** (`dev-experiments/iters.js`: paused, splash, one step): Jacobi at 25/50/80 iterations gave 74.6/76.9/63.3%. More iterations barely helped, which is the classic slow low-frequency convergence of Jacobi.
   - **Step 1, geometric multigrid V-cycle:** with ε=0 it reached ~7%, but with ε=22 the residual *climbed* to 41% within six steps (`exp2.js`). Root cause: the collocated grid. Central-difference D and G can't see checkerboard modes, and vorticity confinement pumps energy into exactly those.
   - **Step 2, staggered MAC grid** (u on x-faces, v on y-faces, implemented as half-texel-offset fetches): now D∘G equals the compact Laplacian exactly. Residual 4.7% (ε=0) and 6–8% (ε=22). V-cycle sweep (`exp3.js`) bottomed out at 2.5%, with ~30% on the first step after a sharp splash.
   - **Step 3, fp32 pressure (R32F when renderable):** fp16 second differences had been the floor. Now 2 V-cycles give ~1%, 4 give ~0%, and the live intro 0.36%.
   - Retests V03, V11, V14 and V22 above.
2. **Grid-scale noise from vorticity confinement.** At ε=22 the Vorticity and Divergence views were salt-and-pepper noise across the empty background. Confinement acts like negative diffusion on noise (growth rate ~ε /s), so it was amplifying fp16 rounding noise. A/B at ε = 22/10/4 is in `dev-history/montage-eps.png`. **Fix:** the default is now ε=6 and confinement is gated off for |ω| < ~1 /s (`smoothstep(0.5, 2.0, |ω|)`). **Retest:** the background vorticity stays black (`dev-history/montage-intro.png`), and V08 still shows a strong ε effect.
3. **Blank simulation after WebGL context restore.**
   - **Reproduced:** after `restoreContext()` the loop ran at 60 fps with every field at 0.
   - **Root cause verified:** an RGBA16F FBO reported `INCOMPLETE_ATTACHMENT (0x8cd6)` until `EXT_color_buffer_float` was requested again, because extensions die with the context.
   - **Fix:** re-run capability detection in `webglcontextrestored`. **Retest:** V21 passes.
4. **Jacobi mode made divergence worse** (V14 first run: 471% at 1 iteration, 186% at 150).
   - **Cause:** plain Jacobi (ω=1) has amplification −1 for the checkerboard mode, so that mode is never removed.
   - **A/B** (`dev-experiments/jac.js`): ω=1 gave 380/113/28% at 1/40/150 iterations; ω=0.8 gave 101/58/25%.
   - **Fix:** damped Jacobi with ω=0.8. **Retest:** V14 passes.
5. **Clear dye during the intro was re-inked by the intro jets** (V18 first run: dye 0.024 after C). **Fix:** Clear dye also ends the intro jets; velocity is untouched. **Retest:** V18 gives dye 0 and speed 0.18; V09 still passes.
6. **Code-review fixes, found by re-reading the code rather than seen in the browser, then regression-tested:**
   - **Pointer velocity:** it was estimated per coalesced event with a 1 ms floor, so bursts with near-identical timestamps could spike it. It's now estimated over windows of at least 8 ms. V04 and V20 were retested.
   - **Legend:** `aria-live` removed, because it would announce the 4 Hz scale updates.
   - **Boot:** `updateHud()` was moved inside boot's try/catch so a boot-time exception shows the error card instead of a dead page. This surfaced through a harness bug, see 7e.
   - **Mobile:** the touch hint no longer lists keyboard shortcuts, and the bottom-sheet chevron now points the right way.
7. **Test-harness defects (my scripts, not the app), recorded for transparency:**
   - a) `pkill -f "http.server 8765"` matched and killed the invoking shell. Replaced with a kill by listening socket (`ss`).
   - b) I edited `run-validation.sh` while bash was executing it, which caused a spurious syntax error after V11. All checks had already completed, and later runs were clean.
   - c) V05's first design sampled the ring after ~3 s of live flow, so advection had moved the dye and the samples read as "gaps". The check was redesigned to draw while paused.
   - d) V20's first two runs could not reach the sliders or the Defaults button inside the collapsed or scrolled mobile panel. The panel is now opened and the button scrolled into view.
   - e) My manual-filtering init script patched `getContext('2d')` too, which crashed the HUD sparkline in the test only. Fixed by patching WebGL contexts only.

## 5. Blocked, not run, and limitations

- **Real-GPU performance: blocked.** This environment only provides SwiftShader, which is CPU rendering, so the 7.5–20 fps above says nothing about GPU frame rates. On a real GPU the default workload is about 20 full-grid passes per step at 410×256, plus dye transport at 1638×1024. I expect it to be comfortable, but I did **not** verify that. Users on weak GPUs can lower the sim and dye grids (V12/V23 show the knobs work). There is no automatic quality scaling.
- **Physical touch hardware: not run.** Touch was exercised through Chromium's real touch-event pipeline via CDP `Input.dispatchTouchEvent` in an emulated viewport, not on a device. Pointer Events with `touch-action: none`, pointer capture and multi-pointer tracking are implemented.
- **Other browsers (Firefox, Safari): not run.** They're not available here. The code uses only standard WebGL1/2 APIs, with the fallbacks from V22.
- **Physical HiDPI display: not run.** DPR 2 and 3 were emulated. The backing store is capped at DPR 2 by design.
- **Long soak (tens of minutes on one page): not run.** The longest continuous page lifetimes in the suite were a few minutes.
- **Full keyboard-only navigation (Tab order through every control): not run.** Shortcuts and slider keys were exercised; Tab traversal was not audited.
- **Audio:** not applicable (the app has no audio).
- **Known numerical limitations:**
  - Velocity and dye are stored in fp16, which sets a small absolute divergence floor (≈1e-3–5e-2 /s). The relative residual therefore reads higher in very smooth, viscous flows, which is why the HUD shows both the absolute value and the percentage.
  - WebGL1 has no fp32 pressure path, so its residual is ≈4%.
  - Vorticity confinement is a heuristic, and it is deliberately gated at low |ω|.
  - Near walls, the staggered-velocity reconstruction uses clamp-to-edge sampling, a first-order boundary approximation.
- The ~9 fps under SwiftShader means the interaction tests ran at low frame rates. Stroke continuity still held (V05) because each frame splats a capsule along the whole pointer segment, but high-frame-rate "feel" could not be judged here.
