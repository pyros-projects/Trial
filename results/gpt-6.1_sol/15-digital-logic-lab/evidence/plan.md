# Digital Logic Lab — design and execution plan

The user explicitly requests one uninterrupted end-to-end run. All design and implementation choices are made within that authorization. The supplied workspace is empty and is not a Git checkout; delivery stays here, without a build step or product dependency.

## Design

One self-contained `index.html`: embedded CSS, SVG artwork, UI, and JavaScript. Separate logical units inside its script are a component catalog, bit-vector logic and event scheduler, example builders, editor/history, instruments, persistence/validation, and rendering. Signals use numbers plus X (unknown) and Z (high impedance); missing inputs resolve to Z, conflicting drivers to X. The queue reevaluates only affected components, with a bounded settling budget. Sequential components sample on rising edges after the previous combinational state settles. A tiny 4-bit accumulator CPU is composed of a clock, counter/program counter, instruction ROM, decoder/control, accumulator register, ALU, and output register; no autonomous CPU component bypasses wires.

The interface is a cream technical workbench with mint signal accents, a searchable component rail, pan/zoom SVG canvas, property inspector, and a live waveform drawer. Pointer interaction and keyboard shortcuts share the same editing/history operations. All imports are schema validated and interpreted as data. Named saves and autosave use localStorage with graceful storage failure handling.

## Tasks / verification

1. [x] Engine and semantics. Write failing Node behavioral checks before implementing: all four half-adder rows, width mismatch, conflicting/floating signals, inversion feedback containment, counter edges/reset, register hold, CPU program, truth table restores live state, safe import. Extract the real embedded engine script in the test harness, outside the artifact.
2. [x] SVG editor and visual design. Palette, ports, interactive wiring, drag/snap, selection/multi-selection, pan/zoom/minimap, context menu, history/clipboard, inspector, responsive panels, shortcuts and settings.
3. [x] Instruments and examples. Analyzer samples from simulation, inspect/cursor and zoom, CSV/VCD export; marked input/output exhaustive table; all nine editable presets and coherent CPU.
4. [x] Persistence and exports. Validated JSON, project saves/autosave, compact URL fragment, SVG/PNG exports, direct-file compatibility.
5. [x] Actual browser verification using agent-browser 0.31.1, its core and dogfood workflow. Desktop 1280×800 and narrow 390×844, pointer and keyboard editing, gate/wire/toggle workflow, sequential step/run/pause/reset and waveform agreement, truth table, undo/redo/delete, invalid wiring and oscillation, save/load/import/export, pan/zoom, diagnostics and external-network isolation. Save screenshots, logs, exact commands, failures/fixes/retests in validation.md.

## Review focus

- Unknowns and feedback must terminate without arbitrary values.
- Clock edges must sample previous settled data across connected sequential components.
- History, clipboard, and resize must preserve real topology.
- Imported text/labels must render as text, and malformed files must not corrupt the circuit.
- Mobile gestures and panel navigation must leave controls usable.

## Execution ledger

- Baseline: no prior implementation, no Git repository, installed agent-browser available; no product dependencies installed.
- Design review: consistent with user brief; native SVG chosen for crisp ports, accessibility, export, and efficient hundreds-component rendering.
- Task 1: engine implemented; RED → first run 15/16 → reset-edge fix → GREEN 16/16. All nine presets validate and settle; CPU outputs follow the connected LDI/OUT/ADD/OUT program.

- Tasks 2–4: complete SVG editor, all components/presets and instruments, validated persistence/imports and vector/raster/waveform/compact exports. The application remains one self-contained index.html.
- Task 5: direct-file browser validation with external HTTP(S) blocked; full desktop and narrow workflows, keyboard/pointer and genuine CDP touch, 510-component invalidation fixture, all curated preset behavior, saved projects and exported-file round trips. Evidence includes honest RED/tool-harness adjustments and final passes.
- Independent read-only review found five important issues. Each was reproduced, fixed, and retested; buffered-clock and paused-recording behavioral regressions expanded the real-engine suite to 19/19.
- Final keyboard, truth fixed-source invalidation, and camera-independent export repairs passed targeted browser regressions. Full delivery record and practical limits are in validation.md. No Git checkout or commit step applies to this filesystem delivery.
