# Digital Logic Laboratory implementation plan

The supplied request authorizes an end-to-end architectural implementation. All runtime code lives in `index.html`; documentation, tests, and screenshots live in the sibling `evidence/` directory.

Design: an SVG circuit editor with accessible ports, a compiled connectivity graph and deterministic propagation queue, explicit numeric/X/Z signals, simultaneous clock-edge state capture, and live analyzer samples. Plain JavaScript, embedded CSS and SVG, no dependencies. Named local projects and schema-validated JSON preserve editable circuits. Curated examples use the same component semantics, including a connected 4-bit CPU with PC, ROM, control decoder, accumulator, ALU, and output register.

- [x] Write failing simulation tests for connected gates, bus validation, simultaneous sequential capture, counter, CPU execution, loops, and JSON validation.
- [x] Implement component registry, event simulator, reset and preset graphs; pass engine tests.
- [x] Build responsive editor, palette, inspector, actual port wiring, editing history, pan/zoom, selection and minimap.
- [x] Connect analyzer, truth table, project persistence, imports and exports, settings and diagnostics.
- [x] Validate through agent-browser at 1280×800 and 390×844, direct-file and isolated local HTTP; inspect screenshots and live signals.
- [x] Reproduce and fix failures, rerun affected workflows and compact regression; record exact evidence and limitations.

Validation expectations are derived from Boolean algebra and instruction semantics: half-adder outputs 00,10,10,01; counter increments modulo 16 only at rising edges; the CPU built-in program loads 0, emits 0, then repeatedly adds 1 and emits the accumulator. Invalid port direction/width and malformed imports are rejected without graph mutation. Combinational oscillation is bounded and reported.
