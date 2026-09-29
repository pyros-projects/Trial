# Wave Laboratory — validation record

Artifact: `../index.html`, one self-contained file (~145 KB). It contains no external scripts, styles, fonts, images or requests; the favicon is an inline `data:` SVG.
Validation date: 2026-09-29. Author: the implementing agent (Claude). No evaluator-owned score or report is included here.

## Environment and tools

| Item | Value |
|---|---|
| Browser automation | **agent-browser 0.31.1** (installed skill). Read `skills get core --full` and the `dogfood` exploratory-testing workflow before use. Headless Chromium, session `wavelab`. |
| Touch input | agent-browser has no touch-drag command for Chrome (`tap` is an alias of click), so real touch drags were sent over the **same session's CDP endpoint** (`agent-browser get cdp-url`) with `Input.dispatchTouchEvent` and touch emulation enabled: `scripts/touch.mjs` (Node 25 built-in WebSocket). |
| Local server | `python3 -m http.server 8765 --bind 127.0.0.1`, used only for inspection. |
| Direct file | `agent-browser open file:///…/index.html` works, so the direct-file check actually **ran**; it was not blocked. |
| Helpers | `scripts/ab.sh` defines `wdrag`, `wclick` and `wc`. They convert world metres to client pixels via `waveLab.toClient()` and then drive **real `agent-browser mouse move/down/up` events**. |
| Offline analysis | Node scripts `scripts/offline-*.js` (cavity modes, lens ray trace, FFT estimator, cylindrical focal shift). |

`window.waveLab` is a read-only diagnostics hook exposed by the app (sim arrays, probe stats, `toClient`). The checks below make every **change** through the UI (mouse, keyboard, touch, form controls) and use the hook only to **read** state or compute metrics from the field arrays.

## Implementation summary (for context)

- **Solver.** Leapfrog FDTD for `u_tt = c(x)² ∇²u − σ(x) u_t + f`.
  - 5-point Laplacian, Float32 arrays. Damping is treated implicitly (centred), so damping never limits stability.
  - Walls are Dirichlet (u = 0).
  - Refractive regions set c = c₀/n per cell, with anti-aliased edges derived from signed-distance functions.
  - Absorbers use a local σ, graded inward over about 3 cm.
- **Domain.** Height is 1 m; width follows the viewport aspect, clamped to 1.25–2.0.
- **Absorbing boundary.** A graded quadratic sponge in a hidden pad (9 % of rows), with a first-order Mur condition at the outer ring. The other boundary modes are fixed (u = 0), free (∂u/∂n = 0, ghost cells) and periodic.
- **Stability.** The ratio is `c_max·Δt·√2/Δx` with c_max = c₀/n_min. Optionally Δt is clamped to 0.97 × limit. Divergence (NaN or |u| > 10⁶) is detected, the simulation auto-pauses, and a toast offers a one-click fix.
- **Sources.** Point, line (plane-wave) and phased array.
  - Each is a forcing term deposited bilinearly, normalised so that amplitude 1 gives |u| ≈ 1.
  - Continuous sources ramp on smoothly.
  - Emission is continuous, single pulse or pulse train, with a Gaussian envelope (FWHM = pulse duration).
  - Waveforms are sine, square, triangle and sawtooth, band-limited to the grid with Lanczos-σ harmonics.
  - Arrays have a per-element phase step Δφ (steering) and an optional focal distance.
- **Diagnostics.** Instantaneous signed amplitude; ⟨u²⟩ intensity; lock-in phase at the reference frequency; |∇u|; medium map; time-averaged energy flux ⟨−u_t∇u⟩ with arrows.
- **Probes.** Bilinear samples of u every few steps. Each shows waveform, A = √2·RMS, peak, lock-in phase, Δφ relative to P1, and dominant frequency (Hann FFT with log-parabolic interpolation) plus a spectrum.

## Checks — required public validation flow

Status legend: PASS, FAIL (then fixed and retested), BLOCKED, NOT-RUN.

