# Wave laboratory design and implementation plan

Goal: a complete, standalone wave laboratory with real numerical propagation, live editing, accurate field probes, and a polished responsive interface. The user's detailed brief is the binding specification; the requested single end-to-end run authorizes design and implementation without intermediate approval gates.

Architecture: two-dimensional centered finite differences on a fixed 12 m × 8 m domain, Float32 buffers, source forcing, material indices, fixed reflecting masks and absorbing layers. The Courant ratio is c_max Δt √2 / Δx; clamp the effective timestep to a ratio of 0.92. Canvas 2D renders actual buffers and overlays, with no dependencies. Editable objects retain world coordinates across resolution changes. Probe histories retain simulation timestamps and field values.

Design: dark instrument-panel interface, cyan and copper signed field, large central viewport, left experiment/tools/source inspector, right numerical/display controls, and live probe strip. Mobile layout places the field first and makes every panel reachable by scrolling. Native labeled form controls, keyboard shortcuts, pointer capture and interpolated strokes.

Execution: inline, incremental. Only index.html is the delivered runtime. Evidence and development tests are sibling files in evidence/. No git repository exists, so worktree/commit/branch steps do not apply. No external app writes or network dependencies are needed.

## Tasks

- [x] 1. Solver: write failing behavioral tests (zero solution, local propagation, linear cancellation, wall blocking, slower medium, CFL clamp); implement embedded WaveSolver; run tests.
- [x] 2. Interface: implement responsive shell, canvas rendering, eight presets, source and numerical controls; run solver tests and syntax check.
- [x] 3. Editing and probes: implement continuous strokes, movable/editable structures/sources, phased arrays, sampled waveforms, scene import/export and local save/restore; validate browser flows.
- [x] 4. Browser QA: use version-matched agent-browser core and dogfood workflows. Test desktop 1280×800 and mobile 390×844, mouse/keyboard/pointer inputs, presets, material changes, probes, pause/step/clear/reset, stability guard, diagnostics, persistence, file:// startup and zero external requests. Reproduce/fix/retest observed failures.
- [x] 5. Review: review requirements and numerical limitations, run regression checks, capture logs/screenshots, complete validation.md and delivery note.

## Review focus

1. Large requested timestep / high speed / fast medium must remain stable.
2. Pointer strokes must remain continuous, including out-of-canvas release and touch-sized controls.
3. Changing resolution must retain scene geometry and clearly clear the field.
4. Probe histories must sample field data, freeze when paused, and reset when cleared.
5. Invalid scene imports must show an error without corrupting the active scene.

## Progress

- Read installed skills: using-superpowers, brainstorming, writing-plans, executing-plans, test-driven-development, verification-before-completion; agent-browser stub and CLI version 0.31.1 core and dogfood.
- User's end-to-end instruction supersedes skill approval handoffs; retain design/testing discipline.
- Delivered a self-contained numerical laboratory, all eight presets, twelve tools, six diagnostics and live sampled probes.
- Read-only review identified three issues; reproduced, fixed and retested them. Additional phase, keyboard and line-resolution regressions also pass after fixes.
- Nine final solver checks and actual offline file:// desktop/mobile workflows pass. Download coverage passes in Chrome 152; Chrome 143 browser cancellation remains an environment block.
- Complete steps, commands, screenshots, logs and remaining coverage are recorded in validation.md.
