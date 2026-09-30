# Atmos Implementation Plan

> Execute inline using executing-plans. User requested a complete autonomous run.

**Goal:** Deliver a polished, coupled 3D weather simulator in index.html.
**Architecture:** A CPU atmosphere engine supplies 3D/2D textures to native WebGL2 shaders; DOM controls, canvas diagnostics and state tools use the same model.
**Tech stack:** Embedded HTML/CSS/JavaScript/GLSL only.
**Spec:** evidence/design.md

## Global constraints
- One self-contained index.html; zero external runtime dependencies.
- Meaningful evolving wind, temperature, vapor, cloud, rain and pressure fields.
- Direct-file compatible; real browser validation; preserve evidence.

## Review focus
- Malformed or oversized state imports must not mutate the current simulation.
- Grid rebuild while running must preserve usable controls and matching GPU dimensions.
- Continuous touch/pointer brushes and camera gestures must not get stuck.
- Pausing must stop numerical time; a step must advance exactly one requested interval.
- Renderer absence or shader failure must produce a useful recovery panel.

## Tasks
- [x] 1. Write failing numerical behavior tests. Implement deterministic Simulation with reset, step, brush, save/load, diagnostics; run tests.
- [x] 2. Implement responsive instrument workspace, WebGL2 ray marcher, rain/lightning traces, field map and vertical section; verify shader compilation and rendered scene in browser.
- [x] 3. Connect controls, presets, probes, camera gestures, continuous brushes, persistence, state JSON, CSV and PNG; exercise actual main workflow.
- [x] 4. Test desktop and mobile, offline direct file, error states and stress controls; diagnose and fix failures, collect evidence, review and retest.
