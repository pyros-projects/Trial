# Elastic Lab — design

Create a complete, polished, offline 2D material playground in one self-contained `index.html`. The user authorized a single uninterrupted build and validation run, so design and implementation review happen within this run.

Use a fixed 1200 × 800 world, a high-DPI Canvas renderer, and a responsive cream/ink/orange instrument interface. Desktop has a scene library, central canvas, and live parameter inspector. Narrow screens keep the canvas and tools available and open scenes/settings in drawers. No fonts, images, scripts, services, or libraries are fetched.

Physics: a symplectic particle integrator plus extended position-based distance and area constraints, pinned particles, attachments, structural/shear/bending cloth edges, elastic spokes, pressure membranes, dynamic circular balls, and static circle/rectangle/capsule geometry. Spatial hashing accelerates particle and edge collisions, with approximate non-neighbor self-collision. Friction, restitution, damping, mass, gravity, and wind act on simulation state. A fixed timestep accumulator and configurable substeps/iterations keep the solver stable.

Interaction: pointer capture and coalesced pointer paths for grab, pin/unpin, cut, tear by pulling, radial impulse, and localized gusts. Object placement includes cloth, rope, elastic body, balloon, rigid ball, and obstacle. Cut/tear mark graph edges dead; cloth triangles depending on those edges disappear permanently; punctured balloons lose pressure. Paused editing is supported without advancing simulated time.

Scenes: mixed playground, hanging flag, draped cloth, loaded bridge, soft stack, suspended ropes, balloon chamber, destructive stress test. Surface, particles, constraints, velocity, stress, contact, pin, and spatial-cell views all display the same world. Actual solver statistics are visible, including FPS, counts, collision pairs, maximum constraint error, iterations, substeps, tool, scene, and pause state.

All requested numerical controls apply live. Preferences are stored locally with a graceful storage fallback. Help explains labeled tools and keyboard shortcuts. Reset restores the current scene; step advances one configured timestep while paused.

Validation: deterministic tests extract the actual embedded physics engine, then agent-browser performs actual pointer/keyboard workflows, controls, spawning, diagnostics, scene switching, pause/step/reset, direct-file offline execution, desktop ≥1280×800, and 390×844. Screenshots and logs go in `evidence/`. Failures are reproduced, fixed, and retested. This directory is an agent-authored record, not an evaluator score.
