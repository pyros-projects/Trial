# Weather Laboratory Implementation Plan

Goal: deliver a complete offline, single-file 3D atmospheric laboratory in index.html.
Architecture: a deterministic CPU grid model feeds WebGL2 3D density and diagnostic textures. A ray-marched renderer displays terrain, volumetric clouds, precipitation, haze and lightning. Native HTML controls and Canvas2D diagnostics share the same simulation state.
Tech stack: embedded HTML/CSS/JavaScript/GLSL, WebGL2 and optional Web Audio. No runtime dependencies.
Spec: user requirements in this conversation.

- [x] Numerical model: test seeded reproducibility, evolving coupled fields, interventions, finite stress behavior and complete state roundtrip. Implement semi-Lagrangian transport, diffusion, pressure gradients, uplift, condensation/latent heating, rainfall and surface water.
- [x] Interface and renderer: build the responsive laboratory, WebGL2 sky/terrain/volume pipeline, field modes, map/section, probe charts, orbit/pan/zoom/fly cameras, continuous pointer brushes and all controls.
- [x] Lifecycle and exports: integrate pause/step/reset, preset and grid changes, state validation/import/export, probe CSV, PNG, settings persistence, audio and error handling.
- [x] Browser validation: use installed agent-browser 0.31.1 core and dogfood workflows. Exercise actual desktop and touch-size controls, offline file load, field evolution and interventions. Capture diagnostics and screenshots, fix reproduced issues and retest.
- [x] Final artifact audit: no external assets/requests, syntax/model checks, responsive screenshots and honest validation.md.

Delivery stays in the supplied workspace. evidence/ holds development tests and reports; index.html remains the only runtime artifact.

Completed: delivered artifact audited; numerical suite 19/19, browser flows and final regression passed. Validation and remaining performance/coverage limits recorded in evidence/validation.md.
