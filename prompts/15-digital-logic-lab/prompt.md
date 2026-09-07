# Digital Logic and Tiny-CPU Laboratory

## Agentic development workflow

Build the complete application in one end-to-end agentic run. You may use the filesystem, shell, dependency tools, compilers, linters, tests, documentation, browser automation, and debugging tools from the beginning, within the permissions and budget assigned by the harness. Plan, implement incrementally, execute, inspect, diagnose, and improve your work throughout development. No previous implementation is assumed. Do not stop at a proposal, scaffold, screenshot, or partially connected demo.

Use the installed browser automation skill `agent-browser` to validate your work. Read the installed skill and its version-matched core workflow before use; consult its exploratory-testing workflow when available. If this capability is genuinely unavailable, use another available real-browser automation tool, record the substitution, and state any coverage that remains blocked. Do not fabricate successful tool use or let a missing optional tool prevent useful work with the tools you do have. The evaluator records tool availability separately from implementation quality.

## Validation

Exercise the actual main workflow using browser navigation, labeled controls, pointer and keyboard input, and screenshots. Merely loading the page, inspecting source code, or observing a DOM element does not establish that a feature works. For Canvas, WebGL, audio, games, and other non-DOM state, perform real interactions and inspect both rendered output and relevant live diagnostics. Check the browser console, uncaught errors, failed requests, and meaningful application state.

Check normal desktop and narrow viewports (at least 1280 x 800 and 390 x 844), input continuity, primary controls, error states, navigation, and any required pause/reset, import/export, or persistence behavior. Reproduce observed failures, fix their cause, and repeat the failed flow plus a compact regression test after material changes. Run the task-specific checks below against genuine application behavior. Do not modify benchmark requirements, supplied fixtures, expected results, or evaluator code to make a test pass.

Keep evidence in a sibling `evidence/` directory: an agent-authored `validation.md` with the exact steps and commands, observed results, failures, relevant screenshots/logs, fixes, and retest outcomes. Use pass, fail, blocked, or not-run honestly; a blocked check is not a pass. Do not write or invent an evaluator-owned score or report. End within the assigned budget with the best working implementation and an explicit account of remaining limitations.

### Standalone HTML delivery and runtime checks

Write the final application to `index.html` in the working directory. The delivered application must remain one self-contained file with the original runtime/dependency restrictions; development tools, test scripts, and a temporary local HTTP server for browser inspection are allowed and are not runtime dependencies of the delivered artifact. Keep evidence and test harnesses outside `index.html`.

Verify that opening the delivered file directly works as required, and that it does not fetch external assets or services. If your browser tool only supports local HTTP, also inspect the artifact's dependency assumptions, record the direct-file check as blocked rather than passed, and preserve direct-file compatibility. When checking via local HTTP, block external internet but leave that local server reachable; test without external cached resources. For audio, explicitly enable playback with a user gesture. Do not claim audio quality was heard when only meters or audio state were inspected.

## Application requirements
Create a polished, interactive digital-logic and tiny-CPU construction laboratory that runs entirely inside a single self-contained `index.html` file, with all HTML, CSS, JavaScript, simulation code, controls, diagrams, and visual assets embedded directly in that file and with no build process, server, external libraries, frameworks, imports, image files, fonts, or network dependencies.

Provide a graphical circuit editor with a zoomable and pannable workspace, component palette, type-aware input and output ports, wires, snapping, selection, drag, duplicate, multi-select, delete, undo, redo, copy, paste, and a property inspector. Wire creation must be interactive and connected to actual simulation ports; wires may be routed automatically or visually smoothed but must remain legible when components move.

Include at least input switches, momentary buttons, constants, LEDs or output probes, NOT, AND, OR, XOR, NAND, NOR, buffers, tri-state or enable gates, multiplexers, decoders, adders, comparators, clocks, D latches or flip-flops, registers, counters, RAM or small memory, and configurable bus splitters or joiners. Components must support meaningful bit widths where appropriate, with clear validation of incompatible connections.

Implement an actual digital simulation with stable propagation, event or tick scheduling, combinational settling, sequential clock edges, reset behavior, unknown or high-impedance state where practical, and detection or containment of non-settling combinational loops. The simulation must not simply recompute decorative labels without honoring connectivity and component semantics.

Allow manual stepping by propagation event and by clock tick, continuous clock execution at adjustable speed, pause, reset, and deterministic initialization. Display unresolved, floating, conflicting, or oscillating signals clearly instead of freezing or silently choosing arbitrary values.

Provide a logic analyzer. The user must be able to attach named probes to wires or ports and see a scrolling waveform aligned to clock ticks or simulation time, zoom the time axis, inspect values, and export captured samples as CSV or a common textual waveform representation. Probe data must originate from the live simulation.

Provide automatic truth-table generation for a selected combinational subcircuit with a reasonable number of input bits. Allow the user to mark inputs and outputs, enumerate combinations, detect non-settling rows, and optionally derive or display a simplified Boolean expression or Karnaugh-map-like summary.

Include curated editable examples for half adder, full adder, multiplexer, SR latch, edge-triggered register, binary counter, small arithmetic logic unit, memory test, and a complete tiny 4-bit or 8-bit CPU. The CPU preset must include clock, program counter, instruction or control logic, registers, ALU, memory, and visible program execution for a short built-in program such as counting, summing, or drawing values to an output display. It may be simplified, but its visible state must arise from the connected circuit simulation.

Provide controls for clock speed, propagation delay model, simulation step limit, default bit width, grid and snap, wire style, value radix, theme, animation, and diagnostic overlays. Include overlays or inspector views for component evaluation order, dirty-event queue, clock domains, bus values, fan-out, and loop detection.

Render the editor with intentional technical polish: crisp scalable components, animated signal flow or value color, readable labels at varying zoom, minimap, alignment guides, compact tooltips, contextual menus, and clear focus and keyboard shortcuts. Keep logic-state colors distinguishable and provide a high-contrast or color-blind-friendly option.

Support exporting and importing complete circuits as validated JSON, local autosave with named projects, SVG or PNG export of the circuit, and a shareable compact representation where practical. Imported circuits must not execute arbitrary code.

The application must adapt to browser resizing, support high-DPI displays, remain usable with mouse and touch or pointer input, handle large circuits with hundreds of components through efficient invalidation or event processing, and avoid losing wires or selection state during resize.

Display a compact live overlay containing frames per second, component and wire counts, pending events, clock tick and frequency, propagation iterations, selected signal value, loop or contention warnings, active tool, and pause state.

Use defaults that open a small functioning circuit and make its signal flow immediately understandable. Treat circuit semantics, propagation correctness, sequential behavior, editor ergonomics, waveform accuracy, CPU coherence, robustness, export safety, and completeness of the required feature set as benchmark criteria.

---

# Public validation checks: Digital Logic and Tiny-CPU Laboratory

Build or modify a switch-to-gate-to-output circuit, connect wires through real ports, toggle inputs, and confirm correct propagated output. Load a clocked counter, register, or tiny-CPU preset and verify state changes across manual and running clock ticks while waveform probes record the same signals. Test undo and redo, selection and deletion, an invalid connection or oscillating loop, truth-table generation for a combinational subcircuit, save and load, pan and zoom, and narrow-viewport editing.

Perform these checks against the actual application. Record observed outcomes; do not hard-code these sequences or confuse an attractive screenshot with correct state.


## Completion

Leave the finished `index.html` and the evidence directory on disk. Return a concise delivery note with the artifact path, what you actually tested, and any unresolved failures or blocked checks. Do not paste the whole implementation into the final message when filesystem delivery is available.
