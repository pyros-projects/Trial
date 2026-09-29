# Nightjar design and implementation plan

Goal: deliver a polished, replayable systemic stealth game in one offline HTML file. The user's complete brief authorizes autonomous implementation and browser validation in one run; intermediate design approval gates are superseded by that instruction.

Architecture: embed a dependency-free simulation script, presentation script, CSS, and inline SVG interface icons in index.html. The simulation owns seeded room assembly, collision, breadth-first grid navigation, line-of-sight ray tracing, acoustic events, independent guard state machines, security, tools, objectives, and run records. Presentation renders actual simulation state with Canvas and DOM and synthesizes audio after a gesture. Only development evidence and harnesses live outside index.html.

Design: Nightjar / The Meridian Archive. Muted ink, mint, warm paper, technical typography, a legible architectural map with pools of light and teal infiltrator. Six connected rooms around a service corridor, loops, cover, access terminal, locked vault, optional loot, cameras, entry/extraction. Dry Run offers a smaller, quieter but fully systemic mission. Difficulty changes perception, guard count and tool charges. Mobile uses a follow camera, tap navigation, and a captured virtual stick with dedicated actions.

Review focus: disconnected seeded maps; AI seeing or moving through closed geometry; held input after modal/focus/pointer cancellation; corrupted local storage/imports; mobile camera conversion and high-DPI canvas sizing.

- [x] Write simulation behavior tests and observe missing-artifact failure.
- [x] Implement seeded maps, collision, pathfinding and occluded perception; verify connected routes for all presets/difficulties.
- [x] Implement guards, sound, cameras, access doors, three finite tools, mission loop and record generation; run behavioral tests.
- [x] Implement polished responsive UI, rendering, minimap, controls, options, audio, history and validated JSON import/export.
- [x] Validate through agent-browser at 1280x800 and 390x844, directly via file URL with external networking blocked. Complete Dry Run through real movement/interactions, provoke AI, hide, inspect live diagnostics, toggle overlays, pause/restart and seed replay.
- [x] Reproduce and fix observed defects, repeat failing flow and compact regression; record exact commands, screenshots, logs and limits in evidence/validation.md.
