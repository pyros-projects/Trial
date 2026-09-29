# Elastic Lab Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement inline, task by task.

**Goal:** Deliver a working single-file deformable physics playground and honest browser evidence.
**Architecture:** Pure embedded `Physics.World` provides integration, constraints, geometry, collision handling, and graph editing. A second embedded script owns scene composition, Canvas rendering, responsive controls, and input. Read-only live snapshots make non-DOM behavior inspectable.
**Tech Stack:** HTML, CSS, JavaScript, Canvas 2D; Node only for development tests; agent-browser for validation.
**Spec:** `evidence/design.md`.

## Global constraints
- Final artifact: `index.html`; all runtime assets embedded; no runtime dependencies or network.
- Fixed 1200 × 800 world and high-DPI responsive rendering.
- All physics, editing, presets, controls, visualization modes, and diagnostics in the request.
- Real browser inputs and screenshots at 1280 × 800 and 390 × 844; direct file tested when supported.

## Review focus
- Fast drags/cuts keep pointer capture and alter the actual graph without gaps.
- Paused edits/step/reset preserve clear, consistent time and state.
- Extreme parameter values remain finite and do not cause unbounded workloads.
- Resizing and mobile drawers preserve world coordinates and accessible controls.
- Removing membrane edges vents pressure and removing cloth edges removes dependent triangles.

### Task 1 — Physics and graph editing
Files: `index.html`, `evidence/tests/physics.test.cjs`.
Produces: `Physics.World`, `settings`, `particle`, `distance`, `cloth`, `rope`, `soft`, `ball`, `obstacle`, `step`, `cut`, `pin`, `impulse`, `gust`, and accurate statistics.
- [x] Write and run failing tests for gravity, pins, stiffness, pressure, collision, cutting, tearing, and density against the embedded core.
- [x] Implement stable integration, XPBD projection, spatial collision acceleration, material builders, and graph edits.
- [x] Run `node --test evidence/tests/physics.test.cjs`; expected: all pass, finite states.

### Task 2 — Application, rendering, and controls
File: `index.html`.
Consumes: embedded physics API; produces responsive UI and `Playground.snapshot()` diagnostics.
- [x] Build the scene library, high-DPI material renderer, controls, modes, playback, help, and preference storage.
- [x] Implement pointer-captured grab/pin/cut/tear/impulse/gust and six placement types.
- [x] Verify syntax and core tests; open the actual file in agent-browser and inspect initial screen.

### Task 3 — End-to-end validation and repairs
Files: `evidence/validation.md`, screenshots, logs, development-only browser harness if useful.
- [x] Validate actual desktop workflows through labeled controls and real pointer/keyboard input.
- [x] Inspect rendered deformation and corresponding live diagnostics; test all modes and scenes.
- [x] Validate 390 × 844, resizing, rapid input, pause/step/reset, offline file execution, console, and network.
- [x] Reproduce each observed defect, fix the cause, repeat that workflow and compact regression.
- [x] Get a fresh review, repair meaningful issues, and leave the finished artifact and evidence.
