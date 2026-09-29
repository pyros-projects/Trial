# Hydraulic Erosion Laboratory Implementation Plan

Goal: Deliver the complete self-contained index.html specified by the user.
Architecture: Typed-array heightfield solver, embedded WebGL shaders/mesh, native DOM controls and Pointer Events. No runtime dependencies.
Spec: design.md and the full user application requirements.
Execution: Inline, in the explicitly requested end-to-end agentic run.

- [x] 1. Write and run behavioral solver tests (determinism, downhill transport, conserved material, evaporation, stable stress parameters, brush editing and state validation) before implementing the solver.
- [x] 2. Implement the solver in index.html and pass the numerical suite. Generate recognizable drainage terrain with deterministic noise and selected terrain parameters.
- [x] 3. Add polished responsive UI and WebGL terrain/water renderer, surface normals, diagnostic modes, camera and brush ray picking. Connect every control to genuine state.
- [x] 4. Implement pause/step/reset/regenerate, presets, resolution changes, probing, PNG export, complete JSON round trip, rejected invalid imports, shortcuts and touch.
- [x] 5. Validate through agent-browser at 1280×800 and 390×844: pointer edits, camera, simulation evolution, parameter effects, all modes, navigation, exports/imports, console and requests. Open file:// directly; inspect offline rendering. Reproduce and fix failures, repeat affected flows and numerical suite.
- [x] 6. Final review, fresh regression verification, write evidence/validation.md and concise delivery note with limitations.

Review focus: positivity and material conservation at high flow; import atomicity; pointer continuity/camera separation; high-DPI resizing and mobile controls; WebGL errors and external network independence.
