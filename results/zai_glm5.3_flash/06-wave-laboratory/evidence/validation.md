# Wave Lab — Validation Evidence

Artifact: `index.html` (single self-contained file, 67.6 KB, 1460 lines; HTML+CSS+JS+simulation+plotting all inline).
Date: 2026-09-08. Session: `agent-browser` (Chromium via CDP), session name `wavelab`.
Primary URL during dev: `http://127.0.0.1:8164/index.html` (local server, external internet not used by the app).
Final checks repeated against `file:///home/pyro/projects/naked/glm-53-flash/06-wave-laboratory/index.html` — the direct-file open **works** and is not blocked.

## Implementation summary

- Real numerical solver: explicit leapfrog finite-difference time-domain (FDTD) scheme for the damped 2D wave
  equation `u_tt + σ·u_t = c(x,y)² ∇²u`, dx = 1 cell, per-cell speed `c/n(x,y)`, Dirichlet wall cells,
  lossy absorber cells, sponge option, one-way (Mur-1), reflecting, and periodic boundaries.
- CFL stability condition `c·dt/dx ≤ 1/√2`, displayed as a percentage meter with auto-clamp guard.
- All scene objects stored in normalized coordinates; masks re-rasterized on edit and on grid resize.
- 6 visualization modes, 6 color scales, exposure, persistence (image-space phosphor blend).
- Probes sample the live field bilinearly every frame; 512-sample ring; 256-point Hann-windowed radix-2 FFT
  for dominant frequency, phase, and optional spectrum; RMS amplitude over the last 256 samples.
- Silent warmup on preset load so the default scene opens with fully developed interference.

## Public validation checks (required)

| Check | Method / evidence | Result |
|---|---|---|
| Multiple sources form interference (actual field) | `twosource` preset; vertical scan at x=0.75 found 12 minima / 6 maxima in \|u\| envelope; screenshot `02-twosource.png` shows hyperbolic fringes | **pass** |
| Adding/moving a barrier changes diffraction | Double slit running; painted a wall over the upper slit with a real mouse stroke (`mouse down/move/up`); transmitted max amplitude 0.240 → 0.208 near-wall with upper beam fully shadowed and two-slit fringes destroyed; probe rms 0.128 → 0.048. Screenshot `03-wall-drawn-over-slit.png` | **pass** |
| Draw a refractive region/lens, observe altered propagation | Preset lens: measured wavelength left/right of interface in `refraction` preset = 16 : 11 cells (ratio 1.45 vs expected 1.5). Live-drawn ellipse lens (Lens tool drag): invN=1.5 inside, wavefronts visibly bend and refocus — `11-lens-drawn-live.png`, `05-lens-focus.png` | **pass** |
| Probe waveform reflects local field state | Probes placed with the real Probe tool at a scanned node (rms 0.0039) vs antinode (rms 0.0889) → app probes measured suppression 15.8×; probe f̂ = 0.0502 (exact driven frequency 0.05), phase −112°, live waveform + spectrum rendered. `06-probes-node-antinode.png` | **pass** |
| Change timestep & wave speed, inspect stability indicator | dt=1.0, c=1.2 → CFL meter 170%, auto-clamp engaged (dt_eff=0.58, "dt clamped" badge). With clamp disabled: **⚠ UNSTABLE** badge and the field genuinely blew up to NaN (44,528/44,928 cells) — numerical instability is real, not cosmetic. Re-enable + Reset recovers (0 NaN, CFL 17%) | **pass** |
| Switch diagnostics while running | Cycled amp/int/phase/grad/media/flow live — 6 distinct pixel signatures, no errors (`15-phase-mode.png`, `16-energy-flow-mode.png`) | **pass** |
| Clear / pause / single-step / reset | Pause froze field and sim time exactly; Step advanced time by exactly dt_eff·substeps = 1.4 and changed the field; Clear zeroed field (max 0.0) while keeping scene objects; Reset restored the preset with warmup (max 1.033, running) | **pass** |

## Additional coverage

