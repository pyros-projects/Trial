# Atmos — Weather and Storm Laboratory

Build a self-contained, offline WebGL2 laboratory in index.html. A deterministic finite grid carries temperature, vapor, cloud water, precipitation, wind (u,v,w), and pressure perturbation. Semi-Lagrangian advection, diffusion, saturation adjustment, latent warming, buoyant motion, terrain uplift, surface moisture exchange and rain fallout couple the fields. Surface arrays carry height, type, and wetness. Presets initialize distinct coherent systems.

The scene ray marches simulated cloud density and procedural terrain using embedded shaders and field textures. Lighting, haze, wet surfaces, rain/snow, lightning and wind traces derive from state. A map and vertical section expose the same arrays. Orbit/pan/zoom, fly mode and camera presets share a camera. Continuous brushes intersect terrain or map and modify numerical fields. Probes show all fields, vertical profiles and history.

A cream and ink instrument workspace contains an experiment rail, viewport with compact diagnostic overlay, column inspector and bottom transport bar. Mobile uses accessible drawers and a full-width scene. Controls include numerical and rendering parameters with bounded timestep and stability diagnostics. Complete JSON state export/import is validated atomically; probe CSV, PNG and settings persistence work without a server.

Validation: numerical tests for deterministic evolution, coupled water-cycle response, stability and state validation; actual agent-browser interactions at 1280×800 and 390×844, direct file load with external requests blocked, screenshots and live diagnostics. No external assets or runtime dependencies.
