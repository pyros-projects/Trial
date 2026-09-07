# SDF Studio implementation plan

Goal: deliver one self-contained index.html implementing the complete requested modeling workflow.
Architecture: vanilla HTML/CSS/JavaScript with an embedded WebGL2 sphere tracer. An ordered field stack supports 32 objects, exact primitive fields and conservative transformed/deformed distance bounds. Rendering, diagnostics and GPU picking share one shader. Scene state is validated, deterministic JSON; localStorage is optional and failure-tolerant.
Tech stack: browser APIs only; Node and agent-browser are development-only.
Spec: the complete user requirements in this conversation. The user explicitly authorized an uninterrupted end-to-end implementation, so inline execution proceeds without additional design approval.

Design: “FORM / SDF Studio”, graphite chrome, mint accent, large studio viewport, left scene and preset library, right inspector, compact render settings and performance status. Mobile uses scene/inspector drawers with a persistent viewport. Default artwork is a sculptural loop and smoothly merged satellite forms on a circular plinth. Controls use accessible names and keyboard shortcuts.

- [x] Establish numerical tests for primitive signs, transform conservatism, ordered CSG, smooth operations and scene validation. Run before implementation and record the expected missing-artifact failure.
- [x] Implement embedded scene core, eight required primitives plus deformed/repeating fields, six presets, stable serialization and validation.
- [x] Implement GPU sphere tracing, normals, light/shadow/AO, procedural materials, environment approximation, fog/tone mapping, all diagnostic modes and exact GPU picking.
- [x] Implement complete scene stack editor, numeric inspector, screen-plane and axis translation, orbit/pan/zoom/focus/reset, quality controls, time, persistence, import/export and PNG.
- [x] Inspect direct-file rendering with agent-browser, exercise real UI and pointer/keyboard workflows at 1280×800 and 390×844, record screenshots, console, errors and network requests.
- [x] Reproduce and fix observed problems, retest failed flows and compact regression. Review artifact dependencies and write evidence/validation.md with honest coverage and limitations.

Verification commands: node evidence/tests/core.test.cjs; agent-browser --session sdf open file:///home/pyro/projects/naked/astra/bench/08-sdf-csg-studio/index.html; agent-browser snapshot -i; labeled form controls, mouse down/move/up, keyboard input, screenshot, errors, console, network requests. Import/export round trip will compare actual serialized state before/after UI actions.
