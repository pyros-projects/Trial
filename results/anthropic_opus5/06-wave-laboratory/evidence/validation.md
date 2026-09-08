# Validation — Wave Interference and Diffraction Laboratory

Artifact: `index.html` (single self-contained file, 105,017 bytes, 2,263 lines)
Validated: 2026-09-08
Tooling: `agent-browser 0.31.1` (installed skill; Chrome for Testing 152.0.7977.54, CDP)
Screenshots: `evidence/shots/`

All numbers below were read out of the **running simulation**, not inferred from pixels.
The delivered file exposes a small read-only introspection handle, `window.waveLab`
(`state / sample / energy / scan / material / probes / sources / probeTail / analyze /
advance`), which the checks below use to compare the live field against closed-form
physics. Rendering was additionally checked by sampling real canvas pixels
(`getImageData`) and by screenshots.

---

## 0. How the checks were run

Two browser sessions:

* `wavelab` — served over `http://127.0.0.1:8617` (`python3 -m http.server`) for iteration.
* `filetest` — `file:///home/pyro/.../index.html` with **`agent-browser set offline on`**.

The local HTTP server is a development convenience only; the final artifact was
re-validated end to end over `file://` with the browser offline.

```bash
agent-browser --session filetest set offline on
agent-browser --session filetest open "file:///home/pyro/projects/naked/opus5/06-wave-laboratory/index.html"
agent-browser --session filetest console          # -> empty
agent-browser --session filetest network requests # -> only the document itself
```

---

## 1. Standalone delivery and runtime restrictions — **PASS**

| Check | Result |
|---|---|
| Opens directly from `file://` | **PASS** — `location.protocol === "file:"`, app fully interactive, 60 fps |
| Works with the browser network disabled | **PASS** — `set offline on`, no degradation |
| Network requests issued | **PASS** — exactly one: the document. No sub-resources |
| Static scan for external deps | **PASS** — `grep` finds no `<script src>`, `<link rel=stylesheet>`, `fetch(`, `XMLHttpRequest`, `new Worker`, `@import`, or any `http(s)://` asset URL |
| Console errors / warnings | **PASS** — empty across every session and every flow exercised |
| Favicon | inline `data:image/svg+xml` URI (removes the only 404 seen during development) |

Screenshot: `22-file-protocol-offline.png` — renders identically to the HTTP run; probe reads
`f = 0.0500` against a source frequency of `0.0500`.

---

## 2. Numerical method

Explicit second-order FDTD leapfrog for the damped scalar wave equation with a
spatially varying speed:

```
u_tt + 2γ(x,y)·u_t = c(x,y)²·∇²u + S(x,y,t)

u⁺ = [ 2u − (1−γΔt)·u⁻ + (c Δt/Δx)²·L(u) ] / (1 + γΔt)
```

Five-point Laplacian, three rotating `Float32Array` buffers, a one-cell ghost ring so the
interior stencil is branch-free, per-cell precomputed coefficients (`cA`, `cB`, `cC`)
rebuilt only when material / `dt` / `c` / damping / boundary change. Rigid barriers are
Dirichlet cells (`cA = 0`). Boundaries: first-order Mur radiating condition plus a graded
sponge, hard reflecting, or periodic ghost wrap.

---

## 3. Physics validation against closed-form predictions

Every probe/target position below was computed from textbook optics **before** the
measurement, then compared with the simulated field.

### 3.1 Double slit — **PASS**
Plane wave, λ = 20 cells, slit separation d = 4λ. Probe 1 placed at the central maximum,
probe 2 at the analytically predicted first minimum `sinθ = λ/2d`.

| Quantity | Value |
|---|---|
| ⟨u²⟩ at central maximum | 3.95 × 10⁻³ |
| ⟨u²⟩ at predicted first minimum | 1.71 × 10⁻⁴ |
| **Fringe contrast** | **23 : 1** (23–45 : 1 across runs) |
| Probe 1 measured frequency | 0.04986 vs source 0.05000 → **−0.3 %** |