| # | Check | How (real interaction) | Observed | Status |
|---|---|---|---|---|
| 1 | Multiple sources form interference | Load default "Two-source interference". The preset puts probes on the central antinode and on the analytically computed first node. | P1 (antinode) A = 0.647; P2 (node) A = 0.0142 (≈ −33 dB). Clear hyperbolic nodal lines (`00-final-default-1280.png`); phase view shows dark nodal lines with phase jumps (`04-mode-3.png`). | PASS |
| 2 | Moving a source changes the field | Select tool: `wdrag` S2 from y = 0.60 to 0.78 with the mouse. | Source moved to (0.622, 0.779). Pattern changes; P2 amplitude 0.058 → 0.31 (`05-moved-source.png`). Undo button enabled. | PASS |
| 3 | Adding a barrier changes diffraction | Wall brush (W): mouse-drag a stroke across the beam, then right-drag to erase half of it. | 0 → 2813 wall cells. Probes in the shadow drop to 0.006 / 0.009. After erasing (1572 cells) the wave diffracts around the wall end (`06`, `07`). | PASS |
| 4 | Moving a barrier changes diffraction | Double-slit preset, select tool: drag the slit barrier +0.2 m. Then set slit separation to 12 cm with the inspector number field. | Barrier x 0.467 → 0.667. Dark-fringe probe 0.031 → 0.431. With 12 cm separation the fringes are visibly wider (`08`, `09`, `10-double-sep12.png`). | PASS |
| 5 | Draw a lens → altered propagation | Blank preset: line tool drag (plane wave), then lens tool drag across the aperture. | Lens D = 0.559 m, n = 1.7 created. Wavefronts converge to a focal spot at ≈ 0.42 m (thin-lens estimate shown in inspector: f ≈ 0.423 m) (`11`, `12`). | PASS |
| 6 | Draw a refractive region → altered propagation | Medium brush (N), n set to 2.0 via the tool-panel number field, brush radius raised with `]`×3, three mouse strokes. | n_max = 2.0 in the grid. Wavelength halves inside, wavefronts bend and the beam deflects (`13`, `14-medium-view.png`). | PASS |
| 7 | Probe waveform reflects local field | Probe tool: click to place 2 probes. Press Space to pause, then click the Step button 12× and compare the probe's latest sample with `fieldAt(x,y)` after each step. | On every recording step (stride 2) probe value = field value exactly (e.g. 0.97477 = 0.97477, 1.17633 = 1.17633); on odd steps it lags by one step as designed. A probe placed inside a painted wall reads 0.000 (`22`). | PASS |
| 8 | Probe accuracy vs analytic 2-D wave | Point source at centre; 3 probes placed by clicks at r = 0.300 (x-ray), 0.600 (x-ray), 0.3138 (y-ray); 16 substeps; ~32 s sim. Script `scripts/probe-accuracy.js`. | f = 17.998 Hz (source 18). Δφ over λ/4 on a ray rotated 90°: −89.06° (exact −90.0°, grid-dispersion theory −90.2°). Δφ over 0.3 m: −151.6° vs grid-dispersion theory −150.9° (continuum −143.6°; the difference is expected numerical dispersion at 18.9 cells/λ). A(0.6)/A(0.3) = 0.694 vs √(r₁/r₂) = 0.707. | PASS |
| 9 | Timestep → stability indicator | Timestep number field = 3 ms with clamp on, then uncheck clamp. | Clamp on: effective Δt 2.017 ms, ratio 0.970, "requested 1.44 > limit → Δt clamped" (`16`). Clamp off: ratio 1.442, "UNSTABLE"; divergence detected at once, auto-paused, toast shown (`17`). "Fix" button → ratio 0.70, running, stable. | PASS |
| 10 | Exact CFL threshold | Clamp off; Δt = 0.99 × and 1.01 × limit via the number field. | 0.99: stable for 1885 steps, max\|u\| ≈ 3. 1.01: diverged by step 115 (max\|u\| 1.8e6), detected and paused (`39`). | PASS |
| 11 | Wave speed → stability indicator | Wave-speed number field 1.5 and 2.2 m/s. | Δt_max 2.080 → 1.387 → 0.945 ms; ratio clamped at 0.97 with an explanation message (`18`). | PASS |
| 12 | Resolution → stability indicator | Resolution select Ultra / Coarse. | Ultra 682×440: ratio 0.906. Coarse 279×180: ratio 0.371. Field resampled, no errors (`19`). | PASS |
| 13 | Switch diagnostics while running | Keys 1–6 on the canvas and the mode radio buttons, all presets. | All six modes render live; `aria-checked` follows (`04-mode-1..6`, `38`). | PASS |
| 14 | Clear | Click "Clear field". | t 1.742 → 0.0065 (a frame had already run); intensity accumulators 8.78 → 0; field regrows from sources. | PASS |
| 15 | Pause | Click Pause, wait 1.2 s. | t and step unchanged (0.429 / 330); button label becomes "Resume". | PASS |
| 16 | Single-step | Click Step (×2), press `.`, press Shift+`.`. | Step 330 → 331 → 332 → 333 → 343; t increases by exactly Δt = 1.3 ms per step. | PASS |
| 17 | Reset | Drag S1 elsewhere, then click "Reset scene"; then Ctrl+Z. | Sources restored to (0.62, 0.40) / (0.62, 0.60); field cleared and warm-up restarted. Ctrl+Z after reset brings back the moved source (0.299, 0.199) (retested after fix F6). | PASS |

