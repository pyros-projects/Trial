# Orbital sandbox implementation plan

Goal: deliver the user's complete, offline single-file orbital mechanics and mission-planning sandbox.
Architecture: one HTML document with a pure numerical engine, Canvas renderer, semantic DOM controls, and a persisted mission state. The map and prediction share the same N-body solver. All visuals are native Canvas/CSS/SVG.
Global constraints: deliver index.html in this directory; no runtime dependencies, network requests or external assets; validate actual user workflows in agent-browser at 1280×800 and 390×844, including direct file opening.

Design decisions: planar, normalized DU / TU / MU with G=1 by default. All bodies gravitate pairwise, including spacecraft. Velocity Verlet with gravitational softening and encounter-based subdivision. Burns are instantaneous impulses split at their exact execution time. Future state snapshots retain every body so all trajectories can transform at their own timestamp. Osculating elements are explicitly two-body approximations. Energy diagnostics account separately for impulses/collisions and numerical drift.

- [x] Task 1: pure engine in evidence/physics.js, embedded in final index.html. Tests first: circular two-body orbit and conservation, reaction of both bodies, correct exact-time burn, predicted/live equivalence, rotating-frame velocity, scenario finite state and collision behavior. API contract in engine-brief.md. Node test runner only for development.
- [x] Task 2: dark mission-control interface in index.html. Header navigation, scene presets, object list/telemetry, central Canvas, maneuver editor, bottom time controller. Implement coherent frames, DPI resize, selection/pan/zoom/paused edits, map-based nodes, overlays, settings, mission save/load/import/export/help.
- [x] Task 3: integrate engine and UI. Expose a read-only live diagnostics snapshot for checking Canvas state. Validate inputs, controls, error handling and persistence. Predictions recompute on edits and periodically while running; configurable sample count without altering integration dt.
- [x] Task 4: independent code review plus real browser desktop/mobile/direct-file validation. Record failures immediately, fix causes and retest. Preserve exact commands, screenshots and observed measurements in evidence/validation.md.

Ruling: the user's explicit one-run build instruction authorizes design and implementation without intermediate approval gates. Work in the supplied blank directory and preserve the required delivery path. Evidence folder is a sibling of index.html. No Git repository was assumed.

Completion: all four work items implemented and verified. Final delivery remains index.html alone; evidence and development harnesses are separate. No Git repository, build process, deployment or external service is required.
