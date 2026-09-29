# FIELD — SDF and CSG Studio

Intent: deliver a complete editable ray-marched modeling studio in one self-contained index.html, with no network or runtime dependencies. Success is coherent CSG, accurate surface picking, useful diagnostics, and a polished usable desktop/mobile editor. The user's one-run instruction authorizes implementation and testing without intermediate approval handoffs.

Design: use WebGL2 with a full-screen triangle and an ordered, uniform-driven SDF field stack (32 objects). Each primitive is transformed into local space, conservatively rescaled, and composed with an explicit operation. The GPU supplies surface ownership, steps, and hit position through a small picking render. Shading derives normals, soft shadows, AO, atmosphere, and material response from the same field. The editor uses native accessible controls, SVG icons, an axis translation gizmo, orbit/pan/zoom, presets, and a JSON scene document. A separate core script provides validation and deterministic serialization; no libraries are required.

Visual direction: graphite editor chrome, warm ivory canvas, violet selection, generous viewport, quiet monospaced numerical details, and a coral ceramic sculpture. Responsive side drawers preserve the viewport on phones.

# Implementation plan

Execution: inline in the supplied workspace. There is no git repository, so worktree/commit/review-range commands are inapplicable; retain the ledger and evidence instead.

Global constraints: final artifact index.html only; all HTML/CSS/JS/GLSL/SVG embedded; direct file loading; WebGL2 with explicit unsupported/error UI; no fetched resources. Evidence/test tooling is outside the artifact.

Review focus: malformed or oversized imports must not damage the current scene; non-uniform scales must not overstep surfaces; subtractive surfaces must pick the cutter; dragging must remain continuous after pointer capture; narrow-screen drawers must not trap or obscure primary workflows.

- [x] Task 1: Scene core. Write meaningful failing tests for import validation, identity preservation and deterministic round trips; implement the real core inside index.html; run Node VM tests against the embedded script.
- [x] Task 2: Renderer. Implement transformed primitives, ordered CSG, shading, true diagnostic modes and GPU picking. Validate shader compilation and rendered pixels in an actual browser.
- [x] Task 3: Editor. Connect scene operations, transforms/materials, render settings, camera, translation gizmo, undo/redo, animation, presets, and persistence. Exercise controls with pointer and keyboard.
- [x] Task 4: Delivery. JSON/file/copy and PNG exports, validated imports, adaptive desktop/mobile layout and explicit errors. Test export/import round trip and direct-file loading with external traffic blocked.
- [x] Task 5: Exploratory verification. Run public workflow at 1280×800 and responsive workflow at 390×844, inspect screenshots and live renderer state, fix reproduced failures and retest. Record exact commands, outcomes and limitations in validation.md.

Checks: node evidence/tests/core.test.cjs; node --check on extracted application scripts; agent-browser snapshots, labeled control interactions, mouse/key gestures, screenshots, console/errors/network logs, GPU pixel probes. Use actual rendered pixel and hit diagnostics, not source presence, for renderer checks.
