# Black Hole Explorer implementation plan

Goal: deliver the complete self-contained index.html requested in the prompt and validate real rendering and interactions.
Architecture: embedded WebGL2 shaders integrate curved rays; an embedded matching JavaScript integrator traces selected rays. Native DOM controls and Canvas2D overlays provide camera, inspection, and responsive layout. No runtime dependency or request.
Spec: the user's Black Hole and Gravitational Lensing Explorer requirements.

User explicitly requests one autonomous end-to-end run. Proceed inline without staged approval. The directory is empty and is not a git repository; no worktree or commits are applicable. Keep all development evidence in evidence/ next to index.html.

Constraints: single file, no external library, no assets, no server needed at runtime; 1280×800 and 390×844 browser checks; offline/direct-file validation; honest status and remaining limitations.

Design: dark observatory interface, amber disk and sparse procedural stars, teal scientific controls. Persistent view preferences, orbit/pan/zoom and camera presets; native range controls grouped into Scene, Camera, and Render tabs. A mode picker exposes steps, bending, frequency factors, disk coordinates, closest approach, and outcome. World-space guide overlays and selected-ray diagram support inspection. A model-notes dialog explains approximation boundaries.

Review focus: prolonged pointer drag and touch gestures, clipping on small screens, numerical instability near the critical impact parameter, exhausted integration budget, WebGL unavailable/context loss.

- [x] Task 1: numerical core. Write and run failing tests for straight zero-mass rays, central capture, gravity-induced bending, step convergence, Doppler asymmetry and parameter constraints. Embed pure functions in index.html, then run tests.
- [x] Task 2: rendering and interface. Implement velocity-Verlet integration with adaptive affine steps in GLSL. Composite a finite-thickness disk with radial temperature, turbulent density, frequency shift and beaming. Generate environment stars procedurally; add accumulation and a bloom postprocess. Wire every required control and ray/geometry overlays.
- [x] Task 3: actual browser validation. Read installed agent-browser core and exploratory workflow (completed). Open delivered file offline, inspect screenshots and diagnostics, exercise labeled controls, pointer/keyboard, quality and resize. Record actual results and fix/retest failures. Test graceful WebGL unavailable and context loss.
- [x] Task 4: final artifact review. Verify self containment, script syntax and physics tests. Finish validation.md, retain logs/screenshots, report limitations.

Model sources consulted during development: Eric Bruneton, Real-time High-Quality Rendering of Non-Rotating Black Holes (2020), https://ebruneton.github.io/black_hole_shader/paper.pdf; James et al., Gravitational Lensing by Spinning Black Holes in Astrophysics, and in the Movie Interstellar, https://arxiv.org/abs/1502.03808. This implementation is original, uses numerical integration rather than source LUT assets, and labels its spin term as an approximation.
