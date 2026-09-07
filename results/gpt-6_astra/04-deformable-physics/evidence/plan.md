# Softlab implementation and validation plan

Goal: deliver a complete, offline, self-contained index.html with real deformable dynamics and an approachable visual workbench.

The supplied requirements authorize an uninterrupted design, implementation, and validation run. Work in the supplied empty directory; no repository or build system is present.

## Design
Use embedded CSS, SVG icons, and Canvas 2D. Keep a pure physics engine in one inline script and the UI/rendering in another. Use fixed world coordinates, a high-DPI camera, position-based distance/area constraints, structural/shear/bending links, pins and attachments, spatial hashing, particle/edge contacts, and static boundary contacts. Constraint cuts remove actual graph edges and cloth triangles. Pressure is disabled when a balloon boundary is punctured. Pointer capture and swept-segment cutting preserve input continuity.

Alternative considered: spring forces require smaller time steps for stable stiff cloth; rigid shape animation cannot satisfy deformable dynamics. Position-based projection gives direct stiffness, substep, and iteration control while remaining robust under editing.

## Sequence
- [x] Write and run behavioral engine checks before the engine exists: gravity and pin invariance, convergence, contact separation, persistent cuts, and pressure preservation.
- [x] Implement particle/constraint/area solver and actual collision geometry in index.html; run engine checks.
- [x] Build eight scenarios, interaction tools, all world/material/solver controls, diagnostics and render modes.
- [x] Build responsive polished UI, keyboard help, high-DPI camera, spawn placement and limit/error feedback.
- [x] Validate using agent-browser 0.31.1: direct file, offline, desktop 1280x800 and narrow 390x844; real mouse/keyboard controls and canvas interactions; live diagnostics and screenshots.
- [x] Reproduce and fix failures. Repeat failed flows and a compact regression. Record exact commands, evidence, and limitations in validation.md.

## Acceptance observations
The public checks are browser workflows, not source checks. Record graph counts and particle coordinates around real grab/pin/cut/tear actions; material strain and contact evidence around physics changes; preserved positions when changing views while paused; exactly one simulation frame when stepping; all scenarios remain finite. Capture errors, console and network requests. No application runtime dependencies, imports, remote fonts, or fetch calls.
