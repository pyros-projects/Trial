# Falling-Sand Alchemy — design and implementation plan

Goal: Deliver a polished, offline, single-file interactive material lab at `index.html`, with persistent material reactions and real-browser evidence.

Architecture: Two embedded scripts: a typed-array simulation engine and a UI/rendering controller. Cell state includes material, temperature, velocity, charge, fuel, lifetime, salinity, activity, and update stamp. A seeded RNG drives all simulation randomness. Canvas rendering and native controls require no resources outside the file.

Design: Charcoal laboratory interface with sand-gold accents, a grouped palette, central scene, context inspector, and world presets. Default scene is a moving volcano beside an ocean. Narrow screens use drawers for palette/settings while retaining the canvas and playback controls.

Constraints: One self-contained HTML file; no runtime dependencies or network; direct-file compatibility; pointer/touch interpolation; high-DPI rendering; complete state round trip; meaningful live diagnostics. User explicitly requests an autonomous end-to-end run, so implementation and validation proceed inline.

Review focus: Rapid pointer strokes; paused painting and exact single steps; invalid imports leave the current world intact; resolution changes preserve state; mobile drawer controls and scrolling; no external requests; deterministic reset; bounded stress performance.

- [x] 1. Write and run initially failing behavioral engine tests for persistent transformations, conduction, corrosion, growth, density, phase changes, deterministic seeds, and serialization.
- [x] 2. Implement typed-array engine in `index.html`: density displacement, liquid/gas movement, thermal exchange and phase transitions, combustion, dissolving, conduction, corrosion, growth, impulses, and seeded elaborate scenes. Run engine tests and correct causes of failures.
- [x] 3. Build the responsive interface, all brush/world controls, actual property visualizations, interpolated pointer input, keyboard shortcuts, save/load/export, autosave, and guide.
- [x] 4. Run agent-browser 0.31.1: file:// loading offline, desktop/narrow screenshots, pointer painting and at least three reactions, heat/cool and diagnostics, playback/reset/clear, imports/exports/autosave, and stress scene. Inspect console/errors/requests and live engine data.
- [x] 5. Reproduce and repair failures, repeat affected workflows and a compact regression. Write `evidence/validation.md` with honest status and retained artifacts.
