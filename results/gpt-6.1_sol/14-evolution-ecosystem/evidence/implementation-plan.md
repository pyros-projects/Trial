# Evolutionary Ecosystem Laboratory implementation plan

Goal: deliver the user's complete standalone ecosystem laboratory in index.html, then validate genuine behavior with agent-browser 0.31.1.

Architecture: separate inline engine, renderer, and interface scripts. Fixed deterministic simulation steps use a seeded PRNG, spatial hash for local sensing, tile fields for finite renewable food, and retained lineage records. Canvas renders the live world; HTML controls and inspection expose the same state. Persistence includes PRNG state, terrain, organisms, evolved genes, ancestry, interventions, settings, camera, and history.

Constraints: one HTML artifact, no runtime dependencies or requests, direct file compatibility, high DPI, desktop and touch layouts, all required presets and diagnostic views. Evidence and tests stay outside index.html. User explicitly authorizes continuous implementation, overriding skill review pauses; no repository exists, so no commits or worktree are needed.

- [x] Engine: deterministic initial conditions and continuation; bounded energy transfer, resources, local inherited decisions, reproduction, mutation, stable clusters, lineage, climate, interventions.
- [x] Interface: polished observation workspace, controls, presets, parameter sliders, pointer tools, selected agent diagnostics, ancestry, charts, responsive layouts.
- [x] Persistence: validated atomic JSON import, autosave and restore, JSON/CSV/PNG export, complete state including camera.
- [x] Verification: unit checks for determinism, ecological dynamics, energy/reproduction coherence, inheritance, interventions, serialization and malformed input; browser pointer/keyboard workflows at 1280×800 and 390×844; console and requests; direct file and offline HTTP.

Review focus: invalid and oversized imports leave current state intact; reset uses the displayed seed and preset; painting stays continuous at 16×; selection and follow survive births/deaths; narrow layout gives access to every control.
