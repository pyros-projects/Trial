# Falling-Sand Alchemy Sandbox Implementation Plan

**Goal:** Deliver a complete, responsive, offline sandbox in `../index.html`.
**Architecture:** A typed-array cellular simulation owns every material, temperature, velocity, charge, fuel, lifetime, salinity, and reaction value. An embedded Canvas renderer and HTML controls operate on that same state. A versioned compact binary-in-JSON format preserves the complete state, seed, controls, and PRNG position.
**Technology:** HTML, CSS, JavaScript, Canvas 2D; no runtime dependencies or requests.
**Spec:** User requirements in this conversation. The explicit one-run authorization supersedes skill approval pauses. This is an empty dedicated workspace, not a git checkout; no branch or commit is required.

## Design choices
- CPU cellular engine with alternating traversal, typed arrays, bounded neighbor operations, and configurable resolution. This provides transparent per-cell diagnostics and predictable offline browser compatibility.
- Dark laboratory interface with coral accents, grouped materials, immediate preset motion, responsive panels, discoverable tools, and keyboard hints.
- Deterministic simulation and preset RNG. Physics includes density swaps, fluid spreading, gas buoyancy, conduction, phase changes, dissolving, fuel consumption, corrosion, growth, charge propagation, and explosion impulses.
- Snapshots validate all types and ranges before replacing any state. Invalid imports leave the current world intact. Autosave is optional and fails visibly if storage is unavailable.

## Tasks
- [x] Write executable engine contract tests before implementation; confirm missing-engine failure.
- [x] Implement the engine and run tests for persistent phases, density, fuel, corrosion, charge, growth, seed/reset consistency, and snapshot round trips.
- [x] Build embedded interface, controls, tools, interpolation, renderer, and nine detailed scenes.
- [x] Validate with installed agent-browser 0.31.1 using direct-file navigation and network blocking, actual pointer strokes, keyboard, controls, diagnostics, and downloads/imports.
- [x] Validate 1280 × 800 and 390 × 844, check console/errors/network, capture screenshots and live state.
- [x] Reproduce/fix failures and run compact regressions. Complete validation.md with honest pass/fail/blocked coverage.

## Test contracts
`AlchemyEngine(width,height,seed)` exposes `set(x,y,material,temp?)`, `step(settings?)`, `stats()`, `serialize(settings)`, `load(snapshot)`, and typed-array state. Tests use the real extracted inline engine, with no DOM mocks. Warm water must become steam; cold water must become ice; metal must retain transmitted charge; acid must consume vulnerable wood; a failed import must not change the grid. Browser tests interact with controls and pointer input; read-only `window.alchemy.inspect()` reports the same simulation used by rendering.

## Completion
Delivered `../index.html` (104,718 bytes). Engine 16/16; main browser workflow 15/15; advanced browser workflow 14/14; final compact regression, offline autosave reload, and mobile/DPR/touch checks pass. Details and performance limits are in `validation.md`.
