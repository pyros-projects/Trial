# Flux implementation plan

Goal: Deliver a complete interactive fluid laboratory in one standalone index.html.

Architecture: WebGL2 ping-pong floating-point textures hold velocity, pressure, divergence, curl, and RGB dye. Semi-Lagrangian advection, iterative viscosity diffusion, vorticity confinement, and a Jacobi pressure projection update a continuous grid. A separate dye grid preserves visual detail. Inline HTML/CSS/SVG supplies the entire responsive interface; no runtime dependencies.

Approach considered: A CPU Canvas solver is broadly portable but limits field detail. WebGL2 moves numerical work to the GPU and is selected. Unsupported contexts receive an actionable fallback screen. The supplied request authorizes independent design and end-to-end implementation, so no review pause or separate branch is needed in this empty delivery directory.

Constraints: Single index.html; no libraries, imports, external assets, fetches, or server required. Pointer/touch and keyboard support. Desktop 1280x800 and mobile 390x844 validation. Evidence outside the delivered HTML.

- [x] Build solver and startup scene. Verify real GPU fields contain finite velocity and dye, projection reduces divergence, and input injects directional momentum.
- [x] Build interface: pause/resume, reset, clear dye, resolution, simulation speed, viscosity, pressure iterations, vorticity, velocity/dye dissipation, interaction force/radius/color; dye/velocity/pressure/curl/divergence modes.
- [x] Connect continuous coalesced pointer strokes, keyboard shortcuts, responsive layout, resize preservation, DPR scaling, status/diagnostics, and unsupported/context-loss handling.
- [x] Validate directly from file with agent-browser and external network disabled. Use labeled controls and real pointer/keyboard input; inspect screenshots, GPU readbacks, errors, and network activity.
- [x] Reproduce and fix observed failures. Retest failed flows and compact regression. Record exact commands, measurements, screenshots, and limitations in evidence/validation.md.

Numerical reference consulted: NVIDIA GPU Gems chapter 38, “Fast Fluid Dynamics Simulation on the GPU,” https://developer.nvidia.com/gpugems/gpugems/part-vi-beyond-triangles/chapter-38-fast-fluid-dynamics-simulation-gpu . Independent implementation of the described stable-fluids approach; no fetched runtime code.