## Additional feature checks

| Check | Observed | Status |
|---|---|---|
| All 8 required presets + blank load without errors | double slit, single slit, two-source, cavity standing waves, lens focusing, refraction, phased array, pulse in obstacle field (`02-*`, `24–28`, regression loop: all finite, no console errors) | PASS |
| Snell's law (refraction preset, `scripts/snell.js`, k = −∇(lock-in phase) over 15×15 cells on the beam axes) | incident 40.00°, refracted 25.55° (Snell 25.37°); n from sines 1.490, from k-ratio 1.497 (n = 1.5) | PASS |
| Double-slit fringe positions (`scripts/fringes.js`) | maxima at 0.343 / 0.500 / 0.657 m vs path-difference theory 0.3386 / 0.5000 / 0.6614 (±4.4 mm ≈ 1.5 cells) | PASS |
| Cavity standing wave (7,7), drive tuned to the discrete mode of the rasterised box | antinode probe A = 7.85, node probe A = 1.0; clean 7×7 lattice in amplitude and intensity (`24`, `25`) | PASS (after fix F1) |
| Lens focus position (`scripts/lensfocus.js`, `offline-lens-raytrace.js`) | on-axis ⟨u²⟩ peak 0.37 m behind centre, gain ≈ 12×. Exact ray trace of the same thick f/0.65 lens: paraxial rays cross at 0.49 m, marginal rays at 0.29–0.39 m, min-RMS focus 0.31 m, so the peak lies inside the spherical-aberration caustic, as expected. Preset probe now placed midway between paraxial and least-RMS focus (0.416 m). | PASS (see limitation L3) |
| Energy conservation (closed box, fixed walls, γ = 0, pulse; `scripts/energy.js`) | discrete leapfrog energy 12 205 342.53 → 12 205 342.98 over 2 730 steps (4×10⁻⁸ relative) while KE/PE exchange ±3 % | PASS |
| Absorbing boundary (`scripts/domain-energy.js`) | pulse energy remaining in the domain after the pulse exits: 3.3×10⁻⁴ of the peak (≈ −35 dB), later 8.7×10⁻⁷ | PASS |
| Absorbing vs reflecting block (`scripts/swr.js`, same rect switched via inspector) | reflection from SWR: absorber 0.178, wall 0.931, method floor with no block 0.153 (finite line source ripple), so the absorber is indistinguishable from the floor with this method | PASS (after fix F5) |
| Phased-array steering / relative phase | "Steer −30°" button: the beam moves onto the mirrored probe (P1 0.94→0.15, P2 0.16→1.45). Δφ slider PageDown×2: 70.4° → 34.5°. Focus 0.5 m forms a focal spot (`30`, `31` — `31` shows the amplitude view because the "2" key went to the focused number field). | PASS |
| Pulsed emitter + "Fire pulse now", square waveform, activation toggle, type conversion | clean pulse ring (`34`); square wave band-limited to 3 harmonics at 18 Hz, probe f = 18.04 Hz; unchecking "Active" → gain 0, HUD "(0 on)"; point → line conversion | PASS |
| Boundary modes absorb / fixed / free / periodic | all stable (~2 s each); reflections and wrap-around visible (`36-*`) | PASS |
| Shape tools and handles | barrier line, rectangle, circle, slits created by drag or click; rectangle resized by corner handle and rotated 43° by rotate handle; undo ×2 / redo verified (`32`, `33`) | PASS |
| Display: color scale, curve, exposure, auto-exposure, persistence, brush radius | pixel colour changes with RdBu map and log curve; manual exposure −2 EV → legend ±4.0, +1 EV → ±0.50; persistence 0.9 blends frames (`41`, `42`); brush radius via `[`/`]` and slider | PASS |
| Keyboard | Space, `.`, Shift+`.`, 1–6, tool keys, Delete, arrows (+1 / +10 cells), Ctrl+Z / Ctrl+Shift+Z, Esc; slider arrow/PageUp/PageDown (after fix F4) | PASS |
| Probe dock | card click selects probe; × removes (undoable); 6 probes scroll horizontally (`46`) | PASS |
| Desktop 1280×800 | header on one row after fix F2; 60 fps, solver ≈ 6 ms + draw ≈ 1.5 ms per frame (`00-final-default-1280.png`) | PASS |
| Narrow 390×844 | stacked layout, no horizontal page scroll (scrollWidth 390), domain 425×340, modes and tools scroll horizontally (`00-final-mobile-390.png`, `20`, `21`) | PASS |
| Touch input (real CDP touch drag, pointerType = touch) | wall painted, 0 → 3230 wall cells, 15 stroke points, page did not scroll (`22`) | PASS |
| Resize continuity | 1280→1000×700→1440×900→1280: grid re-allocated (503/529 cols), field resampled (max\|u\| stays ≈ 3–4), no errors (`43`) | PASS |
| High-DPI | canvas backing store = CSS size × devicePixelRatio (cap 3); overlays drawn in device pixels. Only DPR 1 was actually exercised in headless runs. | PASS (DPR 1 only) |
| Long run (60 s wall-clock, 16 substeps, 37 346 steps) | bounded; node/antinode ratio steady at ≈ 45:1 | PASS |
| Direct `file://` open | runs (t advances, 60 fps), no errors, `performance.getEntriesByType('resource')` = [] (`23`) | PASS |
| Network isolation over HTTP (external `https://**` blocked via `agent-browser network route --abort`) | only request: `GET http://127.0.0.1:8765/index.html 200`, even after switching presets and modes. An early `favicon.ico` 404 (browser auto-request) was removed by adding an inline data-URI icon. | PASS |
| Console / uncaught errors | `agent-browser errors` and `console` empty in all runs | PASS |
| Performance at 1920×1080 | Fine 609×340 ≈ 52–54 fps; Ultra 788×440 ≈ 44 fps; Ultra with 10 substeps ≈ 33 fps (headless, software-composited) | PASS (informational) |
| Audio | not applicable (the app has no audio) | NOT-RUN |

