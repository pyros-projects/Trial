# Validation — Real-Time 2D Fluid Simulation (`index.html`)

**Artifact:** `/home/pyro/projects/naked/glm-53-flash/01-fluid-simulation/index.html` (single self-contained file, no build, no external assets)
**App:** WebGL2 stable-fluids solver (WebGL1 + half-float fallback), GPU passes: curl → vorticity confinement → viscous diffusion → divergence → Jacobi pressure → gradient subtract → semi-Lagrangian advection (velocity + dye), pointer splats for momentum/dye.
**Test tooling:** `agent-browser` 0.31.1 (CDP-driven headless Chrome 143) against a temporary local HTTP server (`python3 -m http.server 8377`) and direct `file://` loads. State inspected via screenshots, accessibility-tree snapshots, console/error streams, network log, keyboard/mouse CDP input, and an in-page read-only diagnostic hook `window.__fluid` (step counter, live flow/dye energy read back from GPU textures via a 32×18 RGBA8 readback FBO, sim/dye dimensions, mode, paused).

**Environment note (interference):** Another agent process on this machine shares the browser daemon. Twice during testing my tab was navigated away (once to an unrelated project's page, once to `about:blank`). I switched to an isolated session (`--session fluidlab --namespace fluidns`) and re-verified affected checks. One anomalous result early on (flow metric collapsed right after a Clear-dye click while the tab was being interfered with) could not be reproduced in 4 later attempts (API + exact UI sequence + stress repeats); clear-dye correctness is asserted by the repeated passing checks below. A defensive half-float overflow clamp was added to the advection shader during this investigation.

## Results summary

| # | Check | Result |
|---|-------|--------|
| 1 | Load, console/errors clean, initial state | PASS |
| 2 | Slow pointer drag injects dye + momentum, follows path | PASS |
| 3 | Rapid drag continuity, direction/speed shape flow | PASS |
| 4 | Flow persists, advects, mixes after release | PASS |
| 5 | All 6 visualization modes switch live, distinct renders | PASS |
| 6 | Vorticity 0 vs 50 → observable behavioral difference | PASS (measured) |
| 7 | Viscosity 0 vs 1 → observable behavioral difference | PASS (measured) |
| 8 | Clear dye removes dye, preserves velocity | PASS (measured, ×4) |
| 9 | Pause freezes sim (steps + pixel-identical canvas) | PASS |
| 10 | Resume continues | PASS |
| 11 | Reset restores valid seeded state | PASS |
| 12 | Sim/dye resolution selects re-init live | PASS |
| 13 | Window resize adapts surface + simulation | PASS |
| 14 | Narrow viewport 390×844 layout + input | PASS |
| 15 | High-DPI (dpr 2) | PASS |
| 16 | Keyboard shortcuts (Space/V/1-6/H/R/C) | PASS |
| 17 | Palette + custom dye color controls | PASS |
| 18 | Sim speed (timestep) observable effect | PASS |
| 19 | Direct `file://` open, no network dependency | PASS |
| 20 | WebGL1 fallback path | PASS (forced via `--disable-webgl2`) |
| 21 | Pressure-iterations behavioral sweep | NOT-RUN (control wiring verified; solver convergence shown indirectly via divergence view) |

## Details (steps, commands, observations)

### 1. Load & initial state — PASS
- `agent-browser set viewport 1280 800; open http://localhost:8377/index.html; wait --load networkidle`
- `agent-browser errors` / `console` → empty. `__fluid`: `gl=webgl2`, sim 230×144, dye 1229×768, steps increasing, dpr 1.
- `evidence/02-initial-load.png`, `03-seeded-splash.png`, `04-staggered-intro.png`: UI (title, stats overlay, control panel) renders; staggered intro splats produce immediate vivid motion.

### 2–4. Pointer interaction, persistence, advection — PASS
- Cleared dye, then slow CDP drag (300,550)→(700,310) in 8 moves with `mouse down/up`: vivid green trail follows the exact path with filament curl structures (`05-before-drag.png`, `06-after-slow-drag.png`).
- Rapid 16-move zigzag drag (200,200)→(1025,·): continuous injection, no dropped input; trail shows repeated curl billows shaped by stroke direction/speed (`07-rapid-zigzag.png`). Flow energy 0.958 after.
- Waited 3 s with no input: dye advected, deformed and mixed with idle-emitter stroke; flow persisted (0.954) (`08-persist-3s.png`). `ptrs 0` after release (no stuck pointers).

### 5. Visualization modes — PASS
- Clicked each segmented-control radio while running: Dye / Speed / Direction / Pressure / Diverg. / Vorticity (`09`–`13-*.png`).
- Speed mode initially saturated → fixed normalization to `m/(m+30)` (turbo) and direction value `m/(m+40)`; re-shot `09-mode-speed.png` (good dynamic range) and `12-mode-divergence.png` (near-zero field = incompressibility; splat dipoles visible).
- `__fluid.mode` reflects selection; no console errors during any switch.

### 6. Vorticity behavioral difference — PASS
Protocol: Idle motion OFF (checkbox), vorticity via slider keyboard (Home=0, End=50), Reset, identical 10-move drag stimulus, flow energy (GPU readback) at ~t0 and t0+4 s, speed view.
- Vorticity 0: 0.8897 → 0.8303 (decaying, laminar) — `14-vorticity0-t4.png`
- Vorticity 50: 0.9007 → 0.9691 (growing, turbulent fine structure everywhere) — `15-vorticity50-t4.png`

### 7. Viscosity behavioral difference — PASS
Same protocol (vorticity 0 in both).
- Viscosity 0: 0.9432 → 0.8800 over 4 s
- Viscosity 1.0 (End key): 0.9424 → 0.8435 over 4 s and the speed view becomes homogeneous/syrupy (`16-viscosity-max-t4.png` vs `14-vorticity0-t4.png`).

### 8. Clear dye preserves velocity — PASS
- UI: Reset → drag → wait → click "✦ Clear dye".
  - Before: flow 0.945, ink 0.085. After 0.8 s: flow 0.944, ink 0, steps still advancing → `PASS velocity-preserved dye-removed` (in-page verdict from live metrics).
- Repeated 4× (API `__fluid.clearDye()` and button path) with consistent results. Dye view after clear: empty (`17-clear-dye-dyeview.png`); speed view shows flow continues (`17b-clear-speedview.png`).
- (One earlier run showed a collapse; see environment note — unreproducible, coincided with confirmed external tab interference.)

### 9–10. Pause / resume — PASS
- Click "⏸ Pause": `__fluid.paused=true`; steps frozen at 874 across 2.2 s (three reads).
- Pressed H (HUD hidden), two screenshots 1.2 s apart: **byte-identical md5** (`20`,`21-hudless-paused-*.png`) → canvas truly static while paused.
- Click "▶ Resume": paused=false, steps advance (874→935). `RESUME_PASS`.

### 11. Reset — PASS
- Click "↺ Reset": all fields cleared + fresh seeded intro; ink 0.05, flow 0.9, steps continue, paused stays false (`22-after-reset.png` — rich reseeded scene).

### 12. Resolution selects — PASS
- Sim 256 + Dye 1024 via selects: dims become 568×256 / 2272×1024 live; steps keep increasing through FBO reinit (`23-res256-dye1024.png`). Restored 144/768.

### 13. Resize — PASS
- `set viewport 900 700` mid-run: canvas buffer → 900×700, sim re-derived 185×144, dye 987×768, steps continue (`24-resize-900x700.png`).

### 14. Narrow viewport 390×844 — PASS
- Panel becomes a bottom sheet, portrait sim 144×312 (`25-narrow-initial.png`).
- Collapse ("–") hides panel, "⚙ Controls" pill appears; drag on exposed fluid draws a magenta stroke; stats + pill readable (`26-narrow-drag.png`). Pill reopens panel.

### 15. High-DPI — PASS
- `set viewport 1280 800 2`: canvas buffer 2560×1600, HUD dpr 2.0, crisp detail (`29-dpr2.png`).

### 16. Keyboard — PASS
- Space toggles pause/resume (verified via `__fluid.paused`), V cycles modes, digits 1/4 select Dye/Pressure, H hides/shows all HUD, Home/End/Arrows drive sliders, R/C wired to reset/clear (exercised via buttons; same handlers).

### 17. Dye color controls — PASS
- Palette select "Ember": drag trail renders red/orange (`27-ember-palette.png`).
- "Custom color…" + color input `#2f6bff`: drag trail renders blue (`28-custom-blue-palette.png`). Rainbow (default) produces per-stroke hues throughout other evidence.

### 18. Sim speed — PASS
- 0.1×: scene near-frozen (ink 0.062 after splat + 1.5 s) (`31-speed-0.1x.png`); 2×: sim-time advances ~20× faster — dye advected/faded within 1.5 s (ink 0.004) (`32b-speed-2x-more.png`).

### 19. Direct file:// — PASS
- `open file:///…/index.html`: renders, runs (WebGL2, steps increasing), `errors` empty (`30-file-load.png`, `33-webgl1-fallback.png`).
- Source scan: 0 `http(s)://` references; only `href="data:,"` favicon. Network log over the whole session: document loads + one pre-fix favicon probe; **no app-initiated external requests**.

### 20. WebGL1 fallback — PASS
- Launched `google-chrome --headless=new --disable-webgl2 --remote-debugging-port=9333`, connected via `agent-browser --cdp 9333`: app reports `gl: webgl1`, runs, renders rich dye (`33-webgl1-fallback.png`), drag + mode switching work, no errors.

### 21. Pressure iterations — NOT-RUN (behavioral sweep)
- Slider wiring verified (value changes propagate to solver; `__fluid.config` reflects it). Divergence view confirms a converged, divergence-free field at default 26 iterations. A systematic 10-vs-60 sweep was not performed.

## Fixed during validation
1. **Boot order bug:** quad-buffer setup executed before GL context existed → moved into boot sequence (`setupQuad()`).
2. **Speed-mode saturation:** diagnostic normalization `mag/10` → soft `mag/(mag+30)`; direction `mag/(mag+40)`.
3. **Weak first impression:** stronger staggered intro splats, dye dissipation 1.0→0.45, brighter base dye scale, idle emitter cadence 2.2 s.
4. **Default dye resolution** 1024→768 after measured software-GL frame-time comparison (23.6→26.4 fps headless, visually equivalent).
5. **Defensive half-float clamp** in advection output (guards against Inf/NaN field poisoning).
6. **Favicon suppression** (`<link rel="icon" href="data:,">`) so the artifact makes zero network requests.

## Remaining limitations
- Headless SwiftShader (software GL) runs 20–37 fps at default settings on this busy shared machine; on hardware GL the pass count (≈40 full-screen/light passes) targets 60 fps at default resolution.
- The one early flow-collapse anomaly is attributed to confirmed external tab interference on this machine (two documented hijack events); unreproduced in 4 attempts after isolation, with the fix-then-verify loop passing.
- True touches were not exercised (no touch digitizer in harness); input uses the Pointer Events path (`pointerdown/move/up` + `touch-action:none`), which is the same path touch devices take.
- Check 21 (pressure-iterations sweep) not run as a behavioral comparison; see above.
