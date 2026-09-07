# Wave laboratory implementation plan

Goal: Deliver a complete, offline, single-file numerical wave laboratory at `index.html`.

Architecture: A typed-array finite-difference scalar wave solver supplies all visualizations and probes. Canvas renders the grid and editable objects. Native labeled HTML controls manage the scene, source parameters, solver settings, diagnostics, and local scene files.

Constraints: No runtime dependencies, imports, build process, server, or network. Support direct file opening, high DPI, desktop 1280×800, and narrow 390×844. Use the installed agent-browser CLI for actual interaction tests. User explicitly authorizes continuous implementation and validation in one run.

Design decisions: Use a CPU solver for portable file compatibility and observable field arrays; a WebGL solver would improve very large grids but add unnecessary device variability. Keep numerical, scene, renderer, and UI modules separated within inline script sections. Use a damped kick-drift finite-difference method with a conservative two-dimensional CFL clamp, physical world coordinates, additive emitters, and explicit material rasterization. A light instrument shell surrounds a dark diverging-color field. Expose diagnostics as read-only live state, never special test behavior.

- [x] Test and implement solver: propagation, additive interference/cancellation, obstacle shadow, material delay, stability, damping, clear. Run genuine solver tests extracted from the delivered artifact with Node.
- [x] Implement canvas rendering, continuous pointer editing, source/structure/probe selection, all eight presets, all diagnostic modes, and source/global controls.
- [x] Implement local scene save/load, validated import/export, keyboard controls, help, and responsive/high-DPI layout.
- [x] Run the actual application in agent-browser with external requests blocked. Test public workflows with labeled controls, pointer drags, keyboard inputs, screenshots, field/probe diagnostics, console/errors, direct file opening, and both viewport sizes.
- [x] Diagnose and fix observed failures; rerun the failed flows and compact regression. Write exact evidence and limitations in validation.md.