## Failures found, fixes, retests

| ID | Failure (observed) | Root cause | Fix | Retest |
|---|---|---|---|---|
| F1 | Cavity preset showed a mixed, irregular stationary pattern; the node probe read 48 % of the antinode (`fail-01-…`, `02-preset-cavity.png`). | Offline replica (`offline-cavity-modes.js`) confirmed that the drive matched the discrete (7,7) mode (7.656 Hz predicted, 7.655 Hz measured). Damping γ = 0.6 gave a linewidth comparable to the spacing of neighbouring odd–odd modes (≈ 0.37 Hz). | γ = 0.2 and a 12 s fast-forward warm-up (runs extra steps within a 22 ms frame budget, HUD shows "⏩ Warm-up"). | Clean 7×7 mode; node/antinode 1.0 / 7.85 (`24`, `25`). PASS |
| F2 | At 1280 px the header wrapped to two rows. | Content was wider than the viewport. | Responsive compaction (hide sub-title and key hints, narrower preset select). | One row at 1280 (`03-header-1280.png`). PASS |
| F3 | Pulse preset showed large low-frequency blobs lingering after the pulse (`02-preset-pulse.png`). | A ~1-cycle pulse carries strong low-frequency content, and the thin sponge reflects long wavelengths. | Thicker pad (9 % of rows), Mur ABC behind the sponge, longer pulse (85 ms), and the absorber block kept off the circles. | Clean wavefront and scattering (`26–28`); domain energy −35 dB after exit. PASS |
| F4 | Slider arrow keys moved by 1/1000 of the range (a slit-count ArrowRight did nothing); a number field went blank after Enter. | The range input used 0–1000 steps; `refresh()` skipped the focused field. | Custom arrow / PageUp / PageDown stepping and a forced refresh on change. | ArrowRight / PageDown verified (Δφ 70.4 → 34.5 with 2× PageDown); fields keep their values. PASS |
| F5 | Absorber blocks reflected noticeably (\|r\| ≈ 0.24). | Absorption rose to full σ within ~1 cm (≪ λ), so the edge acted as an impedance step. | σ graded quadratically inward over 3 cm. | \|r\| 0.178, at the method floor of 0.153. PASS |
| F6 | Reset was not undoable; single-step executed on the next animation frame (non-deterministic for tests); the probe inspector readout was not live; phase bars did not redraw after typed edits; the probe dock height changed when the first probe appeared (re-gridding the field). | UI wiring. | Undo push on reset; synchronous single-step; live inspector hooks; `inspRefresh` on source edits; fixed dock height. | All retested above. PASS |
| — | Harness misfires (not app bugs): `find label … fill` targeted the range input (`harness-misfire-range-fill.png`); keys pressed while a `<select>` kept focus were consumed by the select; `Math.max(...250k array)` overflowed in an eval. | — | Target spinbuttons by ref, focus the canvas before shortcut keys, use `reduce`. | — |

