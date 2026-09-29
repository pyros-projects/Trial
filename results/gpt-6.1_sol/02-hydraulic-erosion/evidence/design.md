# Hydraulic erosion laboratory design

The user's brief is the specification. Build a complete, offline, single-file lab in this end-to-end run, with no design approval pauses or runtime dependencies.

The delivered index.html contains three internal units: a conservative CPU heightfield solver, an embedded WebGL renderer, and the control/pointer/file interface. Terrain, water depth, suspended sediment, directional flux, velocity, and cumulative erosion/deposition remain mutable and inspectable. Limited outward flux guarantees nonnegative water; sediment follows those same fluxes. Capacity depends on water, speed, and slope. Bed exchange, evaporation deposition, and talus redistribution close the erosion cycle. Closed boundaries permit pooling. Seeded multi-scale terrain gives mountain, canyon, island, and valley forms.

The scene uses perspective, dynamic heightfield normals, procedural terrain materials, water, a cutaway base, soft atmospheric shading, contours, and diagnostic palettes. Camera and editing tools have distinct primary gestures; secondary drag and a camera modifier work in editing modes. Pointer capture maintains strokes outside the canvas. A finite, adaptive work budget prevents catch-up loops.

A dark, warm instrument panel includes presets, simulation/terrain/display tabs, a compact brush toolbar, live status, probe, legends, and local PNG/JSON file operations. Desktop and narrow layouts preserve the canvas and controls. Malformed imports are rejected before mutation. Context loss is surfaced and recoverable. Tests cover numerical invariants and browser workflows; evidence records actual results.
