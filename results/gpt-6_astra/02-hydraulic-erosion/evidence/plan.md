# Hydraulic Erosion Laboratory implementation plan

The user authorized a complete end-to-end run, including design, implementation, diagnosis, and browser validation. Work stays in the provided empty application directory; the deliverable is index.html. Evidence is a sibling directory to the file.

Design: an instrument-like interface, warm paper controls, dark green 3D viewport, earth-colored terrain, turquoise water, compact labeled tools, and live scientific diagnostics. Use raw WebGL and a CPU finite-volume heightfield. No external runtime resources.

- [x] Test and implement the deterministic terrain and conservative water/sediment kernel. Exercise downhill transport, erosion, dry deposition, evaporation, conservation, reset, and bounds with real state.
- [x] Build the responsive interface and dynamic WebGL terrain, water, bedrock sides, procedural shading, orbit/pan/zoom, overlays, and seven diagnostic views.
- [x] Connect every control, brush, preset, state import/export, grayscale PNG export, numerical safeguards, and context recovery.
- [x] Use installed agent-browser 0.31.1 with its matching core and exploratory-testing workflows. Open file:// directly with network blocked, interact at 1280x800 and 390x844, inspect pixels and live diagnostics, and record errors/requests.
- [x] Exercise the main simulation for enough time to measure geometry changes, compare parameter behavior, test editing and camera continuity, pause/step/reset/regenerate, all modes, exports/import errors, high DPI, and touch. Fix and retest observed failures.
- [x] Finish validation.md with commands, observed results, screenshots, limitations, and an artifact audit.

Simulation: cell-centered water depth and suspended sediment, positivity-limited four-way gravity flux, conservative upwind sediment advection, velocity/slope-dependent carrying capacity, bed erosion and deposition exchange, exponential evaporation with dry deposition, optional conservative talus relaxation, bounded open-edge outflow. Fixed simulation increments and bounded controls isolate numerical stability from frame rate.