| Check | Result |
|---|---|
| All 8 presets load without console errors: double slit, single slit, two-source, cavity (resonant mode f computed from grid, standing pattern visible `08`), lens, refraction, array, pulse maze (`09`) | **pass** |
| Phased-array steering: per-element drive phases verified in-field (measured 0°,260°,160°,… progression for Δφ=260°); Δφ=60° vs 300° visibly steers beam down vs up (`07a`,`07b`). Multi-lobe structure = correct grating-lobe physics (element spacing > λ/2). Steering-angle readout shown in source list | **pass** |
| Editing tools through real pointer events: Point tool place (0.55,0.30) ✓, Move tool drag source to (0.20,0.35) ✓, Line tool drag creates line source ✓, right-button drag erases ✓, Wall painting while running ✓, Eraser ✓, Slit tool with count/width options ✓, Lens/Medium ellipse+rect drag ✓ | **pass** |
| Source editor: activation toggle (⏸/▶) stops/starts drive; Drive continuous↔pulsed switch; frequency slider updates λ readout (f=0.09 → "λ≈3.9", = c/f exact); array Δφ + element count | **pass** |
| Viewport 1280×800 (desktop) and 390×844 (narrow): drawer menu opens over canvas, canvas resizes to portrait grid 288×589, probe placement and panels work (`12`, `13`) | **pass** |
| High-DPI: canvas backing store = CSS size × min(devicePixelRatio,2); rendering path scales via drawImage | **pass** (code path; validated at dpr 1) |
| Direct-file open: `file://` load runs at 60 fps, no console errors, network log shows only the document itself — **no external assets or services fetched** (also true over HTTP) | **pass** |
| Performance: 60 fps sustained at default (288×222, 4 substeps); 57 fps briefly during scripted instrumentation; stable with persistence, all modes | **pass** |
| Persistence display (0.9) produces phosphor trails (`14-persistence-trails.png`) | **pass** |

## Bugs found during validation and fixed (with retest)

1. **`#probeEmpty` destroyed by `innerHTML=''` clearing** → null crash at startup probe panel build. Fixed by removing only `.item` children + null guards. Retest: clean boot, no errors.
2. **Wave died before reaching slits** — default damping σ=0.02 decayed amplitude by e^(−σt/2) ≈ 92% across the field. Reduced preset σ to 0.001–0.0025. Retest: incident 0.64, transmitted pattern 0.25, probes live.
3. **Probe FFT frequency wrong for young buffers** (zero-padded ring → garbage peak, read 0.0074 instead of 0.05). Fixed by gating FFT/readouts on a full 256-sample window. Retest: f̂ = 0.0502 exact.
4. **CFL guard used stale dt_eff** — changing dt computed the ratio against the previous dt_eff, so the clamp never engaged (CFL stuck at 59% with c=1.2, dt=1.0). Fixed `computeStability` to use requested `S.sim.dt`. Retest: 170% → clamped to 0.58, badge shown; unstable path verified to actually NaN.
5. **`setPointerCapture` threw on synthetic pointer IDs**, aborting pointer handlers (broke scripted drag tests; potential fragility with some touch digitizers). Wrapped in try/catch. Retest: drag flows all pass.
6. **Slit apertures rasterized too narrow + point-source presets too dim** — replaced slit presets with plane-wave (line-source) illumination, widened slit widths, tuned per-preset exposure. Retest: transmitted interference pattern strong and visible.
7. **Lens/medium invisible in wave modes** — added a subtle warm tint for medium cells when "Highlight structures" is on. Retest: `11-lens-drawn-live.png` shows the drawn lens band.

## Not run / limitations (honest)

- **Touch input** was exercised through the unified Pointer Events path (mouse pointer events through the same handlers); no separate finger-touch hardware emulation was run. Pen/touch-specific quirks (e.g. `pointercancel` on gestures) are handled but were not exercised on real hardware.
- **Audio**: not part of the requirements; none implemented, nothing claimed.
- A cosmetic transient: for ~1–2 s after a preset switch, probe readouts can show near-zero RMS while the measurement window refills (buffers intentionally reset with the scene). Values converge to correct steady-state (verified: A 0.129, f̂ 0.0502).
- Phased-array steering produces grating lobes at this element spacing (spacing > λ/2). This is correct wave physics, not a defect; reducing element count/span or raising frequency reduces them.
- Restored an unrelated dev server on port 8137 (sibling project) that my first port probe collided with; my own dev server (8164) was stopped after validation.

## Evidence files

Screenshots in `evidence/screenshots/`: `00` final default (file://), `01` default double slit, `02` two-source fringes,
`03` wall drawn over slit (barrier→diffraction change), `04` refraction, `05` lens focus, `06` probes on node/antinode,
`07a/b` array steering Δφ 60°/300°, `08` standing-wave cavity, `09` pulse obstacle maze, `10` single slit,
`11` live-drawn lens, `12/13` narrow viewport + drawer, `14` persistence trails, `15` phase mode, `16` energy-flow mode.