## Remaining limitations (honest account)

- **L1.** The solver runs on the CPU on the main thread (no WebGL or worker). It holds 60 fps at the default Fine resolution on 1280–1440 px viewports. Larger grids with more substeps trade frame rate for speed; the HUD shows solver and render time.
- **L2.** 5-point FDTD has the usual numerical dispersion: about −0.4 % phase velocity at 18.9 cells/λ, and more for short wavelengths or inside high-index regions. The source inspector warns below 10 and 6 cells per wavelength.
- **L3.** The lens preset uses a fast thick spherical lens, so its intensity peak sits about 15 % closer than the paraxial focal length (spherical aberration). This is physically correct, but the thin-lens f shown in the inspector is only the paraxial estimate.
- **L4.** Scene positions are stored normalised to the domain width, so a browser resize re-scales x positions (shapes stay rigid) and slightly detunes finely tuned setups such as the cavity resonance and the node probes.
- **L5.** Walls are fixed (Dirichlet, u = 0). The "free" (Neumann) option exists only for the outer domain boundary, not for painted walls.
- **L6.** A dominant frequency read from a probe whose window still contains a transient (a wavefront arrival or an edit) can be off by a fraction of an FFT bin until the ~5 s window refreshes; steady-state readings were 17.998–18.00 Hz.
- **L7.** Undo/redo covers scene edits (objects, sources, probes). Global simulation and display settings are not in the undo history.
- **L8.** Automated validation ran in headless Chromium only (desktop, 390 px, CDP touch). Behaviour on physical touch devices, Safari/Firefox and DPR > 1 was not observed.

## How to reproduce

```bash
cd <project>                                   # contains index.html and evidence/
python3 -m http.server 8765 --bind 127.0.0.1 & # only for inspection; file:// also works
export AGENT_BROWSER_SESSION=wavelab
source evidence/scripts/ab.sh                  # helpers: wdrag / wclick / wc / ev
agent-browser set viewport 1280 800
agent-browser open http://127.0.0.1:8765/index.html
agent-browser select "#presetSel" refraction; agent-browser wait 16000
agent-browser eval --stdin < evidence/scripts/snell.js
# touch: node evidence/scripts/touch.mjs "$(agent-browser get cdp-url)" '[[x0,y0],[x1,y1],...]'
```