### 3.2 Single slit — **PASS**
Aperture a = 3λ; probe 2 at the predicted first null `sinθ = λ/a`.

| Quantity | Value |
|---|---|
| ⟨u²⟩ central lobe | 0.314 |
| ⟨u²⟩ predicted first null | 1.38 × 10⁻³ |
| **Contrast** | **227 : 1** |

### 3.3 Two-source interference — **PASS**
Two coherent point sources, separation 5λ. Probe 2 at the predicted first dark fringe.

| Quantity | Value |
|---|---|
| rms at central bright fringe | 0.0822 |
| rms at predicted dark fringe | 0.0109 |
| **Intensity contrast** | **27.6 : 1** |
| Probe frequency error | −0.3 % and +0.8 % |

### 3.4 Refraction / Snell's law — **PASS (quantitative)**
Interface at n₁ = 1 → n₂ = 1.65, incidence 32°. Spatial period measured along a horizontal
line by zero-crossing counting on the live field, in each medium.

| Quantity | Predicted | Measured | Error |
|---|---|---|---|
| period along x, medium 1 (`λ/cos θ₁`) | 23.58 cells | **23.23** | −1.5 % |
| period along x, medium 2 (`(λ/n)/cos θ₂`) | 12.80 cells | **12.65** | −1.2 % |
| **compression ratio** (depends on both λ→λ/n *and* Snell's θ₂) | **1.843** | **1.837** | **−0.3 %** |

Snell's law is therefore satisfied by the solver to ~0.3 %. Screenshot `08-refraction.png`
shows the wavefronts both compressing and rotating toward the normal.

### 3.5 Lens focusing — **PASS**
Biconvex slow region (n = 1.65) built from the aperture/thickness geometry; the probe is
placed at the **lensmaker focal length** `f = R_c / 2(n−1)` computed at build time.

| Quantity | Value |
|---|---|
| ⟨u²⟩ at the geometric focus | 4.64 |
| ⟨u²⟩ off-axis at the same x | 0.038 |
| **Focal concentration** | **122 : 1** |
| Probe frequency | 0.0625 vs source 0.0625 → **0.00 %** |

### 3.6 Cavity standing wave — **PASS**
Closed reflecting box, driven on a computed box resonance `f = (c/2)·√((m/Lx)²+(n/Ly)²)`.

| Quantity | Value |
|---|---|
| max/min ⟨u²⟩ along an interior line | **553 : 1** (stationary nodal structure) |
| probe on antinode / probe on node | rms 0.117 vs **0.0017** |
| **antinode : node intensity** | **2157 : 1** |
| both probes' measured frequency | within **1 %** of the drive |

Note: a driven high-Q cavity settles into a stationary pattern whose nodal lines are
displaced from the ideal analytic mode by mode mixing, so the two cavity probes are parked
on the *measured* strongest antinode and deepest node once the field has rung up
(≈4 s after the scene loads; a toast announces it). This is the only place probe placement
is empirical rather than analytic.

### 3.7 Phased-array beam steering — **PASS**
24 elements, spacing 0.48 λ. The panel reports the derived inter-element phase, e.g.
`Δφ = 98.8° per element` at −35° (closed form: `−k·d·sinθ = 99.1°`).

| Steer | beam peak (measured) | predicted | upper-half : lower-half energy |
|---|---|---|---|
| +20° | y = 0.216 | — | **26 : 1** (upper) |
| −35° | y = 0.830 | y = 0.869 | **54 : 1** (lower) |

Changing the Steer slider moves the beam to the mirror side, as required.
Focus mode (`focus = 202 cells`) produces an on-axis concentration at (0.498, 0.499) with
5.1× gain over the halfway point; the Steer row correctly disables while focusing.
Screenshots `09-array.png`, `17-array-steer-neg35.png`, `18-array-focus.png`.

### 3.8 Pulse in an obstacle field — **PASS**
Ricker wavelet, pulse duration 72, repeat 360. Mixed clutter measured in the material
field: 248 wall / 50 absorber / 108 refractive cells per 3600 sampled. Screenshot
`10-obstacles.png` shows the expanding pulse scattering off the obstacles with persistence
trails; the probe trace shows the wavelet shape.

---

## 4. Public validation checks

### 4.1 Multiple sources form interference — **PASS**
§3.3: two coherent emitters, 27.6 : 1 measured fringe contrast, fringe positions matching
`sinθ = λ/2d`.

### 4.2 Adding / moving a barrier changes diffraction — **PASS**
On the running two-source scene, a barrier was drawn with the **Wall** tool by real pointer
drag (`mouse down` → six `mouse move` → `mouse up`) down 65 % of the field height.

| Location | ⟨u²⟩ before | ⟨u²⟩ after | change |
|---|---|---|---|
| (0.80, 0.50) directly behind the barrier | 6.35 × 10⁻³ | 2.12 × 10⁻⁵ | **299× shadow** |
| (0.80, 0.20) behind the barrier | 2.79 × 10⁻⁴ | 9.22 × 10⁻⁶ | 30× shadow |
| (0.80, 0.85) past the barrier's end | — | 9.06 × 10⁻⁴ | energy diffracting round the tip |

Screenshot `11-drawn-barrier.png` shows the deep geometric shadow, wavefronts wrapping the
barrier tip, and — in the probe trace — the exact moment the barrier cut the signal.

### 4.3 Draw a refractive region or lens; observe altered propagation — **PASS**
**(a) Refractive band.** Drawn with the **Medium** tool at n = 2.0 by four pointer drags.

| Quantity | Predicted | Measured |
|---|---|---|
| period along x inside the drawn band (incl. Snell bend at its face) | 11.08 cells | **11.10** (**0.2 %**) |
| period along x outside | 22.68 cells | 24.22 |
| material readback inside / outside | — | n = 2.00 / n = 1.00 |

Screenshot `13-drawn-medium.png`.

**(b) Lens, erase → re-stamp cycle.**

| Step | focus : off-axis ⟨u²⟩ |
|---|---|
| preset lens present | **80 : 1** |
| lens erased with the Erase tool (drag) | **1.04 : 1** — focus gone |
| new lens stamped with the Lens tool (drag defines the aperture; brush sets thickness; index slider sets n) | **94 : 1** — focus restored, brightest spot on-axis at (0.650, 0.499) |

Screenshots `14-lens-erased.png`, `15-lens-drag-preview.png`, `16-lens-restamped.png`.

### 4.4 Probe waveform reflects local field state — **PASS (exact)**
Paused the sim with the real Pause button, then advanced 12 single steps, comparing the
probe's recorded ring buffer against direct reads of the field at the probe cell:

```
direct field reads : -0.215912 -0.199767 -0.177904 -0.151370 -0.121512 -0.089489
                     -0.055958 -0.021153  0.014731  0.051097  0.086773  0.120230
probe recorded     : (identical)
max |difference|   : 0
```

Probe analysis (Hann-windowed FFT, 1024-point, zero-padded while the record fills,
sample rate 1/Δt) reports peak, rms, dominant frequency and phase. Frequency accuracy on a
settled field: **±0.1 %** (tracked over time: −2.75 % → −1.75 % → **+0.02 %** → **−0.10 %**
as the emitter↔barrier standing-wave field settles — the readout follows the real local
signal, including its transient).

Waveform selection verified spectrally (Goertzel on the probe record, third harmonic
relative to fundamental):

| Waveform | H3/H1 | H2 | Expected |
|---|---|---|---|
| Sine | 0.0001 | 3.8 × 10⁻⁸ | pure tone |
| Square | 0.673 | **1.3 × 10⁻⁷** | odd harmonics only ✔ |
| Sawtooth | 9.07 | 3.2 × 10⁻³ | even + odd ✔ |

### 4.5 Timestep, wave speed, stability indicator — **PASS**

Auto-clamp **on** (default), wave speed raised 1.0 → 2.0:

```
dt requested 0.500   dt effective 0.3518   Courant 0.7036
chip: MARGINAL (amber)      HUD: "0.704 / 0.707"
warning: "dt 0.500 exceeds the CFL limit — clamped to 0.3518."
note:    "CFL MARGINAL · limit dt ≤ 0.3536 at c_max 2.00 · λ 40.0 cells"
```

Auto-clamp **off**, dt driven to 1.05 (Courant 1.05 > 1/√2):

```
chip: UNSTABLE (red, pulsing)
warning: "UNSTABLE: c·dt/dx = 1.050 > 0.707. The field will diverge."
```

The field genuinely diverges (max |u| reached 1.98 × 10²⁹) and the built-in guard fires:
`"Numerical blow-up detected — field cleared. Lower dt or re-enable auto-clamp."`
Screenshot `12-unstable.png`. So the app both **prevents** (clamp, on by default) and
**clearly indicates** the unstable region.

### 4.6 Switch diagnostics while running — **PASS**
All six modes clicked live; each renders distinct real output (canvas pixels sampled):

| Mode | HUD | legend | mean RGB | lit frac | fps |
|---|---|---|---|---|---|
| Amplitude | amplitude | signed amplitude | 58.9, 50.7, 62.8 | 0.974 | 60 |
| Intensity | intensity | time-averaged intensity | 58.5, 76.7, 78.4 | 0.743 | 60 |
| Phase | phase | phase (hue) × envelope | 52.6, 54.8, 54.8 | 0.823 | 59 |
| Gradient | gradient | \|∇u\| wavefront edges | 62.0, 110.2, 112.1 | 0.991 | 60 |
| Flow | flow | energy flux direction | 31.4, 32.3, 32.0 | 0.357 | 59 |
| Medium | medium | propagation medium | 11.4, 25.9, 41.8 | 1.000 | 60 |

Signed amplitude distinguishes sign by hue (magenta negative / cyan positive in Phosphor).
Screenshots `viz-*.png`. Four palettes verified distinct (`pal-*.png`); the four colour
scales (Linear / Soft γ0.7 / Sensitive γ0.4 / Log) change the rendered lit fraction.

### 4.7 Clear, pause, single-step, reset — **PASS**

| Control | Evidence |
|---|---|
| Pause | sim time frozen at 593.5 across 1.5 s wall time; HUD "paused"; button → "Resume" |
| Single step | two clicks advanced sim time by **exactly 3.00** = 2 × substeps(3) × dt(0.5); still paused. Keyboard `.` gives exactly 1.50 |
| Clear field | field max = **0** across 1600 sample points, t → 0, while sources (1), probes (2) and the drawn barrier all survive |
| Reset scene | preset barrier restored, user-drawn barrier removed, sources/probes rebuilt |

---

## 5. Editing, controls and UI

| Item | Result |
|---|---|
| Draw/erase smoothly while dragging | **PASS** — strokes interpolated between pointer samples; Alt or right-drag erases |
| Wall / Absorber / Medium / Erase brushes | **PASS** — absorber band (strength 0.9) attenuated downstream energy from 2.74 × 10⁻² to **9.9 × 10⁻¹⁷** (10¹⁴×) |
| Lens stamp tool | **PASS** — §4.3b; live dashed lens preview during the drag |
| Slit tool | **PASS** — 3-slit barrier stamped by drag (188 wall / 12 open cells sampled along the barrier); produced a textbook 3-slit grating pattern with sharp principal maxima (`25-slit-tool-3slit.png`) |
| Point / Line / Array placement | **PASS** — scene rebuilt from zero sources: both preset emitters deleted via the list ✕ (empty-state message shown), a line emitter drawn by drag spanning y 0.04→0.96 |
| Source controls | **PASS** — frequency (with live λ readout), amplitude, phase, waveform, emission mode, pulse duration, pulse repeat, element count, steer, focus, Active/Muted toggle, delete |
| Pulsed emission | **PASS** — probe record duty fraction 0.165 → burst, not CW |
| Mute source | **PASS** — Active/Muted toggle; with damping 0.03 and both sources muted, mean field energy decayed **1580×** in 4 s |
| Substeps | **PASS** — sim-time rate 60 → 226 units/s going from 2 to 8 substeps (ratio 3.77 vs ideal 4.0; fps dipped 60→57) |
| Boundary modes | **PASS** — absorbing: top-edge energy 17 % of mid-field; reflecting: 111 % (energy retained); periodic: highest edge energy (recirculates) |
| Resolution | **PASS** — 480 → 720 wide (571,680 cells) at **60 fps**; barrier and slits survived the resample; λ/width held at exactly 0.04167 (frequencies rescaled so the physical scene is preserved); fringe contrast 25 : 1 retained |
| Exposure / persistence / palette / colour scale | **PASS** — all change rendering |
| Keyboard | **PASS** — `1`–`0`,`-` tools; `[` `]` brush ±2; `V` cycles view (button group syncs); `Space` pause; `.` step; `C` clear; `R` reset; `Del` delete |
| Overlay HUD | **PASS** — fps, grid dimensions, dt, CFL/max, sim time, source count, probe count, view mode, run state; colour-coded by stability |

---

## 6. Viewports, high-DPI, performance

| Viewport | Result |
|---|---|
| 1280 × 800 | **PASS** — grid auto-sized to 480 × 529, 60 fps, no overflow (`00-hero-default.png`) |
| 390 × 844 | **PASS** — layout stacks (header → canvas → panels); `scrollWidth == clientWidth == 390`, i.e. **no horizontal overflow**; grid 480 × 456; 60 fps; tapping the canvas with the Probe tool added a probe at (0.782, 0.532) and its card appeared (`20-narrow-390x844.png`, `21-narrow-probe-added.png`) |
| High-DPI | **PASS** — canvas backing store is `cssSize × min(devicePixelRatio, 2)`; overlay markers scale by the same factor |
| Resize | **PASS** — `ResizeObserver`; the simulation grid re-derives its aspect from the panel (debounced, >5 % change), resampling structures, the live field and the intensity buffer |
| Touch/pointer | **PASS** — unified Pointer Events, `touch-action: none` on the canvas (computed style verified) |
| Performance | 253,920 cells × 3 substeps at **60 fps**; 571,680 cells at **60 fps**; ≈254 M cell-updates/s measured during scene warm-up |

---

## 7. Defects found and fixed during validation

| # | Defect | Fix | Retest |
|---|---|---|---|
| 1 | Fixed 3:2 canvas letterboxed badly at 1280 × 800, wasting ~40 % of the stage | Canvas fills the stage; the grid derives its aspect from the panel and re-allocates (with resampling) on material change | `03-adaptive.png` — full-bleed, 60 fps |
| 2 | Preset geometry used hard-coded normalised coordinates, so probes missed the true maxima/minima once the aspect was viewport-dependent | All scene geometry recomputed from live cell dimensions (slit separation in λ, lensmaker focal length, Snell angles, array steering) | §3 contrasts 23–2157 : 1 |
| 3 | Presets set the view mode internally without syncing the segmented button group — header read "INTENSITY" while the AMPLITUDE button was lit | `loadPreset` now calls `setViz(S.viz)` | §4.6 — button, HUD and header chip agree |
| 4 | Intensity mode over-scaled (×2.2 on top of gain²) so unit-amplitude fields clipped to white | Removed the extra factor; retuned the two intensity scenes | `07-lens.png` — focus reads against a graded background |
| 5 | Intensity accumulator was not updated during scene warm-up, so intensity views started black and node-finding had no data | `accumulateDiagnostics()` runs during warm-up | Cavity/lens/single-slit correct on first frame |
| 6 | Probe stats required a full 1024-sample record (~6 s of blank readouts after every scene load) | Analyse the newest ≥256 samples, Hann-windowed at their own length and zero-padded | Readings present ~2 s after load, then sharpen |
| 7 | Stability readout lagged one frame after moving the dt / speed sliders (briefly printed "clamped to 0.5000" when it had not yet clamped) | `updateStability()` resolves dt first | §4.5 self-consistent |
| 8 | Keyboard-shortcut legend misaligned — multi-key rows emitted extra anonymous grid items | Each key group wrapped in one `.kg` element | 20 items / 10 rows, aligned (`10-obstacles.png`) |
| 9 | Pulse scene had long dead intervals (repeat 26 λ vs a 480-cell crossing) | Repeat shortened to 15 λ so pulses overlap in flight | `10-obstacles.png` |
| 10 | Invalid CSS colour token in a scrollbar rule | Removed | — |

---

## 8. Status summary

| Area | Status |
|---|---|
| Standalone `file://`, no network, no build, no dependencies | **PASS** |
| Grid-based FDTD solver (not sprites/particles) | **PASS** |
| Interference, diffraction, reflection, refraction, absorption, standing waves, focusing, cancellation | **PASS** — each measured against closed-form predictions |
| Editing: continuous/pulsed emitters, point/line/phased-array, walls, absorbers, slits, obstacles, lenses, refractive regions | **PASS** |
| Smooth drawing/erasing while dragging, live effect | **PASS** |
| Source controls (freq, amplitude, phase, pulse duration, type, waveform, activation) | **PASS** |
| Phased-array relative phase → visible steering and focusing | **PASS** |
| Global controls (pause, step, clear, reset, resolution, dt, speed, damping, boundary, substeps, colour scale, exposure, persistence, brush radius) | **PASS** |
| Stability condition prevented **and** indicated | **PASS** |
| 8 required presets | **PASS** |
| 6 visualization modes incl. signed amplitude | **PASS** |
| Probes: live waveform, amplitude, frequency, phase, spectrum, from the real field | **PASS** (exact buffer match) |
| Resize, high-DPI, pointer/touch, 1280×800 and 390×844 | **PASS** |
| Live overlay with all nine required fields | **PASS** |
| Default scene produces a rich interference pattern immediately | **PASS** — double slit, warmed up during load |

### Known limitations

1. **Cavity probe placement is empirical.** The two cavity probes are parked on the
   measured antinode/node ≈4 s after the scene loads, because a driven high-Q box settles
   into a mode-mixed stationary pattern whose nodal lines are displaced from the ideal
   `(m,n)` mode. The standing-wave physics itself is exact (553 : 1 stationary nodal
   contrast); only the *probe positions* are measured rather than assumed.
2. **Probe frequency during transients.** The dominant-frequency readout follows the real
   local signal, so while a field is still ringing up it can read several percent off
   (observed −2.75 % → +0.02 % as a scene settled). This is faithful measurement, not
   error, but it can look surprising in the first seconds after loading a scene.
3. **Resolution changes rescale source frequencies** to preserve wavelength-per-domain, so
   the numeric frequency values shown in the panel change when the grid width changes. A
   toast explains this. Grid *height* changes (viewport aspect) do not rescale anything.
4. **Very low-frequency sources** (λ ≳ 200 cells) put fewer than ~3 cycles in the probe's
   analysis window, so the frequency readout is coarse there. Amplitude, rms and the
   waveform trace remain exact.
5. **Not exercised:** real multi-touch gestures (pinch/two-finger) — the app uses single
   pointer input only, which was tested; and no import/export or persistence feature was
   built, as none is required by the specification.
