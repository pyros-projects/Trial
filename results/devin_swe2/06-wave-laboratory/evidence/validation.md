# Wave Laboratory — Validation Evidence

Artifact: `../index.html` — single self-contained file, no external deps (verified: zero network
requests besides the document itself; `network requests` showed only `index.html` + favicon 404;
grep found no `http`/`fetch`/`import`/`src=` references).

Tested with `agent-browser` 0.31.1 (Chromium via CDP), served over `http://127.0.0.1:8630` and
opened directly via `file://`. Viewports: 1280×800 and 390×844.

## Environment

- Solver: 2-D FDTD leapfrog `u_tt = c(x,y)²∇²u − γu_t`, 5-point stencil, per-cell speed/damping,
  Dirichlet walls, absorber cells, sponge/reflecting/periodic boundaries.
- Default scene: two point sources at f=0.08 → immediate interference fringes (screenshot 01).

## Public checks

| Check | Method | Result |
|---|---|---|
| Multiple sources interfere | `two` preset; intensity mode shows static hyperbolic nodal lines | PASS (01, 05-int, 12) |
| Adding a barrier changes field | Reflector drag at gx=280 → mean \|u\| left 0.107 vs right 0.055; wall rendered, shadow + diffraction around ends | PASS (02) |
| Refractive region alters propagation | Medium brush n=1.6, ~6.5k cells → sign flips/row 44 inside vs 27 outside (λ compressed ~1.6×); visible wavefront compression | PASS (03) |
| Probe reflects local field | Two probes placed by pointer; rms 0.207 vs 0.110, dominant f = 0.078 vs expected 0.08 (nearest FFT bin); live waveform + spectrum cards | PASS (04) |
| Timestep → stability indicator | dt=0.95 → HUD `CFL 1.34 UNSTABLE`, red hint; field diverged (max 3e38, NaN) → watchdog auto-paused + toast | PASS |
| Wave speed → stability | c=1.5 → CFL 1.06 flagged; c=1.0 → 0.71 | PASS |
| Switch diagnostics while running | All 6 modes cycled live: amp/int/phase/grad/med/flow | PASS (05-*, 13) |
| Clear / pause / single-step / reset | Clear → field energy 0.00; pause froze t; two steps advanced t by exactly 2·dt (186→187); reset restored default + resumed | PASS |
| Presets | double, single, two, cavity, lens, refr, array, maze all exercised via buttons | PASS (06-*, 07, 08, 12) |

## Extra coverage

- Point/line/array/probe placement by pointer drag: line drag → 80-cell source; array drag →
  beam angle follows drag (−135°). PASS
- Source drag-move (38,128)→(38,61), auto-select. PASS
- Live phase-step edit on selected array: element phases 0,60,…,420°. PASS
- Eraser removed all 1764 painted wall cells. PASS; absorber brush painted 1222 cells. PASS
- Resolution change 384×256→512×342→640×428: masks + sources resampled, 60 fps at 640×428. PASS
- Boundary select absorb/reflect/periodic: all run without errors. PASS
- Space toggles pause; N steps when paused. PASS
- file:// open: sim running, t advancing, field live, no console errors. PASS (11)
- Narrow 390×844: canvas letterboxed, HUD intact, ☰ drawer panel opens with all controls. PASS (09, 10)
- External network: none — pure inline single file. PASS

## Bugs found and fixed during validation

1. Probe FFT dominant frequency was off by the substep factor (sampled per frame, not per
   substep) — read 0.242 vs true 0.08. Fixed by sampling inside the substep loop. Retest: 0.078.
2. Preset/reset after watchdog pause left sim frozen — presets now resume running. Retest: RUN.
3. `med` viz mode rendered n=1 as dull red and double-drew the overlay — remapped (n=1 → black,
   n<1 blue, n>1 thermal) and overlay skipped in med mode. Retest: 13-med-fixed.png.
4. `maze` pulse fired once before user could see it — now repeats every 160 t-units and pulse
   sources gained a `fire` button. Retest: 07-maze-pulse.png shows burst + scattering.

## Remaining limitations

- "Phase" mode is an estimator (atan2 of u vs u−u_prev), amplitude-masked — qualitative, not a
  true Hilbert phase.
- Periodic boundary verified non-divergent and stencil-correct, but wrap-around propagation was
  not pixel-verified end-to-end.
- Touch input: pointer events + `touch-action:none` are implemented; only synthetic pointer events
  were exercised in testing (desktop harness).
